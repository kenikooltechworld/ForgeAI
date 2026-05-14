import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class NodeJsDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'nodejs';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      {
        title: 'Node.js - Getting Started',
        url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs',
      },
      { title: 'Node.js - File System', url: 'https://nodejs.org/api/fs.html' },
      { title: 'Node.js - Path', url: 'https://nodejs.org/api/path.html' },
      { title: 'Node.js - HTTP', url: 'https://nodejs.org/api/http.html' },
      { title: 'Node.js - Events', url: 'https://nodejs.org/api/events.html' },
      { title: 'Node.js - Streams', url: 'https://nodejs.org/api/stream.html' },
      { title: 'Node.js - Child Processes', url: 'https://nodejs.org/api/child_process.html' },
      { title: 'Node.js - Buffer', url: 'https://nodejs.org/api/buffer.html' },
      { title: 'Node.js - Crypto', url: 'https://nodejs.org/api/crypto.html' },
      { title: 'Node.js - Process', url: 'https://nodejs.org/api/process.html' },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://nodejs.org/en/learn/getting-started/introduction-to-nodejs'],
      urlFilter: (url) => url.startsWith('https://nodejs.org/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
