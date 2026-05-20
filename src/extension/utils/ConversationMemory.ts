// ConversationMemory — Persistent per-conversation memory for the AI

export interface ToolCallRecord {
  toolName: string;
  arguments: Record<string, unknown>;
  result: string;
  timestamp: number;
}

export interface FileOperationRecord {
  path: string;
  operation: 'read' | 'write' | 'list' | 'search';
  timestamp: number;
}

export interface ResearchFindingRecord {
  topic: string;
  source: string;
  finding: string;
  toolArgs: Record<string, unknown>;
  timestamp: number;
}

export interface ConversationSnapshot {
  conversationId: string;
  createdAt: number;
  updatedAt: number;
  toolCalls: ToolCallRecord[];
  fileOperations: FileOperationRecord[];
  researchFindings: ResearchFindingRecord[];
  workspaceContextHash?: string;
  lastWorkspaceTree?: string;
  summary?: string;
}

const MEMORY_KEY_PREFIX = 'forgeai.conversationMemory.';
const WORKSPACE_CONTEXT_TTL_MS = 30_000; // 30 seconds

/**
 * ConversationMemory — Persistent per-conversation memory for the AI.
 *
 * Solves the problem where the AI forgets everything between messages
 * and redundantly lists directories or re-reads files.
 *
 * Usage:
 *   const memory = new ConversationMemory(storageManager);
 *   memory.recordToolCall(convId, { toolName: 'forgeai_readFile', arguments: { path: 'src/foo.ts' }, result: '...' });
 *   const pastReads = memory.getFileOperations(convId, 'read');
 *   const hasReadFile = memory.hasFileBeenRead(convId, 'src/foo.ts');
 */
export class ConversationMemory {
  private cache: Map<string, ConversationSnapshot> = new Map();
  private lastWorkspaceGather: number = 0;
  private cachedWorkspaceTree: string = '';

  constructor(
    private readonly storage: {
      getWorkspaceValue: <T>(key: string, defaultValue: T) => T;
      setWorkspaceValue: <T>(key: string, value: T) => Promise<void>;
    }
  ) {}

  /**
   * Load a conversation snapshot from persistent storage.
   */
  public load(conversationId: string): ConversationSnapshot {
    if (this.cache.has(conversationId)) {
      return this.cache.get(conversationId)!;
    }

    const key = MEMORY_KEY_PREFIX + conversationId;
    const stored = this.storage.getWorkspaceValue<ConversationSnapshot | null>(key, null);
    if (stored) {
      this.cache.set(conversationId, stored);
      return stored;
    }

    const fresh: ConversationSnapshot = {
      conversationId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      toolCalls: [],
      fileOperations: [],
      researchFindings: [],
    };
    this.cache.set(conversationId, fresh);
    return fresh;
  }

  /**
   * Persist a conversation snapshot to storage.
   */
  private async persist(snapshot: ConversationSnapshot): Promise<void> {
    snapshot.updatedAt = Date.now();
    this.cache.set(snapshot.conversationId, snapshot);
    const key = MEMORY_KEY_PREFIX + snapshot.conversationId;
    await this.storage.setWorkspaceValue(key, snapshot);
  }

  /**
   * Record a tool call for later recall.
   */
  public async recordToolCall(
    conversationId: string,
    record: Omit<ToolCallRecord, 'timestamp'>
  ): Promise<void> {
    const snapshot = this.load(conversationId);
    snapshot.toolCalls.push({ ...record, timestamp: Date.now() });
    // Keep last 50 tool calls to avoid bloat
    if (snapshot.toolCalls.length > 50) {
      snapshot.toolCalls = snapshot.toolCalls.slice(-50);
    }
    await this.persist(snapshot);
  }

  /**
   * Record a research finding so the AI remembers what it learned.
   */
  public async recordResearchFinding(
    conversationId: string,
    record: Omit<ResearchFindingRecord, 'timestamp'>
  ): Promise<void> {
    const snapshot = this.load(conversationId);
    // Deduplicate: skip if same topic + same source already exists
    const exists = snapshot.researchFindings.some(
      (f) => f.topic === record.topic && f.source === record.source
    );
    if (!exists) {
      snapshot.researchFindings.push({ ...record, timestamp: Date.now() });
    }
    // Keep last 30 findings — research knowledge should not be discarded lightly
    if (snapshot.researchFindings.length > 30) {
      snapshot.researchFindings = snapshot.researchFindings.slice(-30);
    }
    await this.persist(snapshot);
  }

  /**
   * Check if a topic has already been researched in this conversation.
   */
  public hasResearchedTopic(conversationId: string, topic: string): boolean {
    const snapshot = this.load(conversationId);
    const normalized = topic.toLowerCase().trim();
    return snapshot.researchFindings.some(
      (f) =>
        f.topic.toLowerCase().trim() === normalized ||
        f.topic.toLowerCase().includes(normalized) ||
        normalized.includes(f.topic.toLowerCase())
    );
  }

  /**
   * Get all research findings for a conversation.
   */
  public getResearchFindings(conversationId: string): ResearchFindingRecord[] {
    const snapshot = this.load(conversationId);
    return snapshot.researchFindings;
  }

