import type { CleanedChunk } from '../types';

export interface RagChunker {
  /**
   * Converts extracted/cleaned text into embeddable chunks.
   */
  chunk(params: {
    sourceId: string;
    url: string;
    title?: string;
    contentHash: string;
    extractedText: string;
  }): Promise<Omit<CleanedChunk, 'sourceId' | 'url' | 'title' | 'contentHash'>[]>;
}
