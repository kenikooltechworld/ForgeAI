# ForgeAI Spec-Driven Architecture — Implementation Plan

> Inspired by Kiro (kiro.dev) | Step-by-step build with testing at every phase
> **Rule:** Do NOT proceed to the next phase until the current phase passes all acceptance criteria.

---

## Overview

Rebuild ForgeAI's spec-driven development system to match Kiro's proven patterns, expanded with a full `.forgeai/` workspace:

| Directory           | Purpose                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `.forgeai/memory/`  | AI research findings, user preferences, tech stack docs, learned facts |
| `.forgeai/product/` | Project overview, branding, feature roadmap, purpose                   |
| `.forgeai/spec/`    | Spec-driven development artifacts (Kiro-style three-phase workflow)    |
| `.forgeai/hooks/`   | Event-driven automation triggers                                       |

### Core Principles

- **Memory-first:** AI knowledge is cut off. ResearchAgent does comprehensive research on every user discussion, saves findings to `.forgeai/memory/`, and references them in all future responses.
- **Product-grounded:** Every spec starts from `.forgeai/product/overview.md` so the AI understands what the project is, who it's for, and what the brand is.
- **Kiro-aligned specs:** Three-phase workflow (Requirements → Design → Tasks), approval gates, bugfix specs, quick plan mode.
- **Hooks:** Automate cascading updates (e.g., design.md changes → regenerate tasks.md).
- **Human-in-control:** AI writes to these directories only when explicitly instructed.

---

## Phase 0: Cleanup & Foundation

**Goal:** Remove all remaining broken spec references from the previous implementation.

### Deliverables

- [ ] Audit all files for lingering `spec`-related dead code, imports, or commands
- [ ] Remove orphaned spec UI components (if any still exist)
- [ ] Ensure `CoreIdentity.ts` has a **single, unambiguous** spec rule (not "disabled")
- [ ] Verify extension compiles and runs cleanly

### Acceptance Criteria (AC)

- [ ] `npm run compile` exits with code 0
- [ ] `npm run test` passes (or at least no spec-related failures)
- [ ] No `spec` imports in `extension.ts`, `WebviewManager.ts`, or `ToolRegistry.ts` unless part of the NEW system
- [ ] The AI prompt clearly states: "Spec system is being rebuilt. Do not reference old spec commands."

### Test Command

```bash
npm run compile && npm run test
```

---

## Phase 1: Spec Infrastructure (Core Model & Persistence)

**Goal:** Create the Spec data model, file-based storage, and CLI commands.

### Deliverables

- [ ] `src/extension/specs/Spec.ts` — Core interface/type for a Spec
- [ ] `src/extension/specs/SpecStore.ts` — File-based CRUD (create, read, update, list, delete)
- [ ] `src/extension/specs/SpecDirectoryManager.ts` — Handles `.forgeai/specs/NNN-name/` folder creation
- [ ] `.forgeai/specs/README.md` — Explains the spec directory to users

### Spec Model (Kiro-Aligned)

```typescript
interface Spec {
  id: string; // e.g., "001-auth-system"
  type: 'feature' | 'bugfix';
  title: string;
  description: string;
  status: 'draft' | 'requirements' | 'design' | 'tasks' | 'in-progress' | 'done';
  currentPhase: 'requirements' | 'design' | 'tasks' | 'execution';
  phases: {
    requirements?: { content: string; approved: boolean; approvedAt?: string };
    design?: { content: string; approved: boolean; approvedAt?: string };
    tasks?: { content: string; approved: boolean; approvedAt?: string };
  };
  createdAt: string;
  updatedAt: string;
}
```

### File Structure per Spec

```
.forgeai/specs/
├── 001-auth-system/
│   ├── requirements.md      (or bugfix.md)
│   ├── design.md
│   ├── tasks.md
│   └── meta.json          (Spec JSON state — AC linkages, status, timestamps)
├── 002-fix-login-redirect/
│   ├── bugfix.md
│   ├── design.md
│   ├── tasks.md
│   └── meta.json
└── README.md
```

