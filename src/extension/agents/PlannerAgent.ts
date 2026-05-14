/**
 * Planner Agent - Decomposes user requests into executable tasks
 */

import { BaseAgent } from './BaseAgent';
import { ToolRegistry } from '../tools/ToolRegistry';
import { OllamaClient } from '../ollama/OllamaClient';
import {
  PlannerInput,
  TaskPlan,
  Task,
  TaskType,
  DependencyGraph,
  CriticFeedback,
  PlanContext,
} from './types';
import * as vscode from 'vscode';

/**
 * System prompt for Planner agent
 */
const PLANNER_SYSTEM_PROMPT = `You are a Planner agent. Your job is to decompose user requests into executable tasks.

# Core Responsibilities
1. Break down complex requests into 3-10 manageable tasks
2. Identify dependencies between tasks
3. Assign appropriate priorities (P0/P1/P2)
4. Define clear success criteria for each task
5. Estimate realistic task durations
6. Consider workspace context when planning

# Task Types
- **read_code**: Read and understand existing code files
- **analyze**: Analyze code for issues, patterns, or root causes
- **generate_fix**: Generate code fixes, new implementations, or refactorings
- **run_tests**: Execute test suites to verify functionality
- **apply_changes**: Apply code changes to files in the workspace
- **verify**: Verify that changes work correctly and meet requirements

# Priority Levels
- **P0 (critical)**: Must be done immediately, blocks other work
- **P1 (high)**: Important, should be done soon
- **P2 (medium)**: Nice to have, can be deferred if needed

# Success Criteria Guidelines
- **Functional**: What the task must accomplish (required)
- **Quality**: Code quality standards to maintain (required)
- **Performance**: Performance requirements (optional)

# Dependency Rules
1. Tasks can only depend on tasks with lower indices
2. Dependencies must form an acyclic graph (no circular dependencies)
3. Tasks with no dependencies can run in parallel
4. Consider logical flow: read → analyze → fix → test → verify

# Workspace Context Usage
- Use file information to determine what needs to be read
- Use Git status to understand current work state
- Use test framework info to generate appropriate test tasks
- Use TypeScript presence to ensure type-safe implementations
- Use package manager info for dependency-related tasks

# Output Format
Return ONLY a JSON array of tasks (no markdown, no explanation):
[
  {
    "type": "read_code" | "analyze" | "generate_fix" | "run_tests" | "apply_changes" | "verify",
    "description": "Clear, specific description of what to do",
    "dependencies": [0, 1], // Array of task indices this depends on
    "priority": "P0" | "P1" | "P2",
    "estimatedMinutes": 5-30, // Realistic estimate
    "criteria": {
      "functional": ["specific requirement 1", "specific requirement 2"],
      "quality": ["quality standard 1", "quality standard 2"],
      "performance": ["performance requirement"] // optional
    }
  }
]

# Examples

## Example 1: Bug Fix with Tests
Request: "Fix the authentication bug and add tests"
Response:
[
  {
    "type": "read_code",
    "description": "Read authentication code to understand current implementation",
    "dependencies": [],
    "priority": "P0",
    "estimatedMinutes": 5,
    "criteria": {
      "functional": ["Understand auth flow", "Identify bug location"],
      "quality": ["Complete code review"]
    }
  },
  {
    "type": "analyze",
    "description": "Analyze authentication bug to identify root cause",
    "dependencies": [0],
    "priority": "P0",
    "estimatedMinutes": 10,
    "criteria": {
      "functional": ["Identify root cause", "Understand impact"],
      "quality": ["Document findings"]
    }
  },
  {
    "type": "generate_fix",
    "description": "Generate fix for authentication bug",
    "dependencies": [1],
    "priority": "P0",
    "estimatedMinutes": 15,
    "criteria": {
      "functional": ["Fix resolves bug", "No breaking changes"],
      "quality": ["Clean code", "Follows patterns"]
    }
  },
  {
    "type": "apply_changes",
    "description": "Apply authentication fix to codebase",
    "dependencies": [2],
    "priority": "P0",
    "estimatedMinutes": 5,
    "criteria": {
      "functional": ["Changes applied correctly"],
      "quality": ["No syntax errors"]
    }
  },
  {
    "type": "generate_fix",
    "description": "Generate tests for authentication fix",
    "dependencies": [3],
    "priority": "P1",
    "estimatedMinutes": 20,
    "criteria": {
      "functional": ["Tests cover fix", "Tests cover edge cases"],
      "quality": ["Good test coverage", "Clear test names"]
    }
  },
  {
    "type": "run_tests",
    "description": "Run all tests to verify fix works",
    "dependencies": [4],
    "priority": "P0",
    "estimatedMinutes": 5,
    "criteria": {
      "functional": ["All tests pass"],
      "quality": ["No test failures"]
    }
  },
  {
    "type": "verify",
    "description": "Verify authentication works correctly",
    "dependencies": [5],
    "priority": "P0",
    "estimatedMinutes": 5,
    "criteria": {
      "functional": ["Auth works as expected", "Bug is fixed"],
      "quality": ["No regressions"]
    }
  }
]

## Example 2: Refactoring
Request: "Refactor the user service to use async/await"
Response:
[
  {
    "type": "read_code",
    "description": "Read user service code to understand current implementation",
    "dependencies": [],
    "priority": "P0",
    "estimatedMinutes": 10,
    "criteria": {
      "functional": ["Understand all methods", "Identify callback patterns"],
      "quality": ["Complete code review"]
    }
  },
  {
    "type": "analyze",
    "description": "Analyze callback patterns and plan async/await conversion",
    "dependencies": [0],
    "priority": "P0",
    "estimatedMinutes": 15,
    "criteria": {
      "functional": ["Identify all callbacks", "Plan conversion strategy"],
      "quality": ["Ensure no breaking changes"]
    }
  },
  {
    "type": "generate_fix",
    "description": "Convert user service methods to async/await",
    "dependencies": [1],
    "priority": "P0",
    "estimatedMinutes": 25,
    "criteria": {
      "functional": ["All methods use async/await", "Error handling preserved"],
      "quality": ["Clean code", "Consistent style"]
    }
  },
  {
    "type": "apply_changes",
    "description": "Apply refactored code to user service file",
    "dependencies": [2],
    "priority": "P0",
    "estimatedMinutes": 5,
    "criteria": {
      "functional": ["Changes applied correctly"],
      "quality": ["No syntax errors"]
    }
  },
  {
    "type": "run_tests",
    "description": "Run existing tests to ensure no regressions",
    "dependencies": [3],
    "priority": "P0",
    "estimatedMinutes": 5,
    "criteria": {
      "functional": ["All tests pass"],
      "quality": ["No test failures"]
    }
  },
  {
    "type": "verify",
    "description": "Verify refactored service works correctly",
    "dependencies": [4],
    "priority": "P0",
    "estimatedMinutes": 5,
    "criteria": {
      "functional": ["Service works as expected", "No regressions"],
      "quality": ["Code is cleaner"]
    }
  }
]

## Example 3: New Feature
Request: "Add pagination to the users API endpoint"
Response:
[
  {
    "type": "read_code",
    "description": "Read users API endpoint and database query code",
    "dependencies": [],
    "priority": "P0",
    "estimatedMinutes": 10,
    "criteria": {
      "functional": ["Understand current endpoint", "Understand data layer"],
      "quality": ["Complete code review"]
    }
  },
  {
    "type": "analyze",
    "description": "Design pagination implementation strategy",
    "dependencies": [0],
    "priority": "P0",
    "estimatedMinutes": 10,
    "criteria": {
      "functional": ["Define pagination params", "Plan query changes"],
      "quality": ["Follow REST best practices"]
    }
  },
  {
    "type": "generate_fix",
    "description": "Implement pagination in database query layer",
    "dependencies": [1],
    "priority": "P0",
    "estimatedMinutes": 15,
    "criteria": {
      "functional": ["Add limit/offset support", "Return total count"],
      "quality": ["Efficient queries", "Clean code"]
    }
  },
  {
    "type": "generate_fix",
    "description": "Update API endpoint to accept pagination parameters",
    "dependencies": [2],
    "priority": "P0",
    "estimatedMinutes": 10,
    "criteria": {
      "functional": ["Accept page/pageSize params", "Return pagination metadata"],
      "quality": ["Validate inputs", "Clear API contract"]
    }
  },
  {
    "type": "apply_changes",
    "description": "Apply pagination changes to codebase",
    "dependencies": [3],
    "priority": "P0",
    "estimatedMinutes": 5,
    "criteria": {
      "functional": ["All changes applied"],
      "quality": ["No syntax errors"]
    }
  },
  {
    "type": "generate_fix",
    "description": "Generate tests for pagination functionality",
    "dependencies": [4],
    "priority": "P1",
    "estimatedMinutes": 20,
    "criteria": {
      "functional": ["Test pagination logic", "Test edge cases"],
      "quality": ["Good coverage", "Clear test names"]
    }
  },
  {
    "type": "run_tests",
    "description": "Run all tests including new pagination tests",
    "dependencies": [5],
    "priority": "P0",
    "estimatedMinutes": 5,
    "criteria": {
      "functional": ["All tests pass"],
      "quality": ["No test failures"]
    }
  },
  {
    "type": "verify",
    "description": "Verify pagination works correctly in API",
    "dependencies": [6],
    "priority": "P0",
    "estimatedMinutes": 5,
    "criteria": {
      "functional": ["Pagination works as expected", "Performance is good"],
      "quality": ["No regressions"]
    }
  }
]

Now decompose this request into tasks:`;

