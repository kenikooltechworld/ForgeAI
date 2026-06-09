import type {
  CleanedChunk,
  RagRetrievedContext,
  RAGSearchParams,
  RagStoreUpsertResult,
} from '../types';
import type { RagStore } from './RagStore';
import type { EmbeddingsProvider } from '../embeddings/EmbeddingsProvider';
import { Logger } from '../../utils/Logger';

/**
 * LanceDB-backed vector store.
 *
 * Uses the correct @lancedb/lancedb API:
 *   - lancedb.connect(path)  to open the database
 *   - db.openTable / db.createTable  to manage collections
 *   - table.vectorSearch(vector).limit(k).toArray()  for ANN search
 *   - table.query().where(filter).toArray()  for metadata filtering
 *   - table.delete(filter)  for removing rows
 *   - table.add(records)  for inserting new rows
 *
 * Embedding dimension is auto-detected from the first batch to avoid
 * hardcoding a value that mismatches the configured model.
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

  // ─── helpers ──────────────────────────────────────────────────────────────

  private async connect(): Promise<any> {
    const lancedb = await import('@lancedb/lancedb');
    return (lancedb as any).connect(this.dbPath);
  }

  private async openOrCreateTable(db: any, firstRecords: any[]): Promise<any> {
    try {
      return await db.openTable(this.collectionName);
    } catch {
      // Table does not exist yet — create it from the first batch of records
      // so LanceDB can infer the schema (including vector dimension) automatically.
      return await db.createTable(this.collectionName, firstRecords);
    }
  }

  private buildIdFilter(chunkIds: string[]): string {
    const quoted = chunkIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(', ');
    return `chunkId IN (${quoted})`;
  }

  // ─── RagStore interface ────────────────────────────────────────────────────

  public async upsertChunks(chunks: CleanedChunk[]): Promise<RagStoreUpsertResult> {
    if (chunks.length === 0) return { upserted: 0, skippedSame: 0 };

    // Embed all texts in one batched call.
    const texts = chunks.map((c) => c.text);
    const vectors = await this.embeddings.embedDocuments(texts);

    const records = chunks.map((chunk, idx) => ({
      chunkId: chunk.chunkId,
      sourceId: chunk.sourceId,
      url: chunk.url,
      title: chunk.title ?? '',
      contentHash: chunk.contentHash,
      text: chunk.text,
      chunkIndex: chunk.chunkIndex,
      vector: vectors[idx],
    }));

    const db = await this.connect();

    let table: any;
    let isNewTable = false;

    try {
      table = await db.openTable(this.collectionName);
    } catch {
      // First time — create directly from records (schema inferred automatically).
      table = await db.createTable(this.collectionName, records);
      isNewTable = true;
    }

    if (isNewTable) {
      return { upserted: records.length, skippedSame: 0 };
    }

    // Table already exists — diff by chunkId + contentHash.
    return this.diffUpsert(table, records);
  }

  public async search(params: RAGSearchParams): Promise<RagRetrievedContext[]> {
    const { query, topK, sourceIds } = params;

    const db = await this.connect();

    let table: any;
    try {
      table = await db.openTable(this.collectionName);
    } catch {
      // Nothing indexed yet.
      this.logger.warn('LanceDB: table not found during search — nothing indexed yet');
      return [];
    }

    const queryVector = await this.embeddings.embedQuery(query);

    // Build the search query.
    let searchQuery = table.vectorSearch(queryVector).limit(topK);

    // Optionally filter by source (SQL-style WHERE clause).
    if (sourceIds && sourceIds.length > 0) {
      const quoted = sourceIds.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(', ');
      searchQuery = searchQuery.where(`sourceId IN (${quoted})`);
    }

    let rows: any[];
    try {
      rows = await searchQuery.toArray();
    } catch (err) {
      // Some LanceDB versions use .select() or different chaining — fall back to no-filter search.
      this.logger.warn(
        `LanceDB search with filter failed, retrying without filter: ${String(err)}`
      );
      rows = await table.vectorSearch(queryVector).limit(topK).toArray();
    }

    if (!rows || rows.length === 0) return [];

    return rows.map((row: any) => ({
      chunkId: row.chunkId ?? '',
      sourceId: row.sourceId ?? '',
      url: row.url ?? '',
      title: row.title || undefined,
      contentHash: row.contentHash ?? '',
      text: row.text ?? '',
      score: Number(row._distance ?? row.score ?? row.distance ?? 0),
    }));
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  private async diffUpsert(table: any, records: any[]): Promise<RagStoreUpsertResult> {
    const chunkIds = records.map((r) => r.chunkId as string);
    const filter = this.buildIdFilter(chunkIds);

    let skippedSame = 0;
    let upserted = 0;

    try {
      // Query existing rows for these chunkIds.
      const existing: any[] = await table
        .query()
        .where(filter)
        .select(['chunkId', 'contentHash'])
        .toArray();

      const existingMap = new Map<string, string>(
        existing.map((r: any) => [r.chunkId as string, r.contentHash as string])
      );

      const toInsert = records.filter((r) => {
        const prev = existingMap.get(r.chunkId as string);
        if (prev && prev === r.contentHash) {
          skippedSame += 1;
          return false;
        }
        upserted += 1;
        return true;
      });

      if (toInsert.length > 0) {
        // Delete stale rows then insert fresh ones (LanceDB upsert pattern).
        const insertIds = toInsert.map((r) => r.chunkId as string);
        await table.delete(this.buildIdFilter(insertIds)).catch(() => undefined);
        await table.add(toInsert);
      }
    } catch (err) {
      // Fallback: replace all matching rows unconditionally.
      this.logger.warn(`LanceDB diff-upsert failed, using replace-all fallback: ${String(err)}`);
      upserted = records.length;
      await table.delete(filter).catch(() => undefined);
      await table.add(records);
    }

    return { upserted, skippedSame };
  }
}
