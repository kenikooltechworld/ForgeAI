# VS Code Language Model API & Chat Participant Integration - 2026

**Research Date:** May 6, 2026  
**Purpose:** Understand how to integrate ForgeAI with VS Code's native Language Model API and Chat Participant system

---

## Executive Summary

VS Code's Language Model API and Chat Participant API enable extensions to:

1. **Provide custom AI models** to VS Code's native model picker (Language Model Chat Provider)
2. **Create @-mention chat participants** that work in VS Code's native chat interface (Chat Participant)

**Key Benefit:** Users can use ForgeAI's Ollama models through GitHub Copilot Chat UI **without paying GitHub** - the inference runs on your own infrastructure.

---

## Which Coding Assistants Use This Approach?

### Extensions Using Language Model Chat Provider API (2026)

Based on VS Code Marketplace research, the following extensions integrate with VS Code's native chat:

| Extension                   | What It Does                                                               | Model Source                |
| --------------------------- | -------------------------------------------------------------------------- | --------------------------- |
| **OpenAI to LM API Bridge** | Connects OpenAI-compatible APIs to VS Code's Language Model API            | OpenAI-compatible endpoints |
| **Unify Chat Provider**     | Supports all major LLM API formats (OpenAI, Anthropic, Ollama, Gemini)     | Multiple providers          |
| **LiteLLM Provider**        | Uses LiteLLM proxy to connect various models to Copilot Chat               | LiteLLM proxy               |
| **vLlama**                  | Integrates locally-hosted LLM models into VS Code's native Chat            | Local Ollama models         |
| **Local LLM Chat**          | Connects to local LLM API endpoints                                        | Local API endpoints         |
| **Local AI Assistant**      | Private/offline models for code completion and chat                        | Local/network models        |
| **Copilot LLM Proxy**       | Bridges Copilot's Language Model API to OpenAI-compatible REST API         | OpenAI-compatible           |
| **HuggingFace VSCode**      | Uses llm-ls backend for LLM integration                                    | HuggingFace models          |
| **Custom LLM Provider**     | Exposes Alibaba Qwen Coder models in VS Code model picker                  | Alibaba Model Studio        |
| **Amazon Bedrock Provider** | Connects AWS Bedrock models (Claude, OpenAI OSS, DeepSeek) to Copilot Chat | AWS Bedrock                 |

**Key Insight:** Multiple extensions successfully use this approach - it's a proven pattern for 2026.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Native Chat UI                    │
│  (GitHub Copilot Chat, Quick Chat, Inline Chat, Chat View)  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ├─── @forgeai (Chat Participant)
                        │    └─── Handles: /fix, /build, /explain, /test
                        │
                        └─── Model Picker
                             └─── Qwen3-Coder-397B (Language Model Provider)
                                  └─── ForgeAI Extension
                                       └─── Your Ollama (localhost:11434)
                                            └─── Your Models (Free!)
