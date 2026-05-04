import * as vscode from "vscode";

/**
 * Logger - Structured logging for ForgeAI extension
 *
 * Provides logging functionality with different severity levels (info, warn, error)
 * and outputs to a dedicated VS Code output channel.
 */
export class Logger implements vscode.Disposable {
  private readonly outputChannel: vscode.OutputChannel;

  constructor(context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel("ForgeAI");
    context.subscriptions.push(this.outputChannel);
  }

  /**
   * Log an informational message
   * @param message The message to log
   * @param args Additional arguments to log (will be JSON stringified)
   */
  public info(message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [INFO] ${message}`;
    this.outputChannel.appendLine(formatted);

    if (args.length > 0) {
      this.outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param args Additional arguments to log (will be JSON stringified)
   */
  public warn(message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [WARN] ${message}`;
    this.outputChannel.appendLine(formatted);

    if (args.length > 0) {
      this.outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param error Optional error object or unknown value
   */
  public error(message: string, error?: Error | unknown): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [ERROR] ${message}`;
    this.outputChannel.appendLine(formatted);

    if (error instanceof Error) {
      this.outputChannel.appendLine(`Error: ${error.message}`);
      if (error.stack) {
        this.outputChannel.appendLine(`Stack: ${error.stack}`);
      }
    } else if (error) {
      this.outputChannel.appendLine(JSON.stringify(error, null, 2));
    }

    // Show output channel for errors
    this.outputChannel.show(true);
  }

  /**
   * Dispose the logger and clean up resources
   */
  public dispose(): void {
    this.outputChannel.dispose();
  }
}
