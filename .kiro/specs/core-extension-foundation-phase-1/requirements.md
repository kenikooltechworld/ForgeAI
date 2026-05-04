# Requirements Document

## Introduction

ForgeAI is an autonomous AI coding assistant delivered as a VS Code extension. This document specifies the requirements for **Phase 1: Core Extension Foundation**, which establishes the foundational infrastructure including VS Code extension setup, webview with React 19 UI, Ollama integration with Qwen3-Coder-397B, basic tool calling, and split-screen interface with thinking visualization.

Phase 1 focuses exclusively on the foundation layer. Multi-agent orchestration (Phase 2), RAG system (Phase 3), and browser automation (Phase 4) are explicitly out of scope.

## Glossary

- **Extension_Host**: The VS Code extension backend process that runs Node.js code and has access to VS Code APIs
- **Webview**: The sandboxed iframe-based UI component that renders the React application
- **Ollama**: Local/cloud LLM inference server that provides model execution capabilities
- **Qwen3_Coder_397B**: The default language model auto-selected for ForgeAI (cloud-hosted via Ollama)
- **Language_Model_Chat_Provider**: VS Code API that registers custom models into the native model picker
- **Chat_Participant**: VS Code API that registers @forgeai as an invokable chat participant
- **LM_Tool**: VS Code API for registering functions that the language model can invoke autonomously
- **Activity_Stream**: The left panel UI component showing conversation history and real-time AI actions
- **Live_Preview**: The right panel UI component showing code diffs, test results, and file previews
- **Thinking_Block**: UI component that displays the AI's reasoning process with collapsible details
- **Tool_Card**: UI component that displays tool execution status with expandable details
- **Workspace_State**: VS Code storage API for persisting data per-workspace
- **Global_State**: VS Code storage API for persisting data globally across all workspaces
- **Message**: A single conversation entry containing role (user/assistant/tool) and content
- **Conversation**: A collection of messages representing a complete interaction session
- **Tab**: A UI container for an independent conversation with isolated state

## Requirements

### Requirement 1: VS Code Extension Registration

**User Story:** As a VS Code user, I want ForgeAI to appear as a native extension, so that I can access it through standard VS Code interfaces.

#### Acceptance Criteria

1. THE Extension_Host SHALL register the extension with identifier "forgeai.forgeai"
2. THE Extension_Host SHALL declare activation events for "onStartupFinished" and "onCommand:forgeai.open"
3. THE Extension_Host SHALL contribute a command "forgeai.open" with title "Open ForgeAI"
4. THE Extension_Host SHALL contribute a view container in the sidebar with icon and title "ForgeAI"
5. THE Extension_Host SHALL register the extension category as "AI" and "Programming Languages"

### Requirement 2: Language Model Chat Provider Registration

**User Story:** As a developer, I want Qwen3-Coder-397B to appear in VS Code's native model picker, so that ForgeAI models integrate seamlessly with the VS Code ecosystem.

#### Acceptance Criteria

1. THE Extension_Host SHALL register a Language_Model_Chat_Provider with vendor "forgeai"
2. THE Language_Model_Chat_Provider SHALL provide model information for "qwen3-coder-397b" with maxInputTokens 128000 and maxOutputTokens 8192
3. THE Language_Model_Chat_Provider SHALL indicate toolCalling capability as true for "qwen3-coder-397b"
4. WHEN provideLanguageModelChatResponse is invoked, THE Language_Model_Chat_Provider SHALL stream response chunks via the progress callback
5. WHEN provideTokenCount is invoked, THE Language_Model_Chat_Provider SHALL return an estimated token count for the provided text

### Requirement 3: Chat Participant Registration

**User Story:** As a VS Code user, I want to invoke ForgeAI using @forgeai in chat, so that I can interact with the assistant using natural language.

#### Acceptance Criteria

1. THE Extension_Host SHALL register a Chat_Participant with name "forgeai" and fullName "ForgeAI"
2. THE Chat_Participant SHALL declare slash commands: "fix", "build", "explain", and "test"
3. WHEN a chat request is received, THE Chat_Participant SHALL stream progress updates via the ChatResponseStream
4. WHEN a chat request is received, THE Chat_Participant SHALL use the model selected by the user via request.model
5. THE Chat_Participant SHALL provide follow-up suggestions based on the conversation context

### Requirement 4: Ollama Integration

**User Story:** As a developer, I want ForgeAI to communicate with Ollama, so that I can use Qwen3-Coder-397B for code generation and analysis.

#### Acceptance Criteria

1. THE Extension_Host SHALL connect to Ollama server at http://localhost:11434 by default
2. WHEN sending a chat request, THE Extension_Host SHALL use the Ollama chat API with model "qwen3-coder:397b"
3. WHEN sending a chat request, THE Extension_Host SHALL enable thinking mode by setting think parameter to true
4. WHEN receiving a streaming response, THE Extension_Host SHALL accumulate thinking, content, and tool_calls fields separately
5. THE Extension_Host SHALL handle connection errors gracefully and display user-friendly error messages

### Requirement 5: Basic Tool Registration

**User Story:** As an AI agent, I want access to file system and terminal tools, so that I can read code, write changes, and execute commands autonomously.

