# Implementation Tasks: Multi-Agent Orchestration System

## Overview

This implementation plan builds the multi-agent orchestration system incrementally using the proven Planner-Executor-Critic pattern from Anthropic. The system uses LangGraph for orchestration and integrates seamlessly with the existing ForgeAI AgentLoop infrastructure.

**Architecture:** Planner-Executor-Critic (Anthropic)  
**Orchestration:** LangGraph (TypeScript)  
**Integration:** Extends existing AgentLoop  
**Timeline:** 12 weeks (6 phases)

## Implementation Approach

- **Phase 1 (Week 1-2):** Core Infrastructure - LangGraph setup and base agent classes
- **Phase 2 (Week 3-4):** Agent Implementation - Full agent logic and system prompts
- **Phase 3 (Week 5-6):** Error Recovery - Pattern recognition and learning system
- **Phase 4 (Week 7-8):** Parallel Execution - Dependency analysis and parallel executor
- **Phase 5 (Week 9-10):** Integration & Testing - AgentLoop integration and comprehensive tests
- **Phase 6 (Week 11-12):** Polish & Production - Observability, documentation, optimization

## Tasks

### Phase 1: Core Infrastructure (Week 1-2)

#### 1. Setup LangGraph Dependencies and Project Structure

- [ ] 1.1 Install LangGraph packages
  - Add @langchain/langgraph@^0.2.0 to package.json dependencies
  - Add @langchain/core@^0.3.0 to package.json dependencies
  - Add @langchain/ollama@^0.1.0 to package.json dependencies
  - Run npm install to install all packages
  - Verify installation by importing StateGraph in a test file
  - Create src/extension/orchestrator/ directory for all orchestration code
  - Create src/extension/agents/ directory for agent implementations
  - **EXISTING:** package.json, src/extension/ directory structure
  - **CREATE:** New directories: src/extension/orchestrator/, src/extension/agents/
  - **MODIFY:** package.json (add dependencies)
  - **VISUAL RESULT:** npm install succeeds, new directories created
  - **TEST:** Import { StateGraph } from "@langchain/langgraph" - should not error
  - _Requirements: TC-1, TC-3_
  - _Design: Section 1 (Overview), Section 9 (Implementation Phases - Phase 1)_

- [ ] 1.2 Create TypeScript type definitions
  - Create src/extension/orchestrator/types.ts
  - Define OrchestratorState interface with all state fields (userRequest, plan, currentTask, results, iteration, maxIterations, status, error, parallelTasks, parallelResults)
  - Define TaskPlan interface (id, userRequest, tasks, context, dependencyGraph, estimatedDuration, createdAt)
  - Define Task interface (id, type, description, dependencies, criteria, priority, estimatedDuration, metadata)
  - Define TaskType union type (read_code, analyze, generate_fix, run_tests, apply_changes, verify)
  - Define ExecutorOutput interface (taskId, status, result, selfEvaluation, toolsUsed, duration, timestamp)
  - Define CriticOutput interface (taskId, status, confidence, feedback, errorPattern, timestamp)
  - Define WorkflowStatus union type (planning, executing, evaluating, refining, complete, failed, hitl_required)
  - Define SuccessCriteria interface (functional, quality, performance)
  - Define PlanContext interface (workspace, git, environment, recentChanges)
  - Export all types for use across the codebase
  - **EXISTING:** src/extension/ directory
  - **CREATE:** src/extension/orchestrator/types.ts (new file, ~200 lines)
  - **VISUAL RESULT:** Complete type definitions file with all interfaces
  - **TEST:** Import types in another file - should not error, get full IntelliSense
  - _Requirements: FR-1, FR-2, FR-3, FR-4_
  - _Design: Section 2.1 (State Schema), Section 7.1 (Core Data Models)_



#### 2. Create Base Agent Infrastructure

- [ ] 2.1 Implement BaseAgent class
  - Create src/extension/agents/BaseAgent.ts
  - Define IAgent interface with methods: execute(), getName(), getCapabilities()
  - Implement BaseAgent abstract class with constructor accepting ToolRegistry and OllamaClient
  - Add protected properties: toolRegistry, ollamaClient, logger
  - Implement logging methods: logInfo(), logError(), logDebug()
  - Implement metrics tracking: recordExecution(), getMetrics()
  - Add error handling wrapper: executeWithErrorHandling()
  - **EXISTING:** src/extension/tools/ToolRegistry.ts, src/extension/ollama/OllamaClient.ts
  - **CREATE:** src/extension/agents/BaseAgent.ts (new file, ~150 lines)
  - **VISUAL RESULT:** Base class ready for agent implementations to extend
  - **TEST:** Create test agent extending BaseAgent, verify logging and metrics work
  - _Requirements: FR-1, FR-2, FR-3, NFR-5_
  - _Design: Section 1 (Agent Definitions)_

- [ ] 2.2 Create Planner Agent skeleton
  - Create src/extension/agents/PlannerAgent.ts
  - Extend BaseAgent class
  - Implement plan(input: PlannerInput): Promise<TaskPlan> method (placeholder returns empty plan)
  - Implement replan(currentPlan: TaskPlan, feedback: CriticFeedback): Promise<TaskPlan> method (placeholder)
  - Add private method: decomposeRequest(request: string): Task[] (placeholder)
  - Add private method: buildDependencyGraph(tasks: Task[]): DependencyGraph (placeholder)
  - Add private method: estimateDuration(tasks: Task[]): number (placeholder)
  - Create system prompt constant: PLANNER_SYSTEM_PROMPT (basic version)
  - **EXISTING:** src/extension/agents/BaseAgent.ts, src/extension/orchestrator/types.ts
  - **CREATE:** src/extension/agents/PlannerAgent.ts (new file, ~100 lines skeleton)
  - **VISUAL RESULT:** Planner agent class structure ready for implementation
  - **TEST:** Instantiate PlannerAgent, call plan() - should return empty TaskPlan without errors
  - _Requirements: FR-1_
  - _Design: Section 1.1 (Planner Agent)_

- [ ] 2.3 Create Executor Agent skeleton
  - Create src/extension/agents/ExecutorAgent.ts
  - Extend BaseAgent class
  - Implement execute(input: ExecutorInput): Promise<ExecutorOutput> method (placeholder returns success status)
  - Implement refine(previousOutput: ExecutorOutput, feedback: CriticFeedback): Promise<ExecutorOutput> method (placeholder)
  - Add private method: selectTools(task: Task): string[] (placeholder)
  - Add private method: executeTool(toolName: string, params: any): Promise<any> (placeholder)
  - Add private method: selfEvaluate(result: any): SelfEvaluation (placeholder)
  - Create system prompt constant: EXECUTOR_SYSTEM_PROMPT (basic version)
  - **EXISTING:** src/extension/agents/BaseAgent.ts, src/extension/orchestrator/types.ts
  - **CREATE:** src/extension/agents/ExecutorAgent.ts (new file, ~120 lines skeleton)
  - **VISUAL RESULT:** Executor agent class structure ready for implementation
  - **TEST:** Instantiate ExecutorAgent, call execute() - should return ExecutorOutput without errors
  - _Requirements: FR-2_
  - _Design: Section 1.2 (Executor Agent)_

- [ ] 2.4 Create Critic Agent skeleton
  - Create src/extension/agents/CriticAgent.ts
  - Extend BaseAgent class
  - Implement evaluate(input: CriticInput): Promise<CriticOutput> method (placeholder returns pass status)
  - Implement suggestRecovery(error: Error): Promise<RecoveryStrategy | null> method (placeholder returns null)
  - Add private method: validateFunctionality(output: ExecutorOutput, criteria: SuccessCriteria): ValidationResult (placeholder)
  - Add private method: checkCodeQuality(output: ExecutorOutput): ValidationResult (placeholder)
  - Add private method: analyzeError(error: Error): ErrorPattern | null (placeholder)
  - Create system prompt constant: CRITIC_SYSTEM_PROMPT (basic version)
  - **EXISTING:** src/extension/agents/BaseAgent.ts, src/extension/orchestrator/types.ts
  - **CREATE:** src/extension/agents/CriticAgent.ts (new file, ~130 lines skeleton)
  - **VISUAL RESULT:** Critic agent class structure ready for implementation
  - **TEST:** Instantiate CriticAgent, call evaluate() - should return CriticOutput without errors
  - _Requirements: FR-3, FR-5_
  - _Design: Section 1.3 (Critic Agent)_



#### 3. Implement LangGraph State Machine

- [ ] 3.1 Create state graph structure
  - Create src/extension/orchestrator/Graph.ts
  - Import StateGraph, START, END, Annotation from @langchain/langgraph
  - Define StateAnnotation using Annotation.Root() with all state fields
  - Create StateGraph instance with StateAnnotation
  - Configure channel reducers for state fields (userRequest, plan, currentTask, results, iteration, status)
  - Add placeholder node functions: plannerNode(), executorNode(), criticNode()
  - **EXISTING:** src/extension/orchestrator/types.ts, src/extension/agents/ (agent classes)
  - **CREATE:** src/extension/orchestrator/Graph.ts (new file, ~200 lines)
  - **VISUAL RESULT:** LangGraph state machine structure defined
  - **TEST:** Import graph, verify it compiles without errors
  - _Requirements: FR-4_
  - _Design: Section 2.2 (State Machine Graph), Section 6.3 (LangGraph Integration API)_

