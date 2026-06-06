/**
 * E2EMapper
 *
 * Generates and maintains Playwright end-to-end tests for features.
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { OllamaClient } from '../ollama/OllamaClient';

export interface E2ETestCase {
  name: string;
  description: string;
  testCode: string;
  pageObject?: string;
}

export interface E2EMapperResult {
  tests: E2ETestCase[];
  outputDir: string;
}

export class E2EMapper {
  constructor(
    private readonly ollama: OllamaClient,
    private readonly logger: Logger,
    private readonly workspaceRoot: string
  ) {}

  public async mapFeatureToTests(featureDir: string): Promise<E2EMapperResult> {
    const components = this.findComponents(featureDir);
    const tests: E2ETestCase[] = [];

    for (const component of components) {
      const testCases = await this.generateTestsForComponent(component);
      tests.push(...testCases);
    }

    const outputDir = path.join(this.workspaceRoot, 'tests', 'e2e');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const testCase of tests) {
      const testPath = path.join(outputDir, `${this.toFileName(testCase.name)}.spec.ts`);
      fs.writeFileSync(testPath, testCase.testCode);
    }

    return { tests, outputDir };
  }

  private findComponents(featureDir: string): string[] {
    const components: string[] = [];
    const dir = featureDir || this.workspaceRoot;
    if (!fs.existsSync(dir)) return components;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !['node_modules', 'dist', '.git'].includes(entry.name)) {
        components.push(...this.findComponents(path.join(dir, entry.name)));
      } else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
        components.push(path.join(dir, entry.name));
      }
    }
    return components;
  }

  private async generateTestsForComponent(componentPath: string): Promise<E2ETestCase[]> {
    const componentName = path.basename(componentPath, path.extname(componentPath));
    const relativePath = path.relative(this.workspaceRoot, componentPath);

    const prompt = `
Generate a Playwright end-to-end test for the component at ${relativePath}.
Requirements:
- Use @playwright/test
- Follow "should [action] when [condition]" naming
- Include assertions for expected outcomes, error states, and edge cases
- Include accessibility checks where applicable

Output only the test code, no explanation.
`;

    try {
      const response = await this.ollama.chat({
        model: 'default',
        messages: [
          { role: 'system', content: 'You are a QA engineer. Generate Playwright tests.' },
          { role: 'user', content: prompt },
        ],
        stream: false,
      });

      const testCode = (response as { message?: { content?: string } }).message?.content || '';
      return [
        {
          name: `${componentName} should render and function correctly`,
          description: `End-to-end test for ${componentName}`,
          testCode: this.wrapPlaywrightTest(componentName, testCode),
        },
      ];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`E2E generation failed for ${componentPath}: ${msg}`);
      return [];
    }
  }

  private wrapPlaywrightTest(name: string, body: string): string {
    return `import { test, expect } from '@playwright/test';

test.describe('${name}', () => {
  test('should ${name.toLowerCase()} when loaded', async ({ page }) => {
${body
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  });
});
`;
  }

  private toFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
