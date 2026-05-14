# Chief Engineer Spec Flow — Implementation Plan

> Transform spec generation from a batch pipeline into a conversational, research-driven chief engineer workflow.

---

## Philosophy

The AI behaves like a staff engineer who refuses to write code until they:

1. Truly understand the problem (Discovery)
2. Have researched current best practices (Research)
3. Presented options with trade-offs (Options)
4. Gotten explicit user lock-in (Spec Generation)

**Constraint enforcement is soft, not hard.** The AI suggests, explains consequences, and lets the user decide.

---

## Phase 1: Conversational Discovery

### Goal

Replace the one-shot ClarifierAgent with a stateful multi-turn conversation.

### Implementation

- Create `DiscoveryAgent` (`src/extension/agents/DiscoveryAgent.ts`)
  - Manages `DiscoverySession` state
  - Reads AGENTS.md / tech.md to ask context-aware questions
  - Accumulates constraints, preferences, ambiguities
- Modify `WebviewManager.handleSendMessage`
  - New mode: `discoveryMode` per conversation
  - When `generate_spec` detected, start Discovery instead of pipeline
  - Route user replies back to DiscoveryAgent until user signals "proceed"
- UI changes:
  - Add `discoveryInProgress` indicator to chat
  - Add "✅ Looks good, proceed" button in chat
  - Discovery questions render as AI chat bubbles (no modal!)
- Persistence:
  - Auto-save every message to `.forgeai/discovery/{sessionId}.json`

### Acceptance Criteria

- [ ] User can have a 10+ turn conversation before spec generation
- [ ] AI respects user constraints (e.g., "no modals") in follow-up questions
- [ ] Session survives webview reload

---

## Phase 2: ResearchAgent (RAG-First, Web-Second)

### Goal

Prevent the AI from generating outdated code by forcing research before proposing solutions.

### Implementation

- Create `ResearchAgent` (`src/extension/agents/ResearchAgent.ts`)
  - Tier 1: Query `RagService` across all collections
  - Tier 2: Fall back to browser tool if RAG similarity < 0.7
  - Generates `ResearchReport` with findings + source attribution
- Create `ResearchCache` (`src/extension/agents/research/ResearchCache.ts`)
  - Stores research results in `.forgeai/research/`
  - Keyed by query hash, TTL = 30 days
  - On hit: returns cached result with staleness warning
- Create `ResearchLearningStore` (`src/extension/agents/research/ResearchLearningStore.ts`)
  - Learns from user corrections: "Actually, use NextAuth v5, not v4"
  - Stores corrections with the original research context
  - Future queries for similar topics surface the correction first

### Acceptance Criteria

- [ ] RAG queried before any LLM generates code recommendations
- [ ] Web research only triggers when RAG is insufficient
- [ ] Research results persisted to `.forgeai/research/`
- [ ] User corrections update the learning store

---

## Phase 3: Options Presentation

### Goal

Present 2-3 researched options as interactive cards, letting the user choose or customize.

### Implementation

- Create `OptionsPresenter` (`src/extension/agents/OptionsPresenter.ts`)
  - Consumes ResearchReport + DiscoverySession
  - Generates 2-3 architectural options with pros/cons
  - Each option references real implementations (e.g., "GitHub-style")
- UI changes:
  - New component: `OptionCard` (vertical stack layout)
  - Each card: title, description, pros, cons, select button
  - "Customize" button opens inline text input
  - "Research more" loops back to Phase 2
- Backend:
  - New message types: `presentOptions`, `selectOption`, `customizeOption`
  - `selectOption` triggers Phase 4

### Acceptance Criteria

- [ ] User sees 2-3 options with clear pros/cons
- [ ] User can customize any option
- [ ] User can request more research

---

## Phase 4: Enhanced Spec Generation

### Goal

Run the existing SpecGeneratorOrchestrator with enriched context from Phases 1-3.

### Implementation

- Modify `SpecGeneratorOrchestrator.run()` signature
  - Accept `DiscoverySession`, `ResearchReport`, `SelectedOption`
  - Inject all three into every agent's system prompt
