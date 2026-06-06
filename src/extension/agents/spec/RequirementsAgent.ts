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

const REQUIREMENTS_INTRO_PROMPT = `You are a senior product manager. Write ONLY the Introduction section.`;

const REQUIREMENTS_GLOSSARY_PROMPT = `You are a senior product manager. Write ONLY the Glossary section.

# RULES
- Define 8-12 domain-specific terms relevant to THIS feature
- Use format: "- **Term_Name**: Definition."
- Each definition must be 1-2 sentences
- Do NOT include any other sections
- Do NOT use placeholders
- Minimum 8 terms`;

const REQUIREMENTS_REQUIREMENTS_PROMPT = `You are a senior product manager. Write ONLY the Requirements section using EARS notation.

# RULES
- Create 8-15 numbered requirements
- EACH requirement MUST have:
  - A clear title (user-facing capability, NOT implementation)
  - A User Story (As a [role], I want [action], so that [benefit])
  - 5-8 acceptance criteria using EARS notation
- EACH criterion must be SPECIFIC and QUANTIFIED
- Do NOT include implementation details (no "use PostgreSQL", "create API")
- Do NOT include styling, deployment, testing, or CI/CD as requirements
- Group related capabilities into ONE requirement
- Use EARS notation EXCLUSIVELY (no "should", "might", "can", "may")
- Separate each requirement with ---`;

const REQUIREMENTS_OUT_OF_SCOPE_PROMPT = `You are a senior product manager. Write ONLY the Out of Scope section.

# RULES
- Include 5-8 out-of-scope items (MUST have at least 5)
- Use format: "N. **{Item}** — {Why it's excluded}"
- Each item must have a clear reason for exclusion
- Do NOT include any other sections`;

const REQUIREMENTS_NFR_PROMPT = `You are a senior product manager. Write ONLY the Non-Functional Requirements section.

# RULES
- Include all 5 categories: Reliability, Performance, Usability, Maintainability, Cost
- Each category must have 2-3 bullets using EARS notation
- All requirements must be QUANTIFIED`;

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

    prompt += `Follow the EXACT template structure. Replace all {placeholder} content with real, specific content.\n`;
    prompt += `Keep exact heading levels and horizontal rules (---). Do NOT invent new sections.\n\n`;
    prompt += `--- EXACT TEMPLATE TO FOLLOW ---\n`;
    prompt += this.specManager.requirementsTemplate().replace(/{SPEC_NAME}/g, title);
    prompt += `\n--- END TEMPLATE ---\n`;

    prompt += `\n# SPEC TOOLS AVAILABLE TO YOU\n`;
    prompt += `You MAY reference specs in your document where appropriate. Example: "See spec ${context.existingSpecs[0]?.id || 'NNN-spec'} for related context."\n`;
    prompt += `- forgeai_listSpecs, forgeai_readSpec, forgeai_writeSpecArtifact, forgeai_createSpec, forgeai_continueSpec\n`;

    prompt += `\n# OUTPUT DISCIPLINE\n`;
    prompt += `- Write ONLY the requirements document\n`;
    prompt += `- Begin with "# Requirements Document: ${title}"\n`;
    prompt += `- Use EARS notation for acceptance criteria\n`;
    prompt += `- Do NOT write preamble, conclusion, code fences around output, or notes after finishing\n`;
    prompt += `- Stop writing once the final section is complete\n`;

    return prompt;
  }

  private async generateSection(
    sectionSystemPrompt: string,
    baseUserPrompt: string,
    sectionName: string,
    toolDefinitions: any[],
    baseSystemPrompt: string
  ): Promise<string> {
    const messages: any[] = [
      { role: 'system', content: baseSystemPrompt + '\n\n' + sectionSystemPrompt },
      { role: 'user', content: `${baseUserPrompt}\n\n--- SECTION INSTRUCTION ---\nWrite ONLY the ${sectionName} section now.` },
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



