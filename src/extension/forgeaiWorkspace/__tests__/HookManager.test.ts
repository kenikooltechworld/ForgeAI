import * as fs from 'fs';
import * as path from 'path';
import { HookManager, Hook } from '../HookManager';

describe('HookManager', () => {
  const workspaceRoot = '/tmp/test-hook-workspace';
  const hooksDir = path.join(workspaceRoot, '.forgeai', 'hooks');
  let manager: HookManager;

  beforeEach(() => {
    if (fs.existsSync(hooksDir)) {
      fs.rmSync(hooksDir, { recursive: true, force: true });
    }
    manager = new HookManager(workspaceRoot);
  });

  afterEach(() => {
    if (fs.existsSync(hooksDir)) {
      fs.rmSync(hooksDir, { recursive: true, force: true });
    }
  });

  it('saves and loads a hook', () => {
    const hook: Hook = {
      id: 'my-hook',
      name: 'My Hook',
      description: 'Does something',
      enabled: true,
      autoApprove: false,
      triggers: [{ type: 'file', pattern: '**/*.ts' }],
      actions: [{ type: 'message', message: 'File changed' }],
      createdAt: 1,
      updatedAt: 2,
    };
    manager.saveHook(hook);
    const loaded = manager.loadHook('my-hook');
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('My Hook');
    expect(loaded!.triggers[0].type).toBe('file');
    expect(loaded!.actions[0].type).toBe('message');
  });

  it('lists hooks sorted', () => {
    manager.saveHook({
      id: 'b-hook',
      name: 'B',
      description: '',
      enabled: true,
      autoApprove: false,
      triggers: [],
      actions: [],
      createdAt: 1,
      updatedAt: 1,
    });
    manager.saveHook({
      id: 'a-hook',
      name: 'A',
      description: '',
      enabled: true,
      autoApprove: false,
      triggers: [],
      actions: [],
      createdAt: 1,
      updatedAt: 1,
    });
    const list = manager.listHooks();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('a-hook');
  });

  it('deletes a hook', () => {
    manager.saveHook({
      id: 'del',
      name: 'Del',
      description: '',
      enabled: true,
      autoApprove: false,
      triggers: [],
      actions: [],
      createdAt: 1,
      updatedAt: 1,
    });
    expect(manager.deleteHook('del')).toBe(true);
    expect(manager.loadHook('del')).toBeNull();
  });

  it('creates defaults only once', () => {
    manager.createDefaults();
    expect(manager.listHooks().length).toBeGreaterThan(0);
    // Second call should not create duplicates
    const before = manager.listHooks().length;
    manager.createDefaults();
    expect(manager.listHooks().length).toBe(before);
  });
});
