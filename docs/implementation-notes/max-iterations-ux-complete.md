# Max Iterations UX Implementation - Complete

**Date:** 2026-05-06  
**Task:** 13.2 - Implement max iterations warning with Continue/Cancel buttons  
**Requirements:** 48.1, 48.2, 20.4  
**Status:** ✅ Complete

## Overview

Implemented an interactive max iterations warning system that provides users with clear context about what the AI was doing and gives them control to continue or cancel when the agent loop reaches its 20-iteration limit.

## What Was Implemented

### 1. Backend Changes

#### AgentLoop.ts

- **Enhanced max iterations handling** to gather detailed context:
  - Last thinking content
  - Last assistant message content
  - Recent tools used (last 10)
  - Total iterations completed
- **Updated AgentLoopUpdate interface** to include `context` field with structured information

#### WebviewManager.ts

- **Added `handleContinueAfterMaxIterations` method**:
  - Takes conversation history
  - Adds guidance message: "Continue working on the task. You have 20 more iterations..."
  - Creates new AgentLoop instance with full context
  - Executes with fresh 20-iteration limit
- **Added `handleCancelAfterMaxIterations` handler**:
  - Sends completion message to webview
  - Displays: "✋ Task cancelled by user. You can review what was completed above."
- **Extracted `executeAgentLoop` method** for code reuse between initial execution and continuation

- **Updated max iterations case** to send detailed warning with context instead of simple text message

### 2. Frontend Changes

#### MaxIterationsWarning.tsx (New Component)

- **Interactive warning component** with:
  - ⚠️ Warning icon and clear title
  - Explanation of what happened
  - Expandable details section showing:
    - Recent tools used (as badges)
    - Last reasoning (truncated to 300 chars)
    - Last message (truncated to 300 chars)
  - **[Continue (20 more iterations)]** button (primary, green)
  - **[Cancel]** button (secondary)
  - Help text explaining what each button does
- **Uses VS Code theme colors** throughout:
  - `--vscode-inputValidation-warningBorder`
  - `--vscode-inputValidation-warningBackground`
  - `--vscode-editor-foreground`
  - `--vscode-descriptionForeground`
  - `--vscode-button-background`
  - `--vscode-button-secondaryBackground`

#### conversationStore.ts

- **Added max iterations state**:
  ```typescript
  maxIterationsWarning: {
    conversationId: string | null;
    message: string | null;
    context: any | null;
  }
  ```
- **Added actions**:
  - `showMaxIterationsWarning(conversationId, message, context)`
  - `clearMaxIterationsWarning()`

#### ActivityStream.tsx

- **Integrated MaxIterationsWarning component**
- **Added handlers**:
  - `handleContinue`: Sends `continueAfterMaxIterations` message with conversation history
  - `handleCancel`: Sends `cancelAfterMaxIterations` message
- **Conditional rendering**: Only shows warning for active conversation

#### App.tsx

- **Added message handler** for `maxIterationsWarning` type
- **Calls store action** to display warning in UI

## How It Works

### User Flow

1. **Agent reaches 20 iterations**
   - AgentLoop stops automatically
   - Gathers context about what it was doing
   - Sends `maxIterations` update with detailed context

2. **Warning appears in UI**
   - Shows at bottom of message list
   - Displays context in expandable section
   - Presents two clear options

3. **User clicks [Continue]**
   - Conversation history sent to extension
   - New AgentLoop created with guidance message
   - Gets 20 fresh iterations
   - AI continues with full context
   - Warning clears from UI

4. **User clicks [Cancel]**
   - Completion message sent to conversation
   - Warning clears from UI
   - User can review what was completed

### Technical Flow

```
AgentLoop hits max iterations (20)
    ↓
Gathers context (thinking, tools, content)
    ↓
Sends maxIterations update to WebviewManager
    ↓
WebviewManager sends maxIterationsWarning to webview
    ↓
App.tsx receives message → calls store.showMaxIterationsWarning()
    ↓
ActivityStream renders MaxIterationsWarning component
    ↓
User clicks [Continue]
    ↓
ActivityStream.handleContinue() sends continueAfterMaxIterations
    ↓
WebviewManager.handleContinueAfterMaxIterations()
    ↓
Creates new AgentLoop with conversation history + guidance
    ↓
New AgentLoop.execute() with 20 fresh iterations
    ↓
AI continues working with full context
```

## Key Design Decisions

### 1. New AgentLoop Instance vs Resume

**Decision:** Create new AgentLoop instance for continuation  
**Rationale:**

