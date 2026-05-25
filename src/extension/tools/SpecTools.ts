import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Tool } from './ToolRegistry';
import type { SpecManager, SpecArtifact, SpecConfig } from '../forgeaiWorkspace/SpecManager';
import type { DriftDetector } from '../forgeaiWorkspace/DriftDetector';
import type { OllamaClient } from '../ollama/OllamaClient';
import type { StorageManager } from '../storage/StorageManager';
import type { ProductManager } from '../forgeaiWorkspace/ProductManager';
import type { MemoryManager } from '../forgeaiWorkspace/MemoryManager';
import type { ResearchAgent } from '../agents/research/ResearchAgent';
import { DEFAULT_MODEL } from '../config/ModelConfig';

type SpecWorkflow = SpecConfig['workflow'];
type ArtifactKey = keyof SpecArtifact;

/**
 * Spec Tools - Allow the AI agent to create, manage, and analyze specs.
 * These are registered in the ToolRegistry so the LLM can invoke them.
 */
export class SpecTools {
  constructor(
    private readonly getSpecManager: () => SpecManager | undefined,
    private readonly getDriftDetector: () => DriftDetector | undefined,
    private readonly getOllama: () => OllamaClient | undefined,
    private readonly getStorage: () => StorageManager | undefined,
    private readonly getProductManager: () => ProductManager | undefined,
    private readonly getMemoryManager: () => MemoryManager | undefined,
    private readonly getResearchAgent: () => ResearchAgent | undefined
  ) {}

  /** forgeai_createSpec — Create a new spec with scaffolding */
  createSpec(): Tool {
    return {
      name: 'forgeai_createSpec',
      description:
        'Create a new ForgeAI spec. ONLY call this AFTER researching (RAG + webResearch) and AFTER the user explicitly agrees to create a spec. ' +
        'If the user asked for a plan or recommendations, do research first and present findings in chat BEFORE calling this tool. ' +
        'Creates .forgeai/specs/<id>/ directory with requirements.md, design.md, tasks.md. Returns the spec ID.',
      inputSchema: {
        type: 'object',
        required: ['title'],
        properties: {
          title: {
            type: 'string',
            description: 'Title of the spec (e.g., "User Authentication", "Fix login timeout")',
          },
          workflow: {
            type: 'string',
            description:
              'Workflow type: requirements-first (default), design-first, quick-plan, or bugfix',
            enum: ['requirements-first', 'design-first', 'quick-plan', 'bugfix'],
          },
          description: {
            type: 'string',
            description: 'Optional short description of what the spec covers',
          },
        },
      },
      execute: (args: { title: string; workflow?: string; description?: string }) => {
        const specManager = this.getSpecManager();
        if (!specManager) {
          return Promise.resolve({ success: false, error: 'SpecManager not available' });
        }
        const id = specManager.nextSpecId(args.title);
        const workflow = (args.workflow as SpecWorkflow) || 'requirements-first';
        const config = specManager.createSpec(id, args.title, workflow);

        // If user provided a description, seed the requirements/bugfix file
        if (args.description) {
          const artifact: ArtifactKey = workflow === 'bugfix' ? 'bugfix' : 'requirements';
          const current = specManager.loadSpec(id)?.artifacts[artifact] || '';
          const seeded = current + `\n\n## User Description\n${args.description}\n`;
          specManager.writeArtifact(id, artifact, seeded);
        }

        return Promise.resolve({
          success: true,
          specId: id,
          title: config.title,
          workflow: config.workflow,
          message: `Spec "${config.title}" created at .forgeai/specs/${id}/`,
        });
      },
    };
  }