### VS Code Commands (registered in `package.json`)

- `forgeai.generateSpec` — Start creating a new spec (opens input box)
- `forgeai.openSpec` — Open a spec by ID (quick pick)
- `forgeai.deleteSpec` — Delete a spec folder
- `forgeai.listSpecs` — Show all specs in output channel

### Acceptance Criteria (AC)

- [ ] Running `forgeai.generateSpec` creates a folder `.forgeai/specs/NNN-title/` with empty `meta.json`
- [ ] `SpecStore.list()` returns all specs sorted by creation date
- [ ] `SpecStore.save(spec)` writes `meta.json` and all `.md` files
- [ ] `SpecStore.load(id)` reads a spec from disk
- [ ] Deleting a spec removes the entire folder
- [ ] `npm run compile` passes

### Test Command

```bash
npm run compile
# Then in VS Code: Ctrl+Shift+P → "ForgeAI: Generate Spec" → test create, open, delete
```

---

## Phase 2: Three-Phase Workflow Engine (LLM Prompts)

**Goal:** Build the AI prompts that generate requirements.md, design.md, and tasks.md.

### Deliverables

- [ ] `src/extension/specs/phases/RequirementsPhase.ts` — Prompt builder for requirements generation
- [ ] `src/extension/specs/phases/DesignPhase.ts` — Prompt builder for design generation
- [ ] `src/extension/specs/phases/TasksPhase.ts` — Prompt builder for task decomposition
- [ ] `src/extension/specs/phases/PhaseApprover.ts` — Manages approval gates (human-in-the-loop)
- [ ] `src/extension/specs/SpecGenerator.ts` — Orchestrates the three-phase pipeline

### Prompt Design (Kiro-Style)

**Requirements Phase Prompt:**

```
You are a technical product manager. Given the user's request, generate a
requirements.md file with:
- Feature title and user story
- Acceptance criteria in EARS notation (Given/When/Then)
- Edge cases and error scenarios
- Out-of-scope items
- Non-functional requirements (performance, security)
```

**Design Phase Prompt:**

```
You are a software architect. Given the requirements.md below, generate a
design.md with:
- System architecture overview
- Data models / schemas
- API endpoints (if applicable)
- Sequence diagrams (text-based)
- Error handling strategy
- Testing strategy
```

**Tasks Phase Prompt:**

```
You are a senior engineer. Given the design.md below, generate a tasks.md with:
- Discrete, checkboxed tasks
- Each task linked to acceptance criteria numbers
- File paths where changes will be made
- Dependencies between tasks (which must run before others)
- Estimated complexity (low/medium/high)
```

### Approval Gate Workflow

1. AI generates phase content → saves to `.md` file
2. Webview shows generated content with **"Approve & Continue"** and **"Edit & Regenerate"** buttons
3. If approved → advance to next phase
4. If edited → user modifies `.md` directly → AI regenerates downstream phases

### Acceptance Criteria (AC)

- [ ] `SpecGenerator.generateRequirements(specId, userPrompt)` produces a valid `requirements.md`
- [ ] `SpecGenerator.generateDesign(specId)` reads `requirements.md` and produces `design.md`
- [ ] `SpecGenerator.generateTasks(specId)` reads `design.md` and produces `tasks.md`
- [ ] Each phase waits for explicit human approval before proceeding
- [ ] If user edits `requirements.md`, `design.md` and `tasks.md` are marked stale and regenerated on request
- [ ] `npm run compile` passes

### Test Command

```bash
npm run compile
# In VS Code: "ForgeAI: Generate Spec" → "Build auth system" → verify each phase generates correct .md
```

---

## Phase 3: Webview Spec Panel (UI Shell)

**Goal:** Create the webview panel for viewing and managing specs.

### Deliverables