- Each agent prompt now includes:
  - Discovery notes (user constraints, preferences)
  - Research snippets (relevant code patterns from RAG)
  - Selected option (architectural direction)
- Output remains: `clarifications.md` (already done) → `requirements.md` → `plan.md` → `tasks.md`

### Acceptance Criteria

- [ ] Generated spec references actual project code patterns from RAG
- [ ] Generated spec respects all user constraints from Discovery
- [ ] Generated spec follows the selected architectural option

---

## Phase 5: Spec Templates

### Goal

Let users start from pre-built templates instead of zero.

### Implementation

- Create `TemplateRegistry` (`src/extension/agents/templates/TemplateRegistry.ts`)
  - Built-in templates: CRUD, Auth, Dashboard, API, E-commerce
  - Each template: requirements.md skeleton, plan.md skeleton, tasks.md skeleton
  - Templates reference AGENTS.md to respect project constraints
- UI changes:
  - "Start from template" button in welcome screen
  - Template gallery: cards with preview + "Use this" button
  - After selection, user still goes through Discovery (template as starting point)
- DiscoveryAgent modification:
  - When template selected, pre-fill known requirements
  - Ask targeted questions: "Should the CRUD use REST or GraphQL?"

### Acceptance Criteria

- [ ] 5+ built-in templates available
- [ ] Template selection pre-fills discovery session
- [ ] User can still customize everything after template selection

---

## Phase 6: Spec Dry Run

### Goal

Simulate task execution without writing files to predict failures.

### Implementation

- Create `SpecDryRunExecutor` (`src/extension/spec/SpecDryRunExecutor.ts`)
  - Reads tasks.md and simulates each step
  - Checks: file existence, dependency order, tool availability
  - Reports predicted failures: "Task 3 needs src/models/User.ts which doesn't exist"
- UI changes:
  - "Dry Run" button next to "Run Spec" in TaskTracker
  - Results shown as warning list in panel

### Acceptance Criteria

- [ ] Dry run identifies missing dependencies before execution
- [ ] Dry run reports which tasks will fail and why
- [ ] No files written during dry run

---

## Phase 7: Multi-Spec Orchestration

### Goal

Understand dependencies across specs (001-auth must complete before 002-dashboard).

### Implementation

- Create `SpecDependencyGraph` (`src/extension/spec/SpecDependencyGraph.ts`)
  - Scans `.forgeai/specs/` for cross-references
  - Parses `plan.md` for "depends on" or "requires" mentions
  - Builds directed graph of spec dependencies
- Modify `SpecTaskExecutor`
  - Before running tasks, check if dependent specs are complete
  - If incomplete: offer to run dependency spec first
- UI changes:
  - Dependency graph visualization in SpecReview panel
  - Warning badges on tasks blocked by incomplete specs

### Acceptance Criteria

- [ ] AI detects when spec B references artifacts from spec A
- [ ] Executor warns when dependencies are unmet
- [ ] User can view dependency graph across all specs

---

## Phase 8: Spec Diff & Versioning

### Goal

Track changes to requirements and show affected tasks.

### Implementation

- Create `SpecVersionStore` (`src/extension/spec/SpecVersionStore.ts`)
  - Snapshots requirements.md on every save
  - Stores diffs in `.forgeai/specs/{id}/versions/`
- Create `SpecDiffAnalyzer` (`src/extension/spec/SpecDiffAnalyzer.ts`)
  - Compares two versions of requirements.md
  - Identifies which tasks are affected by requirement changes
  - Generates migration plan: "Update Task 2.1, Add Task 2.4"
- UI changes:
  - "History" tab in SpecReview panel
  - Diff view showing requirement changes with affected tasks highlighted

### Acceptance Criteria

- [ ] Every spec save creates a version snapshot
- [ ] Diff view shows which requirements changed
- [ ] Affected tasks are automatically flagged for update

---

## Phase 9: Human-in-the-Loop per Task

### Goal

Before executing each task, ask user for micro-decisions.

