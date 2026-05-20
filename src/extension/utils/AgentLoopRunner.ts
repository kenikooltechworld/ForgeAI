/**
 * Agent loop execution and streaming update handling.
 */

import * as vscode from 'vscode';
import { Logger } from './Logger';
import { TestResultsParser } from './TestResultsParser';
import { getToolDisplayName, getToolTarget } from './ToolDisplayUtils';
import { AgentLoopUpdate } from '../ollama/AgentLoop';
import { ToolRegistry } from '../tools/ToolRegistry';

export class AgentLoopRunner {
  private currentAgentLoop?: any;

  constructor(
    private readonly view: vscode.WebviewView | undefined,
    private readonly logger: Logger,
    private readonly toolRegistry?: ToolRegistry
  ) {}

  get activeAgentLoop(): any | undefined {
    return this.currentAgentLoop;
  }

  stopAgentLoop(conversationId: string): void {
    this.logger.info(`Stopping agent loop for conversation: ${conversationId}`);
    if (this.currentAgentLoop) {
      this.currentAgentLoop.stop();
      this.logger.info('Agent loop stop requested');

      this.view?.webview.postMessage({ type: 'agentLoopStopped', conversationId });
      this.view?.webview.postMessage({
        type: 'streamChunk',
        conversationId,
        data: { content: '\n\n\u23f9 Stopped by user', thinking: '', toolCalls: [] },
        done: true,
      });
    } else {
      this.logger.warn('No active agent loop to stop');
    }
  }

  async execute(
    agentLoop: any,
    conversationId: string,
    messages: any[],
    tools: any[],
    model: string,
    autonomyLevel: string
  ): Promise<void> {
    this.currentAgentLoop = agentLoop;

    this.view?.webview.postMessage({
      type: 'agentLoopStarted',
      conversationId,
    });

    try {
      await agentLoop.execute(
        messages,
        (update: AgentLoopUpdate) => this.handleUpdate(update, conversationId),
        tools,
        model,
        { autonomyLevel }
      );
    } finally {
      this.currentAgentLoop = undefined;
      this.logger.info('Agent loop instance cleared');
    }
  }

  private handleUpdate(update: AgentLoopUpdate, conversationId: string): void {
    switch (update.type) {
      case 'chunk':
        this.view?.webview.postMessage({
          type: 'streamChunk',
          conversationId,
          data: {
            content: update.content || '',
            thinking: update.thinking || '',
            toolCalls: update.toolCalls || [],
            tokenUsage: update.tokenUsage,
          },
          done: update.done || false,
        });
        if (update.tokenUsage) {
          this.logger.info(
            `\ud83c\udf10\ud83c\udf10\ud83c\udf10 POSTING TOKEN USAGE TO WEBVIEW: ${JSON.stringify(update.tokenUsage)}`
          );
        }
        break;

      case 'terminalOutput':
        this.handleTerminalOutput(update, conversationId);
        break;

      case 'toolStart':
        this.handleToolStart(update, conversationId);
        break;

      case 'toolComplete':
        this.handleToolComplete(update, conversationId);
        break;

      case 'toolError':
        this.handleToolError(update, conversationId);
        break;

      case 'complete':
        this.logger.info('Agent loop complete');
        this.view?.webview.postMessage({
          type: 'streamChunk',
          conversationId,
          data: { content: '', thinking: '', toolCalls: [] },
          done: true,
        });
        this.view?.webview.postMessage({ type: 'agentLoopStopped', conversationId });
        break;

      case 'maxIterations':
        this.logger.warn('Agent loop reached max iterations');
        this.view?.webview.postMessage({
          type: 'maxIterationsWarning',
          conversationId,
          data: {
            message: update.message,
            context: update.context,
          },
        });
        break;
    }
  }

