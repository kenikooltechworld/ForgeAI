import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class GitDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'git';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'Git - Reference', url: 'https://git-scm.com/docs' },
      {
        title: 'Git - Book Chapter 1',
        url: 'https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control',
      },
      {
        title: 'Git - Branching',
        url: 'https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell',
      },
      {
        title: 'Git - Merging',
        url: 'https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging',
      },
      { title: 'Git - Rebasing', url: 'https://git-scm.com/book/en/v2/Git-Branching-Rebasing' },
      {
        title: 'Git - Remote Branches',
        url: 'https://git-scm.com/book/en/v2/Git-Branching-Remote-Branches',
      },
      {
        title: 'Git - Stashing',
        url: 'https://git-scm.com/book/en/v2/Git-Tools-Stashing-and-Cleaning',
      },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control'],
      urlFilter: (url) => url.startsWith('https://git-scm.com/book/en/v2/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
