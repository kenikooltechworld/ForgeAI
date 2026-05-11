import * as vscode from 'vscode';
import { StorageManager } from './storage/StorageManager';
import { Logger } from './utils/Logger';
import { CommandManager } from './utils/CommandManager';
import { WebviewManager } from './utils/WebviewManager';

/**
 * ForgeAI Extension - Production-ready OOP architecture
 * Follows VS Code extension best practices with proper service initialization and disposal
 */
export class ForgeAIExtension {
  private readonly services: Map<string, any> = new Map();
  private webviewManager?: WebviewManager;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async activate(): Promise<void> {
    await this.initializeServices();
    this.registerCommands();
    this.registerProviders();

    this.context.subscriptions.push(new vscode.Disposable(() => this.deactivate()));

    const logger = this.services.get('logger') as Logger;
    logger.info('ForgeAI extension activated successfully');
  }

  private async initializeServices(): Promise<void> {
    // Initialize core services
    const logger = new Logger(this.context);
    const storage = new StorageManager(this.context);

    this.services.set('logger', logger);
    this.services.set('storage', storage);

    // Initialize Ollama client
    const { OllamaClient } = await import('./ollama/OllamaClient');
    const ollama = new OllamaClient('http://localhost:11434', logger);
    this.services.set('ollama', ollama);

    // Initialize Tool Registry (Task 4.1)
    const { ToolRegistry } = await import('./tools/ToolRegistry');
    const toolRegistry = new ToolRegistry(this.context, logger);
    toolRegistry.registerAllTools();
    this.services.set('toolRegistry', toolRegistry);

    // Check Ollama availability
    const isAvailable = await ollama.isAvailable();
    if (isAvailable) {
      logger.info('Ollama is available and ready');
    } else {
      logger.warn('Ollama is not running. Please start Ollama to use AI features.');
    }

    // Kick off initial RAG ingestion (first install only).
    // MVP: runs once asynchronously; later we’ll add scheduler + diff/replace.
    try {
      const didInitialIngest = await storage.getGlobalValue('forgeai.rag.didInitialIngest', false);
      if (!didInitialIngest) {
        const dbPath = this.context.globalStorageUri.fsPath + '/lancedb';
        const embeddingsModel = 'nomic-embed-text:latest';

        void (async () => {
          logger.info('RAG ingestion: starting initial scrape (first install)...');
          const { RagIngestionService } = await import('./rag/RagIngestionService');
          await new RagIngestionService({
            logger,
            ollamaEmbeddingsModel: embeddingsModel,
            dbPath,
          }).runOnSources({ sourceIds: ['reactjs'] });

          await storage.setGlobalValue('forgeai.rag.didInitialIngest', true);
          logger.info('RAG ingestion: initial scrape complete');
        })().catch((err) => {
          logger.error('RAG ingestion: initial scrape failed', err);
        });
      }

      // Always schedule/attempt refresh after activation (will self-skip if not due).
      const { RagScheduler } = await import('./rag/scheduler/RagScheduler');
      const dbPath = this.context.globalStorageUri.fsPath + '/lancedb';
      const embeddingsModel = 'nomic-embed-text:latest';

// StorageManager.getGlobalValue is synchronous (returns T), but RagSchedulerDeps expects Promise<T>.
// Wrap to satisfy the scheduler interface.
      // RagSchedulerDeps typing expects async storage functions, but StorageManager.getGlobalValue is sync.
      // Cast the whole dependency object to avoid a generic mismatch and keep runtime behavior correct.
      void new (RagScheduler as any)({
        logger,
        ollamaEmbeddingsModel: embeddingsModel,
        dbPath,
        storage: {
          getGlobalValue: async <T>(key: string, defaultValue: T): Promise<T> => {
            return storage.getGlobalValue<T>(key, defaultValue);
          },
          setGlobalValue: storage.setGlobalValue.bind(storage),
        },
        refreshMs: 3 * 24 * 60 * 60 * 1000,
      }).runRefresh({ sourceIds: ['reactjs'] });
    } catch (err) {
      logger.warn('RAG ingestion bootstrap skipped (config/storage error)', err);
    }

    logger.info('Core services initialized');
  }

  private registerCommands(): void {
    const logger = this.services.get('logger') as Logger;
    const commandManager = new CommandManager(this.context, logger);

    commandManager.registerCommand('forgeai.open', () => this.openForgeAI());
    commandManager.registerCommand('forgeai.manage', () => this.manageForgeAI());
    commandManager.registerCommand('forgeai.resetOnboarding', () => this.resetOnboarding());

    this.context.subscriptions.push(commandManager);
    logger.info('Commands registered');
  }

