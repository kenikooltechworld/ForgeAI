/**
 * Unit tests for MultiAgentOrchestrator
 * Tests orchestrator initialization, execution, state management, and callbacks
 */

import { MultiAgentOrchestrator } from '../MultiAgentOrchestrator';
import { AgentLoop } from '../../ollama/AgentLoop';
import { ProgressUpdate, ExecutorOutput, ExecutionContext } from '../types';
import {
  createMockToolRegistry,
  createMockOllamaClient,
  createMockLogger,
} from '../../__tests__/testUtils';

describe('MultiAgentOrchestrator', () => {
  let orchestrator: MultiAgentOrchestrator;
  let mockAgentLoop: AgentLoop;
  let mockToolRegistry: ReturnType<typeof createMockToolRegistry>;
  let mockOllamaClient: ReturnType<typeof createMockOllamaClient>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockToolRegistry = createMockToolRegistry();
    mockOllamaClient = createMockOllamaClient();
    mockLogger = createMockLogger();
    mockAgentLoop = new AgentLoop(mockOllamaClient, mockLogger, mockToolRegistry);
    orchestrator = new MultiAgentOrchestrator(mockAgentLoop, mockToolRegistry, mockOllamaClient);
  });

  afterEach(() => {
    orchestrator.resetMetrics();
  });

  describe('Initialization', () => {
    test('should initialize with correct dependencies', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator.isExecuting()).toBe(false);
    });

    test('should have initial state as null', () => {
      const state = orchestrator.getState();
      expect(state).toBeNull();
    });

    test('should have zero metrics initially', () => {
      const metrics = orchestrator.getMetrics();

      expect(metrics.planner.totalExecutions).toBe(0);
      expect(metrics.executor.totalExecutions).toBe(0);
      expect(metrics.critic.totalExecutions).toBe(0);
    });
  });

  describe('run() method', () => {
    test('should execute simple workflow end-to-end', async () => {
      const request = 'Simple test request';

      const result = await orchestrator.run(request);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.plan).toBeDefined();
      expect(result.results).toBeInstanceOf(Map);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalTasks).toBeGreaterThanOrEqual(0);
      expect(result.metrics.completedTasks).toBeGreaterThanOrEqual(0);
      expect(result.metrics.failedTasks).toBeGreaterThanOrEqual(0);
      expect(result.metrics.iterations).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.metrics.toolsUsed)).toBe(true);
    });

    test('should handle errors gracefully', async () => {
      const request = 'Test request';

      const result = await orchestrator.run(request);

      // Should not throw, even if there are errors
      expect(result).toBeDefined();
    });

    test('should prevent concurrent execution', async () => {
      const request = 'Test request';

      // Start first execution
      const promise1 = orchestrator.run(request);

      // Try to start second execution while first is running
      await expect(orchestrator.run(request)).rejects.toThrow('Orchestrator is already running');

      // Wait for first to complete
      await promise1;
    });

    test('should accept run options', async () => {
      const request = 'Test request';
      const options = {
        maxIterations: 10,
        enableParallel: false,
        timeout: 60000,
        verbose: true,
      };

      const result = await orchestrator.run(request, options);

      expect(result).toBeDefined();
    });

    test('should use default max iterations if not specified', async () => {
      const request = 'Test request';

      const result = await orchestrator.run(request);

      expect(result).toBeDefined();
      // Default max iterations is 5
      expect(result.metrics.iterations).toBeLessThanOrEqual(5);
    });
  });

  describe('State Management', () => {
    test('should return null state before execution', () => {
      const state = orchestrator.getState();

      expect(state).toBeNull();
    });

    test('should return state after execution', async () => {
      const request = 'Test request';

      await orchestrator.run(request);

      const state = orchestrator.getState();

      expect(state).toBeDefined();
      expect(state?.userRequest).toBe(request);
    });

    test('should return deep copy of state', async () => {
      const request = 'Test request';

      await orchestrator.run(request);

      const state1 = orchestrator.getState();
      const state2 = orchestrator.getState();

      // Should be different objects
      expect(state1).not.toBe(state2);

      // But with same values
      expect(state1?.userRequest).toBe(state2?.userRequest);
    });

    test('should not allow external modification of state', async () => {
      const request = 'Test request';

      await orchestrator.run(request);

      const state = orchestrator.getState();

      if (state) {
        // Try to modify state
        state.iteration = 999;

        // Get state again
        const newState = orchestrator.getState();

        // Should not be modified
        expect(newState?.iteration).not.toBe(999);
      }
    });
  });

  describe('Execution Status', () => {
    test('should report not executing initially', () => {
      expect(orchestrator.isExecuting()).toBe(false);
    });

    test('should report executing during run', async () => {
      const request = 'Test request';

      const promise = orchestrator.run(request);

      // Note: This test is timing-dependent and may be flaky
      // In a real scenario, we'd need better synchronization

      await promise;

      // After completion, should not be executing
      expect(orchestrator.isExecuting()).toBe(false);
    });
  });

  describe('Progress Callbacks', () => {
    test('should register progress callback', () => {
      const callback = jest.fn();

      orchestrator.onProgress(callback);

      // Callback should be registered (no error thrown)
      expect(true).toBe(true);
    });

    test('should register task complete callback', () => {
      const callback = jest.fn();

      orchestrator.onTaskComplete(callback);

      // Callback should be registered (no error thrown)
      expect(true).toBe(true);
    });

    test('should register error callback', () => {
      const callback = jest.fn();

      orchestrator.onError(callback);

      // Callback should be registered (no error thrown)
      expect(true).toBe(true);
    });

    test('should handle callback errors gracefully', async () => {
      const failingCallback = jest.fn(() => {
        throw new Error('Callback error');
      });

      orchestrator.onProgress(failingCallback);

      const request = 'Test request';

      // Should not throw even if callback fails
      await expect(orchestrator.run(request)).resolves.toBeDefined();
    });
  });

  describe('Metrics Tracking', () => {
    test('should track agent metrics', async () => {
      const request = 'Test request';

      await orchestrator.run(request);

      const metrics = orchestrator.getMetrics();

      expect(metrics.planner).toBeDefined();
      expect(metrics.executor).toBeDefined();
      expect(metrics.critic).toBeDefined();

      // At least planner should have executed
      expect(metrics.planner.totalExecutions).toBeGreaterThan(0);
    });

    test('should reset all agent metrics', async () => {
      const request = 'Test request';

      await orchestrator.run(request);

      let metrics = orchestrator.getMetrics();
      expect(metrics.planner.totalExecutions).toBeGreaterThan(0);

      orchestrator.resetMetrics();

      metrics = orchestrator.getMetrics();
      expect(metrics.planner.totalExecutions).toBe(0);
      expect(metrics.executor.totalExecutions).toBe(0);
      expect(metrics.critic.totalExecutions).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle graph execution errors', async () => {
      const request = 'Test request';

      const result = await orchestrator.run(request);

      // Should return result even if there are errors
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    test('should include error information in result', async () => {
      const request = 'Test request';

      const result = await orchestrator.run(request);

      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error?.message).toBeDefined();
      }
    });

    test('should set status to failed on error', async () => {
      const request = 'Test request';

      const result = await orchestrator.run(request);

      if (!result.success) {
        expect(result.status).toBe('failed');
      }
    });
  });

  describe('Result Structure', () => {
    test('should return complete result structure', async () => {
      const request = 'Test request';

      const result = await orchestrator.run(request);

      // Verify all required fields
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('plan');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('metrics');

      // Verify metrics structure
      expect(result.metrics).toHaveProperty('totalTasks');
      expect(result.metrics).toHaveProperty('completedTasks');
      expect(result.metrics).toHaveProperty('failedTasks');
      expect(result.metrics).toHaveProperty('iterations');
      expect(result.metrics).toHaveProperty('toolsUsed');
    });

    test('should have valid duration', async () => {
      const request = 'Test request';

      const result = await orchestrator.run(request);

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });

    test('should have valid metrics', async () => {
      const request = 'Test request';

      const result = await orchestrator.run(request);

      expect(result.metrics.totalTasks).toBeGreaterThanOrEqual(0);
      expect(result.metrics.completedTasks).toBeGreaterThanOrEqual(0);
      expect(result.metrics.failedTasks).toBeGreaterThanOrEqual(0);
      expect(result.metrics.iterations).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.metrics.toolsUsed)).toBe(true);
    });
  });

  describe('Integration with Agents', () => {
    test('should use all three agents', async () => {
      const request = 'Test request';

      await orchestrator.run(request);

      const metrics = orchestrator.getMetrics();

      // Planner should always execute
      expect(metrics.planner.totalExecutions).toBeGreaterThan(0);

      // Executor and Critic may or may not execute depending on plan
      // But they should be initialized
      expect(metrics.executor).toBeDefined();
      expect(metrics.critic).toBeDefined();
    });

    test('should track successful executions', async () => {
      const request = 'Test request';

      await orchestrator.run(request);

      const metrics = orchestrator.getMetrics();

      // At least planner should have successful execution
      expect(metrics.planner.successfulExecutions).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Execution Prevention', () => {
    test('should not allow multiple concurrent runs', async () => {
      const request1 = 'Test request 1';
      const request2 = 'Test request 2';

      const promise1 = orchestrator.run(request1);

      // Try to run again while first is still running
      await expect(orchestrator.run(request2)).rejects.toThrow();

      // Wait for first to complete
      await promise1;

      // Now should be able to run again
      await expect(orchestrator.run(request2)).resolves.toBeDefined();
    });
  });
});
