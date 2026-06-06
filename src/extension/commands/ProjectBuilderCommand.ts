/**
 * ProjectBuilderCommand
 *
 * Wizard: requirements → design.md (via UIUXArchitectAgent) → tasks.md → run spec.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { SpecGenerator, ProjectBuilderInput, GeneratedSpec } from '../spec/SpecGenerator';
import { SpecTaskExecutor } from '../spec/SpecTaskExecutor';
import { ForgeBrowserSession } from '../services/ForgeBrowserSession';
import { Logger } from '../utils/Logger';

export class ProjectBuilderCommand {
  constructor(private readonly logger: Logger) {}

  public async execute(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('No workspace open.');
      return;
    }

    const description = await vscode.window.showInputBox({
      prompt: 'Describe what you want to build',
      placeHolder: 'A React dashboard with auth, charts, and dark mode',
    });
    if (!description) return;

    const projectName = await vscode.window.showInputBox({
      prompt: 'Project name',
      placeHolder: 'my-dashboard',
      value: description.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
    });
    if (!projectName) return;

    const techStack = (await vscode.window.showQuickPick(
      ['React + TypeScript + Vite', 'Next.js', 'Node.js + Express', 'Vanilla TypeScript'],
      { canPickMany: true, placeHolder: 'Select tech stack' }
    )) || [];

    const featuresInput = await vscode.window.showInputBox({
      prompt: 'Key features (comma-separated)',
      placeHolder: 'Authentication, Data visualization, Dark mode',
    });
    const features = featuresInput ? featuresInput.split(',').map((f) => f.trim()).filter(Boolean) : [];

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Building project from scratch',
        cancellable: false,
      },
      async (progress) => {
        try {
          progress.report({ increment: 0, message: 'Generating requirements...' });
          const ollama = await vscode.commands.executeCommand('forgeai.getOllama') as any;
          if (!ollama) {
            void vscode.window.showErrorMessage('Ollama client not available.');
            return;
          }

          const generator = new SpecGenerator(ollama, this.logger, workspaceRoot);
          const generated = await generator.generate({
            description,
            techStack: techStack as string[],
            features,
            projectName,
          });

          progress.report({ increment: 50, message: 'Running spec...' });

          const browserSession = new ForgeBrowserSession();
          await browserSession.initialize(
            (frame) => {},
            'about:blank'
          );
          const executor = new SpecTaskExecutor(
            undefined,
            undefined,
            workspaceRoot,
            ollama,
            this.logger
          );

          const result = await executor.executeSpec(
            generated.specDir,
            { execute: ollama.execute.bind(ollama) },
            {
              stopAtCheckpoints: false,
              autoRetry: true,
              maxRetries: 2,
              continueOnFailure: true,
            },
            browserSession,
            ollama,
            this.logger
          );

          progress.report({ increment: 100, message: 'Done' });

          void vscode.window.showInformationMessage(
            `Project built: ${result.completed}/${result.spec.tasks.length} tasks completed`
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error('Project build failed', error);
          void vscode.window.showErrorMessage(`Project build failed: ${msg}`);
        }
      }
    );
  }
}
