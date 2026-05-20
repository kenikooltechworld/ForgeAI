import * as fs from 'fs';
import * as path from 'path';

export interface SteeringFile {
  name: string;
  path: string;
  inclusion: 'always' | 'fileMatch' | 'manual' | 'auto';
  fileMatchPattern?: string | string[];
  autoDescription?: string;
  content: string;
}

export class SteeringManager {
  private steeringDir: string;

  constructor(workspaceRoot: string) {
    this.steeringDir = path.join(workspaceRoot, '.forgeai', 'steering');
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.steeringDir)) {
      fs.mkdirSync(this.steeringDir, { recursive: true });
    }
  }

  listFiles(): SteeringFile[] {
    if (!fs.existsSync(this.steeringDir)) return [];
    return fs
      .readdirSync(this.steeringDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => this.loadFile(f))
      .filter((f): f is SteeringFile => f !== null);
  }

  loadFile(filename: string): SteeringFile | null {
    const filePath = path.join(this.steeringDir, filename);
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.parseSteeringFile(filename, filePath, content);
    } catch {
      return null;
    }
  }

  private parseSteeringFile(name: string, filePath: string, content: string): SteeringFile {
    const frontmatter = this.extractFrontmatter(content);
    const body = this.stripFrontmatter(content);
    return {
      name,
      path: filePath,
      inclusion: (frontmatter.inclusion as SteeringFile['inclusion']) || 'always',
      fileMatchPattern: frontmatter.fileMatchPattern as string | undefined,
      autoDescription: frontmatter.description as string | undefined,
      content: body,
    };
  }

  private extractFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!match) return {};
    const yaml = match[1];
    const result: Record<string, unknown> = {};
    for (const line of yaml.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        if (val.startsWith('[') && val.endsWith(']')) {
          result[key] = val
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
        } else {
          result[key] = val.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        }
      }
    }
    return result;
  }

  private stripFrontmatter(content: string): string {
    return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').trim();
  }

  saveFile(filename: string, content: string): void {
    const filePath = path.join(this.steeringDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  createDefaults(): void {
    const defaults: Array<{ name: string; content: string }> = [
      {
        name: 'product.md',
        content: `---
inclusion: always
---

# Product Overview

## Purpose
<!-- Describe what this product does and who it's for -->

## Target Users
<!-- Who uses this product? -->

## Key Features
<!-- List major features -->

## Business Objectives
<!-- What does this product need to achieve? -->
`,
      },
      {
        name: 'tech.md',
        content: `---
inclusion: always
---

# Technology Stack

## Languages
<!-- e.g. TypeScript 5.x, Python 3.12 -->

## Frameworks
<!-- e.g. React 18, Express 4, FastAPI -->

## Libraries
<!-- Key dependencies -->

## Tools
<!-- Build tools, linters, test runners -->

## Constraints
<!-- Performance, compatibility, deployment limits -->
`,
      },
      {
        name: 'structure.md',
        content: `---
inclusion: always
---

# Project Structure

## Directory Layout
<!-- Overview of how files are organized -->

## Naming Conventions
<!-- File naming patterns -->

## Import Patterns
<!-- How modules reference each other -->

## Architectural Decisions
<!-- Key structural choices -->
`,
      },
      {
        name: 'coding-standards.md',
        content: `---
inclusion: auto
---

# Coding Standards

## Style Rules
<!-- Formatting, linting rules -->

## Forbidden Patterns
<!-- What not to do -->

## Required Patterns
<!-- What to always do -->

## Testing Requirements
<!-- Coverage, test types -->
`,
      },
    ];

    for (const def of defaults) {
      const filePath = path.join(this.steeringDir, def.name);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, def.content, 'utf-8');
      }
    }
  }

  getContextForFile(filePath: string): string {
    const files = this.listFiles();
    const always = files.filter((f) => f.inclusion === 'always');
    const matched = files.filter((f) => {
      if (f.inclusion !== 'fileMatch' || !f.fileMatchPattern) return false;
      const patterns = Array.isArray(f.fileMatchPattern)
        ? f.fileMatchPattern
        : [f.fileMatchPattern];
      return patterns.some((p) => this.minimatch(filePath, p));
    });
    return [...always, ...matched].map((f) => f.content).join('\n\n---\n\n');
  }

  private minimatch(filePath: string, pattern: string): boolean {
    const parts = filePath.split(/[\\/]/);
    const regex = pattern
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/\\]*')
      .replace(/\?/g, '.')
      .replace(/\{\{GLOBSTAR\}\}/g, '.*');
    const re = new RegExp(regex);
    return parts.some((part) => re.test(part)) || re.test(filePath);
  }
}