- [ ] `src/webview/components/SpecPanel/SpecList.tsx` — List all specs with status badges
- [ ] `src/webview/components/SpecPanel/SpecDetail.tsx` — Three-tab view (Requirements, Design, Tasks)
- [ ] `src/webview/components/SpecPanel/PhaseNavigator.tsx` — Shows current phase, approval buttons
- [ ] `src/webview/components/SpecPanel/TaskTracker.tsx` — Renders tasks.md with checkboxes and status
- [ ] `src/extension/specs/SpecPanelProvider.ts` — Webview panel provider

### UI Design (Kiro-Style)

**Spec List:**

- Sidebar list: `001-auth-system` [badge: requirements]
- Status badges: draft | requirements | design | tasks | in-progress | done
- Quick actions: Open, Delete, Continue (if paused at approval gate)

**Spec Detail (Three Tabs):**

- Tab 1: **Requirements** — Markdown renderer + "Approve" button (if not approved)
- Tab 2: **Design** — Markdown renderer + "Approve" button (if requirements approved but design not)
- Tab 3: **Tasks** — Checkbox list + "Run All Tasks" button (if all phases approved)

**Phase Navigator:**

```
[Requirements] → [Design] → [Tasks] → [Execution]
   ✓ Approved     →   ✓ Approved     →   ⏳ Pending approval
```

### Acceptance Criteria (AC)

- [ ] Spec list renders with correct status badges
- [ ] Clicking a spec opens the detail view with three tabs
- [ ] Each tab renders the corresponding `.md` file content
- [ ] Approval buttons only appear when phase is pending approval
- [ ] "Continue" button advances to next phase after approval
- [ ] `npm run compile:webview` builds without errors

### Test Command

```bash
npm run compile:webview
# In VS Code: "ForgeAI: Open Spec Panel" → verify UI renders correctly
```

---

## Phase 4: Task Execution Engine

**Goal:** Execute tasks from `tasks.md` sequentially, track status, and report progress.

### Deliverables

- [ ] `src/extension/specs/TaskExecutor.ts` — Reads tasks.md, executes tasks one by one
- [ ] `src/extension/specs/TaskParser.ts` — Parses checkboxed tasks.md into structured tasks
- [ ] `src/extension/specs/SpecRunner.ts` — Manages the execution lifecycle

### Task Model (Kiro-Style)

```typescript
interface Task {
  id: number;
  description: string;
  acceptanceCriteriaLink: number; // Which AC this task satisfies
  dependencies: number[]; // Task IDs that must complete first
  status: 'pending' | 'in-progress' | 'done' | 'failed';
  filePaths?: string[]; // Files this task will modify
  complexity: 'low' | 'medium' | 'high';
}
```

### Execution Rules (Kiro-Inspired)

1. **Sequential first** — Run tasks in order (parallel is Phase 7)
2. **AC linkage** — Each task maps to acceptance criteria; verify after completion
3. **Status updates** — Real-time updates to `meta.json` and webview
4. **Failure handling** — Stop on failure, report error, allow retry or skip
5. **Agent context** — Each task receives the full spec context (requirements + design)

### Task Execution Prompt

```
You are implementing a task from a spec. Here is the full context:
- Requirements: [content of requirements.md]
- Design: [content of design.md]
- Current Task: [task description]
- Files to modify: [file paths from design.md]

Implement this task completely. Write production-ready code with tests.
```

### Acceptance Criteria (AC)

- [ ] `TaskExecutor.run(specId)` reads `tasks.md` and starts executing
- [ ] After each task, `meta.json` is updated with new status
- [ ] Webview shows real-time progress (checkboxes animate as tasks complete)
- [ ] Failed tasks show error message and "Retry" button
- [ ] Completed tasks write their output (code changes) to disk
- [ ] `npm run compile` passes

### Test Command

```bash
npm run compile
# Create a spec → generate all phases → "Run All Tasks" → verify files are modified
```