#### Acceptance Criteria

1. THE Extension_Host SHALL register an LM_Tool named "forgeai_readFile" with inputSchema requiring a "path" property
2. THE Extension_Host SHALL register an LM_Tool named "forgeai_writeFile" with inputSchema requiring "path" and "content" properties
3. THE Extension_Host SHALL register an LM_Tool named "forgeai_runCommand" with inputSchema requiring a "command" property
4. THE Extension_Host SHALL register an LM_Tool named "forgeai_searchCode" with inputSchema requiring a "query" property
5. WHEN forgeai_readFile is invoked, THE Extension_Host SHALL read the file using vscode.workspace.fs.readFile and return the content as UTF-8 text
6. WHEN forgeai_writeFile is invoked, THE Extension_Host SHALL write the content using vscode.workspace.fs.writeFile
7. WHEN forgeai_runCommand is invoked, THE Extension_Host SHALL execute the command using child_process.exec and return stdout, stderr, and exitCode
8. WHEN forgeai_searchCode is invoked, THE Extension_Host SHALL search workspace files using vscode.workspace.findFiles and return matching results with file path, line number, and text

### Requirement 6: Webview Creation and Lifecycle

**User Story:** As a VS Code user, I want ForgeAI to appear automatically in the sidebar when I open VS Code, so that I have immediate access to the AI assistant without running commands.

#### Acceptance Criteria

1. THE Extension_Host SHALL register a WebviewViewProvider for the view "forgeai.chatView" contributed in package.json
2. THE WebviewView SHALL appear automatically in the ForgeAI sidebar container when VS Code starts (no manual command required)
3. THE Webview SHALL enable scripts via enableScripts option
4. THE Webview SHALL retain context when hidden via retainContextWhenHidden option
5. THE Webview SHALL load the React application HTML with proper Content Security Policy
6. THE Webview SHALL establish bidirectional message passing between Extension_Host and Webview
7. THE "forgeai.open" command SHALL focus the ForgeAI sidebar view if it's not already visible

### Requirement 7: React 19 Application Setup

**User Story:** As a developer, I want the UI built with React 19, so that I can leverage modern hooks like useActionState and useOptimistic.

#### Acceptance Criteria

1. THE Webview SHALL render a React 19 application as the root component
2. THE React_Application SHALL use React.StrictMode for development
3. THE React_Application SHALL use a bundler that supports React 19 features
4. THE React_Application SHALL load within 2 seconds on initial render
5. THE React_Application SHALL handle hot module replacement during development

### Requirement 8: Tailwind CSS v4.0 Integration

**User Story:** As a developer, I want styling with Tailwind CSS v4.0, so that I can use utility classes with VS Code CSS variables for perfect theme integration.

#### Acceptance Criteria

1. THE React_Application SHALL import Tailwind CSS v4.0 styles
2. THE Tailwind_Configuration SHALL define theme variables using @theme directive
3. THE React_Application SHALL access VS Code CSS variables using the syntax "bg-(--vscode-editor-background)"
4. THE React_Application SHALL support all VS Code theme variables including editor, input, button, and sidebar colors
5. THE Tailwind_Build SHALL complete within 500ms for incremental changes

### Requirement 9: Zustand v5 State Management

**User Story:** As a developer, I want centralized state management with Zustand v5, so that I can manage conversations, tabs, and UI state efficiently.

#### Acceptance Criteria

1. THE React_Application SHALL create a Zustand store for conversation state
2. THE Conversation_Store SHALL maintain an array of conversations with id, messages, and model properties
3. THE Conversation_Store SHALL maintain an activeTabId property indicating the current conversation
4. THE Conversation_Store SHALL provide actions: addConversation, removeConversation, addMessage, and switchTab
5. THE Conversation_Store SHALL use the persist middleware with VS Code storage adapter

### Requirement 10: VS Code Storage Integration

**User Story:** As a VS Code user, I want my conversations persisted across sessions, so that I can resume work without losing context.

#### Acceptance Criteria

1. THE Extension_Host SHALL provide a storage adapter that uses context.workspaceState for conversation persistence
2. WHEN the Webview requests state via postMessage, THE Extension_Host SHALL retrieve the value from workspaceState and respond
3. WHEN the Webview updates state via postMessage, THE Extension_Host SHALL store the value in workspaceState
4. THE Storage_Adapter SHALL serialize state as JSON before storage
5. THE Storage_Adapter SHALL deserialize state from JSON after retrieval

### Requirement 11: Split-Screen Layout

**User Story:** As a VS Code user, I want a split-screen interface with activity stream and live preview, so that I can see AI actions and results simultaneously.

#### Acceptance Criteria

1. THE React_Application SHALL render a two-column layout with Activity_Stream on the left and Live_Preview on the right
2. THE Activity_Stream SHALL occupy 50% width by default
3. THE Live_Preview SHALL occupy 50% width by default
4. THE Split_Screen SHALL support resizing via a draggable divider
5. WHEN window width is less than 1200px, THE React_Application SHALL collapse Live_Preview and show Activity_Stream at full width

### Requirement 12: Activity Stream Component

**User Story:** As a VS Code user, I want to see a chronological feed of AI actions, so that I understand what the assistant is doing in real-time.