  /**
   * Get the complete (untruncated) text of a research finding by topic.
   * Returns undefined if no matching finding exists.
   */
  public getResearchFindingFullText(conversationId: string, topic: string): string | undefined {
    const snapshot = this.load(conversationId);
    const normalized = topic.toLowerCase().trim();
    const finding = snapshot.researchFindings.find(
      (f) =>
        f.topic.toLowerCase().trim() === normalized ||
        f.topic.toLowerCase().includes(normalized) ||
        normalized.includes(f.topic.toLowerCase())
    );
    return finding?.finding;
  }

  /**
   * Record a file operation for later recall.
   */
  public async recordFileOperation(
    conversationId: string,
    record: Omit<FileOperationRecord, 'timestamp'>
  ): Promise<void> {
    const snapshot = this.load(conversationId);
    snapshot.fileOperations.push({ ...record, timestamp: Date.now() });
    // Keep last 30 file operations
    if (snapshot.fileOperations.length > 30) {
      snapshot.fileOperations = snapshot.fileOperations.slice(-30);
    }
    await this.persist(snapshot);
  }

  /**
   * Check if a file has already been read in this conversation.
   * Prevents redundant file reads.
   */
  public hasFileBeenRead(conversationId: string, filePath: string): boolean {
    const snapshot = this.load(conversationId);
    return snapshot.fileOperations.some((op) => op.operation === 'read' && op.path === filePath);
  }

  /**
   * Check if a directory has already been listed in this conversation.
   * Prevents redundant directory listings.
   */
  public hasDirectoryBeenListed(conversationId: string, dirPath: string): boolean {
    const snapshot = this.load(conversationId);
    return snapshot.fileOperations.some((op) => op.operation === 'list' && op.path === dirPath);
  }

  /**
   * Get all file operations of a given type.
   */
  public getFileOperations(
    conversationId: string,
    operation?: 'read' | 'write' | 'list' | 'search'
  ): FileOperationRecord[] {
    const snapshot = this.load(conversationId);
    if (!operation) return snapshot.fileOperations;
    return snapshot.fileOperations.filter((op) => op.operation === operation);
  }

  /**
   * Get recent tool calls (last N).
   */
  public getRecentToolCalls(conversationId: string, limit: number = 10): ToolCallRecord[] {
    const snapshot = this.load(conversationId);
    return snapshot.toolCalls.slice(-limit);
  }

  /**
   * Get a summary of what the AI has done so far in this conversation.
   * Useful for injecting into the system prompt.
   */
  public getMemorySummary(conversationId: string): string {
    const snapshot = this.load(conversationId);
    const lines: string[] = [];

    if (snapshot.fileOperations.length > 0) {
      lines.push('## Files Already Explored');
      const reads = snapshot.fileOperations.filter((op) => op.operation === 'read');
      if (reads.length > 0) {
        lines.push(`- Already read: ${reads.map((r) => r.path).join(', ')}`);
      }
      const lists = snapshot.fileOperations.filter((op) => op.operation === 'list');
      if (lists.length > 0) {
        lines.push(`- Already listed: ${lists.map((l) => l.path).join(', ')}`);
      }
    }

    if (snapshot.researchFindings.length > 0) {
      lines.push('## Research Already Conducted — DO NOT SEARCH AGAIN');
      for (const f of snapshot.researchFindings.slice(-8)) {
        const previewLen = f.finding.length;
        lines.push(`- ${f.source}: "${f.topic}" (${previewLen} chars recorded)`);
      }
      lines.push(
        '**CRITICAL RULE**: If the topic above matches the current request, use these findings. Do NOT search again. You already did the work.'
      );
    }

    if (snapshot.researchFindings.length > 0) {
      lines.push('## Learned Facts (from prior research — USE THESE, do not guess)');
      // Show up to 3 most recent findings with generous preview (2000 chars each)
      for (const f of snapshot.researchFindings.slice(-3)) {
        const findingPreview = f.finding.slice(0, 2000);
        lines.push(`\n--- Finding: ${f.topic} ---`);
        lines.push(findingPreview);
        if (f.finding.length > 2000) {
          lines.push(`...[${f.finding.length - 2000} more chars in full memory]`);
        }
      }
    }

    if (snapshot.toolCalls.length > 0) {
      lines.push('## Recent Tool Calls');
      const recent = snapshot.toolCalls.slice(-5);
      for (const tc of recent) {
        lines.push(`- ${tc.toolName}: ${JSON.stringify(tc.arguments).slice(0, 80)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Cache workspace context to avoid re-scanning files on every message.
   */
  public getCachedWorkspaceTree(): string | undefined {
    if (Date.now() - this.lastWorkspaceGather < WORKSPACE_CONTEXT_TTL_MS) {
      return this.cachedWorkspaceTree;
    }
    return undefined;
  }

  public setCachedWorkspaceTree(tree: string): void {
    this.cachedWorkspaceTree = tree;
    this.lastWorkspaceGather = Date.now();
  }

  /**
   * Clear memory for a conversation.
   */
  public async clear(conversationId: string): Promise<void> {
    this.cache.delete(conversationId);
    const key = MEMORY_KEY_PREFIX + conversationId;
    await this.storage.setWorkspaceValue(key, null);
  }
}
