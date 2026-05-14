/**
 * Project Context Detector
 * Phase 2.5: Detect UI framework, styling approach, and existing design systems
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */

import * as vscode from 'vscode';

/** Detected project context */
export interface ProjectContext {
  /** Primary UI framework */
  uiFramework: UIFramework | 'unknown';
  /** Styling approach */
  styling: StylingApproach | 'unknown';
  /** Detected design systems */
  designSystems: DesignSystem[];
  /** Whether TypeScript is used */
  usesTypeScript: boolean;
  /** Package manager */
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
  /** Key dependencies */
  dependencies: Record<string, string>;
}

/** Supported UI frameworks */
export type UIFramework =
  | 'react'
  | 'vue'
  | 'angular'
  | 'svelte'
  | 'solid'
  | 'preact'
  | 'vanilla-js'
  | 'vscode-extension';

/** Supported styling approaches */
export type StylingApproach =
  | 'tailwind'
  | 'css-modules'
  | 'styled-components'
  | 'emotion'
  | 'css-in-js'
  | 'sass'
  | 'less'
  | 'vanilla-css';

/** Detected design system library */
export type DesignSystem =
  | 'material-ui'
  | 'chakra-ui'
  | 'radix-ui'
  | 'mantine'
  | 'shadcn'
  | 'ant-design'
  | 'bootstrap'
  | 'forgeai';

/** Framework detection rules */
const FRAMEWORK_DEPENDENCIES: Record<UIFramework, string[]> = {
  react: ['react', 'react-dom', 'next', 'gatsby', 'remix'],
  vue: ['vue', 'nuxt'],
  angular: ['@angular/core', '@angular/common'],
  svelte: ['svelte', 'sveltekit'],
  solid: ['solid-js'],
  preact: ['preact'],
  'vanilla-js': [],
  'vscode-extension': ['vscode'],
};

/** Styling detection rules */
const STYLING_DEPENDENCIES: Record<StylingApproach, string[]> = {
  tailwind: ['tailwindcss', '@tailwindcss/vite', 'tailwind-merge'],
  'css-modules': [], // Detected by file pattern
  'styled-components': ['styled-components'],
  emotion: ['@emotion/react', '@emotion/styled'],
  'css-in-js': ['goober', 'linaria', 'vanilla-extract'],
  sass: ['sass', 'node-sass'],
  less: ['less'],
  'vanilla-css': [],
};

/** Design system detection rules */
const DESIGN_SYSTEM_DEPENDENCIES: Record<DesignSystem, string[]> = {
  'material-ui': ['@mui/material', '@material-ui/core'],
  'chakra-ui': ['@chakra-ui/react'],
  'radix-ui': ['@radix-ui/react-primitive'],
  mantine: ['@mantine/core'],
  shadcn: ['class-variance-authority', 'tailwindcss-animate'],
  'ant-design': ['antd'],
  bootstrap: ['bootstrap', 'react-bootstrap'],
  forgeai: ['@forgeai/design-system'],
};

export class ProjectContextDetector {
  /**
   * Detect project context by analyzing package.json and file structure.
   */
  public async detect(workspaceRoot: string): Promise<ProjectContext> {
    const packageJson = await this.readPackageJson(workspaceRoot);
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    const context: ProjectContext = {
      uiFramework: this.detectUIFramework(deps),
      styling: await this.detectStyling(deps, workspaceRoot),
      designSystems: this.detectDesignSystems(deps),
      usesTypeScript: 'typescript' in deps || 'tsconfig.json' in deps, // crude check
      packageManager: await this.detectPackageManager(workspaceRoot),
      dependencies: deps,
    };

    return context;
  }

  /** Detect UI framework from dependencies */
  private detectUIFramework(deps: Record<string, string>): UIFramework | 'unknown' {
    for (const [framework, packages] of Object.entries(FRAMEWORK_DEPENDENCIES)) {
      for (const pkg of packages) {
        if (pkg in deps) {
          return framework as UIFramework;
        }
      }
    }
    return 'unknown';
  }

  /** Detect styling approach from dependencies and file patterns */
  private async detectStyling(
    deps: Record<string, string>,
    workspaceRoot: string
  ): Promise<StylingApproach | 'unknown'> {
    // Check dependencies first
    for (const [approach, packages] of Object.entries(STYLING_DEPENDENCIES)) {
      for (const pkg of packages) {
        if (pkg in deps) {
          return approach as StylingApproach;
        }
      }
    }

    // Check for CSS Modules usage (files ending in .module.css/.scss)
    const cssModuleFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceRoot, '**/*.module.{css,scss,sass}'),
      '**/node_modules/**',
      1
    );
    if (cssModuleFiles.length > 0) {
      return 'css-modules';
    }

    // Check for Tailwind config
    const tailwindConfig = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceRoot, 'tailwind.config.{js,ts,mjs}'),
      '**/node_modules/**',
      1
    );
    if (tailwindConfig.length > 0) {
      return 'tailwind';
    }

    // Check for Sass usage
    const sassFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceRoot, '**/*.{scss,sass}'),
      '**/node_modules/**',
      1
    );
    if (sassFiles.length > 0) {
      return 'sass';
    }

    // Check for Less usage
    const lessFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceRoot, '**/*.less'),
      '**/node_modules/**',
      1
    );
    if (lessFiles.length > 0) {
      return 'less';
    }

    // Default to vanilla CSS if any CSS files exist
    const cssFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceRoot, '**/*.css'),
      '**/node_modules/**',
      1
    );
    if (cssFiles.length > 0) {
      return 'vanilla-css';
    }

    return 'unknown';
  }

  /** Detect design system libraries from dependencies */
  private detectDesignSystems(deps: Record<string, string>): DesignSystem[] {
    const found: DesignSystem[] = [];
    for (const [ds, packages] of Object.entries(DESIGN_SYSTEM_DEPENDENCIES)) {
      for (const pkg of packages) {
        if (pkg in deps) {
          found.push(ds as DesignSystem);
          break;
        }
      }
    }
    return found;
  }

  /** Detect package manager from lockfile */
  private async detectPackageManager(workspaceRoot: string): Promise<ProjectContext['packageManager']> {
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceRoot, '{package-lock.json,yarn.lock,pnpm-lock.yaml,bun.lockb}'),
      '**/node_modules/**',
      1
    );

    if (files.length === 0) return 'unknown';

    const name = files[0].path.split('/').pop();
    switch (name) {
      case 'package-lock.json': return 'npm';
      case 'yarn.lock': return 'yarn';
      case 'pnpm-lock.yaml': return 'pnpm';
      case 'bun.lockb': return 'bun';
      default: return 'unknown';
    }
  }

  /** Read and parse package.json */
  private async readPackageJson(workspaceRoot: string): Promise<{ dependencies: Record<string, string>; devDependencies: Record<string, string> }> {
    try {
      const uri = vscode.Uri.file(`${workspaceRoot}/package.json`);
      const data = await vscode.workspace.fs.readFile(uri);
      const json = JSON.parse(Buffer.from(data).toString('utf-8'));
      return {
        dependencies: json.dependencies || {},
        devDependencies: json.devDependencies || {},
      };
    } catch {
      return { dependencies: {}, devDependencies: {} };
    }
  }
}
