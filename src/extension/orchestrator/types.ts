/**
 * Type definitions for Multi-Agent Orchestration System
 *
 * This file contains all TypeScript interfaces and types used across
 * the orchestration system, including state management, task planning,
 * execution, and evaluation.
 */

/**
 * Task types that can be executed by the Executor agent
 */
export type TaskType =
  | 'read_code' // Read and understand existing code
  | 'analyze' // Analyze code for issues or patterns
  | 'generate_fix' // Generate code fixes or implementations
  | 'run_tests' // Execute tests
  | 'apply_changes' // Apply code changes to files
  | 'verify'; // Verify changes work correctly

/**
 * Workflow execution status
 */
export type WorkflowStatus =
  | 'planning' // Planner is creating the task plan
  | 'executing' // Executor is working on tasks
  | 'evaluating' // Critic is evaluating results
  | 'refining' // Executor is refining based on feedback
  | 'complete' // Workflow completed successfully
  | 'failed' // Workflow failed
  | 'hitl_required'; // Human-in-the-loop required

/**
 * Task execution status
 */
export type TaskStatus =
  | 'pending' // Task not started yet
  | 'in_progress' // Task currently executing
  | 'pass' // Task completed successfully (alias: success)
  | 'fail' // Task failed (alias: failed)
  | 'needs_refinement' // Task needs improvement (alias: partial)
  | 'success' // Task completed successfully
  | 'partial' // Task partially complete
  | 'failed'; // Task failed

/**
 * Success criteria for task validation
 */
export interface SuccessCriteria {
  /** Functional requirements that must be met */
  functional: string[];

  /** Code quality standards to maintain */
  quality: string[];

  /** Performance requirements (optional) */
  performance?: string[];
}

/**
 * Individual task in the execution plan
 */
export interface Task {
  /** Unique task identifier */
  id: string;

  /** Type of task to execute */
  type: TaskType;

  /** Human-readable description of what the task should accomplish */
  description: string;

  /** IDs of tasks that must complete before this task can start */
  dependencies: string[];

  /** Success criteria for validating task completion */
  criteria: SuccessCriteria;

  /** Priority level: P0 (critical), P1 (high), P2 (medium) */
  priority: 'P0' | 'P1' | 'P2';

  /** Estimated duration in milliseconds */
  estimatedDuration: number;

  /** Additional task-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Dependency graph structure
 */
export interface DependencyGraph {
  /** Map of task ID to its dependencies */
  dependencies: Map<string, string[]>;

  /** Execution levels (0 = no dependencies, 1 = depends on level 0, etc.) */
  levels: Map<string, number>;

  /** Tasks that can be executed in parallel at each level */
  parallelGroups: string[][];
}

/**
 * Workspace context for planning
 */
export interface PlanContext {
  /** Workspace root path */
  workspace: {
    root: string;
    files: string[];
    openFiles: string[];
  };

  /** Git repository information */
  git: {
    branch: string;
    uncommittedChanges: number;
    status: string;
  };

  /** Development environment details */
  environment: {
    nodeVersion?: string;
    packageManager?: string;
    testFramework?: string;
    hasTypeScript: boolean;
  };

  /** Recent file changes */
  recentChanges?: {
    file: string;
    timestamp: number;
  }[];
}

/**
 * Complete task plan created by Planner agent
 */
export interface TaskPlan {
  /** Unique plan identifier */
  id: string;

  /** Original user request */
  userRequest: string;

  /** List of tasks to execute */
  tasks: Task[];

  /** Workspace context used for planning */
  context: PlanContext;

  /** Dependency graph for task execution order */
  dependencyGraph: DependencyGraph;

  /** Total estimated duration in milliseconds */
  estimatedDuration: number;

  /** Timestamp when plan was created */
  createdAt: number;
}

/**
 * Self-evaluation by Executor agent
 */
export interface SelfEvaluation {
  /** Confidence score (0.0 - 1.0) */
  confidence: number;

  /** Concerns or potential issues identified */
  concerns: string[];

  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Output from Executor agent after task execution
 */
export interface ExecutorOutput {
  /** ID of the task that was executed */
  taskId: string;

  /** Execution status */
  status: TaskStatus;

  /** Result data from task execution */
  result: any;

  /** Self-evaluation of the work */
  selfEvaluation: SelfEvaluation;

  /** Tools used during execution */
  toolsUsed: string[];

  /** Execution duration in milliseconds */
  duration: number;

  /** Timestamp when execution completed */
  timestamp: number;
}

/**
 * Error pattern recognized by Critic agent
 */
export interface ErrorPattern {
  /** Pattern identifier */
  id: string;

  /** Pattern name */
  name: string;

  /** Pattern description */
  description: string;

  /** Suggested recovery strategy */
  recovery?: string;
}

/**
 * Feedback from Critic agent
 */
export interface CriticFeedback {
  /** Overall assessment */
  status: 'pass' | 'fail' | 'needs_refinement';

  /** Specific issues found */
  issues: string[];

  /** Required changes to pass validation */
  requiredChanges: string[];

  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Validation result for specific criteria
 */
export interface ValidationResult {
  /** Whether validation passed */
  passed: boolean;

