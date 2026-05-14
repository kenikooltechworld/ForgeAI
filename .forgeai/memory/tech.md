# ForgeAI Tech Stack Decisions

## Core Technologies

| Technology | Version | Purpose | Decision Rationale |
|-----------|---------|---------|-------------------|
| TypeScript | 5.x | Language | Strict mode for type safety across extension and webview |
| React | 18+ | Webview UI | Functional components, hooks-based state management |
| Tailwind CSS | 3.x | Styling | Utility-first, no runtime CSS-in-JS overhead |
| Express.js | 4.x | Local server | Lightweight backend for webview communication |
| PostgreSQL | 15+ | Database | Structured data persistence for conversations |
| Jest | 29+ | Testing | Unit and integration testing framework |
| Ollama | Latest | LLM Backend | Zero-cost local inference, privacy-preserving |
| ChromaDB | Embedded | Vector DB | In-process RAG, no external service |

## VS Code Extension

- **API Version:** 1.85+
- **Activation Events:** `onView:forgeAI.chatView`
- **Webview:** React app bundled with esbuild
- **Communication:** VS Code message passing API

## Build System

- **Extension:** esbuild (fast, TypeScript support)
- **Webview:** esbuild with React/TypeScript
- **Type Checking:** `tsc --noEmit` for CI validation

## LLM Configuration

- **Primary Models:** Llama 3.1 70B, Qwen 2.5 72B
- **Fallback:** Any Ollama-compatible model
- **Context Window:** Up to 128k tokens (model-dependent)
- **Temperature:** 0.7 for creative tasks, 0.1 for precise tasks

## RAG Knowledge Base

- **Vector Store:** ChromaDB (embedded mode)
- **Embeddings:** Ollama embeddings API (nomic-embed-text)
- **Collections:** material-design-3, apple-hig, wcag-guidelines, tailwind-docs, user-design-system
- **Chunking:** Semantic chunking for docs, AST-based for code

## Dependencies Policy

- **No new runtime deps without ADR** — see AGENTS.md
- **Dev deps preferred** for build-time tools
- **Security:** All deps must have active maintenance (< 6 months since last commit)

## Constraints

- Zero cloud API calls (Ollama only)
- Extension activation < 500ms
- Webview bundle < 2MB
- Tool calls complete within 30 seconds
- Streaming response latency < 100ms per chunk