  /** forgeai_writeSpecArtifact — Write content to a spec artifact file */
  writeSpecArtifact(): Tool {
    return {
      name: 'forgeai_writeSpecArtifact',
      description:
        'Write content to a spec artifact file (requirements.md, design.md, tasks.md, or bugfix.md). After writing, ALSO summarize the key points in your chat response so the user knows what was created.',
      inputSchema: {
        type: 'object',
        required: ['specId', 'type', 'content'],
        properties: {
          specId: {
            type: 'string',
            description: 'Spec ID (e.g., "001-spec")',
          },
          type: {
            type: 'string',
            description: 'Artifact type: requirements, design, tasks, or bugfix',
            enum: ['requirements', 'design', 'tasks', 'bugfix'],
          },
          content: {
            type: 'string',
            description: 'Markdown content to write to the artifact file',
          },
        },
      },
      execute: (args: { specId: string; type: string; content: string }) => {
        const specManager = this.getSpecManager();
        if (!specManager) {
          return Promise.resolve({ success: false, error: 'SpecManager not available' });
        }
        specManager.writeArtifact(args.specId, args.type as ArtifactKey, args.content);
        return Promise.resolve({
          success: true,
          specId: args.specId,
          type: args.type,
          message: `Wrote ${args.type}.md for spec ${args.specId}`,
          content: args.content,
        });
      },
    };
  }

  /** forgeai_readSpec — Read a spec's artifacts */
  readSpec(): Tool {
    return {
      name: 'forgeai_readSpec',
      description:
        'Read an existing spec and return its config and all artifacts (requirements, design, tasks, bugfix). Use this to inspect current spec content before continuing or modifying.',
      inputSchema: {
        type: 'object',
        required: ['specId'],
        properties: {
          specId: {
            type: 'string',
            description: 'Spec ID (e.g., "001-spec")',
          },
        },
      },
      execute: (args: { specId: string }) => {
        const specManager = this.getSpecManager();
        if (!specManager) {
          return Promise.resolve({ success: false, error: 'SpecManager not available' });
        }
        const spec = specManager.loadSpec(args.specId);
        if (!spec) {
          return Promise.resolve({ success: false, error: `Spec ${args.specId} not found` });
        }
        return Promise.resolve({
          success: true,
          config: spec.config,
          artifacts: {
            requirements: spec.artifacts.requirements.slice(0, 3000),
            design: spec.artifacts.design.slice(0, 3000),
            tasks: spec.artifacts.tasks.slice(0, 3000),
            bugfix: spec.artifacts.bugfix.slice(0, 3000),
          },
        });
      },
    };
  }

  /** forgeai_listSpecs — List all specs in the workspace */
  listSpecs(): Tool {
    return {
      name: 'forgeai_listSpecs',
      description:
        'List all specs in the current workspace. Returns spec IDs, titles, statuses, and current phases.',
      inputSchema: {
        type: 'object',
        required: [],
        properties: {},
      },
      execute: () => {
        const specManager = this.getSpecManager();
        if (!specManager) {
          return Promise.resolve({ success: false, error: 'SpecManager not available' });
        }
        const specs = specManager.listSpecs();
        return Promise.resolve({
          success: true,
          specs: specs.map((s) => ({
            id: s.id,
            title: s.title,
            status: s.status,
            currentPhase: s.currentPhase,
            phasesCompleted: s.phasesCompleted,
            workflow: s.workflow,
          })),
        });
      },
    };
  }

