import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class PythonDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'python';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'Python - Tutorial', url: 'https://docs.python.org/3/tutorial/index.html' },
      {
        title: 'Python - Built-in Functions',
        url: 'https://docs.python.org/3/library/functions.html',
      },
      {
        title: 'Python - Data Structures',
        url: 'https://docs.python.org/3/tutorial/datastructures.html',
      },
      { title: 'Python - Classes', url: 'https://docs.python.org/3/tutorial/classes.html' },
      {
        title: 'Python - Errors and Exceptions',
        url: 'https://docs.python.org/3/tutorial/errors.html',
      },
      { title: 'Python - Modules', url: 'https://docs.python.org/3/tutorial/modules.html' },
      {
        title: 'Python - Decorators',
        url: 'https://docs.python.org/3/glossary.html#term-decorator',
      },
      { title: 'Python - Asyncio', url: 'https://docs.python.org/3/library/asyncio.html' },
      { title: 'Python - Type Hints', url: 'https://docs.python.org/3/library/typing.html' },
      {
        title: 'Python - Comprehensions',
        url: 'https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions',
      },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://docs.python.org/3/tutorial/index.html'],
      urlFilter: (url) => url.startsWith('https://docs.python.org/3/'),
      maxPages: 50,
      maxDepth: 2,
    };
  }
}
