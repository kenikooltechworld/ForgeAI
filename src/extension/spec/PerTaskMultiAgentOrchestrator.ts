/**
 * PerTaskMultiAgentOrchestrator
 *
 * Executes each task using a multi-agent pipeline.
 * Now supports a specialized Tri-Agent loop for UI/UX tasks:
 * UI/UX Architect (Design) -> Implementer (Code) -> UI/UX Architect (Verify via Browser Mirror)
 *
 * For non-UI tasks, it falls back to the standard 5-agent pipeline.
 */

import { ExecutableTask, SpecContext } from './types';
import { ContextManager } from './ContextManager';
import { UIUXArchitectAgent, UIUXAgentInput, UIUXAgentResult } from '../agents/ui-ux-architect/UIUXArchitectAgent';
import { BrowserMirrorTools } from '../agents/ui-ux-architect/tools/BrowserMirrorTools';
import { ForgeBrowserSession } from '../services/ForgeBrowserSession';

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
 * Orchestrates the agent pipeline for a single task.
 * Integrates UI/UX Architect and Browser Mirror for a closed-loop visual feedback system.
 */
export class PerTaskMultiAgentOrchestrator {
  private contextManager: ContextManager;
  private uiuxAgent: UIUXArchitectAgent | null = null;
  private workspaceRoot: string;

  constructor(
    workspaceRoot?: string,
    toolRegistry?: any,
    ollamaClient?: any,
    logger?: any
  ) {
    this.workspaceRoot = workspaceRoot || process.cwd();
    this.contextManager = new ContextManager(this.workspaceRoot);

    if (toolRegistry && ollamaClient && logger && workspaceRoot) {
      this.uiuxAgent = new UIUXArchitectAgent(toolRegistry, ollamaClient, logger, workspaceRoot);
    }
  }

