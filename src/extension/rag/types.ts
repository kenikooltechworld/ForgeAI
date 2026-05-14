export type DocSourceId =
  // Development docs
  | 'reactjs'
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'nodejs'
  | 'go'
  | 'rust'
  | 'nextjs'
  | 'vuejs'
  | 'express'
  | 'fastapi'
  | 'tailwindcss'
  | 'shadcn'
  | 'prisma'
  | 'vite'
  | 'docker'
  | 'git'
  | 'postgresql'
  | 'mongodb'
  | 'vscode-api'
  | 'zustand'
  | 'chakra-ui'
  // Design system docs (UI/UX Architect Agent)
  | 'material-design-3'
  | 'apple-hig'
  | 'wcag-guidelines'
  | 'tailwind-docs'
  | 'design-patterns'
  | 'animation-patterns'
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
