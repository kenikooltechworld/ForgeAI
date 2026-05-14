import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';
import type { CrawlConfig } from '../LinkCrawler';

export class ReactJsDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'reactjs';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      { title: 'React - Quick Start', url: 'https://react.dev/learn' },
      { title: 'React - Describing the UI', url: 'https://react.dev/learn/describing-the-ui' },
      {
        title: 'React - Adding Interactivity',
        url: 'https://react.dev/learn/adding-interactivity',
      },
      { title: 'React - Managing State', url: 'https://react.dev/learn/managing-state' },
      { title: 'React Hooks - useState', url: 'https://react.dev/reference/react/useState' },
      { title: 'React Hooks - useEffect', url: 'https://react.dev/reference/react/useEffect' },
      { title: 'React Hooks - useCallback', url: 'https://react.dev/reference/react/useCallback' },
      { title: 'React Hooks - useMemo', url: 'https://react.dev/reference/react/useMemo' },
      { title: 'React Hooks - useRef', url: 'https://react.dev/reference/react/useRef' },
      { title: 'React Hooks - useContext', url: 'https://react.dev/reference/react/useContext' },
      { title: 'React Hooks - useReducer', url: 'https://react.dev/reference/react/useReducer' },
      {
        title: 'React - Components and Props',
        url: 'https://react.dev/learn/passing-props-to-a-component',
      },
    ]);
  }

  public getCrawlConfig(): CrawlConfig {
    return {
      entryUrls: ['https://react.dev/learn'],
      urlFilter: (url) => url.startsWith('https://react.dev/'),
      maxPages: 40,
      maxDepth: 2,
    };
  }
}
