import * as fs from 'fs';
import * as path from 'path';

export interface DriftItem {
  criterion: string;
  severity: 'missing' | 'partial' | 'stale';
  filesTouched: string[];
  suggestion: string;
}

export interface DriftReport {
  specId: string;
  timestamp: number;
  items: DriftItem[];
  coverage: number; // 0-100
  totalCriteria: number;
  matched: number;
}

/**
 * Detects drift between spec requirements and actual implementation.
 * Simple heuristic: acceptance criteria keywords vs. source file contents.
 */
export class DriftDetector {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Scan a spec for drift against the current codebase.
   */
  detect(specId: string, requirements: string, tasks: string): DriftReport {
    const criteria = this.extractAcceptanceCriteria(requirements);
    const srcFiles = this.findSourceFiles();
    const items: DriftItem[] = [];

    for (const criterion of criteria) {
      const keywords = this.extractKeywords(criterion);
      const matches = srcFiles.filter((f) =>
        keywords.some((kw) => f.content.toLowerCase().includes(kw.toLowerCase()))
      );

      if (matches.length === 0) {
        items.push({
          criterion,
          severity: 'missing',
          filesTouched: [],
          suggestion: `No source files found referencing this criterion. Expected implementation for: ${criterion.slice(0, 80)}...`,
        });
      } else if (matches.length === 1) {
        items.push({
          criterion,
          severity: 'partial',
          filesTouched: matches.map((m) => m.relativePath),
          suggestion: `Found in one file only. Consider if tests or docs also cover this criterion.`,
        });
      }
    }

    // Check tasks for stale references
    const taskFiles = this.extractTaskFileReferences(tasks);
    for (const tf of taskFiles) {
      const fullPath = path.join(this.workspaceRoot, tf);
      if (!fs.existsSync(fullPath)) {
        items.push({
          criterion: `Task references file: ${tf}`,
          severity: 'stale',
          filesTouched: [tf],
          suggestion: `File referenced in tasks.md does not exist. Update tasks or recreate file.`,
        });
      }
    }

    const missingCount = items.filter((i) => i.severity === 'missing').length;
    const matchedCount = criteria.length - missingCount;
    const coverage =
      criteria.length === 0 ? 100 : Math.round((matchedCount / criteria.length) * 100);

    return {
      specId,
      timestamp: Date.now(),
      items,
      coverage,
      totalCriteria: criteria.length,
      matched: matchedCount,
    };
  }

  /** Parse EARS-style acceptance criteria from requirements.md */
  private extractAcceptanceCriteria(requirements: string): string[] {
    const lines = requirements.split('\n');
    const criteria: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('- MUST') ||
        trimmed.startsWith('- SHALL') ||
        trimmed.startsWith('- SHOULD') ||
        trimmed.startsWith('- WHEN') ||
        trimmed.startsWith('- IF') ||
        trimmed.match(/^-\s*\[AC-\d+\]/)
      ) {
        criteria.push(trimmed);
      }
    }
    return criteria;
  }

  /** Extract searchable keywords from a criterion (nouns, verbs, tech terms) */
  private extractKeywords(criterion: string): string[] {
    // Remove EARS prefix and punctuation, keep technical terms
    const cleaned = criterion
      .replace(/^-\s*(MUST|SHALL|SHOULD|WHEN|IF)\s+/, '')
      .replace(/\[.*?\]/g, '')
      .replace(/[.,;:?!]/g, '');
    const words = cleaned
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 3 &&
          !['shall', 'must', 'should', 'when', 'then', 'the', 'and', 'with'].includes(
            w.toLowerCase()
          )
      );
    // Deduplicate and return top 5 most meaningful
    return [...new Set(words)].slice(0, 5);
  }

  /** Find all source files in workspace (excluding node_modules, .git, etc.) */
  private findSourceFiles(): Array<{ relativePath: string; content: string }> {
    const results: Array<{ relativePath: string; content: string }> = [];
    const exclude = ['node_modules', '.git', '.forgeai', 'dist', 'build', 'out'];

    const walk = (dir: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (exclude.includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(this.workspaceRoot, full);
        if (entry.isDirectory()) {
          walk(full);
        } else if (
          entry.name.endsWith('.ts') ||
          entry.name.endsWith('.tsx') ||
          entry.name.endsWith('.js') ||
          entry.name.endsWith('.jsx') ||
          entry.name.endsWith('.py') ||
          entry.name.endsWith('.java') ||
          entry.name.endsWith('.go') ||
          entry.name.endsWith('.rs')
        ) {
          try {
            const content = fs.readFileSync(full, 'utf-8');
            results.push({ relativePath: rel, content });
          } catch {
            // Skip unreadable files
          }
        }
      }
    };

    if (fs.existsSync(this.workspaceRoot)) {
      walk(this.workspaceRoot);
    }
    return results;
  }

  /** Extract file paths referenced in tasks.md */
  private extractTaskFileReferences(tasks: string): string[] {
    const refs: string[] = [];
    const regex = /`([^`]+\.(ts|tsx|js|jsx|py|java|go|rs))`/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(tasks)) !== null) {
      refs.push(match[1]);
    }
    return [...new Set(refs)];
  }
}
