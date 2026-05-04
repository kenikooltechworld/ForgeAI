# ForgeAI Documentation

This directory contains all documentation for the ForgeAI project.

## Structure

```
docs/
├── research/           # Research documents and API investigations
│   ├── vscode-api-2026.md                      # VS Code Extension API research
│   ├── nodejs-24-lts-2026.md                   # Node.js 24 LTS features & APIs
│   ├── ollama-intelligence-2026.md             # Ollama & intelligence enhancement
│   ├── frontend-tech-stack-2026.md             # Frontend tech stack (React, Tailwind, Zustand)
│   ├── ui-ux-architecture-2026.md              # UI/UX architecture & design patterns
│   ├── multi-agent-orchestration-2026.md       # Multi-agent orchestration & frameworks
│   ├── rag-implementation-2026.md              # RAG implementation architecture
│   ├── tool-calling-function-execution-2026.md # Tool calling & function execution
│   └── browser-capability-2026.md              # Browser automation & capability
├── architecture/       # Architecture design documents (coming soon)
├── specs/             # Feature specifications (coming soon)
└── guides/            # User and developer guides (coming soon)
```

## Research Documents

### [VS Code API Research 2026](./research/vscode-api-2026.md)

Comprehensive research on VS Code Extension APIs (v1.104 - v1.115) covering:

- Language Model Chat Provider API
- Chat Participant API
- Language Model Tools API
- Inline Completion Provider API
- File System Watcher & Diagnostics
- Agent Skills & Custom Agents
- Agent Hooks
- Subagents & Parallel Execution

**Status:** ✅ Complete  
**Last Updated:** May 3, 2026

### [Node.js 24 LTS 2026](./research/nodejs-24-lts-2026.md)

Comprehensive research on Node.js 24 LTS "Krypton" runtime and APIs covering:

- Native SQLite support (DatabaseSync API, defensive mode, prepared statements)
- Stable ESM support (require(esm), module compile cache, TypeScript loading)
- Enhanced HTTP/2 (HTTP/1 fallback configuration, global proxy support)
- File system enhancements (fs.watch ignore option, fs.stat throwIfNoEntry)
- Stream improvements (bytes() consumer, improved compose())
- Test runner enhancements (env option, expectFailure)
- Async hooks (trackPromises option)
- Performance improvements (30% faster module loading, 15% faster HTTP parsing)
- VS Code integration (built-in runtime for extensions)
- Security features (SQLite defensive mode, updated dependencies)
- Complete API reference and code examples

**Status:** ✅ Complete  
**Last Updated:** May 3, 2026

### [Ollama & Model Intelligence Enhancement 2026](./research/ollama-intelligence-2026.md)

Comprehensive research on Ollama, tool calling, and intelligence enhancement techniques covering:

- Ollama native tool calling (single-shot, parallel, agent loops)
- Top models for ForgeAI (Qwen3-Coder, DeepSeek-R1, Kimi K2.6)
- RAG (Retrieval-Augmented Generation)
- Advanced prompt engineering (CoT, ReAct, ToT, Meta-Prompting)
- Fine-tuning with LoRA/QLoRA
- Multi-agent orchestration
- Verification loops and auto-QA
- Making open-source models smarter than paid alternatives

**Status:** ✅ Complete  
**Last Updated:** May 3, 2026

### [Frontend Tech Stack 2026](./research/frontend-tech-stack-2026.md)

Comprehensive research on frontend technologies for VS Code webview extensions covering:

- React 19 (latest features: useActionState, useOptimistic, use() hook)
- Tailwind CSS v4.0 (CSS-first config, arbitrary values, VS Code theme integration)
- VS Code native theme system (400+ CSS variables)
- Zustand v5 (state management with VS Code storage adapters)
- VS Code state persistence (workspaceState, globalState, secrets)
- Tab/session management architecture (browser-like tabs for conversations)
- Complete code examples and implementation patterns

**Status:** ✅ Complete  
**Last Updated:** May 3, 2026

### [UI/UX Architecture 2026](./research/ui-ux-architecture-2026.md)

Comprehensive research on UI/UX architecture patterns for autonomous AI coding assistants covering:

- First launch experience (auto-select model, quick start suggestions)
- Split-screen architecture (activity stream + live preview)
- AI thinking visualization (inline blocks with confidence indicators)
- Real-time activity feed (tool execution with expandable details)
- Conversation persistence (per-workspace, per-tab storage with VS Code APIs)
- Progressive autonomy system (3-tier: supervised → semi-autonomous → autonomous)
- Trust & transparency patterns (confidence levels, "Why?" buttons, escape hatches)
- Error handling & graceful degradation
- Multi-step workflows (progress indicators, checkpoints, approval gates)
- Command palette & suggestion chips (eliminate blank prompt problem)
- Complete TypeScript/React implementation examples
- Production-ready component architecture

**Status:** ✅ Complete  
**Last Updated:** May 3, 2026

### [Multi-Agent Orchestration Architecture 2026](./research/multi-agent-orchestration-2026.md)

Comprehensive research on multi-agent orchestration patterns and frameworks for ForgeAI covering:

