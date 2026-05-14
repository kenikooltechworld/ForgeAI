/**
 * Design System Storage
 * Task 5.1: Persist and load design systems to/from .forgeai/design-system/
 * Requirements: 1.7, 13.6
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DesignTokens } from '../types/design-tokens';

/** File paths managed by storage */
export interface DesignSystemPaths {
  /** Base design system directory */
  baseDir: string;
  /** tokens.json path */
  tokensJson: string;
  /** tokens.css path */
  tokensCss: string;
  /** tailwind.config.js path */
  tailwindConfig: string;
  /** Design system metadata */
  metadata: string;
}

/** Metadata about a saved design system */
export interface DesignSystemMetadata {
  /** Design system name */
  name: string;
  /** Version */
  version: string;
  /** When created */
  createdAt: string;
  /** When last modified */
  modifiedAt: string;
  /** Which tokens are defined */
  tokenCategories: string[];
}

export class DesignSystemStorage {
  private readonly baseDir: string;

  constructor(projectRoot: string) {
    this.baseDir = path.join(projectRoot, '.forgeai', 'design-system');
  }

  /** Get all managed file paths */
  public getPaths(): DesignSystemPaths {
    return {
      baseDir: this.baseDir,
      tokensJson: path.join(this.baseDir, 'tokens.json'),
      tokensCss: path.join(this.baseDir, 'tokens.css'),
      tailwindConfig: path.join(this.baseDir, 'tailwind.config.js'),
      metadata: path.join(this.baseDir, 'metadata.json'),
    };
  }

  /** Ensure the design system directory exists */
  public ensureDirectory(): void {
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  /** Check if a design system exists */
  public exists(): boolean {
    return fs.existsSync(this.getPaths().metadata);
  }

  /** Save a complete design system */
  public save(tokens: DesignTokens): DesignSystemPaths {
    this.ensureDirectory();
    const paths = this.getPaths();

    // Save tokens as JSON
    fs.writeFileSync(paths.tokensJson, JSON.stringify(tokens, null, 2), 'utf-8');

    // Save metadata
    const metadata: DesignSystemMetadata = {
      name: tokens.name,
      version: tokens.version,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      tokenCategories: Object.keys(tokens).filter(
        (k) => k !== 'name' && k !== 'version'
      ),
    };
    fs.writeFileSync(paths.metadata, JSON.stringify(metadata, null, 2), 'utf-8');

    return paths;
  }

  /** Load a design system from storage */
  public load(): DesignTokens | null {
    const paths = this.getPaths();
    if (!fs.existsSync(paths.tokensJson)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(paths.tokensJson, 'utf-8');
      return JSON.parse(raw) as DesignTokens;
    } catch {
      return null;
    }
  }

  /** Load metadata only */
  public loadMetadata(): DesignSystemMetadata | null {
    const paths = this.getPaths();
    if (!fs.existsSync(paths.metadata)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(paths.metadata, 'utf-8');
      return JSON.parse(raw) as DesignSystemMetadata;
    } catch {
      return null;
    }
  }

  /** Delete the entire design system */
  public delete(): boolean {
    try {
      fs.rmSync(this.baseDir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
}
