/**
 * Session Context Injector
 * Injects previous session context into system prompt
 * Allows AI to continue from where it left off
 */

import { SessionMemory, SessionMemoryData } from '../utils/SessionMemory';
import { Logger } from '../utils/Logger';

export class SessionContextInjector {
  constructor(
    private readonly sessionMemory: SessionMemory,
    private readonly logger: Logger
  ) {}

  /**
   * Get session context for a conversation
   * Returns system prompt injection if session memory exists
   */
  public async getSessionContext(conversationId: string): Promise<string | null> {
    try {
      const sessionData = await this.sessionMemory.loadSessionMemory(conversationId);

      if (!sessionData) {
        return null; // No previous session
      }

      // Check if session is recent (within last 24 hours)
      const hoursSinceLastSession = (Date.now() - sessionData.timestamp) / (1000 * 60 * 60);
      if (hoursSinceLastSession > 24) {
        this.logger.info(
          `Session memory for ${conversationId} is older than 24 hours, not injecting`
        );
        return null;
      }

      return this.createContextPrompt(sessionData);
    } catch (error) {
      this.logger.error(`Failed to get session context for ${conversationId}`, error);
      return null;
    }
  }

  /**
   * Create context prompt from session memory
   */
  private createContextPrompt(sessionData: SessionMemoryData): string {
    const hoursSince = Math.round((Date.now() - sessionData.timestamp) / (1000 * 60 * 60));

    return `## Continuing Previous Session (${hoursSince} hour${hoursSince !== 1 ? 's' : ''} ago)

**What We Were Working On:**
${sessionData.summary}

**What Needs to Happen Next:**
${sessionData.nextSteps}

${sessionData.context.currentTask ? `**Current Task:** ${sessionData.context.currentTask}\n` : ''}

${
  sessionData.context.completedTasks && sessionData.context.completedTasks.length > 0
    ? `**Already Completed:**
${sessionData.context.completedTasks.map((t) => `✓ ${t}`).join('\n')}

`
    : ''
}

${
  sessionData.context.blockers && sessionData.context.blockers.length > 0
    ? `**Known Issues to Watch For:**
${sessionData.context.blockers.map((b) => `⚠️ ${b}`).join('\n')}

`
    : ''
}

**Last Exchange:**
${sessionData.lastMessages
  .map((msg) => {
    const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    const preview = msg.content.length > 150 ? msg.content.substring(0, 150) + '...' : msg.content;
    return `${role}: ${preview}`;
  })
  .join('\n\n')}

---

Continue from where we left off. Use the context above to understand the current state.`;
  }

  /**
   * Save session memory after conversation ends
   * This should be called when user closes the conversation or at regular intervals
   */
  public async saveSessionMemory(
    conversationId: string,
    messages: Array<{ role: string; content: string }>,
    summary: string,
    nextSteps: string,
    context?: { currentTask?: string; completedTasks?: string[]; blockers?: string[] }
  ): Promise<void> {
    try {
      await this.sessionMemory.saveSessionMemory(
        conversationId,
        messages,
        summary,
        nextSteps,
        context
      );

      this.logger.info(`Session memory saved for ${conversationId}`);
    } catch (error) {
      this.logger.error(`Failed to save session memory for ${conversationId}`, error);
    }
  }

  /**
   * Generate summary from conversation
   * This should be called by the AI to create a summary of what was accomplished
   */
  public generateSummaryPrompt(): string {
    return `Please provide a brief summary of what we accomplished in this session:
1. What was the main goal?
2. What did we complete?
3. What still needs to be done?

Format your response as:
SUMMARY: [one sentence summary]
NEXT_STEPS: [what needs to happen next]
CURRENT_TASK: [what we were working on]
COMPLETED: [list of completed items]
BLOCKERS: [any issues to watch for]`;
  }
}
