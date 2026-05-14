import { CriticAgent } from '../CriticAgent';
import { createMockToolRegistry, createMockOllamaClient } from '../../__tests__/testUtils';
import { RecoveryExecutor } from '../recovery/RecoveryExecutor';
import { CriticInput, CriticOutput, Task, ExecutorOutput } from '../types';

describe('CriticAgent Phase 3 recovery', () => {
  test('returns pass after executing recovery when initial critic status is fail', async () => {
    const mockToolRegistry = createMockToolRegistry();
    const mockOllamaClient = createMockOllamaClient();

    // Force diagnostics to include at least one error so buildCriticOutput marks fail.
    jest.spyOn(mockToolRegistry, 'executeTool').mockImplementation(async (name: string) => {
      if (name === 'forgeai_getDiagnostics') {
        return [{ severity: 'error', file: 'src/a.ts', line: 1, message: 'TS error' }];
      }
      return { success: true, data: null };
    });

    // Mock recovery execution to succeed.
    const recoverySpy = jest
      .spyOn(RecoveryExecutor.prototype, 'executeRecovery')
      .mockResolvedValue({
        succeeded: true,
        confidence: 0.9,
        steps: [{ action: 'Install dependency', tool: 'forgeai_runCommand', succeeded: true }],
        errorMessage: 'Error: Cannot find module ...',
        category: 'missing_dependency',
      });

    const critic = new CriticAgent(mockToolRegistry, mockOllamaClient);

    const task: Task = {
      id: 'task-1',
      type: 'read_code',
      description: 'Read relevant source files',
      dependencies: [],
      criteria: { functional: ['x'], quality: ['y'] },
      priority: 'P0',
      estimatedDuration: 1000,
    };

    const executorOutput: ExecutorOutput = {
      taskId: 'task-1',
      status: 'failed',
      result: {
        output: "Error: Cannot find module 'express'",
      },
      selfEvaluation: { confidence: 0.2, concerns: ['err'], suggestions: ['fix'] },
      toolsUsed: [],
      duration: 100,
      timestamp: Date.now(),
    };

    const input: CriticInput = {
      task,
      executorOutput,
      plan: {
        id: 'plan-1',
        userRequest: 'req',
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
        estimatedDuration: 1000,
        createdAt: Date.now(),
      },
    };

    const output: CriticOutput = await critic.evaluate(input);

    expect(output.status).toBe('pass');
    expect(recoverySpy).toHaveBeenCalled();
    expect(output.feedback.suggestions.join('\n')).toContain('Recovery executed successfully');
  });
});
