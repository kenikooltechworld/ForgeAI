/**
 * RequirementsAgent — generates requirements.md via multi-step section generation.
 *
 * Responsibilities:
 *  - Run research via ResearchAgent
 *  - Build product/memory/spec context
 *  - Multi-step generation: Introduction → Glossary → Requirements → Out of Scope → NFR
 *  - Validate structure after each attempt
 *  - Write final artifact via forgeai_writeSpecArtifact
 */

import { BaseAgent } from '../BaseAgent';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { OllamaClient } from '../../ollama/OllamaClient';
import { Logger } from '../../utils/Logger';
import { SpecManager } from '../../forgeaiWorkspace/SpecManager';
import { ProductManager } from '../../forgeaiWorkspace/ProductManager';
import { MemoryManager } from '../../forgeaiWorkspace/MemoryManager';
import { ResearchAgent } from '../research/ResearchAgent';
import { ResearchSession } from '../research/ResearchSession';
import { renderToolSection } from '../../agents/ToolCatalog';
import { getConfiguredModel } from '../../config/ModelConfig';

const REQUIREMENTS_INTRO_PROMPT = `You are a senior product manager. Write ONLY the Introduction section.

# MANDATORY RULES
- Write as many paragraphs as needed to comprehensively cover the feature — minimum 5, NO upper limit
- Cover: what the feature is, why it exists, what problem it solves, the market/domain context, stakeholder landscape, technical approach, business value, constraints and dependencies
- Every paragraph MUST be feature-specific with real detail — no generic filler
- Be EXHAUSTIVE — the reader should understand the full picture after reading this section
- Include exactly ONE bold "**Key Constraint:**" line stating the single most important constraint
- Output starts with "## Introduction"
- Do NOT include any other sections
- Do NOT use placeholders like "TBD" or "{placeholder}"`;

const REQUIREMENTS_GLOSSARY_PROMPT = `You are a senior product manager. Write ONLY the Glossary section.

# MANDATORY RULES
- Define AS MANY domain-specific terms as needed to comprehensively cover every concept, role, component, and technical term used in this feature — NO upper limit
- Each definition must be 2-4 sentences with COMPLETE explanation of what the term is AND why it matters in the context of this specific feature
- Include every acronym, domain term, component name, user role, and technical concept that appears in the requirements
- Do NOT use generic/templated definitions — every definition must be specific to this feature
- Use format: "- **Term_Name**: Full definition. Context-specific explanation of relevance."
- Output starts with "## Glossary"
- Do NOT include any other sections
- Do NOT use placeholders`;

const REQUIREMENTS_REQUIREMENTS_PROMPT = `You are a senior product manager. Write ONLY the Requirements section using EARS notation.

# MANDATORY RULES
- Write AS MANY requirements as needed to cover EVERY capability, behavior, and constraint of the feature — NO upper limit
- Each requirement must have a DETAILED paragraph (3-5 sentences minimum) explaining the user need, the specific behavior, edge cases, and how it relates to other requirements
- Each requirement MUST have a User Story: "As a {role}, I want {action}, so that {benefit}"
- Each requirement MUST have AS MANY acceptance criteria as needed to fully define the behavior — minimum 8, NO upper limit
  - Mix of WHEN/THE, IF/THEN THE, WHILE/THE, and WHERE patterns
  - Each criterion must be SPECIFIC, QUANTIFIED, and TESTABLE with concrete numbers, time limits, error codes, retry counts, thresholds
  - Include boundary conditions, error paths, and exceptional scenarios
- Each requirement must specify WHO is affected (end users, admins, system operators, external services)
- Cover all functional behavior: user actions, system responses, data handling, integrations, error handling, edge cases
- Separate each requirement with ---
- Output starts with "## Requirements"
- Do NOT include implementation details (no "use PostgreSQL", "create API endpoint", "write a function")
- Do NOT include styling, deployment, testing infrastructure, or CI/CD as requirements
- Be EXHAUSTIVE — if a behavior is part of the feature, it MUST have a requirement`;

