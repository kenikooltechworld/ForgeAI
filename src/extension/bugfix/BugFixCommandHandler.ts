/**
 * BugFixCommandHandler
 *
 * Handles the "forgeai.fixBug" command that developers invoke when they encounter a bug.
 * Collects bug information and runs the CodeBugFixOrchestrator.
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { CodeBugFixOrchestrator, BugReport } from './CodeBugFixOrchestrator';

export class BugFixCommandHandler {
  private readonly orchestrator: CodeBugFixOrchestrator;

  constructor(private readonly logger: Logger) {
    this.orchestrator = new CodeBugFixOrchestrator();
  }

  /**
   * Handle the "forgeai.fixBug" command
   * Collects bug information from the user and runs the fix pipeline
   */
  public async handleFixBugCommand(agentLoop: {
    execute: (...args: unknown[]) => Promise<void>;
  }): Promise<void> {
    this.logger.info('Bug fix command invoked');

    // Get error message from user
    const errorMessage = await vscode.window.showInputBox({
      prompt: 'Enter the error message or bug description',
      placeHolder: 'e.g., "TypeError: Cannot read property of undefined"',
    });

    if (!errorMessage) {
      return;
    }

    // Get error type
    const errorType = await vscode.window.showQuickPick(
      ['compilation', 'runtime', 'test', 'lint', 'other'],
      {
        placeHolder: 'Select error type',
      }
    );

    if (!errorType) {
      return;
    }

    // Get file path (optional)
    const filePath = await vscode.window.showInputBox({
      prompt: 'Enter the file path (optional)',
      placeHolder: 'e.g., src/components/Button.tsx',
    });

    // Get line number (optional)
    let lineNumber: number | undefined;
    const lineStr = await vscode.window.showInputBox({
      prompt: 'Enter the line number (optional)',
      placeHolder: 'e.g., 42',
    });
    if (lineStr) {
      lineNumber = parseInt(lineStr, 10);
    }

    // Get stack trace (optional)
    const stackTrace = await vscode.window.showInputBox({
      prompt: 'Enter stack trace (optional)',
      placeHolder: 'Paste the full stack trace here',
    });

    // Get additional context (optional)
    const context = await vscode.window.showInputBox({
      prompt: 'Enter additional context (optional)',
      placeHolder: 'e.g., "This happens when user clicks the button"',
    });

    const bugReport: BugReport = {
      errorMessage,
      errorType: errorType as 'compilation' | 'runtime' | 'test' | 'lint' | 'other',
      filePath: filePath || undefined,
      lineNumber,
      stackTrace: stackTrace || undefined,
      context: context || undefined,
    };

    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'ForgeAI: Fixing bug...',
        cancellable: false,
      },
      async (progress) => {
        try {
          progress.report({ message: 'Analyzing bug...' });
          const result = await this.orchestrator.fixBug(bugReport, agentLoop);

          if (result.finalStatus === 'success') {
            this.logger.info(`Bug fix successful: ${result.bugId}`);
            void vscode.window.showInformationMessage(
              `✅ Bug fixed successfully! (${result.totalDurationMs}ms)`,
              'View Details'
            );
          } else {
            this.logger.error(`Bug fix failed: ${result.bugId}`);
            const failedAgent = result.results.find((r) => !r.success);
            const errorMsg = failedAgent
              ? `${failedAgent.agentName} agent failed: ${failedAgent.summary}`
              : 'Bug fix failed';
            void vscode.window.showErrorMessage(`❌ ${errorMsg}`);
          }

          // Log all agent results
          for (const agentResult of result.results) {
            this.logger.info(
              `${agentResult.agentName}: ${agentResult.success ? 'SUCCESS' : 'FAILED'} - ${agentResult.summary}`
            );
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.logger.error('Bug fix command failed', err);
          void vscode.window.showErrorMessage(`Bug fix failed: ${errorMsg}`);
        }
      }
    );
  }

  /**
   * Handle fixing a bug from an error in the editor
   * Called when user clicks "Fix with ForgeAI" on a diagnostic
   */
  public async handleFixDiagnostic(
    diagnostic: vscode.Diagnostic,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<void> {
    const bugReport: BugReport = {
      errorMessage: diagnostic.message,
      errorType: this.classifyDiagnostic(diagnostic),
      context: `Diagnostic at line ${diagnostic.range.start.line + 1}`,
    };

    this.logger.info(`Fixing diagnostic: ${bugReport.errorMessage}`);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'ForgeAI: Fixing diagnostic...',
        cancellable: false,
      },
      async (progress) => {
        try {
          progress.report({ message: 'Analyzing error...' });
          const result = await this.orchestrator.fixBug(bugReport, agentLoop);

          if (result.finalStatus === 'success') {
            this.logger.info(`Diagnostic fixed: ${result.bugId}`);
            void vscode.window.showInformationMessage(
              `✅ Diagnostic fixed! (${result.totalDurationMs}ms)`
            );
          } else {
            const failedAgent = result.results.find((r) => !r.success);
            const errorMsg = failedAgent ? `${failedAgent.agentName} agent failed` : 'Fix failed';
            void vscode.window.showErrorMessage(`❌ ${errorMsg}`);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.logger.error('Diagnostic fix failed', err);
          void vscode.window.showErrorMessage(`Fix failed: ${errorMsg}`);
        }
      }
    );
  }

  /**
   * Classify a diagnostic to determine error type
   */
  private classifyDiagnostic(
    diagnostic: vscode.Diagnostic
  ): 'compilation' | 'runtime' | 'test' | 'lint' | 'other' {
    const message = diagnostic.message.toLowerCase();
    const source = (diagnostic.source || '').toLowerCase();

    if (source.includes('eslint') || source.includes('lint')) {
      return 'lint';
    }
    if (message.includes('error ts') || message.includes('type error')) {
      return 'compilation';
    }
    if (message.includes('test') || message.includes('expect')) {
      return 'test';
    }
    if (message.includes('runtime') || message.includes('cannot read')) {
      return 'runtime';
    }

    return 'other';
  }
}
