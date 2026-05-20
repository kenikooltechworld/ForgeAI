import * as fs from 'fs';
import * as path from 'path';

export interface SpecConfig {
  id: string;
  title: string;
  workflow: 'requirements-first' | 'design-first' | 'quick-plan' | 'bugfix';
  status: 'draft' | 'requirements' | 'design' | 'tasks' | 'complete';
  currentPhase: 'requirements' | 'design' | 'tasks' | null;
  phasesCompleted: Array<'requirements' | 'design' | 'tasks' | 'bugfix'>;
  /** Phase that has been generated but not yet approved by the user */
  pendingApproval: 'requirements' | 'design' | 'tasks' | 'bugfix' | null;
  createdAt: number;
  updatedAt: number;
  llmModel: string;
}

export interface SpecArtifact {
  requirements: string;
  'requirements-analysis': string;
  design: string;
  tasks: string;
  bugfix: string;
}

export interface Spec {
  config: SpecConfig;
  artifacts: SpecArtifact;
}

/**
 * Manages .forgeai/specs/<name>/ as real markdown files.
 * Kiro-style: specs are files you edit in the native VS Code editor.
 *
 * Directory structure per spec:
 *   .forgeai/specs/<name>/
 *     config.forgeai    — YAML metadata
 *     requirements.md   — Generated, human-edited
 *     design.md         — Generated from approved requirements
 *     tasks.md          — Generated from approved requirements + design
 */
export class SpecManager {
  private specsDir: string;
  private hookManager?: {
    onSpecChange(id: string, phase: 'requirements' | 'design' | 'tasks'): void;
  };

  constructor(workspaceRoot: string) {
    this.specsDir = path.join(workspaceRoot, '.forgeai', 'specs');
    this.ensureDir();
  }

  setHookManager(hookManager: {
    onSpecChange(id: string, phase: 'requirements' | 'design' | 'tasks'): void;
  }): void {
    this.hookManager = hookManager;
  }

