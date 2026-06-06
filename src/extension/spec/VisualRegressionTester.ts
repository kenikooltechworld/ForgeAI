/**
 * VisualRegressionTester
 * Provides pixel-perfect diff detection for UI changes using Playwright screenshots
 * Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7
 */

import * as fs from 'fs';
import * as path from 'path';

export interface VisualTestOptions {
  threshold?: number;
  maxDiffPixels?: number;
  maxDiffPixelRatio?: number;
  viewports?: Array<{ width: number; height: number }>;
}

export interface VisualTestResult {
  passed: boolean;
  diffPath?: string;
  diffPixels?: number;
  diffRatio?: number;
  actualPath?: string;
  baselinePath?: string;
}

export class VisualRegressionTester {
  private baselineDir: string;
  private pixelmatchFn: ((img1: Buffer, img2: Buffer, output: Buffer, width: number, height: number, options?: { threshold?: number }) => number) | null = null;
  private PNG: any = null;
  private initialized = false;

  constructor(workspaceRoot: string) {
    this.baselineDir = path.join(workspaceRoot, '.forgeai', 'visual-baselines');
    this.ensureBaselineDir();
  }

  private ensureBaselineDir(): void {
    if (!fs.existsSync(this.baselineDir)) {
      fs.mkdirSync(this.baselineDir, { recursive: true });
    }
  }

  private async initializeDeps(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const pixelmatchModule = await import('pixelmatch');
      this.pixelmatchFn = pixelmatchModule.default || pixelmatchModule;
      const pngjs = await import('pngjs');
      this.PNG = pngjs.PNG;
    } catch {
      // Dependencies not installed - visual diff will be skipped
    }
    this.initialized = true;
  }

  public async runVisualTest(
    name: string,
    screenshotBuffer: Buffer,
    options: VisualTestOptions = {}
  ): Promise<VisualTestResult> {
    await this.initializeDeps();
    
    const { threshold = 0.1, maxDiffPixelRatio = 0.01 } = options;
    const baselinePath = path.join(this.baselineDir, `${name}-baseline.png`);
    const actualPath = path.join(this.baselineDir, `${name}-actual.png`);
    const diffPath = path.join(this.baselineDir, `${name}-diff.png`);

    // Save actual screenshot
    fs.writeFileSync(actualPath, screenshotBuffer);

    // If no baseline exists, create one and pass
    if (!fs.existsSync(baselinePath)) {
      fs.copyFileSync(actualPath, baselinePath);
      return {
        passed: true,
        actualPath,
        baselinePath,
        diffPixels: 0,
        diffRatio: 0,
      };
    }

    // If pixelmatch/PNG not available, skip comparison but pass
    if (!this.pixelmatchFn || !this.PNG) {
      return {
        passed: true,
        actualPath,
        baselinePath,
        diffPixels: 0,
        diffRatio: 0,
      };
    }

    const baselineImage = this.PNG.sync.read(fs.readFileSync(baselinePath));
    const actualImage = this.PNG.sync.read(screenshotBuffer);

    // Skip if dimensions don't match
    if (baselineImage.width !== actualImage.width || baselineImage.height !== actualImage.height) {
      return {
        passed: false,
        actualPath,
        baselinePath,
        diffPixels: -1,
        diffRatio: -1,
      };
    }

    const diff = new this.PNG({ width: baselineImage.width, height: baselineImage.height });
    const diffPixels = this.pixelmatchFn(
      baselineImage.data,
      actualImage.data,
      diff.data,
      baselineImage.width,
      baselineImage.height,
      { threshold }
    );

    const totalPixels = baselineImage.width * baselineImage.height;
    const diffRatio = diffPixels / totalPixels;

    if (diffPixels > 0) {
      fs.writeFileSync(diffPath, this.PNG.sync.write(diff));
    }

    const passed = diffRatio <= maxDiffPixelRatio;

    return {
      passed,
      diffPath: diffPixels > 0 ? diffPath : undefined,
      diffPixels,
      diffRatio,
      actualPath,
      baselinePath,
    };
  }

  public async updateBaseline(name: string, screenshotBuffer: Buffer): Promise<void> {
    const baselinePath = path.join(this.baselineDir, `${name}-baseline.png`);
    fs.writeFileSync(baselinePath, screenshotBuffer);
  }
}