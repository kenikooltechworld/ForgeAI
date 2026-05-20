import * as vscode from 'vscode';
import { TaskManager, ParsedTask } from '../forgeaiWorkspace/TaskManager';
import { Logger } from '../utils/Logger';

/**
 * CodeLens provider that renders inline "Start Task" / "Running..." / "Completed"
 * buttons on tasks.md files within .forgeai/specs/.
 */
export class TaskCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(
    private taskManager: TaskManager,
    private logger: Logger
  ) {}

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const filePath = document.fileName;
    // Only apply to tasks.md inside .forgeai/specs/
    if (!filePath.includes('.forgeai') || !filePath.includes('specs') || !filePath.endsWith('tasks.md')) {
      return [];
    }

    // Extract specId from path: .../.forgeai/specs/<specId>/tasks.md
    const match = filePath.match(/[\\/]specs[\\/]([^\\/]+)[\\/]tasks\.md$/);
    if (!match) return [];

    const specId = match[1];
    const lenses: vscode.CodeLens[] = [];

    try {
      const tasks = this.taskManager.parseTasks(specId);
      for (const task of tasks) {
        const line = document.lineAt(task.line);
        const range = new vscode.Range(task.line, 0, task.line, line.text.length);
        lenses.push(this.createLens(range, task, specId));
      }
    } catch (err) {
      this.logger.warn('Failed to parse tasks for CodeLens', err);
    }

    return lenses;
  }

  resolveCodeLens(lens: vscode.CodeLens): vscode.CodeLens {
    return lens;
  }

  private createLens(
    range: vscode.Range,
    task: ParsedTask,
    specId: string
  ): vscode.CodeLens {
    switch (task.status) {
      case 'done': {
        const depsDone = task.dependencies.length
          ? ` (deps: ${task.dependencies.map((d) => d.slice(0, 6)).join(', ')})`
          : '';
        return new vscode.CodeLens(range, {
          title: `$(check) Completed${depsDone}`,
          tooltip: `Task completed${depsDone}`,
          command: '',
        });
      }
      case 'in_progress':
        return new vscode.CodeLens(range, {
          title: `$(loading~spin) Running…`,
          tooltip: `Task ${task.id} is currently being executed`,
          command: '',
        });
      case 'failed':
        return new vscode.CodeLens(range, {
          title: `$(error) Retry`,
          tooltip: `Task failed — click to retry`,
          command: 'forgeai.spec.startTask',
          arguments: [specId, task.id],
        });
      case 'pending': {
        const blocked = !this.taskManager.dependenciesMet(specId, task.id);
        if (blocked) {
          const missing = task.dependencies
            .map((dep) => this.taskManager.parseTasks(specId).find((t) => t.id === dep))
            .filter((t): t is ParsedTask => !!t && t.status !== 'done')
            .map((t) => t.description.slice(0, 30));
          return new vscode.CodeLens(range, {
            title: `$(lock) Blocked: ${missing.join(', ')}`,
            tooltip: `Dependencies not yet complete: ${missing.join(', ')}`,
            command: '',
          });
        }
        return new vscode.CodeLens(range, {
          title: `$(play) Start Task`,
          tooltip: `Execute task: ${task.description.slice(0, 60)}`,
          command: 'forgeai.spec.startTask',
          arguments: [specId, task.id],
        });
      }
    }
  }
}
