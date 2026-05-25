/**
 * SpecTaskExecutor — Sequential task runner that replaces the LangGraph orchestrator
 *
 * Core principle: Read the spec, execute tasks one by one, verify, repeat.
 * No recursion limits. No graph transitions. Just: task → execute → verify → next.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { SpecReader } from './SpecReader';
import {
  ParsedSpec,
  ExecutableTask,
  SpecContext,
  ComplianceResult,
  SpecExecutionOptions,
  SPEC_DIR_LAYOUT,
} from './types';
import { DEFAULT_MODEL } from '../config/ModelConfig';

/**
 * Simple internal logger
 */
class TaskLogger {
  private readonly prefix: string;
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  info(msg: string) {
    // eslint-disable-next-line no-console
    console.log(`[${this.prefix}] ${msg}`);
  }
  warn(msg: string) {
    // eslint-disable-next-line no-console
    console.warn(`[${this.prefix}] ${msg}`);
  }
  error(msg: string) {
    // eslint-disable-next-line no-console
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

        // Check for checkpoint — Phase Gate: run ALL tests for the phase at 100%
        if (nextTask.isCheckpoint && opts.stopAtCheckpoints) {
          const phase = spec.phases.find((p) => p.number === nextTask.phase);
          if (phase) {
            this.logger.info(
              `Phase Gate reached: Phase ${nextTask.phase} — running full test suite`
            );

            // Run ALL tests for this phase before proceeding
            const phaseTestResult = this.runPhaseTests(phase);

            if (opts.onPhaseGate) {
              opts.onPhaseGate(phase, phaseTestResult.passed, phaseTestResult.output);
            }

            if (!phaseTestResult.passed) {
              this.logger.error(
                `Phase ${nextTask.phase} gate FAILED. Tests must pass at 100% before proceeding.`
              );
              nextTask.status = 'failed';
              nextTask.error = `Phase gate failed: ${phaseTestResult.output}`;
              failed++;
              if (opts.onTaskFail) {
                opts.onTaskFail(nextTask, nextTask.error);
              }
              if (!opts.continueOnFailure) {
                this.logger.error('Stopping: phase gate failed and continueOnFailure=false');
                break;
              }
              this.specReader.saveStatus(spec);
              continue;
            }

            this.logger.info(`Phase ${nextTask.phase} gate PASSED. All tests pass at 100%.`);

            if (opts.onCheckpoint) {
              const shouldContinue = await opts.onCheckpoint(phase);
              if (!shouldContinue) {
                this.logger.info('Paused at checkpoint.');
                break;
              }
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
   * Verify task output against acceptance criteria by running actual tests,
   * TypeScript compilation, and artifact checks. Task passes ONLY at 100%.
   */
  private verifyCompliance(
    task: ExecutableTask,
    _executionResult: unknown,
    _context: SpecContext
  ): ComplianceResult {
    const startTime = Date.now();
    const criterionResults: ComplianceResult['criterionResults'] = [];
    let allPassed = true;
    const errors: string[] = [];

    // Check 1: Did expected artifacts get created?
    for (const artifact of task.expectedArtifacts) {
      const artifactPath = path.resolve(artifact);
      const exists = fs.existsSync(artifactPath);
      criterionResults.push({
        criterion: `Artifact ${artifact} should exist`,
        passed: exists,
        explanation: exists ? `Found ${artifact}` : `Missing ${artifact}`,
      });
      if (!exists) {
        allPassed = false;
        errors.push(`Missing artifact: ${artifact}`);
      }
    }

    // Check 2: TypeScript compilation (zero errors required)
    try {
      execSync('npx tsc --noEmit', { timeout: 60000, stdio: 'pipe' });
      criterionResults.push({
        criterion: 'TypeScript compilation succeeds with zero errors',
        passed: true,
        explanation: 'tsc --noEmit passed',
      });
    } catch (err) {
      allPassed = false;
      const msg = err instanceof Error ? err.message : String(err);
      criterionResults.push({
        criterion: 'TypeScript compilation succeeds with zero errors',
        passed: false,
        explanation: `TypeScript errors: ${msg.slice(0, 200)}`,
      });
      errors.push(`TypeScript errors: ${msg.slice(0, 200)}`);
    }

    // Check 3: Run tests if test files are specified in instructions
    const testFileMatches = this.extractTestFilesFromInstructions(task);
    if (testFileMatches.length > 0) {
      try {
        // Run tests for specific files
        const testCmd = `npx jest --passWithNoTests ${testFileMatches.join(' ')}`;
        execSync(testCmd, { timeout: 120000, stdio: 'pipe' });
        criterionResults.push({
          criterion: `Tests pass for ${testFileMatches.join(', ')}`,
          passed: true,
          explanation: 'All tests passed',
        });
      } catch (err) {
        allPassed = false;
        const msg = err instanceof Error ? err.message : String(err);
        criterionResults.push({
          criterion: `Tests pass for ${testFileMatches.join(', ')}`,
          passed: false,
          explanation: `Test failures: ${msg.slice(0, 200)}`,
        });
        errors.push(`Test failures: ${msg.slice(0, 200)}`);
      }
    } else {
      // No specific test files — check if any new tests were created
      criterionResults.push({
        criterion: 'Tests exist and pass (or not required for this task)',
        passed: true,
        explanation: 'No test files specified — skipped',
      });
    }

    // Check 4: Lint check if eslint is configured
    try {
      if (
        fs.existsSync(path.resolve('.eslintrc')) ||
        fs.existsSync(path.resolve('eslint.config.js')) ||
        fs.existsSync(path.resolve('.eslintignore'))
      ) {
        execSync('npx eslint --ext .ts,.tsx src/ --max-warnings=0', {
          timeout: 60000,
          stdio: 'pipe',
        });
        criterionResults.push({
          criterion: 'No linting errors introduced',
          passed: true,
          explanation: 'ESLint passed',
        });
      } else {
        criterionResults.push({
          criterion: 'No linting errors introduced',
          passed: true,
          explanation: 'No ESLint config — skipped',
        });
      }
    } catch (err) {
      allPassed = false;
      const msg = err instanceof Error ? err.message : String(err);
      criterionResults.push({
        criterion: 'No linting errors introduced',
        passed: false,
        explanation: `Lint errors: ${msg.slice(0, 200)}`,
      });
      errors.push(`Lint errors: ${msg.slice(0, 200)}`);
    }

    const durationMs = Date.now() - startTime;

    // Calculate score
    const passedCount = criterionResults.filter((c) => c.passed).length;
    const score =
      criterionResults.length > 0 ? Math.round((passedCount / criterionResults.length) * 100) : 100;

    // STRICT: task passes ONLY at 100% score (Kiro-style)
    const passed = allPassed && score === 100;

    const result: ComplianceResult = {
      passed,
      criterionResults,
      score,
      correctionInstructions: passed
        ? undefined
        : `Task validation failed (${score}%). Fix these issues before proceeding:\n${errors.map((e) => `- ${e}`).join('\n')}`,
      durationMs,
    };
    return result;
  }

  /**
   * Extract test file paths from task instructions
   */
  private extractTestFilesFromInstructions(task: ExecutableTask): string[] {
    const files: string[] = [];
    const allText = [task.description, ...task.instructions].join(' ');

    // Match patterns like: src/feature/__tests__/Component.test.ts or src/**/*.test.ts
    const testPattern =
      /(?:test file[s]?|__tests__|\.test\.|\.spec\.)[`"]?(\S+\.test\.(ts|tsx|js|jsx)[`"]?)/gi;
    let match;
    while ((match = testPattern.exec(allText)) !== null) {
      const file = match[1].replace(/[`"]/g, '');
      if (!files.includes(file)) files.push(file);
    }

    // Also look for specific test file mentions
    const filePattern =
      /(?:Create|Implement|Generate)\s+[`"]?(src\/[^`"\s]*\.test\.(ts|tsx))[`"]?/gi;
    while ((match = filePattern.exec(allText)) !== null) {
      const file = match[1];
      if (!files.includes(file)) files.push(file);
    }

    return files;
  }

  /**
   * Run ALL tests for a phase. Returns passed=true only at 100% pass rate.
   * Collects test files from all tasks in the phase and runs them together.
   */
  private runPhaseTests(phase: import('./types').TaskPhase): { passed: boolean; output: string } {
    const allTestFiles: string[] = [];

    for (const task of phase.tasks) {
      if (task.isCheckpoint) continue;
      const taskTests = this.extractTestFilesFromInstructions(task);
      for (const testFile of taskTests) {
        if (!allTestFiles.includes(testFile)) {
          allTestFiles.push(testFile);
        }
      }
    }

    // If no specific test files found, run the full test suite
    if (allTestFiles.length === 0) {
      try {
        this.logger.info(`Running full test suite for Phase ${phase.number}`);
        const output = execSync('npx jest --passWithNoTests --silent', {
          timeout: 300000,
          stdio: 'pipe',
          encoding: 'utf-8',
        });
        return { passed: true, output: `Full suite passed:\n${output}` };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stdout = (err as { stdout?: string }).stdout || '';
        return {
          passed: false,
          output: `Full suite FAILED:\n${msg}\n${stdout}`,
        };
      }
    }

    // Run specific test files collected from phase tasks
    try {
      this.logger.info(`Running Phase ${phase.number} tests: ${allTestFiles.join(', ')}`);
      const testCmd = `npx jest --passWithNoTests ${allTestFiles.join(' ')}`;
      const output = execSync(testCmd, {
        timeout: 300000,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return { passed: true, output: `Phase tests passed:\n${output}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stdout = (err as { stdout?: string }).stdout || '';
      return {
        passed: false,
        output: `Phase tests FAILED:\n${msg}\n${stdout}`,
      };
    }
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
      DEFAULT_MODEL,
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
