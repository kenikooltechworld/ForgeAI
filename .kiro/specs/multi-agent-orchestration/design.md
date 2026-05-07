# Design: Multi-Agent Orchestration System

## Overview

This document describes the technical design for implementing a production-grade multi-agent orchestration system in ForgeAI. The system uses the proven Planner-Executor-Critic pattern from Anthropic's architecture, orchestrated by LangGraph.

**Architecture Pattern:** Planner-Executor-Critic (Anthropic)  
**Orchestration Framework:** LangGraph (TypeScript)  
**Integration:** Extends existing AgentLoop with multi-agent capabilities

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER REQUEST                            │
│              "Fix the auth bug and add tests"               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         v
┌─────────────────────────────────────────────────────────────┐
│                  PLANNER AGENT                              │
│  - Decomposes request into tasks                           │
│  - Creates dependency graph                                 │
│  - Identifies required context                             │
│  Output: Task Plan (6 tasks)                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         v
┌─────────────────────────────────────────────────────────────┐
│              LANGGRAPH ORCHESTRATOR                         │
│  - Manages agent lifecycle                                  │
│  - Routes between agents                                    │
│  - Handles state persistence                                │
│  - Supports parallel execution                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         v
              ┌──────────┴──────────┐
              │                     │
              v                     v
┌──────────────────────┐  ┌──────────────────────┐
│  EXECUTOR AGENT      │  │  EXECUTOR AGENT      │
│  Task 1: Read code   │  │  Task 2: Analyze     │
│  Uses: forgeai tools │  │  Uses: diagnostics   │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           v                         v
┌──────────────────────────────────────────────────┐
│              CRITIC AGENT                        │
│  - Validates task results                        │
│  - Runs actual tests                             │
│  - Checks code quality                           │
│  - Provides feedback                             │
│  Output: Pass/Fail + Feedback                    │
└──────────┬───────────────────────────────────────┘
           │
           v
    ┌──────┴──────┐
    │   PASS?     │
    └──────┬──────┘
           │
    ┌──────┴──────┐
    │             │
    v             v
┌────────┐   ┌─────────────┐
│  DONE  │   │  FEEDBACK   │
└────────┘   └──────┬──────┘
                    │
                    v
          ┌─────────────────┐
          │ Executor Refines│
          │ (iteration 2-5) │
          └─────────────────┘
```

## System Components

### 1. Agent Definitions

#### 1.1 Planner Agent
**Responsibility:** Task decomposition and planning

**Input:**
```typescript
interface PlannerInput {
  userRequest: string;
  workspaceContext: {
    files: string[];
    openFiles: string[];
    recentChanges: string[];
  };
}
```

**Output:**
```typescript
interface TaskPlan {
  tasks: Task[];
  context: PlanContext;
  estimatedDuration: number;
}

interface Task {
  id: string;
  type: TaskType;
  description: string;
  dependencies: string[];
  criteria: SuccessCriteria;
  priority: number;
}

type TaskType = 
  | "read_code"
  | "analyze"
  | "generate_fix"
  | "run_tests"
  | "apply_changes"
  | "verify";
```

**System Prompt:**
```
You are a Planner agent. Your job is to decompose user requests into executable tasks.

Rules:
1. Create 3-10 tasks (not too granular, not too broad)
2. Each task must have clear success criteria
3. Identify dependencies between tasks
4. Consider workspace context when planning
5. Prioritize tasks (P0 = critical, P1 = high, P2 = medium)

Output format: JSON with tasks array and context object
```

#### 1.2 Executor Agent
**Responsibility:** Task execution using ForgeAI tools

**Input:**
```typescript
interface ExecutorInput {
  task: Task;
  context: PlanContext;
  feedback?: CriticFeedback;
  iteration: number;
}
```

**Output:**
```typescript
interface ExecutorOutput {
  taskId: string;
  status: "success" | "partial" | "failed";
  result: any;
  selfEvaluation: {
    confidence: number;
    concerns: string[];
  };
  toolsUsed: string[];
  duration: number;
}
```

**System Prompt:**
```
You are an Executor agent. Your job is to implement tasks using available tools.

Available Tools:
- File operations: forgeai_readFile, forgeai_writeFile, forgeai_listDirectory
- Terminal: forgeai_runCommand, forgeai_createTerminal
- Git: forgeai_gitStatus, forgeai_gitCommit
- Diagnostics: forgeai_getDiagnostics, forgeai_getErrors

Rules:
1. Use tools to accomplish the task
2. Self-evaluate before returning results
3. If you receive feedback, apply it to refine your work
4. Track which tools you used
5. Be autonomous - don't ask for permission

Output format: JSON with result and self-evaluation
```

#### 1.3 Critic Agent (Error Recovery)
**Responsibility:** Validation and error recovery

**Input:**
```typescript
interface CriticInput {
  task: Task;
  executorOutput: ExecutorOutput;
  criteria: SuccessCriteria;
}
```

**Output:**
```typescript
interface CriticOutput {
  status: "pass" | "fail";
  confidence: number;
  feedback: {
    functionality: ValidationResult;
    codeQuality: ValidationResult;
    testCoverage: ValidationResult;
    suggestions: string[];
  };
  errorPattern?: ErrorPattern;
}

interface ValidationResult {
  passed: boolean;
  score: number;
  issues: string[];
}

interface ErrorPattern {
  type: string;
  rootCause: string;
  suggestedFix: string;
  confidence: number;
}
```

**System Prompt:**
```
You are a Critic agent. Your job is to validate work and provide feedback.

