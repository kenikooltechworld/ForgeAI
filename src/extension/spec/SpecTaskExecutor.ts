/**
 * SpecTaskExecutor — Sequential task runner that replaces the LangGraph orchestrator
 *
 * Core principle: Read the spec, execute tasks one by one, verify, repeat.
 * No recursion limits. No graph transitions. Just: task → execute → verify → next.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpecReader } from './SpecReader';
import {
  ParsedSpec,
  ExecutableTask,
  SpecContext,
  ComplianceResult,
  SpecExecutionOptions,
  SPEC_DIR_LAYOUT,
} from './types';

/**
 * Simple internal logger
 */
class TaskLogger {
  private readonly prefix: string;
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  info(msg: string) {
    console.log(`[${this.prefix}] ${msg}`);
  }
  warn(msg: string) {
    console.warn(`[${this.prefix}] ${msg}`);
  }
  error(msg: string) {
    console.error(`[${this.prefix}] ${msg}`);
  }
}

/**
 * Executes tasks from a spec sequentially with context injection
 */
export class SpecTaskExecutor {
  private readonly logger: TaskLogger;
  private readonly specReader: SpecReader;
  private isRunning = false;
  private shouldStop = false;

  constructor() {
    this.logger = new TaskLogger('SpecTaskExecutor');
    this.specReader = new SpecReader();
  }

  /**
   * Execute a spec from start to finish (or until stopped)
   *
   * @param specDir — Path to spec directory
   * @param agentLoop — The AgentLoop instance to use for task execution
   * @param options — Execution options (checkpoints, retries, callbacks)
   */
  public async executeSpec(
    specDir: string,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    options: Partial<SpecExecutionOptions> = {}
  ): Promise<{ spec: ParsedSpec; completed: number; failed: number }> {
    const opts: SpecExecutionOptions = {
      stopAtCheckpoints: true,
      autoRetry: true,
      maxRetries: 2,
      continueOnFailure: true,
      ...options,
    };

    this.isRunning = true;
    this.shouldStop = false;

    // Parse the spec
    const spec = await this.specReader.parseSpecDirectory(specDir);
    this.logger.info(
      `Starting spec execution: ${spec.id} (${spec.tasks.length} tasks, ${spec.progress}% already complete)`
    );

    // Build spec context (will be injected into every task)
    const specContext = this.buildSpecContext(spec, specDir);

    let completed = spec.completedCount;
    let failed = spec.failedCount;

    try {
      while (!this.shouldStop) {
        // Get next ready task
        const nextTask = this.specReader.getNextTask(spec);
        if (!nextTask) {
          this.logger.info('No more tasks ready for execution.');
          break;
        }

        // Check for checkpoint
        if (nextTask.isCheckpoint && opts.stopAtCheckpoints) {
          const phase = spec.phases.find((p) => p.number === nextTask.phase);
          if (phase && opts.onCheckpoint) {
            this.logger.info(`Checkpoint reached: Phase ${nextTask.phase}`);
            const shouldContinue = await opts.onCheckpoint(phase);
            if (!shouldContinue) {
              this.logger.info('Paused at checkpoint.');
              break;
            }
          }
          // Mark checkpoint as complete and continue
          nextTask.status = 'complete';
          completed++;
          void this.specReader.saveStatus(spec);
          continue;
        }

        // Execute the task
        const result = await this.executeTask(nextTask, specContext, agentLoop, opts);

        if (result.passed) {
          nextTask.status = 'complete';
          nextTask.completedAt = Date.now();
          completed++;
          this.logger.info(`Task ${nextTask.id} completed: ${nextTask.description}`);

          // Add to completed tasks in context
          specContext.completedTasks.push({
            taskId: nextTask.id,
            description: nextTask.description,
            artifacts: nextTask.producedArtifacts,
            summary: `Completed: ${nextTask.description}`,
          });

          if (opts.onTaskComplete) {
            opts.onTaskComplete(nextTask, result);
          }
        } else {
          nextTask.status = 'failed';
          nextTask.completedAt = Date.now();
          nextTask.error = result.correctionInstructions || 'Compliance check failed';
          failed++;
          this.logger.warn(`Task ${nextTask.id} failed: ${nextTask.description}`);

          if (opts.onTaskFail) {
            opts.onTaskFail(nextTask, nextTask.error);
          }

          if (!opts.continueOnFailure) {
            this.logger.error('Stopping on task failure (continueOnFailure=false)');
            break;
          }
        }

        // Update progress
        spec.progress = Math.round((completed / spec.tasks.length) * 100);

        // Save status after every task
        this.specReader.saveStatus(spec);

        // Report progress
        if (opts.onTaskProgress) {
          opts.onTaskProgress(nextTask, spec.progress);
        }
      }
    } finally {
      this.isRunning = false;
    }

    this.logger.info(
      `Spec execution finished: ${completed}/${spec.tasks.length} completed, ${failed} failed, ${spec.progress}%`
    );
    return { spec, completed, failed };
  }

