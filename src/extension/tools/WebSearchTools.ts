import * as vscode from 'vscode';
import { Tool } from './ToolRegistry';
import { ResearchCache } from '../agents/research/ResearchCache';
import { ContentCleaner } from '../utils/ContentCleaner';

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
  authorityScore?: number;
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
   * DEPRECATED: WebSearchTools no longer writes to ResearchCache.
   * ResearchAgent is the sole writer for research reports to avoid
   * duplicate/topic-only entries. Kept for API compatibility only.
   */

  /**
   * Score a URL by domain authority for research purposes.
   * Higher score = more authoritative source.
   */
  private scoreUrlAuthority(url: string): number {
    const domain = new URL(url).hostname.toLowerCase();
    const scores: Record<string, number> = {
      // Tier 1: Official docs, GitHub, StackOverflow
      'github.com': 10, 'stackoverflow.com': 10, 'docs.google.com': 10,
      'developer.mozilla.org': 10, 'react.dev': 10, 'reactjs.org': 10,
      'nextjs.org': 10, 'tailwindcss.com': 10, 'typescriptlang.org': 10,
      'nodejs.org': 10, 'python.org': 10, 'docs.python.org': 10,
      'learn.microsoft.com': 10, 'docs.aws.amazon.com': 10,
      'kubernetes.io': 10, 'angular.io': 10, 'vuejs.org': 10,
      'svelte.dev': 10, 'vitejs.dev': 10, 'webpack.js.org': 10,
      'jestjs.io': 10, 'vitest.dev': 10, 'cypress.io': 10,
      'redux.js.org': 10, 'graphql.org': 10, 'swagger.io': 10,
      'openapi.org': 10, 'postgresql.org': 10, 'mongodb.com': 10,
      'redis.io': 10, 'docker.com': 10,
      'linux.die.net': 10, 'man7.org': 10,
      // Tier 2: Quality tech resources
      'dev.to': 8, 'medium.com': 7, 'hashnode.dev': 8,
      'css-tricks.com': 8, 'smashingmagazine.com': 8,
      'martinfowler.com': 9, 'infoq.com': 8, 'academic.microsoft.com': 9,
      'arxiv.org': 9, 'w3.org': 10, 'web.dev': 10,
      'youtube.com': 5, 'www.youtube.com': 5,
      // Tier 3: Forums (useful but less authoritative)
      'reddit.com': 4, 'news.ycombinator.com': 6, 'lobste.rs': 6,
      'discord.com': 3, 'discourse.org': 4,
    };
    // Exact match
    if (scores[domain]) return scores[domain];
    // Subdomain match (e.g., docs.example.com)
    const parts = domain.split('.');
    if (parts.length > 2) {
      const baseDomain = parts.slice(-2).join('.');
      if (scores[baseDomain]) return scores[baseDomain] - 1;
    }
    // .dev or .org bonus
    if (domain.endsWith('.dev') || domain.endsWith('.org')) return 7;
    // .io bonus (common in tech)
    if (domain.endsWith('.io')) return 6;
    // .com default
    if (domain.endsWith('.com')) return 3;
    return 1;
  }

  /**
   * Filter and sort results by domain authority.
   * Low-quality sources (social media, unknown blogs) are excluded unless no alternatives exist.
   */
  private filterByQuality(results: SearchResult[]): SearchResult[] {
    const scored = results
      .map((r) => ({ ...r, authorityScore: this.scoreUrlAuthority(r.url) }))
      .filter((r) => r.authorityScore >= 3); // Exclude very low quality

    if (scored.length === 0) return results; // Fallback to all if filter removes everything

    // Sort by authority score descending, then position
    scored.sort((a, b) => b.authorityScore - a.authorityScore || a.position - b.position);
    return scored;
  }

  /**
   * Build optimized search queries targeting authoritative sources.
   */
  private buildResearchQueries(topic: string, subQueries?: string[]): string[] {
    const baseQueries = subQueries?.slice(0, 3) || [
      topic,
      `${topic} official documentation API reference`,
      `${topic} API examples site:react.dev OR site:nextjs.org OR site:docs.python.org OR site:nodejs.org OR site:typescriptlang.org`,
    ];
    // Enhance queries to target authoritative sources
    return baseQueries.map((q) => {
      if (!q.includes('site:')) {
        return `${q} site:github.com OR site:stackoverflow.com OR site:*.dev OR site:*.org OR site:learn.microsoft.com OR site:docs.google.com`;
      }
      return q;
    }).slice(0, 3);
  }

  /**
   * Perform a web search using available APIs (SerpAPI -> SerpStack fallback)
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
      } catch {
        console.warn('SerpAPI search failed, trying SerpStack');
      }
    }

    if (serpStackKey) {
      try {
        return await this.searchSerpStack(query, serpStackKey);
      } catch {
        console.warn('SerpStack search failed');
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
        'Search the web and return only real fetched content. ' +
        'Every result includes the full page content from the URL. ' +
        'Do NOT call forgeai_fetchPage after this -- content is already included.',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'The search query (e.g., "React useEffect documentation", "TypeScript generic constraints")',
          },
        },
      },
      execute: async (args: { query: string }) => {
        const result = await this.performSearch(args.query);

        const qualityFiltered = this.filterByQuality(result.results);
        const targets = qualityFiltered.slice(0, 5);
        const fetchedPages: Array<{ title: string; url: string; content: string; truncated: boolean; method: string; status?: number | null }> = [];

        for (const r of targets) {
          try {
            const page = await this.fetchPageContent(r.url, 15000);
            fetchedPages.push({
              title: page.title,
              url: page.url,
              content: page.content,
              truncated: page.truncated,
              method: page.method,
              status: page.status,
            });
          } catch {
            fetchedPages.push({
              title: r.title,
              url: r.url,
              content: '',
              truncated: false,
              method: 'error',
              status: 0,
            });
          }
        }

        return {
          success: true,
          query: result.query,
          source: result.source,
          totalResults: result.totalResults,
          qualityFiltered: targets.map((r) => {
            const { authorityScore: _authorityScore, ...rest } = r;
            return rest;
          }),
          fetchedContent: fetchedPages,
          pagesFetched: fetchedPages.filter((p) => p.method !== 'error').length,
          formatted: `## Research: ${args.query}\n\nSearched and fetched ${fetchedPages.length} pages. Below is the FULL CONTENT of each page.\n\n${fetchedPages.map((p, i) => `### [${i + 1}] ${p.title}\nURL: ${p.url}\nMethod: ${p.method}${p.truncated ? '\n(Content truncated -- full version cached)' : ''}\n\n${p.content || '[No content fetched]'}`).join('\n\n---\n\n')}`,
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
        'Deep research fetching FULL page content from official docs, API references, and GitHub READMEs. ' +
        'Returns actual documentation content -- not just snippets. ' +
        'Use for: latest API docs, code examples, version-specific features, official guides.',
      inputSchema: {
        type: 'object',
        required: ['topic'],
        properties: {
          topic: {
            type: 'string',
            description: 'The research topic or question (e.g., "Next.js App Router vs Pages Router")',
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
        const queries = args.subQueries && args.subQueries.length > 0
          ? args.subQueries.slice(0, 3)
          : [
              args.topic + ' official documentation API reference',
              args.topic + ' API examples site:react.dev OR site:nextjs.org OR site:docs.python.org OR site:nodejs.org OR site:typescriptlang.org',
              args.topic + ' code examples github README',
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

        // Auto-fetch top URLs for real content
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
          } catch {
            fetchFailed++;
            fetchedPages.push({
              title: r.title,
              url: r.url,
              content: '[Fetch failed]',
              truncated: false,
              method: 'error',
            });
          }
        }

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
            `WARNING: The above auto-fetched content is ONLY a preview/summary. ` +
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
   * best practices, or GitHub READMEs -- not just search snippets.
   */
  public fetchPage(): Tool {
    return {
      name: 'forgeai_fetchPage',
      description:
        'MANDATORY follow-up after webSearch/webResearch. ' +
        'Fetches the FULL HTML content of a URL, extracts readable text, and returns it in chunks. ' +
        'Call this tool for EVERY relevant URL you find to get REAL documentation, ' +
        'best practices, GitHub READMEs, API references -- not just search snippets. ' +
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
      .replace(/&mdash;/g, '--')
      .replace(/&ndash;/g, '-');

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
   * Fetch actual page content for a URL -- used by ResearchAgent to get
   * real documentation content, not just search snippets.
   *
   * Strategy:
   *  1. Check cache for cleaned content (no expiration, per-project)
   *  2. If not cached, try simple fetch first (fast, no overhead)
   *  3. If fetch fails OR returns empty content, fallback to Playwright
   *     (real browser -- handles Cloudflare, JS-rendered docs, cookies)
   *  4. Clean content before caching
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

    // Check cache first (no expiration, per-project)
    const cache = this.getResearchCache();
    if (cache) {
      const cachedContent = cache.getPageContent(url);
      if (cachedContent) {
        const truncated = cachedContent.length > maxLength;
        const content = truncated
          ? cachedContent.slice(0, maxLength) + '\n\n... [truncated]'
          : cachedContent;
        return {
          url,
          title: url,
          content,
          truncated,
          method: 'fetch',
        };
      }
    }

    let fetchedContent: string | null = null;
    let fetchedTitle: string | null = null;
    let fetchMethod: 'fetch' | 'playwright' = 'fetch';

    // Attempt 1: Simple fetch (fast, no browser startup cost)
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
        const text = this.extractTextFromHtml(html);

        // If content looks substantial, use it
        if (text.length > 200) {
          fetchedContent = text;
          fetchedTitle = this.extractTitle(html);
          fetchMethod = 'fetch';
        }
        // Empty/short content -- likely a Cloudflare challenge or JS-rendered shell
        // Fall through to Playwright
      }
    } catch {
      // fetch failed -- try Playwright
    }

    // Attempt 2: Playwright fallback (real browser with anti-bot)
    if (!fetchedContent) {
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

          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
          });

          // Wait for network to settle, then extra time for JS hydration
          await page.waitForLoadState('networkidle', { timeout: 15000 });
          await page.waitForTimeout(2500);

          fetchedTitle = await page.title();

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

          fetchedContent = text;
          fetchMethod = 'playwright';
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

    // Clean content before caching
    const cleanedContent = ContentCleaner.cleanContent(fetchedContent || '');

    // Cache cleaned content (no expiration, per-project)
    if (cache && cleanedContent) {
      cache.setPageContent(url, cleanedContent);
    }

    // Return result
    const truncated = cleanedContent.length > maxLength;
    const content = truncated
      ? cleanedContent.slice(0, maxLength) + '\n\n... [truncated]'
      : cleanedContent;

    return {
      url,
      title: fetchedTitle || url,
      content,
      truncated,
      method: fetchMethod,
    };
  }
}
