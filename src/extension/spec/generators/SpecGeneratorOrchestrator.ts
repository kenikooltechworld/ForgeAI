/**
 * Spec Generator Orchestrator
 * Runs the full spec generation pipeline with human checkpoints.
 *
 * Pipeline:
 *   Clarifier → SpecWriter → Architect → TaskDecomposer
 *   ↑ checkpoint    ↑ checkpoint  ↑ checkpoint  ↑ checkpoint
 */

import * as fs from 'fs';
import * as path from 'path';
import { ClarifierAgent } from './ClarifierAgent';
import { SpecWriterAgent } from './SpecWriterAgent';
import { ArchitectAgent } from './ArchitectAgent';
import { TaskDecomposerAgent } from './TaskDecomposerAgent';
import type {
  SpecGeneratorOptions,
  GeneratedSpec,
  HumanCheckpoint,
  CheckpointStatus,
} from './types';

export interface OrchestratorDeps {
  /** Execute LLM call (system prompt, user prompt) → response string */
  executeLLM: (systemPrompt: string, userPrompt: string) => Promise<string>;
  /** Read AGENTS.md */
  readConstitution: () => Promise<string>;
  /** Read memory bank file */
  readMemory: (file: 'product' | 'structure' | 'tech') => Promise<string>;
  /** Prompt user for checkpoint approval (returns 'approved' | 'rejected' + feedback) */
  requestCheckpoint: (checkpoint: HumanCheckpoint) => Promise<CheckpointStatus>;
}

export class SpecGeneratorOrchestrator {
  private readonly clarifier: ClarifierAgent;
  private readonly specWriter: SpecWriterAgent;
  private readonly architect: ArchitectAgent;
  private readonly taskDecomposer: TaskDecomposerAgent;

  constructor(private readonly deps: OrchestratorDeps) {
    this.clarifier = new ClarifierAgent({ executeLLM: deps.executeLLM });
    this.specWriter = new SpecWriterAgent({
      executeLLM: deps.executeLLM,
      readConstitution: deps.readConstitution,
      readMemory: deps.readMemory,
    });
    this.architect = new ArchitectAgent({
      executeLLM: deps.executeLLM,
      readConstitution: deps.readConstitution,
      readMemory: deps.readMemory,
    });
    this.taskDecomposer = new TaskDecomposerAgent({
      executeLLM: deps.executeLLM,
      readConstitution: deps.readConstitution,
    });
  }

  /**
   * Run the full spec generation pipeline.
   * Returns the generated spec with all checkpoint results.
   */
  public async run(options: SpecGeneratorOptions): Promise<GeneratedSpec> {
    const specDir = this.resolveSpecDir(options.projectRoot, options.specNumber);
    fs.mkdirSync(specDir, { recursive: true });

    const checkpoints: HumanCheckpoint[] = [];

    // ─── Step 1: Clarifier ───
    const clarifierResult = await this.clarifier.generate(
      specDir,
      options.userRequest
    );
    if (!clarifierResult.success) {
      throw new Error(`Clarifier failed: ${clarifierResult.error}`);
    }

    const cp1 = await this.runCheckpoint(
      'Clarifier',
      clarifierResult.filePath,
      'Clarifying questions generated. Review and answer before proceeding.',
      options.skipCheckpoints
    );
    checkpoints.push(cp1);
    if (cp1.status === 'rejected') {
      throw new Error(`Checkpoint rejected: ${cp1.feedback}`);
    }

    // ─── Step 2: SpecWriter ───
    const specWriterResult = await this.specWriter.generate(
      specDir,
      clarifierResult.content
    );
    if (!specWriterResult.success) {
      throw new Error(`SpecWriter failed: ${specWriterResult.error}`);
    }

    const cp2 = await this.runCheckpoint(
      'SpecWriter',
      specWriterResult.filePath,
      'Requirements written in EARS notation. Review for accuracy and completeness.',
      options.skipCheckpoints
    );
    checkpoints.push(cp2);
    if (cp2.status === 'rejected') {
      throw new Error(`Checkpoint rejected: ${cp2.feedback}`);
    }

    // ─── Step 3: Architect ───
    const architectResult = await this.architect.generate(
      specDir,
      specWriterResult.content
    );
    if (!architectResult.success) {
      throw new Error(`Architect failed: ${architectResult.error}`);
    }

    const cp3 = await this.runCheckpoint(
      'Architect',
      architectResult.filePath,
      'Technical plan generated. Review architecture, data model, and file structure.',
      options.skipCheckpoints
    );
    checkpoints.push(cp3);
    if (cp3.status === 'rejected') {
      throw new Error(`Checkpoint rejected: ${cp3.feedback}`);
    }

    // ─── Step 4: TaskDecomposer ───
    const taskResult = await this.taskDecomposer.generate(
      specDir,
      specWriterResult.content,
      architectResult.content
    );
    if (!taskResult.success) {
      throw new Error(`TaskDecomposer failed: ${taskResult.error}`);
    }

    const cp4 = await this.runCheckpoint(
      'TaskDecomposer',
      taskResult.filePath,
      'Atomic tasks generated. Review task granularity and requirement traceability.',
      options.skipCheckpoints
    );
    checkpoints.push(cp4);
    if (cp4.status === 'rejected') {
      throw new Error(`Checkpoint rejected: ${cp4.feedback}`);
    }

    return {
      specDir,
      clarificationsPath: clarifierResult.filePath,
      requirementsPath: specWriterResult.filePath,
      planPath: architectResult.filePath,
      tasksPath: taskResult.filePath,
      checkpoints,
    };
  }

  /**
   * Resolve the spec directory path, auto-incrementing if needed.
   */
  private resolveSpecDir(projectRoot: string, specNumber?: number): string {
    const specsDir = path.join(projectRoot, '.forgeai', 'specs');

    if (specNumber !== undefined) {
      return path.join(specsDir, String(specNumber).padStart(3, '0') + '-feature');
    }

    // Auto-increment: find highest existing spec number
    let maxNum = 0;
    if (fs.existsSync(specsDir)) {
      const entries = fs.readdirSync(specsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const match = entry.name.match(/^(\d{3})-/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      }
    }
    const nextNum = maxNum + 1;
    return path.join(specsDir, String(nextNum).padStart(3, '0') + '-feature');
  }

  private async runCheckpoint(
    phase: string,
    filePath: string,
    description: string,
    skipCheckpoints?: boolean
  ): Promise<HumanCheckpoint> {
    const checkpoint: HumanCheckpoint = {
      phase,
      filePath,
      description,
      status: 'pending',
    };

    if (skipCheckpoints) {
      checkpoint.status = 'approved';
      return checkpoint;
    }

    checkpoint.status = await this.deps.requestCheckpoint(checkpoint);
    return checkpoint;
  }
}
