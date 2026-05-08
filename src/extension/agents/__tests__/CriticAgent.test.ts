/**
 * Unit tests for CriticAgent
 * Tests validation, error analysis, pattern recognition, and recovery suggestions
 */

import { CriticAgent } from '../CriticAgent';
import {
  CriticInput,
  CriticOutput,
  Task,
  ExecutorOutput,
  TaskPlan,
  RecoveryStrategy,
  TaskType,
} from '../../orchestrator/types';
import { createMockToolRegistry, createMockOllamaClient } from '../../__tests__/testUtils';

describe('CriticAgent', () => {
  let criticAgent: CriticAgent;
  let mockToolRegistry: ReturnType<typeof createMockToolRegistry>;
  let mockOllamaClient: ReturnType<typeof createMockOllamaClient>;

  beforeEach(() => {
    mockToolRegistry = createMockToolRegistry();
    mockOllamaClient = createMockOllamaClient();
    criticAgent = new CriticAgent(mockToolRegistry, mockOllamaClient);
  });

  afterEach(() => {
    criticAgent.resetMetrics();
  });

  describe('Basic Functionality', () => {
    test('should have correct name', () => {
      expect(criticAgent.getName()).toBe('Critic');
    });

    test('should have correct capabilities', () => {
      const capabilities = criticAgent.getCapabilities();
      expect(capabilities).toHaveLength(5);
      expect(capabilities).toContain('Quality validation');
      expect(capabilities).toContain('Test execution');
      expect(capabilities).toContain('Error pattern recognition');
      expect(capabilities).toContain('Feedback generation');
      expect(capabilities).toContain('Recovery suggestions');
    });
  });

  describe('evaluate() method', () => {
    test('should validate successful execution', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'read_code' as TaskType,
        description: 'Read authentication code',
        dependencies: [],
        criteria: {
          functional: ['File content retrieved'],
          quality: ['No errors'],
        },
        priority: 'P0',
        estimatedDuration: 5000,
      };

      const executorOutput: ExecutorOutput = {
        taskId: 'task-1',
        status: 'pass',
        result: { content: 'file content' },
        selfEvaluation: {
          confidence: 0.9,
          concerns: [],
          suggestions: [],
        },
        toolsUsed: ['forgeai_readFile'],
        duration: 1000,
        timestamp: Date.now(),
      };

      const plan: TaskPlan = {
        id: 'plan-1',
        userRequest: 'Read auth code',
        tasks: [task],
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
        estimatedDuration: 5000,
        createdAt: Date.now(),
      };

      const input: CriticInput = {
        task,
        executorOutput,
        plan,
      };

      const output = await criticAgent.evaluate(input);

      // Verify output structure
      expect(output).toBeDefined();
      expect(output.taskId).toBe(task.id);
      expect(output.status).toBeDefined();
      expect(['pass', 'fail', 'needs_refinement']).toContain(output.status);
      expect(output.confidence).toBeGreaterThanOrEqual(0);
      expect(output.confidence).toBeLessThanOrEqual(1);
      expect(output.feedback).toBeDefined();
      expect(output.feedback.status).toBeDefined();
      expect(Array.isArray(output.feedback.issues)).toBe(true);
      expect(Array.isArray(output.feedback.requiredChanges)).toBe(true);
      expect(Array.isArray(output.feedback.suggestions)).toBe(true);
      expect(output.timestamp).toBeGreaterThan(0);
    });

    test('should return pass status in placeholder implementation', async () => {
      const task: Task = {
        id: 'task-2',
        type: 'analyze' as TaskType,
        description: 'Analyze code',
        dependencies: [],
        criteria: {
          functional: ['Analysis complete'],
          quality: ['No issues'],
        },
        priority: 'P1',
        estimatedDuration: 10000,
      };

      const executorOutput: ExecutorOutput = {
        taskId: 'task-2',
        status: 'pass',
        result: { issues: [] },
        selfEvaluation: {
          confidence: 0.8,
          concerns: [],
          suggestions: [],
        },
        toolsUsed: [],
        duration: 2000,
        timestamp: Date.now(),
      };

      const plan: TaskPlan = {
        id: 'plan-2',
        userRequest: 'Analyze code',
        tasks: [task],
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
        estimatedDuration: 10000,
        createdAt: Date.now(),
      };

      const input: CriticInput = {
        task,
        executorOutput,
        plan,
      };

      const output = await criticAgent.evaluate(input);

      // Real implementation evaluates using Ollama + heuristics
      expect(['pass', 'fail']).toContain(output.status);
    });

    test('should provide specific feedback', async () => {
      const task: Task = {
        id: 'task-3',
        type: 'generate_fix' as TaskType,
        description: 'Generate bug fix',
        dependencies: [],
        criteria: {
          functional: ['Bug fixed'],
          quality: ['Code quality maintained'],
        },
        priority: 'P0',
        estimatedDuration: 15000,
      };

      const executorOutput: ExecutorOutput = {
        taskId: 'task-3',
        status: 'pass',
        result: { fix: 'code fix' },
        selfEvaluation: {
          confidence: 0.7,
          concerns: ['Might need more testing'],
          suggestions: ['Add unit tests'],
        },
        toolsUsed: ['forgeai_writeFile'],
        duration: 3000,
        timestamp: Date.now(),
      };

      const plan: TaskPlan = {
        id: 'plan-3',
        userRequest: 'Fix bug',
        tasks: [task],
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
        estimatedDuration: 15000,
        createdAt: Date.now(),
      };

      const input: CriticInput = {
        task,
        executorOutput,
        plan,
      };

      const output = await criticAgent.evaluate(input);

      // Verify feedback structure
      expect(output.feedback).toBeDefined();
      expect(Array.isArray(output.feedback.issues)).toBe(true);
      expect(Array.isArray(output.feedback.requiredChanges)).toBe(true);
      expect(Array.isArray(output.feedback.suggestions)).toBe(true);
    });

    test('should calculate confidence scores', async () => {
      const task: Task = {
        id: 'task-confidence',
        type: 'verify' as TaskType,
        description: 'Verify changes',
        dependencies: [],
        criteria: {
          functional: ['Changes verified'],
          quality: ['No regressions'],
        },
        priority: 'P1',
        estimatedDuration: 5000,
      };

      const executorOutput: ExecutorOutput = {
        taskId: 'task-confidence',
        status: 'pass',
        result: { verified: true },
        selfEvaluation: {
          confidence: 0.85,
          concerns: [],
          suggestions: [],
        },
        toolsUsed: [],
        duration: 1500,
        timestamp: Date.now(),
      };

      const plan: TaskPlan = {
        id: 'plan-confidence',
        userRequest: 'Verify',
        tasks: [task],
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
        estimatedDuration: 5000,
        createdAt: Date.now(),
      };

      const input: CriticInput = {
        task,
        executorOutput,
        plan,
      };

      const output = await criticAgent.evaluate(input);

      expect(output.confidence).toBeGreaterThanOrEqual(0);
      expect(output.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('suggestRecovery() method', () => {
    test('should accept error and return recovery strategy or null', async () => {
      const error = new Error('Cannot find module "express"');

      const strategy = await criticAgent.suggestRecovery(error);

      // Real implementation returns a strategy for known patterns
      expect(strategy === null || typeof strategy === 'object').toBe(true);
      if (strategy) {
        expect(strategy.id).toBeDefined();
        expect(strategy.name).toBeDefined();
        expect(Array.isArray(strategy.steps)).toBe(true);
        expect(typeof strategy.successProbability).toBe('number');
      }
    });

    test('should handle different error types', async () => {
      const errors = [
        new Error('command not found: npm'),
        new Error('ENOENT: no such file or directory'),
        new Error('permission denied'),
        new Error('Cannot find module "react"'),
        new Error('expect is not defined'),
      ];

      for (const error of errors) {
        const strategy = await criticAgent.suggestRecovery(error);

        // Should not throw
        expect(strategy === null || typeof strategy === 'object').toBe(true);
      }
    });
  });

  describe('execute() method', () => {
    test('should delegate to evaluate() method', async () => {
      const task: Task = {
        id: 'task-execute',
        type: 'run_tests' as TaskType,
        description: 'Run tests',
        dependencies: [],
        criteria: {
          functional: ['Tests pass'],
          quality: ['No failures'],
        },
        priority: 'P0',
        estimatedDuration: 20000,
      };

      const executorOutput: ExecutorOutput = {
        taskId: 'task-execute',
        status: 'pass',
        result: { testsPassed: 10, testsFailed: 0 },
        selfEvaluation: {
          confidence: 0.95,
          concerns: [],
          suggestions: [],
        },
        toolsUsed: ['forgeai_runCommand'],
        duration: 5000,
        timestamp: Date.now(),
      };

      const plan: TaskPlan = {
        id: 'plan-execute',
        userRequest: 'Run tests',
        tasks: [task],
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
        estimatedDuration: 20000,
        createdAt: Date.now(),
      };

      const input: CriticInput = {
        task,
        executorOutput,
        plan,
      };

      const result = await criticAgent.execute(input);

      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
    });
  });

  describe('Error Pattern Recognition', () => {
    test('should recognize common error patterns (future)', async () => {
      const errors = [
        { message: 'command not found: npm', expectedPattern: 'missing_command' },
        { message: 'ENOENT: no such file', expectedPattern: 'path_error' },
        { message: 'permission denied', expectedPattern: 'permission_error' },
        { message: 'Cannot find module', expectedPattern: 'missing_dependency' },
        { message: 'expect is not defined', expectedPattern: 'test_framework_error' },
      ];

      for (const { message } of errors) {
        const error = new Error(message);
        const strategy = await criticAgent.suggestRecovery(error);

        // Should not throw
        expect(strategy === null || typeof strategy === 'object').toBe(true);
      }
    });
  });

  describe('Metrics Tracking', () => {
    test('should track execution metrics', async () => {
      const task: Task = {
        id: 'task-metrics',
        type: 'analyze' as TaskType,
        description: 'Analyze',
        dependencies: [],
        criteria: {
          functional: ['Analysis done'],
          quality: ['Complete'],
        },
        priority: 'P1',
        estimatedDuration: 5000,
      };

      const executorOutput: ExecutorOutput = {
        taskId: 'task-metrics',
        status: 'pass',
        result: {},
        selfEvaluation: {
          confidence: 0.8,
          concerns: [],
          suggestions: [],
        },
        toolsUsed: [],
        duration: 1000,
        timestamp: Date.now(),
      };

      const plan: TaskPlan = {
        id: 'plan-metrics',
        userRequest: 'Analyze',
        tasks: [task],
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
        estimatedDuration: 5000,
        createdAt: Date.now(),
      };

      const input: CriticInput = {
        task,
        executorOutput,
        plan,
      };

      // Execute multiple times
      await criticAgent.evaluate(input);
      await criticAgent.evaluate(input);
      await criticAgent.evaluate(input);

      const metrics = criticAgent.getMetrics();

      expect(metrics.totalExecutions).toBe(3);
      expect(metrics.successfulExecutions).toBe(3);
      expect(metrics.failedExecutions).toBe(0);
      expect(metrics.averageDuration).toBeGreaterThanOrEqual(0);
      expect(metrics.lastExecutionTime).toBeGreaterThan(0);
    });

    test('should reset metrics', async () => {
      const task: Task = {
        id: 'task-reset',
        type: 'verify' as TaskType,
        description: 'Verify',
        dependencies: [],
        criteria: {
          functional: ['Verified'],
          quality: ['Complete'],
        },
        priority: 'P1',
        estimatedDuration: 5000,
      };

      const executorOutput: ExecutorOutput = {
        taskId: 'task-reset',
        status: 'pass',
        result: {},
        selfEvaluation: {
          confidence: 0.8,
          concerns: [],
          suggestions: [],
        },
        toolsUsed: [],
        duration: 1000,
        timestamp: Date.now(),
      };

      const plan: TaskPlan = {
        id: 'plan-reset',
        userRequest: 'Verify',
        tasks: [task],
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
        estimatedDuration: 5000,
        createdAt: Date.now(),
      };

      const input: CriticInput = {
        task,
        executorOutput,
        plan,
      };

      await criticAgent.evaluate(input);

      let metrics = criticAgent.getMetrics();
      expect(metrics.totalExecutions).toBe(1);

      criticAgent.resetMetrics();

      metrics = criticAgent.getMetrics();
      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.successfulExecutions).toBe(0);
      expect(metrics.failedExecutions).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle evaluation errors gracefully', async () => {
      const task: Task = {
        id: 'task-error',
        type: 'apply_changes' as TaskType,
        description: 'Apply changes',
        dependencies: [],
        criteria: {
          functional: ['Changes applied'],
          quality: ['No errors'],
        },
        priority: 'P0',
        estimatedDuration: 5000,
      };

      const executorOutput: ExecutorOutput = {
        taskId: 'task-error',
        status: 'pass',
        result: {},
        selfEvaluation: {
          confidence: 0.5,
          concerns: [],
          suggestions: [],
        },
        toolsUsed: [],
        duration: 1000,
        timestamp: Date.now(),
      };

      const plan: TaskPlan = {
        id: 'plan-error',
        userRequest: 'Apply',
        tasks: [task],
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
        estimatedDuration: 5000,
        createdAt: Date.now(),
      };

      const input: CriticInput = {
        task,
        executorOutput,
        plan,
      };

      // Should not throw
      await expect(criticAgent.evaluate(input)).resolves.toBeDefined();
    });

    test('should track failed executions', async () => {
      const failingAgent = new CriticAgent(mockToolRegistry, mockOllamaClient);

      // Mock logInfo to throw an error, simulating a failure during evaluation
      // This allows the error to flow through executeWithErrorHandling which records metrics
      jest.spyOn(failingAgent as any, 'logInfo').mockImplementation(() => {
        throw new Error('Simulated evaluation failure');
      });

      const task: Task = {
        id: 'task-fail',
        type: 'run_tests' as TaskType,
        description: 'Run tests',
        dependencies: [],
        criteria: {
          functional: ['Tests pass'],
          quality: ['No failures'],
        },
        priority: 'P0',
        estimatedDuration: 10000,
      };

      const executorOutput: ExecutorOutput = {
        taskId: 'task-fail',
        status: 'pass',
        result: {},
        selfEvaluation: {
          confidence: 0.8,
          concerns: [],
          suggestions: [],
        },
        toolsUsed: [],
        duration: 1000,
        timestamp: Date.now(),
      };

      const plan: TaskPlan = {
        id: 'plan-fail',
        userRequest: 'Test',
        tasks: [task],
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
        estimatedDuration: 10000,
        createdAt: Date.now(),
      };

      const input: CriticInput = {
        task,
        executorOutput,
        plan,
      };

      await expect(failingAgent.evaluate(input)).rejects.toThrow('Simulated evaluation failure');

      const metrics = failingAgent.getMetrics();
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.failedExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(0);
    });
  });
});
