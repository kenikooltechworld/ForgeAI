/**
 * Clarifier Agent
 * Generates clarifying questions from a user's feature request.
 * Output: specs/NNN-feature/clarifications.md
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SpecGenerationResult } from './types';

export interface ClarifierAgentDeps {
  /** AgentLoop for LLM execution */
  executeLLM: (systemPrompt: string, userPrompt: string) => Promise<string>;
}

export class ClarifierAgent {
  constructor(private readonly deps: ClarifierAgentDeps) {}

  /**
   * Generate clarifying questions for a feature request.
   */
  public async generate(
    specDir: string,
    userRequest: string
  ): Promise<SpecGenerationResult> {
    const filePath = path.join(specDir, 'clarifications.md');

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(userRequest);

    try {
      const content = await this.deps.executeLLM(systemPrompt, userPrompt);
      fs.mkdirSync(specDir, { recursive: true });
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
    return `You are the Clarifier Agent for ForgeAI, a spec-driven AI coding assistant.

Your job is to analyze a user's feature request and generate 3-7 focused clarifying questions that will help write a precise, unambiguous specification.

## Rules
- Ask questions that eliminate ambiguity, not obvious ones
- Focus on: scope, constraints, user experience, edge cases, integrations
- Avoid asking questions that can be answered by reading AGENTS.md
- Format output as a markdown document with Q&A pairs
- For each question, suggest a reasonable default answer

## Output Format
Write a markdown file with this structure:
\`\`\`markdown
# Clarifications: [Feature Name]

## Context
[Brief summary of the feature request]

## Questions

### Q1: [Question title]
**Question:** [The clarifying question]
**Reason:** [Why this matters for the spec]
**Suggested Default:** [A reasonable default answer]
**User Answer:** [Leave blank — user fills this in]

[... repeat for each question ...]

## Out of Scope
[List of things explicitly not included]

## Assumptions
[List of assumptions being made]
\`\`\``;
  }

  private buildUserPrompt(userRequest: string): string {
    return `## Feature Request
${userRequest}

## Instructions
Generate clarifying questions for this feature request. Write the complete markdown output.`;
  }
}
