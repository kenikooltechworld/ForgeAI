import crypto from 'crypto';
import type { RagChunker } from './Chunker';
import type { CleanedChunk } from '../types';

export interface SimpleChunkerOptions {
  maxChars: number;
  overlapChars: number;
}

function stableHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Simple, deterministic chunker based on character windows with overlap.
 * (MVP: good enough until we add language-aware/AST chunking for code.)
 */
export class SimpleRecursiveTextChunker implements RagChunker {
  private readonly options: SimpleChunkerOptions;

  constructor(options: SimpleChunkerOptions) {
    this.options = options;
  }

  public async chunk(params: {
    sourceId: string;
    url: string;
    title?: string;
    contentHash: string;
    extractedText: string;
  }): Promise<Omit<CleanedChunk, 'sourceId' | 'url' | 'title' | 'contentHash'>[]> {
    const { extractedText, url, contentHash } = params;

    const text = extractedText.trim();
    if (text.length === 0) return [];

    const maxChars = Math.max(200, this.options.maxChars);
    const overlapChars = Math.max(0, Math.min(this.options.overlapChars, Math.floor(maxChars / 3)));

    const result: Array<Omit<CleanedChunk, 'sourceId' | 'url' | 'title' | 'contentHash'>> = [];

    let start = 0;
    let chunkIndex = 0;
    while (start < text.length) {
      const end = Math.min(text.length, start + maxChars);
      const slice = text.slice(start, end);

      const chunkId = stableHash(`${url}:${contentHash}:${chunkIndex}:${slice.length}`);

      result.push({
        chunkId,
        chunkIndex,
        text: slice,
        totalChunksHint: undefined,
      });

      chunkIndex += 1;
      if (end === text.length) break;
      start = end - overlapChars;
    }

    return result;
  }
}
