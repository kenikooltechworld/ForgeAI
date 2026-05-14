import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class TailwindCssDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'tailwindcss';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'Tailwind CSS - Installation', url: 'https://tailwindcss.com/docs/installation' },
      { title: 'Tailwind CSS - Utility-First', url: 'https://tailwindcss.com/docs/utility-first' },
      { title: 'Tailwind CSS - Flexbox', url: 'https://tailwindcss.com/docs/flex' },
      { title: 'Tailwind CSS - Grid', url: 'https://tailwindcss.com/docs/grid-template-columns' },
      {
        title: 'Tailwind CSS - Responsive Design',
        url: 'https://tailwindcss.com/docs/responsive-design',
      },
      { title: 'Tailwind CSS - Dark Mode', url: 'https://tailwindcss.com/docs/dark-mode' },
      { title: 'Tailwind CSS - Configuration', url: 'https://tailwindcss.com/docs/configuration' },
      { title: 'Tailwind CSS - Colors', url: 'https://tailwindcss.com/docs/customizing-colors' },
      { title: 'Tailwind CSS - Typography', url: 'https://tailwindcss.com/docs/font-size' },
      { title: 'Tailwind CSS - Spacing', url: 'https://tailwindcss.com/docs/padding' },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://tailwindcss.com/docs/installation'],
      urlFilter: (url) => url.startsWith('https://tailwindcss.com/docs/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
