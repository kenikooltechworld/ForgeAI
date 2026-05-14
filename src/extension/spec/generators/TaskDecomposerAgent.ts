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
    const userPrompt = this.buildUserPrompt(
      requirementsContent,
      planContent,
      constitution
    );

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
- Specific instructions
- Expected artifacts (files to create/modify)
- Acceptance criteria
- Requirement traceability (which requirements this task implements)

## Task Format Rules
- Number tasks as N.M (e.g., 1.1, 1.2, 2.1)
- Group tasks into phases (Phase 1: Setup, Phase 2: Core, etc.)
- Mark property tests with an asterisk: - [ ]* 1.2 Property test name
- Mark checkpoints as: - [ ] N. Checkpoint - Title
- Order tasks by dependency (earliest first)
- Each task should take 15-60 minutes to complete
- Include "Checkpoint" tasks after each phase to verify progress
- Link each task to requirement IDs: _Requirements: 1.1, 1.3_

## Output Format
\`\`\`markdown
# Implementation Plan: [Feature Name]

## Overview
[Brief summary]

## Tasks

### Phase 1: [Phase Title]

- [ ] 1.1 [Task description]
  - [Instruction 1]
  - [Instruction 2]
  - _Requirements: X.Y, X.Z_

- [ ]* 1.2 [Property test task]
  - **Property N: [Name]**
  - **Validates: Requirements X.Y**

- [ ] 2. Checkpoint - [Title]
  - [Verification steps]

[... phases 2-N ...]
\`\`\`

## Quality Checklist
- Every task has clear instructions
- Every task links to at least one requirement
- Dependencies are explicit (task N.M depends on task X.Y)
- Property tests are marked with [ ]*
- Checkpoints exist after each major phase`;
  }

  private buildUserPrompt(
    requirements: string,
    plan: string,
    constitution: string
  ): string {
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
