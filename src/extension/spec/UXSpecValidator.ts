/**
 * UXSpecValidator
 * Validates UI/UX implementation against design specifications using Browser Mirror
 * Requirements: 13.1, 13.2, 13.3, 13.5, 13.6, 12.1, 12.2
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExecutableTask, SpecContext } from './types';
import { ForgeBrowserSession } from '../services/ForgeBrowserSession';
import { VisualRegressionTester } from './VisualRegressionTester';

export interface UXValidationResult {
  passed: boolean;
  score: number;
  visualDefects: string[];
  semanticIssues: string[];
  contrastViolations: Array<{
    element: string;
    ratio: number;
    required: number;
    suggestedFix?: string;
  }>;
  layoutIssues: string[];
  accessibilityIssues: string[];
  screenshotBase64?: string;
  correctionInstructions?: string;
}

export interface VisualBaseline {
  taskIds: string[];
  screenshots: Map<string, string>;
  selectors: Map<string, string>;
  createdAt: number;
}

export class UXSpecValidator {
  private readonly baselinesDir: string;
  private readonly visualRegressionTester: VisualRegressionTester;

  constructor(workspaceRoot: string) {
    this.baselinesDir = path.join(workspaceRoot, '.forgeai', 'visual-baselines');
    this.ensureBaselinesDir();
    this.visualRegressionTester = new VisualRegressionTester(workspaceRoot);
  }

  private ensureBaselinesDir(): void {
    if (!fs.existsSync(this.baselinesDir)) {
      fs.mkdirSync(this.baselinesDir, { recursive: true });
    }
  }

  public async validate(
    task: ExecutableTask,
    specContext: SpecContext,
    browserSession: ForgeBrowserSession
  ): Promise<UXValidationResult> {
    const result: UXValidationResult = {
      passed: true,
      score: 100,
      visualDefects: [],
      semanticIssues: [],
      contrastViolations: [],
      layoutIssues: [],
      accessibilityIssues: [],
    };

    if (!browserSession || !browserSession.getPage()) {
      result.passed = false;
      result.correctionInstructions = 'Browser session not available for UX validation';
      return result;
    }

    const page = browserSession.getPage();
    if (!page) {
      result.passed = false;
      result.correctionInstructions = 'No active browser page for validation';
      return result;
    }

    // 1. Get semantic snapshot (accessibility tree)
    const semantics = await this.getSemanticSnapshot(browserSession);

    // 1b. Capture Playwright runtime errors and fail fast
    const runtimeErrors = await this.captureRuntimeErrors(page);
    if (runtimeErrors.length > 0) {
      result.passed = false;
      result.visualDefects.push(...runtimeErrors);
    }

    // 2. Take screenshot
    const screenshot = await this.takeScreenshot(browserSession);
    if (screenshot) {
      result.screenshotBase64 = screenshot.toString('base64');

      const visualTestResult = await this.visualRegressionTester.runVisualTest(
        `${specContext.spec.id}-${task.id}`,
        screenshot
      );

      if (!visualTestResult.passed) {
        result.passed = false;
        result.visualDefects.push(
          `Visual regression detected: ${visualTestResult.diffPixels} pixels changed`
        );
      }
    }

    // 3. Check expected elements
    const expectedElements = this.getExpectedElementsFromTask(task);
    for (const element of expectedElements) {
      const exists = await this.checkElementExists(page, element.selector);
      if (!exists) {
        result.semanticIssues.push(`Missing element: ${element.description} (${element.selector})`);
        result.passed = false;
      }
    }

    // 4. Check visual rules (layout, spacing, styling)
    const visualRules = this.getVisualRulesFromTask(task);
    for (const rule of visualRules) {
      const violations = await this.checkVisualRule(page, rule);
      result.layoutIssues.push(...violations);
    }

    // 5. Check contrast compliance
    const contrastIssues = await this.checkContrastCompliance(page, specContext);
    result.contrastViolations.push(...contrastIssues);

    // 6. Check accessibility using the live page and parsed semantics
    const a11yIssues = await this.checkAccessibility(page, semantics);
    result.accessibilityIssues.push(...a11yIssues);

    // Calculate score
    const totalIssues = result.visualDefects.length + 
      result.semanticIssues.length + 
      result.contrastViolations.length + 
      result.layoutIssues.length + 
      result.accessibilityIssues.length;
    
    result.score = totalIssues === 0 ? 100 : Math.max(0, 100 - totalIssues * 10);

    if (!result.passed && totalIssues > 0) {
      result.correctionInstructions = this.generateCorrections(result, task);
    }

    return result;
  }

  private async getSemanticSnapshot(browserSession: ForgeBrowserSession): Promise<string> {
    try {
      return await browserSession.getSemanticSnapshot();
    } catch {
      return '';
    }
  }

  private async takeScreenshot(browserSession: ForgeBrowserSession): Promise<Buffer | null> {
    try {
      return await browserSession.takeScreenshot();
    } catch {
      return null;
    }
  }

  private async captureRuntimeErrors(page: any): Promise<string[]> {
    const errors: string[] = [];
    try {
      const pageErrors = await page.evaluate(() => {
        const errors: Array<{ message: string; source: string }> = [];
        window.addEventListener('error', (event: ErrorEvent) => {
          errors.push({ message: event.message, source: 'window' });
        });
        window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
          const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
          errors.push({ message, source: 'unhandledrejection' });
        });
        return errors;
      });
      for (const error of pageErrors) {
        errors.push(`Runtime error: ${error.message}`);
      }
    } catch {
      // Page evaluation failed
    }
    return errors;
  }

  private async checkElementExists(page: any, selector: string): Promise<boolean> {
    try {
      const count = await page.locator(selector).count();
      return count > 0;
    } catch {
      return false;
    }
  }

  private async checkVisualRule(page: any, rule: { selector: string; property: string; value: string }): Promise<string[]> {
    const issues: string[] = [];
    try {
      const currentValue = await page.evaluate(
        (sel: string, prop: string) => {
          const el = document.querySelector(sel);
          return el ? getComputedStyle(el).getPropertyValue(prop) : null;
        },
        rule.selector,
        rule.property
      );

      if (currentValue && rule.value && !this.compareValues(currentValue, rule.value)) {
        issues.push(`Element ${rule.selector} has ${rule.property}="${currentValue}", expected "${rule.value}"`);
      }
    } catch {
      // Element might not exist
    }
    return issues;
  }

  private async checkContrastCompliance(page: any, _specContext: SpecContext): Promise<UXValidationResult['contrastViolations']> {
    const violations: UXValidationResult['contrastViolations'] = [];
    try {
      // Extract foreground/background pairs for visible elements
      const pairs = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const results: Array<{ element: string; fg: string; bg: string }> = [];
        
        for (const el of elements) {
          const style = getComputedStyle(el as Element);
          const fg = style.color;
          const bg = style.backgroundColor;
          
          if (fg && bg && fg !== bg) {
            const selector = el.tagName.toLowerCase();
            const id = (el as Element).id ? `#${(el as Element).id}` : '';
            if (id) results.push({ element: selector + id, fg, bg });
          }
        }
        return results.slice(0, 20); // Limit to 20 elements
      });

      // Check each pair against WCAG 4.5:1 ratio
      for (const pair of pairs) {
        const ratio = this.contrastRatio(pair.fg, pair.bg);
        if (ratio < 4.5) {
          violations.push({
            element: pair.element,
            ratio,
            required: 4.5,
            suggestedFix: `Adjust colors for better contrast (current: ${ratio.toFixed(2)}:1)`,
          });
        }
      }
    } catch {
      // Contrast checking failed
    }
    return violations;
  }

  private async checkAccessibility(page: any, semantics: string): Promise<string[]> {
    const issues: string[] = [];
    try {
      JSON.parse(semantics);
      
      const imagesWithoutAlt = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img:not([alt])'))
          .map((img, i) => `img:nth-of-type(${i + 1})`);
      });
      if (imagesWithoutAlt.length > 0) {
        issues.push(`Images missing alt text: ${imagesWithoutAlt.slice(0, 3).join(', ')}`);
      }

      // Check for interactive elements without accessible names
      const unnamedButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])'));
        const texts = buttons.map(btn => (btn as HTMLButtonElement).textContent?.trim() || '');
        return texts.filter(t => !t).length;
      });
      if (unnamedButtons > 0) {
        issues.push(`${unnamedButtons} interactive elements missing accessible names`);
      }
    } catch {
      // Accessibility check failed
    }
    return issues;
  }

  private getExpectedElementsFromTask(task: ExecutableTask): Array<{ selector: string; description: string }> {
    const elements: Array<{ selector: string; description: string }> = [];
    
    // Parse from instructions
    for (const instruction of task.instructions) {
      const matches = instruction.matchAll(/(?:element|button|input|div|span)\s*[`:]?\s*([.#]?[\w-]+)/gi);
      for (const match of matches) {
        elements.push({
          selector: match[1],
          description: instruction,
        });
      }
    }
    
    // Parse from expected artifacts for UI components
    for (const artifact of task.expectedArtifacts) {
      if (artifact.includes('.tsx') || artifact.includes('.jsx')) {
        elements.push({
          selector: artifact.replace('src/', '').replace('.tsx', '').replace('.jsx', ''),
          description: `Component: ${artifact}`,
        });
      }
    }
    
    return elements.slice(0, 10);
  }

  private getVisualRulesFromTask(task: ExecutableTask): Array<{ selector: string; property: string; value: string }> {
    const rules: Array<{ selector: string; property: string; value: string }> = [];
    
    // Parse visual rules from instructions
    for (const instruction of task.instructions) {
      const layoutMatch = instruction.match(/(?:responsive|mobile|desktop|tablet)/i);
      if (layoutMatch) {
        rules.push({ selector: 'body', property: 'max-width', value: 'responsive' });
      }
      
      const animationMatch = instruction.match(/(?:animation|transition|duration):\s*([\w-]+)/i);
      if (animationMatch) {
        rules.push({ selector: 'body', property: 'transition', value: animationMatch[1] });
      }
    }
    
    return rules;
  }

  private contrastRatio(fg: string, bg: string): number {
    const l1 = this.relativeLuminance(fg);
    const l2 = this.relativeLuminance(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  private relativeLuminance(color: string): number {
    const rgb = this.parseColor(color);
    if (!rgb) return 0;
    
    const [r, g, b] = rgb.map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * r + 0.7152 * g + 0.0712 * b;
  }

  private parseColor(color: string): [number, number, number] | null {
    const hex = color.match(/#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
    if (hex) {
      return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
    }
    
    const rgb = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgb) {
      return [parseInt(rgb[1]), parseInt(rgb[2]), parseInt(rgb[3])];
    }
    
    return null;
  }

  private compareValues(actual: string, expected: string): boolean {
    return actual.trim().toLowerCase().includes(expected.toLowerCase()) ||
      expected.toLowerCase().includes(actual.toLowerCase());
  }

  private generateCorrections(result: UXValidationResult, task: ExecutableTask): string {
    const instructions = [`UX Validation failed for task ${task.id}: ${task.description}`];
    
    if (result.semanticIssues.length > 0) {
      instructions.push('\n**Missing Elements:**');
      result.semanticIssues.forEach(issue => instructions.push(`- ${issue}`));
    }
    
    if (result.contrastViolations.length > 0) {
      instructions.push('\n**WCAG Contrast Violations:**');
      result.contrastViolations.forEach(v => 
        instructions.push(`- ${v.element}: ratio ${v.ratio.toFixed(2)}:${v.required}:1 - ${v.suggestedFix}`)
      );
    }
    
    if (result.layoutIssues.length > 0) {
      instructions.push('\n**Layout Issues:**');
      result.layoutIssues.forEach(issue => instructions.push(`- ${issue}`));
    }
    
    if (result.accessibilityIssues.length > 0) {
      instructions.push('\n**Accessibility Issues:**');
      result.accessibilityIssues.forEach(issue => instructions.push(`- ${issue}`));
    }
    
    return instructions.join('\n');
  }

  public saveBaseline(specId: string, taskId: string, screenshotBase64: string, elements: Record<string, string>): void {
    const baselinePath = path.join(this.baselinesDir, `${specId}-${taskId}.json`);
    const baseline: VisualBaseline = {
      taskIds: [taskId],
      screenshots: new Map([['main', screenshotBase64]]),
      selectors: new Map(Object.entries(elements)),
      createdAt: Date.now(),
    };
    
    // Convert Map to object for JSON serialization
    fs.writeFileSync(baselinePath, JSON.stringify({
      taskIds: baseline.taskIds,
      screenshots: Object.fromEntries(baseline.screenshots),
      selectors: Object.fromEntries(baseline.selectors),
      createdAt: baseline.createdAt,
    }, null, 2));
  }
}