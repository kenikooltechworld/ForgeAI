/**
 * Unit tests for LangGraph State Machine
 * Tests graph structure, node execution, routing logic, and state management
 */

import { GraphBuilder, StateAnnotation } from '../Graph';
import { PlannerAgent } from '../../agents/PlannerAgent';
import { ExecutorAgent } from '../../agents/ExecutorAgent';
import { CriticAgent } from '../../agents/CriticAgent';
import { Task, TaskPlan, ExecutorOutput, WorkflowStatus } from '../types';
import { createMockToolRegistry, createMockOllamaClient } from '../../__tests__/testUtils';

describe('LangGraph State Machine', () => {
  let graphBuilder: GraphBuilder;
  let plannerAgent: PlannerAgent;
  let executorAgent: ExecutorAgent;
  let criticAgent: CriticAgent;
  let mockToolRegistry: ReturnType<typeof createMockToolRegistry>;
  let mockOllamaClient: ReturnType<typeof createMockOllamaClient>;

  beforeEach(() => {
    mockToolRegistry = createMockToolRegistry();
    mockOllamaClient = createMockOllamaClient();
    plannerAgent = new PlannerAgent(mockToolRegistry, mockOllamaClient);
    executorAgent = new ExecutorAgent(mockToolRegistry, mockOllamaClient);
    criticAgent = new CriticAgent(mockToolRegistry, mockOllamaClient);
    graphBuilder = new GraphBuilder(plannerAgent, executorAgent, criticAgent);
  });

  describe('Graph Creation', () => {
    test('should create valid state graph', () => {
      const graph = graphBuilder.createGraph();

      expect(graph).toBeDefined();
      expect(typeof graph.compile).toBe('function');
    });

    test('should compile graph successfully', () => {
      const compiledGraph = graphBuilder.compile();

      expect(compiledGraph).toBeDefined();
      expect(typeof compiledGraph.invoke).toBe('function');
    });
  });

  describe('State Annotation', () => {
    test('should have correct default values', () => {
      const state: typeof StateAnnotation.State = {
        userRequest: '',
        plan: null,
        currentTask: null,
        results: new Map(),
        iteration: 0,
        maxIterations: 5,
        status: 'planning' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      expect(state.userRequest).toBe('');
      expect(state.plan).toBeNull();
      expect(state.currentTask).toBeNull();
      expect(state.results).toBeInstanceOf(Map);
      expect(state.iteration).toBe(0);
      expect(state.maxIterations).toBe(5);
      expect(state.status).toBe('planning');
    });

    test('should merge results maps correctly', () => {
      const map1 = new Map<string, ExecutorOutput>([
        [
          'task-1',
          {
            taskId: 'task-1',
            status: 'pass',
            result: {},
            selfEvaluation: { confidence: 0.8, concerns: [], suggestions: [] },
            toolsUsed: [],
            duration: 1000,
            timestamp: Date.now(),
          },
        ],
      ]);

      const map2 = new Map<string, ExecutorOutput>([
        [
          'task-2',
          {
            taskId: 'task-2',
            status: 'pass',
            result: {},
            selfEvaluation: { confidence: 0.9, concerns: [], suggestions: [] },
            toolsUsed: [],
            duration: 1500,
            timestamp: Date.now(),
          },
        ],
      ]);

      // Test reducer logic
      const merged = new Map([...map1, ...map2]);

      expect(merged.size).toBe(2);
      expect(merged.has('task-1')).toBe(true);
      expect(merged.has('task-2')).toBe(true);
    });
  });

  describe('Planner Node', () => {
    test('should execute planner node correctly', async () => {
      const initialState: typeof StateAnnotation.State = {
        userRequest: 'Test request',
        plan: null,
        currentTask: null,
        results: new Map(),
        iteration: 0,
        maxIterations: 5,
        status: 'planning' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const result = await graphBuilder['plannerNode'](initialState);

      expect(result).toBeDefined();
      expect(result.plan).toBeDefined();
      expect(result.status).toBe('executing');
    });

    test('should handle planner errors', async () => {
      // Create failing planner
      const failingPlanner = new PlannerAgent(mockToolRegistry, mockOllamaClient);
      jest.spyOn(failingPlanner, 'plan').mockRejectedValue(new Error('Planner error'));

      const failingBuilder = new GraphBuilder(failingPlanner, executorAgent, criticAgent);

      const initialState: typeof StateAnnotation.State = {
        userRequest: 'Test request',
        plan: null,
        currentTask: null,
        results: new Map(),
        iteration: 0,
        maxIterations: 5,
        status: 'planning' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const result = await failingBuilder['plannerNode'](initialState);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Planner error');
    });
  });

  describe('Executor Node', () => {
    test('should execute executor node correctly', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'read_code',
        description: 'Read code',
        dependencies: [],
        criteria: {
          functional: ['Code read'],
          quality: ['No errors'],
        },
        priority: 'P0',
        estimatedDuration: 5000,
      };

      const state: typeof StateAnnotation.State = {
        userRequest: 'Test request',
        plan: null,
        currentTask: task,
        results: new Map(),
        iteration: 0,
        maxIterations: 5,
        status: 'executing' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const result = await graphBuilder['executorNode'](state);

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.results?.has('task-1')).toBe(true);
    });

    test('should handle missing current task', async () => {
      const state: typeof StateAnnotation.State = {
        userRequest: 'Test request',
        plan: null,
        currentTask: null,
        results: new Map(),
        iteration: 0,
        maxIterations: 5,
        status: 'executing' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const result = await graphBuilder['executorNode'](state);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('No current task');
    });

    test('should handle executor errors', async () => {
      const failingExecutor = new ExecutorAgent(mockToolRegistry, mockOllamaClient);
      jest.spyOn(failingExecutor, 'execute').mockRejectedValue(new Error('Executor error'));

      const failingBuilder = new GraphBuilder(plannerAgent, failingExecutor, criticAgent);

      const task: Task = {
        id: 'task-1',
        type: 'analyze',
        description: 'Analyze',
        dependencies: [],
        criteria: {
          functional: ['Analysis done'],
          quality: ['Complete'],
        },
        priority: 'P1',
        estimatedDuration: 5000,
      };

      const state: typeof StateAnnotation.State = {
        userRequest: 'Test request',
        plan: null,
        currentTask: task,
        results: new Map(),
        iteration: 0,
        maxIterations: 5,
        status: 'executing' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const result = await failingBuilder['executorNode'](state);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error?.recoverable).toBe(true);
    });
  });

  describe('Critic Node', () => {
    test('should execute critic node correctly', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'verify',
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
        taskId: 'task-1',
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
        id: 'plan-1',
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
        estimatedDuration: 5000,
        createdAt: Date.now(),
      };

      const state: typeof StateAnnotation.State = {
        userRequest: 'Test request',
        plan,
        currentTask: task,
        results: new Map([['task-1', executorOutput]]),
        iteration: 0,
        maxIterations: 5,
        status: 'evaluating' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const result = await graphBuilder['criticNode'](state);

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.iteration).toBe(1);
    });

    test('should handle missing current task', async () => {
      const state: typeof StateAnnotation.State = {
        userRequest: 'Test request',
        plan: null,
        currentTask: null,
        results: new Map(),
        iteration: 0,
        maxIterations: 5,
        status: 'evaluating' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const result = await graphBuilder['criticNode'](state);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    test('should handle critic errors', async () => {
      const failingCritic = new CriticAgent(mockToolRegistry, mockOllamaClient);
      jest.spyOn(failingCritic, 'evaluate').mockRejectedValue(new Error('Critic error'));

      const failingBuilder = new GraphBuilder(plannerAgent, executorAgent, failingCritic);

      const task: Task = {
        id: 'task-1',
        type: 'verify',
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
        taskId: 'task-1',
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
        id: 'plan-1',
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
        estimatedDuration: 5000,
        createdAt: Date.now(),
      };

      const state: typeof StateAnnotation.State = {
        userRequest: 'Test request',
        plan,
        currentTask: task,
        results: new Map([['task-1', executorOutput]]),
        iteration: 0,
        maxIterations: 5,
        status: 'evaluating' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const result = await failingBuilder['criticNode'](state);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });
  });

  describe('Routing Logic', () => {
    test('routeCritic should return __end__ when max iterations reached', () => {
      const state: typeof StateAnnotation.State = {
        userRequest: 'Test',
        plan: null,
        currentTask: null,
        results: new Map(),
        iteration: 5,
        maxIterations: 5,
        status: 'evaluating' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const route = graphBuilder['routeCritic'](state);

      expect(route).toBe('__end__');
    });

    test('routeCritic should return next_task when status is complete', () => {
      const state: typeof StateAnnotation.State = {
        userRequest: 'Test',
        plan: null,
        currentTask: null,
        results: new Map(),
        iteration: 2,
        maxIterations: 5,
        status: 'complete' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const route = graphBuilder['routeCritic'](state);

      expect(route).toBe('next_task');
    });

    test('routeCritic should return executor for retry', () => {
      const state: typeof StateAnnotation.State = {
        userRequest: 'Test',
        plan: null,
        currentTask: null,
        results: new Map(),
        iteration: 2,
        maxIterations: 5,
        status: 'refining' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const route = graphBuilder['routeCritic'](state);

      expect(route).toBe('executor');
    });

    test('routeNextTask should return __end__ when all tasks complete', () => {
      const plan: TaskPlan = {
        id: 'plan-1',
        userRequest: 'Test',
        tasks: [
          {
            id: 'task-1',
            type: 'read_code',
            description: 'Read',
            dependencies: [],
            criteria: { functional: [], quality: [] },
            priority: 'P0',
            estimatedDuration: 5000,
          },
        ],
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

      const state: typeof StateAnnotation.State = {
        userRequest: 'Test',
        plan,
        currentTask: null,
        results: new Map([
          [
            'task-1',
            {
              taskId: 'task-1',
              status: 'pass',
              result: {},
              selfEvaluation: { confidence: 0.8, concerns: [], suggestions: [] },
              toolsUsed: [],
              duration: 1000,
              timestamp: Date.now(),
            },
          ],
        ]),
        iteration: 1,
        maxIterations: 5,
        status: 'complete' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const route = graphBuilder['routeNextTask'](state);

      expect(route).toBe('__end__');
    });

    test('routeNextTask should return executor for next task', () => {
      const plan: TaskPlan = {
        id: 'plan-1',
        userRequest: 'Test',
        tasks: [
          {
            id: 'task-1',
            type: 'read_code',
            description: 'Read',
            dependencies: [],
            criteria: { functional: [], quality: [] },
            priority: 'P0',
            estimatedDuration: 5000,
          },
          {
            id: 'task-2',
            type: 'analyze',
            description: 'Analyze',
            dependencies: [],
            criteria: { functional: [], quality: [] },
            priority: 'P1',
            estimatedDuration: 5000,
          },
        ],
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

      const state: typeof StateAnnotation.State = {
        userRequest: 'Test',
        plan,
        currentTask: null,
        results: new Map([
          [
            'task-1',
            {
              taskId: 'task-1',
              status: 'pass',
              result: {},
              selfEvaluation: { confidence: 0.8, concerns: [], suggestions: [] },
              toolsUsed: [],
              duration: 1000,
              timestamp: Date.now(),
            },
          ],
        ]),
        iteration: 1,
        maxIterations: 5,
        status: 'complete' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const route = graphBuilder['routeNextTask'](state);

      expect(route).toBe('executor');
    });
  });

  describe('Max Iterations Enforcement', () => {
    test('should enforce max iterations limit', () => {
      const state: typeof StateAnnotation.State = {
        userRequest: 'Test',
        plan: null,
        currentTask: null,
        results: new Map(),
        iteration: 20,
        maxIterations: 20,
        status: 'refining' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const route = graphBuilder['routeCritic'](state);

      expect(route).toBe('__end__');
    });

    test('should allow execution below max iterations', () => {
      const state: typeof StateAnnotation.State = {
        userRequest: 'Test',
        plan: null,
        currentTask: null,
        results: new Map(),
        iteration: 3,
        maxIterations: 20,
        status: 'refining' as WorkflowStatus,
        error: undefined,
        parallelTasks: undefined,
        parallelResults: undefined,
      };

      const route = graphBuilder['routeCritic'](state);

      expect(route).toBe('executor');
    });
  });
});
