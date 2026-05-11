import type { DocSourceId, ScrapedDocPage } from '../types';
import type { Scraper } from './Scraper';
import type { DocSource } from './DocSource';
import type { HtmlFetcher } from './HtmlFetcher';
import type { ScrapePlanner } from './ScrapePlanner';
import type { ContentHasher } from './ContentHasher';
import type { DocCleaner } from '../cleaner/DocCleaner';
import type { RagChunker } from '../chunker/Chunker';
import type { RagStore } from '../store/RagStore';

export interface ScraperRunnerDeps {
  sources: DocSource[];
  fetcher: HtmlFetcher;
  planner: ScrapePlanner;
  hasher: ContentHasher;
  cleaner: DocCleaner;
  chunker: RagChunker;
  store: RagStore;
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

  public async run(params: { sourceId: DocSourceId }): Promise<{
    pages: ScrapedDocPage[];
    chunksUpsert: { upserted: number; skippedSame: number };
  }> {
    const { sourceId } = params;

    const source = ensureSource(this.deps.sources, sourceId);
    const candidates = await source.listUrls();

    const nowMs = Date.now();
    const planned = await this.deps.planner.plan({
      sourceId,
      candidates,
      nowMs,
    });

    const pages: ScrapedDocPage[] = [];

    for (const page of planned) {
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
    }

    // Chunk + store upsert
    const allChunks = [];
    for (const p of pages) {
      const chunks = await this.deps.chunker.chunk({
        sourceId: p.sourceId as string,
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
