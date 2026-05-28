import * as vscode from 'vscode';
import { OllamaClient, OllamaMessage, OllamaToolCall } from './OllamaClient';
import { StreamHandler } from './StreamHandler';
import { Logger } from '../utils/Logger';
import { ToolRegistry } from '../tools/ToolRegistry';
import { generateSystemPrompt } from './SystemPrompt';
import { MessageRouter, RoutingResult } from '../classification/MessageRouter';
import type { RagService } from '../rag/RagService';
import type { SpecContext } from '../spec/types';
import { getConfiguredModel } from '../config/ModelConfig';
import { commandTracker } from '../tools/CommandExecutionTracker';
import { SessionContextInjector } from './SessionContextInjector';
import { ContextManager } from '../spec/ContextManager';

/**
 * Agent Loop Update Types
 */
export interface AgentLoopUpdate {
  type:
    | 'iteration'
    | 'chunk'
    | 'toolStart'
    | 'toolComplete'
    | 'toolError'
    | 'complete'
    | 'terminalOutput'
    | 'classification'
    | 'maxIterations';
  iteration?: number;
  thinking?: string;
  content?: string;
  toolCalls?: OllamaToolCall[];
  toolCall?: OllamaToolCall;
  result?: any;
  error?: string;
  message?: string;
  done?: boolean;
  duration?: number; // Tool execution duration in milliseconds
  toolExecutionId?: string; // Unique ID for tracking tool execution lifecycle
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  terminalData?: {
    command: string;
    cwd?: string;
    stdout: string;
    stderr: string;
    exitCode: number;
    timestamp: number;
  };
  context?: {
    lastThinking?: string;
    lastContent?: string;
    recentTools?: string[];
    totalIterations?: number;
  };
  classification?: RoutingResult; // Message classification result
}

/**
 * Production-ready Agent Loop for ForgeAI
 * Implements autonomous multi-step tool execution with streaming support
 * Follows Requirements 18.1-18.5 and design.md Agent Loop specification
 */
export class AgentLoop {
  private isRunning = false;
  private shouldStop = false;
  private messageRouter = new MessageRouter(); // Message classification system

  // Track tool failures to detect loops and force alternative approaches
  private toolFailureCounts = new Map<string, number>();
  private readonly maxToolRetries = 2; // Max failures per tool before forcing alternative

  // Track web research URLs to enforce mandatory fetchPage calls
  private webResearchUrls = new Set<string>();
  private fetchedPageUrls = new Set<string>();
  private webResearchCompleted = false;

  // Track context limit reached for multi-agent handoff
  private contextLimitReached = false;
  private contextSummary = '';
  private lastThreeMessages: OllamaMessage[] = [];

  constructor(
    private readonly ollamaClient: OllamaClient,
    private readonly logger: Logger,
    private readonly toolRegistry?: ToolRegistry,
    private readonly ragService?: RagService,
    private readonly conversationMemory?: any,
    private readonly sessionContextInjector?: SessionContextInjector,
    private readonly contextManager?: ContextManager
  ) {}

