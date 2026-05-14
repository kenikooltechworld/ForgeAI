/**
 * Error pattern definitions and matching engine for Phase 3 (Error Recovery System).
 *
 * This module provides:
 * - ErrorPattern + RecoveryStrategy + RecoveryStep types (imported from agents/types)
 * - Built-in pattern library (regex-driven)
 * - matchErrorPattern() to pick best match with a confidence threshold
 */

import {
  ErrorPattern,
  RecoveryStrategy,
} from '../types';

export type RecoveryStep = {
  action: string;
  tool: string;
  parameters: Record<string, unknown>;
};

export type ErrorCategory =
  | 'missing_dependency'
  | 'path_error'
  | 'permission_error'
  | 'test_framework_error'
  | 'syntax_error'
  | 'network_error'
  | 'configuration_error'
  | 'runtime_error'
  | 'unknown';

type BuiltInPattern = {
  /** Rust regex syntax not used; JS RegExp */
  regex: RegExp;
  category: ErrorCategory;
  rootCause: string;
  suggestedFix: string;
  recoveryType: 'auto_fix' | 'retry_with_changes' | 'escalate_to_user';
  recoverySteps: RecoveryStep[];
  estimatedTimeMs: number;
  confidence: number;
};

export const BUILT_IN_ERROR_PATTERNS: BuiltInPattern[] = [
  {
    regex: /Cannot find module ['"]([^'"]+)['"]/,
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
    estimatedTimeMs: 60_000,
    confidence: 0.95,
  },
  {
    regex: /command not found: (.+)/,
    category: 'missing_dependency',
    rootCause: 'Command not installed in system',
    suggestedFix: 'Install the missing command via npm or system package manager',
    recoveryType: 'auto_fix',
    recoverySteps: [
      {
        action: 'Install missing command',
        tool: 'forgeai_runCommand',
        parameters: { command: 'npm install -g {command}' },
      },
    ],
    estimatedTimeMs: 30_000,
    confidence: 0.9,
  },
  {
    regex: /ENOENT: no such file or directory/i,
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
    estimatedTimeMs: 5_000,
    confidence: 0.9,
  },
  {
    regex: /EACCES: permission denied|permission denied/i,
    category: 'permission_error',
    rootCause: 'Insufficient file system permissions',
    suggestedFix: 'Fix file permissions',
    recoveryType: 'auto_fix',
    recoverySteps: [
      {
        action: 'Fix permissions',
        tool: 'forgeai_runCommand',
        parameters: { command: 'chmod +x {file}' },
      },
    ],
    estimatedTimeMs: 2_000,
    confidence: 0.85,
  },
  {
    regex: /expect is not defined|ReferenceError: expect/i,
    category: 'test_framework_error',
    rootCause: 'Test framework globals not configured',
    suggestedFix: 'Install and configure vitest/jest with globals enabled',
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
    estimatedTimeMs: 45_000,
    confidence: 0.98,
  },
  {
    regex: /SyntaxError: (Unexpected token|Unexpected end of input|Invalid or unexpected token)/,
    category: 'syntax_error',
    rootCause: 'JavaScript/TypeScript syntax error in generated code',
    suggestedFix: 'Fix the syntax error in the generated code',
    recoveryType: 'retry_with_changes',
    recoverySteps: [
      {
        action: 'Get diagnostics',
        tool: 'forgeai_getDiagnostics',
        parameters: {},
      },
    ],
    estimatedTimeMs: 10_000,
    confidence: 0.92,
  },
  {
    regex: /ECONNREFUSED|connect ECONNREFUSED/,
    category: 'network_error',
    rootCause: 'Connection refused — service may not be running',
    suggestedFix: 'Ensure required service is running and accessible',
    recoveryType: 'escalate_to_user',
    recoverySteps: [],
    estimatedTimeMs: 0,
    confidence: 0.88,
  },
  {
    regex: /TypeScript error|TS\d{4}:|error TS/,
    category: 'syntax_error',
    rootCause: 'TypeScript compilation error',
    suggestedFix: 'Fix TypeScript type errors in generated code',
    recoveryType: 'retry_with_changes',
    recoverySteps: [
      {
        action: 'Get TypeScript diagnostics',
        tool: 'forgeai_getDiagnostics',
        parameters: {},
      },
    ],
    estimatedTimeMs: 15_000,
    confidence: 0.93,
  },
  {
    regex: /port (\d+) is already in use|EADDRINUSE/i,
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
    estimatedTimeMs: 5_000,
    confidence: 0.85,
  },
];

function createRecoveryStrategy(
  pattern: BuiltInPattern,
  _errorMessage: string
): RecoveryStrategy {
  return {
    id: `recovery-${pattern.category}-${Date.now()}`,
    name: `${pattern.category} recovery`,
    steps: pattern.recoverySteps.map((s) => s.action),
    successProbability: pattern.confidence,
  };
}

/**
 * Find best matching error pattern for a given error message.
 * Returns null if best confidence is below threshold.
 */
export function matchErrorPattern(errorMessage: string): {
  errorPattern: ErrorPattern | null;
  recovery: RecoveryStrategy | null;
  confidence: number;
} {
  let best: BuiltInPattern | null = null;

  for (const pattern of BUILT_IN_ERROR_PATTERNS) {
    if (pattern.regex.test(errorMessage)) {
      if (!best || pattern.confidence > best.confidence) best = pattern;
    }
  }

  if (!best) {
    return { errorPattern: null, recovery: null, confidence: 0 };
  }

  // confidence threshold: 0.5 aligns with spec
  const confidence = best.confidence;
  if (confidence < 0.5) {
    return { errorPattern: null, recovery: null, confidence };
  }

  const errorPattern: ErrorPattern = {
    id: best.category,
    name: best.category,
    description: best.rootCause,
    recovery: best.suggestedFix,
  };

  const recovery = createRecoveryStrategy(best, errorMessage);

  return { errorPattern, recovery, confidence };
}