  /** Public accessor for the specs directory path */
  getSpecsDir(): string {
    return this.specsDir;
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.specsDir)) {
      fs.mkdirSync(this.specsDir, { recursive: true });
    }
  }

  private specDir(id: string): string {
    return path.join(this.specsDir, id);
  }

  private configPath(id: string): string {
    return path.join(this.specDir(id), 'config.forgeai');
  }

  /** List all specs sorted by creation time */
  listSpecs(): SpecConfig[] {
    if (!fs.existsSync(this.specsDir)) return [];
    return fs
      .readdirSync(this.specsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => this.loadConfig(e.name))
      .filter((c): c is SpecConfig => c !== null)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /** Load full spec (config + artifact file paths) */
  loadSpec(id: string): Spec | null {
    const config = this.loadConfig(id);
    if (!config) return null;
    return {
      config,
      artifacts: this.loadArtifacts(id),
    };
  }

  private loadConfig(id: string): SpecConfig | null {
    const file = this.configPath(id);
    if (!fs.existsSync(file)) return null;
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      return this.parseConfig(id, raw);
    } catch {
      return null;
    }
  }

  private parseConfig(id: string, raw: string): SpecConfig {
    const lines = raw.split('\n');
    const config: Partial<SpecConfig> = { id };
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const val = line
          .slice(colonIdx + 1)
          .trim()
          .replace(/^"|"$/g, '')
          .replace(/^'|'$/g, '');
        switch (key) {
          case 'title':
            config.title = val;
            break;
          case 'workflow':
            config.workflow = val as SpecConfig['workflow'];
            break;
          case 'status':
            config.status = val as SpecConfig['status'];
            break;
          case 'currentPhase':
            config.currentPhase = val === 'null' ? null : (val as SpecConfig['currentPhase']);
            break;
          case 'phasesCompleted':
            config.phasesCompleted = val
              .split(',')
              .map((s) => s.trim())
              .filter((s): s is 'requirements' | 'design' | 'tasks' =>
                ['requirements', 'design', 'tasks'].includes(s)
              );
            break;
          case 'pendingApproval':
            config.pendingApproval = val === 'null' ? null : (val as SpecConfig['pendingApproval']);
            break;
          case 'createdAt':
            config.createdAt = parseInt(val, 10);
            break;
          case 'updatedAt':
            config.updatedAt = parseInt(val, 10);
            break;
          case 'llmModel':
            config.llmModel = val;
            break;
        }
      }
    }
    return config as SpecConfig;
  }

  private saveConfig(id: string, config: SpecConfig): void {
    const lines = [
      `# Spec Configuration`,
      `id: ${config.id}`,
      `title: ${config.title}`,
      `workflow: ${config.workflow}`,
      `status: ${config.status}`,
      `currentPhase: ${config.currentPhase ?? 'null'}`,
      `phasesCompleted: ${config.phasesCompleted.join(', ')}`,
      `pendingApproval: ${config.pendingApproval ?? 'null'}`,
      `createdAt: ${config.createdAt}`,
      `updatedAt: ${config.updatedAt}`,
      `llmModel: ${config.llmModel}`,
    ];
    fs.writeFileSync(this.configPath(id), lines.join('\n'), 'utf-8');
  }

  private loadArtifacts(id: string): SpecArtifact {
    const dir = this.specDir(id);
    return {
      requirements: this.readFileSafe(path.join(dir, 'requirements.md')),
      'requirements-analysis': this.readFileSafe(path.join(dir, 'requirements-analysis.md')),
      design: this.readFileSafe(path.join(dir, 'design.md')),
      tasks: this.readFileSafe(path.join(dir, 'tasks.md')),
      bugfix: this.readFileSafe(path.join(dir, 'bugfix.md')),
    };
  }

  private readFileSafe(file: string): string {
    if (!fs.existsSync(file)) return '';
    try {
      return fs.readFileSync(file, 'utf-8');
    } catch {
      return '';
    }
  }

  /** Create a new spec directory with Kiro-style scaffolding */
  createSpec(
    id: string,
    title: string,
    workflow: SpecConfig['workflow'] = 'requirements-first',
    llmModel = 'default'
  ): SpecConfig {
    const dir = this.specDir(id);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const now = Date.now();
    const config: SpecConfig = {
      id,
      title,
      workflow,
      status: 'draft',
      currentPhase: null,
      phasesCompleted: [],
      pendingApproval: null,
      createdAt: now,
      updatedAt: now,
      llmModel,
    };

    this.saveConfig(id, config);

    // Write Kiro-style scaffold files with proper structure
    const writeIfMissing = (file: string, content: string) => {
      const f = path.join(dir, file);
      if (!fs.existsSync(f)) {
        fs.writeFileSync(f, content.replace(/\{SPEC_NAME\}/g, title), 'utf-8');
      }
    };

    if (workflow === 'bugfix') {
      writeIfMissing('bugfix.md', this.bugfixTemplate());
    } else {
      writeIfMissing('requirements.md', this.requirementsTemplate());
      writeIfMissing('design.md', this.designTemplate());
      writeIfMissing('tasks.md', this.tasksTemplate());
    }

    return config;
  }

  /** Write artifact content to the markdown file directly */
  writeArtifact(id: string, type: keyof SpecArtifact, content: string): void {
    const file = path.join(this.specDir(id), `${type}.md`);
    fs.writeFileSync(file, content, 'utf-8');
    this.touchConfig(id);
    if (type === 'requirements' || type === 'design' || type === 'tasks') {
      this.hookManager?.onSpecChange(id, type);
    }
  }

  /** Advance to the next phase after human approval */
  approvePhase(id: string, phase: 'requirements' | 'design' | 'tasks'): boolean {
    const config = this.loadConfig(id);
    if (!config) return false;

    if (!config.phasesCompleted.includes(phase)) {
      config.phasesCompleted.push(phase);
    }

    // Clear the pending approval now that it's approved
    config.pendingApproval = null;

    // Determine next phase
    const order: Array<'requirements' | 'design' | 'tasks'> = ['requirements', 'design', 'tasks'];
    const idx = order.indexOf(phase);
    config.currentPhase = idx < order.length - 1 ? order[idx + 1] : null;
    config.status = config.currentPhase ?? 'complete';
    config.updatedAt = Date.now();

    this.saveConfig(id, config);
    return true;
  }

  /** Mark a phase as generated but pending human approval */
  setPendingApproval(id: string, phase: 'requirements' | 'design' | 'tasks' | 'bugfix'): boolean {
    const config = this.loadConfig(id);
    if (!config) return false;
    config.pendingApproval = phase;
    config.updatedAt = Date.now();
    this.saveConfig(id, config);
    return true;
  }

  /** Regenerate downstream phases when upstream changes */
  invalidateDownstream(id: string, fromPhase: 'requirements' | 'design'): void {
    const config = this.loadConfig(id);
    if (!config) return;

    if (config.workflow === 'bugfix') {
      config.phasesCompleted = [];
      config.status = 'draft';
      config.currentPhase = null;
      config.pendingApproval = null;
      config.updatedAt = Date.now();
      this.saveConfig(id, config);
      return;
    }

    const order: Array<'requirements' | 'design' | 'tasks'> = ['requirements', 'design', 'tasks'];
    const fromIdx = order.indexOf(fromPhase);
    config.phasesCompleted = config.phasesCompleted.filter(
      (p) => order.indexOf(p as 'requirements' | 'design' | 'tasks') <= fromIdx
    );
    config.status = fromPhase;
    config.currentPhase = fromPhase;
    config.pendingApproval = null;
    config.updatedAt = Date.now();
    this.saveConfig(id, config);
  }

  /** Delete a spec */
  deleteSpec(id: string): boolean {
    const dir = this.specDir(id);
    if (!fs.existsSync(dir)) return false;
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }

  /** Generate next spec ID: 001-feature-name */
  nextSpecId(titleHint = 'new-spec'): string {
    const specs = this.listSpecs();
    let maxNum = 0;
    for (const s of specs) {
      const match = s.id.match(/^(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const next = String(maxNum + 1).padStart(3, '0');
    const slug = titleHint
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${next}-${slug || 'new-spec'}`;
  }

  /** Kiro-style requirements.md template */
  public requirementsTemplate(): string {
    return `# Requirements Document: {SPEC_NAME}

## Introduction

{One or two paragraphs describing what this feature/capability is, why it exists, and what problem it solves.}

**Key Constraint:** {The most important constraint — e.g., "The implementation must be free and run locally with zero cloud service costs."}

---

## Glossary

- **Term_One**: Definition of the first key domain term.
- **Term_Two**: Definition of the second key domain term.
- **Term_Three**: Definition of the third key domain term.

---

## Requirements

### Requirement 1: {Requirement Title}

**User Story:** As a {role}, I want {action}, so that {benefit}.

#### Acceptance Criteria

1. WHEN {condition}, THE {system} SHALL {action}
2. THE {system} SHALL {action}
3. IF {condition}, THEN THE {system} SHALL {action}

---

### Requirement 2: {Requirement Title}

**User Story:** As a {role}, I want {action}, so that {benefit}.

#### Acceptance Criteria

1. WHEN {condition}, THE {system} SHALL {action}
2. THE {system} SHALL {action}

---

*Add more numbered requirements following the same pattern.*

---

## Out of Scope

The following items are explicitly out of scope for this feature:

1. **{Out of scope item 1}** — {Why it's excluded}
2. **{Out of scope item 2}** — {Why it's excluded}
3. **{Out of scope item 3}** — {Why it's excluded}

---

## Non-Functional Requirements

### Reliability

- THE {system} SHALL achieve {target}% success rate for {operation}
- THE {system} SHALL recover from {failure} within {time} seconds

### Performance

- THE {system} SHALL respond to {action} within {time} seconds
- THE {system} SHALL support at least {number} {operations} per {time period} without degradation

### Usability

- THE {system} SHALL provide clear error messages understandable by both the AI agent and the user
- THE {system} SHALL require zero configuration to start using basic features

### Maintainability

- THE {system} SHALL follow the existing {project} architecture patterns
- THE {system} SHALL use TypeScript with full type safety

### Cost

- THE {system} SHALL operate at zero monetary cost (no cloud services, all local execution)
`;
  }

  /** Kiro-style design.md template */
  public designTemplate(): string {
    return `# Design Document: {SPEC_NAME}

## Overview

{One paragraph describing the high-level design approach.}

### Purpose

Enable {stakeholders} to:
- {First capability this design enables}
- {Second capability this design enables}
- {Third capability this design enables}

### Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **{Technology Area}** | {Choice} | {Why this choice was made} |
| **{Technology Area}** | {Choice} | {Why this choice was made} |

### Constraints

- **{Constraint name}**: {Description}
- **{Constraint name}**: {Description}

---

## Architecture

### High-Level Architecture

{ASCII or Mermaid diagram showing system components and relationships.}

### Component Diagram

\`\`\`mermaid
graph TB
    A[Component A] --> B[Component B]
\`\`\`

### {Flow Name} Flow

\`\`\`mermaid
sequenceDiagram
    User->>Agent: "{User request}"
    Agent-->>User: "{Result}"
\`\`\`

---

## Components and Interfaces

### Core Components

#### 1. {Component Name}

{Description of what this component does.}

\`\`\`typescript
export class {ComponentName} {
  // Full interface with JSDoc
}
\`\`\`

---

## Data Model

### {Entity Name} Schema

- \`{fieldName}\`: \`{Type}\` — {Description}

---

## API Design

### {Endpoint/Tool Name}

- **Purpose**: {What this does}
- **Input**: {Schema}
- **Output**: {Schema}

---

## Error Handling

### {Error Category}

- \`{ErrorType}\`: {When it occurs and how to handle it}

---

## Security Model

### Security Architecture

- **Layer 1: Input Validation**
  - Validate all inputs
  - Block dangerous defaults

- **Layer 2: Context Isolation**
  - Each session isolated
  - No sharing between sessions
  - Clear data on close

- **Layer 3: Credential Protection**
  - Never auto-fill secrets
  - No external transmission

- **Layer 4: Audit Logging**
  - Log all actions
  - Record security events

### Security Rules

1. **No External Transmission**
   - All operations execute locally
   - No data sent to cloud services

2. **Credential Protection**
   - Never auto-fill passwords
   - Clear credential fields from memory after use

3. **Sensitive Site Detection**
   - Detect sensitive sites
   - Prompt for user confirmation

4. **Context Isolation**
   - Each session isolated
   - Clear all data on session close

5. **URL Restrictions**
   - Block file:// URLs by default
   - Validate URL scheme

---

## Performance Optimizations

### Resource Management

1. **Lazy Initialization**
   - Launch on first use
   - Reduces startup time

2. **Context Reuse**
   - Reuse existing contexts
   - Context pool for parallel operations

3. **Idle Cleanup**
   - Close after inactivity
   - Configurable idle timeout

4. **Memory Limits**
   - Limit per instance
   - Warn user if approaching limit

### Optimization Techniques

- Use snapshots instead of full data for AI context
- Parallel operations where possible with \`Promise.all\`
- Caching for repeated operations

---

## Testing Strategy

### Property-Based Tests

- **Property {N}: {Property Name}**
  - **Validates: Requirements {numbers}**
`;
  }

  /** Kiro-style tasks.md template */
  public tasksTemplate(): string {
    return `# Implementation Plan: {SPEC_NAME}

## Overview

This implementation plan covers {description of what is being built}. Tasks are organized into phases with dependencies and verification criteria.

**Estimated Total Duration**: {N} {weeks/days}

---

## Phase 1: {Phase Title} ({Timeframe})

### Task 1.1: {Task Title}
**Priority**: Critical
**Estimate**: {N} {days/hours}
**Dependencies**: None

**Description**: {What this task accomplishes}

**Subtasks**:
- [ ] {Subtask 1}
- [ ] {Subtask 2}
- [ ] {Subtask 3}

**Acceptance Criteria**:
- [ ] {Criterion linking to requirement}
- [ ] {Criterion linking to requirement}

**Verification**:
- [ ] {How to verify this task is complete}
- [ ] {Testing steps}

**Implements**: Requirement {X.Y}, {X.Y}

---

### Task 1.2: {Task Title}
**Priority**: Critical
**Estimate**: {N} {days/hours}
**Dependencies**: Task 1.1

**Description**: {What this task accomplishes}

**Subtasks**:
- [ ] {Subtask 1}
- [ ] {Subtask 2}

**Acceptance Criteria**:
- [ ] {Criterion linking to requirement}

**Verification**:
- [ ] {How to verify}

**Implements**: Requirement {X.Y}

---

## Phase 2: {Phase Title} ({Timeframe})

### Task 2.1: {Task Title}
**Priority**: High
**Estimate**: {N} {days/hours}
**Dependencies**: Task 1.2

**Description**: {What this task accomplishes}

**Subtasks**:
- [ ] {Subtask 1}
- [ ] {Subtask 2}

**Acceptance Criteria**:
- [ ] {Criterion linking to requirement}

**Verification**:
- [ ] {How to verify}

**Implements**: Requirement {X.Y}

---

## Legend

- \`[ ]\` — Task not started
- \`[x]\` — Task completed
- \`_{Requirements: X.Y}_\` — Links to requirements.md
`;
  }

  /** Kiro-style bugfix.md template */
  private bugfixTemplate(): string {
    return `# Bugfix Document: {SPEC_NAME}

## Introduction

{Description of the bug: what is broken, what the impact is, and why it needs to be fixed.}

---

## Bug Analysis

### Current Behavior

{Detailed description of what happens now — the incorrect/buggy behavior.}

### Expected Behavior

{Detailed description of what should happen instead.}

### Unchanged Behavior

{Explicitly state what should NOT change.}

---

## Root Cause

{Analysis of why the bug occurs.}

---

## Fix Strategy

### Approach

{High-level approach to fixing the bug.}

### Files to Modify

- \`{filepath}\` — {What to change}

### Testing

- {How to verify the fix works}
- {Regression tests to prevent recurrence}

---

## Acceptance Criteria

1. WHEN {condition}, THE {system} SHALL {expected behavior}
2. THE {system} SHALL NOT {old buggy behavior}
3. WHEN {test condition}, THE {fix} SHALL {expected result}
`;
  }

  private touchConfig(id: string): void {
    const config = this.loadConfig(id);
    if (config) {
      config.updatedAt = Date.now();
      this.saveConfig(id, config);
    }
  }
}
