import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class ShadcnUiDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'shadcn';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'shadcn/ui - Introduction', url: 'https://ui.shadcn.com/docs' },
      { title: 'shadcn/ui - Installation', url: 'https://ui.shadcn.com/docs/installation' },
      { title: 'shadcn/ui - Theming', url: 'https://ui.shadcn.com/docs/theming' },
      { title: 'shadcn/ui - Button', url: 'https://ui.shadcn.com/docs/components/button' },
      { title: 'shadcn/ui - Dialog', url: 'https://ui.shadcn.com/docs/components/dialog' },
      { title: 'shadcn/ui - Form', url: 'https://ui.shadcn.com/docs/components/form' },
      { title: 'shadcn/ui - Table', url: 'https://ui.shadcn.com/docs/components/table' },
      { title: 'shadcn/ui - Select', url: 'https://ui.shadcn.com/docs/components/select' },
      { title: 'shadcn/ui - Toast', url: 'https://ui.shadcn.com/docs/components/toast' },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://ui.shadcn.com/docs'],
      urlFilter: (url) => url.startsWith('https://ui.shadcn.com/docs/'),
      maxPages: 30,
      maxDepth: 2,
    };
  }
}
