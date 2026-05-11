# ForgeAI — Codebase Overview

## Summary
ForgeAI is a **Visual Studio Code extension** that provides an AI chat UI (custom webview) and an **autonomous agent loop** that can call tools to operate on the user’s workspace (read/write files, run terminals, git, diagnostics). It integrates with VS Code’s native **Language Model Chat Provider** API so Ollama models appear in VS Code’s model picker, and it also registers a **Chat Participant** for `vscode.chat` flows. The LLM backend is **Ollama** via a streaming HTTP client, and tool calling is supported by generating tool schemas from a centralized `ToolRegistry`.

## Architecture
**Primary pattern:** VS Code extension “composition root” + layered orchestration:
- `ForgeAIExtension` initializes services and registers VS Code integration points.
- `WebviewManager` bridges the webview UI <-> extension runtime, translates messages, and streams updates to/from the agent loop.
- `AgentLoop` is the autonomous loop: it sends conversation + a system prompt to Ollama, reads streaming chunks, and executes tool calls sequentially.
- `ToolRegistry` is the source of truth for tool definitions + execution.
- `LanguageModelChatProvider` exposes Ollama models to VS Code’s built-in LM interface.

**Key runtime loop:**
- User action (webview message) → `WebviewManager.handleSendMessage()` → creates `AgentLoop` → `agentLoop.execute()`:
  1) prepend a system prompt
  2) call Ollama with `stream=true, think=true, tools`
  3) for each streaming chunk: update UI (token usage, thinking/content/tool calls)
  4) when chunk stream ends: if tool calls exist, execute them via `ToolRegistry.executeTool()`
  5) push tool results back into message history and repeat until no tool calls or user stops

## Directory Structure
Relevant parts of the repository:

```
project-root/
├── src/
│   ├── extension/
│   │   ├── extension.ts                  — extension activation + service wiring
│   │   ├── ollama/
│   │   │   ├── OllamaClient.ts          — streaming HTTP client + error handling
│   │   │   ├── AgentLoop.ts            — autonomous tool-calling loop
│   │   │   └── SystemPrompt.ts        — system prompt + workspace context (used by AgentLoop)
│   │   ├── providers/
│   │   │   └── LanguageModelChatProvider.ts — VS Code model picker + streaming response forwarding
│   │   ├── tools/
│   │   │   └── ToolRegistry.ts        — registers tools + schemas + execution
│   │   ├── utils/
│   │   │   └── WebviewManager.ts      — webview IPC handler + streaming updates
│   │   ├── classification/
│   │   │   └── MessageRouter.ts       — message classification that changes system prompt + tool usage (used by AgentLoop)
│   │   └── orchestrator/
│   │       └── MultiAgentOrchestrator.ts — optional multi-agent path for “complex requests” (wired in WebviewManager)
│   └── webview/
│       └── App.tsx etc.               — React UI (not deeply explored in this run)
└── resources/                          — icons used in VS Code participant registration
```

## Key Abstractions

### ForgeAIExtension
- **File**: `src/extension/extension.ts` (activate/deactivate + service wiring)
- **Responsibility**: Acts as the **composition root** for the extension. Owns `services: Map<string, any>` and coordinates initialization/disposal.
- **Interface**:  
  - `activate(): Promise<void>`: initializes core services, registers commands and providers.
  - `deactivate(): void`: disposes services and the webview manager.
- **Lifecycle**: created on extension activation via exported `activate(context)`.
- **Used by**:
  - VS Code runtime calls `activate()`/`deactivate()` entrypoints.
  - Registers `WebviewManager` via `registerWebviewViewProvider('forgeai.chatView', ...)`.
  - Registers LM provider via `vscode.lm.registerLanguageModelChatProvider('forgeai', ...)`.
  - Registers chat participant via `vscode.chat.createChatParticipant('forgeai.assistant', ...)`.

### WebviewManager
- **File**: `src/extension/utils/WebviewManager.ts` (large IPC/router)
- **Responsibility**: Bridge between the **webview UI** and the **agent runtime**.
- **Interface (important behaviors)**:
  - `resolveWebviewView(webviewView)`: sets webview HTML/JS roots and registers `onDidReceiveMessage`.
  - `handleMessage(message)`: switch-based dispatcher for all webview IPC message types.
  - `handleSendMessage(...)`: builds Ollama messages, validates vision model requirements, and launches `AgentLoop` or `MultiAgentOrchestrator`.
  - `executeAgentLoop(...)`: central place where `AgentLoop` updates become webview `streamChunk`, tool lifecycle events, test parsing events, etc.