- Four orchestration patterns (Supervisor, Router, Pipeline, Swarm) with production metrics
- Framework comparison (LangGraph vs CrewAI vs Custom) - all FREE and open-source
- Anthropic's Planner-Generator-Evaluator architecture (production-proven)
- Agent communication patterns (message passing, shared memory, event-driven)
- Task decomposition & delegation strategies
- ForgeAI feature analysis (framework vs custom for each feature)
- Hybrid architecture recommendation (40% LangGraph + 60% Custom)
- Complete cost analysis ($0/month with free alternatives)
- 16-week implementation roadmap
- Decision framework for pattern and framework selection

**Status:** ✅ Complete  
**Last Updated:** May 3, 2026

### [RAG Implementation Architecture 2026](./research/rag-implementation-2026.md)

Comprehensive research on RAG (Retrieval-Augmented Generation) implementation for ForgeAI covering:

- Vector database comparison (ChromaDB, Qdrant, Weaviate, Pinecone) with performance benchmarks
- Embedding models benchmark (Voyage-4-code, GTE-Qwen2-7B, BGE-large-en-v1.5, E5-mistral-7B)
- Chunking strategies (fixed-size, semantic, AST-based, hierarchical) with quality metrics
- Hybrid search implementation (BM25 + vector with RRF fusion)
- Code-specific RAG patterns (AST metadata, call graph, import resolution, hierarchical context)
- Production RAG stack architecture (ChromaDB + BGE/Voyage + LlamaIndex + tree-sitter)
- Performance optimization (caching, quantization, batch embedding, incremental indexing)
- ForgeAI integration guide (5-phase implementation plan)
- Complete TypeScript/Python implementation examples
- Cost analysis ($0/month local OR $2-5/month cloud)
- Best practices (chunk size, overlap, metadata, monitoring)

**Status:** ✅ Complete  
**Last Updated:** May 3, 2026

### [Tool Calling & Function Execution 2026](./research/tool-calling-function-execution-2026.md)

Comprehensive research on tool calling and function execution architecture for ForgeAI covering:

- Ollama native tool calling (single-shot 97.8% success, parallel 2-3x speedup, agent loops, streaming)
- VS Code Extension Tool APIs (File System, Terminal, Git, Diagnostics with TypeScript wrappers)
- Tool execution patterns (Sequential, Parallel, Conditional, Speculative with dependency analysis)
- Four-layer sandboxing (Firecracker/gVisor, Landlock filesystem, network egress, credential scoping)
- Tool result handling (Prompt caching 50% cost reduction, tool result caching 40-50% hit rate, semantic caching)
- Model Context Protocol (MCP) integration (200+ community servers, universal standard)
- Performance optimization (Batching, parallel execution, multi-layer caching, streaming)
- ForgeAI integration guide (8-phase implementation plan, 12-week timeline)
- Complete TypeScript/Python implementation examples (Tool registry, agent executor, parallel executor, streaming)
- Security best practices (Defense in depth, least privilege, input validation, audit logging, rate limiting)
- Production checklist (Pre-deployment verification, deployment steps, rollback plan, monitoring)
- Additional resources (Papers, tutorials, open-source projects, conferences, certifications)

**Status:** ✅ Complete  
**Last Updated:** May 3, 2026

### [Browser Capability & Automation 2026](./research/browser-capability-2026.md)

Comprehensive research on browser automation and capability for AI agents covering:

- Browser automation landscape 2026 (Playwright vs Puppeteer comparison)
- Playwright for AI agents (7M weekly downloads, multi-browser, auto-waiting, MCP integration)
- MCP Browser Servers (5 production-ready servers: Playwright MCP, Browserbase, mcp-chrome, Browser Use, Chrome DevTools)
- WebMCP & The Agentic Web (Google's 2026 breakthrough, 9x faster than traditional automation)
- Chrome DevTools Protocol (CDP) (5-15ms latency vs 50-100ms WebDriver, 3-10x performance)
- VS Code browser integration (3 approaches: embedded webview, headless browser, browser extension bridge)
- ForgeAI integration guide (7-week phased implementation plan)
- Complete TypeScript implementation examples (Playwright wrapper, MCP client, WebMCP integration)
- Security & anti-detection (Stealth techniques, rate limiting, proxy rotation)
- Production checklist (Deployment readiness, monitoring, error handling)
- Cost analysis ($0/month with local Playwright)

**Status:** ✅ Complete  
**Last Updated:** May 3, 2026

### [Tailwind CSS + VS Code Integration 2026](./research/tailwindcss-vscode-integration-2026.md) ⚠️ **CRITICAL**

Comprehensive research on Tailwind CSS v4.0 integration with VS Code webview CSS variables covering:

- **CRITICAL FINDING:** Tailwind v4.0 arbitrary syntax `bg-(--variable)` DOES NOT WORK for external CSS variables
- **SOLUTION:** Use inline styles `style={{ backgroundColor: 'var(--vscode-editor-background)' }}` for VS Code theme colors
- Hybrid approach: Tailwind for layout/spacing, inline styles for theme colors
- GitHub Next's proven approach (abandoned tailwind-vscode package in favor of inline styles)
- Complete VS Code CSS variables reference (400+ variables organized by category)
- Reusable component patterns (Button, Input, Card with theme integration)
- Theme helper utilities for type safety and consistency
- Best practices and production-ready examples
- Why @theme approach is NOT recommended for VS Code variables

**Status:** ✅ Complete  
**Last Updated:** May 4, 2026

---

## Contributing

When adding new documentation:

1. Place research documents in `research/`
2. Place architecture docs in `architecture/`
3. Place feature specs in `specs/`
4. Place guides in `guides/`
5. Update this README with links to new documents
