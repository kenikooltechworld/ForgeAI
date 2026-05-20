import * as fs from 'fs';
import * as path from 'path';

export interface ProductOverview {
  name: string;
  description: string;
  techStack: string[];
  goals: string[];
  targetUsers: string;
  createdAt: number;
  updatedAt: number;
}

export interface Branding {
  tone: string;
  colorPalette: string[];
  namingConventions: string;
  logoDescription: string;
  updatedAt: number;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'planned' | 'in-progress' | 'complete' | 'deferred';
  acceptanceCriteria: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Roadmap {
  milestones: Array<{
    title: string;
    targetDate?: string;
    features: string[]; // feature ids
    status: 'planned' | 'active' | 'completed';
  }>;
  updatedAt: number;
}

/**
 * Manages the .forgeai/product/ directory, persisting project
 * overview, branding, features roadmap, and feature list.
 */
export class ProductManager {
  private productDir: string;

  constructor(workspaceRoot: string) {
    this.productDir = path.join(workspaceRoot, '.forgeai', 'product');
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.productDir)) {
      fs.mkdirSync(this.productDir, { recursive: true });
    }
  }

  private filePath(name: string): string {
    return path.join(this.productDir, name);
  }

  // ─── Overview ───

  getOverview(): ProductOverview | null {
    const file = this.filePath('overview.md');
    if (!fs.existsSync(file)) return null;
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const meta = this.parseFrontmatter(raw);
      const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
      return {
        name: this.getStr(meta, 'name', 'Untitled Project'),
        description: this.getStr(meta, 'description', body),
        techStack: this.getArr(meta, 'techStack'),
        goals: this.getArr(meta, 'goals'),
        targetUsers: this.getStr(meta, 'targetUsers', 'Developers'),
        createdAt: this.getNum(meta, 'createdAt', 0),
        updatedAt: this.getNum(meta, 'updatedAt', Date.now()),
      };
    } catch {
      return null;
    }
  }

  saveOverview(overview: ProductOverview): void {
    const file = this.filePath('overview.md');
    const frontmatter = [
      '---',
      `name: "${overview.name}"`,
      `techStack: [${overview.techStack.map((s) => `"${s}"`).join(', ')}]`,
      `goals: [${overview.goals.map((g) => `"${g}"`).join(', ')}]`,
      `targetUsers: "${overview.targetUsers}"`,
      `createdAt: ${overview.createdAt}`,
      `updatedAt: ${overview.updatedAt}`,
      '---',
      '',
      overview.description,
    ].join('\n');
    fs.writeFileSync(file, frontmatter, 'utf-8');
  }

  // ─── Branding ───

  getBranding(): Branding | null {
    const file = this.filePath('branding.md');
    if (!fs.existsSync(file)) return null;
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const meta = this.parseFrontmatter(raw);
      return {
        tone: this.getStr(meta, 'tone', 'Professional'),
        colorPalette: this.getArr(meta, 'colorPalette'),
        namingConventions: this.getStr(meta, 'namingConventions', ''),
        logoDescription: this.getStr(meta, 'logoDescription', ''),
        updatedAt: this.getNum(meta, 'updatedAt', Date.now()),
      };
    } catch {
      return null;
    }
  }

  saveBranding(branding: Branding): void {
    const file = this.filePath('branding.md');
    const content = [
      '---',
      `tone: "${branding.tone}"`,
      `colorPalette: [${branding.colorPalette.map((c) => `"${c}"`).join(', ')}]`,
      `namingConventions: "${branding.namingConventions}"`,
      `logoDescription: "${branding.logoDescription}"`,
      `updatedAt: ${branding.updatedAt}`,
      '---',
      '',
      `# Branding`,
      '',
      `**Tone:** ${branding.tone}`,
      `**Naming:** ${branding.namingConventions}`,
    ].join('\n');
    fs.writeFileSync(file, content, 'utf-8');
  }

  // ─── Features ───

  getFeatures(): Feature[] {
    const file = this.filePath('features.json');
    if (!fs.existsSync(file)) return [];
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const data = JSON.parse(raw) as { features: Feature[] };
      return Array.isArray(data.features) ? data.features : [];
    } catch {
      return [];
    }
  }

  saveFeature(feature: Feature): void {
    const features = this.getFeatures();
    const idx = features.findIndex((f) => f.id === feature.id);
    if (idx >= 0) {
      features[idx] = { ...feature, updatedAt: Date.now() };
    } else {
      features.push(feature);
    }
    this.saveFeatures(features);
  }

  saveFeatures(features: Feature[]): void {
    const file = this.filePath('features.json');
    fs.writeFileSync(file, JSON.stringify({ features }, null, 2), 'utf-8');
  }

  deleteFeature(id: string): boolean {
    const features = this.getFeatures().filter((f) => f.id !== id);
    if (features.length === this.getFeatures().length) return false;
    this.saveFeatures(features);
    return true;
  }

  // ─── Roadmap ───

  getRoadmap(): Roadmap | null {
    const file = this.filePath('roadmap.md');
    if (!fs.existsSync(file)) return null;
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const meta = this.parseFrontmatter(raw);
      return {
        milestones: (Array.isArray(meta.milestones)
          ? meta.milestones
          : []) as unknown as Roadmap['milestones'],
        updatedAt: this.getNum(meta, 'updatedAt', Date.now()),
      };
    } catch {
      return null;
    }
  }

  saveRoadmap(roadmap: Roadmap): void {
    const file = this.filePath('roadmap.md');
    const content = [
      '---',
      `updatedAt: ${roadmap.updatedAt}`,
      '---',
      '',
      '# Roadmap',
      '',
      ...roadmap.milestones
        .map((m) => [
          `## ${m.title}${m.targetDate ? ` (${m.targetDate})` : ''}`,
          `Status: ${m.status}`,
          ...m.features.map((f) => `- ${f}`),
          '',
        ])
        .flat(),
    ].join('\n');
    fs.writeFileSync(file, content, 'utf-8');
  }

  // ─── Auto-detect from workspace ───

  detectFromWorkspace(workspaceRoot: string): ProductOverview {
    let name = 'Untitled Project';
    let description = 'A software project.';
    const techStack: string[] = [];

    // Detect from package.json
    const pkgPath = path.join(workspaceRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
        if (pkg.name && typeof pkg.name === 'string') name = pkg.name;
        if (pkg.description && typeof pkg.description === 'string') description = pkg.description;
        const deps = {
          ...((pkg.dependencies as Record<string, string>) || {}),
          ...((pkg.devDependencies as Record<string, string>) || {}),
        };
        const known: Record<string, string> = {
          react: 'React',
          next: 'Next.js',
          vue: 'Vue',
          angular: 'Angular',
          express: 'Express',
          fastify: 'Fastify',
          nestjs: 'NestJS',
          typescript: 'TypeScript',
          tailwindcss: 'Tailwind CSS',
          prisma: 'Prisma',
          mongoose: 'Mongoose',
          jest: 'Jest',
          vitest: 'Vitest',
          playwright: 'Playwright',
          zustand: 'Zustand',
          redux: 'Redux',
          mobx: 'MobX',
        };
        for (const [dep, label] of Object.entries(known)) {
          if (deps[dep]) techStack.push(label);
        }
      } catch {
        /* ignore */
      }
    }

    return {
      name,
      description,
      techStack,
      goals: ['Build a high-quality software product'],
      targetUsers: 'Developers and end users',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  // ─── Helpers ───

  private parseFrontmatter(raw: string): Record<string, string | number | string[]> {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) return {};
    const result: Record<string, string | number | string[]> = {};
    for (const line of match[1].split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) continue;
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          result[key] = JSON.parse(val.replace(/'/g, '"')) as string[];
        } catch {
          result[key] = val;
        }
      } else if (/^\d+$/.test(val)) {
        result[key] = parseInt(val, 10);
      } else {
        result[key] = val.replace(/^"|"$/g, '');
      }
    }
    return result;
  }

  private getStr(
    meta: Record<string, string | number | string[]>,
    key: string,
    fallback: string
  ): string {
    const v = meta[key];
    return typeof v === 'string' ? v : fallback;
  }

  private getNum(
    meta: Record<string, string | number | string[]>,
    key: string,
    fallback: number
  ): number {
    const v = meta[key];
    return typeof v === 'number' ? v : fallback;
  }

  private getArr(meta: Record<string, string | number | string[]>, key: string): string[] {
    const v = meta[key];
    return Array.isArray(v) ? v : [];
  }
}
