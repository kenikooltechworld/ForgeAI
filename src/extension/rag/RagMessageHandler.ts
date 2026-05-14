import * as vscode from 'vscode';
import { RagConfigStorage } from './RagConfigStorage';
import { RagIngestionService } from './RagIngestionService';
import type { StorageManager } from '../storage/StorageManager';
import type { Logger } from '../utils/Logger';

/**
 * Handles RAG-related messages from the webview.
 * Decoupled from WebviewViewProvider so it can be used with any webview.
 */
export class RagMessageHandler implements vscode.Disposable {
  private readonly configStorage: RagConfigStorage;
  private activeToken?: vscode.CancellationTokenSource;

  constructor(
    private readonly storage: StorageManager,
    private readonly logger: Logger,
    private readonly dbPath: string,
    private readonly ollamaEmbeddingsModel: string,
    private readonly postMessage: (msg: any) => void
  ) {
    this.configStorage = new RagConfigStorage(storage);
  }

  public async handleMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'ragGetSources': {
          const statuses = await this.configStorage.getAllSourceStatuses();
          this.postMessage({ type: 'ragSources', statuses });
          break;
        }

        case 'ragToggleSelected': {
          const current = await this.configStorage.getSelectedSources();
          const set = new Set(current);
          if (set.has(message.sourceId)) {
            set.delete(message.sourceId);
          } else {
            set.add(message.sourceId);
          }
          await this.configStorage.setSelectedSources(Array.from(set));
          this.postMessage({
            type: 'ragSourceToggled',
            sourceId: message.sourceId,
            selected: set.has(message.sourceId),
          });
          break;
        }

        case 'ragToggleFavorite': {
          const favorites = await this.configStorage.getFavoriteSources();
          const set = new Set(favorites);
          const isFavorite = set.has(message.sourceId);
          if (isFavorite) {
            set.delete(message.sourceId);
          } else {
            set.add(message.sourceId);
          }
          await this.configStorage.setFavoriteSources(Array.from(set));
          this.postMessage({
            type: 'ragFavoriteToggled',
            sourceId: message.sourceId,
            favorite: !isFavorite,
          });
          break;
        }

        case 'ragStartScrape': {
          await this.handleStartScrape(message.sourceIds);
          break;
        }

        case 'ragCancelScrape': {
          this.activeToken?.cancel();
          this.postMessage({ type: 'ragScrapeCancelled' });
          break;
        }

        default:
          this.logger.warn(`[RAG Handler] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('[RAG Handler] Failed to handle message', error);
    }
  }

  private async handleStartScrape(sourceIds: string[]): Promise<void> {
    if (!sourceIds || sourceIds.length === 0) {
      this.postMessage({
        type: 'ragScrapeError',
        error: 'No sources selected. Please select at least one documentation source.',
      });
      return;
    }

    this.activeToken?.cancel();
    this.activeToken = new vscode.CancellationTokenSource();

    await this.configStorage.setScrapeInProgress(true);
    this.postMessage({ type: 'ragScrapeStarted', total: sourceIds.length });

    const service = new RagIngestionService({
      logger: this.logger,
      ollamaEmbeddingsModel: this.ollamaEmbeddingsModel,
      dbPath: this.dbPath,
    });

    try {
      const onProgress = (event: any) => {
        this.postMessage({ type: 'ragScrapeProgress', event });
      };

      const result = await service.runOnSources({
        sourceIds,
        concurrency: 3,
        onProgress,
        token: this.activeToken.token,
      });

      for (const [sourceId, pages] of Object.entries(result.pagesBySource)) {
        await this.configStorage.setSourceLastScrapedAt(sourceId, Date.now());
        await this.configStorage.setSourcePageCount(sourceId, pages.length);
        await this.configStorage.setSourceError(sourceId, null);
      }

      await this.configStorage.setScrapeInProgress(false);
      this.postMessage({ type: 'ragScrapeComplete' });

      const totalPages = Object.values(result.pagesBySource).reduce(
        (sum, pages) => sum + pages.length,
        0
      );
      void vscode.window.showInformationMessage(
        `ForgeAI: Indexed ${totalPages} pages from ${sourceIds.length} source(s).`
      );
    } catch (error) {
      await this.configStorage.setScrapeInProgress(false);
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error('[RAG Handler] Scrape failed', error);
      this.postMessage({ type: 'ragScrapeError', error: msg });
    }
  }

  public dispose(): void {
    this.activeToken?.cancel();
    this.activeToken = undefined;
  }
}
