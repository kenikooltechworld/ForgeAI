import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class ViteDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'vite';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'Vite - Getting Started', url: 'https://vitejs.dev/guide/' },
      { title: 'Vite - Features', url: 'https://vitejs.dev/guide/features.html' },
      { title: 'Vite - Build', url: 'https://vitejs.dev/guide/build.html' },
      { title: 'Vite - SSR', url: 'https://vitejs.dev/guide/ssr.html' },
      { title: 'Vite - Config Reference', url: 'https://vitejs.dev/config/' },
      { title: 'Vite - Plugin API', url: 'https://vitejs.dev/guide/api-plugin.html' },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://vitejs.dev/guide/'],
      urlFilter: (url) => url.startsWith('https://vitejs.dev/guide/'),
      maxPages: 30,
      maxDepth: 2,
    };
  }
}