- [ ] 3.2 Implement graph nodes
  - In src/extension/orchestrator/Graph.ts, implement plannerNode() function
  - plannerNode: call plannerAgent.plan(), return { plan, status: "executing" }
  - Implement executorNode() function
  - executorNode: call executorAgent.execute(), update results map, return { results }
  - Implement criticNode() function
  - criticNode: call criticAgent.evaluate(), return { status, iteration: iteration + 1 }
  - Add error handling to each node (try-catch, return error status)
  - **EXISTING:** src/extension/orchestrator/Graph.ts (from task 3.1)
  - **MODIFY:** src/extension/orchestrator/Graph.ts (implement node functions, ~100 lines added)
  - **VISUAL RESULT:** Complete node implementations with agent calls
  - **TEST:** Call each node function with mock state, verify correct return values
  - _Requirements: FR-4_
  - _Design: Section 6.3 (LangGraph Integration API - Node implementations)_

- [ ] 3.3 Add graph edges and routing
  - In src/extension/orchestrator/Graph.ts, add edges to graph
  - Add edge: START → "planner"
  - Add edge: "planner" → "executor"
  - Add edge: "executor" → "critic"
  - Implement routeCritic() conditional function
  - routeCritic: if iteration >= maxIterations, return END
  - routeCritic: if status === "pass", return "next_task"
  - routeCritic: else return "executor" (retry with feedback)
  - Add conditional edge from "critic" using routeCritic
  - Implement routeNextTask() conditional function
  - routeNextTask: if all tasks complete, return END
  - routeNextTask: if can run in parallel, return "parallel_executor"
  - routeNextTask: else return "executor"
  - Add conditional edge from "next_task" using routeNextTask
  - **EXISTING:** src/extension/orchestrator/Graph.ts (from task 3.2)
  - **MODIFY:** src/extension/orchestrator/Graph.ts (add edges and routing, ~80 lines added)
  - **VISUAL RESULT:** Complete state machine with all transitions
  - **TEST:** Trace graph execution path, verify correct routing logic
  - _Requirements: FR-4, Property 5 (Iteration Bound)_
  - _Design: Section 2.2 (State Machine Graph - Conditional edges)_

- [ ] 3.4 Compile graph with checkpointer
  - In src/extension/orchestrator/Graph.ts, import MemorySaver from @langchain/langgraph
  - Create MemorySaver instance for state persistence
  - Call graph.compile({ checkpointer: memorySaver })
  - Export compiled graph as orchestratorGraph
  - Add getGraph() function to return compiled graph
  - **EXISTING:** src/extension/orchestrator/Graph.ts (from task 3.3)
  - **MODIFY:** src/extension/orchestrator/Graph.ts (compile graph, ~20 lines added)
  - **VISUAL RESULT:** Compiled LangGraph ready for execution
  - **TEST:** Call getGraph(), verify it returns compiled graph instance
  - _Requirements: FR-4, NFR-4 (State persistence)_
  - _Design: Section 2.2 (State Machine Graph - Compilation)_



#### 4. Create Multi-Agent Orchestrator Class

- [ ] 4.1 Implement orchestrator core
  - Create src/extension/orchestrator/MultiAgentOrchestrator.ts
  - Implement constructor accepting agentLoop: AgentLoop, toolRegistry: ToolRegistry
  - Initialize plannerAgent, executorAgent, criticAgent with toolRegistry
  - Store reference to compiled graph from Graph.ts
  - Add private properties: currentState, progressCallbacks, isRunning
  - Implement run(request: string, options?: RunOptions): Promise<OrchestratorResult> method (basic version)
  - run(): create initial state, invoke graph, return results
  - Add error handling for graph execution failures
  - **EXISTING:** src/extension/orchestrator/Graph.ts, src/extension/agents/ (all agents), src/extension/ollama/AgentLoop.ts
  - **CREATE:** src/extension/orchestrator/MultiAgentOrchestrator.ts (new file, ~150 lines)
  - **VISUAL RESULT:** Orchestrator class ready to execute workflows
  - **TEST:** Create orchestrator, call run() with simple request, verify it executes without errors
  - _Requirements: FR-4, US-2_
  - _Design: Section 6.1 (Orchestrator API)_

- [ ] 4.2 Implement state management methods
  - In src/extension/orchestrator/MultiAgentOrchestrator.ts, implement getState(): OrchestratorState
  - getState(): return deep copy of currentState
  - Implement setState(state: Partial<OrchestratorState>): void
  - setState(): merge partial state with currentState
  - Implement resetState(): void
  - resetState(): clear currentState, reset to initial values
  - Add state validation: validateState(state: OrchestratorState): boolean
  - **EXISTING:** src/extension/orchestrator/MultiAgentOrchestrator.ts (from task 4.1)
  - **MODIFY:** src/extension/orchestrator/MultiAgentOrchestrator.ts (add state methods, ~60 lines added)
  - **VISUAL RESULT:** Complete state management API
  - **TEST:** Call getState(), setState(), verify state updates correctly
  - _Requirements: FR-4_
  - _Design: Section 6.1 (Orchestrator API - State management)_

- [ ] 4.3 Implement control methods
  - In src/extension/orchestrator/MultiAgentOrchestrator.ts, implement pause(): void
  - pause(): set isRunning = false, save current state
  - Implement resume(): Promise<void>
  - resume(): set isRunning = true, continue graph execution from saved state
  - Implement cancel(): void
  - cancel(): set isRunning = false, set status = "failed", cleanup resources
  - Add isPaused(), isCancelled() status check methods
  - **EXISTING:** src/extension/orchestrator/MultiAgentOrchestrator.ts (from task 4.2)
  - **MODIFY:** src/extension/orchestrator/MultiAgentOrchestrator.ts (add control methods, ~50 lines added)
  - **VISUAL RESULT:** Full control over workflow execution
  - **TEST:** Start workflow, pause it, resume it, verify correct behavior
  - _Requirements: FR-4_
  - _Design: Section 6.1 (Orchestrator API - Control methods)_

- [ ] 4.4 Implement progress callbacks
  - In src/extension/orchestrator/MultiAgentOrchestrator.ts, implement onProgress(callback: ProgressCallback): void
  - Store callback in progressCallbacks array
  - Implement onTaskComplete(callback: TaskCompleteCallback): void
  - Implement onError(callback: ErrorCallback): void
  - Add private method: notifyProgress(update: ProgressUpdate): void
  - notifyProgress(): call all registered progress callbacks
  - Add private method: notifyTaskComplete(taskId: string, result: ExecutorOutput): void
  - Add private method: notifyError(error: Error, context: ExecutionContext): void
  - Call notification methods at appropriate points in run() method
  - **EXISTING:** src/extension/orchestrator/MultiAgentOrchestrator.ts (from task 4.3)
  - **MODIFY:** src/extension/orchestrator/MultiAgentOrchestrator.ts (add callbacks, ~70 lines added)
  - **VISUAL RESULT:** Real-time progress updates during execution
  - **TEST:** Register callbacks, run workflow, verify callbacks called with correct data
  - _Requirements: NFR-3 (Observability), US-2 (Progress visible)_
  - _Design: Section 6.1 (Orchestrator API - Monitoring)_



#### 5. Add Unit Tests for Core Components

- [ ] 5.1 Test Planner Agent
  - Create src/extension/agents/__tests__/PlannerAgent.test.ts
  - Test: should decompose simple request into 3-10 tasks
  - Test: should identify dependencies between tasks
  - Test: should assign priorities to tasks (P0, P1, P2)
  - Test: should create acyclic dependency graph
  - Test: should estimate task durations
  - Test: should handle replanning with feedback
  - Use mock ToolRegistry and OllamaClient
  - Verify >80% code coverage for PlannerAgent
  - **EXISTING:** src/extension/agents/PlannerAgent.ts
  - **CREATE:** src/extension/agents/__tests__/PlannerAgent.test.ts (new file, ~200 lines)
  - **VISUAL RESULT:** Comprehensive test suite for Planner
  - **TEST:** Run npm test, verify all Planner tests pass
  - _Requirements: Property 1 (Unique task IDs), Property 2 (Acyclic graph), Property 3 (Valid dependencies)_
  - _Design: Section 8.1 (Unit Testing - Agent Testing)_

- [ ] 5.2 Test Executor Agent
  - Create src/extension/agents/__tests__/ExecutorAgent.test.ts
  - Test: should execute task using correct tools
  - Test: should track tools used during execution
  - Test: should self-evaluate with confidence score
  - Test: should refine output based on feedback
  - Test: should handle tool execution errors gracefully
  - Test: should respect iteration limits
  - Use mock ToolRegistry and OllamaClient
  - Verify >80% code coverage for ExecutorAgent
  - **EXISTING:** src/extension/agents/ExecutorAgent.ts
  - **CREATE:** src/extension/agents/__tests__/ExecutorAgent.test.ts (new file, ~250 lines)
  - **VISUAL RESULT:** Comprehensive test suite for Executor
  - **TEST:** Run npm test, verify all Executor tests pass
  - _Requirements: FR-2, US-3 (Quality assurance)_
  - _Design: Section 8.1 (Unit Testing - Agent Testing)_

- [ ] 5.3 Test Critic Agent
  - Create src/extension/agents/__tests__/CriticAgent.test.ts
  - Test: should validate successful execution (pass status)
  - Test: should detect failures (fail status)
  - Test: should provide specific feedback
  - Test: should recognize error patterns
  - Test: should suggest recovery strategies
  - Test: should calculate confidence scores
  - Use mock ToolRegistry and OllamaClient
  - Verify >80% code coverage for CriticAgent
  - **EXISTING:** src/extension/agents/CriticAgent.ts
  - **CREATE:** src/extension/agents/__tests__/CriticAgent.test.ts (new file, ~220 lines)
  - **VISUAL RESULT:** Comprehensive test suite for Critic
  - **TEST:** Run npm test, verify all Critic tests pass
  - _Requirements: FR-3, FR-5 (Error recovery), US-3 (Quality validation)_
  - _Design: Section 8.1 (Unit Testing - Agent Testing)_

