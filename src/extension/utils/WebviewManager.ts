import * as vscode from 'vscode';
import { StorageManager } from '../storage/StorageManager';
import { Logger } from './Logger';
import { OllamaClient, OllamaMessage } from '../ollama/OllamaClient';
import { AgentLoopUpdate } from '../ollama/AgentLoop';
import { ToolRegistry } from '../tools/ToolRegistry';
import { TestResultsParser } from './TestResultsParser';
import type { ForgeAIWorkspace } from '../forgeaiWorkspace/ForgeAIWorkspace';
import type { ResearchAgent } from '../agents/research/ResearchAgent';
import type { RagService } from '../rag/RagService';
import { SpecWriterAgent } from '../agents/spec/SpecWriterAgent';
import { DEFAULT_MODEL } from '../config/ModelConfig';
import { ContextManager } from '../spec/ContextManager';
import { SessionMemory } from './SessionMemory';
import { SessionContextInjector } from '../ollama/SessionContextInjector';
import { ConversationMemory } from './ConversationMemory';

/**
 * Production-ready Webview Manager for ForgeAI extension
 * Implements WebviewViewProvider and proper disposal
 */
export class WebviewManager implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
  private readonly disposables: vscode.Disposable[] = [];
  private currentAgentLoop?: any;
  private readonly contextManager: ContextManager;
  private readonly sessionMemory: SessionMemory;
  private readonly sessionContextInjector: SessionContextInjector;
  private readonly conversationMemory: ConversationMemory;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly storageManager: StorageManager,
    private readonly logger: Logger,
    private readonly ollamaClient: OllamaClient,
    private readonly toolRegistry?: ToolRegistry,
    private readonly forgeaiWorkspace?: ForgeAIWorkspace,
    private readonly researchAgent?: ResearchAgent,
    private readonly ragService?: RagService
  ) {
    this.logger.info(
      'WebviewManager initialized' +
        (toolRegistry ? ' with ToolRegistry support' : '') +
        (forgeaiWorkspace ? ' and ForgeAIWorkspace' : '') +
        (ragService ? ' and RAG' : '') +
        ' and context management'
    );

    // Initialize context management components
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    this.contextManager = new ContextManager(workspaceRoot);
    this.sessionMemory = new SessionMemory(workspaceRoot, this.logger);
    this.sessionContextInjector = new SessionContextInjector(this.sessionMemory, this.logger);
    this.conversationMemory = new ConversationMemory(this.storageManager);
  }

  public async reveal(): Promise<void> {
    if (!this.view) {
      await vscode.commands.executeCommand('workbench.view.extension.forgeai');
      return;
    }

    this.view.show?.(true);
  }

  /**
   * Notify webview of theme change (Task 14.1)
   */
  public notifyThemeChange(theme: vscode.ColorTheme): void {
    if (!this.view) {
      return;
    }

    this.logger.info(`Notifying webview of theme change: ${theme.kind}`);

    // Send theme change message to webview
    this.view.webview.postMessage({
      type: 'themeChanged',
      theme: {
        kind: theme.kind, // 1 = Light, 2 = Dark, 3 = High Contrast Light, 4 = High Contrast Dark
      },
    });
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
            message.model || DEFAULT_MODEL, // Use provided model or default
            message.images || [], // Extract images from message
            {
              isTaskExecution: message.isTaskExecution,
              specId: message.specId,
              taskId: message.taskId,
            }
          );
          break;
        }
        case 'generateSpec': {
          this.logger.info('Handling generateSpec from webview');
          await this.handleGenerateSpec(
            message.title as string,
            message.description as string,
            (message.mode as string) === 'quick' ? 'quick' : 'full'
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
          try {
            await this.storageManager.setWorkspaceValue(message.key, message.value);
            // Send success response
            this.view?.webview.postMessage({
              type: 'workspaceStateSet',
              key: message.key,
              success: true,
            });
          } catch (error) {
            this.logger.error(`Failed to set workspace state for ${message.key}`, error);

            // Check if this is a storage quota error (Task 15.2)
            if (error instanceof Error && error.message === 'STORAGE_QUOTA_EXCEEDED') {
              this.logger.warn('Storage quota exceeded - notifying webview');
              this.view?.webview.postMessage({
                type: 'storageQuotaExceeded',
                key: message.key,
                error: 'Storage quota exceeded. Please delete old conversations to free up space.',
              });
            } else {
              // Send generic error response
              this.view?.webview.postMessage({
                type: 'workspaceStateSet',
                key: message.key,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
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
            DEFAULT_MODEL
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
        case 'stopAgentLoop': {
          this.logger.info('Handling stopAgentLoop');
          this.handleStopAgentLoop(message.conversationId);
          break;
        }
        case 'retryAfterError': {
          this.logger.info('Handling retryAfterError');
          await this.handleRetryAfterError(message.conversationId, message.errorMessage);
          break;
        }
        case 'conversationHistoryForRetry': {
          this.logger.info('Handling conversationHistoryForRetry');
          // Extract the last user message and resend it
          const history = message.conversationHistory || [];
          const model = message.model || DEFAULT_MODEL;

          // Find the last user message
          const lastUserMessage = [...history].reverse().find((msg: any) => msg.role === 'user');

          if (lastUserMessage) {
            this.logger.info(`Retrying last user message: ${lastUserMessage.content}`);
            // Remove the error message from history before retrying
            const cleanHistory = history.filter((msg: any) => msg.role !== 'error');
            await this.handleSendMessage(
              message.conversationId,
              lastUserMessage.content,
              cleanHistory,
              model,
              lastUserMessage.images || []
            );
          } else {
            this.logger.warn('No user message found to retry');
          }
          break;
        }
        case 'skipAfterError': {
          this.logger.info('Handling skipAfterError');
          // Just log the skip action - no further action needed
          this.logger.info(`User skipped error in conversation ${message.conversationId}`);
          break;
        }
        case 'openSettings': {
          this.logger.info('Handling openSettings');
          // Send message to webview to open settings panel
          this.view?.webview.postMessage({
            type: 'openSettings',
          });
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
    model: string = DEFAULT_MODEL,
    images: Array<{ name: string; dataUrl: string }> = [],
    options: { isTaskExecution?: boolean; specId?: string; taskId?: string } = {}
  ): Promise<void> {
    this.logger.info(`Sending message to Ollama: ${message}`);
    this.logger.info(`Using model: ${model}`);
    this.logger.info(`Conversation history length: ${conversationHistory.length}`);
    this.logger.info(`Attached images: ${images.length}`);
    if (options.isTaskExecution) {
      this.logger.info(`Task execution mode: specId=${options.specId}, taskId=${options.taskId}`);
    }

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

      // Use AgentLoop for autonomous tool execution with full context management
      const { AgentLoop } = await import('../ollama/AgentLoop');
      const agentLoop = new AgentLoop(
        this.ollamaClient,
        this.logger,
        this.toolRegistry,
        this.ragService,
        this.conversationMemory,
        this.sessionContextInjector,
        this.contextManager
      );

      // Convert conversation history to Ollama message format
      const messages: OllamaMessage[] = conversationHistory.map((msg: any) => {
        const ollamaMsg: OllamaMessage = {
          role: msg.role,
          content: msg.content || '',
        };

        // Only include optional fields if they have values
        if (msg.thinking) ollamaMsg.thinking = msg.thinking;
        if (msg.tool_calls) ollamaMsg.tool_calls = msg.tool_calls;
        if (msg.name) ollamaMsg.name = msg.name;
        if (msg.images) ollamaMsg.images = msg.images;

        return ollamaMsg;
      });

      // Extract base64 image data from data URLs
      const imageData = images.map((img) => {
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64Data = img.dataUrl.split(',')[1];
        return base64Data;
      });

      // Check if model supports vision (only send images to vision models)
      const isVisionModel =
        model.includes('llava') ||
        model.includes('vision') ||
        model.includes('bakllava') ||
        model.includes('moondream') ||
        model.includes('gemma4');

      // Warn user if they're trying to send images to a non-vision model
      if (imageData.length > 0 && !isVisionModel) {
        this.logger.warn(
          `User tried to send ${imageData.length} images to non-vision model: ${model}`
        );
        this.view?.webview.postMessage({
          type: 'streamError',
          conversationId,
          errorType: 'VISION_MODEL_REQUIRED',
          errorMessage: `The model "${model}" does not support images. Please select a vision model like "llava" or "llava:13b" from the model dropdown to use image attachments.`,
        });
        return;
      }

      // Add current user message with images (only required fields)
      const userMessage: OllamaMessage = {
        role: 'user',
        content: message,
      };

      // Only add images if there are any and model supports vision
      if (imageData.length > 0 && isVisionModel) {
        userMessage.images = imageData;
        this.logger.info(`Added ${imageData.length} images to user message`);
      }

      messages.push(userMessage);

      this.logger.info(`Total messages to send: ${messages.length}`);

      // Build spec context for task execution
      let specContext: import('../spec/types').SpecContext | undefined;
      if (options.isTaskExecution && options.specId) {
        try {
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (workspaceRoot) {
            const { SpecReader } = await import('../spec/SpecReader');
            const specReader = new SpecReader();
            const specDir = vscode.Uri.joinPath(
              vscode.Uri.file(workspaceRoot),
              '.forgeai',
              'specs',
              options.specId
            ).fsPath;
            const spec = await specReader.parseSpecDirectory(specDir);

            // Enforce sequential task locking: reject if any prior task is not complete
            if (options.taskId) {
              const taskIndex = spec.tasks.findIndex((t) => t.id === options.taskId);
              const lockedBy = spec.tasks
                .slice(0, taskIndex)
                .filter((t) => t.status !== 'complete');
              if (lockedBy.length > 0) {
                const errorMsg = `Task ${options.taskId} is locked. Complete previous tasks first: ${lockedBy.map((t) => t.id).join(', ')}.`;
                this.logger.warn(errorMsg);
                this.view?.webview.postMessage({
                  type: 'streamError',
                  conversationId,
                  errorType: 'taskLocked',
                  errorMessage: errorMsg,
                  actionButton: { label: 'Run All Tasks', action: 'runAll' },
                });
                return;
              }
            }

            specContext = {
              spec,
              currentTask: spec.tasks.find((t) => t.id === options.taskId) || spec.tasks[0],
              constitution: '',
              memoryBank: { product: '', structure: '', tech: '' },
              completedTasks: spec.tasks
                .filter((t) => t.status === 'complete')
                .map((t) => ({
                  taskId: t.id,
                  description: t.description,
                  artifacts: t.producedArtifacts,
                  summary: `Completed: ${t.description}`,
                })),
            };
            this.logger.info(`Loaded spec context for task execution: ${spec.id}`);
          }
        } catch (err) {
          this.logger.warn(`Failed to load spec context for task execution: ${err}`);
        }
      }

      // Execute agent loop with streaming updates and optional spec context
      await this.executeAgentLoop(agentLoop, conversationId, messages, tools, model, specContext);
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
   * Handle spec generation request from the webview.
   * Creates a SpecWriterAgent and runs the spec generation flow.
   */
  private async handleGenerateSpec(
    title: string,
    description: string,
    mode: 'quick' | 'full'
  ): Promise<void> {
    if (!this.forgeaiWorkspace || !this.forgeaiWorkspace.spec) {
      this.view?.webview.postMessage({
        type: 'specGenerationFailed',
        error: 'ForgeAIWorkspace not initialized. Open a workspace folder first.',
      });
      return;
    }

    const specModel = DEFAULT_MODEL;
    const agent = new SpecWriterAgent({
      executeLLM: async (systemPrompt, userPrompt) => {
        const response = await this.ollamaClient.chat({
          model: specModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          options: { temperature: 0.3, num_ctx: 8192 },
        });
        const chatResponse = response as { message: { content: string } };
        return chatResponse.message.content;
      },
      specManager: this.forgeaiWorkspace.spec,
      productManager: this.forgeaiWorkspace.product,
      memoryManager: this.forgeaiWorkspace.memory,
      researchAgent: (this.researchAgent ?? undefined) as ResearchAgent,
    });

    this.view?.webview.postMessage({
      type: 'specGenerationStarted',
      title,
    });

    try {
      const result = await agent.generate({ title, description, mode }, (event) => {
        this.view?.webview.postMessage({
          type: 'specGenerationProgress',
          phase: event.phase,
          status: event.status,
          message: event.message,
        });
      });

      if (result.success) {
        this.view?.webview.postMessage({
          type: 'specGenerated',
          specId: result.specId,
          title: result.title,
          phasesCompleted: result.phasesCompleted,
        });
      } else {
        this.view?.webview.postMessage({
          type: 'specGenerationFailed',
          error: result.error,
        });
      }
    } catch (err) {
      this.view?.webview.postMessage({
        type: 'specGenerationFailed',
        error: err instanceof Error ? err.message : 'Unknown error',
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
      const agentLoop = new AgentLoop(
        this.ollamaClient,
        this.logger,
        this.toolRegistry,
        this.ragService,
        this.conversationMemory,
        this.sessionContextInjector,
        this.contextManager
      );

      // Convert conversation history to Ollama message format (for continue after max iterations)
      const messages: OllamaMessage[] = conversationHistory.map((msg: any) => {
        const ollamaMsg: OllamaMessage = {
          role: msg.role,
          content: msg.content || '',
        };

        // Only include optional fields if they have values
        if (msg.thinking) ollamaMsg.thinking = msg.thinking;
        if (msg.tool_calls) ollamaMsg.tool_calls = msg.tool_calls;
        if (msg.name) ollamaMsg.name = msg.name;

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
      await this.executeAgentLoop(agentLoop, conversationId, messages, tools, DEFAULT_MODEL);
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
    model: string = DEFAULT_MODEL,
    specContext?: import('../spec/types').SpecContext
  ): Promise<void> {
    // Store the current agent loop instance so we can stop it
    this.currentAgentLoop = agentLoop;

    // Notify webview that agent loop started
    this.view?.webview.postMessage({
      type: 'agentLoopStarted',
      conversationId,
    });

    try {
      await agentLoop.execute(
        messages,
        async (update: AgentLoopUpdate) => {
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
                    toolName: this.getToolDisplayName(update.toolCall.function.name),
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
                    toolName: this.getToolDisplayName(update.toolCall.function.name),
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
                    toolName: this.getToolDisplayName(update.toolCall.function.name),
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

               // Notify webview that agent loop stopped
               this.view?.webview.postMessage({
                 type: 'agentLoopStopped',
                 conversationId,
               });

               // Save session memory for conversation continuity
               try {
                 // Extract user and assistant messages for session memory
                 const userMessages = messages
                   .filter((msg: OllamaMessage) => msg.role === 'user')
                   .map((msg) => ({ role: 'user' as const, content: msg.content || '' }));
                 
                 const assistantMessages = messages
                   .filter((msg: OllamaMessage) => msg.role === 'assistant')
                   .map((msg) => ({ role: 'assistant' as const, content: msg.content || '' }));
                 
                 // Combine and take last 10 exchanges (20 messages) for context
                 const combinedMessages: Array<{ role: string; content: string }> = [];
                 for (let i = 0; i < Math.max(userMessages.length, assistantMessages.length); i++) {
                   if (i < userMessages.length) combinedMessages.push(userMessages[i]);
                   if (i < assistantMessages.length) combinedMessages.push(assistantMessages[i]);
                 }
                 
                 // Take last 20 messages (or fewer if conversation is shorter)
                 const recentMessages = combinedMessages.slice(-20);
                 
                 // Generate simple summary and next steps
                 const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
                 const lastAssistantMessage = assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].content : '';
                 
                 const summary = `Conversation about: ${lastUserMessage.substring(0, 100)}${lastUserMessage.length > 100 ? '...' : ''}`;
                 const nextSteps = lastAssistantMessage.length > 0 
                   ? `Continue from: ${lastAssistantMessage.substring(0, 100)}${lastAssistantMessage.length > 100 ? '...' : ''}`
                   : 'No specific next steps';
                 
                 await this.sessionContextInjector.saveSessionMemory(
                   conversationId,
                   recentMessages,
                   summary,
                   nextSteps,
                   {} // empty context for now
                 );
                 
                 this.logger.info(`Session memory saved for conversation ${conversationId}`);
               } catch (error) {
                 this.logger.error(`Failed to save session memory for ${conversationId}`, error);
               }
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
        model, // Pass the model parameter
{ specContext, conversationId } // Pass conversationId for memory management
      );
    } finally {
      // Clear the current agent loop instance
      this.currentAgentLoop = undefined;
      this.logger.info('Agent loop instance cleared');
    }
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
   * Convert technical tool names to user-friendly display names
   */
  private getToolDisplayName(toolName: string): string {
    const toolNameMap: Record<string, string> = {
      // File System Tools
      forgeai_readFile: 'Read file',
      forgeai_writeFile: 'Write file',
      forgeai_listFiles: 'List files',
      forgeai_listDirectory: 'List directory',
      forgeai_createDirectory: 'Create directory',
      forgeai_deleteFile: 'Delete file',
      forgeai_copyFile: 'Copy file',
      forgeai_renameFile: 'Rename file',
      forgeai_getFileStats: 'Get file info',
      forgeai_watchFiles: 'Watch files',
      forgeai_findFiles: 'Find files',
      forgeai_generateDiff: 'Generate diff',
      forgeai_searchInFiles: 'Search in files',

      // Terminal Tools
      forgeai_runCommand: 'Run command',
      forgeai_createTerminal: 'Create terminal',

      // Git Tools
      forgeai_gitStatus: 'Git status',
      forgeai_gitCommit: 'Git commit',
      forgeai_gitPush: 'Git push',
      forgeai_gitPull: 'Git pull',
      forgeai_gitCreateBranch: 'Create branch',

      // Diagnostics Tools
      forgeai_getErrors: 'Get errors',
      forgeai_getDiagnostics: 'Get diagnostics',
    };

    return toolNameMap[toolName] || toolName.replace('forgeai_', '');
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
   * Handle stopping the agent loop
   */
  private handleStopAgentLoop(conversationId: string): void {
    this.logger.info(`Stopping agent loop for conversation: ${conversationId}`);

    if (this.currentAgentLoop) {
      // Call stop() on the agent loop
      this.currentAgentLoop.stop();
      this.logger.info('Agent loop stop requested');

      // Send stopped message to webview
      this.view?.webview.postMessage({
        type: 'agentLoopStopped',
        conversationId,
      });

      // Send a message to the conversation
      this.view?.webview.postMessage({
        type: 'streamChunk',
        conversationId,
        data: {
          content: '\n\n⏹ Stopped by user',
          thinking: '',
          toolCalls: [],
        },
        done: true,
      });
    } else {
      this.logger.warn('No active agent loop to stop');
    }
  }

  /**
   * Handle retry after error (Task 16.2)
   * Re-execute the failed operation by resending the last user message
   */
  private async handleRetryAfterError(conversationId: string, errorMessage: any): Promise<void> {
    this.logger.info(`Retrying after error in conversation: ${conversationId}`);
    this.logger.info(`Error message: ${JSON.stringify(errorMessage)}`);

    // Request conversation history from webview to get the last user message
    this.view?.webview.postMessage({
      type: 'requestConversationHistory',
      conversationId,
      purpose: 'retry',
    });
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
   * Task 16.2 - Log all errors to extension output channel for debugging
   */
  private categorizeError(error: unknown): {
    type: string;
    message: string;
    actionButton?: { label: string; url: string };
  } {
    // Log error to output channel for debugging (Task 16.2)
    this.logger.error('Error occurred during agent execution', error);

    if (error instanceof Error) {
      // ECONNREFUSED - Ollama not running
      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('fetch failed') ||
        error.message.includes('Cannot connect to Ollama')
      ) {
        this.logger.error('OLLAMA_CONNECTION error: Cannot connect to Ollama service');
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
        this.logger.error('OLLAMA_MODEL_NOT_FOUND error: Model not available');
        return {
          type: 'OLLAMA_MODEL_NOT_FOUND',
          message: `Model not found. Please pull the model using: ollama pull ${DEFAULT_MODEL}`,
          actionButton: {
            label: 'Open Ollama Docs',
            url: 'https://docs.ollama.com',
          },
        };
      }

      // Context overflow - tokens exceed model limit
      if (error.message.includes('Context overflow') || error.message.includes('tokens exceeds')) {
        this.logger.error('CONTEXT_OVERFLOW error: Too many tokens in request');
        return {
          type: 'CONTEXT_OVERFLOW',
          message:
            'Conversation context exceeded model limit. Try: (1) Switch to a model with larger context, ' +
            '(2) Continue in a fresh conversation, or (3) Implement the task in smaller steps.',
          actionButton: undefined,
        };
      }

      // HTTP 503 - Service unavailable (model loading or overloaded)
      if (error.message.includes('503') || error.message.includes('Service Unavailable')) {
        this.logger.error('OLLAMA_SERVICE_UNAVAILABLE: Model may be loading or server overloaded');
        return {
          type: 'OLLAMA_SERVICE_UNAVAILABLE',
          message:
            'Ollama service unavailable. The model may be loading or the server is overloaded. ' +
            'Please wait a moment and try again.',
          actionButton: {
            label: 'Retry',
            url: '',
          },
        };
      }

      // HTTP 400 - Bad request (often context related)
      if (error.message.includes('400') || error.message.includes('Bad Request')) {
        this.logger.error('OLLAMA_BAD_REQUEST: Check model name and request format');
        return {
          type: 'OLLAMA_BAD_REQUEST',
          message:
            'Ollama rejected the request. This may be due to context size or an invalid model name. ' +
            'Verify settings and try a smaller context.',
          actionButton: undefined,
        };
      }

      // Timeout
      if (
        error.message.includes('timeout') ||
        error.message.includes('timed out') ||
        error.name === 'AbortError'
      ) {
        this.logger.error('OLLAMA_TIMEOUT error: Request timed out');
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
      this.logger.error(`UNKNOWN error: ${error.message}`);
      return {
        type: 'UNKNOWN',
        message: error.message || 'An unknown error occurred',
      };
    }

    // Unknown error type
    this.logger.error('UNKNOWN error: Non-Error object thrown');
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

    const logoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'kenikoolLogo.png')
    );

    const nonce = this.getNonce();

    this.logger.info(`Script URI: ${scriptUri.toString()}`);
    this.logger.info(`Style Reset URI: ${styleResetUri.toString()}`);
    this.logger.info(`Style URI: ${styleUri.toString()}`);
    this.logger.info(`Logo URI: ${logoUri.toString()}`);
    this.logger.info(`CSP nonce: ${nonce}`);

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};" />
    <title>ForgeAI</title>
    <style nonce="${nonce}">
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(0.92); }
      }
    </style>
    <link rel="stylesheet" href="${styleResetUri}" />
    <link rel="stylesheet" href="${styleUri}" />
  </head>
  <body>
    <div id="root">
      <div id="forgeai-loading" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;font-family:var(--vscode-font-family);background:var(--vscode-editor-background);">
        <img src="${logoUri}" alt="Kenikool Logo" style="width:64px;height:64px;object-fit:contain;border-radius:50px;animation:pulse 1.5s ease-in-out infinite;" />
        <span style="color:var(--vscode-descriptionForeground);font-size:13px;">Loading ForgeAI...</span>
      </div>
    </div>
    <script nonce="${nonce}">
      console.log('[ForgeAI] Webview initializing...');
      window.__FORGEAI_LOGO_URI__ = '${logoUri}';
      const vscodeApi = acquireVsCodeApi();
      window.vscode = vscodeApi;
      console.log('[ForgeAI] VS Code API acquired');
      window.addEventListener('error', function(e) {
        console.error('[ForgeAI] Global error:', e.message, e.filename, e.lineno);
        const root = document.getElementById('root');
        if (root) {
          root.innerHTML = '<div style="padding:20px;color:var(--vscode-errorForeground);font-family:var(--vscode-font-family);"><h3>ForgeAI Error</h3><pre>' + e.message + '<br/>' + (e.filename || '') + ':' + (e.lineno || '') + '</pre></div>';
        }
      });
      window.addEventListener('unhandledrejection', function(e) {
        console.error('[ForgeAI] Unhandled rejection:', e.reason);
        const root = document.getElementById('root');
        if (root) {
          root.innerHTML = '<div style="padding:20px;color:var(--vscode-errorForeground);font-family:var(--vscode-font-family);"><h3>ForgeAI Error</h3><pre>Unhandled Promise Rejection:<br/>' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)) + '</pre></div>';
        }
      });
    </script>
    <script type="module" nonce="${nonce}" src="${scriptUri}" onerror="document.getElementById('root').innerHTML='<div style=\'padding:20px;color:var(--vscode-errorForeground);\'>Failed to load ForgeAI script.</div>'"></script>
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

  // ─── Spec-driven panel helpers (stubs for Phase 5 integration) ──────────

  public postMessage(message: any): void {
    this.view?.webview.postMessage(message);
  }

  public async loadSpecIntoPanels(spec: any): Promise<void> {
    this.view?.webview.postMessage({ type: 'loadSpec', spec });
  }

  public updateTaskInPanel(task: any): void {
    this.view?.webview.postMessage({ type: 'updateTask', task });
  }

  public async generateSpec(conversationId: string, userRequest: string): Promise<void> {
    this.view?.webview.postMessage({ type: 'generateSpec', conversationId, userRequest });
  }

  public showRagSettings(): void {
    this.view?.webview.postMessage({ type: 'showRagSettings' });
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;

    if (this.view) {
      this.view = undefined;
    }
  }
}
