# Implementation Plan: Core Extension Foundation Phase 1 (REVISED - UI-First Approach)

## Overview

This **REVISED** implementation plan builds ForgeAI incrementally with **visible UI progress at each step**. Instead of completing all backend infrastructure before UI, we build features vertically - each task delivers a working, testable piece of the interface.

**Key Changes from Original Plan:**

- ✅ **UI-first approach** - See visual progress immediately
- ✅ **Vertical slices** - Each task completes a full feature (backend + frontend)
- ✅ **Incremental testing** - Test in Extension Development Host after each task
- ✅ **Early feedback** - Catch UI/UX issues before building complex features

The implementation uses TypeScript throughout, with React 19 for the webview UI, Zustand v5 for state management, and native CSS with VS Code theme integration for styling. The extension integrates with Ollama for AI capabilities using the Qwen3-Coder-397B model.

## Styling Guidelines (IMPORTANT)

**All components MUST follow VS Code extension styling best practices:**

1. **Primary Method: Global CSS Classes (90%+ of styling)**
   - Use CSS classes from `globals.css` (e.g., `className="bg-editor text-editor"`)
   - This is the preferred approach for VS Code extensions
   - Better performance and automatic theme integration

2. **Inline Styles: ONLY for Dynamic Values**
   - Use inline styles ONLY for values that change based on props/state
   - Example: `style={{ width: \`${progress}%\` }}` ✅
   - DO NOT use inline styles for static theme colors ❌

3. **CSS Modules: Optional for Complex Components**
   - Use `.module.css` files for complex component-specific layouts
   - Only when utility classes don't fit the use case

**Rationale:** This follows conventions used by official VS Code extensions (GitHub Copilot, GitLens) and provides better performance and maintainability.

## Visual Progression

**After Task 2:** Empty webview with "ForgeAI" title (verify extension loads)
**After Task 3:** Welcome screen with quick action buttons
**After Task 4:** Activity stream with message input (can type but no AI yet)
**After Task 5:** Split-screen layout with live preview panel
**After Task 6:** Working chat with Ollama (see AI responses stream in)
**After Task 7:** Thinking blocks visible (see AI reasoning)
**After Task 8:** Tool execution cards (see file operations in real-time)
**After Task 9:** Code diffs in preview panel (see changes before applying)
**After Task 10:** Tab management (multiple conversations)

## Tasks

### 1. Project Setup and Configuration

- [] 1.1 Initialize VS Code extension project structure
  - Create directory structure: src/extension/, src/webview/, dist/, resources/
  - Initialize package.json with VS Code extension metadata
  - Configure TypeScript with tsconfig.json for both extension and webview
  - Set up .gitignore for node_modules, dist, and build artifacts
  - _Requirements: 1.1, 1.5_

- [] 1.2 Configure build tooling and bundlers
  - Set up esbuild or webpack for extension host bundling
  - Configure Vite for webview React application bundling
  - Add build scripts to package.json: build, watch, package
  - Configure source maps for debugging
  - Set up hot module replacement for development
  - _Requirements: 7.3, 7.5, 53.3_

- [] 1.3 Install and configure dependencies
  - Install VS Code types (@types/vscode ^1.115.0)
  - Install React 19 and React DOM
  - Install Zustand v5 with persist middleware
  - Install node-fetch or axios for HTTP client
  - Install development dependencies (ESLint, Prettier, Vitest)
  - _Requirements: 7.1, 8.1, 9.1_

- [] 1.4 Configure native CSS with VS Code theme integration
  - Create globals.css with VS Code CSS variable utilities
  - Set up utility classes: .bg-editor, .bg-input, .text-editor, etc.
  - Configure VS Code CSS variable syntax: var(--vscode-editor-background)
  - Test theme variable access for editor, input, button, sidebar colors
  - Verify build completes quickly without CSS processing overhead
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 41.1, 41.2, 41.3, 41.4_

- [] 1.5 Set up ESLint and Prettier
  - Configure ESLint 9+ with TypeScript rules
  - Configure Prettier 3+ for code formatting
  - Add lint and format scripts to package.json
  - Configure editor integration for auto-format on save
  - _Requirements: Development best practices_

### 2. Extension Host Core Infrastructure + Welcome Screen UI

- [] 2.1 Implement extension activation and registration
  - Create src/extension/extension.ts with activate() and deactivate() functions
  - Configure package.json with activation events: onStartupFinished, onCommand:forgeai.open
  - Register command "forgeai.open" with title "Open ForgeAI"
  - Add view container in activity bar with icon and title
  - Set extension categories as "AI" and "Programming Languages"
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [] 2.2 Implement Storage Manager
  - Create src/extension/storage/StorageManager.ts
  - Implement getWorkspaceState() and setWorkspaceState() methods
  - Implement getGlobalState() and setGlobalState() methods
  - Implement secret storage methods: getSecret(), setSecret(), deleteSecret()
  - Add setKeysForSync() for cross-machine sync
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [] 2.3 Create webview panel with lifecycle management
  - Implement createWebviewPanel() function in extension.ts
  - Configure webview options: enableScripts, retainContextWhenHidden
  - Set localResourceRoots for dist and resources directories
  - Generate HTML content with proper Content Security Policy
  - Implement getNonce() for CSP nonce generation
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [] 2.4 Implement bidirectional message passing
  - Set up webview.onDidReceiveMessage handler
  - Handle "getState" messages: retrieve from workspaceState and respond
  - Handle "setState" messages: update workspaceState
  - Handle "sendMessage" messages: forward to agent loop
  - Implement postMessage from extension to webview for state updates
  - _Requirements: 6.5, 10.2, 10.3_

- [] 2.5 Build Welcome Screen UI (First Launch Experience)
  - Create src/webview/components/WelcomeScreen.tsx
  - Display title: "Welcome to ForgeAI 🚀"
  - Display subtitle: "Your autonomous AI coding assistant"
  - Show model status: "✓ Connected to Qwen3-Coder-397B (Cloud)" with green checkmark
  - Create 6 quick action buttons in 2x3 grid:
    - 🐛 Fix a bug
    - ✨ Build a feature
    - 📖 Explain code
    - 🧪 Generate tests
    - 🔍 Review changes
    - 📝 Write docs
  - Add message input box with placeholder "Ask ForgeAI anything..."
  - Add Send button
  - Display tip: "💡 Tip: Use Cmd+K anywhere to open the command palette"
  - Add [View Documentation] and [Settings] links at bottom
  - **STYLING:** Use CSS classes from globals.css (e.g., className="bg-editor text-editor bg-button")
  - **STYLING:** Only use inline styles for truly dynamic values (e.g., style={{ width: `${progress}%` }})
  - **STYLING:** Follow VS Code extension best practices - global CSS classes are preferred over inline styles
  - **VISUAL RESULT:** Complete welcome screen matching UI/UX architecture doc
  - **TEST:** Open Extension Development Host, see full welcome screen in sidebar
  - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 21.1, 21.2, 8.3, 8.4, 8.5, 41.2, 41.3, 42.1, 42.4_

