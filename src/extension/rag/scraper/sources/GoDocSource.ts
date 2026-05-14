import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class GoDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'go';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'Go - Effective Go', url: 'https://go.dev/doc/effective_go' },
      { title: 'Go - Getting Started', url: 'https://go.dev/doc/tutorial/getting-started' },
      { title: 'Go - Tour of Go', url: 'https://go.dev/tour/welcome/1' },
      { title: 'Go - Standard Library', url: 'https://pkg.go.dev/std' },
      { title: 'Go - Error Handling', url: 'https://go.dev/blog/error-handling-and-go' },
      { title: 'Go - Concurrency', url: 'https://go.dev/tour/concurrency/1' },
      { title: 'Go - Modules', url: 'https://go.dev/doc/tutorial/getting-started' },
      { title: 'Go - Interfaces', url: 'https://go.dev/tour/methods/9' },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://go.dev/doc/effective_go'],
      urlFilter: (url) => url.startsWith('https://go.dev/doc/'),
      maxPages: 30,
      maxDepth: 2,
    };
  }
}
