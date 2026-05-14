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

import { ToolRegistry } from '../../tools/ToolRegistry';
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

  /**
   * Interpolate {placeholder} tokens in recovery step parameters
   * using values extracted from the error message.
   */
  private interpolateParams(
    params: Record<string, unknown>,
    errorMessage: string,
    regex: RegExp
  ): Record<string, unknown> {
    const regexMatch = regex.exec(errorMessage);
    const captured = regexMatch?.[1] ?? '';

    // Extract common values from the error message
    const portMatch = errorMessage.match(/port\s+(\d+)/i);
    const fileMatch =
      errorMessage.match(/['"]([^'"]+\.\w+)['"]/) || errorMessage.match(/([\w./\\-]+\.\w{1,5})/);

    const replacements: Record<string, string> = {
      command: captured,
      filename: fileMatch?.[1] ?? captured,
      dirname: fileMatch?.[1]?.replace(/[\\/][^\\/]+$/, '') ?? '.',
      file: fileMatch?.[1] ?? captured,
      port: portMatch?.[1] ?? '3000',
    };

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        let interpolated = value;
        for (const [placeholder, replacement] of Object.entries(replacements)) {
          interpolated = interpolated.replace(`{${placeholder}}`, replacement);
        }
        result[key] = interpolated;
      } else {
        result[key] = value;
      }
    }
    return result;
  }

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
    const builtIn = BUILT_IN_ERROR_PATTERNS.find((p) => p.category === match.errorPattern!.id);

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
        const interpolatedParams = this.interpolateParams(
          step.parameters,
          errorMessage,
          builtIn.regex
        );
        await this.toolRegistry.executeTool(step.tool, interpolatedParams);
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
