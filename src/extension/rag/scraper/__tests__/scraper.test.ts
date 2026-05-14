/**
 * Scraper pipeline tests
 * Covers: ContentHasher, MvpScrapePlanner, ReaderModeDocCleaner,
 *         SimpleRecursiveTextChunker, ReactJsDocSource, HttpHtmlFetcher, ScraperRunner
 */

import { Sha256ContentHasher } from '../Sha256ContentHasher';
import { MvpScrapePlanner } from '../MvpScrapePlanner';
import { HttpHtmlFetcher } from '../HttpHtmlFetcher';
import { ReactJsDocSource } from '../sources/ReactJsDocSource';
import { ReaderModeDocCleaner } from '../../cleaner/ReaderModeDocCleaner';
import { SimpleRecursiveTextChunker } from '../../chunker/SimpleRecursiveTextChunker';
import { ScraperRunner } from '../ScraperRunner';
import type { HtmlFetcher } from '../HtmlFetcher';
import type { ScrapePlanner } from '../ScrapePlanner';
import type { ContentHasher } from '../ContentHasher';
import type { DocCleaner } from '../../cleaner/DocCleaner';
import type { RagChunker } from '../../chunker/Chunker';
import type { RagStore } from '../../store/RagStore';

// ─────────────────────────────────────────────
// Sha256ContentHasher
// ─────────────────────────────────────────────
describe('Sha256ContentHasher', () => {
  const hasher = new Sha256ContentHasher();

  it('returns a 64-char hex string for normal input', async () => {
    const { hash } = await hasher.hash({ text: 'hello world' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic – same input produces same hash', async () => {
    const a = await hasher.hash({ text: 'ForgeAI rocks' });
    const b = await hasher.hash({ text: 'ForgeAI rocks' });
    expect(a.hash).toBe(b.hash);
  });

  it('produces different hashes for different inputs', async () => {
    const a = await hasher.hash({ text: 'foo' });
    const b = await hasher.hash({ text: 'bar' });
    expect(a.hash).not.toBe(b.hash);
  });

  it('handles empty string without throwing', async () => {
    const { hash } = await hasher.hash({ text: '' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ─────────────────────────────────────────────
// MvpScrapePlanner
// ─────────────────────────────────────────────
describe('MvpScrapePlanner', () => {
  const planner = new MvpScrapePlanner();

  it('returns all candidates unchanged', async () => {
    const candidates = [
      { url: 'https://example.com/a', title: 'A' },
      { url: 'https://example.com/b', title: 'B' },
    ];
    const result = await planner.plan({ sourceId: 'reactjs', candidates, nowMs: Date.now() });
    expect(result).toEqual(candidates);
  });

  it('returns empty array when candidates is empty', async () => {
    const result = await planner.plan({ sourceId: 'reactjs', candidates: [], nowMs: Date.now() });
    expect(result).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// ReactJsDocSource
// ─────────────────────────────────────────────
describe('ReactJsDocSource', () => {
  const source = new ReactJsDocSource();

  it('has sourceId "reactjs"', () => {
    expect(source.sourceId).toBe('reactjs');
  });

  it('returns a non-empty list of URLs', async () => {
    const urls = await source.listUrls();
    expect(urls.length).toBeGreaterThan(0);
  });

  it('all returned URLs start with https://', async () => {
    const urls = await source.listUrls();
    for (const entry of urls) {
      expect(entry.url).toMatch(/^https:\/\//);
    }
  });

  it('every entry has a title string', async () => {
    const urls = await source.listUrls();
    for (const entry of urls) {
      expect(typeof entry.title).toBe('string');
    }
  });
});

// ─────────────────────────────────────────────
// ReaderModeDocCleaner
// ─────────────────────────────────────────────
describe('ReaderModeDocCleaner', () => {
  const cleaner = new ReaderModeDocCleaner();

  const makeHtml = (body: string) =>
    `<html><head><script>alert("x")</script><style>.a{}</style></head><body>${body}</body></html>`;

  it('extracts plain text from a simple paragraph', async () => {
    const html = makeHtml('<p>Hello from ForgeAI</p>');
    const { extractedText } = await cleaner.clean({
      sourceId: 'reactjs',
      url: 'https://example.com',
      rawHtml: html,
    });
    expect(extractedText).toContain('Hello from ForgeAI');
  });

  it('strips script and style content', async () => {
    const html = makeHtml('<p>Keep this</p><script>var x = 1;</script><style>.bad{}</style>');
    const { extractedText } = await cleaner.clean({
      sourceId: 'reactjs',
      url: 'https://example.com',
      rawHtml: html,
    });
    expect(extractedText).not.toContain('var x = 1');
    expect(extractedText).not.toContain('.bad');
  });

  it('strips nav/header/footer elements', async () => {
    const html = makeHtml(
      '<nav>Go home</nav><header>Site header</header><main><p>Real content</p></main><footer>Footer stuff</footer>'
    );
    const { extractedText } = await cleaner.clean({
      sourceId: 'reactjs',
      url: 'https://example.com',
      rawHtml: html,
    });
    expect(extractedText).toContain('Real content');
    expect(extractedText).not.toContain('Go home');
    expect(extractedText).not.toContain('Site header');
    expect(extractedText).not.toContain('Footer stuff');
  });

  it('returns empty string for empty body', async () => {
    const { extractedText } = await cleaner.clean({
      sourceId: 'reactjs',
      url: 'https://example.com',
      rawHtml: '<html><body></body></html>',
    });
    expect(extractedText).toBe('');
  });

  it('preserves code blocks', async () => {
    const html = makeHtml('<pre><code>const x = 42;</code></pre>');
    const { extractedText } = await cleaner.clean({
      sourceId: 'reactjs',
      url: 'https://example.com',
      rawHtml: html,
    });
    expect(extractedText).toContain('const x = 42');
  });
});

// ─────────────────────────────────────────────
// SimpleRecursiveTextChunker
// ─────────────────────────────────────────────
describe('SimpleRecursiveTextChunker', () => {
  it('returns a single chunk for short text', async () => {
    const chunker = new SimpleRecursiveTextChunker({ maxChars: 500, overlapChars: 50 });
    const chunks = await chunker.chunk({
      sourceId: 'reactjs',
      url: 'https://example.com',
      contentHash: 'abc123',
      extractedText: 'Short text',
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Short text');
  });

  it('splits long text into multiple chunks', async () => {
    // maxChars is clamped to Math.max(200, value) internally, so use 200 explicitly
    // and provide text > 200 chars to guarantee at least 2 chunks.
    const chunker = new SimpleRecursiveTextChunker({ maxChars: 200, overlapChars: 0 });
    const text = 'x'.repeat(500); // 500 chars -> at least 2 chunks of 200
    const chunks = await chunker.chunk({
      sourceId: 'reactjs',
      url: 'https://example.com',
      contentHash: 'abc123',
      extractedText: text,
    });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('each chunk has a unique chunkId', async () => {
    const chunker = new SimpleRecursiveTextChunker({ maxChars: 10, overlapChars: 0 });
    const text = 'abcdefghijklmnopqrstuvwxyz';
    const chunks = await chunker.chunk({
      sourceId: 'reactjs',
      url: 'https://example.com',
      contentHash: 'abc123',
      extractedText: text,
    });
    const ids = chunks.map((c) => c.chunkId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chunkIndex increments from 0', async () => {
    const chunker = new SimpleRecursiveTextChunker({ maxChars: 10, overlapChars: 0 });
    const chunks = await chunker.chunk({
      sourceId: 'reactjs',
      url: 'https://example.com',
      contentHash: 'abc123',
      extractedText: '1234567890ABCDEFGHIJ',
    });
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('returns empty array for empty text', async () => {
    const chunker = new SimpleRecursiveTextChunker({ maxChars: 200, overlapChars: 20 });
    const chunks = await chunker.chunk({
      sourceId: 'reactjs',
      url: 'https://example.com',
      contentHash: 'abc123',
      extractedText: '   ',
    });
    expect(chunks).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// HttpHtmlFetcher (fetch is mocked globally)
// ─────────────────────────────────────────────
describe('HttpHtmlFetcher', () => {
  const fetcher = new HttpHtmlFetcher();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns rawHtml on successful fetch', async () => {
    const mockHtml = '<html><body><p>React docs</p></body></html>';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    } as unknown as Response);

    const { rawHtml } = await fetcher.fetch({
      sourceId: 'reactjs',
      url: 'https://react.dev/reference/react/useState',
    });
    expect(rawHtml).toBe(mockHtml);
  });

  it('throws on non-OK HTTP status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    } as unknown as Response);

    await expect(
      fetcher.fetch({ sourceId: 'reactjs', url: 'https://react.dev/missing' })
    ).rejects.toThrow(/HTTP 404/);
  });

  it('sends correct User-Agent header', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html></html>',
    } as unknown as Response);

    await fetcher.fetch({ sourceId: 'reactjs', url: 'https://react.dev/test' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://react.dev/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('ForgeAI-RAG'),
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────
// ScraperRunner (integration with mocked deps)
// ─────────────────────────────────────────────
describe('ScraperRunner', () => {
  const makeRunner = (
    overrides: Partial<{
      urls: Array<{ url: string; title?: string }>;
      fetchHtml: string;
      existingHash: string;
    }> = {}
  ) => {
    const urls = overrides.urls ?? [{ url: 'https://example.com/page', title: 'Page' }];
    const fetchHtml = overrides.fetchHtml ?? '<html><body><p>Content here</p></body></html>';

    const mockSource = {
      sourceId: 'reactjs' as const,
      listUrls: jest.fn().mockResolvedValue(urls),
    };

    const mockFetcher: HtmlFetcher = {
      fetch: jest.fn().mockResolvedValue({ rawHtml: fetchHtml }),
    };

    const mockPlanner: ScrapePlanner = {
      plan: jest.fn().mockImplementation(async ({ candidates }) => candidates),
    };

    const mockHasher: ContentHasher = {
      hash: jest.fn().mockResolvedValue({ hash: 'fakehash123' }),
    };

    const mockCleaner: DocCleaner = {
      clean: jest.fn().mockResolvedValue({ extractedText: 'cleaned content' }),
    };

    const mockChunker: RagChunker = {
      chunk: jest
        .fn()
        .mockResolvedValue([{ chunkId: 'c1', chunkIndex: 0, text: 'cleaned content' }]),
    };

    const mockStore: RagStore = {
      upsertChunks: jest.fn().mockResolvedValue({ upserted: 1, skippedSame: 0 }),
      search: jest.fn(),
    } as unknown as RagStore;

    const runner = new ScraperRunner({
      sources: [mockSource],
      fetcher: mockFetcher,
      planner: mockPlanner,
      hasher: mockHasher,
      cleaner: mockCleaner,
      chunker: mockChunker,
      store: mockStore,
    });

    return {
      runner,
      mockSource,
      mockFetcher,
      mockPlanner,
      mockHasher,
      mockCleaner,
      mockChunker,
      mockStore,
    };
  };

  it('returns pages with correct structure', async () => {
    const { runner } = makeRunner();
    const { pages } = await runner.run({ sourceId: 'reactjs' });

    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      sourceId: 'reactjs',
      url: 'https://example.com/page',
      title: 'Page',
      contentHash: 'fakehash123',
      extractedText: 'cleaned content',
    });
    expect(pages[0].rawHtml).toContain('Content here');
  });

  it('calls all pipeline stages once per URL', async () => {
    const { runner, mockFetcher, mockPlanner, mockHasher, mockCleaner, mockChunker, mockStore } =
      makeRunner();
    await runner.run({ sourceId: 'reactjs' });

    expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
    expect(mockPlanner.plan).toHaveBeenCalledTimes(1);
    expect(mockHasher.hash).toHaveBeenCalledTimes(1);
    expect(mockCleaner.clean).toHaveBeenCalledTimes(1);
    expect(mockChunker.chunk).toHaveBeenCalledTimes(1);
    expect(mockStore.upsertChunks).toHaveBeenCalledTimes(1);
  });

  it('processes multiple URLs', async () => {
    const { runner, mockFetcher } = makeRunner({
      urls: [
        { url: 'https://example.com/a', title: 'A' },
        { url: 'https://example.com/b', title: 'B' },
      ],
    });
    const { pages } = await runner.run({ sourceId: 'reactjs' });

    expect(pages).toHaveLength(2);
    expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws when sourceId has no registered source', async () => {
    const { runner } = makeRunner();
    await expect(runner.run({ sourceId: 'python' })).rejects.toThrow(
      /No DocSource registered for sourceId="python"/
    );
  });

  it('returns upsert stats from the store', async () => {
    const { runner } = makeRunner();
    const { chunksUpsert } = await runner.run({ sourceId: 'reactjs' });

    expect(chunksUpsert).toEqual({ upserted: 1, skippedSame: 0 });
  });

  it('returns empty pages and zero upserts when planner returns no URLs', async () => {
    const mockSource = { sourceId: 'reactjs' as const, listUrls: jest.fn().mockResolvedValue([]) };
    const mockStore: RagStore = {
      upsertChunks: jest.fn().mockResolvedValue({ upserted: 0, skippedSame: 0 }),
      search: jest.fn(),
    } as unknown as RagStore;

    const runner = new ScraperRunner({
      sources: [mockSource],
      fetcher: { fetch: jest.fn() },
      planner: { plan: jest.fn().mockResolvedValue([]) },
      hasher: { hash: jest.fn() },
      cleaner: { clean: jest.fn() },
      chunker: { chunk: jest.fn().mockResolvedValue([]) },
      store: mockStore,
    });

    const { pages, chunksUpsert } = await runner.run({ sourceId: 'reactjs' });
    expect(pages).toHaveLength(0);
    expect(chunksUpsert).toEqual({ upserted: 0, skippedSame: 0 });
  });
});