  private registerProviders(): void {
    const logger = this.services.get('logger') as Logger;
    const storage = this.services.get('storage') as StorageManager;
    const ollama = this.services.get('ollama');
    const toolRegistry = this.services.get('toolRegistry');

    try {
      // Register webview provider
      this.webviewManager = new WebviewManager(
        this.context,
        storage,
        logger,
        ollama,
        toolRegistry
      );

      // VS Code typings in this repo expect TWO args here.
      const webviewDisposable = vscode.window.registerWebviewViewProvider(
        'forgeai.chatView',
        this.webviewManager
      );

      this.context.subscriptions.push(webviewDisposable);
      logger.info('Webview provider registered successfully for view ID: forgeai.chatView');

      // Register theme change listener (Task 14.1)
      this.registerThemeChangeListener(logger);

      // Register Language Model Chat Provider (Task 11.1)
      this.registerLanguageModelChatProvider(logger, ollama, toolRegistry);

      // Register Chat Participant (Task 11.2)
      this.registerChatParticipant(logger, ollama, toolRegistry);
    } catch (error) {
      logger.error('Failed to register providers', error);
      throw error;
    }
  }

  private registerThemeChangeListener(logger: Logger): void {
    // Listen for theme changes (Task 14.1)
    const themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme((theme) => {
      logger.info(`Theme changed to: ${theme.kind}`);

      // Forward theme change to webview
      if (this.webviewManager) {
        this.webviewManager.notifyThemeChange(theme);
      }
    });

    this.context.subscriptions.push(themeChangeDisposable);
    logger.info('Theme change listener registered');
  }

  private async registerLanguageModelChatProvider(
    logger: Logger,
    ollama: any,
    toolRegistry: any
  ): Promise<void> {
    try {
      const { LanguageModelChatProvider } = await import('./providers/LanguageModelChatProvider');
      const provider = new LanguageModelChatProvider(ollama, logger, toolRegistry);

// VS Code typing in this repo expects TWO arguments here.
      // repo typing expects (id, provider) only
      const disposable = (vscode.lm as any).registerLanguageModelChatProvider('forgeai', provider as any);

      this.context.subscriptions.push(disposable);
      logger.info('Language Model Chat Provider registered successfully');
    } catch (error) {
      logger.error('Failed to register Language Model Chat Provider', error);
      // Don't throw - this is optional functionality
    }
  }

  private async registerChatParticipant(
    logger: Logger,
    ollama: any,
    toolRegistry: any
  ): Promise<void> {
    try {
      const { ChatParticipant } = await import('./providers/ChatParticipant');
      const chatParticipant = new ChatParticipant(ollama, toolRegistry, logger);

      const participant = (vscode.chat as any).createChatParticipant(
        'forgeai.assistant',
        chatParticipant.handleRequest.bind(chatParticipant)
      );

      participant.iconPath = vscode.Uri.joinPath(
        this.context.extensionUri,
        'resources',
        'forgeai-icon.svg'
      );
      participant.followupProvider = {
        provideFollowups: chatParticipant.provideFollowups.bind(chatParticipant),
      };

      this.context.subscriptions.push(participant);
      logger.info('Chat Participant registered successfully with AgentLoop integration');
    } catch (error) {
      logger.error('Failed to register Chat Participant', error);
      // Don't throw - this is optional functionality
    }
  }

  private async openForgeAI(): Promise<void> {
    const logger = this.services.get('logger') as Logger;
    logger.info('Opening ForgeAI view');

    if (this.webviewManager) {
      await this.webviewManager.reveal();
    }
  }

  private manageForgeAI(): void {
    vscode.window.showInformationMessage(
      'ForgeAI settings and model management will be available here soon.'
    );
  }

  private async resetOnboarding(): Promise<void> {
    const logger = this.services.get('logger') as Logger;
    const storage = this.services.get('storage') as StorageManager;

    logger.info('Resetting onboarding tooltips');

    await storage.setGlobalValue('forgeai.onboarding', {
      hasSeenThinkingTooltip: false,
      hasSeenToolTooltip: false,
      hasSeenCodeChangeTooltip: false,
    });

    if (this.webviewManager) {
      vscode.window.showInformationMessage(
        'Onboarding tooltips have been reset. They will appear again on your next interaction.'
      );
    }

    logger.info('Onboarding tooltips reset successfully');
  }

  private deactivate(): void {
    const logger = this.services.get('logger') as Logger;
    logger.info('Deactivating ForgeAI extension');

    this.services.forEach((service) => {
      if ('dispose' in service && typeof service.dispose === 'function') {
        service.dispose();
      }
    });
    this.services.clear();

    if (this.webviewManager) {
      this.webviewManager.dispose();
      this.webviewManager = undefined;
    }
  }
}

/**
 * Extension activation entry point
 */
export function activate(context: vscode.ExtensionContext): Promise<void> {
  const extension = new ForgeAIExtension(context);
  return extension.activate();
}

/**
 * Extension deactivation entry point
 */
export function deactivate(): void {
  // Cleanup handled by ForgeAIExtension
}
