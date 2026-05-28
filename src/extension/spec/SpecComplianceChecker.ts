/**
 * SpecComplianceChecker — Adversarial verification agent
 *
 * Checks task output against acceptance criteria from the spec.
 * Separated from the executor to provide unbiased verification.
 *
 * Principle: "Implementing agents are optimistic about their own output.
 * A separate Verifier has a cleaner signal." — Augment Code SDD Guide
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ExecutableTask,
  ComplianceResult,
  CriterionResult,
  ParsedSpec,
  EARSCriterion,
} from './types';

/**
 * Simple internal logger
 */
class ComplianceLogger {
  private readonly prefix = 'ComplianceChecker';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  info(_msg: string) {
    // Suppressed — only errors and warnings are logged in production
  }
  warn(msg: string) {
    console.warn(`[${this.prefix}] ${msg}`);
  }
  error(msg: string) {
    console.error(`[${this.prefix}] ${msg}`);
  }
}

/**
 * Verifies task completion against spec acceptance criteria
 */
export class SpecComplianceChecker {
  private readonly logger: ComplianceLogger;

  constructor() {
    this.logger = new ComplianceLogger();
  }

  /**
   * Check a task's output against its spec requirements
   *
   * @param task — The executed task
   * @param spec — The full parsed spec (for requirement lookup)
   * @param projectRoot — Project root directory for artifact checks
   */
  public check(task: ExecutableTask, spec: ParsedSpec, projectRoot: string): ComplianceResult {
    const startTime = Date.now();

    // Find acceptance criteria for this task's requirements
    const relevantCriteria = this.getRelevantCriteria(task, spec);
    const criterionResults: CriterionResult[] = [];

    // Check 1: Artifact existence
    for (const artifact of task.expectedArtifacts) {
      const artifactPath = path.join(projectRoot, artifact);
      const exists = fs.existsSync(artifactPath);
      criterionResults.push({
        criterion: `Expected artifact exists: ${artifact}`,
        passed: exists,
        explanation: exists ? `Found at ${artifactPath}` : `Not found at ${artifactPath}`,
      });
    }

    // Check 2: Acceptance criteria from spec requirements
    for (const criterion of relevantCriteria) {
      const result = this.checkCriterion(criterion, task, projectRoot);
      criterionResults.push(result);
    }

    // Check 3: Task-specific instructions followed
    if (task.instructions.length > 0) {
      const instructionResult = this.checkInstructions(task, projectRoot);
      criterionResults.push(instructionResult);
    }

    // Calculate overall score
    const passedCount = criterionResults.filter((c) => c.passed).length;
    const score =
      criterionResults.length > 0 ? Math.round((passedCount / criterionResults.length) * 100) : 100;

    const passed =
      score >= 80 &&
      criterionResults.every((c) => {
        // Hard requirements (artifact existence) must pass
        if (c.criterion.startsWith('Expected artifact')) return c.passed;
        // Others can have some failures if score is high enough
        return true;
      });

    const durationMs = Date.now() - startTime;

    const result: ComplianceResult = {
      passed,
      criterionResults,
      score,
      correctionInstructions: passed
        ? undefined
        : this.generateCorrectionInstructions(criterionResults, task),
      durationMs,
    };

    this.logger.info(
      `Compliance check for task ${task.id}: ${passed ? 'PASSED' : 'FAILED'} (${score}%, ${durationMs}ms)`
    );

    return result;
  }

  /**
   * Get acceptance criteria relevant to this task
   */
  private getRelevantCriteria(task: ExecutableTask, spec: ParsedSpec): EARSCriterion[] {
    const criteria: EARSCriterion[] = [];

    for (const reqId of task.requirementIds) {
      const requirement = spec.requirements.find((r) => r.id === reqId);
      if (requirement) {
        criteria.push(...requirement.acceptanceCriteria);
      }
    }

    return criteria;
  }

