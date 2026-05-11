import type {
  CleanedChunk,
  RagRetrievedContext,
  RAGSearchParams,
  RagStoreUpsertResult,
} from '../types';
import type { RagStore } from './RagStore';
import type { EmbeddingsProvider } from '../embeddings/EmbeddingsProvider';
import { Logger } from '../../utils/Logger';

type LanceDbClient = unknown;
type LanceCollection = unknown;

function stableStringify(input: unknown): string {
  return JSON.stringify(input);
}

/**
 * MVP LanceDB-backed store.
 *
 * Notes:
 * - We use dynamic imports and `unknown`/`any` for LanceDB types because the package’s TS surface
 *   can vary across versions.
 * - We persist chunks in a single collection with text+metadata+embedding vector.
 * - For diff-based replace: we upsert-by (chunkId). If chunkId exists, we compare contentHash
 *   and either skip or replace.
 */
export class LanceDbRagStore implements RagStore {
  private readonly logger: Logger;
  private readonly embeddings: EmbeddingsProvider;
  private readonly dbPath: string;
  private readonly collectionName: string;

  constructor(params: {
    logger: Logger;
    embeddings: EmbeddingsProvider;
    dbPath: string;
    collectionName?: string;
  }) {
    this.logger = params.logger;
    this.embeddings = params.embeddings;
    this.dbPath = params.dbPath;
    this.collectionName = params.collectionName ?? 'forgeai_docs';
  }

  public async upsertChunks(chunks: CleanedChunk[]): Promise<RagStoreUpsertResult> {
    if (chunks.length === 0) return { upserted: 0, skippedSame: 0 };

    const lancedb = await import('@lancedb/lancedb');
    const client: LanceDbClient = new (lancedb as any).LanceDbClient(this.dbPath);

    const collection: LanceCollection = await (client as any)
      .createTable?.(this.collectionName, [], {
        schema: {
          chunkId: 'string',
          sourceId: 'string',
          url: 'string',
          title: 'string?',
          contentHash: 'string',
          text: 'string',
          chunkIndex: 'int32',
          embedding: { type: 'vector', dimension: 1024 },
        },
      })
      .catch(async () => {
        // if table exists, ignore create error
        return (client as any).openTable(this.collectionName);
      });

    // Ensure collection exists (fallback).
    const col: any = (collection as any) ?? (await (client as any).openTable(this.collectionName));

    // Build payloads and embeddings.
    const texts = chunks.map((c) => c.text);
    const vectors = await this.embeddings.embedDocuments(texts);

    const records = chunks.map((chunk, idx) => ({
      chunkId: chunk.chunkId,
      sourceId: chunk.sourceId,
      url: chunk.url,
      title: chunk.title ?? null,
      contentHash: chunk.contentHash,
      text: chunk.text,
      chunkIndex: chunk.chunkIndex,
      embedding: vectors[idx],
      // extra stable data to help debug
      _ingestFingerprint: stableStringify({
        chunkId: chunk.chunkId,
        contentHash: chunk.contentHash,
      }),
    }));

    // MVP upsert strategy:
    // - If LanceDB supports upsert by primary key, we’ll use it.
    // - Otherwise, we delete existing chunkIds then insert fresh.
    const upsertedAndSkipped = await this.upsertOrReplaceByChunkId(col, records);

    return upsertedAndSkipped;
  }

  public async search(params: RAGSearchParams): Promise<RagRetrievedContext[]> {
    const { query, topK, sourceIds } = params;

    const lancedb = await import('@lancedb/lancedb');
    const client: LanceDbClient = new (lancedb as any).LanceDbClient(this.dbPath);
    const col: any = await (client as any).openTable(this.collectionName);

    const queryVector = await this.embeddings.embedQuery(query);

    // Vector search MVP. We also support metadata filtering.
    // where filter shape can vary by LanceDB version; we try common patterns.
    const where =
      sourceIds && sourceIds.length > 0
        ? {
            sourceId: { $in: sourceIds },
          }
        : undefined;

    const results = await col
      .vectorSearch(queryVector, {
        k: topK,
        // Some versions accept `where` / `filter`.
        where,
      })
      .catch(async () => {
        // fallback if `where` isn’t supported
        return col.vectorSearch(queryVector, { k: topK });
      });

    // Normalize results to RagRetrievedContext[]
    // results can be an array or a cursor-like object.
    const rows: any[] = Array.isArray(results) ? results : await (results as any).toArray?.();

    if (!rows || rows.length === 0) return [];

    return rows.map((row) => ({
      chunkId: row.chunkId,
      sourceId: row.sourceId,
      url: row.url,
      title: row.title ?? undefined,
      contentHash: row.contentHash,
      text: row.text,
      score: Number(row.score ?? row.distance ?? 0),
    }));
  }

  private async upsertOrReplaceByChunkId(
    col: any,
    records: Array<any>
  ): Promise<RagStoreUpsertResult> {
    // Best-effort: try to check existing chunkIds and compare contentHash.
    // If LanceDB doesn’t support selective query easily, we’ll just replace everything.
    const chunkIds = records.map((r) => r.chunkId);
    const contentById = new Map(records.map((r) => [r.chunkId as string, r.contentHash as string]));

    let skippedSame = 0;
    let upserted = 0;

    try {
      const existing = await col
        .filter?.(`chunkId in (${chunkIds.map((id: string) => `'${id}'`).join(',')})`)
        .select?.(['chunkId', 'contentHash'])
        .toArray?.();

      if (Array.isArray(existing)) {
        const existingMap = new Map(
          existing.map((r: any) => [r.chunkId as string, r.contentHash as string])
        );
        for (const record of records) {
          const prev = existingMap.get(record.chunkId as string);
          if (prev && prev === record.contentHash) skippedSame += 1;
          else upserted += 1;
        }

        const toInsert = records.filter(
          (r) => (existingMap.get(r.chunkId) ?? null) !== r.contentHash
        );
        if (toInsert.length > 0) {
          // delete then add to emulate upsert
          await col
            .delete?.(`chunkId in (${chunkIds.map((id: string) => `'${id}'`).join(',')})`)
            .catch(() => undefined);
          await col.add?.(toInsert);
        }
      } else {
        // Replace-all fallback
        upserted = records.length;
        await col
          .delete?.(`chunkId in (${chunkIds.map((id: string) => `'${id}'`).join(',')})`)
          .catch(() => undefined);
        await col.add?.(records);
      }
    } catch (err) {
      // Replace-all fallback
      this.logger.warn(`LanceDB upsert fallback: ${String(err)}`);
      upserted = records.length;
      await col
        .delete?.(`chunkId in (${chunkIds.map((id: string) => `'${id}'`).join(',')})`)
        .catch(() => undefined);
      await col.add?.(records);
    }

    return { upserted, skippedSame };
  }
}
