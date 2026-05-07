import * as vscode from 'vscode';
import { Tool } from './ToolRegistry';

/**
 * Git Tools for ForgeAI
 *
 * Provides Git operations through VS Code's Git extension API
 * Implements: gitStatus, gitCommit, gitPush, gitPull, gitCreateBranch
 */

export interface GitStatus {
  branch: string;
  changes: {
    modified: string[];
    added: string[];
    deleted: string[];
    untracked: string[];
  };
  staged: {
    modified: string[];
    added: string[];
    deleted: string[];
  };
  ahead: number;
  behind: number;
}

export interface GitCommitOptions {
  message: string;
  files?: string[]; // If provided, stage only these files
  amend?: boolean;
}

export interface GitBranchOptions {
  name: string;
  checkout?: boolean;
}

export class GitTools {
  private gitExtension: any = null;
  private readonly OPERATION_TIMEOUT = 10000; // 10 seconds timeout

  /**
   * Lazy-load Git extension API
   * This ensures the Git extension is activated before we try to use it
   */
  private async getGitExtension(): Promise<any> {
    if (this.gitExtension) {
      return this.gitExtension;
    }

    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension) {
      throw new Error(
        'Git extension not found. Please ensure Git is installed and the VS Code Git extension is enabled.'
      );
    }

    // Activate the extension if it's not already activated
    if (!gitExtension.isActive) {
      await gitExtension.activate();
    }

