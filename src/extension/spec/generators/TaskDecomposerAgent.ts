/**
 * TaskDecomposer Agent
 * Generates tasks.md — atomic, independently-shippable tasks.
 * Output: specs/NNN-feature/tasks.md
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SpecGenerationResult } from './types';

export interface TaskDecomposerAgentDeps {
  executeLLM: (systemPrompt: string, userPrompt: string) => Promise<string>;
  readConstitution: () => Promise<string>;
}

export class TaskDecomposerAgent {
  constructor(private readonly deps: TaskDecomposerAgentDeps) {}

  /**
   * Generate tasks.md from requirements + plan.
   */
  public async generate(
    specDir: string,
    requirementsContent: string,
    planContent: string
  ): Promise<SpecGenerationResult> {
    const filePath = path.join(specDir, 'tasks.md');

    const constitution = await this.deps.readConstitution();

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(requirementsContent, planContent, constitution);

    try {
      const content = await this.deps.executeLLM(systemPrompt, userPrompt);
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true, filePath, content };
    } catch (error) {
      return {
        success: false,
        filePath,
        content: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildSystemPrompt(): string {
    return `You are the TaskDecomposer Agent for ForgeAI, a spec-driven AI coding assistant.

Your job is to break a technical plan into atomic tasks that a junior engineer could execute. Each task must have:
- A single clear objective
- Specific instructions with file paths and function/class names
- Expected artifacts (files to create/modify)
- Acceptance criteria linking to requirements
- **Test Specification** — REQUIRED for every task:
  - Test Type: unit | integration | e2e | static
  - Test Files: specific file paths (e.g., "src/feature/__tests__/Component.test.ts")
  - Test Cases: specific test cases as bullet points
  - Coverage Target: minimum % (default 70%)
- **UI/UX Spec** — REQUIRED for UI tasks (when task involves UI components, styling, layout):
  - Expected elements: CSS selectors and descriptions
  - Visual rules: styling, spacing, and layout requirements
  - Component specs: props, states, and behavior definitions
- Verification steps including: tests pass, TypeScript compiles, no lint errors
- Requirement traceability (which requirements this task implements)

## Task Format Rules
- Number tasks as N.M (e.g., 1.1, 1.2, 2.1)
- Group tasks into phases (Phase 1: Setup, Phase 2: Core, etc.)
- Order tasks by dependency (earliest first)
- Each task should take 15-60 minutes to complete
- Include "Phase Gate" tasks after each phase to validate all previous tasks pass 100%
- Link each task to requirement IDs: _Requirements: 1.1, 1.3_
- **CRITICAL: Write tests FIRST, then implement, then verify — for every task**
- **CRITICAL: Include UI/UX Spec for any task that touches the frontend**

## Output Format
\`\`\`markdown
# Implementation Plan: [Feature Name]

## Overview
[Brief summary]

**Estimated Total Duration**: {N} {weeks/days}

---

## Phase 1: [Phase Title] ({Timeframe})

### Task 1.1: [Task Title]
**Priority**: Critical
**Estimate**: {N} {hours}
**Dependencies**: None

**Description**: [What this task accomplishes — be specific and comprehensive]

**Subtasks**:
- [ ] [Subtask 1]
- [ ] [Subtask 2]

**Acceptance Criteria**:
- [ ] [Criterion linking to requirement]
- [ ] [Criterion linking to requirement]

**Test Specification** (generate REAL tests, not placeholders):
- **Test Type**: unit | integration | e2e | static
- **Test Files**: [src/feature/__tests__/Component.test.ts]
- **Test Cases** (specific assertion names and expected results):
  - \`should [exact behavior when exact condition]\` -> expects [exact result]
  - \`should [exact behavior when exact condition]\` -> expects [exact result]
  - \`should handle [edge case]\` -> expects [exact error/result]
  - Minimum 3 test cases per task; more for complex logic
- **Coverage Target**: 70% minimum, 100% for critical paths

**Verification Steps**:
- [ ] All tests pass with 100% success rate
- [ ] TypeScript compilation succeeds with zero errors
- [ ] No linting errors introduced

**Implements**: Requirement {X.Y}, {X.Y}

---

### Task 1.2: [Task Title]
...

### Task X. Phase Gate - [Phase Title] Validation
**Priority**: Critical
**Estimate**: 15 minutes
**Dependencies**: Task {last task of phase}

**Description**: Validate all tasks in Phase {N} pass 100% before proceeding

**Subtasks**:
- [ ] Run all tests for Phase {N} tasks
- [ ] Verify TypeScript compilation has zero errors
- [ ] Verify no linting errors
- [ ] Verify all acceptance criteria are met

**Verification Steps**:
- [ ] All Phase {N} tests pass with 100% success rate
- [ ] TypeScript compilation succeeds with zero errors

**Implements**: All Phase {N} requirements

[... phases 2-N ...]
\`\`\`

## Quality Checklist
- Every task has clear instructions with specific file paths
- Every task links to at least one requirement
- Every task has a Test Specification section
- Dependencies are explicit (task N.M depends on task X.Y)
- Phase Gate tasks exist after each major phase
- Verification steps include: tests pass 100%, TypeScript compiles, no lint errors
- Test cases are specific, not vague ("should work" is NOT acceptable)`;
  }

  private buildUserPrompt(requirements: string, plan: string, constitution: string): string {
    return `## Requirements
${requirements}

## Technical Plan
${plan}

## Project Constitution
${constitution}

## Instructions
Write a complete tasks.md implementation plan. Break the plan into atomic tasks. Use the exact format specified in your system prompt. Include all requirement traceability.`;
  }
}
