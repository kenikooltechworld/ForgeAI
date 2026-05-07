# Requirements: Multi-Agent Orchestration System

## Overview

Implement a production-grade multi-agent orchestration system for ForgeAI using the proven Planner-Executor-Critic pattern from Anthropic's architecture. This system will enable intelligent error recovery, parallel task execution, and autonomous problem-solving through specialized agents coordinated by LangGraph.

**Reference Documents:**
- #[[file:docs/research/multi-agent-orchestration-2026.md]]
- #[[file:docs/research/autonomous-system-prompts-2026.md]]
- #[[file:forge.md]]

## Business Goals

1. **Intelligent Error Recovery** - Automatically detect, analyze, and fix errors without user intervention
2. **Autonomous Problem Solving** - Break down complex tasks and solve them systematically
3. **Production Quality** - Deliver working code through iterative refinement (5-15 iterations)
4. **Developer Productivity** - Reduce manual debugging and error fixing by 80%
5. **Scalability** - Support parallel task execution and horizontal scaling

## User Stories

### US-1: Intelligent Error Recovery
**As a** developer  
**I want** ForgeAI to automatically fix errors when commands fail  
**So that** I don't have to manually debug and retry commands

**Acceptance Criteria:**
- When a terminal command fails, Critic agent analyzes the error
- System identifies error pattern (e.g., "command not found", "ENOENT", "permission denied")
- Executor agent applies appropriate fix automatically
- System retries command with fix applied
- Loop continues until success or max iterations (default: 5)
- User sees progress: "Error detected → Analyzing → Fixing → Retrying → Success"

**Example Flow:**
```
User: "Run npm test"
→ Executor runs: npm test in "my-app" directory
→ Error: "Starting directory 'my-app' does not exist"
→ Critic analyzes: Directory doesn't exist, need to find correct path
→ Critic investigates: Runs listDirectory to see workspace structure
→ Critic identifies: package.json is in current directory, not "my-app"
→ Executor fixes: Runs npm test in current directory
→ Success: Tests pass
→ User sees: "✅ Fixed directory error and ran tests successfully. All 17 tests pass."
```

### US-2: Autonomous Task Decomposition
**As a** developer  
**I want** ForgeAI to break down complex requests into manageable tasks  
**So that** I can accomplish complex goals without micromanaging

**Acceptance Criteria:**
- Planner agent receives user request
- Planner decomposes into 3-10 concrete tasks with dependencies
- Each task has clear success criteria
- Tasks execute in correct order (respecting dependencies)
- Progress visible in UI: "Task 1/5: Reading code... ✓"
- Final result aggregates all task outputs

**Example:**
```
User: "Fix the authentication bug and add tests"
→ Planner creates tasks:
  1. Read auth code (src/auth/login.ts)
  2. Analyze bug (identify null pointer issue)
  3. Generate fix (add token validation)
  4. Apply fix (write corrected code)
  5. Generate tests (create login.test.ts)
  6. Run tests (verify all pass)
→ Executor executes tasks sequentially
→ Critic validates each task before proceeding
→ User sees: "✅ Fixed auth bug and added 5 tests. All tests pass."
```

### US-3: Quality Assurance Loop
**As a** developer  
**I want** ForgeAI to validate its own work before showing me results  
**So that** I receive production-quality code, not broken implementations

**Acceptance Criteria:**
- After Executor completes a task, Critic evaluates quality
- Critic runs actual tests (not just reads code)
- Critic checks: functionality, code quality, test coverage
- If quality fails, Critic provides specific feedback
- Executor refines based on feedback
- Loop continues 5-15 iterations until quality criteria met
- User only sees final result after quality validation

**Quality Criteria:**
- **Functionality:** Code works as specified (tests pass)
- **Code Quality:** No syntax errors, follows best practices
- **Completeness:** No stub implementations or TODOs
- **Test Coverage:** Critical paths have tests

### US-4: Parallel Task Execution
**As a** developer  
**I want** ForgeAI to execute independent tasks in parallel  
**So that** complex operations complete faster

