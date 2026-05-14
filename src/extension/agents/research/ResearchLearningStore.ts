import * as fs from 'fs';
import * as path from 'path';

/**
 * A user correction tied to a specific research context.
 */
export interface ResearchCorrection {
  id: string;
  originalTopic: string;
  correction: string; // e.g., "Use NextAuth v5, not v4"
  context: string; // the original finding text
  createdAt: number;
  category: 'version' | 'preference' | 'architecture' | 'other';
}

const STORE_VERSION = 'v1';
const MIN_SIMILARITY = 0.6; // simple keyword overlap threshold

/**
 * Learns from user corrections and surfaces them in future research.
 *
 * - Stores corrections keyed by topic
 * - On lookup: simple keyword-matching to find relevant corrections
 * - Future improvement: use embedding similarity instead of keywords
 */
export class ResearchLearningStore {
  private workspaceRoot: string;
  private storePath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.storePath = path.join(workspaceRoot, '.forgeai', 'research', 'learning-store.json');
    this.ensureDir();
  }

  private ensureDir(): void {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private readStore(): Record<string, ResearchCorrection[]> {
    if (!fs.existsSync(this.storePath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(this.storePath, 'utf-8');
      const data = JSON.parse(raw) as { version: string; corrections: Record<string, ResearchCorrection[]> };
      if (data.version !== STORE_VERSION) {
        return {}; // invalidate on version mismatch
      }
      return data.corrections;
    } catch {
      return {};
    }
  }

  private writeStore(corrections: Record<string, ResearchCorrection[]>): void {
    this.ensureDir();
    const data = { version: STORE_VERSION, corrections };
    fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Record a new correction from the user.
   */
  record(originalTopic: string, correction: string, context: string, category: ResearchCorrection['category'] = 'other'): void {
    const store = this.readStore();
    const key = this.normalizeKey(originalTopic);

    const entry: ResearchCorrection = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      originalTopic,
      correction,
      context,
      createdAt: Date.now(),
      category,
    };

    if (!store[key]) {
      store[key] = [];
    }
    store[key].push(entry);

    // Also index by keywords for broader matching
    const keywords = this.extractKeywords(originalTopic);
    for (const kw of keywords) {
      if (!store[kw]) {
        store[kw] = [];
      }
      // dedupe by id
      if (!store[kw].some((c) => c.id === entry.id)) {
        store[kw].push(entry);
      }
    }

    this.writeStore(store);
  }

  /**
   * Find corrections relevant to a query topic.
   */
  find(topic: string): ResearchCorrection[] {
    const store = this.readStore();
    const key = this.normalizeKey(topic);

    // Direct key match
    if (store[key]) {
      return store[key];
    }

    // Keyword fallback
    const keywords = this.extractKeywords(topic);
    const results: ResearchCorrection[] = [];
    const seenIds = new Set<string>();

    for (const kw of keywords) {
      const entries = store[kw] || [];
      for (const entry of entries) {
        if (!seenIds.has(entry.id)) {
          seenIds.add(entry.id);
          results.push(entry);
        }
      }
    }

    return results;
  }

  /**
   * Get all corrections (useful for inspection / admin).
   */
  all(): ResearchCorrection[] {
    const store = this.readStore();
    const seenIds = new Set<string>();
    const results: ResearchCorrection[] = [];

    for (const entries of Object.values(store)) {
      for (const entry of entries) {
        if (!seenIds.has(entry.id)) {
          seenIds.add(entry.id);
          results.push(entry);
        }
      }
    }

    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  private normalizeKey(topic: string): string {
    return topic
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }

  private extractKeywords(topic: string): string[] {
    // Extract meaningful keywords (length >= 3)
    return topic
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3)
      .slice(0, 10);
  }
}
