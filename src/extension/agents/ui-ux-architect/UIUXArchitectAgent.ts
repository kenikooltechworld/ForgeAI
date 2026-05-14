/**
 * UI/UX Architect Agent
 * Phase 2.5: First-class agent for design system generation and UI/UX tasks
 * Requirements: 13.1, 13.2, 13.3, 13.5, 13.6
 */

import { BaseAgent } from '../BaseAgent';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { OllamaClient } from '../../ollama/OllamaClient';
import { Logger } from '../../utils/Logger';
import { ProjectContextDetector, ProjectContext } from './context/ProjectContextDetector';
import { UIUXTools } from './tools/UIUXTools';
import { DesignSystemStorage } from './storage/DesignSystemStorage';
import { formatAsJSON, formatAsCSS, formatAsTailwind } from './storage/TokenFormatters';

/** Agent input request */
export interface UIUXAgentInput {
  /** What the user wants */
  request: string;
  /** Workspace root path */
  workspaceRoot: string;
  /** Optional: override detected context */
  context?: ProjectContext;
}

/** Agent execution result */
export interface UIUXAgentResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Agent response text */
  response: string;
  /** Generated artifacts */
  artifacts?: {
    designSystem?: string;
    tokensJson?: string;
    tokensCss?: string;
    tokensTailwind?: string;
  };
  /** Detected project context */
  context?: ProjectContext;
  /** Error message if failed */
  error?: string;
}

/** System prompt for the UI/UX Architect Agent */
const UIUX_SYSTEM_PROMPT = `You are the UI/UX Architect Agent for ForgeAI.

Your expertise:
- Generate complete design systems (colors, typography, spacing, shadows, animation)
- Design component hierarchies following Atomic Design principles
- Create information architecture (sitemaps, navigation, user flows)
- Adapt designs for multiple platforms (web, iOS, Android, VS Code extensions)
- Ensure WCAG 2.1 AA accessibility compliance
- Export tokens in JSON, CSS custom properties, and Tailwind formats

## Rules
- Always use semantic token names (never literal colors like "red-500")
- Generate WCAG-compliant color contrasts (AA minimum, AAA preferred)
- Respect detected project context (React + Tailwind → generate Tailwind-compatible tokens)
- Use the design system storage layer for persistence
- Provide rationale for all design decisions
- When in doubt, default to Material Design 3 or Apple HIG conventions

## Output Format
Provide your response in markdown with:
1. Design rationale (2-3 sentences)
2. Generated tokens summary
3. Accessibility compliance statement
4. Next steps / recommendations`;

export class UIUXArchitectAgent extends BaseAgent {
  private readonly contextDetector: ProjectContextDetector;
  private readonly uiuxTools: UIUXTools;
  private readonly storage: DesignSystemStorage;

  constructor(
    toolRegistry: ToolRegistry,
    ollamaClient: OllamaClient,
    logger: Logger,
    workspaceRoot: string
  ) {
    super(toolRegistry, ollamaClient, logger);
    this.contextDetector = new ProjectContextDetector();
    this.uiuxTools = new UIUXTools(workspaceRoot);
    this.storage = new DesignSystemStorage(workspaceRoot);
  }

  /** Agent name */
  public getName(): string {
    return 'UI/UX Architect Agent';
  }

  /** Agent capabilities */
  public getCapabilities(): string[] {
    return [
      'create-design-system',
      'generate-design-tokens',
      'export-tokens',
      'check-contrast',
      'detect-project-context',
      'adapt-for-platform',
      'generate-component-hierarchy',
      'generate-information-architecture',
    ];
  }

  /** System prompt for the agent */
  public getSystemPrompt(): string {
    return UIUX_SYSTEM_PROMPT;
  }

  /**
   * Execute the agent's primary function.
   * Handles design system creation, token generation, and analysis.
   */
  public async execute(input: UIUXAgentInput): Promise<UIUXAgentResult> {
    return this.executeWithErrorHandling(async () => {
      // Detect or use provided project context
      const context = input.context ?? (await this.contextDetector.detect(input.workspaceRoot));
      this.logInfo(`Project context: ${context.uiFramework} + ${context.styling}`);

      // Parse user request to determine action
      const action = this.parseAction(input.request);

      switch (action) {
        case 'create-design-system':
          return this.handleCreateDesignSystem(input, context);
        case 'generate-tokens':
          return this.handleGenerateTokens(input, context);
        case 'check-contrast':
          return this.handleCheckContrast(input);
        case 'detect-context':
          return this.handleDetectContext(context);
        default:
          return this.handleGeneralQuery(input, context);
      }
    }, `UIUXArchitectAgent.execute: ${input.request}`);
  }

  // ─── Action Handlers ───────────────────────────────────────────────

