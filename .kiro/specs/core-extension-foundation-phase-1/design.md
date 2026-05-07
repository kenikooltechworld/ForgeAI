# Design Document

## Introduction

This document provides the technical design for **ForgeAI Phase 1: Core Extension Foundation**. It translates the 53 requirements into a concrete implementation plan with detailed architecture, component specifications, API designs, and data models.

**Design Principles:**
1. **Native Integration** - Leverage VS Code's native APIs for seamless user experience
2. **Performance First** - Optimize for fast load times, smooth interactions, and minimal resource usage
3. **Extensibility** - Design for future phases (multi-agent, RAG, browser automation)
4. **Type Safety** - Use TypeScript throughout for compile-time safety
5. **Modern Stack** - React 19, Native CSS with VS Code theme integration, Zustand v5 for best-in-class developer experience

---

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VS Code Editor                                 │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                        Extension Host (Node.js)                       │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  ForgeAI Extension                                              │ │ │
│  │  │  - Language Model Chat Provider                                 │ │ │
│  │  │  - Chat Participant (@forgeai)                                  │ │ │
│  │  │  - Tool Registry (20+ tools)                                    │ │ │
│  │  │  - Ollama Client                                                │ │ │
│  │  │  - Storage Manager                                              │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  VS Code APIs                                                   │ │ │
│  │  │  - workspace.fs (File System)                                   │ │ │
│  │  │  - window (UI, Terminals)                                       │ │ │
│  │  │  - languages (Diagnostics)                                      │ │ │
│  │  │  - git extension API                                            │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    ↕                                        │
│                          postMessage Protocol                               │
│                                    ↕                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    Webview (Sandboxed iframe)                         │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  React 19 Application                                           │ │ │
│  │  │  - Activity Stream (Left Panel)                                 │ │ │
│  │  │  - Live Preview (Right Panel)                                   │ │ │
│  │  │  - Zustand State Management                                     │ │ │
│  │  │  - Native CSS with VS Code Theme Integration                  │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↕
                            HTTP/WebSocket
                                    ↕
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Ollama Server (localhost:11434)                     │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Qwen3-Coder-397B (Cloud) - Default Model                            │ │
│  │  - Tool Calling Support                                               │ │
│  │  - Thinking Mode (think: true)                                        │ │
│  │  - Streaming Responses                                                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Action → Extension Host → Ollama → Extension Host → Webview → User

1. User sends message in Webview
2. Webview → Extension Host (postMessage)
3. Extension Host → Ollama (HTTP streaming)
4. Ollama streams thinking + content + tool_calls
5. Extension Host executes tools (VS Code APIs)
6. Extension Host → Webview (postMessage with updates)
7. Webview updates UI in real-time
8. Loop continues until task complete
```

### Data Flow

```
┌──────────────┐
│ User Input   │
└──────┬───────┘
       │
       ↓
┌──────────────────────────────────────────────────────────┐
│ Webview (React)                                          │
│ - Zustand Store (conversations, activeTabId)             │
│ - useActionState (form submission)                       │
│ - useOptimistic (instant UI updates)                     │
└──────┬───────────────────────────────────────────────────┘
       │ postMessage({ type: 'sendMessage', content: '...' })
       ↓
┌──────────────────────────────────────────────────────────┐
│ Extension Host                                           │
│ - Message Queue                                          │
│ - Agent Loop Controller                                  │
└──────┬───────────────────────────────────────────────────┘
       │ HTTP POST /api/chat
       ↓
┌──────────────────────────────────────────────────────────┐
│ Ollama Server                                            │
│ - Model: qwen3-coder:397b                                │
│ - think: true                                            │
│ - stream: true                                           │
└──────┬───────────────────────────────────────────────────┘
       │ Stream chunks: { thinking, content, tool_calls }
       ↓
┌──────────────────────────────────────────────────────────┐
│ Extension Host                                           │
│ - Accumulate chunks                                      │
│ - Execute tool_calls (VS Code APIs)                      │
│ - Add tool results to message history                    │
└──────┬───────────────────────────────────────────────────┘
       │ postMessage({ type: 'streamChunk', data: {...} })
       ↓
┌──────────────────────────────────────────────────────────┐
│ Webview (React)                                          │
│ - Update Thinking Block                                  │
│ - Update Tool Cards                                      │
│ - Update Assistant Message                               │
│ - Persist to workspaceState                              │
└──────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Extension Host (Node.js + TypeScript)
- **Runtime:** Node.js 24+ LTS (VS Code built-in)
- **Language:** TypeScript 5.3+
- **VS Code API:** v1.115+ (April 2026)
- **HTTP Client:** node-fetch or axios for Ollama
- **Tool Execution:** child_process for terminal commands

### Webview (React + TypeScript)
- **UI Framework:** React 19.0+
- **Styling:** Native CSS with VS Code CSS variables
- **State Management:** Zustand v5.0+
- **Build Tool:** Vite 5.0+ or esbuild
- **Bundler Target:** ES2022, <500KB gzipped

### Ollama Integration
- **Server:** Ollama v0.5+ (2026)
- **Default Model:** qwen3-coder:397b (cloud)
- **Protocol:** HTTP/1.1 with streaming
- **API Version:** v1 (OpenAI-compatible)

### Development Tools
- **Package Manager:** npm or pnpm
- **Linter:** ESLint 9+ with TypeScript rules
- **Formatter:** Prettier 3+
- **Testing:** Vitest for unit tests, VS Code Test API for integration

---

## Project Structure

```
forgeai/
├── src/
│   ├── extension/                    # Extension Host code
│   │   ├── extension.ts              # Main entry point
│   │   ├── providers/
│   │   │   ├── LanguageModelChatProvider.ts
│   │   │   └── ChatParticipant.ts
│   │   ├── tools/
│   │   │   ├── ToolRegistry.ts
│   │   │   ├── FileSystemTools.ts
│   │   │   ├── TerminalTools.ts
│   │   │   ├── GitTools.ts
│   │   │   └── DiagnosticsTools.ts
│   │   ├── ollama/
│   │   │   ├── OllamaClient.ts
│   │   │   ├── StreamHandler.ts
│   │   │   └── AgentLoop.ts
│   │   ├── storage/
│   │   │   └── StorageManager.ts
│   │   └── types/
│   │       └── index.ts
│   │
│   └── webview/                      # React application
│       ├── index.tsx                 # Entry point
│       ├── App.tsx                   # Root component
│       ├── components/
│       │   ├── ActivityStream/
│       │   │   ├── ActivityStream.tsx
│       │   │   ├── TabBar.tsx
│       │   │   ├── MessageList.tsx
│       │   │   ├── ThinkingBlock.tsx
│       │   │   ├── ToolCard.tsx
│       │   │   └── MessageInput.tsx
│       │   ├── LivePreview/
│       │   │   ├── LivePreview.tsx
│       │   │   ├── CodeDiff.tsx
│       │   │   ├── TestResults.tsx
│       │   │   └── FilePreview.tsx
│       │   ├── SplitScreen/
│       │   │   └── SplitScreen.tsx
│       │   └── WelcomeScreen/
│       │       └── WelcomeScreen.tsx
│       ├── store/
│       │   ├── conversationStore.ts
│       │   └── vscodeStorageAdapter.ts
│       ├── hooks/
│       │   ├── useVSCodeMessage.ts
│       │   └── useStreamingResponse.ts
│       ├── styles/
│       │   └── globals.css           # Native CSS with VS Code variables
│       └── types/
│           └── index.ts
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```


## Extension Host Architecture

### 1. Extension Registration and Activation (Requirements 1-3)

#### package.json Configuration

```json
{
  "name": "forgeai",
  "displayName": "ForgeAI",
  "description": "Autonomous AI coding assistant powered by Qwen3-Coder-397B",
  "version": "1.0.0",
  "publisher": "forgeai",
  "engines": {
    "vscode": "^1.115.0"
  },
  "categories": ["AI", "Programming Languages"],
  "activationEvents": [
    "onStartupFinished",
    "onCommand:forgeai.open"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "forgeai.open",
        "title": "Open ForgeAI",
        "category": "ForgeAI"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "forgeai",
          "title": "ForgeAI",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "languageModelChatProviders": [
      {
        "vendor": "forgeai",
        "displayName": "ForgeAI",
        "managementCommand": "forgeai.manage"
      }
    ],
    "chatParticipants": [
      {
        "id": "forgeai.assistant",
        "name": "forgeai",
        "fullName": "ForgeAI",
        "description": "Autonomous AI coding assistant",
        "isSticky": true,
        "commands": [
          {
            "name": "fix",
            "description": "Autonomously fix a bug"
          },
          {
            "name": "build",
            "description": "Build a feature from a goal"
          },
          {
            "name": "explain",
            "description": "Explain selected code"
          },
          {
            "name": "test",
            "description": "Generate and run tests"
          }
        ]
      }
    ]
  }
}
```

#### Extension Entry Point (extension.ts)

```typescript
import * as vscode from 'vscode';
import { LanguageModelChatProvider } from './providers/LanguageModelChatProvider';
import { ChatParticipant } from './providers/ChatParticipant';
import { ToolRegistry } from './tools/ToolRegistry';
import { StorageManager } from './storage/StorageManager';

export function activate(context: vscode.ExtensionContext) {
  console.log('ForgeAI extension activating...');

  // Initialize storage manager
  const storageManager = new StorageManager(context);

  // Register Language Model Chat Provider
  const chatProvider = new LanguageModelChatProvider();
  context.subscriptions.push(
    vscode.lm.registerLanguageModelChatProvider('forgeai', chatProvider)
  );

  // Register Chat Participant
  const participant = new ChatParticipant();
  context.subscriptions.push(
    vscode.chat.createChatParticipant('forgeai.assistant', participant.handler)
  );

  // Register all tools
  const toolRegistry = new ToolRegistry(context);
  toolRegistry.registerAllTools();

  // Register command to open ForgeAI
  context.subscriptions.push(
    vscode.commands.registerCommand('forgeai.open', () => {
      // Create or show webview panel
      createWebviewPanel(context, storageManager);
    })
  );

  console.log('ForgeAI extension activated successfully');
}

export function deactivate() {
  console.log('ForgeAI extension deactivating...');
}
```

---

### 2. Language Model Chat Provider (Requirement 2)

#### Implementation