#### Acceptance Criteria

1. THE Activity_Stream SHALL display a tab bar at the top showing all open conversations
2. THE Activity_Stream SHALL display messages in chronological order with user messages and assistant responses
3. THE Activity_Stream SHALL display Thinking_Block components for AI reasoning with collapsible details
4. THE Activity_Stream SHALL display Tool_Card components for tool executions with expandable details
5. THE Activity_Stream SHALL display an input box at the bottom for user message entry
6. THE Activity_Stream SHALL auto-scroll to the latest message when new content is added

### Requirement 13: Live Preview Component

**User Story:** As a VS Code user, I want to see code changes and results in a dedicated preview panel, so that I can review AI-generated content before applying it.

#### Acceptance Criteria

1. WHEN a code change is generated, THE Live_Preview SHALL display a code diff view with removed lines and added lines
2. WHEN tests are executed, THE Live_Preview SHALL display test results with pass/fail status for each test
3. WHEN a file is read, THE Live_Preview SHALL display file content with syntax highlighting
4. WHEN no preview is active, THE Live_Preview SHALL display an empty state with icon and message
5. THE Live_Preview SHALL provide action buttons: "Apply", "Reject", and "Open in Editor" for code changes

### Requirement 14: Thinking Visualization

**User Story:** As a VS Code user, I want to see the AI's reasoning process, so that I understand why it makes specific decisions.

#### Acceptance Criteria

1. WHEN the model returns a thinking field, THE Activity_Stream SHALL render a Thinking_Block component
2. THE Thinking_Block SHALL display collapsed by default showing the first line of thinking
3. WHEN the user clicks "Expand", THE Thinking_Block SHALL show the complete thinking content
4. WHEN the user clicks "Collapse", THE Thinking_Block SHALL hide the detailed thinking content
5. THE Thinking_Block SHALL display a confidence indicator (High, Medium, Low) based on language patterns in the thinking text

### Requirement 15: Tool Execution Visualization

**User Story:** As a VS Code user, I want to see tool execution status in real-time, so that I know what operations the AI is performing.

#### Acceptance Criteria

1. WHEN a tool is invoked, THE Activity_Stream SHALL render a Tool_Card component
2. THE Tool_Card SHALL display the tool name, target (e.g., file path), and status (Pending, Complete, Error)
3. THE Tool_Card SHALL display execution duration in milliseconds when complete
4. WHEN the user clicks "Expand", THE Tool_Card SHALL show detailed execution results
5. WHEN a tool execution fails, THE Tool_Card SHALL display the error message with red styling

### Requirement 16: Tab Management

**User Story:** As a VS Code user, I want to manage multiple conversations in tabs, so that I can work on different tasks simultaneously.

#### Acceptance Criteria

1. THE Activity_Stream SHALL display a tab bar with all open conversation tabs
2. WHEN the user clicks a tab, THE React_Application SHALL switch to that conversation and update activeTabId
3. WHEN the user clicks the "+" button, THE React_Application SHALL create a new conversation tab
4. WHEN the user clicks the "×" button on a tab, THE React_Application SHALL close that conversation tab
5. THE Tab_Bar SHALL highlight the active tab with distinct background color using --vscode-tab-activeBackground

### Requirement 17: Message Input and Submission

**User Story:** As a VS Code user, I want to type messages and send them to ForgeAI, so that I can request assistance with natural language.

#### Acceptance Criteria

1. THE Activity_Stream SHALL display a text input box at the bottom
2. WHEN the user types text, THE Input_Box SHALL update in real-time
3. WHEN the user presses Enter or clicks "Send", THE React_Application SHALL add the message to the conversation
4. WHEN the user presses Shift+Enter, THE Input_Box SHALL insert a newline without sending
5. WHEN a message is being processed, THE Input_Box SHALL disable input and show a loading indicator

### Requirement 18: Agent Loop Execution

**User Story:** As an AI agent, I want to execute multi-step tool sequences autonomously, so that I can complete complex tasks without user intervention.

#### Acceptance Criteria

1. WHEN the model returns tool_calls, THE Extension_Host SHALL execute each tool sequentially
2. WHEN a tool execution completes, THE Extension_Host SHALL add the tool result to the message history with role "tool"
3. WHEN all tool results are added, THE Extension_Host SHALL send a new chat request to the model with updated message history
4. THE Agent_Loop SHALL continue until the model returns a response without tool_calls
5. THE Agent_Loop SHALL enforce a maximum iteration limit of 20 to prevent infinite loops

### Requirement 19: Streaming Response Handling

**User Story:** As a VS Code user, I want to see AI responses stream in real-time, so that I get immediate feedback and lower perceived latency.

#### Acceptance Criteria

1. WHEN the model streams a response, THE Extension_Host SHALL forward each chunk to the Webview via postMessage
2. WHEN the Webview receives a thinking chunk, THE Activity_Stream SHALL append the text to the current Thinking_Block
3. WHEN the Webview receives a content chunk, THE Activity_Stream SHALL append the text to the current assistant message
4. WHEN the Webview receives a tool_calls chunk, THE Activity_Stream SHALL render a new Tool_Card for each tool
5. THE Streaming_Handler SHALL accumulate partial fields correctly and handle incomplete JSON gracefully

