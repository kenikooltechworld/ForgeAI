/**
 * ContextManager
 *
 * Manages context window to prevent overflow:
 * 1. Sliding window - keeps only last N messages
 * 2. Result caching - stores agent results in files, not in context
 * 3. Smart compression - summarizes old messages
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
  private readonly maxContextMessages = 10; // Keep only last 10 messages
  private readonly maxMessageSize = 4000; // Max chars per message

  constructor(workspaceRoot: string) {
    this.cacheDir = path.join(workspaceRoot, '.forgeai', 'agent-cache');
    this.ensureCacheDir();
  }

  /**
   * Apply sliding window to messages
   * Keep only last N messages to prevent context overflow
   */
  public applySlidingWindow(messages: OllamaMessage[]): OllamaMessage[] {
    if (messages.length <= this.maxContextMessages) {
      return messages;
    }

    // Keep system message + last N messages
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

      // Get most recent
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
   * Instead of passing full result, pass reference to cached file
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
