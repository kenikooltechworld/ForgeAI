/**
 * BugfixAgent — generates a focused bugfix analysis document.
 *
 * Responsibilities:
 *  - Analyze the bug report / draft
 *  - Produce Current Behavior, Expected Behavior, Root Cause, Reproduction Steps,
 *    Affected Code, What MUST NOT Change, Fix Tasks
 *  - Write artifact via forgeai_writeSpecArtifact
 */

import { BaseAgent } from '../BaseAgent';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { OllamaClient } from '../../ollama/OllamaClient';
import { Logger } from '../../utils/Logger';
import { SpecManager } from '../../forgeaiWorkspace/SpecManager';
import { getToolsForAgent, renderToolSection } from '../ToolCatalog';
import { getConfiguredModel } from '../../config/ModelConfig';

export interface BugfixAgentInput {
  specId: string;
  title: string;
  description: string;
  draftBugfix: string;
}

export interface BugfixAgentOutput {
  specId: string;
  content: string;
  success: boolean;
  error?: string;
}

const BUGFIX_SYSTEM_PROMPT = `# ROLE AND PURPOSE

You are a senior software engineer performing a rigorous bugfix analysis.
Your task is to produce a bugfix specification that serves as the single source of truth for correcting a defect.

# OUTPUT DISCIPLINE
- Return ONLY valid Markdown. No JSON, no explanation, no preamble.
- Begin with the bug title heading "# Bug: {brief title}".
- Do NOT write notes after finishing.
- Stop writing once the "## Fix Tasks" section is complete.

## Required Sections

# Bug Title

## Current Behavior
Describe exactly what happens today with evidence (logs, screenshots, reproduction steps).

## Expected Behavior
Describe exactly what should happen instead.

## Root Cause Analysis
Provide a concise technical explanation of why the bug occurs.

## Reproduction Steps
1. Step one...
2. Step two...

## Affected Code
List specific files, functions, or modules that are involved.

## What MUST NOT Change
Explicitly list behavior, APIs, or data formats that must remain untouched during the fix.

## Fix Tasks
- [ ] Task 1: description
- [ ] Task 2: description

# Rules
- Be surgical — current behavior vs expected behavior must be unambiguous
- Use concrete examples, stack traces, reproduction steps, and affected file paths
- Each fix must be traceable back to a root cause analysis
- Do NOT use placeholders, "TBD", or "TODO"`;

export class BugfixAgent extends BaseAgent {
  constructor(
    toolRegistry: ToolRegistry,
    ollamaClient: OllamaClient,
    logger: Logger,
    private readonly specManager: SpecManager
  ) {
    super(toolRegistry, ollamaClient, logger);
  }

  getName(): string {
    return 'BugfixAgent';
  }

  getCapabilities(): string[] {
    return ['bugfix-analysis', 'root-cause-analysis', 'reproduction-steps', 'task-generation'];
  }

  async execute(input: any): Promise<any> {
    return this.generate(input as BugfixAgentInput);
  }

  async generate(input: BugfixAgentInput): Promise<BugfixAgentOutput> {
    return this.executeWithErrorHandling(async () => {
      const { specId, title, description, draftBugfix } = input;

      const toolSection = renderToolSection(this.getName());
      const toolDefinitions = this.toolRegistry.getToolDefinitions();

      const userPrompt = this.buildUserPrompt(title, description, draftBugfix, specId);

      const response = await this.ollamaClient.chat({
        model: getConfiguredModel(),
        messages: [
          { role: 'system', content: toolSection + '\n\n' + BUGFIX_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        tools: toolDefinitions,
        options: { temperature: 0.3 },
      });

      if (!('message' in response)) {
        throw new Error('Unexpected streaming response from Ollama');
      }

      const content = response.message.content.trim();
      return { specId, content, success: true };
    }, 'generate');
  }

  private buildUserPrompt(title: string, description: string, draftBugfix: string, specId: string): string {
    let prompt = `Write a complete bugfix analysis for: "${title}"\n\n`;
    if (description) {
      prompt += `Description:\n${description}\n\n`;
    }
    prompt += `Draft Bug Report (provided by user):\n${draftBugfix || 'No draft provided — infer from title.'}\n\n`;

    try {
      const spec = this.specManager.loadSpec(specId);
      if (spec) {
        prompt += `Existing Spec Context:\n`;
        prompt += `- Title: ${spec.config.title}\n`;
        prompt += `- Workflow: ${spec.config.workflow}\n`;
        if (spec.artifacts.requirements) {
          prompt += `- Requirements: ${spec.artifacts.requirements.slice(0, 1000)}\n`;
        }
        if (spec.artifacts.design) {
          prompt += `- Design: ${spec.artifacts.design.slice(0, 1000)}\n`;
        }
        prompt += '\n';
      }
    } catch {
      // Spec may not exist yet — proceed without it
    }

    prompt += `Be specific about files, functions, and exact behavior changes needed.\n`;

    return prompt;
  }
}

