/**
 * ToolCatalog — single source of truth for every tool the AI can call.
 *
 * Each entry describes:
 *  - name: exact tool name the LLM uses in function calls
 *  - category: grouping for prompt sections (spec, file, terminal, git, web, browser, uiux, research)
 *  - description: one-line what it does
 *  - whenToUse: concrete trigger conditions so the AI knows when to reach for it
 *  - howToUse: brief calling convention / args shape
 *  - availableTo: which agents should have this in their prompt / tool list
 */

export interface ToolEntry {
  name: string;
  category: 'spec' | 'file' | 'terminal' | 'git' | 'web' | 'browser' | 'uiux' | 'research';
  description: string;
  whenToUse: string;
  howToUse: string;
  availableTo: string[];
}

export const TOOL_CATALOG: ToolEntry[] = [
  {
    name: 'forgeai_createSpec',
    category: 'spec',
    description: 'Create a new ForgeAI spec directory with requirements.md, design.md, tasks.md scaffolding.',
    whenToUse:
      'User asks for a new spec, feature plan, or requirements document AND no suitable existing spec exists. ' +
      'ALWAYS call forgeai_listSpecs first to check for duplicates. Only create after research is done and user confirms.',
    howToUse: 'args: { title: string, workflow?: "requirements-first"|"design-first"|"quick-plan"|"bugfix", description?: string }',
    availableTo: ['RequirementsAgent', 'DesignAgent', 'TasksAgent', 'BugfixAgent', 'SpecOrchestrator'],
  },
  {
    name: 'forgeai_writeSpecArtifact',
    category: 'spec',
    description: 'Write markdown content to a spec artifact file (requirements.md, design.md, tasks.md, bugfix.md).',
    whenToUse:
      'After generating a complete section or document. Write each phase separately so the user can review before continuing.',
    howToUse: 'args: { specId: string, type: "requirements"|"design"|"tasks"|"bugfix", content: string }',
    availableTo: ['RequirementsAgent', 'DesignAgent', 'TasksAgent', 'BugfixAgent', 'SpecOrchestrator'],
  },
  {
    name: 'forgeai_readSpec',
    category: 'spec',
    description: 'Read an existing spec — config plus all artifacts (truncated per-field to 3000 chars).',
    whenToUse:
      'Before continuing or modifying a spec. Use to inspect current content, prior decisions, or related requirements.',
    howToUse: 'args: { specId: string }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'SpecOrchestrator',
      'PlannerAgent',
    ],
  },
  {
    name: 'forgeai_listSpecs',
    category: 'spec',
    description: 'List all specs with IDs, titles, statuses, phases completed, and workflow type.',
    whenToUse: 'Before creating a new spec (to avoid duplicates). Also useful to discover related specs for context.',
    howToUse: 'args: {} (no parameters required)',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'SpecOrchestrator',
      'PlannerAgent',
    ],
  },
  {
    name: 'forgeai_continueSpec',
    category: 'spec',
    description: 'Generate the next missing spec phase (requirements → design → tasks) via AI.',
    whenToUse: 'User explicitly asks to continue, advance, or complete the next phase of an existing spec.',
    howToUse: 'args: { specId: string }',
    availableTo: ['SpecOrchestrator'],
  },
  {
    name: 'forgeai_checkDrift',
    category: 'spec',
    description: 'Run drift detection — check if acceptance criteria in requirements.md are actually implemented.',
    whenToUse: 'After tasks are executed, to verify implementation coverage. Also useful during design to spot gaps.',
    howToUse: 'args: { specId: string }',
    availableTo: ['DesignAgent', 'TasksAgent', 'BugfixAgent', 'SpecOrchestrator', 'CriticAgent'],
  },
  {
    name: 'forgeai_deleteSpec',
    category: 'spec',
    description: 'Delete a spec and all artifacts. Requires explicit user confirmation.',
    whenToUse: 'User asks to delete or discard a spec. Never call without confirmation.',
    howToUse: 'args: { specId: string }',
    availableTo: ['SpecOrchestrator'],
  },
  {
    name: 'forgeai_startTask',
    category: 'spec',
    description: 'Execute a single task from a spec via the AgentLoop / SpecTaskExecutor.',
    whenToUse: 'User asks to run or implement a specific task. Task must have dependencies met.',
    howToUse: 'args: { specId: string, taskId: string }',
    availableTo: ['TasksAgent', 'SpecOrchestrator'],
  },
  {
    name: 'forgeai_runAllTasks',
    category: 'spec',
    description: 'Execute all pending tasks in a spec that have their dependencies met.',
    whenToUse: 'User asks to implement the full spec or run all remaining tasks.',
    howToUse: 'args: { specId: string }',
    availableTo: ['TasksAgent', 'SpecOrchestrator'],
  },
  {
    name: 'forgeai_approveSpec',
    category: 'spec',
    description: 'Approve a pending phase (requirements/design/tasks) so the next phase can be generated.',
    whenToUse: 'User explicitly confirms satisfaction with the current phase and wants to proceed.',
    howToUse: 'args: { specId: string }',
    availableTo: ['SpecOrchestrator'],
  },

  {
    name: 'forgeai_readFile',
    category: 'file',
    description: 'Read a file from the workspace.',
    whenToUse: 'Need to inspect existing source, config, or spec files before deciding what to change.',
    howToUse: 'args: { path: string }',
    availableTo: ['RequirementsAgent', 'DesignAgent', 'TasksAgent', 'BugfixAgent', 'PlannerAgent', 'ExecutorAgent'],
  },
  {
    name: 'forgeai_writeFile',
    category: 'file',
    description: 'Write content to a file, creating it if needed.',
    whenToUse: 'You have complete file content ready to persist (tests, source files, configs).',
    howToUse: 'args: { path: string, content: string }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'PlannerAgent',
      'ExecutorAgent',
      'ImplementerAgent',
    ],
  },
  {
    name: 'forgeai_replaceText',
    category: 'file',
    description: 'Replace exact text within an existing file.',
    whenToUse: 'Targeted single-location edits where oldText + newText are both known exactly.',
    howToUse: 'args: { path: string, oldText: string, newText: string }',
    availableTo: ['TasksAgent', 'BugfixAgent', 'PlannerAgent', 'ExecutorAgent', 'ImplementerAgent'],
  },
  {
    name: 'forgeai_replaceRegex',
    category: 'file',
    description: 'Regex-based replacement inside a file.',
    whenToUse: 'Pattern-based edits where exact old text is not known but a regex match is.',
    howToUse: 'args: { path: string, pattern: string, replacement: string, flags?: string }',
    availableTo: ['TasksAgent', 'BugfixAgent', 'PlannerAgent', 'ExecutorAgent', 'ImplementerAgent'],
  },
  {
    name: 'forgeai_findFile',
    category: 'file',
    description: 'Find a file by exact or partial filename.',
    whenToUse: 'You know the filename but not its path. exactMatch=true for exact, false for partial.',
    howToUse: 'args: { filename: string, exactMatch?: boolean }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'PlannerAgent',
      'ExecutorAgent',
    ],
  },
  {
    name: 'forgeai_listFiles',
    category: 'file',
    description: 'Recursively list files matching a glob pattern.',
    whenToUse: 'Discover files by pattern — e.g. "**/*.test.ts" to find all test files.',
    howToUse: 'args: { pattern: string }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'PlannerAgent',
      'ExecutorAgent',
    ],
  },
  {
    name: 'forgeai_listDirectory',
    category: 'file',
    description: 'List the contents of a directory.',
    whenToUse: 'Explore a folder structure before reading or searching inside it.',
    howToUse: 'args: { path: string }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'PlannerAgent',
      'ExecutorAgent',
    ],
  },
  {
    name: 'forgeai_searchInFiles',
    category: 'file',
    description: 'Search file contents for a query string.',
    whenToUse: 'Find where a symbol, error message, or pattern is referenced.',
    howToUse: 'args: { query: string, filePattern?: string }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'PlannerAgent',
      'ExecutorAgent',
    ],
  },
  {
    name: 'forgeai_createDirectory',
    category: 'file',
    description: 'Create a directory including any missing parents.',
    whenToUse: 'Parent directory does not exist before writing a new file.',
    howToUse: 'args: { path: string }',
    availableTo: ['TasksAgent', 'BugfixAgent', 'PlannerAgent', 'ExecutorAgent', 'ImplementerAgent'],
  },
  {
    name: 'forgeai_deleteFile',
    category: 'file',
    description: 'Delete a file from the workspace.',
    whenToUse: 'Removing an obsolete or incorrect file.',
    howToUse: 'args: { path: string }',
    availableTo: ['TasksAgent', 'BugfixAgent', 'PlannerAgent', 'ExecutorAgent', 'ImplementerAgent'],
  },
  {
    name: 'forgeai_copyFile',
    category: 'file',
    description: 'Copy a file to a new path.',
    whenToUse: 'Duplicating a file as a scaffold or backup before edits.',
    howToUse: 'args: { source: string, destination: string }',
    availableTo: ['TasksAgent', 'BugfixAgent', 'PlannerAgent', 'ExecutorAgent', 'ImplementerAgent'],
  },
  {
    name: 'forgeai_renameFile',
    category: 'file',
    description: 'Rename or move a file.',
    whenToUse: 'Refactoring that requires renaming or relocating a file.',
    howToUse: 'args: { oldPath: string, newPath: string }',
    availableTo: ['TasksAgent', 'BugfixAgent', 'PlannerAgent', 'ExecutorAgent', 'ImplementerAgent'],
  },
  {
    name: 'forgeai_getFileStats',
    category: 'file',
    description: 'Get size and modification time for a path.',
    whenToUse: 'Verify a file exists and check staleness before reading.',
    howToUse: 'args: { path: string }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'PlannerAgent',
      'ExecutorAgent',
    ],
  },
  {
    name: 'forgeai_generateDiff',
    category: 'file',
    description: 'Generate a unified diff between two file versions or paths.',
    whenToUse: 'Summarizing changes before committing or presenting a review.',
    howToUse: 'args: { path?: string, original?: string, modified?: string }',
    availableTo: ['PlannerAgent', 'ExecutorAgent', 'CriticAgent', 'ImplementerAgent', 'ReviewerAgent'],
  },

  {
    name: 'forgeai_runCommand',
    category: 'terminal',
    description: 'Run a shell command and capture stdout/stderr/exitCode.',
    whenToUse: 'Build, test, lint, install, or any short-running command. For long-running servers use forgeai_createTerminal.',
    howToUse: 'args: { command: string, cwd?: string, timeout?: number }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'PlannerAgent',
      'ExecutorAgent',
      'ImplementerAgent',
      'ReviewerAgent',
    ],
  },
  {
    name: 'forgeai_createTerminal',
    category: 'terminal',
    description: 'Open a persistent terminal panel for long-running processes.',
    whenToUse: 'Dev servers, watchers, or any process that must stay alive across multiple commands.',
    howToUse: 'args: { command?: string, cwd?: string }',
    availableTo: ['PlannerAgent', 'ExecutorAgent', 'ImplementerAgent'],
  },

  {
    name: 'forgeai_gitStatus',
    category: 'git',
    description: 'Get git working tree status.',
    whenToUse: 'Before committing or when you need to know modified, staged, or untracked files.',
    howToUse: 'args: { cwd?: string }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'PlannerAgent',
      'ExecutorAgent',
      'ImplementerAgent',
      'ReviewerAgent',
    ],
  },
  {
    name: 'forgeai_gitCommit',
    category: 'git',
    description: 'Stage files and create a git commit.',
    whenToUse: 'After applying changes and tests pass. Never skip verification before committing.',
    howToUse: 'args: { message: string, files?: string[], cwd?: string }',
    availableTo: ['PlannerAgent', 'ExecutorAgent', 'ImplementerAgent', 'ReviewerAgent'],
  },
  {
    name: 'forgeai_gitPush',
    category: 'git',
    description: 'Push commits to the remote repository.',
    whenToUse: 'After a successful local commit, when the user wants to share changes.',
    howToUse: 'args: { remote?: string, branch?: string, cwd?: string }',
    availableTo: ['PlannerAgent', 'ExecutorAgent', 'ImplementerAgent', 'ReviewerAgent'],
  },
  {
    name: 'forgeai_gitPull',
    category: 'git',
    description: 'Pull latest changes from remote.',
    whenToUse: 'Before starting new work or when merge conflicts may exist.',
    howToUse: 'args: { remote?: string, branch?: string, cwd?: string }',
    availableTo: ['PlannerAgent', 'ExecutorAgent', 'ImplementerAgent', 'ReviewerAgent'],
  },
  {
    name: 'forgeai_gitCreateBranch',
    category: 'git',
    description: 'Create and switch to a new git branch.',
    whenToUse: 'Starting work on a feature or fix that should be isolated on its own branch.',
    howToUse: 'args: { name: string, cwd?: string }',
    availableTo: ['PlannerAgent', 'ExecutorAgent', 'ImplementerAgent', 'ReviewerAgent'],
  },

  {
    name: 'forgeai_webSearch',
    category: 'web',
    description: 'Quick web search for a query. Returns top results with titles, URLs, and snippets.',
    whenToUse: 'Need fast lookup for API names, error messages, library usage, or current best practices.',
    howToUse: 'args: { query: string, maxResults?: number }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'SpecOrchestrator',
      'ResearchAgent',
      'PlannerAgent',
      'ExecutorAgent',
    ],
  },
  {
    name: 'forgeai_webResearch',
    category: 'web',
    description: 'Deep web research on a topic. Returns structured findings with sources.',
    whenToUse: 'Need thorough investigation: framework comparisons, architecture patterns, security practices.',
    howToUse: 'args: { topic: string, maxResults?: number }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'SpecOrchestrator',
      'ResearchAgent',
      'PlannerAgent',
    ],
  },
  {
    name: 'forgeai_fetchPage',
    category: 'web',
    description: 'Fetch full HTML/text content of a URL.',
    whenToUse: 'MANDATORY after forgeai_webSearch or forgeai_webResearch — snippets are surface-level, you need the actual page content.',
    howToUse: 'args: { url: string }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'ResearchAgent',
      'PlannerAgent',
      'ExecutorAgent',
    ],
  },
  {
    name: 'forgeai_searchDocs',
    category: 'web',
    description: 'Search the internal documentation RAG index.',
    whenToUse: 'Looking for framework-specific docs already indexed in ForgeAI (React, Next.js, Tailwind, etc.).',
    howToUse: 'args: { query: string, collection?: string }',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'ResearchAgent',
      'PlannerAgent',
      'ExecutorAgent',
    ],
  },

  {
    name: 'forgeai_browserNavigate',
    category: 'browser',
    description: 'Navigate the Browser Mirror to a URL.',
    whenToUse: 'Need to load a page in the integrated browser before taking a screenshot or extracting semantics.',
    howToUse: 'args: { url: string }',
    availableTo: ['UIUXAgent', 'VisualQAAgent', 'DesignAgent', 'TasksAgent', 'BugfixAgent'],
  },
  {
    name: 'forgeai_browserExtract',
    category: 'browser',
    description: 'Extract semantic DOM data from the current Browser Mirror page.',
    whenToUse: 'Need accessibility tree, text content, or element roles for analysis or verification.',
    howToUse: 'args: {} (no parameters required)',
    availableTo: ['UIUXAgent', 'VisualQAAgent', 'DesignAgent', 'TasksAgent', 'BugfixAgent'],
  },
  {
    name: 'forgeai_browserScreenshot',
    category: 'browser',
    description: 'Capture a screenshot from the Browser Mirror.',
    whenToUse: 'Need a visual snapshot for Visual QA, layout verification, or accessibility review.',
    howToUse: 'args: { fullPage?: boolean }',
    availableTo: ['UIUXAgent', 'VisualQAAgent', 'DesignAgent', 'TasksAgent', 'BugfixAgent'],
  },

  {
    name: 'uiux_create_design_system',
    category: 'uiux',
    description: 'Create a complete design system: color palette (WCAG-compliant), typography, spacing, shadows, animation tokens.',
    whenToUse: 'Starting a new feature that needs visual design tokens. Must specify a primary brand color hex.',
    howToUse: 'args: { name: string, primaryColor: string, platforms?: string[] }',
    availableTo: ['UIUXAgent', 'DesignAgent'],
  },
  {
    name: 'uiux_generate_design_tokens',
    category: 'uiux',
    description: 'Generate design tokens in JSON, CSS, or Tailwind format from the saved design system.',
    whenToUse: 'After uiux_create_design_system, when you need tokens in a specific format for implementation.',
    howToUse: 'args: { format: "json"|"css"|"tailwind"|"all", categories?: string[] }',
    availableTo: ['UIUXAgent', 'DesignAgent'],
  },
  {
    name: 'uiux_export_tokens',
    category: 'uiux',
    description: 'Export design tokens to files on disk (.forgeai/design-system/ or custom dir).',
    whenToUse: 'Ready to write tokens into the project so developers can import them.',
    howToUse: 'args: { designSystemName: string, formats: Array<"json"|"css"|"tailwind">, outputDir?: string }',
    availableTo: ['UIUXAgent', 'DesignAgent'],
  },
  {
    name: 'uiux_check_contrast',
    category: 'uiux',
    description: 'Calculate WCAG contrast ratio between foreground and background colors.',
    whenToUse: 'Validating color accessibility for text/background combinations before finalizing tokens.',
    howToUse: 'args: { foreground: string, background: string, level?: "AA"|"AAA" }',
    availableTo: ['UIUXAgent', 'DesignAgent'],
  },

  {
    name: 'forgeai_getErrors',
    category: 'file',
    description: 'Get workspace diagnostics (errors and warnings) from VS Code.',
    whenToUse: 'Need to see what the TypeScript/linter compiler is complaining about.',
    howToUse: 'args: {} (no parameters required)',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'PlannerAgent',
      'ExecutorAgent',
      'ImplementerAgent',
      'ReviewerAgent',
      'CriticAgent',
    ],
  },
  {
    name: 'forgeai_getDiagnostics',
    category: 'file',
    description: 'Get full diagnostic list including warnings and info messages.',
    whenToUse: 'Need comprehensive diagnostics, not just errors.',
    howToUse: 'args: {} (no parameters required)',
    availableTo: [
      'RequirementsAgent',
      'DesignAgent',
      'TasksAgent',
      'BugfixAgent',
      'PlannerAgent',
      'ExecutorAgent',
      'ImplementerAgent',
      'ReviewerAgent',
      'CriticAgent',
    ],
  },
];

