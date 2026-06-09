import * as vscode from 'vscode';
import type { Logger } from '../utils/Logger';
import type { StorageManager } from '../storage/StorageManager';
import { RagConfigStorage } from '../rag/RagConfigStorage';
import { RagIngestionService, type ScrapeProgressEvent } from '../rag/RagIngestionService';

/**
 * Webview provider for the ForgeAI RAG Settings panel.
 * Lets users toggle which doc sources to index, mark favorites,
 * and trigger scraping with live progress feedback.
 */
export class RagSettingsWebviewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly configStorage: RagConfigStorage;
  private activeToken?: vscode.CancellationTokenSource;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly storage: StorageManager,
    private readonly logger: Logger,
    private readonly dbPath: string,
    private readonly ollamaEmbeddingsModel: string
  ) {
    this.configStorage = new RagConfigStorage(storage);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this.context.extensionUri, 'resources'),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    this.disposables.push(
      webviewView.webview.onDidReceiveMessage(
        (message) => this.handleMessage(message),
        null,
        this.disposables
      )
    );

    this.disposables.push(
      webviewView.onDidDispose(() => this.onViewDisposed(), null, this.disposables)
    );
  }

  private async handleMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'ragGetSources': {
          const statuses = this.configStorage.getAllSourceStatuses();
          this.postMessage({ type: 'ragSources', statuses });
          break;
        }

        case 'ragToggleSelected': {
          const selected = this.configStorage.getSelectedSources();
          const set = new Set(selected);
          if (set.has(message.sourceId)) {
            set.delete(message.sourceId);
          } else {
            set.add(message.sourceId);
          }
          await this.configStorage.setSelectedSources(Array.from(set));
          this.postMessage({
            type: 'ragSelectionChanged',
            sourceId: message.sourceId,
            selected: set.has(message.sourceId),
          });
          break;
        }

        case 'ragToggleFavorite': {
          const isFavorite = await this.configStorage.toggleFavorite(message.sourceId);
          this.postMessage({
            type: 'ragFavoriteChanged',
            sourceId: message.sourceId,
            favorite: isFavorite,
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
          this.logger.warn(`[RAG Webview] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('[RAG Webview] Failed to handle message', error);
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

    // Cancel any previous scrape
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
      const onProgress = (event: ScrapeProgressEvent) => {
        this.postMessage({ type: 'ragScrapeProgress', event });
      };

      const result = await service.runOnSources({
        sourceIds: sourceIds,
        concurrency: 3,
        onProgress,
        token: this.activeToken.token,
      });

      // Persist results
      for (const [sourceId, pages] of Object.entries(result.pagesBySource)) {
        await this.configStorage.setSourceLastScrapedAt(sourceId, Date.now());
        await this.configStorage.setSourcePageCount(sourceId, pages.length);
        await this.configStorage.setSourceError(sourceId, null);
      }

      await this.configStorage.setScrapeInProgress(false);
      this.postMessage({ type: 'ragScrapeComplete' });

      // Show completion notification
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
      this.logger.error('[RAG Webview] Scrape failed', error);
      this.postMessage({ type: 'ragScrapeError', error: msg });
    }
  }

  private postMessage(message: any): void {
    this.view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'style.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ForgeAI RAG Settings</title>
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  <div id="root"></div>
  <script>
    window.__FORGEAI_PANEL__ = 'rag';
    const vscodeApi = acquireVsCodeApi();
    window.vscode = vscodeApi;
  </script>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private onViewDisposed(): void {
    this.activeToken?.cancel();
    this.view = undefined;
  }

  public dispose(): void {
    this.activeToken?.cancel();
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
  }
}
