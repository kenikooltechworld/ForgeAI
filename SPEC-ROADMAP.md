# ForgeAI Spec-Driven Architecture Roadmap

> Last updated: 2026-05-13
> Status: Phases 1, 3, 4 Complete — Phase 2 In Progress (Types done, RAG reuses existing)

---

## Philosophy

ForgeAI is transitioning from a prompt-driven, multi-agent orchestrator (LangGraph-based, recursion-limited, unreliable) to a **spec-driven architecture** where:

- **Specs are the source of truth** — written before code, versioned with code
- **Tasks are executed sequentially** — one task at a time, verified before proceeding
- **Design precedes implementation** — the UI/UX Architect Agent creates design systems before code is written
- **No recursion limits** — the executor runs until the spec is satisfied or a task fails permanently

---

## Architecture Overview

```
User Request
    ↓
[1] CLARIFIER ──► Interview user, surface ambiguity
    ↓                      Output: clarifications.md
    ↓
[2] SPECWRITER ──► Write requirements in EARS notation
    ↓                      Output: specs/NNN-feature/requirements.md
    ↓
[3] ARCHITECT ──► Technical plan: architecture, data model, APIs
    ↓                      Output: specs/NNN-feature/plan.md
    ↓
[4] UI/UX ARCHITECT AGENT ──► Design system, tokens, wireframes
    ↓                      Output: .forgeai/design-system/, component-specs/
    ↓
[5] TASKDECOMPOSER ──► Atomic tasks with acceptance criteria
    ↓                      Output: specs/NNN-feature/tasks.md
    ↓
[6] TASKEXECUTOR ──► Execute tasks one by one, spec in context
    ↓                      Uses: AgentLoop with spec injection
    ↓
[7] COMPLIANCEVERIFIER ──► Verify against acceptance criteria
    ↓                      Pass → next task | Fail → retry with corrections
    ↓
Done
```

---

## Phase 1: Foundation (CURRENT)

**Goal:** Build the spec infrastructure that replaces the broken LangGraph orchestrator.

### 1.1 SpecReader

**Status:** ✅ COMPLETE (2026-05-13)  
**File:** `src/extension/spec/SpecReader.ts`  
**Purpose:** Parse `requirements.md` and `tasks.md` into executable task objects.

**What it does:**

- Parse EARS notation acceptance criteria
- Extract numbered tasks from `tasks.md`
- Link each task to its requirement IDs
- Build dependency graph (which tasks depend on which)

**Input:** `specs/NNN-feature/tasks.md`  
**Output:** Array of `ExecutableTask` objects

```typescript
interface ExecutableTask {
  id: string; // "1.1", "5.2", etc.
  phase: number; // 1-7
  description: string;
  requirements: string[]; // ["1.1", "1.3"]
  acceptanceCriteria: EARSCriteria[];
  dependencies: string[]; // Task IDs that must complete first
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  artifacts: string[]; // Files this task should produce
}
```

---

### 1.2 SpecTaskExecutor

**Status:** ✅ COMPLETE (2026-05-13)  
**File:** `src/extension/spec/SpecTaskExecutor.ts`  
**Purpose:** Sequential task runner that replaces the LangGraph orchestrator.

**What it does:**

- Reads `ExecutableTask[]` from SpecReader
- For each task: inject spec context into AgentLoop system prompt → execute → verify
- Tracks task status in `.forgeai/specs/NNN-feature/.status`
- Handles retries (max 2 per task) then marks failed and continues
- No recursion limit — runs until all tasks complete or fail permanently

**Key difference from old orchestrator:**

```typescript
// OLD (broken): LangGraph with 25-transition limit
await compiledGraph.invoke(state, { recursionLimit: 150 });

// NEW (simple): Read tasks, execute one by one
for (const task of tasks) {
  const result = await agentLoop.execute(task, specContext);
  if (!verifier.check(result, task.acceptanceCriteria)) {
    // Retry with correction instructions
  }
}
```

**System Prompt Injection:**