- [ ] 5.4 Test LangGraph state machine
  - Create src/extension/orchestrator/__tests__/Graph.test.ts
  - Test: should create valid state graph
  - Test: should execute planner node correctly
  - Test: should execute executor node correctly
  - Test: should execute critic node correctly
  - Test: should route correctly based on critic output
  - Test: should enforce max iterations limit
  - Test: should handle node errors gracefully
  - Use mock agents
  - Verify graph compilation succeeds
  - **EXISTING:** src/extension/orchestrator/Graph.ts
  - **CREATE:** src/extension/orchestrator/__tests__/Graph.test.ts (new file, ~180 lines)
  - **VISUAL RESULT:** Comprehensive test suite for state machine
  - **TEST:** Run npm test, verify all Graph tests pass
  - _Requirements: FR-4, Property 5 (Iteration bound)_
  - _Design: Section 8.1 (Unit Testing)_

- [ ] 5.5 Test Multi-Agent Orchestrator
  - Create src/extension/orchestrator/__tests__/MultiAgentOrchestrator.test.ts
  - Test: should initialize with correct dependencies
  - Test: should execute simple workflow end-to-end
  - Test: should handle state management correctly
  - Test: should support pause/resume/cancel
  - Test: should call progress callbacks
  - Test: should handle errors gracefully
  - Use mock agents and graph
  - Verify >80% code coverage for orchestrator
  - **EXISTING:** src/extension/orchestrator/MultiAgentOrchestrator.ts
  - **CREATE:** src/extension/orchestrator/__tests__/MultiAgentOrchestrator.test.ts (new file, ~200 lines)
  - **VISUAL RESULT:** Comprehensive test suite for orchestrator
  - **TEST:** Run npm test, verify all orchestrator tests pass
  - _Requirements: FR-4, NFR-2 (Reliability)_
  - _Design: Section 8.1 (Unit Testing)_

### Phase 2: Agent Implementation (Week 3-4)

#### 6. Implement Planner Agent Logic

- [ ] 6.1 Implement task decomposition
  - In src/extension/agents/PlannerAgent.ts, implement decomposeRequest() method
  - Parse user request to identify main goal and sub-goals
  - Generate 3-10 tasks based on request complexity
  - Assign task types: read_code, analyze, generate_fix, run_tests, apply_changes, verify
  - Create task descriptions with clear objectives
  - Define success criteria for each task (functional, quality, performance)
  - Assign priorities: P0 (critical), P1 (high), P2 (medium)
  - Estimate duration for each task (in milliseconds)
  - Use Ollama to help with decomposition (call ollamaClient.chat() with decomposition prompt)
  - **EXISTING:** src/extension/agents/PlannerAgent.ts (skeleton from task 2.2)
  - **MODIFY:** src/extension/agents/PlannerAgent.ts (implement decomposeRequest, ~150 lines added)
  - **VISUAL RESULT:** Planner generates realistic task plans
  - **TEST:** Call plan() with "Fix auth bug and add tests", verify 5-7 tasks generated
  - _Requirements: FR-1, US-2 (Task decomposition)_
  - _Design: Section 1.1 (Planner Agent - Capabilities)_



- [ ] 6.2 Implement dependency analysis
  - In src/extension/agents/PlannerAgent.ts, implement buildDependencyGraph() method
  - Analyze tasks to identify dependencies (e.g., "analyze" depends on "read_code")
  - Create dependency graph with nodes (tasks) and edges (dependencies)
  - Implement cycle detection using depth-first search
  - Throw error if circular dependency detected
  - Compute execution levels using topological sort
  - Group tasks by level (level 0 = no dependencies, level 1 = depends on level 0, etc.)
  - **EXISTING:** src/extension/agents/PlannerAgent.ts (from task 6.1)
  - **MODIFY:** src/extension/agents/PlannerAgent.ts (implement buildDependencyGraph, ~100 lines added)
  - **VISUAL RESULT:** Dependency graph with correct task ordering
  - **TEST:** Create tasks with dependencies, verify graph is acyclic and correctly ordered
  - _Requirements: FR-1, Property 2 (Acyclic graph), Property 3 (Valid dependencies)_
  - _Design: Section 4.1 (Dependency Analysis)_

- [ ] 6.3 Implement context gathering
  - In src/extension/agents/PlannerAgent.ts, add gatherWorkspaceContext() method
  - Get workspace root path using vscode.workspace.workspaceFolders
  - List files in workspace using vscode.workspace.findFiles
  - Get open files using vscode.window.visibleTextEditors
  - Get Git status (branch, uncommitted changes) using Git API
  - Detect environment (Node.js version, package.json, test framework)
  - Get recent file changes from Git log
  - Return PlanContext object with all gathered information
  - **EXISTING:** src/extension/agents/PlannerAgent.ts (from task 6.2)
  - **MODIFY:** src/extension/agents/PlannerAgent.ts (add gatherWorkspaceContext, ~80 lines added)
  - **VISUAL RESULT:** Rich context for planning decisions
  - **TEST:** Call gatherWorkspaceContext(), verify all context fields populated
  - _Requirements: FR-1 (Context identification)_
  - _Design: Section 1.1 (Planner Agent - Input/Output), Section 7.1 (PlanContext)_

- [ ] 6.4 Create comprehensive Planner system prompt
  - In src/extension/agents/PlannerAgent.ts, update PLANNER_SYSTEM_PROMPT constant
  - Define role: "You are a Planner agent. Your job is to decompose user requests into executable tasks."
  - Add rules: Create 3-10 tasks, assign clear success criteria, identify dependencies, prioritize tasks
  - Add task type descriptions: read_code, analyze, generate_fix, run_tests, apply_changes, verify
  - Add output format specification: JSON with tasks array and context object
  - Add examples: Show 3 example requests with corresponding task plans
  - Include workspace context injection instructions
  - **EXISTING:** src/extension/agents/PlannerAgent.ts (from task 6.3)
  - **MODIFY:** src/extension/agents/PlannerAgent.ts (update PLANNER_SYSTEM_PROMPT, ~100 lines added)
  - **VISUAL RESULT:** Comprehensive system prompt for planning
  - **TEST:** Use prompt with Ollama, verify it generates valid task plans
  - _Requirements: FR-1_
  - _Design: Section 1.1 (Planner Agent - System Prompt)_

#### 7. Implement Executor Agent Logic

- [ ] 7.1 Implement task execution routing
  - In src/extension/agents/ExecutorAgent.ts, implement execute() method fully
  - Route task to appropriate handler based on task.type
  - read_code → executeReadCode()
  - analyze → executeAnalyze()
  - generate_fix → executeGenerateFix()
  - run_tests → executeRunTests()
  - apply_changes → executeApplyChanges()
  - verify → executeVerify()
  - Track tools used during execution
  - Measure execution duration
  - Call selfEvaluate() before returning result
  - **EXISTING:** src/extension/agents/ExecutorAgent.ts (skeleton from task 2.3)
  - **MODIFY:** src/extension/agents/ExecutorAgent.ts (implement execute routing, ~120 lines added)
  - **VISUAL RESULT:** Executor routes tasks correctly
  - **TEST:** Execute tasks of each type, verify correct handler called
  - _Requirements: FR-2 (Task execution)_
  - _Design: Section 1.2 (Executor Agent - Capabilities)_

- [ ] 7.2 Implement tool execution methods
  - In src/extension/agents/ExecutorAgent.ts, implement executeReadCode() method
  - Use toolRegistry.executeTool("forgeai_readFile", { path }) to read files
  - Implement executeAnalyze() method
  - Use Ollama to analyze code, identify issues
  - Implement executeGenerateFix() method
  - Use Ollama to generate code fixes
  - Implement executeRunTests() method
  - Use toolRegistry.executeTool("forgeai_runCommand", { command: "npm test" })
  - Implement executeApplyChanges() method
  - Use toolRegistry.executeTool("forgeai_writeFile", { path, content })
  - Implement executeVerify() method
  - Use diagnostics tools to verify no errors
  - **EXISTING:** src/extension/agents/ExecutorAgent.ts (from task 7.1)
  - **MODIFY:** src/extension/agents/ExecutorAgent.ts (implement tool execution methods, ~200 lines added)
  - **VISUAL RESULT:** Executor uses tools to complete tasks
  - **TEST:** Execute each task type, verify correct tools called
  - _Requirements: FR-2 (Tool usage)_
  - _Design: Section 1.2 (Executor Agent - System Prompt - Available Tools)_

- [ ] 7.3 Implement self-evaluation logic
  - In src/extension/agents/ExecutorAgent.ts, implement selfEvaluate() method
  - Analyze result completeness (no TODOs, no stubs)
  - Calculate confidence score (0.0-1.0) based on result quality
  - Identify concerns (potential issues, edge cases not handled)
  - Generate suggestions for improvement
  - Return SelfEvaluation object with confidence, concerns, suggestions
  - **EXISTING:** src/extension/agents/ExecutorAgent.ts (from task 7.2)
  - **MODIFY:** src/extension/agents/ExecutorAgent.ts (implement selfEvaluate, ~80 lines added)
  - **VISUAL RESULT:** Executor provides honest self-assessment
  - **TEST:** Execute task, verify self-evaluation has realistic confidence score
  - _Requirements: FR-2 (Self-evaluation), US-3 (Quality assurance)_
  - _Design: Section 1.2 (Executor Agent - Output - selfEvaluation)_

