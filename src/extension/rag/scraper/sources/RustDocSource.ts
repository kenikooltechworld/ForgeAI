import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class RustDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'rust';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'Rust - The Book', url: 'https://doc.rust-lang.org/book/' },
      { title: 'Rust - Ownership', url: 'https://doc.rust-lang.org/book/ch04-00-ownership.html' },
      {
        title: 'Rust - Lifetimes',
        url: 'https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html',
      },
      {
        title: 'Rust - Error Handling',
        url: 'https://doc.rust-lang.org/book/ch09-00-error-handling.html',
      },
      { title: 'Rust - Cargo', url: 'https://doc.rust-lang.org/cargo/' },
      { title: 'Rust - Standard Library', url: 'https://doc.rust-lang.org/std/' },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://doc.rust-lang.org/book/'],
      urlFilter: (url) => url.startsWith('https://doc.rust-lang.org/book/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
