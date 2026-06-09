# Root Cause Analysis: Master Agent Cannot Call forgeai_spawnAgent

## Web Research Findings

### From Kiro Documentation

- **Subagents**: "let you hand off a focused task to an agent that runs in its own isolated context"
- **Custom Subagents**: "Create a frontend-agent that knows about components and browser tooling. Create a backend-agent that loads your database server"
- **Key Pattern**: "Each subagent stays focused and manages its own context" - meaning each subagent gets ONLY the tools it needs

### From Claude Code Patterns

1. **Architecture**: "Each runs in its own context window with a custom system prompt, a scoped tool list, and independent permissions"
2. **Isolation**: "The parent session delegates work to the subagent, the subagent does the work in isolation, and the parent gets back only the summary"
3. **Tool Scoping**: "Give each agent the narrowest typed tools its workflow needs"
4. **Permission Model**: "Control AI agent tool access in production by enforcing permissions outside the model, not in the prompt"

### From Best Practices

- **Tool Registry Model**: "The moment a tool is in the registry and the registry is loaded into the agent's context, the agent has been granted the capability"
- **Isolation Pattern**: "Skills inject content into the parent's context window, while subagents run in fresh isolated windows with their own model, tools"
- **Scoping Pattern** (TaskTool in Langroid): "When an agent encounters a task that requires specialized tools or isolated execution, it can spawn a new sub-agent with exactly the capabilities needed for that task"

### Common Issues Found on GitHub

1. **Issue #64909 (Claude Code)**: "Sub-agents dispatched via Task tool have empty MCP tool registry"
2. **Issue #47118 (Claude Code)**: "Parent MCP server registrations leak into sub-agent tool output"
3. **Issue #14714 (Claude Code)**: "Subagents don't inherit parent conversation's allowed tools"

---

## The Problem in ForgeAI

### Current State

```
Master Agent receives: 7 tools (ONLY browser tools)
Master Agent needs: ~36 tools + forgeai_spawnAgent to delegate work
Result: Authorization check blocks forgeai_spawnAgent ❌
```

### Root Cause: TWO SEPARATE ISSUES

**Issue 1: Browser Tools Leaked to Master Registry**

- SubAgentSpawner.EXTRA_TOOL_METHODS has browser tools (11 tools)
- When ToolRegistry.registerAllTools() is called, it should register ~26 main tools + 1 spawnAgent
- But master agent is receiving ONLY 7 browser tools
- This suggests browser tools from EXTRA_TOOL_METHODS are somehow being passed instead of main registry

**Issue 2: Master Agent Doesn't Get forgeai_spawnAgent**

- ToolRegistry.registerAllTools() correctly creates spawnAgent tool via SubAgentSpawner.createSpawnAgentTool()
- But this tool is not in the tools array passed to executeAgentLoop()
- The tools array appears to be a filtered/scoped list instead of the full registry

### Why This Happens

Looking at the code flow:

1. `WebviewManager.handleSendMessage()` calls `this.toolRegistry.getToolDefinitions()`
2. `ToolRegistry.getToolDefinitions()` returns all tools from the internal registry
3. These tools are passed to `AgentLoop.execute(..., tools)`
4. AgentLoop receives the tools array and uses it for the authorization check

**The Gap**: Between step 2 (getToolDefinitions) and step 4 (AgentLoop execution), the tools array is somehow being filtered OR a different registry/tool set is being used.

---

## Correct Pattern (From Research)

### Kiro/Claude Code Approach

```
1. Master Agent has: [orchestration tools] + [spawnAgent tool]
   - forgeai_spawnAgent
   - forgeai_createSpec
   - forgeai_readSpec
   - forgeai_writeSpecArtifact
   - (file/terminal/git tools for direct work)

2. Sub-agents have: [specialized tools for their role]
   - researcher gets: webSearch, fetchPage, browserTools
   - code agent gets: readFile, writeFile, runCommand, git tools
   - spec agent gets: specTools only

3. Isolation model:
   - Master agent: lean + orchestration focus
   - Sub-agents: fresh context + scoped tools + custom system prompt
   - Result: Master can delegate, sub-agents are focused, context stays clean
```

### The Architecture Intent

- **Design Goal**: Master should be thin orchestrator, NOT do specialized work
- **Master Tools**: Only orchestration + basic tools (specs, file reading)
- **Browser/Web Tools**: ONLY accessible to sub-agents (researcher, browserMirror types)
- **Authorization Model**: Master CAN call forgeai_spawnAgent; sub-agents CANNOT (they're created fresh)

---

## Why Current Implementation Fails

### Evidence from Logs

```
[ToolRegistry] Registered X tools: ... (includes forgeai_spawnAgent)
BUT
[AgentLoop.execute] Master agent starting with 7 tools
Tool names: forgeai_browserNavigate, forgeai_browserExtract, forgeai_browserClick, ...
[AgentLoop.execute] CRITICAL: forgeai_spawnAgent NOT found in master tools!
```

### Theory

The master agent is receiving a **sub-agent's tool set** instead of the master agent's tool set.

**Possible causes**:

1. `getToolDefinitions()` is being filtered somewhere after being called
2. A different ToolRegistry instance is being used (browser-scoped registry)
3. The tools array is being constructed from EXTRA_TOOL_METHODS instead of the main registry
4. WebviewManager is creating its own filtered tool list somewhere

---

## Solution Strategy

### Step 1: Verify Tool Registration ✓ (Debug Logging Added)

- Check what `ToolRegistry.registerAllTools()` actually registers
- Verify spawnAgent tool is in the main registry
- Log: `[ToolRegistry] Registered X tools: ...list...`

### Step 2: Trace Tool Flow to AgentLoop

- Check what `getToolDefinitions()` returns
- Log: `[ToolRegistry.getToolDefinitions] Returning X tools`
- Verify forgeai_spawnAgent is in the returned array

### Step 3: Check WebviewManager Tool Passing

- Log what tools are passed to executeAgentLoop()
- Log what AgentLoop actually receives

### Step 4: Root Cause Discovery

- If tools are wrong at getToolDefinitions() → problem is in ToolRegistry
- If tools are correct at getToolDefinitions() but wrong in AgentLoop → problem is in WebviewManager
- If tools are correct in AgentLoop but authorization still fails → problem is in AgentLoop authorization logic

### Step 5: Fix

- Ensure master agent receives all tools from ToolRegistry (including forgeai_spawnAgent)
- Keep sub-agents receiving scoped tools (correct behavior already implemented)

---

## Implementation Checklist

- [ ] Run compile: `npm run compile`
- [ ] Check debug logs for `[ToolRegistry]` messages
- [ ] Check debug logs for `[ToolRegistry.getToolDefinitions]` messages
- [ ] Check debug logs for `[AgentLoop.execute]` CRITICAL messages
- [ ] Compare tool count and names at each step
- [ ] If master has 7 tools instead of ~36+spawnAgent, trace where it gets filtered
- [ ] Fix the filtering/scoping issue
- [ ] Verify master agent can now call forgeai_spawnAgent
- [ ] Verify sub-agents still get scoped tools
- [ ] Test: Master spawns researcher → researcher can use webSearch/fetchPage
- [ ] Test: Streaming callback propagates sub-agent updates to UI