```typescript
// providers/LanguageModelChatProvider.ts
import * as vscode from 'vscode';
import { OllamaClient } from '../ollama/OllamaClient';

export class LanguageModelChatProvider implements vscode.LanguageModelChatProvider {
  private ollamaClient: OllamaClient;

  constructor() {
    this.ollamaClient = new OllamaClient('http://localhost:11434');
  }

  async provideLanguageModelChatInformation(
    options: { silent: boolean },
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelChatInformation[]> {
    if (options.silent) return [];

    // Return available models
    return [
      {
        id: 'qwen3-coder-397b',
        name: 'Qwen3-Coder 397B',
        family: 'qwen3',
        version: '1.0.0',
        maxInputTokens: 128000,
        maxOutputTokens: 8192,
        capabilities: {
          toolCalling: true,
          imageInput: false
        }
      }
    ];
  }

  async provideLanguageModelChatResponse(
    model: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: any,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken
  ): Promise<void> {
    try {
      // Convert VS Code messages to Ollama format
      const ollamaMessages = this.convertMessages(messages);

      // Stream response from Ollama
      const stream = await this.ollamaClient.chat({
        model: 'qwen3-coder:397b',
        messages: ollamaMessages,
        stream: true,
        think: true,
        tools: options.tools || []
      });

      // Forward chunks to VS Code
      for await (const chunk of stream) {
        if (token.isCancellationRequested) break;

        if (chunk.message.content) {
          progress.report(new vscode.LanguageModelTextPart(chunk.message.content));
        }
      }
    } catch (error) {
      console.error('Error in provideLanguageModelChatResponse:', error);
      throw error;
    }
  }

  async provideTokenCount(
    model: vscode.LanguageModelChatInformation,
    text: string | vscode.LanguageModelChatRequestMessage,
    token: vscode.CancellationToken
  ): Promise<number> {
    // Rough estimation: 1 token ≈ 4 characters
    const textContent = typeof text === 'string' ? text : text.content;
    return Math.ceil(textContent.length / 4);
  }

  private convertMessages(
    messages: readonly vscode.LanguageModelChatRequestMessage[]
  ): any[] {
    return messages.map(msg => ({
      role: msg.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant',
      content: msg.content
    }));
  }
}
```

---

### 3. Chat Participant (Requirement 3)

#### Implementation

```typescript
// providers/ChatParticipant.ts
import * as vscode from 'vscode';

export class ChatParticipant {
  public handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) => {
    try {
      // Show progress
      stream.progress('ForgeAI is analyzing your request...');

      // Get the selected model
      const model = request.model;

      // Build context-aware prompt
      const messages = this.buildPrompt(request, context);

      // Send request to model
      const response = await model.sendRequest(messages, {}, token);

      // Stream response
      for await (const chunk of response.text) {
        if (token.isCancellationRequested) break;
        stream.markdown(chunk);
      }

      // Provide follow-up suggestions
      stream.button({
        command: 'forgeai.open',
        title: 'Open ForgeAI Panel'
      });

      return {
        metadata: {
          command: request.command
        }
      };
    } catch (error) {
      stream.markdown(`❌ Error: ${error.message}`);
      throw error;
    }
  };

  private buildPrompt(
    request: vscode.ChatRequest,
    context: vscode.ChatContext
  ): vscode.LanguageModelChatRequestMessage[] {
    const messages: vscode.LanguageModelChatRequestMessage[] = [];

    // Add system message
    messages.push({
      role: vscode.LanguageModelChatMessageRole.User,
      content: 'You are ForgeAI, an autonomous AI coding assistant. Help the user with their coding tasks.'
    });

    // Add conversation history
    for (const msg of context.history) {
      messages.push({
        role: msg.role === vscode.ChatMessageRole.User 
          ? vscode.LanguageModelChatMessageRole.User 
          : vscode.LanguageModelChatMessageRole.Assistant,
        content: msg.content
      });
    }

    // Add current request
    messages.push({
      role: vscode.LanguageModelChatMessageRole.User,
      content: request.prompt
    });

    return messages;
  }
}
```

---

### 4. Ollama Integration (Requirements 4, 45-49)

#### Ollama Client

```typescript
// ollama/OllamaClient.ts
import fetch from 'node-fetch';

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  thinking?: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
}

export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface OllamaChatOptions {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  think?: boolean;
  tools?: any[];
}

export class OllamaClient {
  constructor(private baseUrl: string) {}

  async chat(options: OllamaChatOptions): Promise<AsyncIterable<any>> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        stream: options.stream ?? true,
        think: options.think ?? true,
        tools: options.tools || []
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    return this.streamResponse(response.body);
  }

  private async *streamResponse(body: any): AsyncIterable<any> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const chunk = JSON.parse(line);
            yield chunk;
          } catch (error) {
            console.error('Failed to parse chunk:', line);
          }
        }
      }
    }
  }

  async listModels(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models || [];
  }
}
```

#### Stream Handler

```typescript
// ollama/StreamHandler.ts
export class StreamHandler {
  private thinking = '';
  private content = '';
  private toolCalls: any[] = [];

  reset() {
    this.thinking = '';
    this.content = '';
    this.toolCalls = [];
  }

  processChunk(chunk: any): {
    thinking?: string;
    content?: string;
    toolCalls?: any[];
    done: boolean;
  } {
    const result: any = { done: chunk.done || false };

    if (chunk.message?.thinking) {
      this.thinking += chunk.message.thinking;
      result.thinking = chunk.message.thinking;
    }

    if (chunk.message?.content) {
      this.content += chunk.message.content;
      result.content = chunk.message.content;
    }

    if (chunk.message?.tool_calls) {
      this.toolCalls.push(...chunk.message.tool_calls);
      result.toolCalls = chunk.message.tool_calls;
    }

    return result;
  }

  getAccumulated() {
    return {
      thinking: this.thinking,
      content: this.content,
      toolCalls: this.toolCalls
    };
  }
}
```

#### System Prompt for Autonomous Behavior

**CRITICAL**: The AI must receive a comprehensive system prompt that instructs it to be autonomous and proactive. This is the root cause of the issue where the AI describes tools instead of using them.

```typescript
// ollama/SystemPrompt.ts

/**
 * Generate the system prompt for ForgeAI autonomous agent
 * This prompt instructs the AI to be proactive and use tools autonomously
 */
export function generateSystemPrompt(workspaceContext?: {
  workspacePath?: string;
  currentFiles?: string[];
}): string {
  return `You are ForgeAI, an autonomous AI coding assistant integrated into VS Code.

# Core Behavior

You are PROACTIVE and AUTONOMOUS. When a user asks a question:
1. **DO NOT** just describe what you can do
2. **DO** immediately use tools to explore and investigate
3. **DO** provide concrete answers based on actual workspace data

# Example of WRONG behavior:
User: "What can you see in my workspace?"
❌ WRONG: "I can explore files using forgeai_readFile, forgeai_listDirectory..."

# Example of CORRECT behavior:
User: "What can you see in my workspace?"
✅ CORRECT: *Immediately calls forgeai_listDirectory* "I can see your workspace has the following structure: src/, tests/, package.json..."

# Available Tools

You have access to these tools - USE THEM PROACTIVELY:

## File System Tools
- **forgeai_readFile** - Read file contents. Use this to understand code before making changes.
- **forgeai_writeFile** - Write or update files. Use this to implement changes.
- **forgeai_listFiles** - List files by glob pattern (e.g., "**/*.ts"). Use this to discover project structure.
- **forgeai_listDirectory** - List directory contents. Use this to explore folders.
- **forgeai_createDirectory** - Create new directories.
- **forgeai_deleteFile** - Delete files or directories.
- **forgeai_copyFile** - Copy files.
- **forgeai_renameFile** - Rename or move files.
- **forgeai_getFileStats** - Get file metadata (size, timestamps).
- **forgeai_findFiles** - Search with include/exclude patterns.
- **forgeai_searchInFiles** - Search text content across files.

## When to Use Tools

**ALWAYS use tools when:**
- User asks about workspace structure → Use forgeai_listDirectory
- User asks about specific files → Use forgeai_readFile
- User asks to find something → Use forgeai_searchInFiles or forgeai_findFiles
- User asks to implement something → Use forgeai_writeFile
- User asks about project contents → Use forgeai_listFiles

**NEVER:**
- Just describe what tools you have
- Ask permission before exploring (you're autonomous!)
- Wait for explicit instructions to use tools

# Workspace Context
${workspaceContext?.workspacePath ? `
Current workspace: ${workspaceContext.workspacePath}
${workspaceContext.currentFiles ? `
Recent files: ${workspaceContext.currentFiles.join(', ')}
` : ''}
` : 'No workspace currently open.'}

# Thinking Process

Use the <think> tags to show your reasoning:
<think>
1. What is the user asking for?
2. What tools do I need to use?
3. What's my plan of action?
</think>

Then immediately execute your plan using tools.

# Response Style

- Be direct and action-oriented
- Show, don't tell
- Use tools first, explain later
- Provide concrete results, not abstract descriptions

Remember: You are AUTONOMOUS. Act, don't just describe!`;
}
```

#### Agent Loop with System Prompt

```typescript
// ollama/AgentLoop.ts
import { OllamaClient, OllamaMessage } from './OllamaClient';
import { ToolRegistry } from '../tools/ToolRegistry';
import { StreamHandler } from './StreamHandler';
import { generateSystemPrompt } from './SystemPrompt';
import * as vscode from 'vscode';

export class AgentLoop {
  private maxIterations = 20;

  constructor(
    private ollamaClient: OllamaClient,
    private toolRegistry: ToolRegistry
  ) {}

  async execute(
    initialMessages: OllamaMessage[],
    onUpdate: (update: any) => void
  ): Promise<void> {
    // Get workspace context for system prompt
    const workspaceContext = this.getWorkspaceContext();
    
    // Prepend system prompt if not already present
    const messages = [...initialMessages];
    if (messages.length === 0 || messages[0].role !== 'system') {
      messages.unshift({
        role: 'system',
        content: generateSystemPrompt(workspaceContext)
      });
    }
    
    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;
      onUpdate({ type: 'iteration', iteration });

      // Get response from Ollama
      const streamHandler = new StreamHandler();
      const stream = await this.ollamaClient.chat({
        model: 'qwen3-coder:397b',
        messages,
        stream: true,
        think: true,
        tools: this.toolRegistry.getToolDefinitions()
      });

      // Process stream
      for await (const chunk of stream) {
        const update = streamHandler.processChunk(chunk);
        onUpdate({ type: 'chunk', ...update });
      }

      // Get accumulated response
      const { thinking, content, toolCalls } = streamHandler.getAccumulated();

      // Add assistant message
      messages.push({
        role: 'assistant',
        content,
        thinking,
        tool_calls: toolCalls
      });

      // Check if we need to execute tools
      if (!toolCalls || toolCalls.length === 0) {
        // No more tools, we're done
        onUpdate({ type: 'complete' });
        break;
      }

      // Execute tools
      for (const toolCall of toolCalls) {
        onUpdate({ type: 'toolStart', toolCall });

        try {
          const result = await this.toolRegistry.executeTool(
            toolCall.function.name,
            toolCall.function.arguments
          );

          // Add tool result to messages
          messages.push({
            role: 'tool',
            tool_name: toolCall.function.name,
            content: JSON.stringify(result)
          });

          onUpdate({ type: 'toolComplete', toolCall, result });
        } catch (error) {
          onUpdate({ type: 'toolError', toolCall, error: error.message });

          // Add error result
          messages.push({
            role: 'tool',
            tool_name: toolCall.function.name,
            content: JSON.stringify({ error: error.message })
          });
        }
      }
    }

