/**
 * SpecOrchestrator — thin facade that wires the specialized spec agents.
 *
 * Replaces the old monolithic SpecWriterAgent.generate/continue flow:
 *   RequirementsAgent → (neurosymbolic analysis) → DesignAgent → TasksAgent
 *
 * All four specialized agents (RequirementsAgent, DesignAgent, TasksAgent, BugfixAgent)
 * receive complete tool definitions and know exactly which tools they have,
 * when to use them, and how to use them.
 *
 * Backward-compatible: forgeai_continueSpec still dynamically imports SpecWriterAgent,
 * which internally delegates to this orchestrator.
 */

import { Logger } from '../../utils/Logger';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { OllamaClient } from '../../ollama/OllamaClient';
import { SpecManager } from '../../forgeaiWorkspace/SpecManager';
import { ProductManager } from '../../forgeaiWorkspace/ProductManager';
import { MemoryManager } from '../../forgeaiWorkspace/MemoryManager';
import { ResearchAgent } from '../research/ResearchAgent';
import { getConfiguredModel } from '../../config/ModelConfig';
import { RequirementsAgent, RequirementsAgentInput, RequirementsAgentOutput } from './RequirementsAgent';
import { DesignAgent, DesignAgentInput, DesignAgentOutput } from './DesignAgent';
import { TasksAgent, TasksAgentInput, TasksAgentOutput } from './TasksAgent';
import { BugfixAgent, BugfixAgentInput, BugfixAgentOutput } from './BugfixAgent';

export interface SpecOrchestratorDeps {
  toolRegistry?: ToolRegistry;
  ollamaClient?: OllamaClient;
  specManager: SpecManager;
  productManager: ProductManager;
  memoryManager: MemoryManager;
  researchAgent: ResearchAgent;
  logger?: Logger;
}

export interface SpecOrchestratorGenerateInput {
  title: string;
  description: string;
  mode: 'full' | 'quick';
  workflow?: 'requirements-first' | 'design-first' | 'quick-plan' | 'bugfix';
}

export interface SpecOrchestratorGenerateOutput {
  specId: string;
  title: string;
  phasesCompleted: string[];
  success: boolean;
  error?: string;
  content?: string;
}

export class SpecOrchestrator {
  private readonly deps: SpecOrchestratorDeps;
  private readonly requirementsAgent: RequirementsAgent;
  private readonly designAgent: DesignAgent;
  private readonly tasksAgent: TasksAgent;
  private readonly bugfixAgent: BugfixAgent;

  constructor(deps: SpecOrchestratorDeps) {
    this.deps = deps;
    const log = deps.logger || ({
      info: (msg: string) => console.log(`[SpecOrchestrator] ${msg}`),
      error: (msg: string, err?: any) => console.error(`[SpecOrchestrator] ${msg}`, err),
      warn: (msg: string) => console.warn(`[SpecOrchestrator] ${msg}`),
    } as unknown as Logger);

    const toolRegistry = deps.toolRegistry || ({} as ToolRegistry);
    const ollamaClient = deps.ollamaClient || ({} as OllamaClient);

    this.requirementsAgent = new RequirementsAgent(
      toolRegistry,
      ollamaClient,
      log,
      deps.specManager,
      deps.productManager,
      deps.memoryManager,
      deps.researchAgent
    );

    this.designAgent = new DesignAgent(
      toolRegistry,
      ollamaClient,
      log,
      deps.specManager
    );

    this.tasksAgent = new TasksAgent(
      toolRegistry,
      ollamaClient,
      log,
      deps.specManager
    );

    this.bugfixAgent = new BugfixAgent(
      toolRegistry,
      ollamaClient,
      log,
      deps.specManager
    );
  }

