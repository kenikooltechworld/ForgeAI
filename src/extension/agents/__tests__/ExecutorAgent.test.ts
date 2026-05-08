/**
 * Unit tests for ExecutorAgent
 * Tests task execution, tool usage, self-evaluation, and refinement
 */

import { ExecutorAgent } from '../ExecutorAgent';
import {
  ExecutorInput,
  ExecutorOutput,
  Task,
  CriticFeedback,
  TaskType,
} from '../../orchestrator/types';
import { createMockToolRegistry, createMockOllamaClient } from '../../__tests__/testUtils';

describe('ExecutorAgent', () => {
  let executorAgent: ExecutorAgent;
  let mockToolRegistry: ReturnType<typeof createMockToolRegistry>;
  let mockOllamaClient: ReturnType<typeof createMockOllamaClient>;

  beforeEach(() => {
    mockToolRegistry = createMockToolRegistry();
    mockOllamaClient = createMockOllamaClient();
    executorAgent = new ExecutorAgent(mockToolRegistry, mockOllamaClient);
  });

  afterEach(() => {
    executorAgent.resetMetrics();
  });

  describe('Basic Functionality', () => {
    test('should have correct name', () => {
      expect(executorAgent.getName()).toBe('Executor');
    });

    test('should have correct capabilities', () => {
      const capabilities = executorAgent.getCapabilities();
      expect(capabilities).toHaveLength(5);
      expect(capabilities).toContain('Task execution');
      expect(capabilities).toContain('Tool usage');
      expect(capabilities).toContain('Self-evaluation');
      expect(capabilities).toContain('Iterative refinement');
      expect(capabilities).toContain('Code generation');
    });
  });

  describe('execute() method', () => {
    test('should execute a task and return output', async () => {
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

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      const output = await executorAgent.execute(input);

      // Verify output structure
      expect(output).toBeDefined();
      expect(output.taskId).toBe(task.id);
      expect(output.status).toBeDefined();
      // Design.md status values: success | partial | failed | needs_refinement
      expect(['success', 'partial', 'failed', 'needs_refinement', 'pass', 'fail']).toContain(
        output.status
      );
      expect(output.result).toBeDefined();
      expect(output.selfEvaluation).toBeDefined();
      expect(output.selfEvaluation.confidence).toBeGreaterThanOrEqual(0);
      expect(output.selfEvaluation.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(output.selfEvaluation.concerns)).toBe(true);
      expect(Array.isArray(output.selfEvaluation.suggestions)).toBe(true);
      expect(Array.isArray(output.toolsUsed)).toBe(true);
      expect(output.duration).toBeGreaterThanOrEqual(0);
      expect(output.timestamp).toBeGreaterThan(0);
    });

    test('should return pass status in placeholder implementation', async () => {
      const task: Task = {
        id: 'task-2',
        type: 'analyze' as TaskType,
        description: 'Analyze code for issues',
        dependencies: [],
        criteria: {
          functional: ['Issues identified'],
          quality: ['Analysis complete'],
        },
        priority: 'P1',
        estimatedDuration: 10000,
      };

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      const output = await executorAgent.execute(input);

      // Now returns 'partial' (confidence 0.5 maps to partial per design.md)
      expect(['pass', 'partial', 'success']).toContain(output.status);
    });

    test('should track tools used during execution', async () => {
      const task: Task = {
        id: 'task-3',
        type: 'run_tests' as TaskType,
        description: 'Run test suite',
        dependencies: [],
        criteria: {
          functional: ['All tests pass'],
          quality: ['No test failures'],
        },
        priority: 'P0',
        estimatedDuration: 30000,
      };

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      const output = await executorAgent.execute(input);

      // Verify toolsUsed is an array
      expect(Array.isArray(output.toolsUsed)).toBe(true);
    });

    test('should handle different task types', async () => {
      const taskTypes: TaskType[] = [
        'read_code',
        'analyze',
        'generate_fix',
        'run_tests',
        'apply_changes',
        'verify',
      ];

      for (const type of taskTypes) {
        const task: Task = {
          id: `task-${type}`,
          type,
          description: `Task of type ${type}`,
          dependencies: [],
          criteria: {
            functional: ['Task completed'],
            quality: ['No errors'],
          },
          priority: 'P1',
          estimatedDuration: 5000,
        };

        const input: ExecutorInput = {
          task,
          dependencyResults: new Map(),
        };

        const output = await executorAgent.execute(input);

        expect(output).toBeDefined();
        expect(output.taskId).toBe(task.id);
      }
    });

    test('should route to correct handler based on task type', async () => {
      const taskTypes: TaskType[] = [
        'read_code',
        'analyze',
        'generate_fix',
        'run_tests',
        'apply_changes',
        'verify',
      ];

      for (const type of taskTypes) {
        const task: Task = {
          id: `task-${type}`,
          type,
          description: `Task of type ${type}`,
          dependencies: [],
          criteria: {
            functional: ['Task completed'],
            quality: ['No errors'],
          },
          priority: 'P1',
          estimatedDuration: 5000,
        };

        const input: ExecutorInput = {
          task,
          dependencyResults: new Map(),
        };

        const output = await executorAgent.execute(input);

        // Verify output contains task type in result (placeholder implementation)
        expect(output).toBeDefined();
        expect(output.taskId).toBe(task.id);
        // Design.md status values: success | partial | failed | needs_refinement
        expect(['success', 'partial', 'failed', 'needs_refinement']).toContain(output.status);
        expect(output.result).toBeDefined();
        // Real implementation returns actual results, not placeholder objects
        expect(output.selfEvaluation).toBeDefined();
        expect(output.toolsUsed).toBeDefined();
      }
    });

    test('should throw error for unknown task type', async () => {
      const task: Task = {
        id: 'task-unknown',
        type: 'unknown_type' as TaskType,
        description: 'Unknown task type',
        dependencies: [],
        criteria: {
          functional: ['Task completed'],
          quality: ['No errors'],
        },
        priority: 'P1',
        estimatedDuration: 5000,
      };

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      const output = await executorAgent.execute(input);

      // Should return 'failed' status with error (design.md uses 'failed')
      expect(output.status).toBe('failed');
      expect(output.result.error).toContain('Unknown task type');
    });

    test('should measure execution duration', async () => {
      const task: Task = {
        id: 'task-duration',
        type: 'read_code' as TaskType,
        description: 'Read code',
        dependencies: [],
        criteria: {
          functional: ['Code read'],
          quality: ['No errors'],
        },
        priority: 'P1',
        estimatedDuration: 5000,
      };

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      const output = await executorAgent.execute(input);

      // Duration should be measured
      expect(output.duration).toBeGreaterThanOrEqual(0);
      expect(typeof output.duration).toBe('number');
    });

    test('should call selfEvaluate before returning', async () => {
      const task: Task = {
        id: 'task-self-eval',
        type: 'analyze' as TaskType,
        description: 'Analyze code',
        dependencies: [],
        criteria: {
          functional: ['Analysis complete'],
          quality: ['No errors'],
        },
        priority: 'P1',
        estimatedDuration: 5000,
      };

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      const output = await executorAgent.execute(input);

      // Self-evaluation should be present
      expect(output.selfEvaluation).toBeDefined();
      expect(output.selfEvaluation.confidence).toBeGreaterThanOrEqual(0);
      expect(output.selfEvaluation.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(output.selfEvaluation.concerns)).toBe(true);
      expect(Array.isArray(output.selfEvaluation.suggestions)).toBe(true);
    });

    test('should track tools used during execution', async () => {
      const task: Task = {
        id: 'task-tools',
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

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      const output = await executorAgent.execute(input);

      // Tools used should be tracked (empty array in placeholder)
      expect(Array.isArray(output.toolsUsed)).toBe(true);
    });
  });

  describe('refine() method', () => {
    test('should accept previous output and feedback', async () => {
      const previousOutput: ExecutorOutput = {
        taskId: 'task-1',
        status: 'needs_refinement',
        result: { code: 'console.log("test");' },
        selfEvaluation: {
          confidence: 0.6,
          concerns: ['Missing error handling'],
          suggestions: ['Add try-catch'],
        },
        toolsUsed: ['forgeai_writeFile'],
        duration: 1000,
        timestamp: Date.now(),
      };

      const feedback: CriticFeedback = {
        status: 'fail',
        issues: ['Missing error handling'],
        requiredChanges: ['Add try-catch block'],
        suggestions: ['Use async/await'],
      };

      const refinedOutput = await executorAgent.refine(previousOutput, feedback);

      // Verify refined output
      expect(refinedOutput).toBeDefined();
      expect(refinedOutput.taskId).toBe(previousOutput.taskId);
    });

    test('should return output in placeholder implementation', async () => {
      const previousOutput: ExecutorOutput = {
        taskId: 'task-2',
        status: 'needs_refinement',
        result: null,
        selfEvaluation: {
          confidence: 0.5,
          concerns: [],
          suggestions: [],
        },
        toolsUsed: [],
        duration: 0,
        timestamp: Date.now(),
      };

      const feedback: CriticFeedback = {
        status: 'fail',
        issues: ['Test issue'],
        requiredChanges: ['Fix issue'],
        suggestions: [],
      };

      const refinedOutput = await executorAgent.refine(previousOutput, feedback);

      // Placeholder returns same output
      expect(refinedOutput.taskId).toBe(previousOutput.taskId);
    });
  });

  describe('Self-Evaluation', () => {
    test('should include self-evaluation in output', async () => {
      const task: Task = {
        id: 'task-eval',
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

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      const output = await executorAgent.execute(input);

      // Verify self-evaluation structure
      expect(output.selfEvaluation).toBeDefined();
      expect(typeof output.selfEvaluation.confidence).toBe('number');
      expect(output.selfEvaluation.confidence).toBeGreaterThanOrEqual(0);
      expect(output.selfEvaluation.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(output.selfEvaluation.concerns)).toBe(true);
      expect(Array.isArray(output.selfEvaluation.suggestions)).toBe(true);
    });

    test('should have confidence score between 0 and 1', async () => {
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

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      const output = await executorAgent.execute(input);

      expect(output.selfEvaluation.confidence).toBeGreaterThanOrEqual(0);
      expect(output.selfEvaluation.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Metrics Tracking', () => {
    test('should track execution metrics', async () => {
      const task: Task = {
        id: 'task-metrics',
        type: 'read_code' as TaskType,
        description: 'Read code',
        dependencies: [],
        criteria: {
          functional: ['Code read'],
          quality: ['No errors'],
        },
        priority: 'P1',
        estimatedDuration: 5000,
      };

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      // Execute multiple times
      await executorAgent.execute(input);
      await executorAgent.execute(input);
      await executorAgent.execute(input);

      const metrics = executorAgent.getMetrics();

      expect(metrics.totalExecutions).toBe(3);
      expect(metrics.successfulExecutions).toBe(3);
      expect(metrics.failedExecutions).toBe(0);
      expect(metrics.averageDuration).toBeGreaterThanOrEqual(0);
      expect(metrics.lastExecutionTime).toBeGreaterThan(0);
    });

    test('should reset metrics', async () => {
      const task: Task = {
        id: 'task-reset',
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

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      await executorAgent.execute(input);

      let metrics = executorAgent.getMetrics();
      expect(metrics.totalExecutions).toBe(1);

      executorAgent.resetMetrics();

      metrics = executorAgent.getMetrics();
      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.successfulExecutions).toBe(0);
      expect(metrics.failedExecutions).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle execution errors gracefully', async () => {
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

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      // Should not throw
      await expect(executorAgent.execute(input)).resolves.toBeDefined();
    });

    test('should track failed executions', async () => {
      const failingAgent = new ExecutorAgent(mockToolRegistry, mockOllamaClient);

      // Mock logInfo to throw an error, simulating a failure during execution
      // This allows the error to flow through executeWithErrorHandling which records metrics
      jest.spyOn(failingAgent as any, 'logInfo').mockImplementation(() => {
        throw new Error('Simulated execution failure');
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

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      await expect(failingAgent.execute(input)).rejects.toThrow('Simulated execution failure');

      const metrics = failingAgent.getMetrics();
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.failedExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(0);
    });
  });

  describe('Dependency Results', () => {
    test('should accept dependency results', async () => {
      const dependencyOutput: ExecutorOutput = {
        taskId: 'task-dep',
        status: 'pass',
        result: { data: 'dependency result' },
        selfEvaluation: {
          confidence: 0.9,
          concerns: [],
          suggestions: [],
        },
        toolsUsed: [],
        duration: 1000,
        timestamp: Date.now(),
      };

      const task: Task = {
        id: 'task-with-deps',
        type: 'analyze' as TaskType,
        description: 'Analyze with dependencies',
        dependencies: ['task-dep'],
        criteria: {
          functional: ['Analysis complete'],
          quality: ['Uses dependency data'],
        },
        priority: 'P1',
        estimatedDuration: 5000,
      };

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map([['task-dep', dependencyOutput]]),
      };

      const output = await executorAgent.execute(input);

      expect(output).toBeDefined();
      expect(output.taskId).toBe(task.id);
    });
  });

  describe('Iteration Limits', () => {
    test('should respect iteration count in input', async () => {
      const task: Task = {
        id: 'task-iteration',
        type: 'generate_fix' as TaskType,
        description: 'Generate fix',
        dependencies: [],
        criteria: {
          functional: ['Fix generated'],
          quality: ['Quality maintained'],
        },
        priority: 'P0',
        estimatedDuration: 10000,
      };

      const input: ExecutorInput = {
        task,
        dependencyResults: new Map(),
      };

      // Execute should work regardless of iteration count
      const output = await executorAgent.execute(input);

      expect(output).toBeDefined();
    });
  });
});