    if (iteration >= this.maxIterations) {
      onUpdate({
        type: 'maxIterations',
        message: 'Agent reached maximum iterations (20). Task may be incomplete.'
      });
    }
  }

  private getWorkspaceContext(): { workspacePath?: string; currentFiles?: string[] } {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {};
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    
    // Get recently opened files
    const currentFiles = vscode.window.tabGroups.all
      .flatMap(group => group.tabs)
      .map(tab => {
        if (tab.input instanceof vscode.TabInputText) {
          return tab.input.uri.fsPath.replace(workspacePath, '').replace(/^[\/\\]/, '');
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 5); // Limit to 5 most recent files

    return {
      workspacePath,
      currentFiles: currentFiles as string[]
    };
  }

  stop() {
    // Implement stop logic
  }
}
```


---

### 5. Tool Registry and File System Tools (Requirements 5, 29-32)

#### Tool Registry

```typescript
// tools/ToolRegistry.ts
import * as vscode from 'vscode';
import { FileSystemTools } from './FileSystemTools';
import { TerminalTools } from './TerminalTools';
import { GitTools } from './GitTools';
import { DiagnosticsTools } from './DiagnosticsTools';

export interface Tool {
  name: string;
  description: string;
  inputSchema: any;
  execute: (args: any) => Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor(private context: vscode.ExtensionContext) {}

  registerAllTools() {
    // Register file system tools
    const fsTools = new FileSystemTools();
    this.registerTool(fsTools.readFile());
    this.registerTool(fsTools.writeFile());
    this.registerTool(fsTools.listFiles());
    this.registerTool(fsTools.listDirectory());
    this.registerTool(fsTools.createDirectory());
    this.registerTool(fsTools.deleteFile());
    this.registerTool(fsTools.copyFile());
    this.registerTool(fsTools.renameFile());
    this.registerTool(fsTools.getFileStats());
    this.registerTool(fsTools.watchFiles());
    this.registerTool(fsTools.findFiles());
    this.registerTool(fsTools.searchInFiles());

    // Register terminal tools
    const terminalTools = new TerminalTools();
    this.registerTool(terminalTools.runCommand());
    this.registerTool(terminalTools.createTerminal());

    // Register git tools
    const gitTools = new GitTools();
    this.registerTool(gitTools.gitStatus());
    this.registerTool(gitTools.gitCommit());
    this.registerTool(gitTools.gitPush());
    this.registerTool(gitTools.gitPull());
    this.registerTool(gitTools.gitCreateBranch());

    // Register diagnostics tools
    const diagnosticsTools = new DiagnosticsTools();
    this.registerTool(diagnosticsTools.getErrors());
    this.registerTool(diagnosticsTools.getDiagnostics());

    console.log(`Registered ${this.tools.size} tools`);
  }

  private registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);

    // Register with VS Code LM Tools API
    this.context.subscriptions.push(
      vscode.lm.registerTool(tool.name, {
        prepareInvocation: async (options: any, token: vscode.CancellationToken) => {
          return {
            invocationMessage: `Executing ${tool.name}...`,
            confirmationMessages: {
              title: tool.name,
              message: new vscode.MarkdownString(`Execute \`${tool.name}\`?`)
            }
          };
        },
        invoke: async (
          options: vscode.LanguageModelToolInvocationOptions<any>,
          token: vscode.CancellationToken
        ) => {
          try {
            const result = await tool.execute(options.input);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify(result))
            ]);
          } catch (error) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(JSON.stringify({ error: error.message }))
            ]);
          }
        }
      })
    );
  }

  getToolDefinitions(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
  }

  async executeTool(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return await tool.execute(args);
  }
}
```

#### File System Tools

```typescript
// tools/FileSystemTools.ts
import * as vscode from 'vscode';
import { Tool } from './ToolRegistry';

export class FileSystemTools {
  readFile(): Tool {
    return {
      name: 'forgeai_readFile',
      description: 'Read the contents of a file in the workspace',
      inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the file'
          }
        }
      },
      execute: async (args: { path: string }) => {
        const uri = vscode.Uri.file(args.path);
        const content = await vscode.workspace.fs.readFile(uri);
        return {
          path: args.path,
          content: Buffer.from(content).toString('utf8')
        };
      }
    };
  }

  writeFile(): Tool {
    return {
      name: 'forgeai_writeFile',
      description: 'Write or update a file in the workspace',
      inputSchema: {
        type: 'object',
        required: ['path', 'content'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the file'
          },
          content: {
            type: 'string',
            description: 'Content to write to the file'
          }
        }
      },
      execute: async (args: { path: string; content: string }) => {
        const uri = vscode.Uri.file(args.path);
        const buffer = Buffer.from(args.content, 'utf8');
        await vscode.workspace.fs.writeFile(uri, buffer);
        return {
          path: args.path,
          success: true
        };
      }
    };
  }

  listFiles(): Tool {
    return {
      name: 'forgeai_listFiles',
      description: 'List files matching a pattern in the workspace',
      inputSchema: {
        type: 'object',
        required: ['pattern'],
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob pattern (e.g., "**/*.ts")'
          }
        }
      },
      execute: async (args: { pattern: string }) => {
        const files = await vscode.workspace.findFiles(args.pattern);
        return {
          pattern: args.pattern,
          files: files.map(uri => uri.fsPath)
        };
      }
    };
  }

  listDirectory(): Tool {
    return {
      name: 'forgeai_listDirectory',
      description: 'List contents of a directory',
      inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the directory'
          }
        }
      },
      execute: async (args: { path: string }) => {
        const uri = vscode.Uri.file(args.path);
        const entries = await vscode.workspace.fs.readDirectory(uri);
        return {
          path: args.path,
          entries: entries.map(([name, type]) => ({
            name,
            type: type === vscode.FileType.File ? 'file' : 'directory'
          }))
        };
      }
    };
  }

  createDirectory(): Tool {
    return {
      name: 'forgeai_createDirectory',
      description: 'Create a new directory',
      inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the directory to create'
          }
        }
      },
      execute: async (args: { path: string }) => {
        const uri = vscode.Uri.file(args.path);
        await vscode.workspace.fs.createDirectory(uri);
        return {
          path: args.path,
          success: true
        };
      }
    };
  }

  deleteFile(): Tool {
    return {
      name: 'forgeai_deleteFile',
      description: 'Delete a file or directory',
      inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the file or directory'
          }
        }
      },
      execute: async (args: { path: string }) => {
        const uri = vscode.Uri.file(args.path);
        await vscode.workspace.fs.delete(uri, { recursive: true });
        return {
          path: args.path,
          success: true
        };
      }
    };
  }

  copyFile(): Tool {
    return {
      name: 'forgeai_copyFile',
      description: 'Copy a file from source to destination',
      inputSchema: {
        type: 'object',
        required: ['source', 'destination'],
        properties: {
          source: {
            type: 'string',
            description: 'Source file path'
          },
          destination: {
            type: 'string',
            description: 'Destination file path'
          }
        }
      },
      execute: async (args: { source: string; destination: string }) => {
        const sourceUri = vscode.Uri.file(args.source);
        const destUri = vscode.Uri.file(args.destination);
        await vscode.workspace.fs.copy(sourceUri, destUri, { overwrite: true });
        return {
          source: args.source,
          destination: args.destination,
          success: true
        };
      }
    };
  }

  renameFile(): Tool {
    return {
      name: 'forgeai_renameFile',
      description: 'Rename or move a file',
      inputSchema: {
        type: 'object',
        required: ['oldPath', 'newPath'],
        properties: {
          oldPath: {
            type: 'string',
            description: 'Current file path'
          },
          newPath: {
            type: 'string',
            description: 'New file path'
          }
        }
      },
      execute: async (args: { oldPath: string; newPath: string }) => {
        const oldUri = vscode.Uri.file(args.oldPath);
        const newUri = vscode.Uri.file(args.newPath);
        await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: true });
        return {
          oldPath: args.oldPath,
          newPath: args.newPath,
          success: true
        };
      }
    };
  }

  getFileStats(): Tool {
    return {
      name: 'forgeai_getFileStats',
      description: 'Get file metadata (size, creation time, modification time)',
      inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the file'
          }
        }
      },
      execute: async (args: { path: string }) => {
        const uri = vscode.Uri.file(args.path);
        const stat = await vscode.workspace.fs.stat(uri);
        return {
          path: args.path,
          type: stat.type === vscode.FileType.File ? 'file' : 'directory',
          size: stat.size,
          ctime: stat.ctime,
          mtime: stat.mtime
        };
      }
    };
  }

  watchFiles(): Tool {
    return {
      name: 'forgeai_watchFiles',
      description: 'Watch files for changes (create, modify, delete)',
      inputSchema: {
        type: 'object',
        required: ['pattern'],
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob pattern to watch (e.g., "**/*.ts")'
          }
        }
      },
      execute: async (args: { pattern: string }) => {
        // Note: This returns a watcher ID, actual watching happens in Extension Host
        const watcherId = `watcher-${Date.now()}`;
        const watcher = vscode.workspace.createFileSystemWatcher(args.pattern);

        // Store watcher for cleanup
        // (In real implementation, store in a Map for later disposal)

        return {
          watcherId,
          pattern: args.pattern,
          message: 'File watcher created. Events will be sent via postMessage.'
        };
      }
    };
  }

  findFiles(): Tool {
    return {
      name: 'forgeai_findFiles',
      description: 'Search for files by pattern with include/exclude filters',
      inputSchema: {
        type: 'object',
        required: ['include'],
        properties: {
          include: {
            type: 'string',
            description: 'Include pattern (e.g., "**/*.ts")'
          },
          exclude: {
            type: 'string',
            description: 'Exclude pattern (e.g., "**/node_modules/**")'
          }
        }
      },
      execute: async (args: { include: string; exclude?: string }) => {
        const files = await vscode.workspace.findFiles(
          args.include,
          args.exclude || null
        );
        return {
          include: args.include,
          exclude: args.exclude,
          files: files.map(uri => uri.fsPath)
        };
      }
    };
  }

  searchInFiles(): Tool {
    return {
      name: 'forgeai_searchInFiles',
      description: 'Search for text content in files',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Search query string'
          },
          filePattern: {
            type: 'string',
            description: 'File pattern to search in (e.g., "**/*.ts")'
          }
        }
      },
      execute: async (args: { query: string; filePattern?: string }) => {
        const pattern = args.filePattern || '**/*';
        const files = await vscode.workspace.findFiles(pattern);
        const results: any[] = [];

        for (const file of files) {
          try {
            const content = await vscode.workspace.fs.readFile(file);
            const text = Buffer.from(content).toString('utf8');
            const lines = text.split('\n');

            lines.forEach((line, index) => {
              if (line.includes(args.query)) {
                // Include context lines (2 before and 2 after)
                const contextStart = Math.max(0, index - 2);
                const contextEnd = Math.min(lines.length, index + 3);
                const context = lines.slice(contextStart, contextEnd).join('\n');

                results.push({
                  file: file.fsPath,
                  line: index + 1,
                  text: line.trim(),
                  context
                });
              }
            });
          } catch (error) {
            // Skip files that can't be read
          }
        }

        return {
          query: args.query,
          filePattern: pattern,
          results,
          count: results.length
        };
      }
    };
  }
}
```


#### Terminal Tools

```typescript
// tools/TerminalTools.ts
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from './ToolRegistry';

