/**
 * BugFixOrchestrator
 *
 * Handles error recovery and bug fixing during task execution.
 * When a task fails, this orchestrator:
 * 1. Diagnoses the error
 * 2. Generates a fix
 * 3. Verifies the fix works
 * 4. Retries the task
 *
 * Separate from the normal 5-agent pipeline — only triggered on failure.
 */

import { ExecutableTask, SpecContext } from './types';

export interface BugFixResult {
  success: boolean;
  diagnosis: string;
  fixApplied: string;
  verificationResult: string;
  retryAttempt: number;
  maxRetries: number;
}

/**
 * Orchestrates bug fixing and error recovery
 */
export class BugFixOrchestrator {
  /**
   * Execute bug fix workflow when a task fails
   *
   * @param task - The failed task
   * @param error - The error message
   * @param specContext - Full spec context
   * @param agentLoop - The AgentLoop instance
   * @param retryAttempt - Current retry attempt number
   * @param maxRetries - Maximum retries allowed
   * @returns BugFixResult with success status and details
   */
  public async fixFailedTask(
    task: ExecutableTask,
    error: string,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    retryAttempt: number,
    maxRetries: number
  ): Promise<BugFixResult> {
    // Phase 1: Diagnose the error
    const diagnosis = await this.diagnoseError(task, error, specContext, agentLoop);

    if (!diagnosis.success) {
      return {
        success: false,
        diagnosis: diagnosis.summary,
        fixApplied: 'None — diagnosis failed',
        verificationResult: 'N/A',
        retryAttempt,
        maxRetries,
      };
    }

    // Phase 2: Generate and apply fix
    const fixResult = await this.generateAndApplyFix(task, diagnosis, specContext, agentLoop);

    if (!fixResult.success) {
      return {
        success: false,
        diagnosis: diagnosis.summary,
        fixApplied: fixResult.summary,
        verificationResult: 'Fix application failed',
        retryAttempt,
        maxRetries,
      };
    }

    // Phase 3: Verify the fix works
    const verification = await this.verifyFix(task, specContext, agentLoop);

    return {
      success: verification.success,
      diagnosis: diagnosis.summary,
      fixApplied: fixResult.summary,
      verificationResult: verification.summary,
      retryAttempt,
      maxRetries,
    };
  }

  /**
   * Phase 1: Diagnose the error
   */
  private async diagnoseError(
    task: ExecutableTask,
    error: string,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<{ success: boolean; summary: string; rootCause?: string; suggestions?: string[]; errorType?: string }> {
    const errorType = this.categorizeError(error);
    const recovery = this.getRecoveryStrategy(errorType, error);

    const prompt = `
# ERROR DIAGNOSIS - Task ${task.id}

## Task
${task.description}

## Error Message
${error}

## Error Category
${errorType}

## Requirements this task implements
${specContext.spec.requirements
  .filter((r) => task.requirementIds.includes(r.id))
  .map((r) => `- ${r.title}: ${r.description}`)
  .join('\n')}

## Design guidance
${specContext.spec.design || 'No design document available'}

## Your job:
1. Analyze the error message carefully
2. Identify the root cause (not just the symptom)
3. Categorize the error type (compilation, runtime, test failure, lint, missing file, etc.)
4. Suggest 2-3 possible fixes ranked by likelihood
5. Explain why each fix might work

## Output format:
Provide a JSON response with:
{
  "errorType": "compilation|runtime|test|lint|missing|other",
  "rootCause": "The actual root cause, not just the error message",
  "symptoms": ["symptom1", "symptom2"],
  "possibleFixes": [
    {
      "fix": "Fix description",
      "likelihood": "high|medium|low",
      "reasoning": "Why this fix might work"
    }
  ],
  "summary": "Brief summary of diagnosis"
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'Diagnostician');
      const parsed = result as Record<string, unknown> | undefined;
      return {
        success: (parsed?.success as boolean | undefined) !== false,
        summary: (parsed?.summary as string | undefined) || 'Diagnosis complete',
        rootCause: (parsed?.rootCause as string | undefined) || recovery.rootCause,
        suggestions: ((parsed?.possibleFixes as Array<{ fix: string }> | undefined) || []).map((f) => f.fix),
        errorType,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        summary: `Diagnosis failed: ${errorMsg}`,
        errorType,
      };
    }
  }

  private categorizeError(error: string): string {
    const lower = error.toLowerCase();
    if (lower.includes('ts ') && lower.includes('error')) return 'typescript';
    if (lower.includes('jest') || lower.includes('test') || lower.includes('expect')) return 'test';
    if (lower.includes('eslint') || lower.includes('lint')) return 'lint';
    if (lower.includes('playwright') || lower.includes('browser') || lower.includes('timeout')) return 'browser';
    if (lower.includes('enoent') || lower.includes('module not found') || lower.includes('cannot find')) return 'missing';
    return 'other';
  }

  private getRecoveryStrategy(errorType: string, _error: string): { suggestions: string[]; strategy: string; rootCause?: string } {
    switch (errorType) {
      case 'typescript':
        return {
          strategy: 'fix_typescript',
          rootCause: 'TypeScript compilation error',
          suggestions: [
            'Fix type errors in the affected files',
            'Add missing type imports or declarations',
            'Check for incorrect interface implementations',
          ],
        };
      case 'test':
        return {
          strategy: 'fix_tests',
          rootCause: 'Test failure detected',
          suggestions: [
            'Update failing test assertions to match implementation',
            'Fix mock data or test setup',
            'Ensure test environment matches runtime',
          ],
        };
      case 'lint':
        return {
          strategy: 'fix_lint',
          rootCause: 'Linting error detected',
          suggestions: [
            'Apply ESLint auto-fix with --fix flag',
            'Manually fix remaining lint violations',
            'Update ESLint config if rule is inappropriate',
          ],
        };
      case 'browser':
        return {
          strategy: 'fix_browser',
          rootCause: 'Browser/Playwright error',
          suggestions: [
            'Check if dev server is running',
            'Verify element selectors exist in the DOM',
            'Add wait conditions for async content',
          ],
        };
      case 'missing':
        return {
          strategy: 'fix_missing',
          rootCause: 'Missing file or module',
          suggestions: [
            'Create the missing file or module',
            'Install missing dependencies',
            'Fix import paths',
          ],
        };
      default:
        return {
          strategy: 'general_fix',
          rootCause: 'Unknown error type',
          suggestions: [
            'Review error message and stack trace',
            'Check recent changes for regressions',
            'Consult documentation for the affected API',
          ],
        };
    }
  }

  /**
   * Phase 2: Generate and apply fix
   */
  private async generateAndApplyFix(
    task: ExecutableTask,
    diagnosis: { success: boolean; summary: string; rootCause?: string; suggestions?: string[] },
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<{ success: boolean; summary: string }> {
    const prompt = `
# FIX GENERATION - Task ${task.id}

## Task
${task.description}

## Diagnosis
Root Cause: ${diagnosis.rootCause}
Suggested Fixes: ${diagnosis.suggestions?.join(', ') || 'None'}

## Requirements
${specContext.spec.requirements
  .filter((r) => task.requirementIds.includes(r.id))
  .map((r) => `- ${r.title}`)
  .join('\n')}

## Design
${specContext.spec.design || 'No design document available'}

## Your job:
1. Choose the most likely fix from the suggestions
2. Implement the fix in the affected files
3. Ensure the fix doesn't break other parts of the system
4. Follow the design and requirements
5. Write clean, well-documented code

## Output format:
Provide a JSON response with:
{
  "fixChosen": "The fix that was applied",
  "filesModified": ["path/to/file1.ts", "path/to/file2.ts"],
  "filesCreated": ["path/to/new/file.ts"],
  "changes": [
    {
      "file": "path/to/file.ts",
      "change": "Description of what was changed"
    }
  ],
  "summary": "Brief summary of fix applied"
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'Fixer');
      return {
        success: result.success !== false,
        summary: result.summary || 'Fix applied',
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        summary: `Fix generation failed: ${errorMsg}`,
      };
    }
  }

