import type { Logger } from '../utils/Logger';
import type { DocSourceId, ScrapedDocPage } from './types';
import type { CancellationToken } from './scraper/DocSource';

import { ReaderModeDocCleaner } from './cleaner/ReaderModeDocCleaner';
import { SimpleRecursiveTextChunker } from './chunker/SimpleRecursiveTextChunker';
import { LanceDbRagStore } from './store/LanceDbRagStore';
import { OllamaEmbeddingsProvider } from './embeddings/OllamaEmbeddingsProvider';
import { ScraperRunner } from './scraper/ScraperRunner';
import { Sha256ContentHasher } from './scraper/Sha256ContentHasher';
import { HttpHtmlFetcher } from './scraper/HttpHtmlFetcher';
import { MvpScrapePlanner } from './scraper/MvpScrapePlanner';
import { ReactJsDocSource } from './scraper/sources/ReactJsDocSource';
import { TypeScriptDocSource } from './scraper/sources/TypeScriptDocSource';
import { JavaScriptDocSource } from './scraper/sources/JavaScriptDocSource';
import { PythonDocSource } from './scraper/sources/PythonDocSource';
import { NodeJsDocSource } from './scraper/sources/NodeJsDocSource';
import { GoDocSource } from './scraper/sources/GoDocSource';
import { RustDocSource } from './scraper/sources/RustDocSource';
import { NextJsDocSource } from './scraper/sources/NextJsDocSource';
import { VueDocSource } from './scraper/sources/VueDocSource';
import { ExpressDocSource } from './scraper/sources/ExpressDocSource';
import { FastApiDocSource } from './scraper/sources/FastApiDocSource';
import { TailwindCssDocSource } from './scraper/sources/TailwindCssDocSource';
import { ShadcnUiDocSource } from './scraper/sources/ShadcnUiDocSource';
import { PrismaDocSource } from './scraper/sources/PrismaDocSource';
import { ViteDocSource } from './scraper/sources/ViteDocSource';
import { DockerDocSource } from './scraper/sources/DockerDocSource';
import { GitDocSource } from './scraper/sources/GitDocSource';
import { PostgresDocSource } from './scraper/sources/PostgresDocSource';
import { MongoDbDocSource } from './scraper/sources/MongoDbDocSource';
import { VSCodeApiDocSource } from './scraper/sources/VSCodeApiDocSource';
import { ZustandDocSource } from './scraper/sources/ZustandDocSource';

export type ScrapeProgressEvent =
  | { type: 'start'; sourceId: DocSourceId }
  | { type: 'discover'; sourceId: DocSourceId; discoveredCount: number }
  | { type: 'page'; sourceId: DocSourceId; pageIndex: number; totalPages: number; url: string }
  | { type: 'complete'; sourceId: DocSourceId; pages: number; upserted: number }
  | { type: 'error'; sourceId: DocSourceId; error: string };

export interface RunOnSourcesOptions {
  sourceIds: DocSourceId[];
  concurrency?: number;
  onProgress?: (event: ScrapeProgressEvent) => void;
  token?: CancellationToken;
}

function buildAllSources() {
  return [
    new ReactJsDocSource(),
    new TypeScriptDocSource(),
    new JavaScriptDocSource(),
    new PythonDocSource(),
    new NodeJsDocSource(),
    new GoDocSource(),
    new RustDocSource(),
    new NextJsDocSource(),
    new VueDocSource(),
    new ExpressDocSource(),
    new FastApiDocSource(),
    new TailwindCssDocSource(),
    new ShadcnUiDocSource(),
    new PrismaDocSource(),
    new ViteDocSource(),
    new DockerDocSource(),
    new GitDocSource(),
    new PostgresDocSource(),
    new MongoDbDocSource(),
    new VSCodeApiDocSource(),
    new ZustandDocSource(),
  ];
}

export class RagIngestionService {
  constructor(
    private readonly deps: { logger: Logger; ollamaEmbeddingsModel: string; dbPath: string }
  ) {}

  public async runOnSources(options: RunOnSourcesOptions): Promise<{
    pagesBySource: Record<string, ScrapedDocPage[]>;
  }> {
    const { logger, ollamaEmbeddingsModel, dbPath } = this.deps;
    const { sourceIds, concurrency = 3, onProgress, token } = options;

    const { OllamaClient } = await import('../ollama/OllamaClient');
    const ollamaClient = new OllamaClient('http://localhost:11434', logger);

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
    const sources = buildAllSources();

    const runner = new ScraperRunner({
      sources,
      fetcher,
      planner,
      hasher,
      cleaner,
      chunker,
      store,
      logger,
    });

    const pagesBySource: Record<string, ScrapedDocPage[]> = {};

    // Wrap the runner so we can inject progress hooks before/after run()
    const scrapeOne = async (sourceId: DocSourceId): Promise<void> => {
      if (token?.isCancellationRequested) {
        return;
      }

      onProgress?.({ type: 'start', sourceId });
      logger.info(`RAG ingestion: scraping sourceId=${sourceId}`);

      try {
        const result = await runner.run({ sourceId }, token);
        pagesBySource[sourceId] = result.pages;
        logger.info(
          `RAG ingestion: sourceId=${sourceId} pages=${result.pages.length} upserted=${result.chunksUpsert.upserted} skippedSame=${result.chunksUpsert.skippedSame}`
        );
        onProgress?.({
          type: 'complete',
          sourceId,
          pages: result.pages.length,
          upserted: result.chunksUpsert.upserted,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`RAG ingestion: source ${sourceId} failed — ${msg}`);
        onProgress?.({ type: 'error', sourceId, error: msg });
      }
    };

    // Parallel with bounded concurrency so we don't hammer Ollama
    await this.runWithConcurrency(sourceIds, concurrency, scrapeOne, token);

    return { pagesBySource };
  }

  /**
   * Run tasks in parallel with a bounded concurrency limit.
   * Yields to the event loop between batches so chat remains responsive.
   */
  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    task: (item: T) => Promise<void>,
    token?: CancellationToken
  ): Promise<void> {
    for (let i = 0; i < items.length; i += concurrency) {
      if (token?.isCancellationRequested) {
        break;
      }

      const batch = items.slice(i, i + concurrency);
      await Promise.all(batch.map((item) => task(item)));

      // Yield to the event loop between batches so chat handlers get CPU time.
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
}
