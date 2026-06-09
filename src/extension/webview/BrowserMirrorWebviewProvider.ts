import * as vscode from 'vscode';
import type { Logger } from '../utils/Logger';

interface BrowserMirrorState {
  url: string;
  viewport: { width: number; height: number };
  screenshot: string | null;
  consoleLogs: Array<{ type: string; text: string; timestamp: number }>;
  networkRequests: Array<{ url: string; method: string; status: number; timestamp: number }>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Browser Mirror Webview Provider
 *
 * Opens a VS Code webview panel (editor tab) that renders a live browser preview
 * powered by Playwright. Captures screenshots, console logs, and network requests.
 */
export class BrowserMirrorWebviewProvider implements vscode.Disposable {
  private panel?: vscode.WebviewPanel;
  private browser: any = null;
  private context: any = null;
  private page: any = null;
  private readonly disposables: vscode.Disposable[] = [];
  private screenshotIntervalId: NodeJS.Timeout | null = null;
  private readonly state: BrowserMirrorState;

  constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {
    this.state = {
      url: 'about:blank',
      viewport: { width: 1280, height: 720 },
      screenshot: null,
      consoleLogs: [],
      networkRequests: [],
      isLoading: false,
      error: null,
    };
  }

  public async open(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'forgeai.browserMirror',
      'Browser Mirror',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionContext.extensionUri, 'dist', 'webview'),
          vscode.Uri.joinPath(this.extensionContext.extensionUri, 'resources'),
        ],
      }
    );

    this.panel.webview.html = this.getHtml(this.panel.webview);

    this.disposables.push(
      this.panel.webview.onDidReceiveMessage(
        (message) => this.handleMessage(message),
        null,
        this.disposables
      )
    );

    this.disposables.push(
      this.panel.onDidDispose(() => this.dispose(), null, this.disposables)
    );

  }

  private async handleMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'bmNavigate': {
          await this.navigate(message.url);
          break;
        }
        case 'bmClick': {
          await this.click(message.x, message.y);
          break;
        }
        case 'bmType': {
          await this.type(message.text);
          break;
        }
        case 'bmScroll': {
          await this.scroll(message.deltaX, message.deltaY);
          break;
        }
        case 'bmViewport': {
          await this.setViewport(message.width, message.height);
          break;
        }
        case 'bmRefresh': {
          await this.refresh();
          break;
        }
        case 'bmClearLogs': {
          this.state.consoleLogs = [];
          this.state.networkRequests = [];
          this.postMessage({ type: 'bmLogsCleared' });
          break;
        }
        case 'bmDetectLocalhost': {
          const url = await this.detectLocalhostUrl();
          this.postMessage({ type: 'bmDetectedUrl', url });
          break;
        }
        default:
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[BrowserMirror] Message handling error:', error);
      this.postMessage({ type: 'bmError', error: errorMessage });
    }
  }

  private async navigate(url: string): Promise<void> {
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      url = 'https://' + url;
    }

    this.state.url = url;
    this.state.isLoading = true;
    this.state.error = null;
    this.postMessage({ type: 'bmState', state: { ...this.state, screenshot: null } });

    try {
      const page = await this.ensurePage();

      // Set up listeners before navigation
      page.on('console', (msg: any) => {
        this.state.consoleLogs.push({
          type: msg.type(),
          text: msg.text(),
          timestamp: Date.now(),
        });
        if (this.state.consoleLogs.length > 500) {
          this.state.consoleLogs = this.state.consoleLogs.slice(-500);
        }
        this.postMessage({ type: 'bmConsoleLog', log: this.state.consoleLogs[this.state.consoleLogs.length - 1] });
      });

      page.on('requestfinished', (request: any) => {
        const response = request.response();
        this.state.networkRequests.push({
          url: request.url(),
          method: request.method(),
          status: response?.status() || 0,
          timestamp: Date.now(),
        });
        if (this.state.networkRequests.length > 500) {
          this.state.networkRequests = this.state.networkRequests.slice(-500);
        }
        this.postMessage({
          type: 'bmNetworkRequest',
          request: this.state.networkRequests[this.state.networkRequests.length - 1],
        });
      });

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      this.state.isLoading = false;
      await this.takeScreenshot();
    } catch (error) {
      this.state.isLoading = false;
      this.state.error = error instanceof Error ? error.message : String(error);
      this.postMessage({ type: 'bmState', state: this.state });
    }
  }

  private async click(x: number, y: number): Promise<void> {
    if (!this.page) return;
    try {
      await this.page.mouse.click(x, y);
      await this.takeScreenshot();
    } catch (error) {
      this.logger.warn('[BrowserMirror] Click error:', error);
    }
  }

  private async type(text: string): Promise<void> {
    if (!this.page) return;
    try {
      await this.page.keyboard.type(text);
      await this.takeScreenshot();
    } catch (error) {
      this.logger.warn('[BrowserMirror] Type error:', error);
    }
  }

  private async scroll(deltaX: number, deltaY: number): Promise<void> {
    if (!this.page) return;
    try {
      await this.page.mouse.wheel({ deltaX, deltaY });
      await this.takeScreenshot();
    } catch (error) {
      this.logger.warn('[BrowserMirror] Scroll error:', error);
    }
  }

  private async refresh(): Promise<void> {
    if (!this.page) return;
    try {
      this.state.isLoading = true;
      this.postMessage({ type: 'bmState', state: { ...this.state, screenshot: null } });
      await this.page.reload({ waitUntil: 'networkidle', timeout: 30000 });
      this.state.isLoading = false;
      await this.takeScreenshot();
    } catch (error) {
      this.state.isLoading = false;
      this.state.error = error instanceof Error ? error.message : String(error);
      this.postMessage({ type: 'bmState', state: this.state });
    }
  }

  private async setViewport(width: number, height: number): Promise<void> {
    this.state.viewport = { width, height };
    if (this.page) {
      try {
        await this.page.setViewportSize({ width, height });
        await this.takeScreenshot();
      } catch (error) {
        this.logger.warn('[BrowserMirror] Viewport error:', error);
      }
    }
  }

  private async takeScreenshot(): Promise<void> {
    if (!this.page) return;
    try {
      const buffer = await this.page.screenshot({ type: 'jpeg', quality: 80, fullPage: false });
      this.state.screenshot = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      this.postMessage({ type: 'bmScreenshot', screenshot: this.state.screenshot });
    } catch (error) {
      this.logger.warn('[BrowserMirror] Screenshot error:', error);
    }
  }

  private async ensurePage(): Promise<any> {
    if (this.page) {
      return this.page;
    }

    const { chromium } = await import('playwright');

    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch (launchError: any) {
      if (
        launchError?.message?.includes("Executable doesn't exist") ||
        launchError?.message?.includes('npx playwright install')
      ) {
        throw new Error(
          'Browser automation unavailable — Playwright browsers are not installed. ' +
            'Run: npx playwright install chromium'
        );
      }
      throw launchError;
    }

    this.context = await this.browser.newContext({
      viewport: this.state.viewport,
      userAgent: 'ForgeAI/1.0 (BrowserMirror)',
    });

    this.page = await this.context.newPage();

    // Start periodic screenshot capture
    this.screenshotIntervalId = setInterval(() => {
      void this.takeScreenshot();
    }, 2000);

    return this.page;
  }

  private async detectLocalhostUrl(): Promise<string | null> {
    const ports = [3000, 5173, 8080, 4200, 8000, 5000, 9000];
    const { default: http } = await import('http');

    for (const port of ports) {
      try {
        const isReachable = await new Promise<boolean>((resolve) => {
          const req = http.get(`http://localhost:${port}`, { timeout: 1000 }, (res) => {
            resolve(res.statusCode !== undefined && res.statusCode < 500);
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
        });
        if (isReachable) {
          return `http://localhost:${port}`;
        }
      } catch {
        // Continue to next port
      }
    }
    return null;
  }

  private postMessage(message: any): void {
    this.panel?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionContext.extensionUri, 'dist', 'webview', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionContext.extensionUri, 'dist', 'webview', 'style.css')
    );
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};" />
  <title>Browser Mirror</title>
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.__FORGEAI_PANEL__ = 'browserMirror';
    const vscodeApi = acquireVsCodeApi();
    window.vscode = vscodeApi;
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
    if (this.screenshotIntervalId) {
      clearInterval(this.screenshotIntervalId);
      this.screenshotIntervalId = null;
    }

    if (this.page) {
      this.page.close().catch(() => undefined);
      this.page = null;
    }
    if (this.context) {
      this.context.close().catch(() => undefined);
      this.context = null;
    }
    if (this.browser) {
      this.browser.close().catch(() => undefined);
      this.browser = null;
    }

    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
    this.panel = undefined;

  }
}