```

---

## Part 1: Language Model Chat Provider API

### What It Does

Makes your Ollama models appear in **VS Code's native model picker** so other extensions (like Copilot Chat) can use them.

### Implementation Steps

#### 1. Register Provider in package.json

```json
{
  "contributes": {
    "languageModelChatProviders": [
      {
        "vendor": "forgeai",
        "displayName": "ForgeAI (Ollama)",
        "managementCommand": "forgeai.manageModels"
      }
    ],
    "commands": [
      {
        "command": "forgeai.manageModels",
        "title": "Manage ForgeAI Models"
      }
    ]
  }
}
```

#### 2. Register Provider in Extension Code

```typescript
// src/extension/providers/LanguageModelChatProvider.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Register the language model provider
  const provider = new ForgeAILanguageModelProvider();
  vscode.lm.registerLanguageModelChatProvider('forgeai', provider);
}
```

#### 3. Implement LanguageModelChatProvider Interface

```typescript
class ForgeAILanguageModelProvider implements vscode.LanguageModelChatProvider {
  // 1. Provide model information
  async provideLanguageModelChatInformation(
    options: { silent: boolean },
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelChatInformation[]> {
    if (options.silent) {
      return []; // Don't prompt user in silent mode
    }

    // Fetch available models from Ollama
    const models = await this.fetchOllamaModels();

    // Map to VS Code format
    return models.map((model) => ({
      id: model.name,
      name: model.displayName,
      family: model.family,
      version: model.version,
      maxInputTokens: 128000,
      maxOutputTokens: 8192,
      capabilities: {
        imageInput: model.supportsVision,
        toolCalling: model.supportsTools,
      },
    }));
  }

  // 2. Handle chat requests
  async provideLanguageModelChatResponse(
    model: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: vscode.ProvideLanguageModelChatResponseOptions,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken
  ): Promise<void> {
    // Convert VS Code messages to Ollama format
    const ollamaMessages = this.convertMessages(messages);

    // Stream response from Ollama
    const stream = await this.ollamaClient.chat({
      model: model.id,
      messages: ollamaMessages,
      stream: true,
    });

    // Stream back to VS Code
    for await (const chunk of stream) {
      if (chunk.message?.content) {
        progress.report(new vscode.LanguageModelTextPart(chunk.message.content));
      }

      if (chunk.message?.tool_calls) {
        for (const toolCall of chunk.message.tool_calls) {
          progress.report(
            new vscode.LanguageModelToolCallPart(
              toolCall.function.name,
              toolCall.function.arguments
            )
          );
        }
      }
    }
  }

  // 3. Provide token count
  async provideTokenCount(
    model: vscode.LanguageModelChatInformation,
    text: string | vscode.LanguageModelChatRequestMessage,
    token: vscode.CancellationToken
  ): Promise<number> {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.toString().length / 4);
  }

  private async fetchOllamaModels() {
    // Fetch from http://localhost:11434/api/tags
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    return data.models;
  }

  private convertMessages(messages: readonly vscode.LanguageModelChatRequestMessage[]) {
    return messages.map((msg) => ({
      role: msg.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant',
      content: msg.content
        .filter((part) => part instanceof vscode.LanguageModelTextPart)
        .map((part) => (part as vscode.LanguageModelTextPart).value)
        .join(''),
    }));
  }
}
```

### Model Information Structure

```typescript
interface LanguageModelChatInformation {
  id: string; // "qwen3-coder:397b"
  name: string; // "Qwen3-Coder-397B"
  family: string; // "qwen3"
  version: string; // "397b"
  maxInputTokens: number; // 128000
  maxOutputTokens: number; // 8192
  tooltip?: string; // Optional hover text
  detail?: string; // Additional info
  capabilities: {
    imageInput?: boolean; // Supports vision
    toolCalling?: boolean; // Supports function calling
  };
}
```

---

## Part 2: Chat Participant API

### What It Does

Creates an **@forgeai** participant that users can @-mention in VS Code's native chat.

### Implementation Steps

#### 1. Register Participant in package.json

```json
{
  "contributes": {
    "chatParticipants": [
      {
        "id": "forgeai.assistant",
        "name": "forgeai",
        "fullName": "ForgeAI",
        "description": "Your autonomous AI coding assistant",
        "isSticky": true,
        "commands": [
          {
            "name": "fix",
            "description": "Fix bugs and errors in your code"
          },
          {
            "name": "build",
            "description": "Build new features and functionality"
          },
          {
            "name": "explain",
            "description": "Explain code and concepts"
          },
          {
            "name": "test",
            "description": "Generate unit tests"
          }
        ],
        "disambiguation": [
          {
            "category": "coding",
            "description": "The user wants help with coding tasks like fixing bugs, building features, or generating tests",
            "examples": [
              "Fix the authentication bug in login.ts",
              "Build a user dashboard with charts",
              "Generate unit tests for UserService"
            ]
          }
        ]
      }
    ]
  }
}
```

#### 2. Create Chat Participant

```typescript
// src/extension/providers/ChatParticipant.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Create the chat participant
  const participant = vscode.chat.createChatParticipant('forgeai.assistant', handler);

  // Set icon
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'forgeai-icon.svg');

  // Set follow-up provider
  participant.followupProvider = {
    provideFollowups(result: any, context: vscode.ChatContext, token: vscode.CancellationToken) {
      return [
        {
          prompt: 'Explain the changes you made',
          label: 'Explain changes',
        },
        {
          prompt: 'Generate tests for this code',
          label: 'Generate tests',
        },
      ];
    },
  };
}
```

#### 3. Implement Request Handler

```typescript
const handler: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
) => {
  // Handle slash commands
  if (request.command === 'fix') {
    stream.progress('Analyzing code for bugs...');
    await handleFixCommand(request, stream, token);
  } else if (request.command === 'build') {
    stream.progress('Planning feature implementation...');
    await handleBuildCommand(request, stream, token);
  } else if (request.command === 'explain') {
    stream.progress('Analyzing code...');
    await handleExplainCommand(request, stream, token);
  } else if (request.command === 'test') {
    stream.progress('Generating tests...');
    await handleTestCommand(request, stream, token);
  } else {
    // Handle general queries
    await handleGeneralQuery(request, stream, token);
  }

  return { metadata: { command: request.command } };
};

