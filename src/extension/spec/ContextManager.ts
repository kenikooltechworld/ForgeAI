/**
 * ContextManager
 *
 * Manages context window to prevent overflow:
 * 1. Sliding window - keeps only last N messages
 * 2. Result caching - stores agent results in files, not in context
 * 3. Smart compression - summarizes old messages
 * 4. File indexing with .gitignore exclusion for context-aware file ranking
 */

import * as fs from 'fs';
import * as path from 'path';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  thinking?: string;
  tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
  name?: string;
}

export interface CachedAgentResult {
  agentName: string;
  taskId: string;
  timestamp: number;
  result: Record<string, unknown>;
  filePath: string;
}

export class ContextManager {
  private readonly cacheDir: string;
  private readonly indexPath: string;
  private readonly maxContextMessages = 10;
  private readonly maxMessageSize = 4000;
  private fileIndex: Map<string, { mtimeMs: number; tokens: number; content: string }> = new Map();
  private gitignorePatterns: string[] = [];
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.cacheDir = path.join(workspaceRoot, '.forgeai', 'agent-cache');
    this.indexPath = path.join(this.cacheDir, 'file-index.json');
    this.ensureCacheDir();
    this.loadGitignore(workspaceRoot);
    void this.loadIndex();
  }

  private loadGitignore(workspaceRoot: string): void {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    if (!fs.existsSync(gitignorePath)) return;
    try {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      this.gitignorePatterns = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
    } catch {
      this.gitignorePatterns = [];
    }
  }

  private isIgnored(filePath: string): boolean {
    const relative = path.relative(this.workspaceRoot, filePath);
    return this.gitignorePatterns.some((pattern) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\//g, '[/\\\\]') + '$');
      return regex.test(relative);
    });
  }

  private loadIndex(): void {
    try {
      if (fs.existsSync(this.indexPath)) {
        const raw = fs.readFileSync(this.indexPath, 'utf-8');
        const entries = JSON.parse(raw) as Array<{ path: string; mtimeMs: number; tokens: number; content: string }>;
        this.fileIndex = new Map(entries.map((entry) => [entry.path, entry]));
      }
    } catch {
      this.fileIndex = new Map();
    }
  }

  private persistIndex(): void {
    try {
      const entries = Array.from(this.fileIndex.entries()).map(([key, value]) => ({
        path: key,
        mtimeMs: value.mtimeMs,
        tokens: value.tokens,
        content: value.content,
      }));
      fs.writeFileSync(this.indexPath, JSON.stringify(entries, null, 2));
    } catch {
      // ignore
    }
  }

  private estimateTokens(content: string): number {
    return Math.max(1, Math.ceil(content.length / 4));
  }

  public getRelevantFiles(query: string, limit = 20): string[] {
    const keywords = query.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
    const scored: Array<{ path: string; score: number }> = [];

    for (const [relativePath, entry] of this.fileIndex.entries()) {
      const content = entry.content.toLowerCase();
      let score = 0;
      for (const word of keywords) {
        const matches = (content.match(new RegExp(this.escapeRegex(word), 'g')) || []).length;
        score += matches;
      }
      scored.push({ path: relativePath, score });
    }

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.path);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Apply sliding window to messages
   * Keep only last N messages to prevent context overflow
   */
  public applySlidingWindow(messages: OllamaMessage[]): OllamaMessage[] {
    if (messages.length <= this.maxContextMessages) {
      return messages;
    }

    const systemMessages = messages.filter((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    const kept = otherMessages.slice(-this.maxContextMessages);
    return [...systemMessages, ...kept];
  }

  /**
   * Compress message by truncating if too large
   */
  public compressMessage(message: OllamaMessage): OllamaMessage {
    if (!message.content || message.content.length <= this.maxMessageSize) {
      return message;
    }

    return {
      ...message,
      content: message.content.slice(0, this.maxMessageSize) + '\n... [truncated]',
    };
  }

  /**
   * Cache agent result to file instead of keeping in context
   */
  public cacheAgentResult(
    agentName: string,
    taskId: string,
    result: Record<string, unknown>
  ): CachedAgentResult {
    const timestamp = Date.now();
    const fileName = `${taskId}-${agentName}-${timestamp}.json`;
    const filePath = path.join(this.cacheDir, fileName);

    const cached: CachedAgentResult = {
      agentName,
      taskId,
      timestamp,
      result,
      filePath,
    };

    try {
      fs.writeFileSync(filePath, JSON.stringify(cached, null, 2));
    } catch {
      // Silently fail - cache is optional
    }

    return cached;
  }

  /**
   * Retrieve cached agent result
   */
  public getCachedResult(taskId: string, agentName: string): Record<string, unknown> | null {
    try {
      const files = fs.readdirSync(this.cacheDir);
      const pattern = `${taskId}-${agentName}-`;
      const matchingFiles = files.filter((f) => f.startsWith(pattern));

      if (matchingFiles.length === 0) {
        return null;
      }

      const latest = matchingFiles.sort().pop();
      if (!latest) return null;

      const filePath = path.join(this.cacheDir, latest);
      const content = fs.readFileSync(filePath, 'utf-8');
      const cached = JSON.parse(content) as CachedAgentResult;
      return cached.result;
    } catch {
      return null;
    }
  }

  /**
   * Create summary of agent result for context
   */
  public summarizeResult(cached: CachedAgentResult): string {
    return `[Agent Result Cached] ${cached.agentName} completed at ${new Date(cached.timestamp).toISOString()}. Result stored in: ${cached.filePath}. Summary: ${JSON.stringify(cached.result).slice(0, 200)}...`;
  }

  /**
   * Clean old cache files (older than 1 hour)
   */
  public cleanOldCache(): void {
    try {
      const files = fs.readdirSync(this.cacheDir);
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stat = fs.statSync(filePath);

        if (stat.mtimeMs < oneHourAgo) {
          fs.unlinkSync(filePath);
        }
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Ensure cache directory exists
   */
  private ensureCacheDir(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch {
      // Silently fail
    }
  }
}