/**
 * Planner Agent implementation
 */
export class PlannerAgent extends BaseAgent {
  getName(): string {
    return 'Planner';
  }

  getCapabilities(): string[] {
    return [
      'Task decomposition',
      'Dependency analysis',
      'Context gathering',
      'Priority assignment',
      'Duration estimation',
    ];
  }

  /**
   * Plan: Create task plan from user request
   */
  async plan(input: PlannerInput, model?: string): Promise<TaskPlan> {
    return this.executeWithErrorHandling(async () => {
      this.logInfo('Creating task plan for request:', input.userRequest);

      // Decompose request into tasks
      const tasks = await this.decomposeRequest(input.userRequest, input.context, model);

      // Build dependency graph
      const dependencyGraph = this.buildDependencyGraph(tasks);

      // Estimate total duration
      const estimatedDuration = this.estimateDuration(tasks);

      // Create plan
      const plan: TaskPlan = {
        id: `plan-${Date.now()}`,
        userRequest: input.userRequest,
        tasks,
        context: input.context,
        dependencyGraph,
        estimatedDuration,
        createdAt: Date.now(),
      };

      this.logInfo(
        `Created plan with ${plan.tasks.length} tasks, estimated duration: ${Math.round(estimatedDuration / 1000)}s`
      );
      return plan;
    }, 'plan');
  }