async function handleFixCommand(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
) {
  // Use the language model from the request
  const model = request.model;

  // Build prompt
  const messages = [
    vscode.LanguageModelChatMessage.User(
      `You are a debugging expert. Fix the following issue: ${request.prompt}`
    ),
  ];

  // Send to language model
  const response = await model.sendRequest(messages, {}, token);

  // Stream response
  for await (const chunk of response.text) {
    stream.markdown(chunk);
  }

  // Add button to apply fix
  stream.button({
    command: 'forgeai.applyFix',
    title: 'Apply Fix',
    arguments: [],
  });
}
```

### Response Types

````typescript
// Markdown
stream.markdown('# This is a title\n');
stream.markdown('This is **bold** text.\n');

// Code block
stream.markdown('```typescript\n');
stream.markdown('const x = 42;\n');
stream.markdown('```\n');

// Progress
stream.progress('Analyzing code...');

// Button
stream.button({
  command: 'forgeai.applyChanges',
  title: 'Apply Changes',
  arguments: [filePath, content],
});

// Reference
stream.reference(vscode.Uri.file('/path/to/file.ts'));

// Anchor (inline reference)
stream.anchor(symbolLocation, 'MyClass');

// File tree
stream.filetree(
  [
    {
      name: 'src',
      children: [{ name: 'app.ts' }, { name: 'utils.ts' }],
    },
  ],
  baseUri
);
````

---

## Participant Detection (Auto-routing)

VS Code can automatically route questions to your participant without explicit @-mention:

```json
{
  "disambiguation": [
    {
      "category": "coding",
      "description": "The user wants help with coding tasks",
      "examples": ["Fix the authentication bug", "Build a user dashboard", "Generate unit tests"]
    }
  ]
}
```

**Guidelines:**

- Be specific in descriptions
- Use natural language examples
- Avoid conflicts with built-in participants (@workspace, @terminal, @vscode)
- Test with variations of example questions

---

## Tool Calling Integration

Chat participants can invoke language model tools:

### Option 1: Using @vscode/chat-extension-utils

```typescript
import * as chatUtils from '@vscode/chat-extension-utils';

const handler: vscode.ChatRequestHandler = async (request, context, stream, token) => {
  // Get relevant tools
  const tools = vscode.lm.tools.filter((tool) => tool.tags.includes('forgeai'));

  // Send request with tools
  const result = await chatUtils.sendChatParticipantRequest(
    request,
    context,
    {
      prompt: 'You are an autonomous coding assistant.',
      responseStreamOptions: {
        stream,
        references: true,
        responseText: true,
      },
      tools,
    },
    token
  );

  return await result.result;
};
```

### Option 2: Manual Implementation

```typescript
// More control over tool calling process
const response = await request.model.sendRequest(messages, { tools }, token);

for await (const chunk of response.text) {
  if (chunk.toolCalls) {
    for (const toolCall of chunk.toolCalls) {
      // Execute tool
      const result = await executeTool(toolCall);

      // Send result back to model
      messages.push(vscode.LanguageModelChatMessage.Tool(toolCall.id, JSON.stringify(result)));
    }
  }
}
```

---

## Naming Conventions

### Chat Participant

| Property      | Guidelines                            | Example                               |
| ------------- | ------------------------------------- | ------------------------------------- |
| `id`          | Use extension name as prefix          | `forgeai.assistant`                   |
| `name`        | Lowercase, alphanumeric + underscores | `forgeai`                             |
| `fullName`    | Title case, user-friendly             | `ForgeAI`                             |
| `description` | Sentence case, no punctuation         | `Your autonomous AI coding assistant` |

