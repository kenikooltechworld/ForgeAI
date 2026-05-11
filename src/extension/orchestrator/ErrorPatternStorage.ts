/**
 * ErrorPatternStorage - Phase 3 persistent storage for learned error patterns.
 *
 * Uses StorageManager (workspaceState) to persist patterns across sessions.
 */

import { StorageManager } from '../storage/StorageManager';
import { ErrorPattern, RecoveryStrategy } from './types';
import { matchErrorPattern } from './ErrorPatterns';

type StoredErrorPattern = {
  errorPattern: ErrorPattern;
  // optional: persist a strategy used to recover from this pattern
  recovery?: RecoveryStrategy | null;
};

const WORKSPACE_STATE_KEY = 'forgeai.errorPatterns.v1';

export class ErrorPatternStorage {
  constructor(private readonly storageManager: StorageManager) {}

  private readAll(): StoredErrorPattern[] {
    return this.storageManager.getWorkspaceValue<StoredErrorPattern[]>(
      WORKSPACE_STATE_KEY,
      []
    );
  }

  private async writeAll(items: StoredErrorPattern[]): Promise<void> {
    await this.storageManager.setWorkspaceValue(WORKSPACE_STATE_KEY, items);
  }

  public async savePattern(pattern: ErrorPattern, recovery?: RecoveryStrategy | null): Promise<void> {
    const all = this.readAll();

    const next: StoredErrorPattern = {
      errorPattern: pattern,
      recovery: recovery ?? null,
    };

    // de-dupe by errorPattern.id
    const filtered = all.filter((p) => p.errorPattern.id !== pattern.id);
    filtered.push(next);

    await this.writeAll(filtered);
  }

  /**
   * Given an error message, try to find a matching stored pattern.
   * Returns null if nothing matches.
   *
   * Note: we do a best-effort match by first matching built-in patterns,
   * then attempting to match by category/id for stored patterns.
   */
  public async getPattern(errorMessage: string): Promise<ErrorPattern | null> {
    // First, try built-in match so we know the likely category/id.
    const builtIn = matchErrorPattern(errorMessage);
    if (!builtIn.errorPattern) return null;

    const all = this.readAll();
    const stored = all.find((p) => p.errorPattern.id === builtIn.errorPattern!.id);
    return stored?.errorPattern ?? null;
  }

  public async getAllPatterns(): Promise<ErrorPattern[]> {
    return this.readAll().map((p) => p.errorPattern);
  }

  public async deletePattern(id: string): Promise<void> {
    const all = this.readAll();
    const next = all.filter((p) => p.errorPattern.id !== id);
    await this.writeAll(next);
  }
}