  private handleTerminalOutput(update: AgentLoopUpdate, conversationId: string): void {
    this.logger.info('Sending terminal output to webview');
    if (!update.terminalData) return;

    const { command, stdout, stderr, exitCode } = update.terminalData;
    const output = stdout + stderr;

    const isTestCommand =
      command.includes('test') ||
      command.includes('jest') ||
      command.includes('vitest') ||
      command.includes('mocha') ||
      command.includes('pytest');

    if (isTestCommand) {
      this.logger.info('Detected test command, attempting to parse results');
      const testResults = TestResultsParser.parse(output, exitCode);
      if (testResults) {
        this.logger.info(
          `Parsed test results: ${testResults.totalPassed} passed, ${testResults.totalFailed} failed`
        );
        this.view?.webview.postMessage({
          type: 'showTestResults',
          conversationId,
          data: { testResults, rawOutput: output },
        });
        return;
      }
    }

    this.view?.webview.postMessage({
      type: 'showTerminal',
      conversationId,
      data: {
        command,
        output,
        exitCode,
        timestamp: Date.now(),
      },
    });
  }

  private handleToolStart(update: AgentLoopUpdate, conversationId: string): void {
    this.logger.info(`Tool started: ${update.toolCall?.function.name}`);
    if (update.toolCall && update.toolExecutionId) {
      this.view?.webview.postMessage({
        type: 'toolExecutionStart',
        conversationId,
        data: {
          messageId: update.toolExecutionId,
          toolName: getToolDisplayName(update.toolCall.function.name),
          target: getToolTarget(update.toolCall),
          arguments: update.toolCall.function.arguments,
        },
      });
    }
  }

  private handleToolComplete(update: AgentLoopUpdate, conversationId: string): void {
    this.logger.info(`Tool completed: ${update.toolCall?.function.name}`);
    if (update.toolCall && update.toolExecutionId) {
      this.view?.webview.postMessage({
        type: 'toolExecutionComplete',
        conversationId,
        data: {
          messageId: update.toolExecutionId,
          toolName: getToolDisplayName(update.toolCall.function.name),
          target: getToolTarget(update.toolCall),
          duration: update.duration,
          result: update.result,
          arguments: update.toolCall.function.arguments,
        },
      });
    }

    if (update.toolCall?.function.name === 'forgeai_readFile' && update.result) {
      this.logger.info('File read completed, sending to preview panel');
      const args =
        typeof update.toolCall.function.arguments === 'string'
          ? JSON.parse(update.toolCall.function.arguments)
          : update.toolCall.function.arguments;
      const filePath = args?.path || args?.file || args?.filePath || '';
      // Skip spec files — they clutter the preview panel
      if (
        filePath.includes('.forgeai/specs/') ||
        /\/(requirements|design|tasks|bugfix)\.md$/.test(filePath)
      ) {
        this.logger.info(`Skipping spec file preview: ${filePath}`);
      } else {
        const fileContent =
          typeof update.result === 'string'
            ? update.result
            : update.result?.content || JSON.stringify(update.result);
        this.view?.webview.postMessage({
          type: 'showFile',
          conversationId,
          data: { filePath, content: fileContent },
        });
      }
    }

    if (update.toolCall?.function.name === 'forgeai_generateDiff' && update.result) {
      this.logger.info('Diff generated, sending to preview panel');
      this.view?.webview.postMessage({
        type: 'showDiff',
        conversationId,
        data: {
          diff: typeof update.result === 'string' ? update.result : JSON.stringify(update.result),
          filePath: update.toolCall.function.arguments?.path || 'changes.diff',
        },
      });
    }
  }

  private handleToolError(update: AgentLoopUpdate, conversationId: string): void {
    this.logger.error(`Tool error: ${update.toolCall?.function.name}`);
    if (update.toolCall && update.toolExecutionId) {
      this.view?.webview.postMessage({
        type: 'toolExecutionError',
        conversationId,
        data: {
          messageId: update.toolExecutionId,
          toolName: getToolDisplayName(update.toolCall.function.name),
          target: getToolTarget(update.toolCall),
          duration: update.duration,
          error: update.error,
          arguments: update.toolCall.function.arguments,
        },
      });
    }
  }
}
