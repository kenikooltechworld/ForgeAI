/**
 * LangGraph State Machine for Multi-Agent Orchestration
 * Coordinates Planner, Executor, and Critic agents
 */

import { StateGraph, Annotation, MemorySaver } from '@langchain/langgraph';
import { PlannerAgent, gatherWorkspaceContext } from '../agents/PlannerAgent';
import { ExecutorAgent } from '../agents/ExecutorAgent';
import { CriticAgent } from '../agents/CriticAgent';
import { TaskPlan, Task, ExecutorOutput, WorkflowStatus } from './types';

/**
 * Define state annotation for LangGraph
 * This defines the shape of the state and how updates are merged
 */
const StateAnnotation = Annotation.Root({
  // Input
  userRequest: Annotation<string>({
    reducer: (current, update) => update ?? current,
    default: () => '',
  }),

  // Planning
  plan: Annotation<TaskPlan | null>({
    reducer: (current, update) => update ?? current,
    default: () => null,
  }),

  // Execution
  currentTask: Annotation<Task | null>({
    reducer: (current, update) => update ?? current,
    default: () => null,
  }),

  results: Annotation<Map<string, ExecutorOutput>>({
    reducer: (current, update) => {
      // Merge results maps
      const merged = new Map(current);
      if (update) {
        for (const [key, value] of update.entries()) {
          merged.set(key, value);
        }
      }
      return merged;
    },
    default: () => new Map(),
  }),

  // Iteration tracking
  iteration: Annotation<number>({
    reducer: (current, update) => update ?? current,
    default: () => 0,
  }),

  maxIterations: Annotation<number>({
    reducer: (current, update) => update ?? current,
    default: () => 5,
  }),

  // Status
  status: Annotation<WorkflowStatus>({
    reducer: (current, update) => update ?? current,
    default: () => 'planning' as WorkflowStatus,
  }),

  error: Annotation<{ message: string; stack?: string; recoverable: boolean } | undefined>({
    reducer: (current, update) => update ?? current,
    default: () => undefined,
  }),

  // Parallel execution (for future use)
  parallelTasks: Annotation<Task[] | undefined>({
    reducer: (current, update) => update ?? current,
    default: () => undefined,
  }),

  parallelResults: Annotation<Map<string, ExecutorOutput> | undefined>({
    reducer: (current, update) => update ?? current,
    default: () => undefined,
  }),

  // Critic feedback for executor refinement
  lastFeedback: Annotation<import('./types').CriticFeedback | undefined>({
    reducer: (current, update) => update ?? current,
    default: () => undefined,
  }),
});

/**
 * Graph builder class that holds agent instances
 * This allows node functions to access agents without custom config parameters
 */
class GraphBuilder {
  constructor(
    private plannerAgent: PlannerAgent,
    private executorAgent: ExecutorAgent,
    private criticAgent: CriticAgent
  ) {}

