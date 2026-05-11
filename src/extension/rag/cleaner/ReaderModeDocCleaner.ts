import * as cheerio from 'cheerio';
import type { DocCleaner } from './DocCleaner';
import type { DocSourceId } from '../types';

function normalizeWhitespace(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * MVP "reader mode" cleaner:
 * - strips common header/footer/nav/ads containers
 * - removes scripts/styles
 * - extracts main-ish text blocks
 *
 * NOTE: This is intentionally generic because each site has different DOM structure.
 * We'll improve with per-source selectors later.
 */
export class ReaderModeDocCleaner implements DocCleaner {
  public async clean(params: {
    sourceId: DocSourceId;
    url: string;
    title?: string;
    rawHtml: string;
  }): Promise<{ extractedText: string }> {
    const { rawHtml } = params;

    const $ = cheerio.load(rawHtml);

    // Remove noisy elements.
    $('script, style, noscript, svg, canvas, iframe').remove();

    // Common header/footer/nav/ad patterns.
    const junkSelectors = [
      'header',
      'footer',
      'nav',
      'aside',
      '[role="banner"]',
      '[role="navigation"]',
      '[aria-label*="breadcrumb" i]',
      '[class*="breadcrumb" i]',
      '[class*="nav" i]',
      '[id*="nav" i]',
      '[class*="header" i]',
      '[id*="header" i]',
      '[class*="footer" i]',
      '[id*="footer" i]',
      '[class*="sidebar" i]',
      '[id*="sidebar" i]',
      '[class*="advert" i]',
      '[id*="advert" i]',
      '[class*="ads" i]',
      '[id*="ads" i]',
      '[class*="promo" i]',
      '[id*="promo" i]',
      '[class*="subscription" i]',
      '[id*="subscription" i]',
      '[class*="comment" i]',
      '[id*="comment" i]',
      '[class*="cookie" i]',
      '[id*="cookie" i]',
    ];

    for (const sel of junkSelectors) $(sel).remove();

    // Try to pick a "main" container first; fallback to body.
    const main = $('main').first();
    const root = main.length > 0 ? main : $('body');

    // Remove links that look like "skip to..."; keep readable text.
    root.find('a').each((_, el) => {
      const $el = $(el);
      const text = ($el.text() || '').trim();
      if (text.length === 0) $el.remove();
    });

    // Extract text from headings/paragraphs/lists/code blocks.
    // Keep code blocks because docs often include code.
    const textParts: string[] = [];
    root.find('h1,h2,h3,h4,h5,h6,p,li,pre,code').each((_, el) => {
      const tag = el.tagName?.toLowerCase();
      const chunk = $(el).text();
      const normalized = normalizeWhitespace(chunk);
      if (!normalized) return;

      // Avoid repeating extremely short nav-like fragments.
      if (normalized.length < 3) return;

      if (tag === 'pre') {
        textParts.push(normalized);
      } else {
        textParts.push(normalized);
      }
    });

    // De-duplicate consecutive repeats (common with nav artifacts).
    const deduped: string[] = [];
    let last = '';
    for (const part of textParts) {
      if (part === last) continue;
      deduped.push(part);
      last = part;
    }

    const extractedText = normalizeWhitespace(deduped.join('\n'));

    return { extractedText };
  }
}
