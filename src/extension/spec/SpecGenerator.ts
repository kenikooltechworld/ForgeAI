/**
 * SpecGenerator
 *
 * Generates a complete spec from a user description.
 * Pipeline: requirements.md → design.md (via UIUXArchitectAgent) → tasks.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { SPEC_DIR_LAYOUT, type ParsedSpec, type SpecRequirement, type EARSCriterion, type ExecutableTask, type TaskPhase } from './types';
import { UIUXArchitectAgent, UIUXAgentInput, UIUXAgentResult } from '../agents/ui-ux-architect/UIUXArchitectAgent';
import { OllamaClient } from '../ollama/OllamaClient';
import { Logger } from '../utils/Logger';
import type { TaskStatus } from './types';

export interface ProjectBuilderInput {
  description: string;
  techStack: string[];
  features: string[];
  projectName: string;
  designMockups?: Buffer[];
}

export interface GeneratedSpec {
  specDir: string;
  requirements: SpecRequirement[];
  design: string;
  tasks: ExecutableTask[];
  phases: TaskPhase[];
}

export class SpecGenerator {
  constructor(
    private readonly ollama: OllamaClient,
    private readonly logger: Logger,
    private readonly workspaceRoot: string
  ) {}

  public async generate(input: ProjectBuilderInput): Promise<GeneratedSpec> {
    const specDir = path.join(this.workspaceRoot, SPEC_DIR_LAYOUT.specsDir, input.projectName);
    this.ensureDir(specDir);

    const requirements = await this.generateRequirements(input, specDir);
    const design = await this.generateDesign(input, requirements, specDir);
    const { tasks, phases } = this.generateTasks(input, requirements, design, specDir);

    this.writeStatus(specDir, tasks);

    return {
      specDir,
      requirements,
      design,
      tasks,
      phases,
    };
  }

  private async generateRequirements(input: ProjectBuilderInput, specDir: string): Promise<SpecRequirement[]> {
    const requirements: SpecRequirement[] = [];
    for (let i = 0; i < input.features.length; i++) {
      const feature = input.features[i];
      requirements.push({
        id: String(i + 1),
        title: feature,
        description: feature,
        userStory: `As a user, I want ${feature.toLowerCase()}, so that I can use it.`,
        acceptanceCriteria: [
          {
            pattern: 'ubiquitous',
            text: `The system SHALL implement ${feature.toLowerCase()}.`,
            requirementIds: [String(i + 1)],
          },
        ],
        inScope: [feature],
        outOfScope: [],
      });
    }

    const content = this.renderRequirementsMarkdown(requirements);
    fs.writeFileSync(path.join(specDir, SPEC_DIR_LAYOUT.requirementsFile), content);
    return requirements;
  }

  private async generateDesign(input: ProjectBuilderInput, requirements: SpecRequirement[], specDir: string): Promise<string> {
    const requirementsText = requirements
      .map((r) => `## ${r.id}. ${r.title}\n${r.description}\n`)
      .join('\n');

    const prompt = `
You are the Master UI/UX Architect Agent.

## Project Description
${input.description}

## Tech Stack
${input.techStack.join(', ')}

## Requirements
${requirementsText}

## Your Job
Create a comprehensive design.md document that covers:
1. Structural Architecture — pages, routes, navigation, user flows
2. Design System — colors, typography, spacing, shadows, border radius
3. Component Hierarchy — atomic design structure
4. Layout Rules — responsive breakpoints, grid systems
5. Accessibility Guidelines — WCAG 2.1 AA compliance rules
6. Visual QA Criteria — what to verify after implementation

Output ONLY markdown. Do not include code fences around the markdown.
`;

    try {
      const agent = new UIUXArchitectAgent(
        {} as any,
        this.ollama,
        this.logger,
        this.workspaceRoot
      );
      const result = await agent.execute({
        request: prompt,
        workspaceRoot: specDir,
      });

      const design = result.response || this.defaultDesign(input);
      fs.writeFileSync(path.join(specDir, 'design.md'), design);
      return design;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SpecGenerator: UIUXArchitectAgent failed: ${msg}`);
      const design = this.defaultDesign(input);
      fs.writeFileSync(path.join(specDir, 'design.md'), design);
      return design;
    }
  }

  private generateTasks(input: ProjectBuilderInput, requirements: SpecRequirement[], design: string, specDir: string): {
    tasks: ExecutableTask[];
    phases: TaskPhase[];
  } {
    const tasks: ExecutableTask[] = [];
    let taskId = 1;

    // Phase 1: Setup
    tasks.push({
      id: `1.${taskId++}`,
      phase: 1,
      description: 'Initialize project structure and configuration',
      instructions: [
        'Create package.json with dependencies for the selected tech stack',
        'Create tsconfig.json with strict type checking',
        'Create project folder structure (src/, public/, tests/, docs/)',
        'Initialize git repository',
        'Create README.md with project description and setup instructions',
      ],
      requirementIds: [],
      propertyTests: [],
      dependencies: [],
      status: 'pending' as TaskStatus,
      expectedArtifacts: ['package.json', 'tsconfig.json', 'README.md'],
      retryCount: 0,
      maxRetries: 2,
      isCheckpoint: false,
      isPropertyTest: false,
      producedArtifacts: [],
    });

    // Phase 2: Design system (from design.md)
    tasks.push({
      id: '2.1',
      phase: 2,
      description: 'Implement design system tokens and styles',
      instructions: [
        'Create CSS/SCSS variables from design.md color palette',
        'Implement typography scale and font loading',
        'Create spacing and layout utility classes',
        'Set up CSS reset and base styles',
        'Create theme configuration file',
      ],
      requirementIds: requirements.slice(0, Math.max(1, Math.floor(requirements.length / 4))).map((r) => r.id),
      propertyTests: [],
      dependencies: [`1.${taskId - 1}`],
      status: 'pending' as TaskStatus,
      expectedArtifacts: ['src/styles/tokens.css', 'src/styles/global.css'],
      retryCount: 0,
      maxRetries: 2,
      isCheckpoint: false,
      isPropertyTest: false,
      producedArtifacts: [],
    });

    // Phase 3: Components
    const componentTasks = input.features.map((feature, idx) => ({
      id: `3.${idx + 1}`,
      phase: 3,
      description: `Implement ${feature}`,
      instructions: [
        `Create component(s) for ${feature}`,
        'Implement required functionality',
        'Add unit tests for new components',
        'Verify accessibility compliance',
      ],
      requirementIds: [requirements[Math.min(idx, requirements.length - 1)]?.id || String(idx + 1)],
      propertyTests: [],
      dependencies: ['2.1'],
      status: 'pending' as TaskStatus,
      expectedArtifacts: [`src/components/${feature.toLowerCase().replace(/\s+/g, '-')}.tsx`],
      retryCount: 0,
      maxRetries: 2,
      isCheckpoint: false,
      isPropertyTest: false,
      producedArtifacts: [],
    }));
    tasks.push(...componentTasks);

    // Phase 4: Integration
    tasks.push({
      id: '4.1',
      phase: 4,
      description: 'Integrate components and verify end-to-end flow',
      instructions: [
        'Connect all components to main application',
        'Verify routing and navigation',
        'Run full test suite',
        'Verify all tests pass',
      ],
      requirementIds: requirements.map((r) => r.id),
      propertyTests: [],
      dependencies: componentTasks.map((t) => t.id),
      status: 'pending' as TaskStatus,
      expectedArtifacts: ['src/App.tsx', 'src/main.tsx'],
      retryCount: 0,
      maxRetries: 2,
      isCheckpoint: true,
      isPropertyTest: false,
      producedArtifacts: [],
    });

    // Phase 5: Final QA
    tasks.push({
      id: '5.1',
      phase: 5,
      description: 'Run visual QA and final verification',
      instructions: [
        'Run Visual QA Agent on all pages',
        'Fix any visual defects',
        'Verify WCAG accessibility compliance',
        'Run full test suite one final time',
      ],
      requirementIds: requirements.map((r) => r.id),
      propertyTests: [],
      dependencies: ['4.1'],
      status: 'pending' as TaskStatus,
      expectedArtifacts: [],
      retryCount: 0,
      maxRetries: 2,
      isCheckpoint: true,
      isPropertyTest: false,
      producedArtifacts: [],
    });

    const phases = this.groupIntoPhases(tasks);
    return { tasks, phases };
  }

  private groupIntoPhases(tasks: ExecutableTask[]): TaskPhase[] {
    const phaseMap = new Map<number, ExecutableTask[]>();
    for (const task of tasks) {
      const existing = phaseMap.get(task.phase) || [];
      existing.push(task);
      phaseMap.set(task.phase, existing);
    }

    const phases: TaskPhase[] = [];
    const sortedNumbers = Array.from(phaseMap.keys()).sort((a, b) => a - b);
    for (const number of sortedNumbers) {
      const phaseTasks = phaseMap.get(number) || [];
      phases.push({
        number,
        title: `Phase ${number}`,
        tasks: phaseTasks,
        isComplete: phaseTasks.every((t) => t.status === 'complete'),
      });
    }
    return phases;
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private renderRequirementsMarkdown(requirements: SpecRequirement[]): string {
    const lines = ['# Requirements', ''];
    for (const req of requirements) {
      lines.push(`## ${req.id}. ${req.title}`);
      lines.push('');
      if (req.userStory) {
        lines.push(`**User Story:** ${req.userStory}`);
        lines.push('');
      }
      if (req.description) {
        lines.push(req.description);
        lines.push('');
      }
      lines.push('### Acceptance Criteria');
      lines.push('');
      for (const criterion of req.acceptanceCriteria) {
        lines.push(`- [ ] ${criterion.text}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  private defaultDesign(input: ProjectBuilderInput): string {
    return `# Design Document\n\n## Project\n${input.description}\n\n## Tech Stack\n${input.techStack.join(', ')}\n\n## Architecture\n\n### Pages\n- Home\n- Feature pages\n\n### Component Hierarchy\n- Layout\n- Pages\n- Components\n- Atoms\n\n## Design System\n\n### Colors\n- Primary: #3b82f6\n- Secondary: #64748b\n- Background: #ffffff\n- Text: #0f172a\n\n### Typography\n- Font: system-ui\n- Base size: 16px\n- Scale: 1.25\n\n### Spacing\n- Unit: 4px\n- Scale: 0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32\n\n## Accessibility\n- WCAG 2.1 AA compliance\n- Minimum contrast ratio 4.5:1\n\n## Visual QA Criteria\n- No overlapping elements\n- No text overflow\n- No broken images\n- Consistent spacing\n`;
  }

  private writeStatus(specDir: string, tasks: ExecutableTask[]): void {
    const status = {
      specId: path.basename(specDir),
      generatedAt: Date.now(),
      totalTasks: tasks.length,
      completedTasks: 0,
      tasks: tasks.map((t) => ({
        id: t.id,
        status: t.status,
        expectedArtifacts: t.expectedArtifacts,
      })),
    };
    fs.writeFileSync(path.join(specDir, '.status'), JSON.stringify(status, null, 2));
  }
}
