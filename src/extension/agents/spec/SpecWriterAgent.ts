import { SpecManager, SpecConfig } from '../../forgeaiWorkspace/SpecManager';
import { ProductManager, ProductOverview } from '../../forgeaiWorkspace/ProductManager';
import { MemoryManager, MemoryEntry } from '../../forgeaiWorkspace/MemoryManager';
import { ResearchAgent } from '../research/ResearchAgent';
import { ResearchSession } from '../research/ResearchSession';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { OllamaClient } from '../../ollama/OllamaClient';
import { Logger } from '../../utils/Logger';
import { SpecOrchestrator } from './SpecOrchestrator';

export type SpecGenerationMode = 'full' | 'quick';

export interface SpecWriterInput {
  title: string;
  description: string;
  mode: SpecGenerationMode;
}

export interface SpecWriterOutput {
  specId: string;
  title: string;
  phasesCompleted: ('requirements' | 'design' | 'tasks' | 'bugfix')[];
  success: boolean;
  error?: string;
  content?: string;
}

export interface SpecWriterDeps {
  executeLLM: (systemPrompt: string, userPrompt: string) => Promise<string>;
  specManager: SpecManager;
  productManager: ProductManager;
  memoryManager: MemoryManager;
  researchAgent: ResearchAgent;
  toolRegistry?: ToolRegistry;
  ollamaClient?: OllamaClient;
  logger?: Logger;
}

export class SpecWriterAgent {
  private readonly orchestrator: SpecOrchestrator;

  constructor(deps: SpecWriterDeps) {
    this.orchestrator = new SpecOrchestrator({
      toolRegistry: deps.toolRegistry,
      ollamaClient: deps.ollamaClient,
      specManager: deps.specManager,
      productManager: deps.productManager,
      memoryManager: deps.memoryManager,
      researchAgent: deps.researchAgent,
      logger: deps.logger,
    });
  }

  async generate(
    input: SpecWriterInput,
    onProgress?: (event: {
      phase: 'requirements' | 'design' | 'tasks';
      status: 'generating' | 'completed' | 'failed';
      message: string;
    }) => void
  ): Promise<SpecWriterOutput> {
    const result = await this.orchestrator.generate({
      title: input.title,
      description: input.description,
      mode: input.mode,
    });

    return {
      specId: result.specId,
      title: result.title,
      phasesCompleted: result.phasesCompleted as ('requirements' | 'design' | 'tasks' | 'bugfix')[],
      success: result.success,
      error: result.error,
      content: result.content,
    };
  }

  async continue(
    specId: string,
    onProgress?: (event: {
      phase: 'requirements' | 'design' | 'tasks' | 'bugfix';
      status: 'generating' | 'completed' | 'failed';
      message: string;
    }) => void
  ): Promise<SpecWriterOutput> {
    const result = await this.orchestrator.continue(specId);

    return {
      specId: result.specId,
      title: result.title,
      phasesCompleted: result.phasesCompleted as ('requirements' | 'design' | 'tasks' | 'bugfix')[],
      success: result.success,
      error: result.error,
      content: result.content,
    };
  }
}
