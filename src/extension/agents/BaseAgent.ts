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
