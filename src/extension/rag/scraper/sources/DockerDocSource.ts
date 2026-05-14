import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class DockerDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'docker';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      {
        title: 'Docker - Get Started Overview',
        url: 'https://docs.docker.com/get-started/overview/',
      },
      {
        title: 'Docker - Dockerfile Reference',
        url: 'https://docs.docker.com/engine/reference/builder/',
      },
      { title: 'Docker - Docker Compose', url: 'https://docs.docker.com/compose/' },
      { title: 'Docker - Networking', url: 'https://docs.docker.com/engine/network/' },
      { title: 'Docker - Volumes', url: 'https://docs.docker.com/engine/storage/volumes/' },
      {
        title: 'Docker - CLI Reference',
        url: 'https://docs.docker.com/engine/reference/commandline/docker/',
      },
      { title: 'Docker - BuildKit', url: 'https://docs.docker.com/build/buildkit/' },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://docs.docker.com/get-started/overview/'],
      urlFilter: (url) => url.startsWith('https://docs.docker.com/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
