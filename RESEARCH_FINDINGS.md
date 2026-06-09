# Research Findings: Master Agent Tool Access Architecture

## The Problem (What You're Experiencing)

Master agent only receives **7 browser tools** instead of **~36 tools + forgeai_spawnAgent**, which blocks it from spawning sub-agents.

## Root Cause (From Web Research)

This is a **KNOWN ARCHITECTURAL PROBLEM** in both Kiro and Claude Code. From GitHub issues:

1. **Claude Code Issue #14714**: "Subagents (Task tool) don't inherit parent conversation's allowed tools"
2. **Claude Code Issue #30280**: "Sub-agents spawned via Agent tool don't reliably inherit MCP tools"
3. **VS Code Issue #284304**: "Subagent spawned by subagent inherits root tools by default, not the spawner's tools"
4. **VS Code Issue #287675**: "Subagents do not inherit tool access from the main agent"
5. **AnswerOverflow reports**: "Sub-agents lack read/exec permissions ('Tool not found') after main agent is granted"

## How Kiro and Claude Code ACTUALLY Handle This

### Kiro's Approach (from kiro.dev):

- **Each task runs in its own isolated context** with NO state leaking between them
- **Custom agents** allow you to tailor behavior by defining **which tools are available** and **what permissions are granted**
- **Subagents are EXPLICITLY SCOPED** - master agent gets limited tools, each sub-agent gets only what it needs
- Tools are NOT automatically inherited - they must be **explicitly registered per agent type**

### Claude Code's Approach (from claude.com + research):

- **Each subagent runs in fresh conversation** with **custom system prompt**, **scoped tool list**, and **independent permissions**
- **Intermediate tool calls stay INSIDE the subagent** - only final message returns
- Master agent is the **ORCHESTRATOR** - gets only **orchestration tools** (spawnAgent-like capability)
- Specialized tools are **INJECTED** into each sub-agent's context, NOT inherited from master

### LangChain Pattern (from docs.langchain.com):

- Central agent (supervisor) coordinates subagents by **calling them as tools**
- Main agent decides WHICH subagent to invoke with WHAT input
- Each subagent has **distinct tool access** - not shared with parent

## The Critical Insight

**MASTER AGENTS AND SUB-AGENTS HAVE DIFFERENT TOOL SETS**

This is NOT a bug - it's **INTENTIONAL ARCHITECTURE**:

| Agent Type                 | Tool Set                                         | Purpose                                         |
| -------------------------- | ------------------------------------------------ | ----------------------------------------------- |
| **Master/Orchestrator**    | Limited: `spawnAgent`, spec tools, diagnostics   | Decide WHAT work to do, delegate to specialists |
| **Sub-Agent (researcher)** | Web: webSearch, fetchPage, browserNavigate, etc. | DO the research in isolation                    |
| **Sub-Agent (code)**       | File/git: readFile, writeFile, runCommand, etc.  | DO the implementation in isolation              |
| **Sub-Agent (review)**     | Read-only: readFile, getDiagnostics, getDiff     | DO the review without modifying                 |

## Why Your Code Is BROKEN

Looking at your architecture:

```typescript
// WebviewManager.ts - Line 357
const tools = this.toolRegistry ? this.toolRegistry.getToolDefinitions() : [];
// Returns ALL ~36 tools + forgeai_spawnAgent

// Then passed to AgentLoop.execute()
await this.executeAgentLoop(agentLoop, conversationId, messages, tools, model, specContext);

// AgentLoop.ts - Line 283
let effectiveTools = tools; // Gets ALL tools

// Then authorization check at Line 396 blocks most tool calls
if (!effectiveTools.some((t) => t.function?.name === toolCall.function.name)) {
  logger.warn(`[AgentLoop] Blocked unauthorized tool call...`);
}
```

**The Problem**: You're passing ALL tools to the master agent, but the registry has BROWSER TOOLS being registered somehow and filtered.

## The Solution (Kiro/Claude Code Pattern)

