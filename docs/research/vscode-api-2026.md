# VS Code Extension APIs — 2026 Research Report

**Project:** ForgeAI - Autonomous AI Coding Assistant  
**Research Date:** May 3, 2026  
**VS Code Version Coverage:** v1.104 - v1.115 (October 2025 - April 2026)  
**Primary Sources:**
- [VS Code API Documentation](https://code.visualstudio.com/api)
- [VS Code v1.109 Release Notes](https://code.visualstudio.com/updates/v1_109) (January 2026)
- [VS Code v1.115 Release Notes](https://code.visualstudio.com/updates/v1_115) (April 2026)
- [Language Model Chat Provider API](https://code.visualstudio.com/api/extension-guides/ai/language-model-chat-provider)
- [Chat Participant API](https://code.visualstudio.com/api/extension-guides/chat)
- [Language Model Tools API](https://code.visualstudio.com/api/extension-guides/tools)

---

## Executive Summary

VS Code has evolved into a **full multi-agent platform** as of 2026. ForgeAI can leverage native VS Code infrastructure instead of building a custom agent runtime from scratch. The platform now provides:

- Native language model registration and routing
- Built-in tool-calling framework for autonomous agents
- Multi-agent orchestration with parallel execution
- Real-time perception layer (file watchers, diagnostics)
- Deterministic verification hooks
- Packaged skill distribution system

This research covers 9 core APIs essential for building ForgeAI.

---

1. Language Model Chat Provider API (v1.104+)
This is the most important API for ForgeAI. It lets you register your own models (Qwen3-Coder, Ollama, etc.) directly into VS Code's native model picker — the same one Copilot uses.

// package.json
{
  "contributes": {
    "languageModelChatProviders": [
      {
        "vendor": "forgeai",
        "displayName": "ForgeAI",
        "managementCommand": "forgeai.manage",
        "configuration": {
          "properties": {
            "apiKey": {
              "type": "string",
              "secret": true,
              "title": "API Key"
            },
            "models": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": { "type": "string" },
                  "name": { "type": "string" },
                  "url": { "type": "string" },
                  "maxInputTokens": { "type": "number" },
                  "maxOutputTokens": { "type": "number" },
                  "toolCalling": { "type": "boolean" },
                  "vision": { "type": "boolean" }
                }
              }
            }
          }
        }
      }
    ]
  }
}


// extension.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  vscode.lm.registerLanguageModelChatProvider('forgeai', new ForgeAIProvider());
}

class ForgeAIProvider implements vscode.LanguageModelChatProvider {
  async provideLanguageModelChatInformation(
    options: { silent: boolean },
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelChatInformation[]> {
    if (options.silent) return [];
    return [
      {
        id: 'qwen3-coder-397b',
        name: 'Qwen3-Coder 397B',
        family: 'qwen3',
        version: '1.0.0',
        maxInputTokens: 128000,
        maxOutputTokens: 8192,
        capabilities: { toolCalling: true, imageInput: false }
      },
      // ... other models
    ];
  }

  async provideLanguageModelChatResponse(
    model: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: any,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken
  ): Promise<void> {
    // Call your API, stream back chunks
    const stream = await callQwenAPI(model.id, messages);
    for await (const chunk of stream) {
      progress.report(new vscode.LanguageModelTextPart(chunk));
    }
  }

  async provideTokenCount(
    model: vscode.LanguageModelChatInformation,
    text: string | vscode.LanguageModelChatRequestMessage,
    token: vscode.CancellationToken
  ): Promise<number> {
    return Math.ceil(text.toString().length / 4);
  }
}



**What this gives ForgeAI:**
- Your models appear natively in VS Code's model picker
- Any extension or agent that uses `vscode.lm.selectChatModels()` can use ForgeAI models automatically
- Users get a unified model selection experience
- No separate authentication or configuration flow needed

**Status:** Stable (v1.104+)  
**Documentation:** [Language Model Chat Provider API](https://code.visualstudio.com/api/extension-guides/ai/language-model-chat-provider)

---

## 2. Chat Participant API

Register ForgeAI as a `@forgeai` chat participant — users can invoke it directly in chat.

**Status:** Stable  
**Documentation:** [Chat Participant API](https://code.visualstudio.com/api/extension-guides/chat)


// package.json
{
  "contributes": {
    "chatParticipants": [
      {
        "id": "forgeai.assistant",
        "name": "forgeai",
        "fullName": "ForgeAI",
        "description": "Autonomous AI coding assistant",
        "isSticky": true,
        "commands": [
          { "name": "fix", "description": "Autonomously fix a bug" },
          { "name": "build", "description": "Build a feature from a goal" },
          { "name": "explain", "description": "Explain selected code" },
          { "name": "test", "description": "Generate and run tests" }
        ],
        "disambiguation": [
          {
            "category": "coding",
            "description": "User wants to build, fix, or understand code",
            "examples": [
              "Fix the crash in my auth module",
              "Build a REST API for user management",
              "Why is this function slow?"
            ]
          }
        ]
      }
    ]
  }
}


// Chat request handler
const handler: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
) => {
  stream.progress('ForgeAI is analyzing your codebase...');

  // Use the model the user selected
  const model = request.model;

  // Build context-aware prompt
  const messages = buildAgentPrompt(request.prompt, context);

  // Stream response
  const response = await model.sendRequest(messages, {}, token);
  for await (const chunk of response.text) {
    stream.markdown(chunk);
  }

  // Suggest follow-ups
  return { metadata: { command: request.command } };
};

const forgeai = vscode.chat.createChatParticipant('forgeai.assistant', handler);
forgeai.iconPath = vscode.Uri.joinPath(context.extensionUri, 'forge-icon.png');
```

**Key Features:**
- Slash commands (`/fix`, `/build`, `/explain`, `/test`)
- Participant detection (automatic routing based on user intent)
- Follow-up suggestions
- Access to conversation history
- Streaming responses with progress indicators

**Status:** Stable  
**Documentation:** [Chat Participant API](https://code.visualstudio.com/api/extension-guides/chat)

---




## 3. Language Model Tools API — The Autonomy Engine

This is what makes ForgeAI **actually autonomous**. Tools are functions the agent can call automatically. You register them and the LLM decides when to invoke them.

**Status:** Stable  
**Documentation:** [Language Model Tools API](https://code.visualstudio.com/api/extension-guides/tools)

// package.json
{
  "contributes": {
    "languageModelTools": [
      {
        "name": "forgeai_readFile",
        "displayName": "Read File",
        "modelDescription": "Read the contents of a file in the workspace. Use this to understand existing code before making changes.",
        "canBeReferencedInPrompt": true,
        "toolReferenceName": "readFile",
        "icon": "$(file-code)",
        "inputSchema": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "Absolute path to the file" }
          },
          "required": ["path"]
        }
      },
      {
        "name": "forgeai_writeFile",
        "displayName": "Write File",
        "modelDescription": "Write or update a file in the workspace. Use this to implement code changes.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "path": { "type": "string" },
            "content": { "type": "string" }
          },
          "required": ["path", "content"]
        }
      },
      {
        "name": "forgeai_runTerminal",
        "displayName": "Run Terminal Command",
        "modelDescription": "Execute a shell command. Use for running tests, builds, linters.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "command": { "type": "string" },
            "cwd": { "type": "string" }
          },
          "required": ["command"]
        }
      },
      {
        "name": "forgeai_searchCode",
        "displayName": "Search Codebase",
        "modelDescription": "Semantically search the codebase for relevant code, functions, or patterns.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": { "type": "string" },
            "filePattern": { "type": "string" }
          },
          "required": ["query"]
        }
      }
    ]
  }
}



// Tool implementation
class ReadFileTool implements vscode.LanguageModelTool<{ path: string }> {
  async prepareInvocation(options: any, token: vscode.CancellationToken) {
    return {
      invocationMessage: `Reading ${options.input.path}`,
      confirmationMessages: {
        title: 'Read file',
        message: new vscode.MarkdownString(`Read \`${options.input.path}\`?`)
      }
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{ path: string }>,
    token: vscode.CancellationToken
  ) {
    const uri = vscode.Uri.file(options.input.path);
    const content = await vscode.workspace.fs.readFile(uri);
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(Buffer.from(content).toString('utf8'))
    ]);
  }
}