### Requirement 20: Error Handling and User Feedback

**User Story:** As a VS Code user, I want clear error messages when something goes wrong, so that I understand what happened and how to fix it.

#### Acceptance Criteria

1. WHEN Ollama connection fails, THE Extension_Host SHALL display an error notification with message "Cannot connect to Ollama. Please ensure Ollama is running."
2. WHEN a tool execution fails, THE Extension_Host SHALL return an error result with descriptive message
3. WHEN the model returns an error, THE Activity_Stream SHALL display the error message with red styling
4. WHEN the agent loop reaches maximum iterations, THE Extension_Host SHALL stop execution and display a warning message
5. THE Error_Messages SHALL provide actionable guidance (e.g., "Check that the file path exists" or "Verify Ollama is running on port 11434")

### Requirement 21: VS Code Theme Integration

**User Story:** As a VS Code user, I want ForgeAI's UI to match my VS Code theme, so that the extension feels like a native part of the editor.

#### Acceptance Criteria

1. THE React_Application SHALL use VS Code CSS variables for all background colors
2. THE React_Application SHALL use VS Code CSS variables for all foreground colors
3. THE React_Application SHALL use VS Code CSS variables for all border colors
4. WHEN the user changes VS Code theme, THE React_Application SHALL update colors automatically without reload
5. THE React_Application SHALL support dark, light, and high-contrast themes

### Requirement 22: First Launch Experience

**User Story:** As a new user, I want a welcoming first launch experience, so that I understand how to use ForgeAI effectively.

#### Acceptance Criteria

1. WHEN ForgeAI opens for the first time, THE React_Application SHALL display a welcome screen with title "Welcome to ForgeAI"
2. THE Welcome_Screen SHALL display the auto-selected model "Qwen3-Coder-397B (Cloud)"
3. THE Welcome_Screen SHALL display quick action buttons: "Fix a bug", "Build a feature", "Explain code", and "Generate tests"
4. WHEN the user clicks a quick action button, THE React_Application SHALL create a new conversation with a pre-filled prompt
5. THE Welcome_Screen SHALL display a tip about using Cmd+K to open the command palette

### Requirement 23: Conversation Persistence

**User Story:** As a VS Code user, I want my conversations saved automatically, so that I can close and reopen ForgeAI without losing my work.

#### Acceptance Criteria

1. WHEN a message is added to a conversation, THE Conversation_Store SHALL persist the updated state to Workspace_State
2. WHEN ForgeAI is reopened, THE Conversation_Store SHALL restore all conversations from Workspace_State
3. WHEN ForgeAI is reopened, THE Conversation_Store SHALL restore the activeTabId from Workspace_State
4. THE Persistence_Layer SHALL debounce writes to avoid excessive storage operations (maximum 1 write per second)
5. THE Persistence_Layer SHALL handle storage quota errors gracefully and notify the user if storage is full

### Requirement 24: Code Diff Rendering

**User Story:** As a VS Code user, I want to see code changes with clear visual diff, so that I can review what the AI modified before applying changes.

#### Acceptance Criteria

1. WHEN displaying a code diff, THE Live_Preview SHALL show removed lines with red background and "-" prefix
2. WHEN displaying a code diff, THE Live_Preview SHALL show added lines with green background and "+" prefix
3. WHEN displaying a code diff, THE Live_Preview SHALL show unchanged lines with normal styling for context
4. THE Code_Diff SHALL display line numbers for all lines
5. THE Code_Diff SHALL apply syntax highlighting based on the file extension

### Requirement 25: Performance Optimization

**User Story:** As a VS Code user, I want ForgeAI to be responsive and fast, so that it doesn't slow down my development workflow.

#### Acceptance Criteria

1. THE React_Application SHALL render the initial UI within 2 seconds of webview creation
2. THE React_Application SHALL handle message updates within 16ms to maintain 60fps
3. THE React_Application SHALL virtualize long message lists to render only visible items
4. THE Extension_Host SHALL process tool executions within 5 seconds or display a timeout warning
5. THE Bundled_Application SHALL have a total size less than 500KB gzipped

## Parser and Serializer Requirements

### Requirement 26: Message Serialization

**User Story:** As a developer, I want messages serialized to JSON for storage, so that conversations persist correctly across sessions.

#### Acceptance Criteria

1. THE Message_Serializer SHALL convert Message objects to JSON strings
2. THE Message_Serializer SHALL preserve all fields: role, content, thinking, and tool_calls
3. THE Message_Parser SHALL parse JSON strings back into Message objects
4. THE Message_Parser SHALL return a descriptive error when JSON is invalid
5. FOR ALL valid Message objects, THE system SHALL satisfy the round-trip property: parse(serialize(message)) equals message

### Requirement 27: Conversation Serialization

**User Story:** As a developer, I want conversations serialized to JSON for storage, so that complete conversation state persists correctly.

#### Acceptance Criteria

1. THE Conversation_Serializer SHALL convert Conversation objects to JSON strings
2. THE Conversation_Serializer SHALL preserve all fields: id, messages array, and model
3. THE Conversation_Parser SHALL parse JSON strings back into Conversation objects
4. THE Conversation_Parser SHALL return a descriptive error when JSON is invalid or missing required fields
5. FOR ALL valid Conversation objects, THE system SHALL satisfy the round-trip property: parse(serialize(conversation)) equals conversation

