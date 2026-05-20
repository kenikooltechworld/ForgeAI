# ForgeAI Implementation Plan
> Kiro-inspired | Build one phase at a time | Test before proceeding

## .forgeai/ Directory Structure

```
.forgeai/
├── memory/          # AI research, user prefs, tech docs, learnings
│   ├── preferences.json
│   ├── tech-stack.json
│   ├── learnings.json
│   └── research/
├── product/         # Project purpose, branding, roadmap
│   ├── overview.md
│   ├── branding.md
│   └── features.md
├── spec/            # Kiro-style specs
│   └── NNN-title/
│       ├── requirements.md (or bugfix.md)
│       ├── design.md
│       ├── tasks.md
│       └── meta.json
└── hooks/           # Event automation
    └── *.json
```

## Phase 0: Cleanup (30 min)
- Remove all broken spec references from old implementation
- Verify `npm run compile` passes
- Update `CoreIdentity.ts` to remove "spec disabled" rule (will add new rule later)

## Phase 1: Infrastructure (2-3 hrs)
- Create `.forgeai/{memory,product,spec,hooks}/` with READMEs
- Build `ForgeAIWorkspace.ts` — manages all directories
- Build `DirectoryManager.ts` — creates/validates structure
- Add command: `forgeai.initWorkspace`

## Phase 2: Memory System (3-4 hrs)
- ResearchAgent auto-researches before every spec AND during normal chat
- Saves findings to `.forgeai/memory/research/`
- Stores user preferences in `preferences.json`
- Caches tech stack docs in `tech-stack.json`
- AI references memory in all future responses
- Build `MemoryStore.ts`, `ResearchCache.ts`

## Phase 3: Product System (2-3 hrs)
- AI generates `overview.md` from codebase analysis
- User edits `branding.md` with colors, tone, logo
- `features.md` tracks roadmap
- Every spec reads `product/` before generation
- Build `ProductContext.ts`, `ProductGenerator.ts`

## Phase 4: Spec System (Kiro-Style) (4-5 hrs)
- ResearchAgent pre-researches codebase before spec generation
- Three-phase workflow: Requirements → Design → Tasks
- Approval gates at each phase
- Bugfix specs (bugfix.md instead of requirements.md)
- Quick Plan mode for well-understood features
- Build `Spec.ts`, `SpecStore.ts`, `SpecGenerator.ts`, `TaskExecutor.ts`

## Phase 5: Hooks System (2-3 hrs)
- File watchers on `.forgeai/spec/*/design.md`
- Auto-regenerate tasks.md when design changes
- Test runner after task completion
- Build `HookRegistry.ts`, `HookRunner.ts`, `FileWatcher.ts`

## Phase 6: Webview Panel (3-4 hrs)
- Spec list with status badges
- Three-tab detail view (Requirements, Design, Tasks)
- Phase navigator with approve/continue buttons
- Memory viewer (research findings)
- Product doc viewer
- Build `SpecPanel.tsx`, `SpecList.tsx`, `SpecDetail.tsx`

## ResearchAgent Integration
- Before spec: ResearchAgent scans codebase + RAG + web search
- During chat: If user discusses tech, ResearchAgent searches docs
- All findings saved to `.forgeai/memory/research/`
- AI loads memory at start of every conversation
- Memory is persistent across VS Code sessions

## AI Rules (CoreIdentity.ts)
```
Rule: .forgeai/ Workspace
- AI has access to .forgeai/memory/ (research, prefs, learnings)
- AI has access to .forgeai/product/ (project context)
- AI uses .forgeai/spec/ for structured feature planning (Kiro-style)
- AI uses .forgeai/hooks/ for automation
- ResearchAgent auto-researches and saves findings to memory
- AI never writes to these directories without explicit user instruction
```

## Testing Per Phase
1. `npm run compile` passes
2. `npm run test` passes
3. Manual VS Code test
4. Only then proceed to next phase
