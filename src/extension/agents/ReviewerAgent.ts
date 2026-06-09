/**
 * Reviewer Agent
 * Tests, validates, and reviews code
 * Catches errors before returning to user
 */

import { Logger } from '../utils/Logger';
import { OllamaClient } from '../ollama/OllamaClient';

export class ReviewerAgent {
  constructor(
    private readonly logger: Logger,
    private readonly ollamaClient: OllamaClient
  ) {}

  /**
   * Execute review task
   * Receives implementer results to validate
   */
  public async execute(task: string, implementerResults: string): Promise<string> {
    try {

      const systemPrompt = `You are a code reviewer. Your job is to:
1. Test the code
2. Check for errors
3. Validate against requirements
4. Report issues or confirm success

Implementation to review:
${implementerResults}

Be thorough. Report any issues found or confirm success.`;

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
      this.logger.error('Reviewer task failed', error);
      throw error;
    }
  }
}