  /**
   * Execute agent loop with tool calling
   * @param initialMessages Initial conversation messages
   * @param onUpdate Callback for real-time updates
   * @param tools Available tools for the agent
   * @param model Ollama model to use (default: from ModelConfig)
   */
  public async execute(
    initialMessages: OllamaMessage[],
    onUpdate: (update: AgentLoopUpdate) => void,
    tools: any[] = [],
    model: string = getConfiguredModel(),
    options?: { specContext?: SpecContext; conversationId?: string }
  ): Promise<void> {
    this.isRunning = true;
    this.shouldStop = false;

    // Reset web research tracking for this session
    this.webResearchUrls.clear();
    this.fetchedPageUrls.clear();
    this.webResearchCompleted = false;

    // Get workspace context for system prompt and classification
    const workspaceContext = await this.gatherWorkspaceContext();

    // Get language preference from VS Code settings
    const config = vscode.workspace.getConfiguration('forgeai');
    const language = config.get<string>('language', 'English');

    // Skip classification — always use tools and the base system prompt.
    // The model decides autonomously when tools are needed.
    const userMessage = initialMessages.find((m) => m.role === 'user')?.content;

    // Always keep ragChunks available for the final systemPrompt as well.
    const ragChunks: Array<{ text: string; score?: number; url?: string; sourceId?: string }> = [];

    if (userMessage) {
      // Retrieve RAG context once per user message (MVP)
      const fetched =
        this.ragService && userMessage
          ? await this.ragService.retrieve({ query: userMessage, topK: 6 })
          : [];

      ragChunks.push(...fetched);
    }

    // Always use the base system prompt — no category overrides.
    const messages = [...initialMessages];
    let systemPrompt = generateSystemPrompt(
      workspaceContext,
      language,
      ragChunks,
      options?.specContext
    );

    // Inject session context if available (last 3 messages + summary from previous session)
    if (this.sessionContextInjector && options?.conversationId) {
      const sessionContext = await this.sessionContextInjector.getSessionContext(
        options.conversationId
      );
      if (sessionContext) {
        systemPrompt += `\n\n${sessionContext}`;
      }
    }

    // Inject conversation memory to prevent redundant operations
    if (this.conversationMemory) {
      const memorySummary = this.conversationMemory.getMemorySummary(
        options?.conversationId || 'default'
      );
      if (memorySummary.trim().length > 0) {
        systemPrompt += `\n\n## What You've Already Done in This Conversation\n\n${memorySummary}`;
      }
    }

    if (messages.length === 0 || messages[0].role !== 'system') {
      messages.unshift({
        role: 'system',
        content: systemPrompt,
      });
    } else {
      // Replace existing system prompt with category-specific one
      messages[0] = {
        role: 'system',
        content: systemPrompt,
      };
    }

    // Inject error resolution priority at the start
    messages.push({
      role: 'system',
      content: `## ERROR RESOLUTION PROTOCOL

🚨 CRITICAL PRIORITY: Solving errors is your #1 job. Never leave errors unresolved.

When a command fails:
1. READ the error message carefully
2. UNDERSTAND what went wrong and where
3. FIND the root cause
4. APPLY a fix to the code/config
5. VERIFY the fix works by running the command again
6. ONLY THEN move forward

If a command fails multiple times:
- Do NOT keep running the same command
- Do NOT ignore the error
- STOP and analyze what's wrong
- Try a different approach
- Test each fix before moving on

Remember: Wasting time on unresolved errors costs credits. Solve them right the first time.`,
    });

    // Always use all available tools — the model decides when to call them.
    let effectiveTools = tools;

    let iteration = 0;
    let lastRequestTime = 0; // Track last request time for rate limiting
    const MIN_REQUEST_INTERVAL = 500; // Minimum 500ms between requests

    try {
      while (!this.shouldStop) {
        iteration++;
        onUpdate({ type: 'iteration', iteration });

        // Rate limiting: Wait if we're making requests too quickly
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
          const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        lastRequestTime = Date.now();

        // Get response from Ollama with streaming
        const streamHandler = new StreamHandler(this.logger);

        try {
          const result = await this.ollamaClient.chat({
            model,
            messages,
            stream: true,
            think: true,
            tools: effectiveTools,
            // Do NOT set num_ctx here — let the model use its full context window.
            // The applySlidingWindow in OllamaClient handles context budget.
          });

          // Type guard: result should be AsyncGenerator when stream=true
          if (Symbol.asyncIterator in result) {
            // Process stream chunks
            for await (const chunk of result) {
              if (this.shouldStop) {
                break;
              }

              streamHandler.processChunk(chunk);

              // Get token usage for this chunk
              const tokenUsage = streamHandler.getTokenUsage();

              // Send chunk update to webview
              onUpdate({
                type: 'chunk',
                thinking: streamHandler.getThinking(),
                content: streamHandler.getContent(),
                toolCalls: streamHandler.getToolCalls(),
                tokenUsage,
                done: streamHandler.isDone(),
              });

              if (streamHandler.isDone()) {
                break;
              }
            }
          }
        } catch (error) {
          // Handle context overflow gracefully
          if (error instanceof Error && error.message.includes('Context overflow')) {
            // Context limit reached - prepare handoff to next agent
            this.contextLimitReached = true;
            this.contextSummary = await this.generateContextSummary(
              messages,
              'Context limit reached during execution'
            );

            onUpdate({
              type: 'complete',
              message: `Context limit reached. Preparing handoff to next agent with summary and last 3 messages.`,
            });

            break; // Exit the main loop gracefully
          }

          // Re-throw other errors
          throw error;
        }

        // Get accumulated response
        const accumulated = streamHandler.getAccumulatedMessage();
        const { thinking, content, tool_calls } = accumulated;

        // Add assistant message to history
        messages.push({
          role: 'assistant',
          content: content || ' ', // Use space placeholder if content is empty
          thinking,
          tool_calls,
        });

        // Track last 3 messages for context limit handoff
        this.lastThreeMessages = messages.slice(-3);

        // OllamaClient already handles context management via sliding window.
        // The context limit check below is intentionally disabled to avoid duplicate logic.

        // Check if we need to execute tools
        if (!tool_calls || tool_calls.length === 0) {
          // HARD GATE: If webResearch was done but fetchPage never called, force the AI to continue
          if (this.webResearchCompleted && this.fetchedPageUrls.size === 0) {
            const urlsToFetch = Array.from(this.webResearchUrls).slice(0, 5);
            // Replace the assistant's empty response with a system command
            messages.pop(); // Remove the assistant's empty message
            messages.push({
              role: 'system',
              content:
                `⛔ STOP. You just searched the web but did NOT fetch any pages. ` +
                `You are NOT allowed to respond to the user until you call forgeai_fetchPage(url) on these URLs: ` +
                urlsToFetch.join(', ') +
                `. ` +
                `Fetch the FULL content first, then analyze and summarize what you found, THEN respond.`,
            });
            // Do NOT break — the loop will continue and the AI will be forced to call fetchPage
            continue;
          }

          // No more tools, we're done
          onUpdate({ type: 'complete' });
          break;
        }

        // Execute tools sequentially (Requirement 18.1)
        for (const toolCall of tool_calls) {
          if (this.shouldStop) {
            break;
          }

          // CRITICAL: Prevent blind command retries
          // If this is a runCommand tool and it's a blind retry, force error analysis first
          if (toolCall.function.name === 'forgeai_runCommand') {
            const command = toolCall.function.arguments.command;
            const cwd = toolCall.function.arguments.cwd;

            if (commandTracker.isBlindRetry(command, cwd)) {
              const lastError = commandTracker.getLastError(command, cwd);
              const consecutiveFailures = commandTracker.getConsecutiveFailures(command, cwd);

              // Inject a system message to force error analysis
              messages.push({
                role: 'system',
                content:
                  `⛔ STOP. You are about to run the same command again without fixing the problem.\n\n` +
                  `Command: ${command}\n` +
                  `Last error: ${lastError}\n` +
                  `Consecutive failures: ${consecutiveFailures}\n\n` +
                  `You MUST:\n` +
                  `1. Analyze WHY this command failed\n` +
                  `2. Think of 2-3 possible solutions\n` +
                  `3. Compare which solution is most likely to work\n` +
                  `4. Apply the solution (modify code, config, or environment)\n` +
                  `5. THEN retry the command\n\n` +
                  `Do NOT just run the same command again. That wastes the user's credits.`,
              });

              // Skip this tool call and continue to next iteration
              // The AI will be forced to think and apply a fix first
              continue;
            }
          }

          const toolStartTime = Date.now(); // Track start time
          const toolExecutionId = `${toolCall.function.name}-${toolStartTime}`; // Generate unique ID once
          onUpdate({ type: 'toolStart', toolCall, toolExecutionId });

          try {
            // Execute tool using ToolRegistry (Task 4.1)
            let result: any;

            if (this.toolRegistry) {
              // Use ToolRegistry to execute tool
              result = await this.toolRegistry.executeTool(
                toolCall.function.name,
                toolCall.function.arguments
              );
            } else {
              // Fallback: placeholder result (for backward compatibility)
              result = {
                success: true,
                message: `Tool ${toolCall.function.name} executed (placeholder - no ToolRegistry)`,
                arguments: toolCall.function.arguments,
              };
            }

            const toolDuration = Date.now() - toolStartTime; // Calculate duration

            // Track web research URLs and fetchPage calls
            if (
              toolCall.function.name === 'forgeai_webResearch' ||
              toolCall.function.name === 'forgeai_webSearch'
            ) {
              this.webResearchCompleted = true;
              // Extract URLs from result
              try {
                const resultObj: Record<string, unknown> =
                  typeof result === 'string'
                    ? (JSON.parse(result) as Record<string, unknown>)
                    : (result as Record<string, unknown>);
                const results =
                  (resultObj.results as Array<{ url?: string }>) ||
                  ((resultObj.data as Record<string, unknown>)?.results as Array<{
                    url?: string;
                  }>) ||
                  [];
                for (const r of results) {
                  if (r.url) this.webResearchUrls.add(r.url);
                }
              } catch {
                // Ignore parse errors
              }
            }
            if (toolCall.function.name === 'forgeai_fetchPage') {
              try {
                const resultObj: Record<string, unknown> =
                  typeof result === 'string'
                    ? (JSON.parse(result) as Record<string, unknown>)
                    : (result as Record<string, unknown>);
                const url = resultObj.url as string | undefined;
                if (url) this.fetchedPageUrls.add(url);
              } catch {
                // Ignore parse errors
              }
            }

            // Check if this is a terminal command execution (Task 4.9)
            if (toolCall.function.name === 'forgeai_runCommand' && result) {
              const exitCode = result.exitCode || 0;
              const stdout = result.stdout || '';
              const stderr = result.stderr || '';
              const command = result.command || toolCall.function.arguments.command;
              const cwd = result.cwd || toolCall.function.arguments.cwd;

              // Track command execution for blind retry detection
              commandTracker.recordExecution(command, cwd, exitCode, stdout, stderr, toolDuration);

              // CRITICAL: If command FAILED (exitCode !== 0), STOP and force error diagnosis
              if (exitCode !== 0) {
                // Command failed - inject mandatory error diagnosis gate
                messages.push({
                  role: 'tool',
                  name: toolCall.function.name,
                  content: JSON.stringify({
                    command,
                    cwd,
                    exitCode,
                    stdout,
                    stderr,
                    success: false,
                  }),
                });

                // Inject system message to force error diagnosis BEFORE any further action
                messages.push({
                  role: 'system',
                  content: `⛔ CRITICAL ERROR - STOP IMMEDIATELY

Command FAILED with exit code ${exitCode}:
${command}

STDOUT:
${stdout || '(empty)'}

STDERR:
${stderr || '(empty)'}

🚨 ERROR RESOLUTION IS #1 PRIORITY 🚨

You MUST NOT proceed until this error is SOLVED. Follow these steps:

1. **ANALYZE THE ERROR**
   - What does the error message say?
   - Where did it occur (file, line, function)?
   - What is the root cause?

2. **FIND THE SOLUTION**
   - What code/config needs to change?
   - What is the fix?
   - Why will this fix work?

3. **APPLY THE FIX**
   - Modify the code/config
   - Verify the fix is correct
   - Do NOT just run the same command again

4. **VERIFY THE FIX**
   - Run the command again
   - Confirm it succeeds (exit code 0)
   - If it still fails, go back to step 1

DO NOT MOVE FORWARD UNTIL THIS ERROR IS COMPLETELY RESOLVED.
DO NOT SKIP THIS STEP.
DO NOT RUN THE SAME COMMAND TWICE WITHOUT FIXING THE PROBLEM.`,
                });

                // Skip adding to tool results - force the AI to think and fix first
                onUpdate({
                  type: 'terminalOutput',
                  terminalData: {
                    command,
                    cwd,
                    stdout,
                    stderr,
                    exitCode,
                    timestamp: Date.now(),
                  },
                });

                // Continue loop - AI will be forced to analyze and fix before proceeding
                continue;
              }

              // Command succeeded - reset the fix flag
              commandTracker.resetFixFlag(command, cwd);

              onUpdate({
                type: 'terminalOutput',
                terminalData: {
                  command,
                  cwd,
                  stdout,
                  stderr,
                  exitCode,
                  timestamp: Date.now(),
                },
              });
            }

            // Add tool result to message history (Requirement 18.2)
            // Smart truncation based on content type
            const MAX_TOOL_RESULT_CHARS = 12_000;
            let toolResultJson = JSON.stringify(result);

            if (toolResultJson.length > MAX_TOOL_RESULT_CHARS) {
              // Try to parse as JSON for smart truncation
              try {
                const parsed = JSON.parse(toolResultJson);

                // If it's a file read result, keep first 50 lines + last 50 lines
                if (
                  typeof parsed === 'object' &&
                  parsed.content &&
                  typeof parsed.content === 'string'
                ) {
                  const lines = parsed.content.split('\n');
                  if (lines.length > 100) {
                    const first50 = lines.slice(0, 50).join('\n');
                    const last50 = lines.slice(-50).join('\n');
                    parsed.content = `${first50}\n\n... [${lines.length - 100} lines omitted] ...\n\n${last50}`;
                    toolResultJson = JSON.stringify(parsed);
                  }
                }
              } catch {
                // Not JSON, use simple truncation
              }

              // Final check: if still too large, truncate
              if (toolResultJson.length > MAX_TOOL_RESULT_CHARS) {
                toolResultJson =
                  toolResultJson.slice(0, MAX_TOOL_RESULT_CHARS) +
                  `\n... [truncated — ${toolResultJson.length - MAX_TOOL_RESULT_CHARS} chars omitted]`;
              }
            }

            messages.push({
              role: 'tool',
              name: toolCall.function.name,
              content: toolResultJson,
            });

            // Reset failure count on success — the tool works again
            this.toolFailureCounts.delete(toolCall.function.name);

            onUpdate({
              type: 'toolComplete',
              toolCall,
              result,
              duration: toolDuration,
              toolExecutionId,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const toolDuration = Date.now() - toolStartTime; // Calculate duration even on error

            // Track failures to detect loops
            const toolKey = `${toolCall.function.name}`;
            const currentFails = (this.toolFailureCounts.get(toolKey) || 0) + 1;
            this.toolFailureCounts.set(toolKey, currentFails);

            // Build error content with smart hints if this tool keeps failing
            let errorContent = JSON.stringify({ error: errorMessage });

            if (currentFails >= this.maxToolRetries) {
              // Force the AI to try a completely different approach
              const alternatives = this.getAlternativeTools(toolCall.function.name);
              errorContent = JSON.stringify({
                error: errorMessage,
                warning: `This tool has failed ${currentFails} times. Do NOT retry it. Try a different approach.`,
                suggestions: alternatives,
              });

              // Inject a system reminder about exploration
              messages.push({
                role: 'system',
                content: `REMINDER: ${toolCall.function.name} keeps failing. Use a different tool. ${alternatives.join(' ')}`,
              });
            }

            // Add error result to message history
            messages.push({
              role: 'tool',
              name: toolCall.function.name,
              content: errorContent,
            });

            onUpdate({
              type: 'toolError',
              toolCall,
              error: errorMessage,
              duration: toolDuration,
              toolExecutionId,
            });
          }
        }

        // Log after tool execution loop completes — kept for debugging tool count issues
        // (no-op info removed; shouldStop check below is the only logic here)

        // Enforce fetchPage after webResearch: if webResearch was done but no fetchPage
        // has been called yet, inject a system reminder before the next LLM call
        if (
          this.webResearchCompleted &&
          this.fetchedPageUrls.size === 0 &&
          effectiveTools.length > 0
        ) {
          const urlsToFetch = Array.from(this.webResearchUrls).slice(0, 5);
          if (urlsToFetch.length > 0) {
            const reminder =
              `⚠️ CRITICAL REMINDER: You called webResearch/webSearch but have NOT called forgeai_fetchPage yet. ` +
              `You MUST call forgeai_fetchPage(url) on these critical URLs BEFORE responding to the user: ` +
              urlsToFetch.join(', ') +
              `. The search snippets are NOT enough — you need the FULL page content for accurate specs and plans.`;
            messages.push({ role: 'system', content: reminder });
          }
        }

        // Prevent duplicate web searches: if webResearch was already done,
        // temporarily disable webSearch/webResearch tools until fetchPage is used
        if (
          this.webResearchCompleted &&
          this.fetchedPageUrls.size === 0 &&
          effectiveTools.length > 0
        ) {
          const before = effectiveTools.length;
          effectiveTools = effectiveTools.filter(
            (t: { function?: { name?: string } }) =>
              t.function?.name !== 'forgeai_webSearch' && t.function?.name !== 'forgeai_webResearch'
          );
          if (effectiveTools.length < before) {
            // webSearch/webResearch disabled to prevent duplicate searches
          }
        }

        // Continue loop with updated message history (Requirement 18.3)
      }

      // Intentionally no max-iteration enforcement.
      // Loop terminates naturally when the model emits no tool calls,
      // or when the user calls stop().
    } finally {
      this.isRunning = false;
      this.shouldStop = false;
    }
  }

  /**
   * Stop the agent loop
   */
  public stop(): void {
    this.shouldStop = true;
  }

  /**
   * Check if agent loop is currently running
   */
  public isExecuting(): boolean {
    return this.isRunning;
  }

  /**
   * Get message classification metrics
   */
  public getClassificationMetrics() {
    return this.messageRouter.getMetrics();
  }

  /**
   * Clear message routing history
   */
  public clearRoutingHistory(): void {
    this.messageRouter.clearHistory();
  }

  /**
   * Get message routing history
   */
  public getRoutingHistory() {
    return this.messageRouter.getHistory();
  }

  /**
   * Check if context limit was reached
   */
  public isContextLimitReached(): boolean {
    return this.contextLimitReached;
  }

  /**
   * Get context summary for handoff to next agent
   */
  public getContextSummary(): string {
    return this.contextSummary;
  }

  /**
   * Get last 3 messages for handoff to next agent
   */
  public getLastThreeMessages(): OllamaMessage[] {
    return this.lastThreeMessages;
  }

  /**
   * Generate summary of current work for multi-agent handoff
   */
  private async generateContextSummary(
    messages: OllamaMessage[],
    lastContent: string
  ): Promise<string> {
    // Extract key information from recent messages
    const recentMessages = messages.slice(-10);
    const userMessages = recentMessages.filter((m) => m.role === 'user');
    const assistantMessages = recentMessages.filter((m) => m.role === 'assistant');

    // Build summary from last few exchanges
    const summary = `
## Work Summary

**Last Action:** ${lastContent.substring(0, 200)}...

**Recent Progress:**
${assistantMessages
  .slice(-3)
  .map((m) => `- ${m.content.substring(0, 100)}...`)
  .join('\n')}

**User Requests:**
${userMessages
  .slice(-3)
  .map((m) => `- ${m.content.substring(0, 100)}...`)
  .join('\n')}

**Continue with:** The next agent should continue from where this agent left off using the last 3 messages below.
`;

return summary;
  }

  /**
   * Get alternative tool suggestions when a tool keeps failing.
   * Returns specific guidance based on the failed tool type.
   */
  private getAlternativeTools(failedTool: string): string[] {
    const alternatives: Record<string, string[]> = {
      forgeai_readFile: [
        'Use forgeai_listDirectory(path) to see what files actually exist.',
        'Use forgeai_findFiles(pattern) with a wildcard to discover the correct file name.',
        'Use forgeai_searchInFiles(query) to find files containing specific text.',
      ],
      forgeai_writeFile: [
        'Use forgeai_readFile first to check if the file already exists.',
        'Use forgeai_listDirectory to verify the target directory exists.',
        'Use forgeai_createDirectory if the parent directory is missing.',
      ],
      forgeai_listDirectory: [
        'Use forgeai_findFiles("**/*") to list files recursively.',
        'Use forgeai_getFileStats to check if the path exists and what type it is.',
      ],
      forgeai_searchInFiles: [
        'Use forgeai_findFiles(pattern) to discover files by name first.',
        'Use forgeai_listDirectory to explore the directory structure.',
      ],
      forgeai_findFiles: [
        'Use forgeai_listDirectory(path) to see directory contents directly.',
        'Use forgeai_searchInFiles(query) to search by file content instead of name.',
      ],
      forgeai_runCommand: [
        'Use forgeai_getErrors() to see workspace errors that might explain the failure.',
        'Use forgeai_searchInFiles to find relevant files before running commands.',
      ],
      forgeai_browser_navigate: [
        'Use forgeai_webSearch(query) to get search results without a browser.',
        'Use forgeai_webResearch(topic) for deep web research.',
      ],
    };

    return (
      alternatives[failedTool] || [
        'Try a different tool that achieves the same goal.',
        'Use forgeai_listDirectory to explore the workspace.',
        'Use forgeai_findFiles to search for files by pattern.',
      ]
    );
  }

  /**
   * Gather workspace context for system prompt generation
   */
  private async gatherWorkspaceContext(): Promise<import('./SystemPrompt').WorkspaceContext> {
    // Check cache first (30 second TTL)
    if (this.conversationMemory) {
      const cached = this.conversationMemory.getCachedWorkspaceTree();
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {};
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;

    const openFiles = vscode.window.visibleTextEditors
      .map((editor) => vscode.workspace.asRelativePath(editor.document.uri))
      .filter((path) => !path.startsWith('..'));

    // Fetch workspace files for a compact tree (excluding noise folders, capped at 80)
    let workspaceFiles: string[] = [];
    try {
      const exclude =
        '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.next/**,**/coverage/**,**/.cache/**}';
      const uris = await vscode.workspace.findFiles('**/*', exclude, 80);
      workspaceFiles = uris.map((uri) => vscode.workspace.asRelativePath(uri)).sort();
    } catch {
      // Non-fatal — proceed without file tree
    }

    const workspaceTree = this.buildCompactTree(workspaceFiles, 60);

    const context = {
      workspacePath,
      openFiles,
      currentFiles: openFiles,
      workspaceFiles,
      workspaceTree,
    };

    // Cache for 30 seconds
    if (this.conversationMemory) {
      this.conversationMemory.setCachedWorkspaceTree(JSON.stringify(context));
    }

    return context;
  }

  /**
   * Build a compact, line-capped directory tree from relative file paths.
   * Deep or densely-populated directories collapse into summaries like:
   *   - components/ ... (12 sub-items, 34 files)
   */
  private buildCompactTree(paths: string[], maxLines = 60): string {
    interface TreeNode {
      [key: string]: TreeNode;
    }

    const tree: TreeNode = {};
    for (const p of paths) {
      const parts = p.split(/[\\/]/).filter(Boolean);
      if (parts.length === 0) {
        continue;
      }
      let node: TreeNode = tree;
      for (const part of parts) {
        if (!node[part]) {
          node[part] = {};
        }
        node = node[part];
      }
    }

    let lineCount = 0;
    const lines: string[] = [];

    const countFiles = (node: TreeNode): number => {
      let c = 0;
      for (const k of Object.keys(node)) {
        if (Object.keys(node[k]).length === 0) {
          c++;
        } else {
          c += countFiles(node[k]);
        }
      }
      return c;
    };

    const render = (node: TreeNode, indent = '', depth = 0) => {
      const entries = Object.keys(node).sort((a, b) => {
        const aIsDir = Object.keys(node[a]).length > 0;
        const bIsDir = Object.keys(node[b]).length > 0;
        if (aIsDir && !bIsDir) {
          return -1;
        }
        if (!aIsDir && bIsDir) {
          return 1;
        }
        return a.localeCompare(b);
      });

      for (let i = 0; i < entries.length; i++) {
        if (lineCount >= maxLines) {
          return;
        }
        const key = entries[i];
        const children = Object.keys(node[key]);
        const isFile = children.length === 0;

        if (isFile) {
          lines.push(`${indent}- ${key}`);
          lineCount++;
        } else {
          const fileCount = countFiles(node[key]);
          // Collapse deep or wide directories to stay within the line budget
          if (depth >= 2 && (children.length > 4 || fileCount > 6)) {
            lines.push(`${indent}- ${key}/ ... (${children.length} sub-items, ${fileCount} files)`);
            lineCount++;
          } else {
            lines.push(`${indent}- ${key}/`);
            lineCount++;
            render(node[key], indent + '  ', depth + 1);
          }
        }
      }
    };

    render(tree);
    if (paths.length > 0 && lineCount >= maxLines) {
      lines.push('... (tree truncated — use forgeai_listFiles to explore deeper)');
    }
    return lines.join('\n');
  }
}
