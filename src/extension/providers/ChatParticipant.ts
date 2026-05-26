import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { AgentLoop, AgentLoopUpdate } from '../ollama/AgentLoop';
import { OllamaClient, OllamaMessage } from '../ollama/OllamaClient';
import { ToolRegistry } from '../tools/ToolRegistry';
import type { RagService } from '../rag/RagService';
import { getConfiguredModel } from '../config/ModelConfig';

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

  constructor(
    ollamaClient: OllamaClient,
    toolRegistry: ToolRegistry,
    logger: Logger,
    ragService?: RagService
  ) {
    this.toolRegistry = toolRegistry;
    this.logger = logger;
    // Reuse existing AgentLoop - no duplication!
    this.agentLoop = new AgentLoop(ollamaClient, logger, toolRegistry, ragService);
  }

  /**
   * Chat request handler
   * Requirement 3.3: Stream progress updates via ChatResponseStream
   * Requirement 3.4: Use model selected by user via request.model
   *
   * IMPLEMENTATION: All requests routed through AgentLoop (spec-driven architecture replaces multi-agent orchestration).
   */
  public async handleRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<any> {
    this.logger.info(`Chat request received: command=${request.command}, prompt=${request.prompt}`);

    try {
      // Spec-generation intent detection for @forgeai chat
      if (this.isSpecGenerationIntent(request.prompt)) {
        stream.markdown(
          `📋 **Spec Generation Detected**\n\nI'll create a formal spec with requirements, architecture, and tasks for: *"${request.prompt}"*\n\nStarting the spec pipeline (Clarifier → SpecWriter → Architect → TaskDecomposer)...\n`
        );
        await vscode.commands.executeCommand('forgeai.generateSpec');
        stream.button({
          command: 'forgeai.openSpecReview',
          title: 'Open Spec Review',
        });
        return {
          metadata: {
            command: request.command,
            specGeneration: true,
          },
        };
      }

      // Convert VS Code chat history to Ollama message format
      const messages = this.convertChatHistory(context.history, request);

      // Get available tools from registry (reuse existing tools!)
      const tools = this.toolRegistry.getToolDefinitions();
      this.logger.info(`Using ${tools.length} tools from ToolRegistry`);

      // All requests go through AgentLoop (spec-driven architecture)
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
        typeof request.model === 'string' ? request.model : getConfiguredModel()
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

  /**
   * Detect if the user prompt indicates spec-generation intent.
   */
  private isSpecGenerationIntent(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    const specPatterns = [
      /create\s+a?\s*spec\s+(for|about)/i,
      /write\s+(requirements|a?\s*spec)\s+(for|about)/i,
      /spec\s+out\s+/i,
      /generate\s+a?\s*(task\s*plan|spec)\s+(for|about)/i,
      /formal\s+requirements\s+(for|about)/i,
      /ears\s+notation\s+(for|about)/i,
      /decompose\s+.*into\s+tasks/i,
    ];
    return specPatterns.some((p) => p.test(lower));
  }
}
