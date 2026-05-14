/**
 * Architect Agent
 * Generates plan.md — technical architecture from requirements.
 * Output: specs/NNN-feature/plan.md
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SpecGenerationResult } from './types';

export interface ArchitectAgentDeps {
  executeLLM: (systemPrompt: string, userPrompt: string) => Promise<string>;
  readConstitution: () => Promise<string>;
  readMemory: (file: 'product' | 'structure' | 'tech') => Promise<string>;
}

export class ArchitectAgent {
  constructor(private readonly deps: ArchitectAgentDeps) {}

  /**
   * Generate plan.md from requirements.
   */
  public async generate(
    specDir: string,
    requirementsContent: string
  ): Promise<SpecGenerationResult> {
    const filePath = path.join(specDir, 'plan.md');

    const [constitution, structureMemory, techMemory] = await Promise.all([
      this.deps.readConstitution(),
      this.deps.readMemory('structure'),
      this.deps.readMemory('tech'),
    ]);

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(
      requirementsContent,
      constitution,
      structureMemory,
      techMemory
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
    return `You are the Architect Agent for ForgeAI, a spec-driven AI coding assistant.

Your job is to write a technical plan (plan.md) that implements the requirements. The plan must respect the project constitution (AGENTS.md) and existing codebase structure.

## What to Include
1. **Architecture Overview** — high-level design with component diagram (text-based)
2. **Data Model** — interfaces, schemas, state shapes
3. **API Contracts** — function signatures, message formats
4. **File Structure** — new files to create and where they go
5. **Library Selection** — which libraries to use (must be in AGENTS.md tech stack)
6. **Migration Strategy** — how to integrate with existing code
7. **Error Handling Strategy** — how errors are handled
8. **Testing Strategy** — what tests to write and where

## Rules
- All code must be TypeScript strict mode
- Respect AGENTS.md constraints (no cloud APIs, WCAG AA, etc.)
- Use existing patterns from the codebase
- Prefer composition over inheritance
- All async operations must have error handling
- No new runtime dependencies without justification

## Output Format
\`\`\`markdown
# Technical Plan: [Feature Name]

## 1. Architecture Overview
[Text-based component diagram]

## 2. Data Model
[TypeScript interfaces]

## 3. API Contracts
[Function signatures]

## 4. File Structure
[List of new files with paths]

## 5. Implementation Phases
[Ordered phases with milestones]

## 6. Testing Strategy
[What to test and how]

## 7. Error Handling
[Error types and recovery]
\`\`\``;
  }

  private buildUserPrompt(
    requirements: string,
    constitution: string,
    structureMemory: string,
    techMemory: string
  ): string {
    return `## Requirements
${requirements}

## Project Constitution
${constitution}

## Existing Codebase Structure
${structureMemory}

## Tech Stack
${techMemory}

## Instructions
Write a complete technical plan (plan.md). Include architecture, data model, API contracts, file structure, and testing strategy. Respect all constitution constraints.`;
  }
}