// Register all tools
export function registerTools(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.lm.registerTool('forgeai_readFile', new ReadFileTool()),
    vscode.lm.registerTool('forgeai_writeFile', new WriteFileTool()),
    vscode.lm.registerTool('forgeai_runTerminal', new RunTerminalTool()),
    vscode.lm.registerTool('forgeai_searchCode', new SearchCodeTool())
  );
}
```

**Tool-Calling Flow:**
1. User sends chat prompt
2. VS Code determines available tools based on configuration
3. LLM receives prompt + tool definitions
4. LLM generates tool invocation requests with parameters
5. VS Code invokes tools and returns results to LLM
6. LLM processes results and may request more tools
7. Final response returned to user

**Key Capabilities:**
- Automatic tool selection by LLM
- User confirmation dialogs (customizable)
- Error handling with retry instructions
- Conditional availability via `when` clauses
- Tool chaining and iteration

**Status:** Stable  
**Documentation:** [Language Model Tools API](https://code.visualstudio.com/api/extension-guides/tools)

---

## 4. Inline Completion Provider API
Ghost text completions as the user types — like Copilot's autocomplete.

// package.json
{
  "contributes": {
    "configuration": {
      "properties": {
        "forgeai.inlineCompletions.enabled": {
          "type": "boolean",
          "default": true
        }
      }
    }
  }
}


class ForgeAIInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider {

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList> {
    const prefix = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    );
    const suffix = document.getText(
      new vscode.Range(position, new vscode.Position(document.lineCount, 0))
    );

    // Call your model (use a fast/small model for low latency)
    const completion = await getInlineCompletion(prefix, suffix, document.languageId);

    return {
      items: [
        new vscode.InlineCompletionItem(
          completion,
          new vscode.Range(position, position)
        )
      ]
    };
  }
}

// Register
vscode.languages.registerInlineCompletionItemProvider(
  { pattern: '**' }, // all files
  new ForgeAIInlineCompletionProvider()
);
```

