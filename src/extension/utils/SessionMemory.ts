/**
 * Session Memory Manager
 * Saves last 3 messages + summary to disk for cross-session continuity
 * When user reopens conversation, AI loads this and continues from where it left off
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './Logger';

export interface SessionMemoryData {
  conversationId: string;
  timestamp: number;
  lastMessages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
  }>;
  summary: string; // AI-generated summary of what was accomplished
  nextSteps: string; // What needs to be done next
  context: {
    currentTask?: string;
    completedTasks?: string[];
    blockers?: string[];
  };
}

/**
 * Manages session memory - saves last 3 messages + summary for cross-session continuity
 */
export class SessionMemory {
  private readonly storageDir: string;
  private readonly logger: Logger;

  constructor(storageDir: string, logger: Logger) {
    this.storageDir = storageDir;
    this.logger = logger;

    // Ensure storage directory exists
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  /**
   * Get path to session memory file for a conversation
   */
  private getSessionMemoryPath(conversationId: string): string {
    return path.join(this.storageDir, `session-${conversationId}.json`);
  }

  /**
   * Save session memory (last 3 messages + summary)
   * Call this when conversation ends or periodically
   */
  public async saveSessionMemory(
    conversationId: string,
    messages: Array<{ role: string; content: string }>,
    summary: string,
    nextSteps: string,
    context?: { currentTask?: string; completedTasks?: string[]; blockers?: string[] }
  ): Promise<void> {
    try {
      // Get last 3 messages
      const lastMessages = messages.slice(-3).map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: msg.content,
        timestamp: Date.now(),
      }));

      const sessionData: SessionMemoryData = {
        conversationId,
        timestamp: Date.now(),
        lastMessages,
        summary,
        nextSteps,
        context: context || {},
      };

      const filePath = this.getSessionMemoryPath(conversationId);
      fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));

      this.logger.info(`Session memory saved for conversation ${conversationId}`);
    } catch (error) {
      this.logger.error(`Failed to save session memory for ${conversationId}`, error);
    }
  }

  /**
   * Load session memory for a conversation
   * Returns null if no session memory exists
   */
  public async loadSessionMemory(conversationId: string): Promise<SessionMemoryData | null> {
    try {
      const filePath = this.getSessionMemoryPath(conversationId);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf-8');
      const sessionData = JSON.parse(data) as SessionMemoryData;

      this.logger.info(`Session memory loaded for conversation ${conversationId}`);
      return sessionData;
    } catch (error) {
      this.logger.error(`Failed to load session memory for ${conversationId}`, error);
      return null;
    }
  }

  /**
   * Create a system prompt injection from session memory
   * This tells the AI what happened in the previous session
   */
  public createSessionContextPrompt(sessionData: SessionMemoryData): string {
    return `## Previous Session Context

You are continuing a conversation from a previous session. Here's what happened:

**Summary:** ${sessionData.summary}

**Next Steps:** ${sessionData.nextSteps}

${sessionData.context.currentTask ? `**Current Task:** ${sessionData.context.currentTask}` : ''}

${
  sessionData.context.completedTasks && sessionData.context.completedTasks.length > 0
    ? `**Completed Tasks:**\n${sessionData.context.completedTasks.map((t) => `- ${t}`).join('\n')}`
    : ''
}

${
  sessionData.context.blockers && sessionData.context.blockers.length > 0
    ? `**Known Blockers:**\n${sessionData.context.blockers.map((b) => `- ${b}`).join('\n')}`
    : ''
}

**Last 3 Messages from Previous Session:**
${sessionData.lastMessages
  .map((msg) => `${msg.role.toUpperCase()}: ${msg.content.substring(0, 200)}...`)
  .join('\n')}

Continue from where you left off. Use the context above to understand what was happening.`;
  }

  /**
   * Delete session memory for a conversation
   */
  public async deleteSessionMemory(conversationId: string): Promise<void> {
    try {
      const filePath = this.getSessionMemoryPath(conversationId);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.info(`Session memory deleted for conversation ${conversationId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete session memory for ${conversationId}`, error);
    }
  }

  /**
   * List all saved session memories
   */
  public async listSessionMemories(): Promise<SessionMemoryData[]> {
    try {
      const files = fs.readdirSync(this.storageDir).filter((f) => f.startsWith('session-'));

      const memories: SessionMemoryData[] = [];
      for (const file of files) {
        const filePath = path.join(this.storageDir, file);
        const data = fs.readFileSync(filePath, 'utf-8');
        memories.push(JSON.parse(data) as SessionMemoryData);
      }

      return memories;
    } catch (error) {
      this.logger.error('Failed to list session memories', error);
      return [];
    }
  }

  /**
   * Clear all session memories
   */
  public async clearAllSessionMemories(): Promise<void> {
    try {
      const files = fs.readdirSync(this.storageDir).filter((f) => f.startsWith('session-'));

      for (const file of files) {
        const filePath = path.join(this.storageDir, file);
        fs.unlinkSync(filePath);
      }

      this.logger.info(`Cleared ${files.length} session memories`);
    } catch (error) {
      this.logger.error('Failed to clear session memories', error);
    }
  }
}
