# Conversation History Fix

## Problem

The AI was not receiving previous conversation messages - it could not remember user's previous messages or its own responses. Each message was treated as a new conversation with no context.

## Root Cause

In `src/extension/utils/WebviewManager.ts`, the `handleSendMessage` method was only passing the current user message to AgentLoop:

```typescript
// ❌ BEFORE - No conversation history
await agentLoop.execute(
  [
    {
      role: 'user',
      content: message,
    },
  ],
  ...
)
```

This violated **Requirement 18.2-18.3** which states:

- "WHEN a tool execution completes, THE Extension_Host SHALL add the tool result to the message history with role 'tool'"
- "WHEN all tool results are added, THE Extension_Host SHALL send a new chat request to the model with updated message history"

## Solution

### 1. Updated WebviewManager to Accept Conversation History

Modified `handleSendMessage` to accept and process conversation history:

```typescript
// ✅ AFTER - Full conversation history
private async handleSendMessage(
  conversationId: string,
  message: string,
  conversationHistory: any[] = []
): Promise<void> {
  // Convert conversation history to Ollama message format
  const messages = conversationHistory.map((msg: any) => ({
    role: msg.role,
    content: msg.content || '',
    thinking: msg.thinking,
    tool_calls: msg.tool_calls,
    tool_name: msg.tool_name,
  }));

  // Add current user message
  messages.push({
    role: 'user',
    content: message,
  });

  // Execute agent loop with full history
  await agentLoop.execute(messages, ...);
}
```

### 2. Updated MessageInput to Send Conversation History

Modified `src/webview/components/ActivityStream/MessageInput.tsx` to include conversation history in the message:

```typescript
// Get conversation history for context
const conversation = conversations.find((c) => c.id === conversationId);
const conversationHistory = conversation?.messages || [];

// Send to extension host with conversation history
window.vscode.postMessage({
  type: 'sendMessage',
  conversationId,
  content,
  conversationHistory, // ✅ Now includes full history
});
```

## Files Changed

1. **src/extension/utils/WebviewManager.ts**
   - Modified `handleSendMessage` signature to accept `conversationHistory` parameter
   - Added message history conversion logic
   - Added logging for history length

2. **src/webview/components/ActivityStream/MessageInput.tsx**
   - Added `conversations` selector from store
   - Added logic to retrieve conversation history before sending
   - Updated `postMessage` to include `conversationHistory`

## Testing

Build successful:

- Extension: 96.3kb
- Webview: 600.73kb gzipped

## Expected Behavior After Fix

✅ AI will now remember:

- Previous user messages in the conversation
- Its own previous responses
- Tool execution results
- Complete conversation context

✅ Multi-turn conversations will work correctly:

- User: "Create a file called test.txt"
- AI: [creates file]
- User: "Now add 'Hello World' to it" ← AI will remember the file name from previous message
- AI: [adds content to test.txt]

## Requirements Satisfied

- ✅ Requirement 18.2: Tool results added to message history
- ✅ Requirement 18.3: New chat requests include updated message history
- ✅ Requirement 23: Conversation persistence (history is stored in Zustand and passed to AI)
- ✅ Design: Agent Loop receives full conversation history as specified

## Additional Fixes in This Session

1. **Path Bug Fix** - Fixed absolute path handling in `handleApplyChanges`, `handleOpenFile`, and `handleUndoChanges`
2. **CodeDiff Scrollbar** - Fixed overflow handling in CodeDiff component