Validation Steps:
1. Run actual tests (don't just read code)
2. Check code quality (syntax, style, best practices)
3. Verify completeness (no stubs or TODOs)
4. Analyze errors if present

Error Pattern Recognition:
- "command not found" → Install missing command
- "ENOENT" → Fix path or create directory
- "permission denied" → Fix permissions
- "Cannot find module" → Install dependency
- "expect is not defined" → Add test imports

Rules:
1. Be strict - don't pass mediocre work
2. Provide specific, actionable feedback
3. Identify error patterns for recovery
4. Use tools to investigate issues

Output format: JSON with status and detailed feedback
```

### 2. LangGraph State Machine

#### 2.1 State Schema
```typescript
interface OrchestratorState {
  // Input
  userRequest: string;
  workspaceContext: WorkspaceContext;
  
  // Planning
  plan: TaskPlan | null;
  
  // Execution
  currentTask: Task | null;
  currentTaskIndex: number;
  results: Map<string, ExecutorOutput>;
  
  // Iteration tracking
  iteration: number;
  maxIterations: number;
  
  // Status
  status: WorkflowStatus;
  error: string | null;
  
  // Parallel execution
  parallelTasks: Task[];
  parallelResults: Map<string, ExecutorOutput>;
}

type WorkflowStatus = 
  | "planning"
  | "executing"
  | "evaluating"
  | "refining"
  | "complete"
  | "failed"
  | "hitl_required";
```

#### 2.2 State Machine Graph
```typescript
import { StateGraph, START, END } from "@langchain/langgraph";

const graph = new StateGraph<OrchestratorState>({
  channels: {
    userRequest: { value: (x, y) => y ?? x },
    plan: { value: (x, y) => y ?? x },
    currentTask: { value: (x, y) => y ?? x },
    results: { value: (x, y) => new Map([...x, ...y]) },
    iteration: { value: (x, y) => y ?? x },
    status: { value: (x, y) => y ?? x }
  }
});

// Add nodes
graph.addNode("planner", plannerAgent);
graph.addNode("executor", executorAgent);
graph.addNode("critic", criticAgent);
graph.addNode("parallel_executor", parallelExecutorAgent);

// Add edges
graph.addEdge(START, "planner");
graph.addEdge("planner", "executor");
graph.addEdge("executor", "critic");

// Conditional edges
graph.addConditionalEdges("critic", (state) => {
  if (state.iteration >= state.maxIterations) {
    return "hitl_required";
  }
  if (state.status === "pass") {
    return "next_task";
  }
  return "executor"; // Retry with feedback
});

graph.addConditionalEdges("next_task", (state) => {
  if (state.currentTaskIndex >= state.plan.tasks.length) {
    return END;
  }
  // Check if next tasks can run in parallel
  if (canRunInParallel(state)) {
    return "parallel_executor";
  }
  return "executor";
});

const orchestrator = graph.compile({
  checkpointer: new MemorySaver() // For state persistence
});
```



### 3. Error Recovery System

#### 3.1 Error Pattern Recognition

The Critic agent maintains a knowledge base of error patterns and recovery strategies:

```typescript
interface ErrorPattern {
  pattern: RegExp;
  category: ErrorCategory;
  rootCause: string;
  recoveryStrategy: RecoveryStrategy;
  confidence: number;
}

type ErrorCategory = 
  | "missing_dependency"
  | "path_error"
  | "permission_error"
  | "syntax_error"
  | "test_framework_error"
  | "runtime_error"
  | "network_error"
  | "configuration_error";

interface RecoveryStrategy {
  type: "auto_fix" | "retry_with_changes" | "escalate_to_user";
  steps: RecoveryStep[];
  estimatedTime: number;
}

interface RecoveryStep {
  action: string;
  tool: string;
  parameters: Record<string, any>;
  validation: string;
}
```

**Built-in Error Patterns:**

```typescript
const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /command not found: (.+)/,
    category: "missing_dependency",
    rootCause: "Command not installed in system",
    recoveryStrategy: {
      type: "auto_fix",
      steps: [
        {
          action: "Check package manager",
          tool: "forgeai_runCommand",
          parameters: { command: "which npm || which yarn || which pnpm" },
          validation: "Command exists"
        },
        {
          action: "Install missing command",
          tool: "forgeai_runCommand",
          parameters: { command: "npm install -g {command}" },
          validation: "Command now available"
        }
      ],
      estimatedTime: 30000
    },
    confidence: 0.95
  },
  {
    pattern: /ENOENT: no such file or directory, (.+) '(.+)'/,
    category: "path_error",
    rootCause: "File or directory does not exist",
    recoveryStrategy: {
      type: "auto_fix",
      steps: [
        {
          action: "Search for correct path",
          tool: "forgeai_findFiles",
          parameters: { pattern: "{filename}" },
          validation: "File found"
        },
        {
          action: "Create missing directory if needed",
          tool: "forgeai_createDirectory",
          parameters: { path: "{dirname}" },
          validation: "Directory exists"
        }
      ],
      estimatedTime: 5000
    },
    confidence: 0.90
  },
  {
    pattern: /Cannot find module '(.+)'/,
    category: "missing_dependency",
    rootCause: "NPM package not installed",
    recoveryStrategy: {
      type: "auto_fix",
      steps: [
        {
          action: "Check package.json",
          tool: "forgeai_readFile",
          parameters: { path: "package.json" },
          validation: "Package.json exists"
        },
        {
          action: "Install dependencies",
          tool: "forgeai_runCommand",
          parameters: { command: "npm install" },
          validation: "node_modules exists"
        }
      ],
      estimatedTime: 60000
    },
    confidence: 0.95
  },
  {
    pattern: /expect is not defined/,
    category: "test_framework_error",
    rootCause: "Test framework not configured",
    recoveryStrategy: {
      type: "auto_fix",
      steps: [
        {
          action: "Install test framework",
          tool: "forgeai_runCommand",
          parameters: { command: "npm install --save-dev vitest @vitest/ui" },
          validation: "vitest installed"
        },
        {
          action: "Create vitest config",
          tool: "forgeai_writeFile",
          parameters: { 
            path: "vitest.config.ts",
            content: "export default { test: { globals: true } }"
          },
          validation: "Config file exists"
        },
        {
          action: "Update package.json scripts",
          tool: "forgeai_modifyFile",
          parameters: { 
            path: "package.json",
            changes: { scripts: { test: "vitest" } }
          },
          validation: "Test script exists"
        }
      ],
      estimatedTime: 45000
    },
    confidence: 0.98
  },
  {
    pattern: /permission denied/i,
    category: "permission_error",
    rootCause: "Insufficient file permissions",
    recoveryStrategy: {
      type: "auto_fix",
      steps: [
        {
          action: "Fix permissions",
          tool: "forgeai_runCommand",
          parameters: { command: "chmod +x {file}" },
          validation: "File is executable"
        }
      ],
      estimatedTime: 2000
    },
    confidence: 0.85
  }
];
```

#### 3.2 Recovery Workflow

```typescript
async function recoverFromError(
  error: Error,
  context: ExecutionContext
): Promise<RecoveryResult> {
  // 1. Pattern matching
  const matchedPattern = ERROR_PATTERNS.find(p => 
    p.pattern.test(error.message)
  );
  
  if (!matchedPattern) {
    return {
      success: false,
      reason: "Unknown error pattern",
      escalate: true
    };
  }
  
  // 2. Execute recovery strategy
  const strategy = matchedPattern.recoveryStrategy;
  
  if (strategy.type === "escalate_to_user") {
    return {
      success: false,
      reason: matchedPattern.rootCause,
      escalate: true,
      userMessage: `I encountered an error that requires your input: ${error.message}`
    };
  }
  
  // 3. Auto-fix attempt
  for (const step of strategy.steps) {
    try {
      const result = await executeRecoveryStep(step, context);
      
      if (!result.success) {
        return {
          success: false,
          reason: `Recovery step failed: ${step.action}`,
          escalate: true
        };
      }
    } catch (stepError) {
      return {
        success: false,
        reason: `Recovery step threw error: ${stepError.message}`,
        escalate: true
      };
    }
  }
  
  // 4. Validate recovery
  const validated = await validateRecovery(context);
  
  return {
    success: validated,
    reason: validated ? "Error recovered" : "Recovery validation failed",
    escalate: !validated
  };
}
```

#### 3.3 Learning from Errors

The system maintains a learning database to improve error recovery over time:

```typescript
interface ErrorLearning {
  errorPattern: string;
  context: {
    task: string;
    files: string[];
    tools: string[];
  };
  attemptedFixes: RecoveryAttempt[];
  successfulFix: RecoveryAttempt | null;
  timestamp: number;
}

interface RecoveryAttempt {
  strategy: RecoveryStrategy;
  success: boolean;
  duration: number;
  feedback: string;
}

class ErrorLearningSystem {
  private db: Map<string, ErrorLearning[]> = new Map();
  
  recordError(error: Error, context: ExecutionContext): void {
    const key = this.normalizeError(error.message);
    const existing = this.db.get(key) || [];
    
    existing.push({
      errorPattern: error.message,
      context: {
        task: context.currentTask.description,
        files: context.filesInvolved,
        tools: context.toolsUsed
      },
      attemptedFixes: [],
      successfulFix: null,
      timestamp: Date.now()
    });
    
    this.db.set(key, existing);
  }
  
  recordRecoveryAttempt(
    error: Error,
    attempt: RecoveryAttempt
  ): void {
    const key = this.normalizeError(error.message);
    const entries = this.db.get(key);
    
    if (entries && entries.length > 0) {
      const latest = entries[entries.length - 1];
      latest.attemptedFixes.push(attempt);
      
      if (attempt.success) {
        latest.successfulFix = attempt;
      }
    }
  }
  
  getSimilarErrors(error: Error): ErrorLearning[] {
    const key = this.normalizeError(error.message);
    return this.db.get(key) || [];
  }
  