/**
 * Get tool entries filtered for a specific agent.
 */
export function getToolsForAgent(agentName: string): ToolEntry[] {
  return TOOL_CATALOG.filter((t) => t.availableTo.includes(agentName) || t.availableTo.includes('*'));
}

/**
 * Render a Markdown tool-reference section for a system prompt.
 */
export function renderToolSection(agentName: string): string {
  const tools = getToolsForAgent(agentName);
  if (tools.length === 0) return '';

  const lines: string[] = ['# TOOLS AVAILABLE TO YOU', ''];
  lines.push('The following tools are available. Use them when the situation calls for it:');

  const categories = [...new Set(tools.map((t) => t.category))];
  for (const cat of categories) {
    const catTools = tools.filter((t) => t.category === cat);
    lines.push('');
    lines.push(`## ${cat.toUpperCase()} TOOLS`);
    for (const tool of catTools) {
      lines.push(`- **${tool.name}** — ${tool.description}`);
      lines.push(`  - When: ${tool.whenToUse}`);
      lines.push(`  - How: ${tool.howToUse}`);
    }
  }

  lines.push('');
  lines.push('# HOW TO USE TOOLS');
  lines.push('- Call tools ONLY when genuinely needed — do not narrate tool calls in your output document.');
  lines.push('- Do NOT mention tool names in Requirements/Design/Tasks/Bugfix markdown output.');
  lines.push('- Tools are infrastructure; your output is pure Markdown content.');
  lines.push('- When unsure, prefer forgeai_listSpecs or forgeai_readSpec to gather context before acting.');

  return lines.join('\n');
}
