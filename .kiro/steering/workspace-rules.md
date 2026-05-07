---
inclusion: auto
---

# Workspace Rules - Critical Guidelines

## 🚨 NO JUNK FILES

**FORBIDDEN - Never create these files unless explicitly requested:**

- ❌ TESTING.md, TEST_GUIDE.md, TESTING_INSTRUCTIONS.md
- ❌ SUMMARY.md, ANALYSIS.md, REPORT.md
- ❌ FIX_GUIDE.md, TROUBLESHOOTING.md, DEBUG_GUIDE.md
- ❌ CHANGELOG.md, NOTES.md, TODO.md
- ❌ Any documentation files not part of the project structure

**ONLY create files that are:**

- ✅ Part of the spec (requirements.md, design.md, tasks.md)
- ✅ Source code files (_.ts, _.tsx, _.js, _.jsx)
- ✅ Configuration files (package.json, tsconfig.json, etc.)
- ✅ Essential project documentation (README.md in project root)
- ✅ Research documents (in docs/research/ when explicitly requested)

## 🚫 NEVER MAKE DECISIONS WITHOUT USER PERMISSION

**ALWAYS ask the user before:**

- Creating new files (except when implementing a task)
- Changing project structure
- Installing new dependencies
- Modifying configuration files
- Refactoring existing code
- Changing build processes
- Adding new features not in the spec

**Example - FORBIDDEN:**

```
❌ "I'll create a helper utility for this..."
❌ "Let me add a new dependency to solve this..."
❌ "I'll refactor this code to make it better..."
```

**Example - REQUIRED:**

```
✅ "I found an issue with X. Here are 3 solutions:
   1. Solution A (pros/cons)
   2. Solution B (pros/cons)
   3. Solution C (pros/cons)
   Which approach would you like me to use?"

✅ "To implement this, I need to install dependency X.
   Should I proceed?"

✅ "The current code has issue Y. I can fix it by doing Z.
   Should I make this change?"
```

## ❓ ALWAYS ASK FOR CLARIFICATION

**When you're not clear about:**

- Requirements or specifications
- Expected behavior
- Implementation approach
- File locations or naming
- Dependencies or tools to use
- Any ambiguity in the task

**DO NOT:**

- ❌ Guess what the user wants
- ❌ Make assumptions about requirements
- ❌ Implement features not explicitly requested
- ❌ Choose technologies without confirmation

**DO:**

- ✅ Ask specific questions
- ✅ Provide options with pros/cons
- ✅ Request clarification on ambiguous requirements
- ✅ Confirm understanding before implementing

## 🐛 AVOID CREATING CODE WITH BUGS

**Before writing code:**

1. Read requirements.md and design.md thoroughly
2. Read steering files (coding-standards.md, vscode-extension-patterns.md)
3. Understand the complete context
4. Verify the approach is correct

**After writing code:**

1. Run TypeScript compiler to check for errors
2. Use getDiagnostics tool to verify no issues
3. Verify code follows all steering file rules
4. Ensure code is production-ready (no placeholders, no TODOs)
5. Test the code if possible

**If you find a bug:**

- ❌ DON'T: Silently fix it and move on
- ✅ DO: Tell the user about the bug, explain the fix, and ask for confirmation

## ✅ PRODUCTION-READY CODE ONLY

**Every line of code must be:**

- ✅ Complete implementation (no placeholders)
- ✅ No TODO comments
- ✅ No mock data or fake implementations
- ✅ Follows OOP patterns (classes, not functions)
- ✅ Has proper error handling
- ✅ Has explicit return types
- ✅ Follows TypeScript strict mode
- ✅ Passes all diagnostics checks
- ✅ Follows all steering file rules

## 📋 PROBLEM REPORTING FORMAT

**When you encounter a problem, use this format:**

```
🚨 PROBLEM FOUND

Issue: [Clear description of the problem]

Impact: [What this affects]

Possible Solutions:
1. [Solution A]
   - Pros: ...
   - Cons: ...

2. [Solution B]
   - Pros: ...
   - Cons: ...

Recommendation: [Your recommended solution with reasoning]

Question: Which solution would you like me to implement?
```

## 🎯 SUMMARY

1. **NO junk files** - Only create files that are part of the project
2. **NO decisions without permission** - Always ask before making changes
3. **ALWAYS ask for clarification** - Never guess or assume
4. **AVOID bugs** - Verify code before and after writing
5. **Production-ready only** - No placeholders, no TODOs, no mock data
6. **Report problems clearly** - Provide solutions and ask for direction

