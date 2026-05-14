# ForgeAI Project Constitution

> This file is the single source of truth for project-level rules.
> Every agent task MUST respect these constraints.
> Edit this file to change project-wide behavior.

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x (strict mode) |
| Frontend Framework | React | 18+ |
| Styling | Tailwind CSS | 3.x |
| Backend | Express.js | 4.x |
| Database | PostgreSQL | 15+ |
| Testing | Jest | 29+ |
| VS Code API | vscode | 1.85+ |

## Constraints

### Dependencies
- **No new runtime dependencies without an Architecture Decision Record (ADR)**
- Prefer devDependencies over runtime dependencies when possible
- All dependencies must have active maintenance (last commit < 6 months)

### Code Quality
- **All code must have unit tests** (minimum 70% coverage)
- No `any` types except in spec infrastructure (AgentLoop wiring pending)
- No unused variables or imports
- Functional components only (no class components)

### Security
- All inputs validated with Zod schemas
- SQL injection prevention: parameterized queries only
- XSS prevention: React default escaping + sanitize user content
- No secrets in code (use VS Code SecretStorage)

### Performance
- VS Code extension activation < 500ms
- Webview bundle < 2MB
- Tool calls complete within 30 seconds
- Streaming response latency < 100ms per chunk

## Code Style

### TypeScript
- Strict mode enabled
- Explicit return types on public methods
- Interface over type alias for object shapes
- No implicit returns

### React
- Functional components with hooks
- Custom hooks for shared logic (prefix with `use`)
- Props interfaces named `{ComponentName}Props`
- CSS: Tailwind classes or CSS modules (no inline styles)

### File Organization
```
src/extension/
  agents/       — Agent implementations
  ollama/       — LLM client and prompts
  orchestrator/ — (legacy) LangGraph orchestrator
  spec/         — Spec-driven infrastructure ★ NEW
  tools/        — Tool registry and implementations
  rag/          — RAG knowledge base
  utils/        — Shared utilities
  webview/      — Webview React app
```

## AI Agent Behavior

### Tool Usage
- Read workspace state before assuming file structure
- If a tool fails, try a different tool — do not retry the same failed tool blindly
- Use `list_directory` before `read_file` when exploring unknown codebases
- Verify file exists before writing to it

### Code Generation
- Write complete code with imports, exports, and types
- Never leave disconnected or half-finished code
- Include error handling for all async operations
- Add JSDoc for public APIs

### Design System (when UI/UX Agent active)
- All UI components must use design tokens from `.forgeai/design-system/`
- WCAG 2.1 AA minimum for all user-facing UI
- Support both light and dark modes
- Touch targets: minimum 44x44px

## Out of Scope (What Agents Should NOT Do)

- Do not modify `AGENTS.md` directly (human edits only)
- Do not delete existing tests without replacement
- Do not downgrade dependency versions
- Do not add cloud API dependencies (Ollama only for LLM)
- Do not modify `package.json` without explicit approval

## Spec-Driven Development Rules

- Every feature must have a spec in `.forgeai/specs/NNN-feature/`
- Specs follow: `requirements.md` → `plan.md` → `tasks.md`
- Tasks execute sequentially — one at a time, verified before proceeding
- Acceptance criteria use EARS notation
- Human review at phase boundaries (can be disabled with `--autopilot`)

---

*Last updated: 2026-05-13*
