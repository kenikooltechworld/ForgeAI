import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { AgentLoop, AgentLoopUpdate } from '../ollama/AgentLoop';
import { OllamaClient, OllamaMessage } from '../ollama/OllamaClient';
import { ToolRegistry } from '../tools/ToolRegistry';
import { MultiAgentOrchestrator } from '../orchestrator/MultiAgentOrchestrator';
import { Task, WorkflowStatus } from '../orchestrator/types';

/**
 * Chat Participant for ForgeAI
 * Registers @forgeai as an invokable chat participant in VS Code
 * Requirement 3: Chat Participant Registration
 *
 * ARCHITECTURE: This is a thin adapter that connects VS Code's native chat
 * to the existing AgentLoop infrastructure. It reuses:
 * - AgentLoop.ts for autonomous tool execution
 * - ToolRegistry.ts for all 20+ tools
 * - OllamaClient.ts for streaming and tool calling
 * - SystemPrompt.ts for autonomous behavior
 *
 * IMPLEMENTATION: Follows the EXACT SAME PATTERN as WebviewManager.executeAgentLoop()
 */
export class ChatParticipant {
  private logger: Logger;
  private agentLoop: AgentLoop;
  private toolRegistry: ToolRegistry;

  private readonly complexPatterns: RegExp[] = [
    /fix.*bug|bug.*fix/i,
    /add.*test|write.*test|create.*test/i,
    /refactor/i,
    /implement.*feature|add.*feature/i,
    /fix.*error|error.*fix/i,
    /and.*then|first.*then/i,
    /multiple.*file/i,
    /analyze.*and|and.*fix/i,
  ];

  constructor(ollamaClient: OllamaClient, toolRegistry: ToolRegistry, logger: Logger) {
    this.toolRegistry = toolRegistry;
    this.logger = logger;
    // Reuse existing AgentLoop - no duplication!
    this.agentLoop = new AgentLoop(ollamaClient, logger, toolRegistry);
  }

  private shouldUseOrchestrator(requestPrompt: string): boolean {
    return this.complexPatterns.some((p) => p.test(requestPrompt));
  }

