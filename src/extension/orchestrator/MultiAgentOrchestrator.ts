/**
 * Multi-Agent Orchestrator - Coordinates Planner, Executor, and Critic agents
 * Implements the Planner-Executor-Critic pattern from Anthropic
 */

import { AgentLoop } from '../ollama/AgentLoop';
import { ToolRegistry } from '../tools/ToolRegistry';
import { OllamaClient } from '../ollama/OllamaClient';
import { Logger } from '../utils/Logger';
import { PlannerAgent } from '../agents/PlannerAgent';
import { ExecutorAgent } from '../agents/ExecutorAgent';
import { CriticAgent } from '../agents/CriticAgent';
import { GraphBuilder, StateAnnotation } from './Graph';
import {
  OrchestratorState,
  OrchestratorResult,
  RunOptions,
  ProgressCallback,
  TaskCompleteCallback,
  ErrorCallback,
  ProgressUpdate,
  ExecutorOutput,
  ExecutionContext,
  WorkflowStatus,
} from './types';

/**
 * Multi-Agent Orchestrator class
 * Coordinates multiple specialized agents to accomplish complex tasks
 */
export class MultiAgentOrchestrator {
  private readonly logger: Logger;
  private readonly plannerAgent: PlannerAgent;
  private readonly executorAgent: ExecutorAgent;
  private readonly criticAgent: CriticAgent;
  private readonly compiledGraph: ReturnType<GraphBuilder['compile']>;

  // State management
  private currentState: OrchestratorState | null = null;
  private isRunning: boolean = false;
  private isPausedFlag: boolean = false;
  private isCancelledFlag: boolean = false;
  private savedStateForResume: OrchestratorState | null = null;