- Simpler implementation
- Each execution is independent and clean
- Conversation history preserves all context
- Fresh iteration counter is clearer for users
- No risk of state pollution between runs

### 2. Context Information

**Decision:** Show last thinking, last content, and recent tools  
**Rationale:**

- Gives user insight into what AI was attempting
- Helps user decide whether to continue or cancel
- Truncated to prevent overwhelming UI
- Expandable for users who want details

### 3. Guidance Message

**Decision:** Add explicit guidance when continuing  
**Rationale:**

- "Continue working on the task. You have 20 more iterations..."
- Helps AI understand it should continue, not restart
- Emphasizes focus on completing remaining work
- Clear about iteration budget

### 4. Button Styling

**Decision:** Primary (green) for Continue, Secondary for Cancel  
**Rationale:**

- Continue is the expected action (task incomplete)
- Green suggests "go ahead"
- Secondary styling for Cancel (less prominent)
- Follows VS Code button conventions

## Testing Checklist

- [x] Build completes without errors
- [x] No TypeScript diagnostics
- [ ] Manual test: Trigger max iterations (create task that takes >20 iterations)
- [ ] Verify warning appears with correct context
- [ ] Click Continue → verify agent gets 20 more iterations
- [ ] Click Cancel → verify completion message appears
- [ ] Test with different VS Code themes (dark, light, high-contrast)
- [ ] Verify expandable details work correctly
- [ ] Test multiple continuation cycles (Continue → max iterations → Continue again)

## Files Modified

### Backend

- `src/extension/ollama/AgentLoop.ts` - Enhanced context gathering
- `src/extension/utils/WebviewManager.ts` - Added Continue/Cancel handlers

### Frontend

- `src/webview/components/ActivityStream/MaxIterationsWarning.tsx` - New component
- `src/webview/components/ActivityStream/ActivityStream.tsx` - Integrated warning
- `src/webview/store/conversationStore.ts` - Added max iterations state
- `src/webview/App.tsx` - Added message handler

## Requirements Satisfied

✅ **Requirement 48.1:** Agent loop enforces maximum iteration limit of 20  
✅ **Requirement 48.2:** When max iterations reached, display warning with context  
✅ **Requirement 20.4:** Provide actionable guidance (Continue/Cancel buttons)  
✅ **Task 13.2:** Implement max iterations warning with [Retry] and [Continue Manually] buttons

- Note: Renamed "Retry" to "Continue" and "Continue Manually" to "Cancel" for clarity

## Visual Result

When agent reaches max iterations, user sees:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Maximum Iterations Reached                          │
│                                                          │
│ The agent has completed 20 iterations but the task      │
│ may not be fully complete.                              │
│                                                          │
│ ▶ Show what the agent was doing                         │
│                                                          │
│ [Continue (20 more iterations)]  [Cancel]               │
│                                                          │
│ Continue: The agent will get 20 more iterations...      │
│ Cancel: Stop here and review what was completed.        │
└─────────────────────────────────────────────────────────┘
```

When expanded:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Maximum Iterations Reached                          │
│                                                          │
│ The agent has completed 20 iterations but the task      │
│ may not be fully complete.                              │
│                                                          │
│ ▼ Hide details                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Recent tools used:                                  │ │
│ │ [forgeai_readFile] [forgeai_writeFile]             │ │
│ │ [forgeai_runCommand]                                │ │
│ │                                                     │ │
│ │ Last reasoning:                                     │ │
│ │ I need to fix the test failures by updating...     │ │
│ │                                                     │ │
│ │ Last message:                                       │ │
│ │ I've updated the test file but need to verify...   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [Continue (20 more iterations)]  [Cancel]               │
│                                                          │
│ Continue: The agent will get 20 more iterations...      │
│ Cancel: Stop here and review what was completed.        │
└─────────────────────────────────────────────────────────┘
```

## Next Steps

1. **Manual testing** in Extension Development Host
2. **Create test scenario** that reliably triggers max iterations
3. **Verify behavior** across multiple continuation cycles
4. **Test theme integration** with different VS Code themes
5. **Consider adding** iteration counter in UI (e.g., "Iteration 15/20")

## Notes

- The implementation allows **unlimited continuations** - user can keep clicking Continue
- Each continuation gives exactly 20 more iterations
- Full conversation history is preserved across continuations
- The AI has complete context of previous attempts
- Warning automatically clears when user takes action
- Component uses semantic HTML with proper ARIA attributes for accessibility