- **Lifecycle**: owned by `ForgeAIExtension` and disposed when the extension deactivates.
- **Used by**:
  - `ForgeAIExtension` creates it and registers it as a `WebviewViewProvider`.
  - Internally creates `AgentLoop` and optionally `MultiAgentOrchestrator`.

**Non-obvious meaning:** `WebviewManager` is effectively the system’s “event translation layer”—it normalizes many agent/tool lifecycle events into UI messages, and it also injects extra features (file preview, diffs, terminal output parsing, stop/retry/continue flows).

### OllamaClient
- **File**: `src/extension/ollama/OllamaClient.ts`
- **Responsibility**: Pure HTTP client for Ollama’s `/api/chat` and `/api/tags`, with streaming JSON-line parsing and retry/backoff.
- **Interface**:
  - `chat(request: OllamaChatRequest)`: returns either `OllamaChatResponse` or an `AsyncGenerator<OllamaStreamChunk>`, based on `request.stream`.
  - `listModels()`, `isAvailable()`: model discovery and health checking.
- **Lifecycle**: constructed once per extension activation in `ForgeAIExtension.initializeServices()`.
- **Used by**:
  - `LanguageModelChatProvider` (for model listing + chat streaming).
  - `AgentLoop` (for streaming chat in autonomous loop).
  - `WebviewManager` (for agent loop execution and for proxying model fetch requests).

**Key design choice:** streaming chunks are parsed as **newline-delimited JSON** (`buffer.split('\n')` then `JSON.parse(line)`), so the client assumes Ollama’s stream format is line-based.

### LanguageModelChatProvider
- **File**: `src/extension/providers/LanguageModelChatProvider.ts`
- **Responsibility**: Implements `vscode.LanguageModelChatProvider` so VS Code can:
  - display available Ollama models
  - route chat requests to Ollama
  - stream partial text and tool-call events back into VS Code’s chat system
- **Interface**:
  - `provideLanguageModelChatInformation(...)`: fetches `/api/tags`, maps models, returns a VS Code list; falls back to a default model when Ollama is unavailable.
  - `provideLanguageModelChatResponse(...)`: converts VS Code messages to Ollama messages, calls `ollamaClient.chat({stream:true, think:true, tools})`, and forwards `LanguageModelTextPart` + `LanguageModelToolCallPart`.
  - `provideTokenCount(...)`: estimates tokens with `Math.ceil(chars/4)`.
- **Used by**:
  - VS Code runtime via `ForgeAIExtension.registerLanguageModelChatProvider()`.

**Non-obvious behavior:** despite having `modelsCache` fields, this implementation currently doesn’t actively use the cache in `fetchOllamaModels()` (cache vars exist, but the method always calls Ollama). This means model listing can still hammer Ollama unless other code mitigates it.

### ToolRegistry
- **File**: `src/extension/tools/ToolRegistry.ts`
- **Responsibility**: Central registry for tools:
  1) registers tool schemas (for LM tool-calling)
  2) executes tools by name (for `AgentLoop`)
  3) registers each tool with VS Code’s LM Tools API (`vscode.lm.registerTool`)
- **Interface**:
  - `registerAllTools()`: registers FS/terminal/git/diagnostics tools by requiring tool provider modules.
  - `getToolDefinitions()`: produces OpenAI-compatible-ish `{type:'function', function:{name, description, parameters}}`.
  - `executeTool(name, args, token?)`: invoked by `AgentLoop` to perform the actual side-effect.
- **Lifecycle**: created/initialized during extension activation and disposed during extension deactivation.
- **Used by**:
  - `ForgeAIExtension` to register and hold a `ToolRegistry` instance.
  - `WebviewManager` for tool schema injection and autonomous execution.
  - `LanguageModelChatProvider` to send tools to Ollama.

**Non-obvious meaning:** `ToolRegistry.registerTool()` returns tool execution confirmation strings via `prepareInvocation`, but `AgentLoop` does not use VS Code’s tool invocation UI—it calls `executeTool()` directly. This means tool safety/confirmation UX is split: native VS Code tool picker gets confirmations, but autonomous agent execution depends on the extension’s own prompt/tool policies.

### AgentLoop
- **File**: `src/extension/ollama/AgentLoop.ts`
- **Responsibility**: The autonomous agent state machine:
  - classifies the initial user message (via `MessageRouter`)
  - sends a system prompt + message history to Ollama
  - parses tool calls from streamed responses
  - executes tool calls sequentially via `ToolRegistry.executeTool()`
  - repeats with tool results appended until the model stops requesting tools
- **Interface**:
  - `execute(initialMessages, onUpdate, tools, model, options?)`: drives streaming and tool execution.
  - `stop()`, `isExecuting()`: cancellation/stop mechanism (via `shouldStop` flag).
  - routing-related helpers: `getClassificationMetrics()`, `clearRoutingHistory()`.
