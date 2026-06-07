/**
 * SpecWriter Agent
 * Generates requirements.md from clarifications + constitution using the Kiro template.
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
  /** Read a spec artifact */
  readSpec?: (specId: string) => Promise<{ config: any; artifacts: any } | null>;
  /** Write a spec artifact */
  writeSpecArtifact?: (specId: string, type: string, content: string) => Promise<void>;
  /** Logger */
  logger?: { info: (msg: string) => void; warn: (msg: string, err?: any) => void; error: (msg: string, err?: any) => void };
}

export class SpecWriterAgent {
  constructor(private readonly deps: SpecWriterAgentDeps) {}

  /**
   * Generate requirements.md from clarifications using Kiro template.
   * Generates section-by-section to enforce strict template structure.
   */
  public async generate(
    specDir: string,
    clarificationsContent: string,
    specId?: string
  ): Promise<SpecGenerationResult> {
    const filePath = path.join(specDir, 'requirements.md');

    const [constitution, productMemory, techMemory] = await Promise.all([
      this.deps.readConstitution(),
      this.deps.readMemory('product'),
      this.deps.readMemory('tech'),
    ]);

    const log = this.deps.logger?.info || console.log;
    const logWarn = this.deps.logger?.warn || console.warn;

    // Build sections from the Kiro template
    const sections = this.buildTemplateSections(specId || path.basename(specDir));

    const generatedSections: string[] = [];
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      log(`SpecWriter: requirements generation attempt ${attempt}/${maxAttempts}`);

      const escalation = attempt > 1 ? `\n\n⚠️ Attempt ${attempt}/${maxAttempts}: Follow the template EXACTLY. Do NOT deviate.` : '';

      for (const section of sections) {
        try {
          const content = await this.generateSection(
            section.systemPrompt,
            section.userPrompt,
            clarificationsContent,
            constitution,
            productMemory,
            techMemory,
            escalation
          );

          // Validate section has content and no placeholders
          if (!content || content.trim().length < 50) {
            throw new Error(`Section "${section.name}" is too short or empty`);
          }
          if (content.includes('{') && content.includes('}')) {
            throw new Error(`Section "${section.name}" still has placeholders`);
          }

          generatedSections.push(content);
          log(`SpecWriter: section "${section.name}" generated (${content.length} chars)`);
        } catch (err) {
          logWarn(`SpecWriter: section "${section.name}" failed on attempt ${attempt}: ${err instanceof Error ? err.message : err}`);
          if (attempt === maxAttempts) {
            // Generate fallback section at final attempt
            generatedSections.push(this.generateFallbackSection(section.name));
          }
        }
      }

      // Assemble final document
      const title = path.basename(specDir);
      const fullDoc = `# Requirements Document: ${title}\n\n${generatedSections.join('\n\n')}`;

      // Validate structure
      const missingSections = this.getMissingSections(fullDoc);
      if (missingSections.length === 0) {
        // Valid! Write to file and return
        fs.writeFileSync(filePath, fullDoc, 'utf-8');

        // Also write to spec artifacts if available
        if (this.deps.writeSpecArtifact && specId) {
          await this.deps.writeSpecArtifact(specId, 'requirements', fullDoc);
        }

        log(`SpecWriter: requirements written to ${filePath} (${fullDoc.length} chars)`);
        return { success: true, filePath, content: fullDoc };
      }

      logWarn(`SpecWriter: missing sections after attempt ${attempt}: ${missingSections.join(', ')}`);

      // Clear for retry
      generatedSections.length = 0;
    }