  /**
   * Execute a task using the multi-agent pipeline.
   */
  public async executeTaskWithMultiAgents(
    task: ExecutableTask,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    browserSession?: ForgeBrowserSession
  ): Promise<TaskExecutionPipeline> {
    const startTime = Date.now();
    const results: AgentResult[] = [];

    const isUITask = this.isUITask(task);
    this.log(`Task ${task.id} identified as ${isUITask ? 'UI' : 'Core Logic'} task.`);

    if (isUITask) {
      // --- TRI-AGENT UI LOOP ---

      // 1. UI/UX Architect: Design Phase
      this.log(`Running UI/UX Design Phase for ${task.id}...`);
      const designResult = await this.runUIUXDesignPhase(task, specContext, browserSession);
      results.push(designResult);

      if (!designResult.success) {
        this.log(`Design Phase FAILED: ${designResult.summary}`);
        return this.failPipeline(task, results, startTime);
      }
      this.log(`Design Phase SUCCESS`);

      // 2. Implementer: Implementation Phase
      this.log(`Running Implementation Phase for ${task.id}...`);
      const implementerResult = await this.runImplementerAgent(
        task,
        specContext,
        agentLoop,
        designResult
      );
      results.push(implementerResult);

      if (!implementerResult.success) {
        this.log(`Implementation Phase FAILED: ${implementerResult.summary}`);
        return this.failPipeline(task, results, startTime);
      }
      this.log(`Implementation Phase SUCCESS`);

      // 3. UI/UX Architect: Visual Verification Phase (Using Browser Mirror)
      this.log(`Running Visual Verification Phase for ${task.id}...`);
      const visualResult = await this.runUIUXVerificationPhase(task, specContext, implementerResult, browserSession);
      results.push(visualResult);

      if (!visualResult.success) {
        this.log(`Visual Verification FAILED: ${visualResult.summary}`);
        return this.failPipeline(task, results, startTime);
      }
      this.log(`Visual Verification SUCCESS`);

      // Final Quality Review
      this.log(`Running Final Review for ${task.id}...`);
      const reviewerResult = await this.runReviewerAgent(task, specContext, agentLoop, visualResult);
      results.push(reviewerResult);

      if (!reviewerResult.success) {
        this.log(`Review Phase FAILED: ${reviewerResult.summary}`);
        return this.failPipeline(task, results, startTime);
      }
      this.log(`Review Phase SUCCESS`);

      return {
        taskId: task.id,
        taskDescription: task.description,
        results,
        finalStatus: 'success',
        totalDurationMs: Date.now() - startTime,
      };

    } else {
      // --- STANDARD 5-AGENT PIPELINE ---
      const explorerResult = await this.runExplorerAgent(task, specContext, agentLoop);
      results.push(explorerResult);
      if (!explorerResult.success) return this.failPipeline(task, results, startTime);

      const implementerResult = await this.runImplementerAgent(task, specContext, agentLoop, explorerResult);
      results.push(implementerResult);
      if (!implementerResult.success) return this.failPipeline(task, results, startTime);

      const verifierResult = await this.runVerifierAgent(task, specContext, agentLoop, implementerResult);
      results.push(verifierResult);
      if (!verifierResult.success) return this.failPipeline(task, results, startTime);

      const testerResult = await this.runTesterAgent(task, specContext, agentLoop, verifierResult);
      results.push(testerResult);
      if (!testerResult.success) return this.failPipeline(task, results, startTime);

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
  }

  private isUITask(task: ExecutableTask): boolean {
    const uiKeywords = ['ui', 'ux', 'layout', 'component', 'css', 'style', 'color', 'button', 'modal', 'page', 'view', 'frontend', 'visual', 'design'];
    const text = (task.description + ' ' + task.instructions.join(' ')).toLowerCase();
    return uiKeywords.some(keyword => text.includes(keyword));
  }

  private async runUIUXDesignPhase(
    task: ExecutableTask,
    specContext: SpecContext,
    browserSession?: ForgeBrowserSession
  ): Promise<AgentResult> {
    if (!this.uiuxAgent) {
      return {
        agentName: 'UI/UX Architect',
        success: false,
        summary: 'UI/UX Architect agent not initialized.',
        errors: ['Agent missing'],
      };
    }

    const request = `Design the UI/UX for task ${task.id}: ${task.description}.
    Instructions: ${task.instructions.join(' ')}.
    Requirements: ${specContext.spec.requirements.filter(r => task.requirementIds.includes(r.id)).map(r => r.title).join(', ')}`;

    const result = await this.uiuxAgent.execute({
      request,
      workspaceRoot: this.workspaceRoot,
      browserSession,
    });

    if (result.success && result.artifacts?.designSystem) {
      task.uxSpec = {
        expectedElements: [],
        visualRules: [],
        componentSpecs: result.artifacts,
      };
    }

    return {
      agentName: 'UI/UX Architect',
      success: result.success,
      summary: result.response,
      findings: result.artifacts ? [result.artifacts.designSystem || 'Tokens generated'] : [],
      errors: result.error ? [result.error] : [],
    };
  }

  private async runUIUXVerificationPhase(
    task: ExecutableTask,
    specContext: SpecContext,
    implementerResult: AgentResult,
    browserSession?: ForgeBrowserSession
  ): Promise<AgentResult> {
    if (!this.uiuxAgent) {
      return {
        agentName: 'UI/UX Architect (Verification)',
        success: false,
        summary: 'UI/UX Architect agent not initialized.',
        errors: ['Agent missing'],
      };
    }

    if (!browserSession) {
      return {
        agentName: 'UI/UX Architect (Verification)',
        success: false,
        summary: 'Browser session not available for visual verification.',
        errors: ['No active browser session'],
      };
    }

    const mirrorTools = new BrowserMirrorTools(browserSession);

    // 1. Gather visual and semantic evidence
    const semanticsResult = await mirrorTools.getSemanticSnapshot().execute({});
    const screenshotResult = await mirrorTools.takeScreenshot().execute({});

    const evidence = {
      semantics: semanticsResult.success ? semanticsResult.response : 'Could not capture semantics',
      screenshot: screenshotResult.success ? 'Screenshot captured' : 'Screenshot failed',
    };

    const request = `Verify the implementation of Task ${task.id}: ${task.description}.

    Implementation Summary: ${implementerResult.summary}

    Semantic Snapshot:
    ${evidence.semantics}

    Please analyze if the structural and visual implementation matches the design requirements.
    If it does not match, explain why and provide a "Verdict: FAIL" with correction instructions.
    If it matches, provide "Verdict: PASS".`;

    const result = await this.uiuxAgent.execute({
      request,
      workspaceRoot: this.workspaceRoot,
      browserSession,
    });

    const success = result.response.toLowerCase().includes('verdict: pass');

    return {
      agentName: 'UI/UX Architect (Verification)',
      success,
      summary: result.response,
      findings: result.artifacts ? [result.artifacts.designSystem || 'Verification performed'] : [],
      errors: success ? [] : ['Visual/Structural mismatch detected'],
    };
  }

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
  .join('\\n')}

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

