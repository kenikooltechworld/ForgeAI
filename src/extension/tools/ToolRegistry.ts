import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';

/**
 * Tool Interface - Defines the structure of a tool
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    required?: string[];
    properties: Record<string, any>;
  };
  execute: (args: any, token?: vscode.CancellationToken) => Promise<any>;
}

/**
 * Tool Registry - Manages tool registration and execution
 * Integrates with VS Code LM Tools API for native model picker support
 *
 * Design: Follows design.md Section 5 - Tool Registry and File System Tools
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export class ToolRegistry implements vscode.Disposable {
  private readonly tools: Map<string, Tool> = new Map();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {}

  /**
   * Register all tools from various tool providers
   * This will be called during extension activation
   */
  public registerAllTools(): void {
    // Register file system tools (Task 4.2)
    const { FileSystemTools } = require('./FileSystemTools');
    const fsTools = new FileSystemTools();
    this.registerTool(fsTools.readFile());
    this.registerTool(fsTools.writeFile());
    this.registerTool(fsTools.replaceText());
    this.registerTool(fsTools.replaceRegex());
    this.registerTool(fsTools.findFile());
    this.registerTool(fsTools.listFiles());
    this.registerTool(fsTools.listDirectory());
    this.registerTool(fsTools.createDirectory());
    this.registerTool(fsTools.deleteFile());
    this.registerTool(fsTools.copyFile());
    this.registerTool(fsTools.renameFile());
    this.registerTool(fsTools.getFileStats());
    this.registerTool(fsTools.watchFiles());
    this.registerTool(fsTools.findFiles());
    this.registerTool(fsTools.searchInFiles());
    this.registerTool(fsTools.generateDiff()); // Task 5.2 - Code diff generation

    // Register terminal tools (Task 4.9)
    const { TerminalTools } = require('./TerminalTools');
    const terminalTools = new TerminalTools();
    this.registerTool(terminalTools.runCommand());
    this.registerTool(terminalTools.createTerminal());

    // Register git tools (Task 12.1)
    const { GitTools } = require('./GitTools');
    const gitTools = new GitTools();
    this.registerTool(gitTools.gitStatus());
    this.registerTool(gitTools.gitCommit());
    this.registerTool(gitTools.gitPush());
    this.registerTool(gitTools.gitPull());
    this.registerTool(gitTools.gitCreateBranch());

    // Register diagnostics tools (Task 12.2)
    const { DiagnosticsTools } = require('./DiagnosticsTools');
    const diagnosticsTools = new DiagnosticsTools();
    this.registerTool(diagnosticsTools.getErrors());
    this.registerTool(diagnosticsTools.getDiagnostics());

    // Register web search tools (cloud-based, no local browser required)
    const { WebSearchTools } = require('./WebSearchTools');
    const webSearchTools = new WebSearchTools();
    this.registerTool(webSearchTools.webSearch());
    this.registerTool(webSearchTools.webResearch());
    this.registerTool(webSearchTools.searchDocs());
    this.registerTool(webSearchTools.fetchPage());

    // Register browser tools (local Playwright — optional fallback)
    const { BrowserTools } = require('./BrowserTools');
    const browserTools = new BrowserTools();
    this.registerTool(browserTools.browserNavigate());
    this.registerTool(browserTools.browserExtract());
    this.registerTool(browserTools.browserClick());
    this.registerTool(browserTools.browserFill());
    this.registerTool(browserTools.browserScreenshot());
    this.registerTool(browserTools.browserScroll());
    this.registerTool(browserTools.browserClose());

    // Register UI/UX Architect Agent tools (Phase 2.4)
    const { UIUXTools } = require('../agents/ui-ux-architect/tools/UIUXTools');
    const uiuxTools = new UIUXTools(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '');
    this.registerTool(uiuxTools.createDesignSystem());
    this.registerTool(uiuxTools.generateDesignTokens());
    this.registerTool(uiuxTools.exportTokens());
    this.registerTool(uiuxTools.checkContrast());

    // BrowserMirrorTools and VisualQATools are NOT registered globally.
    // They require runtime dependencies (live ForgeBrowserSession, OllamaClient)
    // and are created dynamically by PerTaskMultiAgentOrchestrator / BrowserMirrorStream.

    // Register Spec Tools (spec-driven development)
    const { SpecTools } = require('./SpecTools');
    const specTools = new SpecTools(
      () => (global as any).__FORGEAI_WORKSPACE__?.spec,
      () => (global as any).__FORGEAI_WORKSPACE__?.drift,
      () => (global as any).__FORGEAI_OLLAMA__,
      () => (global as any).__FORGEAI_STORAGE__,
      () => (global as any).__FORGEAI_WORKSPACE__?.product,
      () => (global as any).__FORGEAI_WORKSPACE__?.memory,
      () => (global as any).__FORGEAI_RESEARCH_AGENT__
    );
    this.registerTool(specTools.createSpec());
    this.registerTool(specTools.writeSpecArtifact());
    this.registerTool(specTools.readSpec());
    this.registerTool(specTools.listSpecs());
    this.registerTool(specTools.continueSpec());
    this.registerTool(specTools.checkDrift());
    this.registerTool(specTools.deleteSpec());
    this.registerTool(specTools.startTask());
    this.registerTool(specTools.runAllTasks());
    this.registerTool(specTools.approveSpec());
  }

  /**
   * Register a single tool
   * Integrates with VS Code LM Tools API (vscode.lm.registerTool)
   *
   * @param tool Tool to register
   * Requirements: 5.1, 5.2
   */
  public registerTool(tool: Tool): void {
    // Store tool in registry
    this.tools.set(tool.name, tool);

    // Register with VS Code LM Tools API
    // This makes the tool available in the native model picker
    const disposable = vscode.lm.registerTool(tool.name, {
      /**
       * Prepare invocation - Called before tool execution
       * Used for confirmation messages and user approval
       */
      prepareInvocation: async (
        options: vscode.LanguageModelToolInvocationPrepareOptions<any>,
        token: vscode.CancellationToken
      ) => {
        return {
          invocationMessage: `Executing ${tool.name}...`,
          confirmationMessages: {
            title: tool.name,
            message: new vscode.MarkdownString(
              `Execute \`${tool.name}\` with arguments:\n\n\`\`\`json\n${JSON.stringify(options.input, null, 2)}\n\`\`\``
            ),
          },
        };
      },

      /**
       * Invoke - Execute the tool
       * Handles cancellation, errors, and result formatting
       */
      invoke: async (
        options: vscode.LanguageModelToolInvocationOptions<any>,
        token: vscode.CancellationToken
      ) => {
        try {
          // Check cancellation before execution
          if (token.isCancellationRequested) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(
                JSON.stringify({ error: 'Tool execution cancelled' })
              ),
            ]);
          }

          // Execute tool
          const result = await tool.execute(options.input, token);

          // Check cancellation after execution
          if (token.isCancellationRequested) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(
                JSON.stringify({ error: 'Tool execution cancelled' })
              ),
            ]);
          }

          this.logger.info(`Tool ${tool.name} completed successfully`);

          // Return result as LanguageModelToolResult
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(result)),
          ]);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Tool ${tool.name} failed`, error);

          // Return error as LanguageModelToolResult
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
              JSON.stringify({ error: errorMessage, tool: tool.name })
            ),
          ]);
        }
      },
    });

    this.disposables.push(disposable);
    this.context.subscriptions.push(disposable);
  }

  /**
   * Get tool definitions in OpenAI-compatible format
   * Used for Ollama chat API tool calling
   *
   * @returns Array of tool definitions
   * Requirements: 5.3
   */
  public getToolDefinitions(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }> {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * Execute a tool by name
   * Used by AgentLoop for tool execution
   *
   * @param name Tool name
   * @param args Tool arguments
   * @param token Cancellation token
   * @returns Tool execution result
   * Requirements: 5.4
   */
  public async executeTool(
    name: string,
    args: any,
    token?: vscode.CancellationToken
  ): Promise<any> {
    this.logger.info(`Executing tool: ${name} with args:`, args);

    const tool = this.tools.get(name);
    if (!tool) {
      const error = `Tool not found: ${name}`;
      this.logger.error(error);
      throw new Error(error);
    }

    try {
      // Check cancellation before execution
      if (token?.isCancellationRequested) {
        throw new Error('Tool execution cancelled');
      }

      const result = await tool.execute(args, token);

      // Check cancellation after execution
      if (token?.isCancellationRequested) {
        throw new Error('Tool execution cancelled');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Tool ${name} execution failed`, error);
      throw new Error(`Tool ${name} failed: ${errorMessage}`);
    }
  }

  /**
   * Get a tool by name
   * @param name Tool name
   * @returns Tool or undefined
   */
  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tool names
   * @returns Array of tool names
   */
  public getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get number of registered tools
   * @returns Number of tools
   */
  public getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Dispose all registered tools
   * Implements vscode.Disposable
   */
  public dispose(): void {
    this.logger.info('Disposing tool registry');

    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
    this.tools.clear();

    this.logger.info('Tool registry disposed');
  }
}