const execAsync = promisify(exec);

export class TerminalTools {
  runCommand(): Tool {
    return {
      name: 'forgeai_runCommand',
      description: 'Execute a shell command and return the output',
      inputSchema: {
        type: 'object',
        required: ['command'],
        properties: {
          command: {
            type: 'string',
            description: 'Shell command to execute'
          },
          cwd: {
            type: 'string',
            description: 'Working directory (optional)'
          }
        }
      },
      execute: async (args: { command: string; cwd?: string }) => {
        try {
          const options = args.cwd ? { cwd: args.cwd } : {};
          const { stdout, stderr } = await execAsync(args.command, options);
          return {
            command: args.command,
            stdout,
            stderr,
            exitCode: 0,
            success: true
          };
        } catch (error: any) {
          return {
            command: args.command,
            stdout: error.stdout || '',
            stderr: error.stderr || error.message,
            exitCode: error.code || 1,
            success: false
          };
        }
      }
    };
  }

  createTerminal(): Tool {
    return {
      name: 'forgeai_createTerminal',
      description: 'Create a new terminal and optionally execute a command',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Terminal name'
          },
          command: {
            type: 'string',
            description: 'Command to execute in the terminal'
          }
        }
      },
      execute: async (args: { name?: string; command?: string }) => {
        const terminal = vscode.window.createTerminal({
          name: args.name || 'ForgeAI',
          cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        });

        terminal.show();

        if (args.command) {
          terminal.sendText(args.command, true);
        }

        return {
          name: args.name || 'ForgeAI',
          command: args.command,
          success: true
        };
      }
    };
  }
}
```

#### Git Tools

```typescript
// tools/GitTools.ts
import * as vscode from 'vscode';
import { Tool } from './ToolRegistry';

export class GitTools {
  private getGitAPI() {
    const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
    if (!gitExtension) {
      throw new Error('Git extension not found');
    }
    return gitExtension.getAPI(1);
  }

  gitStatus(): Tool {
    return {
      name: 'forgeai_gitStatus',
      description: 'Get current git status (branch, changes, staged files)',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      execute: async () => {
        const git = this.getGitAPI();
        const repo = git.repositories[0];

        if (!repo) {
          throw new Error('No git repository found');
        }

        const status = repo.state;
        return {
          branch: status.HEAD?.name || 'unknown',
          changes: status.workingTreeChanges.length,
          staged: status.indexChanges.length,
          ahead: status.HEAD?.ahead || 0,
          behind: status.HEAD?.behind || 0
        };
      }
    };
  }

  gitCommit(): Tool {
    return {
      name: 'forgeai_gitCommit',
      description: 'Stage and commit changes with a message',
      inputSchema: {
        type: 'object',
        required: ['message'],
        properties: {
          message: {
            type: 'string',
            description: 'Commit message'
          },
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files to stage (optional, stages all if not provided)'
          }
        }
      },
      execute: async (args: { message: string; files?: string[] }) => {
        try {
          const git = this.getGitAPI();
          const repo = git.repositories[0];

          if (!repo) {
            throw new Error('No git repository found');
          }

          // Stage files
          if (args.files && args.files.length > 0) {
            await repo.add(args.files);
          } else {
            await repo.add([]);  // Stage all
          }

          // Commit
          await repo.commit(args.message);

          return {
            message: args.message,
            files: args.files,
            success: true
          };
        } catch (error: any) {
          return {
            message: args.message,
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  gitPush(): Tool {
    return {
      name: 'forgeai_gitPush',
      description: 'Push commits to remote repository',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      execute: async () => {
        try {
          const git = this.getGitAPI();
          const repo = git.repositories[0];

          if (!repo) {
            throw new Error('No git repository found');
          }

          await repo.push();

          return {
            success: true
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  gitPull(): Tool {
    return {
      name: 'forgeai_gitPull',
      description: 'Pull changes from remote repository',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      execute: async () => {
        try {
          const git = this.getGitAPI();
          const repo = git.repositories[0];

          if (!repo) {
            throw new Error('No git repository found');
          }

          await repo.pull();

          return {
            success: true
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  gitCreateBranch(): Tool {
    return {
      name: 'forgeai_gitCreateBranch',
      description: 'Create a new git branch and optionally checkout',
      inputSchema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Branch name'
          },
          checkout: {
            type: 'boolean',
            description: 'Checkout the new branch (default: true)'
          }
        }
      },
      execute: async (args: { name: string; checkout?: boolean }) => {
        try {
          const git = this.getGitAPI();
          const repo = git.repositories[0];

          if (!repo) {
            throw new Error('No git repository found');
          }

          const checkout = args.checkout !== false;
          await repo.createBranch(args.name, checkout);

          return {
            name: args.name,
            checkout,
            success: true
          };
        } catch (error: any) {
          return {
            name: args.name,
            success: false,
            error: error.message
          };
        }
      }
    };
  }
}
```

#### Diagnostics Tools

```typescript
// tools/DiagnosticsTools.ts
import * as vscode from 'vscode';
import { Tool } from './ToolRegistry';

export class DiagnosticsTools {
  getErrors(): Tool {
    return {
      name: 'forgeai_getErrors',
      description: 'Get all errors and warnings from the workspace',
      inputSchema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description: 'Specific file path (optional, gets all if not provided)'
          }
        }
      },
      execute: async (args: { file?: string }) => {
        const results: any[] = [];

        if (args.file) {
          // Get diagnostics for specific file
          const uri = vscode.Uri.file(args.file);
          const diagnostics = vscode.languages.getDiagnostics(uri);

          for (const diagnostic of diagnostics) {
            results.push({
              file: args.file,
              line: diagnostic.range.start.line + 1,
              column: diagnostic.range.start.character + 1,
              message: diagnostic.message,
              severity: this.getSeverityString(diagnostic.severity),
              source: diagnostic.source || 'unknown'
            });
          }
        } else {
          // Get all diagnostics
          const allDiagnostics = vscode.languages.getDiagnostics();

          for (const [uri, diagnostics] of allDiagnostics) {
            for (const diagnostic of diagnostics) {
              results.push({
                file: uri.fsPath,
                line: diagnostic.range.start.line + 1,
                column: diagnostic.range.start.character + 1,
                message: diagnostic.message,
                severity: this.getSeverityString(diagnostic.severity),
                source: diagnostic.source || 'unknown'
              });
            }
          }
        }

        return {
          file: args.file,
          diagnostics: results,
          count: results.length,
          errors: results.filter(d => d.severity === 'error').length,
          warnings: results.filter(d => d.severity === 'warning').length
        };
      }
    };
  }

  getDiagnostics(): Tool {
    return {
      name: 'forgeai_getDiagnostics',
      description: 'Get diagnostics for a specific file',
      inputSchema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            description: 'File path'
          }
        }
      },
      execute: async (args: { file: string }) => {
        const uri = vscode.Uri.file(args.file);
        const diagnostics = vscode.languages.getDiagnostics(uri);

        return {
          file: args.file,
          diagnostics: diagnostics.map(d => ({
            line: d.range.start.line + 1,
            column: d.range.start.character + 1,
            message: d.message,
            severity: this.getSeverityString(d.severity),
            source: d.source || 'unknown'
          })),
          count: diagnostics.length
        };
      }
    };
  }

  private getSeverityString(severity: vscode.DiagnosticSeverity): string {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return 'error';
      case vscode.DiagnosticSeverity.Warning:
        return 'warning';
      case vscode.DiagnosticSeverity.Information:
        return 'info';
      case vscode.DiagnosticSeverity.Hint:
        return 'hint';
      default:
        return 'unknown';
    }
  }
}
```

---

### 6. Storage Manager (Requirements 10, 44)

```typescript
// storage/StorageManager.ts
import * as vscode from 'vscode';

export class StorageManager {
  constructor(private context: vscode.ExtensionContext) {}

  // Workspace State (per-workspace)
  async getWorkspaceState(key: string): Promise<any> {
    return this.context.workspaceState.get(key);
  }

  async setWorkspaceState(key: string, value: any): Promise<void> {
    await this.context.workspaceState.update(key, value);
  }

  // Global State (user-level, syncs across machines)
  async getGlobalState(key: string): Promise<any> {
    return this.context.globalState.get(key);
  }

  async setGlobalState(key: string, value: any): Promise<void> {
    await this.context.globalState.update(key, value);
  }

  // Enable sync for specific keys
  setKeysForSync(keys: string[]): void {
    this.context.globalState.setKeysForSync(keys);
  }

  // Secrets (encrypted storage)
  async getSecret(key: string): Promise<string | undefined> {
    return await this.context.secrets.get(key);
  }

  async setSecret(key: string, value: string): Promise<void> {
    await this.context.secrets.store(key, value);
  }

  async deleteSecret(key: string): Promise<void> {
    await this.context.secrets.delete(key);
  }
}
```

---

### 7. Webview Creation and Message Passing (Requirement 6)

```typescript
// extension.ts (continued)
function createWebviewPanel(
  context: vscode.ExtensionContext,
  storageManager: StorageManager
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'forgeai',
    'ForgeAI',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'dist'),
        vscode.Uri.joinPath(context.extensionUri, 'resources')
      ]
    }
  );

  // Set HTML content
  panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.type) {
        case 'getState':
          const state = await storageManager.getWorkspaceState(message.key);
          panel.webview.postMessage({
            type: 'stateResponse',
            key: message.key,
            value: state
          });
          break;

        case 'setState':
          await storageManager.setWorkspaceState(message.key, message.value);
          break;

        case 'sendMessage':
          // Handle chat message
          handleChatMessage(message.content, panel.webview);
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    },
    undefined,
    context.subscriptions
  );

  return panel;
}

function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css')
  );

  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link href="${styleUri}" rel="stylesheet">
  <title>ForgeAI</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function handleChatMessage(content: string, webview: vscode.Webview) {
  // This will be implemented with AgentLoop
  // For now, just echo back
  webview.postMessage({
    type: 'streamChunk',
    data: {
      content: `Echo: ${content}`
    }
  });
}
```


---

## Webview / React Application Architecture

### 1. React 19 Application Setup (Requirements 7, 38-40)

#### Entry Point (index.tsx)

```typescript
// webview/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

#### Root Component (App.tsx)

