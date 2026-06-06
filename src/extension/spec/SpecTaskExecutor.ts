/**
 * SpecTaskExecutor — Sequential task runner that replaces the LangGraph orchestrator
 *
 * Core principle: Read the spec, execute tasks one by one, verify, repeat.
 * No recursion limits. No graph transitions. Just: task → execute → verify → next.
 * Now includes UI/UX validation via Browser Mirror.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { SpecReader } from './SpecReader';
import { PerTaskMultiAgentOrchestrator } from './PerTaskMultiAgentOrchestrator';
import { BugFixOrchestrator, BugFixResult } from './BugFixOrchestrator';
import { UXSpecValidator, UXValidationResult } from './UXSpecValidator';
import { HITLHandoffManager } from './HITLHandoffManager';
import { BrowserMirrorStream } from './BrowserMirrorStream';
import { VisualQAAgent } from '../agents/visual-qa/VisualQAAgent';
import { Logger } from '../utils/Logger';
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  info(_msg: string) {
    // Suppressed — only errors and warnings are logged in production
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
  private readonly multiAgentOrchestrator: PerTaskMultiAgentOrchestrator;
  private readonly bugFixOrchestrator: BugFixOrchestrator;
  private readonly uxValidator: UXSpecValidator;
  private readonly hitlManager: HITLHandoffManager | null;
  private readonly visualQAAgent: VisualQAAgent | null;
  private isRunning = false;
  private shouldStop = false;
  private browserMirror?: BrowserMirrorStream;

  constructor(
    orchestrator?: PerTaskMultiAgentOrchestrator,
    hitlManager?: HITLHandoffManager,
    workspaceRoot?: string,
    ollamaClient?: any,
    logger?: Logger
  ) {
    this.logger = (logger as unknown as TaskLogger) || new TaskLogger('SpecTaskExecutor');
    this.specReader = new SpecReader();
    this.multiAgentOrchestrator = orchestrator || new PerTaskMultiAgentOrchestrator();
    this.bugFixOrchestrator = new BugFixOrchestrator();
    this.hitlManager = hitlManager || null;
    this.uxValidator = new UXSpecValidator(workspaceRoot || process.cwd());
    this.visualQAAgent = ollamaClient && workspaceRoot
      ? new VisualQAAgent(ollamaClient, this.logger as unknown as Logger, workspaceRoot)
      : null;
  }

  /**
   * Execute a spec from start to finish (or until stopped)
   *
   * @param specDir — Path to spec directory
   * @param agentLoop — The AgentLoop instance to use for task execution
   * @param options — Execution options (checkpoints, retries, callbacks)
   * @param browserSession — The active browser session for visual verification
   */
  public async executeSpec(
    specDir: string,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    options: Partial<SpecExecutionOptions> = {},
    browserSession?: any,
    ollamaClient?: any,
    logger?: Logger
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

    // Start browser mirror if a browser session is provided
    if (browserSession) {
      try {
        this.browserMirror = new BrowserMirrorStream(
          { extensionUri: { fsPath: specDir } } as any,
          specDir,
          browserSession,
          ollamaClient,
          logger
        );
        await this.browserMirror.open('about:blank');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[SpecTaskExecutor] Browser mirror failed to start: ${msg}`);
      }
    }

    // Parse the spec
    const spec = await this.specReader.parseSpecDirectory(specDir);
    console.log(`[SpecTaskExecutor] Parsed spec ${spec.id} with ${spec.tasks.length} tasks`);
    this.logger.info(
      `Starting spec execution: ${spec.id} (${spec.tasks.length} tasks, ${spec.progress}% already complete)`
    );

    // Build spec context (will be injected into every task)
    const specContext = this.buildSpecContext(spec, specDir);

    let completed = spec.completedCount;
    let failed = spec.failedCount;

    try {
      while (!this.shouldStop) {
        console.log(`[SpecTaskExecutor] Loop iteration: shouldStop=${this.shouldStop}`);
        // Get next ready task
        const nextTask = this.specReader.getNextTask(spec);
        if (!nextTask) {
          console.log(`[SpecTaskExecutor] No next task found. Breaking loop.`);
          break;
        }
        console.log(`[SpecTaskExecutor] Found next task: ${nextTask.id}`);

        // Apply taskFilter if provided — skip tasks that don't match
        if (opts.taskFilter && !opts.taskFilter(nextTask)) {
          // Mark as skipped so getNextTask doesn't return it again
          nextTask.status = 'skipped';
          continue;
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
        const result = await this.executeTask(nextTask, specContext, agentLoop, opts, browserSession);

        if (result.passed) {
          nextTask.status = 'complete';
          nextTask.completedAt = Date.now();
          completed++;
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

          if (opts.onTaskFail) {
            opts.onTaskFail(nextTask, nextTask.error);
          }

          if (!opts.continueOnFailure) {
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

      if (this.browserMirror) {
        try {
          this.browserMirror.dispose();
        } catch {
          // ignore cleanup errors
        }
        this.browserMirror = undefined;
      }
    }

    this.logger.info(
      `Spec execution finished: ${completed}/${spec.tasks.length} completed, ${failed} failed, ${spec.progress}%`
    );
    return { spec, completed, failed };
  }

  /**
   * Execute a single task using the multi-agent pipeline
   * If task fails, use BugFixOrchestrator to diagnose and fix
   *
   * @param task — The task to execute
   * @param specContext — Full spec context injected into system prompt
   * @param agentLoop — AgentLoop instance
   * @param options — Execution options
   * @param browserSession — Optional browser session for visual verification
   */
  public async executeTask(
    task: ExecutableTask,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    _options: SpecExecutionOptions,
    browserSession?: any
  ): Promise<ComplianceResult> {
    console.log(`[SpecTaskExecutor] Entering executeTask for ${task.id}`);
    this.logger.info(`Executing task ${task.id}: ${task.description}`);
    task.status = 'in_progress';
    task.startedAt = Date.now();

    try {
      // Execute task using the multi-agent pipeline (now including UI/UX and Browser Mirror)
      const pipelineResult = await this.multiAgentOrchestrator.executeTaskWithMultiAgents(
        task,
        specContext,
        agentLoop,
        browserSession
      );

      // Check if all agents succeeded
      if (pipelineResult.finalStatus === 'success') {
        const complianceResult = await this.verifyCompliance(task, pipelineResult, specContext);

        // Run Visual QA after compliance if browser mirror is available
        if (complianceResult.passed && this.browserMirror) {
          const visualDefects = await this.browserMirror.runVisualQA();
          if (visualDefects.length > 0) {
            complianceResult.passed = false;
            complianceResult.score = Math.max(0, complianceResult.score - 20);
            complianceResult.correctionInstructions =
              (complianceResult.correctionInstructions || '') +
              '\nVisual QA issues:\n' +
              visualDefects.map((d) => `- [${d.type}] ${d.description}`).join('\n');
          }
        }

        // If compliance check fails, try to fix it
        if (!complianceResult.passed && task.retryCount < task.maxRetries) {
          this.logger.warn(
            `Task ${task.id} failed compliance check. Attempting bug fix (attempt ${task.retryCount + 1}/${task.maxRetries})`
          );

          task.retryCount++;
          const bugFixResult = await this.bugFixOrchestrator.fixFailedTask(
            task,
            complianceResult.correctionInstructions || 'Compliance check failed',
            specContext,
            agentLoop,
            task.retryCount,
            task.maxRetries
          );

          if (bugFixResult.success) {
            this.logger.info(`Bug fix successful for task ${task.id}. Retrying compliance check.`);
            // Re-verify after fix
            return await this.verifyCompliance(task, pipelineResult, specContext);
          } else {
            this.logger.error(`Bug fix failed for task ${task.id}: ${bugFixResult.diagnosis}`);
            return complianceResult;
          }
        }

        return complianceResult;
      } else {
        // Pipeline failed — try bug fix
        const failedAgent = pipelineResult.results.find((r) => !r.success);
        const errorMsg = failedAgent
          ? `${failedAgent.agentName} agent failed: ${failedAgent.summary}`
          : 'Multi-agent pipeline failed';

        if (task.retryCount < task.maxRetries) {
          this.logger.warn(
            `Task ${task.id} pipeline failed. Attempting bug fix (attempt ${task.retryCount + 1}/${task.maxRetries})`
          );

          task.retryCount++;
          const bugFixResult = await this.bugFixOrchestrator.fixFailedTask(
            task,
            errorMsg,
            specContext,
            agentLoop,
            task.retryCount,
            task.maxRetries
          );

          if (bugFixResult.success) {
            this.logger.info(`Bug fix successful for task ${task.id}. Retrying pipeline.`);
            // Retry the entire task
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return this.executeTask(task, specContext, agentLoop, _options, browserSession);
          } else {
            this.logger.error(`Bug fix failed for task ${task.id}: ${bugFixResult.diagnosis}`);
          }
        }

        return {
          passed: false,
          criterionResults: [
            {
              criterion: 'Multi-agent pipeline execution',
              passed: false,
              explanation: errorMsg,
            },
          ],
          score: 0,
          correctionInstructions: errorMsg,
          durationMs: pipelineResult.totalDurationMs,
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Try bug fix on exception
      if (task.retryCount < task.maxRetries) {
        this.logger.warn(
          `Task ${task.id} threw exception. Attempting bug fix (attempt ${task.retryCount + 1}/${task.maxRetries})`
        );

        task.retryCount++;
        const bugFixResult = await this.bugFixOrchestrator.fixFailedTask(
          task,
          errorMsg,
          specContext,
          agentLoop,
          task.retryCount,
          task.maxRetries
        );

        if (bugFixResult.success) {
          this.logger.info(`Bug fix successful for task ${task.id}. Retrying.`);
          return this.executeTask(task, specContext, agentLoop, {} as SpecExecutionOptions, browserSession);
        }
      }

      return {
        passed: false,
        criterionResults: [],
        score: 0,
        correctionInstructions: `Execution error: ${errorMsg}`,
        durationMs: 0,
      };
    }
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
   * Now includes UI/UX visual validation via Browser Mirror.
   */
  private async verifyCompliance(
    task: ExecutableTask,
    _executionResult: unknown,
    _context: SpecContext
  ): Promise<ComplianceResult> {
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

    // Check 2: UI/UX Validation (for UI tasks with browser session)
    if (task.uxSpec && this.browserMirror) {
      const uxResult = await this.validateUX(task, _context);
      if (!uxResult.passed) {
        allPassed = false;
        const uxErrors = uxResult.correctionInstructions || 'UI/UX validation failed';
        criterionResults.push({
          criterion: 'UI/UX visual and semantic validation',
          passed: false,
          explanation: uxErrors,
        });
        errors.push(uxErrors);
      } else {
        criterionResults.push({
          criterion: 'UI/UX visual and semantic validation',
          passed: true,
          explanation: 'UI/UX validation passed',
        });
      }
    }

    // Check 3: TypeScript compilation (zero errors required)
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

    // Check 4: Run tests if test files are specified in instructions
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

// Check 5: Lint check if eslint is configured
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
   * Stop execution gracefully
   */
  public stop(): void {
    this.shouldStop = true;
  }

  /**
   * Check if executor is currently running
   */
  public isCurrentlyRunning(): boolean {
    return this.isRunning;
  }

  private async validateUX(task: ExecutableTask, context: SpecContext, browserSession?: any): Promise<UXValidationResult> {
    if (!task.uxSpec) {
      return { passed: true, score: 100, visualDefects: [], semanticIssues: [], contrastViolations: [], layoutIssues: [], accessibilityIssues: [] };
    }

    if (!browserSession) {
      return {
        passed: false,
        score: 0,
        visualDefects: ['No browser session available'],
        semanticIssues: [],
        contrastViolations: [],
        layoutIssues: [],
        accessibilityIssues: [],
        correctionInstructions: 'Browser session not available for UX validation. Start Browser Mirror first.'
      };
    }

    try {
      const result = await this.uxValidator.validate(task, context, browserSession);
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        passed: false,
        score: 0,
        visualDefects: [msg],
        semanticIssues: [],
        contrastViolations: [],
        layoutIssues: [],
        accessibilityIssues: [],
        correctionInstructions: `UX validation error: ${msg}`
      };
    }
  }

  /**
   * Handle HITL handoff when task fails repeatedly
   */
  private async handleHITLHandoff(
    task: ExecutableTask,
    error: string,
    retryAttempt: number
  ): Promise<boolean> {
    if (!this.hitlManager) return false;

    if (retryAttempt >= task.maxRetries) {
      const result = await this.hitlManager!.requestAssistance(
        task,
        'validation-failure',
        `Task ${task.id} failed after ${retryAttempt} attempts: ${error}`,
        {
          whatAIWasTrying: `Complete task: ${task.description}`,
          whatWentWrong: error,
          whatIsNeeded: 'User guidance on how to proceed',
          attemptedFixes: [],
          suggestions: [
            { title: 'Try a different approach', description: 'Let AI attempt a different implementation strategy' },
            { title: 'Skip this task', description: 'Mark task as skipped and continue' },
            { title: 'Review the spec requirements', description: 'User reviews and updates requirements.md' },
          ],
        }
      );
      return result !== null;
    }
    return false;
  }
}