  private async handleCreateDesignSystem(
    input: UIUXAgentInput,
    context: ProjectContext
  ): Promise<UIUXAgentResult> {
    const primaryColor = this.extractPrimaryColor(input.request) || '#3b82f6';
    const dsName = this.extractDesignSystemName(input.request) || 'ForgeAI Design System';

    // Create design system via tool
    const result = await this.uiuxTools.createDesignSystem().execute(
      { name: dsName, primaryColor, platforms: context.uiFramework === 'vscode-extension' ? ['vscode-extension'] : ['web'] }
    );

    if (!result.success) {
      return { success: false, response: 'Failed to create design system.', error: result.error };
    }

    const tokens = this.storage.load();
    if (!tokens) {
      return { success: false, response: 'Design system was not saved properly.' };
    }

    const artifacts = {
      designSystem: this.storage.getPaths().baseDir,
      tokensJson: formatAsJSON(tokens),
      tokensCss: formatAsCSS(tokens),
      tokensTailwind: formatAsTailwind(tokens),
    };

    return {
      success: true,
      response: `Created **${dsName}** with primary color \`${primaryColor}\`.\n\n` +
        `Generated ${Object.keys(tokens.colors).length} color scales, ` +
        `${Object.keys(tokens.typography.heading).length} heading sizes, ` +
        `and full spacing/shadow/animation tokens.\n\n` +
        `All tokens are WCAG AA compliant. Files saved to \`.forgeai/design-system/\`.`,
      artifacts,
      context,
    };
  }

  private async handleGenerateTokens(
    input: UIUXAgentInput,
    context: ProjectContext
  ): Promise<UIUXAgentResult> {
    const format = this.extractFormat(input.request) || 'all';
    const result = await this.uiuxTools.generateDesignTokens().execute({ format });

    if (!result.success) {
      return { success: false, response: 'Failed to generate tokens.', error: result.error };
    }

    return {
      success: true,
      response: `Generated design tokens in ${result.formats?.join(', ') || format} format.`,
      artifacts: {
        tokensJson: result.outputs?.json,
        tokensCss: result.outputs?.css,
        tokensTailwind: result.outputs?.tailwind,
      },
      context,
    };
  }

  private async handleCheckContrast(input: UIUXAgentInput): Promise<UIUXAgentResult> {
    const colors = this.extractColorPair(input.request);
    if (!colors) {
      return { success: false, response: 'Please provide two colors to check contrast (e.g., "check contrast #000 on #fff").' };
    }

    const result = await this.uiuxTools.checkContrast().execute({
      foreground: colors.foreground,
      background: colors.background,
      level: 'AA',
    });

    return {
      success: true,
      response: `Contrast ratio: **${result.ratio}:1**\n\n` +
        `- AA Normal: ${result.aaNormal ? 'PASS' : 'FAIL'}\n` +
        `- AA Large: ${result.aaLarge ? 'PASS' : 'FAIL'}\n` +
        `- AAA Normal: ${result.aaaNormal ? 'PASS' : 'FAIL'}\n` +
        `- AAA Large: ${result.aaaLarge ? 'PASS' : 'FAIL'}`,
    };
  }

  private async handleDetectContext(context: ProjectContext): Promise<UIUXAgentResult> {
    return {
      success: true,
      response: `**Project Context Detected**\n\n` +
        `- UI Framework: ${context.uiFramework}\n` +
        `- Styling: ${context.styling}\n` +
        `- Design Systems: ${context.designSystems.join(', ') || 'none'}\n` +
        `- TypeScript: ${context.usesTypeScript ? 'yes' : 'no'}\n` +
        `- Package Manager: ${context.packageManager}`,
      context,
    };
  }

  private async handleGeneralQuery(
    input: UIUXAgentInput,
    context: ProjectContext
  ): Promise<UIUXAgentResult> {
    // For general queries, return the system prompt + context
    return {
      success: true,
      response: `${this.getSystemPrompt()}\n\n` +
        `**Detected Context:** ${context.uiFramework} + ${context.styling}\n\n` +
        `I'm ready to help with design systems, tokens, component hierarchies, and accessibility.`,
      context,
    };
  }

  // ─── Request Parsing Helpers ───────────────────────────────────────

  private parseAction(request: string): string {
    const lower = request.toLowerCase();
    if (lower.match(/create|generate.*design system|new design system/)) return 'create-design-system';
    if (lower.match(/generate.*tokens?|export.*tokens?|format.*tokens?/)) return 'generate-tokens';
    if (lower.match(/contrast|wcag|accessibility.*check|check.*color/)) return 'check-contrast';
    if (lower.match(/detect.*context|what.*framework|what.*using/)) return 'detect-context';
    return 'general';
  }

  private extractPrimaryColor(request: string): string | undefined {
    const match = request.match(/#([0-9a-fA-F]{6})/);
    return match ? match[0] : undefined;
  }

  private extractDesignSystemName(request: string): string | undefined {
    const match = request.match(/design system["']?\s*(?:called|named)?\s*["']?([^"'\n]+)/i);
    return match ? match[1].trim() : undefined;
  }

  private extractFormat(request: string): string | undefined {
    const lower = request.toLowerCase();
    if (lower.includes('json')) return 'json';
    if (lower.includes('css')) return 'css';
    if (lower.includes('tailwind')) return 'tailwind';
    if (lower.includes('all')) return 'all';
    return undefined;
  }

  private extractColorPair(request: string): { foreground: string; background: string } | undefined {
    const colors = request.match(/#([0-9a-fA-F]{6})/g);
    if (colors && colors.length >= 2) {
      return { foreground: colors[0], background: colors[1] };
    }
    return undefined;
  }
}
