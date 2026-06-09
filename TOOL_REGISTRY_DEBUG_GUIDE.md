# Tool Registry Debug Guide

## The Issue

The master AI agent is receiving only 7 browser tools instead of ~36 total tools, which prevents it from calling `forgeai_spawnAgent` to spawn specialized sub-agents.

**Symptoms:**

- Master agent blocked from calling tools (logs show "Blocked unauthorized tool call")
- Master agent can't spawn sub-agents
- No streaming updates from sub-agents to UI
- User sees spinning loader but no feedback

## What I Changed

Added debug logging to:

1. **WebviewManager.ts** - Logs when tools are retrieved for the master agent
2. **AgentLoop.ts** - Logs master agent tool list at execution start
3. **ToolRegistry.ts** - Logs tool registration steps and final count

## How to Debug

### Step 1: Compile

```bash
npm run compile
```

### Step 2: Check Logs

Open ForgeAI output channel in VS Code:

- View → Output
- Select "ForgeAI" from dropdown

### Step 3: Trigger Master Agent

- Type a message in ForgeAI chat
- Watch logs appear in real-time

### Step 4: Look for These Messages

**GOOD (what we want to see):**

```
[ToolRegistry] Registered 36 tools: forgeai_readFile, forgeai_writeFile, ... forgeai_spawnAgent
[ToolRegistry.getToolDefinitions] Returning 36 tools: forgeai_readFile, forgeai_writeFile, ... forgeai_spawnAgent
[WebviewManager] Master agent tools OK: 36 tools including forgeai_spawnAgent
[AgentLoop.execute] Master agent starting with 36 tools
[AgentLoop.execute] Tool names: forgeai_readFile, forgeai_writeFile, ... forgeai_spawnAgent
```

**BAD (indicates a problem):**

```
[ToolRegistry] Registered 7 tools: forgeai_browserNavigate, forgeai_browserExtract, ...
[ToolRegistry.getToolDefinitions] Returning 7 tools: forgeai_browserNavigate, forgeai_browserExtract, ...
[WebviewManager] CRITICAL: Master agent missing forgeai_spawnAgent! Available tools: forgeai_browserNavigate, ...
[AgentLoop.execute] CRITICAL: forgeai_spawnAgent NOT found in master tools!
```

## Possible Root Causes

Based on the debug output:

| Scenario                                   | Root Cause                                    | Next Step                                           |
| ------------------------------------------ | --------------------------------------------- | --------------------------------------------------- |
| registerAllTools() only registered 7 tools | Bug in ToolRegistry.registerAllTools()        | Check which tool provider is failing                |
| getToolDefinitions() returned 7 tools      | Tools are being cleared after registration    | Check if dispose() is called prematurely            |
| Master agent got browser tools             | Wrong registry instance being used            | Check if toolRegistry in services is being replaced |
| forgeai_spawnAgent missing from tools list | SubAgentSpawner.createSpawnAgentTool() failed | Check SubAgentSpawner initialization                |

## What to Share

If the debug logs show the issue, please share:

1. The complete log output from "[ToolRegistry] Registered..." through "[AgentLoop.execute]..."
2. Any error messages
3. Whether the issue happens on first load or after some time

## Files Modified

- `src/extension/tools/ToolRegistry.ts` - Added debug logging to registerAllTools() and getToolDefinitions()
- `src/extension/utils/WebviewManager.ts` - Added master agent tool validation in handleSendMessage()
- `src/extension/ollama/AgentLoop.ts` - Added debug logging of received tools at execution start
