import * as vscode from "vscode";
import { Logger } from "./utils/Logger";
import { StorageManager } from "./storage/StorageManager";
import { CommandManager } from "./utils/CommandManager";
import { WebviewManager } from "./utils/WebviewManager";

/**
 * Service interface for type safety
 * All services must implement the dispose method for proper cleanup
 */
interface IService {
  dispose(): void;
}

/**
 * ForgeAI Extension - Main extension class
 *
 * This class manages the lifecycle of the ForgeAI extension, including:
 * - Service initialization (Logger, Storage, Ollama)
 * - Command registration
 * - Provider registration (Language Model Chat Provider, Chat Participant)
 * - Webview management
 */
export class ForgeAIExtension {
  private readonly services: Map<string, IService> = new Map();
  private logger!: Logger;
  private storage!: StorageManager;
  private commandManager!: CommandManager;
  private webviewManager!: WebviewManager;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  /**
   * Activate the extension
   * Called by VS Code when the extension is activated
   */
  public async activate(): Promise<void> {
    try {
      this.initializeServices();
      this.registerCommands();

      this.logger.info("ForgeAI extension activated successfully");

      // Register disposal handler
      this._context.subscriptions.push(new vscode.Disposable(() => this.deactivate()));
    } catch (error) {
      console.error("Failed to activate ForgeAI extension:", error);
      vscode.window.showErrorMessage(
        `ForgeAI activation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      throw error;
    }
  }

  /**
   * Initialize all services required by the extension
   */
  private initializeServices(): void {
    // Initialize logger first (needed by other services)
    this.logger = new Logger(this._context);
    this.services.set("logger", this.logger);
    this.logger.info("Initializing ForgeAI services...");

    // Initialize storage manager
    this.storage = new StorageManager(this._context, this.logger);
    this.services.set("storage", this.storage);
    this.logger.info("Storage manager initialized");

    // Initialize webview manager and register provider
    this.webviewManager = new WebviewManager(this._context, this.storage, this.logger);
    this.webviewManager.register(); // Register the WebviewViewProvider
    this.services.set("webview", this.webviewManager);
    this.logger.info("Webview manager initialized");

    this.logger.info("All services initialized successfully");
  }

  /**
   * Register all commands provided by the extension
   */
  private registerCommands(): void {
    this.commandManager = new CommandManager(this._context, this.logger);

    // Register "forgeai.open" command
    this.commandManager.registerCommand("forgeai.open", () => this.openForgeAI());

    this.logger.info("Commands registered successfully");
  }

  /**
   * Open the ForgeAI webview panel
   */
  private openForgeAI(): void {
    try {
      this.logger.info("Opening ForgeAI panel");
      this.webviewManager.createOrShow();
    } catch (error) {
      this.logger.error("Failed to open ForgeAI panel", error);
      vscode.window.showErrorMessage(
        `Failed to open ForgeAI: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Deactivate the extension
   * Called by VS Code when the extension is deactivated
   */
  private deactivate(): void {
    this.logger.info("Deactivating ForgeAI extension...");

    // Dispose all services
    this.services.forEach((service, name) => {
      if (service && typeof service.dispose === "function") {
        try {
          service.dispose();
          this.logger.info(`Service disposed: ${name}`);
        } catch (error) {
          this.logger.error(`Failed to dispose service: ${name}`, error);
        }
      }
    });

    this.services.clear();
    this.logger.info("ForgeAI extension deactivated");
  }
}

/**
 * Extension activation entry point
 * Called by VS Code when the extension is activated
 */
export function activate(context: vscode.ExtensionContext): Promise<void> {
  const extension = new ForgeAIExtension(context);
  return extension.activate();
}

/**
 * Extension deactivation entry point
 * Called by VS Code when the extension is deactivated
 */
export function deactivate(): void {
  // Cleanup handled by ForgeAIExtension disposal
}
