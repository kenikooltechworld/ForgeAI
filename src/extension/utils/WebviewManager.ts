import * as vscode from "vscode";
import { StorageManager } from "../storage/StorageManager";
import { Logger } from "./Logger";

/**
 * Message types for webview communication
 */
interface GetStateMessage {
  type: "getState";
  key: string;
  requestId?: string;
}

interface SetStateMessage {
  type: "setState";
  key: string;
  value: unknown;
}

interface SendMessageMessage {
  type: "sendMessage";
  content: string;
}

type WebviewMessage = GetStateMessage | SetStateMessage | SendMessageMessage;

interface WebviewResponseMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * WebviewManager - Manages the ForgeAI webview view lifecycle
 *
 * Responsibilities:
 * - Implement WebviewViewProvider for sidebar integration
 * - Generate HTML content with proper CSP
 * - Handle webview disposal
 * - Manage webview resources
 */
export class WebviewManager implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | null = null;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _storage: StorageManager,
    private readonly _logger: Logger
  ) {}

  /**
   * Register the webview view provider
   * This makes the webview appear automatically in the sidebar
   */
  public register(): void {
    const provider = vscode.window.registerWebviewViewProvider("forgeai.chatView", this, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    });

    this.disposables.push(provider);
    this._context.subscriptions.push(provider);
    this._logger.info("WebviewViewProvider registered for forgeai.chatView");
  }

  /**
   * Called by VS Code when the webview view is resolved
   * This is where we set up the webview content and message handlers
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    __context: vscode.WebviewViewResolveContext,
    __token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, "dist"),
        vscode.Uri.joinPath(this._context.extensionUri, "resources"),
      ],
    };

    // Set webview HTML content
    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

    // Register message handler
    this.disposables.push(
      webviewView.webview.onDidReceiveMessage(
        (message) => this.handleMessage(message),
        null,
        this.disposables
      )
    );

    // Register disposal handler
    this.disposables.push(
      webviewView.onDidDispose(() => this.onViewDisposed(), null, this.disposables)
    );

    this._logger.info("Webview view resolved and initialized successfully");
  }

  /**
   * Show the webview view (focus the sidebar)
   * This is called by the "forgeai.open" command
   */
  public createOrShow(): void {
    if (this.view) {
      this.view.show(true);
      this._logger.info("Focused existing ForgeAI view");
    } else {
      // View will be created automatically by VS Code when the sidebar is opened
      vscode.commands.executeCommand("forgeai.chatView.focus");
      this._logger.info("Requested focus on ForgeAI view");
    }
  }

  /**
   * Handle messages received from the webview
   * @param message The message object from the webview
   */
  private async handleMessage(message: WebviewMessage): Promise<void> {
    try {
      this._logger.info(`Received message from webview: ${message.type}`);

      switch (message.type) {
        case "getState":
          await this.handleGetState(message);
          break;

        case "setState":
          await this.handleSetState(message);
          break;

        case "sendMessage":
          await this.handleSendMessage(message);
          break;

        default: {
          // Exhaustive check - TypeScript will error if we miss a case
          const exhaustiveCheck: never = message;
          this._logger.warn(`Unknown message type: ${(exhaustiveCheck as WebviewMessage).type}`);
          break;
        }
      }
    } catch (error) {
      this._logger.error("Failed to handle message from webview", error);
      this.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Handle getState message - retrieve state from workspace storage
   * @param message The getState message
   */
  private async handleGetState(message: GetStateMessage): Promise<void> {
    const { key, requestId } = message;

    if (!key) {
      throw new WebviewError("getState message missing key");
    }

    const value = await this._storage.getWorkspaceState(key);

    this.postMessage({
      type: "stateResponse",
      requestId,
      key,
      value,
    });
  }

  /**
   * Handle setState message - update state in workspace storage
   * @param message The setState message
   */
  private async handleSetState(message: SetStateMessage): Promise<void> {
    const { key, value } = message;

    if (!key) {
      throw new WebviewError("setState message missing key");
    }

    await this._storage.setWorkspaceState(key, value);

    this.postMessage({
      type: "stateUpdated",
      key,
    });
  }

  /**
   * Handle sendMessage message - forward user message to agent loop
   * @param message The sendMessage message
   */
  private handleSendMessage(message: SendMessageMessage): void {
    const { content } = message;

    if (!content) {
      throw new WebviewError("sendMessage message missing content");
    }

    this._logger.info(`User message: ${content}`);

    // TODO: Forward to agent loop (will be implemented in Task 3)
    // For now, just acknowledge receipt
    this.postMessage({
      type: "messageReceived",
      content,
    });
  }

  /**
   * Post a message to the webview
   * @param message The message object to send
   */
  private postMessage(message: WebviewResponseMessage): void {
    if (!this.view) {
      this._logger.warn("Cannot post message: view is null");
      return;
    }

    this.view.webview.postMessage(message);
    this._logger.info(`Posted message to webview: ${message.type}`);
  }

  /**
   * Handle panel disposal
   */
  private onViewDisposed(): void {
    this._logger.info("Webview view disposed");
    this.view = null;
  }

  /**
   * Generate HTML content for the webview
   * @returns HTML string with proper CSP and script loading
   */
  private getWebviewContent(webview: vscode.Webview): string {
    // Get URI for webview script and CSS
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "dist", "webview.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "dist", "webview.css")
    );

    // Generate nonce for CSP
    const nonce = this.getNonce();

    // Generate HTML with proper CSP
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src ${webview.cspSource} 'nonce-${nonce}';
    style-src ${webview.cspSource} 'unsafe-inline';
    font-src ${webview.cspSource};
    img-src ${webview.cspSource} https: data:;
    connect-src http://localhost:11434;
  ">
  <title>ForgeAI</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"><div class="loading">Loading ForgeAI...</div></div>
  <script nonce="${nonce}">
    // Global error handler
    window.addEventListener('error', function(e) {
      console.error('Global error:', e.error);
      document.getElementById('root').innerHTML = '<div class="loading" style="color: var(--vscode-errorForeground, #f48771);">Error loading ForgeAI: ' + e.message + '</div>';
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', function(e) {
      console.error('Unhandled promise rejection:', e.reason);
    });
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generate a cryptographically secure nonce for CSP
   * @returns A random nonce string
   */
  private getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Dispose the webview manager and clean up resources
   */
  public dispose(): void {
    this._logger.info("Disposing WebviewManager");

    // Dispose all disposables
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;

    // Clear view reference
    this.view = null;
  }
}

/**
 * WebviewError - Custom error class for webview operations
 */
export class WebviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebviewError";
  }
}
