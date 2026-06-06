/**
 * Base Agent class for multi-agent orchestration system
 * Provides common functionality for all agents (Planner, Executor, Critic)
 */

import { ToolRegistry } from '../tools/ToolRegistry';
import { OllamaClient } from '../ollama/OllamaClient';
import { Logger } from '../utils/Logger';

/**
 * Agent interface that all agents must implement
 */
export interface IAgent {
  /** Execute the agent's primary function */
  execute(input: any): Promise<any>;

  /** Get the agent's name */
  getName(): string;

  /** Get the agent's capabilities */
  getCapabilities(): string[];
}

/**
 * Execution metrics for monitoring agent performance
 */
interface ExecutionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  lastExecutionTime: number;
}

/**
 * Base agent class with common functionality
 */
export abstract class BaseAgent implements IAgent {
  protected readonly toolRegistry: ToolRegistry;
  protected readonly ollamaClient: OllamaClient;
  protected readonly logger: Logger;
  private metrics: ExecutionMetrics;

  constructor(toolRegistry: ToolRegistry, ollamaClient: OllamaClient, logger?: Logger) {
    this.toolRegistry = toolRegistry;
    this.ollamaClient = ollamaClient;
    // Use provided logger or create a simple console logger for tests
    this.logger =
      logger ||
      ({
        info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
        error: (msg: string, error?: any) => console.error(`[ERROR] ${msg}`, error),
        warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
        debug: (msg: string, ...args: any[]) => console.debug(`[DEBUG] ${msg}`, ...args),
      } as any);
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      lastExecutionTime: 0,
    };
  }

  /**
   * Abstract method that subclasses must implement
   */
  abstract execute(input: any): Promise<any>;

  /**
   * Abstract method to get agent name
   */
  abstract getName(): string;

  /**
   * Abstract method to get agent capabilities
   */
  abstract getCapabilities(): string[];

  /**
   * Log info message
   */
  protected logInfo(message: string, ...args: any[]): void {
    this.logger.info(message, ...args);
  }

  /**
   * Log error message
   */
  protected logError(message: string, error?: any): void {
    this.logger.error(message, error);
  }

  /**
   * Log debug message
   */
  protected logDebug(message: string, ...args: any[]): void {
    // Logger doesn't have debug method, use info instead
    this.logger.info(`[DEBUG] ${message}`, ...args);
  }

  /**
   * Record execution metrics
   */
  protected recordExecution(duration: number, success: boolean): void {
    this.metrics.totalExecutions++;
    this.metrics.lastExecutionTime = Date.now();

    if (success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }

    // Update average duration
    const totalDuration = this.metrics.averageDuration * (this.metrics.totalExecutions - 1);
    this.metrics.averageDuration = (totalDuration + duration) / this.metrics.totalExecutions;
  }

  /**
   * Get execution metrics
   */
  public getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Execute with error handling wrapper
   */
  protected async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();

    try {
      this.logDebug(`Starting ${operationName}`);
      const result = await operation();
      const duration = Date.now() - startTime;

      this.recordExecution(duration, true);
      this.logDebug(`Completed ${operationName} in ${duration}ms`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordExecution(duration, false);

      this.logError(`Failed ${operationName} after ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * Execute an LLM call with optional tool-calling loop.
   *
   * If the model returns tool_calls, this method executes each tool via
   * ToolRegistry, feeds results back, and retries. Repeats until the model
   * returns plain text or max iterations is reached.
   *
   * All agents MUST use this instead of calling `this.ollamaClient.chat` directly,
   * so that tool awareness in prompts is matched by actual tool execution.
   */
  protected async executeWithTools<T>({
    messages,
    tools,
    toolNames,          // optional — if omitted, uses tools from this.toolRegistry
    model,
    maxIterations = 16,
    onToolStart,
    onToolComplete,
    onToolError,
  }: {
    messages: any[];
    tools?: any[];
    toolNames?: string[];
    model?: string;
    maxIterations?: number;
    onToolStart?: (name: string) => void;
    onToolComplete?: (name: string, durationMs: number) => void;
    onToolError?: (name: string, error: Error) => void;
  }): Promise<{ content: string; toolCallsMade: number }> {
    const resolvedTools = tools ?? this.toolRegistry.getToolDefinitions();
    const resolvedModel = model ?? this.ollamaClient
      ? (this.ollamaClient as any).defaultModel
      : undefined;

    let conversation = [...messages];
    let totalToolCalls = 0;

    for (let iter = 0; iter < maxIterations; iter++) {
      const response = await this.ollamaClient.chat({
        model: resolvedModel,
        messages: conversation,
        stream: false,
        tools: resolvedTools,
        options: { temperature: 0.3 },
      });

      // Safety: should never stream here
      if (Symbol.asyncIterator in (response as any)) {
        throw new Error('Unexpected streaming response during executeWithTools');
      }

      const msg: any = (response as any).message;
      const toolCalls: any[] | undefined = msg.tool_calls;

      // No tool calls → plain text response, we're done
      if (!toolCalls || toolCalls.length === 0) {
        return { content: msg.content || '', toolCallsMade: totalToolCalls };
      }

      // Process each tool call
      conversation.push({ role: 'assistant', content: msg.content, tool_calls: toolCalls });

      for (const call of toolCalls) {
        const name = call.function?.name || '';
        const args = call.function?.arguments || {};
        totalToolCalls++;

        try {
          if (onToolStart) onToolStart(name);
          const t0 = Date.now();

          const result = await this.toolRegistry.executeTool(name, args);

          const durationMs = Date.now() - t0;
          if (onToolComplete) onToolComplete(name, durationMs);

          conversation.push({
            role: 'tool',
            content: typeof result === 'string' ? result : JSON.stringify(result),
            name,
          });
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          if (onToolError) onToolError(name, error);
          conversation.push({
            role: 'tool',
            content: JSON.stringify({ error: error.message }),
            name,
          });
        }
      }
    }

    // Max iterations reached: return whatever the model last produced
    const last = conversation[conversation.length - 1];
    return {
      content: (last?.content as string) || '',
      toolCallsMade: totalToolCalls,
    };
  }

  /**
   * Helper: resolve a lazy tool dependency (function or value).
   * Supports { get: () => T } wrappers and raw values.
   */
  protected resolveDeps<T>(deps: T | (() => T) | { get: () => T } | null | undefined): T | null {
    if (deps === null || deps === undefined) return null;
    if (typeof deps === 'function') return (deps as () => T)();
    if (typeof (deps as any).get === 'function') return (deps as any).get() as T;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (deps as any) as T;
  }

  /**
   * Reset metrics (useful for testing)
   */
  public resetMetrics(): void {
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      lastExecutionTime: 0,
    };
  }
}