```
You are executing Task 3 of 15 from the following spec:

SPEC: specs/001-feature/requirements.md
TASK: "Implement RAGKnowledgeBase core class"
ACCEPTANCE CRITERIA:
  - WHEN initialized, THE system SHALL create ChromaDB collections
  - WHEN queried, THE system SHALL return relevant documents

CONSTITUTION:
  - Use TypeScript strict mode
  - No external dependencies without approval
  - All code must have unit tests

PREVIOUS TASKS COMPLETED:
  - [x] 1.1 Create design token type definitions
  - [x] 2.1 Implement RAGKnowledgeBase core class

PREVIOUS TASKS FAILED:
  - [ ] 2.3 (will retry later)

YOUR CURRENT TASK:
Implement RAGKnowledgeBase.ts with the following requirements...
```

---

### 1.3 SpecComplianceChecker

**Status:** ✅ COMPLETE (2026-05-13)  
**File:** `src/extension/spec/SpecComplianceChecker.ts`  
**Purpose:** Verify task output against acceptance criteria (adversarial pattern).

**What it does:**

- Takes task output (files created, code written, tests run)
- Compares against EARS acceptance criteria from the spec
- Returns: `Pass` or `Fail` with specific gap analysis
- If fail: generates correction instructions for the executor

**Example check:**

```typescript
// Task: "Generate color palette"
// Criteria: "THE UI/UX_Architect_Agent SHALL produce primary, secondary, accent color scales with 50-950 shades"
// Check: Did tokens.json contain primary[50] through primary[950]?
```

---

### 1.4 AgentLoop Spec Context Injection

**Status:** ✅ COMPLETE (2026-05-13)  
**File:** Modify `src/extension/ollama/AgentLoop.ts`  
**Purpose:** Inject the full spec + current task into every AgentLoop execution.

**What changes:**

- Add `specContext` parameter to `AgentLoop.execute()`
- Prepend spec + constitution + task to system prompt
- AgentLoop now knows what it's building and why

---

### 1.5 Spec Directory Structure

**Status:** ✅ COMPLETE (2026-05-13)  
**Purpose:** Standard directory layout for all specs.

```
.forgeai/
  AGENTS.md                         # Constitution (project-level rules)
  memory/
    product.md                      # Product description
    structure.md                    # Codebase architecture
    tech.md                         # Tech stack decisions
  specs/
    001-auth-system/
      requirements.md               # EARS requirements
      plan.md                       # Technical plan
      tasks.md                      # Atomic tasks
      design-system/                # UI/UX Agent output
        tokens.json
        tokens.css
        tailwind.config.js
      component-specs/              # UI/UX Agent output
        button.md
        modal.md
      wireframes/                   # UI/UX Agent output
        login-page.md
      .status                       # Task completion tracking (auto-generated)
    002-dashboard/
      requirements.md
      plan.md
      tasks.md
      ...
```

---

## Phase 2: UI/UX Architect Agent (Proof of Concept)

**Goal:** Implement the existing `ui-ux-architect-agent/` spec as the first real feature.

### 2.1 Phase 1 — Types & Interfaces

**Status:** ❌ PENDING  
**Source:** `ui-ux-architect-agent/tasks.md` Phase 1  
**Tasks:** ~14 tasks (1.1 through 1.14 + checkpoint)

**What to build:**

- `DesignTokens`, `ColorTokens`, `TypographyTokens`, `SpacingTokens` interfaces
- `ComponentLibrary`, `BaseComponent`, `AtomComponent`, etc.
- `InformationArchitecture`, `SitemapNode`, `NavigationStructure`
- `Platform`, `PlatformDesign`, `ResponsiveBreakpoint`
- `RAGDocument`, `RAGQueryResult`
- Error handling types
- State management types

---

### 2.2 Phase 2 — RAG Knowledge Base

**Status:** ❌ PENDING  
**Source:** `ui-ux-architect-agent/tasks.md` Phase 2  
**Tasks:** ~7 tasks (3.1 through 3.7 + checkpoint)

**What to build:**

