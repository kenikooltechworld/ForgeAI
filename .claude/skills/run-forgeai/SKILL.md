---
name: run-forgeai
description: build, run, and smoke-test the ForgeAI VS Code extension
---

ForgeAI is an autonomous AI coding assistant for VS Code, powered by Ollama. Since it is a VS Code extension, it normally requires a full VS Code instance to run. To enable programmatic driving and testing in headless environments, this skill provides a Node.js-based smoke test driver that mocks the VS Code API.

## Prerequisites

Ensure you have Node.js (>= 24.0.0) and `tsx` installed.

```bash
npm install -g tsx
```

## Build

The extension must be compiled before running the driver.

```bash
npm run compile
```

## Run (Agent Path)

The primary way to verify the extension's core logic without a GUI is using the smoke test driver. This driver verifies LLM connectivity, tool registration, and workspace initialization.

```bash
export NODE_PATH=$(pwd)/.claude/skills/run-forgeai/node_modules
npx tsx .claude/skills/run-forgeai/driver.mjs
```

The driver performs the following checks:
1. **Ollama Connectivity**: Verifies the LLM server is reachable.
2. **Tool Registry**: Confirms core tools (like `forgeai_writeFile`) are correctly registered.
3. **Workspace Initialization**: Verifies that `.forgeai/specs` is created.

## Run (Human Path)

For manual verification:
1. Open the project in VS Code.
2. Press `F5` to launch the Extension Development Host.
3. Open the ForgeAI chat view and interact with the assistant.

## Gotchas

- **VS Code Dependencies**: The extension depends heavily on the `vscode` module, which is only available at runtime within VS Code. The driver uses a mock implementation located in `.claude/skills/run-forgeai/node_modules/vscode` to bypass this.
- **Ollama Server**: The AI features require an Ollama server running at `http://localhost:11434`. If the server is missing, the smoke test will warn but continue to test non-LLM functionality.

## Troubleshooting

- **"Cannot find module 'vscode'"**: Ensure `NODE_PATH` is set to include the skill's mock directory: `export NODE_PATH=$(pwd)/.claude/skills/run-forgeai/node_modules`.
- **Build errors**: Run `npm run clean` and then `npm run compile` again.
