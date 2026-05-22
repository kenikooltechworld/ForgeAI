import { SpecManager, SpecConfig } from '../../forgeaiWorkspace/SpecManager';
import { ProductManager, ProductOverview } from '../../forgeaiWorkspace/ProductManager';
import { MemoryManager, MemoryEntry } from '../../forgeaiWorkspace/MemoryManager';
import { ResearchAgent } from '../research/ResearchAgent';
import { ResearchSession } from '../research/ResearchSession';

export type SpecGenerationMode = 'full' | 'quick';

export interface SpecWriterInput {
  title: string;
  description: string;
  mode: SpecGenerationMode;
}

export interface SpecWriterOutput {
  specId: string;
  title: string;
  phasesCompleted: ('requirements' | 'design' | 'tasks' | 'bugfix')[];
  success: boolean;
  error?: string;
  /** The generated artifact content for the phase that was just completed */
  content?: string;
}

export interface SpecWriterDeps {
  executeLLM: (systemPrompt: string, userPrompt: string) => Promise<string>;
  specManager: SpecManager;
  productManager: ProductManager;
  memoryManager: MemoryManager;
  researchAgent: ResearchAgent;
}

/**
 * Section-specific prompts for multi-step requirements generation
 * Each section is generated separately to ensure quality and structure
 */

const REQUIREMENTS_CORRECTION_PROMPT = `CRITICAL: Your previous output was REJECTED because it violated the requirements specification.

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

IMPORTANT: Your output will be validated again. If it fails validation, you will be rejected again.
This is your chance to fix it. Do it correctly this time.`;

const REQUIREMENTS_INTRO_PROMPT = `You are a senior product manager. Write ONLY the Introduction section.

# RULES:
- Write ONLY the Introduction section
- Write 2-3 paragraphs describing what the feature is, why it exists, and what problem it solves
- Include ONE bold **Key Constraint** line
- Do NOT include any other sections
- Do NOT use placeholders like "TBD" or "{placeholder}" in the final output
- Do NOT write more than 3 paragraphs`;

const REQUIREMENTS_GLOSSARY_PROMPT = `You are a senior product manager. Write ONLY the Glossary section.

# RULES:
- Write ONLY the Glossary section
- Define 8-12 domain-specific terms relevant to THIS feature
- Use format: "- **Term_Name**: Definition."
- Each definition must be 1-2 sentences
- Do NOT include any other sections
- Do NOT use placeholders
- Do NOT write fewer than 8 terms`;

const REQUIREMENTS_REQUIREMENTS_PROMPT = `You are a senior product manager. Write ONLY the Requirements section using EARS notation.

# RULES:
- Write ONLY the Requirements section
- Create 8-15 numbered requirements
- EACH requirement MUST have:
  - A clear title (user-facing capability, NOT implementation)
  - A User Story (As a [role], I want [action], so that [benefit])
  - 5-8 acceptance criteria using EARS notation
- EACH criterion must be SPECIFIC and QUANTIFIED (times, counts, percentages)
- Do NOT include implementation details (no "use PostgreSQL", "create API", "use Tailwind")
- Do NOT include styling, deployment, testing, or CI/CD as requirements
- Do NOT create requirements for CRUD operations (those are implementation tasks)
- Group related capabilities into ONE requirement (not separate requirements for each operation)
- Use EARS notation EXCLUSIVELY (no "should", "might", "can", "may")
- Separate each requirement with ---
- Do NOT use placeholders or TBD
- Do NOT include any other sections`;

const REQUIREMENTS_OUT_OF_SCOPE_PROMPT = `You are a senior product manager. Write ONLY the Out of Scope section.

# RULES:
- Write ONLY the Out of Scope section
- Include 5-8 out-of-scope items (MUST have at least 5)
- Use format: "N. **{Item}** — {Why it's excluded}"
- Each item must have a clear reason for exclusion
- Do NOT include any other sections
- Do NOT use placeholders
- Do NOT write fewer than 5 items`;

const REQUIREMENTS_NFR_PROMPT = `You are a senior product manager. Write ONLY the Non-Functional Requirements section.

# RULES:
- Write ONLY the Non-Functional Requirements section
- Include all 5 categories: Reliability, Performance, Usability, Maintainability, Cost
- Each category must have 2-3 bullets using EARS notation
- All requirements must be QUANTIFIED (percentages, times, counts, sizes)
- Do NOT include any other sections
- Do NOT use placeholders
- Do NOT write fewer than 2 bullets per category`;

