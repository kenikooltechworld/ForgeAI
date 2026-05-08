# ForgeAI 🚀

**Autonomous AI Coding Assistant for VS Code**

ForgeAI is a VS Code extension that brings autonomous AI capabilities directly into your development workflow. Powered by 10 curated AI models via Ollama (default: gpt-oss:120b-cloud), ForgeAI doesn't just chat—it thinks, plans, and executes tasks read files, run commands, and modify code autonomously.

![ForgeAI Banner](resources/kenikoolLogo.png)

---

## ✨ What Makes ForgeAI Different

### 🤖 Truly Autonomous

ForgeAI is an **agent**, not a chatbot. When you ask "What files are in my workspace?", it doesn't describe what it could do—it immediately takes action and shows you the results. This autonomous behavior means the AI **acts, not describes**.

### 🧠 Visible Thinking Process

See exactly how the AI reasons through problems with **thinking blocks** that show:

- The AI's reasoning process in real-time
- Confidence indicators (high, medium, low)
- Token usage statistics
- Expandable "Why this approach?" explanations

### 🛠️ Real-Time Tool Execution

Watch the AI work with **tool execution cards** that display:

- Tool name and target (file path, command, etc.)
- Status: Pending → Running → Complete/Error
- Execution duration in milliseconds
- Expandable input parameters and output results

### 📊 Split-Screen Architecture

**Activity Stream** (left) + **Live Preview** (right):

- Activity Stream: Conversation history, thinking blocks, tool cards
- Live Preview: File contents, code diffs, terminal output, test results
- Resizable divider with persistent width

---

## 🎯 Key Features

### Autonomous Agent Loop

- Multi-step task execution with automatic tool calling
- Streaming responses with real-time updates
- Graceful error handling and recovery
- Smart iteration management with user control

### 20+ Language Model Tools

**File System:** Read, write, list, create, delete, copy, rename files and directories  
**Search:** Find files, search content, watch for changes  
**Terminal:** Execute commands, create terminals  
**Git:** Status, commit, push, pull, create branches  
**Diagnostics:** Get errors and warnings  
**Code:** Generate diffs with syntax highlighting

### VS Code Native Integration

- **Language Model Chat Provider**: ForgeAI models appear in VS Code's native model picker
- **Chat Participant**: Use `@forgeai` in VS Code chat with slash commands (`/fix`, `/build`, `/explain`, `/test`)
- **Activity Bar Icon**: Quick access from sidebar
- **Theme Integration**: Automatically adapts to all VS Code themes
- **Model Selection**: Choose from 12 curated models in Settings

### Multi-Conversation Management

- Browser-like tabs for multiple conversations
- Drag-and-drop tab reordering
- Middle-click to close tabs
- Tab context menu (rename, duplicate, close others)
- Conversation persistence across sessions

### Advanced UI Features

- **Message Virtualization**: Smooth scrolling with 1000+ messages
- **Auto-Scroll**: Smart scrolling with manual override and "Jump to latest" button
- **Message Filtering**: Filter by role (user, assistant, tool, thinking)
- **Message Search**: Search with highlighting and result count
- **Welcome Screen**: Quick action buttons for common tasks

### Multilingual Support

17 languages including:

- English (default)
- Nigerian Pidgin, Yoruba, Igbo, Hausa
- French, Spanish, Portuguese, Swahili, Arabic
- Chinese (Simplified), Hindi, Japanese, Korean
- German, Italian, Russian

---

## 📋 Prerequisites

### Required

- **VS Code**: 1.115.0 or higher
- **Node.js**: 24.0.0 or higher (LTS)
- **Ollama**: Latest version (v0.12+)

### For Cloud Models (Recommended)

- Ollama account for cloud models
- Internet connection
- **Default Model**: gpt-oss:120b-cloud - Auto-selected on first launch

### For Local Models (Optional)

- **GPU Requirements**:
  - qwen3-coder:30b: 20GB+ VRAM
  - deepseek-r1:8b: 6GB+ VRAM
  - gemma4:e4b: 3GB+ VRAM

---

## 🤖 Supported Models

ForgeAI provides 12 curated models optimized for different use cases:

### Cloud Models (5) ☁️

1. **gpt-oss:120b-cloud** (Default)
   - Main coding and general purpose
   - Tools ✓ | Context: 128K
   - Auto-selected on first launch

