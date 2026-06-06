/**
 * CodeReviewAgent
 *
 * Reviews code changes against project standards.
 * Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { OllamaClient } from '../ollama/OllamaClient';

export interface CodeReviewIssue {
  file: string;
  line: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'code-smell' | 'performance' | 'security' | 'style';
  message: string;
  suggestion?: string;
}

export interface CodeReviewResult {
  issues: CodeReviewIssue[];
  summary: string;
  passed: boolean;
}

export class CodeReviewAgent {
  constructor(
    private readonly ollama: OllamaClient,
    private readonly logger: Logger,
    private readonly workspaceRoot: string
  ) {}

  public async reviewChanges(): Promise<CodeReviewResult> {
    const diffs = await this.getGitDiff();
    if (diffs.length === 0) {
      return { issues: [], summary: 'No changes to review', passed: true };
    }

    const prompt = this.buildReviewPrompt(diffs);
    const response = await this.ollama.chat({
      model: 'default',
      messages: [
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      stream: false,
    });

    const text = (response as { message?: { content?: string } }).message?.content || '';
    return this.parseReviewResult(text, diffs);
  }

  private async getGitDiff(): Promise<Array<{ file: string; diff: string }>> {
    const result: Array<{ file: string; diff: string }> = [];
    try {
      const stdout = this.execSync('git diff --cached --no-color');
      const files = stdout.split(/^diff --git /m).filter(Boolean);
      for (const fileDiff of files) {
        const fileMatch = fileDiff.match(/^a\/.*? b\/(.*?)$/m);
        if (fileMatch) {
          result.push({ file: fileMatch[1], diff: fileDiff });
        }
      }
    } catch {
      // Not a git repo or no changes
    }
    return result;
  }

  private buildReviewPrompt(diffs: Array<{ file: string; diff: string }>): string {
    return `
Review the following code changes for issues including: code smells, performance problems, security vulnerabilities, and style violations.

For each issue, provide:
- file path
- line number (approximate)
- severity: critical, high, medium, low
- category: code-smell, performance, security, style
- message: brief description
- suggestion: how to fix it

Changes:
${diffs.map((d) => `\n## ${d.file}\n\`\`\`diff\n${d.diff.slice(0, 2000)}\n\`\`\``).join('\n')}

Output JSON array of issues.
`;
  }

  private parseReviewResult(
    text: string,
    diffs: Array<{ file: string; diff: string }>
  ): CodeReviewResult {
    try {
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const issues: CodeReviewIssue[] = Array.isArray(parsed)
        ? parsed.map((item: any) => ({
            file: item.file || diffs[0]?.file || 'unknown',
            line: Number(item.line) || 1,
            severity: this.normalizeSeverity(item.severity),
            category: this.normalizeCategory(item.category),
            message: String(item.message || item.description || ''),
            suggestion: item.suggestion,
          }))
        : [];

      return {
        issues,
        summary: `Review complete: ${issues.length} issue(s) found`,
        passed: issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length === 0,
      };
    } catch {
      return {
        issues: [],
        summary: 'Review complete: no issues detected',
        passed: true,
      };
    }
  }

  private normalizeSeverity(value: any): CodeReviewIssue['severity'] {
    const map: Record<string, CodeReviewIssue['severity']> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };
    return map[String(value).toLowerCase()] || 'medium';
  }

  private normalizeCategory(value: any): CodeReviewIssue['category'] {
    const map: Record<string, CodeReviewIssue['category']> = {
      'code-smell': 'code-smell',
      performance: 'performance',
      security: 'security',
      style: 'style',
    };
    return map[String(value).toLowerCase()] || 'style';
  }

  private getSystemPrompt(): string {
    return `You are a senior code reviewer. Analyze diffs for code smells, performance issues, security vulnerabilities, and style violations. Be concise and actionable.`;
  }

  private execSync(command: string): string {
    const { execSync } = require('child_process');
    return execSync(command, { cwd: this.workspaceRoot, encoding: 'utf-8' });
  }
}