- [ ] 7.4 Implement refinement with feedback
  - In src/extension/agents/ExecutorAgent.ts, implement refine() method fully
  - Parse feedback from Critic agent
  - Identify required changes from feedback.requiredChanges
  - Apply changes using appropriate tools
  - Re-execute task with improvements
  - Track iteration count
  - Return refined ExecutorOutput
  - **EXISTING:** src/extension/agents/ExecutorAgent.ts (from task 7.3)
  - **MODIFY:** src/extension/agents/ExecutorAgent.ts (implement refine, ~100 lines added)
  - **VISUAL RESULT:** Executor improves based on feedback
  - **TEST:** Execute task, provide feedback, call refine(), verify improvements made
  - _Requirements: FR-2 (Refinement), US-3 (Iterative refinement)_
  - _Design: Section 1.2 (Executor Agent - Input - feedback)_

- [ ] 7.5 Create comprehensive Executor system prompt
  - In src/extension/agents/ExecutorAgent.ts, update EXECUTOR_SYSTEM_PROMPT constant
  - Define role: "You are an Executor agent. Your job is to implement tasks using available tools."
  - List all available tools with descriptions (file operations, terminal, Git, diagnostics)
  - Add autonomy rules: "Use tools to accomplish tasks. Don't ask for permission. Be autonomous."
  - Add self-evaluation rules: "Evaluate your work honestly. Identify concerns and suggest improvements."
  - Add refinement rules: "If you receive feedback, apply it to improve your work."
  - Add output format specification: JSON with result and self-evaluation
  - Add examples: Show 3 example tasks with tool usage and self-evaluation
  - **EXISTING:** src/extension/agents/ExecutorAgent.ts (from task 7.4)
  - **MODIFY:** src/extension/agents/ExecutorAgent.ts (update EXECUTOR_SYSTEM_PROMPT, ~150 lines added)
  - **VISUAL RESULT:** Comprehensive system prompt for execution
  - **TEST:** Use prompt with Ollama, verify it uses tools autonomously
  - _Requirements: FR-2_
  - _Design: Section 1.2 (Executor Agent - System Prompt)_



#### 8. Implement Critic Agent Logic

- [ ] 8.1 Implement validation logic
  - In src/extension/agents/CriticAgent.ts, implement evaluate() method fully
  - Call validateFunctionality() to check if task meets functional criteria
  - Call checkCodeQuality() to check syntax, style, best practices
  - Call checkTestCoverage() to verify tests exist and pass
  - Calculate overall confidence score (0.0-1.0)
  - Generate specific, actionable feedback
  - Identify required changes if validation fails
  - Return CriticOutput with status (pass/fail), confidence, feedback
  - **EXISTING:** src/extension/agents/CriticAgent.ts (skeleton from task 2.4)
  - **MODIFY:** src/extension/agents/CriticAgent.ts (implement evaluate, ~150 lines added)
  - **VISUAL RESULT:** Critic validates work thoroughly
  - **TEST:** Evaluate good output (should pass), evaluate bad output (should fail with feedback)
  - _Requirements: FR-3 (Validation), US-3 (Quality assurance)_
  - _Design: Section 1.3 (Critic Agent - Capabilities)_

- [ ] 8.2 Implement actual test execution
  - In src/extension/agents/CriticAgent.ts, add runActualTests() method
  - Use toolRegistry.executeTool("forgeai_runCommand", { command: "npm test" })
  - Parse test output to extract pass/fail status
  - Count passing and failing tests
  - Extract error messages from failing tests
  - Return test results with detailed information
  - Don't just read code - actually run tests!
  - **EXISTING:** src/extension/agents/CriticAgent.ts (from task 8.1)
  - **MODIFY:** src/extension/agents/CriticAgent.ts (add runActualTests, ~80 lines added)
  - **VISUAL RESULT:** Critic runs real tests, not just code inspection
  - **TEST:** Create test file, run Critic evaluation, verify tests actually executed
  - _Requirements: FR-3 (Run actual tests), US-3 (Tests passing)_
  - _Design: Section 1.3 (Critic Agent - System Prompt - Validation Steps)_

- [ ] 8.3 Implement error pattern recognition
  - In src/extension/agents/CriticAgent.ts, implement analyzeError() method
  - Match error message against known patterns using regex
  - Patterns: "command not found", "ENOENT", "permission denied", "Cannot find module", "expect is not defined"
  - Extract error details (command, file path, module name, etc.)
  - Identify error category (missing_dependency, path_error, permission_error, etc.)
  - Calculate confidence score for pattern match
  - Return ErrorPattern object with type, rootCause, confidence
  - **EXISTING:** src/extension/agents/CriticAgent.ts (from task 8.2)
  - **MODIFY:** src/extension/agents/CriticAgent.ts (implement analyzeError, ~100 lines added)
  - **VISUAL RESULT:** Critic recognizes common error patterns
  - **TEST:** Analyze various errors, verify correct pattern recognition
  - _Requirements: FR-3 (Error pattern recognition), FR-5 (Error recovery)_
  - _Design: Section 3.1 (Error Pattern Recognition)_

- [ ] 8.4 Implement recovery suggestion
  - In src/extension/agents/CriticAgent.ts, implement suggestRecovery() method fully
  - Call analyzeError() to identify error pattern
  - Look up recovery strategy for error pattern
  - Generate recovery steps (tools to call, parameters to use)
  - Estimate recovery time
  - Return RecoveryStrategy with type (auto_fix, retry_with_changes, escalate_to_user), steps, estimatedTime
  - Return null if no recovery strategy available
  - **EXISTING:** src/extension/agents/CriticAgent.ts (from task 8.3)
  - **MODIFY:** src/extension/agents/CriticAgent.ts (implement suggestRecovery, ~120 lines added)
  - **VISUAL RESULT:** Critic suggests actionable recovery strategies
  - **TEST:** Provide error, call suggestRecovery(), verify strategy returned
  - _Requirements: FR-5 (Error recovery), US-1 (Intelligent error recovery)_
  - _Design: Section 3.2 (Recovery Workflow)_

- [ ] 8.5 Create comprehensive Critic system prompt
  - In src/extension/agents/CriticAgent.ts, update CRITIC_SYSTEM_PROMPT constant
  - Define role: "You are a Critic agent. Your job is to validate work and provide feedback."
  - Add validation steps: Run actual tests, check code quality, verify completeness, analyze errors
  - Add error pattern library with 10+ patterns and recovery strategies
  - Add feedback rules: "Be strict. Don't pass mediocre work. Provide specific, actionable feedback."
  - Add output format specification: JSON with status and detailed feedback
  - Add examples: Show 3 example evaluations with pass/fail decisions and feedback
  - **EXISTING:** src/extension/agents/CriticAgent.ts (from task 8.4)
  - **MODIFY:** src/extension/agents/CriticAgent.ts (update CRITIC_SYSTEM_PROMPT, ~150 lines added)
  - **VISUAL RESULT:** Comprehensive system prompt for validation
  - **TEST:** Use prompt with Ollama, verify it validates work strictly
  - _Requirements: FR-3_
  - _Design: Section 1.3 (Critic Agent - System Prompt)_

#### 9. Add Integration Tests for Agents

- [ ] 9.1 Test Planner-Executor integration
  - Create src/extension/orchestrator/__tests__/integration/PlannerExecutor.test.ts
  - Test: Planner creates plan, Executor executes first task
  - Test: Executor uses correct tools based on task type
  - Test: Task results match expected format
  - Use real ToolRegistry (not mocked)
  - Use mock Ollama responses
  - **EXISTING:** src/extension/agents/PlannerAgent.ts, src/extension/agents/ExecutorAgent.ts
  - **CREATE:** src/extension/orchestrator/__tests__/integration/PlannerExecutor.test.ts (new file, ~150 lines)
  - **VISUAL RESULT:** Planner and Executor work together
  - **TEST:** Run integration test, verify plan execution works
  - _Requirements: FR-1, FR-2_
  - _Design: Section 8.2 (Integration Testing)_

- [ ] 9.2 Test Executor-Critic feedback loop
  - Create src/extension/orchestrator/__tests__/integration/ExecutorCritic.test.ts
  - Test: Executor completes task, Critic evaluates (pass)
  - Test: Executor completes task, Critic evaluates (fail), Executor refines
  - Test: Feedback loop continues until pass or max iterations
  - Test: Max iterations enforced (stops at 5)
  - Use real ToolRegistry
  - Use mock Ollama responses
  - **EXISTING:** src/extension/agents/ExecutorAgent.ts, src/extension/agents/CriticAgent.ts
  - **CREATE:** src/extension/orchestrator/__tests__/integration/ExecutorCritic.test.ts (new file, ~180 lines)
  - **VISUAL RESULT:** Executor-Critic feedback loop works
  - **TEST:** Run integration test, verify refinement loop works
  - _Requirements: FR-2, FR-3, US-3 (Quality assurance loop)_
  - _Design: Section 8.2 (Integration Testing - Agent coordination)_

- [ ] 9.3 Test complete workflow end-to-end
  - Create src/extension/orchestrator/__tests__/integration/Workflow.test.ts
  - Test: Simple workflow (1 task) completes successfully
  - Test: Complex workflow (5+ tasks) completes successfully
  - Test: Workflow with dependencies executes in correct order
  - Test: Workflow with errors recovers and completes
  - Test: Workflow respects max iterations limit
  - Use real agents, real ToolRegistry
  - Use mock Ollama responses
  - **EXISTING:** All agent classes, MultiAgentOrchestrator
  - **CREATE:** src/extension/orchestrator/__tests__/integration/Workflow.test.ts (new file, ~200 lines)
  - **VISUAL RESULT:** Complete workflows execute successfully
  - **TEST:** Run integration test, verify end-to-end execution
  - _Requirements: All functional requirements_
  - _Design: Section 8.2 (Integration Testing - Workflow execution)_

