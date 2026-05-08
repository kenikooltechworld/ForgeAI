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
      this.webviewManager = new WebviewManager(this.context, storage, logger, ollama, toolRegistry);

      const webviewDisposable = vscode.window.registerWebviewViewProvider(
        'forgeai.chatView',
        this.webviewManager,
        {
          webviewOptions: {
            retainContextWhenHidden: true,
          },
        }
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

      const disposable = vscode.lm.registerLanguageModelChatProvider('forgeai', provider, {
        vendor: 'forgeai',
        name: 'ForgeAI',
        version: '1.0.0',
      });

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
      // Pass OllamaClient (ollama), ToolRegistry, and Logger
      const chatParticipant = new ChatParticipant(ollama, toolRegistry, logger);

      const participant = vscode.chat.createChatParticipant(
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

    // Reset onboarding state to default (all tooltips will show again)
    await storage.setGlobalValue('forgeai.onboarding', {
      hasSeenThinkingTooltip: false,
      hasSeenToolTooltip: false,
      hasSeenCodeChangeTooltip: false,
    });

    // Notify the webview to reload the onboarding state
    if (this.webviewManager) {
      // The webview will automatically reload the state on next open
      vscode.window.showInformationMessage(
        'Onboarding tooltips have been reset. They will appear again on your next interaction.'
      );
    }

    logger.info('Onboarding tooltips reset successfully');
  }

  private deactivate(): void {
    const logger = this.services.get('logger') as Logger;
    logger.info('Deactivating ForgeAI extension');

    // Dispose all services
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