  /**
   * Replan: Update plan based on critic feedback
   */
  async replan(currentPlan: TaskPlan, feedback: CriticFeedback, model?: string): Promise<TaskPlan> {
    return this.executeWithErrorHandling(async () => {
      this.logInfo('Replanning based on feedback');

      const selectedModel = model || 'gemma4:31b-cloud';

      const feedbackContext = `
The previous plan had the following issues:
${feedback.issues.map((i) => `- ${i}`).join('\n')}

Required changes:
${feedback.requiredChanges.map((c) => `- ${c}`).join('\n')}

Suggestions:
${feedback.suggestions.map((s) => `- ${s}`).join('\n')}

Previous plan had ${currentPlan.tasks.length} tasks:
${currentPlan.tasks.map((t, i) => `${i}. [${t.type}] ${t.description}`).join('\n')}
`;

      try {
        const response = await this.ollamaClient.chat({
          model: selectedModel,
          messages: [
            { role: 'system', content: PLANNER_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `${feedbackContext}\n\nOriginal request: ${currentPlan.userRequest}\n\nGenerate an improved plan that addresses the feedback above.`,
            },
          ],
          stream: false,
        });

        if (Symbol.asyncIterator in response) {
          throw new Error('Unexpected streaming response');
        }

        const content = response.message.content;
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
        const tasksData = JSON.parse(jsonStr);

        if (!Array.isArray(tasksData) || tasksData.length < 3) {
          this.logInfo('Replan produced insufficient tasks, keeping current plan');
          return currentPlan;
        }

        // Convert to Task objects (same logic as decomposeRequest)
        const validTypes: TaskType[] = [
          'read_code',
          'analyze',
          'generate_fix',
          'run_tests',
          'apply_changes',
          'verify',
        ];
        const tasks: Task[] = tasksData.slice(0, 10).map((taskData: any, index: number) => ({
          id: `task-${index}`,
          type: validTypes.includes(taskData.type) ? taskData.type : 'analyze',
          description: taskData.description || `Task ${index + 1}`,
          dependencies: (taskData.dependencies || []).map((depIndex: number) => `task-${depIndex}`),
          criteria: {
            functional: taskData.criteria?.functional || ['Complete the task'],
            quality: taskData.criteria?.quality || ['Maintain code quality'],
            performance: taskData.criteria?.performance,
          },
          priority: ['P0', 'P1', 'P2'].includes(taskData.priority) ? taskData.priority : 'P1',
          estimatedDuration: (taskData.estimatedMinutes || 5) * 60 * 1000,
          metadata: { originalIndex: index },
        }));

        const dependencyGraph = this.buildDependencyGraph(tasks);
        const estimatedDuration = this.estimateDuration(tasks);

        const newPlan: TaskPlan = {
          id: `plan-replan-${Date.now()}`,
          userRequest: currentPlan.userRequest,
          tasks,
          context: currentPlan.context,
          dependencyGraph,
          estimatedDuration,
          createdAt: Date.now(),
        };

        this.logInfo(`Replan produced ${newPlan.tasks.length} tasks`);
        return newPlan;
      } catch (error) {
        this.logError('Replan failed, keeping current plan', error);
        return currentPlan;
      }
    }, 'replan');
  }

