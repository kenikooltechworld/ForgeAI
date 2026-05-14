import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';

export class ZustandDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'zustand';

  public listUrls(): Promise<Array<{ url: string; title?: string }>> {
    return Promise.resolve([
      {
        title: 'Zustand - Getting Started',
        url: 'https://github.com/pmndrs/zustand/blob/main/docs/guides/getting-started.md',
      },
      {
        title: 'Zustand - Updating State',
        url: 'https://github.com/pmndrs/zustand/blob/main/docs/guides/updating-state.md',
      },
      {
        title: 'Zustand - Slices Pattern',
        url: 'https://github.com/pmndrs/zustand/blob/main/docs/guides/slices-pattern.md',
      },
      {
        title: 'Zustand - Middleware',
        url: 'https://github.com/pmndrs/zustand/blob/main/docs/guides/middleware-and-immer.md',
      },
      {
        title: 'Zustand - Persist Middleware',
        url: 'https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md',
      },
      {
        title: 'Zustand - TypeScript',
        url: 'https://github.com/pmndrs/zustand/blob/main/docs/guides/typescript.md',
      },
    ]);
  }
}
