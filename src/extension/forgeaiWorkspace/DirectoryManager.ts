import * as fs from 'fs';
import * as path from 'path';

/**
 * Manages the creation and validation of .forgeai/ directory structure.
 *
 * .forgeai/
 * ├── memory/    — AI research, user preferences, tech docs, learnings
 * ├── product/   — Project overview, branding, features roadmap
 * ├── spec/      — Kiro-style specs (requirements → design → tasks)
 * └── hooks/     — Event-driven automation triggers
 */

const DIRECTORIES = ['memory', 'product', 'specs', 'steering', 'hooks'] as const;
type ForgeAIDirectory = (typeof DIRECTORIES)[number];

interface DirectoryConfig {
  name: ForgeAIDirectory;
  description: string;
}

const CONFIG: Record<ForgeAIDirectory, DirectoryConfig> = {
  memory: {
    name: 'memory',
    description:
      'AI research findings, user preferences, cached tech documentation, and learned facts about the codebase.',
  },
  product: {
    name: 'product',
    description:
      'Project overview, branding guidelines, feature roadmap, and high-level architecture.',
  },
  specs: {
    name: 'specs',
    description:
      'ForgeAI spec-driven development artifacts. Each spec is a directory with requirements.md, design.md, tasks.md, and config.forgeai.',
  },
  steering: {
    name: 'steering',
    description:
      'Persistent project guidance files (product.md, tech.md, structure.md, coding-standards.md) loaded into every AI interaction.',
  },
  hooks: {
    name: 'hooks',
    description:
      'Event-driven automation. Hooks trigger actions when files change or tasks complete.',
  },
};

export class DirectoryManager {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /** Get absolute path to .forgeai/ */
  getForgeAIPath(): string {
    return path.join(this.workspaceRoot, '.forgeai');
  }

  /** Get absolute path to a specific subdirectory */
  getDirectoryPath(dir: ForgeAIDirectory): string {
    return path.join(this.getForgeAIPath(), dir);
  }

  /** Check if .forgeai/ exists and is valid */
  isInitialized(): boolean {
    const forgeaiPath = this.getForgeAIPath();
    if (!fs.existsSync(forgeaiPath)) {
      return false;
    }
    return DIRECTORIES.every((dir) => fs.existsSync(path.join(forgeaiPath, dir)));
  }

  /** Create all .forgeai/ subdirectories with READMEs */
  initialize(): void {
    const forgeaiPath = this.getForgeAIPath();

    // Create main .forgeai/ directory
    if (!fs.existsSync(forgeaiPath)) {
      fs.mkdirSync(forgeaiPath, { recursive: true });
    }

    // Create subdirectories
    for (const dirName of DIRECTORIES) {
      const dirPath = path.join(forgeaiPath, dirName);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Write README.md for each directory
      const readmePath = path.join(dirPath, 'README.md');
      if (!fs.existsSync(readmePath)) {
        fs.writeFileSync(readmePath, this.generateReadme(dirName), 'utf-8');
      }
    }

    // Write root README
    const rootReadmePath = path.join(forgeaiPath, 'README.md');
    if (!fs.existsSync(rootReadmePath)) {
      fs.writeFileSync(rootReadmePath, this.generateRootReadme(), 'utf-8');
    }
  }

  /** List all specs in .forgeai/specs/ */
  listSpecs(): Array<{ id: string; title: string; path: string }> {
    const specDir = this.getDirectoryPath('specs');
    if (!fs.existsSync(specDir)) {
      return [];
    }

    const entries = fs.readdirSync(specDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        id: entry.name,
        title: entry.name.replace(/^\d+-/, '').replace(/-/g, ' '),
        path: path.join(specDir, entry.name),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private generateReadme(dir: ForgeAIDirectory): string {
    const config = CONFIG[dir];
    return `# .forgeai/${dir}/\n\n${config.description}\n\n## Files\n\n<!-- AI and users can add files here -->\n\n---\n\n*This directory is managed by ForgeAI. Do not delete.*\n`;
  }

  private generateRootReadme(): string {
    return `# .forgeai/\n\nForgeAI workspace directory. Contains AI memory, product context, specs, and hooks.\n\n## Structure\n\n| Directory | Purpose |\n|-----------|---------|\n| memory/   | AI research findings, user preferences, cached docs |\n| product/  | Project overview, branding, feature roadmap |\n| spec/     | Spec-driven development artifacts |\n| hooks/    | Event-driven automation triggers |\n\n## How It Works\n\n1. **memory/** — ResearchAgent saves web search and RAG findings here. The AI references these files in all future responses so its knowledge stays current.\n2. **product/** — Describes what the project is, who it's for, and what features exist. Every spec generation starts by reading product/overview.md.\n3. **spec/** — Kiro-style three-phase specs: requirements.md → design.md → tasks.md. Each phase requires human approval.\n4. **hooks/** — Triggers that fire when files change (e.g., regenerate tasks.md when design.md is edited).\n\n---\n\n*Generated by ForgeAI.*\n`;
  }
}