- **Important internal behaviors**:
  - Prepends/replaces the first `system` message with a category-specific system prompt (from `generateSystemPrompt(...)` + `MessageRouter`).
  - Applies classification decision: if `routing.shouldUseTool` is false, it forces `effectiveTools = []` for that conversation run.
  - Implements a **minimum 500ms request interval** between Ollama calls to reduce rapid successive calls.
  - When streaming: uses `StreamHandler` to accumulate thinking/content/tool_calls and to compute token usage.
  - Tool lifecycle events are emitted via `onUpdate({type:'toolStart'|'toolComplete'|'toolError', ...})`.
- **Used by**:
  - `WebviewManager.executeAgentLoop()`.
  - `WebviewManager.handleOrchestratorRequest()` (indirectly via `MultiAgentOrchestrator`).
  
**Non-obvious invariant:** the loop terminates naturally when `tool_calls` is empty after an iteration, not by a max-iteration cap. The code comments explicitly say max iterations is intentionally not enforced in `AgentLoop` (so “stopping” is either tool-less completion or an external `stop()`).

## Data Flow
1. **Webview starts a request**
   - Webview sends `sendMessage` IPC
   - `WebviewManager.handleMessage()` routes to `handleSendMessage()`
2. **Message + tools are prepared**
   - Builds `OllamaMessage[]` from `conversationHistory`
   - Validates image attachments vs selected model capabilities (vision model heuristic)
   - Pulls tool definitions from `ToolRegistry.getToolDefinitions()`
3. **Autonomous execution**
   - `WebviewManager.executeAgentLoop()` calls `agentLoop.execute(messages, onUpdate, tools, model)`
4. **Classification + prompt injection**
   - `AgentLoop` builds workspace context (`gatherWorkspaceContext()`)
   - Routes the initial user message via `MessageRouter` to determine a category-specific system prompt and whether tools should be used
5. **LLM streaming + UI updates**
   - `AgentLoop` calls `ollamaClient.chat({stream:true, think:true, tools:effectiveTools})`
   - For each streamed chunk: `StreamHandler.processChunk(chunk)` then `onUpdate({type:'chunk', ...})`
   - `WebviewManager.executeAgentLoop()` forwards chunk parts to the webview and also logs/sends token usage
6. **Tool execution**
   - When iteration completes and the model emitted tool calls, `AgentLoop` executes each tool sequentially through `ToolRegistry.executeTool()`
   - Tool results/errors are appended to message history as `role:'tool'`
7. **Repeat until no tool calls**
   - If a new iteration yields no `tool_calls`, `AgentLoop` emits `complete` and terminates.

## Non-Obvious Behaviors & Design Decisions
- **Two different “tool pathways” exist**:
  - VS Code native tool invocations via `vscode.lm.registerTool` (for UI/model picker tools)
  - Direct execution via `ToolRegistry.executeTool()` inside `AgentLoop` (for autonomous behavior)
  - This split means confirmation UX is not automatically enforced for autonomous tool calls.
- **Loop termination is model-driven**:
  - `AgentLoop` intentionally does not enforce `maxIterations` inside the loop; it relies on the model to stop emitting tool calls (or user-driven `stop()`).
- **Classification can disable tools**:
  - If `MessageRouter` categorizes the initial message such that `shouldUseTool` is false, the agent still runs but sends `tools: []` to Ollama.
- **Streaming chunk parsing assumes NDJSON-like lines**:
  - `OllamaClient.streamChat()` buffers by `'\n'` and parses each line as JSON; malformed lines only log and are skipped.
- **Vision handling is heuristic-based**:
  - `WebviewManager` decides whether a model supports vision based on substring matching (`llava`, `vision`, etc.). It blocks image uploads to non-vision models and notifies the webview.
- **Token usage reporting is a first-class UX element**:
  - Both `AgentLoop` and `WebviewManager` log and forward `tokenUsage` to the UI, explicitly calling out in logs when token usage is posted.

## Suggested Reading Order
1. `src/extension/extension.ts` — how the extension is wired and what gets registered with VS Code.
2. `src/extension/utils/WebviewManager.ts` — the main IPC router and where the agent loop is launched + UI streaming happens.
3. `src/extension/ollama/AgentLoop.ts` — the autonomous tool-calling control flow and streaming iteration loop.
4. `src/extension/tools/ToolRegistry.ts` — how tool schemas are produced for Ollama and how tool execution is dispatched.
5. `src/extension/ollama/OllamaClient.ts` — how streaming chat and model listing work at the HTTP/protocol level.
6. `src/extension/providers/LanguageModelChatProvider.ts` — the alternate path for VS Code’s native chat/model integration.