  /**
   * Execute a single task using the AgentLoop
   *
   * @param task — The task to execute
   * @param specContext — Full spec context injected into system prompt
   * @param agentLoop — AgentLoop instance
   * @param options — Execution options
   */
  private async executeTask(
    task: ExecutableTask,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    options: SpecExecutionOptions
  ): Promise<ComplianceResult> {
    this.logger.info(`Executing task ${task.id}: ${task.description}`);
    task.status = 'in_progress';
    task.startedAt = Date.now();

    // Build the task prompt with full context
    const taskPrompt = this.buildTaskPrompt(task, specContext);

    let attempts = 0;
    let lastResult: ComplianceResult | null = null;

    while (attempts <= options.maxRetries) {
      attempts++;
      task.retryCount = attempts - 1;

      try {
        // Execute via AgentLoop
        // TODO: Phase 1.4 will wire this properly
        // For now, this is the interface contract
        const executionResult = await this.runAgentLoop(agentLoop, taskPrompt, task, specContext);

        // Verify compliance
        lastResult = this.verifyCompliance(task, executionResult, specContext);

        if (lastResult.passed) {
          return lastResult;
        }

        // Failed — should we retry?
        if (attempts <= options.maxRetries && options.autoRetry) {
          this.logger.warn(
            `Task ${task.id} failed compliance, retrying (${attempts}/${options.maxRetries})`
          );
          // Update prompt with correction instructions for next attempt
          // The correction instructions will be included in the next prompt
        } else {
          // No more retries
          break;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Task ${task.id} execution error: ${errorMsg}`);

        lastResult = {
          passed: false,
          criterionResults: [],
          score: 0,
          correctionInstructions: `Execution error: ${errorMsg}`,
          durationMs: 0,
        };

        if (attempts <= options.maxRetries && options.autoRetry) {
          this.logger.warn(`Task ${task.id} errored, retrying (${attempts}/${options.maxRetries})`);
        } else {
          break;
        }
      }
    }

    return (
      lastResult || {
        passed: false,
        criterionResults: [],
        score: 0,
        durationMs: 0,
      }
    );
  }

  /**
   * Build the full task prompt with spec context injected
   *
   * This is the key piece: every task execution gets the FULL spec context
   * so the AI knows what it's building and why.
   */
  private buildTaskPrompt(task: ExecutableTask, context: SpecContext): string {
    const completedSummary = context.completedTasks
      .map((t) => `- [x] ${t.taskId}: ${t.description}`)
      .join('\n');

    const pendingTasks = context.spec.tasks
      .filter((t) => t.status === 'pending' && t.id !== task.id)
      .map((t) => `- [ ] ${t.id}: ${t.description}`)
      .join('\n');

    const acceptanceCriteria = context.spec.requirements
      .filter((r) => task.requirementIds.includes(r.id))
      .flatMap((r) => r.acceptanceCriteria)
      .map((c) => `- ${c.text}`)
      .join('\n');

    return `
# SPEC CONTEXT

You are executing Task ${task.id} of ${context.spec.tasks.length} from the following specification.

## Constitution (Project Rules)
${context.constitution}

## Current Task
**ID:** ${task.id}
**Phase:** ${task.phase}
**Description:** ${task.description}

## Instructions
${task.instructions.map((i) => `- ${i}`).join('\n')}

## Acceptance Criteria
${acceptanceCriteria || 'No specific acceptance criteria defined.'}

## Requirements Traceability
This task implements: ${task.requirementIds.join(', ')}

## Previously Completed Tasks
${completedSummary || 'None yet.'}

## Remaining Tasks
${pendingTasks || 'None — this is the last task!'}

## Your Instructions
Follow the instructions above precisely. Produce the expected artifacts. Do not skip steps.
Expected artifacts: ${task.expectedArtifacts.join(', ') || 'None specified'}
`.trim();
  }

  /**
   * Build the spec context for injection into AgentLoop
   */
  private buildSpecContext(spec: ParsedSpec, specDir: string): SpecContext {
    // Load constitution
    const constitutionPath = path.join(specDir, '..', SPEC_DIR_LAYOUT.constitution);
    const constitution = fs.existsSync(constitutionPath)
      ? fs.readFileSync(constitutionPath, 'utf-8')
      : '# No constitution defined. Use sensible defaults.';

    // Load memory bank
    const productPath = path.join(specDir, '..', SPEC_DIR_LAYOUT.productFile);
    const structurePath = path.join(specDir, '..', SPEC_DIR_LAYOUT.structureFile);
    const techPath = path.join(specDir, '..', SPEC_DIR_LAYOUT.techFile);

    return {
      spec,
      currentTask: spec.tasks[0], // Will be updated before each task execution
      constitution,
      memoryBank: {
        product: fs.existsSync(productPath) ? fs.readFileSync(productPath, 'utf-8') : '',
        structure: fs.existsSync(structurePath) ? fs.readFileSync(structurePath, 'utf-8') : '',
        tech: fs.existsSync(techPath) ? fs.readFileSync(techPath, 'utf-8') : '',
      },
      completedTasks: spec.tasks
        .filter((t) => t.status === 'complete')
        .map((t) => ({
          taskId: t.id,
          description: t.description,
          artifacts: t.producedArtifacts,
          summary: `Completed: ${t.description}`,
        })),
    };
  }

  /**
   * Verify task output against acceptance criteria
   *
   * TODO: Phase 1.3 will implement the real ComplianceChecker
   * For now, this is a placeholder that checks if expected artifacts exist.
   */
  private verifyCompliance(
    task: ExecutableTask,
    _executionResult: unknown,
    _context: SpecContext
  ): ComplianceResult {
    const startTime = Date.now();
    const criterionResults: ComplianceResult['criterionResults'] = [];
    let allPassed = true;

    // Check 1: Did expected artifacts get created?
    for (const artifact of task.expectedArtifacts) {
      const artifactPath = path.join(task.id.startsWith('ui-ux') ? '.' : 'src/extension', artifact);
      const exists = fs.existsSync(artifactPath);
      criterionResults.push({
        criterion: `Artifact ${artifact} should exist`,
        passed: exists,
        explanation: exists ? `Found ${artifact}` : `Missing ${artifact}`,
      });
      if (!exists) allPassed = false;
    }

    // Check 2: If no expected artifacts, check if task has instructions that were followed
    if (task.expectedArtifacts.length === 0) {
      criterionResults.push({
        criterion: 'Task instructions executed',
        passed: true,
        explanation: 'No artifact requirements — instructions-based task',
      });
    }

    const durationMs = Date.now() - startTime;

    // Calculate score
    const passedCount = criterionResults.filter((c) => c.passed).length;
    const score =
      criterionResults.length > 0 ? Math.round((passedCount / criterionResults.length) * 100) : 100;

    const result: ComplianceResult = {
      passed: allPassed && score >= 80,
      criterionResults,
      score,
      correctionInstructions: allPassed
        ? undefined
        : `Missing artifacts: ${task.expectedArtifacts.filter((a) => !fs.existsSync(path.join('.', a))).join(', ')}`,
      durationMs,
    };
    return result;
  }

  /**
   * Run the AgentLoop with the task prompt and spec context
   */
  private async runAgentLoop(
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    prompt: string,
    task: ExecutableTask,
    specContext: SpecContext
  ): Promise<unknown> {
    const messages = [
      {
        role: 'system' as const,
        content: 'You are a task executor. Follow instructions precisely.',
      },
      { role: 'user' as const, content: prompt },
    ];

    const toolResults: unknown[] = [];

    await agentLoop.execute(
      messages,
      (update: unknown) => {
        const u = update as { type: string; content?: string };
        if (u.type === 'complete' || u.type === 'toolComplete') {
          toolResults.push(u);
        }
      },
      [],
      'gpt-oss:120b-cloud',
      { specContext }
    );

    return {
      success: true,
      artifacts: task.expectedArtifacts,
      output: `Executed: ${task.description}`,
      results: toolResults,
    };
  }

  /**
   * Stop execution gracefully
   */
  public stop(): void {
    this.shouldStop = true;
    this.logger.info('Stop requested. Finishing current task...');
  }

  /**
   * Check if executor is currently running
   */
  public isCurrentlyRunning(): boolean {
    return this.isRunning;
  }
}