    return this.executeGenericAgent(agentLoop, prompt, 'Explorer');
  }

  private async runImplementerAgent(
    task: ExecutableTask,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    previousResult: AgentResult
  ): Promise<AgentResult> {
    const prompt = `
# IMPLEMENTER AGENT - Task ${task.id}

Your job: Write/modify code to implement this task. VERIFY no errors are introduced.

## Task
${task.description}

## Explorer/Architect's findings:
${previousResult.summary}

## Requirements:
${specContext.spec.requirements
  .filter((r) => task.requirementIds.includes(r.id))
  .map((r) => `- ${r.title}: ${r.description}`)
  .join('\\n')}

## Design:
${specContext.spec.design || 'No design document available'}

## Instructions:
${task.instructions.map((i) => `- ${i}`).join('\\n')}

## Expected artifacts:
${task.expectedArtifacts.join('\\n')}

## 🚨 ERROR PREVENTION PROTOCOL 🚨

After writing/modifying code:
1. **VERIFY** TypeScript compilation: npx tsc --noEmit
   - If errors: FIX them immediately
   - Do NOT move forward with TypeScript errors

2. **VERIFY** ESLint: npx eslint --ext .ts,.tsx src/ --max-warnings=0
   - If errors: FIX them immediately
   - Do NOT move forward with linting errors

3. **VERIFY** imports and exports are correct
   - Check all imports resolve
   - Check all exports are used

If ANY errors are found, fix them BEFORE reporting success.

## Your job:
1. Create/modify files as needed
2. Follow the design and requirements
3. Write clean, well-documented code
4. Include error handling
5. Add JSDoc comments for public APIs
6. RUN TypeScript compilation to verify no errors
7. RUN ESLint to verify no linting errors
8. FIX any errors found
9. ONLY THEN report success

## Output format:
Provide a JSON response with:
{
  "filesCreated": ["path/to/file1.ts"],
  "filesModified": ["path/to/file2.ts"],
  "compilationPassed": true/false,
  "lintPassed": true/false,
  "errors": ["error1", "error2"],
  "summary": "Implementation complete with verification"
}
`;

    return this.executeGenericAgent(agentLoop, prompt, 'Implementer', previousResult.summary);
  }

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
      `- ${r.title}: ${r.description}\\n  Acceptance criteria: ${r.acceptanceCriteria.map((c) => c.text).join(', ')}`
  )
  .join('\\n')}

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

    return this.executeGenericAgent(agentLoop, prompt, 'Verifier');
  }

  private async runTesterAgent(
    task: ExecutableTask,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    verifierResult: AgentResult
  ): Promise<AgentResult> {
    const prompt = `
# TESTER AGENT - Task ${task.id}

Your job: Run tests and DIAGNOSE ALL ERRORS. Errors are #1 priority.

## Task
${task.description}

## Verifier's findings:
${verifierResult.summary}

## Test files to run:
${task.expectedArtifacts.filter((a) => a.includes('.test.')).join('\\n') || 'No specific test files'}

## 🚨 ERROR RESOLUTION PROTOCOL 🚨

When you encounter ANY error:
1. **READ** the error message completely
2. **UNDERSTAND** what went wrong and where (file, line, function)
3. **ANALYZE** the root cause
4. **FIND** the solution
5. **APPLY** the fix to the code
6. **VERIFY** by running the test again
7. **REPEAT** until all errors are resolved

NEVER move forward with unresolved errors.
NEVER ignore error messages.
NEVER run the same command twice without fixing the problem.

## Your job:
1. Run TypeScript compilation: npx tsc --noEmit
   - If errors: STOP and diagnose each one
   - Fix the TypeScript errors
   - Re-run until zero errors

2. Run ESLint: npx eslint --ext .ts,.tsx src/ --max-warnings=0
   - If errors: STOP and diagnose each one
   - Fix the linting errors
   - Re-run until zero errors

3. Run tests: npx jest --passWithNoTests
   - If failures: STOP and diagnose each one
   - Fix the failing tests
   - Re-run until all pass

## Output format:
Provide a JSON response with:
{
  "compilationPassed": true/false,
  "compilationErrors": ["error1", "error2"],
  "lintPassed": true/false,
  "lintErrors": ["error1", "error2"],
  "testsPassed": true/false,
  "testFailures": ["failure1", "failure2"],
  "allErrorsResolved": true/false,
  "summary": "Detailed summary of all errors found and how they were fixed"
}
`;

    return this.executeGenericAgent(agentLoop, prompt, 'Tester');
  }

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

    return this.executeGenericAgent(agentLoop, prompt, 'Reviewer');
  }

  private async executeGenericAgent(
    agentLoop: {
      execute: (...args: unknown[]) => Promise<void>;
      isContextLimitReached?: () => boolean;
      getContextSummary?: () => string;
      getLastThreeMessages?: () => any[];
    },
    prompt: string,
    agentName: string,
    previousAgentSummary?: string
  ): Promise<AgentResult> {
    let finalContent = '';
    let result: any = { success: true, summary: `${agentName} completed` };

    try {
      await agentLoop.execute(
        [
          { role: 'system' as const, content: `You are a ${agentName} agent. Respond with valid JSON only. No markdown, no explanations, just JSON.` },
          { role: 'user' as const, content: prompt },
        ],
        (update: any) => {
          if (update.type === 'chunk' && update.content) finalContent += update.content;
          if (update.type === 'complete' && finalContent.trim().length > 0) {
            try { result = { ...result, ...JSON.parse(finalContent) }; } catch { result = { ...result, summary: finalContent }; }
          }
        },
        [],
        'default-model',
        {}
      );
    } catch (err) {
      return { agentName, success: false, summary: `${agentName} failed: ${err}`, errors: [String(err)] };
    }

    return {
      agentName,
      success: result.success !== false,
      summary: result.summary || 'Completed',
      findings: result.findings || [],
      errors: result.errors || [],
    };
  }

  private failPipeline(task: ExecutableTask, results: AgentResult[], startTime: number): TaskExecutionPipeline {
    return {
      taskId: task.id,
      taskDescription: task.description,
      results,
      finalStatus: 'failed',
      totalDurationMs: Date.now() - startTime,
    };
  }

  private log(msg: string) {
    console.log(`[PerTaskMultiAgentOrchestrator] ${msg}`);
  }
}