const REQUIREMENTS_OUT_OF_SCOPE_PROMPT = `You are a senior product manager. Write ONLY the Out of Scope section.

# MANDATORY RULES
- List AS MANY out-of-scope items as needed to clearly define the boundaries of this feature — NO upper limit
- Each item must have a DETAILED explanation (2-3 sentences minimum) of WHY it's excluded, what it would require, and what phase/future work it belongs to
- Be EXHAUSTIVE — it's better to over-define boundaries than to leave ambiguous scope creep
- Security Constraints: AS MANY as needed (minimum 8) with FULL explanations of security principles and what violations would look like
- Timeline Constraints: AS MANY as needed (minimum 6) explaining what's deferred to future phases, with detailed reasons (complexity, dependencies, ROI, risk)
- Output starts with "## Out of Scope"
- Do NOT include any other sections`;


const REQUIREMENTS_NFR_PROMPT = `You are a senior product manager. Write ONLY the Non-Functional Requirements section.

# MANDATORY RULES
- Include ALL 5 categories: Reliability, Performance, Usability, Maintainability, Cost
- Each category must have AS MANY requirements as needed — NO upper limit, minimum 8 per category
- Each requirement must include:
  - A specific QUANTIFIED target with concrete numbers, percentages, time limits, error rates
  - A clear measurement method (how to verify the requirement is met — tests, monitoring, benchmarks)
  - Context-specific rationale tied to THIS feature's actual use cases
- Every requirement must use EARS notation (WHEN/THE, IF/THEN, WHILE/THE)
- Every requirement must be VERIFIABLE — a tester must be able to confirm it passes or fails with objective evidence
- Cover every non-functional aspect: error rates, recovery times, data durability, response times (P50/P95/P99), throughput, memory usage, accessibility, code coverage, documentation, cost limits, resource efficiency
- Be EXHAUSTIVE — non-functional requirements define the quality bar for the entire feature
- Output starts with "## Non-Functional Requirements"
- Do NOT include any other sections`;

const REQUIREMENTS_CORRECTION_PROMPT = `CRITICAL: Your previous output was REJECTED.

# WHAT WENT WRONG:
{FAILURE_REASON}

# YOU MUST FIX THIS IMMEDIATELY:
1. Re-read the section prompt carefully
2. Follow the EXACT format specified
3. Do NOT deviate from the template
4. Do NOT include content from other sections
5. Do NOT use placeholders or TBD

# REGENERATE THE SECTION NOW:
{SECTION_PROMPT}

# USER INPUT:
{USER_INPUT}

IMPORTANT: Your output will be validated again.`;

export interface RequirementsAgentInput {
  title: string;
  description: string;
  specId: string;
  researchSession: ResearchSession;
}

export interface RequirementsAgentOutput {
  specId: string;
  content: string;
  success: boolean;
  error?: string;
}

export class RequirementsAgent extends BaseAgent {
  constructor(
    toolRegistry: ToolRegistry,
    ollamaClient: OllamaClient,
    logger: Logger,
    private readonly specManager: SpecManager,
    private readonly productManager: ProductManager,
    private readonly memoryManager: MemoryManager,
    private readonly researchAgent: ResearchAgent
  ) {
    super(toolRegistry, ollamaClient, logger);
  }

  getName(): string {
    return 'RequirementsAgent';
  }

  getCapabilities(): string[] {
    return [
      'requirements-generation',
      'multi-step-document-creation',
      'EARS-notation',
      'research-synthesis',
      'structure-validation',
    ];
  }

  async execute(input: any): Promise<any> {
    return this.generate(input as RequirementsAgentInput);
  }

