/**
 * ProjectBuilderCommand
 *
 * Wizard: requirements → design.md (via DesignAgent) → tasks.md → run spec.
 * NOW USES: SpecOrchestrator with RequirementsAgent + DesignAgent + TasksAgent
 * All output follows the Kiro template format exactly.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getConfiguredModel } from '../config/ModelConfig';
import { SpecOrchestrator, SpecOrchestratorDeps } from '../agents/spec/SpecOrchestrator';
import { ToolRegistry } from '../tools/ToolRegistry';
import { OllamaClient } from '../ollama/OllamaClient';
import { Logger } from '../utils/Logger';
import { SpecManager } from '../forgeaiWorkspace/SpecManager';
import { ProductManager } from '../forgeaiWorkspace/ProductManager';
import { MemoryManager } from '../forgeaiWorkspace/MemoryManager';
import { ResearchAgent } from '../agents/research/ResearchAgent';
import { SpecTaskExecutor } from '../spec/SpecTaskExecutor';
import { ForgeBrowserSession } from '../services/ForgeBrowserSession';

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
      prompt: 'Project name (used as spec title)',
      placeHolder: 'my-dashboard',
      value: description.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
    });
    if (!projectName) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Building project from scratch (Kiro template)',
        cancellable: false,
      },
      async (progress) => {
        try {
          progress.report({ increment: 0, message: 'Initializing services...' });

          // Get services from extension globals (same pattern as extension.ts)
          const ollama = (global as any).__FORGEAI_OLLAMA__ as OllamaClient | undefined;
          const forgeaiWorkspace = (global as any).__FORGEAI_WORKSPACE__;
          const researchAgent = (global as any).__FORGEAI_RESEARCH_AGENT__ as ResearchAgent | undefined;

          if (!ollama || !forgeaiWorkspace) {
            void vscode.window.showErrorMessage('ForgeAI services not ready. Please reload the window.');
            return;
          }

          const toolRegistry = new ToolRegistry(
            {} as any,
            this.logger
          );

          const orchestratorDeps: SpecOrchestratorDeps = {
            toolRegistry,
            ollamaClient: ollama,
            specManager: forgeaiWorkspace.spec,
            productManager: forgeaiWorkspace.product,
            memoryManager: forgeaiWorkspace.memory,
            researchAgent: researchAgent || ({} as ResearchAgent),
            logger: this.logger,
          };

          const orchestrator = new SpecOrchestrator(orchestratorDeps);

          progress.report({ increment: 10, message: 'Generating requirements (Kiro template)...' });

          const result = await orchestrator.generate({
            title: projectName,
            description,
            mode: 'full',
            workflow: 'requirements-first',
          });

          if (!result.success) {
            void vscode.window.showErrorMessage(`Spec generation failed: ${result.error}`);
            return;
          }

          progress.report({ increment: 70, message: 'Running spec tasks...' });

          const specDir = path.join(workspaceRoot, '.forgeai', 'specs', result.specId);

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

           const executorResult = await executor.executeSpec(
            specDir,
            { execute: async (..._args: unknown[]) => {
              const [systemPrompt, userPrompt] = _args as [string, string];
              const response = await ollama.chat({
                model: getConfiguredModel(),
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
                stream: false,
              });
              return (response as any).message?.content || '';
            }},
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
            `Project built: ${executorResult.completed}/${executorResult.spec.tasks.length} tasks completed`
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