  async generate(input: SpecOrchestratorGenerateInput): Promise<SpecOrchestratorGenerateOutput> {
    const { title, description, mode, workflow = 'requirements-first' } = input;
    const specId = this.deps.specManager.nextSpecId(title);
    const phasesCompleted: string[] = [];
    const log = this.deps.logger || ({} as Logger);

    try {
      this.deps.specManager.createSpec(specId, title, workflow);

      if (workflow === 'bugfix') {
        const bugfixResult = await this.bugfixAgent.generate({
          specId,
          title,
          description,
          draftBugfix: description,
        });
        this.deps.specManager.writeArtifact(specId, 'bugfix', bugfixResult.content);
        phasesCompleted.push('bugfix');
        this.deps.specManager.approvePhase(specId, 'bugfix' as 'requirements');
        return { specId, title, phasesCompleted, success: true, content: bugfixResult.content };
      }

      // ── Phase 1: Requirements ──
      log.info?.('Starting requirements phase');
      const specForRequirements = this.deps.specManager.loadSpec(specId);
      const researchSession = await this.deps.researchAgent.runResearch(
        {
          sessionId: `research-${Date.now()}`,
          userRequest: `${title}: ${description}`,
          status: 'satisfied',
          messages: [
            { role: 'user', content: `${title}: ${description}`, timestamp: new Date().toISOString() },
          ],
          constraints: [],
          preferences: [],
          ambiguitiesResolved: [],
          turnCount: 0,
          maxTurns: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any,
        () => {}
      );

      const requirementsResult: RequirementsAgentOutput = await this.requirementsAgent.generate({
        title,
        description,
        specId,
        researchSession,
      });

      if (!requirementsResult.success) {
        throw new Error(requirementsResult.error || 'Requirements generation failed');
      }

      this.deps.specManager.writeArtifact(specId, 'requirements', requirementsResult.content);
      phasesCompleted.push('requirements');

      // Neurosymbolic analysis
      try {
        const analysis = await this.analyzeRequirements(requirementsResult.content);
        this.deps.specManager.writeArtifact(specId, 'requirements-analysis', analysis);
      } catch (analysisError) {
        log.warn?.('Requirements analysis failed, continuing without it', analysisError);
      }

      if (mode !== 'quick') {
        this.deps.specManager.setPendingApproval(specId, 'requirements');
        return { specId, title, phasesCompleted, success: true, content: requirementsResult.content };
      }

      // ── Phase 2: Design ──
      log.info?.('Starting design phase');
      const designResult: DesignAgentOutput = await this.designAgent.generate({
        specId,
        title,
        description,
        requirements: requirementsResult.content,
      });

      this.deps.specManager.writeArtifact(specId, 'design', designResult.content);
      phasesCompleted.push('design');

      // ── Phase 3: Tasks ──
      log.info?.('Starting tasks phase');
      const tasksResult: TasksAgentOutput = await this.tasksAgent.generate({
        specId,
        title,
        description,
        requirements: requirementsResult.content,
        design: designResult.content,
      });

      this.deps.specManager.writeArtifact(specId, 'tasks', tasksResult.content);
      phasesCompleted.push('tasks');

      this.deps.specManager.approvePhase(specId, 'requirements');
      this.deps.specManager.approvePhase(specId, 'design');
      this.deps.specManager.approvePhase(specId, 'tasks');

      return {
        specId,
        title,
        phasesCompleted,
        success: true,
        content: requirementsResult.content,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during spec generation';
      log.error?.('Spec generation failed', error);
      return {
        specId,
        title,
        phasesCompleted,
        success: false,
        error: errorMessage,
      };
    }
  }

  async continue(specId: string): Promise<SpecOrchestratorGenerateOutput> {
    const spec = this.deps.specManager.loadSpec(specId);
    if (!spec) {
      return { specId, title: '', phasesCompleted: [], success: false, error: `Spec ${specId} not found` };
    }

    const { config, artifacts } = spec;
    const title = config.title;
    const description = config.title;

    try {
      const phasesCompleted = [...config.phasesCompleted];

      if (phasesCompleted.includes('requirements')) {
        const requirements = artifacts.requirements || '';

        if (!phasesCompleted.includes('design')) {
          const designResult = await this.designAgent.generate({
            specId,
            title,
            description,
            requirements,
          });
          this.deps.specManager.writeArtifact(specId, 'design', designResult.content);
          phasesCompleted.push('design');
        }

        if (!phasesCompleted.includes('tasks') && phasesCompleted.includes('design')) {
          const design = artifacts.design || '';
          const tasksResult = await this.tasksAgent.generate({
            specId,
            title,
            description,
            requirements,
            design,
          });
          this.deps.specManager.writeArtifact(specId, 'tasks', tasksResult.content);
          phasesCompleted.push('tasks');
        }
      }

      return { specId, title, phasesCompleted, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during spec continuation';
      this.deps.logger?.error('Spec continuation failed', error);
      return { specId, title, phasesCompleted: config.phasesCompleted, success: false, error: errorMessage };
    }
  }

  private async analyzeRequirements(requirements: string): Promise<string> {
    const prompt = `Analyze the following requirements document for ambiguity, gaps, contradictions, and unstated assumptions.

Requirements Document:
---
${requirements}
---

You are a requirements analyst performing neurosymbolic analysis.
Your job is to find SPECIFIC, ACTIONABLE problems.
Do not say "looks good" — find issues. If truly none, say so explicitly.

# Analysis Categories

## 1. Ambiguity
Find phrases that could reasonably be interpreted two different ways.

## 2. Logical Gaps
Find missing acceptance criteria, boundary conditions, or error paths.

## 3. Contradictions
Find pairs of requirements that conflict with each other.

## 4. Unstated Assumptions
Find assumptions the author made but did not write down.

# Output Format
Return ONLY valid Markdown with this exact structure:

## Ambiguities Found: N
## Gaps Found: N
## Contradictions Found: N
## Unstated Assumptions: N

If a category has zero findings, write "None found."`;

    const response = await this.deps.ollamaClient!.chat({
      model: getConfiguredModel(),
      messages: [
        { role: 'system', content: 'You are a rigorous requirements analyst. Find specific, actionable problems.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
      tools: this.deps.toolRegistry!.getToolDefinitions(),
      options: { temperature: 0.3 },
    });

    if (!('message' in response)) {
      throw new Error('Unexpected response during requirements analysis');
    }
    return response.message.content.trim();
  }
}

