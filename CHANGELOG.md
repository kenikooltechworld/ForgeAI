# Changelog

All notable changes to the ForgeAI extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-07

### 🎉 Initial Release - Phase 1: Core Extension Foundation

ForgeAI 1.0.0 brings autonomous AI coding assistance directly into VS Code with a comprehensive set of features and tools.

---

## ✨ What's New

### 🤖 Autonomous AI Assistant

- **Thinking Mode**: Real-time visibility into AI reasoning process
- **Tool Calling**: AI autonomously executes 20+ tools
- **Agent Loop**: Multi-turn conversations with automatic tool execution
- **Smart Iteration Management**: Intelligent task completion with user control

### 💬 Chat Interface

- **Welcome Screen**: Quick action buttons for common tasks (Fix bug, Build feature, Explain code, Generate tests, Review changes, Write docs)
- **Activity Stream**: Comprehensive message history with filtering and search
- **Message Virtualization**: Smooth scrolling with 1000+ messages
- **Auto-scroll**: Smart scrolling with manual override
- **Multiple Conversations**: Browser-like tabs for managing multiple chats

### 🎨 User Interface

- **Split-Screen Layout**: Activity stream and live preview panel with resizable divider
- **Live Preview Panel**: View file contents, code diffs, terminal output, and test results
- **Thinking Blocks**: Collapsible AI reasoning with confidence indicators
- **Tool Cards**: Real-time tool execution status with expandable details
- **Code Diffs**: Professional diff view with syntax highlighting
- **VS Code Theme Integration**: Automatic adaptation to all VS Code themes

### 🛠️ Tool Integration (20+ Tools)

#### File Operations

- ✅ Read files
- ✅ Write files
- ✅ List files with glob patterns
- ✅ List directory contents
- ✅ Create directories
- ✅ Delete files/directories
- ✅ Copy files
- ✅ Rename/move files
- ✅ Get file metadata

#### Search & Discovery

- ✅ Find files with include/exclude patterns
- ✅ Search text in files with context
- ✅ Watch files for changes

#### Terminal & Commands

- ✅ Execute shell commands with output
- ✅ Create VS Code terminals

#### Git Integration

- ✅ Git status (branch, changes, staged files)
- ✅ Git commit with optional file selection
- ✅ Git push to remote
- ✅ Git pull from remote
- ✅ Create Git branches

#### Diagnostics

- ✅ Get file diagnostics (errors, warnings)
- ✅ Get all workspace errors

#### Code Preview

- ✅ Generate code diffs

### 🌐 VS Code Integration

- **Language Model Provider**: Integrates with VS Code's native chat
- **Chat Participant**: Use `@forgeai` in VS Code chat
- **Slash Commands**: `/fix`, `/build`, `/explain`, `/test`
- **Command Palette**: "Open ForgeAI" command
- **Activity Bar Icon**: Quick access from sidebar

### 🌍 Multilingual Support

Supports 17 languages:

- English (default)
- Nigerian Pidgin
- Yoruba, Igbo, Hausa
- French, Spanish, Portuguese
- Swahili, Arabic
- Chinese (Simplified), Hindi
- Japanese, Korean
- German, Italian, Russian

### ⚙️ Configuration

- **Language Selection**: Choose AI response language
- **Thinking Visibility**: Toggle thinking blocks on/off
- **Autonomy Level**: Supervised, Semi-autonomous, or Autonomous
- **Ollama Base URL**: Configure Ollama server location
- **Split Screen Width**: Persistent panel sizing

### 💾 Data Persistence

- **Conversation Storage**: All conversations persist across sessions
- **Tab Management**: Tab order and active tab restored
- **Settings Sync**: Global and workspace settings
- **Storage Quota Handling**: Graceful error handling with user guidance

### 🎯 Error Handling

- **Error Notifications**: User-friendly error messages with action buttons
- **Auto-dismiss**: 10-second auto-dismiss with pin option
- **Recovery Actions**: Retry, Skip, and Report Issue buttons
- **Connection Errors**: Helpful guidance for Ollama connection issues
- **Model Errors**: Clear instructions for missing models

### 🚀 Performance

- **Message Virtualization**: Efficient rendering of long conversations
- **Lazy Loading**: On-demand component loading
- **Debouncing**: Optimized state persistence and search
- **Bundle Optimization**: Minified production builds

---

## 📋 Requirements Implemented (53/53)

### Extension Registration & Activation (5/5)

