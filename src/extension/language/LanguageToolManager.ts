/**
 * LanguageToolManager
 *
 * Manages language-specific tools (linters, test runners, formatters).
 * Requirements: 9.3, 9.4, 9.5, 9.7
 */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { LanguageDetector, LanguageInfo } from './LanguageDetector';
import { Logger } from '../utils/Logger';

export interface LanguageTool {
  name: string;
  command: string;
  installCommand: string;
  checkCommand: string;
  description: string;
}

export interface LanguageTools {
  lint: LanguageTool;
  test: LanguageTool;
  format?: LanguageTool;
}

export class LanguageToolManager {
  private readonly detector: LanguageDetector;
  private readonly toolCache = new Map<string, LanguageTools>();
  private readonly missingTools = new Map<string, string[]>();

  constructor(private readonly logger: Logger, private readonly workspaceRoot: string) {
    this.detector = new LanguageDetector();
  }

  public getToolsForLanguage(language: string): LanguageTools | null {
    const cacheKey = language.toLowerCase();
    if (this.toolCache.has(cacheKey)) return this.toolCache.get(cacheKey)!;

    const tools = this.resolveTools(language);
    if (tools) this.toolCache.set(cacheKey, tools);
    return tools;
  }

  public getToolsForFile(filePath: string): LanguageTools | null {
    const info = this.detector.detectFromFile(filePath);
    return this.getToolsForLanguage(info.language);
  }

  public async detectMissingTools(language: string): Promise<string[]> {
    const tools = this.getToolsForLanguage(language);
    if (!tools) return [];

    const missing: string[] = [];
    for (const [name, tool] of Object.entries(tools)) {
      if ('command' in tool) {
        try {
          cp.execSync(tool.checkCommand, { cwd: this.workspaceRoot, encoding: 'utf-8' });
        } catch {
          missing.push(name);
        }
      }
    }
    return missing;
  }

  public getInstallInstructions(language: string, missingTool: string): string {
    const tools = this.getToolsForLanguage(language);
    if (!tools) return `Install ${missingTool} for ${language}`;

    const tool = tools[missingTool as keyof LanguageTools];
    if (!tool || !('command' in tool)) return `Install ${missingTool} for ${language}`;

    return `${tool.installCommand}  # ${tool.description}`;
  }

  private resolveTools(language: string): LanguageTools | null {
    const lang = language.toLowerCase();
    const config: LanguageTools = {
      lint: {
        name: 'lint',
        command: '',
        installCommand: '',
        checkCommand: '',
        description: `Linting for ${language}`,
      },
      test: {
        name: 'test',
        command: '',
        installCommand: '',
        checkCommand: '',
        description: `Testing for ${language}`,
      },
    };

    if (lang.includes('javascript') || lang.includes('js')) {
      config.lint = {
        name: 'eslint',
        command: 'npx eslint --version',
        installCommand: 'npm install --save-dev eslint',
        checkCommand: 'npx eslint --version',
        description: 'ESLint for JavaScript/TypeScript',
      };
      config.test = {
        name: 'jest',
        command: 'npx jest --version',
        installCommand: 'npm install --save-dev jest',
        checkCommand: 'npx jest --version',
        description: 'Jest for JavaScript/TypeScript',
      };
      config.format = {
        name: 'prettier',
        command: 'npx prettier --version',
        installCommand: 'npm install --save-dev prettier',
        checkCommand: 'npx prettier --version',
        description: 'Prettier for JavaScript/TypeScript',
      };
    } else if (lang.includes('typescript') || lang.includes('ts')) {
      config.lint = {
        name: 'eslint',
        command: 'npx eslint --version',
        installCommand: 'npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin',
        checkCommand: 'npx eslint --version',
        description: 'ESLint with TypeScript support',
      };
      config.test = {
        name: 'jest',
        command: 'npx jest --version',
        installCommand: 'npm install --save-dev jest ts-jest @types/jest',
        checkCommand: 'npx jest --version',
        description: 'Jest with TypeScript support',
      };
      config.format = {
        name: 'prettier',
        command: 'npx prettier --version',
        installCommand: 'npm install --save-dev prettier @prettier/plugin-xml',
        checkCommand: 'npx prettier --version',
        description: 'Prettier for TypeScript',
      };
    } else if (lang.includes('python') || lang.includes('py')) {
      config.lint = {
        name: 'pylint',
        command: 'pylint --version',
        installCommand: 'pip install pylint',
        checkCommand: 'pylint --version',
        description: 'Pylint for Python',
      };
      config.test = {
        name: 'pytest',
        command: 'pytest --version',
        installCommand: 'pip install pytest',
        checkCommand: 'pytest --version',
        description: 'Pytest for Python',
      };
      config.format = {
        name: 'black',
        command: 'black --version',
        installCommand: 'pip install black',
        checkCommand: 'black --version',
        description: 'Black formatter for Python',
      };
    } else if (lang.includes('go')) {
      config.lint = {
        name: 'golangci-lint',
        command: 'golangci-lint --version',
        installCommand: 'go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest',
        checkCommand: 'golangci-lint --version',
        description: 'golangci-lint for Go',
      };
      config.test = {
        name: 'go-test',
        command: 'go version',
        installCommand: 'go test ./...',
        checkCommand: 'go test -v ./...',
        description: 'Go test runner',
      };
    } else if (lang.includes('rust')) {
      config.lint = {
        name: 'clippy',
        command: 'cargo clippy --version',
        installCommand: 'rustup component add clippy',
        checkCommand: 'cargo clippy --version',
        description: 'Clippy linter for Rust',
      };
      config.test = {
        name: 'cargo-test',
        command: 'cargo test --version',
        installCommand: 'cargo test',
        checkCommand: 'cargo test --no-run',
        description: 'Cargo test runner for Rust',
      };
    } else if (lang.includes('php')) {
      config.lint = {
        name: 'phpcs',
        command: 'phpcs --version',
        installCommand: 'composer require --dev squizlabs/php_codesniffer',
        checkCommand: 'phpcs --version',
        description: 'PHP_CodeSniffer for PHP',
      };
      config.test = {
        name: 'phpunit',
        command: 'phpunit --version',
        installCommand: 'composer require --dev phpunit/phpunit',
        checkCommand: 'phpunit --version',
        description: 'PHPUnit for PHP',
      };
    } else if (lang.includes('java') || lang.includes('kotlin')) {
      config.lint = {
        name: 'checkstyle',
        command: 'java -jar checkstyle.jar --version',
        installCommand: 'Download checkstyle.jar',
        checkCommand: 'java -jar checkstyle.jar --version',
        description: 'Checkstyle for Java/Kotlin',
      };
      config.test = {
        name: 'junit',
        command: 'mvn test -Dtest=...',
        installCommand: 'mvn test',
        checkCommand: 'mvn test -DskipTests',
        description: 'JUnit for Java',
      };
    } else if (lang.includes('c#') || lang.includes('csharp')) {
      config.lint = {
        name: 'roslyn',
        command: 'dotnet build',
        installCommand: 'dotnet add package Microsoft.CodeAnalysis.FxCopAnalyzers',
        checkCommand: 'dotnet build',
        description: 'Roslyn analyzers for C#',
      };
      config.test = {
        name: 'xunit',
        command: 'dotnet test',
        installCommand: 'dotnet add package xunit',
        checkCommand: 'dotnet test --no-build',
        description: 'xUnit for C#',
      };
    } else {
      return null;
    }

    return config;
  }
}
