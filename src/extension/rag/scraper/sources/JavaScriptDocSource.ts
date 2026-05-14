import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class JavaScriptDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'javascript';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'JavaScript.info - The JavaScript Language', url: 'https://javascript.info/js' },
      {
        title: 'JavaScript.info - Arrow Functions',
        url: 'https://javascript.info/arrow-functions',
      },
      { title: 'JavaScript.info - Promises', url: 'https://javascript.info/promise-basics' },
      { title: 'JavaScript.info - Async/Await', url: 'https://javascript.info/async-await' },
      { title: 'JavaScript.info - Array Methods', url: 'https://javascript.info/array-methods' },
      { title: 'JavaScript.info - Objects', url: 'https://javascript.info/object' },
      {
        title: 'JavaScript.info - Destructuring',
        url: 'https://javascript.info/destructuring-assignment',
      },
      { title: 'JavaScript.info - Modules', url: 'https://javascript.info/modules-intro' },
      { title: 'JavaScript.info - Classes', url: 'https://javascript.info/class' },
      { title: 'JavaScript.info - Fetch', url: 'https://javascript.info/fetch' },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://javascript.info/js'],
      urlFilter: (url) => url.startsWith('https://javascript.info/'),
      maxPages: 50,
      maxDepth: 2,
    };
  }
}
