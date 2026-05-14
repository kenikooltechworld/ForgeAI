import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class ExpressDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'express';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      {
        title: 'Express - Getting Started',
        url: 'https://expressjs.com/en/starter/installing.html',
      },
      {
        title: 'Express - Basic Routing',
        url: 'https://expressjs.com/en/starter/basic-routing.html',
      },
      { title: 'Express - Routing Guide', url: 'https://expressjs.com/en/guide/routing.html' },
      {
        title: 'Express - Middleware',
        url: 'https://expressjs.com/en/guide/using-middleware.html',
      },
      {
        title: 'Express - Error Handling',
        url: 'https://expressjs.com/en/guide/error-handling.html',
      },
      { title: 'Express - Request Object', url: 'https://expressjs.com/en/4x/api.html#req' },
      { title: 'Express - Response Object', url: 'https://expressjs.com/en/4x/api.html#res' },
      { title: 'Express - Router', url: 'https://expressjs.com/en/4x/api.html#router' },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://expressjs.com/en/starter/installing.html'],
      urlFilter: (url) => url.startsWith('https://expressjs.com/en/'),
      maxPages: 30,
      maxDepth: 2,
    };
  }
}
