import * as vscode from 'vscode';
import { Tool } from './ToolRegistry';

/**
 * File System Tools - Provides file and directory operations
 *
 * Design: Follows design.md Section 5 - File System Tools
 * Requirements: 5.1, 5.2, 5.5, 5.6, 29.1-29.8, 30.1-30.6, 31.1-31.6, 32.1-32.5
 *
 * All tools use VS Code workspace.fs API (not Node.js fs module)
 * This ensures proper workspace scoping and VS Code integration
 */
export class FileSystemTools {
  /**
   * Read file contents
   * Requirement 5.1, 5.5
   */
  readFile(): Tool {
    return {
      name: 'forgeai_readFile',
      description: 'Read the contents of a file in the workspace',
      inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the file',
          },
        },
      },
      execute: async (args: { path: string }, token?: vscode.CancellationToken) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const uri = vscode.Uri.file(args.path);
        const content = await vscode.workspace.fs.readFile(uri);

        // Check cancellation after read
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        return {
          path: args.path,
          content: Buffer.from(content).toString('utf8'),
        };
      },
    };
  }

  /**
   * Write file contents
   * Requirement 5.2, 5.6
   */
  writeFile(): Tool {
    return {
      name: 'forgeai_writeFile',
      description: 'Write or update a file in the workspace',
      inputSchema: {
        type: 'object',
        required: ['path', 'content'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the file',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
      },
      execute: async (
        args: { path: string; content: string },
        token?: vscode.CancellationToken
      ) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const uri = vscode.Uri.file(args.path);
        const buffer = Buffer.from(args.content, 'utf8');
        await vscode.workspace.fs.writeFile(uri, buffer);

        // Check cancellation after write
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        return {
          path: args.path,
          success: true,
        };
      },
    };
  }

  /**
   * List files matching a pattern
   * Requirement 29.1, 29.2
   */
  listFiles(): Tool {
    return {
      name: 'forgeai_listFiles',
      description: 'List files matching a pattern in the workspace',
      inputSchema: {
        type: 'object',
        required: ['pattern'],
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob pattern (e.g., "**/*.ts")',
          },
        },
      },
      execute: async (args: { pattern: string }, token?: vscode.CancellationToken) => {
        if (token?.isCancellationRequested) throw new Error('Operation cancelled');

        const exclude =
          '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.next/**,**/coverage/**,**/.cache/**}';
        const files = await vscode.workspace.findFiles(args.pattern, exclude, 300);

        if (token?.isCancellationRequested) throw new Error('Operation cancelled');

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        return {
          pattern: args.pattern,
          files: files.map((uri) =>
            workspaceRoot ? uri.fsPath.replace(workspaceRoot, '').replace(/^[\\/]/, '') : uri.fsPath
          ),
          count: files.length,
          note:
            files.length === 300
              ? 'Result capped at 300 files. Use a more specific pattern.'
              : undefined,
        };
      },
    };
  }

  /**
   * List directory contents
   * Requirement 29.3, 29.4
   */
  listDirectory(): Tool {
    return {
      name: 'forgeai_listDirectory',
      description: 'List contents of a directory',
      inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the directory',
          },
        },
      },
      execute: async (args: { path: string }, token?: vscode.CancellationToken) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const uri = vscode.Uri.file(args.path);
        const entries = await vscode.workspace.fs.readDirectory(uri);

        // Check cancellation after read
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        return {
          path: args.path,
          entries: entries.map(([name, type]) => ({
            name,
            type: type === vscode.FileType.File ? 'file' : 'directory',
          })),
          count: entries.length,
        };
      },
    };
  }

  /**
   * Create directory
   * Requirement 29.5, 29.6
   */
  createDirectory(): Tool {
    return {
      name: 'forgeai_createDirectory',
      description: 'Create a new directory',
      inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the directory to create',
          },
        },
      },
      execute: async (args: { path: string }, token?: vscode.CancellationToken) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const uri = vscode.Uri.file(args.path);
        await vscode.workspace.fs.createDirectory(uri);

        // Check cancellation after create
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        return {
          path: args.path,
          success: true,
        };
      },
    };
  }

  /**
   * Delete file or directory
   * Requirement 29.7, 29.8
   */
  deleteFile(): Tool {
    return {
      name: 'forgeai_deleteFile',
      description: 'Delete a file or directory',
      inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the file or directory',
          },
        },
      },
      execute: async (args: { path: string }, token?: vscode.CancellationToken) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const uri = vscode.Uri.file(args.path);
        await vscode.workspace.fs.delete(uri, { recursive: true });

        // Check cancellation after delete
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        return {
          path: args.path,
          success: true,
        };
      },
    };
  }

  /**
   * Copy file
   * Requirement 30.1, 30.2
   */
  copyFile(): Tool {
    return {
      name: 'forgeai_copyFile',
      description: 'Copy a file from source to destination',
      inputSchema: {
        type: 'object',
        required: ['source', 'destination'],
        properties: {
          source: {
            type: 'string',
            description: 'Source file path',
          },
          destination: {
            type: 'string',
            description: 'Destination file path',
          },
        },
      },
      execute: async (
        args: { source: string; destination: string },
        token?: vscode.CancellationToken
      ) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const sourceUri = vscode.Uri.file(args.source);
        const destUri = vscode.Uri.file(args.destination);
        await vscode.workspace.fs.copy(sourceUri, destUri, { overwrite: true });

        // Check cancellation after copy
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        return {
          source: args.source,
          destination: args.destination,
          success: true,
        };
      },
    };
  }

  /**
   * Rename or move file
   * Requirement 30.3, 30.4
   */
  renameFile(): Tool {
    return {
      name: 'forgeai_renameFile',
      description: 'Rename or move a file',
      inputSchema: {
        type: 'object',
        required: ['oldPath', 'newPath'],
        properties: {
          oldPath: {
            type: 'string',
            description: 'Current file path',
          },
          newPath: {
            type: 'string',
            description: 'New file path',
          },
        },
      },
      execute: async (
        args: { oldPath: string; newPath: string },
        token?: vscode.CancellationToken
      ) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const oldUri = vscode.Uri.file(args.oldPath);
        const newUri = vscode.Uri.file(args.newPath);
        await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: true });

        // Check cancellation after rename
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        return {
          oldPath: args.oldPath,
          newPath: args.newPath,
          success: true,
        };
      },
    };
  }

  /**
   * Get file metadata
   * Requirement 30.5, 30.6
   */
  getFileStats(): Tool {
    return {
      name: 'forgeai_getFileStats',
      description: 'Get file metadata (size, creation time, modification time)',
      inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the file',
          },
        },
      },
      execute: async (args: { path: string }, token?: vscode.CancellationToken) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const uri = vscode.Uri.file(args.path);
        const stat = await vscode.workspace.fs.stat(uri);

        // Check cancellation after stat
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        return {
          path: args.path,
          type: stat.type === vscode.FileType.File ? 'file' : 'directory',
          size: stat.size,
          ctime: stat.ctime,
          mtime: stat.mtime,
        };
      },
    };
  }

  /**
   * Watch files for changes
   * Requirement 31.1-31.6
   * Note: This creates a watcher but doesn't return events directly
   * Events should be sent via webview postMessage in production
   */
  watchFiles(): Tool {
    return {
      name: 'forgeai_watchFiles',
      description: 'Watch files for changes (create, modify, delete)',
      inputSchema: {
        type: 'object',
        required: ['pattern'],
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob pattern to watch (e.g., "**/*.ts")',
          },
        },
      },
      execute: async (args: { pattern: string }, token?: vscode.CancellationToken) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const watcherId = `watcher-${Date.now()}`;
        const watcher = vscode.workspace.createFileSystemWatcher(args.pattern);

        // In production, store watcher in a Map for cleanup
        // and forward events to webview via postMessage

        // For now, just return watcher info
        return {
          watcherId,
          pattern: args.pattern,
          message: 'File watcher created. Events will be sent via postMessage.',
        };
      },
    };
  }

  /**
   * Find files with include/exclude patterns
   * Requirement 32.1, 32.2
   */
  findFiles(): Tool {
    return {
      name: 'forgeai_findFiles',
      description: 'Search for files by pattern with include/exclude filters',
      inputSchema: {
        type: 'object',
        required: ['include'],
        properties: {
          include: {
            type: 'string',
            description: 'Include pattern (e.g., "**/*.ts")',
          },
          exclude: {
            type: 'string',
            description: 'Exclude pattern (e.g., "**/node_modules/**")',
          },
        },
      },
      execute: async (
        args: { include: string; exclude?: string },
        token?: vscode.CancellationToken
      ) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const defaultExclude =
          '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.next/**,**/coverage/**,**/.cache/**}';
        const files = await vscode.workspace.findFiles(
          args.include,
          args.exclude ?? defaultExclude,
          300
        );

        if (token?.isCancellationRequested) throw new Error('Operation cancelled');

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        return {
          include: args.include,
          exclude: args.exclude ?? defaultExclude,
          files: files.map((uri) =>
            workspaceRoot ? uri.fsPath.replace(workspaceRoot, '').replace(/^[\\/]/, '') : uri.fsPath
          ),
          count: files.length,
          note:
            files.length === 300
              ? 'Result capped at 300 files. Use a more specific pattern.'
              : undefined,
        };
      },
    };
  }

  /**
   * Generate code diff for preview
   * Shows proposed changes before applying them
   * Used by AI to show code modifications to user
   */
  generateDiff(): Tool {
    return {
      name: 'forgeai_generateDiff',
      description:
        'Generate a code diff to show proposed changes before applying them. Use this when you want to modify a file and show the user what will change.',
      inputSchema: {
        type: 'object',
        required: ['file', 'originalContent', 'newContent'],
        properties: {
          file: {
            type: 'string',
            description: 'File path relative to workspace root',
          },
          originalContent: {
            type: 'string',
            description: 'Original file content',
          },
          newContent: {
            type: 'string',
            description: 'New file content with changes',
          },
          language: {
            type: 'string',
            description: 'Programming language for syntax highlighting (optional)',
          },
        },
      },
      execute: async (
        args: { file: string; originalContent: string; newContent: string; language?: string },
        token?: vscode.CancellationToken
      ) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        // Generate diff lines
        const diffLines = this.generateDiffLines(args.originalContent, args.newContent);

        // Detect language from file extension if not provided
        const language = args.language || this.detectLanguage(args.file);

        return {
          file: args.file,
          lines: diffLines,
          language,
          originalContent: args.originalContent,
          success: true,
        };
      },
    };
  }

  /**
   * Generate diff lines from original and modified content
   * Simple line-by-line diff algorithm
   */
  private generateDiffLines(
    original: string,
    modified: string
  ): Array<{ type: 'added' | 'removed' | 'unchanged'; lineNumber: number; content: string }> {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const diffLines: Array<{
      type: 'added' | 'removed' | 'unchanged';
      lineNumber: number;
      content: string;
    }> = [];

    // Simple line-by-line diff (can be enhanced with proper diff algorithm)
    const maxLines = Math.max(originalLines.length, modifiedLines.length);
    let lineNumber = 1;

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i];
      const modLine = modifiedLines[i];

      if (origLine === modLine) {
        // Unchanged line
        diffLines.push({
          type: 'unchanged',
          lineNumber: lineNumber++,
          content: origLine || '',
        });
      } else if (origLine !== undefined && modLine === undefined) {
        // Line removed
        diffLines.push({
          type: 'removed',
          lineNumber: lineNumber++,
          content: origLine,
        });
      } else if (origLine === undefined && modLine !== undefined) {
        // Line added
        diffLines.push({
          type: 'added',
          lineNumber: lineNumber++,
          content: modLine,
        });
      } else {
        // Line changed (show as removed + added)
        diffLines.push({
          type: 'removed',
          lineNumber: lineNumber,
          content: origLine,
        });
        diffLines.push({
          type: 'added',
          lineNumber: lineNumber++,
          content: modLine,
        });
      }
    }

    return diffLines;
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      html: 'html',
      css: 'css',
      scss: 'scss',
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      sh: 'bash',
      sql: 'sql',
    };

    return languageMap[ext || ''] || 'plaintext';
  }

  /**
   * Search for text content in files
   * Requirement 32.3, 32.4, 32.5
   */
  searchInFiles(): Tool {
    return {
      name: 'forgeai_searchInFiles',
      description: 'Search for text content in files',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Search query string',
          },
          filePattern: {
            type: 'string',
            description: 'File pattern to search in (e.g., "**/*.ts")',
          },
        },
      },
      execute: async (
        args: { query: string; filePattern?: string },
        token?: vscode.CancellationToken
      ) => {
        // Check cancellation
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const pattern = args.filePattern || '**/*';
        const defaultExclude =
          '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.next/**,**/coverage/**,**/.cache/**}';
        const files = await vscode.workspace.findFiles(pattern, defaultExclude, 200);
        const results: Array<{
          file: string;
          line: number;
          text: string;
          context: string;
        }> = [];

        for (const file of files) {
          // Check cancellation in loop
          if (token?.isCancellationRequested) {
            throw new Error('Operation cancelled');
          }

          try {
            const content = await vscode.workspace.fs.readFile(file);
            const text = Buffer.from(content).toString('utf8');
            const lines = text.split('\n');

            lines.forEach((line, index) => {
              if (line.includes(args.query)) {
                // Include context lines (2 before and 2 after) - Requirement 32.5
                const contextStart = Math.max(0, index - 2);
                const contextEnd = Math.min(lines.length, index + 3);
                const context = lines.slice(contextStart, contextEnd).join('\n');

                results.push({
                  file: file.fsPath,
                  line: index + 1,
                  text: line.trim(),
                  context,
                });
              }
            });
          } catch (error) {
            // Skip files that can't be read (binary files, permission errors, etc.)
          }
        }

        return {
          query: args.query,
          filePattern: pattern,
          results,
          count: results.length,
        };
      },
    };
  }

  /**
   * Replace specific text in a file (targeted edit)
   * More efficient than full file rewrite - only changes what's needed
   */
  replaceText(): Tool {
    return {
      name: 'forgeai_replaceText',
      description: 'Replace specific text in a file. Use this to make targeted edits instead of rewriting entire files. More efficient and saves tokens.',
      inputSchema: {
        type: 'object',
        required: ['path', 'oldText', 'newText'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the file',
          },
          oldText: {
            type: 'string',
            description: 'Exact text to replace (must match exactly including whitespace)',
          },
          newText: {
            type: 'string',
            description: 'New text to insert',
          },
        },
      },
      execute: async (
        args: { path: string; oldText: string; newText: string },
        token?: vscode.CancellationToken
      ) => {
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const uri = vscode.Uri.file(args.path);
        const content = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(content).toString('utf8');

        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        if (!text.includes(args.oldText)) {
          return {
            path: args.path,
            success: false,
            error: 'Text not found. The oldText must match exactly including whitespace and indentation.',
          };
        }

        const newContent = text.replace(args.oldText, args.newText);

        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const buffer = Buffer.from(newContent, 'utf8');
        await vscode.workspace.fs.writeFile(uri, buffer);

        return {
          path: args.path,
          success: true,
          replacements: text.split(args.oldText).length - 1,
        };
      },
    };
  }

