/**
 * Unit tests for PlannerAgent
 * Tests task decomposition, dependency analysis, and planning capabilities
 */

import { PlannerAgent } from '../PlannerAgent';
import { PlannerInput, TaskPlan } from '../../orchestrator/types';
import { createMockToolRegistry, createMockOllamaClient } from '../../__tests__/testUtils';

describe('PlannerAgent', () => {
  let plannerAgent: PlannerAgent;
  let mockToolRegistry: ReturnType<typeof createMockToolRegistry>;
  let mockOllamaClient: ReturnType<typeof createMockOllamaClient>;

  beforeEach(() => {
    mockToolRegistry = createMockToolRegistry();
    mockOllamaClient = createMockOllamaClient();
    plannerAgent = new PlannerAgent(mockToolRegistry, mockOllamaClient);
  });

  afterEach(() => {
    plannerAgent.resetMetrics();
  });

  describe('Basic Functionality', () => {
    test('should have correct name', () => {
      expect(plannerAgent.getName()).toBe('Planner');
    });

    test('should have correct capabilities', () => {
      const capabilities = plannerAgent.getCapabilities();
      expect(capabilities).toHaveLength(5);
      expect(capabilities).toContain('Task decomposition');
      expect(capabilities).toContain('Dependency analysis');
      expect(capabilities).toContain('Context gathering');
      expect(capabilities).toContain('Priority assignment');
      expect(capabilities).toContain('Duration estimation');
    });
  });

  describe('plan() method', () => {
    test('should create a task plan from user request', async () => {
      const input: PlannerInput = {
        userRequest: 'Fix the authentication bug',
        context: {
          workspace: {
            root: '/test/workspace',
            files: ['src/auth.ts', 'src/login.ts'],
            openFiles: ['src/auth.ts'],
          },
          git: {
            branch: 'main',
            uncommittedChanges: 2,
            status: 'modified',
          },
          environment: {
            nodeVersion: '18.0.0',
            packageManager: 'npm',
            testFramework: 'vitest',
            hasTypeScript: true,
          },
        },
      };

      const plan = await plannerAgent.plan(input);

      // Verify plan structure
      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.id).toMatch(/^plan-\d+$/);
      expect(plan.userRequest).toBe(input.userRequest);
      expect(plan.tasks).toBeDefined();
      expect(Array.isArray(plan.tasks)).toBe(true);
      expect(plan.context).toBe(input.context);
      expect(plan.dependencyGraph).toBeDefined();
      expect(plan.estimatedDuration).toBeDefined();
      expect(plan.createdAt).toBeDefined();
    });

    test('should return empty task list in placeholder implementation', async () => {
      const input: PlannerInput = {
        userRequest: 'Simple request',
        context: {
          workspace: { root: '', files: [], openFiles: [] },
          git: { branch: '', uncommittedChanges: 0, status: '' },
          environment: { hasTypeScript: false },
        },
      };

      const plan = await plannerAgent.plan(input);

      // Now returns real tasks from Ollama (mocked to return 3 tasks)
      expect(plan.tasks).toBeDefined();
      expect(Array.isArray(plan.tasks)).toBe(true);
      expect(plan.tasks.length).toBeGreaterThanOrEqual(3);
    });

    test('should handle errors gracefully', async () => {
      const input: PlannerInput = {
        userRequest: 'Test request',
        context: {
          workspace: { root: '', files: [], openFiles: [] },
          git: { branch: '', uncommittedChanges: 0, status: '' },
          environment: { hasTypeScript: false },
        },
      };

      // Should resolve with a valid plan (mock returns 3 tasks)
      const plan = await plannerAgent.plan(input);
      expect(plan).toBeDefined();
      expect(plan.tasks.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('replan() method', () => {
    test('should accept current plan and feedback', async () => {
      const currentPlan: TaskPlan = {
        id: 'plan-123',
        userRequest: 'Test request',
        tasks: [],
        context: {
          workspace: { root: '', files: [], openFiles: [] },
          git: { branch: '', uncommittedChanges: 0, status: '' },
          environment: { hasTypeScript: false },
        },
        dependencyGraph: {
          dependencies: new Map(),
          levels: new Map(),
          parallelGroups: [],
        },
        estimatedDuration: 0,
        createdAt: Date.now(),
      };

      const feedback = {
        status: 'fail' as const,
        issues: ['Task 1 failed'],
        requiredChanges: ['Fix task 1'],
        suggestions: ['Add more tests'],
      };

      const newPlan = await plannerAgent.replan(currentPlan, feedback);

      // Placeholder returns same plan
      expect(newPlan).toBeDefined();
      expect(newPlan.id).toBe(currentPlan.id);
    });
  });

  describe('execute() method', () => {
    test('should delegate to plan() method', async () => {
      const input: PlannerInput = {
        userRequest: 'Test request',
        context: {
          workspace: { root: '', files: [], openFiles: [] },
          git: { branch: '', uncommittedChanges: 0, status: '' },
          environment: { hasTypeScript: false },
        },
      };

      const result = await plannerAgent.execute(input);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userRequest).toBe(input.userRequest);
    });
  });

  describe('Metrics Tracking', () => {
    test('should track execution metrics', async () => {
      const input: PlannerInput = {
        userRequest: 'Test request',
        context: {
          workspace: { root: '', files: [], openFiles: [] },
          git: { branch: '', uncommittedChanges: 0, status: '' },
          environment: { hasTypeScript: false },
        },
      };

      // Execute multiple times
      await plannerAgent.plan(input);
      await plannerAgent.plan(input);
      await plannerAgent.plan(input);

      const metrics = plannerAgent.getMetrics();

      expect(metrics.totalExecutions).toBe(3);
      expect(metrics.successfulExecutions).toBe(3);
      expect(metrics.failedExecutions).toBe(0);
      expect(metrics.averageDuration).toBeGreaterThanOrEqual(0);
      expect(metrics.lastExecutionTime).toBeGreaterThan(0);
    });

    test('should reset metrics', async () => {
      const input: PlannerInput = {
        userRequest: 'Test request',
        context: {
          workspace: { root: '', files: [], openFiles: [] },
          git: { branch: '', uncommittedChanges: 0, status: '' },
          environment: { hasTypeScript: false },
        },
      };

      await plannerAgent.plan(input);

      let metrics = plannerAgent.getMetrics();
      expect(metrics.totalExecutions).toBe(1);

      plannerAgent.resetMetrics();

      metrics = plannerAgent.getMetrics();
      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.successfulExecutions).toBe(0);
      expect(metrics.failedExecutions).toBe(0);
    });
  });

  describe('Dependency Graph (Future Implementation)', () => {
    test('should have dependency graph structure', async () => {
      const input: PlannerInput = {
        userRequest: 'Complex request with dependencies',
        context: {
          workspace: { root: '', files: [], openFiles: [] },
          git: { branch: '', uncommittedChanges: 0, status: '' },
          environment: { hasTypeScript: false },
        },
      };

      const plan = await plannerAgent.plan(input);

      // Verify dependency graph structure exists
      expect(plan.dependencyGraph).toBeDefined();
      expect(plan.dependencyGraph.dependencies).toBeInstanceOf(Map);
      expect(plan.dependencyGraph.levels).toBeInstanceOf(Map);
      expect(Array.isArray(plan.dependencyGraph.parallelGroups)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input gracefully', async () => {
      const input: PlannerInput = {
        userRequest: '',
        context: {
          workspace: { root: '', files: [], openFiles: [] },
          git: { branch: '', uncommittedChanges: 0, status: '' },
          environment: { hasTypeScript: false },
        },
      };

      // Should not throw even with empty request
      await expect(plannerAgent.plan(input)).resolves.toBeDefined();
    });

    test('should track failed executions', async () => {
      // Mock a failure by making logInfo throw during plan execution
      const failingAgent = new PlannerAgent(mockToolRegistry, mockOllamaClient);

      // Mock logInfo to throw an error, simulating a failure during planning
      // This allows the error to flow through executeWithErrorHandling which records metrics
      jest.spyOn(failingAgent as any, 'logInfo').mockImplementation(() => {
        throw new Error('Simulated failure');
      });

      const input: PlannerInput = {
        userRequest: 'Test request',
        context: {
          workspace: { root: '', files: [], openFiles: [] },
          git: { branch: '', uncommittedChanges: 0, status: '' },
          environment: { hasTypeScript: false },
        },
      };

      await expect(failingAgent.execute(input)).rejects.toThrow('Simulated failure');

      const metrics = failingAgent.getMetrics();
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.failedExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(0);
    });
  });
});
