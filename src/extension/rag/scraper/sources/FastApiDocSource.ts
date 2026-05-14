import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class FastApiDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'fastapi';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'FastAPI - Introduction', url: 'https://fastapi.tiangolo.com/' },
      { title: 'FastAPI - First Steps', url: 'https://fastapi.tiangolo.com/tutorial/first-steps/' },
      {
        title: 'FastAPI - Path Parameters',
        url: 'https://fastapi.tiangolo.com/tutorial/path-params/',
      },
      {
        title: 'FastAPI - Query Parameters',
        url: 'https://fastapi.tiangolo.com/tutorial/query-params/',
      },
      { title: 'FastAPI - Request Body', url: 'https://fastapi.tiangolo.com/tutorial/body/' },
      {
        title: 'FastAPI - Dependencies',
        url: 'https://fastapi.tiangolo.com/tutorial/dependencies/',
      },
      { title: 'FastAPI - Security', url: 'https://fastapi.tiangolo.com/tutorial/security/' },
      { title: 'FastAPI - Async', url: 'https://fastapi.tiangolo.com/async/' },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://fastapi.tiangolo.com/tutorial/'],
      urlFilter: (url) => url.startsWith('https://fastapi.tiangolo.com/tutorial/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