  getBestRecoveryStrategy(error: Error): RecoveryStrategy | null {
    const similar = this.getSimilarErrors(error);
    
    // Find most successful strategy
    const strategies = similar
      .filter(e => e.successfulFix)
      .map(e => e.successfulFix!.strategy);
    
    if (strategies.length === 0) return null;
    
    // Return most frequently successful strategy
    const counts = new Map<string, number>();
    strategies.forEach(s => {
      const key = JSON.stringify(s);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    
    const best = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    return JSON.parse(best[0]);
  }
  
  private normalizeError(message: string): string {
    // Remove specific paths, line numbers, etc.
    return message
      .replace(/\/[^\s]+/g, "{path}")
      .replace(/:\d+:\d+/g, "")
      .replace(/\d+/g, "{num}")
      .toLowerCase()
      .trim();
  }
}
```



### 4. Parallel Execution System

#### 4.1 Dependency Analysis

The Planner agent analyzes task dependencies to identify parallelizable tasks:

```typescript
interface DependencyGraph {
  nodes: Map<string, Task>;
  edges: Map<string, string[]>; // taskId -> [dependentTaskIds]
  levels: Task[][]; // Tasks grouped by execution level
}

class DependencyAnalyzer {
  buildGraph(tasks: Task[]): DependencyGraph {
    const nodes = new Map<string, Task>();
    const edges = new Map<string, string[]>();
    
    // Build nodes
    tasks.forEach(task => nodes.set(task.id, task));
    
    // Build edges
    tasks.forEach(task => {
      edges.set(task.id, task.dependencies);
    });
    
    // Compute execution levels using topological sort
    const levels = this.computeLevels(nodes, edges);
    
    return { nodes, edges, levels };
  }
  
  private computeLevels(
    nodes: Map<string, Task>,
    edges: Map<string, string[]>
  ): Task[][] {
    const levels: Task[][] = [];
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();
    
    // Calculate in-degree for each node
    nodes.forEach((_, id) => inDegree.set(id, 0));
    edges.forEach(deps => {
      deps.forEach(depId => {
        inDegree.set(depId, (inDegree.get(depId) || 0) + 1);
      });
    });
    
    // Process nodes level by level
    while (visited.size < nodes.size) {
      const currentLevel: Task[] = [];
      
      // Find all nodes with in-degree 0
      nodes.forEach((task, id) => {
        if (!visited.has(id) && inDegree.get(id) === 0) {
          currentLevel.push(task);
          visited.add(id);
        }
      });
      
      if (currentLevel.length === 0) {
        throw new Error("Circular dependency detected");
      }
      
      levels.push(currentLevel);
      
      // Update in-degrees
      currentLevel.forEach(task => {
        const deps = edges.get(task.id) || [];
        deps.forEach(depId => {
          inDegree.set(depId, (inDegree.get(depId) || 0) - 1);
        });
      });
    }
    
    return levels;
  }
  
  canRunInParallel(tasks: Task[]): boolean {
    // Tasks can run in parallel if they have no dependencies on each other
    const taskIds = new Set(tasks.map(t => t.id));
    
    return tasks.every(task => {
      return task.dependencies.every(depId => !taskIds.has(depId));
    });
  }
}
```

#### 4.2 Parallel Executor

```typescript
class ParallelExecutor {
  private maxConcurrency: number = 3; // Limit concurrent tasks
  
  async executeLevel(
    tasks: Task[],
    context: ExecutionContext
  ): Promise<Map<string, ExecutorOutput>> {
    const results = new Map<string, ExecutorOutput>();
    
    // Execute tasks in batches to respect concurrency limit
    for (let i = 0; i < tasks.length; i += this.maxConcurrency) {
      const batch = tasks.slice(i, i + this.maxConcurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(task => this.executeTask(task, context))
      );
      
      // Process results
      batchResults.forEach((result, index) => {
        const task = batch[index];
        
        if (result.status === "fulfilled") {
          results.set(task.id, result.value);
        } else {
          results.set(task.id, {
            taskId: task.id,
            status: "failed",
            result: null,
            selfEvaluation: {
              confidence: 0,
              concerns: [result.reason.message]
            },
            toolsUsed: [],
            duration: 0
          });
        }
      });
    }
    
    return results;
  }
  
  private async executeTask(
    task: Task,
    context: ExecutionContext
  ): Promise<ExecutorOutput> {
    const startTime = Date.now();
    
    // Execute task using Executor agent
    const result = await this.executorAgent.execute({
      task,
      context,
      iteration: 1
    });
    
    return {
      ...result,
      duration: Date.now() - startTime
    };
  }
}
```

#### 4.3 Resource Management

```typescript
interface ResourceLimits {
  maxConcurrentTasks: number;
  maxMemoryPerTask: number; // MB
  maxExecutionTime: number; // ms
  maxToolCallsPerTask: number;
}

class ResourceManager {
  private limits: ResourceLimits = {
    maxConcurrentTasks: 3,
    maxMemoryPerTask: 512,
    maxExecutionTime: 300000, // 5 minutes
    maxToolCallsPerTask: 50
  };
  
  private activeTaskCount: number = 0;
  private taskMetrics: Map<string, TaskMetrics> = new Map();
  
  async acquireSlot(taskId: string): Promise<boolean> {
    if (this.activeTaskCount >= this.limits.maxConcurrentTasks) {
      return false;
    }
    
    this.activeTaskCount++;
    this.taskMetrics.set(taskId, {
      startTime: Date.now(),
      toolCalls: 0,
      memoryUsage: 0
    });
    
    return true;
  }
  
  releaseSlot(taskId: string): void {
    this.activeTaskCount--;
    this.taskMetrics.delete(taskId);
  }
  
  checkLimits(taskId: string): LimitCheckResult {
    const metrics = this.taskMetrics.get(taskId);
    if (!metrics) {
      return { exceeded: false };
    }
    
    const duration = Date.now() - metrics.startTime;
    
    if (duration > this.limits.maxExecutionTime) {
      return {
        exceeded: true,
        reason: "Execution time limit exceeded",
        limit: "time"
      };
    }
    
    if (metrics.toolCalls > this.limits.maxToolCallsPerTask) {
      return {
        exceeded: true,
        reason: "Tool call limit exceeded",
        limit: "toolCalls"
      };
    }
    
    return { exceeded: false };
  }
  
  recordToolCall(taskId: string): void {
    const metrics = this.taskMetrics.get(taskId);
    if (metrics) {
      metrics.toolCalls++;
    }
  }
}
```



### 5. Integration with Existing AgentLoop

#### 5.1 Architecture Integration

The multi-agent system extends the existing `AgentLoop` without replacing it:

```typescript
// Current: Single-agent architecture
class AgentLoop {
  async run(userRequest: string): Promise<void> {
    // Single agent handles everything
  }
}

// New: Multi-agent orchestration (optional)
class MultiAgentOrchestrator {
  private agentLoop: AgentLoop;
  private graph: CompiledGraph;
  
  constructor(agentLoop: AgentLoop) {
    this.agentLoop = agentLoop;
    this.graph = this.buildGraph();
  }
  
  async run(userRequest: string): Promise<void> {
    // Decide: single-agent or multi-agent?
    if (this.shouldUseMultiAgent(userRequest)) {
      return this.runMultiAgent(userRequest);
    } else {
      return this.agentLoop.run(userRequest);
    }
  }
  
  private shouldUseMultiAgent(request: string): boolean {
    // Use multi-agent for complex requests
    const complexity = this.analyzeComplexity(request);
    return complexity.score > 0.7;
  }
}
```

#### 5.2 Complexity Analysis

```typescript
interface ComplexityAnalysis {
  score: number; // 0-1
  factors: {
    multipleFiles: boolean;
    multipleSteps: boolean;
    requiresTesting: boolean;
    requiresResearch: boolean;
    hasErrorRecovery: boolean;
  };
  recommendation: "single" | "multi";
}

class ComplexityAnalyzer {
  analyze(request: string): ComplexityAnalysis {
    const factors = {
      multipleFiles: this.detectMultipleFiles(request),
      multipleSteps: this.detectMultipleSteps(request),
      requiresTesting: this.detectTestingNeeds(request),
      requiresResearch: this.detectResearchNeeds(request),
      hasErrorRecovery: this.detectErrorRecovery(request)
    };
    
    // Calculate score
    let score = 0;
    if (factors.multipleFiles) score += 0.2;
    if (factors.multipleSteps) score += 0.3;
    if (factors.requiresTesting) score += 0.2;
    if (factors.requiresResearch) score += 0.2;
    if (factors.hasErrorRecovery) score += 0.1;
    
    return {
      score,
      factors,
      recommendation: score > 0.7 ? "multi" : "single"
    };
  }
  
  private detectMultipleFiles(request: string): boolean {
    const patterns = [
      /multiple files/i,
      /several files/i,
      /all files/i,
      /across.*files/i,
      /\band\b.*\bfile/i
    ];
    return patterns.some(p => p.test(request));
  }
  
  private detectMultipleSteps(request: string): boolean {
    const patterns = [
      /first.*then/i,
      /step \d+/i,
      /\band then\b/i,
      /after that/i,
      /next/i
    ];
    return patterns.some(p => p.test(request));
  }
  
  private detectTestingNeeds(request: string): boolean {
    const patterns = [
      /test/i,
      /verify/i,
      /validate/i,
      /check if/i
    ];
    return patterns.some(p => p.test(request));
  }
  
  private detectResearchNeeds(request: string): boolean {
    const patterns = [
      /research/i,
      /find out/i,
      /investigate/i,
      /analyze/i,
      /understand/i
    ];
    return patterns.some(p => p.test(request));
  }
  
  private detectErrorRecovery(request: string): boolean {
    const patterns = [
      /fix.*error/i,
      /bug/i,
      /not working/i,
      /broken/i,
      /crash/i
    ];
    return patterns.some(p => p.test(request));
  }
}
```

#### 5.3 Backward Compatibility

```typescript
// Existing code continues to work
const agentLoop = new AgentLoop(ollamaClient, toolRegistry);
await agentLoop.run("Fix the auth bug");

// New multi-agent capability (opt-in)
const orchestrator = new MultiAgentOrchestrator(agentLoop);
await orchestrator.run("Fix the auth bug and add tests");

// Configuration
interface OrchestratorConfig {
  enabled: boolean;
  complexityThreshold: number;
  maxConcurrentTasks: number;
  enableLearning: boolean;
}

const config: OrchestratorConfig = {
  enabled: true,
  complexityThreshold: 0.7,
  maxConcurrentTasks: 3,
  enableLearning: true
};
```

#### 5.4 Tool Sharing

All agents share the same `ToolRegistry`:

```typescript
class MultiAgentOrchestrator {
  private toolRegistry: ToolRegistry;
  
  constructor(agentLoop: AgentLoop, toolRegistry: ToolRegistry) {
    this.agentLoop = agentLoop;
    this.toolRegistry = toolRegistry;
    
    // All agents use the same tools
    this.plannerAgent = new PlannerAgent(toolRegistry);
    this.executorAgent = new ExecutorAgent(toolRegistry);
    this.criticAgent = new CriticAgent(toolRegistry);
  }
}
```



### 6. API Specifications

#### 6.1 Orchestrator API

```typescript
interface IOrchestratorAPI {
  // Main execution
  run(request: string, options?: RunOptions): Promise<OrchestratorResult>;
  
  // State management
  getState(): OrchestratorState;
  setState(state: Partial<OrchestratorState>): void;
  
  // Control
  pause(): void;
  resume(): void;
  cancel(): void;
  
  // Monitoring
  onProgress(callback: ProgressCallback): void;
  onTaskComplete(callback: TaskCompleteCallback): void;
  onError(callback: ErrorCallback): void;
}

interface RunOptions {
  maxIterations?: number;
  timeout?: number;
  enableParallel?: boolean;
  enableLearning?: boolean;
}

interface OrchestratorResult {
  success: boolean;
  plan: TaskPlan;
  results: Map<string, ExecutorOutput>;
  duration: number;
  iterations: number;
  errors: Error[];
}

type ProgressCallback = (progress: ProgressUpdate) => void;
type TaskCompleteCallback = (taskId: string, result: ExecutorOutput) => void;
type ErrorCallback = (error: Error, context: ExecutionContext) => void;

interface ProgressUpdate {
  currentTask: Task;
  completedTasks: number;
  totalTasks: number;
  percentage: number;
  estimatedTimeRemaining: number;
}
```

#### 6.2 Agent APIs

**Planner Agent:**
```typescript
interface IPlannerAgent {
  plan(input: PlannerInput): Promise<TaskPlan>;
  replan(
    currentPlan: TaskPlan,
    feedback: CriticFeedback
  ): Promise<TaskPlan>;
}
```

**Executor Agent:**
```typescript
interface IExecutorAgent {
  execute(input: ExecutorInput): Promise<ExecutorOutput>;
  refine(
    previousOutput: ExecutorOutput,
    feedback: CriticFeedback
  ): Promise<ExecutorOutput>;
}
```

**Critic Agent:**
```typescript
interface ICriticAgent {
  evaluate(input: CriticInput): Promise<CriticOutput>;
  suggestRecovery(error: Error): Promise<RecoveryStrategy | null>;
}
```

#### 6.3 LangGraph Integration API

```typescript
import { StateGraph, Annotation } from "@langchain/langgraph";

// Define state annotation
const StateAnnotation = Annotation.Root({
  userRequest: Annotation<string>,
  plan: Annotation<TaskPlan | null>,
  currentTask: Annotation<Task | null>,
  results: Annotation<Map<string, ExecutorOutput>>,
  iteration: Annotation<number>,
  status: Annotation<WorkflowStatus>
});

// Create graph
const workflow = new StateGraph(StateAnnotation)
  .addNode("planner", plannerNode)
  .addNode("executor", executorNode)
  .addNode("critic", criticNode)
  .addEdge("__start__", "planner")
  .addEdge("planner", "executor")
  .addEdge("executor", "critic")
  .addConditionalEdges("critic", routeCritic)
  .compile();

// Node implementations
async function plannerNode(state: typeof StateAnnotation.State) {
  const plan = await plannerAgent.plan({
    userRequest: state.userRequest,
    workspaceContext: await getWorkspaceContext()
  });
  
  return { plan, status: "executing" };
}

async function executorNode(state: typeof StateAnnotation.State) {
  const result = await executorAgent.execute({
    task: state.currentTask!,
    context: state.plan!.context,
    iteration: state.iteration
  });
  
  const results = new Map(state.results);
  results.set(state.currentTask!.id, result);
  
  return { results };
}

async function criticNode(state: typeof StateAnnotation.State) {
  const taskResult = state.results.get(state.currentTask!.id)!;
  
  const evaluation = await criticAgent.evaluate({
    task: state.currentTask!,
    executorOutput: taskResult,
    criteria: state.currentTask!.criteria
  });
  
  return {
    status: evaluation.status === "pass" ? "complete" : "refining",
    iteration: state.iteration + 1
  };
}

function routeCritic(state: typeof StateAnnotation.State): string {
  if (state.iteration >= 5) {
    return "__end__";
  }
  
  if (state.status === "complete") {
    return "next_task";
  }
  
  return "executor"; // Retry with feedback
}
```



### 7. Data Models & Storage

#### 7.1 Core Data Models

```typescript
// Task Plan
interface TaskPlan {
  id: string;
  userRequest: string;
  tasks: Task[];
  context: PlanContext;
  dependencyGraph: DependencyGraph;
  estimatedDuration: number;
  createdAt: number;
}

interface Task {
  id: string;
  type: TaskType;
  description: string;
  dependencies: string[];
  criteria: SuccessCriteria;
  priority: number;
  estimatedDuration: number;
  metadata: Record<string, any>;
}

interface SuccessCriteria {
  functional: string[];
  quality: QualityCriteria;
  performance: PerformanceCriteria;
}

interface QualityCriteria {
  noSyntaxErrors: boolean;
  noTypeErrors: boolean;
  noLintWarnings: boolean;
  hasTests: boolean;
  testsPassing: boolean;
}

interface PerformanceCriteria {
  maxExecutionTime?: number;
  maxMemoryUsage?: number;
}

// Execution Context
interface PlanContext {
  workspace: {
    root: string;
    files: string[];
    openFiles: string[];
  };
  git: {
    branch: string;
    hasUncommittedChanges: boolean;
  };
  environment: {
    nodeVersion?: string;
    npmVersion?: string;
    hasPackageJson: boolean;
    hasTests: boolean;
  };
  recentChanges: FileChange[];
}

interface FileChange {
  path: string;
  type: "created" | "modified" | "deleted";
  timestamp: number;
}

// Execution Results
interface ExecutorOutput {
  taskId: string;
  status: "success" | "partial" | "failed";
  result: any;
  selfEvaluation: SelfEvaluation;
  toolsUsed: ToolUsage[];
  duration: number;
  timestamp: number;
}

interface SelfEvaluation {
  confidence: number; // 0-1
  concerns: string[];
  suggestions: string[];
}

interface ToolUsage {
  tool: string;
  parameters: Record<string, any>;
  result: any;
  duration: number;
  success: boolean;
}

// Critic Feedback
interface CriticOutput {
  taskId: string;
  status: "pass" | "fail";
  confidence: number;
  feedback: DetailedFeedback;
  errorPattern?: ErrorPattern;
  timestamp: number;
}

interface DetailedFeedback {
  functionality: ValidationResult;
  codeQuality: ValidationResult;
  testCoverage: ValidationResult;
  suggestions: string[];
  requiredChanges: string[];
}
```

#### 7.2 State Persistence

```typescript
interface IStatePersistence {
  save(state: OrchestratorState): Promise<void>;
  load(id: string): Promise<OrchestratorState | null>;
  delete(id: string): Promise<void>;
  list(): Promise<StateMetadata[]>;
}

interface StateMetadata {
  id: string;
  userRequest: string;
  status: WorkflowStatus;
  createdAt: number;
  updatedAt: number;
  completedTasks: number;
  totalTasks: number;
}

class FileSystemStatePersistence implements IStatePersistence {
  private stateDir: string;
  
  constructor(stateDir: string) {
    this.stateDir = stateDir;
  }
  
  async save(state: OrchestratorState): Promise<void> {
    const id = this.generateId(state);
    const path = `${this.stateDir}/${id}.json`;
    
    await fs.writeFile(
      path,
      JSON.stringify(state, this.replacer, 2)
    );
  }
  
  async load(id: string): Promise<OrchestratorState | null> {
    const path = `${this.stateDir}/${id}.json`;
    
    try {
      const content = await fs.readFile(path, "utf-8");
      return JSON.parse(content, this.reviver);
    } catch (error) {
      return null;
    }
  }
  
  async delete(id: string): Promise<void> {
    const path = `${this.stateDir}/${id}.json`;
    await fs.unlink(path);
  }
  
  async list(): Promise<StateMetadata[]> {
    const files = await fs.readdir(this.stateDir);
    const metadata: StateMetadata[] = [];
    
    for (const file of files) {
      if (file.endsWith(".json")) {
        const state = await this.load(file.replace(".json", ""));
        if (state) {
          metadata.push(this.extractMetadata(state));
        }
      }
    }
    
    return metadata;
  }
  
  private generateId(state: OrchestratorState): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private replacer(key: string, value: any): any {
    // Handle Map serialization
    if (value instanceof Map) {
      return {
        __type: "Map",
        entries: Array.from(value.entries())
      };
    }
    return value;
  }
  
  private reviver(key: string, value: any): any {
    // Handle Map deserialization
    if (value && value.__type === "Map") {
      return new Map(value.entries);
    }
    return value;
  }
  
  private extractMetadata(state: OrchestratorState): StateMetadata {
    return {
      id: this.generateId(state),
      userRequest: state.userRequest,
      status: state.status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedTasks: state.results.size,
      totalTasks: state.plan?.tasks.length || 0
    };
  }
}
```

#### 7.3 Learning Database

```typescript
interface ILearningDatabase {
  recordError(error: ErrorLearning): Promise<void>;
  recordSuccess(success: SuccessPattern): Promise<void>;
  queryErrors(pattern: string): Promise<ErrorLearning[]>;
  querySuccesses(taskType: TaskType): Promise<SuccessPattern[]>;
  getStatistics(): Promise<LearningStatistics>;
}

interface SuccessPattern {
  taskType: TaskType;
  approach: string;
  toolsUsed: string[];
  duration: number;
  quality: number;
  timestamp: number;
}

interface LearningStatistics {
  totalErrors: number;
  totalSuccesses: number;
  errorsByCategory: Map<ErrorCategory, number>;
  successRate: number;
  averageRecoveryTime: number;
  mostCommonErrors: ErrorPattern[];
  bestPractices: SuccessPattern[];
}

class SQLiteLearningDatabase implements ILearningDatabase {
  private db: Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initSchema();
  }
  
  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS errors (
        id INTEGER PRIMARY KEY,
        pattern TEXT NOT NULL,
        category TEXT NOT NULL,
        context TEXT NOT NULL,
        attempted_fixes TEXT NOT NULL,
        successful_fix TEXT,
        timestamp INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS successes (
        id INTEGER PRIMARY KEY,
        task_type TEXT NOT NULL,
        approach TEXT NOT NULL,
        tools_used TEXT NOT NULL,
        duration INTEGER NOT NULL,
        quality REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_errors_pattern ON errors(pattern);
      CREATE INDEX IF NOT EXISTS idx_errors_category ON errors(category);
      CREATE INDEX IF NOT EXISTS idx_successes_task_type ON successes(task_type);
    `);
  }
  
  async recordError(error: ErrorLearning): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO errors (pattern, category, context, attempted_fixes, successful_fix, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      error.errorPattern,
      this.categorizeError(error.errorPattern),
      JSON.stringify(error.context),
      JSON.stringify(error.attemptedFixes),
      error.successfulFix ? JSON.stringify(error.successfulFix) : null,
      error.timestamp
    );
  }
  
  async recordSuccess(success: SuccessPattern): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO successes (task_type, approach, tools_used, duration, quality, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      success.taskType,
      success.approach,
      JSON.stringify(success.toolsUsed),
      success.duration,
      success.quality,
      success.timestamp
    );
  }
  
  async queryErrors(pattern: string): Promise<ErrorLearning[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM errors
      WHERE pattern LIKE ?
      ORDER BY timestamp DESC
      LIMIT 10
    `);
    
    const rows = stmt.all(`%${pattern}%`);
    return rows.map(row => this.deserializeError(row));
  }
  
  async querySuccesses(taskType: TaskType): Promise<SuccessPattern[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM successes
      WHERE task_type = ?
      ORDER BY quality DESC, duration ASC
      LIMIT 10
    `);
    
    const rows = stmt.all(taskType);
    return rows.map(row => this.deserializeSuccess(row));
  }
  
  async getStatistics(): Promise<LearningStatistics> {
    const totalErrors = this.db.prepare("SELECT COUNT(*) as count FROM errors").get().count;
    const totalSuccesses = this.db.prepare("SELECT COUNT(*) as count FROM successes").get().count;
    
    const errorsByCategory = new Map<ErrorCategory, number>();
    const categoryRows = this.db.prepare(`
      SELECT category, COUNT(*) as count
      FROM errors
      GROUP BY category
    `).all();
    
    categoryRows.forEach(row => {
      errorsByCategory.set(row.category as ErrorCategory, row.count);
    });
    
    const successRate = totalSuccesses / (totalErrors + totalSuccesses);
    
    return {
      totalErrors,
      totalSuccesses,
      errorsByCategory,
      successRate,
      averageRecoveryTime: 0, // TODO: Calculate
      mostCommonErrors: [], // TODO: Calculate
      bestPractices: [] // TODO: Calculate
    };
  }
  
  private categorizeError(pattern: string): ErrorCategory {
    // Simple categorization logic
    if (pattern.includes("ENOENT")) return "path_error";
    if (pattern.includes("Cannot find module")) return "missing_dependency";
    if (pattern.includes("permission denied")) return "permission_error";
    return "runtime_error";
  }
  
  private deserializeError(row: any): ErrorLearning {
    return {
      errorPattern: row.pattern,
      context: JSON.parse(row.context),
      attemptedFixes: JSON.parse(row.attempted_fixes),
      successfulFix: row.successful_fix ? JSON.parse(row.successful_fix) : null,
      timestamp: row.timestamp
    };
  }
  
  private deserializeSuccess(row: any): SuccessPattern {
    return {
      taskType: row.task_type,
      approach: row.approach,
      toolsUsed: JSON.parse(row.tools_used),
      duration: row.duration,
      quality: row.quality,
      timestamp: row.timestamp
    };
  }
}
```



### 8. Testing Strategy

#### 8.1 Unit Testing

**Agent Testing:**
```typescript
describe("PlannerAgent", () => {
  let planner: PlannerAgent;
  let mockToolRegistry: ToolRegistry;
  
  beforeEach(() => {
    mockToolRegistry = new MockToolRegistry();
    planner = new PlannerAgent(mockToolRegistry);
  });
  
  it("should decompose simple request into tasks", async () => {
    const input: PlannerInput = {
      userRequest: "Fix the auth bug",
      workspaceContext: {
        files: ["src/auth.ts"],
        openFiles: ["src/auth.ts"],
        recentChanges: []
      }
    };
    
    const plan = await planner.plan(input);
    
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.tasks.length).toBeLessThanOrEqual(10);
    expect(plan.tasks[0]).toHaveProperty("id");
    expect(plan.tasks[0]).toHaveProperty("type");
    expect(plan.tasks[0]).toHaveProperty("description");
  });
  
  it("should identify dependencies between tasks", async () => {
    const input: PlannerInput = {
      userRequest: "Fix the bug and add tests",
      workspaceContext: {
        files: ["src/auth.ts"],
        openFiles: [],
        recentChanges: []
      }
    };
    
    const plan = await planner.plan(input);
    
    // Test task should depend on fix task
    const testTask = plan.tasks.find(t => t.type === "run_tests");
    const fixTask = plan.tasks.find(t => t.type === "generate_fix");
    
    expect(testTask?.dependencies).toContain(fixTask?.id);
  });
});

describe("ExecutorAgent", () => {
  let executor: ExecutorAgent;
  let mockToolRegistry: ToolRegistry;
  
  beforeEach(() => {
    mockToolRegistry = new MockToolRegistry();
    executor = new ExecutorAgent(mockToolRegistry);
  });
  
  it("should execute task using tools", async () => {
    const task: Task = {
      id: "task-1",
      type: "read_code",
      description: "Read auth.ts file",
      dependencies: [],
      criteria: {
        functional: ["File content retrieved"],
        quality: { noSyntaxErrors: true, noTypeErrors: true, noLintWarnings: false, hasTests: false, testsPassing: false },
        performance: {}
      },
      priority: 1,
      estimatedDuration: 5000,
      metadata: {}
    };
    
    const result = await executor.execute({
      task,
      context: {} as PlanContext,
      iteration: 1
    });
    
    expect(result.status).toBe("success");
    expect(result.toolsUsed.length).toBeGreaterThan(0);
    expect(result.selfEvaluation.confidence).toBeGreaterThan(0);
  });
});

describe("CriticAgent", () => {
  let critic: CriticAgent;
  let mockToolRegistry: ToolRegistry;
  
  beforeEach(() => {
    mockToolRegistry = new MockToolRegistry();
    critic = new CriticAgent(mockToolRegistry);
  });
  
  it("should validate successful execution", async () => {
    const task: Task = {
      id: "task-1",
      type: "generate_fix",
      description: "Fix auth bug",
      dependencies: [],
      criteria: {
        functional: ["Bug fixed", "No syntax errors"],
        quality: { noSyntaxErrors: true, noTypeErrors: true, noLintWarnings: true, hasTests: false, testsPassing: false },
        performance: {}
      },
      priority: 1,
      estimatedDuration: 10000,
      metadata: {}
    };
    
    const executorOutput: ExecutorOutput = {
      taskId: "task-1",
      status: "success",
      result: { fixed: true },
      selfEvaluation: { confidence: 0.9, concerns: [], suggestions: [] },
      toolsUsed: [],
      duration: 5000,
      timestamp: Date.now()
    };
    
    const evaluation = await critic.evaluate({
      task,
      executorOutput,
      criteria: task.criteria
    });
    
    expect(evaluation.status).toBe("pass");
    expect(evaluation.confidence).toBeGreaterThan(0.7);
  });
  
  it("should detect error patterns", async () => {
    const error = new Error("ENOENT: no such file or directory, open 'missing.txt'");
    
    const recovery = await critic.suggestRecovery(error);
    
    expect(recovery).not.toBeNull();
    expect(recovery?.type).toBe("auto_fix");
    expect(recovery?.steps.length).toBeGreaterThan(0);
  });
});
```

#### 8.2 Integration Testing

**LangGraph Workflow Testing:**
```typescript
describe("MultiAgentOrchestrator", () => {
  let orchestrator: MultiAgentOrchestrator;
  let mockAgentLoop: AgentLoop;
  let mockToolRegistry: ToolRegistry;
  
  beforeEach(() => {
    mockToolRegistry = new MockToolRegistry();
    mockAgentLoop = new MockAgentLoop();
    orchestrator = new MultiAgentOrchestrator(mockAgentLoop, mockToolRegistry);
  });
  
  it("should complete simple workflow", async () => {
    const result = await orchestrator.run("Fix the auth bug");
    
    expect(result.success).toBe(true);
    expect(result.plan.tasks.length).toBeGreaterThan(0);
    expect(result.results.size).toBe(result.plan.tasks.length);
  });
  
  it("should handle parallel execution", async () => {
    const result = await orchestrator.run(
      "Fix bug in auth.ts and update docs.md",
      { enableParallel: true }
    );
    
    expect(result.success).toBe(true);
    // Verify parallel execution happened
    const durations = Array.from(result.results.values()).map(r => r.duration);
    const totalDuration = result.duration;
    const sequentialDuration = durations.reduce((a, b) => a + b, 0);
    
    expect(totalDuration).toBeLessThan(sequentialDuration);
  });
  
  it("should recover from errors", async () => {
    // Inject error into executor
    const mockExecutor = orchestrator["executorAgent"];
    mockExecutor.execute = jest.fn().mockRejectedValueOnce(
      new Error("Cannot find module 'missing-package'")
    ).mockResolvedValueOnce({
      taskId: "task-1",
      status: "success",
      result: {},
      selfEvaluation: { confidence: 0.9, concerns: [], suggestions: [] },
      toolsUsed: [],
      duration: 5000,
      timestamp: Date.now()
    });
    
    const result = await orchestrator.run("Use missing-package");
    
    expect(result.success).toBe(true);
    expect(result.iterations).toBeGreaterThan(1);
  });
});
```

#### 8.3 Property-Based Testing

**Correctness Properties:**

```typescript
import fc from "fast-check";

describe("Property-Based Tests", () => {
  describe("Task Planning Properties", () => {
    it("Property 1: All tasks must have unique IDs", () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          async (userRequest) => {
            const planner = new PlannerAgent(toolRegistry);
            const plan = await planner.plan({
              userRequest,
              workspaceContext: generateMockContext()
            });
            
            const ids = plan.tasks.map(t => t.id);
            const uniqueIds = new Set(ids);
            
            return ids.length === uniqueIds.size;
          }
        )
      );
    });
    
    it("Property 2: Dependency graph must be acyclic", () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          async (userRequest) => {
            const planner = new PlannerAgent(toolRegistry);
            const plan = await planner.plan({
              userRequest,
              workspaceContext: generateMockContext()
            });
            
            return !hasCycle(plan.dependencyGraph);
          }
        )
      );
    });
    
    it("Property 3: All dependencies must reference existing tasks", () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          async (userRequest) => {
            const planner = new PlannerAgent(toolRegistry);
            const plan = await planner.plan({
              userRequest,
              workspaceContext: generateMockContext()
            });
            
            const taskIds = new Set(plan.tasks.map(t => t.id));
            
            return plan.tasks.every(task =>
              task.dependencies.every(depId => taskIds.has(depId))
            );
          }
        )
      );
    });
  });
  
  describe("Error Recovery Properties", () => {
    it("Property 4: Recovery must not introduce new errors", () => {
      fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(new Error("ENOENT: no such file")),
            fc.constant(new Error("Cannot find module 'x'")),
            fc.constant(new Error("permission denied"))
          ),
          async (error) => {
            const critic = new CriticAgent(toolRegistry);
            const recovery = await critic.suggestRecovery(error);
            
            if (!recovery) return true;
            
            // Execute recovery and verify no new errors
            const result = await executeRecovery(recovery);
            
            return result.success || result.escalate;
          }
        )
      );
    });
    
    it("Property 5: Learning database must preserve error patterns", () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            errorPattern: fc.string(),
            context: fc.object(),
            attemptedFixes: fc.array(fc.object()),
            successfulFix: fc.option(fc.object()),
            timestamp: fc.integer()
          }),
          async (errorLearning) => {
            const db = new SQLiteLearningDatabase(":memory:");
            
            await db.recordError(errorLearning);
            const retrieved = await db.queryErrors(errorLearning.errorPattern);
            
            return retrieved.length > 0 &&
                   retrieved[0].errorPattern === errorLearning.errorPattern;
          }
        )
      );
    });
  });
  
  describe("Parallel Execution Properties", () => {
    it("Property 6: Parallel tasks must not violate dependencies", () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string(),
              dependencies: fc.array(fc.string())
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (tasks) => {
            const analyzer = new DependencyAnalyzer();
            const graph = analyzer.buildGraph(tasks as Task[]);
            
            // Check each level
            for (const level of graph.levels) {
              const levelIds = new Set(level.map(t => t.id));
              
              // No task in this level should depend on another task in the same level
              const hasIntraLevelDependency = level.some(task =>
                task.dependencies.some(depId => levelIds.has(depId))
              );
              
              if (hasIntraLevelDependency) return false;
            }
            
            return true;
          }
        )
      );
    });
  });
});

// Helper functions
function hasCycle(graph: DependencyGraph): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const dependencies = graph.edges.get(nodeId) || [];
    for (const depId of dependencies) {
      if (!visited.has(depId)) {
        if (dfs(depId)) return true;
      } else if (recursionStack.has(depId)) {
        return true;
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  }
  
  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) return true;
    }
  }
  
  return false;
}

function generateMockContext(): WorkspaceContext {
  return {
    files: ["src/index.ts", "src/utils.ts"],
    openFiles: ["src/index.ts"],
    recentChanges: []
  };
}

async function executeRecovery(strategy: RecoveryStrategy): Promise<RecoveryResult> {
  // Mock implementation
  return { success: true, reason: "Recovered", escalate: false };
}
```



### 9. Implementation Phases

#### Phase 1: Core Infrastructure (Week 1-2)
**Goal:** Set up LangGraph and basic agent structure

**Tasks:**
1. Install LangGraph dependencies
2. Create base agent classes (Planner, Executor, Critic)
3. Implement state schema and graph structure
4. Create basic orchestrator class
5. Add unit tests for core components

**Deliverables:**
- Working LangGraph state machine
- Three agent classes with basic functionality
- Test suite with >80% coverage

#### Phase 2: Agent Implementation (Week 3-4)
**Goal:** Implement full agent logic and system prompts

**Tasks:**
1. Implement Planner agent with task decomposition
2. Implement Executor agent with tool integration
3. Implement Critic agent with validation logic
4. Create agent system prompts
5. Add integration tests

**Deliverables:**
- Fully functional agents
- System prompts for each agent
- Integration test suite

#### Phase 3: Error Recovery System (Week 5-6)
**Goal:** Build intelligent error recovery

**Tasks:**
1. Implement error pattern recognition
2. Create recovery strategy database
3. Build learning system
4. Add error recovery tests
5. Integrate with Critic agent

**Deliverables:**
- Error recovery system
- Learning database
- Recovery strategy library

#### Phase 4: Parallel Execution (Week 7-8)
**Goal:** Enable parallel task execution

**Tasks:**
1. Implement dependency analyzer
2. Create parallel executor
3. Add resource management
4. Implement level-based execution
5. Add parallel execution tests

**Deliverables:**
- Parallel execution system
- Resource manager
- Performance benchmarks

#### Phase 5: Integration & Testing (Week 9-10)
**Goal:** Integrate with existing AgentLoop and test

**Tasks:**
1. Integrate with existing AgentLoop
2. Add complexity analyzer
3. Implement backward compatibility
4. Create end-to-end tests
5. Add property-based tests

**Deliverables:**
- Fully integrated system
- Complete test suite
- Performance metrics

#### Phase 6: Polish & Documentation (Week 11-12)
**Goal:** Production readiness

**Tasks:**
1. Add observability (logging, metrics)
2. Create user documentation
3. Add configuration options
4. Performance optimization
5. Security review

**Deliverables:**
- Production-ready system
- Complete documentation
- Performance report

### 10. Observability & Monitoring

#### 10.1 Logging

```typescript
interface LogEntry {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  agent: "planner" | "executor" | "critic" | "orchestrator";
  message: string;
  context: Record<string, any>;
}

class OrchestratorLogger {
  private entries: LogEntry[] = [];
  
  log(entry: Omit<LogEntry, "timestamp">): void {
    this.entries.push({
      ...entry,
      timestamp: Date.now()
    });
    
    // Also log to console
    console.log(`[${entry.level.toUpperCase()}] [${entry.agent}] ${entry.message}`);
  }
  
  debug(agent: string, message: string, context?: Record<string, any>): void {
    this.log({ level: "debug", agent: agent as any, message, context: context || {} });
  }
  
  info(agent: string, message: string, context?: Record<string, any>): void {
    this.log({ level: "info", agent: agent as any, message, context: context || {} });
  }
  
  warn(agent: string, message: string, context?: Record<string, any>): void {
    this.log({ level: "warn", agent: agent as any, message, context: context || {} });
  }
  
  error(agent: string, message: string, context?: Record<string, any>): void {
    this.log({ level: "error", agent: agent as any, message, context: context || {} });
  }
  
  getEntries(filter?: Partial<LogEntry>): LogEntry[] {
    if (!filter) return this.entries;
    
    return this.entries.filter(entry => {
      return Object.entries(filter).every(([key, value]) => {
        return entry[key as keyof LogEntry] === value;
      });
    });
  }
  
  export(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}
```

#### 10.2 Metrics

```typescript
interface Metrics {
  // Execution metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageDuration: number;
  
  // Task metrics
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
  
  // Agent metrics
  plannerCalls: number;
  executorCalls: number;
  criticCalls: number;
  
  // Error metrics
  totalErrors: number;
  recoveredErrors: number;
  escalatedErrors: number;
  
  // Parallel execution metrics
  parallelTasksExecuted: number;
  averageParallelSpeedup: number;
}

class MetricsCollector {
  private metrics: Metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageDuration: 0,
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageTaskDuration: 0,
    plannerCalls: 0,
    executorCalls: 0,
    criticCalls: 0,
    totalErrors: 0,
    recoveredErrors: 0,
    escalatedErrors: 0,
    parallelTasksExecuted: 0,
    averageParallelSpeedup: 0
  };
  
  recordRequest(success: boolean, duration: number): void {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Update average duration
    this.metrics.averageDuration = 
      (this.metrics.averageDuration * (this.metrics.totalRequests - 1) + duration) /
      this.metrics.totalRequests;
  }
  
  recordTask(success: boolean, duration: number): void {
    this.metrics.totalTasks++;
    if (success) {
      this.metrics.completedTasks++;
    } else {
      this.metrics.failedTasks++;
    }
    
    this.metrics.averageTaskDuration =
      (this.metrics.averageTaskDuration * (this.metrics.totalTasks - 1) + duration) /
      this.metrics.totalTasks;
  }
  
  recordAgentCall(agent: "planner" | "executor" | "critic"): void {
    if (agent === "planner") this.metrics.plannerCalls++;
    if (agent === "executor") this.metrics.executorCalls++;
    if (agent === "critic") this.metrics.criticCalls++;
  }
  
  recordError(recovered: boolean): void {
    this.metrics.totalErrors++;
    if (recovered) {
      this.metrics.recoveredErrors++;
    } else {
      this.metrics.escalatedErrors++;
    }
  }
  
  recordParallelExecution(tasksCount: number, speedup: number): void {
    this.metrics.parallelTasksExecuted += tasksCount;
    
    const totalParallelRuns = this.metrics.parallelTasksExecuted / tasksCount;
    this.metrics.averageParallelSpeedup =
      (this.metrics.averageParallelSpeedup * (totalParallelRuns - 1) + speedup) /
      totalParallelRuns;
  }
  
  getMetrics(): Metrics {
    return { ...this.metrics };
  }
  
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageDuration: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageTaskDuration: 0,
      plannerCalls: 0,
      executorCalls: 0,
      criticCalls: 0,
      totalErrors: 0,
      recoveredErrors: 0,
      escalatedErrors: 0,
      parallelTasksExecuted: 0,
      averageParallelSpeedup: 0
    };
  }
}
```

#### 10.3 Tracing

```typescript
interface TraceSpan {
  id: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  agent: string;
  metadata: Record<string, any>;
}

class Tracer {
  private spans: Map<string, TraceSpan> = new Map();
  private activeSpans: Set<string> = new Set();
  
  startSpan(name: string, agent: string, parentId?: string): string {
    const id = this.generateId();
    
    const span: TraceSpan = {
      id,
      parentId,
      name,
      startTime: Date.now(),
      agent,
      metadata: {}
    };
    
    this.spans.set(id, span);
    this.activeSpans.add(id);
    
    return id;
  }
  
  endSpan(id: string, metadata?: Record<string, any>): void {
    const span = this.spans.get(id);
    if (!span) return;
    
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    
    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata };
    }
    
    this.activeSpans.delete(id);
  }
  
  addMetadata(id: string, metadata: Record<string, any>): void {
    const span = this.spans.get(id);
    if (span) {
      span.metadata = { ...span.metadata, ...metadata };
    }
  }
  
  getTrace(rootId: string): TraceSpan[] {
    const trace: TraceSpan[] = [];
    
    const collectChildren = (parentId: string) => {
      const children = Array.from(this.spans.values())
        .filter(span => span.parentId === parentId);
      
      children.forEach(child => {
        trace.push(child);
        collectChildren(child.id);
      });
    };
    
    const root = this.spans.get(rootId);
    if (root) {
      trace.push(root);
      collectChildren(rootId);
    }
    
    return trace;
  }
  
  exportTrace(rootId: string): string {
    const trace = this.getTrace(rootId);
    return JSON.stringify(trace, null, 2);
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 11. Security Considerations

#### 11.1 Tool Access Control

```typescript
interface ToolPermissions {
  allowedTools: string[];
  deniedTools: string[];
  requireApproval: string[];
}

class ToolAccessControl {
  private permissions: ToolPermissions = {
    allowedTools: ["*"], // All tools allowed by default
    deniedTools: [],
    requireApproval: [
      "forgeai_deleteFile",
      "forgeai_runCommand", // Commands that could be destructive
      "forgeai_gitPush"
    ]
  };
  
  canUseTool(toolName: string): boolean {
    // Check denied list first
    if (this.permissions.deniedTools.includes(toolName)) {
      return false;
    }
    
    // Check allowed list
    if (this.permissions.allowedTools.includes("*")) {
      return true;
    }
    
    return this.permissions.allowedTools.includes(toolName);
  }
  
  requiresApproval(toolName: string): boolean {
    return this.permissions.requireApproval.includes(toolName);
  }
  
  async requestApproval(
    toolName: string,
    parameters: Record<string, any>
  ): Promise<boolean> {
    // Show approval dialog to user
    const approved = await this.showApprovalDialog(toolName, parameters);
    return approved;
  }
  
  private async showApprovalDialog(
    toolName: string,
    parameters: Record<string, any>
  ): Promise<boolean> {
    // Implementation would show VS Code dialog
    return true; // Mock implementation
  }
}
```

#### 11.2 Input Validation

```typescript
class InputValidator {
  validateUserRequest(request: string): ValidationResult {
    const errors: string[] = [];
    
    // Check length
    if (request.length === 0) {
      errors.push("Request cannot be empty");
    }
    
    if (request.length > 10000) {
      errors.push("Request too long (max 10000 characters)");
    }
    
    // Check for malicious patterns
    const maliciousPatterns = [
      /rm\s+-rf\s+\//,
      /:\(\)\{\s*:\|:&\s*\};:/,  // Fork bomb
      /eval\(/,
      /exec\(/
    ];
    
    for (const pattern of maliciousPatterns) {
      if (pattern.test(request)) {
        errors.push("Request contains potentially malicious pattern");
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  validateToolParameters(
    toolName: string,
    parameters: Record<string, any>
  ): ValidationResult {
    const errors: string[] = [];
    
    // Validate file paths
    if (parameters.path) {
      if (parameters.path.includes("..")) {
        errors.push("Path traversal not allowed");
      }
      
      if (parameters.path.startsWith("/")) {
        errors.push("Absolute paths not allowed");
      }
    }
    
    // Validate commands
    if (parameters.command) {
      const dangerousCommands = ["rm -rf", "dd if=", "mkfs", "format"];
      
      for (const cmd of dangerousCommands) {
        if (parameters.command.includes(cmd)) {
          errors.push(`Dangerous command detected: ${cmd}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

### 12. Performance Optimization

#### 12.1 Caching Strategy

```typescript
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

class OrchestratorCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 300000; // 5 minutes
  
  set<T>(key: string, value: T, ttl?: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }
  
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Cache workspace context
  cacheWorkspaceContext(context: WorkspaceContext): void {
    this.set("workspace_context", context, 60000); // 1 minute TTL
  }
  
  getWorkspaceContext(): WorkspaceContext | null {
    return this.get("workspace_context");
  }
  
  // Cache file contents
  cacheFileContent(path: string, content: string): void {
    this.set(`file:${path}`, content, 30000); // 30 seconds TTL
  }
  
  getFileContent(path: string): string | null {
    return this.get(`file:${path}`);
  }
}
```

#### 12.2 Optimization Techniques

1. **Lazy Loading**: Load agents only when needed
2. **Request Batching**: Batch multiple tool calls together
3. **Parallel Execution**: Execute independent tasks in parallel
4. **Caching**: Cache workspace context and file contents
5. **Streaming**: Stream results as they become available
6. **Resource Pooling**: Reuse agent instances

### 13. Configuration

```typescript
interface OrchestratorConfig {
  // Feature flags
  enabled: boolean;
  enableParallel: boolean;
  enableLearning: boolean;
  enableCaching: boolean;
  
  // Thresholds
  complexityThreshold: number;
  maxConcurrentTasks: number;
  maxIterations: number;
  
  // Timeouts
  taskTimeout: number;
  requestTimeout: number;
  
  // Paths
  stateDir: string;
  learningDbPath: string;
  
  // Logging
  logLevel: "debug" | "info" | "warn" | "error";
  enableTracing: boolean;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  enabled: true,
  enableParallel: true,
  enableLearning: true,
  enableCaching: true,
  complexityThreshold: 0.7,
  maxConcurrentTasks: 3,
  maxIterations: 5,
  taskTimeout: 300000,
  requestTimeout: 600000,
  stateDir: ".forgeai/orchestrator/state",
  learningDbPath: ".forgeai/orchestrator/learning.db",
  logLevel: "info",
  enableTracing: true
};
```

## Summary

This design document provides a comprehensive blueprint for implementing a production-grade multi-agent orchestration system in ForgeAI. The system:

1. **Uses proven patterns**: Planner-Executor-Critic from Anthropic
2. **Leverages LangGraph**: For state management and orchestration
3. **Enables parallel execution**: For improved performance
4. **Includes error recovery**: With learning capabilities
5. **Maintains backward compatibility**: Extends existing AgentLoop
6. **Provides observability**: Logging, metrics, and tracing
7. **Ensures security**: Input validation and access control
8. **Optimizes performance**: Caching and resource management

The implementation will be done in 6 phases over 12 weeks, with comprehensive testing at each phase.
