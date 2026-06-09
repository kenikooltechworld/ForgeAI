/**
 * SecretManager
 *
 * Stores secrets in memory only for the current VS Code session.
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7
 */

import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';

export interface SecretRecord {
  key: string;
  value: string;
  tool?: string;
  createdAt: number;
}

export class SecretManager {
  private readonly secrets: Map<string, SecretRecord> = new Map();

  constructor(private readonly logger: Logger) {}

  public store(key: string, value: string, tool?: string): void {
    this.secrets.set(key, {
      key,
      value,
      tool,
      createdAt: Date.now(),
    });
  }

  public retrieve(key: string): string | null {
    const record = this.secrets.get(key);
    if (!record) return null;
    return record.value;
  }

  public async promptForSecret(key: string, reason: string): Promise<string | null> {
    const value = await vscode.window.showInputBox({
      prompt: `Secret required: ${key}`,
      placeHolder: reason,
      password: true,
    });
    if (value) {
      this.store(key, value, 'user-prompt');
    }
    return value || null;
  }

  public clear(key?: string): void {
    if (key) {
      this.secrets.delete(key);
    } else {
      this.secrets.clear();
    }
  }

  public listKeys(): string[] {
    return Array.from(this.secrets.keys());
  }
}