### Phase 3: Error Recovery System (Week 5-6)

#### 10. Implement Error Pattern Database

- [ ] 10.1 Create error pattern definitions
  - Create src/extension/orchestrator/ErrorPatterns.ts
  - Define ErrorPattern interface (pattern, category, rootCause, recoveryStrategy, confidence)
  - Define RecoveryStrategy interface (type, steps, estimatedTime)
  - Define RecoveryStep interface (action, tool, parameters, validation)
  - Define ErrorCategory type (missing_dependency, path_error, permission_error, syntax_error, test_framework_error, runtime_error, network_error, configuration_error)
  - Export all types
  - **EXISTING:** src/extension/orchestrator/types.ts
  - **CREATE:** src/extension/orchestrator/ErrorPatterns.ts (new file, ~100 lines)
  - **VISUAL RESULT:** Complete type definitions for error recovery
  - **TEST:** Import types, verify IntelliSense works
  - _Requirements: FR-5 (Error recovery system)_
  - _Design: Section 3.1 (Error Pattern Recognition)_


- [ ] 10.2 Create built-in error patterns
  - In src/extension/orchestrator/ErrorPatterns.ts, create BUILT_IN_PATTERNS array
  - Pattern 1: Missing dependency - "Cannot find module 'X'" → Install dependency
  - Pattern 2: Command not found - "command not found: X" → Install tool or fix PATH
  - Pattern 3: File not found - "ENOENT: no such file or directory" → Create file or fix path
  - Pattern 4: Permission denied - "EACCES: permission denied" → Fix permissions
  - Pattern 5: Test framework not configured - "expect is not defined" → Install test framework
  - Pattern 6: Syntax error - "SyntaxError: Unexpected token" → Fix syntax
  - Pattern 7: Network error - "ECONNREFUSED" → Check network/service
  - Pattern 8: Configuration error - "Invalid configuration" → Fix config file
  - Each pattern includes: regex, category, rootCause, recoveryStrategy with steps
  - Export BUILT_IN_PATTERNS constant
  - **EXISTING:** src/extension/orchestrator/ErrorPatterns.ts (from task 10.1)
  - **MODIFY:** src/extension/orchestrator/ErrorPatterns.ts (add patterns, ~200 lines added)
  - **VISUAL RESULT:** 8+ built-in error patterns with recovery strategies
  - **TEST:** Match various errors against patterns, verify correct matches
  - _Requirements: FR-5 (Built-in patterns)_
  - _Design: Section 3.1 (Error Pattern Recognition - Built-in patterns)_

- [ ] 10.3 Implement pattern matching engine
  - In src/extension/orchestrator/ErrorPatterns.ts, create matchErrorPattern() function
  - Accept error message string as input
  - Iterate through BUILT_IN_PATTERNS
  - Test each pattern's regex against error message
  - Calculate confidence score based on match quality
  - Return best matching pattern with confidence score
  - Return null if no pattern matches (confidence < 0.5)
  - **EXISTING:** src/extension/orchestrator/ErrorPatterns.ts (from task 10.2)
  - **MODIFY:** src/extension/orchestrator/ErrorPatterns.ts (add matching engine, ~80 lines added)
  - **VISUAL RESULT:** Pattern matching engine working
  - **TEST:** Match known errors, verify correct pattern returned
  - _Requirements: FR-5 (Pattern matching)_
  - _Design: Section 3.1 (Error Pattern Recognition - Matching algorithm)_

- [ ] 10.4 Create error pattern storage
  - Create src/extension/orchestrator/ErrorPatternStorage.ts
  - Implement ErrorPatternStorage class with constructor accepting StorageManager
  - Add savePattern(pattern: ErrorPattern): Promise<void> method
  - Add getPattern(errorMessage: string): Promise<ErrorPattern | null> method
  - Add getAllPatterns(): Promise<ErrorPattern[]> method
  - Add deletePattern(id: string): Promise<void> method
  - Store patterns in workspace state using StorageManager
  - Merge built-in patterns with user-defined patterns
  - **EXISTING:** src/extension/storage/StorageManager.ts, src/extension/orchestrator/ErrorPatterns.ts
  - **CREATE:** src/extension/orchestrator/ErrorPatternStorage.ts (new file, ~120 lines)
  - **VISUAL RESULT:** Persistent error pattern storage
  - **TEST:** Save pattern, retrieve it, verify persistence across sessions
  - _Requirements: FR-5 (Pattern storage), NFR-4 (State persistence)_
  - _Design: Section 3.3 (Learning System - Pattern storage)_

#### 11. Implement Error Recovery Workflow

- [ ] 11.1 Create recovery executor
  - Create src/extension/orchestrator/RecoveryExecutor.ts
  - Implement RecoveryExecutor class with constructor accepting toolRegistry: ToolRegistry
  - Add executeRecovery(strategy: RecoveryStrategy): Promise<RecoveryResult> method
  - Iterate through recovery steps
  - Execute each step using appropriate tool
  - Validate step completion before proceeding
  - Track recovery progress
  - Return RecoveryResult with success status and details
  - **EXISTING:** src/extension/orchestrator/ErrorPatterns.ts, src/extension/tools/ToolRegistry.ts
  - **CREATE:** src/extension/orchestrator/RecoveryExecutor.ts (new file, ~150 lines)
  - **VISUAL RESULT:** Automated error recovery execution
  - **TEST:** Execute recovery strategy, verify steps executed correctly
  - _Requirements: FR-5 (Automated recovery)_
  - _Design: Section 3.2 (Recovery Workflow - Execution)_

- [ ] 11.2 Integrate recovery into Critic agent
  - In src/extension/agents/CriticAgent.ts, add recoveryExecutor property
  - Update constructor to accept RecoveryExecutor
  - In evaluate() method, if validation fails, call suggestRecovery()
  - If recovery strategy available, call recoveryExecutor.executeRecovery()
  - If recovery succeeds, re-evaluate the task
  - If recovery fails, escalate to user (HITL)
  - Track recovery attempts (max 3 per task)
  - **EXISTING:** src/extension/agents/CriticAgent.ts, src/extension/orchestrator/RecoveryExecutor.ts
  - **MODIFY:** src/extension/agents/CriticAgent.ts (integrate recovery, ~100 lines added)
  - **VISUAL RESULT:** Critic automatically attempts recovery
  - **TEST:** Trigger error, verify Critic attempts recovery
  - _Requirements: FR-5 (Automatic recovery), US-1 (Intelligent error recovery)_
  - _Design: Section 3.2 (Recovery Workflow - Integration)_

- [ ] 11.3 Implement HITL escalation
  - In src/extension/orchestrator/MultiAgentOrchestrator.ts, add escalateToUser() method
  - Accept error, context, attempted recoveries as parameters
  - Create user-friendly error message with context
  - Show VS Code notification with error details
  - Provide action buttons: "Retry", "Skip Task", "Cancel Workflow"
  - Wait for user decision
  - Return user's choice to workflow
  - **EXISTING:** src/extension/orchestrator/MultiAgentOrchestrator.ts
  - **MODIFY:** src/extension/orchestrator/MultiAgentOrchestrator.ts (add HITL, ~80 lines added)
  - **VISUAL RESULT:** User notified when manual intervention needed
  - **TEST:** Trigger unrecoverable error, verify user notification shown
  - _Requirements: FR-5 (HITL escalation), US-1 (User intervention when needed)_
  - _Design: Section 3.2 (Recovery Workflow - HITL escalation)_

- [ ] 11.4 Add recovery metrics tracking
  - In src/extension/orchestrator/RecoveryExecutor.ts, add metrics tracking
  - Track: recovery attempts, success rate, average recovery time, most common errors
  - Store metrics in workspace state
  - Add getRecoveryMetrics(): RecoveryMetrics method
  - Add resetMetrics(): void method
  - **EXISTING:** src/extension/orchestrator/RecoveryExecutor.ts
  - **MODIFY:** src/extension/orchestrator/RecoveryExecutor.ts (add metrics, ~60 lines added)
  - **VISUAL RESULT:** Recovery metrics available for analysis
  - **TEST:** Execute recoveries, verify metrics tracked correctly
  - _Requirements: NFR-3 (Observability)_
  - _Design: Section 10 (Observability & Monitoring - Metrics)_


#### 12. Implement Learning System

- [ ] 12.1 Create pattern learning logic
  - Create src/extension/orchestrator/PatternLearner.ts
  - Implement PatternLearner class with constructor accepting errorPatternStorage: ErrorPatternStorage
  - Add learnFromError(error: Error, recovery: RecoveryStrategy, success: boolean): Promise<void> method
  - Extract error signature (key parts of error message)
  - Check if similar pattern exists
  - If exists, update confidence score based on success
  - If new, create new pattern with initial confidence
  - Save pattern to storage
  - **EXISTING:** src/extension/orchestrator/ErrorPatternStorage.ts
  - **CREATE:** src/extension/orchestrator/PatternLearner.ts (new file, ~120 lines)
  - **VISUAL RESULT:** System learns from recovery attempts
  - **TEST:** Execute recovery, verify pattern learned and stored
  - _Requirements: FR-5 (Learning from errors)_
  - _Design: Section 3.3 (Learning System - Pattern learning)_

