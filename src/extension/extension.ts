import * as vscode from 'vscode';
import * as path from 'path';
import { StorageManager } from './storage/StorageManager';
import { Logger } from './utils/Logger';
import { CommandManager } from './utils/CommandManager';
import { WebviewManager } from './utils/WebviewManager';
import type { RagService } from './rag/RagService';
import { SpecReader } from './spec/SpecReader';
import { SpecTaskExecutor } from './spec/SpecTaskExecutor';
import { DEFAULT_MODEL } from './config/ModelConfig';

/**
 * ForgeAI Extension - Production-ready OOP architecture
 * Follows VS Code extension best practices with proper service initialization and disposal
 */
export class ForgeAIExtension {
  private readonly services: Map<string, any> = new Map();
  private webviewManager?: WebviewManager;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async activate(): Promise<void> {
    await this.initializeServices();
    this.registerCommands();
    await this.registerProviders();

    this.context.subscriptions.push(new vscode.Disposable(() => this.deactivate()));

    const logger = this.services.get('logger') as Logger;
    logger.info('ForgeAI extension activated successfully');
  }

  private async initializeServices(): Promise<void> {
    // Initialize core services
    const logger = new Logger(this.context);
    const storage = new StorageManager(this.context);

    this.services.set('logger', logger);
    this.services.set('storage', storage);

    // Initialize Ollama client
    const { OllamaClient } = await import('./ollama/OllamaClient');
    const ollama = new OllamaClient('http://localhost:11434', logger);
    this.services.set('ollama', ollama);

    // Set globals for SpecTools lazy access (must be before ToolRegistry init)
    (global as any).__FORGEAI_OLLAMA__ = ollama;
    (global as any).__FORGEAI_STORAGE__ = storage;

    // Initialize ForgeAIWorkspace (spec-driven development)
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    let forgeaiWorkspace:
      | import('./forgeaiWorkspace/ForgeAIWorkspace').ForgeAIWorkspace
      | undefined;
    if (workspaceRoot) {
      const { ForgeAIWorkspace } = await import('./forgeaiWorkspace/ForgeAIWorkspace');
      forgeaiWorkspace = new ForgeAIWorkspace(workspaceRoot, logger, this.context);
      await forgeaiWorkspace.maybeAutoInitialize();
      this.services.set('forgeaiWorkspace', forgeaiWorkspace);
      (global as any).__FORGEAI_WORKSPACE__ = forgeaiWorkspace;
      logger.info('ForgeAIWorkspace initialized at ' + workspaceRoot);
    } else {
      logger.warn('No workspace open - ForgeAIWorkspace not initialized');
    }

    // Initialize RAG retrieval service used during chat execution.
    const ragService = await this.createRagService(logger, ollama);
    if (ragService) {
      this.services.set('ragService', ragService);
      logger.info('RAG service initialized for chat retrieval');
    } else {
      logger.warn('RAG service unavailable - chat will run without retrieval grounding');
    }

    // Initialize ResearchAgent for spec generation
    let researchAgent: import('./agents/research/ResearchAgent').ResearchAgent | undefined;
    if (workspaceRoot) {
      const { ResearchAgent } = await import('./agents/research/ResearchAgent');
      researchAgent = new ResearchAgent({
        ragService: {
          retrieve: async (query: string, k?: number) => {
            if (!ragService) return [];
            const results = await ragService.retrieve({ query, topK: k ?? 5 });
            return results.map((r) => ({
              text: r.text,
              sourceId: r.sourceId,
              score: r.score ?? 0,
            }));
          },
        },
        webSearch: {
          performSearch: async (query: string) => {
            try {
              const { WebSearchTools } = await import('./tools/WebSearchTools');
              const webSearch = new WebSearchTools();
              const result = await webSearch['performSearch'](query);
              return {
                results: result.results.map((r) => ({
                  title: r.title,
                  url: r.url,
                  snippet: r.snippet,
                })),
                totalResults: result.totalResults,
                source: result.source,
              };
            } catch (err) {
              logger.warn('Web search failed, returning empty results:', err);
              return { results: [], totalResults: 0, source: 'none' };
            }
          },
        },
        executeLLM: async (systemPrompt: string, userPrompt: string) => {
          const response = await ollama.chat({
            model: DEFAULT_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            stream: false,
          });
          const chatResponse = response as { message: { content: string } };
          return chatResponse.message.content;
        },
        fetchPage: async (url: string) => {
          const { WebSearchTools } = await import('./tools/WebSearchTools');
          const webSearch = new WebSearchTools();
          return webSearch.fetchPageContent(url, 8000);
        },
        workspaceRoot,
      });
      this.services.set('researchAgent', researchAgent);
      (global as any).__FORGEAI_RESEARCH_AGENT__ = researchAgent;
      logger.info('ResearchAgent initialized');
    }

    // Initialize Tool Registry (Task 4.1)
    const { ToolRegistry } = await import('./tools/ToolRegistry');
    const toolRegistry = new ToolRegistry(this.context, logger);
    toolRegistry.registerAllTools();
    this.services.set('toolRegistry', toolRegistry);

    // Keep activation responsive: run non-critical checks in background.
    void this.checkOllamaAvailability(ollama, logger);
    void this.startOptionalRagBootstrap(storage, logger);

    logger.info('Core services initialized');
  }

