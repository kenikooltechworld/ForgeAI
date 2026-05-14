import type { DocSourceId } from '../types';
import type { HtmlFetcher } from './HtmlFetcher';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const JITTER_MAX_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(status: number): boolean {
  // Retry on rate limits, server errors, and suspected bot-blocks (403)
  return (
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 500 ||
    status === 403
  );
}

export class HttpHtmlFetcher implements HtmlFetcher {
  public async fetch(params: { sourceId: DocSourceId; url: string }): Promise<{ rawHtml: string }> {
    const { url } = params;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
          },
        });

        if (res.ok) {
          const rawHtml = await res.text();
          return { rawHtml };
        }

        // Non-OK response
        if (!isRetryable(res.status) || attempt === MAX_RETRIES) {
          const body = await res.text().catch(() => '');
          throw new Error(`Failed to fetch ${url} (HTTP ${res.status}) ${body.slice(0, 200)}`);
        }

        // Retryable status — wait and retry
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * JITTER_MAX_MS;
        await sleep(delay);
      } catch (err) {
        // Network errors (DNS, timeout, etc.)
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * JITTER_MAX_MS;
          await sleep(delay);
        }
      }
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${MAX_RETRIES} retries`);
  }
}