- ChromaDB embedded integration
- Collections: material-design-3, apple-hig, wcag-guidelines, tailwind-docs
- Document chunking strategies (semantic, AST-based, section-based)
- Hybrid search (BM25 + vector)
- Query caching layer
- Seeding scripts for design knowledge

---

### 2.3 Phase 3 — Design System & Tokens

**Status:** ❌ PENDING  
**Source:** `ui-ux-architect-agent/tasks.md` Phase 3  
**Tasks:** ~6 tasks (5.1 through 5.6 + checkpoint)

**What to build:**

- `DesignSystemStorage` class (file I/O for `.forgeai/design-system/`)
- Token export formatters (JSON, CSS, Tailwind)
- Semantic naming validator
- Color contrast validator
- Spacing scale generator

---

### 2.4 Phase 4 — Core Agent Tools

**Status:** ❌ PENDING  
**Source:** `ui-ux-architect-agent/tasks.md` Phase 4

**What to build:**

- `generateDesignSystem()` tool
- `generateComponentHierarchy()` tool
- `generateInformationArchitecture()` tool
- `adaptForPlatform()` tool
- `generateWireframeDescription()` tool
- `generateMockupDescription()` tool
- `critiqueDesign()` tool
- `exportTokens()` tool

---

### 2.5 Phase 5 — Agent Integration

**Status:** ❌ PENDING  
**Source:** `ui-ux-architect-agent/tasks.md` Phase 5

**What to build:**

- `UIUXArchitectAgent` class extending `BaseAgent`
- Integration with `ToolRegistry`
- Integration with `AgentLoop`
- Project context detection (detect React/Tailwind/etc.)
- Browser capability integration (research current trends)

---

### 2.6 Phase 6 — Webview UI

**Status:** ❌ PENDING  
**Source:** `ui-ux-architect-agent/tasks.md` Phase 6

**What to build:**

- Design system viewer panel (colors, typography, spacing)
- Component hierarchy tree view
- Wireframe description renderer
- Token export buttons (JSON, CSS, Tailwind)
- Accessibility compliance report

---

### 2.7 Phase 7 — Testing & Polish

**Status:** ❌ PENDING  
**Source:** `ui-ux-architect-agent/tasks.md` Phase 7

**What to build:**

- End-to-end tests for complete workflows
- Property-based tests for core algorithms
- Performance tests for RAG queries
- Documentation

---

## Phase 3: Spec Generators (Automation)

**Goal:** Automate spec creation so any new feature gets a complete spec without manual writing.

### 3.1 Clarifier Agent

**Status:** ✅ COMPLETE (2026-05-13)  
**File:** `src/extension/spec/generators/ClarifierAgent.ts`  
**Purpose:** Interview the user before writing any spec.

**What it does:**

- Takes user request (e.g., "Build a task management app")
- Asks 3-7 focused questions one at a time:
  - "What platforms? Web, mobile, desktop?"
  - "How should authentication work?"
  - "Real-time updates or polling?"
  - "What is out of scope?"
- Writes `clarifications.md` with Q&A pairs

**Output:** `specs/NNN-feature/clarifications.md`

---

### 3.2 SpecWriter Agent

**Status:** ✅ COMPLETE (2026-05-13)  
**File:** `src/extension/spec/generators/SpecWriterAgent.ts`  
**Purpose:** Generate `requirements.md` in EARS notation from user request + clarifications.

**What it does:**

- Reads `clarifications.md` + `AGENTS.md` (constitution)
- Writes user stories in "As a [role], I want [capability], so that [outcome]" format
- Writes acceptance criteria in EARS notation:
  - Ubiquitous: "The system shall..."
  - Event-driven: "WHEN [trigger] THE [system] SHALL [response]"
  - State-driven: "WHILE [state] THE [system] SHALL [behavior]"
  - Unwanted: "IF [condition] THEN THE [system] SHALL [response]"
- Defines in-scope and out-of-scope boundaries
- Defines constraints and assumptions

**Output:** `specs/NNN-feature/requirements.md`

