import type { DocSourceId } from '../types';

export interface ScrapePlanner {
  /**
   * Decide which URLs to scrape this run.
   * Should skip URLs that were scraped too recently.
   */
  plan(params: {
    sourceId: DocSourceId;
    candidates: Array<{ url: string; title?: string }>;
    nowMs: number;
  }): Promise<Array<{ url: string; title?: string }>>;
}
