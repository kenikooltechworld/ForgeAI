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
 * @returns Complete system prompt string
 */
export function generateSystemPrompt(
  workspaceContext?: WorkspaceContext,
  language?: string
): string {
  const sections = [
    getCoreIdentity(),
    getLanguageInstructions(language),
    getCriticalRules(),
    getToolGuidelines(),
    getTerminalGuidelines(),
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
