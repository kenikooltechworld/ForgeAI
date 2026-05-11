import type { DocSourceId } from '../types';
import type { HtmlFetcher } from './HtmlFetcher';

export class HttpHtmlFetcher implements HtmlFetcher {
  public async fetch(params: { sourceId: DocSourceId; url: string }): Promise<{ rawHtml: string }> {
    const { url } = params;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        // MVP: generic UA to reduce bot blocking.
        'User-Agent':
          'ForgeAI-RAG/1.0 (+https://github.com/kenikooltechworld/ForgeAI; compatible fetch)',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Failed to fetch ${url} (HTTP ${res.status}) ${body.slice(0, 200)}`);
    }

    const rawHtml = await res.text();
    return { rawHtml };
  }
}
