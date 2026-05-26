import * as vscode from 'vscode';
import { Tool } from './ToolRegistry';
import { ResearchCache } from '../agents/research/ResearchCache';
import { ResearchFinding, ResearchReport } from '../agents/research/ResearchSession';

/**
 * Web Search Tools - Cloud-based web search via SerpAPI and SerpStack
 *
 * Replaces local browser automation with API-driven web search.
 * No local Chromium required. Uses user's API keys from VS Code settings.
 */

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

interface SearchResponse {
  query: string;
  totalResults: number;
  results: SearchResult[];
  source: 'serpapi' | 'serpstack' | 'none';
}

export class WebSearchTools {
  private researchCache: ResearchCache | null = null;

  /**
   * Lazily initialize ResearchCache using the current VS Code workspace root.
   */
  private getResearchCache(): ResearchCache | null {
    if (this.researchCache) {
      return this.researchCache;
    }
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return null;
    }
    this.researchCache = new ResearchCache(workspaceRoot);
    return this.researchCache;
  }

  /**
   * Persist web-search findings to ResearchCache so ResearchAgent
   * can reuse them during spec generation instead of repeating the search.
   */
  private saveResearchReport(
    query: string,
    findings: ResearchFinding[],
    webQueriesRun: number
  ): void {
    const cache = this.getResearchCache();
    if (!cache) {
      return;
    }
    const report: ResearchReport = {
      sessionId: `websearch-${Date.now()}`,
      topic: query,
      findings,
      ragCoverage: 0,
      sourceTypes: Array.from(new Set(findings.map((f) => f.source))),
      webQueriesRun,
      learningCorrectionsApplied: 0,
      generatedAt: Date.now(),
    };
    cache.set(query, report);
  }

  /**
   * Perform a web search using available APIs (SerpAPI → SerpStack fallback)
   */
  private async performSearch(query: string): Promise<SearchResponse> {
    const config = vscode.workspace.getConfiguration('forgeai');
    const provider = config.get<string>('search.provider', 'auto');
    const serpApiKey = config.get<string>('search.serpApiKey', '');
    const serpStackKey = config.get<string>('search.serpStackKey', '');

    // Respect provider preference
    if (provider === 'serpapi') {
      if (!serpApiKey) {
        throw new Error(
          'Provider set to SerpAPI but no API key configured. Set forgeai.search.serpApiKey.'
        );
      }
      return this.searchSerpAPI(query, serpApiKey);
    }

    if (provider === 'serpstack') {
      if (!serpStackKey) {
        throw new Error(
          'Provider set to SerpStack but no API key configured. Set forgeai.search.serpStackKey.'
        );
      }
      return this.searchSerpStack(query, serpStackKey);
    }

    // Auto: try SerpAPI first, then SerpStack
    if (serpApiKey) {
      try {
        return await this.searchSerpAPI(query, serpApiKey);
      } catch (err) {
        console.warn('SerpAPI search failed, trying SerpStack:', err);
      }
    }

    if (serpStackKey) {
      try {
        return await this.searchSerpStack(query, serpStackKey);
      } catch (err) {
        console.warn('SerpStack search failed:', err);
      }
    }

    // No API keys configured
    throw new Error(
      'No web search API key configured. ' +
        'Set forgeai.search.serpApiKey or forgeai.search.serpStackKey in VS Code settings.'
    );
  }

  /**
   * Search via SerpAPI (Google Search API)
   * https://serpapi.com/
   */
  private async searchSerpAPI(query: string, apiKey: string): Promise<SearchResponse> {
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('q', query);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('num', '10');

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      throw new Error(`SerpAPI HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const organic = (data.organic_results as Array<Record<string, string>>) || [];

    return {
      query,
      totalResults:
        ((data.search_information as Record<string, unknown>)?.total_results as number) ||
        organic.length,
      results: organic.slice(0, 10).map((r, i) => ({
        title: r.title || '',
        url: r.link || r.url || '',
        snippet: r.snippet || r.description || '',
        position: i + 1,
      })),
      source: 'serpapi',
    };
  }

  /**
   * Search via SerpStack (Real-time SERP API)
   * https://serpstack.com/
   */
  private async searchSerpStack(query: string, apiKey: string): Promise<SearchResponse> {
    const url = new URL('http://api.serpstack.com/search');
    url.searchParams.set('query', query);
    url.searchParams.set('access_key', apiKey);
    url.searchParams.set('num', '10');

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      throw new Error(`SerpStack HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const organic = (data.organic_results as Array<Record<string, string>>) || [];

    return {
      query,
      totalResults:
        ((data.search_information as Record<string, unknown>)?.total_results as number) ||
        organic.length,
      results: organic.slice(0, 10).map((r, i) => ({
        title: r.title || '',
        url: r.url || r.link || '',
        snippet: r.snippet || r.description || '',
        position: i + 1,
      })),
      source: 'serpstack',
    };
  }

  /**
   * Tool: forgeai_webSearch
   * Perform a general web search query
   */
  public webSearch(): Tool {
    return {
      name: 'forgeai_webSearch',
      description:
        'Search the web and return result URLs with snippets. ' +
        'After this tool returns, you MUST call forgeai_fetchPage(url) on EVERY URL from the results ' +
        'to get the FULL page content before responding to the user. ' +
        'You are NOT allowed to summarize search snippets — only fetched page content.',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description:
              'The search query (e.g., "React useEffect documentation", "TypeScript generic constraints")',
          },
        },
      },
      execute: async (args: { query: string }) => {
        const result = await this.performSearch(args.query);

        // ─── Auto-fetch top 3 URLs for real content ───
        const topUrls = result.results.slice(0, 3);
        const fetchedPages: Array<{
          title: string;
          url: string;
          content: string;
          truncated: boolean;
          method: string;
          status?: number | null;
        }> = [];
        let fetchSuccess = 0;
        let fetchFailed = 0;

        for (const r of topUrls) {
          try {
            const page = await this.fetchPageContent(r.url, 4000);
            fetchedPages.push({
              title: page.title,
              url: page.url,
              content: page.content,
              truncated: page.truncated,
              method: page.method,
              status: page.status,
            });
            fetchSuccess++;
          } catch (err) {
            fetchFailed++;
            fetchedPages.push({
              title: r.title,
              url: r.url,
              content: `[Fetch failed: ${err instanceof Error ? err.message : String(err)}]`,
              truncated: false,
              method: 'error',
            });
          }
        }

        // ─── Persist findings to ResearchCache for reuse by ResearchAgent ───
        const findings: ResearchFinding[] = [
          ...result.results.slice(0, 5).map((r) => ({
            source: 'web' as const,
            query: args.query,
            text: `${r.title}\n${r.snippet}`,
            url: r.url,
            relevanceScore: 0.5,
            retrievedAt: Date.now(),
          })),
          ...fetchedPages
            .filter((p) => p.method !== 'error')
            .map((p) => ({
              source: 'web-page' as const,
              query: args.query,
              text: `📄 ${p.title}\n${p.content}`,
              url: p.url,
              relevanceScore: 0.85,
              retrievedAt: Date.now(),
            })),
          {
            source: 'web' as const,
            query: args.query,
            text: `📊 Fetch summary: ${fetchSuccess} fetched, ${fetchFailed} failed (attempted ${fetchSuccess + fetchFailed}).`,
            relevanceScore: 0.0,
            retrievedAt: Date.now(),
          },
        ];
        this.saveResearchReport(args.query, findings, 1);

        return {
          success: true,
          query: result.query,
          source: result.source,
          totalResults: result.totalResults,
          results: result.results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
          })),
          fetchedContent: fetchedPages,
          fetchSummary: `${fetchSuccess} fetched, ${fetchFailed} failed (attempted ${fetchSuccess + fetchFailed})`,
          formatted:
            `## Search Results for "${args.query}"\n\n` +
            result.results
              .map((r) => `${r.position}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
              .join('\n\n') +
            `\n\n---\n\n## Fetched Page Content (${fetchSuccess} success, ${fetchFailed} failed)\n\n` +
            fetchedPages
              .map(
                (p) =>
                  `### ${p.title} (${p.method})\nURL: ${p.url}\n\n${p.content.slice(0, 3000)}${p.content.length > 3000 ? '\n\n... [truncated in summary]' : ''}`
              )
              .join('\n\n---\n\n') +
            `\n\n---\n\n` +
            `⚠️ MANDATORY NEXT STEP: The above auto-fetched content is ONLY a preview/summary. ` +
            `You MUST now call forgeai_fetchPage(url) on EVERY critical URL from the search results ` +
            `to get the FULL documentation, complete API references, code examples, and version numbers. ` +
            `Do NOT respond to the user until you have fetched the critical pages. ` +
            `Critical URLs to fetch: ${result.results
              .slice(0, 5)
              .map((r) => r.url)
              .join(', ')}`,
        };
      },
    };
  }

  /**
   * Tool: forgeai_webResearch
   * Deep research by searching multiple related queries and aggregating results
   */
  public webResearch(): Tool {
    return {
      name: 'forgeai_webResearch',
      description:
        'DISCOVERY phase — finds URLs and gets surface-level snippets. ' +
        'After this tool returns, you MUST call forgeai_fetchPage(url) on EVERY URL from the results ' +
        'to get the FULL page content before responding to the user. ' +
        'You are NOT allowed to summarize search snippets — only fetched page content.',
      inputSchema: {
        type: 'object',
        required: ['topic'],
        properties: {
          topic: {
            type: 'string',
            description:
              'The research topic or question (e.g., "Next.js App Router vs Pages Router")',
          },
          subQueries: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional specific sub-queries to run (max 3). If omitted, the tool will generate them.',
          },
        },
      },
      execute: async (args: { topic: string; subQueries?: string[] }) => {
        const queries = args.subQueries?.slice(0, 3) || [
          args.topic,
          `${args.topic} documentation`,
          `${args.topic} best practices`,
        ];

        const allResults: SearchResult[] = [];
        const seenUrls = new Set<string>();

        for (const q of queries.slice(0, 3)) {
          try {
            const result = await this.performSearch(q);
            for (const r of result.results) {
              if (!seenUrls.has(r.url)) {
                seenUrls.add(r.url);
                allResults.push(r);
              }
            }
          } catch {
            // Skip failed queries, continue with others
          }
        }

        // ─── Auto-fetch top URLs for real content ───
        const topUrls = allResults.slice(0, 5);
        const fetchedPages: Array<{
          title: string;
          url: string;
          content: string;
          truncated: boolean;
          method: string;
          status?: number | null;
        }> = [];
        let fetchSuccess = 0;
        let fetchFailed = 0;

        for (const r of topUrls) {
          try {
            const page = await this.fetchPageContent(r.url, 4000);
            fetchedPages.push({
              title: page.title,
              url: page.url,
              content: page.content,
              truncated: page.truncated,
              method: page.method,
              status: page.status,
            });
            fetchSuccess++;
          } catch (err) {
            fetchFailed++;
            fetchedPages.push({
              title: r.title,
              url: r.url,
              content: `[Fetch failed: ${err instanceof Error ? err.message : String(err)}]`,
              truncated: false,
              method: 'error',
            });
          }
        }

        // ─── Persist findings to ResearchCache for reuse by ResearchAgent ───
        const findings: ResearchFinding[] = [
          ...allResults.slice(0, 15).map((r) => ({
            source: 'web' as const,
            query: args.topic,
            text: `${r.title}\n${r.snippet}`,
            url: r.url,
            relevanceScore: 0.5,
            retrievedAt: Date.now(),
          })),
          ...fetchedPages
            .filter((p) => p.method !== 'error')
            .map((p) => ({
              source: 'web-page' as const,
              query: args.topic,
              text: `📄 ${p.title}\n${p.content}`,
              url: p.url,
              relevanceScore: 0.85,
              retrievedAt: Date.now(),
            })),
          {
            source: 'web' as const,
            query: args.topic,
            text: `📊 Fetch summary: ${fetchSuccess} fetched, ${fetchFailed} failed (attempted ${fetchSuccess + fetchFailed}). Queries run: ${queries.slice(0, 3).length}.`,
            relevanceScore: 0.0,
            retrievedAt: Date.now(),
          },
        ];
        this.saveResearchReport(args.topic, findings, queries.slice(0, 3).length);

        return {
          success: true,
          topic: args.topic,
          queriesRun: queries.length,
          uniqueResults: allResults.length,
          results: allResults.slice(0, 15).map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
          })),
          fetchedContent: fetchedPages,
          fetchSummary: `${fetchSuccess} fetched, ${fetchFailed} failed (attempted ${fetchSuccess + fetchFailed})`,
          formatted:
            `## Search Results for "${args.topic}"\n\n` +
            allResults
              .slice(0, 15)
              .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
              .join('\n\n') +
            `\n\n---\n\n## Fetched Page Content (${fetchSuccess} success, ${fetchFailed} failed)\n\n` +
            fetchedPages
              .map(
                (p) =>
                  `### ${p.title} (${p.method})\nURL: ${p.url}\n\n${p.content.slice(0, 3000)}${p.content.length > 3000 ? '\n\n... [truncated in summary]' : ''}`
              )
              .join('\n\n---\n\n') +
            `\n\n---\n\n` +
            `⚠️ MANDATORY NEXT STEP: The above auto-fetched content is ONLY a preview/summary. ` +
            `You MUST now call forgeai_fetchPage(url) on EVERY critical URL from the search results ` +
            `to get the FULL documentation, complete API references, code examples, and version numbers. ` +
            `Do NOT respond to the user until you have fetched the critical pages. ` +
            `Critical URLs to fetch: ${allResults
              .slice(0, 5)
              .map((r) => r.url)
              .join(', ')}`,
        };
      },
    };
  }

  /**
   * Tool: forgeai_searchDocs
   * Search documentation for a specific library or framework
   */
  public searchDocs(): Tool {
    return {
      name: 'forgeai_searchDocs',
      description:
        'Search for official documentation using cloud APIs (no local browser needed). ' +
        'Optimized for finding docs, tutorials, and reference pages. ' +
        'Use this instead of browser tools when looking up library or framework documentation.',
      inputSchema: {
        type: 'object',
        required: ['library'],
        properties: {
          library: {
            type: 'string',
            description: 'Library or framework name (e.g., "React", "Django", "TensorFlow")',
          },
          topic: {
            type: 'string',
            description:
              'Specific topic within the library (e.g., "hooks", "routing", "authentication")',
          },
        },
      },
      execute: async (args: { library: string; topic?: string }) => {
        const query = args.topic
          ? `${args.library} ${args.topic} documentation site:${args.library.toLowerCase()}.dev OR site:docs.${args.library.toLowerCase()}.com`
          : `${args.library} documentation official`;

        const result = await this.performSearch(query);
        return {
          success: true,
          library: args.library,
          topic: args.topic || 'general',
          results: result.results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
          })),
          formatted: result.results
            .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
            .join('\n\n'),
        };
      },
    };
  }

  /**
   * Tool: forgeai_fetchPage
   * Fetch the actual HTML content of a web page and extract readable text.
   * Use this AFTER webSearch/webResearch to get real documentation content,
   * best practices, or GitHub READMEs — not just search snippets.
   */
  public fetchPage(): Tool {
    return {
      name: 'forgeai_fetchPage',
      description:
        'MANDATORY follow-up after webSearch/webResearch. ' +
        'Fetches the FULL HTML content of a URL, extracts readable text, and returns it in chunks. ' +
        'Call this tool for EVERY relevant URL you find to get REAL documentation, ' +
        'best practices, GitHub READMEs, API references — not just search snippets. ' +
        'If the page has more content, use the offset parameter to fetch the next chunk. ' +
        'NO local browser needed. Works immediately.',
      inputSchema: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            description: 'Full URL to fetch (e.g., "https://react.dev/learn/thinking-in-react")',
          },
          maxLength: {
            type: 'number',
            description: 'Characters per chunk (default: 15000, max: 25000)',
          },
          offset: {
            type: 'number',
            description:
              'Character offset for pagination. Start at 0, then use nextOffset from the previous response to get the next chunk.',
          },
        },
      },
      execute: async (args: { url: string; maxLength?: number; offset?: number }) => {
        const maxLen = Math.min(args.maxLength ?? 15000, 25000);
        const offset = args.offset ?? 0;

        // Fetch the FULL page content (no internal truncation)
        const page = await this.fetchPageContent(args.url, Number.MAX_SAFE_INTEGER);

        const totalLength = page.content.length;
        const chunk = page.content.slice(offset, offset + maxLen);
        const hasMore = offset + maxLen < totalLength;
        const nextOffset = hasMore ? offset + maxLen : null;

        return {
          success: true,
          url: page.url,
          title: page.title,
          content: chunk,
          offset,
          length: chunk.length,
          totalLength,
          hasMore,
          nextOffset,
          truncated: hasMore,
          method: page.method,
        };
      },
    };
  }

  /**
   * Extract readable text from raw HTML using simple heuristics.
   */
  private extractTextFromHtml(html: string): string {
    // Remove script and style blocks
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

    // Try to extract from main content areas first
    const mainMatch =
      text.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
      text.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
      text.match(/<div[^>]*class=["']content["'][^>]*>([\s\S]*?)<\/div>/i) ||
      text.match(/<div[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/div>/i) ||
      text.match(/<div[^>]*class=["']documentation["'][^>]*>([\s\S]*?)<\/div>/i);

    if (mainMatch) {
      text = mainMatch[1];
    }

    // Convert common block elements to newlines
    text = text
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n');

    // Strip all remaining tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&hellip;/g, '...')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–');

    // Clean up whitespace
    text = text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    return text;
  }

  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return match ? match[1].trim() : '';
  }

  /**
   * Fetch actual page content for a URL — used by ResearchAgent to get
   * real documentation content, not just search snippets.
   *
   * Strategy:
   *  1. Try simple fetch first (fast, no overhead)
   *  2. If fetch fails OR returns empty content, fallback to Playwright
   *     (real browser — handles Cloudflare, JS-rendered docs, cookies)
   */
  public async fetchPageContent(
    url: string,
    maxLength = 8000
  ): Promise<{
    title: string;
    content: string;
    url: string;
    truncated: boolean;
    method: 'fetch' | 'playwright';
    status?: number | null;
  }> {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${urlObj.protocol}`);
    }

    // ─── Attempt 1: Simple fetch (fast, no browser startup cost) ───
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
        },
      });

      if (response.ok) {
        const html = await response.text();
        let text = this.extractTextFromHtml(html);

        // If content looks substantial, return it immediately
        if (text.length > 200) {
          const truncated = text.length > maxLength;
          if (truncated) {
            text = text.slice(0, maxLength) + '\n\n... [truncated]';
          }
          return {
            url,
            title: this.extractTitle(html),
            content: text,
            truncated,
            method: 'fetch',
          };
        }
        // Empty/short content — likely a Cloudflare challenge or JS-rendered shell
        // Fall through to Playwright
      }
    } catch {
      // fetch failed — try Playwright
    }

    // ─── Attempt 2: Playwright fallback (real browser with anti-bot) ───
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
      });

      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      const page = await context.newPage();

      try {
        // Add a small random delay to mimic human behavior
        await page.waitForTimeout(Math.floor(Math.random() * 500) + 200);

        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });

        // Wait for network to settle, then extra time for JS hydration
        await page.waitForLoadState('networkidle', { timeout: 15000 });
        await page.waitForTimeout(2500);

        const title = await page.title();

        // Extract main content with multiple fallback strategies
        const text = await page.evaluate(() => {
          const selectors = [
            'main',
            'article',
            '[role="main"]',
            '.content',
            '.documentation',
            '#content',
            '.markdown-body',
            '.prose',
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent && el.textContent.trim().length > 200) {
              return (el as HTMLElement).innerText;
            }
          }
          // Fallback: body minus noise
          const body = document.body.cloneNode(true) as HTMLElement;
          body
            .querySelectorAll(
              'nav, header, footer, aside, script, style, noscript, .ads, .cookie-banner'
            )
            .forEach((el) => el.remove());
          return body.innerText;
        });

        let content = text;
        const truncated = content.length > maxLength;
        if (truncated) {
          content = content.slice(0, maxLength) + '\n\n... [truncated]';
        }

        return {
          url: page.url(),
          title,
          content,
          truncated,
          method: 'playwright',
          status: response?.status() ?? null,
        };
      } finally {
        await browser.close();
      }
    } catch (playwrightErr) {
      throw new Error(
        `Both fetch and Playwright failed for ${url}. ` +
          `Playwright error: ${playwrightErr instanceof Error ? playwrightErr.message : String(playwrightErr)}`
      );
    }
  }
}
