import * as vscode from 'vscode';
import { Tool } from './ToolRegistry';

/**
 * Diagnostics Tools for ForgeAI
 *
 * Provides access to VS Code diagnostics (errors, warnings, info)
 * Implements: getErrors, getDiagnostics
 */

export interface DiagnosticInfo {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source: string;
  code?: string | number;
}

export class DiagnosticsTools {
  /**
   * Tool: Get all errors and warnings in the workspace
   */
  public getErrors(): Tool {
    return {
      name: 'forgeai_getErrors',
      description:
        'Get all errors and warnings in the workspace. Returns diagnostics grouped by severity (errors, warnings, info).',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async () => {
        return await this.getAllErrors();
      },
    };
  }

  /**
   * Tool: Get diagnostics for specific file(s)
   */
  public getDiagnostics(): Tool {
    return {
      name: 'forgeai_getDiagnostics',
      description:
        'Get diagnostics (errors, warnings, info) for one or more specific files. Useful for checking files after modifications.',
      inputSchema: {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of file paths to check for diagnostics',
          },
        },
        required: ['paths'],
      },
      execute: async (args: { paths: string[] }) => {
        return await this.getDiagnosticsForFiles(args.paths);
      },
    };
  }

  /**
   * Get all errors and warnings in the workspace
   * Returns diagnostics grouped by severity
   */
  async getAllErrors(): Promise<{
    errors: DiagnosticInfo[];
    warnings: DiagnosticInfo[];
    info: DiagnosticInfo[];
    total: number;
  }> {
    const diagnostics = vscode.languages.getDiagnostics();

    const errors: DiagnosticInfo[] = [];
    const warnings: DiagnosticInfo[] = [];
    const info: DiagnosticInfo[] = [];

    for (const [uri, fileDiagnostics] of diagnostics) {
      const file = uri.fsPath;

      for (const diagnostic of fileDiagnostics) {
        const diagnosticInfo: DiagnosticInfo = {
          file,
          line: diagnostic.range.start.line + 1, // Convert to 1-based
          column: diagnostic.range.start.character + 1, // Convert to 1-based
          message: diagnostic.message,
          severity: this.getSeverityString(diagnostic.severity),
          source: diagnostic.source || 'unknown',
          code: diagnostic.code ? String(diagnostic.code) : undefined,
        };

        switch (diagnostic.severity) {
          case vscode.DiagnosticSeverity.Error:
            errors.push(diagnosticInfo);
            break;
          case vscode.DiagnosticSeverity.Warning:
            warnings.push(diagnosticInfo);
            break;
          case vscode.DiagnosticSeverity.Information:
          case vscode.DiagnosticSeverity.Hint:
            info.push(diagnosticInfo);
            break;
        }
      }
    }

    return {
      errors,
      warnings,
      info,
      total: errors.length + warnings.length + info.length,
    };
  }

  /**
   * Get diagnostics for a specific file
   * Returns all diagnostics (errors, warnings, info) for the file
   */
  async getDiagnosticsForFile(filePath: string): Promise<{
    file: string;
    diagnostics: DiagnosticInfo[];
    errorCount: number;
    warningCount: number;
  }> {
    // Resolve file path to URI
    let uri: vscode.Uri;

    try {
      // Try as absolute path first
      uri = vscode.Uri.file(filePath);
    } catch {
      // Try as workspace-relative path
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      uri = vscode.Uri.file(`${workspaceRoot}/${filePath}`);
    }

    // Get diagnostics for this file
    const fileDiagnostics = vscode.languages.getDiagnostics(uri);

    const diagnostics: DiagnosticInfo[] = [];
    let errorCount = 0;
    let warningCount = 0;

    for (const diagnostic of fileDiagnostics) {
      const diagnosticInfo: DiagnosticInfo = {
        file: uri.fsPath,
        line: diagnostic.range.start.line + 1, // Convert to 1-based
        column: diagnostic.range.start.character + 1, // Convert to 1-based
        message: diagnostic.message,
        severity: this.getSeverityString(diagnostic.severity),
        source: diagnostic.source || 'unknown',
        code: diagnostic.code ? String(diagnostic.code) : undefined,
      };

      diagnostics.push(diagnosticInfo);

      if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
        errorCount++;
      } else if (diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
        warningCount++;
      }
    }

    return {
      file: uri.fsPath,
      diagnostics,
      errorCount,
      warningCount,
    };
  }

  /**
   * Get diagnostics for multiple files
   * Useful for checking specific files after modifications
   */
  async getDiagnosticsForFiles(filePaths: string[]): Promise<
    Array<{
      file: string;
      diagnostics: DiagnosticInfo[];
      errorCount: number;
      warningCount: number;
    }>
  > {
    const results = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.getDiagnosticsForFile(filePath);
        results.push(result);
      } catch (error: any) {
        // If file doesn't exist or can't be accessed, skip it
        console.warn(`Could not get diagnostics for ${filePath}:`, error.message);
      }
    }

    return results;
  }

  /**
   * Get diagnostics summary for the workspace
   * Returns counts by severity
   */
  async getSummary(): Promise<{
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    filesWithErrors: number;
    filesWithWarnings: number;
  }> {
    const diagnostics = vscode.languages.getDiagnostics();

    let totalErrors = 0;
    let totalWarnings = 0;
    let totalInfo = 0;
    const filesWithErrors = new Set<string>();
    const filesWithWarnings = new Set<string>();

    for (const [uri, fileDiagnostics] of diagnostics) {
      let hasError = false;
      let hasWarning = false;

      for (const diagnostic of fileDiagnostics) {
        switch (diagnostic.severity) {
          case vscode.DiagnosticSeverity.Error:
            totalErrors++;
            hasError = true;
            break;
          case vscode.DiagnosticSeverity.Warning:
            totalWarnings++;
            hasWarning = true;
            break;
          case vscode.DiagnosticSeverity.Information:
          case vscode.DiagnosticSeverity.Hint:
            totalInfo++;
            break;
        }
      }

      if (hasError) {
        filesWithErrors.add(uri.fsPath);
      }
      if (hasWarning) {
        filesWithWarnings.add(uri.fsPath);
      }
    }

    return {
      totalErrors,
      totalWarnings,
      totalInfo,
      filesWithErrors: filesWithErrors.size,
      filesWithWarnings: filesWithWarnings.size,
    };
  }

  /**
   * Convert VS Code diagnostic severity to string
   */
  private getSeverityString(
    severity: vscode.DiagnosticSeverity
  ): 'error' | 'warning' | 'info' | 'hint' {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return 'error';
      case vscode.DiagnosticSeverity.Warning:
        return 'warning';
      case vscode.DiagnosticSeverity.Information:
        return 'info';
      case vscode.DiagnosticSeverity.Hint:
        return 'hint';
      default:
        return 'info';
    }
  }

  /**
   * Filter diagnostics by severity
   */
  filterBySeverity(
    diagnostics: DiagnosticInfo[],
    severity: 'error' | 'warning' | 'info' | 'hint'
  ): DiagnosticInfo[] {
    return diagnostics.filter((d) => d.severity === severity);
  }

  /**
   * Filter diagnostics by source (e.g., 'typescript', 'eslint')
   */
  filterBySource(diagnostics: DiagnosticInfo[], source: string): DiagnosticInfo[] {
    return diagnostics.filter((d) => d.source === source);
  }

  /**
   * Group diagnostics by file
   */
  groupByFile(diagnostics: DiagnosticInfo[]): Map<string, DiagnosticInfo[]> {
    const grouped = new Map<string, DiagnosticInfo[]>();

    for (const diagnostic of diagnostics) {
      const existing = grouped.get(diagnostic.file) || [];
      existing.push(diagnostic);
      grouped.set(diagnostic.file, existing);
    }

    return grouped;
  }
}