  // Progress callbacks
  private progressCallbacks: ProgressCallback[] = [];
  private taskCompleteCallbacks: TaskCompleteCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];

  constructor(
    private readonly agentLoop: AgentLoop,
    private readonly toolRegistry: ToolRegistry,
    ollamaClient: OllamaClient,
    logger?: Logger
  ) {
    // Use provided logger or create a simple console logger for tests
    this.logger =
      logger ||
      ({
        info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
        error: (msg: string, error?: any) => console.error(`[ERROR] ${msg}`, error),
        warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
        debug: (msg: string, ...args: any[]) => console.debug(`[DEBUG] ${msg}`, ...args),
      } as any);

    // Initialize agents
    this.plannerAgent = new PlannerAgent(toolRegistry, ollamaClient, this.logger);
    this.executorAgent = new ExecutorAgent(toolRegistry, ollamaClient, this.logger);
    this.criticAgent = new CriticAgent(toolRegistry, ollamaClient, this.logger);

    // Create and compile graph
    const graphBuilder = new GraphBuilder(this.plannerAgent, this.executorAgent, this.criticAgent);
    this.compiledGraph = graphBuilder.compile();

    this.logger.info('MultiAgentOrchestrator initialized');
  }

  /**
   * Run the orchestrator with a user request
   * @param request User request to process
   * @param options Execution options
   * @returns Orchestrator result
   */
  public async run(request: string, options?: RunOptions): Promise<OrchestratorResult> {
    this.logger.info(`Starting orchestrator run with request: ${request}`);

    if (this.isRunning) {
      throw new Error('Orchestrator is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      // Create initial state
      const initialState: typeof StateAnnotation.State = {
        userRequest: request,
        plan: null,
        currentTask: null,
        results: new Map(),
        iteration: 0,
        maxIterations: options?.maxIterations ?? 5,
        status: 'planning' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
        lastFeedback: undefined,
      };

      this.currentState = initialState;

      // Invoke graph
      this.logger.info('Invoking LangGraph state machine');
      const config = {
        configurable: {
          thread_id: `orchestrator-${Date.now()}`,
          model: options?.model, // Pass model to graph nodes
        },
      };

      // Execute graph
      let finalState: typeof StateAnnotation.State = initialState;

      try {
        // Invoke the graph and get the final state
        const result = await this.compiledGraph.invoke(initialState, config);
        finalState = result;

        this.logger.info(`Graph execution completed with status: ${finalState.status}`);
      } catch (error) {
        this.logger.error('Graph execution failed', error);

        // Update state with error
        finalState = {
          ...finalState,
          status: 'failed' as WorkflowStatus,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            recoverable: false,
          },
        };
      }

      // Update current state
      this.currentState = finalState;

      // Calculate metrics
      const duration = Date.now() - startTime;
      const completedTasks = Array.from(finalState.results.values()).filter(
        (r) => r.status === 'success' || r.status === 'pass'
      ).length;
      const failedTasks = Array.from(finalState.results.values()).filter(
        (r) => r.status === 'fail' || r.status === 'failed'
      ).length;
      const toolsUsed = Array.from(finalState.results.values()).flatMap((r) => r.toolsUsed);

      // Create result
      const result: OrchestratorResult = {
        success: finalState.status === 'complete',
        status: finalState.status,
        plan: finalState.plan!,
        results: finalState.results,
        duration,
        error: finalState.error,
        metrics: {
          totalTasks: finalState.plan?.tasks.length ?? 0,
          completedTasks,
          failedTasks,
          iterations: finalState.iteration,
          toolsUsed: Array.from(new Set(toolsUsed)),
        },
      };

      this.logger.info(
        `Orchestrator run completed: success=${result.success}, duration=${duration}ms, iterations=${finalState.iteration}`
      );

      return result;
    } catch (error) {
      this.logger.error('Orchestrator run failed', error);

      // Notify error callbacks
      this.notifyError(error instanceof Error ? error : new Error('Unknown error'), {
        phase: 'planning',
        iteration: 0,
        timestamp: Date.now(),
      });

      // Return error result
      return {
        success: false,
        status: 'failed' as WorkflowStatus,
        plan: this.currentState?.plan ?? {
          id: '',
          userRequest: request,
          tasks: [],
          context: {
            workspace: { root: '', files: [], openFiles: [] },
            git: { branch: '', uncommittedChanges: 0, status: '' },
            environment: { hasTypeScript: false },
          },
          dependencyGraph: {
            dependencies: new Map(),
            levels: new Map(),
            parallelGroups: [],
          },
          estimatedDuration: 0,
          createdAt: Date.now(),
        },
        results: new Map(),
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          recoverable: false,
        },
        metrics: {
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          iterations: 0,
          toolsUsed: [],
        },
      };
    } finally {
      this.isRunning = false;
      this.isCancelledFlag = false;
    }
  }

  /**
   * Get current orchestrator state
   * @returns Current state (deep copy)
   */
  public getState(): OrchestratorState | null {
    if (!this.currentState) {
      return null;
    }

    // Return deep copy to prevent external modifications
    return {
      ...this.currentState,
      results: new Map(this.currentState.results),
      parallelResults: this.currentState.parallelResults
        ? new Map(this.currentState.parallelResults)
        : undefined,
    };
  }

  /**
   * Set orchestrator state (merge with current state)
   * @param state Partial state to merge
   */
  public setState(state: Partial<OrchestratorState>): void {
    if (!this.currentState) {
      this.logger.warn('Cannot set state: no current state exists');
      return;
    }

    // Validate the partial state before merging
    if (!this.validateState({ ...this.currentState, ...state })) {
      this.logger.error('Invalid state provided to setState');
      throw new Error('Invalid state: state validation failed');
    }

    // Merge partial state with current state
    this.currentState = {
      ...this.currentState,
      ...state,
      // Ensure Maps are properly merged
      results: state.results ? new Map(state.results) : this.currentState.results,
      parallelResults: state.parallelResults
        ? new Map(state.parallelResults)
        : this.currentState.parallelResults,
    };

    this.logger.info('[DEBUG] State updated successfully');
  }

  /**
   * Reset orchestrator state to initial values
   */
  public resetState(): void {
    this.currentState = null;
    this.isRunning = false;
    this.isPausedFlag = false;
    this.isCancelledFlag = false;
    this.savedStateForResume = null;
    this.logger.info('Orchestrator state reset');
  }

  /**
   * Validate orchestrator state
   * @param state State to validate
   * @returns true if valid, false otherwise
   */
  private validateState(state: OrchestratorState): boolean {
    try {
      // Check required fields
      if (typeof state.userRequest !== 'string') {
        this.logger.error('Invalid state: userRequest must be a string');
        return false;
      }

      if (typeof state.iteration !== 'number' || state.iteration < 0) {
        this.logger.error('Invalid state: iteration must be a non-negative number');
        return false;
      }

      if (typeof state.maxIterations !== 'number' || state.maxIterations < 1) {
        this.logger.error('Invalid state: maxIterations must be a positive number');
        return false;
      }

      if (!(state.results instanceof Map)) {
        this.logger.error('Invalid state: results must be a Map');
        return false;
      }

      // Validate status
      const validStatuses: WorkflowStatus[] = [
        'planning',
        'executing',
        'evaluating',
        'refining',
        'complete',
        'failed',
        'hitl_required',
      ];
      if (!validStatuses.includes(state.status)) {
        this.logger.error(`Invalid state: status must be one of ${validStatuses.join(', ')}`);
        return false;
      }

      // Validate plan if present
      if (state.plan !== null) {
        if (typeof state.plan.id !== 'string' || !state.plan.id) {
          this.logger.error('Invalid state: plan.id must be a non-empty string');
          return false;
        }

        if (!Array.isArray(state.plan.tasks)) {
          this.logger.error('Invalid state: plan.tasks must be an array');
          return false;
        }
      }

      // Validate error if present
      if (state.error !== undefined) {
        if (typeof state.error.message !== 'string') {
          this.logger.error('Invalid state: error.message must be a string');
          return false;
        }

        if (typeof state.error.recoverable !== 'boolean') {
          this.logger.error('Invalid state: error.recoverable must be a boolean');
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error during state validation', error);
      return false;
    }
  }

  /**
   * Check if orchestrator is currently running
   * @returns true if running, false otherwise
   */
  public isExecuting(): boolean {
    return this.isRunning;
  }

  /**
   * Pause the current workflow execution
   * Saves current state for later resumption
   */
  public pause(): void {
    if (!this.isRunning) {
      this.logger.warn('Cannot pause: orchestrator is not running');
      return;
    }

    if (this.isPausedFlag) {
      this.logger.warn('Orchestrator is already paused');
      return;
    }

    this.isPausedFlag = true;
    this.isRunning = false;

    // Save current state for resume
    if (this.currentState) {
      this.savedStateForResume = {
        ...this.currentState,
        results: new Map(this.currentState.results),
        parallelResults: this.currentState.parallelResults
          ? new Map(this.currentState.parallelResults)
          : undefined,
      };
    }

    this.logger.info('Orchestrator paused');
  }

  /**
   * Resume a paused workflow execution
   * Continues from saved state
   */
  public async resume(): Promise<void> {
    if (!this.isPausedFlag) {
      this.logger.warn('Cannot resume: orchestrator is not paused');
      return;
    }

    if (!this.savedStateForResume) {
      this.logger.error('Cannot resume: no saved state available');
      throw new Error('No saved state available for resume');
    }

    this.logger.info('Resuming orchestrator from saved state');

    this.isPausedFlag = false;
    this.isRunning = true;

    // Restore state
    this.currentState = this.savedStateForResume;
    this.savedStateForResume = null;

    // Note: In a full implementation, we would continue graph execution here
    // For now, we just restore the state and mark as running
    this.logger.info('Orchestrator resumed (note: graph continuation not yet implemented)');
  }

  /**
   * Cancel the current workflow execution
   * Stops execution and cleans up resources
   */
  public cancel(): void {
    if (!this.isRunning && !this.isPausedFlag) {
      this.logger.warn('Cannot cancel: orchestrator is not running or paused');
      return;
    }

    this.isCancelledFlag = true;
    this.isRunning = false;
    this.isPausedFlag = false;

    // Update state to failed
    if (this.currentState) {
      this.currentState = {
        ...this.currentState,
        status: 'failed' as WorkflowStatus,
        error: {
          message: 'Workflow cancelled by user',
          recoverable: false,
        },
      };
    }

    // Clear saved state
    this.savedStateForResume = null;

    this.logger.info('Orchestrator cancelled');
  }

  /**
   * Check if orchestrator is paused
   * @returns true if paused, false otherwise
   */
  public isPaused(): boolean {
    return this.isPausedFlag;
  }

  /**
   * Check if orchestrator is cancelled
   * @returns true if cancelled, false otherwise
   */
  public isCancelled(): boolean {
    return this.isCancelledFlag;
  }

  /**
   * Register progress callback
   * @param callback Progress callback function
   */
  public onProgress(callback: ProgressCallback): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Register task complete callback
   * @param callback Task complete callback function
   */
  public onTaskComplete(callback: TaskCompleteCallback): void {
    this.taskCompleteCallbacks.push(callback);
  }

  /**
   * Register error callback
   * @param callback Error callback function
   */
  public onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Notify progress callbacks
   * @param update Progress update
   */
  private notifyProgress(update: ProgressUpdate): void {
    this.progressCallbacks.forEach((callback) => {
      try {
        callback(update);
      } catch (error) {
        this.logger.error('Error in progress callback', error);
      }
    });
  }

  /**
   * Notify task complete callbacks
   * @param taskId Task ID
   * @param result Executor output
   */
  private notifyTaskComplete(taskId: string, result: ExecutorOutput): void {
    this.taskCompleteCallbacks.forEach((callback) => {
      try {
        callback(taskId, result);
      } catch (error) {
        this.logger.error('Error in task complete callback', error);
      }
    });
  }

  /**
   * Notify error callbacks
   * @param error Error that occurred
   * @param context Execution context
   */
  private notifyError(error: Error, context: ExecutionContext): void {
    this.errorCallbacks.forEach((callback) => {
      try {
        callback(error, context);
      } catch (callbackError) {
        this.logger.error('Error in error callback', callbackError);
      }
    });
  }

  /**
   * Get agent metrics
   * @returns Metrics for all agents
   */
  public getMetrics() {
    return {
      planner: this.plannerAgent.getMetrics(),
      executor: this.executorAgent.getMetrics(),
      critic: this.criticAgent.getMetrics(),
    };
  }

  /**
   * Reset agent metrics
   */
  public resetMetrics(): void {
    this.plannerAgent.resetMetrics();
    this.executorAgent.resetMetrics();
    this.criticAgent.resetMetrics();
  }
}
