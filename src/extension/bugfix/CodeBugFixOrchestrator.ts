/**
 * CodeBugFixOrchestrator
 *
 * Handles bug fixing for regular code using the same multi-agent pipeline as spec tasks:
 * 1. Explorer - Analyzes the bug and codebase context
 * 2. Implementer - Writes the fix
 * 3. Verifier - Checks against requirements and design patterns
 * 4. Tester - Runs tests, compilation, linting
 * 5. Reviewer - Final quality gate
 *
 * Used when developers encounter bugs in their regular code (not spec tasks).
 */

export interface BugReport {
  errorMessage: string;
  errorType: 'compilation' | 'runtime' | 'test' | 'lint' | 'other';
  filePath?: string;
  lineNumber?: number;
  stackTrace?: string;
  context?: string;
}

export interface BugFixPipelineResult {
  bugId: string;
  bugReport: BugReport;
  results: AgentResult[];
  finalStatus: 'success' | 'failed';
  totalDurationMs: number;
}

export interface AgentResult {
  agentName: string;
  success: boolean;
  summary: string;
  findings?: string[];
  errors?: string[];
  artifacts?: string[];
}

/**
 * Orchestrates the 5-agent pipeline for bug fixing
 */
export class CodeBugFixOrchestrator {
  /**
   * Execute bug fix using the 5-agent pipeline
   *
   * @param bugReport - The bug to fix
   * @param agentLoop - The AgentLoop instance
   * @returns Pipeline execution result
   */
  public async fixBug(
    bugReport: BugReport,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<BugFixPipelineResult> {
    const startTime = Date.now();
    const bugId = `bug-${Date.now()}`;
    const results: AgentResult[] = [];

    // Phase 1: Explorer Agent
    const explorerResult = await this.runExplorerAgent(bugReport, agentLoop);
    results.push(explorerResult);

    if (!explorerResult.success) {
      return {
        bugId,
        bugReport,
        results,
        finalStatus: 'failed',
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Phase 2: Implementer Agent
    const implementerResult = await this.runImplementerAgent(bugReport, explorerResult, agentLoop);
    results.push(implementerResult);

    if (!implementerResult.success) {
      return {
        bugId,
        bugReport,
        results,
        finalStatus: 'failed',
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Phase 3: Verifier Agent
    const verifierResult = await this.runVerifierAgent(bugReport, implementerResult, agentLoop);
    results.push(verifierResult);

    if (!verifierResult.success) {
      return {
        bugId,
        bugReport,
        results,
        finalStatus: 'failed',
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Phase 4: Tester Agent
    const testerResult = await this.runTesterAgent(bugReport, verifierResult, agentLoop);
    results.push(testerResult);

    if (!testerResult.success) {
      return {
        bugId,
        bugReport,
        results,
        finalStatus: 'failed',
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Phase 5: Reviewer Agent
    const reviewerResult = await this.runReviewerAgent(bugReport, testerResult, agentLoop);
    results.push(reviewerResult);

    const finalStatus = reviewerResult.success ? 'success' : 'failed';

    return {
      bugId,
      bugReport,
      results,
      finalStatus,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Phase 1: Explorer Agent
   * Analyzes the bug and understands the codebase context
   */
  private async runExplorerAgent(
    bugReport: BugReport,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<AgentResult> {
    const prompt = `
# EXPLORER AGENT - Bug Analysis

## Bug Report
**Error Type:** ${bugReport.errorType}
**Error Message:** ${bugReport.errorMessage}
${bugReport.filePath ? `**File:** ${bugReport.filePath}` : ''}
${bugReport.lineNumber ? `**Line:** ${bugReport.lineNumber}` : ''}
${bugReport.stackTrace ? `**Stack Trace:** ${bugReport.stackTrace}` : ''}
${bugReport.context ? `**Context:** ${bugReport.context}` : ''}

## Your job:
1. Analyze the error message and stack trace
2. Identify the root cause (not just the symptom)
3. Understand the affected code and its dependencies
4. Determine what files need to be examined
5. Identify any related issues that might exist

## Output format:
Provide a JSON response with:
{
  "rootCause": "The actual root cause",
  "affectedFiles": ["file1.ts", "file2.ts"],
  "dependencies": ["dependency1", "dependency2"],
  "relatedIssues": ["issue1", "issue2"],
  "summary": "Brief analysis summary"
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'Explorer');
      return {
        agentName: 'Explorer',
        success: true,
        summary: result.summary || 'Analysis complete',
        findings: result.findings || [],
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
   * Writes the fix based on Explorer's findings
   */
  private async runImplementerAgent(
    bugReport: BugReport,
    explorerResult: AgentResult,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<AgentResult> {
    const prompt = `
# IMPLEMENTER AGENT - Bug Fix

## Bug
${bugReport.errorMessage}

## Explorer's Analysis
${explorerResult.summary}

## Your job:
1. Implement the fix in the affected files
2. Follow code quality standards (no console.log, proper error handling)
3. Write clean, well-documented code
4. Ensure the fix doesn't break other parts of the system
5. Add JSDoc comments for public APIs

## Output format:
Provide a JSON response with:
{
  "filesModified": ["file1.ts", "file2.ts"],
  "filesCreated": ["new-file.ts"],
  "changes": [
    {
      "file": "file.ts",
      "change": "Description of what was changed"
    }
  ],
  "summary": "Brief summary of fix applied"
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'Implementer');
      return {
        agentName: 'Implementer',
        success: true,
        summary: result.summary || 'Fix implemented',
        artifacts: result.artifacts || [],
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
   * Checks the fix against code quality standards
   */
  private async runVerifierAgent(
    bugReport: BugReport,
    implementerResult: AgentResult,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<AgentResult> {
    const prompt = `
# VERIFIER AGENT - Code Quality Check

## Bug Fixed
${bugReport.errorMessage}

## Implementation
${implementerResult.summary}

## Your job:
1. Verify the fix resolves the original bug
2. Check code quality (no console.log, proper error handling)
3. Verify no new issues were introduced
4. Check TypeScript types are correct
5. Verify naming conventions and code style

## Output format:
Provide a JSON response with:
{
  "bugResolved": true|false,
  "codeQualityOK": true|false,
  "noNewIssues": true|false,
  "typesCorrect": true|false,
  "styleOK": true|false,
  "issues": ["issue1", "issue2"],
  "summary": "Verification result"
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'Verifier');
      const success =
        result.bugResolved &&
        result.codeQualityOK &&
        result.noNewIssues &&
        result.typesCorrect &&
        result.styleOK;
      return {
        agentName: 'Verifier',
        success,
        summary: result.summary || 'Verification complete',
        findings: result.findings || [],
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
   * Runs tests and verifies the fix works
   */
  private async runTesterAgent(
    bugReport: BugReport,
    verifierResult: AgentResult,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<AgentResult> {
    const prompt = `
# TESTER AGENT - Testing and Verification

## Bug
${bugReport.errorMessage}

## Verifier's Result
${verifierResult.summary}

## Your job:
1. Run TypeScript compilation: npx tsc --noEmit
2. Run ESLint: npx eslint --ext .ts,.tsx src/ --max-warnings=0
3. Run tests: npx jest --passWithNoTests
4. Verify the original bug is fixed
5. Check no new test failures were introduced

## Output format:
Provide a JSON response with:
{
  "compilationPassed": true|false,
  "lintPassed": true|false,
  "testsPassed": true|false,
  "bugFixed": true|false,
  "noNewFailures": true|false,
  "errors": ["error1", "error2"],
  "summary": "Testing result"
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'Tester');
      const success =
        result.compilationPassed &&
        result.lintPassed &&
        result.testsPassed &&
        result.bugFixed &&
        result.noNewFailures;
      return {
        agentName: 'Tester',
        success,
        summary: result.summary || 'Testing complete',
        findings: result.findings || [],
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
   * Final quality gate - security, performance, standards
   */
  private async runReviewerAgent(
    bugReport: BugReport,
    testerResult: AgentResult,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<AgentResult> {
    const prompt = `
# REVIEWER AGENT - Final Quality Gate

## Bug Fixed
${bugReport.errorMessage}

## Tester's Result
${testerResult.summary}

## Your job:
1. Security: No hardcoded secrets, proper input validation
2. Performance: No performance regressions, efficient algorithms
3. Code quality: Clear naming, proper documentation
4. Standards: Follows project conventions and AGENTS.md constraints
5. Accessibility: If UI-related, check WCAG compliance

## Output format:
Provide a JSON response with:
{
  "securityOK": true|false,
  "performanceOK": true|false,
  "codeQualityOK": true|false,
  "standardsOK": true|false,
  "accessibilityOK": true|false,
  "issues": ["issue1", "issue2"],
  "summary": "Review result"
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'Reviewer');
      const success =
        result.securityOK &&
        result.performanceOK &&
        result.codeQualityOK &&
        result.standardsOK &&
        result.accessibilityOK;
      return {
        agentName: 'Reviewer',
        success,
        summary: result.summary || 'Review complete',
        findings: result.findings || [],
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