  /**
   * Check a single EARS criterion
   */
  private checkCriterion(
    criterion: EARSCriterion,
    task: ExecutableTask,
    projectRoot: string
  ): CriterionResult {
    const text = criterion.text.toLowerCase();

    // Ubiquitous: "The system shall..."
    if (criterion.pattern === 'ubiquitous') {
      // Check if the described behavior is reflected in produced artifacts
      return {
        criterion: criterion.text,
        passed: task.producedArtifacts.length > 0 || task.status === 'complete',
        explanation:
          task.producedArtifacts.length > 0
            ? 'Artifacts produced — presumed implemented'
            : 'No artifacts to verify against',
      };
    }

    // Event-driven: "WHEN [trigger] THE [system] SHALL [response]"
    if (criterion.pattern === 'event-driven') {
      // Look for trigger/response in code or tests
      const hasTrigger = this.checkCodeContains(projectRoot, task, text);
      return {
        criterion: criterion.text,
        passed: hasTrigger,
        explanation: hasTrigger
          ? 'Trigger/response pattern found in code'
          : 'Could not verify trigger/response pattern',
      };
    }

    // State-driven: "WHILE [state] THE [system] SHALL [behavior]"
    if (criterion.pattern === 'state-driven') {
      const hasState = this.checkCodeContains(projectRoot, task, text);
      return {
        criterion: criterion.text,
        passed: hasState,
        explanation: hasState ? 'State behavior found in code' : 'Could not verify state behavior',
      };
    }

    // Unwanted behavior: "IF [condition] THEN THE [system] SHALL [response]"
    if (criterion.pattern === 'unwanted-behavior') {
      // Check for error handling, edge cases
      const hasHandling = this.checkCodeContains(projectRoot, task, text);
      return {
        criterion: criterion.text,
        passed: hasHandling,
        explanation: hasHandling
          ? 'Error handling found in code'
          : 'Could not verify error handling',
      };
    }

    // Optional: "WHERE [feature] THE [system] SHALL [behavior]"
    return {
      criterion: criterion.text,
      passed: true, // Optional features are not required
      explanation: 'Optional criterion — not required for compliance',
    };
  }

  /**
   * Check if task instructions were followed
   */
  private checkInstructions(task: ExecutableTask, projectRoot: string): CriterionResult {
    // For now, if artifacts were produced, assume instructions were followed
    // In the future, this could use an LLM to verify
    const hasArtifacts =
      task.producedArtifacts.length > 0 &&
      task.producedArtifacts.every((a) => fs.existsSync(path.join(projectRoot, a)));

    return {
      criterion: `Task instructions followed: ${task.description}`,
      passed: hasArtifacts || task.instructions.length === 0,
      explanation: hasArtifacts
        ? 'Expected artifacts exist — instructions presumed followed'
        : 'Could not verify all instructions were followed',
    };
  }

  /**
   * Check if code contains keywords from criterion
   */
  private checkCodeContains(projectRoot: string, task: ExecutableTask, keywords: string): boolean {
    // Check produced artifacts for keyword mentions
    for (const artifact of task.producedArtifacts) {
      const artifactPath = path.join(projectRoot, artifact);
      if (fs.existsSync(artifactPath)) {
        try {
          const content = fs.readFileSync(artifactPath, 'utf-8').toLowerCase();
          // Simple keyword matching — could be enhanced with semantic analysis
          const keywordParts = keywords.split(/\s+/).filter((k) => k.length > 3);
          const matches = keywordParts.filter((k) => content.includes(k)).length;
          if (matches > 0) return true;
        } catch {
          // Binary file or unreadable — skip
        }
      }
    }
    return false;
  }

  /**
   * Generate correction instructions for failed tasks
   */
  private generateCorrectionInstructions(
    criterionResults: CriterionResult[],
    task: ExecutableTask
  ): string {
    const failed = criterionResults.filter((c) => !c.passed);

    const instructions = [
      `Task ${task.id} failed compliance check.`,
      '',
      'Failed criteria:',
      ...failed.map((c) => `- ${c.criterion}: ${c.explanation}`),
      '',
      'Please fix the following:',
      ...failed.map((c) => `1. ${c.criterion}`),
      '',
      `Task description: ${task.description}`,
      ...task.instructions.map((i) => `  - ${i}`),
    ];

    return instructions.join('\n');
  }
}
