import type { DocSourceId } from '../types';
import type { ScrapePlanner } from './ScrapePlanner';

export class MvpScrapePlanner implements ScrapePlanner {
  public async plan(params: {
    sourceId: DocSourceId;
    candidates: Array<{ url: string; title?: string }>;
    nowMs: number;
  }): Promise<Array<{ url: string; title?: string }>> {
    // MVP: scrape everything.
    // Next iteration: consult persisted "lastScrapedAt" per (sourceId,url) or per source.
    return params.candidates;
  }
}
