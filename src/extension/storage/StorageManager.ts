import * as vscode from "vscode";
import { Logger } from "../utils/Logger";

/**
 * StorageManager - Manages VS Code storage (workspace state, global state, secrets)
 *
 * Provides type-safe access to VS Code's storage APIs:
 * - Workspace State: Per-workspace storage (conversations, settings)
 * - Global State: Cross-workspace storage (user preferences)
 * - Secrets: Secure storage for sensitive data (API keys, tokens)
 */
export class StorageManager implements vscode.Disposable {
  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _logger: Logger
  ) {}

  /**
   * Get a value from workspace state
   * @param key The storage key
   * @returns The stored value or undefined if not found
   */
  public getWorkspaceState<T>(key: string): T | undefined {
    try {
      const value = this._context.workspaceState.get<T>(key);
      this._logger.info(`Retrieved workspace state: ${key}`);
      return value;
    } catch (error) {
      this._logger.error(`Failed to get workspace state: ${key}`, error);
      throw new StorageError(`Failed to get workspace state: ${key}`, error);
    }
  }

  /**
   * Set a value in workspace state
   * @param key The storage key
   * @param value The value to store
   */
  public async setWorkspaceState<T>(key: string, value: T): Promise<void> {
    try {
      await this._context.workspaceState.update(key, value);
      this._logger.info(`Set workspace state: ${key}`);
    } catch (error) {
      this._logger.error(`Failed to set workspace state: ${key}`, error);
      throw new StorageError(`Failed to set workspace state: ${key}`, error);
    }
  }

  /**
   * Get a value from global state
   * @param key The storage key
   * @returns The stored value or undefined if not found
   */
  public getGlobalState<T>(key: string): T | undefined {
    try {
      const value = this._context.globalState.get<T>(key);
      this._logger.info(`Retrieved global state: ${key}`);
      return value;
    } catch (error) {
      this._logger.error(`Failed to get global state: ${key}`, error);
      throw new StorageError(`Failed to get global state: ${key}`, error);
    }
  }

  /**
   * Set a value in global state
   * @param key The storage key
   * @param value The value to store
   */
  public async setGlobalState<T>(key: string, value: T): Promise<void> {
    try {
      await this._context.globalState.update(key, value);
      this._logger.info(`Set global state: ${key}`);
    } catch (error) {
      this._logger.error(`Failed to set global state: ${key}`, error);
      throw new StorageError(`Failed to set global state: ${key}`, error);
    }
  }

  /**
   * Get a secret from secure storage
   * @param key The secret key
   * @returns The secret value or undefined if not found
   */
  public async getSecret(key: string): Promise<string | undefined> {
    try {
      const value = await this._context.secrets.get(key);
      this._logger.info(`Retrieved secret: ${key}`);
      return value;
    } catch (error) {
      this._logger.error(`Failed to get secret: ${key}`, error);
      throw new StorageError(`Failed to get secret: ${key}`, error);
    }
  }

  /**
   * Store a secret in secure storage
   * @param key The secret key
   * @param value The secret value
   */
  public async setSecret(key: string, value: string): Promise<void> {
    try {
      await this._context.secrets.store(key, value);
      this._logger.info(`Stored secret: ${key}`);
    } catch (error) {
      this._logger.error(`Failed to store secret: ${key}`, error);
      throw new StorageError(`Failed to store secret: ${key}`, error);
    }
  }

  /**
   * Delete a secret from secure storage
   * @param key The secret key
   */
  public async deleteSecret(key: string): Promise<void> {
    try {
      await this._context.secrets.delete(key);
      this._logger.info(`Deleted secret: ${key}`);
    } catch (error) {
      this._logger.error(`Failed to delete secret: ${key}`, error);
      throw new StorageError(`Failed to delete secret: ${key}`, error);
    }
  }

  /**
   * Set keys for cross-machine sync
   * @param keys Array of keys to sync
   */
  public setKeysForSync(keys: string[]): void {
    try {
      this._context.globalState.setKeysForSync(keys);
      this._logger.info(`Set keys for sync: ${keys.join(", ")}`);
    } catch (error) {
      this._logger.error("Failed to set keys for sync", error);
      throw new StorageError("Failed to set keys for sync", error);
    }
  }

  /**
   * Dispose the storage manager and clean up resources
   */
  public dispose(): void {
    this._logger.info("Disposing StorageManager");
    // StorageManager doesn't have any resources to clean up
    // The context is managed by VS Code
  }
}

/**
 * StorageError - Custom error class for storage operations
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly _cause?: unknown
  ) {
    super(message);
    this.name = "StorageError";
  }
}
