/**
 * PerformanceProfiler
 *
 * Detects slow functions and suggests optimizations.
 * Requirements: 33.1, 33.2, 33.3, 33.4, 33.5, 33.6, 33.7
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';

export interface PerformanceIssue {
  file: string;
  line: number;
  functionName: string;
  severity: 'high' | 'medium' | 'low';
  category: 'slow-function' | 'n-plus-1' | 'memory-leak' | 're-render';
  message: string;
  suggestion: string;
}

export interface PerformanceReport {
  issues: PerformanceIssue[];
  summary: string;
}

export class PerformanceProfiler {
  constructor(private readonly logger: Logger) {}

  public async profile(workspaceRoot: string): Promise<PerformanceReport> {
    const issues = await this.analyzeCodebase(workspaceRoot);
    return {
      issues,
      summary: `Performance profile: ${issues.length} issue(s) detected`,
    };
  }

  private async analyzeCodebase(workspaceRoot: string): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];
    const files = vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}', '**/node_modules/**');
    for (const file of await files) {
      const content = (await vscode.workspace.fs.readFile(file)).toString();
      const relative = vscode.workspace.asRelativePath(file);
      issues.push(...this.scanFile(relative, content));
    }
    return issues;
  }

  private scanFile(file: string, content: string): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      if (line.includes('for (') && line.includes('.map(')) {
        issues.push({
          file,
          line: lineNum,
          functionName: 'unknown',
          severity: 'medium',
          category: 'slow-function',
          message: 'Nested loop detected',
          suggestion: 'Consider using a Map or Set for O(1) lookups',
        });
      }

      if (line.includes('useEffect(') && !line.includes('[]')) {
        issues.push({
          file,
          line: lineNum,
          functionName: 'useEffect',
          severity: 'medium',
          category: 're-render',
          message: 'useEffect without dependency array may cause unnecessary re-renders',
          suggestion: 'Add dependency array to useEffect',
        });
      }
    }

    return issues;
  }
}
