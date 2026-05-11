import type { EmbeddingsProvider } from './EmbeddingsProvider';
import type { Logger } from '../../utils/Logger';
import type { OllamaClient } from '../../ollama/OllamaClient';

/**
 * Ollama embeddings MVP adapter.
 *
 * Assumes an Ollama embeddings endpoint similar to:
 *   POST {baseUrl}/api/embeddings
 * with:
 *   { model, prompt } or { model, input }
 *
 * If your Ollama build differs, we’ll adjust the request shape in one place.
 */
export class OllamaEmbeddingsProvider implements EmbeddingsProvider {
  private readonly logger: Logger;
  private readonly ollama: OllamaClient;
  private readonly embeddingsModel: string;

  constructor(params: {
    ollama: OllamaClient;
    logger: Logger;
    embeddingsModel: string;
  }) {
    this.ollama = params.ollama;
    this.logger = params.logger;
    this.embeddingsModel = params.embeddingsModel;
  }

  public async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const result: number[][] = [];
    for (const text of texts) {
      result.push(await this.embedQuery(text));
    }
    return result;
  }

  public async embedQuery(text: string): Promise<number[]> {
    // MVP: call Ollama directly via embeddings endpoint using fetch through global fetch.
    // We intentionally keep this implementation self-contained.
    //
    // NOTE: OllamaClient doesn’t expose embeddings() yet, so we’ll use base URL from ollama client indirectly later.
    // For now, we rely on global fetch with the same base URL pattern used elsewhere.
    //
    // If we want to avoid guessing base URL, we should extend OllamaClient with embeddings() next.
    const baseUrl = (this.ollama as any).baseUrl as string | undefined;
    const resolvedBaseUrl = baseUrl ?? 'http://localhost:11434';

    const url = `${resolvedBaseUrl.replace(/\/$/, '')}/api/embeddings`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.embeddingsModel,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Ollama embeddings HTTP ${response.status}: ${body}`);
      throw new Error(`Ollama embeddings failed (HTTP ${response.status})`);
    }

    const data: any = await response.json();

    // Try common shapes.
    const embedding: number[] | undefined =
      data?.embedding ??
      data?.embeddings?.[0] ??
      data?.data?.[0]?.embedding ??
      data?.data?.[0]?.vector;

    if (!embedding || !Array.isArray(embedding)) {
      this.logger.error(`Unexpected Ollama embeddings response shape: ${JSON.stringify(data).slice(0, 1000)}`);
      throw new Error('Ollama embeddings response did not contain an embedding vector');
    }

    return embedding;
  }
}