### Implementation

- Modify `SpecTaskExecutor`
  - New mode: `interactiveMode`
  - Before each task: pause and ask user via VS Code notification
  - Show task description + options (e.g., "Hook or Zustand?")
- Create `TaskDecisionStore` (`src/extension/spec/TaskDecisionStore.ts`)
  - Records user decisions per task
  - Future runs of same spec reuse decisions
- UI changes:
  - TaskTracker shows "Awaiting decision" status
  - Inline decision form when user clicks pending task

### Acceptance Criteria

- [ ] Executor pauses before each task when interactive mode is on
- [ ] User can make micro-decisions that affect implementation
- [ ] Decisions are saved and reusable across spec re-runs

---

## Phase 10: Spec-to-Test Auto-Gen

### Goal

Generate Jest/Vitest skeletons from EARS acceptance criteria automatically.

### Implementation

- Create `TestGenerator` (`src/extension/spec/TestGenerator.ts`)
  - Parses `requirements.md` EARS criteria
  - Generates test file with `describe/it` blocks matching criteria
  - Reads AGENTS.md to use correct test framework (Jest vs Vitest)
- Trigger: After spec generation completes
  - Auto-generates `tests/` directory next to spec
  - Each requirement gets a test file: `001-auth-requirement-1.1.test.ts`

### Acceptance Criteria

- [ ] Every EARS acceptance criterion generates at least one test case
- [ ] Generated tests use the project's actual test framework
- [ ] Tests are runnable immediately (may fail until implementation exists)

---

## Phase 11: Post-Execution Compliance Analysis

### Goal

After execution, report what was built vs. what was spec'd.

### Implementation

- Create `SpecComplianceAnalyzer` (`src/extension/spec/SpecComplianceAnalyzer.ts`)
  - Compares executed files against `requirements.md` acceptance criteria
  - Checks: file existence, function signatures, behavior matches criteria
  - Reports gaps: "Requirement 2.3 (MFA) not implemented"
- UI: Compliance dashboard in SpecReview panel
  - Green/yellow/red per requirement
  - Click through to see evidence or missing implementation
- Modify `SpecTaskExecutor`
  - After all tasks complete, auto-trigger compliance analysis
  - Results posted to webview as `complianceReport` message

### Acceptance Criteria

- [ ] Post-build report shows compliance percentage per requirement
- [ ] Missing implementations are listed with requirement references
- [ ] Report survives webview reload

---

## Files to Create

| File                                                         | Phase |
| ------------------------------------------------------------ | ----- |
| `src/extension/agents/DiscoveryAgent.ts`                     | 1     |
| `src/extension/agents/DiscoverySession.ts`                   | 1     |
| `src/extension/agents/research/ResearchAgent.ts`             | 2     |
| `src/extension/agents/research/ResearchCache.ts`             | 2     |
| `src/extension/agents/research/ResearchLearningStore.ts`     | 2     |
| `src/extension/agents/OptionsPresenter.ts`                   | 3     |
| `src/extension/agents/templates/TemplateRegistry.ts`         | 5     |
| `src/extension/spec/SpecDryRunExecutor.ts`                   | 6     |
| `src/extension/spec/SpecDependencyGraph.ts`                  | 7     |
| `src/extension/spec/SpecVersionStore.ts`                     | 8     |
| `src/extension/spec/SpecDiffAnalyzer.ts`                     | 8     |
| `src/extension/spec/TaskDecisionStore.ts`                    | 9     |
| `src/extension/spec/TestGenerator.ts`                        | 10    |
| `src/extension/spec/SpecComplianceAnalyzer.ts`               | 11    |
| `src/webview/components/DiscoveryUI/OptionCard.tsx`          | 3     |
| `src/webview/components/DiscoveryUI/DiscoveryProgress.tsx`   | 1     |
| `src/webview/components/DiscoveryUI/TemplateGallery.tsx`     | 5     |
| `src/webview/components/DiscoveryUI/ComplianceDashboard.tsx` | 11    |

---

_Last updated: 2026-05-13_