**Acceptance Criteria:**
- Planner identifies tasks with no dependencies
- Independent tasks execute simultaneously
- Dependent tasks wait for prerequisites
- Progress shows parallel execution: "Running 3 tasks in parallel..."
- Results aggregate when all tasks complete
- Failure in one task doesn't block independent tasks

**Example:**
```
User: "Analyze all TypeScript files for issues"
→ Planner creates tasks:
  - Task 1: Analyze src/auth/*.ts (no dependencies)
  - Task 2: Analyze src/api/*.ts (no dependencies)
  - Task 3: Analyze src/utils/*.ts (no dependencies)
  - Task 4: Aggregate results (depends on 1, 2, 3)
→ Tasks 1-3 run in parallel
→ Task 4 waits for all to complete
→ User sees: "Analyzed 47 files in 12 seconds (3 parallel workers)"
```

### US-5: Learning from Corrections
**As a** developer  
**I want** ForgeAI to learn from my corrections  
**So that** it doesn't repeat the same mistakes

**Acceptance Criteria:**
- When user corrects ForgeAI's output, system records the correction
- Critic agent analyzes: what was wrong, what was correct
- Pattern stored in learning database
- Future similar tasks use learned patterns
- Confidence scores improve over time
- User sees: "Applied learned pattern from previous correction"

## Functional Requirements

### FR-1: Planner Agent
**Priority:** P0 (Critical)

The Planner agent decomposes user requests into executable tasks.

**Capabilities:**
- Parse natural language requests
- Identify required context (files, dependencies, tools)
- Create task dependency graph
- Estimate task complexity
- Generate execution plan with success criteria

**Input:** User request (string)  
**Output:** Task plan (array of tasks with dependencies)

**Example Task Plan:**
```typescript
{
  tasks: [
    {
      id: "task-1",
      type: "read_code",
      description: "Read authentication code",
      files: ["src/auth/login.ts"],
      dependencies: [],
      criteria: "File content retrieved successfully"
    },
    {
      id: "task-2",
      type: "analyze",
      description: "Identify bug cause",
      dependencies: ["task-1"],
      criteria: "Root cause identified with confidence > 0.8"
    },
    {
      id: "task-3",
      type: "generate_fix",
      description: "Create fix for null pointer",
      dependencies: ["task-2"],
      criteria: "Fix addresses root cause, no new errors introduced"
    }
  ],
  context: {
    framework: "React",
    testRunner: "Vitest",
    language: "TypeScript"
  }
}
```

### FR-2: Executor Agent
**Priority:** P0 (Critical)

The Executor agent implements tasks using available tools.

**Capabilities:**
- Execute tasks from plan
- Use ForgeAI tools (file operations, terminal commands, etc.)
- Self-evaluate before handoff to Critic
- Apply feedback from Critic to refine implementation
- Track iteration count

**Input:** Task + Context + Optional Feedback  
**Output:** Task result + Self-evaluation

**Tools Available:**
- All ForgeAI tools (forgeai_readFile, forgeai_writeFile, forgeai_runCommand, etc.)
- Git tools (forgeai_gitStatus, forgeai_gitCommit, etc.)
- Diagnostics tools (forgeai_getDiagnostics, forgeai_getErrors)

### FR-3: Critic Agent (Error Recovery)
**Priority:** P0 (Critical)

The Critic agent validates Executor's work and provides feedback.

**Capabilities:**
- Run actual tests (not just read code)
- Check code quality (syntax, style, best practices)
- Analyze errors and identify patterns
- Provide specific, actionable feedback
- Suggest fixes for common error patterns
- Track confidence scores

**Error Pattern Recognition:**
- "command not found" → Install missing command
- "ENOENT: no such file or directory" → Fix path or create directory
- "permission denied" → Fix permissions
- "port already in use" → Kill process or use different port
- "Cannot find module" → Install missing dependency
- "expect is not defined" → Add test framework imports

**Input:** Task result + Success criteria  
**Output:** Evaluation (pass/fail) + Feedback

**Evaluation Schema:**
```typescript
{
  status: "pass" | "fail",
  confidence: 0.0 - 1.0,
  feedback: {
    functionality: { passed: boolean, issues: string[] },
    codeQuality: { score: number, issues: string[] },
    testCoverage: { percentage: number, missing: string[] },
    suggestions: string[]
  }
}
```

