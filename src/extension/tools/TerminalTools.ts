import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from './ToolRegistry';

const execAsync = promisify(exec);

/**
 * Terminal Tools - Provides command execution and terminal management
 *
 * Design: Follows design.md Section 5 - Terminal Tools
 * Requirements: 5.3, 5.7, 5.8
 *
 * Uses child_process.exec for command execution (not VS Code terminal for programmatic execution)
 * Uses vscode.window.createTerminal for interactive terminal creation
 */
export class TerminalTools {
  // Store active terminals by name for reuse
  private static terminals: Map<string, vscode.Terminal> = new Map();
  private static defaultTerminalName = 'ForgeAI';

  /**
   * Get or create a terminal with the given name
   * Reuses existing terminal if it's still active
   */
  private static getOrCreateTerminal(name: string, cwd?: string): vscode.Terminal {
    // Check if terminal exists and is still active
    const existingTerminal = this.terminals.get(name);
    if (existingTerminal) {
      // Verify terminal is still in the active terminals list
      const isActive = vscode.window.terminals.includes(existingTerminal);
      if (isActive) {
        // Reuse existing terminal
        return existingTerminal;
      } else {
        // Terminal was closed, remove from map
        this.terminals.delete(name);
      }
    }

    // Create new terminal
    const terminal = vscode.window.createTerminal({
      name,
      cwd: cwd ? vscode.Uri.file(cwd) : undefined,
    });

    // Store for reuse
    this.terminals.set(name, terminal);

    // Listen for terminal disposal to clean up map
    vscode.window.onDidCloseTerminal((closedTerminal) => {
      if (closedTerminal === terminal) {
        this.terminals.delete(name);
      }
    });

    return terminal;
  }

