import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ParsedTask {
  /** Unique task identifier (hash of description) */
  id: string;
  /** 0-based position in the task list */
  index: number;
  /** Human-readable description */
  description: string;
  /** Current execution status */
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  /** Task IDs that must complete before this one (inferred from ordering) */
  dependencies: string[];
  /** Phase / heading this task belongs to */
  phase: string;
  /** Line number in tasks.md (0-based) */
  line: number;
}

export interface TaskState {
  specId: string;
  tasks: ParsedTask[];
  lastUpdated: number;
}

/**
 * Parses tasks.md markdown into structured tasks and tracks execution state.
 * Kiro-style: tasks are checkboxes in a markdown file you edit in VS Code.
 */
export class TaskManager {
  private specsDir: string;

  constructor(workspaceRoot: string) {
    this.specsDir = path.join(workspaceRoot, '.forgeai', 'specs');
  }

  /** Parse tasks.md for a spec into structured task objects */
  parseTasks(specId: string): ParsedTask[] {
    const tasksFile = path.join(this.specsDir, specId, 'tasks.md');
    if (!fs.existsSync(tasksFile)) return [];

    const content = fs.readFileSync(tasksFile, 'utf-8');
    const state = this.loadState(specId);
    const lines = content.split('\n');

    const tasks: ParsedTask[] = [];
    let currentPhase = 'General';
    const taskByIndex: Map<number, ParsedTask> = new Map();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track phase headings (## Heading or ### Heading)
      const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);
      if (headingMatch) {
        currentPhase = headingMatch[2].trim();
        continue;
      }

      // Parse checkbox tasks: - [ ] description  or  - [x] description
      const checkboxMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
      if (checkboxMatch) {
        const checked = checkboxMatch[1].toLowerCase() === 'x';
        const description = checkboxMatch[2].trim();
        const id = this.hashDescription(description);
        const index = tasks.length;

        // Infer dependencies: within the same phase, a task depends on the
        // immediately preceding task if it exists. This creates a sequential
        // chain per phase matching Kiro's ordered-task convention.
        const dependencies: string[] = [];
        if (index > 0) {
          // Find the most recent task in the same phase
          for (let j = index - 1; j >= 0; j--) {
            if (tasks[j].phase === currentPhase) {
              dependencies.push(tasks[j].id);
              break;
            }
          }
        }

        // Restore status from persisted state if available
        const persisted = state.tasks.find((t) => t.id === id);
        const status: ParsedTask['status'] = persisted
          ? persisted.status
          : checked
            ? 'done'
            : 'pending';

        const task: ParsedTask = {
          id,
          index,
          description,
          status,
          dependencies,
          phase: currentPhase,
          line: i,
        };

        tasks.push(task);
        taskByIndex.set(index, task);
      }
    }

    return tasks;
  }

  /** Get execution state for a spec */
  getTaskState(specId: string): TaskState {
    const tasks = this.parseTasks(specId);
    return {
      specId,
      tasks,
      lastUpdated: Date.now(),
    };
  }

  /** Update a task's status and persist it */
  updateTaskStatus(specId: string, taskId: string, status: ParsedTask['status']): boolean {
    const state = this.loadState(specId);
    const task = state.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = status;
    } else {
      // If not in state yet, add it (will be reconciled on next parse)
      state.tasks.push({ id: taskId, status } as ParsedTask);
    }
    state.lastUpdated = Date.now();
    this.saveState(specId, state);
    this.syncCheckboxInMarkdown(specId, taskId, status === 'done');
    return true;
  }

  /** Check if all dependencies for a task are satisfied */
  dependenciesMet(specId: string, taskId: string): boolean {
    const tasks = this.parseTasks(specId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return false;
    for (const depId of task.dependencies) {
      const dep = tasks.find((t) => t.id === depId);
      if (!dep || dep.status !== 'done') return false;
    }
    return true;
  }

  /** Get the next ready-to-start task (dependencies met, status pending) */
  getNextRunnableTask(specId: string): ParsedTask | undefined {
    const tasks = this.parseTasks(specId);
    for (const task of tasks) {
      if (task.status === 'pending' && this.dependenciesMet(specId, task.id)) {
        return task;
      }
    }
    return undefined;
  }

  /** Build a dependency graph for visualization */
  buildDependencyGraph(specId: string): {
    nodes: Array<{ id: string; label: string; status: string; phase: string }>;
    edges: Array<{ from: string; to: string }>;
  } {
    const tasks = this.parseTasks(specId);
    const nodes = tasks.map((t) => ({
      id: t.id,
      label: t.description.slice(0, 60),
      status: t.status,
      phase: t.phase,
    }));
    const edges: Array<{ from: string; to: string }> = [];
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        edges.push({ from: depId, to: task.id });
      }
    }
    return { nodes, edges };
  }

  /** Sync the checkbox state in tasks.md to reflect current status */
  private syncCheckboxInMarkdown(specId: string, taskId: string, done: boolean): void {
    const tasksFile = path.join(this.specsDir, specId, 'tasks.md');
    if (!fs.existsSync(tasksFile)) return;

    const content = fs.readFileSync(tasksFile, 'utf-8');
    const lines = content.split('\n');
    const tasks = this.parseTasks(specId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const line = lines[task.line];
    const checkboxPattern = /^(\s*[-*]\s+\[)([ xX])(\]\s+.+)$/;
    if (checkboxPattern.test(line)) {
      const marker = done ? 'x' : ' ';
      lines[task.line] = line.replace(checkboxPattern, `$1${marker}$3`);
      fs.writeFileSync(tasksFile, lines.join('\n'), 'utf-8');
    }
  }

  private loadState(specId: string): TaskState {
    const file = path.join(this.specsDir, specId, 'task-state.json');
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, 'utf-8');
        return JSON.parse(raw) as TaskState;
      } catch {
        // fall through to default
      }
    }
    return { specId, tasks: [], lastUpdated: Date.now() };
  }

  private saveState(specId: string, state: TaskState): void {
    const file = path.join(this.specsDir, specId, 'task-state.json');
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8');
  }

  private hashDescription(description: string): string {
    return crypto.createHash('md5').update(description).digest('hex').slice(0, 8);
  }
}