    this.gitExtension = gitExtension.exports;
    return this.gitExtension;
  }

  /**
   * Wrap async operation with timeout
   */
  private async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number = this.OPERATION_TIMEOUT
  ): Promise<T> {
    return Promise.race([
      operation,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Git operation timed out')), timeoutMs)
      ),
    ]);
  }

  /**
   * Tool: Get current Git status
   */
  public gitStatus(): Tool {
    return {
      name: 'forgeai_gitStatus',
      description:
        'Get current Git status including branch name, changes, staged files, and sync status (ahead/behind remote)',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        return await this.withTimeout(this.getStatus());
      },
    };
  }

  /**
   * Tool: Stage and commit changes
   */
  public gitCommit(): Tool {
    return {
      name: 'forgeai_gitCommit',
      description:
        'Stage and commit changes with a commit message. Optionally stage only specific files.',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Commit message',
          },
          files: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional: Array of file paths to stage. If not provided, stages all changes.',
          },
          amend: {
            type: 'boolean',
            description: 'Optional: Amend the previous commit instead of creating a new one',
          },
        },
        required: ['message'],
      },
      execute: async (args: GitCommitOptions) => {
        return await this.withTimeout(this.commit(args));
      },
    };
  }

  /**
   * Tool: Push commits to remote
   */
  public gitPush(): Tool {
    return {
      name: 'forgeai_gitPush',
      description: 'Push commits to the remote repository',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        return await this.withTimeout(this.push(), 30000); // 30s timeout for push
      },
    };
  }

  /**
   * Tool: Pull commits from remote
   */
  public gitPull(): Tool {
    return {
      name: 'forgeai_gitPull',
      description: 'Pull commits from the remote repository',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        return await this.withTimeout(this.pull(), 30000); // 30s timeout for pull
      },
    };
  }

  /**
   * Tool: Create a new branch
   */
  public gitCreateBranch(): Tool {
    return {
      name: 'forgeai_gitCreateBranch',
      description: 'Create a new Git branch and optionally checkout to it',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Branch name',
          },
          checkout: {
            type: 'boolean',
            description: 'Whether to checkout the new branch (default: true)',
          },
        },
        required: ['name'],
      },
      execute: async (args: GitBranchOptions) => {
        return await this.withTimeout(this.createBranch(args));
      },
    };
  }

  /**
   * Get current Git status
   * Returns branch name, changes, staged files, and sync status
   */
  async getStatus(): Promise<GitStatus> {
    try {
      const gitExtension = await this.getGitExtension();
      const api = gitExtension.getAPI(1);
      const repo = api.repositories[0];

      if (!repo) {
        throw new Error('No Git repository found in workspace');
      }

      const state = repo.state;
      const head = state.HEAD;

      // Get changes
      const changes = {
        modified: [] as string[],
        added: [] as string[],
        deleted: [] as string[],
        untracked: [] as string[],
      };

      const staged = {
        modified: [] as string[],
        added: [] as string[],
        deleted: [] as string[],
      };

      // Process working tree changes (with safety check)
      const workingTreeChanges = state.workingTreeChanges || [];
      for (const change of workingTreeChanges) {
        if (!change || !change.uri) continue;

        const path = change.uri.fsPath;

        switch (change.status) {
          case 0: // INDEX_MODIFIED
            changes.modified.push(path);
            break;
          case 1: // INDEX_ADDED
            changes.added.push(path);
            break;
          case 2: // INDEX_DELETED
            changes.deleted.push(path);
            break;
          case 7: // UNTRACKED
            changes.untracked.push(path);
            break;
        }
      }

      // Process index changes (staged) (with safety check)
      const indexChanges = state.indexChanges || [];
      for (const change of indexChanges) {
        if (!change || !change.uri) continue;

        const path = change.uri.fsPath;

        switch (change.status) {
          case 0: // INDEX_MODIFIED
            staged.modified.push(path);
            break;
          case 1: // INDEX_ADDED
            staged.added.push(path);
            break;
          case 2: // INDEX_DELETED
            staged.deleted.push(path);
            break;
        }
      }

      return {
        branch: head?.name || 'unknown',
        changes,
        staged,
        ahead: head?.ahead || 0,
        behind: head?.behind || 0,
      };
    } catch (error: any) {
      throw new Error(`Failed to get Git status: ${error.message}`);
    }
  }

  /**
   * Stage and commit changes
   * If files are provided, stage only those files
   * Otherwise, stage all changes
   */
  async commit(
    options: GitCommitOptions
  ): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    try {
      const gitExtension = await this.getGitExtension();
      const api = gitExtension.getAPI(1);
      const repo = api.repositories[0];

      if (!repo) {
        throw new Error('No Git repository found in workspace');
      }

      // Stage files
      if (options.files && options.files.length > 0) {
        // Stage specific files
        for (const file of options.files) {
          const uri = vscode.Uri.file(file);
          await repo.add([uri]);
        }
      } else {
        // Stage all changes
        await repo.add([]);
      }

      // Commit
      const commitHash = await repo.commit(options.message, {
        amend: options.amend || false,
      });

      return {
        success: true,
        commitHash,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Push commits to remote
   */
  async push(): Promise<{ success: boolean; error?: string }> {
    try {
      const gitExtension = await this.getGitExtension();
      const api = gitExtension.getAPI(1);
      const repo = api.repositories[0];

      if (!repo) {
        throw new Error('No Git repository found in workspace');
      }

      await repo.push();

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Pull commits from remote
   */
  async pull(): Promise<{ success: boolean; error?: string }> {
    try {
      const gitExtension = await this.getGitExtension();
      const api = gitExtension.getAPI(1);
      const repo = api.repositories[0];

      if (!repo) {
        throw new Error('No Git repository found in workspace');
      }

      await repo.pull();

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a new branch
   * Optionally checkout the new branch
   */
  async createBranch(options: GitBranchOptions): Promise<{ success: boolean; error?: string }> {
    try {
      const gitExtension = await this.getGitExtension();
      const api = gitExtension.getAPI(1);
      const repo = api.repositories[0];

      if (!repo) {
        throw new Error('No Git repository found in workspace');
      }

      // Create branch
      await repo.createBranch(options.name, options.checkout !== false);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get list of branches
   */
  async listBranches(): Promise<{ current: string; branches: string[] }> {
    const gitExtension = await this.getGitExtension();
    const api = gitExtension.getAPI(1);
    const repo = api.repositories[0];

    if (!repo) {
      throw new Error('No Git repository found in workspace');
    }

    const state = repo.state;
    const head = state.HEAD;
    const refs = state.refs;

    const branches = refs
      .filter((ref: any) => ref.type === 0) // HEAD type
      .map((ref: any) => ref.name || '');

    return {
      current: head?.name || 'unknown',
      branches,
    };
  }

  /**
   * Checkout a branch
   */
  async checkout(branchName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const gitExtension = await this.getGitExtension();
      const api = gitExtension.getAPI(1);
      const repo = api.repositories[0];

      if (!repo) {
        throw new Error('No Git repository found in workspace');
      }

      await repo.checkout(branchName);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get commit history
   */
  async getLog(limit: number = 10): Promise<
    Array<{
      hash: string;
      message: string;
      author: string;
      date: Date;
    }>
  > {
    const gitExtension = await this.getGitExtension();
    const api = gitExtension.getAPI(1);
    const repo = api.repositories[0];

    if (!repo) {
      throw new Error('No Git repository found in workspace');
    }

    const log = await repo.log({ maxEntries: limit });

    return log.map((commit: any) => ({
      hash: commit.hash,
      message: commit.message,
      author: commit.authorName || 'Unknown',
      date: new Date(commit.authorDate || Date.now()),
    }));
  }
}
