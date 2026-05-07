import * as vscode from 'vscode';

/**
 * Production-ready Logger service for ForgeAI extension
 * Provides structured logging with timestamps and error tracking
 */
export class Logger implements vscode.Disposable {
  private readonly outputChannel: vscode.OutputChannel;

  constructor(context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('ForgeAI');
    context.subscriptions.push(this.outputChannel);
  }

  public info(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [INFO] ${message}`;
    this.outputChannel.appendLine(formatted);

    if (args.length > 0) {
      this.outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
  }

  public error(message: string, error?: Error | unknown): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [ERROR] ${message}`;
    this.outputChannel.appendLine(formatted);

    if (error instanceof Error) {
      this.outputChannel.appendLine(`Error: ${error.message}`);
      this.outputChannel.appendLine(`Stack: ${error.stack}`);
    } else if (error) {
      this.outputChannel.appendLine(JSON.stringify(error, null, 2));
    }

    this.outputChannel.show(true);
  }

  public warn(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [WARN] ${message}`;
    this.outputChannel.appendLine(formatted);

    if (args.length > 0) {
      this.outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}
