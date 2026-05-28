/**
 * ChatBugFixHandler
 *
 * Handles bug fixing through the chat interface.
 * Developer pastes error → ForgeAI investigates → Reports findings → Asks for approval → Fixes
 *
 * Integrates with the webview chat to provide conversational bug fixing.
 */

import { CodeBugFixOrchestrator, BugReport } from './CodeBugFixOrchestrator';

export interface ChatBugFixState {
  bugReport: BugReport;
  findings: BugFixFindings;
  solutions: BugFixSolution[];
  selectedSolution?: number;
  userApproval: boolean;
  userAdditionalContext?: string;
  fixApplied: boolean;
  fixResult?: BugFixResult;
}

export interface BugFixFindings {
  rootCause: string;
  affectedFiles: string[];
  relatedIssues: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  explanation: string;
}

export interface BugFixSolution {
  id: number;
  title: string;
  description: string;
  approach: string;
  riskLevel: 'low' | 'medium' | 'high';
  estimatedTime: string;
}

export interface BugFixResult {
  success: boolean;
  summary: string;
  filesModified: string[];
  errors?: string[];
}

/**
 * Handles bug fixing through chat interface
 */
export class ChatBugFixHandler {
  private readonly orchestrator: CodeBugFixOrchestrator;
  private state: ChatBugFixState | null = null;

  constructor() {
    this.orchestrator = new CodeBugFixOrchestrator();
  }

  /**
   * Phase 1: Developer pastes error in chat
   * ForgeAI analyzes and reports findings
   */
  public async analyzeErrorFromChat(
    errorMessage: string,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<{
    findings: BugFixFindings;
    solutions: BugFixSolution[];
    message: string;
  }> {
    // Create bug report from error message
    const bugReport: BugReport = {
      errorMessage,
      errorType: this.classifyError(errorMessage),
      context: 'Error from chat',
    };

    // Run Explorer agent to analyze
    const explorerPrompt = `
# ERROR ANALYSIS

## Error Message
${errorMessage}

## Your job:
1. Analyze the error
2. Identify root cause
3. Determine severity
4. List affected files
5. Identify related issues
6. Provide clear explanation

## Output format:
{
  "rootCause": "The actual root cause",
  "affectedFiles": ["file1.ts", "file2.ts"],
  "relatedIssues": ["issue1", "issue2"],
  "severity": "critical|high|medium|low",
  "explanation": "Clear explanation of what's wrong and why"
}
`;

    let findings: BugFixFindings = {
      rootCause: 'Unknown',
      affectedFiles: [],
      relatedIssues: [],
      severity: 'medium',
      explanation: 'Unable to analyze error',
    };

    try {
      const result = await this.executeAgent(agentLoop, explorerPrompt, 'Analyzer');
      findings = {
        rootCause: result.rootCause || 'Unknown',
        affectedFiles: result.affectedFiles || [],
        relatedIssues: result.relatedIssues || [],
        severity: result.severity || 'medium',
        explanation: result.explanation || 'Unable to analyze',
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      findings.explanation = `Analysis failed: ${errorMsg}`;
    }

    // Generate solution options
    const solutions = await this.generateSolutions(findings, agentLoop);

    // Store state
    this.state = {
      bugReport,
      findings,
      solutions,
      userApproval: false,
      fixApplied: false,
    };

    // Build message for user
    const message = `
🔍 **Error Analysis Complete**

**Root Cause:** ${findings.rootCause}

**Severity:** ${findings.severity.toUpperCase()}

**Explanation:** ${findings.explanation}

**Affected Files:** ${findings.affectedFiles.length > 0 ? findings.affectedFiles.join(', ') : 'None identified'}

**Related Issues:** ${findings.relatedIssues.length > 0 ? findings.relatedIssues.join(', ') : 'None'}

---

**Proposed Solutions:**
${solutions.map((s) => `\n${s.id}. **${s.title}** (Risk: ${s.riskLevel}, Time: ${s.estimatedTime})\n   ${s.description}`).join('\n')}

---

**Next Steps:**
1. Review the solutions above
2. Tell me which solution you prefer (e.g., "Solution 1")
3. Add any additional context if needed
4. I'll ask for final approval before fixing
`;

    return { findings, solutions, message };
  }

  /**
   * Phase 2: Developer selects solution and provides additional context
   */
  public async collectUserInput(
    selectedSolutionId: number,
    additionalContext?: string
  ): Promise<{
    approved: boolean;
    message: string;
  }> {
    if (!this.state) {
      return {
        approved: false,
        message: '❌ No active bug fix session. Please paste an error first.',
      };
    }

    if (selectedSolutionId < 1 || selectedSolutionId > this.state.solutions.length) {
      return {
        approved: false,
        message: `❌ Invalid solution ID. Please select between 1 and ${this.state.solutions.length}.`,
      };
    }

    this.state.selectedSolution = selectedSolutionId - 1;
    this.state.userAdditionalContext = additionalContext;

    const selectedSolution = this.state.solutions[this.state.selectedSolution];

    const message = `
✅ **Solution Selected**

**Solution:** ${selectedSolution.title}
**Approach:** ${selectedSolution.approach}
${additionalContext ? `**Your Context:** ${additionalContext}` : ''}

---

**Before I proceed with the fix, please confirm:**

1. ✓ The analysis is correct
2. ✓ The selected solution is appropriate
3. ✓ You're ready for me to apply the fix

**Reply with:**
- "yes" or "proceed" to fix the error
- "no" or "cancel" to stop
- Any additional instructions or concerns
`;

    return {
      approved: true,
      message,
    };
  }

  /**
   * Phase 3: Developer approves fix
   * ForgeAI applies the fix using multi-agent pipeline
   */
  public async applyFix(agentLoop: { execute: (...args: unknown[]) => Promise<void> }): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.state || this.state.selectedSolution === undefined) {
      return {
        success: false,
        message: '❌ No solution selected. Please select a solution first.',
      };
    }

    try {
      // Run full multi-agent pipeline
      const pipelineResult = await this.orchestrator.fixBug(this.state.bugReport, agentLoop);

      if (pipelineResult.finalStatus === 'success') {
        this.state.fixApplied = true;
        this.state.userApproval = true;

        const message = `
✅ **Bug Fix Successful!**

**Duration:** ${pipelineResult.totalDurationMs}ms

**Pipeline Results:**
${pipelineResult.results
  .map((r) => `- ${r.agentName}: ${r.success ? '✓ SUCCESS' : '✗ FAILED'} - ${r.summary}`)
  .join('\n')}

**Files Modified:**
${
  pipelineResult.results
    .flatMap((r) => r.artifacts || [])
    .filter((a, i, arr) => arr.indexOf(a) === i)
    .map((f) => `- ${f}`)
    .join('\n') || 'None'
}

---

**Next Steps:**
1. Review the changes in your editor
2. Run tests to verify the fix
3. Commit the changes if satisfied

Is there anything else you'd like me to help with?
`;

        return { success: true, message };
      } else {
        const failedAgent = pipelineResult.results.find((r) => !r.success);
        const errorMsg = failedAgent
          ? `${failedAgent.agentName} agent failed: ${failedAgent.summary}`
          : 'Fix failed';

        const message = `
❌ **Bug Fix Failed**

**Error:** ${errorMsg}

**Pipeline Results:**
${pipelineResult.results
  .map((r) => `- ${r.agentName}: ${r.success ? '✓ SUCCESS' : '✗ FAILED'} - ${r.summary}`)
  .join('\n')}

---

**What went wrong:**
The fix process encountered an issue during the ${failedAgent?.agentName || 'execution'} phase.

**Options:**
1. Try a different solution
2. Provide more context about the error
3. Try again with the same solution

What would you like to do?
`;

        return { success: false, message };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `❌ Fix failed: ${errorMsg}`,
      };
    }
  }