```typescript
// webview/App.tsx
import React, { Suspense } from 'react';
import { useConversationStore } from './store/conversationStore';
import SplitScreen from './components/SplitScreen/SplitScreen';
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen';

// Lazy load heavy components
const Settings = React.lazy(() => import('./components/Settings/Settings'));

function App() {
  const conversations = useConversationStore(state => state.conversations);
  const showWelcome = conversations.length === 0;

  return (
    <div className="h-screen w-screen overflow-hidden bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
      {showWelcome ? (
        <WelcomeScreen />
      ) : (
        <SplitScreen />
      )}
      
      <Suspense fallback={<div>Loading...</div>}>
        {/* Settings panel loaded on demand */}
      </Suspense>
    </div>
  );
}

export default App;
```

---

### 2. Zustand v5 State Management (Requirements 9, 43-44)

#### Conversation Store

```typescript
// store/conversationStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { vscodeStorageAdapter } from './vscodeStorageAdapter';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  thinking?: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
  timestamp: number;
}

export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface Tab {
  id: string;
  title: string;
  conversationId: string;
  createdAt: number;
}

interface ConversationStore {
  // State
  conversations: Conversation[];
  tabs: Tab[];
  activeTabId: string | null;
  
  // Actions
  addConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  clearConversation: (conversationId: string) => void;
  
  // Tab actions
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  switchTab: (id: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
}

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      tabs: [],
      activeTabId: null,
      
      addConversation: (conversation) => {
        set((state) => ({
          conversations: [...state.conversations, conversation]
        }));
      },
      
      removeConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.filter(c => c.id !== id)
        }));
      },
      
      addMessage: (conversationId, message) => {
        set((state) => ({
          conversations: state.conversations.map(c =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  updatedAt: Date.now()
                }
              : c
          )
        }));
      },
      
      updateMessage: (conversationId, messageId, updates) => {
        set((state) => ({
          conversations: state.conversations.map(c =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === messageId ? { ...m, ...updates } : m
                  )
                }
              : c
          )
        }));
      },
      
      clearConversation: (conversationId) => {
        set((state) => ({
          conversations: state.conversations.map(c =>
            c.id === conversationId
              ? { ...c, messages: [], updatedAt: Date.now() }
              : c
          )
        }));
      },
      
      addTab: (tab) => {
        set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: tab.id
        }));
      },
      
      removeTab: (id) => {
        set((state) => {
          const tabs = state.tabs.filter(t => t.id !== id);
          const activeTabId = state.activeTabId === id
            ? tabs[tabs.length - 1]?.id || null
            : state.activeTabId;
          
          return { tabs, activeTabId };
        });
      },
      
      switchTab: (id) => {
        set({ activeTabId: id });
      },
      
      updateTabTitle: (id, title) => {
        set((state) => ({
          tabs: state.tabs.map(t =>
            t.id === id ? { ...t, title } : t
          )
        }));
      },
      
      reorderTabs: (fromIndex, toIndex) => {
        set((state) => {
          const tabs = [...state.tabs];
          const [removed] = tabs.splice(fromIndex, 1);
          tabs.splice(toIndex, 0, removed);
          return { tabs };
        });
      }
    }),
    {
      name: 'forgeai-conversations',
      storage: vscodeStorageAdapter
    }
  )
);
```

#### VS Code Storage Adapter

```typescript
// store/vscodeStorageAdapter.ts
import { StateStorage } from 'zustand/middleware';

// VS Code API is available as global vscode object in webview
declare const vscode: any;

let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_DELAY = 1000; // 1 second

export const vscodeStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      // Request state from extension host
      vscode.postMessage({ type: 'getState', key: name });
      
      // Listen for response
      const handler = (event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'stateResponse' && message.key === name) {
          window.removeEventListener('message', handler);
          resolve(message.value ? JSON.stringify(message.value) : null);
        }
      };
      
      window.addEventListener('message', handler);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 5000);
    });
  },
  
  setItem: async (name: string, value: string): Promise<void> => {
    // Debounce writes to avoid excessive storage operations
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      try {
        const parsed = JSON.parse(value);
        vscode.postMessage({ type: 'setState', key: name, value: parsed });
      } catch (error) {
        console.error('Failed to parse state for storage:', error);
      }
    }, DEBOUNCE_DELAY);
  },
  
  removeItem: async (name: string): Promise<void> => {
    vscode.postMessage({ type: 'setState', key: name, value: undefined });
  }
};
```

---

### 3. Split-Screen Layout (Requirements 11, 36)

```typescript
// components/SplitScreen/SplitScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import ActivityStream from '../ActivityStream/ActivityStream';
import LivePreview from '../LivePreview/LivePreview';

function SplitScreen() {
  const [leftWidth, setLeftWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Constrain between 30% and 70%
    setLeftWidth(Math.max(30, Math.min(70, newLeftWidth)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Responsive behavior
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showSplitScreen = windowWidth >= 1200;

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {/* Activity Stream (Left Panel) */}
      <div
        className="h-full overflow-hidden"
        style={{ width: showSplitScreen ? `${leftWidth}%` : '100%' }}
      >
        <ActivityStream />
      </div>

      {/* Draggable Divider */}
      {showSplitScreen && (
        <div
          className="w-1 h-full cursor-col-resize bg-(--vscode-panel-border) hover:bg-(--vscode-focusBorder) transition-colors"
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Live Preview (Right Panel) */}
      {showSplitScreen && (
        <div
          className="h-full overflow-hidden"
          style={{ width: `${100 - leftWidth}%` }}
        >
          <LivePreview />
        </div>
      )}
    </div>
  );
}

export default SplitScreen;
```

---

### 4. Activity Stream Component (Requirements 12, 34)

```typescript
// components/ActivityStream/ActivityStream.tsx
import React, { useRef, useEffect, useState } from 'react';
import { useConversationStore } from '../../store/conversationStore';
import TabBar from './TabBar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

function ActivityStream() {
  const activeTabId = useConversationStore(state => state.activeTabId);
  const conversations = useConversationStore(state => state.conversations);
  const tabs = useConversationStore(state => state.tabs);
  
  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeConversation = conversations.find(c => c.id === activeTab?.conversationId);
  
  const [filter, setFilter] = useState<'all' | 'user' | 'assistant' | 'tool' | 'thinking'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation?.messages, autoScroll]);

  // Detect manual scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className="flex flex-col h-full bg-(--vscode-editor-background)">
      {/* Tab Bar */}
      <TabBar />

      {/* Filter and Search */}
      <div className="flex items-center gap-2 p-2 border-b border-(--vscode-panel-border)">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-2 py-1 rounded bg-(--vscode-input-background) text-(--vscode-input-foreground) border border-(--vscode-input-border)"
        >
          <option value="all">All</option>
          <option value="user">User</option>
          <option value="assistant">Assistant</option>
          <option value="tool">Tools</option>
          <option value="thinking">Thinking</option>
        </select>
        
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-2 py-1 rounded bg-(--vscode-input-background) text-(--vscode-input-foreground) border border-(--vscode-input-border) placeholder:text-(--vscode-input-placeholderForeground)"
        />
      </div>

      {/* Message List */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {activeConversation ? (
          <MessageList
            messages={activeConversation.messages}
            filter={filter}
            searchQuery={searchQuery}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-(--vscode-descriptionForeground)">
            No active conversation
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Jump to Latest Button */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="absolute bottom-20 right-4 px-4 py-2 rounded bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground) shadow-lg"
        >
          ↓ Jump to latest
        </button>
      )}

      {/* Message Input */}
      <MessageInput conversationId={activeConversation?.id} />
    </div>
  );
}

export default ActivityStream;
```


#### Tab Bar Component (Requirements 16, 37)

```typescript
// components/ActivityStream/TabBar.tsx
import React, { useState } from 'react';
import { useConversationStore } from '../../store/conversationStore';

function TabBar() {
  const tabs = useConversationStore(state => state.tabs);
  const activeTabId = useConversationStore(state => state.activeTabId);
  const switchTab = useConversationStore(state => state.switchTab);
  const removeTab = useConversationStore(state => state.removeTab);
  const addTab = useConversationStore(state => state.addTab);
  const addConversation = useConversationStore(state => state.addConversation);
  const reorderTabs = useConversationStore(state => state.reorderTabs);
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);

  const handleNewTab = () => {
    const conversationId = crypto.randomUUID();
    const tabId = crypto.randomUUID();
    
    // Create new conversation
    addConversation({
      id: conversationId,
      title: 'New Conversation',
      messages: [],
      model: 'qwen3-coder-397b',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    // Create new tab
    addTab({
      id: tabId,
      title: 'New Conversation',
      conversationId,
      createdAt: Date.now()
    });
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    removeTab(tabId);
  };

  const handleMiddleClick = (e: React.MouseEvent, tabId: string) => {
    if (e.button === 1) {  // Middle mouse button
      e.preventDefault();
      removeTab(tabId);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    reorderTabs(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="flex items-center gap-1 bg-(--vscode-editorGroupHeader-tabsBackground) border-b border-(--vscode-editorGroupHeader-tabsBorder) overflow-x-auto">
      {tabs.slice(0, 10).map((tab, index) => (
        <div
          key={tab.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          onMouseDown={(e) => handleMiddleClick(e, tab.id)}
          onContextMenu={(e) => handleContextMenu(e, tab.id)}
          onClick={() => switchTab(tab.id)}
          className={`
            flex items-center gap-2 px-3 py-2 cursor-pointer min-w-32 max-w-48
            ${tab.id === activeTabId
              ? 'bg-(--vscode-tab-activeBackground) text-(--vscode-tab-activeForeground) border-b-2 border-(--vscode-tab-activeBorder)'
              : 'bg-(--vscode-tab-inactiveBackground) text-(--vscode-tab-inactiveForeground) hover:bg-(--vscode-tab-hoverBackground)'
            }
          `}
        >
          <span className="text-sm truncate flex-1">{tab.title}</span>
          <button
            onClick={(e) => handleCloseTab(e, tab.id)}
            className="hover:bg-(--vscode-toolbar-hoverBackground) rounded p-1 text-xs"
          >
            ×
          </button>
        </div>
      ))}
      
      {tabs.length > 10 && (
        <div className="px-2 text-sm text-(--vscode-descriptionForeground)">
          +{tabs.length - 10} more
        </div>
      )}
      
      <button
        onClick={handleNewTab}
        className="px-3 py-2 hover:bg-(--vscode-toolbar-hoverBackground) text-(--vscode-foreground)"
      >
        +
      </button>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-(--vscode-menu-background) border border-(--vscode-menu-border) shadow-lg rounded z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button className="block w-full px-4 py-2 text-left hover:bg-(--vscode-menu-selectionBackground) text-(--vscode-menu-foreground)">
            Rename
          </button>
          <button className="block w-full px-4 py-2 text-left hover:bg-(--vscode-menu-selectionBackground) text-(--vscode-menu-foreground)">
            Duplicate
          </button>
          <div className="border-t border-(--vscode-menu-separatorBackground)" />
          <button
            onClick={() => {
              removeTab(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="block w-full px-4 py-2 text-left hover:bg-(--vscode-menu-selectionBackground) text-(--vscode-menu-foreground)"
          >
            Close
          </button>
          <button className="block w-full px-4 py-2 text-left hover:bg-(--vscode-menu-selectionBackground) text-(--vscode-menu-foreground)">
            Close Others
          </button>
          <button className="block w-full px-4 py-2 text-left hover:bg-(--vscode-menu-selectionBackground) text-(--vscode-menu-foreground)">
            Close All
          </button>
          <div className="border-t border-(--vscode-menu-separatorBackground)" />
          <button className="block w-full px-4 py-2 text-left hover:bg-(--vscode-menu-selectionBackground) text-(--vscode-menu-foreground)">
            Export Conversation
          </button>
        </div>
      )}
    </div>
  );
}

export default TabBar;
```