const REQUIREMENTS_INTRO_PROMPT_OLD = `You are a senior product manager writing the Introduction section of a requirements document.

Your ONLY job is to write the Introduction section. NOTHING ELSE.

# EXACT OUTPUT FORMAT (follow this EXACTLY):

## Introduction

[2-3 paragraphs describing:]
1. WHAT this feature is (user-facing capability, not implementation)
2. WHY it exists (problem it solves, business value)
3. WHO uses it (end user, AI agent, system)

Then add ONE bold **Key Constraint** line.

# EXAMPLE (from Kiro browser-capability):

## Introduction

This document defines the requirements for the Browser Capability feature in ForgeAI. The Browser Capability enables the ForgeAI AI agent to perform real web browsing for research and information gathering - NOT for testing, but for actual autonomous navigation, interaction, and data extraction from live websites.

The feature uses Playwright for browser automation, integrated via the Model Context Protocol (MCP) to allow the AI agent to control browsers naturally. This enables use cases like researching API documentation, finding tutorials, checking GitHub issues, and comparing pricing across websites.

**Key Constraint:** The implementation must be free and run locally with zero cloud service costs.

# CRITICAL RULES:
- Write ONLY the Introduction section
- Include exactly 2-3 paragraphs
- Include ONE bold **Key Constraint** line
- Do NOT include any other sections
- Do NOT use placeholders like "TBD" or "{placeholder}"`;

/**
 * System prompt for generating design.md
 */
/**
 * System prompt for neurosymbolic requirements analysis
 * Detects ambiguity, gaps, contradictions, and unstated assumptions.
 */
const REQUIREMENTS_ANALYSIS_PROMPT = `You are a requirements analyst performing neurosymbolic analysis on a requirements document.

Your job is to find SPECIFIC, ACTIONABLE problems in the requirements text below.
Do not say "looks good" — find issues. If truly none, say so explicitly.

# Analysis Categories

## 1. Ambiguity (Neuro-symbolic sampling)
Find phrases that could reasonably be interpreted two different ways by a developer.
For each ambiguity:
  - Quote the ambiguous phrase
  - Give Interpretation A (what the author likely meant)
  - Give Interpretation B (what a developer might reasonably think)
  - Propose a rewrite that eliminates the ambiguity

## 2. Logical Gaps
Find missing acceptance criteria, boundary conditions, or error paths.
For each gap:
  - State what's missing
  - Suggest the specific criterion that should be added

## 3. Contradictions
Find pairs of requirements that conflict with each other.
For each contradiction:
  - Quote both conflicting requirements
  - Explain the conflict
  - Propose a resolution

## 4. Unstated Assumptions
Find assumptions the author made but did not write down.
For each assumption:
  - State the assumption
  - Explain why it should be made explicit

# Output Format
Return ONLY valid Markdown. Use this exact structure:

## Ambiguities Found: N

### Ambiguity 1
- **Phrase:** "..."
- **Interpretation A:** ...
- **Interpretation B:** ...
- **Proposed Fix:** ...

(etc.)

## Gaps Found: N

### Gap 1
...

## Contradictions Found: N

### Contradiction 1
...

## Unstated Assumptions: N

### Assumption 1
...

If a category has zero findings, write "None found." under that heading.
Do NOT include any preamble, introduction, or conclusion outside the headings above.`;

const BUGFIX_SYSTEM_PROMPT = `You are a senior software engineer performing a rigorous bugfix analysis.
Your task is to produce a bugfix specification that serves as the single source of truth for correcting a defect.

# Rules
- Write with surgical precision — current behavior vs expected behavior must be unambiguous
- Use concrete examples, stack traces, reproduction steps, and affected file paths
- Include a "What MUST NOT change" section to prevent collateral damage
- Each fix must be traceable back to a root cause analysis
- Do NOT use placeholders, "TBD", or "TODO"

# Output Format
Return ONLY valid Markdown with the following sections:

# Bug Title

## Current Behavior
Describe exactly what happens today with evidence (logs, screenshots, reproduction steps).

## Expected Behavior
Describe exactly what should happen instead.

## Root Cause Analysis
Provide a concise technical explanation of why the bug occurs.

## Reproduction Steps
1. Step one...
2. Step two...

## Affected Code
List specific files, functions, or modules that are involved.

## What MUST NOT Change
Explicitly list behavior, APIs, or data formats that must remain untouched during the fix.

## Fix Tasks
- [ ] Task 1: description
- [ ] Task 2: description`;

const DESIGN_SYSTEM_PROMPT = `You are a principal software architect.
Your task is to write a professional technical design document following the Kiro template format EXACTLY.

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
    - ### Core Components — Numbered sections ("#### N. {Component Name}") with description and TypeScript code block showing the full interface/class with JSDoc
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
- NEVER create a section called "## Functional Requirements" or "## User Stories" — those belong in requirements.md
- NEVER write raw data fields as numbered requirements — the design document describes architecture, not behavioral requirements
- NEVER invent headings outside the mandatory list above

# Rules
- Use specific technology names and patterns relevant to the project's tech stack
- Include concrete type definitions, interface signatures, and request/response schemas
- Use Mermaid-compatible diagram descriptions
- Do NOT use placeholders, "TBD", or "TODO" — write complete, specific content
- Do NOT omit any of the mandatory sections above
- Write in Markdown with proper headings, code blocks, and tables
- Replace {SPEC_NAME} with the actual feature name in the title

# Output Format
Return ONLY valid Markdown. No JSON, no explanation, no preamble. Start with the title heading.
Before finishing, verify your output matches the EXACT template structure provided in the user prompt.`;

/**
 * System prompt for generating tasks.md
 */