- [ ] 12.2 Implement confidence scoring
  - In src/extension/orchestrator/PatternLearner.ts, add updateConfidence() method
  - Use Bayesian updating: new_confidence = (successes + 1) / (attempts + 2)
  - Increase confidence on successful recovery
  - Decrease confidence on failed recovery
  - Remove patterns with confidence < 0.3 after 10 attempts
  - **EXISTING:** src/extension/orchestrator/PatternLearner.ts (from task 12.1)
  - **MODIFY:** src/extension/orchestrator/PatternLearner.ts (add confidence scoring, ~50 lines added)
  - **VISUAL RESULT:** Pattern confidence adapts over time
  - **TEST:** Execute multiple recoveries, verify confidence updates correctly
  - _Requirements: FR-5 (Confidence scoring)_
  - _Design: Section 3.3 (Learning System - Confidence scoring)_

- [ ] 12.3 Integrate learning into recovery workflow
  - In src/extension/orchestrator/RecoveryExecutor.ts, add patternLearner property
  - Update constructor to accept PatternLearner
  - After recovery execution, call patternLearner.learnFromError()
  - Pass error, recovery strategy, and success status
  - **EXISTING:** src/extension/orchestrator/RecoveryExecutor.ts, src/extension/orchestrator/PatternLearner.ts
  - **MODIFY:** src/extension/orchestrator/RecoveryExecutor.ts (integrate learning, ~30 lines added)
  - **VISUAL RESULT:** System learns from every recovery attempt
  - **TEST:** Execute recovery, verify learning triggered
  - _Requirements: FR-5 (Learning integration)_
  - _Design: Section 3.3 (Learning System - Integration)_

- [ ] 12.4 Add pattern export/import
  - In src/extension/orchestrator/ErrorPatternStorage.ts, add exportPatterns(): Promise<string> method
  - Serialize all patterns to JSON string
  - Add importPatterns(json: string): Promise<void> method
  - Parse JSON and validate patterns
  - Merge with existing patterns (no duplicates)
  - Add VS Code commands: "forgeai.exportErrorPatterns", "forgeai.importErrorPatterns"
  - **EXISTING:** src/extension/orchestrator/ErrorPatternStorage.ts
  - **MODIFY:** src/extension/orchestrator/ErrorPatternStorage.ts (add export/import, ~80 lines added)
  - **CREATE:** Add commands in src/extension/extension.ts
  - **VISUAL RESULT:** Users can share learned patterns
  - **TEST:** Export patterns, import them in new workspace, verify patterns available
  - _Requirements: FR-5 (Pattern sharing)_
  - _Design: Section 3.3 (Learning System - Pattern sharing)_

#### 13. Add Error Recovery Tests

- [ ] 13.1 Test error pattern recognition
  - Create src/extension/orchestrator/__tests__/ErrorPatterns.test.ts
  - Test: Match "Cannot find module 'express'" → missing_dependency pattern
  - Test: Match "command not found: npm" → command_not_found pattern
  - Test: Match "ENOENT: no such file" → path_error pattern
  - Test: Match unknown error → returns null
  - Test: Confidence scoring works correctly
  - **EXISTING:** src/extension/orchestrator/ErrorPatterns.ts
  - **CREATE:** src/extension/orchestrator/__tests__/ErrorPatterns.test.ts (new file, ~150 lines)
  - **VISUAL RESULT:** Pattern recognition thoroughly tested
  - **TEST:** Run tests, verify all pattern matching works
  - _Requirements: FR-5_
  - _Design: Section 8.1 (Unit Testing - Error recovery)_

- [ ] 13.2 Test recovery execution
  - Create src/extension/orchestrator/__tests__/RecoveryExecutor.test.ts
  - Test: Execute recovery strategy with 3 steps
  - Test: Recovery succeeds when all steps complete
  - Test: Recovery fails when step fails
  - Test: Recovery tracks progress correctly
  - Test: Metrics updated after recovery
  - Use mock ToolRegistry
  - **EXISTING:** src/extension/orchestrator/RecoveryExecutor.ts
  - **CREATE:** src/extension/orchestrator/__tests__/RecoveryExecutor.test.ts (new file, ~180 lines)
  - **VISUAL RESULT:** Recovery execution thoroughly tested
  - **TEST:** Run tests, verify recovery execution works
  - _Requirements: FR-5_
  - _Design: Section 8.1 (Unit Testing - Error recovery)_

- [ ] 13.3 Test pattern learning
  - Create src/extension/orchestrator/__tests__/PatternLearner.test.ts
  - Test: Learn new pattern from error
  - Test: Update existing pattern confidence
  - Test: Remove low-confidence patterns
  - Test: Bayesian confidence scoring works correctly
  - Use mock ErrorPatternStorage
  - **EXISTING:** src/extension/orchestrator/PatternLearner.ts
  - **CREATE:** src/extension/orchestrator/__tests__/PatternLearner.test.ts (new file, ~150 lines)
  - **VISUAL RESULT:** Learning system thoroughly tested
  - **TEST:** Run tests, verify learning works correctly
  - _Requirements: FR-5_
  - _Design: Section 8.1 (Unit Testing - Learning system)_

- [ ] 13.4 Test end-to-end error recovery
  - Create src/extension/orchestrator/__tests__/integration/ErrorRecovery.test.ts
  - Test: Workflow encounters error, recognizes pattern, recovers automatically
  - Test: Workflow encounters unknown error, escalates to user
  - Test: Recovery fails, tries alternative strategy
  - Test: Max recovery attempts enforced (3)
  - Test: Pattern learned after recovery
  - Use real agents and recovery system
  - **EXISTING:** All error recovery components
  - **CREATE:** src/extension/orchestrator/__tests__/integration/ErrorRecovery.test.ts (new file, ~200 lines)
  - **VISUAL RESULT:** End-to-end error recovery tested
  - **TEST:** Run integration test, verify complete recovery workflow
  - _Requirements: FR-5, US-1_
  - _Design: Section 8.2 (Integration Testing - Error recovery)_


### Phase 5: Integration & Testing (Week 9-10)

#### 17. Integrate with Existing AgentLoop

- [ ] 17.1 Create orchestrator adapter
  - Create src/extension/orchestrator/AgentLoopAdapter.ts
  - Implement AgentLoopAdapter class with constructor accepting agentLoop: AgentLoop, orchestrator: MultiAgentOrchestrator
  - Add shouldUseOrchestrator(request: string): boolean method
  - Detect complex requests that need orchestration (keywords: "fix and test", "refactor and document", "multiple files")
  - Add executeWithOrchestrator(request: string): Promise<void> method
  - Call orchestrator.run() and stream results to AgentLoop
  - Add executeWithSingleAgent(request: string): Promise<void> method
  - Use existing AgentLoop for simple requests
  - **EXISTING:** src/extension/ollama/AgentLoop.ts, src/extension/orchestrator/MultiAgentOrchestrator.ts
  - **CREATE:** src/extension/orchestrator/AgentLoopAdapter.ts (new file, ~150 lines)
  - **VISUAL RESULT:** Seamless integration with existing AgentLoop
  - **TEST:** Send complex request, verify orchestrator used; send simple request, verify single agent used
  - _Requirements: FR-7 (AgentLoop integration)_
  - _Design: Section 5 (Integration with Existing AgentLoop)_

- [ ] 17.2 Update ChatParticipant to use adapter
  - In src/extension/providers/ChatParticipant.ts, import AgentLoopAdapter
  - Create AgentLoopAdapter instance in activate()
  - In handleChatRequest(), call adapter.shouldUseOrchestrator()
  - If true, call adapter.executeWithOrchestrator()
  - If false, call adapter.executeWithSingleAgent()
  - Stream progress updates to chat UI
  - **EXISTING:** src/extension/providers/ChatParticipant.ts, src/extension/orchestrator/AgentLoopAdapter.ts
  - **MODIFY:** src/extension/providers/ChatParticipant.ts (integrate adapter, ~50 lines added)
  - **VISUAL RESULT:** Chat participant uses orchestrator for complex requests
  - **TEST:** Send complex request in chat, verify orchestrator executes
  - _Requirements: FR-7 (Chat integration)_
  - _Design: Section 5 (Integration with Existing AgentLoop - ChatParticipant)_

- [ ] 17.3 Add orchestrator status to UI
  - In src/webview/components/ActivityStream/ActivityStream.tsx, add orchestrator status display
  - Show current workflow status (planning, executing, evaluating, complete)
  - Show current task being executed
  - Show progress bar (tasks completed / total tasks)
  - Show parallel execution indicator when tasks run in parallel
  - Update status in real-time using progress callbacks
  - **EXISTING:** src/webview/components/ActivityStream/ActivityStream.tsx
  - **MODIFY:** src/webview/components/ActivityStream/ActivityStream.tsx (add orchestrator status, ~100 lines added)
  - **VISUAL RESULT:** User sees orchestrator progress in UI
  - **TEST:** Execute orchestrated workflow, verify status updates in UI
  - _Requirements: US-2 (Progress visible), NFR-3 (Observability)_
  - _Design: Section 5 (Integration with Existing AgentLoop - UI updates)_

