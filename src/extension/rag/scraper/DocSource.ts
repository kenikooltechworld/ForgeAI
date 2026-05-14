import type { DocSourceId } from '../types';
import type { CrawlConfig } from './LinkCrawler';

/** Lightweight cancellation token used across scraper components. */
export interface CancellationToken {
  readonly isCancellationRequested: boolean;
}

export interface DocSource {
  sourceId: DocSourceId;

  /**
   * Returns the list of URLs to scrape for this source.
   * MVP can start with a small hardcoded list per source adapter.
   */
  listUrls(): Promise<Array<{ url: string; title?: string }>>;

  /**
   * Optional crawl configuration. When provided, the scraper will
   * discover additional pages by following links starting from entryUrls.
   */
  getCrawlConfig?(): CrawlConfig;
}
