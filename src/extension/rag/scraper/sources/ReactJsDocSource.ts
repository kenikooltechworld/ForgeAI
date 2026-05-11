import type { DocSource } from '../DocSource';
import type { DocSourceId } from '../../types';

export class ReactJsDocSource implements DocSource {
  public readonly sourceId: DocSourceId = 'reactjs';

  public async listUrls(): Promise<Array<{ url: string; title?: string }>> {
    // MVP: small curated set; expand later.
    return [
      { title: 'React Hooks - useState', url: 'https://react.dev/reference/react/useState' },
      { title: 'React Hooks - useEffect', url: 'https://react.dev/reference/react/useEffect' },
      { title: 'React Hooks - useMemo', url: 'https://react.dev/reference/react/useMemo' },
    ];
  }
}
