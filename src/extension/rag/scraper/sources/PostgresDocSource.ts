import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class PostgresDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'postgresql';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      {
        title: 'PostgreSQL - Introduction',
        url: 'https://www.postgresql.org/docs/current/intro-whatis.html',
      },
      {
        title: 'PostgreSQL - SQL Syntax',
        url: 'https://www.postgresql.org/docs/current/sql-syntax.html',
      },
      {
        title: 'PostgreSQL - Data Types',
        url: 'https://www.postgresql.org/docs/current/datatype.html',
      },
      {
        title: 'PostgreSQL - Functions',
        url: 'https://www.postgresql.org/docs/current/functions.html',
      },
      {
        title: 'PostgreSQL - Indexes',
        url: 'https://www.postgresql.org/docs/current/indexes.html',
      },
      {
        title: 'PostgreSQL - Query Planning',
        url: 'https://www.postgresql.org/docs/current/performance-tips.html',
      },
      {
        title: 'PostgreSQL - Transactions',
        url: 'https://www.postgresql.org/docs/current/tutorial-transactions.html',
      },
      {
        title: 'PostgreSQL - Joins',
        url: 'https://www.postgresql.org/docs/current/tutorial-join.html',
      },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://www.postgresql.org/docs/current/intro-whatis.html'],
      urlFilter: (url) => url.startsWith('https://www.postgresql.org/docs/current/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
