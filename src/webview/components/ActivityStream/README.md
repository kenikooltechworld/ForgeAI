# Activity Stream Components

This directory contains the components that make up the Activity Stream interface - the main chat interface for ForgeAI.

## Components

### ActivityStream.tsx

Main container component that orchestrates the three-section layout:

- TabBar (top) - Conversation tabs
- MessageList (middle) - Chat messages
- MessageInput (bottom) - User input

### TabBar.tsx

Browser-like tab interface for managing multiple conversations.

**Features:**

- Multiple conversation tabs
- Active tab highlighting
- New conversation button
- Tab switching

### MessageList.tsx

Displays the conversation history with messages, thinking blocks, and tool cards.

**Features:**

- User and AI messages
- Thinking blocks (AI reasoning)
- Tool execution cards
- Empty state

### MessageInput.tsx

Text input for user messages with send button.

**Features:**

- Multi-line textarea
- Send button
- Enter to send (Shift+Enter for new line)
- VS Code theme integration

### ThinkingBlock.tsx

Collapsible block showing AI's reasoning process.

**Features:**

- 🧠 icon indicator
- Collapsed by default (first line visible)
- Expand/Collapse button
- VS Code theme colors

### ToolCard.tsx

Displays tool execution status with expandable details.

**Features:**

- Tool name with contextual icon (🔧 file ops, 🖥️ terminal, 🔍 search, etc.)
- Target display (file path, command, etc.)
- Status badges:
  - ⏳ Pending
  - ⚙️ Running (with elapsed time)
  - ✓ Complete (with duration)
  - ⚠️ Error (with error message)
- Progress bar for running operations
- Expandable details showing:
  - Input parameters (JSON formatted)
  - Output data (JSON or text)
  - Execution time
- Error messages with red styling
- VS Code theme integration

**Props:**

```typescript
interface ToolCardProps {
  toolName: string; // Name of the tool
  target?: string; // File path, command, etc.
  status: 'Pending' | 'Running' | 'Complete' | 'Error';
  duration?: number; // Execution time in milliseconds
  error?: string; // Error message if failed
  result?: any; // Output data
  arguments?: Record<string, any>; // Input parameters
  startTime?: number; // For calculating elapsed time
}
```

**Usage:**

```tsx
<ToolCard
  toolName="forgeai_readFile"
  target="/path/to/file.ts"
  status="Complete"
  duration={45}
  result="file content here..."
  arguments={{ path: '/path/to/file.ts' }}
/>
```

## Styling Guidelines

All components follow VS Code extension styling best practices:

1. **Primary Method: CSS Classes (90%+)**
   - Use classes from `globals.css`: `bg-editor`, `text-editor`, `border-input`, etc.
   - Better performance and automatic theme integration

2. **Inline Styles: ONLY for Dynamic Values**
   - Use inline styles ONLY for values that change based on props/state
   - Example: `style={{ width: \`${progress}%\` }}`
   - DO NOT use inline styles for static theme colors

3. **VS Code Theme Integration**
   - All components use VS Code CSS variables
   - Automatic light/dark theme support
   - Consistent with VS Code UI

## Requirements Mapping

- **Requirement 12:** Activity Stream Layout
- **Requirement 14:** Thinking Block Display
- **Requirement 15:** Tool Execution Visualization
- **Requirement 16:** Tab Management
- **Requirement 17:** Message Input
- **Requirement 35:** Tool Execution with Progress

## Testing

Test in Extension Development Host:

1. Open ForgeAI sidebar
2. Send a message
3. Verify tool cards appear with correct status
4. Click Expand to see details
5. Verify all icons and colors match VS Code theme