---

**These rules are MANDATORY. Violations will result in rejected code.**



# Implementation Rules - CRITICAL

## Core Principle: Follow the Spec, Not Assumptions

When implementing tasks, you MUST:

1. **Read the requirements.md** - Understand what needs to be built
2. **Read the design.md** - Understand how it should be built
3. **Read the relevant research docs** - Understand the patterns and best practices
4. **Follow the task description exactly** - Don't add or remove requirements

## FORBIDDEN Behaviors

❌ **DO NOT** implement based on what you think is right
❌ **DO NOT** make assumptions about how things should work
❌ **DO NOT** add features not in the requirements
❌ **DO NOT** skip reading the spec files
❌ **DO NOT** implement patterns you know from other projects

## REQUIRED Behaviors

✅ **DO** read requirements.md before starting any task
✅ **DO** read design.md to understand the architecture
✅ **DO** read relevant research docs for patterns
✅ **DO** follow the task description exactly
✅ **DO** implement only what's specified
✅ **DO** ask for clarification if requirements are unclear

## Implementation Workflow

For every task:

1. **Read Task Description** - Understand what needs to be done
2. **Read Requirements** - Find the requirement IDs mentioned in the task
3. **Read Design** - Find the design section for those requirements
4. **Read Research Docs** - Find relevant patterns and examples
5. **Implement** - Follow the spec exactly
6. **Verify** - Check against requirements and design

## Example: Wrong vs Right Approach

### ❌ WRONG - Making Assumptions
```
Task: Implement streaming response handler
Developer: "I'll use useRef because I think it's better for performance"
```

### ✅ RIGHT - Following Spec
```
Task: Implement streaming response handler
Developer: 
1. Reads requirements.md for streaming requirements
2. Reads design.md for StreamHandler architecture
3. Reads ui-ux-architecture-2026.md for streaming patterns
4. Implements exactly as specified in the design
```

## When You're Stuck

If the requirements are unclear or contradictory:
1. **STOP** - Don't make assumptions
2. **ASK** - Request clarification from the user
3. **WAIT** - Don't proceed until you have clear direction

## Remember

The spec files (requirements.md, design.md, research docs) are the source of truth.
Your job is to implement what's specified, not to improve or optimize it.


---
inclusion: fileMatch
fileMatchPattern: 'src/extension/**'
---

# VS Code Extension Patterns - Production-Ready

## Extension Architecture - OOP Required

### Extension Entry Point
```typescript
// ❌ FORBIDDEN - Functional approach
export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('extension.hello', () => {
    vscode.window.showInformationMessage('Hello!');
  });
  context.subscriptions.push(disposable);
}

// ✅ REQUIRED - Object-oriented approach
export class ForgeAIExtension {
  private readonly services: Map<string, IService> = new Map();
  
  constructor(private readonly context: vscode.ExtensionContext) {}
  
  public async activate(): Promise<void> {
    await this.initializeServices();
    this.registerCommands();
    this.registerProviders();
    
    this.context.subscriptions.push(
      new vscode.Disposable(() => this.deactivate())
    );
  }
  
  private async initializeServices(): Promise<void> {
    const logger = new Logger(this.context);
    const storage = new StorageManager(this.context);
    const ollama = new OllamaClient('http://localhost:11434', logger);
    
    this.services.set('logger', logger);
    this.services.set('storage', storage);
    this.services.set('ollama', ollama);
  }
  
  private registerCommands(): void {
    const commandManager = new CommandManager(
      this.context,
      this.services.get('logger') as Logger
    );
    
    commandManager.registerCommand('forgeai.open', () => this.openForgeAI());
    
    this.context.subscriptions.push(commandManager);
  }
  
  private registerProviders(): void {
    const chatProvider = new LanguageModelChatProvider(
      this.services.get('ollama') as OllamaClient,
      this.services.get('logger') as Logger
    );
    
    this.context.subscriptions.push(
      vscode.lm.registerLanguageModelChatProvider('forgeai', chatProvider)
    );
  }
  
  private openForgeAI(): void {
    const webviewManager = new WebviewManager(
      this.context,
      this.services.get('storage') as StorageManager,
      this.services.get('logger') as Logger
    );
    
    webviewManager.createOrShow();
  }
  
  private deactivate(): void {
    this.services.forEach(service => {
      if ('dispose' in service && typeof service.dispose === 'function') {
        service.dispose();
      }
    });
    this.services.clear();
  }
}

// Extension activation
export function activate(context: vscode.ExtensionContext): Promise<void> {
  const extension = new ForgeAIExtension(context);
  return extension.activate();
}

export function deactivate(): void {
  // Cleanup handled by ForgeAIExtension
}
```

