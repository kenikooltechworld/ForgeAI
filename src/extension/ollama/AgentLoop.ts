import * as vscode from 'vscode';
import { OllamaClient, OllamaMessage, OllamaToolCall } from './OllamaClient';
import { StreamHandler } from './StreamHandler';
import { Logger } from '../utils/Logger';
import { ToolRegistry } from '../tools/ToolRegistry';
import { generateSystemPrompt, getWorkspaceContext } from './SystemPrompt';
import { MessageRouter, RoutingContext, RoutingResult } from '../classification/MessageRouter';
import type { RagService } from '../rag/RagService';
import type { SpecContext } from '../spec/types';

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
    | 'maxIterations'
    | 'terminalOutput'
    | 'classification';
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
  // Backward-compatible default cap (older UI/webview assumes a warning when capped)
  private readonly defaultMaxIterations = 20; // Max iterations before stopping (Requirement 48.1, 48.2)
  private isRunning = false;
  private shouldStop = false;
  private messageRouter = new MessageRouter(); // Message classification system

  // Track tool failures to detect loops and force alternative approaches
  private toolFailureCounts = new Map<string, number>();
  private readonly maxToolRetries = 2; // Max failures per tool before forcing alternative

  constructor(
    private readonly ollamaClient: OllamaClient,
    private readonly logger: Logger,
    private readonly toolRegistry?: ToolRegistry,
    private readonly ragService?: RagService
  ) {}

  /**
   * Execute agent loop with tool calling
   * @param initialMessages Initial conversation messages
   * @param onUpdate Callback for real-time updates
   * @param tools Available tools for the agent
   * @param model Ollama model to use (default: gpt-oss:120b-cloud)
   */
  public async execute(
    initialMessages: OllamaMessage[],
    onUpdate: (update: AgentLoopUpdate) => void,
    tools: any[] = [],
    model: string = 'gpt-oss:120b-cloud',
    options?: { maxIterations?: number; specContext?: SpecContext } // undefined => unbounded (autonomous)
  ): Promise<void> {
    this.logger.info('Starting agent loop execution');
    this.logger.info(`Using model: ${model}`);
    this.isRunning = true;
    this.shouldStop = false;

    // Get workspace context for system prompt and classification
    const workspaceContext = await this.gatherWorkspaceContext();
    this.logger.info(
      `Workspace context: ${workspaceContext.workspacePath || 'none'}, ` +
        `${workspaceContext.currentFiles?.length || 0} recent files`
    );

    // Get language preference from VS Code settings
    const config = vscode.workspace.getConfiguration('forgeai');
    const language = config.get<string>('language', 'English');
    this.logger.info(`Language preference: ${language}`);

    // Classify the user's message if this is the first user message
    let routing: RoutingResult | undefined;
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
      this.logger.info(
        `RAG retrieval: ${fetched.length} chunk(s) fetched${this.ragService ? '' : ' (service not configured)'}`
      );

      const routingContext: RoutingContext = {
        userMessage,
        workspaceContext: {
          hasErrors: false, // TODO: Detect actual errors
          isEmpty: !workspaceContext.currentFiles?.length,
        },
        sessionHistory: [], // TODO: Add session history
      };

      // Generate base system prompt (optionally grounded with RAG and spec context)
      const baseSystemPrompt = generateSystemPrompt(
        workspaceContext,
        language,
        ragChunks,
        options?.specContext
      );

      // Route the message and get category-specific system prompt
      routing = this.messageRouter.route(routingContext, baseSystemPrompt);

      this.logger.info(
        `Message classified as: ${routing.classification.category} ` +
          `(confidence: ${routing.classification.confidence.toFixed(2)}) - ` +
          `${routing.classification.reasoning}`
      );

      // Send classification update to webview
      onUpdate({
        type: 'classification',
        classification: routing,
      });
    }

    // Prepare messages with appropriate system prompt.
    // IMPORTANT: Always pass ragChunks into the fallback generateSystemPrompt so
    // that the final system prompt is consistently grounded.
    const messages = [...initialMessages];
    const systemPrompt =
      routing?.systemPrompt ||
      generateSystemPrompt(workspaceContext, language, ragChunks, options?.specContext);

    if (messages.length === 0 || messages[0].role !== 'system') {
      messages.unshift({
        role: 'system',
        content: systemPrompt,
      });
      this.logger.info('Category-specific system prompt prepended to messages');
    } else {
      // Replace existing system prompt with category-specific one
      messages[0] = {
        role: 'system',
        content: systemPrompt,
      };
      this.logger.info('System prompt replaced with category-specific version');
    }

    // Adjust tool usage based on classification
    let effectiveTools = tools;

    if (routing) {
      if (!routing.shouldUseTool) {
        effectiveTools = []; // Disable tools for conversation/planning categories
        this.logger.info('Tools disabled based on message classification');
      }
    }

    let iteration = 0;
    let lastRequestTime = 0; // Track last request time for rate limiting
    const MIN_REQUEST_INTERVAL = 500; // Minimum 500ms between requests
    const maxIterations = options?.maxIterations ?? this.defaultMaxIterations;

    try {
      while (!this.shouldStop) {
        iteration++;
        if (iteration > maxIterations) {
          this.logger.warn(
            `Agent loop stopped after ${maxIterations} iterations to prevent infinite loops`
          );
          onUpdate({ type: 'maxIterations', iteration });
          break;
        }
        this.logger.info(`Agent loop iteration ${iteration}/${maxIterations}`);
        onUpdate({ type: 'iteration', iteration });

        // Rate limiting: Wait if we're making requests too quickly
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
          const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
          this.logger.info(`Rate limiting: waiting ${waitTime}ms before next request`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        lastRequestTime = Date.now();

        this.logger.info(
          `Sending to Ollama: model=${model}, messages=${messages.length}, tools=${effectiveTools.length}, think=true`
        );
        if (effectiveTools.length > 0) {
          this.logger.info(
            `Tool names being sent: ${effectiveTools.map((t: any) => t.function.name).join(', ')}`
          );
        } else {
          this.logger.info(
            'No tools being sent to Ollama (disabled by classification or not available)'
          );
        }

        // Get response from Ollama with streaming
        const streamHandler = new StreamHandler(this.logger);

        // Track tool calls made this session to enforce maxToolCalls limit
        const toolCallsMade = messages.filter(
          (m) => m.role === 'assistant' && m.tool_calls?.length
        ).length;
        const maxToolCalls = routing?.maxToolCalls ?? this.defaultMaxIterations;
        if (toolCallsMade >= maxToolCalls && effectiveTools.length > 0) {
          this.logger.warn(
            `Max tool calls (${maxToolCalls}) reached. Disabling tools to force chat response.`
          );
          effectiveTools = []; // Force the model to chat instead of calling more tools
        }

        try {
          const result = await this.ollamaClient.chat({
            model,
            messages,
            stream: true,
            think: true,
            tools: effectiveTools,
            options: { num_ctx: 8192 }, // Prevent context overflow with large tool results
          });

          // Type guard: result should be AsyncGenerator when stream=true
          if (Symbol.asyncIterator in result) {
            // Process stream chunks
            for await (const chunk of result) {
              if (this.shouldStop) {
                this.logger.info('Agent loop stopped by user');
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

              // Log token usage when available
              if (tokenUsage) {
                this.logger.info(
                  `📊📊📊 SENDING TOKEN USAGE TO WEBVIEW: ${JSON.stringify(tokenUsage)}`
                );
              }

              if (streamHandler.isDone()) {
                break;
              }
            }
          }
        } catch (error) {
          this.logger.error('Error during Ollama chat in agent loop', error);
          throw error;
        }

        // Get accumulated response
        const accumulated = streamHandler.getAccumulatedMessage();
        const { thinking, content, tool_calls } = accumulated;

        this.logger.info(
          `Iteration ${iteration} complete: thinking=${!!thinking}, content=${!!content}, tool_calls=${tool_calls?.length || 0}`
        );

        // Add assistant message to history
        messages.push({
          role: 'assistant',
          content: content || '',
          thinking,
          tool_calls,
        });

        // Check if we need to execute tools
        if (!tool_calls || tool_calls.length === 0) {
          // No more tools, we're done
          this.logger.info('Agent loop complete - no more tool calls');
          onUpdate({ type: 'complete' });
          break;
        }

        // Execute tools sequentially (Requirement 18.1)
        for (const toolCall of tool_calls) {
          if (this.shouldStop) {
            this.logger.info('Agent loop stopped by user during tool execution');
            break;
          }

          this.logger.info(`Executing tool: ${toolCall.function.name}`);
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

            // Check if this is a terminal command execution (Task 4.9)
            if (toolCall.function.name === 'forgeai_runCommand' && result) {
              this.logger.info('Terminal command executed, sending output to webview');
              onUpdate({
                type: 'terminalOutput',
                terminalData: {
                  command: result.command || toolCall.function.arguments.command,
                  cwd: result.cwd || toolCall.function.arguments.cwd,
                  stdout: result.stdout || '',
                  stderr: result.stderr || '',
                  exitCode: result.exitCode || 0,
                  timestamp: Date.now(),
                },
              });
            }

            // Add tool result to message history (Requirement 18.2)
            // Truncate to prevent HTTP 400 from oversized payloads.
            const MAX_TOOL_RESULT_CHARS = 12_000;
            let toolResultJson = JSON.stringify(result);
            if (toolResultJson.length > MAX_TOOL_RESULT_CHARS) {
              toolResultJson =
                toolResultJson.slice(0, MAX_TOOL_RESULT_CHARS) +
                `\n... [truncated — ${toolResultJson.length - MAX_TOOL_RESULT_CHARS} chars omitted]`;
            }
            messages.push({
              role: 'tool',
              name: toolCall.function.name,
              content: toolResultJson,
            });

            // Reset failure count on success — the tool works again
            this.toolFailureCounts.delete(toolCall.function.name);

            this.logger.info(
              `Tool ${toolCall.function.name} completed successfully in ${toolDuration}ms`
            );
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
            this.logger.error(`Tool ${toolCall.function.name} failed`, error);

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
    this.logger.info('Stopping agent loop');
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

    return {
      workspacePath,
      openFiles,
      currentFiles: openFiles,
      workspaceFiles,
      workspaceTree,
    };
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
