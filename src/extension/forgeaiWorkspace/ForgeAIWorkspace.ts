import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DirectoryManager } from './DirectoryManager';
import { MemoryManager } from './MemoryManager';
import { ProductManager } from './ProductManager';
import { SpecManager } from './SpecManager';
import { HookManager } from './HookManager';
import { SteeringManager } from './SteeringManager';
import { TaskManager } from './TaskManager';
import { DriftDetector } from './DriftDetector';
import { ModelRouter } from '../ollama/ModelRouter';
import { Logger } from '../utils/Logger';
import { PersonaManager } from '../persona/PersonaManager';

/**
 * Main entry point for managing the .forgeai/ workspace.
 *
 * Responsibilities:
 * - Initialize directory structure
 * - Provide typed access to each subsystem (memory, product, spec, hooks)
 * - Track initialization state
 * - Expose file paths to other extension components
 */

export class ForgeAIWorkspace {
  private directoryManager: DirectoryManager;
  private logger: Logger;
  private context: vscode.ExtensionContext;
  private initialized: boolean = false;
  readonly memory: MemoryManager;
  readonly product: ProductManager;
  readonly spec: SpecManager;
  readonly hooks: HookManager;
  readonly steering: SteeringManager;
  readonly tasks: TaskManager;
  readonly drift: DriftDetector;
  readonly modelRouter: ModelRouter;
  readonly persona: PersonaManager;

  constructor(workspaceRoot: string, logger: Logger, context: vscode.ExtensionContext) {
    this.directoryManager = new DirectoryManager(workspaceRoot);
    this.logger = logger;
    this.context = context;
    this.memory = new MemoryManager(workspaceRoot);
    this.product = new ProductManager(workspaceRoot);
    this.spec = new SpecManager(workspaceRoot);
    this.hooks = new HookManager(workspaceRoot);
    this.spec.setHookManager(this.hooks);
    this.steering = new SteeringManager(workspaceRoot);
    this.tasks = new TaskManager(workspaceRoot);
    this.drift = new DriftDetector(workspaceRoot);
    this.modelRouter = new ModelRouter();
    this.persona = new PersonaManager(workspaceRoot);
  }

  /**
   * Auto-initialize on first launch for this workspace.
   * Uses globalState to track which workspaces have been initialized.
   */
  async maybeAutoInitialize(): Promise<boolean> {
    const workspaceRoot = this.directoryManager
      .getForgeAIPath()
      .replace('/.forgeai', '')
      .replace('\\.forgeai', '');
    const stateKey = `forgeai.workspaceInitialized.${this.hashPath(workspaceRoot)}`;

    const alreadyInitialized = this.context.globalState.get<boolean>(stateKey, false);
    if (alreadyInitialized && this.isInitialized()) {
      this.initialized = true;
      return true;
    }

    // First launch for this workspace — auto-init silently
    try {
      this.directoryManager.initialize();
      this.initialized = true;
      await this.context.globalState.update(stateKey, true);

      // Auto-detect and save product overview from workspace
      const workspaceRoot = this.directoryManager
        .getForgeAIPath()
        .replace('/.forgeai', '')
        .replace('\\.forgeai', '');
      if (!this.product.getOverview()) {
        const detected = this.product.detectFromWorkspace(workspaceRoot);
        this.product.saveOverview(detected);
      }

      // Create default hooks
      this.hooks.createDefaults();

      // Create default steering files
      this.steering.createDefaults();

      return true;
    } catch (error) {
      this.logger.error('[ForgeAIWorkspace] Auto-init failed', error);
      return false;
    }
  }

  /**
   * Initialize the .forgeai/ workspace if it doesn't exist.
   * Called on command: forgeai.initWorkspace
   */
  initialize(): void {
    try {
      this.directoryManager.initialize();
      this.initialized = true;
      vscode.window.showInformationMessage('ForgeAI workspace initialized at .forgeai/');
    } catch (error) {
      this.logger.error('[ForgeAIWorkspace] Failed to initialize workspace', error);
      vscode.window.showErrorMessage(
        `Failed to initialize ForgeAI workspace: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** Check if workspace is already initialized */
  isInitialized(): boolean {
    return this.directoryManager.isInitialized();
  }

  /** Ensure workspace exists before operations */
  requireWorkspace(): boolean {
    if (!this.isInitialized()) {
      vscode.window.showWarningMessage(
        'ForgeAI workspace not initialized. Run: ForgeAI: Init Workspace'
      );
      return false;
    }
    return true;
  }

  /** Get current workspace state for AI awareness */
  getWorkspaceState(): {
    initialized: boolean;
    specs: ReturnType<DirectoryManager['listSpecs']>;
    memoryCount: number;
    productExists: boolean;
    productName: string;
    productDescription: string;
    productTechStack: string[];
    hooksExist: boolean;
  } {
    const initialized = this.isInitialized();
    const overview = initialized ? this.product.getOverview() : null;
    return {
      initialized,
      specs: initialized ? this.directoryManager.listSpecs() : [],
      memoryCount: initialized ? this.memory.list().length : 0,
      productExists:
        initialized && fs.existsSync(path.join(this.rootPath, 'product', 'overview.md')),
      productName: overview?.name ?? '',
      productDescription: overview?.description ?? '',
      productTechStack: overview?.techStack ?? [],
      hooksExist: initialized && fs.existsSync(path.join(this.rootPath, 'hooks', 'README.md')),
    };
  }

  private hashPath(p: string): string {
    let hash = 0x811c9dc5;
    const normalized = p.trim().toLowerCase();
    for (let i = 0; i < normalized.length; i++) {
      hash ^= normalized.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  /** Path to .forgeai/ */
  get rootPath(): string {
    return this.directoryManager.getForgeAIPath();
  }

  /** Path to .forgeai/memory/ */
  get memoryPath(): string {
    return this.directoryManager.getDirectoryPath('memory');
  }

  /** Path to .forgeai/product/ */
  get productPath(): string {
    return this.directoryManager.getDirectoryPath('product');
  }

  /** Path to .forgeai/specs/ */
  get specPath(): string {
    return this.directoryManager.getDirectoryPath('specs');
  }

  /** Path to .forgeai/hooks/ */
  get hooksPath(): string {
    return this.directoryManager.getDirectoryPath('hooks');
  }

  /** List all specs in .forgeai/spec/ */
  listSpecs(): ReturnType<DirectoryManager['listSpecs']> {
    return this.directoryManager.listSpecs();
  }
}