const TASKS_SYSTEM_PROMPT = `You are a senior engineering lead breaking down a design into discrete, trackable implementation tasks following the Kiro template format EXACTLY.

# MANDATORY Section Structure (follow this exact order, use these exact headings)
1.  Title: "# Implementation Plan: {SPEC_NAME}"
2.  ## Overview — One paragraph describing what is being built.
    - **Estimated Total Duration**: {N} {weeks/days}
3.  ---
4.  ## Phase N: {Phase Title} ({Timeframe})
    Each phase contains numbered tasks ("### Task N.M: {Task Title}") with these exact fields:
    - **Priority**: Critical | High | Medium | Low
    - **Estimate**: {N} {days/hours}
    - **Dependencies**: None | Task X.Y | Task X.Y, Task Z.W
    - **Description**: {What this task accomplishes}
    - **Subtasks**: Checklist "- [ ] {Subtask}"
    - **Acceptance Criteria**: Checklist "- [ ] {Criterion linking to requirement}"
    - **Verification**: Checklist "- [ ] {How to verify}"
    - **Implements**: Requirement {X.Y}, {X.Y}
    - Separate each task with ---
    Order phases by dependency (Phase 1: setup/infrastructure, Phase 2: core implementation, Phase 3: integration/testing, etc.)

# CRITICAL Negative Constraints — NEVER Do These
- NEVER create a section called "## Functional Requirements" or "## User Stories" — those belong in requirements.md
- NEVER describe data models or API schemas as tasks — tasks are implementation actions, not specifications
- NEVER invent headings outside the mandatory list above

# Rules
- Each task must be atomic (one developer can complete it in 1-4 hours)
- Tasks must reference specific requirements by ID or description
- Include file paths and function/class names where applicable
- Order tasks by dependency (setup/infrastructure first, independent next, integration last)
- Do NOT use placeholders, "TBD", or "TODO" — write complete, specific content
- Do NOT omit any of the mandatory sections above
- Use checkboxes for subtasks and acceptance criteria: "- [ ] ..."
- Replace {SPEC_NAME} with the actual feature name in the title

# Output Format
Return ONLY valid Markdown. No JSON, no explanation, no preamble. Start with the title heading.
Before finishing, verify your output matches the EXACT template structure provided in the user prompt.`;

/**
 * SpecWriterAgent — generates complete, professional specs via LLM.
 *
 * Flow:
 *  1. Gather context (product overview, memory findings, existing specs)
 *  2. Generate requirements.md (EARS notation, user stories)
 *  3. Generate design.md (architecture, data models, API endpoints)
 *  4. Generate tasks.md (discrete implementation steps)
 *  5. Save all artifacts via SpecManager
 */
export class SpecWriterAgent {
  private deps: SpecWriterDeps;

  constructor(deps: SpecWriterDeps) {
    this.deps = deps;
  }