  /** forgeai_continueSpec — Generate the next phase of a spec using AI */
  continueSpec(): Tool {
    return {
      name: 'forgeai_continueSpec',
      description:
        'Continue an existing spec by generating the next missing phase (requirements → design → tasks) using AI. For bugfix specs, generates the full bugfix analysis. Use this when the user asks you to continue, advance, or generate the next phase of a spec.',
      inputSchema: {
        type: 'object',
        required: ['specId'],
        properties: {
          specId: {
            type: 'string',
            description: 'Spec ID to continue',
          },
        },
      },
      execute: async (args: { specId: string }, token?: vscode.CancellationToken) => {
        const specManager = this.getSpecManager();
        const ollama = this.getOllama();
        const storage = this.getStorage();
        if (!specManager || !ollama) {
          return { success: false, error: 'SpecManager or Ollama not available' };
        }

        const spec = specManager.loadSpec(args.specId);
        if (!spec) {
          return { success: false, error: `Spec ${args.specId} not found` };
        }

        // Use configured default model for spec generation
        const specModel = DEFAULT_MODEL;
        const { SpecWriterAgent } = await import('../agents/spec/SpecWriterAgent');
        const agent = new SpecWriterAgent({
          executeLLM: async (systemPrompt: string, userPrompt: string) => {
            if (token?.isCancellationRequested) throw new Error('Operation cancelled');
            const response = await ollama.chat({
              model: specModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              stream: false,
              options: { temperature: 0.3, num_ctx: 8192 },
            });
            const chatResponse = response as { message: { content: string } };
            return chatResponse.message.content;
          },
          specManager,
          productManager:
            this.getProductManager() ?? ({ getOverview: () => null } as unknown as ProductManager),
          memoryManager:
            this.getMemoryManager() ?? ({ list: () => [] } as unknown as MemoryManager),
          researchAgent: this.getResearchAgent()!,
        });

        const result = await agent.continue(args.specId);
        if (result.success) {
          return {
            success: true,
            specId: args.specId,
            phasesCompleted: result.phasesCompleted,
            message: `Generated next phase for spec "${result.title}". Phases completed: ${result.phasesCompleted.join(', ') || 'none'}`,
            content: result.content || '',
          };
        }
        return { success: false, error: result.error || 'Unknown error' };
      },
    };
  }

  /** forgeai_checkDrift — Run drift detection on a spec */
  checkDrift(): Tool {
    return {
      name: 'forgeai_checkDrift',
      description:
        'Run spec drift detection to check if acceptance criteria in requirements.md are actually implemented in the codebase. Returns drift report with coverage percentage and specific gaps.',
      inputSchema: {
        type: 'object',
        required: ['specId'],
        properties: {
          specId: {
            type: 'string',
            description: 'Spec ID to check',
          },
        },
      },
      execute: (args: { specId: string }) => {
        const specManager = this.getSpecManager();
        const driftDetector = this.getDriftDetector();
        if (!specManager || !driftDetector) {
          return Promise.resolve({
            success: false,
            error: 'SpecManager or DriftDetector not available',
          });
        }
        const spec = specManager.loadSpec(args.specId);
        if (!spec) {
          return Promise.resolve({ success: false, error: `Spec ${args.specId} not found` });
        }
        const report = driftDetector.detect(
          args.specId,
          spec.artifacts.requirements,
          spec.artifacts.tasks
        );
        return Promise.resolve({
          success: true,
          specId: args.specId,
          coverage: report.coverage,
          totalCriteria: report.totalCriteria,
          matched: report.matched,
          driftItems: report.items.map((i) => ({
            criterion: i.criterion,
            severity: i.severity,
            suggestion: i.suggestion,
          })),
        });
      },
    };
  }

  /** forgeai_deleteSpec — Delete a spec and all its artifacts */
  deleteSpec(): Tool {
    return {
      name: 'forgeai_deleteSpec',
      description:
        'Delete a ForgeAI spec and all its artifact files (requirements.md, design.md, tasks.md, bugfix.md). Use this when the user asks you to delete, remove, or discard a spec. Requires explicit user confirmation before deleting.',
      inputSchema: {
        type: 'object',
        required: ['specId'],
        properties: {
          specId: {
            type: 'string',
            description: 'Spec ID to delete (e.g., "001-spec")',
          },
        },
      },
      execute: async (args: { specId: string }) => {
        const specManager = this.getSpecManager();
        if (!specManager) {
          return { success: false, error: 'SpecManager not available' };
        }
        const spec = specManager.loadSpec(args.specId);
        if (!spec) {
          return { success: false, error: `Spec ${args.specId} not found` };
        }
        const confirm = await vscode.window.showWarningMessage(
          `Delete spec "${spec.config.title}" (${args.specId})? This cannot be undone.`,
          { modal: true },
          'Delete'
        );
        if (confirm !== 'Delete') {
          return { success: false, error: 'Deletion cancelled by user', cancelled: true };
        }
        specManager.deleteSpec(args.specId);
        return {
          success: true,
          specId: args.specId,
          message: `Spec "${spec.config.title}" (${args.specId}) deleted.`,
        };
      },
    };
  }