2. **gemma4:31b-cloud**
   - Vision + coding capabilities
   - Tools ✓ | Vision 📷 | Context: 128K

3. **qwen3.5:397b-cloud**
   - Complex reasoning tasks
   - Tools ✓ | Context: 128K

4. **deepseek-v3.1:671b-cloud**
   - Deep research and analysis
   - Tools ✓ | Thinking 🧠 | Context: 64K

5. **kimi-k2.5:cloud**
   - Long context, multimodal
   - Tools ✓ | Vision 📷 | Context: 200K+

### Local Models (5) ↓

6. **qwen3-vl:8b**
   - Local vision capabilities
   - Tools ✓ | Vision 📷 | ~6GB VRAM

7. **qwen3-coder:30b**
   - Heavy coding tasks
   - Tools ✓ | ~20GB VRAM

8. **deepseek-r1:8b**
   - Local reasoning
   - Tools ✓ | Thinking 🧠 | ~6GB VRAM

9. **gemma4:e4b**
   - Fast and efficient
   - Tools ✓ | ~3GB VRAM

10. **qwen3.5:9b**
    - Balanced local model
    - Tools ✓ | ~6GB VRAM

**Legend:**

- ✓ = Tool calling support (all models)
- 📷 = Vision capabilities
- 🧠 = Enhanced thinking/reasoning mode
- ☁️ = Cloud-hosted (requires internet)
- ↓ = Local (requires GPU)

**Model Selection:** Change models anytime via Settings → Model Configuration

---

## 🚀 Installation

### Step 1: Install Ollama

