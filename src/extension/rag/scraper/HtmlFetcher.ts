import type { DocSourceId } from '../types';

export interface HtmlFetcher {
  fetch(params: {
    sourceId: DocSourceId;
    url: string;
  }): Promise<{ rawHtml: string }>;
}
