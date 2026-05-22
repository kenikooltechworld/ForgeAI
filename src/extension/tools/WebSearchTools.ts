import * as vscode from 'vscode';
import { Tool } from './ToolRegistry';

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
        'MANDATORY fallback when RAG documentation is insufficient. ' +
        'Search the web using cloud APIs (SerpAPI/SerpStack). ' +
        'NO local browser needed. ' +
        'Call this tool WHENEVER: ' +
        '(1) The RAG context in your system prompt does not contain the information you need, ' +
        '(2) You need current best practices, latest versions, or 2026 documentation, ' +
        '(3) You are planning a feature and need to verify technology choices. ' +
        'Returns top search results with titles, URLs, and snippets. ' +
        'AFTER getting search results, you MUST call forgeai_fetchPage(url) for the most relevant URLs to get the ACTUAL content — not just snippets.',
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
          formatted: result.results
            .map((r) => `${r.position}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
            .join('\n\n'),
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
        'MANDATORY deep research before creating any spec or plan. ' +
        'Runs multiple related queries and aggregates results. ' +
        'Call this tool WHENEVER: ' +
        '(1) The user asks you to plan, design, or architect a feature, ' +
        '(2) You need comprehensive context on a technology (Python, React, database, etc.), ' +
        '(3) RAG documentation is missing or insufficient for the topic. ' +
        'This tool finds current best practices, latest versions, security recommendations, and architecture patterns. ' +
        'Always call this BEFORE forgeai_createSpec. ' +
        'AFTER getting results, you MUST call forgeai_fetchPage(url) for the most relevant URLs to get the ACTUAL documentation content — not just snippets.',
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
          formatted: allResults
            .slice(0, 15)
            .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
            .join('\n\n'),
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
        'Fetches the actual HTML content of a URL and extracts readable text. ' +
        'Call this tool for EVERY relevant URL you find to get REAL documentation, ' +
        'best practices, GitHub READMEs, API references — not just search snippets. ' +
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
            description: 'Maximum characters to return (default: 8000)',
          },
        },
      },
      execute: async (args: { url: string; maxLength?: number }) => {
        const maxLen = args.maxLength ?? 8000;

        // Validate URL
        let url: URL;
        try {
          url = new URL(args.url);
        } catch {
          throw new Error(`Invalid URL: ${args.url}`);
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error(`Unsupported protocol: ${url.protocol}`);
        }

        // Fetch the page
        const response = await fetch(url.toString(), {
          signal: AbortSignal.timeout(15000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();

        // Extract readable text from HTML
        let text = this.extractTextFromHtml(html);

        // Truncate if too long
        const truncated = text.length > maxLen;
        if (truncated) {
          text =
            text.slice(0, maxLen) + '\n\n... [truncated — content exceeds ' + maxLen + ' chars]';
        }

        return {
          success: true,
          url: args.url,
          title: this.extractTitle(html),
          content: text,
          length: text.length,
          truncated,
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
}