**Key Considerations:**
- Use a fast, small model for low latency (< 200ms ideal)
- Provide both prefix and suffix context
- Cache aggressively to reduce API calls
- Debounce requests to avoid overwhelming the model
- Support partial acceptance (word-by-word, line-by-line)

**Status:** Stable  
**Documentation:** [InlineCompletionItemProvider API](https://code.visualstudio.com/api/references/vscode-api#InlineCompletionItemProvider)

---

## 5. File System Watcher — Perception Layer
ForgeAI's always-on perception: watch for file changes, errors, git diffs.

// Watch all workspace files
const watcher = vscode.workspace.createFileSystemWatcher('**/*');

watcher.onDidChange(uri => {
  forgeAIPerception.onFileChanged(uri);
});
watcher.onDidCreate(uri => {
  forgeAIPerception.onFileCreated(uri);
});
watcher.onDidDelete(uri => {
  forgeAIPerception.onFileDeleted(uri);
});

// Watch diagnostics (errors/warnings) in real time
vscode.languages.onDidChangeDiagnostics(event => {
  for (const uri of event.uris) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
    if (errors.length > 0) {
      forgeAIPerception.onErrorsDetected(uri, errors);
    }
  }
});

// Watch active editor
vscode.window.onDidChangeActiveTextEditor(editor => {
  if (editor) forgeAIPerception.onActiveFileChanged(editor.document);
});