  /** Validation score (0.0 - 1.0) */
  score: number;

  /** Issues found during validation */
  issues: string[];
}

/**
 * Output from Critic agent after evaluation
 */
export interface CriticOutput {
  /** ID of the task that was evaluated */
  taskId: string;

  /** Evaluation status */
  status: 'pass' | 'fail' | 'needs_refinement';

  /** Confidence in the evaluation (0.0 - 1.0) */
  confidence: number;

  /** Detailed feedback for the Executor */
  feedback: CriticFeedback;

  /** Error pattern if recognized */
  errorPattern?: ErrorPattern;

  /** Timestamp when evaluation completed */
  timestamp: number;
}

/**
 * Recovery strategy for handling errors
 */
export interface RecoveryStrategy {
  /** Strategy identifier */
  id: string;

  /** Strategy name */
  name: string;

  /** Steps to execute for recovery */
  steps: string[];

  /** Estimated success probability (0.0 - 1.0) */
  successProbability: number;
}

/**
 * Main orchestrator state (used by LangGraph)
 */
export interface OrchestratorState {
  /** Original user request */
  userRequest: string;

  /** Current task plan */
  plan: TaskPlan | null;

  /** Currently executing task */
  currentTask: Task | null;

  /** Map of task ID to execution results */
  results: Map<string, ExecutorOutput>;

  /** Current iteration count */
  iteration: number;

  /** Maximum iterations allowed */
  maxIterations: number;

  /** Current workflow status */
  status: WorkflowStatus;

  /** Error information if workflow failed */
  error?: {
    message: string;
    stack?: string;
    recoverable: boolean;
  };

  /** Tasks that can be executed in parallel */
  parallelTasks?: Task[];

  /** Results from parallel execution */
  parallelResults?: Map<string, ExecutorOutput>;

  /** Last critic feedback — passed to executor on retry (design.md Section 2.2) */
  lastFeedback?: CriticFeedback;
}

/**
 * Input for Planner agent
 */
export interface PlannerInput {
  /** User request to decompose into tasks */
  userRequest: string;

  /** Workspace context */
  context: PlanContext;

  /** Previous plan if replanning */
  previousPlan?: TaskPlan;

  /** Feedback from Critic if replanning */
  feedback?: CriticFeedback;
}

/**
 * Input for Executor agent
 */
export interface ExecutorInput {
  /** Task to execute */
  task: Task;

  /** Workspace and planning context */
  context?: PlanContext;

  /** Results from dependent tasks */
  dependencyResults: Map<string, ExecutorOutput>;

  /** Feedback from Critic if refining */
  feedback?: CriticFeedback;

  /** Previous attempt if retrying */
  previousOutput?: ExecutorOutput;

  /** Current iteration number (1-based) */
  iteration?: number;
}

/**
 * Input for Critic agent
 */
export interface CriticInput {
  /** Task that was executed */
  task: Task;

  /** Output from Executor */
  executorOutput: ExecutorOutput;

  /** Original task plan for context */
  plan: TaskPlan;
}

/**
 * Progress update for monitoring
 */
export interface ProgressUpdate {
  /** Current workflow status */
  status: WorkflowStatus;

  /** Current task being executed */
  currentTask?: Task;

  /** Number of completed tasks */
  completedTasks: number;

  /** Total number of tasks */
  totalTasks: number;

  /** Progress percentage (0-100) */
  progress: number;

  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;

  /** Timestamp of update */
  timestamp: number;
}

/**
 * Final result from orchestrator execution
 */
export interface OrchestratorResult {
  /** Whether execution was successful */
  success: boolean;

  /** Final workflow status */
  status: WorkflowStatus;

  /** Task plan that was executed */
  plan: TaskPlan;

  /** All task execution results */
  results: Map<string, ExecutorOutput>;

  /** Total execution duration in milliseconds */
  duration: number;

  /** Error information if failed */
  error?: {
    message: string;
    stack?: string;
    recoverable: boolean;
  };

  /** Metrics and statistics */
  metrics: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    iterations: number;
    toolsUsed: string[];
  };
}

/**
 * Options for orchestrator execution
 */
export interface RunOptions {
  /** Maximum iterations allowed (default: 20) */
  maxIterations?: number;

  /** Enable parallel execution (default: false) */
  enableParallel?: boolean;

  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;

  /** Enable verbose logging (default: false) */
  verbose?: boolean;

  /** Model to use for agent execution (optional, defaults to gemma4:31b-cloud) */
  model?: string;
}

/**
 * Callback types for monitoring
 */
export type ProgressCallback = (update: ProgressUpdate) => void;
export type TaskCompleteCallback = (taskId: string, result: ExecutorOutput) => void;
export type ErrorCallback = (error: Error, context: { task?: Task; phase: string }) => void;

/**
 * Execution context for error handling
 */
export interface ExecutionContext {
  /** Current task being executed */
  task?: Task;

  /** Current execution phase */
  phase: 'planning' | 'executing' | 'evaluating' | 'refining';

  /** Iteration number */
  iteration: number;

  /** Timestamp */
  timestamp: number;
}
