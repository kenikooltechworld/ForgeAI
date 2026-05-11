export type DocSourceId =
  | 'reactjs'
  | 'python'
  | 'go'
  | 'javascript'
  | 'tailwindcss'
  | 'shadcn'
  | 'chakra-ui'
  | string;

export interface ScrapedDocPage {
  sourceId: DocSourceId;
  url: string;
  title?: string;
  rawHtml: string;
  extractedText: string;
  scrapedAtMs: number;
  /** Stable fingerprint of extractedText to support diff/replace logic */
  contentHash: string;
}

export interface CleanedChunk {
  sourceId: DocSourceId;
  url: string;
  title?: string;
  contentHash: string;
  chunkId: string;

  /** Chunk text to embed */
  text: string;

  /** Basic provenance */
  chunkIndex: number;
  totalChunksHint?: number;
}

export interface RagRetrievedContext {
  chunkId: string;
  sourceId: DocSourceId;
  url: string;
  title?: string;
  contentHash: string;
  text: string;

  /** Retrieval score from the vector DB */
  score: number;
}

export interface RagEmbeddingJobMeta {
  sourceId: DocSourceId;
  url: string;
  contentHash: string;
  /** When this was produced/ingested */
  ingestedAtMs: number;
}

export interface RagStoreUpsertResult {
  upserted: number;
  skippedSame: number;
}

export interface RAGSearchParams {
  query: string;
  topK: number;
  /** Optional allow/deny lists */
  sourceIds?: DocSourceId[];
}
