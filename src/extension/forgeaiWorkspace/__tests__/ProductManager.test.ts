import * as fs from 'fs';
import * as path from 'path';
import { ProductManager, ProductOverview, Feature } from '../ProductManager';

describe('ProductManager', () => {
  const workspaceRoot = '/tmp/test-product-workspace';
  const productDir = path.join(workspaceRoot, '.forgeai', 'product');
  let manager: ProductManager;

  beforeEach(() => {
    if (fs.existsSync(productDir)) {
      fs.rmSync(productDir, { recursive: true, force: true });
    }
    manager = new ProductManager(workspaceRoot);
  });

  afterEach(() => {
    if (fs.existsSync(productDir)) {
      fs.rmSync(productDir, { recursive: true, force: true });
    }
  });

  it('saves and loads overview', () => {
    const overview: ProductOverview = {
      name: 'ForgeAI',
      description: 'AI coding assistant',
      techStack: ['TypeScript', 'React'],
      goals: ['Ship fast'],
      targetUsers: 'Developers',
      createdAt: 1,
      updatedAt: 2,
    };
    manager.saveOverview(overview);
    const loaded = manager.getOverview();
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('ForgeAI');
    expect(loaded!.techStack).toEqual(['TypeScript', 'React']);
  });

  it('saves and loads features', () => {
    const f1: Feature = {
      id: 'f1',
      title: 'Auth',
      description: 'Login system',
      priority: 'high',
      status: 'planned',
      acceptanceCriteria: ['Can login'],
      createdAt: 1,
      updatedAt: 2,
    };
    manager.saveFeature(f1);
    expect(manager.getFeatures()).toHaveLength(1);
    expect(manager.getFeatures()[0].title).toBe('Auth');
  });

  it('deletes a feature', () => {
    manager.saveFeature({
      id: 'del',
      title: 'X',
      description: 'Y',
      priority: 'low',
      status: 'planned',
      acceptanceCriteria: [],
      createdAt: 1,
      updatedAt: 1,
    });
    expect(manager.deleteFeature('del')).toBe(true);
    expect(manager.getFeatures()).toHaveLength(0);
  });

  it('detects from package.json', () => {
    const pkgDir = '/tmp/test-product-detect';
    const pkgPath = path.join(pkgDir, 'package.json');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(pkgPath, JSON.stringify({
      name: 'my-app',
      description: 'My app desc',
      dependencies: { react: '^18', typescript: '^5' },
    }));
    const m = new ProductManager(pkgDir);
    const detected = m.detectFromWorkspace(pkgDir);
    expect(detected.name).toBe('my-app');
    expect(detected.description).toBe('My app desc');
    expect(detected.techStack).toContain('React');
    expect(detected.techStack).toContain('TypeScript');
    fs.rmSync(pkgDir, { recursive: true, force: true });
  });
});