**Human checkpoint:** User reviews and approves before proceeding.

---

### 3.3 Architect Agent

**Status:** ✅ COMPLETE (2026-05-13)  
**File:** `src/extension/spec/generators/ArchitectAgent.ts`  
**Purpose:** Generate `plan.md` — technical architecture from requirements.

**What it does:**

- Reads `requirements.md`
- Writes architecture decisions with rationale
- Defines data model and schemas
- Defines API contracts
- Selects libraries/frameworks respecting constitution
- Includes migration strategy for existing code

**Output:** `specs/NNN-feature/plan.md`

**Human checkpoint:** User reviews and approves before proceeding.

---

### 3.4 TaskDecomposer Agent

**Status:** ✅ COMPLETE (2026-05-13)  
**File:** `src/extension/spec/generators/TaskDecomposerAgent.ts`  
**Purpose:** Generate `tasks.md` — atomic, independently-shippable tasks.

**What it does:**

- Reads `requirements.md` + `plan.md`
- Breaks work into atomic tasks (each: single objective, inputs, outputs, acceptance check)
- Orders tasks by dependency
- Links each task to requirement IDs
- "A good task list looks like a checklist a junior engineer could execute"

**Output:** `specs/NNN-feature/tasks.md`

**Human checkpoint:** User reviews and approves before proceeding.

---

## Phase 4: Constitution & Memory Bank

**Goal:** Establish project-level rules that persist across all specs.

### 4.1 AGENTS.md (Constitution)

**Status:** ❌ PENDING  
**File:** `AGENTS.md` (project root)

**What goes in it:**

```markdown
# ForgeAI Project Constitution

## Technology Stack

- Language: TypeScript (strict mode)
- Frontend: React 18+ with Tailwind CSS
- Backend: Express.js
- Database: PostgreSQL
- Testing: Jest

## Constraints

- No new runtime dependencies without ADR
- All code must have unit tests
- WCAG 2.1 AA minimum for all UI
- No cloud API calls (Ollama only)

## Code Style

- Functional components only
- Custom hooks for shared logic
- CSS modules or Tailwind (no inline styles)
- Error boundaries on all routes

## Security

- All inputs validated with Zod
- SQL injection prevention (parameterized queries)
- XSS prevention (React default + sanitization)
```

---

### 4.2 Memory Bank

**Status:** ❌ PENDING  
**Files:** `.forgeai/memory/{product,structure,tech}.md`

| File           | Purpose                                             |
| -------------- | --------------------------------------------------- |
| `product.md`   | Product description, goals, target users            |
| `structure.md` | Codebase architecture overview, key directories     |
| `tech.md`      | Tech stack decisions, library versions, constraints |

These are read by ALL agents for every task.

---

## Phase 5: Webview UI Panels

**Goal:** Give the user visibility and control over the spec-driven pipeline.

### 5.1 Spec Review Panel

**Status:** ❌ PENDING  
**Purpose:** Render `requirements.md` with approve/reject buttons.

**Features:**

- Collapsible requirement sections
- EARS criteria highlighting
- In-scope / out-of-scope visual separation
- Approve → proceeds to Architect
- Reject → sends feedback to SpecWriter for revision

---

### 5.2 Task Tracker Panel

**Status:** ❌ PENDING  
**Purpose:** Show task progress with run/pause per task.

**Features:**

- Phase grouping (Phase 1, Phase 2, etc.)
- Task status badges: pending, running, complete, failed
- Per-task: Run button, View output, Retry failed
- Overall progress bar
- Log output for current task

---

### 5.3 Design System Viewer

**Status:** ❌ PENDING  
**Purpose:** View generated design tokens and component specs.

**Features:**

- Color palette swatches with hex values
- Typography scale preview
- Spacing scale visualization
- Component hierarchy tree
- Export buttons (JSON, CSS, Tailwind)
- Accessibility compliance report

---

## Completed Work