Create **EXPLICIT TOOL SCOPES** for each agent type:

### Pattern 1: Master Agent Scope

```typescript
const masterAgentTools = toolRegistry.getToolDefinitions().filter((t) => {
  const name = t.function.name;
  // ONLY orchestration + spec tools
  return [
    'forgeai_spawnAgent', // Can spawn sub-agents
    'forgeai_createSpec',
    'forgeai_readSpec',
    'forgeai_startTask',
    'forgeai_runAllTasks',
    'forgeai_getDiagnostics',
  ].includes(name);
});
```

### Pattern 2: Sub-Agent Scopes

```typescript
// In SubAgentSpawner.buildScopedToolRegistry()
const agentToolScopes = {
  'researcher': ['forgeai_webSearch', 'forgeai_webResearch', 'forgeai_fetchPage', 'forgeai_browserNavigate', ...],
  'code': ['forgeai_readFile', 'forgeai_writeFile', 'forgeai_runCommand', 'forgeai_gitStatus', ...],
  'review': ['forgeai_readFile', 'forgeai_getDiagnostics', 'forgeai_generateDiff'],
};
```

## Why This Isn't Implemented Yet

Your current code:

1. ✅ Creates scoped registries for sub-agents (SubAgentSpawner.buildScopedToolRegistry) - **CORRECT**
2. ✅ Defines allowed tools per agent type (AgentRegistry) - **CORRECT**
3. ❌ **FAILS** to define a scoped tool set for the MASTER AGENT
4. ❌ Passes ALL tools to master instead of just orchestration tools

## The Fix (What You Need To Do)

**DO NOT modify your authorization check in AgentLoop** - that's working correctly.

**INSTEAD**: Filter tools BEFORE passing them to the master agent loop:

### In WebviewManager.ts (handleSendMessage):

```typescript
private async handleSendMessage(...) {
  // Get ALL tools
  const allTools = this.toolRegistry ? this.toolRegistry.getToolDefinitions() : [];

  // Filter to ONLY master agent tools (orchestration scope)
  const masterAgentTools = allTools.filter((t: any) => {
    const toolName = t.function?.name;
    return [
      'forgeai_spawnAgent',      // CRITICAL: spawn sub-agents
      'forgeai_createSpec',
      'forgeai_readSpec',
      'forgeai_writeSpec',
      'forgeai_listSpecs',
      'forgeai_continueSpec',
      'forgeai_startTask',
      'forgeai_runAllTasks',
      'forgeai_approveSpec',
      'forgeai_getDiagnostics',
    ].includes(toolName);
  });

  // Pass FILTERED tools to agent loop
  await this.executeAgentLoop(agentLoop, conversationId, messages, masterAgentTools, model, specContext);
}
```

## Key Insight From Research

From **Inngest blog** + **LangChain docs**:

> "A sub-agent is a separate LLM execution context spawned by a parent agent to handle a scoped task. The parent describes the task, provides tools, and gets back a result. **The sub-agent should run in its own context window so it doesn't pollute the parent's.**"

Your WebviewManager passes the same tool registry to AgentLoop. Since AgentLoop is used for BOTH master and sub-agents in your pattern, you need explicit scoping AT CALL TIME.

## Why This Matters

- **Master agent** focuses on orchestration: "What should be done? Which expert handles this?"
- **Sub-agents** focus on execution: "Do this specific task with your tools"
- **Separation of concerns** prevents context pollution and improves reasoning
- **Security**: Master agent cannot accidentally call dangerous tools directly

## Validation Points

After implementing the fix, verify:

1. ✅ Master agent gets `forgeai_spawnAgent` in its tool list
2. ✅ Master agent can call `forgeai_spawnAgent` without "Blocked unauthorized" error
3. ✅ Master agent delegateswork to sub-agents
4. ✅ Sub-agents receive ONLY their scoped tools (from buildScopedToolRegistry)
5. ✅ Sub-agent updates stream to UI (via registerStreamingCallback)
6. ✅ Users see real-time feedback for spawned agent work
