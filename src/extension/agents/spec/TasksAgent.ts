/**
 * TasksAgent — generates tasks.md (implementation plan) from design + requirements.
 *
 * Responsibilities:
 *  - Reference requirements and design documents
 *  - Produce phase-based task breakdown with Test Specifications per task
 *  - Write artifact via forgeai_writeSpecArtifact
 */

import { BaseAgent } from '../BaseAgent';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { OllamaClient } from '../../ollama/OllamaClient';
import { Logger } from '../../utils/Logger';
import { SpecManager } from '../../forgeaiWorkspace/SpecManager';
import { getToolsForAgent, renderToolSection } from '../ToolCatalog';
import { getConfiguredModel } from '../../config/ModelConfig';

export interface TasksAgentInput {
  specId: string;
  title: string;
  description: string;
  requirements: string;
  design: string;
}

export interface TasksAgentOutput {
  specId: string;
  content: string;
  success: boolean;
  error?: string;
}

const TASKS_SYSTEM_PROMPT = `# ROLE AND PURPOSE

You are a senior engineering lead breaking down a design into discrete, trackable implementation tasks following the Kiro template format EXACTLY.

# MANDATORY Section Structure (follow this exact order, use these exact headings)
1.  Title: "# Implementation Plan: {SPEC_NAME}"
2.  ## Overview — One paragraph describing what is being built.
    - **Estimated Total Duration**: {N} {weeks/days}
3.  ---
4.  ## Phase N: {Phase Title} ({Timeframe})
    Each phase contains numbered tasks ("### Task N.M: {Task Title}") with these exact fields:
    - **Priority**: Critical | High | Medium | Low
    - **Estimate**: {N} {days/hours}
    - **Dependencies**: None | Task X.Y | Task X.Y, Task Z.W
    - **Description**: {What this task accomplishes — be specific and comprehensive}
    - **Subtasks**: Checklist "- [ ] {Subtask}"
    - **Acceptance Criteria**: Checklist "- [ ] {Criterion linking to requirement}"
    - **Test Specification**: REQUIRED for every task. Must include:
      - **Test Type**: unit | integration | e2e | static (TypeScript compilation)
      - **Test Files**: List of test files to create (e.g., "src/feature/__tests__/Component.test.ts")
      - **Test Cases**: Specific test cases as bullet points — "- Should {expected behavior when condition}"
      - **Coverage Target**: Minimum % coverage expected (default: 70% for unit tests)
    - **Verification Steps**: Checklist "- [ ] {How to verify this task is complete and correct}"
      - Must include: "- [ ] All tests pass with 100% success rate"
      - Must include: "- [ ] TypeScript compilation succeeds with zero errors"
      - Must include: "- [ ] No linting errors introduced"
    - **Implements**: Requirement {X.Y}, {X.Y}
    - Separate each task with ---
    - Order phases by dependency (Phase 1: setup/infrastructure, Phase 2: core implementation, Phase 3: integration/testing, etc.)

# CRITICAL: Test-Driven Task Requirements
Every implementation task MUST include a Test Specification. Follow this flow:
1. **Write tests FIRST** — Before implementing, generate the test file with failing tests
2. **Implement the feature** — Write the minimum code to make tests pass
3. **Run all tests** — Verify 100% pass rate (no failures allowed)
4. **Run TypeScript check** — npx tsc --noEmit must have zero errors
5. **Run lint check** — No new linting errors introduced
6. **Only then mark task complete**

If a task has no testable logic (e.g., configuration, documentation), the Test Type is "static" and verification is TypeScript compilation only.

# CRITICAL Negative Constraints — NEVER Do These
- NEVER create a section called "## Functional Requirements" or "## User Stories"
- NEVER describe data models or API schemas as tasks — tasks are implementation actions, not specifications
- NEVER invent headings outside the mandatory list above
- NEVER skip the Test Specification section for any task
- NEVER use vague test cases like "should work" or "should be correct" — be specific

# Rules
- Each task must be atomic (one developer can complete it in 1-4 hours)
- Tasks must reference specific requirements by ID or description
- Include file paths and function/class names where applicable
- Order tasks by dependency (setup/infrastructure first, independent next, integration last)
- Do NOT use placeholders, "TBD", or "TODO"
- Use checkboxes for subtasks and acceptance criteria: "- [ ] ..."
- Replace {SPEC_NAME} with the actual feature name in the title
- Each phase MUST end with a "Phase Gate" task that validates all previous tasks in the phase pass 100%

# OUTPUT DISCIPLINE
- Return ONLY valid Markdown. No JSON, no explanation, no preamble.
- Begin with "# Implementation Plan: {SPEC_NAME}"
- Stop writing once the final section is complete`;

export class TasksAgent extends BaseAgent {
  constructor(
    toolRegistry: ToolRegistry,
    ollamaClient: OllamaClient,
    logger: Logger,
    private readonly specManager: SpecManager
  ) {
    super(toolRegistry, ollamaClient, logger);
  }

  getName(): string {
    return 'TasksAgent';
  }

  getCapabilities(): string[] {
    return [
      'task-decomposition',
      'test-driven-task-design',
      'dependency-ordering',
      'phase-gate-planning',
      'acceptance-criteria-linking',
    ];
  }

  async execute(input: any): Promise<any> {
    return this.generate(input as TasksAgentInput);
  }

  async generate(input: TasksAgentInput): Promise<TasksAgentOutput> {
    return this.executeWithErrorHandling(async () => {
      const { specId, title, description, requirements, design } = input;

      const toolSection = renderToolSection(this.getName());
      const toolDefinitions = this.toolRegistry.getToolDefinitions();

      const userPrompt = this.buildUserPrompt(title, description, requirements, design);

      const response = await this.ollamaClient.chat({
        model: getConfiguredModel(),
        messages: [
          { role: 'system', content: toolSection + '\n\n' + TASKS_SYSTEM_PROMPT },
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

  private buildUserPrompt(title: string, description: string, requirements: string, design: string): string {
    let prompt = `Write a complete implementation task breakdown for: "${title}"\n\n`;
    prompt += `Requirements Summary:\n${requirements.slice(0, 2000)}\n\n`;
    prompt += `Design Summary:\n${design.slice(0, 2000)}\n\n`;
    prompt += `Write the implementation plan now following the EXACT template below.\n`;
    prompt += `Replace all {placeholder} content with real, specific content for "${title}".\n`;
    prompt += `Keep the exact heading levels, horizontal rules (---), and section order.\n`;
    prompt += `Do NOT invent new sections or change the structure.\n\n`;
    prompt += `--- EXACT TEMPLATE TO FOLLOW ---\n`;
    prompt += this.specManager.tasksTemplate().replace(/{SPEC_NAME}/g, title);
    prompt += `\n--- END TEMPLATE ---\n`;

    prompt += `\n# OUTPUT DISCIPLINE\n`;
    prompt += `- Write ONLY the implementation plan\n`;
    prompt += `- Begin with "# Implementation Plan: ${title}"\n`;
    prompt += `- Do NOT write preamble, conclusion, code fences around output, or notes after finishing\n`;
    prompt += `- Stop writing once the final section is complete\n`;

    return prompt;
  }
}