---

## Phase 5: Quick Plan Mode

**Goal:** For well-understood features, skip approval gates and generate all three phases in one pass.

### Deliverables

- [ ] `src/extension/specs/QuickPlan.ts` — Single-pass generator
- [ ] UI toggle: "Use Quick Plan" (default: off)
- [ ] Upfront clarifying questions (Kiro-style: scope, constraints, edge cases, implementation forks)

### Quick Plan Flow

1. User: "Generate spec for auth system"
2. AI asks 3-5 clarifying questions (scope, framework, constraints)
3. User answers
4. AI generates `requirements.md` + `design.md` + `tasks.md` in one LLM call
5. All three saved to disk
6. User lands on Tasks tab, ready to run

### Acceptance Criteria (AC)

- [ ] Quick Plan generates all three `.md` files in < 30 seconds
- [ ] Generated files are valid and follow Kiro format
- [ ] User can still edit any file and regenerate downstream
- [ ] `npm run compile` passes

### Test Command

```bash
npm run compile
# "ForgeAI: Generate Spec" → enable Quick Plan → verify all three files generate at once
```

---

## Phase 6: Hooks System (Event-Driven Automation)

**Goal:** Automate routine tasks when files or specs change.

### Deliverables

- [ ] `src/extension/specs/hooks/HookRegistry.ts` — Register and manage hooks
- [ ] `src/extension/specs/hooks/HookRunner.ts` — Execute hooks on triggers
- [ ] `src/extension/specs/hooks/FileWatcher.ts` — Watches for file events
- [ ] `.forgeai/hooks/` directory for user-defined hooks

### Hook Triggers (Kiro-Aligned)

- `onSpecChange` — When any `.md` in a spec folder is edited
- `onTaskComplete` — After a task finishes
- `onFileSave` — When any project file is saved (optional)

### Common Hook Patterns

- **Cascading specs:** When `design.md` changes → regenerate `tasks.md`
- **Test runner:** After task execution → run relevant tests
- **Doc sync:** After spec approval → update `README.md` or `CHANGELOG.md`

### Hook Format (YAML-inspired, JSON for simplicity)

```json
{
  "name": "regenerate-tasks",
  "trigger": "onSpecChange",
  "filePattern": "**/design.md",
  "action": "agent",
  "prompt": "The design.md changed. Regenerate tasks.md based on the new design."
}
```

### Acceptance Criteria (AC)

- [ ] Editing `design.md` auto-triggers `tasks.md` regeneration (with user confirmation)
- [ ] Hook definitions are stored in `.forgeai/hooks/` and versioned
- [ ] Hooks can be enabled/disabled per spec
- [ ] `npm run compile` passes

### Test Command

```bash
npm run compile
# Edit design.md → verify hook triggers → verify tasks.md updates
```

---

## Phase 7: Advanced Features

**Goal:** Match Kiro's most advanced capabilities.

### Deliverables

- [ ] **Parallel Task Execution** — Dependency graph analysis, isolated contexts, file-conflict detection
- [ ] **Requirements Analysis** — Ambiguity detection using multi-sample LLM prompts
- [ ] **Spec Types** — Bugfix specs (bugfix.md instead of requirements.md)
- [ ] **Model Routing** — Use different Ollama models for spec authoring vs. code generation

### Parallel Execution (Kiro-Style)

- Build dependency graph from task list
- Tasks touching same files → sequential
- Independent tasks → parallel
- Tests run after code they validate

### Requirements Analysis

- After generating requirements, offer "Analyze Requirements"
- AI samples multiple interpretations of each requirement
- Surfaces ambiguities as two-option questions
- Uses consistency checks (no contradictions)

### Acceptance Criteria (AC)

- [ ] Parallel execution reduces large-spec time by ~50%
- [ ] Requirements analysis catches at least one ambiguity in test specs
- [ ] Bugfix specs use `bugfix.md` format (current/expected/unchanged behavior)
- [ ] `npm run compile` passes

