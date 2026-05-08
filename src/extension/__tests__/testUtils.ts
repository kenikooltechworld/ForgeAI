/**
 * Shared test utilities and mocks for unit tests
 */

import * as vscode from 'vscode';
import { ToolRegistry } from '../tools/ToolRegistry';
import { OllamaClient, OllamaChatRequest, OllamaChatResponse } from '../ollama/OllamaClient';
import { Logger } from '../utils/Logger';

/**
 * Create a mock VS Code Extension Context
 */
export function createMockContext(): vscode.ExtensionContext {
  return {
    subscriptions: [],
    workspaceState: {
      get: jest.fn(),
      update: jest.fn(),
      keys: jest.fn(() => []),
    },
    globalState: {
      get: jest.fn(),
      update: jest.fn(),
      keys: jest.fn(() => []),
      setKeysForSync: jest.fn(),
    },
    extensionPath: '/mock/extension/path',
    extensionUri: vscode.Uri.file('/mock/extension/path'),
    environmentVariableCollection: {} as any,
    extensionMode: 3, // ExtensionMode.Test
    storageUri: vscode.Uri.file('/mock/storage'),
    globalStorageUri: vscode.Uri.file('/mock/global/storage'),
    logUri: vscode.Uri.file('/mock/log'),
    asAbsolutePath: jest.fn((relativePath: string) => `/mock/extension/path/${relativePath}`),
    storagePath: '/mock/storage',
    globalStoragePath: '/mock/global/storage',
    logPath: '/mock/log',
    secrets: {} as any,
    extension: {} as any,
    languageModelAccessInformation: {} as any,
  } as vscode.ExtensionContext;
}

/**
 * Create a mock Logger
 */
export function createMockLogger(): Logger {
  const mockContext = createMockContext();
  return new Logger(mockContext);
}

/**
 * Create a mock ToolRegistry
 */
export function createMockToolRegistry(): ToolRegistry {
  const mockContext = createMockContext();
  const mockLogger = createMockLogger();
  const registry = new ToolRegistry(mockContext, mockLogger);

  // Mock the executeTool method
  jest.spyOn(registry, 'executeTool').mockResolvedValue({ success: true, data: null });

  return registry;
}

/**
 * Create a mock OllamaClient
 */
export function createMockOllamaClient(): OllamaClient {
  const mockLogger = createMockLogger();
  const client = new OllamaClient('http://localhost:11434', mockLogger);

  // Default mock task plan — valid 3-task plan matching PlannerAgent's expected format
  const mockTaskPlan = [
    {
      type: 'read_code',
      description: 'Read relevant source files',
      dependencies: [],
      priority: 'P0',
      estimatedMinutes: 5,
      criteria: {
        functional: ['Files read successfully'],
        quality: ['Complete code review'],
      },
    },
    {
      type: 'analyze',
      description: 'Analyze code for issues',
      dependencies: [0],
      priority: 'P0',
      estimatedMinutes: 10,
      criteria: {
        functional: ['Issues identified'],
        quality: ['Analysis complete'],
      },
    },
    {
      type: 'generate_fix',
      description: 'Generate fix for identified issues',
      dependencies: [1],
      priority: 'P0',
      estimatedMinutes: 15,
      criteria: {
        functional: ['Fix generated'],
        quality: ['Clean code'],
      },
    },
  ];

  // Mock critic evaluation response
  const mockCriticEvaluation = {
    status: 'pass',
    confidence: 0.85,
    feedback: {
      functionality: { passed: true, score: 0.9, issues: [] },
      codeQuality: { passed: true, score: 0.85, issues: [] },
      testCoverage: { passed: true, score: 0.8, issues: [] },
      suggestions: ['Consider adding more test coverage'],
      requiredChanges: [],
    },
  };

  // Mock the chat method — returns critic evaluation for Critic agent, task plan for Planner
  jest.spyOn(client, 'chat').mockImplementation(async (request: OllamaChatRequest) => {
    const systemPrompt = request.messages.find((m) => m.role === 'system')?.content || '';
    const isCriticRequest =
      systemPrompt.includes('Critic agent') || systemPrompt.includes('validate work');

    const content = isCriticRequest
      ? JSON.stringify(mockCriticEvaluation)
      : JSON.stringify(mockTaskPlan);

    const response: OllamaChatResponse = {
      model: request.model,
      created_at: new Date().toISOString(),
      message: {
        role: 'assistant',
        content,
      },
      done: true,
    };
    return response;
  });

  return client;
}
