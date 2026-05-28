/**
 * Command Execution Tracker
 * Prevents duplicate command runs and tracks execution history
 * Requirement: Prevent AI from blindly retrying failed commands
 */

export interface CommandExecution {
  command: string;
  cwd?: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timestamp: number;
  duration: number;
}

export interface CommandHistory {
  command: string;
  cwd?: string;
  executions: CommandExecution[];
  lastError?: string;
  lastErrorAnalysis?: string;
  fixAttempted?: boolean;
}

/**
 * Tracks command execution history to prevent duplicate runs
 * and enforce error analysis before retry
 */
export class CommandExecutionTracker {
  private history: Map<string, CommandHistory> = new Map();
  private readonly MAX_HISTORY_PER_COMMAND = 5;

  /**
   * Get unique key for a command
   */
  private getCommandKey(command: string, cwd?: string): string {
    return `${command}|${cwd || 'default'}`;
  }

  /**
   * Record a command execution
   */
  public recordExecution(
    command: string,
    cwd: string | undefined,
    exitCode: number,
    stdout: string,
    stderr: string,
    duration: number
  ): void {
    const key = this.getCommandKey(command, cwd);
    let history = this.history.get(key);

    if (!history) {
      history = {
        command,
        cwd,
        executions: [],
      };
      this.history.set(key, history);
    }

    history.executions.push({
      command,
      cwd,
      exitCode,
      stdout,
      stderr,
      timestamp: Date.now(),
      duration,
    });

    // Keep only last N executions
    if (history.executions.length > this.MAX_HISTORY_PER_COMMAND) {
      history.executions = history.executions.slice(-this.MAX_HISTORY_PER_COMMAND);
    }

    // Track error
    if (exitCode !== 0) {
      history.lastError = stderr || stdout;
    }
  }

  /**
   * Check if a command is being retried without fixes
   * Returns true if:
   * - Command has been run before
   * - Last run failed
   * - No fix has been attempted
   * - Same command is being run again
   */
  public isBlindRetry(command: string, cwd?: string): boolean {
    const key = this.getCommandKey(command, cwd);
    const history = this.history.get(key);

    if (!history || history.executions.length === 0) {
      return false; // First run, not a retry
    }

    const lastExecution = history.executions[history.executions.length - 1];

    // If last execution failed and no fix was attempted, this is a blind retry
    return lastExecution.exitCode !== 0 && !history.fixAttempted;
  }

  /**
   * Get the last error for a command
   */
  public getLastError(command: string, cwd?: string): string | undefined {
    const key = this.getCommandKey(command, cwd);
    const history = this.history.get(key);
    return history?.lastError;
  }

  /**
   * Get execution history for a command
   */
  public getHistory(command: string, cwd?: string): CommandExecution[] {
    const key = this.getCommandKey(command, cwd);
    const history = this.history.get(key);
    return history?.executions || [];
  }

  /**
   * Mark that a fix has been attempted for a command
   * Call this after the AI has analyzed the error and applied a fix
   */
  public markFixAttempted(command: string, cwd?: string, analysis?: string): void {
    const key = this.getCommandKey(command, cwd);
    let history = this.history.get(key);

    if (!history) {
      history = {
        command,
        cwd,
        executions: [],
      };
      this.history.set(key, history);
    }

    history.fixAttempted = true;
    if (analysis) {
      history.lastErrorAnalysis = analysis;
    }
  }

  /**
   * Reset fix flag for a command (after successful retry)
   */
  public resetFixFlag(command: string, cwd?: string): void {
    const key = this.getCommandKey(command, cwd);
    const history = this.history.get(key);

    if (history) {
      history.fixAttempted = false;
      history.lastErrorAnalysis = undefined;
    }
  }

  /**
   * Get count of consecutive failures for a command
   */
  public getConsecutiveFailures(command: string, cwd?: string): number {
    const key = this.getCommandKey(command, cwd);
    const history = this.history.get(key);

    if (!history || history.executions.length === 0) {
      return 0;
    }

    let count = 0;
    for (let i = history.executions.length - 1; i >= 0; i--) {
      if (history.executions[i].exitCode !== 0) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }

  /**
   * Clear history for a command
   */
  public clearHistory(command?: string, cwd?: string): void {
    if (command) {
      const key = this.getCommandKey(command, cwd);
      this.history.delete(key);
    } else {
      this.history.clear();
    }
  }

  /**
   * Get all tracked commands
   */
  public getAllTrackedCommands(): string[] {
    return Array.from(this.history.keys());
  }
}

// Global instance
export const commandTracker = new CommandExecutionTracker();
