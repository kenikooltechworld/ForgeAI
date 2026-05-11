/**
 * RecoveryExecutor - Phase 3 recovery execution.
 *
 * Given an error message, it:
 * - matches a built-in error pattern
 * - executes each recovery step via ToolRegistry
 * - returns a structured RecoveryResult
 *
 * Note: current RecoveryStrategy type stores `steps: string[]` only.
 * To actually execute tools/params, we run directly from BUILT_IN_ERROR_PATTERNS.
 */

import { ToolRegistry } from '../tools/ToolRegistry';
import { matchErrorPattern, BUILT_IN_ERROR_PATTERNS } from './ErrorPatterns';

export type RecoveryStepResult = {
  action: string;
  tool: string;
  succeeded: boolean;
  error?: string;
};

export type RecoveryResult = {
  succeeded: boolean;
  category?: string;
  confidence: number;
  steps: RecoveryStepResult[];
  errorMessage?: string;
};

export class RecoveryExecutor {
  constructor(private readonly toolRegistry: ToolRegistry) {}

  public async executeRecovery(errorMessage: string): Promise<RecoveryResult> {
    const match = matchErrorPattern(errorMessage);

    if (!match.recovery || !match.errorPattern) {
      return {
        succeeded: false,
        confidence: match.confidence,
        steps: [],
        errorMessage,
      };
    }

    // Find the built-in pattern definition to get tool+params
    const builtIn = BUILT_IN_ERROR_PATTERNS.find(
      (p) => p.category === match.errorPattern!.id
    );

    if (!builtIn) {
      return {
        succeeded: false,
        confidence: match.confidence,
        steps: [],
        errorMessage,
        category: match.errorPattern.id,
      };
    }

    const steps: RecoveryStepResult[] = [];

    for (const step of builtIn.recoverySteps) {
      try {
        await this.toolRegistry.executeTool(step.tool, step.parameters);
        steps.push({
          action: step.action,
          tool: step.tool,
          succeeded: true,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        steps.push({
          action: step.action,
          tool: step.tool,
          succeeded: false,
          error: msg,
        });

        // stop at first failure (safer than continuing)
        return {
          succeeded: false,
          confidence: match.confidence,
          steps,
          errorMessage,
          category: builtIn.category,
        };
      }
    }

    return {
      succeeded: true,
      confidence: match.confidence,
      steps,
      errorMessage,
      category: builtIn.category,
    };
  }
}