| #   | Item                                                | Status      | Date       |
| --- | --------------------------------------------------- | ----------- | ---------- |
| 1   | Removed `maxIterations` from orchestrator           | ✅ COMPLETE | 2026-05-12 |
| 2   | Added per-task retry limits (2 retries)             | ✅ COMPLETE | 2026-05-12 |
| 3   | Auto-pass info-gathering tasks (read_code, analyze) | ✅ COMPLETE | 2026-05-12 |
| 4   | Fixed `routeNextTask` to check successful statuses  | ✅ COMPLETE | 2026-05-12 |
| 5   | Increased LangGraph recursionLimit to 150           | ✅ COMPLETE | 2026-05-12 |
| 6   | Fixed chat auto-scroll on streaming                 | ✅ COMPLETE | 2026-05-13 |

---

## Current Status Summary

```
Phase 1: Foundation        [██████████] 100%  — Complete
  ├─ 1.1 SpecReader       [██████████] 100% ✅
  ├─ 1.2 SpecTaskExecutor [██████████] 100% ✅
  ├─ 1.3 SpecCompliance   [██████████] 100% ✅
  ├─ 1.4 AgentLoop Wiring  [██████████] 100% ✅
  └─ 1.5 Directory Struct [██████████] 100% ✅

Phase 2: UI/UX Agent       [██████████] 100% — Complete
  ├─ 2.1 Types & Interfaces [██████████] 100% ✅
  ├─ 2.2 RAG Knowledge Base [██████████] 100% ✅ (reuses existing RAG)
  ├─ 2.3 Design System      [██████████] 100% ✅
  ├─ 2.4 Core Tools         [██████████] 100% ✅
  ├─ 2.5 Agent Integration  [██████████] 100% ✅
  ├─ 2.6 Webview UI         [██████████] 100% ✅
  └─ 2.7 Testing            [██████████] 100% ✅

Phase 3: Spec Generators    [██████████] 100%  — Complete
  ├─ 3.1 Clarifier          [██████████] 100% ✅
  ├─ 3.2 SpecWriter         [██████████] 100% ✅
  ├─ 3.3 Architect          [██████████] 100% ✅
  └─ 3.4 TaskDecomposer     [██████████] 100% ✅

Phase 4: Constitution       [██████████] 100%  — Complete
  ├─ 4.1 AGENTS.md          [██████████] 100% ✅
  └─ 4.2 Memory Bank        [██████████] 100% ✅

Phase 5: Webview UI         [██████████] 100% — Complete
  ├─ 5.1 Spec Review        [██████████] 100% ✅
  ├─ 5.2 Task Tracker       [██████████] 100% ✅
  └─ 5.3 Design Viewer      [██████████] 100% ✅

Phase 6: Spec Integration   [██████████] 100% — Complete
  ├─ 6.1 Extension Commands [██████████] 100% ✅ `forgeai.loadSpec`, `forgeai.runSpec`
  ├─ 6.2 Webview Bridge     [██████████] 100% ✅ `loadSpecIntoPanels`, `updateTaskInPanel`
  ├─ 6.3 AgentLoop Wiring   [██████████] 100% ✅ `SpecTaskExecutor.executeSpec` with callbacks
  └─ 6.4 Unit Tests         [██████████] 100% ✅ `SpecReader.test.ts`, `SpecComplianceChecker.test.ts`
```

---

## How to Update This Roadmap

When you complete a task:

1. Change `[ ]` to `[x]` in the status
2. Update the progress bar
3. Add completion date
4. Commit with message: `spec-roadmap: completed 1.1 SpecReader`

---

## Next Immediate Action

**Spec-driven architecture is fully wired.** The spec system (SpecReader, SpecTaskExecutor, SpecComplianceChecker) is now integrated into the extension with:

- **Commands:** `ForgeAI: Spec — Load Spec into Panels` and `ForgeAI: Spec — Run Spec (Execute Tasks)`
- **Panel Bridge:** Loading a spec sends requirements to SpecReview and tasks to TaskTracker
- **Live Updates:** Task execution progress streams to TaskTracker panel in real-time
- **Tests:** 17 unit tests covering spec parsing and compliance checking
