import * as fs from 'fs';
import * as path from 'path';
import { SpecManager } from '../SpecManager';

describe('SpecManager', () => {
  const workspaceRoot = '/tmp/test-spec-workspace';
  const specDir = path.join(workspaceRoot, '.forgeai', 'specs');
  let manager: SpecManager;

  beforeEach(() => {
    if (fs.existsSync(specDir)) {
      fs.rmSync(specDir, { recursive: true, force: true });
    }
    manager = new SpecManager(workspaceRoot);
  });

  afterEach(() => {
    if (fs.existsSync(specDir)) {
      fs.rmSync(specDir, { recursive: true, force: true });
    }
  });

  it('creates a spec with scaffold files', () => {
    const meta = manager.createSpec('001-auth', 'Authentication');
    expect(meta.id).toBe('001-auth');
    expect(meta.title).toBe('Authentication');
    expect(meta.status).toBe('draft');
    expect(meta.currentPhase).toBeNull();

    const specPath = path.join(specDir, '001-auth');
    expect(fs.existsSync(path.join(specPath, 'requirements.md'))).toBe(true);
    expect(fs.existsSync(path.join(specPath, 'design.md'))).toBe(true);
    expect(fs.existsSync(path.join(specPath, 'tasks.md'))).toBe(true);
    expect(fs.existsSync(path.join(specPath, 'config.forgeai'))).toBe(true);
  });

  it('lists specs', () => {
    manager.createSpec('001-a', 'A');
    manager.createSpec('002-b', 'B');
    const list = manager.listSpecs();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('001-a');
    expect(list[1].id).toBe('002-b');
  });

  it('loads a full spec', () => {
    manager.createSpec('003-load', 'Load Test');
    const spec = manager.loadSpec('003-load');
    expect(spec).not.toBeNull();
    expect(spec!.config.title).toBe('Load Test');
    expect(spec!.artifacts.requirements).toContain('Requirements');
  });

  it('updates an artifact and advances status', () => {
    manager.createSpec('004-update', 'Update Test');
    manager.writeArtifact('004-update', 'requirements', '# Updated Requirements\n\nNew content.');
    const spec = manager.loadSpec('004-update');
    expect(spec!.config.status).toBe('draft');
    expect(spec!.artifacts.requirements).toContain('Updated Requirements');
  });

  it('approves phases and advances status', () => {
    manager.createSpec('005-approve', 'Approve Test');
    manager.writeArtifact('005-approve', 'requirements', 'reqs');
    manager.writeArtifact('005-approve', 'design', 'design');
    manager.writeArtifact('005-approve', 'tasks', 'tasks');

    expect(manager.approvePhase('005-approve', 'requirements')).toBe(true);
    expect(manager.loadSpec('005-approve')!.config.status).toBe('design');

    expect(manager.approvePhase('005-approve', 'design')).toBe(true);
    expect(manager.loadSpec('005-approve')!.config.status).toBe('tasks');

    expect(manager.approvePhase('005-approve', 'tasks')).toBe(true);
    expect(manager.loadSpec('005-approve')!.config.status).toBe('complete');
  });

  it('deletes a spec', () => {
    manager.createSpec('006-del', 'Delete');
    expect(manager.deleteSpec('006-del')).toBe(true);
    expect(manager.loadSpec('006-del')).toBeNull();
  });

  it('generates next spec ID', () => {
    manager.createSpec('001-first', 'First');
    manager.createSpec('002-second', 'Second');
    expect(manager.nextSpecId()).toBe('003-new-spec');
  });
});
