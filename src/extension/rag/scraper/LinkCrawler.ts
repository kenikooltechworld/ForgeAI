import * as cheerio from 'cheerio';
import type { HtmlFetcher } from './HtmlFetcher';
import type { CancellationToken } from './DocSource';

export interface CrawlConfig {
  /** Starting URLs for the crawl */
  entryUrls: string[];
  /** Only follow links that pass this filter */
  urlFilter: (url: string) => boolean;
  /** Maximum total pages to discover (default: 50) */
  maxPages?: number;
  /** Maximum link hops from entry (default: 2) */
  maxDepth?: number;
}

/**
 * Breadth-first link crawler that discovers documentation sub-pages.
 * Respects maxPages and maxDepth to prevent runaway crawling.
 */
export class LinkCrawler {
  constructor(private readonly fetcher: HtmlFetcher) {}

  public async discover(config: CrawlConfig, token?: CancellationToken): Promise<string[]> {
    const { entryUrls, urlFilter, maxPages = 50, maxDepth = 2 } = config;

    const discovered = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [];

    for (const url of entryUrls) {
      const normalized = this.normalizeUrl(url);
      if (normalized) {
        discovered.add(normalized);
        queue.push({ url: normalized, depth: 0 });
      }
    }

    let index = 0;
    while (index < queue.length && discovered.size < maxPages) {
      if (token?.isCancellationRequested) {
        return Array.from(discovered);
      }

      const { url, depth } = queue[index++];

      if (depth >= maxDepth) {
        continue;
      }

      try {
        const { rawHtml } = await this.fetcher.fetch({ sourceId: 'crawler', url });

        // Polite delay between crawl requests
        if (index < queue.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // Yield to the event loop so chat/other handlers can run
        await new Promise((resolve) => setImmediate(resolve));

        const links = this.extractLinks(rawHtml, url);

        for (const link of links) {
          const normalized = this.normalizeUrl(link);
          if (!normalized) {
            continue;
          }
          if (discovered.has(normalized)) {
            continue;
          }
          if (!urlFilter(normalized)) {
            continue;
          }
          if (discovered.size >= maxPages) {
            break;
          }

          discovered.add(normalized);
          queue.push({ url: normalized, depth: depth + 1 });
        }
      } catch {
        // Skip pages that fail to fetch during crawl
      }
    }

    return Array.from(discovered);
  }

  private extractLinks(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const links: string[] = [];

    $('a[href]').each((_i, el) => {
      const href = $(el).attr('href');
      if (href) {
        try {
          const resolved = new URL(href, baseUrl).href;
          links.push(resolved);
        } catch {
          // Ignore malformed URLs
        }
      }
    });

    return links;
  }

  private normalizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      // Remove fragment and trailing slash for deduplication
      parsed.hash = '';
      let href = parsed.href;
      if (href.endsWith('/')) {
        href = href.slice(0, -1);
      }
      return href;
    } catch {
      return null;
    }
  }
}
