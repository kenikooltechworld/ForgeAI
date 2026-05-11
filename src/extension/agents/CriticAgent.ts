/**
 * Critic Agent - Validates work, runs tests, recognizes error patterns, and suggests recovery.
 * Implements FR-3 (Validation), FR-5 (Error Recovery), US-1 (Intelligent Error Recovery),
 * US-3 (Quality Assurance Loop) from requirements.md.
 * Follows design.md Section 1.3 (Critic Agent) and Section 3 (Error Recovery System).
 */

import { BaseAgent } from './BaseAgent';
import { ToolRegistry } from '../tools/ToolRegistry';
import { OllamaClient } from '../ollama/OllamaClient';
import {
  CriticInput,
  CriticOutput,
  RecoveryStrategy,
  ValidationResult,
  ErrorPattern,
  CriticFeedback,
} from '../orchestrator/types';

import { RecoveryExecutor } from '../orchestrator/RecoveryExecutor';

// ─────────────────────────────────────────────────────────────────────────────
// Error Pattern Database (design.md Section 3.1)
// ─────────────────────────────────────────────────────────────────────────────

interface BuiltInErrorPattern {
  pattern: RegExp;
  category: string;
  rootCause: string;
  suggestedFix: string;
  recoveryType: 'auto_fix' | 'retry_with_changes' | 'escalate_to_user';
  recoverySteps: Array<{ action: string; tool: string; parameters: Record<string, any> }>;
  estimatedTime: number;
  confidence: number;
}

