/**
 * Core types for ForgeAI Spec-Driven Architecture
 * Replaces the LangGraph orchestrator with a spec-based task executor
 */

/**
 * EARS notation criteria extracted from requirements.md
 * EARS = Easy Approach to Requirements Syntax
 */
export interface EARSCriterion {
  /** EARS pattern type */
  pattern: 'ubiquitous' | 'event-driven' | 'state-driven' | 'unwanted-behavior' | 'optional';

  /** The requirement text in EARS notation */
  text: string;

  /** Requirement IDs this criterion traces back to */
  requirementIds: string[];
}

/**
 * A single requirement from requirements.md
 */
export interface SpecRequirement {
  /** Requirement number (e.g., "1", "2.3") */
  id: string;

  /** Requirement title */
  title: string;

  /** User story: "As a [role], I want [capability], so that [outcome]" */
  userStory?: string;

  /** Acceptance criteria in EARS notation */
  acceptanceCriteria: EARSCriterion[];

  /** In-scope items */
  inScope: string[];

  /** Out-of-scope items (critical for preventing scope creep) */
  outOfScope: string[];
}

/**
 * Task status tracking
 */
export type TaskStatus = 'pending' | 'in_progress' | 'complete' | 'failed' | 'skipped';

/**
 * A single executable task parsed from tasks.md
 */
export interface ExecutableTask {
  /** Task ID (e.g., "1.1", "5.2", "12.4") */
  id: string;

  /** Phase number (1-7) */
  phase: number;

  /** Task description */
  description: string;

  /** Detailed instructions for the task */
  instructions: string[];

  /** Requirement IDs this task traces back to */
  requirementIds: string[];

  /** Property test IDs (if this task has property tests) */
  propertyTests: PropertyTest[];

  /** Task IDs that must complete before this one can start */
  dependencies: string[];

  /** Current status */
  status: TaskStatus;

  /** Files this task should produce */
  expectedArtifacts: string[];

  /** Number of retry attempts so far */
  retryCount: number;

  /** Maximum retries allowed (default: 2) */
  maxRetries: number;

  /** Whether this is a checkpoint (not a real task, just a review point) */
  isCheckpoint: boolean;

  /** Whether this is a property test task */
  isPropertyTest: boolean;

  /** Parent task ID (for sub-tasks) */
  parentId?: string;

  /** Sub-tasks */
  subTasks?: ExecutableTask[];

  /** When the task was started */
  startedAt?: number;

  /** When the task was completed or failed */
  completedAt?: number;

  /** Error message if failed */
  error?: string;

  /** Actual artifacts produced */
  producedArtifacts: string[];
}

/**
 * Property test definition
 */
export interface PropertyTest {
  /** Property number */
  id: number;

  /** Property name */
  name: string;

  /** Requirement IDs this property validates */
  validates: string[];
}

/**
 * A phase grouping of tasks
 */
export interface TaskPhase {
  /** Phase number */
  number: number;

  /** Phase title */
  title: string;

  /** Tasks in this phase */
  tasks: ExecutableTask[];

  /** Whether all tasks in this phase are complete */
  isComplete: boolean;
}

/**
 * The complete parsed spec document
 */
export interface ParsedSpec {
  /** Spec ID */
  id: string;

  /** Spec directory path */
  specPath: string;

  /** Requirements parsed from requirements.md */
  requirements: SpecRequirement[];

  /** Tasks parsed from tasks.md */
  tasks: ExecutableTask[];

  /** Phases derived from tasks */
  phases: TaskPhase[];

  /** Task dependency graph */
  dependencyGraph: Map<string, string[]>;

  /** Phase number → title map (from tasks.md headers) */
  phaseTitles: Map<number, string>;

  /** Overall progress (0-100) */
  progress: number;

  /** Number of completed tasks */
  completedCount: number;

  /** Number of failed tasks */
  failedCount: number;

  /** Number of pending tasks */
  pendingCount: number;
}

/**
 * Spec context injected into AgentLoop system prompts
 */
export interface SpecContext {
  /** The full parsed spec */
  spec: ParsedSpec;

  /** The current task being executed */
  currentTask: ExecutableTask;

  /** Constitution content (AGENTS.md) */
  constitution: string;

  /** Memory bank content */
  memoryBank: {
    product: string;
    structure: string;
    tech: string;
  };

  /** Previously completed tasks and their outputs */
  completedTasks: CompletedTaskOutput[];
}

/**
 * Output from a completed task
 */
export interface CompletedTaskOutput {
  taskId: string;
  description: string;
  artifacts: string[];
  summary: string;
}

/**
 * Compliance check result
 */
export interface ComplianceResult {
  /** Did the task pass all acceptance criteria? */
  passed: boolean;

  /** Individual criterion results */
  criterionResults: CriterionResult[];

  /** Overall score (0-100) */
  score: number;

  /** Correction instructions if failed */
  correctionInstructions?: string;

  /** Time taken to verify */
  durationMs: number;
}

/**
 * Individual criterion check result
 */
export interface CriterionResult {
  /** The criterion text */
  criterion: string;

  /** Did this criterion pass? */
  passed: boolean;

  /** Explanation of why it passed or failed */
  explanation: string;
}

/**
 * Spec execution options
 */
export interface SpecExecutionOptions {
  /** Whether to stop at checkpoints for human review */
  stopAtCheckpoints: boolean;

  /** Whether to auto-retry failed tasks */
  autoRetry: boolean;

  /** Max retries per task */
  maxRetries: number;

  /** Whether to continue on task failure (skip failed, proceed with next) */
  continueOnFailure: boolean;

  /** Callback for task progress updates */
  onTaskProgress?: (task: ExecutableTask, progress: number) => void;

  /** Callback for task completion */
  onTaskComplete?: (task: ExecutableTask, result: ComplianceResult) => void;

  /** Callback for task failure */
  onTaskFail?: (task: ExecutableTask, error: string) => void;

  /** Callback for checkpoint reached */
  onCheckpoint?: (phase: TaskPhase) => Promise<boolean>; // return true to continue, false to pause

  /** Callback for phase gate validation result */
  onPhaseGate?: (phase: TaskPhase, passed: boolean, output: string) => void;

  /** Optional filter — if provided, only tasks where this returns true will be executed */
  taskFilter?: (task: ExecutableTask) => boolean;
}

/**
 * Spec directory layout constants
 */
export const SPEC_DIR_LAYOUT = {
  /** Root spec directory */
  specsDir: '.forgeai/specs',

  /** Constitution file */
  constitution: 'AGENTS.md',

  /** Memory bank directory */
  memoryDir: '.forgeai/memory',

  /** Product description */
  productFile: '.forgeai/memory/product.md',

  /** Codebase structure */
  structureFile: '.forgeai/memory/structure.md',

  /** Tech stack decisions */
  techFile: '.forgeai/memory/tech.md',

  /** Requirements document */
  requirementsFile: 'requirements.md',

  /** Technical plan */
  planFile: 'plan.md',

  /** Tasks document */
  tasksFile: 'tasks.md',

  /** Task status tracking */
  statusFile: '.status',

  /** Design system output directory */
  designSystemDir: '.forgeai/design-system',

  /** Component specs directory */
  componentSpecsDir: 'component-specs',

  /** Wireframes directory */
  wireframesDir: 'wireframes',
} as const;