#### Message List Component

```typescript
// components/ActivityStream/MessageList.tsx
import React from 'react';
import { Message } from '../../store/conversationStore';
import ThinkingBlock from './ThinkingBlock';
import ToolCard from './ToolCard';

interface MessageListProps {
  messages: Message[];
  filter: 'all' | 'user' | 'assistant' | 'tool' | 'thinking';
  searchQuery: string;
}

function MessageList({ messages, filter, searchQuery }: MessageListProps) {
  // Filter messages
  const filteredMessages = messages.filter(msg => {
    // Apply filter
    if (filter !== 'all') {
      if (filter === 'thinking' && !msg.thinking) return false;
      if (filter !== 'thinking' && msg.role !== filter) return false;
    }
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        msg.content.toLowerCase().includes(query) ||
        msg.thinking?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  return (
    <div className="p-4 space-y-4">
      {filteredMessages.map((message) => (
        <div key={message.id} className="space-y-2">
          {/* Thinking Block */}
          {message.thinking && (
            <ThinkingBlock thinking={message.thinking} />
          )}

          {/* Tool Calls */}
          {message.tool_calls?.map((toolCall, index) => (
            <ToolCard
              key={`${message.id}-tool-${index}`}
              toolCall={toolCall}
              status="complete"
            />
          ))}

          {/* Message Content */}
          {message.content && (
            <div
              className={`
                p-3 rounded
                ${message.role === 'user'
                  ? 'bg-(--vscode-input-background) text-(--vscode-input-foreground) ml-8'
                  : message.role === 'assistant'
                  ? 'bg-(--vscode-editor-background) text-(--vscode-editor-foreground)'
                  : 'bg-(--vscode-textCodeBlock-background) text-(--vscode-textPreformat-foreground) text-sm'
                }
              `}
            >
              <div className="flex items-start gap-2">
                <span className="font-semibold text-xs text-(--vscode-descriptionForeground)">
                  {message.role === 'user' ? 'You' : message.role === 'assistant' ? 'ForgeAI' : message.tool_name}
                </span>
                <span className="text-xs text-(--vscode-descriptionForeground)">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="mt-2 whitespace-pre-wrap">{message.content}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default MessageList;
```

#### Thinking Block Component (Requirements 14, 33)

```typescript
// components/ActivityStream/ThinkingBlock.tsx
import React, { useState } from 'react';

interface ThinkingBlockProps {
  thinking: string;
}

function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  // Calculate confidence based on language patterns
  const confidence = calculateConfidence(thinking);

  const firstLine = thinking.split('\n')[0];

  return (
    <div className="border border-(--vscode-panel-border) rounded p-3 bg-(--vscode-textBlockQuote-background)">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">🧠 Thinking</span>
          <span
            className={`
              text-xs px-2 py-1 rounded
              ${confidence === 'high'
                ? 'bg-green-500/20 text-green-400'
                : confidence === 'medium'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
              }
            `}
          >
            {confidence === 'high' ? '✅ High' : confidence === 'medium' ? '⚠️ Medium' : '🔴 Low'}
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-(--vscode-textLink-foreground) hover:underline"
        >
          {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
        </button>
      </div>

      <div className="mt-2">
        {isExpanded ? (
          <div className="whitespace-pre-wrap text-sm">{thinking}</div>
        ) : (
          <div className="text-sm text-(--vscode-descriptionForeground)">{firstLine}...</div>
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowWhy(!showWhy)}
            className="text-xs px-3 py-1 rounded bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground) hover:bg-(--vscode-button-secondaryHoverBackground)"
          >
            Why?
          </button>
          <span className="text-xs text-(--vscode-descriptionForeground)">
            {thinking.split(' ').length} tokens
          </span>
        </div>
      )}

      {showWhy && (
        <div className="mt-3 p-3 border-l-2 border-(--vscode-textLink-foreground) bg-(--vscode-editor-background) text-sm">
          <strong>Detailed Reasoning:</strong>
          <p className="mt-2">
            This approach was chosen because it provides the most direct path to solving the problem
            while maintaining code quality and following best practices.
          </p>
        </div>
      )}
    </div>
  );
}

function calculateConfidence(thinking: string): 'high' | 'medium' | 'low' {
  const lowerThinking = thinking.toLowerCase();
  
  // High confidence indicators
  const highConfidence = ['i found', 'clearly', 'definitely', 'certain', 'confident'];
  const highCount = highConfidence.filter(word => lowerThinking.includes(word)).length;
  
  // Low confidence indicators
  const lowConfidence = ['maybe', 'might', 'possibly', 'unsure', 'not certain', '?'];
  const lowCount = lowConfidence.filter(word => lowerThinking.includes(word)).length;
  
  if (highCount >= 2 && lowCount === 0) return 'high';
  if (lowCount >= 2) return 'low';
  return 'medium';
}

export default ThinkingBlock;
```

#### Tool Card Component (Requirements 15, 35)

```typescript
// components/ActivityStream/ToolCard.tsx
import React, { useState } from 'react';
import { ToolCall } from '../../store/conversationStore';

interface ToolCardProps {
  toolCall: ToolCall;
  status: 'pending' | 'running' | 'complete' | 'error';
  result?: any;
  error?: string;
  duration?: number;
}

function ToolCard({ toolCall, status, result, error, duration }: ToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'running':
        return '⚙️';
      case 'complete':
        return '✓';
      case 'error':
        return '❌';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400';
      case 'running':
        return 'text-blue-400';
      case 'complete':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
    }
  };

  return (
    <div className="border border-(--vscode-panel-border) rounded p-3 bg-(--vscode-editor-background)">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={getStatusColor()}>{getStatusIcon()}</span>
          <span className="text-sm font-semibold">{toolCall.function.name}</span>
          <span className="text-xs text-(--vscode-descriptionForeground)">
            {JSON.stringify(toolCall.function.arguments).slice(0, 50)}...
          </span>
        </div>
        <div className="flex items-center gap-2">
          {duration && (
            <span className="text-xs text-(--vscode-descriptionForeground)">
              {duration}ms
            </span>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-(--vscode-textLink-foreground) hover:underline"
          >
            {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
          </button>
        </div>
      </div>

      {status === 'running' && (
        <div className="mt-2">
          <div className="w-full bg-(--vscode-progressBar-background) rounded-full h-2">
            <div className="bg-(--vscode-progressBar-foreground) h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 space-y-2">
          <div>
            <strong className="text-xs">Input:</strong>
            <pre className="mt-1 p-2 bg-(--vscode-textCodeBlock-background) rounded text-xs overflow-x-auto">
              {JSON.stringify(toolCall.function.arguments, null, 2)}
            </pre>
          </div>
          
          {result && (
            <div>
              <strong className="text-xs">Output:</strong>
              <pre className="mt-1 p-2 bg-(--vscode-textCodeBlock-background) rounded text-xs overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
          
          {error && (
            <div>
              <strong className="text-xs text-red-400">Error:</strong>
              <pre className="mt-1 p-2 bg-red-500/10 rounded text-xs text-red-400">
                {error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolCard;
```


#### Message Input Component (Requirements 17, 38, 39)

```typescript
// components/ActivityStream/MessageInput.tsx
import React, { useActionState, useOptimistic } from 'react';
import { useConversationStore } from '../../store/conversationStore';

declare const vscode: any;

interface MessageInputProps {
  conversationId?: string;
}

function MessageInput({ conversationId }: MessageInputProps) {
  const addMessage = useConversationStore(state => state.addMessage);
  
  // useActionState for form handling (React 19)
  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const content = formData.get('message') as string;
      
      if (!content.trim() || !conversationId) {
        return { success: false, error: 'Message cannot be empty' };
      }

      try {
        // Add user message optimistically
        const userMessage = {
          id: crypto.randomUUID(),
          role: 'user' as const,
          content,
          timestamp: Date.now()
        };
        
        addMessage(conversationId, userMessage);

        // Send to extension host
        vscode.postMessage({
          type: 'sendMessage',
          conversationId,
          content
        });

        return { success: true, error: null };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
    { success: false, error: null }
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <div className="border-t border-(--vscode-panel-border) p-4">
      {state.error && (
        <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
          {state.error}
        </div>
      )}
      
      <form action={formAction} className="flex flex-col gap-2">
        <textarea
          name="message"
          placeholder="Ask ForgeAI anything..."
          disabled={isPending || !conversationId}
          onKeyDown={handleKeyDown}
          className="w-full p-3 rounded bg-(--vscode-input-background) text-(--vscode-input-foreground) border border-(--vscode-input-border) placeholder:text-(--vscode-input-placeholderForeground) resize-none focus:outline-none focus:ring-2 focus:ring-(--vscode-focusBorder)"
          rows={3}
        />
        
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              className="p-2 rounded hover:bg-(--vscode-toolbar-hoverBackground)"
              title="Attach file"
            >
              📎
            </button>
            <button
              type="button"
              className="p-2 rounded hover:bg-(--vscode-toolbar-hoverBackground)"
              title="Voice input"
            >
              🎤
            </button>
            <button
              type="button"
              className="p-2 rounded hover:bg-(--vscode-toolbar-hoverBackground)"
              title="Settings"
            >
              ⚙️
            </button>
          </div>
          
          <button
            type="submit"
            disabled={isPending || !conversationId}
            className="px-4 py-2 rounded bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground) disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
      
      <div className="mt-2 text-xs text-(--vscode-descriptionForeground)">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}

export default MessageInput;
```

---

### 5. Live Preview Component (Requirements 13, 24)

