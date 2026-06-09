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
 *
 * CRITICAL FIX: Sub-agent streaming updates are NOW forwarded to WebviewManager
 * so users see real-time feedback from spawned agents.
 */

import { AgentLoop, type AgentLoopUpdate } from '../ollama/AgentLoop';
import type { OllamaClient, OllamaMessage } from '../ollama/OllamaClient';
import { ToolRegistry } from '../tools/ToolRegistry';
import type { Tool } from '../tools/ToolRegistry';
import { Logger } from '../utils/Logger';
import type { RagService } from '../rag/RagService';
import {
  getAgentDefinition,
  type AgentDefinition,
  type SpawnAgentArgs,
  type AgentExecutionResult,
} from './AgentRegistry';
import { getConfiguredModel } from '../config/ModelConfig';
import { WebSearchTools } from '../tools/WebSearchTools';
import { BrowserTools } from '../tools/BrowserTools';
import * as path from 'path';
import * as fs from 'fs';

let spawnerInstance: SubAgentSpawner | null = null;
let lastSpawnerError: string | null = null;
let streamingCallbacks: Map<string, (update: AgentLoopUpdate) => void> = new Map();

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

/**
 * Register a streaming callback for a spawned agent.
 * This is called by ToolRegistry when forgeai_spawnAgent is invoked,
 * passing the parent agent's onUpdate callback so sub-agent updates reach the UI.
 */
export function registerStreamingCallback(
  agentId: string,
  callback: (update: AgentLoopUpdate) => void
): void {
  streamingCallbacks.set(agentId, callback);
}

/**
 * Get and remove the streaming callback for a spawned agent.
 */
export function getStreamingCallback(
  agentId: string
): ((update: AgentLoopUpdate) => void) | undefined {
  const callback = streamingCallbacks.get(agentId);
  if (callback) {
    streamingCallbacks.delete(agentId);
  }
  return callback;
}

export class SubAgentSpawner {
  private static readonly SESSION_STORE = path.join(process.env.APPDATA || '', 'ForgeAI', 'agents');
  private static activeSessions: Map<string, { agentName: string; startedAt: number }> = new Map();
  private static readonly webSearchTools = new WebSearchTools();
  private static readonly browserTools = new BrowserTools();

