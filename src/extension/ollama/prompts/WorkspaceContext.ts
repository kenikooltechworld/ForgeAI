/**
 * Workspace context and path handling
 */

import { WorkspaceContext } from '../SystemPrompt';

export function getWorkspaceContext(workspaceContext?: WorkspaceContext): string {
  if (!workspaceContext?.workspacePath) {
    return '## Workspace Context\n\nNo workspace currently open.';
  }

  const treeText =
    workspaceContext.workspaceTree && workspaceContext.workspaceTree.length > 0
      ? `\n### Workspace file tree (compact overview)\n${workspaceContext.workspaceTree}`
      : '';

  return `## Workspace Context

Current workspace: ${workspaceContext.workspacePath}
${workspaceContext.openFiles?.length ? `Currently open in editor: ${workspaceContext.openFiles.join(', ')}` : ''}
${treeText}

All file operations should be within the workspace directory.

### Path Guidelines
- Use absolute paths by combining workspace root with relative paths
- When users refer to files, they mean files within the workspace
- Always read a file before modifying it
- The file tree above is a compact overview. If you need to know whether a specific file exists or explore a subdirectory in detail, call \`forgeai_listFiles\` or \`forgeai_searchInFiles\`.`;
}