### Requirement 28: Tool Call Serialization

**User Story:** As a developer, I want tool calls serialized to JSON for message history, so that tool execution state persists correctly.

#### Acceptance Criteria

1. THE Tool_Call_Serializer SHALL convert tool call objects to JSON strings
2. THE Tool_Call_Serializer SHALL preserve function name and arguments
3. THE Tool_Call_Parser SHALL parse JSON strings back into tool call objects
4. THE Tool_Call_Parser SHALL return a descriptive error when function name is missing
5. FOR ALL valid tool call objects, THE system SHALL satisfy the round-trip property: parse(serialize(toolCall)) equals toolCall

## Comprehensive File System Tool Operations

### Requirement 29: File Listing and Directory Operations

**User Story:** As an AI agent, I want comprehensive file and directory operations, so that I can navigate and manage the workspace file system autonomously.

#### Acceptance Criteria

1. THE Extension_Host SHALL register an LM_Tool named "forgeai_listFiles" with inputSchema requiring a "pattern" property
2. WHEN forgeai_listFiles is invoked, THE Extension_Host SHALL use vscode.workspace.findFiles to search for files matching the pattern and return an array of file paths
3. THE Extension_Host SHALL register an LM_Tool named "forgeai_listDirectory" with inputSchema requiring a "path" property
4. WHEN forgeai_listDirectory is invoked, THE Extension_Host SHALL use vscode.workspace.fs.readDirectory to list directory contents and return entries with name and type (file or directory)
5. THE Extension_Host SHALL register an LM_Tool named "forgeai_createDirectory" with inputSchema requiring a "path" property
6. WHEN forgeai_createDirectory is invoked, THE Extension_Host SHALL use vscode.workspace.fs.createDirectory to create the directory
7. THE Extension_Host SHALL register an LM_Tool named "forgeai_deleteFile" with inputSchema requiring a "path" property
8. WHEN forgeai_deleteFile is invoked, THE Extension_Host SHALL use vscode.workspace.fs.delete to remove the file or directory

### Requirement 30: File Manipulation Operations

**User Story:** As an AI agent, I want to copy, move, and rename files, so that I can reorganize workspace structure autonomously.

#### Acceptance Criteria

1. THE Extension_Host SHALL register an LM_Tool named "forgeai_copyFile" with inputSchema requiring "source" and "destination" properties
2. WHEN forgeai_copyFile is invoked, THE Extension_Host SHALL use vscode.workspace.fs.copy to copy the file from source to destination
3. THE Extension_Host SHALL register an LM_Tool named "forgeai_renameFile" with inputSchema requiring "oldPath" and "newPath" properties
4. WHEN forgeai_renameFile is invoked, THE Extension_Host SHALL use vscode.workspace.fs.rename to rename or move the file
5. THE Extension_Host SHALL register an LM_Tool named "forgeai_getFileStats" with inputSchema requiring a "path" property
6. WHEN forgeai_getFileStats is invoked, THE Extension_Host SHALL use vscode.workspace.fs.stat to retrieve file metadata including type, size, creation time, and modification time

### Requirement 31: File System Watching

**User Story:** As an AI agent, I want to monitor file changes in real-time, so that I can react to workspace modifications autonomously.

#### Acceptance Criteria

1. THE Extension_Host SHALL register an LM_Tool named "forgeai_watchFiles" with inputSchema requiring a "pattern" property
2. WHEN forgeai_watchFiles is invoked, THE Extension_Host SHALL use vscode.workspace.createFileSystemWatcher to create a file watcher for the specified pattern
3. THE File_Watcher SHALL emit events for file creation via onDidCreate callback
4. THE File_Watcher SHALL emit events for file modification via onDidChange callback
5. THE File_Watcher SHALL emit events for file deletion via onDidDelete callback
6. THE Extension_Host SHALL provide a mechanism to dispose of file watchers when no longer needed

### Requirement 32: Advanced File Search

**User Story:** As an AI agent, I want to search files by content and pattern, so that I can locate relevant code efficiently.

#### Acceptance Criteria

1. THE Extension_Host SHALL register an LM_Tool named "forgeai_findFiles" with inputSchema requiring "include" and optional "exclude" properties
2. WHEN forgeai_findFiles is invoked, THE Extension_Host SHALL use vscode.workspace.findFiles with include and exclude patterns to search for files
3. THE Extension_Host SHALL register an LM_Tool named "forgeai_searchInFiles" with inputSchema requiring "query" and optional "filePattern" properties
4. WHEN forgeai_searchInFiles is invoked, THE Extension_Host SHALL search file contents for the query string and return results with file path, line number, and matching text
5. THE Search_Results SHALL include context lines (2 lines before and after each match) for better understanding

## UI Component Specifications

### Requirement 33: Thinking Visualization with Confidence Indicators

**User Story:** As a VS Code user, I want to see the AI's reasoning process with confidence levels, so that I understand the reliability of its decisions.

#### Acceptance Criteria

