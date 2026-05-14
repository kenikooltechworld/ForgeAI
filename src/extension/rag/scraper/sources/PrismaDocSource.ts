import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class PrismaDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'prisma';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'Prisma - Introduction', url: 'https://www.prisma.io/docs/orm' },
      { title: 'Prisma - Schema', url: 'https://www.prisma.io/docs/orm/prisma-schema/overview' },
      {
        title: 'Prisma - Data Model',
        url: 'https://www.prisma.io/docs/orm/prisma-schema/data-model/models',
      },
      {
        title: 'Prisma - Client Queries',
        url: 'https://www.prisma.io/docs/orm/prisma-client/queries',
      },
      {
        title: 'Prisma - CRUD Operations',
        url: 'https://www.prisma.io/docs/orm/prisma-client/queries/crud',
      },
      {
        title: 'Prisma - Relations',
        url: 'https://www.prisma.io/docs/orm/prisma-schema/data-model/relations',
      },
      {
        title: 'Prisma - Migrations',
        url: 'https://www.prisma.io/docs/orm/prisma-migrate/getting-started',
      },
      {
        title: 'Prisma - Filtering and Sorting',
        url: 'https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting',
      },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://www.prisma.io/docs/orm'],
      urlFilter: (url) => url.startsWith('https://www.prisma.io/docs/orm/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
