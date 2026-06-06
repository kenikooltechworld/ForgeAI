/**
 * UI/UX Architect Agent
 * Refactored as a Master Architect for structural design and visual verification.
 * Requirements: 13.1, 13.2, 13.3, 13.5, 13.6
 */

import { BaseAgent } from '../BaseAgent';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { OllamaClient } from '../../ollama/OllamaClient';
import { Logger } from '../../utils/Logger';
import { ProjectContextDetector, ProjectContext } from './context/ProjectContextDetector';
import { UIUXTools } from './tools/UIUXTools';
import { BrowserMirrorTools } from './tools/BrowserMirrorTools';
import { DesignSystemStorage } from './storage/DesignSystemStorage';
import { formatAsJSON, formatAsCSS, formatAsTailwind } from './storage/TokenFormatters';
import { ForgeBrowserSession } from '../../services/ForgeBrowserSession';

/** Agent input request */
export interface UIUXAgentInput {
  /** What the user wants */
  request: string;
  /** Workspace root path */
  workspaceRoot: string;
  /** Optional: override detected context */
  context?: ProjectContext;
  /** Optional: current browser session for verification */
  browserSession?: ForgeBrowserSession;
}

/** Agent execution result */
export interface UIUXAgentResult {
  success: boolean;
  response: string;
  artifacts?: {
    designSystem?: string;
    tokensJson?: string;
    tokensCss?: string;
    tokensTailwind?: string;
  };
  context?: ProjectContext;
  error?: string;
}

/** System prompt for the Master UI/UX Architect Agent */
const UIUX_SYSTEM_PROMPT = `You are the Master UI/UX Architect for ForgeAI. Your goal is to design end-to-end software structures and verify their implementation visually.

Your expertise:
- **Structural Architecture**: Designing sitemaps, user flows, page-to-page transitions, and navigation systems for Web, Mobile, and Extensions.
- **Design Systems**: Generating complete design systems (colors, typography, spacing, shadows) based on Atomic Design principles.
- **Visual Verification**: Using the Browser Mirror to physically verify that the implementation matches the design specs.
- **Accessibility**: Ensuring WCAG 2.1 AA compliance.
- **Cross-Platform Adaptation**: Adapting layouts for different screen sizes and platforms.

## Master Architect Workflow
When tasked with a feature, you must follow this reasoning loop:
1. **Analyze**: Study the requirements and project context.
2. **Structure**: Define the structural design (which pages, what navigation, how user moves from A to B).
3. **Design**: Create the visual specifications (tokens, component hierarchy, layout rules).
4. **Verify**: After code is written, use the Browser Mirror tools (\`browser_get_semantics\`, \`browser_screenshot\`) to verify the implementation.
5. **Refine**: If visual or structural bugs are found, provide precise CSS or layout corrections.

## Rules
- Use semantic token names.
- Respect detected project context (e.g., React + Tailwind).
- Always prioritize user-centric flows and accessibility.
- When verifying, first check the semantic tree, then the visual screenshot.
- Provide rationale for all design and structural decisions.

## Output Format
Provide your response in markdown with:
1. **Architectural Decision**: Rationale for the structure/design으로
2. **Structural Map**: Sitemaps or flow descriptions.
3. **Visual Specs**: Tokens or component rules.
4. **Verification Report**: Results of the Browser Mirror checks (if applicable).
5. **Next Steps**: Clear instructions for the coding agent.`;

export class UIUXArchitectAgent extends BaseAgent {
  private readonly contextDetector: ProjectContextDetector;
  private readonly uiuxTools: UIUXTools;
  private readonly storage: DesignSystemStorage;
  private browserMirrorTools?: BrowserMirrorTools;

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
    return 'Master UI/UX Architect Agent';
  }

  /** Agent capabilities */
  public getCapabilities(): string[] {
    return [
      'structural-design',
      'create-design-system',
      'generate-design-tokens',
      'visual-verification',
      'accessibility-audit',
      'cross-platform-adaptation',
      'information-architecture',
    ];
  }

  /** System prompt for the agent */
  public getSystemPrompt(): string {
    return UIUX_SYSTEM_PROMPT;
  }

  /**
   * Execute the agent's primary function.
   * Now uses a reasoning loop instead of a simple dispatcher.
   */
  public async execute(input: UIUXAgentInput): Promise<UIUXAgentResult> {
    return this.executeWithErrorHandling(async () => {
      // Detect or use provided project context
      const context = input.context ?? (await this.contextDetector.detect(input.workspaceRoot));
      this.logInfo(`Project context: ${context.uiFramework} + ${context.styling}`);

      // If a browser session is provided, inject mirror tools into the agent's context
      if (input.browserSession) {
        this.browserMirrorTools = new BrowserMirrorTools(input.browserSession);
      }

      const userPrompt = `
        User Request: ${input.request}

        Project Context:
        - Framework: ${context.uiFramework}
        - Styling: ${context.styling}
        - Workspace: ${input.workspaceRoot}

        If this is a verification task, use the browser mirror tools to inspect the current state.
        If this is a design task, provide a comprehensive structural and visual specification.
      `;

      const response = await this.ollamaClient.chat({
        model: 'default',
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: userPrompt }
        ],
        stream: false
      }) as { message: { content: string } };

      return {
        success: true,
        response: response.message?.content || '',
        context,
      };
    }, `MasterUIUXArchitectAgent.execute: ${input.request}`);
  }

  /**
   * Specialized method for creating a design system (maintained for backward compatibility)
   */
  public async createDesignSystem(name: string, primaryColor: string, context: ProjectContext): Promise<UIUXAgentResult> {
    const result = await this.uiuxTools.createDesignSystem().execute({
      name,
      primaryColor,
      platforms: context.uiFramework === 'vscode-extension' ? ['vscode-extension'] : ['web'],
    });

    if (!result.success) {
      return { success: false, response: 'Failed to create design system.', error: result.error };
    }

    const tokens = this.storage.load();
    if (!tokens) {
      return { success: false, response: 'Design system was not saved properly.' };
    }

    return {
      success: true,
      response: `Created **${name}** with primary color \`${primaryColor}\`. Tokens saved to \`.forgeai/design-system/\`.`,
      artifacts: {
        designSystem: this.storage.getPaths().baseDir,
        tokensJson: formatAsJSON(tokens),
        tokensCss: formatAsCSS(tokens),
        tokensTailwind: formatAsTailwind(tokens),
      },
      context,
    };
  }
}