  /**
   * Generate requirements.md using multi-step section-by-section approach.
   * Each section is generated separately to ensure quality and structure.
   * Includes validation and regeneration if needed.
   */
  private async generateRequirementsMultiStep(
    title: string,
    description: string,
    context: any,
    researchSession: any,
    onProgress?: (msg: string) => void
  ): Promise<string> {
    const featureName = title.replace(/\s+/g, '_');
    const maxAttempts = 10;

    // Build the FULL user prompt with Kiro template, research, product context, etc.
    // This was previously dead code — buildRequirementsUserPrompt injects the actual template.
    const baseUserPrompt = this.buildRequirementsUserPrompt(
      title,
      description,
      context,
      researchSession
    );

    // Escalating prompt intensity levels
    const getEscalatedPrompt = (basePrompt: string, attemptNumber: number): string => {
      if (attemptNumber <= 3) {
        return basePrompt; // Use base prompt for first 3 attempts
      } else if (attemptNumber <= 6) {
        // Attempts 4-6: Add aggressive emphasis
        return `${basePrompt}\n\n⚠️ CRITICAL: This is attempt ${attemptNumber}/10. Your previous output was rejected. Follow the template EXACTLY. Do NOT deviate.`;
      } else if (attemptNumber <= 8) {
        // Attempts 7-8: Maximum aggression
        return `${basePrompt}\n\n🚨 FINAL WARNING (Attempt ${attemptNumber}/10): You MUST follow the template EXACTLY. Every word matters. Do NOT add extra content. Do NOT use placeholders. Output ONLY the section requested.`;
      } else {
        // Attempts 9-10: Extreme emphasis
        return `${basePrompt}\n\n🔴 LAST CHANCE (Attempt ${attemptNumber}/10): This is your final attempt. Follow the template EXACTLY. Do NOT deviate even slightly. Output ONLY the requested section with NO extra text.`;
      }
    };

    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
      try {
        const sections: string[] = [];

        // Step 1: Generate Introduction
        onProgress?.(`Generating Introduction section (attempt ${attempts}/${maxAttempts})...`);
        const intro = await this.generatePhase(
          getEscalatedPrompt(REQUIREMENTS_INTRO_PROMPT, attempts),
          `${baseUserPrompt}\n\n--- SECTION INSTRUCTION ---\nWrite ONLY the Introduction section. Include 2-3 paragraphs and ONE bold **Key Constraint** line. Do NOT include any other sections.`
        );
        sections.push(intro);

        // Step 2: Generate Glossary
        onProgress?.(`Generating Glossary section (attempt ${attempts}/${maxAttempts})...`);
        const glossary = await this.generatePhase(
          getEscalatedPrompt(REQUIREMENTS_GLOSSARY_PROMPT, attempts),
          `${baseUserPrompt}\n\n--- SECTION INSTRUCTION ---\nWrite ONLY the Glossary section. Define 8-12 domain-specific terms relevant to "${title}" using format: "- **Term_Name**: Definition." Do NOT include any other sections.`
        );
        sections.push('---');
        sections.push(glossary);

        // Step 3: Generate Requirements
        onProgress?.(`Generating Requirements section (attempt ${attempts}/${maxAttempts})...`);
        const requirements = await this.generatePhase(
          getEscalatedPrompt(REQUIREMENTS_REQUIREMENTS_PROMPT, attempts),
          `${baseUserPrompt}\n\n--- SECTION INSTRUCTION ---\nWrite ONLY the Requirements section. Create 8-15 numbered requirements for "${title}". EACH requirement MUST have a clear title, a User Story, and 5-8 acceptance criteria using EARS notation. Use EARS notation EXCLUSIVELY. Separate each requirement with ---. Do NOT include any other sections.`
        );
        sections.push('---');
        sections.push(requirements);

        // Step 4: Generate Out of Scope
        onProgress?.(`Generating Out of Scope section (attempt ${attempts}/${maxAttempts})...`);
        const outOfScope = await this.generatePhase(
          getEscalatedPrompt(REQUIREMENTS_OUT_OF_SCOPE_PROMPT, attempts),
          `${baseUserPrompt}\n\n--- SECTION INSTRUCTION ---\nWrite ONLY the Out of Scope section. Include 5-8 out-of-scope items for "${title}". Use format: "N. **{Item}** — {Why it's excluded}". Do NOT include any other sections.`
        );
        sections.push('---');
        sections.push(outOfScope);

        // Step 5: Generate Non-Functional Requirements
        onProgress?.(
          `Generating Non-Functional Requirements section (attempt ${attempts}/${maxAttempts})...`
        );
        const nfr = await this.generatePhase(
          getEscalatedPrompt(REQUIREMENTS_NFR_PROMPT, attempts),
          `${baseUserPrompt}\n\n--- SECTION INSTRUCTION ---\nWrite ONLY the Non-Functional Requirements section. Include all 5 categories (Reliability, Performance, Usability, Maintainability, Cost) for "${title}". Each category must have 2-3 bullets using EARS notation. All requirements must be QUANTIFIED. Do NOT include any other sections.`
        );
        sections.push('---');
        sections.push(nfr);

        // Assemble final document
        const finalDocument = `# Requirements Document: ${title}\n\n${sections.join('\n\n')}`;

        // Validate structure
        try {
          this.validateRequirementsStructure(finalDocument);
          onProgress?.('✅ Requirements validation passed!');
          return finalDocument;
        } catch (validationError) {
          const errorMsg =
            validationError instanceof Error ? validationError.message : 'Unknown error';
          onProgress?.(
            `⚠️ Validation failed (attempt ${attempts}/${maxAttempts}): ${errorMsg}. Retrying with more aggressive prompts...`
          );
          if (attempts === maxAttempts) {
            throw validationError;
          }
          // Continue to next attempt with escalated prompts
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        onProgress?.(
          `⚠️ Generation error (attempt ${attempts}/${maxAttempts}): ${errorMsg}. Retrying...`
        );
        if (attempts === maxAttempts) {
          throw new Error(
            `Multi-step requirements generation failed after ${maxAttempts} attempts: ${errorMsg}`
          );
        }
      }
    }

    throw new Error('Multi-step requirements generation failed: max attempts exceeded');
  }

  /**
   * Validate that requirements document has all mandatory sections.
   * Throws error if validation fails.
   */
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

