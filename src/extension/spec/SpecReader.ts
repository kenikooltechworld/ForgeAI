/**
 * SpecReader — Parses spec documents (requirements.md, tasks.md) into executable tasks
 *
 * Replaces the LangGraph orchestrator's implicit task generation with explicit
 * spec-based task parsing. Reads markdown spec files and produces ExecutableTask[]
 * that the SpecTaskExecutor can run sequentially.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ParsedSpec,
  ExecutableTask,
  SpecRequirement,
  EARSCriterion,
  TaskPhase,
  PropertyTest,
  TaskStatus,
  SPEC_DIR_LAYOUT,
} from './types';

/**
 * Simple internal logger that doesn't require VS Code ExtensionContext
 */
class SpecLogger {
  private readonly prefix: string;
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  info(msg: string) {
    console.log(`[${this.prefix}] ${msg}`);
  }
  warn(msg: string) {
    console.warn(`[${this.prefix}] ${msg}`);
  }
  error(msg: string) {
    console.error(`[${this.prefix}] ${msg}`);
  }
}

/**
 * Parses spec documents from a directory into executable tasks
 */
export class SpecReader {
  private readonly logger: SpecLogger;

  constructor() {
    this.logger = new SpecLogger('SpecReader');
  }

  /**
   * Parse a spec directory into a ParsedSpec
   *
   * @param specDir — Path to the spec directory (e.g., "ui-ux-architect-agent/")
   * @returns ParsedSpec with requirements, tasks, and phases
   */
  public async parseSpecDirectory(specDir: string): Promise<ParsedSpec> {
    this.logger.info(`Parsing spec directory: ${specDir}`);

    const requirementsPath = path.join(specDir, SPEC_DIR_LAYOUT.requirementsFile);
    const tasksPath = path.join(specDir, SPEC_DIR_LAYOUT.tasksFile);
    const statusPath = path.join(specDir, SPEC_DIR_LAYOUT.statusFile);

    // Parse requirements
    const requirements = fs.existsSync(requirementsPath)
      ? this.parseRequirements(fs.readFileSync(requirementsPath, 'utf-8'))
      : [];

    // Parse tasks
    const tasks = fs.existsSync(tasksPath)
      ? this.parseTasks(fs.readFileSync(tasksPath, 'utf-8'))
      : [];

    // Load saved status if exists
    if (fs.existsSync(statusPath)) {
      this.applySavedStatus(tasks, statusPath);
    }

    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(tasks);

    // Group into phases
    const phases = this.groupIntoPhases(tasks);

    // Calculate progress
    const completedCount = tasks.filter((t) => t.status === 'complete').length;
    const failedCount = tasks.filter((t) => t.status === 'failed').length;
    const pendingCount = tasks.filter((t) => t.status === 'pending').length;
    const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

    const spec: ParsedSpec = {
      id: path.basename(specDir),
      specPath: specDir,
      requirements,
      tasks,
      phases,
      dependencyGraph,
      progress,
      completedCount,
      failedCount,
      pendingCount,
    };

    this.logger.info(
      `Parsed spec: ${requirements.length} requirements, ${tasks.length} tasks, ${phases.length} phases, ${progress}% complete`
    );

    return spec;
  }

