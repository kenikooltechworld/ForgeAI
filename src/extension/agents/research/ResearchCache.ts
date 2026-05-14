import * as fs from 'fs';
import * as path from 'path';
import { ResearchReport } from './ResearchSession';

const CACHE_VERSION = 'v1';
const DEFAULT_TTL_DAYS = 30;

interface CacheEntry {
  version: string;
  queryHash: string;
  report: ResearchReport;
  createdAt: number; // timestamp
  ttlDays: number;
}

/**
 * Persistent cache for research results.
 *
 * - Keyed by query hash (SHA-256 of normalized query string)
 * - Stored in `.forgeai/research/cache/`
 * - TTL = 30 days by default
 * - On hit: returns cached result with staleness warning if expired
 */
export class ResearchCache {
  private workspaceRoot: string;
  private cacheDir: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.cacheDir = path.join(workspaceRoot, '.forgeai', 'research', 'cache');
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Build a simple hash for a query string.
   */
  static hashQuery(query: string): string {
    // FNV-1a 32-bit hash — fast and good enough for cache keys
    let hash = 0x811c9dc5;
    const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
    for (let i = 0; i < normalized.length; i++) {
      hash ^= normalized.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  /**
   * Look up a cached report by query string.
   * Returns `null` if not found or expired.
   */
  get(query: string): { report: ResearchReport; stale: boolean } | null {
    const hash = ResearchCache.hashQuery(query);
    const filePath = path.join(this.cacheDir, `${hash}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const entry: CacheEntry = JSON.parse(raw);

      // Version mismatch → invalidate
      if (entry.version !== CACHE_VERSION) {
        return null;
      }

      const now = Date.now();
      const expiry = entry.createdAt + entry.ttlDays * 24 * 60 * 60 * 1000;
      const stale = now > expiry;

      return { report: entry.report, stale };
    } catch {
      return null;
    }
  }

  /**
   * Store a research report keyed by query string.
   */
  set(query: string, report: ResearchReport, ttlDays: number = DEFAULT_TTL_DAYS): void {
    const hash = ResearchCache.hashQuery(query);
    const filePath = path.join(this.cacheDir, `${hash}.json`);

    const entry: CacheEntry = {
      version: CACHE_VERSION,
      queryHash: hash,
      report,
      createdAt: Date.now(),
      ttlDays,
    };

    this.ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
  }

  /**
   * Clear all cached entries (useful for debugging or cache busting).
   */
  clear(): void {
    if (!fs.existsSync(this.cacheDir)) {
      return;
    }
    const files = fs.readdirSync(this.cacheDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
    }
  }
}
