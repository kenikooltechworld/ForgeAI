/**
 * Explorer Agent
 * Fast codebase analysis and file discovery
 * Uses lightweight model (Haiku) for speed
 * Runs in parallel with other explorers
 */

import { Logger } from '../utils/Logger';
import { OllamaClient } from '../ollama/OllamaClient';

export class ExplorerAgent {
  constructor(
    private readonly logger: Logger,
    private readonly ollamaClient: OllamaClient
  ) {}

  /**
   * Execute exploration task
   * Returns findings about codebase structure, files, patterns
   */
  public async execute(task: string): Promise<string> {
    try {
      this.logger.info(`Explorer: Starting task: ${task}`);

      const systemPrompt = `You are a code explorer. Your job is to:
1. Analyze codebase structure
2. Find relevant files
3. Identify patterns and dependencies
4. Report findings concisely

Be brief and factual. Return only findings, no explanations.`;

      const response = await this.ollamaClient.chat({
        model: 'qwen3-vl-8b', // Fast, lightweight model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: task },
        ],
        stream: false,
      });

      const chatResponse = response as { message: { content: string } };
      const result = chatResponse.message.content;

      this.logger.info(`Explorer: Task completed`);
      return result;
    } catch (error) {
      this.logger.error('Explorer task failed', error);
      throw error;
    }
  }
}
