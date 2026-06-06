/**
 * MobileMirror
 *
 * Mobile emulator integration for iOS/Android testing in VS Code.
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7
 */

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { VisualQAAgent } from '../agents/visual-qa/VisualQAAgent';

export type ProjectType =
  | 'react-native'
  | 'expo'
  | 'flutter'
  | 'native-ios'
  | 'native-android'
  | 'unknown';

export interface DevicePreset {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  userAgent: string;
  platform: 'ios' | 'android';
}

export interface DeviceLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  tag: string;
  message: string;
}

export interface MobileMirrorState {
  projectType: ProjectType;
  activeDevice: string | null;
  isRunning: boolean;
  devServerUrl: string | null;
  logs: DeviceLogEntry[];
}

export class MobileMirror {
  private readonly presets: Record<string, DevicePreset> = {
    'iPhone 15': {
      name: 'iPhone 15',
      width: 393,
      height: 852,
      deviceScaleFactor: 3,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      platform: 'ios',
    },
    'iPhone SE': {
      name: 'iPhone SE',
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      platform: 'ios',
    },
    'Pixel 8': {
      name: 'Pixel 8',
      width: 412,
      height: 915,
      deviceScaleFactor: 2.625,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
      platform: 'android',
    },
    'Pixel 7': {
      name: 'Pixel 7',
      width: 412,
      height: 915,
      deviceScaleFactor: 2.625,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7)',
      platform: 'android',
    },
    'iPad Pro': {
      name: 'iPad Pro',
      width: 1024,
      height: 1366,
      deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
      platform: 'ios',
    },
    'Galaxy Tab': {
      name: 'Galaxy Tab',
      width: 800,
      height: 1280,
      deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-T970)',
      platform: 'android',
    },
  };

  private readonly state: MobileMirrorState = {
    projectType: 'unknown',
    activeDevice: null,
    isRunning: false,
    devServerUrl: null,
    logs: [],
  };

  private devServerProcess: cp.ChildProcess | null = null;
  private logWatcher: NodeJS.Timeout | null = null;
  private visualQAAgent: VisualQAAgent | null = null;
  private panel: vscode.WebviewPanel | undefined;
  private outputChannel: vscode.OutputChannel;
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly logger: Logger,
    private readonly workspaceRoot: string,
    ollamaClient?: any
  ) {
    this.visualQAAgent = ollamaClient
      ? new VisualQAAgent(ollamaClient, logger, workspaceRoot)
      : null;
    this.outputChannel = vscode.window.createOutputChannel('Mobile Mirror');
  }

  public detectProjectType(): ProjectType {
    const root = this.workspaceRoot;
    const files = fs.readdirSync(root);

    if (files.includes('pubspec.yaml')) return 'flutter';
    if (files.includes('package.json')) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['expo']) return 'expo';
        if (deps['react-native']) return 'react-native';
      } catch {
        // ignore
      }
    }
    if (files.includes('Podfile') || files.includes('*.xcodeproj')) return 'native-ios';
    if (files.includes('build.gradle') || files.includes('settings.gradle'))
      return 'native-android';

    return 'unknown';
  }

  public getPresets(): Record<string, DevicePreset> {
    return { ...this.presets };
  }

  public getPreset(name: string): DevicePreset | null {
    return this.presets[name] || null;
  }

  public getState(): MobileMirrorState {
    return { ...this.state };
  }

  public async launchEmulator(deviceName: string): Promise<string> {
    const preset = this.presets[deviceName];
    if (!preset) throw new Error(`Unknown device: ${deviceName}`);

    const projectType = this.detectProjectType();
    this.state.projectType = projectType;
    this.state.activeDevice = deviceName;

    if (projectType === 'expo' || projectType === 'react-native') {
      return await this.launchReactNative(deviceName, preset);
    } else if (projectType === 'flutter') {
      return await this.launchFlutter(deviceName, preset);
    } else if (projectType === 'native-ios') {
      return await this.launchNativeIOS(deviceName, preset);
    } else if (projectType === 'native-android') {
      return await this.launchNativeAndroid(deviceName, preset);
    } else {
      throw new Error(`Unsupported project type for mobile mirror: ${projectType}`);
    }
  }

  private async finalizeLaunch(): Promise<void> {
    await this.openPanel();
    this.outputChannel.show(true);
    await this.startFileWatcher();
  }

  private async launchReactNative(deviceName: string, preset: DevicePreset): Promise<string> {
    const isExpo = this.state.projectType === 'expo';
    const port = 8081;

    // Launch Metro bundler
    const startCmd = isExpo ? 'npx expo start --no-dev --minify' : 'npx react-native start';
    this.devServerProcess = cp.spawn(startCmd, {
      cwd: this.workspaceRoot,
      shell: true,
      detached: false,
    });

    this.devServerProcess.stdout?.on('data', (data) => this.captureLog('Metro', data.toString()));
    this.devServerProcess.stderr?.on('data', (data) => this.captureLog('Metro', data.toString()));

    // Wait for Metro to be ready
    const url = await this.waitForDevServer(port);
    this.state.devServerUrl = url;
    this.state.isRunning = true;
    await this.finalizeLaunch();

    // Open in browser with mobile user agent / viewport
    const mobileUrl = `${url}`;
    this.logger.info(`Mobile Mirror: React Native dev server at ${mobileUrl} on ${deviceName}`);
    return mobileUrl;
  }

  private async launchFlutter(deviceName: string, preset: DevicePreset): Promise<string> {
    // List available emulators
    let emulatorId: string | undefined;
    try {
      const output = cp.execSync('flutter emulators', {
        encoding: 'utf-8',
        cwd: this.workspaceRoot,
      });
      const match = output.match(/(\S+)\s+\(\S+\)\s+•/);
      if (match) emulatorId = match[1];
    } catch {
      // ignore
    }

    if (!emulatorId) {
      throw new Error('No Flutter emulator found. Create one with `flutter emulators --create`.');
    }

    // Launch emulator
    cp.execSync(`flutter emulators --launch ${emulatorId}`, {
      cwd: this.workspaceRoot,
      encoding: 'utf-8',
      timeout: 60000,
    });

    // Run Flutter app
    this.devServerProcess = cp.spawn('flutter run', {
      cwd: this.workspaceRoot,
      shell: true,
      detached: false,
    });

    this.devServerProcess.stdout?.on('data', (data) => this.captureLog('Flutter', data.toString()));
    this.devServerProcess.stderr?.on('data', (data) => this.captureLog('Flutter', data.toString()));

    // Flutter web fallback: flutter run -d chrome --web-port=8080
    const url = await this.waitForDevServer(8080);
    this.state.devServerUrl = url;
    this.state.isRunning = true;
    await this.finalizeLaunch();
    this.logger.info(`Mobile Mirror: Flutter app launched on ${deviceName}`);
    return url;
  }

  private async launchNativeIOS(deviceName: string, preset: DevicePreset): Promise<string> {
    // For native iOS, we can't fully automate in CI without a Mac.
    // We provide the build/run command and optionally open the simulator.
    try {
      cp.execSync('open -a Simulator', { cwd: this.workspaceRoot, timeout: 10000 });
    } catch {
      // ignore if not on macOS
    }
    this.state.isRunning = true;
    await this.finalizeLaunch();
    this.logger.info(
      `Mobile Mirror: Native iOS project detected. Open the project in Xcode to run on ${deviceName}.`
    );
    return `ios-simulator://${deviceName}`;
  }

  private async launchNativeAndroid(deviceName: string, preset: DevicePreset): Promise<string> {
    try {
      const output = cp.execSync('adb devices', { encoding: 'utf-8', cwd: this.workspaceRoot });
      const devices = output.split('\n').filter((line) => line.includes('\tdevice'));
      if (devices.length === 0) {
        throw new Error(
          'No Android device/emulator connected. Start an emulator or connect a device.'
        );
      }
    } catch {
      // ignore
    }
    this.state.isRunning = true;
    await this.finalizeLaunch();
    this.logger.info('Mobile Mirror: Native Android project detected. Use adb install to deploy.');
    return `android-emulator://${deviceName}`;
  }

  public async simulateRotation(orientation: 'portrait' | 'landscape'): Promise<void> {
    const preset = this.presets[this.state.activeDevice || ''];
    if (!preset) return;

    // For web-based mobile (Expo/Flutter web), we adjust the viewport
    // For native, we send adb/xcrun commands where possible
    if (this.state.projectType === 'expo' || this.state.projectType === 'flutter') {
      this.logger.info(
        `Mobile Mirror: Simulating rotation to ${orientation} on ${this.state.activeDevice}`
      );
    } else if (this.state.projectType === 'native-android') {
      const rotation = orientation === 'landscape' ? '1' : '0';
      try {
        cp.execSync(`adb shell settings put system accelerometer_rotation 0`, {
          cwd: this.workspaceRoot,
        });
        cp.execSync(`adb shell settings put system user_rotation ${rotation}`, {
          cwd: this.workspaceRoot,
        });
      } catch {
        // ignore
      }
    }
  }

  public async simulateNetworkCondition(
    condition: 'online' | 'offline' | 'slow' | 'lossy'
  ): Promise<void> {
    this.logger.info(`Mobile Mirror: Simulating network condition: ${condition}`);
    // For web-based mobile, this would be implemented via Playwright route interception
    // For native, we use adb shell commands
    if (this.state.projectType === 'native-android') {
      try {
        switch (condition) {
          case 'offline':
            cp.execSync('adb shell svc wifi disable', { cwd: this.workspaceRoot });
            cp.execSync('adb shell svc data disable', { cwd: this.workspaceRoot });
            break;
          case 'online':
            cp.execSync('adb shell svc wifi enable', { cwd: this.workspaceRoot });
            cp.execSync('adb shell svc data enable', { cwd: this.workspaceRoot });
            break;
          default:
            // slow/lossy require more complex setup (tc on Linux, Network Link Conditioner on macOS)
            break;
        }
      } catch {
        // ignore
      }
    }
  }

  public async simulateGpsLocation(latitude: number, longitude: number): Promise<void> {
    this.logger.info(`Mobile Mirror: Simulating GPS location: ${latitude}, ${longitude}`);
    if (this.state.projectType === 'native-android') {
      try {
        cp.execSync(`adb emu geo fix ${longitude} ${latitude}`, {
          cwd: this.workspaceRoot,
          timeout: 5000,
        });
      } catch {
        // ignore
      }
    } else if (this.state.projectType === 'native-ios') {
      try {
        cp.execSync(
          `xcrun simctl location ${this.getSimulatorId() || 'booted'} set ${latitude},${longitude}`,
          { cwd: this.workspaceRoot, timeout: 5000 }
        );
      } catch {
        // ignore
      }
    }
  }

  public getLogs(): DeviceLogEntry[] {
    return [...this.state.logs];
  }

  public async runVisualQA(): Promise<import('../agents/visual-qa/VisualQAAgent').VisualDefect[]> {
    if (!this.visualQAAgent || !this.state.devServerUrl) return [];
    try {
      const screenshot = await this.captureScreenshot();
      if (!screenshot) return [];
      const result = await this.visualQAAgent.analyzeScreenshot(screenshot);
      return result.defects;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`MobileMirror VisualQA failed: ${msg}`);
      return [];
    }
  }

  public async captureScreenshot(): Promise<Buffer | null> {
    // For web-based mobile apps, we can use Playwright via BrowserMirrorStream
    // For native, we use adb exec-out screencap or xcrun simctl io
    try {
      if (this.state.projectType === 'native-android') {
        const result = cp.execSync('adb exec-out screencap -p', {
          cwd: this.workspaceRoot,
          encoding: 'buffer',
          timeout: 10000,
        });
        return Buffer.from(result);
      } else if (this.state.projectType === 'native-ios') {
        const simId = this.getSimulatorId();
        if (simId) {
          const result = cp.execSync(`xcrun simctl io ${simId} screenshot /dev/stdout`, {
            cwd: this.workspaceRoot,
            encoding: 'buffer',
            timeout: 10000,
          });
          return Buffer.from(result);
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  private async openPanel(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'forgeai.mobileMirror',
      'Mobile Mirror',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = this.getMobilePanelHtml();
    this.disposables.push(
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
      })
    );
  }

  private getMobilePanelHtml(): string {
    const device = this.presets[this.state.activeDevice || ''];
    const width = device?.width || 375;
    const height = device?.height || 667;
    const url = this.state.devServerUrl || 'about:blank';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    body { margin: 0; background: #1e1e1e; font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .toolbar { padding: 8px 12px; background: var(--vscode-editor-inactiveSelectionBackground); border-bottom: 1px solid var(--vscode-panel-border); display: flex; gap: 8px; align-items: center; }
    .device-frame { flex: 1; display: flex; align-items: center; justify-content: center; background: #0f0f0f; overflow: auto; padding: 16px; }
    iframe { width: ${width}px; height: ${height}px; border: 1px solid var(--vscode-panel-border); background: #fff; border-radius: 8px; }
    .status { font-size: 12px; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>Mobile Mirror</strong>
    <span class="status">${this.state.projectType} • ${this.state.activeDevice || 'No device'} • ${url}</span>
  </div>
  <div class="device-frame">
    <iframe src="${url}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message && message.type === 'refresh') {
        document.querySelector('iframe').src = message.url;
      }
    });
  </script>
</body>
</html>`;
  }

  private async startFileWatcher(): Promise<void> {
    if (this.fileWatcher) return;

    const watchGlobs = [
      '**/*.{js,jsx,ts,tsx}',
      '**/*.dart',
      '**/*.{swift,m,mm}',
      '**/*.kt',
      '**/*.java',
    ];

    for (const glob of watchGlobs) {
      this.fileWatcher = vscode.workspace.createFileSystemWatcher(glob);
      this.disposables.push(this.fileWatcher);
      this.fileWatcher.onDidChange(() => this.triggerHotReload());
      this.fileWatcher.onDidCreate(() => this.triggerHotReload());
      this.fileWatcher.onDidDelete(() => this.triggerHotReload());
    }
  }

  private async triggerHotReload(): Promise<void> {
    if (!this.state.isRunning) return;

    const start = Date.now();
    try {
      if (this.state.projectType === 'expo' || this.state.projectType === 'react-native') {
        // Trigger Metro bundler reload via RPC or by reloading the webview
        this.panel?.webview.postMessage({
          type: 'refresh',
          url: this.state.devServerUrl || 'about:blank',
        });
      } else if (this.state.projectType === 'flutter') {
        // Flutter hot reload is handled by `flutter run` automatically
        this.logger.info('Mobile Mirror: Flutter hot reload triggered by file change');
      }
    } catch {
      // ignore reload failures
    }

    const elapsed = Date.now() - start;
    if (elapsed > 2000) {
      this.logger.warn(`Mobile Mirror: Hot reload took ${elapsed}ms (target: <2000ms)`);
    }
  }

  public async stop(): Promise<void> {
    this.state.isRunning = false;
    this.state.devServerUrl = null;
    this.state.activeDevice = null;

    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
    }

    if (this.logWatcher) {
      clearInterval(this.logWatcher);
      this.logWatcher = null;
    }

    if (this.devServerProcess) {
      try {
        this.devServerProcess.kill('SIGTERM');
      } catch {
        // ignore
      }
      this.devServerProcess = null;
    }

    this.state.logs = [];
    this.outputChannel.hide();
    this.logger.info('Mobile Mirror stopped');
  }

  private async waitForDevServer(port: number, timeoutMs = 30000): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const response = await fetch(`http://localhost:${port}`);
        if (response.ok) return `http://localhost:${port}`;
      } catch {
        // not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Dev server did not start on port ${port} within ${timeoutMs}ms`);
  }

  private captureLog(tag: string, raw: string): void {
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    for (const line of lines) {
      const level =
        line.toLowerCase().includes('error') || line.toLowerCase().includes('fatal')
          ? 'error'
          : line.toLowerCase().includes('warn')
            ? 'warn'
            : line.toLowerCase().includes('debug')
              ? 'debug'
              : 'info';

      this.state.logs.push({
        timestamp: Date.now(),
        level,
        tag,
        message: line.trim(),
      });

      this.outputChannel.appendLine(`[${level.toUpperCase()}] [${tag}] ${line.trim()}`);

      if (this.state.logs.length > 1000) {
        this.state.logs = this.state.logs.slice(-1000);
      }
    }
  }

  private getSimulatorId(): string | null {
    try {
      const output = cp.execSync('xcrun simctl list devices booted', {
        encoding: 'utf-8',
        cwd: this.workspaceRoot,
      });
      const match = output.match(/\(([A-F0-9-]+)\)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
