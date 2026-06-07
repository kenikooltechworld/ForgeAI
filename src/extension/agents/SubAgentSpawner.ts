/**
 * SubAgentSpawner
 *
 * Creates fresh, isolated agent instances for each specialist assignment.
 * Each spawn gets:
 *  - its own AgentLoop (fresh context window)
 *  - its own ToolRegistry (only the tools that agent is allowed to use)
 *  - the agent's specialized system prompt from AgentRegistry
 *
 * The sub-agent runs to completion and returns only a compressed summary
 * to the calling (parent) agent. The full sub-agent context is discarded.
 *
 * This is the Claude Code pattern: context isolation through fresh LLM sessions.
 */

import { AgentLoop } from '../ollama/AgentLoop';
import { ToolRegistry } from '../tools/ToolRegistry';
import type { Tool } from '../tools/ToolRegistry';
import type { AgentDefinition, SpawnAgentArgs, AgentExecutionResult } from './AgentRegistry';
import * as path from 'path';
import * as fs from 'fs';

let spawnerInstance: SubAgentSpawner | null = null;
let lastSpawnerError: string | null = null;

export function initSubAgentSpawner(
  ollamaClient: any,
  toolRegistry: ToolRegistry,
  logger: any,
  ragService?: any
): void {
  spawnerInstance = new SubAgentSpawner(ollamaClient, toolRegistry, logger, ragService);
}

export function getSubAgentSpawner(): SubAgentSpawner | null {
  return spawnerInstance;
}

export class SubAgentSpawner {
  private static readonly SESSION_STORE = path.join(process.env.APPDATA || '', 'ForgeAI', 'agents');
  private static activeSessions: Map<string, { agentName: string; startedAt: number }> = new Map();

  constructor(
    private readonly ollamaClient: OllamaClient,
    private readonly toolRegistry: ToolRegistry,
    private readonly logger: Logger,
    private readonly ragService?: RagService,
  ) {}

  /**
   * Spawn a specialized sub-agent by type.
   *
   * This creates a BRAND NEW AgentLoop instance with:
   * - A fresh ToolRegistry containing only the agent's allowed tools
   * - The agent's specialized system prompt
   * - Clean message history (only: system prompt + user task)
   *
   * When the agent finishes, its full context is discarded. Only the
   * summary is returned to the parent.
   */
  public async spawnAgent(args: SpawnAgentArgs,ParentContext?: { userMessage?: string; workspaceRoot?: string }): Promise<AgentExecutionResult> {
    const definition = getAgentDefinition(args.type);
    if (!definition) {
      return {
        success: false,
        agentType: args.type,
        agentName: args.type,
        summary: '',
        durationMs: 0,
        error: `Unknown agent type: ${args.type}. Available: ${Object.keys(definition ? {} : { researcher: 1, spec: 1, requirements: 1, design: 1, tasks: 1, browserMirror: 1, code: 1, review: 1 })}`,
      };
    }

    const startTime = Date.now();
    const agentId = `${args.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      // Build a tool registry containing ONLY the tools this agent is allowed to use
      const agentToolRegistry = this.buildScopedToolRegistry(definition.allowedTools);

      // Build messages: system prompt + user task (with optional details and context files)
      const userPrompt = this.buildUserPrompt(args, ParentContext);

      const messages = [
        { role: 'system', content: definition.systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      // Create a FRESH AgentLoop — isolated context
      const agentLoop = new AgentLoop(
        this.ollamaClient,
        this.logger,
        agentToolRegistry,
        this.ragService
        // Note: no conversationMemory, no sessionContextInjector — sub-agents are stateless
      );

      // Track active session
      SubAgentSpawner.activeSessions.set(agentId, {
        agentName: definition.name,
        startedAt: startTime,
      });

      this.logger.info(`[SubAgentSpawner] Spawning ${definition.name} (${agentId}) task: ${args.task.slice(0, 80)}`);

      let fullOutput = '';
      let toolCallsMade = 0;

      try {
        // Run the agent loop
        await agentLoop.execute(messages, (update) => {
          if (update.type === 'toolStart' && update.toolCall) {
            toolCallsMade++;
          }
          if (update.type === 'complete' && update.content) {
            fullOutput = update.content;
          }
        }, [], definition.defaultModel);
      } finally {
        SubAgentSpawner.activeSessions.delete(agentId);
      }

      const durationMs = Date.now() - startTime;

      // Compress the output into a summary for the parent agent
      const summary = this.compressOutput(fullOutput, definition, args);

      this.logger.info(`[SubAgentSpawner] ${definition.name} completed in ${durationMs}ms (${toolCallsMade} tool calls)`);

      return {
        success: true,
        agentType: args.type,
        agentName: definition.name,
        summary,
        outputPath: this.detectOutputPath(args, fullOutput),
        artifacts: this.extractArtifacts(args, fullOutput),
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[SubAgentSpawner] ${definition.name} failed:`, error);

