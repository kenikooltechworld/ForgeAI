import type { Logger } from '../utils/Logger';
import type { DocSourceId, ScrapedDocPage } from './types';

import { ReaderModeDocCleaner } from './cleaner/ReaderModeDocCleaner';
import { SimpleRecursiveTextChunker } from './chunker/SimpleRecursiveTextChunker';
import { LanceDbRagStore } from './store/LanceDbRagStore';
import { OllamaEmbeddingsProvider } from './embeddings/OllamaEmbeddingsProvider';
import { ScraperRunner } from './scraper/ScraperRunner';
import { Sha256ContentHasher } from './scraper/Sha256ContentHasher';
import { HttpHtmlFetcher } from './scraper/HttpHtmlFetcher';
import { MvpScrapePlanner } from './scraper/MvpScrapePlanner';
import { ReactJsDocSource } from './scraper/sources/ReactJsDocSource';

export class RagIngestionService {
  constructor(private readonly deps: { logger: Logger; ollamaEmbeddingsModel: string; dbPath: string }) {}

  public async runOnSources(params: { sourceIds: DocSourceId[] }): Promise<{
    pagesBySource: Record<string, ScrapedDocPage[]>;
  }> {
    const { logger, ollamaEmbeddingsModel, dbPath } = this.deps;

    // Create embeddings provider (embeds happen inside the store)
    const ollama = await import('../ollama/OllamaClient').then((m) => m);

    // We need a logger-compatible object; embeddings provider uses logger typing only.
    // We'll instantiate Ollama embeddings without direct OllamaClient dependency for now via fetch-based endpoint.
    // (If you later extend OllamaClient with embeddings(), we’ll refactor this.)
    const { OllamaClient } = await import('../ollama/OllamaClient');

    const ollamaClient = new OllamaClient('http://localhost:11434', logger as any);

    const embeddings = new OllamaEmbeddingsProvider({
      ollama: ollamaClient,
      logger,
      embeddingsModel: ollamaEmbeddingsModel,
    });

    const store = new LanceDbRagStore({
      logger,
      embeddings,
      dbPath,
    });

    const chunker = new SimpleRecursiveTextChunker({ maxChars: 900, overlapChars: 150 });
    const cleaner = new ReaderModeDocCleaner();
    const hasher = new Sha256ContentHasher();
    const fetcher = new HttpHtmlFetcher();
    const planner = new MvpScrapePlanner();
    const sources = [new ReactJsDocSource()];

    const runner = new ScraperRunner({
      sources,
      fetcher,
      planner,
      hasher,
      cleaner,
      chunker,
      store,
    });

    const pagesBySource: Record<string, ScrapedDocPage[]> = {};

    for (const sourceId of params.sourceIds) {
      logger.info(`RAG ingestion: scraping sourceId=${sourceId}`);
      const result = await runner.run({ sourceId });
      pagesBySource[sourceId] = result.pages;
      logger.info(
        `RAG ingestion: sourceId=${sourceId} pages=${result.pages.length} upserted=${result.chunksUpsert.upserted} skippedSame=${result.chunksUpsert.skippedSame}`
      );
    }

    return { pagesBySource };
  }
}
