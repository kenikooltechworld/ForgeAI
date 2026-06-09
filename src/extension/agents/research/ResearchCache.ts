import * as fs from 'fs';
import * as path from 'path';
import { ResearchReport } from './ResearchSession';
import type { ResearchSession } from './ResearchSession';

const CACHE_VERSION = 'v1';
const DEFAULT_TTL_DAYS = 30;

interface CacheEntry {
  version: string;
  queryHash: string;
  createdAt: number;
  ttlDays: number;
  findingCount: number;
  sourceTypes: string[];
  webQueriesRun: number;
  markdownPath: string;
}

/**
 * Persistent cache for research results.
 *
 * - Organized by sessionId/topic for better structure
 * - Stored in `.forgeai/research/cache/{sessionId}/{topicSlug}.json`
 * - TTL = 30 days by default
 * - On hit: returns cached result with staleness warning if expired
 */
export class ResearchCache {
  private workspaceRoot: string;
  private baseCacheDir: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.baseCacheDir = path.join(workspaceRoot, '.forgeai', 'research', 'cache');
    this.ensureDir(this.baseCacheDir);
  }

  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
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
   * Get the cache directory path for a specific session.
   */
  private getSessionCacheDir(sessionId: string): string {
    return path.join(this.baseCacheDir, sessionId);
  }

  /**
   * Look up a cached entry by session and topic slug.
   * Returns metadata only — the actual content is in the markdown file.
   * Returns `null` if not found or expired.
   */
  get(sessionId: string, topicSlug: string): { stale: boolean; markdownPath: string } | null {
    const sessionDir = this.getSessionCacheDir(sessionId);
    const filePath = path.join(sessionDir, `${topicSlug}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const entry: CacheEntry = JSON.parse(raw) as CacheEntry;

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
   * Check cache for any topic matching the query hash.
   * DEPRECATED: legacy path, unused by the main ResearchAgent flow.
   * Kept for API consumers. Will be removed in a future version.
   */
  getAny(
    sessionId: string,
    topicSlug: string,
    _query: string
  ): { report: ResearchReport; stale: boolean } | null {
    return this.get(sessionId, topicSlug);
  }

  /**
   * Store a research report keyed by session and topic slug.
   */
  set(
    sessionId: string,
    topicSlug: string,
    query: string,
    report: ResearchReport,
    ttlDays: number = DEFAULT_TTL_DAYS
  ): void {
    const sessionDir = this.getSessionCacheDir(sessionId);
    const markdownFilename = `${sessionId}-${topicSlug}.md`;
    const markdownPath = path.join(this.baseCacheDir, '..', markdownFilename);

    const entry: CacheEntry = {
      version: CACHE_VERSION,
      queryHash: ResearchCache.hashQuery(query),
      createdAt: Date.now(),
      ttlDays,
      findingCount: report.findings.length,
      sourceTypes: report.sourceTypes,
      webQueriesRun: report.webQueriesRun,
      markdownPath,
    };

    this.ensureDir(sessionDir);
    fs.writeFileSync(path.join(sessionDir, `${topicSlug}.json`), JSON.stringify(entry, null, 2), 'utf-8');
  }

  /**
   * Clear all cached entries for a specific session.
   */
  clearSession(sessionId: string): void {
    const sessionDir = this.getSessionCacheDir(sessionId);
    if (!fs.existsSync(sessionDir)) return;
    const files = fs.readdirSync(sessionDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(sessionDir, file));
      }
    }
  }

  /**
   * Clear all cached sessions (useful for debugging or cache busting).
   */
  clear(): void {
    if (!fs.existsSync(this.baseCacheDir)) {
      return;
    }
    const sessions = fs.readdirSync(this.baseCacheDir);
    for (const session of sessions) {
      const sessionDir = path.join(this.baseCacheDir, session);
      if (fs.lstatSync(sessionDir).isDirectory()) {
        this.clearSession(session);
        fs.rmdirSync(sessionDir);
      } else if (session.endsWith('.json')) {
        // Legacy format
        fs.unlinkSync(path.join(this.baseCacheDir, session));
      }
    }
  }

  /**
   * Get cleaned page content from cache by URL.
   * Returns the cached content if found, null otherwise.
   * No expiration — content is permanent per-project.
   */
  getPageContent(url: string): string | null {
    const contentCacheDir = path.join(this.baseCacheDir, 'page-content');
    const urlHash = ResearchCache.hashUrl(url);
    const filePath = path.join(contentCacheDir, `${urlHash}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const entry = JSON.parse(raw) as { content: string; url: string };
      return entry.content;
    } catch {
      return null;
    }
  }

  /**
   * Store cleaned page content in cache by URL.
   * No expiration — content is permanent per-project.
   * No size limits — store full cleaned content.
   */
  setPageContent(url: string, cleanedContent: string): void {
    const contentCacheDir = path.join(this.baseCacheDir, 'page-content');
    const urlHash = ResearchCache.hashUrl(url);
    const filePath = path.join(contentCacheDir, `${urlHash}.json`);

    const entry = {
      url,
      content: cleanedContent,
      cachedAt: Date.now(),
    };

    this.ensureDir(contentCacheDir);
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
  }

  /**
   * Build a hash for a URL to use as cache key.
   */
  private static hashUrl(url: string): string {
    // FNV-1a 32-bit hash — fast and good enough for cache keys
    let hash = 0x811c9dc5;
    const normalized = url.trim().toLowerCase();
    for (let i = 0; i < normalized.length; i++) {
      hash ^= normalized.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  /**
   * Persist full research session to `.forgeai/research/sessions/{sessionId}/index.json`.
   */
  persistSession(session: ResearchSession): void {
    const sessionDir = path.join(
      this.workspaceRoot,
      '.forgeai',
      'research',
      'sessions',
      session.sessionId
    );
    this.ensureDir(sessionDir);
    fs.writeFileSync(
      path.join(sessionDir, 'index.json'),
      JSON.stringify(session, null, 2),
      'utf-8'
    );
  }

  /**
   * Load a research session by ID.
   */
  loadSession(sessionId: string): ResearchSession | null {
    const sessionFile = path.join(
      this.workspaceRoot,
      '.forgeai',
      'research',
      'sessions',
      sessionId,
      'index.json'
    );
    if (!fs.existsSync(sessionFile)) return null;
    try {
      const raw = fs.readFileSync(sessionFile, 'utf-8');
      return JSON.parse(raw) as ResearchSession;
    } catch {
      return null;
    }
  }
}