  /**
   * Check if a command is already running in a terminal
   * This is a simple heuristic - we can't directly check process state
   */
  private static isLongRunningCommand(command: string): boolean {
    const longRunningPatterns = [
      /npm\s+(run\s+)?dev/,
      /npm\s+(run\s+)?start/,
      /yarn\s+dev/,
      /yarn\s+start/,
      /ng\s+serve/,
      /vite(\s+dev)?$/,
      /webpack\s+serve/,
      /next\s+dev/,
      /gatsby\s+develop/,
      /--watch/,
    ];

    return longRunningPatterns.some((pattern) => pattern.test(command));
  }
  /**
   * Run shell command
   * Requirement 5.3, 5.7
   *
   * Executes a shell command using child_process.exec and returns stdout, stderr, and exitCode.
   * This is for programmatic command execution where the AI needs the output.
   *
   * REUSES existing terminal if available to avoid terminal clutter.
   */
  runCommand(): Tool {
    return {
      name: 'forgeai_runCommand',
      description:
        'Execute a shell command and WAIT for it to complete. Returns stdout, stderr, and exit code after the command finishes. Reuses existing ForgeAI terminal to avoid clutter. Default timeout is 5 minutes. Use this for commands that need to complete before proceeding (npm install, npm test, npm run build, etc.).',
      inputSchema: {
        type: 'object',
        required: ['command'],
        properties: {
          command: {
            type: 'string',
            description: 'Shell command to execute (e.g., "npm test", "git status", "npm install")',
          },
          cwd: {
            type: 'string',
            description:
              'Working directory for command execution (optional, defaults to workspace root)',
          },
          timeout: {
            type: 'number',
            description:
              'Timeout in milliseconds (optional, defaults to 300000ms = 5 minutes). Increase for very long-running commands.',
          },
        },
      },
      execute: async (
        args: { command: string; cwd?: string; timeout?: number },
        token?: vscode.CancellationToken
      ) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        try {
          // Get workspace root as default cwd
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
          const cwd = args.cwd || workspaceRoot;
          // Increase default timeout to 5 minutes for long-running commands like npm install
          const timeout = args.timeout || 300000; // 5 minutes default

          // Get or create terminal (reuses existing one)
          const terminal = TerminalTools.getOrCreateTerminal(
            TerminalTools.defaultTerminalName,
            cwd
          );

          // Show terminal
          terminal.show(true); // preserveFocus = true, so it doesn't steal focus

          // Send command to terminal for visibility
          terminal.sendText(args.command);

          // Log start time for duration tracking
          const startTime = Date.now();

          // Execute command programmatically to get output for AI
          // This WAITS for the command to complete before returning
          const { stdout, stderr } = await execAsync(args.command, {
            cwd,
            timeout,
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          });

          // Calculate duration
          const duration = Date.now() - startTime;

          // Check cancellation after execution
          if (token?.isCancellationRequested) {
            throw new Error('Operation cancelled');
          }

          return {
            command: args.command,
            cwd,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: 0,
            success: true,
            terminalName: TerminalTools.defaultTerminalName,
            terminalReused: true,
            duration: `${(duration / 1000).toFixed(2)}s`,
            message: `Command completed successfully in ${(duration / 1000).toFixed(2)}s (terminal reused)`,
          };
        } catch (error: any) {
          // Check if it's a cancellation
          if (token?.isCancellationRequested) {
            throw new Error('Operation cancelled');
          }

          // Handle execution errors
          const exitCode = error.code || 1;
          const stdout = error.stdout?.trim() || '';
          const stderr = error.stderr?.trim() || error.message || 'Command execution failed';

          // Check if it's a timeout error
          const isTimeout = error.killed && error.signal === 'SIGTERM';

          return {
            command: args.command,
            cwd: args.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
            stdout,
            stderr: isTimeout
              ? `Command timed out after ${(args.timeout || 300000) / 1000}s. Consider increasing timeout or running as background process.`
              : stderr,
            exitCode,
            success: false,
            terminalName: TerminalTools.defaultTerminalName,
            terminalReused: true,
            error: isTimeout ? 'TIMEOUT' : 'EXECUTION_ERROR',
          };
        }
      },
    };
  }

  /**
   * Create VS Code terminal
   * Requirement 5.8
   *
   * Creates an interactive VS Code terminal that the user can see and interact with.
   * This is for commands that need user interaction or long-running processes.
   * Reuses existing terminal with the same name if available.
   *
   * For long-running commands, waits briefly (5 seconds) to check for startup errors.
   */
  createTerminal(): Tool {
    return {
      name: 'forgeai_createTerminal',
      description:
        'Create or reuse a VS Code terminal for interactive command execution. Use this for long-running processes (dev servers, watch modes) or commands that need user interaction. If a terminal with the same name exists, it will be reused. Waits 5 seconds after starting to check for immediate errors.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Terminal name (optional, defaults to "ForgeAI Terminal")',
          },
          cwd: {
            type: 'string',
            description: 'Working directory (optional, defaults to workspace root)',
          },
          command: {
            type: 'string',
            description: 'Command to execute in the terminal (optional)',
          },
          waitForStartup: {
            type: 'boolean',
            description:
              'Wait 5 seconds to check for startup errors (optional, defaults to true for commands)',
          },
        },
      },
      execute: async (
        args: { name?: string; cwd?: string; command?: string; waitForStartup?: boolean },
        token?: vscode.CancellationToken
      ) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        try {
          // Get workspace root as default cwd
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          const cwd = args.cwd || workspaceRoot;
          const terminalName = args.name || 'ForgeAI Terminal';
          const shouldWait = args.waitForStartup !== false && !!args.command;

          // Get or create terminal (reuses existing one with same name)
          const terminal = TerminalTools.getOrCreateTerminal(terminalName, cwd);
          const wasReused = vscode.window.terminals.includes(terminal);

          // Show terminal
          terminal.show();

          // Execute command if provided
          if (args.command) {
            terminal.sendText(args.command);

            // If we should wait for startup, also run the command programmatically to check for errors
            if (shouldWait) {
              try {
                // Wait 5 seconds to see if command starts successfully
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // Try to execute the command programmatically to check for immediate errors
                // This will catch errors like "command not found", "module not found", etc.
                const checkResult = await execAsync(args.command, {
                  cwd: cwd || workspaceRoot,
                  timeout: 5000, // 5 second timeout for startup check
                  maxBuffer: 1024 * 1024, // 1MB buffer
                });

                // If we get here without error, command started successfully
                // (or it's a long-running command that's still running)
                return {
                  name: terminalName,
                  cwd: cwd || 'workspace root',
                  command: args.command,
                  reused: wasReused,
                  startupCheck: 'success',
                  message: wasReused
                    ? `Terminal '${terminalName}' reused. Command started successfully.`
                    : `Terminal '${terminalName}' created. Command started successfully.`,
                  success: true,
                };
              } catch (startupError: any) {
                // Check if it's a timeout (expected for long-running commands)
                const isTimeout = startupError.killed && startupError.signal === 'SIGTERM';

                if (isTimeout) {
                  // Timeout is expected for long-running commands - this is success
                  return {
                    name: terminalName,
                    cwd: cwd || 'workspace root',
                    command: args.command,
                    reused: wasReused,
                    startupCheck: 'running',
                    message: wasReused
                      ? `Terminal '${terminalName}' reused. Command is running (long-running process detected).`
                      : `Terminal '${terminalName}' created. Command is running (long-running process detected).`,
                    success: true,
                  };
                } else {
                  // Real error - command failed to start
                  const errorMessage =
                    startupError.stderr?.trim() ||
                    startupError.message ||
                    'Command failed to start';
                  return {
                    name: terminalName,
                    cwd: cwd || 'workspace root',
                    command: args.command,
                    reused: wasReused,
                    startupCheck: 'error',
                    error: errorMessage,
                    stdout: startupError.stdout?.trim() || '',
                    stderr: startupError.stderr?.trim() || '',
                    exitCode: startupError.code || 1,
                    message: `Terminal '${terminalName}' created but command failed: ${errorMessage}`,
                    success: false,
                  };
                }
              }
            }
          }

          // Check cancellation after creation
          if (token?.isCancellationRequested) {
            throw new Error('Operation cancelled');
          }

          return {
            name: terminalName,
            cwd: cwd || 'workspace root',
            command: args.command,
            reused: wasReused,
            message: wasReused
              ? `Terminal '${terminalName}' reused. Command sent to existing terminal.`
              : `Terminal '${terminalName}' created successfully. The terminal is now visible in VS Code.`,
            success: true,
          };
        } catch (error: any) {
          // Check if it's a cancellation
          if (token?.isCancellationRequested) {
            throw new Error('Operation cancelled');
          }

          throw new Error(`Failed to create terminal: ${error.message}`);
        }
      },
    };
  }
}
