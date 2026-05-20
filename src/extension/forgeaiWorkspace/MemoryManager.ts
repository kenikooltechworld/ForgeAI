import * as fs from 'fs';
import * as path from 'path';

export interface MemoryEntry {
  id: string;
  category: 'finding' | 'preference' | 'learning';
  title: string;
  content: string;
  source?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Manages the .forgeai/memory/ directory, persisting findings,
 * preferences, and learnings as markdown files with frontmatter.
 */
export class MemoryManager {
  private memoryDir: string;

  constructor(workspaceRoot: string) {
    this.memoryDir = path.join(workspaceRoot, '.forgeai', 'memory');
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  private filePath(entryId: string): string {
    return path.join(this.memoryDir, `${entryId}.md`);
  }

  /**
   * Save a memory entry to a markdown file with YAML frontmatter.
   */
  save(entry: MemoryEntry): void {
    this.ensureDir();
    const file = this.filePath(entry.id);
    const frontmatter = [
      '---',
      `id: ${entry.id}`,
      `category: ${entry.category}`,
      `title: ${entry.title}`,
      `source: ${entry.source ?? 'unknown'}`,
      `tags: [${entry.tags.map((t) => `"${t}"`).join(', ')}]`,
      `createdAt: ${entry.createdAt}`,
      `updatedAt: ${entry.updatedAt}`,
      '---',
      '',
      entry.content,
    ].join('\n');

    fs.writeFileSync(file, frontmatter, 'utf-8');
  }

  /**
   * Load a single memory entry by ID.
   */
  load(entryId: string): MemoryEntry | null {
    const file = this.filePath(entryId);
    if (!fs.existsSync(file)) {
      return null;
    }
    return this.parseFile(file);
  }

  /**
   * List all memory entries, optionally filtered by category.
   */
  list(category?: MemoryEntry['category']): MemoryEntry[] {
    this.ensureDir();
    const files = fs.readdirSync(this.memoryDir).filter((f) => f.endsWith('.md'));
    const entries: MemoryEntry[] = [];
    for (const file of files) {
      const entry = this.parseFile(path.join(this.memoryDir, file));
      if (entry && (!category || entry.category === category)) {
        entries.push(entry);
      }
    }
    return entries.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Delete a memory entry.
   */
  delete(entryId: string): boolean {
    const file = this.filePath(entryId);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
    return false;
  }

  private parseFile(filePath: string): MemoryEntry | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!match) return null;

      const yaml = match[1];
      const content = match[2].trim();

      const get = (key: string): string | undefined => {
        const line = yaml.split('\n').find((l) => l.startsWith(`${key}:`));
        return line ? line.split(':').slice(1).join(':').trim() : undefined;
      };

      const getArray = (key: string): string[] => {
        const line = yaml.split('\n').find((l) => l.startsWith(`${key}:`));
        if (!line) return [];
        const rawArr = line.split(':').slice(1).join(':');
        try {
          return JSON.parse(rawArr.trim().replace(/'/g, '"'));
        } catch {
          return [];
        }
      };

      const id = get('id') ?? path.basename(filePath, '.md');
      const category = (get('category') ?? 'finding') as MemoryEntry['category'];
      const title = get('title') ?? id;
      const source = get('source');
      const tags = getArray('tags');
      const createdAt = parseInt(get('createdAt') ?? '0', 10);
      const updatedAt = parseInt(get('updatedAt') ?? '0', 10);

      return { id, category, title, content, source, tags, createdAt, updatedAt };
    } catch {
      return null;
    }
  }
}