### FR-4: Orchestration Layer (LangGraph Integration)
**Priority:** P0 (Critical)

Coordinate agents using LangGraph state machine.

**Capabilities:**
- Manage agent lifecycle
- Route between Planner → Executor → Critic
- Handle state persistence (checkpointing)
- Support parallel execution
- Implement retry logic with max iterations
- Provide observability (trace execution)

**State Schema:**
```typescript
{
  userRequest: string,
  plan: TaskPlan,
  currentTask: Task | null,
  results: TaskResult[],
  iteration: number,
  maxIterations: number,
  status: "planning" | "executing" | "evaluating" | "complete" | "failed"
}
```

### FR-5: Error Recovery System
**Priority:** P0 (Critical)

Automatically detect, analyze, and fix errors.

**Error Recovery Workflow:**
1. **Detect:** Executor encounters error (command fails, test fails, etc.)
2. **Analyze:** Critic identifies error pattern and root cause
3. **Investigate:** Critic uses tools to gather evidence (listDirectory, readFile, etc.)
4. **Fix:** Executor applies appropriate fix based on Critic's analysis
5. **Verify:** Critic validates fix worked
6. **Retry:** Executor retries original operation
7. **Loop:** Repeat until success or max iterations

**Supported Error Types:**
- Terminal command errors
- Test failures
- Compilation errors
- Runtime errors
- File system errors
- Dependency errors

### FR-6: Parallel Task Execution
**Priority:** P1 (High)

Execute independent tasks simultaneously.

**Capabilities:**
- Identify tasks with no dependencies
- Spawn parallel Executor agents
- Aggregate results when all complete
- Handle partial failures gracefully

**Constraints:**
- Max 3 parallel tasks (to avoid overwhelming system)
- Dependent tasks wait for prerequisites
- Shared state protected with locks

### FR-7: Learning System
**Priority:** P2 (Medium)

Learn from user corrections and improve over time.

**Capabilities:**
- Record user corrections
- Analyze correction patterns
- Store learned patterns in database
- Apply learned patterns to future tasks
- Track confidence scores

**Learning Database Schema:**
```typescript
{
  pattern: {
    errorType: string,
    context: object,
    incorrectApproach: string,
    correctApproach: string,
    confidence: number,
    timesApplied: number,
    successRate: number
  }
}
```

## Non-Functional Requirements

### NFR-1: Performance
- Task planning: < 2 seconds
- Task execution: < 30 seconds per task
- Error analysis: < 5 seconds
- Total workflow: < 5 minutes for complex tasks
- Parallel execution: 3x faster than sequential for independent tasks

### NFR-2: Reliability
- Success rate: > 90% for common tasks
- Error recovery: > 85% success rate
- Max iterations: 5 (configurable up to 15)
- Graceful degradation: Fall back to HITL if stuck

### NFR-3: Observability
- Every agent action logged
- Execution traces viewable in UI
- Progress visible in real-time
- Thinking process exposed to user
- Performance metrics tracked

### NFR-4: Scalability
- Support 10+ concurrent workflows
- Handle 100+ tasks per workflow
- Parallel execution scales to 3 workers
- State persistence for long-running tasks

### NFR-5: Maintainability
- Agent code modular and testable
- Clear separation of concerns
- LangGraph handles orchestration complexity
- Easy to add new specialist agents

## Technical Constraints

### TC-1: Framework
- **MUST** use LangGraph for orchestration (MIT license, free)
- **MUST** integrate with existing ForgeAI tools
- **MUST** work with Ollama + Qwen3-Coder-397B
- **MUST** use TypeScript throughout

### TC-2: Integration
- **MUST** integrate with existing AgentLoop
- **MUST** use existing ToolRegistry
- **MUST** work with current VS Code extension architecture
- **MUST** maintain backward compatibility

### TC-3: Dependencies
- LangGraph (TypeScript version)
- @langchain/core
- @langchain/ollama (for Ollama integration)
- Existing ForgeAI dependencies

### TC-4: Cost
- **MUST** be 100% free (no paid services)
- **MUST** run locally with Ollama
- **MUST** not require cloud APIs

## Success Metrics

