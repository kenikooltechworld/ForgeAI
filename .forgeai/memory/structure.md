# ForgeAI Codebase Architecture

## Directory Structure

```
ForgeAI/
├── src/
│   ├── extension/           # VS Code extension backend
│   │   ├── agents/         # Agent implementations (Planner, Executor, Critic, UI/UX)
│   │   ├── ollama/         # LLM client, prompts, AgentLoop
│   │   ├── orchestrator/   # (legacy) LangGraph multi-agent orchestrator
│   │   ├── spec/           # ★ NEW: Spec-driven infrastructure
│   │   │   ├── types.ts    # Spec types (ExecutableTask, ParsedSpec, etc.)
│   │   │   ├── SpecReader.ts         # Parse tasks.md into executable tasks
│   │   │   ├── SpecTaskExecutor.ts   # Sequential task runner
│   │   │   ├── SpecComplianceChecker.ts # Verify against acceptance criteria
│   │   │   └── index.ts    # Barrel export
│   │   ├── tools/          # Tool registry and implementations
│   │   ├── rag/            # RAG knowledge base (ChromaDB)
│   │   ├── utils/          # Logger, WebviewManager, etc.
│   │   ├── types/          # Shared type definitions
│   │   ├── webview/        # Webview backend communication
│   │   ├── classification/ # Message classification system
│   │   ├── providers/      # VS Code providers
│   │   ├── errors/         # Error handling
│   │   └── extension.ts    # Extension entry point
│   └── webview/             # React frontend
│       ├── components/      # React components
│       ├── store/          # State management
│       ├── types/          # Webview types
│       └── index.tsx       # Webview entry
├── .forgeai/               # ★ NEW: Spec-driven artifacts
│   ├── memory/             # Persistent project context
│   │   ├── product.md      # Product description
│   │   ├── structure.md    # This file — codebase architecture
│   │   └── tech.md         # Tech stack decisions
│   ├── specs/              # Feature specs
│   └── design-system/      # Generated design tokens
├── AGENTS.md               # ★ NEW: Project constitution
├── ui-ux-architect-agent/  # Existing Kiro-generated spec
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
├── browser-capability/     # Browser capability spec
└── docs/                   # Documentation and research
```

## Key Components

### AgentLoop (`src/extension/ollama/AgentLoop.ts`)
- Core execution loop for AI tool calls
- Handles streaming responses
- Integrates with ToolRegistry
- **TODO Phase 1.4:** Inject spec context into system prompts

### SpecTaskExecutor (`src/extension/spec/SpecTaskExecutor.ts`)
- Replaces LangGraph orchestrator
- Reads tasks from spec, executes sequentially
- No recursion limits
- **Status:** Implemented, pending AgentLoop wiring

### ToolRegistry (`src/extension/tools/ToolRegistry.ts`)
- Registers and executes agent tools
- Tools: writeFile, readFile, runCommand, webSearch, etc.
- Extensible architecture for new tools

### WebviewManager (`src/extension/utils/WebviewManager.ts`)
- Manages VS Code webview panel
- Handles message passing between extension and React frontend
- Orchestrates agent execution from UI

## Data Flow

```
User Request (Webview)
    ↓
WebviewManager
    ↓
SpecTaskExecutor (NEW) — reads spec, gets next task
    ↓
AgentLoop — executes task with spec context
    ↓
ToolRegistry — calls tools (writeFile, etc.)
    ↓
File System / Terminal
    ↓
SpecComplianceChecker — verifies output
    ↓
Status saved → Webview updated
```

## Legacy Components (Being Replaced)

- `src/extension/orchestrator/MultiAgentOrchestrator.ts` — LangGraph-based, recursion-limited
- `src/extension/orchestrator/Graph.ts` — LangGraph state machine
- These are kept for reference but will be deprecated once spec-driven is fully wired