  constructor(
    private readonly ollamaClient: OllamaClient,
    private readonly toolRegistry: ToolRegistry,
    private readonly logger: Logger,
    private readonly ragService?: RagService
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
  public async spawnAgent(
    args: SpawnAgentArgs,
    ParentContext?: { userMessage?: string; workspaceRoot?: string }
  ): Promise<AgentExecutionResult> {
    const agentType = args.type?.trim();
    if (!agentType) {
      return {
        success: false,
        agentType: args.type || 'unknown',
        agentName: 'unknown',
        summary: '',
        durationMs: 0,
        error:
          'forgeai_spawnAgent requires a "type" field. Available types: researcher, spec, requirements, design, tasks, browserMirror, code, review.',
      };
    }

    const definition = getAgentDefinition(agentType);
    if (!definition) {
      return {
        success: false,
        agentType: agentType,
        agentName: agentType,
        summary: '',
        durationMs: 0,
        error: `Unknown agent type: "${agentType}". Available: researcher, spec, requirements, design, tasks, browserMirror, code, review`,
      };
    }

    const startTime = Date.now();
    const agentId = `${args.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      // Build a tool registry containing ONLY the tools this agent is allowed to use
      const agentToolRegistry = this.buildScopedToolRegistry(definition.allowedTools);

      // Build messages: system prompt + user task (with optional details and context files)
      const userPrompt = this.buildUserPrompt(args, ParentContext);

      const messages: OllamaMessage[] = [
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

      let fullOutput = '';
      let toolCallsMade = 0;

      // Get the streaming callback from the parent agent (if registered)
      // This allows sub-agent updates to be forwarded to the WebviewManager
      const parentStreamingCallback = getStreamingCallback(agentId);

      try {
        // Run the agent loop - NOW WITH FULL STREAMING SUPPORT
        await agentLoop.execute(
          messages,
          (update: AgentLoopUpdate) => {
            // Forward ALL updates to parent agent (if callback is registered)
            // This enables real-time UI feedback for sub-agent execution
            if (parentStreamingCallback) {
              // Create a modified update with agent type prefix for clarity
              const forwardedUpdate = { ...update };
              if (forwardedUpdate.toolCall) {
                forwardedUpdate.toolCall = { ...forwardedUpdate.toolCall };
                forwardedUpdate.toolCall.function = {
                  ...forwardedUpdate.toolCall.function,
                  name: `[${agentType}] ${forwardedUpdate.toolCall.function.name}`,
                };
              }
              parentStreamingCallback(forwardedUpdate);
            }

            // Track completion and tool calls for result summary
            if (update.type === 'toolStart' && update.toolCall) {
              toolCallsMade++;
            }
            if (update.type === 'complete' && update.content) {
              fullOutput = update.content;
            }
          },
          agentToolRegistry.getToolDefinitions(),
          getConfiguredModel()
        );
      } finally {
        SubAgentSpawner.activeSessions.delete(agentId);
      }

      const durationMs = Date.now() - startTime;

      // Compress the output into a summary for the parent agent
      const summary = this.compressOutput(fullOutput, definition, args);

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
        error: `${errorMessage}. Do NOT call forgeai_webResearch or forgeai_webSearch directly — the main AI does not have those tools. Re-spawn this agent or escalate to user.`,
      };
    }
  }

  /**
   * Build a new ToolRegistry containing only the tools this agent is allowed to use.
   * Uses the PARENT toolRegistry as the source (so we don't duplicate implementations),
   * but only exposes the tools named in the agent's allowedTools list.
   */
  private buildScopedToolRegistry(allowedTools: string[]): ToolRegistry {
    const scoped = ToolRegistry.createSubRegistry(this.logger);

    for (const toolName of allowedTools) {
      let toolDef = this.toolRegistry.getToolDefinition(toolName);

      if (!toolDef) {
        toolDef = SubAgentSpawner.lookupExtraTool(toolName);
      }

      if (toolDef) {
        scoped.registerTool(toolDef);
      } else {
        this.logger.warn(`[SubAgentSpawner] Tool "${toolName}" not found — skipping for sub-agent`);
      }
    }

    return scoped;
  }

  private static readonly EXTRA_TOOL_METHODS: Record<string, () => Tool> = {
    forgeai_webSearch: () => SubAgentSpawner.webSearchTools.webSearch(),
    forgeai_webResearch: () => SubAgentSpawner.webSearchTools.webResearch(),
    forgeai_searchDocs: () => SubAgentSpawner.webSearchTools.searchDocs(),
    forgeai_fetchPage: () => SubAgentSpawner.webSearchTools.fetchPage(),
    forgeai_browserNavigate: () => SubAgentSpawner.browserTools.browserNavigate(),
    forgeai_browserExtract: () => SubAgentSpawner.browserTools.browserExtract(),
    forgeai_browserClick: () => SubAgentSpawner.browserTools.browserClick(),
    forgeai_browserScreenshot: () => SubAgentSpawner.browserTools.browserScreenshot(),
    forgeai_browserFill: () => SubAgentSpawner.browserTools.browserFill(),
    forgeai_browserScroll: () => SubAgentSpawner.browserTools.browserScroll(),
    forgeai_browserClose: () => SubAgentSpawner.browserTools.browserClose(),
  };

  private static lookupExtraTool(toolName: string): Tool | undefined {
    const factory = SubAgentSpawner.EXTRA_TOOL_METHODS[toolName];
    if (factory) return factory();
    return undefined;
  }

  /**
   * Build the user prompt for the sub-agent by combining:
   * - The task (required)
   * - Details (optional, more context)
   * - Context file contents (optional, read from disk)
   * - Research output path hint (for spec-related agents)
   */
  private buildUserPrompt(
    args: SpawnAgentArgs,
    parentContext?: { userMessage?: string; workspaceRoot?: string }
  ): string {
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
      parts.push(`## Constraints\n${args.constraints.map((c) => `- ${c}`).join('\n')}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Compress the full agent output into a summary suitable for the parent agent.
   * Target: 200-400 tokens. Preserves key findings, file paths, and verdicts.
   */
  private compressOutput(
    output: string,
    definition: AgentDefinition,
    args: SpawnAgentArgs
  ): string {
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
            description:
              'The concrete task for the agent. Be specific: what you want, why, what format you need back.',
          },
          details: {
            type: 'string',
            description:
              'Optional extra context the agent needs (requirements, constraints, expected output format).',
          },
          contextFiles: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional list of workspace-relative file paths the agent should read before starting.',
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
