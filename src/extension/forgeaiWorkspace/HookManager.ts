import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface HookTrigger {
  type: 'file' | 'spec' | 'command';
  pattern?: string; // glob pattern for file triggers
  phase?: 'requirements' | 'design' | 'tasks'; // spec phase
  command?: string; // command ID for command triggers
}

export interface HookAction {
  type: 'agent' | 'shell' | 'message';
  prompt?: string; // for agent actions
  command?: string; // for shell actions
  message?: string; // for message actions
}

export interface Hook {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  autoApprove: boolean;
  triggers: HookTrigger[];
  actions: HookAction[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Manages the .forgeai/hooks/ directory.
 * Hooks are stored as individual YAML files.
 */
export class HookManager {
  private hooksDir: string;

  constructor(workspaceRoot: string) {
    this.hooksDir = path.join(workspaceRoot, '.forgeai', 'hooks');
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.hooksDir)) {
      fs.mkdirSync(this.hooksDir, { recursive: true });
    }
  }

  /** List all hooks */
  listHooks(): Hook[] {
    if (!fs.existsSync(this.hooksDir)) return [];
    const entries = fs.readdirSync(this.hooksDir);
    const hooks: Hook[] = [];
    for (const entry of entries) {
      if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
        const hook = this.loadHook(entry.replace(/\.ya?ml$/, ''));
        if (hook) hooks.push(hook);
      }
    }
    return hooks.sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Load a single hook */
  loadHook(id: string): Hook | null {
    const file = path.join(this.hooksDir, `${id}.yaml`);
    if (!fs.existsSync(file)) return null;
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      return this.parseYaml(raw, id);
    } catch {
      return null;
    }
  }

  /** Save a hook */
  saveHook(hook: Hook): void {
    const file = path.join(this.hooksDir, `${hook.id}.yaml`);
    const yaml = this.toYaml(hook);
    fs.writeFileSync(file, yaml, 'utf-8');
  }

  /** Delete a hook */
  deleteHook(id: string): boolean {
    const file = path.join(this.hooksDir, `${id}.yaml`);
    if (!fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
  }

  /** Create default hooks on first init */
  createDefaults(): void {
    const defaults: Hook[] = [
      {
        id: 'on-requirements-change',
        name: 'On Requirements Change',
        description: 'Triggers when requirements.md is saved to suggest design updates',
        enabled: true,
        autoApprove: false,
        triggers: [{ type: 'spec', phase: 'requirements' }],
        actions: [
          { type: 'message', message: 'Requirements changed — consider updating the design.md' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'on-spec-change',
        name: 'On Spec Change',
        description: 'Triggers when spec artifacts are modified to suggest task updates',
        enabled: true,
        autoApprove: false,
        triggers: [{ type: 'spec', phase: 'design' }],
        actions: [
          { type: 'agent', prompt: 'Review the updated design.md and update tasks.md accordingly' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'on-readme-save',
        name: 'On README Save',
        description: 'Suggest updating product overview when README changes',
        enabled: false,
        autoApprove: false,
        triggers: [{ type: 'file', pattern: '**/README.md' }],
        actions: [
          { type: 'message', message: 'README changed — consider updating product/overview.md' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    for (const hook of defaults) {
      const file = path.join(this.hooksDir, `${hook.id}.yaml`);
      if (!fs.existsSync(file)) {
        this.saveHook(hook);
      }
    }
  }

  private parseYaml(raw: string, id: string): Hook {
    const lines = raw.split('\n');
    const result: Record<string, unknown> = {};
    let currentKey = '';
    let inArray = false;
    const arrayItems: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (line.startsWith('  - ') && inArray) {
        arrayItems.push(trimmed.replace(/^- /, ''));
        continue;
      }

      if (line.startsWith('- ')) {
        if (!inArray) {
          inArray = true;
          arrayItems.length = 0;
        }
        arrayItems.push(trimmed.replace(/^- /, ''));
        continue;
      }

      if (inArray && arrayItems.length > 0) {
        result[currentKey] = arrayItems.map((item) => this.parseItem(item));
        inArray = false;
        arrayItems.length = 0;
      }

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const val = trimmed.slice(colonIdx + 1).trim();
        currentKey = key;
        if (!val) {
          inArray = true;
          arrayItems.length = 0;
        } else {
          result[key] = this.parseValue(val);
        }
      }
    }

    if (inArray && arrayItems.length > 0) {
      result[currentKey] = arrayItems.map((item) => this.parseItem(item));
    }

    return {
      id: id,
      name: (result.name as string) ?? id,
      description: (result.description as string) ?? '',
      enabled: result.enabled === true || result.enabled === 'true',
      autoApprove: result.autoApprove === true || result.autoApprove === 'true',
      triggers: Array.isArray(result.triggers) ? (result.triggers as HookTrigger[]) : [],
      actions: Array.isArray(result.actions) ? (result.actions as HookAction[]) : [],
      createdAt: typeof result.createdAt === 'number' ? result.createdAt : Date.now(),
      updatedAt: typeof result.updatedAt === 'number' ? result.updatedAt : Date.now(),
    };
  }

  private parseItem(item: string): Record<string, string> {
    const parts = item.split(',').map((p) => p.trim());
    const result: Record<string, string> = {};
    for (const part of parts) {
      const eqIdx = part.indexOf(':');
      if (eqIdx > 0) {
        result[part.slice(0, eqIdx).trim()] = part
          .slice(eqIdx + 1)
          .trim()
          .replace(/^"|"$/g, '');
      }
    }
    return result;
  }

  private parseValue(val: string): string | boolean | number {
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (/^\d+$/.test(val)) return parseInt(val, 10);
    return val.replace(/^"|"$/g, '');
  }

  private toYaml(hook: Hook): string {
    const lines = [
      `# ${hook.name}`,
      `id: ${hook.id}`,
      `name: "${hook.name}"`,
      `description: "${hook.description}"`,
      `enabled: ${hook.enabled}`,
      `autoApprove: ${hook.autoApprove}`,
      '',
      'triggers:',
      ...hook.triggers.map((t) => {
        const parts = [`type: ${t.type}`];
        if (t.pattern) parts.push(`pattern: "${t.pattern}"`);
        if (t.phase) parts.push(`phase: ${t.phase}`);
        if (t.command) parts.push(`command: "${t.command}"`);
        return `  - ${parts.join(', ')}`;
      }),
      '',
      'actions:',
      ...hook.actions.map((a) => {
        const parts = [`type: ${a.type}`];
        if (a.prompt) parts.push(`prompt: "${a.prompt}"`);
        if (a.command) parts.push(`command: "${a.command}"`);
        if (a.message) parts.push(`message: "${a.message}"`);
        return `  - ${parts.join(', ')}`;
      }),
      '',
      `createdAt: ${hook.createdAt}`,
      `updatedAt: ${hook.updatedAt}`,
    ];
    return lines.join('\n');
  }

  // ─── Execution Engine ───

  private disposables: vscode.Disposable[] = [];
  private agentDispatch?: (prompt: string) => Promise<string>;

  /**
   * Register an agent dispatch callback for 'agent' type hook actions.
   */
  registerAgentDispatch(dispatch: (prompt: string) => Promise<string>): void {
    this.agentDispatch = dispatch;
  }

  /**
   * Start watching file system for hook triggers.
   * Call this once during extension activation.
   */
  startWatching(): void {
    this.stopWatching();
    const hooks = this.listHooks().filter((h) => h.enabled);
    for (const hook of hooks) {
      for (const trigger of hook.triggers) {
        if (trigger.type === 'file' && trigger.pattern) {
          const watcher = vscode.workspace.createFileSystemWatcher(trigger.pattern);
          watcher.onDidChange(
            () => void this.executeHook(hook, { event: 'fileChange', pattern: trigger.pattern })
          );
          watcher.onDidCreate(
            () => void this.executeHook(hook, { event: 'fileCreate', pattern: trigger.pattern })
          );
          this.disposables.push(watcher);
        }
      }
    }
  }

  /**
   * Stop all file watchers.
   */
  stopWatching(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }

  /**
   * Called by SpecManager when a spec phase is written/approved.
   */
  onSpecChange(specId: string, phase: 'requirements' | 'design' | 'tasks'): void {
    const hooks = this.listHooks().filter((h) => h.enabled);
    for (const hook of hooks) {
      const matches = hook.triggers.some(
        (t) => t.type === 'spec' && (t.phase === phase || !t.phase)
      );
      if (matches) {
        void this.executeHook(hook, { event: 'specChange', specId, phase });
      }
    }
  }

  /**
   * Execute a hook's actions given a context.
   */
  private async executeHook(
    hook: Hook,
    _context: { event: string; pattern?: string; specId?: string; phase?: string }
  ): Promise<void> {
    for (const action of hook.actions) {
      try {
        switch (action.type) {
          case 'message':
            if (action.message) {
              vscode.window.showInformationMessage(`[Hook: ${hook.name}] ${action.message}`);
            }
            break;
          case 'shell':
            if (action.command) {
              const terminal =
                vscode.window.activeTerminal ?? vscode.window.createTerminal(`Hook: ${hook.name}`);
              terminal.sendText(action.command);
              terminal.show();
            }
            break;
          case 'agent':
            if (action.prompt && this.agentDispatch) {
              if (hook.autoApprove) {
                await this.agentDispatch(action.prompt);
              } else {
                const confirm = await vscode.window.showInformationMessage(
                  `[Hook: ${hook.name}] Run agent action?`,
                  { modal: false },
                  'Run',
                  'Skip'
                );
                if (confirm === 'Run') {
                  await this.agentDispatch(action.prompt);
                }
              }
            }
            break;
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          `Hook "${hook.name}" action failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }
}
