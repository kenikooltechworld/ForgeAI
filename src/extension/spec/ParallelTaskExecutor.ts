/**
 * ParallelTaskExecutor
 *
 * Runs independent spec tasks in parallel while respecting dependencies.
 * Requirements: 27.1, 27.2, 27.4, 27.5, 27.6, 27.7
 */

import { ExecutableTask, ParsedSpec, SpecContext, ComplianceResult, SPEC_DIR_LAYOUT } from './types';
import { SpecReader } from './SpecReader';
import { BugFixOrchestrator } from './BugFixOrchestrator';
import { Logger } from '../utils/Logger';
import * as fs from 'fs';
import * as path from 'path';

export interface ParallelTaskResult {
  taskId: string;
  passed: boolean;
  compliance: ComplianceResult;
}

export interface ParallelExecutionOptions {
  maxConcurrency?: number;
  maxRetries?: number;
  continueOnFailure?: boolean;
  onTaskProgress?: (taskId: string, progress: number) => void;
  onTaskComplete?: (taskId: string, compliance: ComplianceResult) => void;
  onTaskFail?: (taskId: string, error: string) => void;
  executeTask: (
    task: ExecutableTask,
    context: SpecContext,
    options: { maxRetries: number }
  ) => Promise<ComplianceResult>;
}

export class ParallelTaskExecutor {
  private readonly specReader: SpecReader;
  private readonly bugFixOrchestrator: BugFixOrchestrator;
  private readonly logger: Logger;
  private readonly maxConcurrency: number;

  constructor(logger: Logger, maxConcurrency = 2) {
    this.logger = logger;
    this.specReader = new SpecReader();
    this.bugFixOrchestrator = new BugFixOrchestrator();
    this.maxConcurrency = Math.min(maxConcurrency, 4);
  }

  public async executeParallel(
    specDir: string,
    options: ParallelExecutionOptions
  ): Promise<ParallelTaskResult[]> {
    const spec = await this.specReader.parseSpecDirectory(specDir);
    const context = this.buildContext(spec, specDir);
    const pending = new Set(spec.tasks.filter((t) => t.status === 'pending').map((t) => t.id));
    const results = new Map<string, ParallelTaskResult>();
    const inFlight = new Map<string, Promise<ParallelTaskResult>>();

    while (pending.size > 0 || inFlight.size > 0) {
      const ready = this.getReadyTasks(spec.tasks, results, pending);

      while (inFlight.size < this.maxConcurrency && ready.length > 0) {
        const task = ready.shift()!;
        pending.delete(task.id);
        const promise = this.runTask(task, spec, context, options).then((result) => {
          results.set(task.id, result);
          inFlight.delete(task.id);
          return result;
        });
        inFlight.set(task.id, promise);
      }

      if (inFlight.size > 0) {
        const result = await Promise.race(inFlight.values());
        if (!options.continueOnFailure && !result.passed) {
          break;
        }
      }
    }

    return Array.from(results.values());
  }

  private getReadyTasks(
    tasks: ExecutableTask[],
    results: Map<string, ParallelTaskResult>,
    pending: Set<string>
  ): ExecutableTask[] {
    const ready: ExecutableTask[] = [];
    for (const task of tasks) {
      if (!pending.has(task.id)) continue;
      const depsMet = task.dependencies.every((depId) => results.has(depId) && results.get(depId)!.passed);
      if (depsMet) ready.push(task);
    }
    return ready;
  }

  private async runTask(
    task: ExecutableTask,
    spec: ParsedSpec,
    context: SpecContext,
    options: ParallelExecutionOptions
  ): Promise<ParallelTaskResult> {
    try {
      const compliance = await options.executeTask(task, context, { maxRetries: options.maxRetries ?? 2 });
      options.onTaskComplete?.(task.id, compliance);
      return { taskId: task.id, passed: compliance.passed, compliance };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      options.onTaskFail?.(task.id, msg);
      return {
        taskId: task.id,
        passed: false,
        compliance: {
          passed: false,
          criterionResults: [],
          score: 0,
          correctionInstructions: msg,
          durationMs: 0,
        },
      };
    }
  }

  private buildContext(spec: ParsedSpec, specDir: string): SpecContext {
    const constitutionPath = path.join(specDir, '..', SPEC_DIR_LAYOUT.constitution);
    const constitution = fs.existsSync(constitutionPath)
      ? fs.readFileSync(constitutionPath, 'utf-8')
      : '# No constitution defined. Use sensible defaults.';

    const productPath = path.join(specDir, '..', SPEC_DIR_LAYOUT.productFile);
    const structurePath = path.join(specDir, '..', SPEC_DIR_LAYOUT.structureFile);
    const techPath = path.join(specDir, '..', SPEC_DIR_LAYOUT.techFile);

    return {
      spec,
      currentTask: spec.tasks[0],
      constitution,
      memoryBank: {
        product: fs.existsSync(productPath) ? fs.readFileSync(productPath, 'utf-8') : '',
        structure: fs.existsSync(structurePath) ? fs.readFileSync(structurePath, 'utf-8') : '',
        tech: fs.existsSync(techPath) ? fs.readFileSync(techPath, 'utf-8') : '',
      },
      completedTasks: [],
    };
  }
}