  /**
   * Planner node - Creates task plan from user request
   */
  async plannerNode(
    state: typeof StateAnnotation.State,
    config?: { configurable?: { model?: string } }
  ): Promise<Partial<typeof StateAnnotation.State>> {
    try {
      const model = config?.configurable?.model;

      // Gather real workspace context (files, git, environment)
      let context;
      try {
        context = await gatherWorkspaceContext();
      } catch {
        // Fallback context if VS Code APIs unavailable (e.g. in tests)
        context = {
          workspace: { root: '', files: [], openFiles: [] },
          git: { branch: 'unknown', uncommittedChanges: 0, status: 'unknown' },
          environment: { hasTypeScript: false },
        };
      }

      const plan = await this.plannerAgent.plan({ userRequest: state.userRequest, context }, model);

      // Set the first task as currentTask so the executor can start immediately
      const firstTask = plan.tasks.length > 0 ? plan.tasks[0] : null;

      return {
        plan,
        currentTask: firstTask,
        status: 'executing' as WorkflowStatus,
      };
    } catch (error) {
      return {
        status: 'failed' as WorkflowStatus,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error in planner',
          stack: error instanceof Error ? error.stack : undefined,
          recoverable: false,
        },
      };
    }
  }

  /**
   * Executor node - Executes current task
   */
  async executorNode(
    state: typeof StateAnnotation.State
  ): Promise<Partial<typeof StateAnnotation.State>> {
    try {
      const currentTask = state.currentTask;
      if (!currentTask) {
        throw new Error('No current task to execute');
      }

      // Collect results from dependency tasks to pass as context
      const dependencyResults = new Map<string, ExecutorOutput>();
      for (const depId of currentTask.dependencies) {
        const depResult = state.results.get(depId);
        if (depResult) {
          dependencyResults.set(depId, depResult);
        }
      }

      const previousOutput = state.results.get(currentTask.id);

      const output =
        state.lastFeedback && previousOutput
          ? await this.executorAgent.refine(previousOutput, state.lastFeedback)
          : await this.executorAgent.execute({
              task: currentTask,
              dependencyResults,
              iteration: state.iteration + 1,
              feedback: state.lastFeedback, // Pass critic feedback on retry
            });

      const updatedResults = new Map(state.results);
      updatedResults.set(currentTask.id, output);

      return {
        results: updatedResults,
        status: 'evaluating' as WorkflowStatus,
      };
    } catch (error) {
      return {
        status: 'failed' as WorkflowStatus,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error in executor',
          stack: error instanceof Error ? error.stack : undefined,
          recoverable: true,
        },
      };
    }
  }

  /**
   * Critic node - Evaluates executor's work
   */
  async criticNode(
    state: typeof StateAnnotation.State
  ): Promise<Partial<typeof StateAnnotation.State>> {
    try {
      // Get current task and its result
      const currentTask = state.currentTask;
      if (!currentTask) {
        throw new Error('No current task to evaluate');
      }

      const executorOutput = state.results.get(currentTask.id);
      if (!executorOutput) {
        throw new Error(`No result found for task ${currentTask.id}`);
      }

      // Evaluate result
      const evaluation = await this.criticAgent.evaluate({
        task: currentTask,
        executorOutput,
        plan: state.plan!,
      });

      // Determine next status based on evaluation
      let nextStatus: WorkflowStatus;
      if (evaluation.status === 'pass') {
        nextStatus = 'complete';
      } else if (state.iteration >= state.maxIterations) {
        nextStatus = 'failed';
      } else {
        nextStatus = 'refining';
      }

      return {
        status: nextStatus,
        iteration: state.iteration + 1,
        // Store feedback so executor can use it on retry
        lastFeedback: evaluation.status === 'fail' ? evaluation.feedback : undefined,
      };
    } catch (error) {
      return {
        status: 'failed' as WorkflowStatus,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error in critic',
          stack: error instanceof Error ? error.stack : undefined,
          recoverable: false,
        },
        iteration: state.iteration + 1,
      };
    }
  }

  /**
   * Route from critic node based on evaluation result
   */
  routeCritic(state: typeof StateAnnotation.State): string {
    // Check if max iterations reached
    if (state.iteration >= state.maxIterations) {
      return '__end__';
    }

    // Check if task passed
    if (state.status === 'complete') {
      return 'next_task';
    }

    // Otherwise, retry with feedback
    return 'executor';
  }

  /**
   * Route from next_task node to determine what to do next
   */
  routeNextTask(state: typeof StateAnnotation.State): string {
    // Check if all tasks are complete
    if (!state.plan || state.results.size >= state.plan.tasks.length) {
      return '__end__';
    }

    // TODO: Check if can run in parallel (future feature)
    // if (state.parallelTasks && state.parallelTasks.length > 0) {
    //   return 'parallel_executor';
    // }

    // Otherwise, execute next task sequentially
    return 'executor';
  }

  /**
   * Create and compile the state graph with checkpointer
   */
  createGraph() {
    // Create graph and add all nodes using method chaining
    // This helps TypeScript infer the node names correctly
    const graph = new StateGraph(StateAnnotation)
      .addNode('planner', this.plannerNode.bind(this))
      .addNode('executor', this.executorNode.bind(this))
      .addNode('critic', this.criticNode.bind(this))
      .addNode('next_task', async (state: typeof StateAnnotation.State) => {
        // Advance to the next task whose dependencies are all satisfied
        if (!state.plan) return state;

        const completedIds = new Set(state.results.keys());
        const nextTask =
          state.plan.tasks.find(
            (t) =>
              !completedIds.has(t.id) && t.dependencies.every((depId) => completedIds.has(depId))
          ) ?? null;

        return {
          currentTask: nextTask,
          status: nextTask ? ('executing' as WorkflowStatus) : ('complete' as WorkflowStatus),
        };
      })
      .addEdge('__start__', 'planner')
      .addEdge('planner', 'executor')
      .addEdge('executor', 'critic');

    // Add conditional edges with routing maps
    graph.addConditionalEdges('critic', this.routeCritic.bind(this), {
      __end__: '__end__',
      next_task: 'next_task',
      executor: 'executor',
    });

    graph.addConditionalEdges('next_task', this.routeNextTask.bind(this), {
      __end__: '__end__',
      executor: 'executor',
    });

    return graph;
  }

  /**
   * Compile the graph with checkpointer
   */
  compile() {
    const memorySaver = new MemorySaver();
    return this.createGraph().compile({
      checkpointer: memorySaver,
    });
  }
}

/**
 * Export the GraphBuilder class for creating graph instances
 */
export { GraphBuilder, StateAnnotation };