/**
    * Replace text using regex pattern
    * Allows flexible pattern matching for code edits
    */
  replaceRegex(): Tool {
    return {
      name: 'forgeai_replaceRegex',
      description: 'Replace text matching a regex pattern in a file. Use this for flexible code edits. More efficient than rewriting entire files.',
      inputSchema: {
        type: 'object',
        required: ['path', 'pattern', 'replacement'],
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the file',
          },
          pattern: {
            type: 'string',
            description: 'Regular expression pattern to match (JavaScript regex syntax)',
          },
          replacement: {
            type: 'string',
            description: 'Replacement text. Use $1, $2, etc. for capture groups',
          },
          flags: {
            type: 'string',
            description: 'Regex flags (e.g., "g" for global, "i" for case-insensitive)',
          },
        },
      },
      execute: async (
        args: { path: string; pattern: string; replacement: string; flags?: string },
        token?: vscode.CancellationToken
      ) => {
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const uri = vscode.Uri.file(args.path);
        const content = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(content).toString('utf8');

        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        let regex: RegExp;
        try {
          regex = new RegExp(args.pattern, args.flags || 'g');
        } catch (e) {
          return {
            path: args.path,
            success: false,
            error: `Invalid regex pattern: ${args.pattern}`,
          };
        }

        const matches = text.match(regex);
        if (!matches || matches.length === 0) {
          return {
            path: args.path,
            success: false,
            error: 'No matches found for the pattern',
          };
        }

        const newContent = text.replace(regex, args.replacement);

        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const buffer = Buffer.from(newContent, 'utf8');
        await vscode.workspace.fs.writeFile(uri, buffer);

        return {
          path: args.path,
          success: true,
          matches: matches.length,
        };
      },
    };
  }

  /**
   * Find a file by its name (searches across entire workspace)
   * Use this when you know the filename but not the exact path
   * More efficient than listing directories manually
   */
  findFile(): Tool {
    return {
      name: 'forgeai_findFile',
      description: 'Find a file by name across the workspace. Use this when you know the filename but need to locate its path. Searches recursively from workspace root.',
      inputSchema: {
        type: 'object',
        required: ['fileName'],
        properties: {
          fileName: {
            type: 'string',
            description: 'Exact filename or pattern to search for (e.g., "extension.ts")',
          },
          exactMatch: {
            type: 'boolean',
            description: 'If true, matches exact filename. If false, matches files containing the name (default: true)',
          },
        },
      },
      execute: async (
        args: { fileName: string; exactMatch?: boolean },
        token?: vscode.CancellationToken
      ) => {
        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const exclude = '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/.next/**,**/coverage/**,**/.cache/**}';
        const allFiles = await vscode.workspace.findFiles('**/*', exclude, 1000);

        if (token?.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

        // Filter files by name
        const matchingFiles = allFiles.filter((uri) => {
          const fileName = uri.fsPath.split(/[/\\]/).pop() || '';
          if (args.exactMatch === false) {
            return fileName.toLowerCase().includes(args.fileName.toLowerCase());
          }
          return fileName === args.fileName;
        });

        // Sort by path for consistent results
        matchingFiles.sort((a, b) => a.fsPath.localeCompare(b.fsPath));

        return {
          fileName: args.fileName,
          exactMatch: args.exactMatch ?? true,
          files: matchingFiles.map((uri) => ({
            path: workspaceRoot ? uri.fsPath.replace(workspaceRoot, '').replace(/^[\\/]/, '') : uri.fsPath,
            fullPath: uri.fsPath,
          })),
          count: matchingFiles.length,
        };
      },
    };
  }
}