const BUILT_IN_ERROR_PATTERNS: BuiltInErrorPattern[] = [
  {
    pattern: /Cannot find module ['"]([^'"]+)['"]/,
    category: 'missing_dependency',
    rootCause: 'NPM package not installed',
    suggestedFix: 'Run npm install to install missing dependencies',
    recoveryType: 'auto_fix',
    recoverySteps: [
      {
        action: 'Check package.json',
        tool: 'forgeai_readFile',
        parameters: { path: 'package.json' },
      },
      {
        action: 'Install dependencies',
        tool: 'forgeai_runCommand',
        parameters: { command: 'npm install' },
      },
    ],
    estimatedTime: 60000,
    confidence: 0.95,
  },
  {
    pattern: /command not found: (.+)/,
    category: 'missing_dependency',
    rootCause: 'Command not installed in system',
    suggestedFix: 'Install the missing command via npm or system package manager',
    recoveryType: 'auto_fix',
    recoverySteps: [
      {
        action: 'Check available package managers',
        tool: 'forgeai_runCommand',
        parameters: { command: 'which npm || which yarn || which pnpm' },
      },
      {
        action: 'Install missing command',
        tool: 'forgeai_runCommand',
        parameters: { command: 'npm install -g {command}' },
      },
    ],
    estimatedTime: 30000,
    confidence: 0.9,
  },
  {
    pattern: /ENOENT: no such file or directory/,
    category: 'path_error',
    rootCause: 'File or directory does not exist at the specified path',
    suggestedFix: 'Verify the file path is correct or create the missing directory',
    recoveryType: 'auto_fix',
    recoverySteps: [
      {
        action: 'Search for correct path',
        tool: 'forgeai_findFiles',
        parameters: { pattern: '{filename}' },
      },
      {
        action: 'Create missing directory',
        tool: 'forgeai_createDirectory',
        parameters: { path: '{dirname}' },
      },
    ],
    estimatedTime: 5000,
    confidence: 0.9,
  },
  {
    pattern: /EACCES: permission denied|permission denied/i,
    category: 'permission_error',
    rootCause: 'Insufficient file system permissions',
    suggestedFix: 'Fix file permissions with chmod',
    recoveryType: 'auto_fix',
    recoverySteps: [
      {
        action: 'Fix permissions',
        tool: 'forgeai_runCommand',
        parameters: { command: 'chmod +x {file}' },
      },
    ],
    estimatedTime: 2000,
    confidence: 0.85,
  },
  {
    pattern: /expect is not defined|ReferenceError: expect/,
    category: 'test_framework_error',
    rootCause: 'Test framework globals not configured',
    suggestedFix: 'Install and configure vitest or jest with globals enabled',
    recoveryType: 'auto_fix',
    recoverySteps: [
      {
        action: 'Install vitest',
        tool: 'forgeai_runCommand',
        parameters: { command: 'npm install --save-dev vitest' },
      },
      {
        action: 'Create vitest config',
        tool: 'forgeai_writeFile',
        parameters: {
          path: 'vitest.config.ts',
          content: 'export default { test: { globals: true } }',
        },
      },
    ],
    estimatedTime: 45000,
    confidence: 0.98,
  },
  {
    pattern: /SyntaxError: (Unexpected token|Unexpected end of input|Invalid or unexpected token)/,
    category: 'syntax_error',
    rootCause: 'JavaScript/TypeScript syntax error in generated code',
    suggestedFix: 'Review and fix the syntax error in the generated code',
    recoveryType: 'retry_with_changes',
    recoverySteps: [{ action: 'Get diagnostics', tool: 'forgeai_getDiagnostics', parameters: {} }],
    estimatedTime: 10000,
    confidence: 0.92,
  },
  {
    pattern: /ECONNREFUSED|connect ECONNREFUSED/,
    category: 'network_error',
    rootCause: 'Connection refused — service may not be running',
    suggestedFix: 'Ensure the required service is running and accessible',
    recoveryType: 'escalate_to_user',
    recoverySteps: [],
    estimatedTime: 0,
    confidence: 0.88,
  },
  {
    pattern: /TypeScript error|TS\d{4}:|error TS/,
    category: 'syntax_error',
    rootCause: 'TypeScript compilation error',
    suggestedFix: 'Fix TypeScript type errors in the generated code',
    recoveryType: 'retry_with_changes',
    recoverySteps: [
      { action: 'Get TypeScript diagnostics', tool: 'forgeai_getDiagnostics', parameters: {} },
    ],
    estimatedTime: 15000,
    confidence: 0.93,
  },
  {
    pattern: /npm ERR! code E404|404 Not Found/,
    category: 'missing_dependency',
    rootCause: 'NPM package not found in registry',
    suggestedFix: 'Verify the package name is correct',
    recoveryType: 'escalate_to_user',
    recoverySteps: [],
    estimatedTime: 0,
    confidence: 0.87,
  },
  {
    pattern: /port (\d+) is already in use|EADDRINUSE/,
    category: 'configuration_error',
    rootCause: 'Port already in use by another process',
    suggestedFix: 'Kill the process using the port or use a different port',
    recoveryType: 'auto_fix',
    recoverySteps: [
      {
        action: 'Find process on port',
        tool: 'forgeai_runCommand',
        parameters: { command: 'npx kill-port {port}' },
      },
    ],
    estimatedTime: 5000,
    confidence: 0.85,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt (design.md Section 1.3 - Critic Agent System Prompt)
// ─────────────────────────────────────────────────────────────────────────────

const CRITIC_SYSTEM_PROMPT = `You are a Critic agent. Your job is to validate work and provide detailed, actionable feedback.

# Core Responsibilities
1. Validate that the executor's output meets the task's success criteria
2. Run actual tests to verify functionality (don't just read code)
3. Check code quality: no syntax errors, no TODOs, no stubs, follows best practices
4. Identify error patterns and suggest specific recovery strategies
5. Provide honest, strict evaluation — don't pass mediocre work

# Validation Steps (in order)
1. **Functionality Check**: Does the output accomplish what was asked?
   - For code: Does it compile/run without errors?
   - For tests: Do they pass?
   - For analysis: Is the root cause identified?
2. **Quality Check**: Is the output production-ready?
   - No TODO or FIXME comments
   - No stub implementations (functions that just return null/undefined)
   - No syntax errors
   - Follows TypeScript/JavaScript best practices
3. **Completeness Check**: Is everything done?
   - All required changes applied
   - No missing pieces
   - Success criteria from the task are met

# Error Pattern Recognition
When you see errors, identify the pattern:
- "Cannot find module 'X'" → Missing npm dependency, run npm install
- "command not found: X" → Missing system command, install it
- "ENOENT: no such file or directory" → Wrong path, find correct path
- "EACCES: permission denied" → Fix file permissions
- "expect is not defined" → Test framework not configured
- "SyntaxError" → Fix syntax in generated code
- "TypeScript error / TS####" → Fix TypeScript type errors
- "ECONNREFUSED" → Service not running, escalate to user
- "port already in use" → Kill process on port

# Feedback Rules
1. Be STRICT — if there are issues, return "fail" status
2. Be SPECIFIC — list exact issues, not vague complaints
3. Be ACTIONABLE — tell the executor exactly what to fix
4. Be HONEST — don't inflate confidence scores

# Output Format
Return ONLY valid JSON (no markdown, no explanation):
{
  "status": "pass" | "fail",
  "confidence": 0.0-1.0,
  "feedback": {
    "functionality": {
      "passed": boolean,
      "score": 0.0-1.0,
      "issues": ["specific issue 1", "specific issue 2"]
    },
    "codeQuality": {
      "passed": boolean,
      "score": 0.0-1.0,
      "issues": ["specific issue 1"]
    },
    "testCoverage": {
      "passed": boolean,
      "score": 0.0-1.0,
      "issues": ["specific issue 1"]
    },
    "suggestions": ["actionable suggestion 1", "actionable suggestion 2"],
    "requiredChanges": ["change 1 that MUST be made", "change 2"]
  },
  "errorPattern": {
    "type": "error category",
    "rootCause": "what caused this",
    "suggestedFix": "how to fix it",
    "confidence": 0.0-1.0
  }
}

# Examples

## Example 1: PASS — Good code
Task: "Generate fix for null pointer in auth.ts"
Executor output: { generatedCode: "if (!token) { throw new Error('Token required'); }" }
Response:
{
  "status": "pass",
  "confidence": 0.92,
  "feedback": {
    "functionality": { "passed": true, "score": 0.95, "issues": [] },
    "codeQuality": { "passed": true, "score": 0.90, "issues": [] },
    "testCoverage": { "passed": true, "score": 0.85, "issues": [] },
    "suggestions": ["Consider adding a unit test for the null token case"],
    "requiredChanges": []
  }
}

## Example 2: FAIL — Tests failing
Task: "Run tests to verify fix"
Executor output: { output: "FAIL src/auth.test.ts\n● auth › should validate token\n  Expected: true\n  Received: false" }
Response:
{
  "status": "fail",
  "confidence": 0.95,
  "feedback": {
    "functionality": { "passed": false, "score": 0.2, "issues": ["Test 'auth › should validate token' is failing", "Expected true but received false"] },
    "codeQuality": { "passed": true, "score": 0.8, "issues": [] },
    "testCoverage": { "passed": false, "score": 0.3, "issues": ["1 test failing"] },
    "suggestions": ["Review the token validation logic", "Check if the fix was applied correctly"],
    "requiredChanges": ["Fix the token validation to return true for valid tokens", "Re-run tests to verify"]
  }
}

## Example 3: FAIL — Missing dependency
Task: "Run npm test"
Executor output: { output: "Error: Cannot find module 'vitest'" }
Response:
{
  "status": "fail",
  "confidence": 0.98,
  "feedback": {
    "functionality": { "passed": false, "score": 0.0, "issues": ["Cannot find module 'vitest' — dependency not installed"] },
    "codeQuality": { "passed": true, "score": 0.8, "issues": [] },
    "testCoverage": { "passed": false, "score": 0.0, "issues": ["Tests cannot run without vitest"] },
    "suggestions": ["Install vitest with: npm install --save-dev vitest"],
    "requiredChanges": ["Run: npm install --save-dev vitest", "Then retry running tests"]
  },
  "errorPattern": {
    "type": "missing_dependency",
    "rootCause": "NPM package vitest not installed",
    "suggestedFix": "Run npm install --save-dev vitest",
    "confidence": 0.98
  }
}

Now evaluate this task result:`;

// ─────────────────────────────────────────────────────────────────────────────
// Test result parsing helper
// ─────────────────────────────────────────────────────────────────────────────

interface TestRunResult {
  passed: boolean;
  passCount: number;
  failCount: number;
  totalCount: number;
  errors: string[];
  output: string;
}

function parseTestOutput(output: string): TestRunResult {
  const errors: string[] = [];
  let passCount = 0;
  let failCount = 0;

  // Jest patterns
  const jestPass = output.match(/(\d+)\s+passed/);
  const jestFail = output.match(/(\d+)\s+failed/);
  if (jestPass) passCount = parseInt(jestPass[1], 10);
  if (jestFail) failCount = parseInt(jestFail[1], 10);

  // Vitest patterns
  const vitestPass = output.match(/(\d+)\s+tests?\s+passed/i);
  const vitestFail = output.match(/(\d+)\s+tests?\s+failed/i);
  if (vitestPass) passCount = parseInt(vitestPass[1], 10);
  if (vitestFail) failCount = parseInt(vitestFail[1], 10);

  // Extract error lines
  const errorLines = output
    .split('\n')
    .filter((l) => l.includes('●') || l.includes('FAIL ') || /Error:/.test(l))
    .slice(0, 10);
  errors.push(...errorLines);

  return {
    passed: failCount === 0 && (passCount > 0 || output.includes('pass')),
    passCount,
    failCount,
    totalCount: passCount + failCount,
    errors,
    output,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CriticAgent
// ─────────────────────────────────────────────────────────────────────────────

export class CriticAgent extends BaseAgent {
  private readonly recoveryExecutor: RecoveryExecutor;

  constructor(toolRegistry: ToolRegistry, ollamaClient: OllamaClient, logger?: any) {
    super(toolRegistry, ollamaClient, logger);
    this.recoveryExecutor = new RecoveryExecutor(toolRegistry);
  }

  getName(): string {
    return 'Critic';
  }

  getCapabilities(): string[] {
    return [
      'Quality validation',
      'Test execution',
      'Error pattern recognition',
      'Feedback generation',
      'Recovery suggestions',
    ];
  }

  // ── 8.1 Validate executor's work ──────────────────────────────────────────

  async evaluate(input: CriticInput): Promise<CriticOutput> {
    return this.executeWithErrorHandling(async () => {
      this.logInfo(`Evaluating task: ${input.task.id} (type: ${input.task.type})`);

      const executorOutput = input.executorOutput;

      // 1. Run actual tests if this is a test-related task (8.2)
      let testResult: TestRunResult | null = null;
      if (input.task.type === 'run_tests' || input.task.type === 'verify') {
        testResult = await this.runActualTests(input.task.metadata?.testCommand);
      }

      // 2. Get diagnostics for code quality check
      let diagnosticIssues: string[] = [];
      try {
        const diags = await this.toolRegistry.executeTool('forgeai_getDiagnostics', {});
        if (Array.isArray(diags)) {
          diagnosticIssues = diags
            .filter((d: any) => d.severity === 'error')
            .map((d: any) => `${d.file}:${d.line} — ${d.message}`);
        }
      } catch {
        // Diagnostics unavailable — not a blocking issue
      }

      // 3. Check for obvious quality issues in executor result
      const qualityIssues = this.checkCodeQuality(executorOutput);

      // 4. Analyze errors from executor output (8.3)
      const errorText = this.extractErrorText(executorOutput);
      const errorPattern = errorText ? this.analyzeError(new Error(errorText)) : null;

      // 5. Use Ollama for deep validation (design.md Section 1.3)
      let ollamaEvaluation: any = null;
      try {
        const evalContext = `
Task: ${input.task.description}
Task Type: ${input.task.type}
Success Criteria:
  Functional: ${input.task.criteria.functional.join(', ')}
  Quality: ${input.task.criteria.quality.join(', ')}

Executor Output:
${JSON.stringify(executorOutput.result, null, 2).slice(0, 2000)}

Self-Evaluation from Executor:
  Confidence: ${executorOutput.selfEvaluation.confidence}
  Concerns: ${executorOutput.selfEvaluation.concerns.join(', ') || 'none'}

${testResult ? `Test Results: ${testResult.passCount} passed, ${testResult.failCount} failed\nErrors: ${testResult.errors.slice(0, 5).join('\n')}` : ''}
${diagnosticIssues.length > 0 ? `Diagnostic Errors:\n${diagnosticIssues.slice(0, 5).join('\n')}` : ''}
${qualityIssues.length > 0 ? `Quality Issues Found:\n${qualityIssues.join('\n')}` : ''}`;

        const response = await this.ollamaClient.chat({
          model: 'gemma4:31b-cloud',
          messages: [
            { role: 'system', content: CRITIC_SYSTEM_PROMPT },
            { role: 'user', content: evalContext },
          ],
          stream: false,
        });

        if ('message' in response) {
          const content = response.message.content;
          const jsonMatch =
            content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
          ollamaEvaluation = JSON.parse(jsonStr);
        }
      } catch (err) {
        this.logError('Ollama evaluation failed, using heuristic evaluation', err);
      }

      // 6. Build final CriticOutput — merge Ollama + heuristic results
      const criticOutput = this.buildCriticOutput(
        input.task.id,
        ollamaEvaluation,
        testResult,
        diagnosticIssues,
        qualityIssues,
        errorPattern
      );

      // Phase 3: execute recovery when critic fails
      if (criticOutput.status === 'fail') {
        const errorMessage =
          errorText ||
          (input.executorOutput?.result?.error
            ? String(input.executorOutput.result.error)
            : null) ||
          'Critic evaluation failed';

        const recoveryResult = await this.recoveryExecutor.executeRecovery(
          errorMessage
        );

        if (recoveryResult.succeeded) {
          return {
            ...criticOutput,
            status: 'pass',
            confidence: Math.max(criticOutput.confidence, recoveryResult.confidence),
            feedback: {
              ...criticOutput.feedback,
              suggestions: [
                ...criticOutput.feedback.suggestions,
                `Recovery executed successfully for category "${recoveryResult.category ?? 'unknown'}".`,
                ...recoveryResult.steps
                  .filter((s) => s.succeeded)
                  .map((s) => `- ${s.action} (${s.tool})`),
              ],
            },
          };
        }

        // If recovery failed, keep criticOutput as fail (graph will retry/refine)
        return {
          ...criticOutput,
          feedback: {
            ...criticOutput.feedback,
            suggestions: [
              ...criticOutput.feedback.suggestions,
              `Recovery attempt failed: ${recoveryResult.errorMessage ?? 'unknown error'}`,
            ],
          },
        };
      }

      return criticOutput;
    }, 'evaluate');
  }

  // ── 8.2 Run actual tests ──────────────────────────────────────────────────

  private async runActualTests(testCommand?: string): Promise<TestRunResult> {
    const cmd = testCommand || 'npm test -- --no-coverage --passWithNoTests';
    this.logInfo(`Running actual tests: ${cmd}`);

    try {
      const output = await this.toolRegistry.executeTool('forgeai_runCommand', { command: cmd });
      const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
      const result = parseTestOutput(outputStr);
      this.logInfo(`Test results: ${result.passCount} passed, ${result.failCount} failed`);
      return result;
    } catch (err) {
      const errorStr = err instanceof Error ? err.message : String(err);
      this.logError('Test execution failed', err);
      return parseTestOutput(errorStr);
    }
  }

  // ── 8.3 Error pattern recognition ────────────────────────────────────────

  private analyzeError(error: Error): ErrorPattern | null {
    const message = error.message;

    for (const pattern of BUILT_IN_ERROR_PATTERNS) {
      const match = pattern.pattern.exec(message);
      if (match) {
        this.logInfo(
          `Error pattern matched: ${pattern.category} (confidence: ${pattern.confidence})`
        );
        return {
          id: pattern.category,
          name: pattern.category,
          description: pattern.rootCause,
          recovery: pattern.suggestedFix,
        };
      }
    }

    this.logInfo('No known error pattern matched');
    return null;
  }

  // ── 8.4 Recovery suggestion ───────────────────────────────────────────────

  async suggestRecovery(error: Error): Promise<RecoveryStrategy | null> {
    return this.executeWithErrorHandling(async () => {
      this.logInfo(`Analyzing error for recovery: ${error.message.slice(0, 100)}`);

      const message = error.message;

      for (const pattern of BUILT_IN_ERROR_PATTERNS) {
        if (pattern.pattern.test(message)) {
          this.logInfo(`Recovery strategy found: ${pattern.recoveryType} for ${pattern.category}`);

          return {
            id: `recovery-${pattern.category}-${Date.now()}`,
            name: `${pattern.category} recovery`,
            steps: pattern.recoverySteps.map((s) => s.action),
            successProbability: pattern.confidence,
          };
        }
      }

      this.logInfo('No recovery strategy available for this error');
      return null;
    }, 'suggestRecovery');
  }

  // ── Required by IAgent interface ──────────────────────────────────────────

  async execute(input: CriticInput): Promise<CriticOutput> {
    return this.evaluate(input);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Check executor output for obvious quality issues without Ollama.
   */
  private checkCodeQuality(executorOutput: any): string[] {
    const issues: string[] = [];
    const result = executorOutput?.result;

    if (!result) {
      issues.push('Executor produced no result');
      return issues;
    }

    // Check for error in result
    if (result.error) {
      issues.push(`Executor reported error: ${result.error}`);
    }

    // Check generated code for quality issues
    const code = result.generatedCode || result.code || '';
    if (typeof code === 'string' && code.length > 0) {
      if (code.includes('TODO') || code.includes('FIXME')) {
        issues.push('Generated code contains TODO/FIXME comments — not production-ready');
      }
      if (/return\s+null\s*;/.test(code) && code.includes('// placeholder')) {
        issues.push('Generated code contains placeholder return values');
      }
      if (code.includes('throw new Error("Not implemented")')) {
        issues.push('Generated code has unimplemented methods');
      }
    }

    // Check test results
    if (result.failCount > 0) {
      issues.push(`${result.failCount} test(s) are failing`);
    }

    // Check apply_changes result
    if (result.appliedFiles !== undefined && result.appliedFiles.length === 0) {
      issues.push('No files were modified — changes may not have been applied');
    }

    // Check verify result
    if (result.passed === false && result.issues?.length > 0) {
      issues.push(...result.issues.map((i: string) => `Verification failed: ${i}`));
    }

    return issues;
  }

  /**
   * Extract error text from executor output for pattern matching.
   */
  private extractErrorText(executorOutput: any): string | null {
    const result = executorOutput?.result;
    if (!result) return null;

    if (result.error) return result.error;
    if (result.output && typeof result.output === 'string') {
      // Look for error patterns in command output
      const errorLines = result.output
        .split('\n')
        .filter((l: string) => /error|Error|FAIL|Cannot find|ENOENT|EACCES|ECONNREFUSED/i.test(l))
        .join('\n');
      return errorLines || null;
    }
    if (result.testErrors?.length > 0) return result.testErrors.join('\n');

    return null;
  }

  /**
   * Build the final CriticOutput by merging Ollama evaluation with heuristic checks.
   */
  private buildCriticOutput(
    taskId: string,
    ollamaEval: any,
    testResult: TestRunResult | null,
    diagnosticIssues: string[],
    qualityIssues: string[],
    errorPattern: ErrorPattern | null
  ): CriticOutput {
    // If Ollama gave us a valid evaluation, use it as the primary source
    if (ollamaEval && typeof ollamaEval.status === 'string') {
      // Merge heuristic issues into Ollama's feedback
      const allFunctionalIssues = [
        ...(ollamaEval.feedback?.functionality?.issues || []),
        ...diagnosticIssues,
      ];
      const allQualityIssues = [
        ...(ollamaEval.feedback?.codeQuality?.issues || []),
        ...qualityIssues,
      ];

      // Override status to fail if heuristics found blocking issues
      const hasBlockingIssues =
        diagnosticIssues.length > 0 ||
        (testResult !== null && !testResult.passed && testResult.failCount > 0);

      const finalStatus = hasBlockingIssues ? 'fail' : ollamaEval.status;
      const finalConfidence = hasBlockingIssues
        ? Math.min(ollamaEval.confidence || 0.5, 0.3)
        : ollamaEval.confidence || 0.7;

      const feedback: CriticFeedback = {
        status: finalStatus,
        issues: [...allFunctionalIssues, ...allQualityIssues],
        requiredChanges: ollamaEval.feedback?.requiredChanges || [],
        suggestions: ollamaEval.feedback?.suggestions || [],
      };

      return {
        taskId,
        status: finalStatus,
        confidence: finalConfidence,
        feedback,
        errorPattern:
          errorPattern ||
          (ollamaEval.errorPattern
            ? {
                id: ollamaEval.errorPattern.type || 'unknown',
                name: ollamaEval.errorPattern.type || 'unknown',
                description: ollamaEval.errorPattern.rootCause || '',
                recovery: ollamaEval.errorPattern.suggestedFix || '',
              }
            : undefined),
        timestamp: Date.now(),
      };
    }

    // Fallback: pure heuristic evaluation when Ollama is unavailable
    const allIssues = [...diagnosticIssues, ...qualityIssues];
    const testFailed = testResult !== null && !testResult.passed;
    const hasFail = allIssues.length > 0 || testFailed;

    const feedback: CriticFeedback = {
      status: hasFail ? 'fail' : 'pass',
      issues: allIssues,
      requiredChanges: allIssues.map((i) => `Fix: ${i}`),
      suggestions: testResult?.errors.slice(0, 3) || [],
    };

    return {
      taskId,
      status: hasFail ? 'fail' : 'pass',
      confidence: hasFail ? 0.3 : 0.7,
      feedback,
      errorPattern: errorPattern || undefined,
      timestamp: Date.now(),
    };
  }
}