---

## Resource Management - Always Dispose

### Disposable Pattern
```typescript
// ✅ REQUIRED - Implement IDisposable
export class WebviewManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly storage: StorageManager,
    private readonly logger: Logger
  ) {}
  
  public createOrShow(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    
    this.panel = vscode.window.createWebviewPanel(
      'forgeai',
      'ForgeAI',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist')
        ]
      }
    );
    
    // Register message handler
    this.disposables.push(
      this.panel.webview.onDidReceiveMessage(
        message => this.handleMessage(message),
        null,
        this.disposables
      )
    );
    
    // Register panel disposal
    this.disposables.push(
      this.panel.onDidDispose(
        () => this.onPanelDisposed(),
        null,
        this.disposables
      )
    );
    
    this.panel.webview.html = this.getWebviewContent();
  }
  
  private handleMessage(message: any): void {
    // Handle messages
  }
  
  private onPanelDisposed(): void {
    this.panel = null;
    this.dispose();
  }
  
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }
  
  private getWebviewContent(): string {
    const scriptUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${this.panel!.webview.cspSource};">
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
```

---

## VS Code API Usage - Production Patterns

### File System Operations
```typescript
// ❌ FORBIDDEN - Node.js fs module
import * as fs from 'fs';

class FileService {
  readFile(path: string): string {
    return fs.readFileSync(path, 'utf8');
  }
}

// ✅ REQUIRED - VS Code workspace.fs API
export class FileService {
  constructor(private readonly logger: Logger) {}
  
  public async readFile(uri: vscode.Uri): Promise<string> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(content).toString('utf8');
    } catch (error) {
      this.logger.error(`Failed to read file ${uri.fsPath}`, error);
      throw new FileReadError(`Failed to read file: ${error.message}`, uri);
    }
  }
  
  public async writeFile(uri: vscode.Uri, content: string): Promise<void> {
    try {
      const buffer = Buffer.from(content, 'utf8');
      await vscode.workspace.fs.writeFile(uri, buffer);
      this.logger.info(`File written successfully: ${uri.fsPath}`);
    } catch (error) {
      this.logger.error(`Failed to write file ${uri.fsPath}`, error);
      throw new FileWriteError(`Failed to write file: ${error.message}`, uri);
    }
  }
  
  public async exists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }
}
```

### Storage Management
```typescript
// ✅ REQUIRED - Type-safe storage with classes
export class StorageManager {
  constructor(private readonly context: vscode.ExtensionContext) {}
  
  public async getWorkspaceState<T>(key: string): Promise<T | undefined> {
    return this.context.workspaceState.get<T>(key);
  }
  
  public async setWorkspaceState<T>(key: string, value: T): Promise<void> {
    await this.context.workspaceState.update(key, value);
  }
  
  public async getGlobalState<T>(key: string): Promise<T | undefined> {
    return this.context.globalState.get<T>(key);
  }
  
  public async setGlobalState<T>(key: string, value: T): Promise<void> {
    await this.context.globalState.update(key, value);
  }
  
  public async getSecret(key: string): Promise<string | undefined> {
    return await this.context.secrets.get(key);
  }
  
  public async setSecret(key: string, value: string): Promise<void> {
    await this.context.secrets.store(key, value);
  }
  
  public async deleteSecret(key: string): Promise<void> {
    await this.context.secrets.delete(key);
  }
}
```

### Command Registration
```typescript
// ✅ REQUIRED - Command manager class
export class CommandManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {}
  
  public registerCommand(
    command: string,
    callback: (...args: any[]) => any
  ): void {
    const disposable = vscode.commands.registerCommand(command, async (...args) => {
      try {
        this.logger.info(`Executing command: ${command}`);
        return await callback(...args);
      } catch (error) {
        this.logger.error(`Command ${command} failed`, error);
        vscode.window.showErrorMessage(`Command failed: ${error.message}`);
        throw error;
      }
    });
    
    this.disposables.push(disposable);
    this.context.subscriptions.push(disposable);
  }
  
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
  }
}
```