    // Validate that requirements have user stories
    const requirementMatches = content.match(/### Requirement \d+:/g) || [];
    if (requirementMatches.length < 8) {
      throw new Error(
        `Requirements validation failed. Found only ${requirementMatches.length} requirements, need at least 8`
      );
    }

    // Validate that each requirement has a user story
    const userStoryMatches = content.match(/\*\*User Story:\*\*/g) || [];
    if (userStoryMatches.length < requirementMatches.length) {
      throw new Error(`Requirements validation failed. Not all requirements have user stories`);
    }

    // Validate glossary has enough terms
    const glossarySection = content.match(/## Glossary\n([\s\S]*?)---/);
    if (glossarySection) {
      const termMatches = glossarySection[1].match(/^- \*\*/gm) || [];
      if (termMatches.length < 8) {
        throw new Error(
          `Requirements validation failed. Glossary has only ${termMatches.length} terms, need at least 8`
        );
      }
    }

    // Validate out of scope has enough items
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

  /**
   * Generate a spec from a title and description.
   *
   * Mode 'full': generates only requirements + analysis, then stops and
   *   sets pending approval. The caller must trigger `continue()` after
   *   human approval to generate design, then tasks.
   * Mode 'quick': generates all three phases in one shot and auto-approves.
   */
  async generate(
    input: SpecWriterInput,
    onProgress?: (event: {
      phase: 'requirements' | 'design' | 'tasks';
      status: 'generating' | 'completed' | 'failed';
      message: string;
    }) => void
  ): Promise<SpecWriterOutput> {
    const { title, description, mode } = input;
    const specId = this.generateNextSpecId();

    try {
      // 1. Gather context
      const context = this.buildContext(title, description);

      // 2. Research phase (RAG → cache → web search)
      const researchSession = await this.runResearch(title, description, (msg) =>
        onProgress?.({
          phase: 'requirements',
          status: 'generating',
          message: msg,
        })
      );

      // 3. Update product overview from research if no existing product context
      await this.updateProductFromResearch(researchSession);

      // 4. Generate requirements using multi-step approach
      onProgress?.({
        phase: 'requirements',
        status: 'generating',
        message: 'Writing requirements with EARS acceptance criteria (multi-step generation)...',
      });
      const requirements = await this.generateRequirementsMultiStep(
        title,
        description,
        context,
        researchSession,
        (msg) =>
          onProgress?.({
            phase: 'requirements',
            status: 'generating',
            message: msg,
          })
      );
      this.deps.specManager.createSpec(specId, title);
      this.deps.specManager.writeArtifact(specId, 'requirements', requirements);
      onProgress?.({
        phase: 'requirements',
        status: 'completed',
        message: 'Requirements document complete',
      });

      const phasesCompleted: ('requirements' | 'design' | 'tasks')[] = ['requirements'];

      // 5. Neurosymbolic requirements analysis (before design)
      onProgress?.({
        phase: 'requirements',
        status: 'generating',
        message: 'Analyzing requirements for ambiguity, gaps, and contradictions...',
      });
      const analysis = await this.analyzeRequirements(requirements);
      this.deps.specManager.writeArtifact(specId, 'requirements-analysis', analysis);
      onProgress?.({
        phase: 'requirements',
        status: 'completed',
        message: 'Requirements analysis complete — review before continuing to design',
      });

      // ─── Full mode: STOP HERE. Design and tasks are generated later via continue() ───
      if (mode !== 'quick') {
        this.deps.specManager.setPendingApproval(specId, 'requirements');
        return { specId, title, phasesCompleted, success: true };
      }

      // ─── Quick mode: generate all remaining phases in one shot ───
      // 6. Generate design
      onProgress?.({
        phase: 'design',
        status: 'generating',
        message: 'Writing technical design with architecture and API specs...',
      });
      const design = await this.generatePhase(
        DESIGN_SYSTEM_PROMPT,
        this.buildDesignUserPrompt(title, description, context, requirements)
      );
      this.deps.specManager.writeArtifact(specId, 'design', design);
      onProgress?.({
        phase: 'design',
        status: 'completed',
        message: 'Design document complete',
      });
      phasesCompleted.push('design');

      // 7. Generate tasks
      onProgress?.({
        phase: 'tasks',
        status: 'generating',
        message: 'Breaking design into discrete implementation tasks...',
      });
      const tasks = await this.generatePhase(
        TASKS_SYSTEM_PROMPT,
        this.buildTasksUserPrompt(title, description, context, requirements, design)
      );
      this.deps.specManager.writeArtifact(specId, 'tasks', tasks);
      onProgress?.({
        phase: 'tasks',
        status: 'completed',
        message: 'Tasks document complete',
      });
      phasesCompleted.push('tasks');

      // Quick mode: auto-approve all phases
      this.deps.specManager.approvePhase(specId, 'requirements');
      this.deps.specManager.approvePhase(specId, 'design');
      this.deps.specManager.approvePhase(specId, 'tasks');

      return { specId, title, phasesCompleted, success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during spec generation';
      onProgress?.({
        phase: 'tasks',
        status: 'failed',
        message: errorMessage,
      });
      return { specId, title, phasesCompleted: [], success: false, error: errorMessage };
    }
  }

  /**
   * Continue an existing spec by generating the next missing phase.
   * Uses already-approved previous phases as context.
   */
  async continue(
    specId: string,
    onProgress?: (event: {
      phase: 'requirements' | 'design' | 'tasks' | 'bugfix';
      status: 'generating' | 'completed' | 'failed';
      message: string;
    }) => void
  ): Promise<SpecWriterOutput> {
    const spec = this.deps.specManager.loadSpec(specId);
    if (!spec) {
      return {
        specId,
        title: '',
        phasesCompleted: [],
        success: false,
        error: `Spec ${specId} not found`,
      };
    }

    const { config, artifacts } = spec;
    const title = config.title;
    const description = config.title;

    // Bugfix workflow: single-phase generation
    if (config.workflow === 'bugfix') {
      return this.generateBugfix(specId, title, description, artifacts.bugfix, onProgress);
    }

    const order: Array<'requirements' | 'design' | 'tasks'> = ['requirements', 'design', 'tasks'];
    // Determine next missing phase from phasesCompleted (not currentPhase)
    const nextPhase = order.find((p) => !config.phasesCompleted.includes(p));
    if (!nextPhase) {
      return { specId, title, phasesCompleted: config.phasesCompleted, success: true };
    }
    const phasesCompleted = [...config.phasesCompleted];

    try {
      const context = this.buildContext(title, description);

      if (nextPhase === 'requirements') {
        // Run research before generating requirements
        const researchSession = await this.runResearch(title, description, (msg) =>
          onProgress?.({
            phase: 'requirements',
            status: 'generating',
            message: msg,
          })
        );
        await this.updateProductFromResearch(researchSession);

        onProgress?.({
          phase: 'requirements',
          status: 'generating',
          message: 'Writing requirements with EARS acceptance criteria (multi-step generation)...',
        });
        const requirements = await this.generateRequirementsMultiStep(
          title,
          description,
          context,
          researchSession,
          (msg) =>
            onProgress?.({
              phase: 'requirements',
              status: 'generating',
              message: msg,
            })
        );
        this.deps.specManager.writeArtifact(specId, 'requirements', requirements);
        onProgress?.({
          phase: 'requirements',
          status: 'completed',
          message: 'Requirements document complete',
        });
        phasesCompleted.push('requirements');

        // Neurosymbolic requirements analysis (before design)
        onProgress?.({
          phase: 'requirements',
          status: 'generating',
          message: 'Analyzing requirements for ambiguity, gaps, and contradictions...',
        });
        const analysis = await this.analyzeRequirements(requirements);
        this.deps.specManager.writeArtifact(specId, 'requirements-analysis', analysis);
        onProgress?.({
          phase: 'requirements',
          status: 'completed',
          message: 'Requirements analysis complete',
        });

        return { specId, title, phasesCompleted, success: true, content: requirements };
      } else if (nextPhase === 'design') {
        const requirements = artifacts.requirements || '';
        onProgress?.({
          phase: 'design',
          status: 'generating',
          message: 'Writing technical design with architecture and API specs...',
        });
        const design = await this.generatePhase(
          DESIGN_SYSTEM_PROMPT,
          this.buildDesignUserPrompt(title, description, context, requirements)
        );
        this.deps.specManager.writeArtifact(specId, 'design', design);
        onProgress?.({
          phase: 'design',
          status: 'completed',
          message: 'Design document complete',
        });
        phasesCompleted.push('design');

        return { specId, title, phasesCompleted, success: true, content: design };
      } else if (nextPhase === 'tasks') {
        const requirements = artifacts.requirements || '';
        const design = artifacts.design || '';
        onProgress?.({
          phase: 'tasks',
          status: 'generating',
          message: 'Breaking design into discrete implementation tasks...',
        });
        const tasks = await this.generatePhase(
          TASKS_SYSTEM_PROMPT,
          this.buildTasksUserPrompt(title, description, context, requirements, design)
        );
        this.deps.specManager.writeArtifact(specId, 'tasks', tasks);
        onProgress?.({
          phase: 'tasks',
          status: 'completed',
          message: 'Tasks document complete',
        });
        phasesCompleted.push('tasks');

        return { specId, title, phasesCompleted, success: true, content: tasks };
      }

      return { specId, title, phasesCompleted, success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during spec continuation';
      onProgress?.({
        phase: nextPhase,
        status: 'failed',
        message: errorMessage,
      });
      return {
        specId,
        title,
        phasesCompleted: config.phasesCompleted,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate a complete bugfix analysis from current draft content.
   */
  private async generateBugfix(
    specId: string,
    title: string,
    description: string,
    draftBugfix: string,
    onProgress?: (event: {
      phase: 'bugfix';
      status: 'generating' | 'completed' | 'failed';
      message: string;
    }) => void
  ): Promise<SpecWriterOutput> {
    try {
      onProgress?.({
        phase: 'bugfix',
        status: 'generating',
        message: 'Analyzing bug and generating fix specification...',
      });
      const context = this.buildContext(title, description);
      const userPrompt = this.buildBugfixUserPrompt(title, description, context, draftBugfix);
      const bugfix = await this.generatePhase(BUGFIX_SYSTEM_PROMPT, userPrompt);
      this.deps.specManager.writeArtifact(specId, 'bugfix', bugfix);
      onProgress?.({
        phase: 'bugfix',
        status: 'completed',
        message: 'Bugfix specification complete',
      });
      return { specId, title, phasesCompleted: ['bugfix'], success: true, content: bugfix };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during bugfix generation';
      onProgress?.({ phase: 'bugfix', status: 'failed', message: errorMessage });
      return { specId, title, phasesCompleted: [], success: false, error: errorMessage };
    }
  }

  /**
   * Call the LLM for a single phase with structured prompting.
   */
  private async generatePhase(systemPrompt: string, userPrompt: string): Promise<string> {
    const raw = await this.deps.executeLLM(systemPrompt, userPrompt);
    // Strip any markdown code fence wrappers the model may have added
    let cleaned = raw.trim();
    if (cleaned.startsWith('```markdown')) {
      cleaned = cleaned.slice('```markdown'.length).trim();
    }
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3).trim();
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3).trim();
    }
    return cleaned;
  }

  /**
   * Build workspace context for the LLM.
   */
  private buildContext(
    title: string,
    description: string
  ): {
    product: ProductOverview | null;
    memoryFindings: MemoryEntry[];
    existingSpecs: SpecConfig[];
  } {
    const product = this.deps.productManager.getOverview();
    const allMemory = this.deps.memoryManager.list();
    // Filter to relevant findings: match title/description keywords or recent entries
    const keywords = this.extractKeywords(`${title} ${description}`);
    const relevant = allMemory.filter(
      (m) =>
        keywords.some(
          (kw) => m.title.toLowerCase().includes(kw) || m.content.toLowerCase().includes(kw)
        ) || m.tags.some((t) => keywords.includes(t.toLowerCase()))
    );
    // If no keyword matches, include the 5 most recent findings
    const findings = relevant.length > 0 ? relevant : allMemory.slice(0, 5);
    const existingSpecs = this.deps.specManager.listSpecs();
    return { product, memoryFindings: findings, existingSpecs };
  }

  /**
   * Run comprehensive research before spec generation.
   * Checks RAG → cache → web search. Updates product if new context found.
   */
  private async runResearch(
    title: string,
    description: string,
    onProgress?: (message: string) => void
  ): Promise<ResearchSession> {
    onProgress?.('Researching industry standards, best practices, and documentation...');
    const discoverySession: import('../discovery/DiscoverySession').DiscoverySession = {
      sessionId: `spec-research-${Date.now()}`,
      userRequest: `${title}: ${description}`,
      status: 'satisfied',
      messages: [
        { role: 'user', content: `${title}: ${description}`, timestamp: new Date().toISOString() },
      ],
      constraints: [],
      preferences: [],
      ambiguitiesResolved: [],
      turnCount: 0,
      maxTurns: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const session = await this.deps.researchAgent.runResearch(discoverySession, (event) => {
      if (event.type === 'topicStart') {
        onProgress?.(`Researching: ${event.topicQuery}`);
      }
    });
    onProgress?.('Research complete. Findings cached for future use.');
    return session;
  }

  /**
   * Update product overview from research findings if project context is discovered.
   */
  private async updateProductFromResearch(researchSession: ResearchSession): Promise<void> {
    const existing = this.deps.productManager.getOverview();
    if (existing) return; // Don't overwrite existing product context

    // Synthesize research findings into a product overview using LLM
    const researchContext = this.deps.researchAgent?.buildSpecContext(researchSession) ?? '';
    if (!researchContext) return;

    const systemPrompt = `You are a product analyst. Given research findings about a software project, extract:
- project name (infer from context or use "Untitled Project")
- one-sentence description
- tech stack (list of technologies mentioned)
- goals (list of objectives)
- target users (who will use this)

Return ONLY valid JSON with these exact keys: name, description, techStack (array), goals (array), targetUsers (string).`;

    const userPrompt = `Research findings:\n${researchContext.slice(0, 4000)}\n\nExtract product overview as JSON:`;

    try {
      const raw = await this.deps.executeLLM(systemPrompt, userPrompt);
      const cleaned = raw
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;
      const getString = (v: unknown, fallback: string): string =>
        typeof v === 'string' ? v : fallback;
      const overview: ProductOverview = {
        name: getString(parsed.name, 'Untitled Project'),
        description: getString(parsed.description, ''),
        techStack: Array.isArray(parsed.techStack) ? parsed.techStack.map(String) : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals.map(String) : [],
        targetUsers: getString(parsed.targetUsers, 'Developers'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.deps.productManager.saveOverview(overview);
    } catch {
      // Silent fail — product overview is optional
    }
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'shall',
      'can',
      'need',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'me',
      'him',
      'her',
      'us',
      'them',
      'my',
      'your',
      'his',
      'its',
      'our',
      'their',
      'system',
      'feature',
      'implement',
      'create',
      'build',
      'add',
      'new',
      'user',
    ]);
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }

  private generateNextSpecId(): string {
    const existing = this.deps.specManager.listSpecs();
    const maxNum = existing.reduce((max, s) => {
      const match = s.id.match(/^(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `${String(maxNum + 1).padStart(3, '0')}-spec`;
  }

  private buildRequirementsUserPrompt(
    title: string,
    description: string,
    context: ReturnType<SpecWriterAgent['buildContext']>,
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

    const researchContext = this.deps.researchAgent.buildSpecContext(researchSession);
    if (researchContext) {
      prompt += `Latest Research (industry standards, best practices, documentation):\n`;
      prompt += `${researchContext.slice(0, 15000)}\n\n`;
      prompt += `Use the research above to ensure requirements reflect current best practices and accurate technical constraints.\n\n`;
    }

    if (context.existingSpecs.length > 0) {
      prompt += `Existing Specs in Project:\n`;
      for (const s of context.existingSpecs.slice(0, 10)) {
        prompt += `- ${s.id}: ${s.title} (${s.status})\n`;
      }
      prompt += '\n';
    }

    prompt += `Write the requirements document now following the EXACT template below.\n`;
    prompt += `Replace all {placeholder} content with real, specific content for "${title}".\n`;
    prompt += `Keep the exact heading levels, horizontal rules (---), and section order.\n`;
    prompt += `Do NOT invent new sections or change the structure.\n\n`;
    prompt += `--- EXACT TEMPLATE TO FOLLOW ---\n`;
    prompt += this.deps.specManager.requirementsTemplate().replace(/{SPEC_NAME}/g, title);
    prompt += `\n--- END TEMPLATE ---\n`;

    return prompt;
  }

  private buildContextSection(context: ReturnType<SpecWriterAgent['buildContext']>): string {
    let section = '';
    if (context.product) {
      section += `Project Context:\n`;
      section += `- Name: ${context.product.name}\n`;
      section += `- Description: ${context.product.description}\n`;
      section += `- Tech Stack: ${context.product.techStack.join(', ')}\n`;
      section += `- Goals: ${context.product.goals.join(', ')}\n`;
      section += `- Target Users: ${context.product.targetUsers}\n\n`;
    }
    if (context.memoryFindings.length > 0) {
      section += `Relevant Research Findings:\n`;
      for (const f of context.memoryFindings.slice(0, 8)) {
        section += `- ${f.title}: ${f.content.slice(0, 300)}\n`;
      }
      section += '\n';
    }
    if (context.existingSpecs.length > 0) {
      section += `Existing Specs in Project:\n`;
      for (const s of context.existingSpecs.slice(0, 10)) {
        section += `- ${s.id}: ${s.title} (${s.status})\n`;
      }
      section += '\n';
    }
    return section;
  }

  private buildDesignUserPrompt(
    title: string,
    description: string,
    context: ReturnType<SpecWriterAgent['buildContext']>,
    requirements: string
  ): string {
    let prompt = `Write a complete technical design document for: "${title}"\n\n`;
    prompt += `Feature Description:\n${description}\n\n`;

    if (context.product) {
      prompt += `Tech Stack:\n${context.product.techStack.map((t) => `- ${t}`).join('\n')}\n\n`;
    }

    prompt += `Requirements Document (already approved):\n${requirements.slice(0, 4000)}\n\n`;
    prompt += `Write the design document now following the EXACT template below.\n`;
    prompt += `Replace all {placeholder} content with real, specific content for "${title}".\n`;
    prompt += `Keep the exact heading levels, horizontal rules (---), and section order.\n`;
    prompt += `Do NOT invent new sections or change the structure.\n\n`;
    prompt += `--- EXACT TEMPLATE TO FOLLOW ---\n`;
    prompt += this.deps.specManager.designTemplate().replace(/{SPEC_NAME}/g, title);
    prompt += `\n--- END TEMPLATE ---\n`;

    return prompt;
  }

  /**
   * Neurosymbolic requirements analysis — runs LLM-based ambiguity detection,
   * gap finding, contradiction checking, and assumption surfacing.
   */
  private async analyzeRequirements(requirements: string): Promise<string> {
    const prompt = `Analyze the following requirements document for ambiguity, gaps, contradictions, and unstated assumptions.

Requirements Document:
---
${requirements}
---

${REQUIREMENTS_ANALYSIS_PROMPT}`;
    return this.deps.executeLLM(
      'You are a rigorous requirements analyst. Find specific, actionable problems.',
      prompt
    );
  }

  private buildTasksUserPrompt(
    title: string,
    description: string,
    context: ReturnType<SpecWriterAgent['buildContext']>,
    requirements: string,
    design: string
  ): string {
    let prompt = `Write a complete implementation task breakdown for: "${title}"\n\n`;

    prompt += `Requirements Summary:\n${requirements.slice(0, 2000)}\n\n`;
    prompt += `Design Summary:\n${design.slice(0, 2000)}\n\n`;

    prompt += `Write the implementation plan now following the EXACT template below.\n`;
    prompt += `Replace all {placeholder} content with real, specific content for "${title}".\n`;
    prompt += `Keep the exact heading levels, horizontal rules (---), and section order.\n`;
    prompt += `Do NOT invent new sections or change the structure.\n\n`;
    prompt += `--- EXACT TEMPLATE TO FOLLOW ---\n`;
    prompt += this.deps.specManager.tasksTemplate().replace(/{SPEC_NAME}/g, title);
    prompt += `\n--- END TEMPLATE ---\n`;

    return prompt;
  }

  private buildBugfixUserPrompt(
    title: string,
    _description: string,
    context: ReturnType<SpecWriterAgent['buildContext']>,
    draftBugfix: string
  ): string {
    let prompt = `Write a complete bugfix analysis for: "${title}"\n\n`;

    prompt += `Draft Bug Report (provided by user):\n${draftBugfix || 'No draft provided — infer from title.'}\n\n`;

    prompt += this.buildContextSection(context);

    prompt += `Write the bugfix analysis now. Follow the exact section structure from the system prompt.\n`;
    prompt += `Be specific about files, functions, and exact behavior changes needed.\n`;

    return prompt;
  }
}
