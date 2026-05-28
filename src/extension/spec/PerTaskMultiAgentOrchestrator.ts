/**
 * PerTaskMultiAgentOrchestrator
 *
 * Executes each task using a 5-agent pipeline with context management:
 * 1. Explorer - Analyzes existing code, dependencies, current state
 * 2. Implementer - Writes/modifies code based on Explorer findings
 * 3. Verifier - Checks against requirements.md + design.md
 * 4. Tester - Runs tests, diagnoses errors
 * 5. Reviewer - Final quality gate, security, performance
 *
 * Uses ContextManager to prevent context overflow:
 * - Sliding window: keeps only last 10 messages
 * - Result caching: stores results in files, not in context
 * - Smart compression: truncates large messages
 */

import { ExecutableTask, SpecContext } from './types';
import { ContextManager } from './ContextManager';

export interface AgentResult {
  agentName: string;
  success: boolean;
  summary: string;
  findings?: string[];
  errors?: string[];
  artifacts?: string[];
  nextAgentPrompt?: string;
}

export interface TaskExecutionPipeline {
  taskId: string;
  taskDescription: string;
  results: AgentResult[];
  finalStatus: 'success' | 'failed';
  totalDurationMs: number;
}

/**
 * Orchestrates the 5-agent pipeline for a single task
 */
export class PerTaskMultiAgentOrchestrator {
  private contextManager: ContextManager;