```typescript
// components/LivePreview/LivePreview.tsx
import React, { useState } from 'react';
import CodeDiff from './CodeDiff';
import TestResults from './TestResults';
import FilePreview from './FilePreview';

type PreviewType = 'diff' | 'test' | 'file' | 'empty';

interface LivePreviewProps {
  type?: PreviewType;
  data?: any;
}

function LivePreview({ type = 'empty', data }: LivePreviewProps) {
  const [activeView, setActiveView] = useState<PreviewType>(type);

  const renderContent = () => {
    switch (activeView) {
      case 'diff':
        return <CodeDiff diff={data} />;
      case 'test':
        return <TestResults results={data} />;
      case 'file':
        return <FilePreview file={data} />;
      case 'empty':
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-(--vscode-descriptionForeground)">
            <div className="text-6xl mb-4">📄</div>
            <div className="text-lg">Code changes and previews</div>
            <div className="text-sm">will appear here</div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-(--vscode-editor-background)">
      {activeView !== 'empty' && (
        <div className="flex items-center justify-between p-2 border-b border-(--vscode-panel-border)">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('diff')}
              className={`px-3 py-1 rounded text-sm ${
                activeView === 'diff'
                  ? 'bg-(--vscode-button-background) text-(--vscode-button-foreground)'
                  : 'hover:bg-(--vscode-toolbar-hoverBackground)'
              }`}
            >
              Code Diff
            </button>
            <button
              onClick={() => setActiveView('test')}
              className={`px-3 py-1 rounded text-sm ${
                activeView === 'test'
                  ? 'bg-(--vscode-button-background) text-(--vscode-button-foreground)'
                  : 'hover:bg-(--vscode-toolbar-hoverBackground)'
              }`}
            >
              Test Results
            </button>
            <button
              onClick={() => setActiveView('file')}
              className={`px-3 py-1 rounded text-sm ${
                activeView === 'file'
                  ? 'bg-(--vscode-button-background) text-(--vscode-button-foreground)'
                  : 'hover:bg-(--vscode-toolbar-hoverBackground)'
              }`}
            >
              File Preview
            </button>
          </div>
          
          <button
            onClick={() => setActiveView('empty')}
            className="p-1 hover:bg-(--vscode-toolbar-hoverBackground) rounded"
          >
            ×
          </button>
        </div>
      )}
      
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}

export default LivePreview;
```

#### Code Diff Component

```typescript
// components/LivePreview/CodeDiff.tsx
import React from 'react';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  lineNumber: number;
  content: string;
}

interface CodeDiffProps {
  diff: {
    file: string;
    lines: DiffLine[];
  };
}

function CodeDiff({ diff }: CodeDiffProps) {
  if (!diff) return null;

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{diff.file}</h3>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)">
            Apply Changes
          </button>
          <button className="px-3 py-1 rounded bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground) hover:bg-(--vscode-button-secondaryHoverBackground)">
            Reject
          </button>
          <button className="px-3 py-1 rounded bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground) hover:bg-(--vscode-button-secondaryHoverBackground)">
            Open in Editor
          </button>
        </div>
      </div>
      
      <div className="border border-(--vscode-panel-border) rounded overflow-hidden">
        {diff.lines.map((line, index) => (
          <div
            key={index}
            className={`
              flex font-mono text-sm
              ${line.type === 'added'
                ? 'bg-green-500/10 text-green-400'
                : line.type === 'removed'
                ? 'bg-red-500/10 text-red-400'
                : 'bg-(--vscode-editor-background) text-(--vscode-editor-foreground)'
              }
            `}
          >
            <span className="px-3 py-1 text-(--vscode-descriptionForeground) select-none w-12 text-right">
              {line.lineNumber}
            </span>
            <span className="px-2 py-1 select-none w-6">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            <span className="px-2 py-1 flex-1">{line.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CodeDiff;
```

---

### 6. Welcome Screen Component (Requirement 22)

```typescript
// components/WelcomeScreen/WelcomeScreen.tsx
import React from 'react';
import { useConversationStore } from '../../store/conversationStore';

function WelcomeScreen() {
  const addConversation = useConversationStore(state => state.addConversation);
  const addTab = useConversationStore(state => state.addTab);

  const handleQuickAction = (prompt: string, title: string) => {
    const conversationId = crypto.randomUUID();
    const tabId = crypto.randomUUID();
    
    // Create new conversation with pre-filled prompt
    addConversation({
      id: conversationId,
      title,
      messages: [
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: prompt,
          timestamp: Date.now()
        }
      ],
      model: 'qwen3-coder-397b',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    // Create new tab
    addTab({
      id: tabId,
      title,
      conversationId,
      createdAt: Date.now()
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
      <h1 className="text-4xl font-bold mb-2">Welcome to ForgeAI 🚀</h1>
      <p className="text-lg text-(--vscode-descriptionForeground) mb-8">
        Your autonomous AI coding assistant
      </p>

      <div className="mb-8 p-4 bg-(--vscode-textBlockQuote-background) border border-(--vscode-panel-border) rounded">
        <div className="flex items-center gap-2">
          <span className="text-green-400">✓</span>
          <span>Connected to <strong>Qwen3-Coder-397B (Cloud)</strong></span>
        </div>
        <p className="text-sm text-(--vscode-descriptionForeground) mt-1">
          Fast, intelligent, and ready to help
        </p>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-center">🎯 What would you like to do?</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleQuickAction('Fix the bug in my code', 'Fix a bug')}
            className="p-6 rounded border border-(--vscode-panel-border) hover:bg-(--vscode-list-hoverBackground) transition-colors text-left"
          >
            <div className="text-2xl mb-2">🐛</div>
            <div className="font-semibold">Fix a bug</div>
            <div className="text-sm text-(--vscode-descriptionForeground)">
              Identify and fix issues in your code
            </div>
          </button>

          <button
            onClick={() => handleQuickAction('Build a new feature', 'Build a feature')}
            className="p-6 rounded border border-(--vscode-panel-border) hover:bg-(--vscode-list-hoverBackground) transition-colors text-left"
          >
            <div className="text-2xl mb-2">✨</div>
            <div className="font-semibold">Build a feature</div>
            <div className="text-sm text-(--vscode-descriptionForeground)">
              Create new functionality from scratch
            </div>
          </button>

          <button
            onClick={() => handleQuickAction('Explain this code to me', 'Explain code')}
            className="p-6 rounded border border-(--vscode-panel-border) hover:bg-(--vscode-list-hoverBackground) transition-colors text-left"
          >
            <div className="text-2xl mb-2">📖</div>
            <div className="font-semibold">Explain code</div>
            <div className="text-sm text-(--vscode-descriptionForeground)">
              Understand how your code works
            </div>
          </button>

          <button
            onClick={() => handleQuickAction('Generate tests for my code', 'Generate tests')}
            className="p-6 rounded border border-(--vscode-panel-border) hover:bg-(--vscode-list-hoverBackground) transition-colors text-left"
          >
            <div className="text-2xl mb-2">🧪</div>
            <div className="font-semibold">Generate tests</div>
            <div className="text-sm text-(--vscode-descriptionForeground)">
              Create comprehensive test suites
            </div>
          </button>
        </div>
      </div>

      <div className="text-sm text-(--vscode-descriptionForeground)">
        💡 Tip: Use <kbd className="px-2 py-1 bg-(--vscode-keybindingLabel-background) border border-(--vscode-keybindingLabel-border) rounded">Cmd+K</kbd> to open the command palette
      </div>
    </div>
  );
}

export default WelcomeScreen;
```

---

### 7. Native CSS Configuration with VS Code Theme Integration (Requirements 8, 41-42)

#### globals.css

```css
/* webview/styles/globals.css */
/* VS Code Native CSS Styling */

/* Global Styles */
:root {
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  margin: 0;
  padding: 0;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell',
    'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

::-webkit-scrollbar-track {
  background: var(--vscode-editor-background);
}

::-webkit-scrollbar-thumb {
  background: var(--vscode-editorGroupHeader-tabsBorder);
  border-radius: 6px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--vscode-editor-lineHighlightBorder);
}

/* Utility classes for VS Code theming */
.bg-editor {
  background-color: var(--vscode-editor-background);
}

.bg-input {
  background-color: var(--vscode-input-background);
}

.bg-button {
  background-color: var(--vscode-button-background);
}

.text-editor {
  color: var(--vscode-editor-foreground);
}

.text-muted {
  color: var(--vscode-descriptionForeground);
}

/* Button styling */
button {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

button:hover {
  background-color: var(--vscode-button-hoverBackground);
}

/* Diff coloring */
.diff-removed {
  background-color: var(--vscode-diffEditor-removedTextBackground);
}

.diff-inserted {
  background-color: var(--vscode-diffEditor-insertedTextBackground);
}

/* Animations */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

#### Component Styling Approach (VS Code Best Practices)

**Primary Method: Global CSS Classes (90%+ of styling)**

Components should primarily use CSS classes from globals.css. This is the preferred approach for VS Code extensions because:
- Better performance (CSS loaded once, not recalculated on every render)
- Automatic theme integration when users change VS Code themes
- Follows conventions used by official VS Code extensions (GitHub Copilot, GitLens)
- Easier to maintain and update styles in one place

**When to Use Each Approach:**

1. **Global CSS Classes (PREFERRED - Use for most styling)**
   ```tsx
   // ✅ GOOD - Use CSS classes for static styling
   <div className="bg-editor text-editor">
     <button className="bg-button">Click me</button>
     <span className="text-muted">Subtitle</span>
   </div>
   ```

2. **Inline Styles (ONLY for truly dynamic values)**
   ```tsx
   // ✅ GOOD - Inline for dynamic values based on props/state
   <div style={{ width: `${progress}%` }}>
     <div style={{ transform: `translateX(${offset}px)` }}>
   
   // ❌ BAD - Don't use inline for static theme colors
   <div style={{ 
     backgroundColor: 'var(--vscode-editor-background)',
     color: 'var(--vscode-editor-foreground)'
   }}>
   
   // ✅ GOOD - Use CSS class instead
   <div className="bg-editor text-editor">
   ```

3. **CSS Modules (OPTIONAL - For complex component-specific styles)**
   ```tsx
   // Use .module.css for component-specific styles that don't fit utility classes
   import styles from './MyComponent.module.css';
   
   <div className={styles.complexLayout}>
     <div className={styles.customGrid}>
   ```

**Styling Priority:**
1. First, check if a utility class exists in globals.css
2. If not, consider adding a new utility class to globals.css
3. For complex component-specific layouts, use CSS modules
4. Only use inline styles for truly dynamic values


---

## Data Models and Type Definitions

### Core Types

```typescript
// types/index.ts

// Message Types
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  thinking?: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
  timestamp: number;
}

export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

// Conversation Types
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: number;
  updatedAt: number;
}

// Tab Types
export interface Tab {
  id: string;
  title: string;
  conversationId: string;
  createdAt: number;
}

// Tool Types
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    required?: string[];
    properties: Record<string, any>;
  };
  execute: (args: any) => Promise<any>;
}

// Ollama Types
export interface OllamaMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  thinking?: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
}

export interface OllamaChatOptions {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  think?: boolean;
  tools?: any[];
}

export interface OllamaChunk {
  message: {
    thinking?: string;
    content?: string;
    tool_calls?: ToolCall[];
  };
  done: boolean;
}

