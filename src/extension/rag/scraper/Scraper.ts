import type { DocSourceId, ScrapedDocPage } from '../types';
import type { RagStoreUpsertResult, CleanedChunk } from '../types';

export interface Scraper {
  run(params: {
    sourceId: DocSourceId;
  }): Promise<{
    pages: ScrapedDocPage[];
    chunksUpsert: RagStoreUpsertResult;
  }>;
}