  constructor(workspaceRoot?: string) {
    this.contextManager = new ContextManager(workspaceRoot || process.cwd());
  }
  /**
   * Execute a task using the 5-agent pipeline
   *
   * @param task - The task to execute
   * @param specContext - Full spec context (requirements, design, etc.)
   * @param agentLoop - The AgentLoop instance to use for each agent
   * @returns Pipeline execution result
   */
  public async executeTaskWithMultiAgents(
    task: ExecutableTask,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<TaskExecutionPipeline> {
    const startTime = Date.now();
    const results: AgentResult[] = [];

    // Phase 1: Explorer Agent
    const explorerResult = await this.runExplorerAgent(task, specContext, agentLoop);
    results.push(explorerResult);

    // Cache explorer result to prevent context overflow
    if (explorerResult.success) {
      const cached = this.contextManager.cacheAgentResult('Explorer', task.id, {
        summary: explorerResult.summary,
        findings: explorerResult.findings,
      });
      explorerResult.nextAgentPrompt = this.contextManager.summarizeResult(cached);
    }

    if (!explorerResult.success) {
      return {
        taskId: task.id,
        taskDescription: task.description,
        results,
        finalStatus: 'failed',
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Phase 2: Implementer Agent
    const implementerResult = await this.runImplementerAgent(
      task,
      specContext,
      agentLoop,
      explorerResult
    );
    results.push(implementerResult);

    // Cache implementer result
    if (implementerResult.success) {
      const cached = this.contextManager.cacheAgentResult('Implementer', task.id, {
        summary: implementerResult.summary,
        artifacts: implementerResult.artifacts,
      });
      implementerResult.nextAgentPrompt = this.contextManager.summarizeResult(cached);
    }

    if (!implementerResult.success) {
      return {
        taskId: task.id,
        taskDescription: task.description,
        results,
        finalStatus: 'failed',
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Phase 3: Verifier Agent
    const verifierResult = await this.runVerifierAgent(
      task,
      specContext,
      agentLoop,
      implementerResult
    );
    results.push(verifierResult);

    // Cache verifier result
    if (verifierResult.success) {
      const cached = this.contextManager.cacheAgentResult('Verifier', task.id, {
        summary: verifierResult.summary,
        findings: verifierResult.findings,
      });
      verifierResult.nextAgentPrompt = this.contextManager.summarizeResult(cached);
    }

    if (!verifierResult.success) {
      return {
        taskId: task.id,
        taskDescription: task.description,
        results,
        finalStatus: 'failed',
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Phase 4: Tester Agent
    const testerResult = await this.runTesterAgent(task, specContext, agentLoop, verifierResult);
    results.push(testerResult);

    // Cache tester result
    if (testerResult.success) {
      const cached = this.contextManager.cacheAgentResult('Tester', task.id, {
        summary: testerResult.summary,
        findings: testerResult.findings,
      });
      testerResult.nextAgentPrompt = this.contextManager.summarizeResult(cached);
    }

    if (!testerResult.success) {
      return {
        taskId: task.id,
        taskDescription: task.description,
        results,
        finalStatus: 'failed',
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Phase 5: Reviewer Agent
    const reviewerResult = await this.runReviewerAgent(task, specContext, agentLoop, testerResult);
    results.push(reviewerResult);

    // Cache reviewer result
    if (reviewerResult.success) {
      const cached = this.contextManager.cacheAgentResult('Reviewer', task.id, {
        summary: reviewerResult.summary,
        findings: reviewerResult.findings,
      });
      reviewerResult.nextAgentPrompt = this.contextManager.summarizeResult(cached);
    }

    // Clean old cache files
    this.contextManager.cleanOldCache();

    const finalStatus = reviewerResult.success ? 'success' : 'failed';

    return {
      taskId: task.id,
      taskDescription: task.description,
      results,
      finalStatus,
      totalDurationMs: Date.now() - startTime,
    };
  }
      task,
      specContext,
      agentLoop,
      implementerResult
    );
    results.push(verifierResult);

    if (!verifierResult.success) {
      return {
        taskId: task.id,
        taskDescription: task.description,
        results,
        finalStatus: 'failed',
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Phase 4: Tester Agent
    const testerResult = await this.runTesterAgent(task, specContext, agentLoop, verifierResult);
    results.push(testerResult);

    if (!testerResult.success) {
      return {
        taskId: task.id,
        taskDescription: task.description,
        results,
        finalStatus: 'failed',
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Phase 5: Reviewer Agent
    const reviewerResult = await this.runReviewerAgent(task, specContext, agentLoop, testerResult);
    results.push(reviewerResult);

    const finalStatus = reviewerResult.success ? 'success' : 'failed';

    return {
      taskId: task.id,
      taskDescription: task.description,
      results,
      finalStatus,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Phase 1: Explorer Agent
   * Analyzes what exists, dependencies, current state
   */
  private async runExplorerAgent(
    task: ExecutableTask,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<AgentResult> {
    const prompt = `
# EXPLORER AGENT - Task ${task.id}

Your job: Analyze what exists in the codebase for this task.

## Task
${task.description}

## What to check:
1. What files/components already exist related to this task?
2. What dependencies are needed?
3. What's the current state of the codebase?
4. What needs to be created vs. modified?
5. Are there any blockers or prerequisites?

## Requirements this task implements:
${specContext.spec.requirements
  .filter((r) => task.requirementIds.includes(r.id))
  .map((r) => `- ${r.title}: ${r.description}`)
  .join('\n')}

## Design guidance:
${specContext.spec.design || 'No design document available'}

## Output format:
Provide a JSON response with:
{
  "filesExist": ["path/to/file1.ts", "path/to/file2.ts"],
  "filesToCreate": ["path/to/new/file.ts"],
  "filesToModify": ["path/to/existing/file.ts"],
  "dependencies": ["dependency1", "dependency2"],
  "blockers": ["blocker1", "blocker2"],
  "summary": "Brief summary of findings"
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'Explorer');
      return {
        agentName: 'Explorer',
        success: true,
        summary: result.summary || 'Analysis complete',
        findings: result.findings || [],
        nextAgentPrompt: prompt,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        agentName: 'Explorer',
        success: false,
        summary: `Explorer failed: ${errorMsg}`,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Phase 2: Implementer Agent
   * Writes/modifies code based on Explorer findings
   */
  private async runImplementerAgent(
    task: ExecutableTask,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    explorerResult: AgentResult
  ): Promise<AgentResult> {
    const prompt = `
# IMPLEMENTER AGENT - Task ${task.id}

Your job: Write/modify code to implement this task.

## Task
${task.description}

## Explorer's findings:
${explorerResult.summary}

## Requirements:
${specContext.spec.requirements
  .filter((r) => task.requirementIds.includes(r.id))
  .map((r) => `- ${r.title}: ${r.description}`)
  .join('\n')}

## Design:
${specContext.spec.design || 'No design document available'}

## Instructions:
${task.instructions.map((i) => `- ${i}`).join('\n')}

## Expected artifacts:
${task.expectedArtifacts.join('\n')}

## Your job:
1. Create/modify files as needed
2. Follow the design and requirements
3. Write clean, well-documented code
4. Include error handling
5. Add JSDoc comments for public APIs

## Output format:
Provide a JSON response with:
{
  "filesCreated": ["path/to/file1.ts"],
  "filesModified": ["path/to/file2.ts"],
  "summary": "Brief summary of implementation",
  "issues": ["issue1", "issue2"]
}
`;

    try {
      const result = await this.executeAgent(
        agentLoop,
        prompt,
        'Implementer',
        explorerResult.summary
      );
      return {
        agentName: 'Implementer',
        success: true,
        summary: result.summary || 'Implementation complete',
        artifacts: result.artifacts || [],
        nextAgentPrompt: prompt,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        agentName: 'Implementer',
        success: false,
        summary: `Implementer failed: ${errorMsg}`,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Phase 3: Verifier Agent
   * Checks against requirements.md + design.md
   */
  private async runVerifierAgent(
    task: ExecutableTask,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    implementerResult: AgentResult
  ): Promise<AgentResult> {
    const prompt = `
# VERIFIER AGENT - Task ${task.id}

Your job: Verify the implementation meets requirements and design.

## Task
${task.description}

## Implementer's work:
${implementerResult.summary}

## Requirements to verify:
${specContext.spec.requirements
  .filter((r) => task.requirementIds.includes(r.id))
  .map(
    (r) =>
      `- ${r.title}: ${r.description}\n  Acceptance criteria: ${r.acceptanceCriteria.map((c) => c.text).join(', ')}`
  )
  .join('\n')}

## Design to verify against:
${specContext.spec.design || 'No design document available'}

## Your job:
1. Check each requirement is met
2. Verify design is followed
3. Check acceptance criteria
4. Identify any gaps or issues
5. Verify code quality (no console.log, proper error handling, etc.)

## Output format:
Provide a JSON response with:
{
  "requirementsMet": true/false,
  "designFollowed": true/false,
  "acceptanceCriteriaMet": true/false,
  "issues": ["issue1", "issue2"],
  "summary": "Verification result"
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'Verifier');
      const success = result.success !== false;
      return {
        agentName: 'Verifier',
        success,
        summary: result.summary || 'Verification complete',
        findings: result.findings || [],
        errors: result.errors || [],
        nextAgentPrompt: prompt,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        agentName: 'Verifier',
        success: false,
        summary: `Verifier failed: ${errorMsg}`,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Phase 4: Tester Agent
   * Runs tests, diagnoses errors
   */
  private async runTesterAgent(
    task: ExecutableTask,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    verifierResult: AgentResult
  ): Promise<AgentResult> {
    const prompt = `
# TESTER AGENT - Task ${task.id}

Your job: Run tests and diagnose any errors.

## Task
${task.description}

## Verifier's findings:
${verifierResult.summary}

## Test files to run:
${task.expectedArtifacts.filter((a) => a.includes('.test.')).join('\n') || 'No specific test files'}

## Your job:
1. Run TypeScript compilation: npx tsc --noEmit
2. Run ESLint: npx eslint --ext .ts,.tsx src/ --max-warnings=0
3. Run tests: npx jest --passWithNoTests
4. Diagnose any failures
5. Provide clear error messages

## Output format:
Provide a JSON response with:
{
  "compilationPassed": true/false,
  "lintPassed": true/false,
  "testsPassed": true/false,
  "errors": ["error1", "error2"],
  "summary": "Test result"
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'Tester');
      const success = result.success !== false;
      return {
        agentName: 'Tester',
        success,
        summary: result.summary || 'Testing complete',
        findings: result.findings || [],
        errors: result.errors || [],
        nextAgentPrompt: prompt,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        agentName: 'Tester',
        success: false,
        summary: `Tester failed: ${errorMsg}`,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Phase 5: Reviewer Agent
   * Final quality gate, security, performance
   */
  private async runReviewerAgent(
    task: ExecutableTask,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    testerResult: AgentResult
  ): Promise<AgentResult> {
    const prompt = `
# REVIEWER AGENT - Task ${task.id}

Your job: Final quality gate - security, performance, standards.

## Task
${task.description}

## Tester's findings:
${testerResult.summary}

## Review checklist:
1. Security: No hardcoded secrets, proper input validation, SQL injection prevention
2. Performance: No N+1 queries, proper caching, efficient algorithms
3. Code quality: No console.log, proper error handling, clear naming
4. Testing: Adequate test coverage (70%+)
5. Documentation: JSDoc for public APIs, clear comments
6. Standards: Follows AGENTS.md constraints, TypeScript strict mode
7. Accessibility: WCAG 2.1 AA for UI components

## Output format:
Provide a JSON response with:
{
  "securityOK": true/false,
  "performanceOK": true/false,
  "codeQualityOK": true/false,
  "testingOK": true/false,
  "documentationOK": true/false,
  "standardsOK": true/false,
  "accessibilityOK": true/false,
  "issues": ["issue1", "issue2"],
  "summary": "Review result"
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'Reviewer');
      const success = result.success !== false;
      return {
        agentName: 'Reviewer',
        success,
        summary: result.summary || 'Review complete',
        findings: result.findings || [],
        errors: result.errors || [],
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        agentName: 'Reviewer',
        success: false,
        summary: `Reviewer failed: ${errorMsg}`,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Execute a single agent with the given prompt
   * Handles context limit by using handoff mechanism
   */
  private async executeAgent(
    agentLoop: {
      execute: (...args: unknown[]) => Promise<void>;
      isContextLimitReached?: () => boolean;
      getContextSummary?: () => string;
      getLastThreeMessages?: () => any[];
    },
    prompt: string,
    agentName: string,
    previousAgentSummary?: string
  ): Promise<{ success?: boolean; summary?: string; findings?: string[]; errors?: string[] }> {
    // If previous agent hit context limit, use handoff
    let systemPrompt = `You are a ${agentName} agent. Respond with valid JSON only. No markdown, no explanations, just JSON.`;

    if (previousAgentSummary) {
      systemPrompt += `\n\nPrevious agent's work summary:\n${previousAgentSummary}\n\nContinue from where the previous agent left off.`;
    }

    const messages = [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      { role: 'user' as const, content: prompt },
    ];

    let finalContent = '';
    let result: { success?: boolean; summary?: string; findings?: string[]; errors?: string[] } = {
      success: true,
      summary: `${agentName} completed`,
    };

    try {
      await agentLoop.execute(
        messages,
        (update: unknown) => {
          const u = update as { type: string; content?: string; message?: string };
          // Collect content from chunk updates
          if (u.type === 'chunk' && u.content) {
            finalContent += u.content;
          }
          // Handle context limit reached
          if (u.type === 'complete' && u.message?.includes('Context limit')) {
            result.contextLimitReached = true;
            result.contextSummary = agentLoop.getContextSummary?.();
            result.lastThreeMessages = agentLoop.getLastThreeMessages?.();
            return;
          }
          // On complete, parse the final content
          if (u.type === 'complete') {
            if (finalContent.trim().length > 0) {
              try {
                result = JSON.parse(finalContent);
              } catch {
                result = { success: true, summary: finalContent };
              }
            }
          }
        },
        [],
        'default-model',
        {}
      );

      // Check if context limit was reached after execution
      if (agentLoop.isContextLimitReached?.()) {
        const contextSummary = agentLoop.getContextSummary?.();
        const lastThreeMessages = agentLoop.getLastThreeMessages?.();
        result.contextLimitReached = true;
        result.contextSummary = contextSummary;
        result.lastThreeMessages = lastThreeMessages;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // If error is context overflow, mark it as such
      if (errorMsg.includes('Context overflow')) {
        result = {
          success: false,
          errors: [errorMsg],
          contextLimitReached: true,
          contextSummary: agentLoop.getContextSummary?.(),
          lastThreeMessages: agentLoop.getLastThreeMessages?.(),
        };
      } else {
        result = { success: false, errors: [errorMsg] };
      }
    }

    return result;
  }
}