1. WHEN the model returns a thinking field, THE Thinking_Block SHALL display collapsed by default showing the first line
2. THE Thinking_Block SHALL include a confidence indicator with three levels: High (green), Medium (amber), Low (red)
3. THE Confidence_Indicator SHALL be determined by analyzing language patterns in the thinking text (certainty keywords, hedging language, question marks)
4. THE Thinking_Block SHALL include a "Why?" button that expands to show detailed reasoning when clicked
5. WHEN the user clicks "Expand", THE Thinking_Block SHALL show the complete thinking content with preserved formatting
6. THE Thinking_Block SHALL display token usage information showing thinking tokens and total tokens consumed

### Requirement 34: Activity Stream with Real-Time Updates

**User Story:** As a VS Code user, I want a real-time activity feed showing all AI actions, so that I can monitor what the assistant is doing.

#### Acceptance Criteria

1. THE Activity_Stream SHALL display messages in chronological order with timestamps
2. THE Activity_Stream SHALL support filtering by message type (user, assistant, tool, thinking)
3. THE Activity_Stream SHALL include a search box that filters messages by content in real-time
4. THE Activity_Stream SHALL auto-scroll to the latest message when new content is added, unless the user has manually scrolled up
5. WHEN the user manually scrolls up, THE Activity_Stream SHALL pause auto-scrolling and display a "Jump to latest" button
6. THE Activity_Stream SHALL virtualize long message lists to render only visible items for performance

### Requirement 35: Tool Execution Visualization with Progress

**User Story:** As a VS Code user, I want to see tool execution status with progress indicators, so that I know what operations are in progress.

#### Acceptance Criteria

1. WHEN a tool is invoked, THE Tool_Card SHALL display status as "Pending" with a spinner animation
2. WHEN a tool is executing, THE Tool_Card SHALL display status as "Running" with elapsed time in milliseconds
3. WHEN a tool completes successfully, THE Tool_Card SHALL display status as "Complete" with total execution duration
4. WHEN a tool fails, THE Tool_Card SHALL display status as "Error" with red styling and error message
5. THE Tool_Card SHALL include an "Expand" button that shows detailed execution results including input parameters and output data
6. THE Tool_Card SHALL display a progress bar for long-running operations when progress information is available

### Requirement 36: Split-Screen Layout with Responsive Behavior

**User Story:** As a VS Code user, I want a split-screen interface that adapts to window size, so that I can work efficiently on different screen sizes.

#### Acceptance Criteria

1. THE React_Application SHALL render a two-column layout with Activity_Stream on the left at 50% width and Live_Preview on the right at 50% width by default
2. THE Split_Screen SHALL include a draggable divider between panels that allows resizing from 30% to 70% width for either panel
3. WHEN window width is less than 1200px, THE React_Application SHALL collapse Live_Preview and show Activity_Stream at full width
4. WHEN window width is greater than 1600px, THE Live_Preview SHALL support showing multiple views simultaneously (code diff + test results)
5. THE Split_Screen SHALL persist the user's preferred panel width ratio to Workspace_State

### Requirement 37: Tab Management with Browser-Like Behavior

**User Story:** As a VS Code user, I want to manage multiple conversations with browser-like tab controls, so that I can work on different tasks simultaneously.

#### Acceptance Criteria

1. THE Tab_Bar SHALL support drag-and-drop to reorder tabs
2. THE Tab_Bar SHALL allow closing tabs with × button or middle-click
3. THE Tab_Bar SHALL display a context menu on right-click with options: Rename, Duplicate, Close, Close Others, Close All, Export Conversation
4. WHEN a tab is closed, THE React_Application SHALL activate the adjacent tab (right if available, otherwise left)
5. THE Tab_Bar SHALL highlight the active tab with --vscode-tab-activeBackground and --vscode-tab-activeForeground colors
6. THE Tab_Bar SHALL display a maximum of 10 visible tabs with overflow scroll for additional tabs

## React 19 Specific Implementation

### Requirement 38: Form Handling with useActionState

**User Story:** As a developer, I want to use React 19's useActionState hook for form handling, so that I can manage form state and submission efficiently.

#### Acceptance Criteria

1. THE Message_Input_Form SHALL use the useActionState hook to manage form submission state
2. THE useActionState hook SHALL handle async form submission with automatic pending state management
3. THE Form SHALL display error messages returned from the action function with red styling
4. THE Form SHALL disable the submit button when isPending is true and display "Sending..." text
5. THE Form SHALL clear the input field after successful message submission

### Requirement 39: Optimistic UI Updates with useOptimistic

**User Story:** As a VS Code user, I want instant UI feedback when sending messages, so that the interface feels responsive.

#### Acceptance Criteria

1. THE Activity_Stream SHALL use the useOptimistic hook to display user messages immediately before server confirmation
2. THE Optimistic_Message SHALL display with reduced opacity (50%) and a "sending..." indicator
3. WHEN the server confirms the message, THE Activity_Stream SHALL replace the optimistic message with the confirmed version at full opacity
4. WHEN the server returns an error, THE Activity_Stream SHALL remove the optimistic message and display an error notification
5. THE Optimistic_Updates SHALL apply to tool execution status (show "Pending" immediately, update to "Complete" or "Error" when confirmed)

