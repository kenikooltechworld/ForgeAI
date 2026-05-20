import * as fs from 'fs';
import * as path from 'path';
import { SpecWriterAgent, SpecWriterDeps } from '../SpecWriterAgent';
import { SpecManager } from '../../../forgeaiWorkspace/SpecManager';
import { ProductManager } from '../../../forgeaiWorkspace/ProductManager';
import { MemoryManager } from '../../../forgeaiWorkspace/MemoryManager';
import { ResearchAgent } from '../../research/ResearchAgent';
import { ResearchSession } from '../../research/ResearchSession';

function createMockResearchAgent(): ResearchAgent {
  return {
    runResearch: jest.fn().mockResolvedValue({
      sessionId: 'research-test',
      userRequest: 'test',
      reports: {},
      status: 'complete',
      workspaceRoot: '/tmp',
      generatedAt: Date.now(),
    } as ResearchSession),
    buildResearchContext: jest.fn().mockReturnValue(''),
  } as unknown as ResearchAgent;
}

describe('SpecWriterAgent', () => {
  const workspaceRoot = '/tmp/test-spec-writer-workspace';
  const forgeaiDir = path.join(workspaceRoot, '.forgeai');
  let specManager: SpecManager;
  let productManager: ProductManager;
  let memoryManager: MemoryManager;
  let deps: SpecWriterDeps;

  beforeEach(() => {
    if (fs.existsSync(forgeaiDir)) {
      fs.rmSync(forgeaiDir, { recursive: true, force: true });
    }
    fs.mkdirSync(forgeaiDir, { recursive: true });
    specManager = new SpecManager(workspaceRoot);
    productManager = new ProductManager(workspaceRoot);
    memoryManager = new MemoryManager(workspaceRoot);
    deps = {
      executeLLM: jest.fn(),
      specManager,
      productManager,
      memoryManager,
      researchAgent: createMockResearchAgent(),
    };
  });

  afterEach(() => {
    if (fs.existsSync(forgeaiDir)) {
      fs.rmSync(forgeaiDir, { recursive: true, force: true });
    }
  });

  it('generates only requirements + analysis in full mode and sets pending approval', async () => {
    const mockLLM = jest.fn().mockResolvedValue('# Generated Content\n\nThis is complete content.');
    deps.executeLLM = mockLLM;

    const agent = new SpecWriterAgent(deps);
    const result = await agent.generate({
      title: 'Test Feature',
      description: 'A test feature for authentication',
      mode: 'full',
    });

    expect(result.success).toBe(true);
    expect(result.phasesCompleted).toEqual(['requirements']);

    const spec = specManager.loadSpec(result.specId);
    expect(spec).not.toBeNull();
    expect(spec!.artifacts.requirements).toContain('# Generated Content');
    // design.md and tasks.md should still be the scaffold templates (not overwritten by LLM)
    expect(spec!.artifacts.design).toContain('Design Document');
    expect(spec!.artifacts.tasks).toContain('Implementation Plan');
    // LLM should only be called twice: requirements + analysis
    expect(mockLLM).toHaveBeenCalledTimes(2);

    const meta = specManager.listSpecs().find((s) => s.id === result.specId);
    expect(meta).toBeDefined();
    expect(meta!.pendingApproval).toBe('requirements');
    expect(meta!.phasesCompleted).toEqual([]);
  });

  it('auto-approves all phases in quick mode', async () => {
    const mockLLM = jest.fn().mockResolvedValue('# Content');
    deps.executeLLM = mockLLM;

    const agent = new SpecWriterAgent(deps);
    const result = await agent.generate({
      title: 'Quick Feature',
      description: 'Quick mode test',
      mode: 'quick',
    });

    expect(result.success).toBe(true);

    const meta = specManager.listSpecs().find((s) => s.id === result.specId);
    expect(meta).toBeDefined();
    expect(meta!.phasesCompleted).toContain('requirements');
    expect(meta!.phasesCompleted).toContain('design');
    expect(meta!.phasesCompleted).toContain('tasks');
    expect(meta!.status).toBe('complete');
  });

  it('returns error on LLM failure', async () => {
    deps.executeLLM = jest.fn().mockRejectedValue(new Error('LLM timeout'));

    const agent = new SpecWriterAgent(deps);
    const result = await agent.generate({
      title: 'Failing Feature',
      description: 'Should fail',
      mode: 'full',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('LLM timeout');
  });

  it('includes product context in the LLM prompt', async () => {
    const mockLLM = jest.fn().mockResolvedValue('# Content');
    deps.executeLLM = mockLLM;

    productManager.saveOverview({
      name: 'MyApp',
      description: 'A social network',
      techStack: ['React', 'Node.js'],
      goals: ['Scale to 1M users'],
      targetUsers: 'Developers',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const agent = new SpecWriterAgent(deps);
    await agent.generate({
      title: 'Feature',
      description: 'Desc',
      mode: 'full',
    });

    // First call is requirements generation
    const [, userPrompt] = mockLLM.mock.calls[0];
    expect(userPrompt).toContain('MyApp');
    expect(userPrompt).toContain('React');
  });

  it('includes relevant memory findings in the LLM prompt', async () => {
    const mockLLM = jest.fn().mockResolvedValue('# Content');
    deps.executeLLM = mockLLM;

    memoryManager.save({
      id: 'm1',
      category: 'finding',
      title: 'Auth best practices',
      content: 'Use JWT with refresh tokens for mobile auth.',
      source: 'research',
      tags: ['auth', 'security'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const agent = new SpecWriterAgent(deps);
    await agent.generate({
      title: 'Auth Feature',
      description: 'Implement authentication',
      mode: 'full',
    });

    const [, userPrompt] = mockLLM.mock.calls[0];
    expect(userPrompt).toContain('Auth best practices');
  });

  it('reports progress for each phase in quick mode', async () => {
    const mockLLM = jest.fn().mockResolvedValue('# Content');
    deps.executeLLM = mockLLM;

    const progressEvents: Array<{ phase: string; status: string }> = [];
    const agent = new SpecWriterAgent(deps);
    await agent.generate(
      { title: 'Progress Feature', description: 'Test progress', mode: 'quick' },
      (event) => progressEvents.push({ phase: event.phase, status: event.status })
    );

    // Quick mode: requirements (gen+complete) + analysis (gen+complete) + design (gen+complete) + tasks (gen+complete) = 8 events
    expect(progressEvents.length).toBeGreaterThanOrEqual(8);
    expect(progressEvents.some((e) => e.phase === 'requirements' && e.status === 'completed')).toBe(
      true
    );
    expect(progressEvents.some((e) => e.phase === 'design' && e.status === 'completed')).toBe(true);
    expect(progressEvents.some((e) => e.phase === 'tasks' && e.status === 'completed')).toBe(true);
  });

  it('stops after requirements in full mode and does not report design/tasks progress', async () => {
    const mockLLM = jest.fn().mockResolvedValue('# Content');
    deps.executeLLM = mockLLM;

    const progressEvents: Array<{ phase: string; status: string }> = [];
    const agent = new SpecWriterAgent(deps);
    await agent.generate(
      { title: 'Full Mode Feature', description: 'Test full mode', mode: 'full' },
      (event) => progressEvents.push({ phase: event.phase, status: event.status })
    );

    // Full mode: requirements (gen+complete) + analysis (gen+complete) = 4 events only
    expect(progressEvents.some((e) => e.phase === 'requirements' && e.status === 'completed')).toBe(
      true
    );
    expect(progressEvents.some((e) => e.phase === 'design')).toBe(false);
    expect(progressEvents.some((e) => e.phase === 'tasks')).toBe(false);
  });

  it('generates sequential spec IDs', async () => {
    const mockLLM = jest.fn().mockResolvedValue('# Content');
    deps.executeLLM = mockLLM;

    const agent = new SpecWriterAgent(deps);
    const result1 = await agent.generate({ title: 'A', description: '', mode: 'full' });
    const result2 = await agent.generate({ title: 'B', description: '', mode: 'full' });

    // IDs should be numeric and sequential
    const num1 = parseInt(result1.specId.split('-')[0], 10);
    const num2 = parseInt(result2.specId.split('-')[0], 10);
    expect(num2).toBe(num1 + 1);
  });
});