  /** forgeai_startTask — Execute a single task from a spec */
  startTask(): Tool {
    return {
      name: 'forgeai_startTask',
      description:
        'Execute a single task from a spec\'s tasks.md. Triggers the AgentLoop to implement the task. The task must have all dependencies met and status "pending". Use this when the user asks you to run, execute, or implement a specific task.',
      inputSchema: {
        type: 'object',
        required: ['specId', 'taskId'],
        properties: {
          specId: {
            type: 'string',
            description: 'Spec ID containing the task',
          },
          taskId: {
            type: 'string',
            description: 'Task ID to execute (e.g., "T1", "T2")',
          },
        },
      },
      execute: async (args: { specId: string; taskId: string }) => {
        try {
          await vscode.commands.executeCommand('forgeai.spec.startTask', args.specId, args.taskId);
          return {
            success: true,
            specId: args.specId,
            taskId: args.taskId,
            message: `Task ${args.taskId} execution started for spec ${args.specId}.`,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, error: `Failed to start task: ${msg}` };
        }
      },
    };
  }

  /** forgeai_runAllTasks — Execute all pending tasks in a spec */
  runAllTasks(): Tool {
    return {
      name: 'forgeai_runAllTasks',
      description:
        "Execute all pending tasks from a spec's tasks.md that have their dependencies met. Tasks run sequentially. Use this when the user asks you to run all tasks, implement the spec, or execute the full task list.",
      inputSchema: {
        type: 'object',
        required: ['specId'],
        properties: {
          specId: {
            type: 'string',
            description: 'Spec ID whose tasks should be executed',
          },
        },
      },
      execute: async (args: { specId: string }) => {
        const specManager = this.getSpecManager();
        if (!specManager) {
          return { success: false, error: 'SpecManager not available' };
        }
        const spec = specManager.loadSpec(args.specId);
        if (!spec) {
          return { success: false, error: `Spec ${args.specId} not found` };
        }

        // Open tasks.md so the command can detect it
        const tasksFile = vscode.Uri.file(
          path.join(specManager.getSpecsDir(), args.specId, 'tasks.md')
        );
        if (fs.existsSync(tasksFile.fsPath)) {
          const doc = await vscode.workspace.openTextDocument(tasksFile);
          await vscode.window.showTextDocument(doc);
        }

        try {
          await vscode.commands.executeCommand('forgeai.spec.runAllTasks');
          return {
            success: true,
            specId: args.specId,
            message: `All runnable tasks started for spec ${args.specId}.`,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, error: `Failed to run tasks: ${msg}` };
        }
      },
    };
  }

  /** forgeai_approveSpec — Approve a pending phase so continueSpec can proceed */
  approveSpec(): Tool {
    return {
      name: 'forgeai_approveSpec',
      description:
        'Approve a spec phase that is pending review. This marks the phase as approved and allows the next phase to be generated. Use this when the user explicitly says they are satisfied with a generated requirements/design/tasks phase and wants to proceed.',
      inputSchema: {
        type: 'object',
        required: ['specId'],
        properties: {
          specId: {
            type: 'string',
            description: 'Spec ID to approve (e.g., "001-spec")',
          },
        },
      },
      execute: async (args: { specId: string }) => {
        const specManager = this.getSpecManager();
        if (!specManager) {
          return { success: false, error: 'SpecManager not available' };
        }
        const spec = specManager.loadSpec(args.specId);
        if (!spec) {
          return { success: false, error: `Spec ${args.specId} not found` };
        }
        const pending = spec.config.pendingApproval;
        if (!pending) {
          return { success: false, error: 'No pending approval for this spec' };
        }
        specManager.approvePhase(args.specId, pending as 'requirements' | 'design' | 'tasks');
        return {
          success: true,
          specId: args.specId,
          approvedPhase: pending,
          message: `Approved ${pending} phase for spec ${args.specId}. You can now continue to the next phase.`,
        };
      },
    };
  }
}