---

## AI Prompt Rules (Critical)

The system prompt (`CoreIdentity.ts`) must have **ONE unambiguous rule**:

```
### Rule X: Spec-Driven Development

ForgeAI has a spec-driven development system for structured feature planning.

**When to use it:**
- User asks for a complex feature (> 500 lines estimated)
- User explicitly says "create a spec" or "plan this feature"
- User wants structured, trackable implementation

**When NOT to use it:**
- Quick one-off questions
- Simple fixes (< 50 lines)
- Bug fixes (use bugfix spec only if user asks for formal tracking)

**How to use it:**
1. Call forgeai_generateSpec(title, description)
2. Guide user through Requirements → Design → Tasks phases
3. Wait for human approval at each phase
4. Execute tasks sequentially (or parallel if enabled)

**Do NOT:**
- Generate specs without user request
- Skip approval gates unless Quick Plan is explicitly enabled
- Confuse specs with simple research tasks
```

---

## Testing Strategy

**After EVERY phase:**

1. `npm run compile` must pass
2. `npm run test` must pass (or add tests for new code)
3. Manual test in VS Code: verify the feature works end-to-end
4. **ONLY then** proceed to next phase

**Regression Tests:**

- Create a test spec in each phase and verify it works
- Run the same spec through full pipeline after each phase update
- Ensure deleting a spec cleans up all files

---

## Files to Create (Summary)

### Extension Side

```
src/extension/specs/
├── Spec.ts
├── SpecStore.ts
├── SpecDirectoryManager.ts
├── SpecGenerator.ts
├── SpecRunner.ts
├── phases/
│   ├── RequirementsPhase.ts
│   ├── DesignPhase.ts
│   ├── TasksPhase.ts
│   └── PhaseApprover.ts
├── TaskExecutor.ts
├── TaskParser.ts
├── QuickPlan.ts
└── hooks/
    ├── HookRegistry.ts
    ├── HookRunner.ts
    └── FileWatcher.ts
```

### Webview Side

```
src/webview/components/SpecPanel/
├── SpecList.tsx
├── SpecDetail.tsx
├── PhaseNavigator.tsx
└── TaskTracker.tsx
```

### Commands (package.json)

- `forgeai.generateSpec`
- `forgeai.openSpec`
- `forgeai.deleteSpec`
- `forgeai.listSpecs`

---

## Phase Timeline (Suggested)

| Phase | Name            | Est. Time | Depends On |
| ----- | --------------- | --------- | ---------- |
| 0     | Cleanup         | 30 min    | —          |
| 1     | Infrastructure  | 2-3 hrs   | Phase 0    |
| 2     | Workflow Engine | 3-4 hrs   | Phase 1    |
| 3     | Webview Panel   | 3-4 hrs   | Phase 1    |
| 4     | Task Execution  | 3-4 hrs   | Phase 2    |
| 5     | Quick Plan      | 2 hrs     | Phase 2    |
| 6     | Hooks           | 2-3 hrs   | Phase 4    |
| 7     | Advanced        | 4-6 hrs   | Phase 6    |

**Total: ~20-26 hours** (can be split across sessions)

---

## Risk Mitigation

| Risk                          | Mitigation                                              |
| ----------------------------- | ------------------------------------------------------- |
| LLM generates garbage specs   | Approval gates at every phase + user can edit           |
| Spec files get corrupted      | `meta.json` as source of truth, `.md` as human-readable |
| Webview bundle gets too large | Lazy-load spec panel, code-splitting                    |
| AI still confused about specs | Single, explicit rule in `CoreIdentity.ts`              |
| Half-removed old code         | Phase 0: exhaustive cleanup before building             |

---

_Plan version: 1.0_
_Based on: Kiro Spec-Driven Architecture (kiro.dev/docs/specs/) as of May 2026_