- ✅ 1.1 Extension activates on VS Code startup
- ✅ 1.2 Command palette integration
- ✅ 1.3 Activity bar icon and view container
- ✅ 1.4 Proper extension metadata
- ✅ 1.5 Extension categories (AI, Programming Languages)

### Ollama Integration (5/5)

- ✅ 4.1 HTTP client with streaming support
- ✅ 4.2 List available models
- ✅ 4.3 Thinking mode support
- ✅ 4.4 Streaming response handling
- ✅ 4.5 Connection error handling

### Tool Registry (8/8)

- ✅ 5.1 Tool registration system
- ✅ 5.2 VS Code LM Tools API integration
- ✅ 5.3 OpenAI-compatible tool schemas
- ✅ 5.4 Tool execution with error handling
- ✅ 5.5 File system tools (read, write, list)
- ✅ 5.6 Directory operations
- ✅ 5.7 Terminal command execution
- ✅ 5.8 Terminal creation

### Webview & UI (6/6)

- ✅ 6.1 Webview panel creation
- ✅ 6.2 Script execution enabled
- ✅ 6.3 Content Security Policy
- ✅ 6.4 Resource loading
- ✅ 6.5 Bidirectional message passing
- ✅ 6.6 Lifecycle management

### Build & Development (5/5)

- ✅ 7.1 TypeScript configuration
- ✅ 7.2 React 19 setup
- ✅ 7.3 Vite bundler configuration
- ✅ 7.4 ESBuild for extension
- ✅ 7.5 Source maps

### Styling (5/5)

- ✅ 8.1 Native CSS with VS Code variables
- ✅ 8.2 Utility classes
- ✅ 8.3 Theme variable access
- ✅ 8.4 Global CSS structure
- ✅ 8.5 Performance optimization

### State Management (4/4)

- ✅ 9.1 Zustand v5 integration
- ✅ 9.2 Conversation store
- ✅ 9.3 Message management
- ✅ 9.4 Persist middleware

### Storage (5/5)

- ✅ 10.1 Workspace state management
- ✅ 10.2 Global state management
- ✅ 10.3 Secret storage
- ✅ 10.4 Cross-machine sync
- ✅ 10.5 Storage quota handling

### Layout (5/5)

- ✅ 11.1 Split-screen layout
- ✅ 11.2 Resizable divider
- ✅ 11.3 Width persistence
- ✅ 11.4 Responsive behavior
- ✅ 11.5 Panel collapse

### Activity Stream (6/6)

- ✅ 12.1 Three-section layout
- ✅ 12.2 Message virtualization
- ✅ 12.3 Tab bar
- ✅ 12.4 Message input
- ✅ 12.5 Empty state
- ✅ 12.6 Auto-scroll

### Live Preview (4/4)

- ✅ 13.1 Code diff component
- ✅ 13.2 Test results display
- ✅ 13.3 File preview
- ✅ 13.4 Empty state
- ✅ 13.5 Action buttons

### Thinking Blocks (5/5)

- ✅ 14.1 Collapsible thinking display
- ✅ 14.2 Expand/collapse functionality
- ✅ 14.3 VS Code theme colors
- ✅ 14.4 First line preview
- ✅ 14.5 Confidence indicators

### Tool Cards (5/5)

- ✅ 15.1 Tool name and icon
- ✅ 15.2 Status badges
- ✅ 15.3 Execution duration
- ✅ 15.4 Expandable details
- ✅ 15.5 Error display

### Tab Management (5/5)

- ✅ 16.1 Multiple tabs
- ✅ 16.2 Tab switching
- ✅ 16.3 Tab close
- ✅ 16.4 Active tab highlighting
- ✅ 16.5 New tab creation

### Agent Loop (5/5)

- ✅ 18.1 Message history management
- ✅ 18.2 Sequential tool execution
- ✅ 18.3 Loop continuation
- ✅ 18.4 Smart iteration management
- ✅ 18.5 Progress callbacks

### Streaming (5/5)

- ✅ 19.1 Chunk accumulation
- ✅ 19.2 Content streaming
- ✅ 19.3 Thinking streaming
- ✅ 19.4 Tool call streaming
- ✅ 19.5 Completion detection

### Error Handling (5/5)

- ✅ 20.1 Connection errors
- ✅ 20.2 Model not found
- ✅ 20.3 Timeout errors
- ✅ 20.4 Max iterations warning
- ✅ 20.5 User-friendly messages