- [x] 2.6 Make quick action buttons functional
  - Connect buttons to create new conversation with pre-filled prompts
  - "Fix a bug" → "I'll help you fix a bug. Can you describe the issue, or should I analyze recent error logs and test failures?"
  - "Build a feature" → "I'll help you build a feature. What would you like to create?"
  - "Explain code" → "I'll explain code for you. Which file or function should I explain?"
  - "Generate tests" → "I'll generate tests. Which file or component needs test coverage?"
  - "Review changes" → "I'll review your changes. Should I analyze your last commit or current working changes?"
  - "Write docs" → "I'll help write documentation. Which code needs documentation?"
  - Store conversation in Zustand store (implement basic store first)
  - Hide welcome screen after first interaction
  - **VISUAL RESULT:** Click button, see conversation start with AI prompt
  - **TEST:** Click each button, verify correct prompt appears
  - _Requirements: 22.4, 9.2, 9.4_

- [] 2.7 Implement progressive onboarding tooltips
  - Create src/webview/components/OnboardingTooltip.tsx component
  - Store onboarding state in globalState: { hasSeenThinkingTooltip, hasSeenToolTooltip, hasSeenCodeChangeTooltip }
  - **First message sent tooltip:**
    - Show after user sends first message
    - Content: "💡 Tip: ForgeAI shows its thinking process. Click any thinking block to see detailed reasoning."
    - Buttons: [Got it] [Don't show again]
    - Position: Near first thinking block
  - **First tool execution tooltip:**
    - Show when first tool card appears
    - Content: "💡 Tip: Click any tool card to see execution details and results."
    - Buttons: [Got it] [Don't show again]
    - Position: Near first tool card
  - **First code change tooltip:**
    - Show when first code diff appears in preview panel
    - Content: "💡 Tip: All changes can be undone. Use Cmd+Z or click the undo button."
    - Buttons: [Got it] [Don't show again]
    - Position: Near preview panel
  - Use VS Code theme colors for tooltip styling
  - Persist "don't show again" choices to globalState
  - **VISUAL RESULT:** Contextual tooltips appear at the right moments during first use
  - **TEST:** Fresh install, send message, see tooltip appear
  - _Requirements: First launch experience from UI/UX doc_

### 3. Ollama Integration + Activity Stream with Live Chat

- [x] 3.1 Implement Ollama HTTP client
  - Create src/extension/ollama/OllamaClient.ts
  - Implement chat() method with streaming support
  - Implement listModels() method to retrieve available models
  - Configure default base URL: http://localhost:11434
  - Handle HTTP errors and connection failures gracefully
  - _Requirements: 4.1, 4.2, 4.5_

- [x] 3.2 Implement streaming response handler
  - Create src/extension/ollama/StreamHandler.ts
  - Implement processChunk() to parse streaming JSON chunks
  - Accumulate thinking, content, and tool_calls fields separately
  - Handle incomplete JSON chunks gracefully
  - Implement getAccumulated() to retrieve complete response
  - _Requirements: 4.4, 19.5, 46.2_

- [x] 3.3 Build Activity Stream UI structure
  - Create src/webview/components/ActivityStream/ActivityStream.tsx
  - Create three-section layout: TabBar (top), MessageList (middle), MessageInput (bottom)
  - Create src/webview/components/ActivityStream/TabBar.tsx with single "New Conversation" tab
  - Create src/webview/components/ActivityStream/MessageList.tsx with empty state
  - Create src/webview/components/ActivityStream/MessageInput.tsx with textarea and Send button
  - Apply VS Code theme colors: bg-(--vscode-editor-background), text-(--vscode-editor-foreground)
  - **VISUAL RESULT:** Complete activity stream layout visible in sidebar
  - **TEST:** See tab bar, empty message list, and input box
  - _Requirements: 12.1, 12.2, 12.5, 17.1, 21.1, 21.2_

- [x] 3.4 Connect MessageInput to Ollama (working chat)
  - Implement Zustand conversation store (basic version)
  - Connect MessageInput submit to store.addMessage()
  - Update WebviewManager.handleSendMessage() to call OllamaClient.chat()
  - Stream response chunks to webview via postMessage({ type: "streamChunk", chunk })
  - Create useStreamingResponse hook to accumulate chunks
  - Render user messages and AI responses in MessageList
  - Show typing indicator while AI is responding
  - **VISUAL RESULT:** Type message, press Enter, see AI response stream in word-by-word
  - **TEST:** Send "Hello", see Ollama respond in real-time
  - _Requirements: 4.3, 19.1, 19.2, 19.3, 19.4, 38.1, 38.2_

- [x] 3.5 Implement thinking mode with ThinkingBlock UI
  - Enable think parameter in Ollama API calls
  - Separate thinking chunks from content chunks in stream handler
  - Forward thinking chunks to webview via postMessage
  - Create src/webview/components/ActivityStream/ThinkingBlock.tsx
  - Display thinking in collapsible block with 🧠 icon
  - Show collapsed by default with first line visible
  - Add [Expand ▼] / [Collapse ▲] button
  - Use VS Code theme colors for styling
  - **VISUAL RESULT:** See AI thinking blocks appear before responses
  - **TEST:** Send message, see thinking block with AI's reasoning
  - _Requirements: 4.3, 46.1, 46.3, 14.1, 14.2, 14.3, 14.4, 33.1, 33.5_

- [x] 3.6 Implement connection error handling UI
  - Handle ECONNREFUSED: show error notification "Cannot connect to Ollama. Please ensure Ollama is running on http://localhost:11434"
  - Handle 404 errors: show "Model not found. Please pull the model using: ollama pull qwen3-coder:397b"
  - Handle timeout errors: show "Ollama request timed out. The model may be loading. Please try again."
  - Add [Open Ollama Docs] button to error notifications
  - Display errors in MessageList with red styling and ⚠️ icon
  - Implement exponential backoff retry (1s, 2s, 4s) up to 3 attempts
  - **VISUAL RESULT:** Stop Ollama, send message, see helpful error with action button
  - **TEST:** Verify error messages are clear and actionable
  - _Requirements: 4.5, 20.1, 20.5, 47.1, 47.2, 47.3, 47.4, 47.5_

- [x] 3.7 Implement agent loop with tool execution (placeholder UI)
  - Create src/extension/ollama/AgentLoop.ts
  - Implement execute() method with message history management
  - Execute tool calls sequentially and add results to message history
  - Continue loop until model returns response without tool_calls
  - Enforce maximum iteration limit of 20
  - Provide onUpdate callback for real-time progress updates
  - Create src/webview/components/ActivityStream/ToolCard.tsx (basic version)
  - Display tool name, status (Pending/Complete/Error), and duration
  - **VISUAL RESULT:** See tool execution cards appear in activity stream (tools not functional yet)
  - **TEST:** Tool cards show correct status updates
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 48.1, 48.2, 15.1, 15.2_

- [ ] 3.8 **CRITICAL FIX: Implement autonomous system prompt**
  - Create src/extension/ollama/SystemPrompt.ts with generateSystemPrompt() function
  - System prompt MUST instruct AI to be proactive and autonomous
  - Include explicit examples of WRONG behavior (describing tools) vs CORRECT behavior (using tools)
  - List all available tools with when to use them
  - Add workspace context injection (current path, recent files)
  - Integrate system prompt into AgentLoop.execute() - prepend to messages array
  - Implement getWorkspaceContext() helper to gather workspace info
  - **CRITICAL:** This fixes the issue where AI describes tools instead of using them
  - **VISUAL RESULT:** AI immediately uses tools when asked about workspace
  - **TEST:** Ask "what can you see in my workspace?" - AI should call forgeai_listDirectory, not describe tools
  - _Requirements: 18.1, 5.1, Design: System Prompt for Autonomous Behavior_

### 4. Tool Registry + File System Tools + Live Preview Panel

- [x] 4.1 Implement Tool Registry infrastructure
  - Create src/extension/tools/ToolRegistry.ts with Tool interface
  - Implement registerTool() method with VS Code LM Tools API integration
  - Implement getToolDefinitions() to return OpenAI-compatible tool schemas
  - Implement executeTool() to invoke tools by name
  - Add error handling for tool not found and execution failures
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 4.2 Implement core file system tools (read, write, list)
  - Create src/extension/tools/FileSystemTools.ts
  - Implement forgeai_readFile: read file using vscode.workspace.fs.readFile
  - Implement forgeai_writeFile: write file using vscode.workspace.fs.writeFile
  - Implement forgeai_listFiles: search files using vscode.workspace.findFiles
  - Implement forgeai_listDirectory: list directory using vscode.workspace.fs.readDirectory
  - _Requirements: 5.5, 5.6, 29.1, 29.2, 29.3, 29.4_

- [x] 4.3 Build LivePreview panel with empty state
  - Create src/webview/components/LivePreview/LivePreview.tsx
  - Show empty state with 📄 icon
  - Display text: "Code changes and previews will appear here"
  - Apply VS Code theme colors
  - **VISUAL RESULT:** Right panel shows empty state
  - **TEST:** See empty preview panel in split-screen layout
  - _Requirements: 13.4, 21.1, 21.2_

- [x] 4.4 Implement SplitScreen layout with resizable divider
  - Create src/webview/components/SplitScreen/SplitScreen.tsx
  - Render ActivityStream (left 50%) and LivePreview (right 50%)
  - Implement draggable divider for resizing (30% to 70% range)
  - Persist width ratio to workspaceState
  - Add responsive behavior: collapse LivePreview when width < 1200px
  - **VISUAL RESULT:** Split-screen with resizable divider
  - **TEST:** Drag divider, resize window, see layout adapt
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 36.1, 36.2, 36.3, 36.5_

- [x] 4.5 Enhance ToolCard with expandable details
  - Update src/webview/components/ActivityStream/ToolCard.tsx
  - Display tool name with icon (🔧 for file ops, 🖥️ for terminal, etc.)
  - Show target (file path or command)
  - Display status badge: Pending (⏳ spinner), Running (elapsed time), Complete (✓ duration), Error (⚠️ red)
  - Add [Expand ▼] button to show input parameters and output data
  - Show execution duration in milliseconds when complete
  - Display error message with red styling for failed tools
  - Use VS Code theme colors for all elements
  - **VISUAL RESULT:** Professional tool cards with status and expandable details
  - **TEST:** See tool cards update in real-time during execution
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 35.1, 35.2, 35.3, 35.4, 35.5_

- [x] 4.6 Implement FilePreview component for readFile results
  - Create src/webview/components/LivePreview/FilePreview.tsx
  - Display file path in header
  - Show file content with syntax highlighting (use VS Code theme)
  - Display line numbers
  - Show file metadata: size, last modified
  - Add [Open in Editor] and [Copy] buttons
  - Highlight specific lines if provided by tool result
  - **VISUAL RESULT:** File content appears in preview panel when AI reads files
  - **TEST:** AI reads a file, see content with syntax highlighting in preview
  - _Requirements: 13.3, 24.5, 21.1, 21.2_

- [x] 4.7 Implement directory and file manipulation tools
  - Implement forgeai_createDirectory: create directory using vscode.workspace.fs.createDirectory
  - Implement forgeai_deleteFile: delete file/directory using vscode.workspace.fs.delete
  - Implement forgeai_copyFile: copy file using vscode.workspace.fs.copy
  - Implement forgeai_renameFile: rename/move file using vscode.workspace.fs.rename
  - Implement forgeai_getFileStats: get file metadata using vscode.workspace.fs.stat
  - Show success/error notifications in UI for each operation
  - **VISUAL RESULT:** See tool cards for file operations with success/error status
  - **TEST:** AI creates/deletes/copies files, see operations in tool cards
  - _Requirements: 29.5, 29.6, 29.7, 29.8, 30.1, 30.2, 30.3, 30.4, 30.5, 30.6_

- [x] 4.8 Implement file watching and search tools
  - Implement forgeai_watchFiles: create file watcher using vscode.workspace.createFileSystemWatcher
  - Handle onDidCreate, onDidChange, onDidDelete events
  - Implement forgeai_findFiles: search with include/exclude patterns
  - Implement forgeai_searchInFiles: search file contents with context lines
  - Display search results in LivePreview panel with clickable file paths
  - **VISUAL RESULT:** Search results appear in preview panel with context
  - **TEST:** AI searches files, see results with highlighted matches
  - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5, 31.6, 32.1, 32.2, 32.3, 32.4, 32.5_

- [x] 4.9 Implement terminal tools
  - Create src/extension/tools/TerminalTools.ts
  - Implement forgeai_runCommand: execute shell command using child_process.exec
  - Return stdout, stderr, and exitCode
  - Implement forgeai_createTerminal: create VS Code terminal
  - Handle command execution errors gracefully
  - Display command output in LivePreview panel with stdout (white) and stderr (red)
  - **VISUAL RESULT:** Terminal output appears in preview panel
  - **TEST:** AI runs command, see output in preview
  - _Requirements: 5.7, 5.8_

### 5. Code Diff Component + Apply Changes

**Goal:** Show code changes in preview panel with apply/reject actions

- [x] 5.1 Implement CodeDiff component
  - Create src/webview/components/LivePreview/CodeDiff.tsx
  - Display file path in header with icon
  - Show removed lines with red background (bg-(--vscode-diffEditor-removedTextBackground)) and "-" prefix
  - Show added lines with green background (bg-(--vscode-diffEditor-insertedTextBackground)) and "+" prefix
  - Show unchanged lines with normal styling for context (3 lines before/after changes)
  - Display line numbers for all lines
  - Apply syntax highlighting based on file extension using VS Code theme
  - Use VS Code CSS variables for all colors
  - **VISUAL RESULT:** Professional code diff with VS Code theme colors
  - _Requirements: 13.1, 24.1, 24.2, 24.3, 24.4, 24.5, 21.1, 21.2_

- [ ] 5.2 Add action buttons to CodeDiff
  - Add [Apply Changes] button (primary, green)
  - Add [Reject] button (secondary, red)
  - Add [Open in Editor] button (secondary)
  - Implement Apply: send "applyChanges" message to extension, update file using vscode.workspace.fs.writeFile
  - Implement Reject: close diff view, return to empty state
  - Implement Open in Editor: send "openFile" message to extension, use vscode.window.showTextDocument
  - Show success notification after applying changes
  - **VISUAL RESULT:** Click Apply, see file updated and success message
  - **TEST:** AI suggests code change, see diff, click Apply, verify file updated
  - _Requirements: 13.5, 24.1_

- [ ] 5.3 Implement undo functionality for code changes
  - Store original file content before applying changes
  - Add [Undo] button that appears after applying changes
  - Implement undo: restore original content using vscode.workspace.fs.writeFile
  - Show "Changes undone" notification
  - **VISUAL RESULT:** Apply change, click Undo, see file restored
  - **TEST:** Apply change, undo it, verify file restored to original
  - _Requirements: Onboarding tooltip mentions undo (Cmd+Z)_

### 6. Tab Management + Multi-Conversation Support

**Goal:** Support multiple conversations with browser-like tabs

- [ ] 6.1 Enhance TabBar with full tab management
  - Update src/webview/components/ActivityStream/TabBar.tsx
  - Display all tabs with title (truncate long titles with "...")
  - Add × close button to each tab
  - Highlight active tab with --vscode-tab-activeBackground and --vscode-tab-activeForeground
  - Show inactive tabs with --vscode-tab-inactiveBackground
  - Add "+" button to create new tab
  - Display maximum 10 visible tabs with horizontal scroll for overflow
  - **VISUAL RESULT:** Browser-like tab bar with multiple conversations
  - **TEST:** Create multiple tabs, switch between them, close tabs
  - _Requirements: 16.1, 16.2, 16.4, 16.5, 37.1, 37.5, 37.6_

- [ ] 6.2 Implement drag-and-drop tab reordering
  - Add drag handle to tabs
  - Implement onDragStart, onDragOver, onDrop handlers
  - Update tab order in store when dropped
  - Show visual feedback during drag (highlight drop zone)
  - Persist tab order to workspaceState
  - **VISUAL RESULT:** Drag tabs to reorder them
  - **TEST:** Drag tab to new position, verify order persists after reload
  - _Requirements: 37.1, 37.2_

- [ ] 6.3 Implement tab context menu
  - Add right-click handler to tabs
  - Show context menu with options:
    - Rename (show inline input to edit title)
    - Duplicate (create copy of conversation)
    - Close
    - Close Others (close all except current)
    - Close All
    - Export Conversation (download as JSON)
  - Implement each action with store updates
  - Use VS Code theme colors for context menu
  - **VISUAL RESULT:** Right-click tab, see context menu with actions
  - **TEST:** Try each menu option, verify it works correctly
  - _Requirements: 37.3, 37.4_

- [ ] 6.4 Implement middle-click to close tabs
  - Add onMouseDown handler to detect middle button (button === 1)
  - Close tab on middle-click
  - Activate adjacent tab (right if available, otherwise left)
  - **VISUAL RESULT:** Middle-click tab to close it
  - **TEST:** Middle-click tab, verify it closes and adjacent tab activates
  - _Requirements: 37.2, 37.4_

### 7. Message List Virtualization + Auto-Scroll

**Goal:** Handle long conversations efficiently with smooth scrolling

- [x] 7.1 Implement MessageList with virtualization
  - Update src/webview/components/ActivityStream/MessageList.tsx
  - Install and use react-virtuoso for virtualization
  - Render only visible messages plus 10-message buffer above/below
  - Handle variable-height messages (short text vs long code blocks)
  - Maintain scroll position when new messages added at bottom
  - Use VS Code theme colors for message bubbles
  - **VISUAL RESULT:** Smooth scrolling even with 1000+ messages
  - **TEST:** Load conversation with many messages, scroll smoothly at 60fps
  - _Requirements: 12.2, 51.1, 51.2, 51.3, 51.4, 51.5, 25.2, 25.3_

- [x] 7.2 Implement auto-scroll with manual override
  - Auto-scroll to latest message when new content added
  - Detect manual scroll up (user scrolls away from bottom)
  - Pause auto-scrolling when user manually scrolls up
  - Show [Jump to latest ↓] button when manually scrolled up
  - Resume auto-scroll when user clicks button or scrolls to bottom
  - Use VS Code button colors for "Jump to latest" button
  - **VISUAL RESULT:** Auto-scroll works, pauses when you scroll up, resumes with button
  - **TEST:** Scroll up, send message, see button appear, click it to jump to bottom
  - _Requirements: 12.6, 34.4, 34.5_

- [x] 7.3 Implement message filtering and search
  - Add filter dropdown above MessageList: All, User, Assistant, Tool, Thinking
  - Add search input box with 🔍 icon
  - Filter messages by type when dropdown changes
  - Filter messages by content as user types in search box
  - Debounce search input with 300ms delay
  - Highlight search matches in message content
  - Show "X results" count
  - Use VS Code input colors for search box
  - **VISUAL RESULT:** Filter and search messages in real-time
  - **TEST:** Type in search, see matching messages highlighted
  - _Requirements: 34.2, 34.3, 52.2_

### 8. Thinking Block Enhancements

**Goal:** Show AI reasoning with confidence indicators and detailed explanations

- [x] 8.1 Add confidence indicators to ThinkingBlock
  - Update src/webview/components/ActivityStream/ThinkingBlock.tsx
  - Analyze thinking text for confidence level:
    - High: "I found", "clearly", "definitely", "certain" → ✅ green badge
    - Medium: "I think", "probably", "might", "could" → ⚠️ amber badge
    - Low: "I'm not sure", "uncertain", "unclear", "maybe" → 🔴 red badge
  - Display confidence badge next to 🧠 icon
  - Color-code thinking block border based on confidence
  - **VISUAL RESULT:** Thinking blocks show confidence level
  - **TEST:** See different confidence levels in different thinking blocks
  - _Requirements: 14.5, 33.2, 33.3_

- [x] 8.2 Add "Why?" button for detailed reasoning
  - Add [Why this approach?] button to thinking blocks
  - On click, show modal/expanded view with detailed reasoning
  - Include sections:
    - Root cause analysis
    - Pattern recognition
    - Minimal change principle
    - Data sources used
  - Use VS Code theme colors for modal
  - Add [Close ×] button to modal
  - **VISUAL RESULT:** Click "Why?", see detailed explanation modal
  - **TEST:** Click button, see comprehensive reasoning breakdown
  - _Requirements: 33.4, UI/UX doc "Why?" button section_

- [x] 8.3 Display token usage in thinking blocks
  - Show token count: "Thinking tokens: 245 | Total: 1,234"
  - Display in small text at bottom of expanded thinking block
  - Use muted color (--vscode-descriptionForeground)
  - **VISUAL RESULT:** See token usage when thinking block expanded
  - **TEST:** Expand thinking block, see token count at bottom
  - _Requirements: 33.6_

### 9. Test Results Component

**Goal:** Show test execution results in preview panel

- [ ] 9.1 Implement TestResults component
  - Create src/webview/components/LivePreview/TestResults.tsx
  - Display header: "Test Results" with test file icon 🧪
  - Show test files with pass/fail status:
    - ✓ filename.test.ts (5/5 passed) - green
    - ⚠️ filename.test.ts (3/5 passed) - amber
    - ✗ filename.test.ts (0/5 passed) - red
  - List individual tests under each file:
    - ✓ test name (duration) - green
    - ✗ test name (duration) - red with error message
  - Show summary at bottom: "17/17 tests passed ✓ | Duration: 2.3s"
  - Add [View Details] button to expand error messages
  - Add [Run Again] button to re-run tests
  - Use VS Code theme colors for all elements
  - **VISUAL RESULT:** Professional test results view
  - **TEST:** AI runs tests, see results in preview panel
  - _Requirements: 13.2_

### 10. Settings Panel + Model Selection

**Goal:** Configure extension settings and select AI models

- [x] 10.1 Implement Settings panel (lazy loaded)
  - Create src/webview/components/Settings/Settings.tsx
  - Use React.lazy() for code splitting
  - Display in modal overlay or slide-in panel
  - Add [×] close button
  - Use VS Code theme colors for panel background
  - **VISUAL RESULT:** Click settings icon, see settings panel slide in
  - **TEST:** Open settings, close settings, verify lazy loading
  - _Requirements: 50.1, 50.2, 40.2_

- [x] 10.2 Implement model selection UI
  - Add "Model Configuration" section in Settings
  - Display dropdown list of 10 curated Ollama models (fetch from /api/tags and filter):
    - **Cloud Models (5):**
      1. gpt-oss:120b-cloud - Main coding (default) | Tools ✓ | Context: 128K
      2. gemma4:31b-cloud - Vision + coding | Tools ✓ | Vision 📷 | Context: 128K
      3. qwen3.5:397b-cloud - Complex reasoning | Tools ✓ | Context: 128K
      4. deepseek-v3.1:671b-cloud - Deep research | Tools ✓ | Thinking 🧠 | Context: 64K
      5. kimi-k2.5:cloud - Long context, multimodal | Tools ✓ | Vision 📷 | Context: 200K+
    - **Local Models (5):**
      6. qwen3-vl:8b - Local vision | Tools ✓ | Vision 📷 | ~6GB VRAM
      7. qwen3-coder:30b - Heavy coding | Tools ✓ | ~20GB VRAM
      8. deepseek-r1:8b - Local reasoning | Tools ✓ | Thinking 🧠 | ~6GB VRAM
      9. gemma4:e4b - Fast/efficient | Tools ✓ | ~3GB VRAM
      10. qwen3.5:9b - Balanced local | Tools ✓ | ~6GB VRAM
  - Show model info for each: name, capabilities (Vision 📷, Thinking 🧠, Tools), context window, VRAM (local only)
  - Group models by type: Cloud (☁️) and Local (↓) sections in dropdown
  - Highlight currently selected model: "✓ gpt-oss:120b-cloud (Cloud) - Auto-selected"
  - Show installation status for local models: "↓ Not installed" or "✓ Ready"
  - Update active conversation's model property on selection
  - Display currently selected model in ActivityStream header
  - Cache model list and refresh every 5 minutes
  - Show loading spinner while fetching models
  - Handle errors: "Cannot connect to Ollama to fetch models"
  - **VISUAL RESULT:** See 10 curated models grouped by cloud/local, select different model
  - **TEST:** Change model, send message, verify new model is used
  - _Requirements: 45.1, 45.2, 45.3, 45.4, 45.5_

- [x] 10.3 Implement thinking mode toggle
  - Add "Thinking Visibility" section in Settings
  - Add toggle switch: "● Show thinking process (recommended)" / "○ Hide thinking process"
  - Hide/show all ThinkingBlock components based on toggle state
  - Implement keyboard shortcut: Cmd+/ (Mac) or Ctrl+/ (Windows/Linux)
  - Persist setting to globalState
  - Apply setting across all conversations immediately
  - **VISUAL RESULT:** Toggle thinking visibility on/off
  - **TEST:** Toggle off, see thinking blocks disappear; toggle on, see them reappear
  - _Requirements: 49.1, 49.2, 49.3, 49.4, 49.5_

- [x] 10.4 Add autonomy level setting
  - Add "Autonomy Level" section in Settings
  - Show three radio options:
    - ○ Supervised - Ask before every action
    - ● Semi-Autonomous - Ask for unusual actions (default)
    - ○ Autonomous - Act independently
  - Persist setting to globalState
  - Show info tooltip explaining each level
  - **VISUAL RESULT:** Select autonomy level
  - **TEST:** Change level, verify it persists after reload
  - _Requirements: UI/UX doc Settings section_

### 11. Language Model Chat Provider + Chat Participant (VS Code Native Integration)

**Goal:** Integrate ForgeAI with VS Code's native chat and model picker with FULL autonomous capabilities

**ARCHITECTURE:** Task 11 reuses existing infrastructure (AgentLoop, ToolRegistry, OllamaClient) to provide the same autonomous behavior as the main extension, just with a different UI (VS Code native chat instead of custom webview).

- [x] 11.1 Implement Language Model Chat Provider
  - Create src/extension/providers/LanguageModelChatProvider.ts
  - Implement provideLanguageModelChatInformation() to return model info
  - Return qwen3-coder-397b with maxInputTokens 128000, maxOutputTokens 8192
  - Indicate toolCalling capability as true
  - Implement provideLanguageModelChatResponse() with streaming
  - Implement provideTokenCount() with character-based estimation
  - Register provider with vscode.lm.registerLanguageModelChatProvider
  - **VISUAL RESULT:** Qwen3-Coder-397B appears in VS Code's native model picker
  - **TEST:** Open VS Code chat, see ForgeAI model in dropdown
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 11.2 Implement Chat Participant with AgentLoop Integration
  - Create src/extension/providers/ChatParticipant.ts as thin adapter
  - **REUSE AgentLoop.ts** for autonomous tool execution (no duplication!)
  - **REUSE ToolRegistry.ts** for all 20+ tools (no duplication!)
  - **REUSE OllamaClient.ts** for streaming and tool calling (no duplication!)
  - **REUSE SystemPrompt.ts** for autonomous behavior (no duplication!)
  - Implement convertChatHistory() to convert VS Code chat format to Ollama format
  - Implement streamUpdateToChat() to convert AgentLoop updates to VS Code chat stream
  - Implement handler function that delegates to AgentLoop.execute()
  - Declare slash commands: /fix, /build, /explain, /test
  - Stream progress updates via ChatResponseStream (🔧 tool execution, ✅ completion, ⚠️ errors)
  - Show tool execution progress: "🔧 Executing forgeai_listDirectory..."
  - Show tool completion: "✅ forgeai_listDirectory completed (45ms)"
  - Show terminal output in code blocks when tools execute commands
  - Provide follow-up suggestions with buttons
  - Register participant with vscode.chat.createChatParticipant
  - **IMPLEMENTATION:** ~150 lines of format conversion code, reuses ~1,550 lines from existing infrastructure
  - **VISUAL RESULT:** Type @forgeai in VS Code chat, see ForgeAI respond with FULL tool calling
  - **TEST:** Use @forgeai what files are in my workspace? - should execute forgeai_listDirectory tool
  - **TEST:** Use @forgeai /fix - should analyze code and use tools autonomously
  - **TEST:** See tool execution progress and results in chat
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 18.1 (agent loop), 5.1-5.8 (tools)_
  - _Implementation Notes: docs/implementation-notes/task-11-agent-loop-integration.md_

### 12. Git Tools + Diagnostics Tools

**Goal:** Add Git operations and error diagnostics to tool registry

- [x] 12.1 Implement Git tools
  - Create src/extension/tools/GitTools.ts
  - Get Git API from vscode.git extension
  - Implement forgeai_gitStatus: get branch, changes, staged files
  - Implement forgeai_gitCommit: stage and commit with message
  - Implement forgeai_gitPush, forgeai_gitPull, forgeai_gitCreateBranch
  - Display Git operations in tool cards with branch/commit info
  - **VISUAL RESULT:** AI performs Git operations, see them in tool cards
  - **TEST:** Ask AI to commit changes, see Git commit tool card
  - _Requirements: Git integration_

- [x] 12.2 Implement diagnostics tools
  - Create src/extension/tools/DiagnosticsTools.ts
  - Implement forgeai_getErrors: get all workspace errors/warnings
  - Implement forgeai_getDiagnostics: get diagnostics for specific file
  - Use vscode.languages.getDiagnostics API
  - Return file path, line, column, message, severity, source
  - Display diagnostics in LivePreview panel with clickable file paths
  - **VISUAL RESULT:** AI checks for errors, see diagnostics list in preview
  - **TEST:** Ask AI to find errors, see diagnostics with file locations
  - _Requirements: Diagnostics integration_

### 13. Agent Loop Stop Button + Max Iterations UI

**Goal:** Give users control over long-running agent loops

- [ ] 13.1 Implement agent loop stop functionality
  - Add [Stop ⏹] button in ActivityStream header during agent loop execution
  - Show button only when agent loop is running
  - On click, send "stopAgentLoop" message to extension
  - Gracefully terminate agent loop in extension
  - Display "Stopped by user" message in activity stream with ⏹ icon
  - Log iteration state for debugging
  - Use VS Code button colors (red for stop button)
  - **VISUAL RESULT:** Long-running task, click Stop, see it terminate gracefully
  - **TEST:** Start long task, click Stop button, verify it stops immediately
  - _Requirements: 48.4, 48.5_

- [ ] 13.2 Implement max iterations warning
  - When agent loop reaches 20 iterations, stop automatically
  - Display warning message: "⚠️ Agent reached maximum iterations (20). Task may be incomplete."
  - Show [Retry] and [Continue Manually] buttons
  - Retry: restart agent loop from current state
  - Continue Manually: let user provide guidance
  - Use amber/warning colors for message
  - **VISUAL RESULT:** Agent hits limit, see warning with action buttons
  - **TEST:** Trigger max iterations, see warning appear
  - _Requirements: 48.1, 48.2, 20.4_

### 14. VS Code Theme Integration Testing

**Goal:** Ensure perfect theme integration across all themes

- [ ] 14.1 Implement dynamic theme updates
  - Listen for VS Code theme changes using vscode.window.onDidChangeActiveColorTheme
  - Forward theme change events to webview via postMessage
  - Update CSS variables in webview when theme changes
  - Test all components update colors without reload
  - **VISUAL RESULT:** Change VS Code theme, see ForgeAI colors update instantly
  - **TEST:** Switch between dark/light/high-contrast themes, verify colors update
  - _Requirements: 21.4_

- [ ] 14.2 Verify all VS Code CSS variables are used
  - Audit all components to ensure they use VS Code CSS variables
  - Replace any hard-coded colors with theme variables
  - Test with dark theme (default)
  - Test with light theme
  - Test with high-contrast theme
  - Document all CSS variables used in a reference file
  - **VISUAL RESULT:** Extension looks native in all themes
  - **TEST:** Try all VS Code themes, verify perfect integration
  - _Requirements: 21.1, 21.2, 21.3, 21.5_

### 15. Conversation Persistence Testing

**Goal:** Ensure conversations persist correctly across sessions

- [ ] 15.1 Test conversation persistence end-to-end
  - Create multiple conversations with messages
  - Add thinking blocks, tool cards, code diffs
  - Close ForgeAI sidebar
  - Reload VS Code window
  - Reopen ForgeAI sidebar
  - Verify all conversations restored with correct content
  - Verify activeTabId restored (correct tab selected)
  - Verify tab order preserved
  - **VISUAL RESULT:** Conversations persist perfectly across reloads
  - **TEST:** Create conversations, reload VS Code, verify everything restored
  - _Requirements: 23.1, 23.2, 23.3_

- [ ] 15.2 Test storage quota error handling
  - Fill workspace storage to near quota limit
  - Try to save large conversation
  - Verify graceful error handling
  - Display user-friendly error: "Storage quota exceeded. Please delete old conversations."
  - Provide [Manage Conversations] button to delete old ones
  - **VISUAL RESULT:** Storage full, see helpful error with action button
  - **TEST:** Simulate storage quota error, verify error handling
  - _Requirements: 23.4, 23.5, 44.5_

### 16. Error Handling UI Polish

**Goal:** Ensure all errors have user-friendly messages and actions

- [ ] 16.1 Implement error notification system
  - Create src/webview/components/ErrorNotification.tsx
  - Display errors in activity stream with ⚠️ icon and red styling
  - Show error title and description
  - Provide actionable buttons based on error type:
    - Ollama connection error → [Start Ollama] [Open Docs]
    - Model not found → [Pull Model] [Change Model]
    - Tool execution error → [Retry] [Skip]
    - Network error → [Retry] [Check Connection]
  - Use VS Code notification colors
  - Auto-dismiss after 10 seconds (with option to pin)
  - **VISUAL RESULT:** Errors show with helpful actions
  - **TEST:** Trigger various errors, verify helpful messages appear
  - _Requirements: 20.1, 20.2, 20.3, 20.5_

- [ ] 16.2 Add error recovery actions
  - Implement [Retry] button: re-execute failed operation
  - Implement [Skip] button: continue without failed operation
  - Implement [Report Issue] button: open GitHub issue with error details
  - Log all errors to extension output channel for debugging
  - **VISUAL RESULT:** Error occurs, click Retry, see operation succeed
  - **TEST:** Cause error, use recovery actions, verify they work
  - _Requirements: 20.5_

### 17. Performance Optimization + Performance Metrics UI

**Goal:** Optimize performance and show real-time metrics to verify targets

- [ ] 17.1 Implement lazy loading and code splitting
  - Use React.lazy() for Settings panel
  - Use React.lazy() for LivePreview component
  - Load ActivityStream immediately, defer others
  - Generate separate chunks with max 100KB size
  - Verify initial load within 2 seconds
  - **VISUAL RESULT:** Fast initial load, components load on-demand
  - **TEST:** Open ForgeAI, see instant load; open Settings, see it load separately
  - _Requirements: 50.1, 50.2, 50.3, 50.4, 50.5_

- [ ] 17.2 Implement debouncing and throttling
  - Debounce state persistence writes (1 write per second max)
  - Debounce search input (300ms delay)
  - Throttle file watcher events (10 events per second max)
  - Throttle window resize events (10 events per second max)
  - Cancel pending operations when new operation triggered
  - **VISUAL RESULT:** Smooth typing in search, no lag during rapid events
  - **TEST:** Type rapidly in search, resize window quickly, verify smooth performance
  - _Requirements: 52.1, 52.2, 52.3, 52.4, 52.5_

- [ ] 17.3 Optimize bundle size
  - Configure tree-shaking to eliminate unused code
  - Minify JavaScript and CSS for production
  - Generate source maps but exclude from production bundle
  - Analyze bundle size and warn if chunk exceeds 100KB gzipped
  - Verify total bundle size < 500KB gzipped
  - **VISUAL RESULT:** Small bundle size, fast download
  - **TEST:** Build production bundle, verify size < 500KB gzipped
  - _Requirements: 53.1, 53.2, 53.3, 53.4, 53.5_

- [ ] 17.4 Add performance metrics UI (dev mode only)
  - Create src/webview/components/PerformanceMetrics.tsx (dev mode only)
  - Show in bottom-right corner when NODE_ENV=development
  - Display real-time metrics:
    - FPS counter (target: 60fps)
    - Render time (target: <16ms)
    - Message count in current conversation
    - Memory usage (if available)
    - Bundle size info
  - Use small, semi-transparent overlay
  - Add [×] button to hide metrics
  - Use VS Code theme colors with low opacity
  - **VISUAL RESULT:** Dev mode shows live performance metrics
  - **TEST:** Run in dev mode, see FPS counter and render times
  - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_

- [ ] 17.5 Verify performance targets with visual feedback
  - Test initial UI render within 2 seconds (show loading spinner if slower)
  - Test message updates within 16ms (60fps) - use performance metrics UI
  - Test virtualized list scrolling at 60fps with 1000+ messages
  - Test tool execution within 5 seconds or show timeout warning
  - Add performance warnings in UI if targets not met
  - **VISUAL RESULT:** Performance targets met, no lag or stuttering
  - **TEST:** Load 1000+ messages, scroll smoothly; send messages, see instant updates
  - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_

### 18. Integration and End-to-End Testing + Integration Test UI

**Goal:** Test complete workflows and show test results in UI

- [ ] 18.1 Integrate extension host with webview
  - Connect agent loop to webview message passing
  - Forward streaming chunks from Ollama to webview
  - Handle tool execution results and update UI
  - Test complete message flow: user input → Ollama → tools → UI update
  - **VISUAL RESULT:** Complete integration working end-to-end
  - **TEST:** Send message, see it flow through entire system with UI updates
  - _Requirements: Integration of all components_

- [ ] 18.2 Test complete agent loop workflow
  - Test single-turn conversation (no tools)
  - Test multi-turn conversation with tool calls
  - Test agent loop with multiple tool executions
  - Test max iteration limit enforcement
  - Test manual stop functionality
  - **VISUAL RESULT:** All agent loop scenarios work correctly
  - **TEST:** Try each scenario, verify correct behavior and UI updates
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 18.3 Test all file system tools end-to-end with visual feedback
  - Test readFile → see file content in preview panel
  - Test writeFile → see success notification
  - Test listFiles → see file list in preview
  - Test listDirectory → see directory contents
  - Test createDirectory → see success notification
  - Test deleteFile → see confirmation and success
  - Test copyFile → see source and destination in tool card
  - Test renameFile → see old and new paths
  - Test getFileStats → see file metadata in preview
  - Test watchFiles → see file change events in real-time
  - Test findFiles → see search results with file paths
  - Test searchInFiles → see matches with context lines
  - Verify error handling shows helpful messages for invalid paths and permissions
  - **VISUAL RESULT:** Every file operation shows clear visual feedback
  - **TEST:** Execute each tool, verify UI shows correct results
  - _Requirements: All file system tool requirements_

- [ ] 18.4 Test conversation persistence with visual confirmation
  - Create 3 conversations with different content:
    - Conversation 1: Simple text messages
    - Conversation 2: Messages with thinking blocks
    - Conversation 3: Messages with tool cards and code diffs
  - Add 10+ messages to each conversation
  - Switch between tabs to verify tab switching works
  - Close ForgeAI sidebar
  - Reload VS Code window (Cmd+R or Ctrl+R)
  - Reopen ForgeAI sidebar
  - Verify all 3 conversations restored with exact content
  - Verify activeTabId restored (correct tab selected)
  - Verify tab order preserved
  - Test storage quota error: fill storage, see error notification with [Manage Conversations] button
  - **VISUAL RESULT:** Perfect persistence, everything restored exactly as it was
  - **TEST:** Create conversations, reload VS Code, verify 100% restoration
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

- [ ] 18.5 Test VS Code theme integration across all themes
  - Test with default dark theme (Dark+)
  - Test with default light theme (Light+)
  - Test with high-contrast dark theme
  - Test with high-contrast light theme
  - Test with popular community themes (Dracula, One Dark Pro, Solarized)
  - Test dynamic theme switching: change theme while ForgeAI is open
  - Verify all components update colors instantly without reload
  - Verify all components use theme variables correctly:
    - Activity Stream: background, foreground, borders
    - Live Preview: background, foreground, borders
    - Thinking Blocks: background, foreground, borders
    - Tool Cards: background, foreground, status colors
    - Code Diffs: removed/added line colors
    - Buttons: background, foreground, hover states
    - Input boxes: background, foreground, borders
    - Tabs: active/inactive backgrounds
  - Take screenshots of each theme for documentation
  - **VISUAL RESULT:** Extension looks native in every VS Code theme
  - **TEST:** Switch between all themes, verify perfect color integration
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

- [ ] 18.6 Create integration test results dashboard (dev mode)
  - Create src/webview/components/TestDashboard.tsx (dev mode only)
  - Show test results for all integration tests
  - Display test categories:
    - ✓ Agent Loop Tests (5/5 passed)
    - ✓ File System Tools (12/12 passed)
    - ✓ Conversation Persistence (4/4 passed)
    - ✓ Theme Integration (6/6 passed)
    - ✓ Performance Tests (5/5 passed)
  - Show expandable details for each test
  - Add [Run All Tests] button to re-run tests
  - Use VS Code theme colors for pass/fail indicators
  - **VISUAL RESULT:** Comprehensive test dashboard showing all test results
  - **TEST:** Run tests, see results in dashboard
  - _Requirements: Testing and validation_

### 19. Documentation and Packaging + Documentation UI

**Goal:** Create comprehensive documentation and package for distribution

- [ ] 19.1 Create README.md with setup instructions
  - Document prerequisites: VS Code 1.115+, Node.js 24+ LTS, Ollama
  - Document installation steps with screenshots
  - Document usage examples and quick start guide
  - Document keyboard shortcuts and commands in table format
  - Add troubleshooting section with common issues and solutions
  - Add architecture diagram showing extension components
  - Add screenshots of key features (welcome screen, activity stream, live preview)
  - **VISUAL RESULT:** Professional README with screenshots and diagrams
  - **TEST:** Follow README instructions on fresh machine, verify they work
  - _Requirements: Documentation_

- [ ] 19.2 Create CHANGELOG.md with visual timeline
  - Document Phase 1 features and capabilities
  - List all 53 requirements implemented with checkboxes
  - Note known limitations and future phases (Phase 2: Multi-agent, Phase 3: RAG, Phase 4: Browser)
  - Add version history with dates
  - Include "What's New" section with feature highlights
  - **VISUAL RESULT:** Clear changelog showing all Phase 1 accomplishments
  - **TEST:** Review changelog, verify all features documented
  - _Requirements: Documentation_

- [ ] 19.3 Create in-app documentation panel
  - Create src/webview/components/Documentation/Documentation.tsx
  - Add [?] help button in ForgeAI header
  - Show documentation panel as slide-in overlay
  - Include sections:
    - Getting Started (quick start guide)
    - Keyboard Shortcuts (interactive list)
    - Features Overview (with examples)
    - Troubleshooting (common issues)
    - About (version, credits, links)
  - Add search box to filter documentation
  - Use VS Code theme colors for panel
  - Add [×] close button
  - **VISUAL RESULT:** Built-in help accessible from UI
  - **TEST:** Click [?] button, see documentation panel with all sections
  - _Requirements: First launch experience, user guidance_

- [ ] 19.4 Package extension for distribution
  - Run production build with optimizations
  - Generate .vsix package using vsce
  - Test installation from .vsix file in clean VS Code
  - Verify extension loads and activates correctly
  - Verify all features work after installation
  - Test on Windows, macOS, and Linux (if possible)
  - **VISUAL RESULT:** Working .vsix package ready for distribution
  - **TEST:** Install .vsix, verify extension works perfectly
  - _Requirements: Packaging and distribution_

- [ ] 19.5 Create demo video and screenshots
  - Record 2-minute demo video showing:
    - Welcome screen and first interaction
    - AI fixing a bug with thinking blocks
    - Tool execution with visual feedback
    - Code diff and apply changes
    - Multiple conversations in tabs
  - Capture screenshots of:
    - Welcome screen
    - Activity stream with thinking blocks
    - Live preview with code diff
    - Settings panel
    - Theme integration (dark and light)
  - Add screenshots to README.md and marketplace listing
  - **VISUAL RESULT:** Professional demo materials for users
  - **TEST:** Watch demo video, verify it showcases all key features
  - _Requirements: Marketing and user onboarding_

### 20. Final Checkpoint + Final Validation UI

**Goal:** Comprehensive validation and final polish

- [ ] 20.1 Create comprehensive validation checklist UI
  - Create src/webview/components/ValidationChecklist.tsx (dev mode only)
  - Show validation checklist with all 53 requirements
  - Group requirements by category:
    - ✓ Extension Registration (5 requirements)
    - ✓ Ollama Integration (5 requirements)
    - ✓ Tool Registry (20+ requirements)
    - ✓ UI Components (15 requirements)
    - ✓ Performance (8 requirements)
  - Display checkbox for each requirement with status
  - Add [Run Validation] button to check all requirements
  - Show progress bar during validation
  - Display validation results with pass/fail indicators
  - Add [Export Report] button to save validation report
  - Use VS Code theme colors
  - **VISUAL RESULT:** Interactive validation checklist showing all requirements
  - **TEST:** Run validation, see all 53 requirements checked
  - _Requirements: All 53 requirements_

- [ ] 20.2 Comprehensive testing and validation
  - Verify all 53 requirements are implemented
  - Test all features end-to-end with visual confirmation
  - Verify performance targets met (use performance metrics UI)
  - Test error handling and edge cases
  - Test on different VS Code versions (1.115+)
  - Test on different operating systems (Windows, macOS, Linux)
  - Test with different Ollama models
  - Test with large workspaces (1000+ files)
  - Test with long conversations (1000+ messages)
  - **VISUAL RESULT:** All tests pass, extension works flawlessly
  - **TEST:** Run all tests, verify 100% pass rate
  - _Requirements: All requirements_

- [ ] 20.3 Create final demo scenario
  - Create a complete demo workflow showing all features:
    1. Open ForgeAI, see welcome screen
    2. Click "Fix a bug" quick action
    3. AI analyzes code with thinking blocks
    4. AI executes file system tools (visible in tool cards)
    5. AI generates fix with code diff in preview panel
    6. Apply fix, see success notification
    7. AI runs tests, see results in preview panel
    8. Create new tab for another task
    9. Switch between tabs
    10. Change VS Code theme, see colors update
    11. Open settings, change autonomy level
    12. Close and reopen ForgeAI, see conversations restored
  - Record this workflow as final demo video
  - Take screenshots at each step
  - **VISUAL RESULT:** Complete demo showing every feature working perfectly
  - **TEST:** Follow demo scenario, verify every step works
  - _Requirements: All features working together_

- [ ] 20.4 Final polish and cleanup
  - Remove all console.log statements (except critical errors)
  - Remove all TODO comments (or convert to GitHub issues)
  - Remove all unused imports and dead code
  - Format all code with Prettier
  - Lint all code with ESLint (zero warnings)
  - Run TypeScript compiler with strict mode (zero errors)
  - Optimize all images and assets
  - Verify bundle size < 500KB gzipped
  - **VISUAL RESULT:** Clean, production-ready codebase
  - **TEST:** Run linter and compiler, verify zero errors/warnings
  - _Requirements: Code quality and production readiness_

- [ ] 20.5 Create release checklist
  - Create RELEASE_CHECKLIST.md with final steps:
    - [ ] All 53 requirements implemented and tested
    - [ ] All tests passing (unit, integration, e2e)
    - [ ] Performance targets met (load <2s, 60fps, bundle <500KB)
    - [ ] Documentation complete (README, CHANGELOG, in-app help)
    - [ ] Demo video and screenshots created
    - [ ] Extension packaged as .vsix
    - [ ] Tested on Windows, macOS, Linux
    - [ ] Tested with VS Code 1.115+
    - [ ] Tested with Ollama and Qwen3-Coder-397B
    - [ ] No console errors or warnings
    - [ ] Code formatted and linted
    - [ ] Ready for Phase 2 (Multi-agent orchestration)
  - **VISUAL RESULT:** Complete release checklist confirming readiness
  - **TEST:** Review checklist, verify all items checked
  - _Requirements: Release readiness_

## Notes

- All tasks reference specific requirements for traceability
- The implementation uses TypeScript throughout for type safety
- React 19 features (useActionState, useOptimistic, use) are leveraged for modern UI patterns
- Native CSS with VS Code CSS variables is used for theme integration
- Zustand v5 with persist middleware handles state management
- Performance optimization is integrated throughout, not just at the end
- Each major component has dedicated tasks for implementation and testing
- The plan follows a logical progression: setup → infrastructure → UI → integration → optimization
