/**
 * BuildConfigParser
 *
 * Parses language-specific build configurations.
 * Requirements: 9.7
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger';

export interface BuildConfig {
  type: string;
  language: string;
  testCommand?: string;
  lintCommand?: string;
  buildCommand?: string;
  packageManager?: string;
}

export class BuildConfigParser {
  constructor(private readonly logger: Logger) {}

  public parse(workspaceRoot: string): BuildConfig | null {
    const files = [
      { file: 'package.json', parser: this.parsePackageJson.bind(this) },
      { file: 'pyproject.toml', parser: this.parsePyProject.bind(this) },
      { file: 'requirements.txt', parser: () => ({ type: 'python', language: 'python', packageManager: 'pip' }) },
      { file: 'go.mod', parser: () => ({ type: 'go', language: 'go', testCommand: 'go test ./...', buildCommand: 'go build ./...' }) },
      { file: 'Cargo.toml', parser: () => ({ type: 'rust', language: 'rust', testCommand: 'cargo test', buildCommand: 'cargo build' }) },
      { file: 'composer.json', parser: this.parseComposerJson.bind(this) },
      { file: 'pom.xml', parser: () => ({ type: 'java', language: 'java', testCommand: 'mvn test', buildCommand: 'mvn compile' }) },
      { file: 'build.gradle', parser: () => ({ type: 'java', language: 'java', testCommand: 'gradle test', buildCommand: 'gradle build' }) },
      { file: '.csproj', parser: () => ({ type: 'csharp', language: 'csharp', testCommand: 'dotnet test', buildCommand: 'dotnet build' }) },
    ];

    for (const { file, parser } of files) {
      const fullPath = path.join(workspaceRoot, file);
      if (fs.existsSync(fullPath)) {
        try {
          return parser(fullPath);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`BuildConfigParser: failed to parse ${file}: ${msg}`);
        }
      }
    }

    return null;
  }

  private parsePackageJson(filePath: string): BuildConfig {
    const content = fs.readFileSync(filePath, 'utf-8');
    const pkg = JSON.parse(content);

    const scripts = pkg.scripts || {};
    const hasTypeScript = fs.existsSync(path.join(path.dirname(filePath), 'tsconfig.json'));

    return {
      type: 'node',
      language: hasTypeScript ? 'typescript' : 'javascript',
      testCommand: scripts.test || 'npm test',
      lintCommand: scripts.lint || 'npm run lint',
      buildCommand: scripts.build || 'npm run build',
      packageManager: 'npm',
    };
  }

  private parsePyProject(filePath: string): BuildConfig {
    const content = fs.readFileSync(filePath, 'utf-8');
    const hasPytest = content.includes('pytest');
    const hasBlack = content.includes('black');

    return {
      type: 'python',
      language: 'python',
      testCommand: hasPytest ? 'pytest' : 'python -m pytest',
      lintCommand: 'pylint **/*.py',
      buildCommand: 'python setup.py build',
      packageManager: 'pip',
    };
  }

  private parseComposerJson(filePath: string): BuildConfig {
    const content = fs.readFileSync(filePath, 'utf-8');
    const pkg = JSON.parse(content);

    return {
      type: 'php',
      language: 'php',
      testCommand: pkg.scripts?.test || 'vendor/bin/phpunit',
      lintCommand: 'vendor/bin/phpcs',
      buildCommand: 'composer install',
      packageManager: 'composer',
    };
  }
}
