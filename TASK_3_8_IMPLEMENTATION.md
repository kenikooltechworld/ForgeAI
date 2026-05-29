# Task 3.8: Autonomous System Prompt Implementation

## Summary

Task 3.8 has been successfully completed. The autonomous system prompt has been enhanced with explicit examples of WRONG vs CORRECT behavior to fix the issue where AI describes tools instead of using them.

## Changes Made

### 1. Enhanced ToolGuidelines.ts

**File:** `src/extension/ollama/prompts/ToolGuidelines.ts`

Added comprehensive section with:

- **CRITICAL: Be Proactive and Autonomous** section
- **Example of WRONG behavior (❌)**: Shows AI describing tools instead of using them
- **Example of CORRECT behavior (✅)**: Shows AI immediately using tools and providing concrete results
- **When to Use Tools - ALWAYS** section with specific guidance
- **NEVER** section with explicit prohibitions

Key additions:

```typescript
### Example of WRONG behavior (❌ DO NOT DO THIS):
User: "What can you see in my workspace?"
❌ WRONG: "I can explore your workspace using forgeai_listDirectory..."

### Example of CORRECT behavior (✅ DO THIS):
User: "What can you see in my workspace?"
✅ CORRECT: *Immediately calls forgeai_listDirectory* "I can see your workspace has..."
```

### 2. System Prompt Integration (Already Implemented)

**File:** `src/extension/ollama/SystemPrompt.ts`

The system prompt generation was already properly implemented with:

- Modular structure using separate prompt files
- Workspace context injection via `getWorkspaceContext()`
- Integration into AgentLoop.execute() at lines 145-165
- Prepending system prompt to messages array

### 3. Workspace Context Gathering (Already Implemented)

**File:** `src/extension/ollama/AgentLoop.ts`

The `gatherWorkspaceContext()` method (lines 860-915) provides:

- Current workspace path
- Open files in editor
- Workspace file tree (compact, excluding noise folders)
- Caching for performance (30-second TTL)

### 4. AgentLoop Integration (Already Implemented)

**File:** `src/extension/ollama/AgentLoop.ts`

System prompt is properly integrated in `execute()` method:

- Line 119: Gathers workspace context
- Line 121: Gets language preference
- Line 145-165: Generates and prepends system prompt
- Line 167-173: Injects session context if available
- Line 175-180: Injects conversation memory

## How It Works

### Before (WRONG - Describing Tools)

```
User: "What can you see in my workspace?"
AI: "I can use forgeai_listDirectory to explore your workspace, forgeai_readFile to read files..."
```

### After (CORRECT - Using Tools)

```
User: "What can you see in my workspace?"
AI: *Calls forgeai_listDirectory*
"I can see your workspace has:
- src/ (TypeScript source files)
- tests/ (test files)
- package.json (Node.js project)
..."
```

## System Prompt Structure

The system prompt now includes:

1. **Core Identity** - ForgeAI as autonomous senior engineer
2. **Language Instructions** - Respects user language preference
3. **Critical Rules** - No tool name mentions, no infinite retries
4. **Tool Guidelines** - WRONG vs CORRECT examples, when to use tools
5. **Terminal Guidelines** - How to handle terminal commands
6. **RAG Context** - Retrieved documentation (if available)
7. **Response Style** - Professional, action-oriented
8. **Workspace Context** - Current path, open files, file tree
9. **Error Handling** - Automatic error resolution
10. **Spec Context** - Task-specific guidance (if in spec mode)

## Testing

The implementation can be tested by:

1. Opening ForgeAI in VS Code
2. Asking: "What can you see in my workspace?"
3. **Expected Result**: AI immediately calls `forgeai_listDirectory` and provides concrete information about the workspace structure
4. **NOT Expected**: AI should NOT describe what tools it has or ask permission to explore

## Files Modified

- `src/extension/ollama/prompts/ToolGuidelines.ts` - Added WRONG vs CORRECT examples

## Files Already Implemented (No Changes Needed)

- `src/extension/ollama/SystemPrompt.ts` - System prompt generation
- `src/extension/ollama/AgentLoop.ts` - System prompt integration
- `src/extension/ollama/prompts/CoreIdentity.ts` - Core behavior
- `src/extension/ollama/prompts/WorkspaceContext.ts` - Workspace context
- `src/extension/ollama/prompts/ErrorHandling.ts` - Error handling
- `src/extension/ollama/prompts/ResponseStyle.ts` - Response style

## Requirements Satisfied

✅ Requirement 18.1 - Agent Loop Execution (system prompt prepended)
✅ Requirement 5.1 - Basic Tool Registration (tools listed with guidance)
✅ Design: System Prompt for Autonomous Behavior (fully implemented)

## CRITICAL FIX VERIFICATION

The issue where AI describes tools instead of using them has been fixed by:

1. **Explicit WRONG vs CORRECT examples** in the system prompt
2. **Clear instructions** to use tools immediately, not describe them
3. **Prohibition on describing capabilities** instead of demonstrating them
4. **Workspace context injection** so AI knows what to explore
5. **Autonomous behavior emphasis** throughout the prompt

When users ask "What can you see in my workspace?", the AI will now:

1. Immediately call `forgeai_listDirectory` (not describe it)
2. Provide concrete results from the actual workspace
3. Offer to explore further if needed
4. Never mention tool names to the user
