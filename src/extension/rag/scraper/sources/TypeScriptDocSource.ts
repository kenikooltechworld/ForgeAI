import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class TypeScriptDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'typescript';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      {
        title: 'TypeScript - Handbook',
        url: 'https://www.typescriptlang.org/docs/handbook/intro.html',
      },
      {
        title: 'TypeScript - Basic Types',
        url: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html',
      },
      {
        title: 'TypeScript - Functions',
        url: 'https://www.typescriptlang.org/docs/handbook/2/functions.html',
      },
      {
        title: 'TypeScript - Object Types',
        url: 'https://www.typescriptlang.org/docs/handbook/2/objects.html',
      },
      {
        title: 'TypeScript - Generics',
        url: 'https://www.typescriptlang.org/docs/handbook/2/generics.html',
      },
      {
        title: 'TypeScript - Type Narrowing',
        url: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html',
      },
      {
        title: 'TypeScript - Modules',
        url: 'https://www.typescriptlang.org/docs/handbook/2/modules.html',
      },
      {
        title: 'TypeScript - Enums',
        url: 'https://www.typescriptlang.org/docs/handbook/enums.html',
      },
      {
        title: 'TypeScript - Utility Types',
        url: 'https://www.typescriptlang.org/docs/handbook/utility-types.html',
      },
      {
        title: 'TypeScript - Decorators',
        url: 'https://www.typescriptlang.org/docs/handbook/decorators.html',
      },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://www.typescriptlang.org/docs/handbook/intro.html'],
      urlFilter: (url) => url.startsWith('https://www.typescriptlang.org/docs/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