    // All attempts failed — return best effort
    const title = path.basename(specDir);
    const fallbackDoc = `# Requirements Document: ${title}\n\n${generatedSections.join('\n\n')}`;
    fs.writeFileSync(filePath, fallbackDoc, 'utf-8');
    return {
      success: false,
      filePath,
      content: fallbackDoc,
      error: 'Requirements generation had validation failures after all attempts',
    };
  }

  private buildTemplateSections(featureName: string): Array<{ name: string; systemPrompt: string; userPrompt: string }> {
    return [
      {
        name: 'Introduction',
        systemPrompt: `You are a senior product manager writing a requirements document.

# MANDATORY RULES
- Write ONLY the Introduction section
- 2-3 paragraphs describing what the feature is, why it exists, and what problem it solves
- Include stakeholders and high-level approach
- Include exactly ONE bold "**Key Constraint:**" line
- Output begins with "## Introduction"
- No placeholders, no "TBD", no bracketed fill-in text`,
        userPrompt: `Feature: ${featureName}\n\nClarifications:\n{clarifications}\n\nWrite ONLY the Introduction section for this requirements document.`,
      },
      {
        name: 'Glossary',
        systemPrompt: `You are a senior product manager writing a requirements document.

# MANDATORY RULES
- Write ONLY the Glossary section
- Define 8-12 domain-specific terms for THIS feature
- Format: "- **Term_Name**: Definition. (1-2 sentences each)"
- Output begins with "## Glossary"
- No placeholders`,
        userPrompt: `Feature: ${featureName}\n\nWrite ONLY the Glossary section. Define 8-12 terms specific to this feature.`,
      },
      {
        name: 'Requirements',
        systemPrompt: `You are a senior product manager writing a requirements document.

# MANDATORY RULES
- Write ONLY the Requirements section
- Create 8-15 numbered requirements (### Requirement N: Title)
- EACH requirement MUST have a User Story AND 5-8 EARS acceptance criteria
- EARS format: WHEN/THE/IF/THEN THE — all criteria must be specific and quantified
- NO implementation details (no "use PostgreSQL", "create API", etc.)
- NO styling/deployment/testing/CI/CD as requirements
- Separate each requirement with ---
- Output begins with "## Requirements"`,
        userPrompt: `Feature: ${featureName}\n\nClarifications:\n{clarifications}\n\nWrite ONLY the Requirements section with 8-15 EARS-notation requirements.`,
      },
      {
        name: 'Out of Scope',
        systemPrompt: `You are a senior product manager writing a requirements document.

# MANDATORY RULES
- Write ONLY the Out of Scope section
- Include 5-8 out-of-scope items (MUST have at least 5)
- Format: "N. **Item** — Why it's excluded"
- Use format "- **Constraint name**: Description" for Security Constraints
- Use format "- Text" for Timeline Constraints
- Output begins with "## Out of Scope"
- No placeholders`,
        userPrompt: `Feature: ${featureName}\n\nWrite ONLY the Out of Scope section with 5-8 items, Security Constraints, and Timeline Constraints.`,
      },
      {
        name: 'Non-Functional Requirements',
        systemPrompt: `You are a senior product manager writing a requirements document.

# MANDATORY RULES
- Write ONLY the Non-Functional Requirements section
- Include ALL 5 categories: Reliability, Performance, Usability, Maintainability, Cost
- Each category needs 2-3 bullets using EARS notation
- All requirements must be QUANTIFIED
- Output begins with "## Non-Functional Requirements"
- No placeholders`,
        userPrompt: `Feature: ${featureName}\n\nWrite ONLY the Non-Functional Requirements section with all 5 categories.`,
      },
    ];
  }

  private async generateSection(
    systemPrompt: string,
    userPrompt: string,
    clarifications: string,
    constitution: string,
    productMemory: string,
    techMemory: string,
    escalation: string
  ): Promise<string> {
    const filledUserPrompt = userPrompt
      .replace('{clarifications}', clarifications)
      .replace('{constitution}', constitution)
      .replace('{productMemory}', productMemory)
      .replace('{techMemory}', techMemory);

    const content = await this.deps.executeLLM(
      systemPrompt + escalation,
      filledUserPrompt
    );

    return content.trim();
  }

  private generateFallbackSection(name: string): string {
    return `## ${name}\n\n*[This section requires manual completion.]*`;
  }

  private getMissingSections(content: string): string[] {
    const required = [
      '# Requirements Document:',
      '## Introduction',
      '## Glossary',
      '## Requirements',
      '## Out of Scope',
      '## Non-Functional Requirements',
    ];
    return required.filter(section => !content.includes(section));
  }

  // ─── OLD API (kept for backward compat) ───────────────────────────────────
  // These methods are retained but the primary path is the Kiro-template flow above.

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