### Metric 1: Error Recovery Rate
**Target:** 85% of errors automatically fixed  
**Measurement:** (Errors fixed automatically / Total errors) × 100

### Metric 2: Task Success Rate
**Target:** 90% of tasks complete successfully  
**Measurement:** (Successful tasks / Total tasks) × 100

### Metric 3: Iteration Efficiency
**Target:** Average 3-5 iterations per task  
**Measurement:** Total iterations / Total tasks

### Metric 4: User Intervention Rate
**Target:** < 15% of workflows require HITL  
**Measurement:** (Workflows with HITL / Total workflows) × 100

### Metric 5: Time to Resolution
**Target:** < 5 minutes for complex tasks  
**Measurement:** Average time from request to completion

## Out of Scope

The following are explicitly OUT OF SCOPE for this spec:

1. **Visual QA Agent** - Screenshot analysis and CSS fixes (future spec)
2. **RAG System** - Documentation search and retrieval (future spec)
3. **Persona System** - Multiple AI personalities (future spec)
4. **Cloud Deployment** - LangGraph Cloud hosting (use local only)
5. **Advanced Learning** - ML-based pattern recognition (use simple pattern matching)
6. **Multi-Model Support** - Only Ollama + Qwen3-Coder-397B for now

## Dependencies

### Upstream Dependencies
- Core Extension Foundation Phase 1 (MUST be complete)
- Tool Registry (MUST be functional)
- AgentLoop (MUST be working)
- Ollama Client (MUST be integrated)

### Downstream Dependencies
- Future specs will build on this orchestration system
- RAG system will use Planner-Executor-Critic pattern
- Visual QA will use Critic agent for validation

## Risks and Mitigations

### Risk 1: LangGraph Learning Curve
**Impact:** High  
**Probability:** Medium  
**Mitigation:** 
- Start with simple examples from documentation
- Use TypeScript version (more familiar than Python)
- Allocate 1 week for learning and prototyping

### Risk 2: Performance Overhead
**Impact:** Medium  
**Probability:** Medium  
**Mitigation:**
- Profile agent execution times
- Cache repeated operations
- Limit max iterations to 5 by default
- Use parallel execution for independent tasks

### Risk 3: Integration Complexity
**Impact:** High  
**Probability:** Low  
**Mitigation:**
- Maintain backward compatibility with existing AgentLoop
- Gradual migration: run both systems in parallel initially
- Comprehensive integration tests

### Risk 4: Error Pattern Coverage
**Impact:** Medium  
**Probability:** High  
**Mitigation:**
- Start with 10 most common error patterns
- Add patterns incrementally based on user feedback
- Provide fallback to HITL for unknown errors

## Correctness Properties

### Property 1: Task Completion Guarantee
**Property:** Every task either completes successfully or fails after max iterations  
**Test:** Run 100 random tasks, verify none hang indefinitely

### Property 2: State Consistency
**Property:** Agent state remains consistent across iterations  
**Test:** Inject state corruption, verify system detects and recovers

### Property 3: Error Recovery Idempotence
**Property:** Applying same fix twice produces same result  
**Test:** Run error recovery twice on same error, verify identical outcomes

### Property 4: Parallel Execution Safety
**Property:** Parallel tasks don't interfere with each other  
**Test:** Run 3 parallel tasks modifying different files, verify no conflicts

### Property 5: Iteration Bound
**Property:** No workflow exceeds max iterations  
**Test:** Create infinite loop scenario, verify system stops at max iterations

## Glossary

- **Agent:** Autonomous entity that performs specific tasks (Planner, Executor, Critic)
- **Orchestration:** Coordination of multiple agents to accomplish complex goals
- **LangGraph:** Open-source framework for building stateful multi-agent workflows
- **Critic Agent:** Agent that validates work and provides feedback (also called Evaluator)
- **Error Recovery:** Automatic detection, analysis, and fixing of errors
- **Task Plan:** Structured breakdown of user request into executable tasks
- **Iteration:** One cycle of Executor → Critic → Feedback → Executor
- **HITL:** Human-in-the-loop (user intervention when system is stuck)
- **Checkpointing:** Saving agent state to resume later
- **State Machine:** Graph of nodes (agents) and edges (transitions)