### Theme Integration (5/5)

- ✅ 21.1 VS Code CSS variables
- ✅ 21.2 All components themed
- ✅ 21.3 Dark theme support
- ✅ 21.4 Dynamic theme updates
- ✅ 21.5 High contrast support

### Welcome Screen (5/5)

- ✅ 22.1 Welcome title and subtitle
- ✅ 22.2 Model status indicator
- ✅ 22.3 Quick action buttons (6)
- ✅ 22.4 Message input
- ✅ 22.5 Tips and links

### Conversation Persistence (5/5)

- ✅ 23.1 Conversation storage
- ✅ 23.2 Tab order persistence
- ✅ 23.3 Active tab restoration
- ✅ 23.4 Storage quota detection
- ✅ 23.5 Error recovery

### Code Diff (5/5)

- ✅ 24.1 Diff generation
- ✅ 24.2 Removed lines (red)
- ✅ 24.3 Added lines (green)
- ✅ 24.4 Context lines
- ✅ 24.5 Syntax highlighting

### Performance (5/5)

- ✅ 25.1 Initial load < 2s
- ✅ 25.2 60fps scrolling
- ✅ 25.3 Virtualized lists
- ✅ 25.4 Tool execution < 5s
- ✅ 25.5 Bundle size < 500KB

### File System Tools (6/6)

- ✅ 29.1 Read file
- ✅ 29.2 Write file
- ✅ 29.3 List files
- ✅ 29.4 List directory
- ✅ 29.5 Create directory
- ✅ 29.6 Delete file

### File Manipulation (6/6)

- ✅ 30.1 Copy file
- ✅ 30.2 Rename file
- ✅ 30.3 Get file stats
- ✅ 30.4 Error handling
- ✅ 30.5 Success notifications
- ✅ 30.6 Permission checks

### File Watching (6/6)

- ✅ 31.1 Create file watcher
- ✅ 31.2 onDidCreate events
- ✅ 31.3 onDidChange events
- ✅ 31.4 onDidDelete events
- ✅ 31.5 Pattern matching
- ✅ 31.6 Event handling

### File Search (5/5)

- ✅ 32.1 Find files
- ✅ 32.2 Include patterns
- ✅ 32.3 Exclude patterns
- ✅ 32.4 Search in files
- ✅ 32.5 Context lines

### Thinking Enhancements (6/6)

- ✅ 33.1 Thinking icon
- ✅ 33.2 Confidence levels
- ✅ 33.3 Color-coded borders
- ✅ 33.4 "Why?" button
- ✅ 33.5 Detailed reasoning
- ✅ 33.6 Token usage display

### Message Features (5/5)

- ✅ 34.1 Message roles
- ✅ 34.2 Message filtering
- ✅ 34.3 Message search
- ✅ 34.4 Search highlighting
- ✅ 34.5 Result count

### Tool Card Features (5/5)

- ✅ 35.1 Tool icons
- ✅ 35.2 Target display
- ✅ 35.3 Status updates
- ✅ 35.4 Duration display
- ✅ 35.5 Input/output display

### Split Screen (5/5)

- ✅ 36.1 Draggable divider
- ✅ 36.2 Width constraints (30-70%)
- ✅ 36.3 Persistence
- ✅ 36.4 Responsive collapse
- ✅ 36.5 Visual feedback

### Tab Features (6/6)

- ✅ 37.1 Drag-and-drop reorder
- ✅ 37.2 Middle-click close
- ✅ 37.3 Context menu
- ✅ 37.4 Close actions
- ✅ 37.5 Tab overflow scroll
- ✅ 37.6 Visual states

### Streaming Features (5/5)

- ✅ 38.1 Word-by-word streaming
- ✅ 38.2 Typing indicator
- ✅ 38.3 Chunk processing
- ✅ 38.4 Progress updates
- ✅ 38.5 Completion handling

### VS Code Theme (5/5)

- ✅ 41.1 CSS variable utilities
- ✅ 41.2 Background colors
- ✅ 41.3 Foreground colors
- ✅ 41.4 Border colors
- ✅ 41.5 All components

### Welcome Features (4/4)

- ✅ 42.1 First launch detection
- ✅ 42.2 Quick actions
- ✅ 42.3 Pre-filled prompts
- ✅ 42.4 Hide after interaction

### Storage Features (5/5)

