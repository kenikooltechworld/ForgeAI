import { Logger } from '../utils/Logger';
import { OllamaMessage, OllamaStreamChunk, OllamaToolCall } from './OllamaClient';

/**
 * Accumulated response from streaming chunks
 */
export interface AccumulatedResponse {
  thinking: string;
  content: string;
  tool_calls: OllamaToolCall[];
  done: boolean;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Production-ready Streaming Response Handler for Ollama
 * Accumulates thinking, content, and tool_calls fields separately
 * Handles incomplete JSON chunks gracefully
 */
export class StreamHandler {
  private thinking: string = '';
  private content: string = '';
  private toolCalls: OllamaToolCall[] = [];
  private done: boolean = false;
  private promptTokens?: number;
  private completionTokens?: number;
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.logger.info('StreamHandler initialized');
  }

  /**
   * Process a streaming chunk and accumulate fields
   * @param chunk Streaming chunk from Ollama
   */
  public processChunk(chunk: OllamaStreamChunk): void {
    try {
      // Log the entire chunk for debugging (only when done=true to see token counts)
      if (chunk.done) {
        this.logger.info(`Final chunk received: ${JSON.stringify(chunk)}`);
      }

      // Guard against chunks that lack a message object
      const msg = chunk.message;
      if (!msg) {
        this.logger.warn('Stream chunk missing message object');
        return;
      }

      // Accumulate thinking field
      if (msg.thinking) {
        this.thinking += msg.thinking;
        this.logger.info(`Accumulated thinking: ${msg.thinking.length} chars`);
      }

      // Accumulate content field
      if (msg.content) {
        this.content += msg.content;
        this.logger.info(`Accumulated content: ${msg.content.length} chars`);
      }

      // Accumulate tool_calls field
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        this.toolCalls.push(...msg.tool_calls);
        this.logger.info(`Accumulated ${msg.tool_calls.length} tool calls`);
      }

      // Capture token usage (typically in final chunk when done=true)
      if (chunk.prompt_eval_count !== undefined) {
        this.promptTokens = chunk.prompt_eval_count;
        this.logger.info(`✅✅✅ CAPTURED PROMPT TOKENS: ${chunk.prompt_eval_count}`);
      }

      if (chunk.eval_count !== undefined) {
        this.completionTokens = chunk.eval_count;
        this.logger.info(`✅✅✅ CAPTURED COMPLETION TOKENS: ${chunk.eval_count}`);
      }

      // Update done status
      if (chunk.done) {
        this.done = true;
        const tokenUsage = this.getTokenUsage();
        this.logger.info(
          `🏁🏁🏁 STREAM COMPLETED. Token usage object: ${JSON.stringify(tokenUsage)}`
        );
      }
    } catch (error) {
      this.logger.error('Failed to process chunk', error);
      throw error;
    }
  }

  /**
   * Get the accumulated response
   * @returns Complete accumulated response
   */
  public getAccumulated(): AccumulatedResponse {
    const tokenUsage =
      this.promptTokens !== undefined || this.completionTokens !== undefined
        ? {
            promptTokens: this.promptTokens,
            completionTokens: this.completionTokens,
            totalTokens: (this.promptTokens || 0) + (this.completionTokens || 0) || undefined,
          }
        : undefined;

    return {
      thinking: this.thinking,
      content: this.content,
      tool_calls: this.toolCalls,
      done: this.done,
      tokenUsage,
    };
  }

  /**
   * Get accumulated response as OllamaMessage format
   * @returns Accumulated response in message format
   */
  public getAccumulatedMessage(): OllamaMessage {
    const message: OllamaMessage = {
      role: 'assistant',
      content: this.content,
    };

    if (this.thinking) {
      message.thinking = this.thinking;
    }

    if (this.toolCalls.length > 0) {
      message.tool_calls = this.toolCalls;
    }

    return message;
  }

  /**
   * Reset the handler for a new stream
   */
  public reset(): void {
    this.thinking = '';
    this.content = '';
    this.toolCalls = [];
    this.done = false;
    this.promptTokens = undefined;
    this.completionTokens = undefined;
    this.logger.info('StreamHandler reset');
  }

  /**
   * Check if stream is complete
   * @returns true if done signal received
   */
  public isDone(): boolean {
    return this.done;
  }

  /**
   * Get current thinking accumulation
   * @returns Accumulated thinking text
   */
  public getThinking(): string {
    return this.thinking;
  }

  /**
   * Get current content accumulation
   * @returns Accumulated content text
   */
  public getContent(): string {
    return this.content;
  }

  /**
   * Get current tool calls accumulation
   * @returns Accumulated tool calls
   */
  public getToolCalls(): OllamaToolCall[] {
    return this.toolCalls;
  }

  /**
   * Get token usage information
   * @returns Token usage with prompt, completion, and total tokens
   */
  public getTokenUsage():
    | { promptTokens?: number; completionTokens?: number; totalTokens?: number }
    | undefined {
    if (this.promptTokens === undefined && this.completionTokens === undefined) {
      return undefined;
    }

    return {
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: (this.promptTokens || 0) + (this.completionTokens || 0) || undefined,
    };
  }
}
