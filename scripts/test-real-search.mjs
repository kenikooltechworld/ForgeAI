/**
 * REAL end-to-end test — uses actual SerpAPI + Playwright
 * No mocks, no placeholders. Tests what ForgeAI would actually do.
 */

const SERP_API_KEY = process.env.SERP_API_KEY;
const SERP_STACK_KEY = process.env.SERP_STACK_KEY;

// ─── 1. REAL SerpAPI search ───
async function searchSerpAPI(query) {
  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', SERP_API_KEY);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('num', '10');

  console.log(`\n🔍 Searching SerpAPI: "${query}"...`);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);

  const data = await res.json();
  const results = (data.organic_results || []).map((r, i) => ({
    title: r.title || '',
    url: r.link || r.url || '',
    snippet: r.snippet || r.description || '',
    position: i + 1,
  }));

  console.log(`   ✅ ${results.length} results`);
  results.slice(0, 5).forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.title}`);
    console.log(`      ${r.url}`);
  });
  return results;
}

// ─── 2. REAL fetchPageContent (direct fetch + Playwright fallback) ───
async function fetchPageContent(url, maxLength = 8000) {
  console.log(`\n📄 Fetching: ${url}`);

  // Attempt 1: Direct fetch
  try {
    const res = await fetch(url, {
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
      },
    });

    if (res.ok) {
      const html = await res.text();
      const text = extractTextFromHtml(html);
      if (text.length > 200) {
        const truncated = text.length > maxLength;
        console.log(
          `   ✅ Direct fetch success (${text.length} chars, ${truncated ? 'truncated' : 'full'})`
        );
        return {
          title: extractTitle(html),
          content: truncated ? text.slice(0, maxLength) + '\n\n... [truncated]' : text,
          url,
          method: 'fetch',
          truncated,
        };
      }
      console.log('   ⚠️ Direct fetch returned short content, trying Playwright...');
    }
  } catch (err) {
    console.log(`   ⚠️ Direct fetch failed: ${err.message}`);
  }

  // Attempt 2: Playwright
  console.log('   🎭 Launching Playwright...');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const html = await page.content();
    const text = extractTextFromHtml(html);
    const title = await page.title();
    const truncated = text.length > maxLength;
    console.log(
      `   ✅ Playwright success (${text.length} chars, ${truncated ? 'truncated' : 'full'})`
    );
    await browser.close();
    return {
      title,
      content: truncated ? text.slice(0, maxLength) + '\n\n... [truncated]' : text,
      url,
      method: 'playwright',
      truncated,
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

function extractTextFromHtml(html) {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

  const mainMatch =
    text.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    text.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    text.match(/<div[^>]*class=["']content["'][^>]*>([\s\S]*?)<\/div>/i) ||
    text.match(/<div[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/div>/i);
  if (mainMatch) text = mainMatch[1];

  text = text
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return text;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return m ? m[1].trim() : '';
}

// ─── Main test ───
async function run() {
  if (!SERP_API_KEY) {
    console.error(
      '❌ Set SERP_API_KEY env var. Your key is in VS Code settings > ForgeAI > Search: Serp Api Key'
    );
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('REAL ForgeAI Web Search + Fetch Test');
  console.log('='.repeat(70));

  // Query: React latest version 2026
  const query = 'React latest version 2026';
  const results = await searchSerpAPI(query);

  if (results.length === 0) {
    console.log('\n❌ No search results');
    return;
  }

  // Fetch top 3 URLs for real content
  console.log('\n' + '='.repeat(70));
  console.log('Fetching top 3 URLs with REAL content...');
  console.log('='.repeat(70));

  for (let i = 0; i < Math.min(3, results.length); i++) {
    const r = results[i];
    try {
      const page = await fetchPageContent(r.url, 3000);
      console.log(`\n📌 RESULT ${i + 1}: ${page.title || r.title}`);
      console.log(`   URL: ${page.url}`);
      console.log(`   Method: ${page.method}`);
      console.log(`   Content preview (first 800 chars):`);
      console.log('-'.repeat(60));
      console.log(page.content.slice(0, 800));
      console.log('-'.repeat(60));
    } catch (err) {
      console.log(`\n❌ Failed to fetch ${r.url}: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Test complete.');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
