import { getCoreIdentity, getCriticalRules } from './prompts/CoreIdentity';
import { getToolGuidelines, getTerminalGuidelines } from './prompts/ToolGuidelines';
import { getResponseStyle, getLanguageInstructions } from './prompts/ResponseStyle';
import { getWorkspaceContext } from './prompts/WorkspaceContext';
import { getErrorHandling } from './prompts/ErrorHandling';

// Re-export getWorkspaceContext for backward compatibility
export { getWorkspaceContext } from './prompts/WorkspaceContext';

/**
 * Workspace context for system prompt generation
 */
export interface WorkspaceContext {
  workspacePath?: string;
  currentFiles?: string[];
  openFiles?: string[];
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
  ragChunks?: Array<{ text: string; score?: number; url?: string; sourceId?: string }>
): string {
  const sections = [
    getCoreIdentity(),
    getLanguageInstructions(language),
    getCriticalRules(),
    getToolGuidelines(),
    getTerminalGuidelines(),
    ragChunks && ragChunks.length ? getRagContextSection(ragChunks) : '',
    getResponseStyle(),
    getWorkspaceContext(workspaceContext),
    getErrorHandling(),
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

  return `## RAG Context (Documentation)

Use the following documentation excerpts to ground your solution:

${cleaned}

When facts are not present in the excerpts, proceed carefully and prefer asking clarifying questions over guessing.`;
}