      return {
        success: false,
        agentType: args.type,
        agentName: definition.name,
        summary: `Agent failed after ${durationMs}ms.`,
        durationMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Build a new ToolRegistry containing only the tools this agent is allowed to use.
   * Uses the PARENT toolRegistry as the source (so we don't duplicate implementations),
   * but only exposes the tools named in the agent's allowedTools list.
   */
  private buildScopedToolRegistry(allowedTools: string[]): ToolRegistry {
    const scoped = new ToolRegistry(this.logger);

    for (const toolName of allowedTools) {
      const toolDef = this.toolRegistry.getToolDefinition(toolName);
      if (toolDef) {
        scoped.registerTool(toolDef);
      } else {
        this.logger.warn(`[SubAgentSpawner] Tool "${toolName}" not found in parent registry — skipping for sub-agent`);
      }
    }

    return scoped;
  }

  /**
   * Build the user prompt for the sub-agent by combining:
   * - The task (required)
   * - Details (optional, more context)
   * - Context file contents (optional, read from disk)
   * - Research output path hint (for spec-related agents)
   */
  private buildUserPrompt(args: SpawnAgentArgs, parentContext?: { userMessage?: string; workspaceRoot?: string }): string {
    const parts: string[] = [];

    if (parentContext?.userMessage) {
      parts.push(`## From Master Orchestrator\n${parentContext.userMessage}`);
    }

    parts.push(`## Your Task\n${args.task}`);

    if (args.details) {
      parts.push(`## Additional Context\n${args.details}`);
    }

    if (args.contextFiles && args.contextFiles.length > 0 && parentContext?.workspaceRoot) {
      parts.push('## Context Files');
      for (const file of args.contextFiles) {
        const filePath = path.join(parentContext.workspaceRoot, file);
        if (fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            parts.push(`\n### ${file}\n\`\`\`\n${content.slice(0, 10000)}\n\`\`\``);
          } catch {
            parts.push(`\n### ${file}\n[Could not read file]`);
          }
        } else {
          parts.push(`\n### ${file}\n[File not found]`);
        }
      }
    }

    if (args.constraints && args.constraints.length > 0) {
      parts.push(`## Constraints\n${args.constraints.map(c => `- ${c}`).join('\n')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Compress the full agent output into a summary suitable for the parent agent.
   * Target: 200-400 tokens. Preserves key findings, file paths, and verdicts.
   */
  private compressOutput(output: string, definition: AgentDefinition, args: SpawnAgentArgs): string {
    const maxChars = definition.maxContextTokens * 2; // rough: 1 token ≈ 2 chars for English

    if (output.length <= maxChars) {
      return output.trim();
    }

    // For longer outputs, extract the essential parts
    const lines = output.split('\n').filter((l) => l.trim());
    const essential: string[] = [];

    // Always include the first few lines (usually the summary/verdict)
    essential.push(...lines.slice(0, 10));

    // Include lines that look like file paths
    const pathRegex = /(?:\.\/|\.forgeai\/|\.kiro\/|[A-Za-z]:[\\/][^\s]+)/g;
    const paths = output.match(pathRegex) || [];
    if (paths.length > 0) {
      essential.push('\n## Files', ...paths.slice(0, 20));
    }

    // Include bullet points (likely key findings)
    const bullets = lines.filter((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '));
    essential.push(...bullets.slice(0, 30));

    // Include headings (section markers)
    const headings = lines.filter((l) => l.trim().startsWith('#'));
    essential.push(...headings.slice(0, 15));

    const compressed = essential.join('\n').trim();

    if (compressed.length > maxChars) {
      return compressed.slice(0, maxChars) + '\n...[truncated — full output saved to file]';
    }

    return compressed;
  }

  /**
   * Detect if the agent produced a file output path (for artifacts)
   */
  private detectOutputPath(args: SpawnAgentArgs, output: string): string | undefined {
    // Check if the agent mentioned a file path in its output
    const pathRegex = /(?:\.\/)?(?:\.forgeai|\.kiro|docs|src)[^\s"'<>]*\.(md|json|ts|js|tsx|jsx)/g;
    const matches = output.match(pathRegex);
    if (matches && matches.length > 0) {
      return matches[0].replace(/^\.\//, '');
    }
    return undefined;
  }

  /**
   * Extract any artifacts (file paths, URLs) from the agent output
   */
  private extractArtifacts(args: SpawnAgentArgs, output: string): Record<string, string> {
    const artifacts: Record<string, string> = {};
    const pathRegex = /(?:\.\/)?(?:\.forgeai|\.kiro|docs|src)[^\s"'<>]*\.(md|json|ts|js|tsx|jsx)/g;
    const matches = output.match(pathRegex) || [];
    matches.forEach((m, i) => {
      artifacts[`file_${i + 1}`] = m.replace(/^\.\//, '');
    });
    return artifacts;
  }

  /**
   * Create the forgeai_spawnAgent tool definition for the master AI.
   * Registered globally on the main ToolRegistry so the master AI can call it.
   */
  public static createSpawnAgentTool(): any {
    return {
      name: 'forgeai_spawnAgent',
      description:
        'Delegate a task to a specialized sub-agent. The sub-agent runs in its own isolated context — ' +
        'it has its own conversation history, its own tool access, and returns only a compressed summary. ' +
        'Use this for ANY specialized work: research, spec writing, code implementation, review, browser QA. ' +
        'The master AI should NEVER do these tasks directly — always delegate.\n\n' +
        listAgentDescriptions(),
      inputSchema: {
        type: 'object',
        required: ['type', 'task'],
        properties: {
          type: {
            type: 'string',
            description:
              'The agent type to spawn. Choose the right specialist:\n' +
              '- "researcher": web research, official docs, API lookups, browser navigation\n' +
              '- "spec": full spec creation (internally spawns requirements/design/tasks)\n' +
              '- "requirements": just the requirements.md section\n' +
              '- "design": just the design.md section\n' +
              '- "tasks": just the tasks.md section\n' +
              '- "browserMirror": screenshots and visual QA\n' +
              '- "code": implementation and code changes\n' +
              '- "review": code review against requirements/design',
          },
          task: {
            type: 'string',
            description: 'The concrete task for the agent. Be specific: what you want, why, what format you need back.',
          },
          details: {
            type: 'string',
            description: 'Optional extra context the agent needs (requirements, constraints, expected output format).',
          },
          contextFiles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of workspace-relative file paths the agent should read before starting.',
          },
          constraints: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of rules the agent must follow.',
          },
        },
      },
      execute: async (args: any) => {
        const spawner = getSubAgentSpawner();
        if (!spawner) {
          return {
            success: false,
            summary: 'Sub-agent spawner is not initialized.',
            error: 'SubAgentSpawner not initialized — call initSubAgentSpawner first',
          };
        }
        return await spawner.spawnAgent(args);
      },
    };
  }
}

function listAgentDescriptions(): string {
  const agents = [
    { type: 'researcher', desc: 'Web research + official doc navigation with Playwright' },
    { type: 'spec', desc: 'Full spec creation (spawns requirements/design/tasks internally)' },
    { type: 'requirements', desc: 'requirements.md section only' },
    { type: 'design', desc: 'design.md section only' },
    { type: 'tasks', desc: 'tasks.md section only' },
    { type: 'browserMirror', desc: 'Browser screenshots and visual QA' },
    { type: 'code', desc: 'Implementation and code changes' },
    { type: 'review', desc: 'Code review against requirements/design' },
  ];
  return agents.map((a) => '  - ' + a.type + ': ' + a.desc).join('\n');
}
