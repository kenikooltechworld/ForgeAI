import { Logger } from '../utils/Logger';
import { OllamaMessage, OllamaStreamChunk, OllamaToolCall } from './OllamaClient';

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
  }

  public processChunk(chunk: OllamaStreamChunk): void {
    try {
      const msg = chunk.message;
      if (!msg) return;

      if (msg.thinking) this.thinking += msg.thinking;
      if (msg.content) this.content += msg.content;
      if (msg.tool_calls?.length) this.toolCalls.push(...msg.tool_calls);
      if (chunk.prompt_eval_count !== undefined) this.promptTokens = chunk.prompt_eval_count;
      if (chunk.eval_count !== undefined) this.completionTokens = chunk.eval_count;

      if (chunk.done) {
        this.done = true;
      }
    } catch (error) {
      throw error;
    }
  }

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

  public getAccumulatedMessage(): OllamaMessage {
    const message: OllamaMessage = {
      role: 'assistant',
      content: this.content,
    };
    if (this.thinking) message.thinking = this.thinking;
    if (this.toolCalls.length > 0) message.tool_calls = this.toolCalls;
    return message;
  }

  public reset(): void {
    this.thinking = '';
    this.content = '';
    this.toolCalls = [];
    this.done = false;
    this.promptTokens = undefined;
    this.completionTokens = undefined;
  }

  public isDone(): boolean {
    return this.done;
  }
  public getThinking(): string {
    return this.thinking;
  }
  public getContent(): string {
    return this.content;
  }
  public getToolCalls(): OllamaToolCall[] {
    return this.toolCalls;
  }

  public getTokenUsage():
    | { promptTokens?: number; completionTokens?: number; totalTokens?: number }
    | undefined {
    if (this.promptTokens === undefined && this.completionTokens === undefined) return undefined;
    return {
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: (this.promptTokens || 0) + (this.completionTokens || 0) || undefined,
    };
  }
}
