import * as vscode from "vscode";
import { Logger } from "./Logger";

/**
 * CommandManager - Manages VS Code command registration and execution
 *
 * Provides centralized command registration with error handling and logging.
 */
export class CommandManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _logger: Logger
  ) {}

  /**
   * Register a command with error handling and logging
   * @param command The command identifier (e.g., "forgeai.open")
   * @param callback The command handler function
   */
  public registerCommand(command: string, callback: (...args: unknown[]) => unknown): void {
    const disposable = vscode.commands.registerCommand(command, async (..._args: unknown[]) => {
      try {
        this._logger.info(`Executing command: ${command}`);
        return await callback(..._args);
      } catch (error) {
        this._logger.error(`Command ${command} failed`, error);
        vscode.window.showErrorMessage(
          `Command failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    });

    this.disposables.push(disposable);
    this._context.subscriptions.push(disposable);
  }

  /**
   * Dispose all registered commands
   */
  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
  }
}