  /**
   * Reset state for new bug fix session
   */
  public resetSession(): void {
    this.state = null;
  }

  /**
   * Get current session state
   */
  public getState(): ChatBugFixState | null {
    return this.state;
  }

  /**
   * Generate solution options
   */
  private async generateSolutions(
    findings: BugFixFindings,
    agentLoop: { execute: (...args: unknown[]) => Promise<void> }
  ): Promise<BugFixSolution[]> {
    const prompt = `
# SOLUTION GENERATION

## Error Analysis
**Root Cause:** ${findings.rootCause}
**Severity:** ${findings.severity}
**Explanation:** ${findings.explanation}

## Your job:
Generate 3 different solutions to fix this error. For each solution:
1. Provide a clear title
2. Describe the approach
3. Estimate risk level (low/medium/high)
4. Estimate time to implement

## Output format:
{
  "solutions": [
    {
      "title": "Solution title",
      "description": "What this solution does",
      "approach": "How to implement it",
      "riskLevel": "low|medium|high",
      "estimatedTime": "5 minutes|30 minutes|1 hour"
    }
  ]
}
`;

    try {
      const result = await this.executeAgent(agentLoop, prompt, 'SolutionGenerator');
      if (result.solutions && Array.isArray(result.solutions)) {
        return result.solutions.map((s: any, i: number) => ({
          id: i + 1,
          title: s.title || `Solution ${i + 1}`,
          description: s.description || 'No description',
          approach: s.approach || 'No approach',
          riskLevel: s.riskLevel || 'medium',
          estimatedTime: s.estimatedTime || 'Unknown',
        }));
      }
    } catch (err) {
      // Return default solutions on error
    }

    return [
      {
        id: 1,
        title: 'Direct Fix',
        description: 'Apply the most straightforward fix',
        approach: 'Modify the affected code directly',
        riskLevel: 'medium',
        estimatedTime: '15 minutes',
      },
      {
        id: 2,
        title: 'Refactor Approach',
        description: 'Refactor the code to prevent the issue',
        approach: 'Restructure the affected code',
        riskLevel: 'high',
        estimatedTime: '1 hour',
      },
      {
        id: 3,
        title: 'Add Validation',
        description: 'Add validation to prevent the error',
        approach: 'Add input validation and error handling',
        riskLevel: 'low',
        estimatedTime: '30 minutes',
      },
    ];
  }

  /**
   * Classify error type from message
   */
  private classifyError(
    errorMessage: string
  ): 'compilation' | 'runtime' | 'test' | 'lint' | 'other' {
    const lower = errorMessage.toLowerCase();

    if (lower.includes('error ts') || lower.includes('type error')) {
      return 'compilation';
    }
    if (lower.includes('test') || lower.includes('expect')) {
      return 'test';
    }
    if (lower.includes('eslint') || lower.includes('lint')) {
      return 'lint';
    }
    if (lower.includes('cannot read') || lower.includes('undefined') || lower.includes('null')) {
      return 'runtime';
    }

    return 'other';
  }

  /**
   * Execute a single agent
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
    let result: any = { success: true };

    try {
      await agentLoop.execute(
        messages,
        (update: unknown) => {
          const u = update as { type: string; content?: string };
          if (u.type === 'chunk' && u.content) {
            finalContent += u.content;
          }
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
      result = { success: false, error: errorMsg };
    }

    return result;
  }
}
