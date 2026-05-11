import type { DocSourceId, RagRetrievedContext } from './types';
import type { RagStore } from './store/RagStore';

export interface RagService {
  retrieve(params: {
    query: string;
    topK: number;
    sourceIds?: DocSourceId[];
  }): Promise<RagRetrievedContext[]>;
}

export class RagServiceImpl implements RagService {
  constructor(private readonly store: RagStore) {}

  public async retrieve(params: {
    query: string;
    topK: number;
    sourceIds?: DocSourceId[];
  }): Promise<RagRetrievedContext[]> {
    return this.store.search({
      query: params.query,
      topK: params.topK,
      sourceIds: params.sourceIds,
    });
  }
}
