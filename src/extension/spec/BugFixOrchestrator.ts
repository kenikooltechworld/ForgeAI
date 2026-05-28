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
  ): Promise<{ success: boolean; summary: string; rootCause?: string; suggestions?: string[] }> {
    const prompt = `
# ERROR DIAGNOSIS - Task ${task.id}

## Task
${task.description}

## Error Message
${error}

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
      return {
        success: result.success !== false,
        summary: result.summary || 'Diagnosis complete',
        rootCause: (result as any).rootCause,
        suggestions: (result as any).possibleFixes?.map((f: any) => f.fix) || [],
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        summary: `Diagnosis failed: ${errorMsg}`,
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
        content: `You are a ${agentName} agent. Respond with valid JSON only. No markdown, no explanations, just JSON.`,
      },
      { role: 'user' as const, content: prompt },
    ];

    let finalContent = '';
    let result: any = {
      success: true,
      summary: `${agentName} completed`,
    };

    try {
      await agentLoop.execute(
        messages,
        (update: unknown) => {
          const u = update as { type: string; content?: string };
          // Collect content from chunk updates
          if (u.type === 'chunk' && u.content) {
            finalContent += u.content;
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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      result = { success: false, errors: [errorMsg] };
    }

    return result;
  }
}