  /**
   * Parse requirements.md content into SpecRequirement objects
   *
   * Handles Kiro-style format:
   * ### Requirement N: Title
   * **User Story:** As a [role], I want [capability], so that [outcome].
   * #### Acceptance Criteria
   * 1. WHEN ... THE system SHALL ...
   * 2. THE system SHALL ...
   */
  public parseRequirements(content: string): SpecRequirement[] {
    const requirements: SpecRequirement[] = [];
    const lines = content.split('\n');

    let currentReq: Partial<SpecRequirement> | null = null;
    let inAcceptanceCriteria = false;
    const currentCriterionText = '';

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Match: ### Requirement 1: Title
      const reqMatch = line.match(/^###\s+Requirement\s+(\d+(?:\.\d+)?)\s*:\s*(.+)$/i);
      if (reqMatch) {
        // Save previous requirement
        if (currentReq && currentReq.id) {
          requirements.push(currentReq as SpecRequirement);
        }
        currentReq = {
          id: reqMatch[1],
          title: reqMatch[2],
          acceptanceCriteria: [],
          inScope: [],
          outOfScope: [],
        };
        inAcceptanceCriteria = false;
        continue;
      }

      // Match: **User Story:** ...
      const storyMatch = line.match(/^\*\*User Story:\*\*\s*(.+)$/i);
      if (storyMatch && currentReq) {
        currentReq.userStory = storyMatch[1];
        continue;
      }

      // Match: #### Acceptance Criteria
      if (line.match(/^#{3,4}\s+Acceptance Criteria/i)) {
        inAcceptanceCriteria = true;
        continue;
      }

      // Match numbered acceptance criteria within acceptance criteria section
      if (inAcceptanceCriteria && currentReq && currentReq.acceptanceCriteria) {
        const criterionMatch = line.match(/^(\d+)\.\s*(.+)$/);
        if (criterionMatch) {
          const text = criterionMatch[2];
          const pattern = this.detectEARSPattern(text);
          currentReq.acceptanceCriteria.push({
            pattern,
            text,
            requirementIds: [currentReq.id!],
          });
        }
      }

      // Match: ### Requirement N: Title (alternative format without colon)
      const reqMatchAlt = line.match(/^###\s+Requirement\s+(\d+(?:\.\d+)?)\s+(.+)$/i);
      if (reqMatchAlt && !reqMatch) {
        if (currentReq && currentReq.id) {
          requirements.push(currentReq as SpecRequirement);
        }
        currentReq = {
          id: reqMatchAlt[1],
          title: reqMatchAlt[2],
          acceptanceCriteria: [],
          inScope: [],
          outOfScope: [],
        };
        inAcceptanceCriteria = false;
      }
    }

    // Save last requirement
    if (currentReq && currentReq.id) {
      requirements.push(currentReq as SpecRequirement);
    }

    return requirements;
  }

  /**
   * Parse tasks.md content into ExecutableTask objects
   *
   * Handles Kiro-style format:
   * ### Phase N: Title
   * - [ ] N.M Task description
   *   - Sub-instruction 1
   *   - Sub-instruction 2
   *   _Requirements: 1.1, 1.2_
   *   - [ ]* N.M Property test (marked with asterisk)
   *     - **Property P: Name**
   *     - **Validates: Requirements ...**
   *
   * - [ ] N Checkpoint - Title
   */
  public parseTasks(content: string): ExecutableTask[] {
    const tasks: ExecutableTask[] = [];
    const lines = content.split('\n');

    let currentPhase = 0;
    let currentTask: ExecutableTask | null = null;
    let inSubInstructions = false;
    let indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trimEnd();
      const trimmed = line.trim();

      // Match phase header: ### Phase N: Title
      const phaseMatch = trimmed.match(/^#{3}\s+Phase\s+(\d+)\s*[:\-]?\s*(.+)$/i);
      if (phaseMatch) {
        currentPhase = parseInt(phaseMatch[1], 10);
        // Save current task
        if (currentTask) {
          tasks.push(currentTask);
          currentTask = null;
        }
        inSubInstructions = false;
        continue;
      }

      // Match task item: - [ ] N.M Task description
      // Also matches: - [ ]* N.M Property test (asterisk = property test)
      const taskMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\*?\s+(\d+(?:\.\d+)?)\s+(.+)$/);
      if (taskMatch && currentPhase > 0) {
        // Save previous task
        if (currentTask) {
          tasks.push(currentTask);
        }

        const indent = taskMatch[1].length;
        const checked = taskMatch[2].toLowerCase() === 'x';
        const isPropertyTest = line.includes('[ ]*') || line.includes('[x]*');
        const taskId = taskMatch[3];
        const description = taskMatch[4].trim();

        currentTask = {
          id: taskId,
          phase: currentPhase,
          description,
          instructions: [],
          requirementIds: [],
          propertyTests: [],
          dependencies: [],
          status: checked ? 'complete' : 'pending',
          expectedArtifacts: [],
          retryCount: 0,
          maxRetries: 2,
          isCheckpoint: description.toLowerCase().includes('checkpoint'),
          isPropertyTest,
          producedArtifacts: [],
        };

        inSubInstructions = true;
        indentLevel = indent + 2; // Sub-items should be more indented
        continue;
      }

      // If we're inside a task, collect sub-instructions
      if (currentTask && inSubInstructions) {
        const trimmedLine = trimmed;

        // Empty line or horizontal rule ends sub-instructions
        if (trimmedLine === '' || trimmedLine === '---') {
          inSubInstructions = false;
          continue;
        }

        // Another task at same or less indent ends sub-instructions
        if (trimmedLine.startsWith('- [') && !trimmedLine.match(/^-\s+\[[ xX]\]\*?\s+\d+/)) {
          inSubInstructions = false;
          continue;
        }

        // Match requirements traceability: _Requirements: 1.1, 1.2_
        // Also handles: - _Requirements: 1.1, 1.3_ and *Requirements: 1.1, 1.3*
        const reqMatch = trimmedLine.match(
          /^(?:[-*]\s+)?[_*]?Requirements:\s*([\d.,\s]+)(?:\s*[_*])?/i
        );
        if (reqMatch) {
          const reqStr = reqMatch[1];
          currentTask.requirementIds = reqStr
            .split(/,\s*/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          continue;
        }

        // Match property test: **Property N: Name**
        const propMatch = trimmedLine.match(/^\*\*Property\s+(\d+)\s*:\s*(.+)\*\*$/);
        if (propMatch) {
          const prop: PropertyTest = {
            id: parseInt(propMatch[1], 10),
            name: propMatch[2].trim(),
            validates: [],
          };
          currentTask.propertyTests.push(prop);
          continue;
        }

        // Match validates: **Validates: Requirements ...**
        const validatesMatch = trimmedLine.match(
          /^\*\*Validates:\s*Requirements?\s*([\d.,\s]+)\*\*$/i
        );
        if (validatesMatch && currentTask.propertyTests.length > 0) {
          const lastProp = currentTask.propertyTests[currentTask.propertyTests.length - 1];
          lastProp.validates = validatesMatch[1]
            .split(/,\s*/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          continue;
        }

        // Collect instructions (any line that looks like a task detail)
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          const instruction = trimmedLine.replace(/^[-*]\s*/, '');
          // Skip requirement traceability lines (already handled above, but guard here too)
          if (!instruction.match(/^[_*]?Requirements?:/i)) {
            currentTask.instructions.push(instruction);
          }
        } else if (trimmedLine.length > 0) {
          // Continuation of previous instruction or standalone detail
          // Skip if it looks like a requirement traceability line
          if (!trimmedLine.match(/^[_*]?Requirements?:/i)) {
            currentTask.instructions.push(trimmedLine);
          }
        }
      }
    }

    // Save last task
    if (currentTask) {
      tasks.push(currentTask);
    }

    // Post-process: infer dependencies
    this.inferDependencies(tasks);

    // Post-process: infer expected artifacts from instructions
    this.inferArtifacts(tasks);

    return tasks;
  }

  /**
   * Detect EARS pattern from criterion text
   */
  private detectEARSPattern(text: string): EARSCriterion['pattern'] {
    const lower = text.toLowerCase();
    if (lower.match(/^when\s+/)) return 'event-driven';
    if (lower.match(/^while\s+/)) return 'state-driven';
    if (lower.match(/^if\s+/)) return 'unwanted-behavior';
    if (lower.match(/^where\s+/)) return 'optional';
    return 'ubiquitous';
  }

  /**
   * Infer task dependencies based on task IDs
   * Task 5.2 depends on 5.1 (same phase, previous number)
   * Phase 2 tasks depend on all Phase 1 tasks
   */
  private inferDependencies(tasks: ExecutableTask[]): void {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    for (const task of tasks) {
      const parts = task.id.split('.');
      const phase = parseInt(parts[0], 10);
      const subNum = parts.length > 1 ? parseInt(parts[1], 10) : 0;

      // Same phase, previous sub-task is a dependency
      if (subNum > 1) {
        const prevId = `${phase}.${subNum - 1}`;
        if (taskMap.has(prevId)) {
          task.dependencies.push(prevId);
        }
      }

      // First task of a phase depends on last task of previous phase
      if (subNum <= 1 || parts.length === 1) {
        // Find the last task of the previous phase
        const prevPhaseTasks = tasks.filter((t) => t.phase === phase - 1);
        if (prevPhaseTasks.length > 0) {
          // Add dependency on the last task of previous phase
          const lastPrevTask = prevPhaseTasks[prevPhaseTasks.length - 1];
          if (!task.dependencies.includes(lastPrevTask.id)) {
            task.dependencies.push(lastPrevTask.id);
          }
        }
      }
    }
  }

  /**
   * Infer expected artifacts from task instructions
   */
  private inferArtifacts(tasks: ExecutableTask[]): void {
    for (const task of tasks) {
      const artifacts: string[] = [];
      const allText = [task.description, ...task.instructions].join(' ');

      // Look for file creation instructions
      const fileMatches = allText.match(/(?:Create|Implement|Generate)\s+[`"]?(?:src\/[^`"\s]+)/gi);
      if (fileMatches) {
        for (const match of fileMatches) {
          const fileMatch = match.match(/(src\/[^`"\s]+)/);
          if (fileMatch) {
            artifacts.push(fileMatch[1]);
          }
        }
      }

      // Look for directory creation
      const dirMatches = allText.match(/Create\s+[`"]?(?:src\/[^`"\s]+)\s+directory/gi);
      if (dirMatches) {
        for (const match of dirMatches) {
          const dirMatch = match.match(/(src\/[^`"\s]+)/);
          if (dirMatch) {
            artifacts.push(dirMatch[1] + '/');
          }
        }
      }

      task.expectedArtifacts = [...new Set(artifacts)];
    }
  }

  /**
   * Build dependency graph as a Map
   */
  private buildDependencyGraph(tasks: ExecutableTask[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const task of tasks) {
      graph.set(task.id, task.dependencies);
    }
    return graph;
  }

  /**
   * Group tasks into phases
   */
  private groupIntoPhases(tasks: ExecutableTask[]): TaskPhase[] {
    const phaseMap = new Map<number, ExecutableTask[]>();

    for (const task of tasks) {
      if (!phaseMap.has(task.phase)) {
        phaseMap.set(task.phase, []);
      }
      phaseMap.get(task.phase)!.push(task);
    }

    const phases: TaskPhase[] = [];
    for (const [number, phaseTasks] of phaseMap) {
      phases.push({
        number,
        title: `Phase ${number}`,
        tasks: phaseTasks,
        isComplete: phaseTasks.every((t) => t.status === 'complete' || t.status === 'skipped'),
      });
    }

    return phases.sort((a, b) => a.number - b.number);
  }

  /**
   * Apply saved task status from .status file
   */
  private applySavedStatus(tasks: ExecutableTask[], statusPath: string): void {
    try {
      const statusContent = fs.readFileSync(statusPath, 'utf-8');
      const statusData = JSON.parse(statusContent);

      if (statusData.tasks && Array.isArray(statusData.tasks)) {
        for (const savedTask of statusData.tasks) {
          const task = tasks.find((t) => t.id === savedTask.id);
          if (task && savedTask.status) {
            task.status = savedTask.status as TaskStatus;
            task.retryCount = savedTask.retryCount || 0;
            task.producedArtifacts = savedTask.producedArtifacts || [];
            if (savedTask.error) {
              task.error = savedTask.error;
            }
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to load saved status from ${statusPath}: ${err}`);
    }
  }

  /**
   * Get tasks ready for execution (all dependencies satisfied)
   */
  public getReadyTasks(spec: ParsedSpec): ExecutableTask[] {
    return spec.tasks.filter((task) => {
      if (task.status !== 'pending') return false;
      // All dependencies must be complete
      return task.dependencies.every((depId) => {
        const dep = spec.tasks.find((t) => t.id === depId);
        return dep?.status === 'complete' || dep?.status === 'skipped';
      });
    });
  }

  /**
   * Get the next task to execute (first ready task in phase order)
   */
  public getNextTask(spec: ParsedSpec): ExecutableTask | null {
    const ready = this.getReadyTasks(spec);
    if (ready.length === 0) return null;

    // Sort by phase, then by ID
    ready.sort((a, b) => {
      if (a.phase !== b.phase) return a.phase - b.phase;
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    return ready[0];
  }

  /**
   * Save task status to .status file
   */
  public saveStatus(spec: ParsedSpec): void {
    const statusPath = path.join(spec.specPath, SPEC_DIR_LAYOUT.statusFile);
    const statusData = {
      specId: spec.id,
      updatedAt: Date.now(),
      progress: spec.progress,
      tasks: spec.tasks.map((t) => ({
        id: t.id,
        status: t.status,
        retryCount: t.retryCount,
        producedArtifacts: t.producedArtifacts,
        error: t.error,
        completedAt: t.completedAt,
      })),
    };

    try {
      fs.writeFileSync(statusPath, JSON.stringify(statusData, null, 2));
      this.logger.info(`Saved task status to ${statusPath}`);
    } catch (err) {
      this.logger.error(`Failed to save status: ${err}`);
    }
  }
}