- ✅ 44.1 Workspace storage
- ✅ 44.2 Global storage
- ✅ 44.3 Secret storage
- ✅ 44.4 Sync support
- ✅ 44.5 Quota handling

### Model Selection (5/5)

- ✅ 45.1 Model dropdown
- ✅ 45.2 Cloud models (5)
- ✅ 45.3 Local models (5)
- ✅ 45.4 Model info display
- ✅ 45.5 Selection persistence

### Thinking Mode (5/5)

- ✅ 46.1 Think parameter
- ✅ 46.2 Thinking chunks
- ✅ 46.3 Thinking display
- ✅ 46.4 Toggle visibility
- ✅ 46.5 Keyboard shortcut

### Error Features (5/5)

- ✅ 47.1 Connection errors
- ✅ 47.2 Model errors
- ✅ 47.3 Timeout errors
- ✅ 47.4 Action buttons
- ✅ 47.5 Exponential backoff

### Agent Loop Features (5/5)

- ✅ 48.1 Smart iteration management
- ✅ 48.2 Task completion warnings
- ✅ 48.3 Continue/Cancel options
- ✅ 48.4 Stop button
- ✅ 48.5 Graceful termination

### Settings Features (5/5)

- ✅ 49.1 Thinking toggle
- ✅ 49.2 Language selection
- ✅ 49.3 Autonomy level
- ✅ 49.4 Keyboard shortcuts
- ✅ 49.5 Persistence

### Settings Panel (5/5)

- ✅ 50.1 Lazy loading
- ✅ 50.2 Code splitting
- ✅ 50.3 Modal overlay
- ✅ 50.4 Close button
- ✅ 50.5 Theme colors

### Virtualization (5/5)

- ✅ 51.1 React Virtuoso
- ✅ 51.2 Visible messages only
- ✅ 51.3 Variable heights
- ✅ 51.4 Scroll position
- ✅ 51.5 Performance

### Optimization (5/5)

- ✅ 52.1 Debouncing
- ✅ 52.2 Search debounce (300ms)
- ✅ 52.3 Throttling
- ✅ 52.4 Event throttling
- ✅ 52.5 Operation cancellation

### Bundle (5/5)

- ✅ 53.1 Tree-shaking
- ✅ 53.2 Minification
- ✅ 53.3 Source maps
- ✅ 53.4 Size analysis
- ✅ 53.5 Gzip compression

---

## 🔮 Known Limitations

### Phase 1 Scope

- Single-agent execution (multi-agent orchestration planned for Phase 2)
- No codebase indexing (RAG integration planned for Phase 3)
- No browser capabilities (planned for Phase 4)
- Limited to Ollama models (cloud provider support planned)

### Performance

- Large file operations (>10MB) may be slow
- Very long conversations (>5000 messages) may impact performance
- Syntax highlighting limited to common languages

### Platform Support

- Tested primarily on Windows, macOS, and Linux
- Some terminal commands may behave differently across platforms
- Git integration requires Git to be installed and in PATH

---

## 🗺️ Future Phases

### Phase 2: Multi-Agent Orchestration (Q3 2026)

- Task decomposition and parallel execution
- Specialized agents (Planner, Coder, Tester, Reviewer)
- Agent coordination and communication
- Workflow orchestration

### Phase 3: RAG Integration (Q4 2026)

- Codebase indexing and semantic search
- Context-aware suggestions
- Documentation integration
- Knowledge base management

### Phase 4: Browser Capabilities (Q1 2027)

- Web scraping and research
- API testing and documentation
- UI testing automation
- Screenshot and visual testing

---

## 🐛 Bug Fixes

### Initial Release

- No bugs to fix yet! This is the first release.

---

## 🔒 Security

### Initial Release

- Content Security Policy implemented
- Secret storage for sensitive data
- Input validation for all tools
- Safe command execution

---

## 📦 Dependencies

### Production

- React 19.0.0
- Zustand 5.0.0
- Lucide React 1.14.0
- React Markdown 10.1.0
- React Virtuoso 4.18.6
- Axios 1.6.0

### Development

- TypeScript 5.3.0
- Vite 5.0.0
- ESBuild 0.24.0
- ESLint 8.0.0
- Prettier 3.4.0

---

## 📄 License

MIT License - See LICENSE file for details

---

**Thank you for using ForgeAI! 🚀**

For support, visit our [GitHub repository](https://github.com/yourusername/forgeai) or join our [Discord community](https://discord.gg/forgeai).