// Watch text selection
vscode.window.onDidChangeTextEditorSelection(event => {
  forgeAIPerception.onSelectionChanged(event.textEditor, event.selections);
});
```

**Perception Capabilities:**
- Real-time file change detection (create, modify, delete)
- Live error and warning monitoring via diagnostics
- Active editor and selection tracking
- Git status changes (via Git extension API)
- Terminal output monitoring

**Use Cases for ForgeAI:**
- Proactive bug detection when errors appear
- Auto-suggest fixes when tests fail
- Context awareness (know what the user is working on)
- Background analysis without polling

**Status:** Stable  
**Documentation:** [File System Watcher API](https://code.visualstudio.com/api/references/vscode-api#FileSystemWatcher)

---

## 6. Agent Skills & Custom Agents (v1.108+)
ForgeAI can package its specialized workflows as Agent Skills — reusable, domain-specific instruction sets that VS Code loads automatically.

<!-- .kiro/skills/forgeai-bugfix/SKILL.md -->
---
name: forgeai-bugfix
description: ForgeAI autonomous bug fixing workflow
---

When fixing bugs:
1. Read the error message and stack trace
2. Locate the root cause file and line
3. Understand the surrounding context
4. Write a minimal fix
5. Run tests to verify
6. Report what was changed and why

// package.json — contribute skills with your extension
{
  "contributes": {
    "chatSkills": [
      { "path": "./skills/forgeai-bugfix" },
      { "path": "./skills/forgeai-refactor" },
      { "path": "./skills/forgeai-test-writer" }
    ]
  }
}


7. Agent Hooks (v1.109+)
Run deterministic shell commands at key agent lifecycle points — perfect for ForgeAI's verification loop.


// .forgeai/hooks/post-write.json
{
  "name": "ForgeAI Post-Write Lint",
  "version": "1.0.0",
  "when": {
    "type": "postToolUse",
    "toolTypes": ["write"]
  },
  "then": {
    "type": "runCommand",
    "command": "npm run lint --fix"
  }
}


// Run tests after every file write
{
  "name": "ForgeAI Auto-Test",
  "version": "1.0.0",
  "when": {
    "type": "postToolUse",
    "toolTypes": ["write"]
  },
  "then": {
    "type": "runCommand",
    "command": "npm test -- --run"
  }
}


8. Subagents & Parallel Execution (v1.109+)
VS Code now natively supports subagents running in parallel with isolated context windows. ForgeAI's multi-agent architecture maps directly to this.

<!-- .forgeai/agents/planner.agent.md -->
---
name: ForgeAI-Planner
model: ['qwen3-coder-397b (forgeai)']
tools: ['agent']
agents: ['ForgeAI-Executor', 'ForgeAI-Critic']
user-invocable: false
---

You are the ForgeAI Planner. Break down the user's goal into concrete tasks.
Delegate implementation to ForgeAI-Executor and review to ForgeAI-Critic.

<!-- .forgeai/agents/executor.agent.md -->
---
name: ForgeAI-Executor
model: ['qwen3-coder-397b (forgeai)']
tools: ['forgeai_readFile', 'forgeai_writeFile', 'forgeai_runTerminal', 'forgeai_searchCode']
user-invocable: false
disable-model-invocation: false
---

You are the ForgeAI Executor. Implement tasks assigned by the Planner.
Always run tests after writing code. Fix failures before reporting done.


---

## 9. API Summary Table

| API | Purpose for ForgeAI | Status | Version | Documentation |
|-----|---------------------|--------|---------|---------------|
| `lm.registerLanguageModelChatProvider` | Register Qwen3/Ollama models natively | ✅ Stable | v1.104+ | [Link](https://code.visualstudio.com/api/extension-guides/ai/language-model-chat-provider) |
| `chat.createChatParticipant` | `@forgeai` in chat | ✅ Stable | - | [Link](https://code.visualstudio.com/api/extension-guides/chat) |
| `lm.registerTool` | Agent tools (read/write/run/search) | ✅ Stable | - | [Link](https://code.visualstudio.com/api/extension-guides/tools) |
| `languages.registerInlineCompletionItemProvider` | Ghost text completions | ✅ Stable | - | [Link](https://code.visualstudio.com/api/references/vscode-api#InlineCompletionItemProvider) |
| `workspace.createFileSystemWatcher` | Perception layer | ✅ Stable | - | [Link](https://code.visualstudio.com/api/references/vscode-api#FileSystemWatcher) |
| `languages.onDidChangeDiagnostics` | Real-time error watching | ✅ Stable | - | [Link](https://code.visualstudio.com/api/references/vscode-api#languages) |
| `chatSkills` contribution point | Packaged skill workflows | ✅ Stable | v1.108+ | [Link](https://code.visualstudio.com/updates/v1_108) |
| Agent hooks (`.json` hook files) | Deterministic post-action triggers | 🔬 Preview | v1.109+ | [Link](https://code.visualstudio.com/updates/v1_109) |
| Custom agents (`.agent.md`) | Multi-agent orchestration | 🔬 Preview | v1.109+ | [Link](https://code.visualstudio.com/updates/v1_109) |
| `lm.registerLanguageModelChatProvider` config schema | Native API key UI | 📝 Proposed | v1.109 | [Link](https://code.visualstudio.com/api/extension-guides/ai/language-model-chat-provider) |
| `chat.registerSkillProvider` | Dynamic skill injection | 📝 Proposed | - | - |
| Subagents parallel execution | Parallel agent workstreams | ✅ Stable | v1.109+ | [Link](https://code.visualstudio.com/updates/v1_109) |
| Terminal sandboxing | Safe agent command execution | 🧪 Experimental | v1.109+ | [Link](https://code.visualstudio.com/updates/v1_109) |
| `env.isAppPortable` | Portable mode detection | 📝 Proposed | - | - |

**Legend:**
- ✅ Stable: Production-ready, safe to use
- 🔬 Preview: Available but evolving, may change
- 🧪 Experimental: Early stage, opt-in only
- 📝 Proposed: API proposal, not yet available in stable

---

## Key Architectural Insights
The biggest insight from this research: **VS Code has evolved into a full multi-agent platform as of 2026**. ForgeAI doesn't need to build its own agent runtime from scratch — it can plug directly into VS Code's native agent infrastructure.

### What This Means for ForgeAI

1. **Language Model Chat Provider** → Your models (Qwen3-Coder 397B, Ollama) appear everywhere in VS Code natively
2. **LM Tools** → Your agent's hands (read, write, run, search) with automatic invocation
3. **Agent Skills** → Your agent's domain knowledge, packaged and reusable
4. **Agent Hooks** → Deterministic verification after every action (lint, test, build)
5. **Custom Agents + Subagents** → Your multi-agent orchestration, natively parallel
6. **File Watcher + Diagnostics** → Always-on perception without polling

### Recommended Architecture for ForgeAI

```
┌─────────────────────────────────────────────────────────┐
│                    ForgeAI Extension                    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Language Model Chat Provider                    │  │
│  │  - Qwen3-Coder 397B (cloud, default)            │  │
│  │  - Ollama models (local)                         │  │
│  │  - Auto mode (smart routing)                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Chat Participant (@forgeai)                     │  │
│  │  - /fix, /build, /explain, /test                │  │
│  │  - Participant detection                         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Tool Registry (LM Tools)                        │  │
│  │  - forgeai_readFile                              │  │
│  │  - forgeai_writeFile                             │  │
│  │  - forgeai_runTerminal                           │  │
│  │  - forgeai_searchCode                            │  │
│  │  - forgeai_getDiagnostics                        │  │
│  │  - forgeai_gitDiff                               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Inline Completion Provider                      │  │
│  │  - Fast model for low latency                    │  │
│  │  - Prefix/suffix context                         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Perception Layer                                │  │
│  │  - File watcher (create/modify/delete)           │  │
│  │  - Diagnostics watcher (errors/warnings)         │  │
│  │  - Active editor tracker                         │  │
│  │  - Selection tracker                             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Agent Skills (Packaged Workflows)               │  │
│  │  - forgeai-bugfix                                │  │
│  │  - forgeai-refactor                              │  │
│  │  - forgeai-test-writer                           │  │
│  │  - forgeai-code-review                           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Agent Hooks (Verification Loop)                 │  │
│  │  - Post-write: lint + format                     │  │
│  │  - Post-write: run tests                         │  │
│  │  - Pre-commit: security scan                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Multi-Agent Orchestration                       │  │
│  │  - ForgeAI-Planner (breaks down goals)           │  │
│  │  - ForgeAI-Executor (implements tasks)           │  │
│  │  - ForgeAI-Critic (reviews output)               │  │
│  │  - ForgeAI-Researcher (searches docs/web)        │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Next Steps

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up VS Code extension project structure
- [ ] Implement Language Model Chat Provider for Qwen3-Coder 397B
- [ ] Add Ollama support for local models
- [ ] Create basic chat participant (`@forgeai`)
- [ ] Implement model auto-routing logic