### Requirement 40: Async Data Loading with use() Hook

**User Story:** As a developer, I want to use React 19's use() hook for async data loading, so that I can simplify data fetching with Suspense.

#### Acceptance Criteria

1. THE Conversation_Loader SHALL use the use() hook to read conversation data from promises
2. THE React_Application SHALL wrap async components with Suspense boundaries showing loading skeletons
3. THE Suspense_Fallback SHALL display a skeleton UI matching the expected content layout
4. WHEN data loading fails, THE Error_Boundary SHALL catch the error and display a user-friendly error message with retry button
5. THE use() hook SHALL integrate with React's concurrent rendering for smooth transitions

## Tailwind CSS v4.0 Integration

### Requirement 41: VS Code Theme Variable Syntax

**User Story:** As a developer, I want to use Tailwind CSS v4.0's new syntax for VS Code theme variables, so that styling integrates seamlessly with VS Code themes.

#### Acceptance Criteria

1. THE Tailwind_Configuration SHALL use the @theme directive to define custom theme variables
2. THE React_Components SHALL use the syntax "bg-(--vscode-editor-background)" to access VS Code CSS variables (NOT "bg-[var(--vscode-editor-background)]")
3. THE React_Components SHALL use the syntax "text-(--vscode-editor-foreground)" for text colors
4. THE React_Components SHALL use the syntax "border-(--vscode-input-border)" for border colors
5. THE Tailwind_Build SHALL complete incremental builds within 500ms for development hot reload

### Requirement 42: Dynamic Utility Values

**User Story:** As a developer, I want Tailwind CSS v4.0's dynamic utility values to work automatically, so that I can use arbitrary numeric values without configuration.

#### Acceptance Criteria

1. THE Tailwind_Engine SHALL support arbitrary numeric values for spacing utilities (e.g., "mt-29", "w-17") without configuration
2. THE Tailwind_Engine SHALL support arbitrary numeric values for grid utilities (e.g., "grid-cols-15") without configuration
3. THE Tailwind_Engine SHALL support arbitrary opacity values (e.g., "opacity-75") without configuration
4. THE Tailwind_Engine SHALL support data attribute selectors (e.g., "data-current:opacity-100") without configuration
5. THE Tailwind_Build SHALL generate only the utility classes actually used in the codebase for optimal bundle size

## Zustand v5 State Management

### Requirement 43: Conversation Store with Persist Middleware

**User Story:** As a developer, I want a Zustand store with VS Code storage persistence, so that conversation state persists across sessions.

#### Acceptance Criteria

1. THE Conversation_Store SHALL maintain state with conversations array, activeTabId, and model properties
2. THE Conversation_Store SHALL provide actions: addConversation, removeConversation, addMessage, switchTab, updateTabTitle, clearConversation
3. THE Conversation_Store SHALL use the persist middleware with a custom VS Code storage adapter
4. THE VS_Code_Storage_Adapter SHALL implement getItem, setItem, and removeItem methods using postMessage to communicate with Extension_Host
5. THE Persist_Middleware SHALL debounce writes to avoid excessive storage operations with a maximum of 1 write per second

### Requirement 44: VS Code Storage Adapter Implementation

**User Story:** As a developer, I want a custom storage adapter for Zustand that uses VS Code's workspaceState, so that state persists correctly in the extension environment.

#### Acceptance Criteria

1. THE Extension_Host SHALL listen for "getState" messages from the Webview and respond with values from context.workspaceState
2. THE Extension_Host SHALL listen for "setState" messages from the Webview and update context.workspaceState with the provided values
3. THE VS_Code_Storage_Adapter SHALL serialize state as JSON before sending to Extension_Host
4. THE VS_Code_Storage_Adapter SHALL deserialize state from JSON after receiving from Extension_Host
5. THE VS_Code_Storage_Adapter SHALL handle storage errors gracefully and notify the user if storage quota is exceeded

## Ollama Integration Enhancements

### Requirement 45: Model Selection UI

**User Story:** As a VS Code user, I want to select different Ollama models, so that I can choose the best model for my task.

#### Acceptance Criteria

1. THE Settings_Panel SHALL display a dropdown list of available Ollama models retrieved from the Ollama API
2. THE Model_Selector SHALL show model information including name, size, context window, and capabilities (tool calling, vision)
3. WHEN the user selects a model, THE React_Application SHALL update the active conversation's model property
4. THE Model_Selector SHALL display the currently selected model in the Activity_Stream header
5. THE Extension_Host SHALL cache the list of available models and refresh every 5 minutes

### Requirement 46: Streaming with Think Parameter

**User Story:** As a VS Code user, I want to see the AI's thinking process streamed in real-time, so that I get immediate feedback on its reasoning.

#### Acceptance Criteria

1. WHEN sending a chat request with think parameter set to true, THE Extension_Host SHALL enable thinking mode in the Ollama API call
2. WHEN receiving streaming chunks, THE Extension_Host SHALL separate thinking, content, and tool_calls fields
3. THE Webview SHALL display thinking chunks in a Thinking_Block component as they arrive
4. THE Webview SHALL display content chunks in the assistant message as they arrive
5. THE Streaming_Handler SHALL handle incomplete JSON in tool_calls chunks and accumulate until complete

