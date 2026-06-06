/**
 * BrowserMirrorStream
 * Streams live browser frames from Playwright to VS Code Webview panel
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { ForgeBrowserSession, BrowserFrameEvent } from '../services/ForgeBrowserSession';
import { VisualQAAgent, VisualDefect } from '../agents/visual-qa/VisualQAAgent';

interface MirrorState {
  url: string;
  viewport: { width: number; height: number };
  screenshot: string | null;
  consoleLogs: Array<{ type: string; text: string; timestamp: number }>;
  networkRequests: Array<{ url: string; method: string; status: number; timestamp: number }>;
  isLoading: boolean;
  error: string | null;
}

export class BrowserMirrorStream implements vscode.Disposable {
  private panel?: vscode.WebviewPanel;
  private session: ForgeBrowserSession;
  private readonly disposables: vscode.Disposable[] = [];
  private screenshotIntervalId: NodeJS.Timeout | null = null;
  private readonly state: MirrorState;
  private workspaceRoot: string;
  private pageErrors: Array<{ message: string; timestamp: number }> = [];
  private failedNetworkRequests: Array<{ url: string; status: number; timestamp: number }> = [];
  private devServerProcess: cp.ChildProcess | null = null;
  private readonly visualQAAgent: VisualQAAgent | null;
  private lastVisualDefects: VisualDefect[] = [];

  constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    workspaceRoot: string,
    existingSession?: ForgeBrowserSession,
    ollamaClient?: any,
    logger?: any
  ) {
    this.workspaceRoot = workspaceRoot;
    this.session = existingSession || new ForgeBrowserSession();
    this.visualQAAgent = ollamaClient && logger
      ? new VisualQAAgent(ollamaClient, logger, workspaceRoot)
      : null;
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

  public async open(url: string = 'about:blank'): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      await this.navigate(url);
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

    await this.initializeSession(url);
  }

  private async initializeSession(url: string): Promise<void> {
    await this.session.initialize(
      (frame: BrowserFrameEvent) => {
        this.postMessage({ type: 'RENDER_FRAME', data: frame.data });
      },
      url
    );
    
    // Start periodic screenshot capture for fallback
    this.screenshotIntervalId = setInterval(() => {
      void this.takePeriodicScreenshot();
    }, 2000);
  }

  private async ensureDevServerRunning(targetUrl: string): Promise<string> {
    const localhostUrl = await this.detectLocalhostUrl();
    if (localhostUrl) {
      return localhostUrl;
    }

    const projectRoot = this.workspaceRoot;
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!cp.spawnSync('cmd', ['/c', 'dir', packageJsonPath], { encoding: 'utf-8' }).stdout) {
      return targetUrl;
    }

    const scripts = ['dev', 'start', 'serve', 'preview'];
    const detectedScript = scripts.find((script) => {
      try {
        const content = cp.spawnSync('cmd', ['/c', 'type', 'package.json'], {
          cwd: projectRoot,
          encoding: 'utf-8',
        }).stdout || '';
        return content.includes(`"${script}"`);
      } catch {
        return false;
      }
    });

    if (!detectedScript) {
      return targetUrl;
    }

    this.postMessage({ type: 'bmState', state: { ...this.state, isLoading: true } });

    try {
      this.devServerProcess = cp.spawn('npm', ['run', detectedScript], {
        cwd: projectRoot,
        shell: true,
        detached: false,
      });

      this.devServerProcess.stdout?.on('data', () => {});
      this.devServerProcess.stderr?.on('data', () => {});

      const readyUrl = await new Promise<string | null>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(null);
        }, 10000);

        const interval = setInterval(async () => {
          const detected = await this.detectLocalhostUrl();
          if (detected) {
            clearTimeout(timeout);
            clearInterval(interval);
            resolve(detected);
          }
        }, 500);
      });

      if (readyUrl) {
        return readyUrl;
      }
    } catch (error) {
      console.warn('[BrowserMirrorStream] Dev server launch failed:', error);
    }

    return targetUrl;
  }

  private async takePeriodicScreenshot(): Promise<void> {
    if (!this.panel || !this.session.getPage()) return;
    
    try {
      const buffer = await this.session.takeScreenshot();
      const base64 = buffer.toString('base64');
      this.state.screenshot = `data:image/jpeg;base64,${base64}`;
      this.postMessage({ type: 'bmScreenshot', screenshot: this.state.screenshot });
    } catch {
      // Screenshot failed
    }
  }

  private async handleMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'bmNavigate':
          await this.navigate(message.url);
          break;
        case 'bmClick':
          await this.click(message.x, message.y);
          break;
        case 'bmType':
          await this.type(message.text);
          break;
        case 'bmScroll':
          await this.scroll(message.deltaX, message.deltaY);
          break;
        case 'bmViewport':
          await this.setViewport(message.width, message.height);
          break;
        case 'bmRefresh':
          await this.refresh();
          break;
        case 'bmClearLogs':
          this.state.consoleLogs = [];
          this.state.networkRequests = [];
          this.postMessage({ type: 'bmLogsCleared' });
          break;
        case 'bmDetectLocalhost':
          const localhostUrl = await this.detectLocalhostUrl();
          this.postMessage({ type: 'bmDetectedUrl', url: localhostUrl });
          break;
        case 'HUMAN_INTERCEPT_CLICK':
          await this.handleHumanClick(message.x, message.y);
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.postMessage({ 
        type: 'bmError', 
        error: errorMessage,
        timestamp: Date.now()
      });
    }
  }

  private async navigate(url: string): Promise<void> {
    if (!this.session.getPage()) return;

    this.state.url = url;
    this.state.isLoading = true;
    this.state.error = null;
    this.postMessage({ type: 'bmState', state: { ...this.state, screenshot: null } });

    try {
      const page = this.session.getPage()!;
      
      // Set up listeners
      page.on('console', (msg: any) => {
        const text = msg.text();
        const type = msg.type();
        this.state.consoleLogs.push({
          type,
          text,
          timestamp: Date.now(),
        });
        if (this.state.consoleLogs.length > 500) {
          this.state.consoleLogs = this.state.consoleLogs.slice(-500);
        }
        if (type === 'error') {
          this.pageErrors.push({ message: text, timestamp: Date.now() });
        }
      });

      page.on('requestfinished', (request: any) => {
        const response = request.response();
        const status = response?.status() || 0;
        this.state.networkRequests.push({
          url: request.url(),
          method: request.method(),
          status,
          timestamp: Date.now(),
        });
        if (this.state.networkRequests.length > 500) {
          this.state.networkRequests = this.state.networkRequests.slice(-500);
        }
        if (status >= 500) {
          this.failedNetworkRequests.push({ url: request.url(), status, timestamp: Date.now() });
        }
      });

      const resolvedUrl = url === 'about:blank' ? url : await this.ensureDevServerRunning(url);
      await page.goto(resolvedUrl, { waitUntil: 'networkidle', timeout: 30000 });
      this.state.isLoading = false;
    } catch (error) {
      this.state.isLoading = false;
      this.state.error = error instanceof Error ? error.message : String(error);
      this.postMessage({ type: 'bmState', state: this.state });
    }
  }

  private async click(x: number, y: number): Promise<void> {
    if (!this.session.getPage()) return;
    try {
      await this.session.getPage()!.mouse.click(x, y);
    } catch (error) {
      console.warn('[BrowserMirrorStream] Click error:', error);
    }
  }

  private async handleHumanClick(x: number, y: number): Promise<void> {
    // Forward human click to browser
    await this.click(x, y);
  }

  private async type(text: string): Promise<void> {
    if (!this.session.getPage()) return;
    try {
      await this.session.getPage()!.keyboard.type(text);
    } catch (error) {
      console.warn('[BrowserMirrorStream] Type error:', error);
    }
  }

  private async scroll(deltaX: number, deltaY: number): Promise<void> {
    if (!this.session.getPage()) return;
    try {
      await this.session.getPage()!.mouse.wheel(deltaX, deltaY);
    } catch (error) {
      console.warn('[BrowserMirrorStream] Scroll error:', error);
    }
  }

  private async setViewport(width: number, height: number): Promise<void> {
    this.state.viewport = { width, height };
    if (this.session.getPage()) {
      try {
        await this.session.getPage()!.setViewportSize({ width, height });
      } catch (error) {
        console.warn('[BrowserMirrorStream] Viewport error:', error);
      }
    }
  }

  private async refresh(): Promise<void> {
    if (!this.session.getPage()) return;
    try {
      this.state.isLoading = true;
      this.postMessage({ type: 'bmState', state: { ...this.state, screenshot: null } });
      await this.session.getPage()!.reload({ waitUntil: 'networkidle', timeout: 30000 });
      this.state.isLoading = false;
    } catch (error) {
      this.state.isLoading = false;
      this.state.error = error instanceof Error ? error.message : String(error);
      this.postMessage({ type: 'bmState', state: this.state });
    }
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
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};" />
  <title>Browser Mirror</title>
  <style>
    :root { --bg: var(--vscode-editor-background); --fg: var(--vscode-editor-foreground); --accent: var(--vscode-button-background); }
    * { box-sizing: border-box; }
    body { 
      font-family: var(--vscode-font-family); 
      background: var(--bg); 
      color: var(--fg); 
      padding: 0; 
      margin: 0; 
      display: flex; 
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    #toolbar {
      height: 32px;
      background: var(--vscode-panel-background);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }
    #toolbar input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 12px;
    }
    #toolbar button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    }
    #toolbar button:hover { opacity: 0.9; }
    #mirror-container {
      flex: 1;
      position: relative;
      overflow: hidden;
      cursor: crosshair;
    }
    #mirror-canvas {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    #loading-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
    }
    .error-banner {
      padding: 8px 12px;
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
      font-size: 12px;
      display: none;
    }
  </style>
</head>
<body>
  <div class="error-banner" id="error-banner"></div>
  <div id="toolbar">
    <input type="text" id="url-input" placeholder="Enter URL..." />
    <button onclick="goToUrl()">Go</button>
    <button onclick="refreshPage()">Refresh</button>
    <button onclick="detectLocalhost()">Detect Localhost</button>
  </div>
  <div id="mirror-container">
    <img id="mirror-canvas" />
    <div id="loading-overlay" style="display: none;">Loading...</div>
  </div>
  
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const canvas = document.getElementById('mirror-canvas');
    const urlInput = document.getElementById('url-input');
    const loadingOverlay = document.getElementById('loading-overlay');
    const errorBanner = document.getElementById('error-banner');

    window.addEventListener('message', (event) => {
      const message = event.data;
      
      if (message.type === 'RENDER_FRAME' || message.type === 'bmScreenshot') {
        canvas.src = 'data:image/jpeg;base64,' + message.data;
        loadingOverlay.style.display = 'none';
      }
      
      if (message.type === 'bmState') {
        if (message.state.isLoading) {
          loadingOverlay.style.display = 'flex';
        }
      }
      
      if (message.type === 'bmDetectedUrl' && message.url) {
        urlInput.value = message.url;
        goToUrl();
      }
    });

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = 1280 / rect.width;
      const scaleY = 720 / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      vscode.postMessage({ type: 'HUMAN_INTERCEPT_CLICK', x, y });
    });

    function goToUrl() {
      const url = urlInput.value.trim();
      if (url) {
        let fullUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          fullUrl = 'https://' + url;
        }
        vscode.postMessage({ type: 'bmNavigate', url: fullUrl });
      }
    }

    function refreshPage() {
      vscode.postMessage({ type: 'bmRefresh' });
    }

    function detectLocalhost() {
      vscode.postMessage({ type: 'bmDetectLocalhost' });
    }

    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') goToUrl();
    });
  </script>
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

    if (this.devServerProcess) {
      try {
        this.devServerProcess.kill();
      } catch {
        // ignore cleanup errors
      }
      this.devServerProcess = null;
    }

    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
    this.panel = undefined;
  }

  public getValidationErrors(): string[] {
    const errors: string[] = [];
    for (const entry of this.pageErrors) {
      errors.push(`Console error: ${entry.message}`);
    }
    for (const entry of this.failedNetworkRequests) {
      errors.push(`Network error: ${entry.url} returned ${entry.status}`);
    }
    if (this.state.error) {
      errors.push(`Navigation error: ${this.state.error}`);
    }
    return errors;
  }

  public async runVisualQA(designMockup?: Buffer): Promise<VisualDefect[]> {
    if (!this.visualQAAgent) {
      return [];
    }

    try {
      const screenshot = await this.session.takeScreenshot();
      if (!screenshot) {
        return [];
      }
      const result = await this.visualQAAgent.analyzeScreenshot(screenshot, designMockup);
      this.lastVisualDefects = result.defects;
      return result.defects;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[BrowserMirrorStream] VisualQA failed: ${msg}`);
      return [];
    }
  }

  public getLastVisualDefects(): VisualDefect[] {
    return this.lastVisualDefects;
  }
}