/**
 * Orchestrator Agent
 * Breaks down tasks and delegates to specialized subagents
 * Manages context by keeping only results, not intermediate work
 */

import { Logger } from '../utils/Logger';
import { OllamaClient, OllamaMessage } from '../ollama/OllamaClient';
import { ExplorerAgent } from './ExplorerAgent';
import { ImplementerAgent } from './ImplementerAgent';
import { ReviewerAgent } from './ReviewerAgent';

export interface TaskBreakdown {
  mainTask: string;
  explorerTasks: string[];
  implementerTasks: string[];
  reviewerTasks: string[];
}

export interface AgentResult {
  agentType: 'explorer' | 'implementer' | 'reviewer';
  taskId: string;
  result: string;
  status: 'success' | 'failed';
  error?: string;
}

export class OrchestratorAgent {
  private explorer: ExplorerAgent;
  private implementer: ImplementerAgent;
  private reviewer: ReviewerAgent;
  private results: AgentResult[] = [];

  constructor(
    private readonly logger: Logger,
    private readonly ollamaClient: OllamaClient
  ) {
    this.explorer = new ExplorerAgent(logger, ollamaClient);
    this.implementer = new ImplementerAgent(logger, ollamaClient);
    this.reviewer = new ReviewerAgent(logger, ollamaClient);
  }

  /**
   * Execute a task by breaking it down and delegating to subagents
   */
  public async executeTask(
    userTask: string,
    onProgress: (update: { stage: string; message: string }) => void
  ): Promise<string> {
    try {
      // Stage 1: Break down task
      onProgress({ stage: 'planning', message: 'Breaking down task into subtasks...' });
      const breakdown = await this.breakdownTask(userTask);

      // Stage 2: Exploration (fast, parallel)
      if (breakdown.explorerTasks.length > 0) {
        onProgress({ stage: 'exploration', message: 'Exploring codebase...' });
        await this.runExplorerTasks(breakdown.explorerTasks);
      }

      // Stage 3: Implementation (sequential, full context)
      if (breakdown.implementerTasks.length > 0) {
        onProgress({ stage: 'implementation', message: 'Implementing changes...' });
        await this.runImplementerTasks(breakdown.implementerTasks);
      }

      // Stage 4: Review (validation)
      if (breakdown.reviewerTasks.length > 0) {
        onProgress({ stage: 'review', message: 'Reviewing and testing...' });
        await this.runReviewerTasks(breakdown.reviewerTasks);
      }

      // Stage 5: Synthesize results
      onProgress({ stage: 'synthesis', message: 'Synthesizing results...' });
      const finalResult = await this.synthesizeResults();

      return finalResult;
    } catch (error) {
      this.logger.error('Orchestrator task execution failed', error);
      throw error;
    }
  }

  /**
   * Break down task into subtasks for each agent type
   */
  private async breakdownTask(userTask: string): Promise<TaskBreakdown> {
    const systemPrompt = `You are a task breakdown specialist. Analyze the user's task and break it down into:
1. Explorer tasks: File discovery, codebase analysis, understanding structure
2. Implementer tasks: Code changes, modifications, implementations
3. Reviewer tasks: Testing, validation, error checking

Return JSON with this structure:
{
  "mainTask": "summary of main task",
  "explorerTasks": ["task1", "task2"],
  "implementerTasks": ["task1", "task2"],
  "reviewerTasks": ["task1", "task2"]
}`;

    const response = await this.ollamaClient.chat({
      model: 'gemma4:31b-cloud',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userTask },
      ],
      stream: false,
    });

    const chatResponse = response as { message: { content: string } };
    const content = chatResponse.message.content;

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse task breakdown');
    }

    return JSON.parse(jsonMatch[0]) as TaskBreakdown;
  }

  /**
   * Run explorer tasks (fast, parallel)
   */
  private async runExplorerTasks(tasks: string[]): Promise<void> {

    const promises = tasks.map((task, index) =>
      this.explorer.execute(task).then((result) => {
        this.results.push({
          agentType: 'explorer',
          taskId: `explorer-${index}`,
          result,
          status: 'success',
        });
      })
    );

    await Promise.all(promises);
  }

  /**
   * Run implementer tasks (sequential, full context)
   */
  private async runImplementerTasks(tasks: string[]): Promise<void> {

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const explorerContext = this.results
        .filter((r) => r.agentType === 'explorer')
        .map((r) => r.result)
        .join('\n');

      const result = await this.implementer.execute(task, explorerContext);
      this.results.push({
        agentType: 'implementer',
        taskId: `implementer-${i}`,
        result,
        status: 'success',
      });
    }
  }

  /**
   * Run reviewer tasks (validation)
   */
  private async runReviewerTasks(tasks: string[]): Promise<void> {

    const implementerResults = this.results
      .filter((r) => r.agentType === 'implementer')
      .map((r) => r.result)
      .join('\n');

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const result = await this.reviewer.execute(task, implementerResults);
      this.results.push({
        agentType: 'reviewer',
        taskId: `reviewer-${i}`,
        result,
        status: 'success',
      });
    }
  }

  /**
   * Synthesize results from all agents
   */
  private async synthesizeResults(): Promise<string> {
    const resultsSummary = this.results
      .map((r) => `[${r.agentType.toUpperCase()}] ${r.result}`)
      .join('\n\n');

    const systemPrompt = `You are a synthesis specialist. Combine the results from multiple agents into a coherent final response.
Focus on:
1. What was accomplished
2. What changes were made
3. Any issues or blockers
4. Next steps if needed`;

    const response = await this.ollamaClient.chat({
      model: 'gemma4:31b-cloud',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Synthesize these agent results:\n\n${resultsSummary}` },
      ],
      stream: false,
    });

    const chatResponse = response as { message: { content: string } };
    return chatResponse.message.content;
  }

  /**
   * Get all results from this execution
   */
  public getResults(): AgentResult[] {
    return this.results;
  }

  /**
   * Clear results for next task
   */
  public clearResults(): void {
    this.results = [];
  }
}
