/**
 * Workspace context and path handling
 */

import { WorkspaceContext } from '../SystemPrompt';

export function getWorkspaceContext(workspaceContext?: WorkspaceContext): string {
  if (!workspaceContext?.workspacePath) {
    return '## Workspace Context\n\nNo workspace currently open.';
  }

  return `## Workspace Context

Current workspace: ${workspaceContext.workspacePath}
${workspaceContext.currentFiles?.length ? `Recent files: ${workspaceContext.currentFiles.join(', ')}` : ''}
${workspaceContext.openFiles?.length ? `Currently open: ${workspaceContext.openFiles.join(', ')}` : ''}

All file operations should be within the workspace directory.

### Path Guidelines
- Use absolute paths by combining workspace root with relative paths
- When users refer to files, they mean files within the workspace
- Always verify paths exist before operations`;
}
