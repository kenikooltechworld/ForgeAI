import type { DocSourceId, ScrapedDocPage } from '../types';
import type { Scraper } from './Scraper';
import type { DocSource, CancellationToken } from './DocSource';
import type { HtmlFetcher } from './HtmlFetcher';
import type { ScrapePlanner } from './ScrapePlanner';
import type { ContentHasher } from './ContentHasher';
import type { DocCleaner } from '../cleaner/DocCleaner';
import type { RagChunker } from '../chunker/Chunker';
import type { RagStore } from '../store/RagStore';
import type { Logger } from '../../utils/Logger';
import { LinkCrawler } from './LinkCrawler';

export interface ScraperRunnerDeps {
  sources: DocSource[];
  fetcher: HtmlFetcher;
  planner: ScrapePlanner;
  hasher: ContentHasher;
  cleaner: DocCleaner;
  chunker: RagChunker;
  store: RagStore;
  logger?: Logger;
}

function ensureSource(sources: DocSource[], sourceId: DocSourceId): DocSource {
  const found = sources.find((s) => s.sourceId === sourceId);
  if (!found) throw new Error(`No DocSource registered for sourceId="${sourceId}"`);
  return found;
}

/**
 * MVP scraper runner:
 * list URLs -> fetch HTML -> clean -> hash -> chunk -> store upsert
 */
export class ScraperRunner implements Scraper {
  private readonly deps: ScraperRunnerDeps;

  constructor(deps: ScraperRunnerDeps) {
    this.deps = deps;
  }

  public async run(
    params: { sourceId: DocSourceId },
    token?: CancellationToken
  ): Promise<{
    pages: ScrapedDocPage[];
    chunksUpsert: { upserted: number; skippedSame: number };
  }> {
    const { sourceId } = params;

    const source = ensureSource(this.deps.sources, sourceId);
    const listed = await source.listUrls();

    // Optional: discover additional pages by crawling from entry URLs
    let discovered: string[] = [];
    if (source.getCrawlConfig) {
      try {
        this.deps.logger?.info(`[RAG scraper] ${sourceId} → starting link discovery...`);
        const crawler = new LinkCrawler(this.deps.fetcher);
        discovered = await crawler.discover(source.getCrawlConfig(), token);
        this.deps.logger?.info(
          `[RAG scraper] ${sourceId} → discovered ${discovered.length} additional page(s)`
        );
      } catch (err) {
        this.deps.logger?.warn(`[RAG scraper] ${sourceId} → crawl failed: ${String(err)}`);
      }
    }

    // Merge listed + discovered, deduplicate by URL
    const urlMap = new Map<string, { url: string; title?: string }>();
    for (const c of listed) {
      urlMap.set(c.url, c);
    }
    for (const url of discovered) {
      if (!urlMap.has(url)) {
        urlMap.set(url, { url });
      }
    }
    const candidates = Array.from(urlMap.values());

    const nowMs = Date.now();
    const planned = await this.deps.planner.plan({
      sourceId,
      candidates,
      nowMs,
    });

    const pages: ScrapedDocPage[] = [];

    for (let i = 0; i < planned.length; i++) {
      if (token?.isCancellationRequested) {
        this.deps.logger?.info(`[RAG scraper] ${sourceId} → cancelled mid-run`);
        break;
      }

      const page = planned[i];

      // Polite delay between requests (skip before the first one).
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Yield to the event loop so chat handlers can run between pages.
      await new Promise((resolve) => setImmediate(resolve));

      try {
        this.deps.logger?.info(
          `[RAG scraper] [${i + 1}/${planned.length}] ${sourceId} → ${page.url}`
        );
        const { rawHtml } = await this.deps.fetcher.fetch({ sourceId, url: page.url });

        const cleaned = await this.deps.cleaner.clean({
          sourceId,
          url: page.url,
          title: page.title,
          rawHtml,
        });

        const contentHashRes = await this.deps.hasher.hash({ text: cleaned.extractedText });

        pages.push({
          sourceId,
          url: page.url,
          title: page.title,
          rawHtml,
          extractedText: cleaned.extractedText,
          scrapedAtMs: nowMs,
          contentHash: contentHashRes.hash,
        });
        this.deps.logger?.info(
          `[RAG scraper] ✓ ${page.url} (${cleaned.extractedText.length} chars)`
        );
      } catch (err) {
        this.deps.logger?.warn(`[RAG scraper] ✗ ${page.url}: ${String(err)}`);
      }
    }

    if (token?.isCancellationRequested) {
      return { pages, chunksUpsert: { upserted: 0, skippedSame: 0 } };
    }

    // Chunk + store upsert
    const allChunks = [];
    for (const p of pages) {
      const chunks = await this.deps.chunker.chunk({
        sourceId: p.sourceId,
        url: p.url,
        title: p.title,
        contentHash: p.contentHash,
        extractedText: p.extractedText,
      });
      allChunks.push(...(chunks as any[]));
    }

    const chunksUpsert = await this.deps.store.upsertChunks(allChunks as any);

    return { pages, chunksUpsert };
  }
}
