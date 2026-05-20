/**
 * RAG service and message handler setup for the webview.
 */

import * as vscode from 'vscode';
import { Logger } from './Logger';
import { StorageManager } from '../storage/StorageManager';
import { OllamaClient } from '../ollama/OllamaClient';
import { RagMessageHandler } from '../rag/RagMessageHandler';
import type { RagService } from '../rag/RagService';

export class RagSetup {
  private ragService?: RagService;
  private ragMessageHandler?: RagMessageHandler;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly storageManager: StorageManager,
    private readonly logger: Logger,
    private readonly ollamaClient: OllamaClient,
    private readonly postMessage: (msg: any) => void
  ) {}

  async getRagService(): Promise<RagService | undefined> {
    if (this.ragService) return this.ragService;
    try {
      const { LanceDbRagStore } = await import('../rag/store/LanceDbRagStore');
      const { OllamaEmbeddingsProvider } =
        await import('../rag/embeddings/OllamaEmbeddingsProvider');
      const { RagServiceImpl } = await import('../rag/RagService');
      const dbPath = vscode.Uri.joinPath(this.context.globalStorageUri, 'rag.db').fsPath;
      const embeddings = new OllamaEmbeddingsProvider({
        ollama: this.ollamaClient,
        logger: this.logger,
        embeddingsModel: 'nomic-embed-text',
      });
      const store = new LanceDbRagStore({
        logger: this.logger,
        embeddings,
        dbPath,
        collectionName: 'forgeai-docs',
      });
      this.ragService = new RagServiceImpl(store);
      return this.ragService;
    } catch (err) {
      this.logger.warn('RAG service initialization failed', err);
      return undefined;
    }
  }

  ensureRagMessageHandler(): RagMessageHandler {
    if (this.ragMessageHandler) return this.ragMessageHandler;
    const dbPath = vscode.Uri.joinPath(this.context.globalStorageUri, 'rag.db').fsPath;
    this.ragMessageHandler = new RagMessageHandler(
      this.storageManager,
      this.logger,
      dbPath,
      'nomic-embed-text',
      (msg: any) => this.postMessage(msg)
    );
    return this.ragMessageHandler;
  }

  get handler(): RagMessageHandler | undefined {
    return this.ragMessageHandler;
  }
}