- [ ] 17.4 Add orchestrator commands
  - In src/extension/extension.ts, register new commands
  - Command: "forgeai.runOrchestrator" - Run orchestrator with user input
  - Command: "forgeai.pauseOrchestrator" - Pause current workflow
  - Command: "forgeai.resumeOrchestrator" - Resume paused workflow
  - Command: "forgeai.cancelOrchestrator" - Cancel current workflow
  - Command: "forgeai.showOrchestratorStatus" - Show status in output panel
  - Each command calls appropriate orchestrator method
  - **EXISTING:** src/extension/extension.ts, src/extension/orchestrator/MultiAgentOrchestrator.ts
  - **MODIFY:** src/extension/extension.ts (add commands, ~80 lines added)
  - **VISUAL RESULT:** Users can control orchestrator via commands
  - **TEST:** Run commands, verify orchestrator responds correctly
  - _Requirements: FR-7 (Command integration)_
  - _Design: Section 5 (Integration with Existing AgentLoop - Commands)_

#### 18. Add Comprehensive Integration Tests

- [ ] 18.1 Test simple workflow end-to-end
  - Create src/extension/__tests__/integration/SimpleWorkflow.test.ts
  - Test: "Fix typo in README.md"
  - Verify: Planner creates 3 tasks (read, fix, verify)
  - Verify: Executor fixes typo
  - Verify: Critic validates fix
  - Verify: Workflow completes successfully
  - Use real file system, real tools
  - **EXISTING:** All orchestrator components
  - **CREATE:** src/extension/__tests__/integration/SimpleWorkflow.test.ts (new file, ~150 lines)
  - **VISUAL RESULT:** Simple workflow tested end-to-end
  - **TEST:** Run integration test, verify workflow completes
  - _Requirements: All functional requirements_
  - _Design: Section 8.2 (Integration Testing - Simple workflow)_

- [ ] 18.2 Test complex workflow end-to-end
  - Create src/extension/__tests__/integration/ComplexWorkflow.test.ts
  - Test: "Fix auth bug, add tests, and update docs"
  - Verify: Planner creates 8+ tasks with dependencies
  - Verify: Tasks execute in correct order
  - Verify: Parallel tasks execute simultaneously
  - Verify: Error recovery works if test fails
  - Verify: Workflow completes successfully
  - Use real file system, real tools
  - **EXISTING:** All orchestrator components
  - **CREATE:** src/extension/__tests__/integration/ComplexWorkflow.test.ts (new file, ~250 lines)
  - **VISUAL RESULT:** Complex workflow tested end-to-end
  - **TEST:** Run integration test, verify workflow completes
  - _Requirements: All functional requirements_
  - _Design: Section 8.2 (Integration Testing - Complex workflow)_

- [ ] 18.3 Test AgentLoop integration
  - Create src/extension/__tests__/integration/AgentLoopIntegration.test.ts
  - Test: Simple request uses single agent
  - Test: Complex request uses orchestrator
  - Test: Progress updates stream to UI
  - Test: User can pause/resume/cancel
  - Test: Commands work correctly
  - Use real AgentLoop and orchestrator
  - **EXISTING:** src/extension/orchestrator/AgentLoopAdapter.ts, src/extension/ollama/AgentLoop.ts
  - **CREATE:** src/extension/__tests__/integration/AgentLoopIntegration.test.ts (new file, ~200 lines)
  - **VISUAL RESULT:** AgentLoop integration tested
  - **TEST:** Run integration test, verify integration works
  - _Requirements: FR-7_
  - _Design: Section 8.2 (Integration Testing - AgentLoop integration)_

- [ ] 18.4 Test error scenarios
  - Create src/extension/__tests__/integration/ErrorScenarios.test.ts
  - Test: Missing dependency error → auto-recovery
  - Test: Test failure → retry with fixes
  - Test: Unrecoverable error → HITL escalation
  - Test: Max iterations reached → workflow stops
  - Test: User cancels workflow → cleanup happens
  - Use real orchestrator and error recovery system
  - **EXISTING:** All orchestrator components
  - **CREATE:** src/extension/__tests__/integration/ErrorScenarios.test.ts (new file, ~220 lines)
  - **VISUAL RESULT:** Error scenarios tested
  - **TEST:** Run integration test, verify error handling works
  - _Requirements: FR-5, NFR-2 (Reliability)_
  - _Design: Section 8.2 (Integration Testing - Error scenarios)_

#### 19. Performance Testing

- [ ] 19.1 Create performance benchmarks
  - Create src/extension/__tests__/performance/Benchmarks.test.ts
  - Benchmark: Sequential execution of 10 tasks
  - Benchmark: Parallel execution of 10 tasks (3 levels)
  - Benchmark: Planning time for complex request
  - Benchmark: Error recovery time
  - Measure: execution time, memory usage, CPU usage
  - Compare: orchestrator vs single agent
  - **EXISTING:** All orchestrator components
  - **CREATE:** src/extension/__tests__/performance/Benchmarks.test.ts (new file, ~180 lines)
  - **VISUAL RESULT:** Performance benchmarks
  - **TEST:** Run benchmarks, verify performance meets requirements
  - _Requirements: NFR-1 (Performance)_
  - _Design: Section 12 (Performance Optimization)_

- [ ] 19.2 Test resource limits
  - Create src/extension/__tests__/performance/ResourceLimits.test.ts
  - Test: Max concurrent tasks enforced (3)
  - Test: Max iterations enforced (20)
  - Test: Max recovery attempts enforced (3)
  - Test: Memory usage stays under 500MB
  - Test: CPU usage stays under 80%
  - **EXISTING:** All orchestrator components
  - **CREATE:** src/extension/__tests__/performance/ResourceLimits.test.ts (new file, ~150 lines)
  - **VISUAL RESULT:** Resource limits tested
  - **TEST:** Run tests, verify limits enforced
  - _Requirements: NFR-1 (Performance - Resource limits)_
  - _Design: Section 12 (Performance Optimization - Resource management)_

- [ ] 19.3 Test scalability
  - Create src/extension/__tests__/performance/Scalability.test.ts
  - Test: Workflow with 50 tasks completes
  - Test: Workflow with 100 tasks completes
  - Test: Execution time scales linearly
  - Test: Memory usage scales linearly
  - Test: No memory leaks after 10 workflows
  - **EXISTING:** All orchestrator components
  - **CREATE:** src/extension/__tests__/performance/Scalability.test.ts (new file, ~180 lines)
  - **VISUAL RESULT:** Scalability tested
  - **TEST:** Run tests, verify system scales
  - _Requirements: NFR-1 (Performance - Scalability)_
  - _Design: Section 12 (Performance Optimization - Scalability)_


### Phase 6: Polish & Production (Week 11-12)

#### 20. Add Observability & Monitoring

- [ ] 20.1 Implement telemetry collection
  - Create src/extension/orchestrator/Telemetry.ts
  - Implement Telemetry class with constructor()
  - Add trackEvent(event: string, properties: Record<string, any>): void method
  - Add trackMetric(metric: string, value: number): void method
  - Add trackError(error: Error, context: Record<string, any>): void method
  - Store telemetry data in memory (circular buffer, max 1000 events)
  - Add getTelemetry(): TelemetryData method
  - Add clearTelemetry(): void method
  - **EXISTING:** None
  - **CREATE:** src/extension/orchestrator/Telemetry.ts (new file, ~120 lines)
  - **VISUAL RESULT:** Telemetry collection system
  - **TEST:** Track events, verify data collected correctly
  - _Requirements: NFR-3 (Observability)_
  - _Design: Section 10 (Observability & Monitoring - Telemetry)_

- [ ] 20.2 Add telemetry to orchestrator
  - In src/extension/orchestrator/MultiAgentOrchestrator.ts, add telemetry property
  - Track events: workflow_started, workflow_completed, workflow_failed, task_started, task_completed, task_failed
  - Track metrics: workflow_duration, task_duration, tasks_per_workflow, iterations_per_task
  - Track errors: all errors with context
  - Call telemetry methods at appropriate points
  - **EXISTING:** src/extension/orchestrator/MultiAgentOrchestrator.ts, src/extension/orchestrator/Telemetry.ts
  - **MODIFY:** src/extension/orchestrator/MultiAgentOrchestrator.ts (add telemetry, ~60 lines added)
  - **VISUAL RESULT:** Orchestrator tracks all events
  - **TEST:** Run workflow, verify telemetry collected
  - _Requirements: NFR-3 (Observability)_
  - _Design: Section 10 (Observability & Monitoring - Integration)_

- [ ] 20.3 Create telemetry viewer
  - Create src/webview/components/Telemetry/TelemetryViewer.tsx
  - Display telemetry events in table (timestamp, event, properties)
  - Display metrics in charts (workflow duration over time, success rate)
  - Display errors with stack traces
  - Add filters: by event type, by time range
  - Add export button (export to JSON)
  - **EXISTING:** src/webview/components/
  - **CREATE:** src/webview/components/Telemetry/TelemetryViewer.tsx (new file, ~200 lines)
  - **VISUAL RESULT:** Telemetry viewer UI
  - **TEST:** View telemetry in UI, verify data displayed correctly
  - _Requirements: NFR-3 (Observability)_
  - _Design: Section 10 (Observability & Monitoring - Visualization)_

- [ ] 20.4 Add logging configuration
  - In src/extension/orchestrator/MultiAgentOrchestrator.ts, add log level configuration
  - Support log levels: DEBUG, INFO, WARN, ERROR
  - Add setLogLevel(level: LogLevel): void method
  - Filter logs based on level
  - Add VS Code setting: "forgeai.orchestrator.logLevel"
  - **EXISTING:** src/extension/orchestrator/MultiAgentOrchestrator.ts
  - **MODIFY:** src/extension/orchestrator/MultiAgentOrchestrator.ts (add logging config, ~40 lines added)
  - **MODIFY:** package.json (add setting)
  - **VISUAL RESULT:** Configurable logging
  - **TEST:** Change log level, verify logs filtered correctly
  - _Requirements: NFR-3 (Observability)_
  - _Design: Section 10 (Observability & Monitoring - Logging)_

