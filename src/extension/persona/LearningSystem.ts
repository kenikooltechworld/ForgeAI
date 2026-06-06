/**
 * LearningSystem
 *
 * Captures user corrections and adjusts future code generation.
 * Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger';

export interface LearnedPattern {
  id: string;
  description: string;
  context: string;
  frequency: number;
  createdAt: number;
}

export class LearningSystem {
  private readonly patternsPath: string;
  private patterns: LearnedPattern[] = [];

  constructor(private readonly workspaceRoot: string, private readonly logger: Logger) {
    this.patternsPath = path.join(workspaceRoot, '.forgeai', 'memory', 'learned-patterns.json');
    this.load();
  }

  public async recordCorrection(before: string, after: string, context: string): Promise<void> {
    const pattern: LearnedPattern = {
      id: this.generateId(),
      description: `Correction: ${before.slice(0, 100)} → ${after.slice(0, 100)}`,
      context,
      frequency: 1,
      createdAt: Date.now(),
    };
    this.patterns.push(pattern);
    await this.persist();
  }

  public getPatterns(): LearnedPattern[] {
    return [...this.patterns];
  }

  public async deletePattern(id: string): Promise<boolean> {
    const index = this.patterns.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.patterns.splice(index, 1);
    await this.persist();
    return true;
  }

  public getTopPatterns(limit = 10): LearnedPattern[] {
    return this.patterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  public buildContextInjection(): string | null {
    const top = this.getTopPatterns(5);
    if (top.length === 0) return null;
    return `
## Learned Patterns (apply these unless User explicitly overrides)
${top.map((p) => `- [${p.frequency}x] ${p.description}`).join('\n')}
`;
  }

  private load(): void {
    try {
      if (fs.existsSync(this.patternsPath)) {
        const data = JSON.parse(fs.readFileSync(this.patternsPath, 'utf-8'));
        if (Array.isArray(data)) {
          this.patterns.push(...data);
        }
      }
    } catch {
      this.patterns = [];
    }
  }

  private async persist(): Promise<void> {
    try {
      const dir = path.dirname(this.patternsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.patternsPath, JSON.stringify(this.patterns, null, 2));
    } catch {
      // ignore
    }
  }

  private generateId(): string {
    return `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
