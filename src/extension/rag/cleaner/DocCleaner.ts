import type { DocSourceId } from '../types';

export interface DocCleaner {
  /**
   * Receives raw scraped HTML and returns extracted readable text.
   * Cleaning should remove headers/footers/ads/nav when possible.
   */
  clean(params: {
    sourceId: DocSourceId;
    url: string;
    title?: string;
    rawHtml: string;
  }): Promise<{ extractedText: string }>;
}