  private async createRagService(logger: Logger, ollama: any): Promise<RagService | undefined> {
    try {
      const { RagServiceImpl } = await import('./rag/RagService');
      const { LanceDbRagStore } = await import('./rag/store/LanceDbRagStore');
      const { OllamaEmbeddingsProvider } =
        await import('./rag/embeddings/OllamaEmbeddingsProvider');

      const dbPath = this.context.globalStorageUri.fsPath + '/lancedb';
      const embeddingsModel = 'nomic-embed-text:latest';
      const embeddings = new OllamaEmbeddingsProvider({
        ollama,
        logger,
        embeddingsModel,
      });
      const store = new LanceDbRagStore({
        logger,
        embeddings,
        dbPath,
      });

      return new RagServiceImpl(store);
    } catch (error) {
      logger.warn('Failed to initialize RAG service', error);
      return undefined;
    }
  }

  private async checkOllamaAvailability(ollama: any, logger: Logger): Promise<void> {
    try {
      const isAvailable = await ollama.isAvailable();
      if (isAvailable) {
        logger.info('Ollama is available and ready');
      } else {
        logger.warn('Ollama is not running. Please start Ollama to use AI features.');
      }
    } catch (error) {
      logger.warn('Failed to check Ollama availability', error);
    }
  }

  private async startOptionalRagBootstrap(storage: StorageManager, logger: Logger): Promise<void> {
    try {
      // Delay startup-heavy indexing so activation and UI stay responsive.
      setTimeout(() => {
        void this.runRagBootstrap(storage, logger);
      }, 1500);
    } catch (error) {
      logger.warn('RAG bootstrap initialization skipped', error);
    }
  }

