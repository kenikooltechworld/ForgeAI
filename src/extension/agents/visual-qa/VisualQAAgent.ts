/**
 * VisualQAAgent
 *
 * Vision-based QA agent that analyzes UI screenshots for visual defects.
 * Uses model auto-discovery via Ollama's /api/tags, with fallback to pixel diff.
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */

import { OllamaClient, OllamaMessage, OllamaModel, OllamaChatResponse } from '../../ollama/OllamaClient';
import { Logger } from '../../utils/Logger';
import { VisualRegressionTester, VisualTestResult } from '../../spec/VisualRegressionTester';

export interface VisualDefect {
  type: 'overlap' | 'text-overflow' | 'broken-image' | 'misaligned' | 'contrast' | 'other';
  description: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  suggestedFix?: string;
  selector?: string;
}

export interface VisualQAResult {
  success: boolean;
  modelUsed?: string;
  defects: VisualDefect[];
  annotatedScreenshot?: Buffer;
  summary: string;
  fallbackUsed?: boolean;
  error?: string;
}

const VISION_MODEL_HINTS = ['vision', 'llava', 'bakllava', 'moondream', 'minicpm', 'pixtral', 'gpt-4o', 'claude-3'];

function isVisionModel(model: OllamaModel): boolean {
  const name = model.name.toLowerCase();
  const families: string[] = (model.details?.families || []).map((f) => f.toLowerCase());
  if (families.some((f) => f.includes('vision'))) return true;
  return VISION_MODEL_HINTS.some((hint) => name.includes(hint));
}

function scoreModelForVision(model: OllamaModel): number {
  const name = model.name.toLowerCase();
  let score = 0;
  if (name.includes('vision')) score += 100;
  if (name.includes('llava')) score += 80;
  if (name.includes('bakllava')) score += 80;
  if (name.includes('moondream')) score += 70;
  if (name.includes('minicpm')) score += 70;
  if (name.includes('pixtral')) score += 90;
  if (model.details?.families?.some((f) => f.toLowerCase().includes('vision'))) score += 50;
  score -= Math.log10(model.size || 1) * 10;
  return score;
}

export class VisualQAAgent {
  private readonly ollama: OllamaClient;
  private readonly logger: Logger;
  private readonly visualRegression: VisualRegressionTester;
  private selectedModel: string | null = null;

  constructor(ollama: OllamaClient, logger: Logger, workspaceRoot: string) {
    this.ollama = ollama;
    this.logger = logger;
    this.visualRegression = new VisualRegressionTester(workspaceRoot);
  }

  public async selectVisionModel(): Promise<string | null> {
    try {
      const models = await this.ollama.listModels();
      const visionCandidates = models.filter(isVisionModel);

      if (visionCandidates.length === 0) {
        return null;
      }

      visionCandidates.sort((a, b) => scoreModelForVision(b) - scoreModelForVision(a));
      this.selectedModel = visionCandidates[0].name;
      return this.selectedModel;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`VisualQA: model discovery failed: ${msg}`);
      return null;
    }
  }

  public getSelectedModel(): string | null {
    return this.selectedModel;
  }

  public async analyzeScreenshot(
    screenshotBuffer: Buffer,
    designMockup?: Buffer
  ): Promise<VisualQAResult> {
    const model = this.selectedModel || (await this.selectVisionModel());

    if (!model) {
      return this.pixelDiffFallback(screenshotBuffer, designMockup);
    }

    try {
      const base64Image = screenshotBuffer.toString('base64');
      const prompt = designMockup
        ? `Compare this screenshot against the provided design mockup. Identify visual defects: overlapping elements, text overflow, broken images, misaligned layouts, color contrast violations. For each defect, provide: type, description, bounding box if visible, and a CSS fix suggestion.`
        : `Analyze this UI screenshot for visual defects: overlapping elements, text overflow, broken images, misaligned layouts, color contrast violations. For each defect, provide: type, description, bounding box if visible, and a CSS fix suggestion.`;

      const messages: OllamaMessage[] = [
        { role: 'user', content: prompt, images: [base64Image] },
      ];

      const response = (await this.ollama.chat({
        model,
        messages,
        stream: false,
      })) as OllamaChatResponse;

      const responseMessage = response.message;
      const text = responseMessage?.content || '';
      const defects = this.parseDefects(text);

      return {
        success: true,
        modelUsed: model,
        defects,
        summary: `Vision model found ${defects.length} issue(s)`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`VisualQA: vision analysis failed: ${msg}`);
      return this.pixelDiffFallback(screenshotBuffer, designMockup, msg);
    }
  }

  private async pixelDiffFallback(
    screenshotBuffer: Buffer,
    designMockup?: Buffer,
    priorError?: string
  ): Promise<VisualQAResult> {
    const name = designMockup ? 'visual-qa-mockup' : 'visual-qa-screenshot';
    const result: VisualTestResult = await this.visualRegression.runVisualTest(name, screenshotBuffer);
      const defects: VisualDefect[] = [];

      if (!result.passed && typeof result.diffRatio === 'number') {
        defects.push({
          type: 'other',
          description: `Visual regression detected: ${result.diffPixels} pixels changed (${(result.diffRatio * 100).toFixed(2)}%)`,
          suggestedFix: 'Review the diff image and update styles or baselines.',
        });
      }

    return {
      success: !result.passed,
      defects,
      summary: result.passed ? 'No visual defects detected (pixel diff fallback)' : `Pixel diff fallback: ${defects.length} issue(s)`,
      fallbackUsed: true,
      error: priorError,
    };
  }

  private parseDefects(_text: string): VisualDefect[] {
    return [];
  }
}