### Requirement 47: Connection Error Handling

**User Story:** As a VS Code user, I want clear error messages when Ollama is unavailable, so that I know how to fix connection issues.

#### Acceptance Criteria

1. WHEN Ollama connection fails with ECONNREFUSED, THE Extension_Host SHALL display error notification: "Cannot connect to Ollama. Please ensure Ollama is running on http://localhost:11434"
2. WHEN Ollama returns a 404 error for a model, THE Extension_Host SHALL display error notification: "Model not found. Please pull the model using: ollama pull [model-name]"
3. WHEN Ollama returns a timeout error, THE Extension_Host SHALL display error notification: "Ollama request timed out. The model may be loading. Please try again in a moment."
4. THE Error_Notification SHALL include an "Open Ollama Docs" button that opens the Ollama documentation in the browser
5. THE Extension_Host SHALL retry failed requests up to 3 times with exponential backoff (1s, 2s, 4s) before showing error

### Requirement 48: Agent Loop with Max Iterations

**User Story:** As an AI agent, I want to execute multi-step tool sequences with a safety limit, so that I can complete complex tasks without infinite loops.

#### Acceptance Criteria

1. THE Agent_Loop SHALL enforce a maximum iteration limit of 20 tool call rounds
2. WHEN the agent loop reaches maximum iterations, THE Extension_Host SHALL stop execution and display warning: "Agent reached maximum iterations (20). Task may be incomplete."
3. THE Agent_Loop SHALL log each iteration with thinking content, tool calls, and tool results for debugging
4. THE Agent_Loop SHALL allow the user to manually stop execution with a "Stop" button in the Activity_Stream
5. WHEN the user clicks "Stop", THE Agent_Loop SHALL gracefully terminate and display the current state with a "Stopped by user" message

### Requirement 49: Thinking Mode Visualization

**User Story:** As a VS Code user, I want to toggle thinking mode visibility, so that I can focus on results when I don't need to see reasoning.

#### Acceptance Criteria

1. THE Settings_Panel SHALL include a toggle for "Show thinking process" (enabled by default)
2. WHEN thinking mode is disabled, THE Activity_Stream SHALL hide all Thinking_Block components
3. WHEN thinking mode is enabled, THE Activity_Stream SHALL show all Thinking_Block components in collapsed state by default
4. THE User SHALL be able to toggle thinking mode with keyboard shortcut Cmd+/ (Mac) or Ctrl+/ (Windows/Linux)
5. THE Thinking_Mode_Setting SHALL persist to Global_State and apply across all conversations

## Performance Optimization Requirements

### Requirement 50: Lazy Loading and Code Splitting

**User Story:** As a VS Code user, I want the extension to load quickly, so that it doesn't slow down my editor startup.

#### Acceptance Criteria

1. THE React_Application SHALL use React.lazy() to code-split the Settings_Panel component
2. THE React_Application SHALL use React.lazy() to code-split the Live_Preview component
3. THE React_Application SHALL load the core Activity_Stream component immediately and defer loading of other components
4. THE Bundler SHALL generate separate chunks for Settings_Panel and Live_Preview with maximum chunk size of 100KB
5. THE Initial_Bundle SHALL load within 2 seconds on a standard broadband connection (10 Mbps)

### Requirement 51: Message List Virtualization

**User Story:** As a VS Code user, I want smooth scrolling even with hundreds of messages, so that the interface remains responsive.

#### Acceptance Criteria

1. THE Activity_Stream SHALL use virtualization to render only visible messages plus a 10-message buffer above and below
2. THE Virtualized_List SHALL maintain scroll position when new messages are added at the bottom
3. THE Virtualized_List SHALL handle variable-height messages (short text vs long code blocks) correctly
4. THE Virtualized_List SHALL render at 60fps (16ms per frame) when scrolling through 1000+ messages
5. THE Virtualized_List SHALL use react-window or react-virtuoso library for implementation

### Requirement 52: Debouncing and Throttling

**User Story:** As a developer, I want state updates debounced to avoid excessive writes, so that the extension performs efficiently.

#### Acceptance Criteria

1. THE Conversation_Store SHALL debounce state persistence writes with a maximum of 1 write per second
2. THE Search_Input SHALL debounce search queries with a 300ms delay to avoid excessive filtering
3. THE File_Watcher SHALL throttle file change events to a maximum of 10 events per second to avoid overwhelming the UI
4. THE Resize_Handler SHALL throttle window resize events to a maximum of 10 events per second for split-screen layout updates
5. THE Debounce_Implementation SHALL cancel pending operations when a new operation is triggered

### Requirement 53: Bundle Size Optimization

**User Story:** As a VS Code user, I want the extension to have a small bundle size, so that it loads quickly and uses minimal resources.

#### Acceptance Criteria

1. THE Total_Bundle_Size SHALL be less than 500KB gzipped for the initial load
2. THE Bundler SHALL use tree-shaking to eliminate unused code from dependencies
3. THE Bundler SHALL minify JavaScript and CSS for production builds
4. THE Bundler SHALL generate source maps for debugging but exclude them from production bundle
5. THE Build_Process SHALL analyze bundle size and warn if any chunk exceeds 100KB gzipped
