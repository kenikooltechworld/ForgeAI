/**
 * Multi-Agent Coordinator
 * Handles handoff between agents when context limit is reached
 * Passes summary + last 3 messages to next agent for seamless continuation
 */

import { Logger } from '../utils/Logger';
import { OllamaClient, OllamaMessage } from '../ollama/OllamaClient';

export interface AgentHandoff {
  summary: string;
  lastThreeMessages: OllamaMessage[];
  conversationId: string;
  timestamp: number;
}

export class MultiAgentCoordinator {
  private activeHandoffs: Map<string, AgentHandoff> = new Map();

  constructor(
    private readonly logger: Logger,
    private readonly ollamaClient: OllamaClient
  ) {}

  /**
   * Register a handoff from one agent to the next
   */
  public registerHandoff(
    conversationId: string,
    summary: string,
    lastThreeMessages: OllamaMessage[]
  ): void {
    const handoff: AgentHandoff = {
      summary,
      lastThreeMessages,
      conversationId,
      timestamp: Date.now(),
    };

    this.activeHandoffs.set(conversationId, handoff);
    this.logger.info(`Handoff registered for conversation ${conversationId}`);
  }

  /**
   * Get handoff for a conversation
   */
  public getHandoff(conversationId: string): AgentHandoff | undefined {
    return this.activeHandoffs.get(conversationId);
  }

  /**
   * Create system prompt for next agent with handoff context
   */
  public createHandoffSystemPrompt(handoff: AgentHandoff): string {
    return `## Continuing from Previous Agent

${handoff.summary}

### Last 3 Messages from Previous Agent:
${handoff.lastThreeMessages
  .map((msg) => {
    const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    return `**${role}:** ${msg.content}`;
  })
  .join('\n\n')}

---

**Your Task:** Continue from where the previous agent left off. Use the summary and last 3 messages above to understand the current state. Do NOT ask "where do we start?" or "what do you want me to do?" - you already know the context.

Continue working on the task immediately.`;
  }

  /**
   * Prepare messages for next agent
   * Includes handoff context + last 3 messages
   */
  public prepareMessagesForNextAgent(
    handoff: AgentHandoff,
    newUserMessage?: string
  ): OllamaMessage[] {
    const messages: OllamaMessage[] = [];

    // Add system message with handoff context
    messages.push({
      role: 'system',
      content: this.createHandoffSystemPrompt(handoff),
    });

    // Add last 3 messages from previous agent
    messages.push(...handoff.lastThreeMessages);

    // Add new user message if provided
    if (newUserMessage) {
      messages.push({
        role: 'user',
        content: newUserMessage,
      });
    }

    return messages;
  }

  /**
   * Clear handoff after it's been used
   */
  public clearHandoff(conversationId: string): void {
    this.activeHandoffs.delete(conversationId);
    this.logger.info(`Handoff cleared for conversation ${conversationId}`);
  }

  /**
   * Clear all handoffs
   */
  public clearAllHandoffs(): void {
    this.activeHandoffs.clear();
    this.logger.info('All handoffs cleared');
  }

  /**
   * Get list of active handoffs
   */
  public getActiveHandoffs(): string[] {
    return Array.from(this.activeHandoffs.keys());
  }
}