---

## Cancellation Token Handling

```typescript
// ✅ REQUIRED - Always handle cancellation
export class LanguageModelChatProvider implements vscode.LanguageModelChatProvider {
  constructor(
    private readonly ollama: OllamaClient,
    private readonly logger: Logger
  ) {}
  
  async provideLanguageModelChatResponse(
    model: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: any,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken
  ): Promise<void> {
    // Check cancellation before starting
    if (token.isCancellationRequested) {
      this.logger.info('Request cancelled before starting');
      return;
    }
    
    try {
      const stream = await this.ollama.chat({
        model: 'qwen3-coder:397b',
        messages: this.convertMessages(messages),
        stream: true,
        think: true
      });
      
      for await (const chunk of stream) {
        // Check cancellation in loop
        if (token.isCancellationRequested) {
          this.logger.info('Request cancelled during streaming');
          break;
        }
        
        if (chunk.message.content) {
          progress.report(new vscode.LanguageModelTextPart(chunk.message.content));
        }
      }
    } catch (error) {
      if (token.isCancellationRequested) {
        this.logger.info('Request cancelled due to error');
        return;
      }
      
      this.logger.error('Chat response failed', error);
      throw error;
    }
  }
  
  private convertMessages(
    messages: readonly vscode.LanguageModelChatRequestMessage[]
  ): OllamaMessage[] {
    return messages.map(msg => ({
      role: msg.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant',
      content: msg.content
    }));
  }
}
```

---

## Error Handling - Production Ready

```typescript
// ✅ REQUIRED - Custom error classes for VS Code
export class ExtensionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ExtensionError';
  }
}

export class FileReadError extends ExtensionError {
  constructor(message: string, public readonly uri: vscode.Uri, cause?: Error) {
    super(message, cause);
    this.name = 'FileReadError';
  }
}

export class FileWriteError extends ExtensionError {
  constructor(message: string, public readonly uri: vscode.Uri, cause?: Error) {
    super(message, cause);
    this.name = 'FileWriteError';
  }
}

// Usage with user-friendly messages
export class FileService {
  public async readFile(uri: vscode.Uri): Promise<string> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(content).toString('utf8');
    } catch (error) {
      const message = `Failed to read file: ${uri.fsPath}`;
      this.logger.error(message, error);
      
      // Show user-friendly error
      vscode.window.showErrorMessage(
        `Cannot read file: ${uri.fsPath}. Please check file permissions.`,
        'Open File',
        'Cancel'
      ).then(selection => {
        if (selection === 'Open File') {
          vscode.commands.executeCommand('vscode.open', uri);
        }
      });
      
      throw new FileReadError(message, uri, error as Error);
    }
  }
}
```

---

## Logging - Production Ready

```typescript
// ✅ REQUIRED - Structured logging class
export class Logger implements vscode.Disposable {
  private readonly outputChannel: vscode.OutputChannel;
  
  constructor(context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('ForgeAI');
    context.subscriptions.push(this.outputChannel);
  }
  
  public info(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [INFO] ${message}`;
    this.outputChannel.appendLine(formatted);
    
    if (args.length > 0) {
      this.outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
  }
  
  public error(message: string, error?: Error | unknown): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [ERROR] ${message}`;
    this.outputChannel.appendLine(formatted);
    
    if (error instanceof Error) {
      this.outputChannel.appendLine(`Error: ${error.message}`);
      this.outputChannel.appendLine(`Stack: ${error.stack}`);
    } else if (error) {
      this.outputChannel.appendLine(JSON.stringify(error, null, 2));
    }
    
    this.outputChannel.show(true);
  }
  
  public warn(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [WARN] ${message}`;
    this.outputChannel.appendLine(formatted);
    
    if (args.length > 0) {
      this.outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
  }
  
  public dispose(): void {
    this.outputChannel.dispose();
  }
}
```

---

## Production Checklist

- [ ] All classes implement proper disposal
- [ ] All subscriptions added to context.subscriptions
- [ ] All file operations use vscode.workspace.fs
- [ ] All long operations handle CancellationToken
- [ ] All errors have custom error classes
- [ ] All errors show user-friendly messages
- [ ] All operations are logged
- [ ] No Node.js fs module usage
- [ ] No hard-coded paths
- [ ] All resources are properly cleaned up