  /**
   * Chat request handler
   * Requirement 3.3: Stream progress updates via ChatResponseStream
   * Requirement 3.4: Use model selected by user via request.model
   *
   * IMPLEMENTATION: Uses MultiAgentOrchestrator for complex requests; otherwise uses existing AgentLoop.
   */
  public async handleRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<any> {
    this.logger.info(`Chat request received: command=${request.command}, prompt=${request.prompt}`);

    try {
      // Convert VS Code chat history to Ollama message format
      const messages = this.convertChatHistory(context.history, request);

      // Get available tools from registry (reuse existing tools!)
      const tools = this.toolRegistry.getToolDefinitions();
      this.logger.info(`Using ${tools.length} tools from ToolRegistry`);

      // Multi-agent orchestration for complex requests
      if (this.shouldUseOrchestrator(request.prompt)) {
        const selectedModel = String(request.model ?? 'gpt-oss:120b-cloud');
        this.logger.info('Routing complex request through MultiAgentOrchestrator');

        const orchestrator = new MultiAgentOrchestrator(
          this.agentLoop,
          this.toolRegistry,
          // MultiAgentOrchestrator expects ollamaClient + optional logger; we can reuse it via agentLoop internals
          // but here we only pass what its constructor needs. If ollamaClient isn't accessible,
          // MultiAgentOrchestrator will be created with its required constructor signature elsewhere.
          // NOTE: In this codebase, agentLoop already encapsulates ollama; we reuse it by creating a new instance below.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this.agentLoop as any).ollamaClient,
          this.logger
        );

        orchestrator.onProgress((update) => {
          const pct = Math.round(update.progress);
          const taskName = update.currentTask?.description ?? 'Working...';
          stream.progress(`⚙️ [${pct}%] ${taskName}`);
        });

        orchestrator.onTaskComplete((taskId, result) => {
          const icon =
            result.status === 'success' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';
          stream.progress(
            `${icon} Task ${taskId} (${result.selfEvaluation.confidence ? Math.round(result.selfEvaluation.confidence * 100) : 0}%)`
          );
        });

        orchestrator.onError((error) => {
          stream.markdown(`\n❌ **Orchestrator Error:** ${error.message}\n\n`);
        });

        const orchestratorResult = await orchestrator.run(request.prompt, {
          model: selectedModel,
          maxIterations: 5,
          enableParallel: false,
        });

        if (orchestratorResult.success) {
          stream.progress('✅ Orchestration complete');
        } else {
          stream.markdown(
            `\n❌ Orchestration failed: ${orchestratorResult.error?.message ?? 'Unknown error'}\n\n`
          );
        }

        stream.button({
          command: 'forgeai.open',
          title: 'Open ForgeAI Panel',
        });

        return {
          metadata: {
            command: request.command,
            multiAgent: true,
            status: orchestratorResult.status,
          },
        };
      }

      // Single-agent path (existing behavior)
      let sentContentLength = 0;
      let lastThinkingUpdate = 0;
      const THINKING_UPDATE_INTERVAL = 2000;

      await this.agentLoop.execute(
        messages,
        (update: AgentLoopUpdate) => {
          switch (update.type) {
            case 'chunk':
              if (update.content) {
                const newContent = update.content.substring(sentContentLength);
                if (newContent) {
                  stream.markdown(newContent);
                  sentContentLength = update.content.length;
                }
              }

              if (update.thinking && !update.content) {
                const now = Date.now();
                if (now - lastThinkingUpdate > THINKING_UPDATE_INTERVAL) {
                  const thinkingPreview = update.thinking.substring(0, 80);
                  stream.progress(
                    `🧠 ${thinkingPreview}${update.thinking.length > 80 ? '...' : ''}`
                  );
                  lastThinkingUpdate = now;
                }
              }
              break;

            case 'toolStart':
              this.logger.info(`Tool started: ${update.toolCall?.function.name}`);
              if (update.toolCall) {
                const toolName = update.toolCall.function.name.replace('forgeai_', '');
                stream.progress(`🔧 ${toolName}...`);
              }
              break;

            case 'toolComplete':
              this.logger.info(`Tool completed: ${update.toolCall?.function.name}`);
              if (update.toolCall) {
                const toolName = update.toolCall.function.name.replace('forgeai_', '');
                const duration = update.duration ? ` (${update.duration}ms)` : '';
                stream.progress(`✅ ${toolName}${duration}`);
              }
              break;

            case 'toolError':
              this.logger.error(`Tool error: ${update.toolCall?.function.name} - ${update.error}`);
              if (update.toolCall && update.error) {
                const toolName = update.toolCall.function.name.replace('forgeai_', '');
                stream.markdown(`\n⚠️ **Tool Error:** ${toolName} - ${update.error}\n\n`);
              }
              break;

            case 'terminalOutput':
              this.logger.info('Sending terminal output to chat');
              if (update.terminalData) {
                stream.markdown(`\n**Command:** \`${update.terminalData.command}\`\n\n`);
                if (update.terminalData.stdout) {
                  stream.markdown(`\`\`\`\n${update.terminalData.stdout}\n\`\`\`\n\n`);
                }
                if (update.terminalData.stderr) {
                  stream.markdown(`**Errors:**\n\`\`\`\n${update.terminalData.stderr}\n\`\`\`\n\n`);
                }
              }
              break;

            case 'complete':
              this.logger.info('Agent loop complete');
              stream.progress('✅ Task complete');
              sentContentLength = 0;
              break;

            case 'maxIterations':
              this.logger.warn('Agent loop reached max iterations');
              stream.markdown(
                `\n⚠️ **Warning:** ${update.message || 'Reached maximum iterations'}\n\n`
              );
              break;
          }
        },
        tools,
        String(request.model ?? 'gpt-oss:120b-cloud')
      );

      stream.button({
        command: 'forgeai.open',
        title: 'Open ForgeAI Panel',
      });

      return {
        metadata: {
          command: request.command,
        },
      };
    } catch (error) {
      this.logger.error('Error in chat request handler', error);
      stream.markdown(
        `❌ **Error:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n`
      );
      stream.markdown('Please try again or check if Ollama is running.');

      return {
        metadata: {
          command: request.command,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Convert VS Code chat history to Ollama message format
   * SAME PATTERN AS WebviewManager.handleSendMessage()
   */
  private convertChatHistory(
    history: readonly (vscode.ChatRequestTurn | vscode.ChatResponseTurn)[],
    currentRequest: vscode.ChatRequest
  ): OllamaMessage[] {
    const messages: OllamaMessage[] = [];

    // Convert history (type guard: request turns have `.prompt`, response parts are on request turns in this API)
    for (const turn of history) {
      if (!('prompt' in turn)) continue;

      messages.push({
        role: 'user',
        content: turn.prompt,
      });

      if ('response' in turn && turn.response) {
        const responseParts = (turn as any).response as unknown[];
        const responseText = responseParts
          .map((part: vscode.ChatResponseMarkdownPart | unknown) => {
            if (part instanceof vscode.ChatResponseMarkdownPart) {
              return part.value.value;
            }
            return '';
          })
          .join('');

        if (responseText) {
          messages.push({
            role: 'assistant',
            content: responseText,
          });
        }
      }
    }

    // Add current request with command context
    let prompt = currentRequest.prompt;
    if (currentRequest.command) {
      // Add command context to prompt
      const commandPrompts: Record<string, string> = {
        fix: 'You are a debugging expert. Fix the following issue:\n\n',
        build: 'You are a software architect. Build the following feature:\n\n',
        explain: 'You are a code educator. Explain the following:\n\n',
        test: 'You are a testing expert. Generate tests for:\n\n',
      };
      const prefix = commandPrompts[currentRequest.command] || '';
      prompt = prefix + prompt;
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    return messages;
  }

  /**
   * Provide follow-up suggestions
   * Requirement 3.5: Provide follow-up suggestions based on context
   */
  public provideFollowups(
    result: any,
    context: vscode.ChatContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.ChatFollowup[]> {
    const followups: vscode.ChatFollowup[] = [];

    // Provide context-aware follow-ups based on the command used
    if (result.metadata?.command === 'fix') {
      followups.push(
        {
          prompt: 'Explain the changes you made',
          label: '📖 Explain changes',
        },
        {
          prompt: 'Generate tests for this fix',
          label: '🧪 Generate tests',
        }
      );
    } else if (result.metadata?.command === 'build') {
      followups.push(
        {
          prompt: 'Add error handling to this code',
          label: '🛡️ Add error handling',
        },
        {
          prompt: 'Generate tests for this feature',
          label: '🧪 Generate tests',
        }
      );
    } else if (result.metadata?.command === 'explain') {
      followups.push(
        {
          prompt: 'Show me a practical example',
          label: '💡 Show example',
        },
        {
          prompt: 'What are common pitfalls?',
          label: '⚠️ Common pitfalls',
        }
      );
    } else if (result.metadata?.command === 'test') {
      followups.push(
        {
          prompt: 'Add edge case tests',
          label: '🔍 Add edge cases',
        },
        {
          prompt: 'Explain the test strategy',
          label: '📖 Explain strategy',
        }
      );
    } else {
      // General follow-ups
      followups.push(
        {
          prompt: 'Can you explain this in more detail?',
          label: '📖 More details',
        },
        {
          prompt: 'Show me a code example',
          label: '💻 Code example',
        }
      );
    }

    return followups;
  }
}
