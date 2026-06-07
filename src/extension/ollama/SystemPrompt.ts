import { getCoreIdentity, getCriticalRules } from './prompts/CoreIdentity';
import { getToolGuidelines, getTerminalGuidelines } from './prompts/ToolGuidelines';
import { getResponseStyle, getLanguageInstructions } from './prompts/ResponseStyle';
import { getWorkspaceContext } from './prompts/WorkspaceContext';
import { getErrorHandling } from './prompts/ErrorHandling';
import { SpecContext } from '../spec/types';

// Re-export getWorkspaceContext for backward compatibility
export { getWorkspaceContext } from './prompts/WorkspaceContext';

/**
 * Workspace context for system prompt generation
 */
export interface WorkspaceContext {
  workspacePath?: string;
  currentFiles?: string[];
  openFiles?: string[];
  workspaceFiles?: string[];
  workspaceTree?: string;
}

/**
 * Generate the system prompt for ForgeAI autonomous agent
 *
 * This prompt instructs the AI to be a natural, professional coding assistant
 * that acts autonomously without exposing internal processes to users.
 *
 * @param workspaceContext Optional workspace context for dynamic injection
 * @param language Optional language preference for responses
 * @param ragChunks Optional retrieved documentation chunks for grounding
 * @returns Complete system prompt string
 */
export function generateSystemPrompt(
  workspaceContext?: WorkspaceContext,
  language?: string,
  ragChunks?: Array<{ text: string; score?: number; url?: string; sourceId?: string }>,
  specContext?: SpecContext
): string {
  const sections = [
    getCoreIdentity(),
    getLanguageInstructions(language),
    getCriticalRules(),
    getToolGuidelines(),
    getTerminalGuidelines(),
    getResearchDirective(),
    ragChunks && ragChunks.length ? getRagContextSection(ragChunks) : '',
    getResponseStyle(),
    getWorkspaceContext(workspaceContext),
    getErrorHandling(),
    specContext ? getSpecContextSection(specContext) : '',
    getFinalReminder(),
  ].filter((section) => section.trim().length > 0);

  return sections.join('\n\n');
}

/**
 * Final reminder to maintain professional behavior
 */
function getFinalReminder(): string {
  return `Remember: Act naturally and professionally. Users want results and solutions, not explanations of your internal processes.`;
}

/**
 * Research directive: always instructs the model to research before acting.
 * This is inlined unconditionally so the model never skips research.
 */
function getResearchDirective(): string {
  return `## Research-First Protocol

Your training data is outdated. For ANY planning, architecture, tech-stack decision, feature discussion, or spec write:

1. **RESEARCH FIRST via sub-agent**: Call forgeai_spawnAgent(type="researcher", task="...", details="...") with a clear description of what you need. The researcher sub-agent has its own browser tools and will navigate official docs, GitHub, StackOverflow — it returns actual content, not topics.
2. **PRESENT FINDINGS IN CHAT**: Share the researcher's findings with the user BEFORE creating a spec — cite sources and URLs from the research output.
3. **ASK BEFORE SPEC**: Only create a spec when the user explicitly agrees.

## When research is required:
- Choosing frameworks, libraries, or infrastructure
- Recommending versions, APIs, or configuration approaches
- Discussing architecture patterns or best practices
- Before creating requirements, design, or tasks.md

**NEVER** skip research because you think you know the answer. **NEVER** create a spec from memory.
**NEVER** call forgeai_webSearch or forgeai_webResearch directly — always use forgeai_spawnAgent(type="researcher").`;
}

function getRagContextSection(
  ragChunks: Array<{ text: string; score?: number; url?: string; sourceId?: string }>
): string {
  const cleaned = ragChunks
    .slice(0, 6)
    .map((c, idx) => {
      const provenanceParts: string[] = [];
      if (c.sourceId) provenanceParts.push(`source=${c.sourceId}`);
      if (c.url) provenanceParts.push(`url=${c.url}`);
      const provenance = provenanceParts.length ? ` (${provenanceParts.join(', ')})` : '';

      return `### RAG Chunk ${idx + 1}${provenance}\n\n${c.text.trim()}`;
    })
    .join('\n\n');

  return `## RAG Context (Current Documentation)

**IMPORTANT: The documentation below is scraped from official sources and represents the CURRENT state of the technology.**

- The version numbers, APIs, and examples shown are the latest stable versions
- Use the exact API syntax and code examples shown in the documentation
- Do NOT rely on your training data for API details - it is outdated
- When writing code, follow the patterns and examples from these docs

Documentation excerpts:

${cleaned}

**If the information you need is NOT in the excerpts above, you MUST:**
1. Call 'forgeai_webSearch' or 'forgeai_webResearch' to find current documentation URLs
2. **CRITICAL: After getting search results, call 'forgeai_fetchPage(url)' for the 2-3 most relevant URLs** — search snippets are surface-level. You need the ACTUAL page content (docs, GitHub READMEs, API references, best practices)
3. Do NOT guess, assume, or rely on training data
4. Do NOT ask the user for clarification unless the topic is about their specific business logic

**For ANY planning, architecture, or feature discussion:**
- Present your research findings to the user in chat BEFORE creating specs or writing code
- Cite sources (RAG docs, fetched page content) when making recommendations
- Only create a formal spec after the user agrees or explicitly asks for one

Research first, FETCH actual content, share findings, then act.`;
}

/**
 * Format spec context into a system prompt section.
 * Injected when AgentLoop is running in spec-driven mode.
 */
function getSpecContextSection(specContext: SpecContext): string {
  const { currentTask, spec, completedTasks, constitution } = specContext;

  const completedSummary = completedTasks
    .map((t) => `- [x] ${t.taskId}: ${t.description}`)
    .join('\n');

  const pendingTasks = spec.tasks
    .filter((t) => t.status === 'pending' && t.id !== currentTask.id)
    .map((t) => `- [ ] ${t.id}: ${t.description}`)
    .join('\n');

  const acceptanceCriteria = spec.requirements
    .filter((r) => currentTask.requirementIds.includes(r.id))
    .flatMap((r) => r.acceptanceCriteria)
    .map((c) => `- ${c.text}`)
    .join('\n');

  return `## SPEC CONTEXT (Current Task)

You are executing **Task ${currentTask.id}** of ${spec.tasks.length} from the project specification.

### Constitution (Project Rules)
${constitution}

### Current Task
**ID:** ${currentTask.id}
**Phase:** ${currentTask.phase}
**Description:** ${currentTask.description}

### Instructions
${currentTask.instructions.map((i) => `- ${i}`).join('\n')}

### Acceptance Criteria
${acceptanceCriteria || 'No specific acceptance criteria defined.'}

### Requirements Traceability
This task implements: ${currentTask.requirementIds.join(', ')}

### Previously Completed Tasks
${completedSummary || 'None yet.'}

### Remaining Tasks
${pendingTasks || 'None — this is the last task!'}

### Expected Artifacts
${currentTask.expectedArtifacts.join(', ') || 'None specified'}

IMPORTANT: Follow the instructions precisely. Produce all expected artifacts. Do not skip steps.`;
}