1. Visit [ollama.com](https://ollama.com/download)
2. Download and install Ollama for your platform
3. Start Ollama:
   ```bash
   ollama serve
   ```

### Step 2: Pull the Default Model

**For Cloud Model (Recommended):**

```bash
# Sign in to Ollama (required for cloud models)
ollama signin

# Pull the default model
ollama pull gpt-oss:120b-cloud
```

**For Local Models (Optional):**

```bash
# Lightweight (3GB VRAM)
ollama pull gemma4:e4b

# Balanced (6GB VRAM)
ollama pull deepseek-r1:8b

# Heavy (20GB VRAM)
ollama pull qwen3-coder:30b
```

### Step 3: Install ForgeAI Extension

**From VSIX:**

1. Download `forgeai-1.0.0.vsix`
2. Open VS Code
3. Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
4. Click `...` menu → "Install from VSIX..."
5. Select the downloaded file
6. Reload VS Code

**From Source:**

```bash
git clone https://github.com/yourusername/forgeai.git
cd forgeai
npm install
npm run compile
npm run package
code --install-extension forgeai-1.0.0.vsix
```

---

## 🎯 Quick Start

### 1. Open ForgeAI

The extension activates automatically on VS Code startup. Click the ForgeAI icon in the Activity Bar (sidebar) or use:

- Command Palette: `Ctrl+Shift+P` / `Cmd+Shift+P` → "Open ForgeAI"

### 2. Welcome Screen

On first launch, you'll see:

- ✓ Connected to gpt-oss:120b-cloud (Cloud)
- 6 quick action buttons:
  - 🐛 Fix a bug
  - ✨ Build a feature
  - 📖 Explain code
  - 🧪 Generate tests
  - 🔍 Review changes
  - 📝 Write docs

### 3. Watch the AI Work

ForgeAI will:

1. **Think**: Show reasoning in collapsible thinking blocks
2. **Act**: Execute tools autonomously (file operations, commands, etc.)
3. **Display**: Show results in the live preview panel
4. **Iterate**: Continue until task is complete. Use the stop button to end the loop at any time.

---

## 💡 Usage Examples

### Example 1: Fix a Bug

```
You: The app crashes when quantity is zero

ForgeAI:
[Thinking] I need to find where quantity is used in calculations...
[Searching] Looking for "quantity" in TypeScript files...
[Reading] Checking src/cart/CartCalculator.ts...
[Analyzing] Getting error diagnostics...

I found the issue! Line 45 divides by quantity without checking for zero.

[Shows code diff in Live Preview panel]

Would you like me to apply this fix?
```

### Example 2: Build a Feature

```
You: Add JWT authentication

ForgeAI:
[Thinking] I'll create auth middleware, JWT utilities, and update routes...
[Creating] Setting up src/auth/ directory...
[Writing] Creating JWT utilities...
[Writing] Creating auth middleware...
[Installing] Adding jsonwebtoken dependency...

✓ JWT authentication implemented with:
  - Token generation and validation
  - Auth middleware for protected routes
  - Login and logout endpoints

Would you like me to add tests?
```

### Example 3: Using @forgeai in VS Code Chat

```
@forgeai /fix The login button doesn't work on mobile

[AI autonomously:]
1. Searches for login button code
2. Reads relevant files
3. Identifies CSS media query issue
4. Generates fix
5. Shows diff
6. Applies changes
```

---

## ⚙️ Settings

All ForgeAI settings are available through the Settings panel. Click the Settings button in the ForgeAI interface to configure:

### Model Selection

Choose from 12 curated models optimized for different use cases:

- **Cloud Models**: gpt-oss:120b-cloud (default), gemma4:31b-cloud, qwen3.5:397b-cloud, deepseek-v3.1:671b-cloud, kimi-k2.5:cloud
- **Local Models**: qwen3-vl:8b, qwen3-coder:30b, deepseek-r1:8b, gemma4:e4b, qwen3.5:9b, llava:7b, llava:13b

### Autonomy Level

- **Supervised**: Ask before every action
- **Semi-Autonomous**: Ask for unusual actions (recommended)
- **Autonomous**: Act independently

### Thinking Visibility

- **Show thinking process** (recommended): See how ForgeAI reasons through problems
- **Hide thinking process**: Show only results

Toggle thinking blocks anytime with `Ctrl+/` (Windows/Linux) or `Cmd+/` (Mac)

---

## 🏗️ Architecture

ForgeAI uses a split-panel architecture with an Extension Host (Node.js) managing AI interactions and tool execution, and a React-based Webview providing the user interface. The extension communicates with Ollama via HTTP streaming for real-time AI responses.

**Key Components:**

- **Extension Host**: Manages AI model interactions, tool execution, and VS Code integration
- **Webview UI**: Split-screen interface with Activity Stream and Live Preview panels
- **Ollama Integration**: Connects to local or cloud AI models via HTTP streaming

---

## 🛠️ Available Capabilities

ForgeAI provides 20+ tools organized into these categories:

### File Operations

Read, write, create, delete, copy, and rename files and directories. List directory contents and get file metadata.

### Search & Discovery

Find files with pattern matching, search text across your codebase with context, and watch files for changes.

### Terminal & Commands

Execute shell commands and create VS Code terminals for running development tasks.

### Git Integration

Check repository status, commit changes, push/pull from remotes, and create branches.

### Diagnostics

Get errors and warnings from your workspace to help identify and fix issues.

### Code Preview

Generate syntax-highlighted code diffs to visualize changes before applying them.

---

---

## 🐛 Troubleshooting

### Ollama Connection Error

**Problem:** "Cannot connect to Ollama"

**Solutions:**

1. Ensure Ollama is running:
   ```bash
   ollama serve
   ```
2. Check Ollama is accessible:
   ```bash
   curl http://localhost:11434/api/tags
   ```
3. Check ForgeAI Settings if needed
4. Check firewall isn't blocking port 11434

### Model Not Found

**Problem:** "Model not found"

**Solution:** Pull the model:

```bash
# For default cloud model
ollama pull gpt-oss:120b-cloud

# For local models
ollama pull gemma4:e4b
ollama pull qwen3-coder:30b
```

### Slow Responses

**Problem:** AI is very slow

**Solutions:**

1. Check internet connection (for cloud models)
2. Try a smaller local model (gemma4:e4b) via Settings
3. Check Ollama logs for issues
4. Ensure system meets model requirements
5. Switch to a different model in ForgeAI Settings

### Extension Not Loading

**Problem:** ForgeAI doesn't appear

**Solutions:**

1. Reload VS Code window
2. Check extension is enabled in Extensions view
3. Check Output panel: View → Output → Select "ForgeAI"

### Theme Not Updating

**Problem:** Colors don't match VS Code theme

**Solution:** Reload VS Code window after theme change

---

## � License

MIT License - See [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- **Ollama** - Local AI infrastructure
- **VS Code Team** - Extension API and development platform
- **Open Source Community** - For the amazing tools and libraries that make this possible

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/kenikool/forgeai/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/forgeai/discussions)
- **Documentation:** [docs.forgeai.dev](https://docs.forgeai.dev)

---

**Made with ❤️ by the ForgeAI Team**

_ForgeAI - Where AI thinks, acts, and builds autonomously_