### Phase 2: Autonomy (Weeks 3-4)
- [ ] Register core LM tools (read, write, run, search)
- [ ] Implement tool confirmation dialogs
- [ ] Add error handling and retry logic
- [ ] Test tool-calling flow end-to-end

### Phase 3: Intelligence (Weeks 5-6)
- [ ] Implement inline completion provider
- [ ] Set up perception layer (file watcher, diagnostics)
- [ ] Create agent skills for common workflows
- [ ] Add agent hooks for verification

### Phase 4: Multi-Agent (Weeks 7-8)
- [ ] Design multi-agent orchestration
- [ ] Implement Planner, Executor, Critic agents
- [ ] Test parallel subagent execution
- [ ] Optimize context window management

### Phase 5: Polish (Weeks 9-10)
- [ ] Add comprehensive error handling
- [ ] Implement telemetry and analytics
- [ ] Create user documentation
- [ ] Prepare for marketplace publication

---

## Additional Resources

- [VS Code Extension API Reference](https://code.visualstudio.com/api/references/vscode-api)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [Chat Extension Sample](https://github.com/microsoft/vscode-extension-samples/tree/main/chat-sample)
- [Language Model Tools Sample](https://github.com/microsoft/vscode-extension-samples/tree/main/chat-tools-sample)
- [Microsoft AI Tools Guidelines](https://www.microsoft.com/en-us/ai/responsible-ai)
- [GitHub Copilot Extensibility Policy](https://docs.github.com/en/copilot/building-copilot-extensions)

---

**Research Completed:** May 3, 2026  
**Next Review:** Check for updates in VS Code v1.120+ (June 2026)