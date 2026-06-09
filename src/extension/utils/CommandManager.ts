import * as vscode from 'vscode';
import { Logger } from './Logger';

/**
 * Production-ready Command Manager for ForgeAI extension
 * Handles command registration with error handling and logging
 */
export class CommandManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {}

  public registerCommand(command: string, callback: (...args: any[]) => any): void {
    const disposable = vscode.commands.registerCommand(command, async (...args) => {
      try {
        return await callback(...args);
      } catch (error) {
        this.logger.error(`Command ${command} failed`, error);
        vscode.window.showErrorMessage(
          `Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        throw error;
      }
    });

    this.disposables.push(disposable);
    this.context.subscriptions.push(disposable);
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
  }
}