  /**
   * Phase 3: Verify the fix works
   */
  private async verifyFix(
    task: ExecutableTask,
    specContext: SpecContext,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<{ success: boolean; summary: string }> {
    const prompt = `
# FIX VERIFICATION - Task ${task.id}

## Task
${task.description}

## Your job:
1. Run TypeScript compilation: npx tsc --noEmit
2. Run ESLint: npx eslint --ext .ts,.tsx src/ --max-warnings=0
3. Run tests: npx jest --passWithNoTests
4. Check if the original error is resolved
5. Verify no new errors were introduced

## Output format:
Provide a JSON response with:
{
  "compilationPassed": true|false,
  "lintPassed": true|false,
  "testsPassed": true|false,
  "originalErrorResolved": true|false,
  "newErrorsIntroduced": false,
  "summary": "Verification result"
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'Verifier');
      const allPassed =
        result.compilationPassed &&
        result.lintPassed &&
        result.testsPassed &&
        result.originalErrorResolved;
      return {
        success: allPassed,
        summary: result.summary || 'Verification complete',
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        summary: `Verification failed: ${errorMsg}`,
      };
    }
  }

  /**
   * Execute a single agent with the given prompt
   */
  private async executeAgent(
    agentLoop: { execute: (...args: unknown[]) => Promise<void> },
    prompt: string,
    agentName: string
  ): Promise<any> {
    const messages = [
      {
        role: 'system' as const,
        content: `You are a ${agentName} agent. Respond with valid JSON only.`,
      },
      { role: 'user' as const, content: prompt },
    ];

    let finalContent = '';
    let result: any = { success: true, summary: `${agentName} completed` };

    try {
      await agentLoop.execute(
        messages,
        (update: unknown) => {
          const u = update as { type: string; content?: string };
          if (u.type === 'chunk' && u.content) {
            finalContent += u.content;
          }
          if (u.type === 'complete' && finalContent.trim().length > 0) {
            try {
              result = JSON.parse(finalContent);
            } catch {
              result = { success: true, summary: finalContent };
            }
          }
        },
        [],
        'default-model',
        {}
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      result = { success: false, errors: [errorMsg] };
    }

    return result;
  }

  public async fixRegression(
    filePath: string,
    errorOutput: string
  ): Promise<{ success: boolean; diagnosis?: string; applied?: boolean }> {
    try {
      const diagnosis = await this.diagnoseRegression(filePath, errorOutput);
      const applied = await this.applyRegressionFix(filePath, diagnosis);
      return { success: applied, diagnosis, applied };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, diagnosis: msg };
    }
  }

  private async diagnoseRegression(filePath: string, errorOutput: string): Promise<string> {
    const prompt = `
# REGRESSION DIAGNOSIS

## File
${filePath}

## Error Output
${errorOutput.slice(0, 4000)}

## Your Job
Identify the root cause and the exact fix needed.

Output JSON:
{
  "diagnosis": "Root cause description",
  "fixDescription": "What to change",
  "confidence": 0-100
}
`;

    try {
      const result = await this.executeAgent({ execute: async () => {} }, prompt, 'RegressionDiagnostician');
      return (result as any).diagnosis || 'Unknown regression';
    } catch {
      return 'Unknown regression';
    }
  }

  private async applyRegressionFix(_filePath: string, _diagnosis: string): Promise<boolean> {
    return false;
  }
}
