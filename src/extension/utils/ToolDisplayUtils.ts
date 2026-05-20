/**
 * Tool display name / target extraction utilities.
 * Pure functions — no external dependencies.
 */

const TOOL_NAME_MAP: Record<string, string> = {
  forgeai_readFile: 'Read file',
  forgeai_writeFile: 'Write file',
  forgeai_listFiles: 'List files',
  forgeai_listDirectory: 'List directory',
  forgeai_createDirectory: 'Create directory',
  forgeai_deleteFile: 'Delete file',
  forgeai_copyFile: 'Copy file',
  forgeai_renameFile: 'Rename file',
  forgeai_getFileStats: 'Get file info',
  forgeai_watchFiles: 'Watch files',
  forgeai_findFiles: 'Find files',
  forgeai_generateDiff: 'Generate diff',
  forgeai_searchInFiles: 'Search in files',
  forgeai_runCommand: 'Run command',
  forgeai_createTerminal: 'Create terminal',
  forgeai_gitStatus: 'Git status',
  forgeai_gitCommit: 'Git commit',
  forgeai_gitPush: 'Git push',
  forgeai_gitPull: 'Git pull',
  forgeai_gitCreateBranch: 'Create branch',
  forgeai_getErrors: 'Get errors',
  forgeai_getDiagnostics: 'Get diagnostics',
};

/**
 * Convert a technical forgeai_ tool name to a user-friendly display name.
 */
export function getToolDisplayName(toolName: string): string {
  return TOOL_NAME_MAP[toolName] || toolName.replace('forgeai_', '');
}

/**
 * Extract target information (path, command, query, etc.) from tool call arguments.
 */
export function getToolTarget(toolCall: {
  function: { arguments: string | Record<string, unknown> };
}): string | undefined {
  try {
    const args: Record<string, unknown> =
      typeof toolCall.function.arguments === 'string'
        ? (JSON.parse(toolCall.function.arguments) as Record<string, unknown>)
        : toolCall.function.arguments;

    if (typeof args.path === 'string') return args.path;
    if (typeof args.file === 'string') return args.file;
    if (typeof args.filePath === 'string') return args.filePath;
    if (typeof args.command === 'string') return args.command;
    if (typeof args.query === 'string') return args.query;
    if (typeof args.pattern === 'string') return args.pattern;

    return undefined;
  } catch {
    return undefined;
  }
}