### Slash Commands

| Property      | Guidelines                    | Example                            |
| ------------- | ----------------------------- | ---------------------------------- |
| `name`        | Lower camel case              | `fix`, `buildFeature`              |
| `description` | Sentence case, no punctuation | `Fix bugs and errors in your code` |

---

## Cost Analysis

### Using ForgeAI Models Through Copilot Chat

```
User types: @forgeai /fix this bug
     ↓
ForgeAI Extension handles request
     ↓
Your Ollama processes it (localhost:11434)
     ↓
Response appears in Copilot Chat UI
```

**GitHub Charges:** $0 (you're using your own models)  
**Your Costs:**

- Local models: Free (electricity/compute)
- Cloud models: Whatever you pay your cloud provider

### Comparison with GitHub Copilot

| Feature       | GitHub Copilot  | ForgeAI via LM API              |
| ------------- | --------------- | ------------------------------- |
| Model         | GitHub's models | Your Ollama models              |
| Cost          | $10-20/month    | Free (local) or your cloud cost |
| Data privacy  | Sent to GitHub  | Stays on your infrastructure    |
| Model choice  | Limited         | Any Ollama model                |
| Customization | Limited         | Full control                    |

---

## Best Practices

### 1. Model Information

- Provide accurate token limits
- Indicate capabilities correctly (vision, tool calling)
- Use descriptive model names

### 2. Chat Responses

- Stream responses for better UX
- Use progress messages for long operations
- Provide actionable buttons
- Include relevant references

### 3. Error Handling

- Handle Ollama connection errors gracefully
- Provide helpful error messages
- Offer retry options

### 4. Performance

- Cache model information
- Use streaming for large responses
- Implement cancellation support

### 5. User Experience

- Write clear command descriptions
- Provide follow-up suggestions
- Use participant detection wisely
- Don't conflict with built-in participants

---

## Testing

### Test Language Model Provider

```typescript
// Test model discovery
const models = await provider.provideLanguageModelChatInformation({ silent: false }, token);
console.log('Available models:', models);

// Test chat response
const messages = [vscode.LanguageModelChatMessage.User('Hello')];
await provider.provideLanguageModelChatResponse(models[0], messages, {}, progress, token);
```

### Test Chat Participant

1. Open VS Code Chat (Cmd+I or Ctrl+I)
2. Type `@forgeai` - should see your participant
3. Type `@forgeai /fix` - should see slash command
4. Send a message - should get response
5. Check follow-up suggestions appear

---

## Publishing Checklist

- [ ] Read [Microsoft AI tools and practices guidelines](https://www.microsoft.com/en-us/ai/responsible-ai)
- [ ] Adhere to [GitHub Copilot extensibility policy](https://docs.github.com/en/copilot/building-copilot-extensions/about-building-copilot-extensions)
- [ ] Test with multiple VS Code themes
- [ ] Test with different Ollama models
- [ ] Implement telemetry for success metrics
- [ ] Add comprehensive error handling
- [ ] Write clear documentation
- [ ] Create demo video/screenshots
- [ ] Publish to VS Code Marketplace

---

## Official Documentation Links

- [Language Model Chat Provider API](https://code.visualstudio.com/api/extension-guides/ai/language-model-chat-provider)
- [Chat Participant API](https://code.visualstudio.com/api/extension-guides/chat)
- [Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [Language Model Tools](https://code.visualstudio.com/api/extension-guides/tools)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [Chat Extension Utils Library](https://github.com/microsoft/vscode-chat-extension-utils)

---

## Example Extensions to Study

1. **vLlama** - Local Ollama integration
2. **Amazon Bedrock Provider** - Cloud model integration
3. **Unify Chat Provider** - Multi-provider support
4. **LiteLLM Provider** - Proxy-based approach

---

## Summary

**Language Model Chat Provider** = Your models in VS Code's model picker  
**Chat Participant** = @forgeai in VS Code's native chat

**Result:** Users can use ForgeAI through Copilot Chat UI without paying GitHub - all inference runs on your infrastructure!

This is a proven pattern used by multiple successful extensions in 2026.
