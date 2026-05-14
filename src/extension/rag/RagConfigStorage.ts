import type { DocSourceId } from './types';
import type { StorageManager } from '../storage/StorageManager';

export interface SourceStatus {
  sourceId: DocSourceId;
  label: string;
  category: string;
  lastScrapedAtMs: number | null;
  pageCount: number | null;
  isScraping: boolean;
  error: string | null;
  selected: boolean;
  favorite: boolean;
}

export interface RagConfig {
  selectedSourceIds: DocSourceId[];
  favoriteSourceIds: DocSourceId[];
  sourceStatuses: Record<string, SourceStatus>;
  scrapeInProgress: boolean;
}

const ALL_SOURCES: Array<{ id: DocSourceId; label: string; category: string }> = [
  { id: 'reactjs', label: 'React', category: 'Frontend' },
  { id: 'nextjs', label: 'Next.js', category: 'Frontend' },
  { id: 'vuejs', label: 'Vue.js', category: 'Frontend' },
  { id: 'tailwindcss', label: 'Tailwind CSS', category: 'Frontend' },
  { id: 'shadcn', label: 'shadcn/ui', category: 'Frontend' },
  { id: 'typescript', label: 'TypeScript', category: 'Language' },
  { id: 'javascript', label: 'JavaScript', category: 'Language' },
  { id: 'python', label: 'Python', category: 'Language' },
  { id: 'go', label: 'Go', category: 'Language' },
  { id: 'rust', label: 'Rust', category: 'Language' },
  { id: 'nodejs', label: 'Node.js', category: 'Backend / Runtime' },
  { id: 'express', label: 'Express', category: 'Backend / Runtime' },
  { id: 'fastapi', label: 'FastAPI', category: 'Backend / Runtime' },
  { id: 'prisma', label: 'Prisma', category: 'Backend / Runtime' },
  { id: 'vite', label: 'Vite', category: 'Tooling' },
  { id: 'docker', label: 'Docker', category: 'Tooling' },
  { id: 'git', label: 'Git', category: 'Tooling' },
  { id: 'postgresql', label: 'PostgreSQL', category: 'Database' },
  { id: 'mongodb', label: 'MongoDB', category: 'Database' },
  { id: 'vscode-api', label: 'VS Code API', category: 'Tooling' },
  { id: 'zustand', label: 'Zustand', category: 'Frontend' },
];

export class RagConfigStorage {
  constructor(private readonly storage: StorageManager) {}

  public getSelectedSources(): DocSourceId[] {
    return this.storage.getGlobalValue<DocSourceId[]>('forgeai.rag.selectedSources', []);
  }

  public async setSelectedSources(sourceIds: DocSourceId[]): Promise<void> {
    await this.storage.setGlobalValue('forgeai.rag.selectedSources', sourceIds);
  }

  public getFavoriteSources(): DocSourceId[] {
    return this.storage.getGlobalValue<DocSourceId[]>('forgeai.rag.favoriteSources', []);
  }

  public async setFavoriteSources(sourceIds: DocSourceId[]): Promise<void> {
    await this.storage.setGlobalValue('forgeai.rag.favoriteSources', sourceIds);
  }

  public async toggleFavorite(sourceId: DocSourceId): Promise<boolean> {
    const favorites = this.getFavoriteSources();
    const index = favorites.indexOf(sourceId);
    if (index >= 0) {
      favorites.splice(index, 1);
      await this.setFavoriteSources(favorites);
      return false;
    }
    favorites.push(sourceId);
    await this.setFavoriteSources(favorites);
    return true;
  }

  public getSourceLastScrapedAt(sourceId: DocSourceId): number | null {
    const map = this.storage.getGlobalValue<Record<string, number | null>>(
      'forgeai.rag.sourceLastScrapedAt',
      {}
    );
    return map[sourceId] ?? null;
  }

  public async setSourceLastScrapedAt(sourceId: DocSourceId, timestampMs: number): Promise<void> {
    const map = this.storage.getGlobalValue<Record<string, number | null>>(
      'forgeai.rag.sourceLastScrapedAt',
      {}
    );
    map[sourceId] = timestampMs;
    await this.storage.setGlobalValue('forgeai.rag.sourceLastScrapedAt', map);
  }

  public getSourcePageCount(sourceId: DocSourceId): number | null {
    const map = this.storage.getGlobalValue<Record<string, number | null>>(
      'forgeai.rag.sourcePageCount',
      {}
    );
    return map[sourceId] ?? null;
  }

  public async setSourcePageCount(sourceId: DocSourceId, count: number): Promise<void> {
    const map = this.storage.getGlobalValue<Record<string, number | null>>(
      'forgeai.rag.sourcePageCount',
      {}
    );
    map[sourceId] = count;
    await this.storage.setGlobalValue('forgeai.rag.sourcePageCount', map);
  }

  public isScrapeInProgress(): boolean {
    return this.storage.getGlobalValue<boolean>('forgeai.rag.scrapeInProgress', false);
  }

  public async setScrapeInProgress(value: boolean): Promise<void> {
    await this.storage.setGlobalValue('forgeai.rag.scrapeInProgress', value);
  }

  public getAllSourceStatuses(): SourceStatus[] {
    const selected = new Set(this.getSelectedSources());
    const favorites = new Set(this.getFavoriteSources());
    const lastScrapedMap = this.storage.getGlobalValue<Record<string, number | null>>(
      'forgeai.rag.sourceLastScrapedAt',
      {}
    );
    const pageCountMap = this.storage.getGlobalValue<Record<string, number | null>>(
      'forgeai.rag.sourcePageCount',
      {}
    );
    const errorMap = this.storage.getGlobalValue<Record<string, string | null>>(
      'forgeai.rag.sourceErrors',
      {}
    );

    return ALL_SOURCES.map((s) => ({
      sourceId: s.id,
      label: s.label,
      category: s.category,
      lastScrapedAtMs: lastScrapedMap[s.id] ?? null,
      pageCount: pageCountMap[s.id] ?? null,
      isScraping: false,
      error: errorMap[s.id] ?? null,
      selected: selected.has(s.id),
      favorite: favorites.has(s.id),
    }));
  }

  public async setSourceError(sourceId: DocSourceId, error: string | null): Promise<void> {
    const map = this.storage.getGlobalValue<Record<string, string | null>>(
      'forgeai.rag.sourceErrors',
      {}
    );
    if (error) {
      map[sourceId] = error;
    } else {
      delete map[sourceId];
    }
    await this.storage.setGlobalValue('forgeai.rag.sourceErrors', map);
  }

  public static getAllAvailableSources(): Array<{
    id: DocSourceId;
    label: string;
    category: string;
  }> {
    return ALL_SOURCES;
  }
}
