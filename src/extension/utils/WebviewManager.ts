import * as vscode from 'vscode';
import { StorageManager } from '../storage/StorageManager';
import { Logger } from './Logger';
import { OllamaClient, OllamaMessage } from '../ollama/OllamaClient';
import { AgentLoopUpdate } from '../ollama/AgentLoop';
import { ToolRegistry } from '../tools/ToolRegistry';
import { TestResultsParser } from './TestResultsParser';

/**
 * Production-ready Webview Manager for ForgeAI extension
 * Implements WebviewViewProvider and proper disposal
 */
export class WebviewManager implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly storageManager: StorageManager,
    private readonly logger: Logger,
    private readonly ollamaClient: OllamaClient,
    private readonly toolRegistry?: ToolRegistry
  ) {}

  public async reveal(): Promise<void> {
    if (!this.view) {
      await vscode.commands.executeCommand('workbench.view.extension.forgeai');
      return;
    }

    this.view.show?.(true);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.logger.info('resolveWebviewView called - starting webview initialization');
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this.context.extensionUri, 'resources'),
      ],
    };

    this.logger.info('Webview options configured, generating HTML');
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    this.logger.info('HTML set successfully');

    // Register message handler with proper disposal
    this.disposables.push(
      webviewView.webview.onDidReceiveMessage(
        (message) => this.handleMessage(message),
        null,
        this.disposables
      )
    );

    // Register panel disposal
    this.disposables.push(
      webviewView.onDidDispose(() => this.onViewDisposed(), null, this.disposables)
    );

    this.logger.info('Webview resolved successfully - all handlers registered');
  }

  private async handleMessage(message: any): Promise<void> {
    this.logger.info(`Received message from webview: ${JSON.stringify(message)}`);
    try {
      switch (message.type) {
        case 'sendMessage': {
          this.logger.info('Handling sendMessage');
          await this.handleSendMessage(
            message.conversationId,
            message.content,
            message.conversationHistory || [],
            message.model || 'gpt-oss:120b-cloud' // Use provided model or default
          );
          break;
        }
        case 'openExternal': {
          this.logger.info(`Handling openExternal: ${message.url}`);
          await vscode.env.openExternal(vscode.Uri.parse(message.url));
          break;
        }
        case 'getSettings': {
          this.logger.info('Handling getSettings message');
          const showThinking = this.storageManager.getWorkspaceValue('forgeai.showThinking', true);
          this.logger.info(`Sending settings response: showThinking=${showThinking}`);
          this.view?.webview.postMessage({ type: 'settings', payload: { showThinking } });
          break;
        }
        case 'getWorkspaceState': {
          this.logger.info(`Handling getWorkspaceState: ${message.key}`);
          const value = this.storageManager.getWorkspaceValue(message.key, null);
          this.logger.info(
            `Sending workspaceState response: ${message.key} = ${JSON.stringify(value)}`
          );
          this.view?.webview.postMessage({
            type: 'workspaceState',
            key: message.key,
            value,
          });
          break;
        }
        case 'setWorkspaceState': {
          this.logger.info(
            `Handling setWorkspaceState: ${message.key} = ${JSON.stringify(message.value)}`
          );
          await this.storageManager.setWorkspaceValue(message.key, message.value);
          break;
        }
        case 'getOnboardingState': {
          this.logger.info('Handling getOnboardingState message');
          const onboardingState = this.storageManager.getGlobalValue('forgeai.onboarding', {
            hasSeenThinkingTooltip: false,
            hasSeenToolTooltip: false,
            hasSeenCodeChangeTooltip: false,
            hasSeenWelcomeScreen: false,
          });
          this.logger.info(`Sending onboarding state: ${JSON.stringify(onboardingState)}`);
          this.view?.webview.postMessage({ type: 'onboardingState', payload: onboardingState });
          break;
        }
        case 'getLanguage': {
          this.logger.info('Handling getLanguage message');
          const config = vscode.workspace.getConfiguration('forgeai');
          const language = config.get<string>('language', 'English');
          this.logger.info(`Sending language setting: ${language}`);
          this.view?.webview.postMessage({ type: 'language', language });
          break;
        }
        case 'getSelectedModel': {
          this.logger.info('Handling getSelectedModel message');
          const selectedModel = this.storageManager.getGlobalValue(
            'forgeai.selectedModel',
            'gpt-oss:120b-cloud'
          );
          this.logger.info(`Sending selected model: ${selectedModel}`);
          this.view?.webview.postMessage({ type: 'selectedModel', model: selectedModel });
          break;
        }
        case 'getAutonomyLevel': {
          this.logger.info('Handling getAutonomyLevel message');
          const autonomyLevel = this.storageManager.getGlobalValue(
            'forgeai.autonomyLevel',
            'semi-autonomous'
          );
          this.logger.info(`Sending autonomy level: ${autonomyLevel}`);
          this.view?.webview.postMessage({ type: 'autonomyLevel', level: autonomyLevel });
          break;
        }
        case 'setOnboardingState': {
          this.logger.info(`Handling setOnboardingState: ${JSON.stringify(message.payload)}`);
          await this.storageManager.setGlobalValue('forgeai.onboarding', message.payload);
          break;
        }
        case 'setLanguage': {
          this.logger.info(`Handling setLanguage: ${message.language}`);
          // Update VS Code configuration
          const config = vscode.workspace.getConfiguration('forgeai');
          await config.update('language', message.language, vscode.ConfigurationTarget.Global);
          break;
        }
        case 'setShowThinking': {
          this.logger.info(`Handling setShowThinking: ${message.show}`);
          // Persist to globalState (Requirement 49.5)
          await this.storageManager.setGlobalValue('forgeai.showThinking', message.show);
          break;
        }
        case 'setSelectedModel': {
          this.logger.info(`Handling setSelectedModel: ${message.model}`);
          // Persist to globalState (should persist across sessions)
          await this.storageManager.setGlobalValue('forgeai.selectedModel', message.model);
          break;
        }
        case 'setAutonomyLevel': {
          this.logger.info(`Handling setAutonomyLevel: ${message.level}`);
          // Persist to globalState (Task 10.4)
          await this.storageManager.setGlobalValue('forgeai.autonomyLevel', message.level);
          break;
        }
        case 'getSplitScreenWidth': {
          this.logger.info('Handling getSplitScreenWidth message');
          const width = this.storageManager.getWorkspaceValue('forgeai.splitScreenWidth', 50);
          this.logger.info(`Sending splitScreenWidth response: ${width}`);
          this.view?.webview.postMessage({ type: 'splitScreenWidth', width });
          break;
        }
        case 'setSplitScreenWidth': {
          this.logger.info(`Handling setSplitScreenWidth: ${message.width}`);
          await this.storageManager.setWorkspaceValue('forgeai.splitScreenWidth', message.width);
          break;
        }
        case 'applyChanges': {
          this.logger.info(`Handling applyChanges: ${message.filePath}`);
          await this.handleApplyChanges(message.filePath, message.content);
          break;
        }
        case 'openFile': {
          this.logger.info(`Handling openFile: ${message.filePath}`);
          await this.handleOpenFile(message.filePath, message.lineNumber);
          break;
        }
        case 'undoChanges': {
          this.logger.info(`Handling undoChanges: ${message.filePath}`);
          await this.handleUndoChanges(message.filePath, message.originalContent);
          break;
        }
        case 'runCommand': {
          this.logger.info(`Handling runCommand: ${message.command}`);
          await this.handleSendMessage(
            message.conversationId,
            `Run this command: ${message.command}${message.cwd ? ` in directory ${message.cwd}` : ''}`
          );
          break;
        }
        case 'continueAfterMaxIterations': {
          this.logger.info('Handling continueAfterMaxIterations');
          await this.handleContinueAfterMaxIterations(
            message.conversationId,
            message.conversationHistory || []
          );
          break;
        }
        case 'cancelAfterMaxIterations': {
          this.logger.info('Handling cancelAfterMaxIterations');
          // Just send a completion message - the agent loop has already stopped
          this.view?.webview.postMessage({
            type: 'streamChunk',
            conversationId: message.conversationId,
            data: {
              content: '\n\n✋ Task cancelled by user. You can review what was completed above.',
              thinking: '',
              toolCalls: [],
            },
            done: true,
          });
          break;
        }
        case 'fetchOllamaModels': {
          this.logger.info('Handling fetchOllamaModels');
          await this.handleFetchOllamaModels();
          break;
        }
        default:
          this.logger.warn(`Unknown message type: ${message.type}`);
          break;
      }
    } catch (error) {
      this.logger.error('Failed to handle webview message', error);
    }
  }

  private async handleSendMessage(
    conversationId: string,
    message: string,
    conversationHistory: any[] = [],
    model: string = 'gpt-oss:120b-cloud'
  ): Promise<void> {
    this.logger.info(`Sending message to Ollama: ${message}`);
    this.logger.info(`Using model: ${model}`);
    this.logger.info(`Conversation history length: ${conversationHistory.length}`);

    try {
      // Get tool definitions from ToolRegistry
      const tools = this.toolRegistry ? this.toolRegistry.getToolDefinitions() : [];

      this.logger.info(`Available tools: ${tools.length}`);
      if (tools.length > 0) {
        this.logger.info(`Tool names: ${tools.map((t) => t.function.name).join(', ')}`);
        this.logger.info(`Tool definitions: ${JSON.stringify(tools, null, 2)}`);
      } else {
        this.logger.warn('NO TOOLS AVAILABLE - ToolRegistry might not be initialized!');
      }

      // Use AgentLoop for autonomous tool execution
      const { AgentLoop } = await import('../ollama/AgentLoop');
      const agentLoop = new AgentLoop(this.ollamaClient, this.logger, this.toolRegistry);

      // Convert conversation history to Ollama message format
      const messages: OllamaMessage[] = conversationHistory.map((msg: any) => {
        const ollamaMsg: OllamaMessage = {
          role: msg.role,
          content: msg.content || '',
        };

        // Only include optional fields if they have values
        if (msg.thinking) ollamaMsg.thinking = msg.thinking;
        if (msg.tool_calls) ollamaMsg.tool_calls = msg.tool_calls;
        if (msg.tool_name) ollamaMsg.tool_name = msg.tool_name;

        return ollamaMsg;
      });

      // Add current user message (only required fields)
      messages.push({
        role: 'user',
        content: message,
      });

      this.logger.info(`Total messages to send: ${messages.length}`);

      // Execute agent loop with streaming updates
      await this.executeAgentLoop(agentLoop, conversationId, messages, tools, model);
    } catch (error) {
      this.logger.error('Failed to send message to Ollama', error);

      // Determine error type and send appropriate message
      const errorInfo = this.categorizeError(error);

      // Send error to webview with detailed information
      this.view?.webview.postMessage({
        type: 'streamError',
        conversationId,
        errorType: errorInfo.type,
        errorMessage: errorInfo.message,
        actionButton: errorInfo.actionButton,
      });
    }
  }

  /**
   * Handle continuing after max iterations
   */
  private async handleContinueAfterMaxIterations(
    conversationId: string,
    conversationHistory: any[] = []
  ): Promise<void> {
    this.logger.info('Continuing agent loop after max iterations');

    try {
      // Get tool definitions from ToolRegistry
      const tools = this.toolRegistry ? this.toolRegistry.getToolDefinitions() : [];

      // Use AgentLoop for autonomous tool execution
      const { AgentLoop } = await import('../ollama/AgentLoop');
      const agentLoop = new AgentLoop(this.ollamaClient, this.logger, this.toolRegistry);

      // Convert conversation history to Ollama message format
      const messages: OllamaMessage[] = conversationHistory.map((msg: any) => {
        const ollamaMsg: OllamaMessage = {
          role: msg.role,
          content: msg.content || '',
        };

        // Only include optional fields if they have values
        if (msg.thinking) ollamaMsg.thinking = msg.thinking;
        if (msg.tool_calls) ollamaMsg.tool_calls = msg.tool_calls;
        if (msg.tool_name) ollamaMsg.tool_name = msg.tool_name;

        return ollamaMsg;
      });

      // Add a system message to guide the continuation
      messages.push({
        role: 'user',
        content:
          'Continue working on the task. You have 20 more iterations. Focus on completing the most important remaining work.',
      });

      this.logger.info(`Continuing with ${messages.length} messages`);

      // Execute agent loop with streaming updates
      await this.executeAgentLoop(agentLoop, conversationId, messages, tools);
    } catch (error) {
      this.logger.error('Failed to continue after max iterations', error);

      // Determine error type and send appropriate message
      const errorInfo = this.categorizeError(error);

      // Send error to webview with detailed information
      this.view?.webview.postMessage({
        type: 'streamError',
        conversationId,
        errorType: errorInfo.type,
        errorMessage: errorInfo.message,
        actionButton: errorInfo.actionButton,
      });
    }
  }

  /**
   * Execute agent loop with streaming updates (extracted for reuse)
   */
  private async executeAgentLoop(
    agentLoop: any,
    conversationId: string,
    messages: OllamaMessage[],
    tools: any[],
    model: string = 'gpt-oss:120b-cloud'
  ): Promise<void> {
    await agentLoop.execute(
      messages,
      (update: AgentLoopUpdate) => {
        // Handle different update types
        switch (update.type) {
          case 'chunk':
            // Send streaming chunk to webview
            this.view?.webview.postMessage({
              type: 'streamChunk',
              conversationId,
              data: {
                content: update.content || '',
                thinking: update.thinking || '',
                toolCalls: update.toolCalls || [],
                tokenUsage: update.tokenUsage,
              },
              done: update.done || false,
            });

            // Log when token usage is being sent
            if (update.tokenUsage) {
              this.logger.info(
                `🌐🌐🌐 POSTING TOKEN USAGE TO WEBVIEW: ${JSON.stringify(update.tokenUsage)}`
              );
            }
            break;

          case 'terminalOutput':
            this.logger.info('Sending terminal output to webview');

            // Check if this is test output and parse it (Task 9.1)
            if (update.terminalData) {
              const { command, stdout, stderr, exitCode } = update.terminalData;
              const output = stdout + stderr;

              // Check if this looks like a test command
              const isTestCommand =
                command.includes('test') ||
                command.includes('jest') ||
                command.includes('vitest') ||
                command.includes('mocha') ||
                command.includes('pytest');

              if (isTestCommand) {
                this.logger.info('Detected test command, attempting to parse results');

                // Try to parse test results
                const testResults = TestResultsParser.parse(output, exitCode);

                if (testResults) {
                  this.logger.info(
                    `Parsed test results: ${testResults.totalPassed} passed, ${testResults.totalFailed} failed`
                  );

                  // Send test results to webview
                  this.view?.webview.postMessage({
                    type: 'showTestResults',
                    conversationId,
                    data: {
                      ...testResults,
                      onRunAgain: () => {
                        // Will be handled by webview message
                      },
                    },
                  });
                } else {
                  this.logger.info('Could not parse test results, showing as terminal output');
                  // Fall back to showing as terminal output
                  this.view?.webview.postMessage({
                    type: 'showTerminalOutput',
                    conversationId,
                    data: update.terminalData,
                  });
                }
              } else {
                // Not a test command, show as terminal output
                this.view?.webview.postMessage({
                  type: 'showTerminalOutput',
                  conversationId,
                  data: update.terminalData,
                });
              }
            }
            break;

          case 'toolStart':
            this.logger.info(`Tool started: ${update.toolCall?.function.name}`);
            // Send tool start notification to webview for live feedback
            if (update.toolCall && update.toolExecutionId) {
              this.view?.webview.postMessage({
                type: 'toolExecutionStart',
                conversationId,
                data: {
                  messageId: update.toolExecutionId, // Use consistent ID from AgentLoop
                  toolName: update.toolCall.function.name,
                  target: this.getToolTarget(update.toolCall),
                  arguments: update.toolCall.function.arguments,
                },
              });
            }
            break;

          case 'toolComplete':
            this.logger.info(`Tool completed: ${update.toolCall?.function.name}`);

            // Send tool completion notification to webview for live feedback
            if (update.toolCall && update.toolExecutionId) {
              this.view?.webview.postMessage({
                type: 'toolExecutionComplete',
                conversationId,
                data: {
                  messageId: update.toolExecutionId, // Use consistent ID from AgentLoop
                  toolName: update.toolCall.function.name,
                  target: this.getToolTarget(update.toolCall),
                  duration: update.duration,
                  result: update.result,
                  arguments: update.toolCall.function.arguments,
                },
              });
            }

            // Check if this is a readFile tool - send file data to preview panel (Task 4.6)
            if (update.toolCall?.function.name === 'forgeai_readFile' && update.result) {
              this.logger.info('File read completed, sending to preview panel');
              const args =
                typeof update.toolCall.function.arguments === 'string'
                  ? JSON.parse(update.toolCall.function.arguments)
                  : update.toolCall.function.arguments;

              this.view?.webview.postMessage({
                type: 'showFile',
                data: {
                  filePath: update.result.path || args.path,
                  content: update.result.content || '',
                  size: update.result.content?.length,
                  lastModified: Date.now(),
                },
              });
            }

            // Check if this is a generateDiff tool - send diff to webview (Task 5.2)
            if (update.toolCall?.function.name === 'forgeai_generateDiff' && update.result) {
              this.logger.info('Sending diff data to webview');
              this.view?.webview.postMessage({
                type: 'showDiff',
                data: {
                  file: update.result.file,
                  lines: update.result.lines,
                  language: update.result.language,
                  originalContent: update.result.originalContent,
                  onApply: () => {
                    // Will be handled by webview message
                  },
                  onReject: () => {
                    // Will be handled by webview message
                  },
                  onOpenInEditor: () => {
                    // Will be handled by webview message
                  },
                },
              });
            }

            break;

          case 'toolError':
            this.logger.error(`Tool error: ${update.toolCall?.function.name} - ${update.error}`);
            // Send tool error notification to webview for live feedback
            if (update.toolCall && update.toolExecutionId) {
              this.view?.webview.postMessage({
                type: 'toolExecutionError',
                conversationId,
                data: {
                  messageId: update.toolExecutionId, // Use consistent ID from AgentLoop
                  toolName: update.toolCall.function.name,
                  target: this.getToolTarget(update.toolCall),
                  duration: update.duration,
                  error: update.error,
                  arguments: update.toolCall.function.arguments,
                },
              });
            }
            break;

          case 'complete':
            this.logger.info('Agent loop complete');
            // Send final completion message
            this.view?.webview.postMessage({
              type: 'streamChunk',
              conversationId,
              data: {
                content: '',
                thinking: '',
                toolCalls: [],
              },
              done: true,
            });
            break;

          case 'maxIterations':
            this.logger.warn('Agent loop reached max iterations');
            // Send detailed max iterations warning to webview with context
            this.view?.webview.postMessage({
              type: 'maxIterationsWarning',
              conversationId,
              data: {
                message: update.message,
                context: update.context,
              },
            });
            break;
        }
      },
      tools,
      model // Pass the model parameter
    );
  }

  /**
   * Handle applying code changes to a file
   */
  private async handleApplyChanges(filePath: string, content: string): Promise<void> {
    try {
      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      // Resolve file URI - handle both absolute and relative paths
      let fileUri: vscode.Uri;

      // Check if path is absolute (Windows: C:\, D:\, etc. or Unix: /)
      const isAbsolute = /^[a-zA-Z]:[\\\/]/.test(filePath) || filePath.startsWith('/');

      if (isAbsolute) {
        // For absolute paths, use vscode.Uri.file() directly
        fileUri = vscode.Uri.file(filePath);
      } else {
        // For relative paths, join with workspace folder
        fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
      }

      // Write file using VS Code API
      const buffer = Buffer.from(content, 'utf8');
      await vscode.workspace.fs.writeFile(fileUri, buffer);

      this.logger.info(`File written successfully: ${fileUri.fsPath}`);

      // Show success notification
      vscode.window.showInformationMessage(`Changes applied to ${filePath}`);

      // Send success response to webview
      this.view?.webview.postMessage({
        type: 'applyChangesSuccess',
        filePath,
      });
    } catch (error) {
      this.logger.error(`Failed to apply changes to ${filePath}`, error);

      // Show error notification
      vscode.window.showErrorMessage(
        `Failed to apply changes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Send error response to webview
      this.view?.webview.postMessage({
        type: 'applyChangesError',
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle opening a file in the editor
   */
  private async handleOpenFile(filePath: string, lineNumber?: number): Promise<void> {
    try {
      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      // Resolve file URI - handle both absolute and relative paths
      let fileUri: vscode.Uri;

      // Check if path is absolute (Windows: C:\, D:\, etc. or Unix: /)
      const isAbsolute = /^[a-zA-Z]:[\\\/]/.test(filePath) || filePath.startsWith('/');

      if (isAbsolute) {
        // For absolute paths, use vscode.Uri.file() directly
        fileUri = vscode.Uri.file(filePath);
      } else {
        // For relative paths, join with workspace folder
        fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
      }

      // Open document
      const document = await vscode.workspace.openTextDocument(fileUri);

      // Show document in editor
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });

      // If line number provided, jump to that line
      if (lineNumber !== undefined && lineNumber > 0) {
        const position = new vscode.Position(lineNumber - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }

      this.logger.info(`Opened file in editor: ${fileUri.fsPath}`);
    } catch (error) {
      this.logger.error(`Failed to open file ${filePath}`, error);

      // Show error notification
      vscode.window.showErrorMessage(
        `Failed to open file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle undoing changes to a file
   */
  private async handleUndoChanges(filePath: string, originalContent: string): Promise<void> {
    try {
      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      // Resolve file URI - handle both absolute and relative paths
      let fileUri: vscode.Uri;

      // Check if path is absolute (Windows: C:\, D:\, etc. or Unix: /)
      const isAbsolute = /^[a-zA-Z]:[\\\/]/.test(filePath) || filePath.startsWith('/');

      if (isAbsolute) {
        // For absolute paths, use vscode.Uri.file() directly
        fileUri = vscode.Uri.file(filePath);
      } else {
        // For relative paths, join with workspace folder
        fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
      }

      // Restore original content
      const buffer = Buffer.from(originalContent, 'utf8');
      await vscode.workspace.fs.writeFile(fileUri, buffer);

      this.logger.info(`Changes undone successfully: ${fileUri.fsPath}`);

      // Show success notification
      vscode.window.showInformationMessage(`Changes undone for ${filePath}`);

      // Send success response to webview
      this.view?.webview.postMessage({
        type: 'undoChangesSuccess',
        filePath,
      });
    } catch (error) {
      this.logger.error(`Failed to undo changes for ${filePath}`, error);

      // Show error notification
      vscode.window.showErrorMessage(
        `Failed to undo changes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Send error response to webview
      this.view?.webview.postMessage({
        type: 'undoChangesError',
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Extract target information from tool call arguments
   */
  private getToolTarget(toolCall: any): string | undefined {
    try {
      const args =
        typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;

      // Extract target based on tool type
      if (args.path) return args.path;
      if (args.file) return args.file;
      if (args.filePath) return args.filePath;
      if (args.command) return args.command;
      if (args.query) return args.query;
      if (args.pattern) return args.pattern;

      return undefined;
    } catch (error) {
      this.logger.error('Failed to extract tool target', error);
      return undefined;
    }
  }

  /**
   * Handle fetching Ollama models (proxy request to avoid CORS)
   */
  private async handleFetchOllamaModels(): Promise<void> {
    try {
      this.logger.info('Fetching Ollama models from http://localhost:11434/api/tags');

      // Use node-fetch or http module to make the request
      const response = await fetch('http://localhost:11434/api/tags');

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const data = await response.json();
      this.logger.info(`Successfully fetched ${data.models?.length || 0} models from Ollama`);

      // Send success response to webview
      this.view?.webview.postMessage({
        type: 'ollamaModelsResponse',
        success: true,
        data: data,
      });
    } catch (error) {
      this.logger.error('Failed to fetch Ollama models', error);

      // Categorize the error and get error details
      const errorDetails = this.categorizeOllamaFetchError(error);

      // Send detailed error response to webview
      this.view?.webview.postMessage({
        type: 'ollamaModelsResponse',
        success: false,
        error: errorDetails,
      });
    }
  }

  /**
   * Categorize Ollama fetch errors and return structured error details
   */
  private categorizeOllamaFetchError(error: unknown): {
    code: string;
    title: string;
    message: string;
    steps: string[];
  } {
    if (!(error instanceof Error)) {
      return {
        code: 'UNKNOWN_ERROR',
        title: 'Unknown Error',
        message: 'An unexpected error occurred while connecting to Ollama.',
        steps: [
          'Check if Ollama is running',
          'Run: ollama serve',
          'Visit: https://docs.ollama.com for help',
        ],
      };
    }

    // 403 Forbidden - Permission issue
    if (error.message.includes('HTTP_403')) {
      return {
        code: 'PERMISSION_DENIED',
        title: 'Permission Denied',
        message:
          'Ollama is running but refusing the connection. This usually means Ollama is configured to only accept connections from specific sources.',
        steps: [
          'Check if Ollama is running with restricted access',
          'Restart Ollama without access restrictions',
          'Run: ollama serve',
          'If the issue persists, check your firewall settings',
        ],
      };
    }

    // 404 Not Found - Wrong endpoint or Ollama version issue
    if (error.message.includes('HTTP_404')) {
      return {
        code: 'API_NOT_FOUND',
        title: 'Ollama API Not Found',
        message:
          'The Ollama API endpoint was not found. This might mean you are running an older version of Ollama.',
        steps: [
          'Update Ollama to the latest version',
          'Visit: https://ollama.com/download',
          'Download and install the latest version',
          'Restart Ollama after updating',
        ],
      };
    }

    // 500/502 Server Error
    if (error.message.includes('HTTP_500') || error.message.includes('HTTP_502')) {
      return {
        code: 'SERVER_ERROR',
        title: 'Ollama Server Error',
        message: 'Ollama is running but encountered an internal error. This is usually temporary.',
        steps: [
          'Wait a few seconds and try again',
          'If the error persists, restart Ollama',
          'Run: ollama serve',
          'Check Ollama logs for more details',
        ],
      };
    }

    // Connection refused - Ollama not running
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      return {
        code: 'CONNECTION_REFUSED',
        title: 'Ollama Not Running',
        message: 'Cannot connect to Ollama. It appears Ollama is not running on your system.',
        steps: [
          'Open a terminal or command prompt',
          'Run: ollama serve',
          'Wait for "Ollama is running" message',
          'Return to ForgeAI and try again',
          '',
          'Need help? Visit: https://docs.ollama.com',
        ],
      };
    }

    // Timeout
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return {
        code: 'CONNECTION_TIMEOUT',
        title: 'Connection Timeout',
        message: 'The connection to Ollama timed out. Ollama might be starting up or overloaded.',
        steps: [
          'Wait 10-15 seconds for Ollama to fully start',
          'Try again',
          'If the issue persists, restart Ollama',
          'Run: ollama serve',
        ],
      };
    }

    // Unknown error with error message
    return {
      code: 'UNKNOWN_ERROR',
      title: 'Connection Error',
      message: `An unexpected error occurred: ${error.message}`,
      steps: [
        'Check if Ollama is installed',
        'Run: ollama --version',
        'If not installed, visit: https://ollama.com/download',
        'After installation, run: ollama serve',
      ],
    };
  }

  /**
   * Categorize error and return appropriate error information
   */
  private categorizeError(error: unknown): {
    type: string;
    message: string;
    actionButton?: { label: string; url: string };
  } {
    if (error instanceof Error) {
      // ECONNREFUSED - Ollama not running
      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('fetch failed') ||
        error.message.includes('Cannot connect to Ollama')
      ) {
        return {
          type: 'OLLAMA_CONNECTION',
          message:
            'Cannot connect to Ollama. Please ensure Ollama is running on http://localhost:11434',
          actionButton: {
            label: 'Open Ollama Docs',
            url: 'https://docs.ollama.com',
          },
        };
      }

      // 404 - Model not found
      if (error.message.includes('404') || error.message.includes('Model not found')) {
        return {
          type: 'OLLAMA_MODEL_NOT_FOUND',
          message: 'Model not found. Please pull the model using: ollama pull gpt-oss:120b-cloud',
          actionButton: {
            label: 'Open Ollama Docs',
            url: 'https://docs.ollama.com',
          },
        };
      }

      // Timeout
      if (
        error.message.includes('timeout') ||
        error.message.includes('timed out') ||
        error.name === 'AbortError'
      ) {
        return {
          type: 'OLLAMA_TIMEOUT',
          message: 'Ollama request timed out. The model may be loading. Please try again.',
          actionButton: {
            label: 'Open Ollama Docs',
            url: 'https://docs.ollama.com',
          },
        };
      }

      // Generic error
      return {
        type: 'UNKNOWN',
        message: error.message || 'An unknown error occurred',
      };
    }

    // Unknown error type
    return {
      type: 'UNKNOWN',
      message: 'An unknown error occurred',
    };
  }

  private onViewDisposed(): void {
    this.logger.info('Webview disposed');
    this.view = undefined;
    this.dispose();
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.js')
    );

    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'reset.css')
    );

    // Use static CSS filename (configured in vite.config.ts)
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'style.css')
    );

    const nonce = this.getNonce();

    this.logger.info(`Script URI: ${scriptUri.toString()}`);
    this.logger.info(`Style Reset URI: ${styleResetUri.toString()}`);
    this.logger.info(`Style URI: ${styleUri.toString()}`);
    this.logger.info(`CSP nonce: ${nonce}`);

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};" />
    <title>ForgeAI</title>
    <link rel="stylesheet" href="${styleResetUri}" />
    <link rel="stylesheet" href="${styleUri}" />
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">
      console.log('[ForgeAI] Webview initializing...');
      const vscodeApi = acquireVsCodeApi();
      window.vscode = vscodeApi;
      console.log('[ForgeAI] VS Code API acquired');
    </script>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;

    if (this.view) {
      this.view = undefined;
    }
  }
}
