/**
 * Implementer Agent
 * Writes code, makes modifications
 * Uses full model with tool access
 * Receives context from Explorer
 */

import { Logger } from '../utils/Logger';
import { OllamaClient } from '../ollama/OllamaClient';

export class ImplementerAgent {
  constructor(
    private readonly logger: Logger,
    private readonly ollamaClient: OllamaClient
  ) {}

  /**
   * Execute implementation task
   * Receives explorer context to understand codebase
   */
  public async execute(task: string, explorerContext: string): Promise<string> {
    try {

      const systemPrompt = `You are a code implementer. Your job is to:
1. Write clean, production-ready code
2. Follow existing patterns
3. Handle errors properly
4. Return only the code/changes needed

Context from Explorer:
${explorerContext}

Be concise. Return only code changes, no explanations.`;

      const response = await this.ollamaClient.chat({
        model: 'gemma4:31b-cloud', // Full model with tools
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: task },
        ],
        stream: false,
      });

      const chatResponse = response as { message: { content: string } };
      const result = chatResponse.message.content;

      return result;
    } catch (error) {
      this.logger.error('Implementer task failed', error);
      throw error;
    }
  }
}