// WebView Message Types
export type WebviewMessage =
  | { type: 'getState'; key: string }
  | { type: 'setState'; key: string; value: any }
  | { type: 'sendMessage'; conversationId: string; content: string }
  | { type: 'stopAgent' }
  | { type: 'applyChanges'; file: string; changes: string };

export type ExtensionMessage =
  | { type: 'stateResponse'; key: string; value: any }
  | { type: 'streamChunk'; data: { thinking?: string; content?: string; toolCalls?: ToolCall[] } }
  | { type: 'toolStart'; toolCall: ToolCall }
  | { type: 'toolComplete'; toolCall: ToolCall; result: any }
  | { type: 'toolError'; toolCall: ToolCall; error: string }
  | { type: 'agentComplete' }
  | { type: 'error'; message: string };
```

---

## API Specifications

### Extension Host ↔ Webview Message Protocol

#### Messages from Webview to Extension Host

```typescript
// Get state from storage
{
  type: 'getState',
  key: string  // e.g., 'forgeai-conversations'
}

// Set state in storage
{
  type: 'setState',
  key: string,
  value: any  // Serializable object
}

// Send chat message
{
  type: 'sendMessage',
  conversationId: string,
  content: string
}

// Stop agent execution
{
  type: 'stopAgent'
}

// Apply code changes
{
  type: 'applyChanges',
  file: string,
  changes: string
}
```

#### Messages from Extension Host to Webview

```typescript
// State response
{
  type: 'stateResponse',
  key: string,
  value: any
}

// Streaming chunk
{
  type: 'streamChunk',
  data: {
    thinking?: string,
    content?: string,
    toolCalls?: ToolCall[]
  }
}

// Tool execution started
{
  type: 'toolStart',
  toolCall: ToolCall
}

// Tool execution completed
{
  type: 'toolComplete',
  toolCall: ToolCall,
  result: any
}

// Tool execution failed
{
  type: 'toolError',
  toolCall: ToolCall,
  error: string
}

// Agent loop completed
{
  type: 'agentComplete'
}

// Error occurred
{
  type: 'error',
  message: string
}
```

---

## Performance Optimization Implementation (Requirements 25, 50-53)

### 1. Lazy Loading with React.lazy()

```typescript
// App.tsx
import React, { Suspense, lazy } from 'react';

// Lazy load heavy components
const Settings = lazy(() => import('./components/Settings/Settings'));
const LivePreview = lazy(() => import('./components/LivePreview/LivePreview'));

function App() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      {/* Components loaded on demand */}
      <Settings />
      <LivePreview />
    </Suspense>
  );
}
```

### 2. Message List Virtualization

```typescript
// components/ActivityStream/MessageList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function MessageList({ messages }: { messages: Message[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,  // Estimated message height
    overscan: 10  // Render 10 extra items above/below viewport
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            <MessageComponent message={messages[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3. Debouncing and Throttling

```typescript
// hooks/useDebounce.ts
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage in search
function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);  // 300ms delay

  useEffect(() => {
    // Only search after user stops typing for 300ms
    if (debouncedQuery) {
      performSearch(debouncedQuery);
    }
  }, [debouncedQuery]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

```typescript
// hooks/useThrottle.ts
import { useEffect, useRef, useState } from 'react';

export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}

// Usage in resize handler
function SplitScreen() {
  const [width, setWidth] = useState(window.innerWidth);
  const throttledWidth = useThrottle(width, 100);  // Max 10 updates per second

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use throttledWidth for layout calculations
}
```

### 4. Bundle Size Optimization

#### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true
    })
  ],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,  // Disable source maps in production
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'zustand-vendor': ['zustand']
        }
      }
    },
    chunkSizeWarningLimit: 100  // Warn if chunk > 100KB
  }
});
```

---

## Error Handling Strategy (Requirements 20, 47)

### Error Types and Messages

```typescript
// types/errors.ts
export enum ErrorType {
  OLLAMA_CONNECTION = 'OLLAMA_CONNECTION',
  OLLAMA_MODEL_NOT_FOUND = 'OLLAMA_MODEL_NOT_FOUND',
  OLLAMA_TIMEOUT = 'OLLAMA_TIMEOUT',
  TOOL_EXECUTION = 'TOOL_EXECUTION',
  STORAGE_QUOTA = 'STORAGE_QUOTA',
  MAX_ITERATIONS = 'MAX_ITERATIONS'
}

export const ERROR_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.OLLAMA_CONNECTION]: 'Cannot connect to Ollama. Please ensure Ollama is running on http://localhost:11434',
  [ErrorType.OLLAMA_MODEL_NOT_FOUND]: 'Model not found. Please pull the model using: ollama pull [model-name]',
  [ErrorType.OLLAMA_TIMEOUT]: 'Ollama request timed out. The model may be loading. Please try again in a moment.',
  [ErrorType.TOOL_EXECUTION]: 'Tool execution failed. Check the error details below.',
  [ErrorType.STORAGE_QUOTA]: 'Storage quota exceeded. Please clear some conversations to free up space.',
  [ErrorType.MAX_ITERATIONS]: 'Agent reached maximum iterations (20). Task may be incomplete.'
};
```

### Error Handler

```typescript
// utils/errorHandler.ts
import * as vscode from 'vscode';
import { ErrorType, ERROR_MESSAGES } from '../types/errors';

export class ErrorHandler {
  static handle(error: any, context?: string): void {
    console.error(`Error in ${context}:`, error);

    let errorType: ErrorType;
    let message: string;

    // Determine error type
    if (error.code === 'ECONNREFUSED') {
      errorType = ErrorType.OLLAMA_CONNECTION;
    } else if (error.message?.includes('404')) {
      errorType = ErrorType.OLLAMA_MODEL_NOT_FOUND;
    } else if (error.message?.includes('timeout')) {
      errorType = ErrorType.OLLAMA_TIMEOUT;
    } else {
      errorType = ErrorType.TOOL_EXECUTION;
    }

    message = ERROR_MESSAGES[errorType];

    // Show error notification
    vscode.window.showErrorMessage(message, 'Open Ollama Docs', 'Retry').then(selection => {
      if (selection === 'Open Ollama Docs') {
        vscode.env.openExternal(vscode.Uri.parse('https://docs.ollama.com'));
      } else if (selection === 'Retry') {
        // Implement retry logic
      }
    });
  }

  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        
        // Exponential backoff: 1s, 2s, 4s
        const backoff = delay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
    
    throw new Error('Max retries exceeded');
  }
}
```

---

## Build and Development Configuration

### package.json

```json
{
  "name": "forgeai",
  "version": "1.0.0",
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "npm run compile:extension && npm run compile:webview",
    "compile:extension": "tsc -p ./tsconfig.extension.json",
    "compile:webview": "vite build",
    "watch": "concurrently \"npm run watch:extension\" \"npm run watch:webview\"",
    "watch:extension": "tsc -watch -p ./tsconfig.extension.json",
    "watch:webview": "vite",
    "lint": "eslint src --ext ts,tsx",
    "test": "vitest"
  },
  "dependencies": {
    "zustand": "^5.0.0",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "@types/vscode": "^1.115.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@tanstack/react-virtual": "^3.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "eslint": "^9.0.0",
    "vitest": "^1.0.0",
    "concurrently": "^8.0.0"
  }
}
```

### tsconfig.extension.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src/extension",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["src/extension/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### tsconfig.webview.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src/webview",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/webview/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Testing Strategy

### Unit Tests (Vitest)

```typescript
// tests/tools/FileSystemTools.test.ts
import { describe, it, expect, vi } from 'vitest';
import { FileSystemTools } from '../../src/extension/tools/FileSystemTools';
import * as vscode from 'vscode';

vi.mock('vscode');

describe('FileSystemTools', () => {
  describe('readFile', () => {
    it('should read file content', async () => {
      const fsTools = new FileSystemTools();
      const tool = fsTools.readFile();
      
      const mockContent = Buffer.from('test content', 'utf8');
      vi.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(mockContent);
      
      const result = await tool.execute({ path: '/test/file.ts' });
      
      expect(result.content).toBe('test content');
      expect(result.path).toBe('/test/file.ts');
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/AgentLoop.test.ts
import { describe, it, expect } from 'vitest';
import { AgentLoop } from '../../src/extension/ollama/AgentLoop';
import { OllamaClient } from '../../src/extension/ollama/OllamaClient';
import { ToolRegistry } from '../../src/extension/tools/ToolRegistry';

describe('AgentLoop Integration', () => {
  it('should execute multi-step tool sequence', async () => {
    const ollamaClient = new OllamaClient('http://localhost:11434');
    const toolRegistry = new ToolRegistry(mockContext);
    const agentLoop = new AgentLoop(ollamaClient, toolRegistry);
    
    const updates: any[] = [];
    const onUpdate = (update: any) => updates.push(update);
    
    await agentLoop.execute(
      [{ role: 'user', content: 'Read src/index.ts and fix any errors' }],
      onUpdate
    );
    
    expect(updates).toContainEqual(expect.objectContaining({ type: 'toolStart' }));
    expect(updates).toContainEqual(expect.objectContaining({ type: 'toolComplete' }));
    expect(updates).toContainEqual(expect.objectContaining({ type: 'complete' }));
  });
});
```

---

## Deployment and Distribution

### VS Code Marketplace Publishing

```bash
# Install vsce
npm install -g @vscode/vsce

# Package extension
vsce package

# Publish to marketplace
vsce publish
```

### Extension Manifest (package.json additions)

```json
{
  "icon": "resources/icon.png",
  "repository": {
    "type": "git",
    "url": "https://github.com/forgeai/forgeai-vscode"
  },
  "bugs": {
    "url": "https://github.com/forgeai/forgeai-vscode/issues"
  },
  "homepage": "https://forgeai.dev",
  "license": "MIT",
  "keywords": [
    "ai",
    "coding-assistant",
    "ollama",
    "qwen",
    "autonomous",
    "code-generation"
  ]
}
```

---

## Summary

This design document provides a complete technical specification for ForgeAI Phase 1, covering:

✅ **Extension Host Architecture** - VS Code extension registration, Language Model Chat Provider, Chat Participant, Ollama integration, 20+ tools
✅ **Webview Architecture** - React 19 application with modern hooks, Native CSS with VS Code theme integration, Zustand v5 state management
✅ **UI Components** - Split-screen layout, Activity Stream, Live Preview, Thinking Block, Tool Card, Tab Bar, Message Input, Welcome Screen
✅ **Data Models** - Complete TypeScript interfaces for all entities
✅ **API Specifications** - Message protocol between Extension Host and Webview
✅ **Performance Optimization** - Lazy loading, virtualization, debouncing, bundle size optimization
✅ **Error Handling** - Comprehensive error types, retry strategies, user feedback
✅ **Build Configuration** - Vite, TypeScript, ESLint, Vitest setup
✅ **Testing Strategy** - Unit tests and integration tests

All 53 requirements from the requirements document are addressed with concrete implementation details, exact API specifications, and code examples.

