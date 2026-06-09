import type { Logger } from '../../utils/Logger';
import type { DocSourceId } from '../types';
import type { CancellationToken } from '../scraper/DocSource';
import { RagIngestionService } from '../RagIngestionService';

export interface RagSchedulerDeps {
  logger: Logger;
  ollamaEmbeddingsModel: string;
  dbPath: string;
  storage: {
    getGlobalValue<T>(key: string, defaultValue: T): T | Promise<T>;
    setGlobalValue(key: string, value: unknown): Promise<void>;
  };
  /**
   * How often to refresh. MVP says every 2–3 days; we'll use a default of 3 days.
   */
  refreshMs?: number;
}

export class RagScheduler {
  private readonly deps: RagSchedulerDeps;

  constructor(deps: RagSchedulerDeps) {
    this.deps = deps;
  }

  public async runRefresh(
    params: { sourceIds: DocSourceId[] },
    token?: CancellationToken
  ): Promise<void> {
    const { logger, storage, refreshMs } = this.deps;

    const lastRun = await storage.getGlobalValue<number | null>(
      'forgeai.rag.lastRefreshAtMs',
      null
    );
    const now = Date.now();
    const effectiveRefreshMs = refreshMs ?? 3 * 24 * 60 * 60 * 1000;

    // If we ran recently, skip.
    if (lastRun && now - lastRun < effectiveRefreshMs) {
      return;
    }

    if (token?.isCancellationRequested) {
      return;
    }

    await new RagIngestionService({
      logger,
      ollamaEmbeddingsModel: this.deps.ollamaEmbeddingsModel,
      dbPath: this.deps.dbPath,
    }).runOnSources({ sourceIds: params.sourceIds, token });

    if (!token?.isCancellationRequested) {
      await storage.setGlobalValue('forgeai.rag.lastRefreshAtMs', now);
    }
  }
}
