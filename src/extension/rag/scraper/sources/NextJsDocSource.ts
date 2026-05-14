import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class NextJsDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'nextjs';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      {
        title: 'Next.js - Getting Started',
        url: 'https://nextjs.org/docs/app/getting-started/installation',
      },
      {
        title: 'Next.js - App Router',
        url: 'https://nextjs.org/docs/app/building-your-application/routing',
      },
      {
        title: 'Next.js - Pages and Layouts',
        url: 'https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts',
      },
      {
        title: 'Next.js - Data Fetching',
        url: 'https://nextjs.org/docs/app/building-your-application/data-fetching/fetching',
      },
      {
        title: 'Next.js - Server Components',
        url: 'https://nextjs.org/docs/app/building-your-application/rendering/server-components',
      },
      {
        title: 'Next.js - Client Components',
        url: 'https://nextjs.org/docs/app/building-your-application/rendering/client-components',
      },
      {
        title: 'Next.js - API Routes',
        url: 'https://nextjs.org/docs/app/building-your-application/routing/route-handlers',
      },
      {
        title: 'Next.js - Middleware',
        url: 'https://nextjs.org/docs/app/building-your-application/routing/middleware',
      },
      {
        title: 'Next.js - Image Optimization',
        url: 'https://nextjs.org/docs/app/building-your-application/optimizing/images',
      },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://nextjs.org/docs/app/getting-started/installation'],
      urlFilter: (url) => url.startsWith('https://nextjs.org/docs/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