  async generate(input: RequirementsAgentInput): Promise<RequirementsAgentOutput> {
    return this.executeWithErrorHandling(async () => {
      const { title, description, specId, researchSession } = input;

      const context = this.buildContext(title, description);
      const toolSection = renderToolSection(this.getName());
      // Filter to spec + research + file tools (requirements generation doesn't need git/browser)
      const allTools = this.toolRegistry.getToolDefinitions();
      const toolDefinitions = allTools.filter((t: any) =>
        ['forgeai_createSpec', 'forgeai_writeSpecArtifact', 'forgeai_readSpec', 'forgeai_listSpecs',
         'forgeai_continueSpec', 'forgeai_checkDrift', 'forgeai_deleteSpec',
         'forgeai_readFile', 'forgeai_listFiles', 'forgeai_searchInFiles', 'forgeai_findFile',
         'forgeai_webSearch', 'forgeai_webResearch', 'forgeai_fetchPage', 'forgeai_searchDocs',
        ].includes(t.function?.name)
      );

      const baseUserPrompt = this.buildBaseUserPrompt(title, description, context, researchSession);
      const systemPrompt = this.buildSystemPrompt(toolSection);

      const maxAttempts = 10;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        this.logInfo(`Requirements generation attempt ${attempt}/${maxAttempts}`);

        const escalation = attempt <= 3 ? '' : attempt <= 6
          ? '\n\n⚠️ This is attempt ' + attempt + '/10. Follow the template EXACTLY.'
          : attempt <= 8
            ? '\n\n🚨 FINAL WARNING (Attempt ' + attempt + '/10): Output ONLY the requested section.'
            : '\n\n🔴 LAST CHANCE (Attempt ' + attempt + '/10): Do NOT deviate. No extra text.';

        const sections: string[] = [];

        const intro = await this.generateSection(
          REQUIREMENTS_INTRO_PROMPT + escalation,
          baseUserPrompt,
          'Introduction',
          toolDefinitions,
          systemPrompt
        );
        sections.push(intro);

        const glossary = await this.generateSection(
          REQUIREMENTS_GLOSSARY_PROMPT + escalation,
          baseUserPrompt,
          'Glossary',
          toolDefinitions,
          systemPrompt
        );
        sections.push('---');
        sections.push(glossary);

        const requirements = await this.generateSection(
          REQUIREMENTS_REQUIREMENTS_PROMPT + escalation,
          baseUserPrompt,
          'Requirements',
          toolDefinitions,
          systemPrompt
        );
        sections.push('---');
        sections.push(requirements);

        const outOfScope = await this.generateSection(
          REQUIREMENTS_OUT_OF_SCOPE_PROMPT + escalation,
          baseUserPrompt,
          'Out of Scope',
          toolDefinitions,
          systemPrompt
        );
        sections.push('---');
        sections.push(outOfScope);

        const nfr = await this.generateSection(
          REQUIREMENTS_NFR_PROMPT + escalation,
          baseUserPrompt,
          'Non-Functional Requirements',
          toolDefinitions,
          systemPrompt
        );
        sections.push('---');
        sections.push(nfr);

        const finalDocument = `# Requirements Document: ${title}\n\n${sections.join('\n\n')}`;

        try {
          this.validateRequirementsStructure(finalDocument);
          this.logInfo('Requirements validation passed');
          return { specId, content: finalDocument, success: true };
        } catch (validationError) {
          const errorMsg = validationError instanceof Error ? validationError.message : String(validationError);
          this.logWarn(`Validation failed (attempt ${attempt}): ${errorMsg}`);

          if (attempt === maxAttempts) {
            return { specId, content: finalDocument, success: false, error: `Validation failed after ${maxAttempts} attempts: ${errorMsg}` };
          }
        }
      }

      throw new Error('Requirements generation failed: max attempts exceeded');
    }, 'generate');
  }

  private buildSystemPrompt(toolSection: string): string {
    return `${toolSection}

# ROLE AND PURPOSE

You are a senior product manager specializing in requirements engineering.
Your output is a formal, EARS-notation requirements document.

# OUTPUT DISCIPLINE
- Write ONLY the requirements document
- Begin with "# Requirements Document: {title}"
- Use EARS notation for all acceptance criteria
- Do NOT write preamble, conclusion, code fences, or post-completion notes
- Stop writing once the final Non-Functional Requirements section is complete`;
  }

  private buildBaseUserPrompt(
    title: string,
    description: string,
    context: {
      product: { name: string; description: string; techStack: string[]; goals: string[]; targetUsers: string } | null;
      memoryFindings: { title: string; content: string }[];
      existingSpecs: { id: string; title: string; status: string }[];
    },
    researchSession: ResearchSession
  ): string {
    let prompt = `Write a complete requirements specification for: "${title}"\n\n`;
    prompt += `Feature Description:\n${description}\n\n`;

    if (context.product) {
      prompt += `Project Context:\n`;
      prompt += `- Name: ${context.product.name}\n`;
      prompt += `- Description: ${context.product.description}\n`;
      prompt += `- Tech Stack: ${context.product.techStack.join(', ')}\n`;
      prompt += `- Goals: ${context.product.goals.join(', ')}\n`;
      prompt += `- Target Users: ${context.product.targetUsers}\n\n`;
    }

    if (context.memoryFindings.length > 0) {
      prompt += `Relevant Research Findings:\n`;
      for (const f of context.memoryFindings.slice(0, 8)) {
        prompt += `- ${f.title}: ${f.content.slice(0, 300)}\n`;
      }
      prompt += '\n';
    }

    const researchContext = this.researchAgent.buildSpecContext(researchSession);
    if (researchContext) {
      prompt += `Latest Research (industry standards, best practices, documentation):\n`;
      prompt += `${researchContext.slice(0, 15000)}\n\n`;
      prompt += `Use the research above to ensure requirements reflect current best practices.\n\n`;
    }

    if (context.existingSpecs.length > 0) {
      prompt += `Existing Specs in Project:\n`;
      for (const s of context.existingSpecs.slice(0, 10)) {
        prompt += `- ${s.id}: ${s.title} (${s.status})\n`;
      }
      prompt += '\n';
    }

    prompt += `You are generating ONE section of a requirements document.\n`;
    prompt += `The full template has these mandatory sections:\n`;
    prompt += `## Introduction | ## Glossary | ## Requirements | ## Out of Scope | ## Non-Functional Requirements\n`;
    prompt += `You will receive ONLY the template for your assigned section.\n`;
    prompt += `Fill every {placeholder} with specific, comprehensive content derived from the feature description.\n`;
    prompt += `Use EARS notation for all acceptance criteria.\n`;
    prompt += `Do NOT include placeholders like {placeholder} or "TBD" or "Continue for..." in your output.\n\n`;

    return prompt;
  }

  private async generateSection(
    sectionSystemPrompt: string,
    baseUserPrompt: string,
    sectionName: string,
    toolDefinitions: any[],
    baseSystemPrompt: string
  ): Promise<string> {
    // Extract ONLY the relevant section from the template
    const sectionTemplate = this.extractSectionTemplate(sectionName);

    const sectionUserPrompt = `${baseUserPrompt}\n\n--- SECTION TEMPLATE (fill THIS exact structure) ---\n${sectionTemplate}\n--- END SECTION TEMPLATE ---\n\n--- SECTION INSTRUCTION ---\nWrite ONLY the "${sectionName}" section now.\nFill every {placeholder} with comprehensive, feature-specific content.\nFollow the EXACT heading levels and structure shown above.\nDo NOT include any other sections.\nDo NOT leave placeholders.\nBegin directly with the section heading (e.g., "## Introduction").`;

    const messages: any[] = [
      { role: 'system', content: baseSystemPrompt + '\n\n' + sectionSystemPrompt },
      { role: 'user', content: sectionUserPrompt },
    ];

    const result = await (this as any).executeWithTools({
      messages,
      tools: toolDefinitions,
      maxIterations: 6,
    });

    const content = result.content.trim();
    if (!content) {
      throw new Error(`Empty response for ${sectionName} section`);
    }
    return content;
  }

  private extractSectionTemplate(sectionName: string): string {
    const fullTemplate = this.specManager.requirementsTemplate().replace(/{SPEC_NAME}/g, '{title}');
    const lines = fullTemplate.split('\n');
    const sectionHeaders: { [key: string]: string } = {
      'Introduction': '## Introduction',
      'Glossary': '## Glossary',
      'Requirements': '## Requirements',
      'Out of Scope': '## Out of Scope',
      'Non-Functional Requirements': '## Non-Functional Requirements',
    };

    const targetHeader = sectionHeaders[sectionName];
    if (!targetHeader) return fullTemplate;

    const startIdx = lines.findIndex(l => l.trim() === targetHeader);
    if (startIdx === -1) return fullTemplate;

    // Find the next ## section or end of document
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith('## ') && i > startIdx) {
        endIdx = i;
        break;
      }
    }

    return lines.slice(startIdx, endIdx).join('\n');
  }

  private buildContext(title: string, description: string) {
    const product = this.productManager.getOverview();
    const allMemory = this.memoryManager.list();
    const keywords = this.extractKeywords(`${title} ${description}`);
    const relevant = allMemory.filter(
      (m) =>
        keywords.some((kw) => m.title.toLowerCase().includes(kw) || m.content.toLowerCase().includes(kw)) ||
        m.tags.some((t) => keywords.includes(t.toLowerCase()))
    );
    const findings = relevant.length > 0 ? relevant : allMemory.slice(0, 5);
    const existingSpecs = this.specManager.listSpecs();
    return { product, memoryFindings: findings, existingSpecs };
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
      'need', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their',
      'system', 'feature', 'implement', 'create', 'build', 'add', 'new', 'user',
    ]);
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }

  private validateRequirementsStructure(content: string): void {
    const mandatorySections = [
      '# Requirements Document:',
      '## Introduction',
      '## Glossary',
      '## Requirements',
      '## Out of Scope',
      '## Non-Functional Requirements',
    ];

    const missingSections: string[] = [];
    for (const section of mandatorySections) {
      if (!content.includes(section)) {
        missingSections.push(section);
      }
    }

    if (missingSections.length > 0) {
      throw new Error(
        `Requirements validation failed. Missing sections: ${missingSections.join(', ')}`
      );
    }

    const requirementMatches = content.match(/### Requirement \d+:/g) || [];
    if (requirementMatches.length < 8) {
      throw new Error(
        `Requirements validation failed. Found only ${requirementMatches.length} requirements, need at least 8`
      );
    }

    const userStoryMatches = content.match(/\*\*User Story:\*\*/g) || [];
    if (userStoryMatches.length < requirementMatches.length) {
      throw new Error('Requirements validation failed. Not all requirements have user stories');
    }

    const glossarySection = content.match(/## Glossary\n([\s\S]*?)---/);
    if (glossarySection) {
      const termMatches = glossarySection[1].match(/^- \*\*/gm) || [];
      if (termMatches.length < 8) {
        throw new Error(
          `Requirements validation failed. Glossary has only ${termMatches.length} terms, need at least 8`
        );
      }
    }

    const outOfScopeSection = content.match(/## Out of Scope\n([\s\S]*?)---/);
    if (outOfScopeSection) {
      const itemMatches = outOfScopeSection[1].match(/^\d+\. \*\*/gm) || [];
      if (itemMatches.length < 5) {
        throw new Error(
          `Requirements validation failed. Out of Scope has only ${itemMatches.length} items, need at least 5`
        );
      }
    }
  }

  private logWarn(msg: string): void {
    this.logger.warn(msg);
  }
}



