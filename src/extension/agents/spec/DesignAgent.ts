/**
 * DesignAgent — generates design.md using the Kiro template structure.
 *
 * Responsibilities:
 *  - Read existing requirements via forgeai_readSpec
 *  - Generate Architecture, Components, Data Model, API, Error Handling, Security, Performance, Testing sections
 *  - Reference UIUX tools when design-system detail is needed
 *  - Write final artifact via forgeai_writeSpecArtifact
 */

import { BaseAgent } from '../BaseAgent';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { OllamaClient } from '../../ollama/OllamaClient';
import { Logger } from '../../utils/Logger';
import { SpecManager } from '../../forgeaiWorkspace/SpecManager';
import { getToolsForAgent, renderToolSection } from '../ToolCatalog';
import { getConfiguredModel } from '../../config/ModelConfig';

export interface DesignAgentInput {
  specId: string;
  title: string;
  description: string;
  requirements: string;
}

export interface DesignAgentOutput {
  specId: string;
  content: string;
  success: boolean;
  error?: string;
}

const DESIGN_SYSTEM_PROMPT = `# ROLE AND PURPOSE

You are a principal software architect.
Your task is to write a professional technical design document following the Kiro template format EXACTLY.

# OUTPUT DISCIPLINE
- Return ONLY valid Markdown
- Begin with "# Design Document: {SPEC_NAME}"
- Do NOT write preamble, conclusion, code fences around your output, or notes after finishing
- Stop writing once the final "## Testing Strategy" section is complete

# MANDATORY Section Structure (follow this exact order, use these exact headings)
1.  Title: "# Design Document: {SPEC_NAME}"
2.  ## Overview — One paragraph describing the high-level design approach.
    - ### Purpose — Enable {stakeholders} to: (bullet list of capabilities)
    - ### Key Technical Decisions — Table with columns: Decision | Choice | Rationale
    - ### Constraints — "- **{Constraint name}**: {Description}"
3.  ---
4.  ## Architecture
    - ### High-Level Architecture — ASCII or Mermaid component diagram
    - ### Component Diagram — Mermaid graph showing components and relationships
    - ### {Flow Name} Flow — Mermaid sequenceDiagram showing interaction flow
5.  ---
6.  ## Components and Interfaces
    - ### Core Components — Numbered sections ("#### N. {Component Name}") with description and TypeScript code block
7.  ---
8.  ## Data Model
    - ### {Entity Name} Schema — "- \`{fieldName}\`: \`{Type}\` — {Description}"
9.  ---
10. ## API Design
    - ### {Endpoint/Tool Name} — Purpose, Input schema, Output schema, Error cases
11. ---
12. ## Error Handling
    - ### {Error Category} — "- \`{ErrorType}\`: {When it occurs and how to handle it}"
13. ---
14. ## Security Model
    - ### Security Architecture — Layered approach (Layer 1: Input Validation, Layer 2: Context Isolation, etc.)
    - ### Security Rules — Numbered list (No External Transmission, Credential Protection, etc.)
15. ---
16. ## Performance Optimizations
    - ### Resource Management — Numbered list of techniques
    - ### Optimization Techniques — Bulleted list
17. ---
18. ## Testing Strategy
    - ### Property-Based Tests — "- **Property N: {Name}** — Validates: Requirements {numbers}"

# CRITICAL Negative Constraints — NEVER Do These
- NEVER create a section called "## Functional Requirements" or "## User Stories"
- NEVER write raw data fields as numbered requirements
- NEVER invent headings outside the mandatory list above

# Rules
- Use specific technology names relevant to the project's tech stack
- Include concrete type definitions, interface signatures, and request/response schemas
- Use Mermaid-compatible diagram descriptions
- Do NOT use placeholders, "TBD", or "TODO"
- Write in Markdown with proper headings, code blocks, and tables
- Replace {SPEC_NAME} with the actual feature name`;

export class DesignAgent extends BaseAgent {
  constructor(
    toolRegistry: ToolRegistry,
    ollamaClient: OllamaClient,
    logger: Logger,
    private readonly specManager: SpecManager
  ) {
    super(toolRegistry, ollamaClient, logger);
  }

  getName(): string {
    return 'DesignAgent';
  }

  getCapabilities(): string[] {
    return [
      'technical-design-generation',
      'architecture-design',
      'api-design',
      'data-modeling',
      'security-modeling',
      'mermaid-diagrams',
      'design-system-reference',
    ];
  }

  async execute(input: any): Promise<any> {
    return this.generate(input as DesignAgentInput);
  }

  async generate(input: DesignAgentInput): Promise<DesignAgentOutput> {
    return this.executeWithErrorHandling(async () => {
      const { specId, title, description, requirements } = input;

      const toolSection = renderToolSection(this.getName());
      const toolDefinitions = this.toolRegistry.getToolDefinitions();

      const userPrompt = this.buildUserPrompt(title, description, requirements);

      const response = await this.ollamaClient.chat({
        model: getConfiguredModel(),
        messages: [
          { role: 'system', content: toolSection + '\n\n' + DESIGN_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        tools: toolDefinitions,
        options: { temperature: 0.3 },
      });

      if (!('message' in response)) {
        throw new Error('Unexpected streaming response from Ollama');
      }

      const content = response.message.content.trim();
      return { specId, content, success: true };
    }, 'generate');
  }

  private buildUserPrompt(title: string, description: string, requirements: string): string {
    let prompt = `Write a complete technical design document for: "${title}"\n\n`;
    prompt += `Feature Description:\n${description}\n\n`;
    prompt += `Requirements Document (already approved):\n${requirements.slice(0, 4000)}\n\n`;
    prompt += `Write the design document now following the EXACT template below.\n`;
    prompt += `Replace all {placeholder} content with real, specific content for "${title}".\n`;
    prompt += `Keep the exact heading levels, horizontal rules (---), and section order.\n`;
    prompt += `Do NOT invent new sections or change the structure.\n\n`;
    prompt += `--- EXACT TEMPLATE TO FOLLOW ---\n`;
    prompt += this.specManager.designTemplate().replace(/{SPEC_NAME}/g, title);
    prompt += `\n--- END TEMPLATE ---\n`;

    prompt += `\n# OUTPUT DISCIPLINE\n`;
    prompt += `- Write ONLY the design document\n`;
    prompt += `- Begin with "# Design Document: ${title}"\n`;
    prompt += `- Do NOT write preamble, conclusion, code fences around output, or notes after finishing\n`;
    prompt += `- Stop writing once the final "## Testing Strategy" section is complete\n`;

    return prompt;
  }
}


