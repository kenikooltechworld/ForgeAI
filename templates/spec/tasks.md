# Implementation Plan: {SPEC_NAME}

## Overview

This implementation plan covers {description of what is being built}. Tasks are organized into phases with dependencies and verification criteria.

**Estimated Total Duration**: {N} {weeks/days}

---

## Phase 1: {Phase Title} ({Timeframe})

### Task 1.1: {Task Title}

**Priority**: Critical
**Estimate**: {N} {days/hours}
**Dependencies**: None
**Status**: Pending ← (Pending | In Progress | Completed | Failed)

**Description**: {What this task accomplishes}

**Subtasks**:

- [ ] {Subtask 1}
- [ ] {Subtask 2}
- [ ] {Subtask 3}

**Acceptance Criteria**:

- [ ] {Criterion linking to requirement}
- [ ] {Criterion linking to requirement}

**Verification**:

- [ ] Code compiles without errors
- [ ] All subtasks checked
- [ ] All acceptance criteria met
- [ ] Tests pass (unit/integration/manual)
- [ ] Verification checklist completed

**Implements**: Requirement {X.Y}, {X.Y}

---

### Task 1.2: {Task Title}

**Priority**: Critical
**Estimate**: {N} {days/hours}
**Dependencies**: Task 1.1
**Status**: Locked ← (Pending | In Progress | Completed | Failed)

**Description**: {What this task accomplishes}

**Subtasks**:

- [ ] {Subtask 1}
- [ ] {Subtask 2}

**Acceptance Criteria**:

- [ ] {Criterion linking to requirement}

**Verification**:

- [ ] Code compiles without errors
- [ ] All subtasks checked
- [ ] All acceptance criteria met
- [ ] Tests pass (unit/integration/manual)
- [ ] Verification checklist completed

**Implements**: Requirement {X.Y}

---

## Phase 2: {Phase Title} ({Timeframe})

### Task 2.1: {Task Title}

**Priority**: High
**Estimate**: {N} {days/hours}
**Dependencies**: Task 1.2
**Status**: Locked ← (Pending | In Progress | Completed | Failed)

**Description**: {What this task accomplishes}

**Subtasks**:

- [ ] {Subtask 1}
- [ ] {Subtask 2}

**Acceptance Criteria**:

- [ ] {Criterion linking to requirement}

**Verification**:

- [ ] Code compiles without errors
- [ ] All subtasks checked
- [ ] All acceptance criteria met
- [ ] Tests pass (unit/integration/manual)
- [ ] Verification checklist completed

**Implements**: Requirement {X.Y}

---

### Task 2.2: {Task Title}

**Priority**: Medium
**Estimate**: {N} {days/hours}
**Dependencies**: Task 2.1
**Status**: Locked ← (Pending | In Progress | Completed | Failed)

**Description**: {What this task accomplishes}

**Subtasks**:

- [ ] {Subtask 1}
- [ ] {Subtask 2}

**Acceptance Criteria**:

- [ ] {Criterion linking to requirement}

**Verification**:

- [ ] Code compiles without errors
- [ ] All subtasks checked
- [ ] All acceptance criteria met
- [ ] Tests pass (unit/integration/manual)
- [ ] Verification checklist completed

**Implements**: Requirement {X.Y}

---

## Task Execution Workflow

### Sequential Locking Model

1. **Task 1.1** starts in `Pending` status - ready to execute
2. All subsequent tasks start in `Locked` status - blocked until previous completes
3. When a task begins: change status to `In Progress`
4. When a task is fully verified: change status to `Completed`
5. Locked tasks automatically unlock when their dependencies complete

### Status Definitions

- **Pending** - Task is ready to start (no unmet dependencies)
- **Locked** - Task is blocked by incomplete prerequisite task(s)
- **In Progress** - Task is actively being implemented
- **Completed** - Task has passed all verification and tests
- **Failed** - Task implementation failed, requires retry

### Verification Checklist Template

Before marking a task `Completed`:

- [ ] Code compiles without errors (`npm run compile`)
- [ ] All subtasks checked
- [ ] All acceptance criteria met
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] Manual testing complete
- [ ] Requirements traceability verified

---

## Legend

- `[ ]` — Task not started
- `[x]` — Task completed
- `Pending` — Ready to execute
- `Locked` — Blocked by prerequisite task
- `In Progress` — Currently executing
- `Completed` — Verified and done
- `Failed` — Failed, needs retry
- `_{Requirements: X.Y}_` — Links to requirements.md acceptance criteria