  /**
   * Execute method (required by IAgent interface)
   */
  async execute(input: PlannerInput, model?: string): Promise<TaskPlan> {
    return this.plan(input, model);
  }

  /**
   * Decompose request into tasks using Ollama
   */
  private async decomposeRequest(
    request: string,
    context: PlanContext,
    model?: string
  ): Promise<Task[]> {
    this.logInfo('Decomposing request into tasks');

    // Use provided model or default to gemma4:31b-cloud
    const selectedModel = model || 'gemma4:31b-cloud';
    this.logInfo(`Using model: ${selectedModel}`);

    // Build context summary for the AI
    const contextSummary = `
Workspace Context:
- Root: ${context.workspace.root}
- Files: ${context.workspace.files.length} files
- Open files: ${context.workspace.openFiles.join(', ') || 'none'}
- Git branch: ${context.git.branch}
- Uncommitted changes: ${context.git.uncommittedChanges}
- Node version: ${context.environment.nodeVersion || 'unknown'}
- Package manager: ${context.environment.packageManager || 'unknown'}
- Test framework: ${context.environment.testFramework || 'unknown'}
- TypeScript: ${context.environment.hasTypeScript ? 'yes' : 'no'}
`;

    // Call Ollama to decompose the request
    const response = await this.ollamaClient.chat({
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: PLANNER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `${contextSummary}\n\nUser Request: ${request}`,
        },
      ],
      stream: false,
    });

    // Parse the response (non-streaming)
    let tasksData: any[];
    try {
      // Check if response is streaming (shouldn't be, but handle it)
      if (Symbol.asyncIterator in response) {
        throw new Error('Unexpected streaming response');
      }

      // Extract JSON from response (handle markdown code blocks)
      const content = response.message.content;
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      tasksData = JSON.parse(jsonStr);

      if (!Array.isArray(tasksData)) {
        throw new Error('Response is not an array');
      }
    } catch (error) {
      this.logError('Failed to parse Ollama response:', error);
      throw new Error(`Failed to parse task decomposition: ${error}`);
    }

    // Validate we have 3-10 tasks
    if (tasksData.length < 3 || tasksData.length > 10) {
      this.logError(`Invalid number of tasks: ${tasksData.length} (expected 3-10)`);
      // Adjust if needed
      if (tasksData.length < 3) {
        throw new Error('Too few tasks generated (minimum 3 required)');
      }
      if (tasksData.length > 10) {
        this.logInfo('Too many tasks, truncating to 10');
        tasksData = tasksData.slice(0, 10);
      }
    }

    // Convert to Task objects
    const tasks: Task[] = tasksData.map((taskData, index) => {
      // Convert dependency indices to task IDs
      const dependencies = (taskData.dependencies || []).map((depIndex: number) => {
        return `task-${depIndex}`;
      });

      // Validate task type
      const validTypes: TaskType[] = [
        'read_code',
        'analyze',
        'generate_fix',
        'run_tests',
        'apply_changes',
        'verify',
      ];
      if (!validTypes.includes(taskData.type)) {
        this.logError(`Invalid task type: ${taskData.type}, defaulting to 'analyze'`);
        taskData.type = 'analyze';
      }

      // Validate priority
      const validPriorities = ['P0', 'P1', 'P2'];
      if (!validPriorities.includes(taskData.priority)) {
        this.logError(`Invalid priority: ${taskData.priority}, defaulting to 'P1'`);
        taskData.priority = 'P1';
      }

      // Create task object
      const task: Task = {
        id: `task-${index}`,
        type: taskData.type as TaskType,
        description: taskData.description || `Task ${index + 1}`,
        dependencies,
        criteria: {
          functional: taskData.criteria?.functional || ['Complete the task'],
          quality: taskData.criteria?.quality || ['Maintain code quality'],
          performance: taskData.criteria?.performance,
        },
        priority: taskData.priority as 'P0' | 'P1' | 'P2',
        estimatedDuration: (taskData.estimatedMinutes || 5) * 60 * 1000, // Convert minutes to milliseconds
        metadata: {
          originalIndex: index,
        },
      };

      return task;
    });

    this.logInfo(`Decomposed request into ${tasks.length} tasks`);
    return tasks;
  }

  /**
   * Build dependency graph with cycle detection and topological sorting
   */
  private buildDependencyGraph(tasks: Task[]): DependencyGraph {
    this.logInfo('Building dependency graph');

    // Create dependency map
    const dependencies = new Map<string, string[]>();
    for (const task of tasks) {
      dependencies.set(task.id, task.dependencies);
    }

    // Detect cycles using depth-first search
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (taskId: string): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);

      const deps = dependencies.get(taskId) || [];
      for (const depId of deps) {
        // Check if dependency exists
        if (!dependencies.has(depId)) {
          this.logError(`Invalid dependency: ${taskId} depends on non-existent task ${depId}`);
          throw new Error(`Task ${taskId} has invalid dependency ${depId}`);
        }

        // Check for cycle
        if (!visited.has(depId)) {
          if (hasCycle(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          this.logError(`Circular dependency detected: ${taskId} -> ${depId}`);
          return true;
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    // Check all tasks for cycles
    for (const task of tasks) {
      if (!visited.has(task.id)) {
        if (hasCycle(task.id)) {
          throw new Error('Circular dependency detected in task graph');
        }
      }
    }

    this.logInfo('No circular dependencies found');

    // Compute execution levels using topological sort (Kahn's algorithm)
    const levels = new Map<string, number>();
    const inDegree = new Map<string, number>();

    // Initialize in-degree for all tasks
    for (const task of tasks) {
      inDegree.set(task.id, task.dependencies.length);
    }

    // Find tasks with no dependencies (level 0)
    const queue: string[] = [];
    for (const task of tasks) {
      if (inDegree.get(task.id) === 0) {
        levels.set(task.id, 0);
        queue.push(task.id);
      }
    }

    // Process tasks level by level
    while (queue.length > 0) {
      const taskId = queue.shift()!;
      const currentLevel = levels.get(taskId)!;

      // Find tasks that depend on this task
      for (const task of tasks) {
        if (task.dependencies.includes(taskId)) {
          // Decrement in-degree
          const newInDegree = inDegree.get(task.id)! - 1;
          inDegree.set(task.id, newInDegree);

          // If all dependencies satisfied, assign level
          if (newInDegree === 0) {
            levels.set(task.id, currentLevel + 1);
            queue.push(task.id);
          }
        }
      }
    }

    // Verify all tasks have been assigned a level
    if (levels.size !== tasks.length) {
      throw new Error('Failed to compute execution levels (possible cycle)');
    }

    // Group tasks by level for parallel execution
    const parallelGroups: string[][] = [];
    const maxLevel = Math.max(...Array.from(levels.values()));

    for (let level = 0; level <= maxLevel; level++) {
      const tasksAtLevel = tasks
        .filter((task) => levels.get(task.id) === level)
        .map((task) => task.id);

      if (tasksAtLevel.length > 0) {
        parallelGroups.push(tasksAtLevel);
      }
    }

    this.logInfo(
      `Dependency graph built: ${levels.size} tasks across ${parallelGroups.length} levels`
    );

    return {
      dependencies,
      levels,
      parallelGroups,
    };
  }

  /**
   * Estimate total duration by summing all task durations
   */
  private estimateDuration(tasks: Task[]): number {
    return tasks.reduce((total, task) => total + task.estimatedDuration, 0);
  }
}

/**
 * Gather workspace context for planning
 * This is a static utility method that can be called before creating a plan
 */
export async function gatherWorkspaceContext(): Promise<PlanContext> {
  // Get workspace root
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const root = workspaceFolders?.[0]?.uri.fsPath || '';

  // List files in workspace (limit to 1000 for performance)
  const fileUris = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 1000);
  const files = fileUris.map((uri) => vscode.workspace.asRelativePath(uri));

  // Get open files
  const openFiles = vscode.window.visibleTextEditors.map((editor) =>
    vscode.workspace.asRelativePath(editor.document.uri)
  );

  // Get Git status
  let gitBranch = 'unknown';
  let gitUncommittedChanges = 0;
  let gitStatus = 'unknown';

  try {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (gitExtension) {
      const git = gitExtension.exports.getAPI(1);
      const repo = git.repositories[0];

      if (repo) {
        gitBranch = repo.state.HEAD?.name || 'unknown';
        gitUncommittedChanges =
          repo.state.workingTreeChanges.length + repo.state.indexChanges.length;
        gitStatus = repo.state.HEAD?.commit ? 'clean' : 'no commits';
      }
    }
  } catch (error) {
    // Git not available or error accessing it
    console.error('Failed to get Git status:', error);
  }

  // Detect environment
  let nodeVersion: string | undefined;
  let packageManager: string | undefined;
  let testFramework: string | undefined;
  let hasTypeScript = false;

  try {
    // Check for package.json
    const packageJsonUri = vscode.Uri.joinPath(
      workspaceFolders?.[0]?.uri || vscode.Uri.file(''),
      'package.json'
    );
    try {
      const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonUri);
      const packageJson = JSON.parse(Buffer.from(packageJsonContent).toString('utf8'));

      // Detect package manager
      if (files.some((f) => f === 'package-lock.json')) {
        packageManager = 'npm';
      } else if (files.some((f) => f === 'yarn.lock')) {
        packageManager = 'yarn';
      } else if (files.some((f) => f === 'pnpm-lock.yaml')) {
        packageManager = 'pnpm';
      }

      // Detect test framework
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (deps.jest) {
        testFramework = 'jest';
      } else if (deps.vitest) {
        testFramework = 'vitest';
      } else if (deps.mocha) {
        testFramework = 'mocha';
      }

      // Check for TypeScript
      hasTypeScript =
        !!deps.typescript || files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

      // Get Node version from engines field
      if (packageJson.engines?.node) {
        nodeVersion = packageJson.engines.node;
      }
    } catch (error) {
      // package.json not found or invalid
    }
  } catch (error) {
    console.error('Failed to detect environment:', error);
  }

  // Get recent file changes (last 10 modified files)
  const recentChanges: { file: string; timestamp: number }[] = [];
  try {
    // Sort files by modification time (most recent first)
    const fileStats = await Promise.all(
      fileUris.slice(0, 50).map(async (uri) => {
        try {
          const stat = await vscode.workspace.fs.stat(uri);
          return {
            file: vscode.workspace.asRelativePath(uri),
            timestamp: stat.mtime,
          };
        } catch {
          return null;
        }
      })
    );

    recentChanges.push(
      ...fileStats
        .filter((stat): stat is { file: string; timestamp: number } => stat !== null)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10)
    );
  } catch (error) {
    console.error('Failed to get recent changes:', error);
  }

  return {
    workspace: {
      root,
      files,
      openFiles,
    },
    git: {
      branch: gitBranch,
      uncommittedChanges: gitUncommittedChanges,
      status: gitStatus,
    },
    environment: {
      nodeVersion,
      packageManager,
      testFramework,
      hasTypeScript,
    },
    recentChanges,
  };
}
