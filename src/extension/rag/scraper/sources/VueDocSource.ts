import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class VueDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'vuejs';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'Vue.js - Introduction', url: 'https://vuejs.org/guide/introduction.html' },
      {
        title: 'Vue.js - Reactivity Fundamentals',
        url: 'https://vuejs.org/guide/essentials/reactivity-fundamentals.html',
      },
      {
        title: 'Vue.js - Computed Properties',
        url: 'https://vuejs.org/guide/essentials/computed.html',
      },
      {
        title: 'Vue.js - Lifecycle Hooks',
        url: 'https://vuejs.org/guide/essentials/lifecycle.html',
      },
      {
        title: 'Vue.js - Template Syntax',
        url: 'https://vuejs.org/guide/essentials/template-syntax.html',
      },
      {
        title: 'Vue.js - Components',
        url: 'https://vuejs.org/guide/essentials/component-basics.html',
      },
      {
        title: 'Vue.js - Composables',
        url: 'https://vuejs.org/guide/reusability/composables.html',
      },
      {
        title: 'Vue.js - Pinia State Management',
        url: 'https://pinia.vuejs.org/introduction.html',
      },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://vuejs.org/guide/introduction.html'],
      urlFilter: (url) => url.startsWith('https://vuejs.org/guide/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