#### 21. Add Documentation

- [ ] 21.1 Create architecture documentation
  - Create docs/orchestrator/ARCHITECTURE.md
  - Document: System overview, component diagram, data flow
  - Document: Agent responsibilities (Planner, Executor, Critic)
  - Document: LangGraph state machine (nodes, edges, routing)
  - Document: Error recovery system (patterns, learning)
  - Document: Parallel execution (dependency graph, topological sort)
  - Include: Mermaid diagrams for visualization
  - **EXISTING:** None
  - **CREATE:** docs/orchestrator/ARCHITECTURE.md (new file, ~300 lines)
  - **VISUAL RESULT:** Comprehensive architecture documentation
  - **TEST:** Review documentation, verify accuracy
  - _Requirements: Documentation requirement_
  - _Design: All sections_

- [ ] 21.2 Create API documentation
  - Create docs/orchestrator/API.md
  - Document: MultiAgentOrchestrator API (methods, parameters, return types)
  - Document: Agent APIs (PlannerAgent, ExecutorAgent, CriticAgent)
  - Document: Error recovery APIs (ErrorPatternStorage, RecoveryExecutor)
  - Document: Parallel execution APIs (DependencyGraph, ParallelExecutor)
  - Include: Code examples for each API
  - Include: TypeScript type definitions
  - **EXISTING:** None
  - **CREATE:** docs/orchestrator/API.md (new file, ~250 lines)
  - **VISUAL RESULT:** Complete API documentation
  - **TEST:** Review documentation, verify accuracy
  - _Requirements: Documentation requirement_
  - _Design: Section 6 (API Specifications)_

- [ ] 21.3 Create user guide
  - Create docs/orchestrator/USER_GUIDE.md
  - Document: How to use orchestrator (commands, chat integration)
  - Document: When to use orchestrator vs single agent
  - Document: How to monitor progress (UI, telemetry)
  - Document: How to handle errors (HITL, recovery)
  - Document: How to configure orchestrator (settings)
  - Include: Screenshots and examples
  - Include: Troubleshooting section
  - **EXISTING:** None
  - **CREATE:** docs/orchestrator/USER_GUIDE.md (new file, ~200 lines)
  - **VISUAL RESULT:** User-friendly guide
  - **TEST:** Follow guide, verify instructions work
  - _Requirements: Documentation requirement_
  - _Design: All user-facing features_

- [ ] 21.4 Create developer guide
  - Create docs/orchestrator/DEVELOPER_GUIDE.md
  - Document: How to extend orchestrator (custom agents, custom patterns)
  - Document: How to add new error patterns
  - Document: How to customize recovery strategies
  - Document: How to add new task types
  - Document: Testing guidelines (unit, integration, performance)
  - Include: Code examples for extensions
  - **EXISTING:** None
  - **CREATE:** docs/orchestrator/DEVELOPER_GUIDE.md (new file, ~250 lines)
  - **VISUAL RESULT:** Developer extension guide
  - **TEST:** Follow guide, verify extension works
  - _Requirements: Documentation requirement_
  - _Design: Extensibility considerations_

#### 22. Security & Configuration

- [ ] 22.1 Implement security controls
  - Create src/extension/orchestrator/SecurityManager.ts
  - Implement SecurityManager class with constructor()
  - Add validateToolAccess(toolName: string): boolean method
  - Maintain whitelist of allowed tools
  - Add validateFileAccess(path: string): boolean method
  - Prevent access to sensitive files (.env, credentials, private keys)
  - Add validateCommandExecution(command: string): boolean method
  - Prevent dangerous commands (rm -rf, format, etc.)
  - Add VS Code settings for security configuration
  - **EXISTING:** None
  - **CREATE:** src/extension/orchestrator/SecurityManager.ts (new file, ~150 lines)
  - **VISUAL RESULT:** Security controls in place
  - **TEST:** Attempt dangerous operations, verify blocked
  - _Requirements: NFR-5 (Security)_
  - _Design: Section 11 (Security Considerations)_

- [ ] 22.2 Add configuration management
  - Create src/extension/orchestrator/ConfigManager.ts
  - Implement ConfigManager class with constructor()
  - Add getConfig(key: string): any method
  - Add setConfig(key: string, value: any): void method
  - Support configuration keys: maxIterations, maxConcurrentTasks, maxRecoveryAttempts, logLevel, enableTelemetry
  - Load configuration from VS Code settings
  - Add configuration validation
  - **EXISTING:** None
  - **CREATE:** src/extension/orchestrator/ConfigManager.ts (new file, ~120 lines)
  - **VISUAL RESULT:** Centralized configuration
  - **TEST:** Change config, verify orchestrator uses new values
  - _Requirements: NFR-6 (Configurability)_
  - _Design: Section 13 (Configuration)_

- [ ] 22.3 Add VS Code settings
  - In package.json, add configuration section
  - Setting: forgeai.orchestrator.maxIterations (default: 20)
  - Setting: forgeai.orchestrator.maxConcurrentTasks (default: 3)
  - Setting: forgeai.orchestrator.maxRecoveryAttempts (default: 3)
  - Setting: forgeai.orchestrator.logLevel (default: "INFO")
  - Setting: forgeai.orchestrator.enableTelemetry (default: true)
  - Setting: forgeai.orchestrator.enableParallelExecution (default: true)
  - Setting: forgeai.orchestrator.securityMode (default: "strict")
  - **EXISTING:** package.json
  - **MODIFY:** package.json (add settings, ~50 lines added)
  - **VISUAL RESULT:** User-configurable settings
  - **TEST:** Change settings in VS Code, verify orchestrator uses them
  - _Requirements: NFR-6 (Configurability)_
  - _Design: Section 13 (Configuration)_

- [ ] 22.4 Integrate security and config
  - In src/extension/orchestrator/MultiAgentOrchestrator.ts, add securityManager and configManager
  - Update constructor to accept SecurityManager and ConfigManager
  - Check security before tool execution
  - Use config values for limits (maxIterations, maxConcurrentTasks, etc.)
  - Throw error if security check fails
  - **EXISTING:** src/extension/orchestrator/MultiAgentOrchestrator.ts, SecurityManager, ConfigManager
  - **MODIFY:** src/extension/orchestrator/MultiAgentOrchestrator.ts (integrate security/config, ~60 lines added)
  - **VISUAL RESULT:** Secure and configurable orchestrator
  - **TEST:** Attempt dangerous operation, verify blocked; change config, verify used
  - _Requirements: NFR-5 (Security), NFR-6 (Configurability)_
  - _Design: Section 11 (Security), Section 13 (Configuration)_

#### 23. Final Testing & Optimization

- [ ] 23.1 Run full test suite
  - Run all unit tests (npm test)
  - Run all integration tests
  - Run all performance tests
  - Verify >80% code coverage
  - Fix any failing tests
  - **EXISTING:** All test files
  - **MODIFY:** Fix any issues found
  - **VISUAL RESULT:** All tests passing
  - **TEST:** npm test shows 100% pass rate
  - _Requirements: All requirements_
  - _Design: Section 8 (Testing Strategy)_

- [ ] 23.2 Performance optimization
  - Profile orchestrator execution
  - Identify bottlenecks (slow agents, slow tools)
  - Optimize hot paths (planning, execution, validation)
  - Reduce memory allocations
  - Add caching where appropriate (plan cache, pattern cache)
  - Verify performance meets requirements (<5s for simple workflows)
  - **EXISTING:** All orchestrator components
  - **MODIFY:** Optimize identified bottlenecks
  - **VISUAL RESULT:** Faster execution
  - **TEST:** Run benchmarks, verify performance improved
  - _Requirements: NFR-1 (Performance)_
  - _Design: Section 12 (Performance Optimization)_

- [ ] 23.3 Memory leak detection
  - Run orchestrator for 100 workflows
  - Monitor memory usage over time
  - Identify memory leaks (listeners not removed, references not cleared)
  - Fix memory leaks
  - Verify memory usage stable after 100 workflows
  - **EXISTING:** All orchestrator components
  - **MODIFY:** Fix memory leaks
  - **VISUAL RESULT:** Stable memory usage
  - **TEST:** Run 100 workflows, verify memory doesn't grow
  - _Requirements: NFR-2 (Reliability)_
  - _Design: Section 12 (Performance Optimization - Memory management)_

- [ ] 23.4 User acceptance testing
  - Test with real user scenarios (bug fixes, feature additions, refactoring)
  - Verify user experience is smooth
  - Verify error messages are clear
  - Verify progress updates are helpful
  - Collect feedback and make improvements
  - **EXISTING:** Complete orchestrator system
  - **MODIFY:** Based on user feedback
  - **VISUAL RESULT:** Production-ready system
  - **TEST:** Real users can complete tasks successfully
  - _Requirements: All user stories_
  - _Design: All user-facing features_

## Completion Criteria

The multi-agent orchestration system is complete when:

1. ✅ All 23 tasks and their subtasks are completed
2. ✅ All tests pass (unit, integration, performance)
3. ✅ Code coverage >80%
4. ✅ Documentation complete (architecture, API, user guide, developer guide)
5. ✅ Performance meets requirements (<5s simple workflows, <30s complex workflows)
6. ✅ Security controls in place
7. ✅ User acceptance testing passed
8. ✅ No critical bugs or memory leaks

## Next Steps After Completion

1. Deploy to production
2. Monitor telemetry and user feedback
3. Iterate based on feedback
4. Add advanced features (custom agents, advanced recovery strategies)
5. Optimize further based on real-world usage

