import * as fs from 'fs';
import * as path from 'path';
import { MemoryManager, MemoryEntry } from '../MemoryManager';

describe('MemoryManager', () => {
  const workspaceRoot = '/tmp/test-memory-workspace';
  const memoryDir = path.join(workspaceRoot, '.forgeai', 'memory');
  let manager: MemoryManager;

  beforeEach(() => {
    if (fs.existsSync(memoryDir)) {
      fs.rmSync(memoryDir, { recursive: true, force: true });
    }
    manager = new MemoryManager(workspaceRoot);
  });

  afterEach(() => {
    if (fs.existsSync(memoryDir)) {
      fs.rmSync(memoryDir, { recursive: true, force: true });
    }
  });

  it('saves and loads a memory entry', () => {
    const entry: MemoryEntry = {
      id: 'test-1',
      category: 'finding',
      title: 'Test Finding',
      content: 'This is a test finding.',
      source: 'rag',
      tags: ['react', 'hooks'],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };

    manager.save(entry);
    const loaded = manager.load('test-1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('test-1');
    expect(loaded!.title).toBe('Test Finding');
    expect(loaded!.content).toBe('This is a test finding.');
    expect(loaded!.source).toBe('rag');
    expect(loaded!.tags).toEqual(['react', 'hooks']);
  });

  it('lists all entries sorted by createdAt desc', () => {
    manager.save({
      id: 'older',
      category: 'preference',
      title: 'Older',
      content: 'content',
      tags: [],
      createdAt: 1000,
      updatedAt: 1000,
    });
    manager.save({
      id: 'newer',
      category: 'finding',
      title: 'Newer',
      content: 'content',
      tags: [],
      createdAt: 2000,
      updatedAt: 2000,
    });

    const list = manager.list();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('newer');
    expect(list[1].id).toBe('older');
  });

  it('filters entries by category', () => {
    manager.save({
      id: 'f1',
      category: 'finding',
      title: 'Finding',
      content: 'content',
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });
    manager.save({
      id: 'p1',
      category: 'preference',
      title: 'Preference',
      content: 'content',
      tags: [],
      createdAt: 2,
      updatedAt: 2,
    });

    const findings = manager.list('finding');
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('f1');

    const preferences = manager.list('preference');
    expect(preferences).toHaveLength(1);
    expect(preferences[0].id).toBe('p1');
  });

  it('deletes an entry', () => {
    manager.save({
      id: 'del-me',
      category: 'learning',
      title: 'Learning',
      content: 'content',
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });

    expect(manager.load('del-me')).not.toBeNull();
    expect(manager.delete('del-me')).toBe(true);
    expect(manager.load('del-me')).toBeNull();
    expect(manager.delete('del-me')).toBe(false);
  });
});
