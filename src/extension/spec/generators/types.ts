/**
 * Spec Generator Types
 * Shared types for all spec generator agents.
 */

/** Result of a spec generation step */
export interface SpecGenerationResult {
  /** Whether generation succeeded */
  success: boolean;
  /** Path to the generated file */
  filePath: string;
  /** Generated content */
  content: string;
  /** Error message if failed */
  error?: string;
}

/** Human checkpoint status */
export type CheckpointStatus = 'pending' | 'approved' | 'rejected';

/** Checkpoint that requires human review */
export interface HumanCheckpoint {
  /** Phase name */
  phase: string;
  /** File to review */
  filePath: string;
  /** Description of what was generated */
  description: string;
  /** Current status */
  status: CheckpointStatus;
  /** User feedback if rejected */
  feedback?: string;
}

/** Options for running the spec generator pipeline */
export interface SpecGeneratorOptions {
  /** Project root directory */
  projectRoot: string;
  /** Feature name (kebab-case) */
  featureName: string;
  /** User's initial request/description */
  userRequest: string;
  /** Next spec number (auto-incremented if not provided) */
  specNumber?: number;
  /** Whether to skip human checkpoints (autopilot mode) */
  skipCheckpoints?: boolean;
}

/** Complete spec after full pipeline */
export interface GeneratedSpec {
  /** Spec directory path */
  specDir: string;
  /** Clarifications file path */
  clarificationsPath: string;
  /** Requirements file path */
  requirementsPath: string;
  /** Plan file path */
  planPath: string;
  /** Tasks file path */
  tasksPath: string;
  /** All checkpoint results */
  checkpoints: HumanCheckpoint[];
}

/** System prompt templates for each generator agent */
export interface GeneratorPromptTemplate {
  /** Agent role description */
  role: string;
  /** Instructions for the agent */
  instructions: string[];
  /** Output format specification */
  outputFormat: string;
  /** Examples of good output */
  examples?: string[];
}
