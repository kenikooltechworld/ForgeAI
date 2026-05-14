import type { EmbeddingsProvider } from './EmbeddingsProvider';
import type { Logger } from '../../utils/Logger';
import type { OllamaClient } from '../../ollama/OllamaClient';

/**
 * Ollama embeddings adapter.
 *
 * Tries the batched POST /api/embed endpoint first (Ollama >= 0.1.x):
 *   { model, input: string[] }  → { embeddings: number[][] }
 *
 * Falls back to sequential POST /api/embeddings calls for older builds:
 *   { model, prompt: string }   → { embedding: number[] }
 */
export class OllamaEmbeddingsProvider implements EmbeddingsProvider {
  private readonly logger: Logger;
  private readonly ollama: OllamaClient;
  private readonly embeddingsModel: string;

  constructor(params: { ollama: OllamaClient; logger: Logger; embeddingsModel: string }) {
    this.ollama = params.ollama;
    this.logger = params.logger;
    this.embeddingsModel = params.embeddingsModel;
  }

  private get baseUrl(): string {
    return this.ollama.getBaseUrl();
  }

  // ─── EmbeddingsProvider interface ─────────────────────────────────────────

  public async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Try batch endpoint first — much faster for large text sets.
    try {
      return await this.batchEmbed(texts);
    } catch (err) {
      this.logger.warn(`Batch embed failed, falling back to sequential: ${String(err)}`);
      return this.sequentialEmbed(texts);
    }
  }

  public async embedQuery(text: string): Promise<number[]> {
    const vectors = await this.embedDocuments([text]);
    return vectors[0];
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  /** POST /api/embed  (Ollama >= 0.1, supports array input) */
  private async batchEmbed(texts: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/api/embed`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.embeddingsModel, input: texts }),
    });

    if (!response.ok) {
      throw new Error(`/api/embed HTTP ${response.status}`);
    }

    const data: any = await response.json();

    // Response shape: { embeddings: number[][] }
    const embeddings: number[][] | undefined = data?.embeddings;
    if (!embeddings || !Array.isArray(embeddings) || embeddings.length !== texts.length) {
      throw new Error(
        `/api/embed unexpected response shape: ${JSON.stringify(data).slice(0, 400)}`
      );
    }

    return embeddings;
  }

  /** Sequential POST /api/embeddings  (Ollama legacy, one text at a time) */
  private async sequentialEmbed(texts: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/api/embeddings`;
    const results: number[][] = [];

    for (const text of texts) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.embeddingsModel, prompt: text }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.error(`Ollama /api/embeddings HTTP ${response.status}: ${body}`);
        throw new Error(`Ollama embeddings failed (HTTP ${response.status})`);
      }

      const data: any = await response.json();

      const embedding: number[] | undefined =
        data?.embedding ?? data?.embeddings?.[0] ?? data?.data?.[0]?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error(
          `Unexpected /api/embeddings response: ${JSON.stringify(data).slice(0, 400)}`
        );
      }

      results.push(embedding);
    }

    return results;
  }
}