  private async runRagBootstrap(storage: StorageManager, logger: Logger): Promise<void> {
    try {
      const didInitialIngest = await storage.getGlobalValue('forgeai.rag.didInitialIngest', false);
      const dbPath = this.context.globalStorageUri.fsPath + '/lancedb';
      const embeddingsModel = 'nomic-embed-text:latest';

      const allSourceIds = [
        'reactjs',
        'typescript',
        'javascript',
        'python',
        'nodejs',
        'go',
        'rust',
        'nextjs',
        'vuejs',
        'express',
        'fastapi',
        'tailwindcss',
        'shadcn',
        'prisma',
        'vite',
        'docker',
        'git',
        'postgresql',
        'mongodb',
        'vscode-api',
        'zustand',
      ];

      if (!didInitialIngest) {
        logger.info('RAG ingestion: first install — prompting user to select sources');

        const action = await vscode.window.showInformationMessage(
          'ForgeAI: Choose which documentation sources to index for AI context.',
          { modal: false },
          'Open RAG Settings'
        );

        if (action === 'Open RAG Settings') {
          await this.openRagSettings();
        }

        // Mark as seen so we don't prompt again on next activation
        await storage.setGlobalValue('forgeai.rag.didInitialIngest', true);
      } else {
        // Only run periodic refresh on subsequent activations if explicitly enabled
        const enableBootstrap = vscode.workspace
          .getConfiguration('forgeai')
          .get<boolean>('enableRagBootstrap', false);
        if (enableBootstrap) {
          const { RagScheduler } = await import('./rag/scheduler/RagScheduler');
          const scheduler = new (RagScheduler as any)({
            logger,
            ollamaEmbeddingsModel: embeddingsModel,
            dbPath,
            storage: {
              getGlobalValue: async <T>(key: string, defaultValue: T): Promise<T> => {
                return storage.getGlobalValue<T>(key, defaultValue);
              },
              setGlobalValue: storage.setGlobalValue.bind(storage),
            },
            refreshMs: 3 * 24 * 60 * 60 * 1000,
            onRefreshStart: () => {
              void vscode.window.showInformationMessage(
                'ForgeAI: Refreshing documentation index in the background\u2026'
              );
            },
          });
          void scheduler.runRefresh({ sourceIds: allSourceIds });
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        'RAG ingestion bootstrap failed',
        error instanceof Error ? error : new Error(msg)
      );
      void vscode.window.showErrorMessage(
        `ForgeAI: Documentation indexing failed — ${msg}. Check the ForgeAI output channel for details.`
      );
    }
  }

  private registerCommands(): void {
    const logger = this.services.get('logger') as Logger;
    const commandManager = new CommandManager(this.context, logger);

    commandManager.registerCommand('forgeai.open', () => this.openForgeAI());
    commandManager.registerCommand('forgeai.manage', () => this.manageForgeAI());
    commandManager.registerCommand('forgeai.resetOnboarding', () => this.resetOnboarding());
    commandManager.registerCommand('forgeai.openRagSettings', () => this.openRagSettings());

    // UI/UX Architect Agent commands (Phase 2.5)
    commandManager.registerCommand('forgeai.uiux.createDesignSystem', () =>
      this.createDesignSystem()
    );
    commandManager.registerCommand('forgeai.uiux.generateTokens', () => this.generateTokens());
    commandManager.registerCommand('forgeai.uiux.critiqueDesign', () => this.critiqueDesign());
    commandManager.registerCommand('forgeai.uiux.checkAccessibility', () =>
      this.checkAccessibility()
    );

    // Phase 5: Webview UI Panel commands
    commandManager.registerCommand('forgeai.openSpecReview', () => this.openSpecReview());
    commandManager.registerCommand('forgeai.openTaskTracker', () => this.openTaskTracker());
    commandManager.registerCommand('forgeai.openDesignSystem', () => this.openDesignSystem());

    // Spec-driven architecture commands
    commandManager.registerCommand('forgeai.generateSpec', () => this.generateSpecCommand());
    commandManager.registerCommand('forgeai.loadSpec', () => this.loadSpec());
    commandManager.registerCommand('forgeai.runSpec', () => this.runSpec());

    // Bug fix commands
    commandManager.registerCommand('forgeai.fixBug', () => this.fixBugCommand());

    // Spec task execution commands (called by SpecTools and TaskCodeLensProvider)
    commandManager.registerCommand('forgeai.spec.runAllTasks', () => this.runSpec());
    commandManager.registerCommand('forgeai.spec.startTask', (specId: string, taskId: string) =>
      this.runSpecTask(specId, taskId)
    );

    this.context.subscriptions.push(commandManager);
    logger.info('Commands registered');
  }

  private async registerProviders(): Promise<void> {
    const logger = this.services.get('logger') as Logger;
    const storage = this.services.get('storage') as StorageManager;
    const ollama = this.services.get('ollama');
    const toolRegistry = this.services.get('toolRegistry');
    const ragService = this.services.get('ragService');

    try {
      // Register webview provider
      const forgeaiWorkspace = this.services.get('forgeaiWorkspace');
      const researchAgent = this.services.get('researchAgent');
      this.webviewManager = new WebviewManager(
        this.context,
        storage,
        logger,
        ollama,
        toolRegistry,
        forgeaiWorkspace,
        researchAgent,
        ragService
      );

      // VS Code typings in this repo expect TWO args here.
      const webviewDisposable = vscode.window.registerWebviewViewProvider(
        'forgeai.chatView',
        this.webviewManager
      );

      this.context.subscriptions.push(webviewDisposable);
      logger.info('Webview provider registered successfully for view ID: forgeai.chatView');

      // Register theme change listener (Task 14.1)
      this.registerThemeChangeListener(logger);

      // Register Language Model Chat Provider (Task 11.1)
      this.registerLanguageModelChatProvider(logger, ollama, toolRegistry);

      // Register Chat Participant (Task 11.2)
      this.registerChatParticipant(logger, ollama, toolRegistry, ragService);

      // Register UI/UX Architect Agent Design System webview (Phase 2.6)
      await this.registerUIUXDesignSystemView(logger);

      // RAG messages are handled inside the main WebviewManager
    } catch (error) {
      logger.error('Failed to register providers', error);
      throw error;
    }
  }

  private registerThemeChangeListener(logger: Logger): void {
    // Listen for theme changes (Task 14.1)
    const themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme((theme) => {
      logger.info(`Theme changed to: ${theme.kind}`);

      // Forward theme change to webview
      if (this.webviewManager) {
        this.webviewManager.notifyThemeChange(theme);
      }
    });

    this.context.subscriptions.push(themeChangeDisposable);
    logger.info('Theme change listener registered');
  }

  private async registerLanguageModelChatProvider(
    logger: Logger,
    ollama: any,
    toolRegistry: any
  ): Promise<void> {
    try {
      const { LanguageModelChatProvider } = await import('./providers/LanguageModelChatProvider');
      const provider = new LanguageModelChatProvider(ollama, logger, toolRegistry);

      // VS Code typing in this repo expects TWO arguments here.
      // repo typing expects (id, provider) only
      const disposable = (vscode.lm as any).registerLanguageModelChatProvider(
        'forgeai',
        provider as any
      );

      this.context.subscriptions.push(disposable);
      logger.info('Language Model Chat Provider registered successfully');
    } catch (error) {
      logger.error('Failed to register Language Model Chat Provider', error);
      // Don't throw - this is optional functionality
    }
  }

  private async registerChatParticipant(
    logger: Logger,
    ollama: any,
    toolRegistry: any,
    ragService: RagService | undefined
  ): Promise<void> {
    try {
      const { ChatParticipant } = await import('./providers/ChatParticipant');
      const chatParticipant = new ChatParticipant(ollama, toolRegistry, logger, ragService);

      const participant = (vscode.chat as any).createChatParticipant(
        'forgeai.assistant',
        chatParticipant.handleRequest.bind(chatParticipant)
      );

      participant.iconPath = vscode.Uri.joinPath(
        this.context.extensionUri,
        'resources',
        'forgeai-icon.svg'
      );
      participant.followupProvider = {
        provideFollowups: chatParticipant.provideFollowups.bind(chatParticipant),
      };

      this.context.subscriptions.push(participant);
      logger.info('Chat Participant registered successfully with AgentLoop integration');
    } catch (error) {
      logger.error('Failed to register Chat Participant', error);
      // Don't throw - this is optional functionality
    }
  }

  private async openForgeAI(): Promise<void> {
    const logger = this.services.get('logger') as Logger;
    logger.info('Opening ForgeAI view');

    if (this.webviewManager) {
      await this.webviewManager.reveal();
    }
  }

  private manageForgeAI(): void {
    vscode.window.showInformationMessage(
      'ForgeAI settings and model management will be available here soon.'
    );
  }

  private async openRagSettings(): Promise<void> {
    const logger = this.services.get('logger') as Logger;
    logger.info('Opening RAG Settings view');
    if (this.webviewManager) {
      await this.webviewManager.reveal();
      this.webviewManager.showRagSettings();
    }
  }

  private async resetOnboarding(): Promise<void> {
    const logger = this.services.get('logger') as Logger;
    const storage = this.services.get('storage') as StorageManager;

    logger.info('Resetting onboarding tooltips');

    await storage.setGlobalValue('forgeai.onboarding', {
      hasSeenThinkingTooltip: false,
      hasSeenToolTooltip: false,
      hasSeenCodeChangeTooltip: false,
    });

    if (this.webviewManager) {
      vscode.window.showInformationMessage(
        'Onboarding tooltips have been reset. They will appear again on your next interaction.'
      );
    }

    logger.info('Onboarding tooltips reset successfully');
  }

  // ─── UI/UX Architect Agent Commands (Phase 2.5) ────────────────────────

  private async createDesignSystem(): Promise<void> {
    const logger = this.services.get('logger') as Logger;
    const ollama = this.services.get('ollama') as import('./ollama/OllamaClient').OllamaClient;
    const toolRegistry = this.services.get(
      'toolRegistry'
    ) as import('./tools/ToolRegistry').ToolRegistry;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    const { UIUXArchitectAgent } = await import('./agents/ui-ux-architect/UIUXArchitectAgent');
    const agent = new UIUXArchitectAgent(toolRegistry, ollama, logger, workspaceRoot);

    const primaryColor = await vscode.window.showInputBox({
      prompt: 'Enter primary brand color (hex, e.g., #3b82f6)',
      value: '#3b82f6',
    });
    if (!primaryColor) return;

    const name = await vscode.window.showInputBox({
      prompt: 'Design system name',
      value: 'My Design System',
    });
    if (!name) return;

    const result = await agent.execute({
      request: `create design system "${name}" with primary color ${primaryColor}`,
      workspaceRoot,
    });

    if (result.success) {
      vscode.window.showInformationMessage(`Design system "${name}" created successfully!`);
      logger.info('UI/UX: Design system created', result);
    } else {
      vscode.window.showErrorMessage(`Failed: ${result.error || 'Unknown error'}`);
    }
  }

  private async generateTokens(): Promise<void> {
    const logger = this.services.get('logger') as Logger;
    const ollama = this.services.get('ollama') as import('./ollama/OllamaClient').OllamaClient;
    const toolRegistry = this.services.get(
      'toolRegistry'
    ) as import('./tools/ToolRegistry').ToolRegistry;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    const { UIUXArchitectAgent } = await import('./agents/ui-ux-architect/UIUXArchitectAgent');
    const agent = new UIUXArchitectAgent(toolRegistry, ollama, logger, workspaceRoot);

    const format = await vscode.window.showQuickPick(['json', 'css', 'tailwind', 'all'], {
      placeHolder: 'Select token export format',
    });
    if (!format) return;

    const result = await agent.execute({
      request: `generate tokens in ${format} format`,
      workspaceRoot,
    });

    if (result.success) {
      vscode.window.showInformationMessage(`Tokens exported in ${format} format!`);
    } else {
      vscode.window.showErrorMessage(`Failed: ${result.error || 'No design system found'}`);
    }
  }

  private critiqueDesign(): void {
    void vscode.window.showInformationMessage(
      'Design critique: analyze open files for design issues (coming soon)'
    );
  }

  private checkAccessibility(): void {
    void vscode.window.showInformationMessage(
      'Accessibility check: WCAG compliance scanner (coming soon)'
    );
  }

  // ─── Phase 5: Webview UI Panel Commands ──────────────────────────────

  private openSpecReview(): void {
    this.ensureWebviewOpen();
    this.webviewManager?.postMessage({ type: 'openSpecReview' });
    const logger = this.services.get('logger') as Logger;
    logger.info('Opening Spec Review panel');
  }

  private openTaskTracker(): void {
    this.ensureWebviewOpen();
    this.webviewManager?.postMessage({ type: 'openTaskTracker' });
    const logger = this.services.get('logger') as Logger;
    logger.info('Opening Task Tracker panel');
  }

  private openDesignSystem(): void {
    this.ensureWebviewOpen();
    this.webviewManager?.postMessage({ type: 'openDesignSystem' });
    const logger = this.services.get('logger') as Logger;
    logger.info('Opening Design System panel');
  }

  private ensureWebviewOpen(): void {
    if (!this.webviewManager) return;
    // Focus the webview view if available
    void vscode.commands.executeCommand('forgeai.chatView.focus');
  }

  // ─── Spec-Driven Architecture Commands ────────────────────────────────

  private async loadSpec(): Promise<void> {
    const logger = this.services.get('logger') as Logger;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('No workspace open to load specs from');
      return;
    }

    const specsDir = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), '.forgeai', 'specs');
    try {
      await vscode.workspace.fs.createDirectory(specsDir);
    } catch {
      // Directory may already exist
    }

    // Let user pick a spec directory
    const specUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: specsDir,
      openLabel: 'Load Spec',
      title: 'Select a spec directory (contains requirements.md and tasks.md)',
    });

    if (!specUris || specUris.length === 0) {
      return;
    }

    const specDir = specUris[0].fsPath;
    logger.info(`Loading spec from: ${specDir}`);

    try {
      const specReader = new SpecReader();
      const spec = await specReader.parseSpecDirectory(specDir);

      // Store parsed spec in workspace state so WebviewManager can access it
      await this.webviewManager?.loadSpecIntoPanels(spec);

      // Open the spec review panel to show loaded data
      this.openSpecReview();
      this.openTaskTracker();

      void vscode.window.showInformationMessage(
        `Loaded spec "${spec.id}": ${spec.requirements.length} requirements, ${spec.tasks.length} tasks, ${spec.progress}% complete`
      );
      logger.info(`Spec loaded: ${spec.id} with ${spec.tasks.length} tasks`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to load spec', error);
      void vscode.window.showErrorMessage(`Failed to load spec: ${msg}`);
    }
  }

  private async runSpec(): Promise<void> {
    const logger = this.services.get('logger') as Logger;
    const ollama = this.services.get('ollama');
    if (!ollama) {
      void vscode.window.showWarningMessage('Ollama client not available. Cannot run spec.');
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('No workspace open to run specs from');
      return;
    }

    // Let user pick a spec directory
    const specsDir = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), '.forgeai', 'specs');
    const specUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: specsDir,
      openLabel: 'Run Spec',
      title: 'Select a spec directory to execute',
    });

    if (!specUris || specUris.length === 0) {
      return;
    }

    const specDir = specUris[0].fsPath;
    logger.info(`Running spec from: ${specDir}`);

    try {
      const executor = new SpecTaskExecutor();

      // Open panels to show progress
      this.openSpecReview();
      this.openTaskTracker();

      const result = await executor.executeSpec(
        specDir,
        { execute: ollama.execute.bind(ollama) },
        {
          stopAtCheckpoints: true,
          autoRetry: true,
          maxRetries: 2,
          continueOnFailure: true,
          onTaskProgress: (task, progress) => {
            logger.info(`Spec progress: ${progress}% — Task ${task.id}: ${task.description}`);
            void this.webviewManager?.updateTaskInPanel(task);
          },
          onTaskComplete: (task, compliance) => {
            logger.info(`Task ${task.id} completed with score ${compliance.score}`);
            void this.webviewManager?.updateTaskInPanel(task);
          },
          onTaskFail: (task, error) => {
            logger.warn(`Task ${task.id} failed: ${error}`);
            void this.webviewManager?.updateTaskInPanel(task);
          },
          onPhaseGate: (phase, passed, output) => {
            if (passed) {
              logger.info(`Phase ${phase.number} gate PASSED: all tests at 100%`);
              void this.webviewManager?.postMessage({
                type: 'showTerminal',
                data: { output: `Phase ${phase.number} Gate: PASSED\n${output}` },
              });
            } else {
              logger.error(`Phase ${phase.number} gate FAILED:\n${output}`);
              void vscode.window.showErrorMessage(
                `Phase ${phase.number} gate FAILED. Fix tests before proceeding.`,
                'View Output'
              );
              void this.webviewManager?.postMessage({
                type: 'showTerminal',
                data: { output: `Phase ${phase.number} Gate: FAILED\n${output}` },
              });
            }
          },
          onCheckpoint: async (phase) => {
            const choice = await vscode.window.showInformationMessage(
              `Checkpoint reached: Phase ${phase.number} — ${phase.title}. All tests passed at 100%.`,
              'Continue',
              'Pause'
            );
            return choice === 'Continue';
          },
        }
      );

      void vscode.window.showInformationMessage(
        `Spec execution complete: ${result.completed}/${result.spec.tasks.length} tasks completed, ${result.failed} failed`
      );
      logger.info(`Spec run finished: ${result.completed} completed, ${result.failed} failed`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to run spec', error);
      void vscode.window.showErrorMessage(`Failed to run spec: ${msg}`);
    }
  }

  /**
   * Run a single task from a spec by specId + taskId.
   * Called by forgeai.spec.startTask command (used by SpecTools and TaskCodeLensProvider).
   */
  private async runSpecTask(specId: string, taskId: string): Promise<void> {
    const logger = this.services.get('logger') as Logger;
    const ollama = this.services.get('ollama');

    if (!ollama) {
      void vscode.window.showWarningMessage('Ollama client not available. Cannot run task.');
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('No workspace open.');
      return;
    }

    logger.info(`Running task ${taskId} from spec ${specId}`);

    try {
      const specDir = path.join(workspaceRoot, '.forgeai', 'specs', specId);
      const executor = new SpecTaskExecutor();

      this.openTaskTracker();

      const result = await executor.executeSpec(
        specDir,
        { execute: ollama.execute.bind(ollama) },
        {
          stopAtCheckpoints: false,
          autoRetry: true,
          maxRetries: 2,
          continueOnFailure: false,
          taskFilter: (task) => task.id === taskId,
          onTaskProgress: (task, progress) => {
            logger.info(`Task ${task.id} progress: ${progress}%`);
            void this.webviewManager?.updateTaskInPanel(task);
          },
          onTaskComplete: (task, compliance) => {
            logger.info(`Task ${task.id} completed with score ${compliance.score}`);
            void this.webviewManager?.updateTaskInPanel(task);
          },
          onTaskFail: (task, error) => {
            logger.warn(`Task ${task.id} failed: ${error}`);
            void this.webviewManager?.updateTaskInPanel(task);
          },
        }
      );

      void vscode.window.showInformationMessage(
        `Task ${taskId} complete: ${result.completed} done, ${result.failed} failed`
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to run task ${taskId}`, error);
      void vscode.window.showErrorMessage(`Failed to run task ${taskId}: ${msg}`);
    }
  }

  private async generateSpecCommand(): Promise<void> {
    const logger = this.services.get('logger') as Logger;

    const userRequest = await vscode.window.showInputBox({
      prompt: 'Describe the feature or system to spec out',
      placeHolder: 'e.g., "User authentication with OAuth2 and email verification"',
      title: 'Generate Spec',
    });

    if (!userRequest || !userRequest.trim()) {
      return;
    }

    // Ensure webview is open
    this.ensureWebviewOpen();

    // Use a synthetic conversation ID for the command-based flow
    const conversationId = `spec-gen-${Date.now()}`;
    await this.webviewManager?.generateSpec(conversationId, userRequest.trim());
    logger.info(`Command-triggered spec generation for: ${userRequest}`);
  }

  private async registerUIUXDesignSystemView(logger: Logger): Promise<void> {
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const { UIUXWebviewProvider } = await import('./agents/ui-ux-architect/UIUXWebviewProvider');
      const provider = new UIUXWebviewProvider(this.context, workspaceRoot);

      const disposable = vscode.window.registerWebviewViewProvider(
        UIUXWebviewProvider.viewType,
        provider
      );
      this.context.subscriptions.push(disposable);
      logger.info('UI/UX Design System webview registered');
    } catch (error) {
      logger.error('Failed to register UI/UX webview', error);
    }
  }

  private deactivate(): void {
    const logger = this.services.get('logger') as Logger;
    logger.info('Deactivating ForgeAI extension');

    this.services.forEach((service) => {
      if ('dispose' in service && typeof service.dispose === 'function') {
        service.dispose();
      }
    });
    this.services.clear();

    if (this.webviewManager) {
      this.webviewManager.dispose();
      this.webviewManager = undefined;
    }
  }

  // ─── Bug Fix Commands ────────────────────────────────────────────────

  private async fixBugCommand(): Promise<void> {
    const logger = this.services.get('logger') as Logger;
    const ollama = this.services.get('ollama');

    if (!ollama) {
      void vscode.window.showWarningMessage('Ollama client not available. Cannot fix bug.');
      return;
    }

    try {
      const { BugFixCommandHandler } = await import('./bugfix/BugFixCommandHandler');
      const handler = new BugFixCommandHandler(logger);
      await handler.handleFixBugCommand({ execute: ollama.execute.bind(ollama) });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Bug fix command failed', error);
      void vscode.window.showErrorMessage(`Bug fix failed: ${msg}`);
    }
  }
}

/**
 * Extension activation entry point
 */
export function activate(context: vscode.ExtensionContext): Promise<void> {
  const extension = new ForgeAIExtension(context);
  return extension.activate();
}

/**
 * Extension deactivation entry point
 */
export function deactivate(): void {
  // Cleanup handled by ForgeAIExtension
}
