import type { CleanedChunk, RagRetrievedContext, RAGSearchParams, RagStoreUpsertResult } from '../types';

export interface RagStore {
  /**
   * Upsert (or skip) chunks based on contentHash.
   * If chunk already exists with same contentHash, it should be skipped.
   */
  upsertChunks(chunks: CleanedChunk[]): Promise<RagStoreUpsertResult>;

  /**
   * Search by query text; store should embed query internally (via embeddings service).
   */
  search(params: RAGSearchParams): Promise<RagRetrievedContext[]>;
}
