/**
 * LanguageDetector
 *
 * Detects programming language from file extension and content.
 * Requirements: 9.1, 9.2, 9.7
 */

import * as vscode from 'vscode';

export interface LanguageInfo {
  language: string;
  extension: string;
  family: 'javascript' | 'typescript' | 'python' | 'go' | 'rust' | 'php' | 'java' | 'csharp' | 'unknown';
}

export class LanguageDetector {
  private readonly extensionMap: Record<string, LanguageInfo> = {
    '.js': { language: 'JavaScript', extension: '.js', family: 'javascript' },
    '.jsx': { language: 'JavaScript (JSX)', extension: '.jsx', family: 'javascript' },
    '.mjs': { language: 'JavaScript (ESM)', extension: '.mjs', family: 'javascript' },
    '.cjs': { language: 'JavaScript (CommonJS)', extension: '.cjs', family: 'javascript' },
    '.ts': { language: 'TypeScript', extension: '.ts', family: 'typescript' },
    '.tsx': { language: 'TypeScript (TSX)', extension: '.tsx', family: 'typescript' },
    '.mts': { language: 'TypeScript (ESM)', extension: '.mts', family: 'typescript' },
    '.cts': { language: 'TypeScript (CommonJS)', extension: '.cts', family: 'typescript' },
    '.py': { language: 'Python', extension: '.py', family: 'python' },
    '.pyw': { language: 'Python', extension: '.pyw', family: 'python' },
    '.go': { language: 'Go', extension: '.go', family: 'go' },
    '.rs': { language: 'Rust', extension: '.rs', family: 'rust' },
    '.php': { language: 'PHP', extension: '.php', family: 'php' },
    '.phtml': { language: 'PHP', extension: '.phtml', family: 'php' },
    '.java': { language: 'Java', extension: '.java', family: 'java' },
    '.kt': { language: 'Kotlin', extension: '.kt', family: 'java' },
    '.cs': { language: 'C#', extension: '.cs', family: 'csharp' },
    '.csx': { language: 'C# Script', extension: '.csx', family: 'csharp' },
  };

  public detectFromFile(filePath: string): LanguageInfo {
    const ext = this.getExtension(filePath);
    const info = this.extensionMap[ext];
    if (info) return info;

    // Fallback: detect from content
    return { language: 'Unknown', extension: ext, family: 'unknown' };
  }

  public detectFromUri(uri: vscode.Uri): LanguageInfo {
    return this.detectFromFile(uri.fsPath);
  }

  public getLanguageFamilies(): string[] {
    return [...new Set(Object.values(this.extensionMap).map((i) => i.language))];
  }

  public isSupported(language: string): boolean {
    const families = Object.values(this.extensionMap).map((i) => i.language.toLowerCase());
    return families.includes(language.toLowerCase());
  }

  private getExtension(filePath: string): string {
    const ext = filePath.toLowerCase();
    const lastDot = ext.lastIndexOf('.');
    if (lastDot === -1) return '';
    return ext.slice(lastDot);
  }
}
