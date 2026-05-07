import * as vscode from 'vscode';

export class StorageManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  public getWorkspaceValue<T>(key: string, defaultValue: T): T {
    const value = this.context.workspaceState.get<T>(key);
    return value === undefined ? defaultValue : value;
  }

  public async setWorkspaceValue<T>(key: string, value: T): Promise<void> {
    await this.context.workspaceState.update(key, value);
  }

  public getGlobalValue<T>(key: string, defaultValue: T): T {
    const value = this.context.globalState.get<T>(key);
    return value === undefined ? defaultValue : value;
  }

  public async setGlobalValue<T>(key: string, value: T): Promise<void> {
    await this.context.globalState.update(key, value);
  }

  public async getSecret(key: string): Promise<string | undefined> {
    if ('secrets' in this.context) {
      return await (this.context as unknown as vscode.ExtensionContext).secrets.get(key);
    }
    return undefined;
  }

  public async setSecret(key: string, value: string): Promise<void> {
    if ('secrets' in this.context) {
      await (this.context as unknown as vscode.ExtensionContext).secrets.store(key, value);
    }
  }

  public async deleteSecret(key: string): Promise<void> {
    if ('secrets' in this.context) {
      await (this.context as unknown as vscode.ExtensionContext).secrets.delete(key);
    }
  }
}
