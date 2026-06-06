/**
 * MonitoringMode
 *
 * Watches source files for changes and auto-runs affected tests.
 * Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { HealthScanner } from './HealthScanner';
import { BugFixOrchestrator } from './BugFixOrchestrator';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface CodeQualityMetrics {
  testCoverage?: number;
  lintViolations: number;
  cyclomaticComplexity: number;
  timestamp: number;
}

export class MonitoringMode {
  private readonly logger: Logger;
  private readonly healthScanner: HealthScanner;
  private readonly bugFixOrchestrator: BugFixOrchestrator;
  private readonly workspaceRoot: string;
  private readonly watcher: vscode.FileSystemWatcher;
  private readonly metricsHistory: CodeQualityMetrics[] = [];
  private lastTestResults: { passed: boolean; output: string } | null = null;
  private isRunning = false;
  private disposeWatcher?: () => void;

  constructor(workspaceRoot: string, logger: Logger) {
    this.workspaceRoot = workspaceRoot;
    this.logger = logger;
    this.healthScanner = new HealthScanner(workspaceRoot);
    this.bugFixOrchestrator = new BugFixOrchestrator();
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx,py,go,rs}');
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.info('Monitoring mode started');

    const changeDisposable = this.watcher.onDidChange((uri) => this.handleFileChange(uri));
    const createDisposable = this.watcher.onDidCreate((uri) => this.handleFileChange(uri));
    const deleteDisposable = this.watcher.onDidDelete((uri) => this.handleFileChange(uri));

    this.disposeWatcher = () => {
      changeDisposable.dispose();
      createDisposable.dispose();
      deleteDisposable.dispose();
    };

    this.scheduleHealthScan();
  }

  public stop(): void {
    this.isRunning = false;
    this.disposeWatcher?.();
    this.logger.info('Monitoring mode stopped');
  }

  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    if (!this.isRunning) return;
    const relative = path.relative(this.workspaceRoot, uri.fsPath);
    this.logger.info(`File changed: ${relative}`);

    try {
      const result = this.runAffectedTests(uri.fsPath);
      this.lastTestResults = result;

      if (!result.passed) {
        const msg = `Regression detected in ${relative}`;
        this.logger.warn(msg);
        void vscode.window.showWarningMessage(`ForgeAI Monitoring: ${msg}`);

        const fixResult = await this.bugFixOrchestrator.fixRegression(relative, result.output);
        if (!fixResult.success) {
          void vscode.window.showErrorMessage(`ForgeAI: Auto-fix failed for ${relative}. Manual review needed.`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Monitoring error for ${relative}: ${msg}`);
    }
  }

  private runAffectedTests(changedFilePath: string): { passed: boolean; output: string } {
    const ext = path.extname(changedFilePath);
    let testCmd = '';

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      const testFile = changedFilePath.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
      if (fs.existsSync(testFile)) {
        testCmd = `npx jest --passWithNoTests ${testFile}`;
      } else {
        testCmd = 'npx jest --passWithNoTests --silent';
      }
    } else if (ext === '.py') {
      testCmd = 'python -m pytest';
    } else if (ext === '.go') {
      testCmd = 'go test ./...';
    } else if (ext === '.rs') {
      testCmd = 'cargo test';
    }

    if (!testCmd) return { passed: true, output: 'No tests' };

    try {
      const output = cp.execSync(testCmd, {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 120000,
      });
      return { passed: true, output };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { passed: false, output: msg };
    }
  }

  private scheduleHealthScan(): void {
    setInterval(async () => {
      if (!this.isRunning) return;
      try {
        const report = await this.healthScanner.runAll();
        this.logger.info(`Health scan: ${report.summary}`);
        if (!report.overallHealthy) {
          void vscode.window.showWarningMessage(`ForgeAI Health Scan: ${report.summary}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Health scan failed: ${msg}`);
      }
    }, 24 * 60 * 60 * 1000);
  }

  public getMetrics(): CodeQualityMetrics[] {
    return [...this.metricsHistory];
  }
}
