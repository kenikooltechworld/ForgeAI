import type { DocSourceId } from '../types';

export interface DocSource {
  sourceId: DocSourceId;

  /**
   * Returns the list of URLs to scrape for this source.
   * MVP can start with a small hardcoded list per source adapter.
   */
  listUrls(): Promise<Array<{ url: string; title?: string }>>;
}
