import * as vscode from 'vscode';
import { OllamaClient, OllamaMessage, OllamaToolCall } from './OllamaClient';
import { StreamHandler } from './StreamHandler';
import { Logger } from '../utils/Logger';
import { ToolRegistry } from '../tools/ToolRegistry';
import { generateSystemPrompt, getWorkspaceContext } from './SystemPrompt';

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
    | 'terminalOutput';
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
}

/**
 * Production-ready Agent Loop for ForgeAI
 * Implements autonomous multi-step tool execution with streaming support
 * Follows Requirements 18.1-18.5 and design.md Agent Loop specification
 */
export class AgentLoop {
  private readonly maxIterations = 100; // Increased to allow AI to work until task is complete
  private isRunning = false;
  private shouldStop = false;

  constructor(
    private readonly ollamaClient: OllamaClient,
    private readonly logger: Logger,
    private readonly toolRegistry?: ToolRegistry
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
    model: string = 'gpt-oss:120b-cloud'
  ): Promise<void> {
    this.logger.info('Starting agent loop execution');
    this.logger.info(`Using model: ${model}`);
    this.isRunning = true;
    this.shouldStop = false;

    // Get workspace context for system prompt
    const workspaceContext = getWorkspaceContext();
    this.logger.info(
      `Workspace context: ${workspaceContext.workspacePath || 'none'}, ` +
        `${workspaceContext.currentFiles?.length || 0} recent files`
    );

    // Get language preference from VS Code settings
    const config = vscode.workspace.getConfiguration('forgeai');
    const language = config.get<string>('language', 'English');
    this.logger.info(`Language preference: ${language}`);

    // Prepend system prompt if not already present
    const messages = [...initialMessages];
    if (messages.length === 0 || messages[0].role !== 'system') {
      const systemPrompt = generateSystemPrompt(workspaceContext, language);
      messages.unshift({
        role: 'system',
        content: systemPrompt,
      });
      this.logger.info('System prompt prepended to messages');
    } else {
      this.logger.info('System prompt already present, skipping');
    }

    let iteration = 0;
    let lastRequestTime = 0; // Track last request time for rate limiting
    const MIN_REQUEST_INTERVAL = 500; // Minimum 500ms between requests

    try {
      while (iteration < this.maxIterations && !this.shouldStop) {
        iteration++;
        this.logger.info(`Agent loop iteration ${iteration}/${this.maxIterations}`);
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
          `Sending to Ollama: model=gpt-oss:120b-cloud, messages=${messages.length}, tools=${tools.length}, think=true`
        );
        if (tools.length > 0) {
          this.logger.info(
            `Tool names being sent: ${tools.map((t: any) => t.function.name).join(', ')}`
          );
        } else {
          this.logger.error(
            'CRITICAL: No tools being sent to Ollama! AI will not be able to use tools!'
          );
        }

        // Get response from Ollama with streaming
        const streamHandler = new StreamHandler(this.logger);

        try {
          const result = await this.ollamaClient.chat({
            model, // Use the provided model parameter
            messages,
            stream: true,
            think: true,
            tools,
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
            messages.push({
              role: 'tool',
              tool_name: toolCall.function.name,
              content: JSON.stringify(result),
            });

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

            // Add error result to message history
            messages.push({
              role: 'tool',
              tool_name: toolCall.function.name,
              content: JSON.stringify({ error: errorMessage }),
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

      // Check if we hit max iterations (Requirement 18.5)
      if (iteration >= this.maxIterations) {
        this.logger.warn('Agent loop reached max iterations');

        // Gather context about what the agent was trying to do
        const lastAssistantMessage = messages
          .slice()
          .reverse()
          .find((m) => m.role === 'assistant');

        const recentToolCalls = messages
          .slice(-10) // Last 10 messages
          .filter((m) => m.role === 'tool')
          .map((m) => m.tool_name)
          .filter(Boolean);

        onUpdate({
          type: 'maxIterations',
          message: 'Agent reached maximum iterations (20). Task may be incomplete.',
          context: {
            lastThinking: lastAssistantMessage?.thinking,
            lastContent: lastAssistantMessage?.content,
            recentTools: recentToolCalls,
            totalIterations: iteration,
          },
        });
      }
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
}
