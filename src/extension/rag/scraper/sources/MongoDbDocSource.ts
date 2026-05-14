import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class MongoDbDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'mongodb';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'MongoDB - Introduction', url: 'https://www.mongodb.com/docs/manual/introduction/' },
      {
        title: 'MongoDB - Getting Started',
        url: 'https://www.mongodb.com/docs/manual/tutorial/getting-started/',
      },
      { title: 'MongoDB - Documents', url: 'https://www.mongodb.com/docs/manual/core/document/' },
      { title: 'MongoDB - CRUD Operations', url: 'https://www.mongodb.com/docs/manual/crud/' },
      { title: 'MongoDB - Aggregation', url: 'https://www.mongodb.com/docs/manual/aggregation/' },
      { title: 'MongoDB - Indexes', url: 'https://www.mongodb.com/docs/manual/indexes/' },
      {
        title: 'MongoDB - Schema Validation',
        url: 'https://www.mongodb.com/docs/manual/core/schema-validation/',
      },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://www.mongodb.com/docs/manual/introduction/'],
      urlFilter: (url) => url.startsWith('https://www.mongodb.com/docs/manual/'),
      maxPages: 30,
      maxDepth: 2,
    };
  }
}
