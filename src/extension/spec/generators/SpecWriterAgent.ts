/**
 * SpecWriter Agent
 * Generates requirements.md in EARS notation from clarifications + constitution.
 * Output: specs/NNN-feature/requirements.md
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SpecGenerationResult } from './types';

export interface SpecWriterAgentDeps {
  executeLLM: (systemPrompt: string, userPrompt: string) => Promise<string>;
  /** Read project constitution (AGENTS.md) */
  readConstitution: () => Promise<string>;
  /** Read memory bank files */
  readMemory: (file: 'product' | 'structure' | 'tech') => Promise<string>;
}

export class SpecWriterAgent {
  constructor(private readonly deps: SpecWriterAgentDeps) {}

  /**
   * Generate requirements.md from clarifications.
   */
  public async generate(
    specDir: string,
    clarificationsContent: string
  ): Promise<SpecGenerationResult> {
    const filePath = path.join(specDir, 'requirements.md');

    const [constitution, productMemory, techMemory] = await Promise.all([
      this.deps.readConstitution(),
      this.deps.readMemory('product'),
      this.deps.readMemory('tech'),
    ]);

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(
      clarificationsContent,
      constitution,
      productMemory,
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
    return `You are the SpecWriter Agent for ForgeAI, a spec-driven AI coding assistant.

Your job is to write requirements in EARS (Easy Approach to Requirements Syntax) notation. Every requirement must be testable and unambiguous.

## EARS Notation

- **Ubiquitous:** "The [system] SHALL [behavior]"
- **Event-driven:** "WHEN [trigger] THE [system] SHALL [response]"
- **State-driven:** "WHILE [state] THE [system] SHALL [behavior]"
- **Unwanted:** "IF [condition] THEN THE [system] SHALL [response]"
- **Optional:** "WHERE [feature-flag] THE [system] MAY [behavior]"

## Rules
- Number requirements as 1.1, 1.2, 2.1, etc.
- Group by functional area
- Each requirement MUST have at least one acceptance criterion
- Acceptance criteria use EARS notation
- Define what is IN scope and what is OUT of scope
- Reference the constitution for tech stack constraints
- No cloud API dependencies (Ollama only per constitution)

## Output Format
\`\`\`markdown
# Requirements: [Feature Name]

## 1. [Functional Area]
### 1.1 [Requirement Title]
**Description:** [What this requirement covers]
**Priority:** Must / Should / Could
**Acceptance Criteria:**
- [event-driven] WHEN [trigger] THE [system] SHALL [response]
- [ubiquitous] THE [system] SHALL [behavior]

## In Scope
- [...]

## Out of Scope
- [...]

## Constraints
- [...]

## Assumptions
- [...]
\`\`\``;
  }

  private buildUserPrompt(
    clarifications: string,
    constitution: string,
    productMemory: string,
    techMemory: string
  ): string {
    return `## Clarifications
${clarifications}

## Project Constitution (AGENTS.md)
${constitution}

## Product Context
${productMemory}

## Tech Stack Context
${techMemory}

## Instructions
Write a complete requirements.md file. Use EARS notation for all acceptance criteria. Number requirements sequentially. Include in-scope, out-of-scope, constraints, and assumptions sections.`;
  }
}
