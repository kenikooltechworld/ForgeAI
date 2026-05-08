/**
 * Tool usage guidelines and best practices
 */

export function getToolGuidelines(): string {
  return `## Available Tools

You have access to comprehensive file system, terminal, git, and diagnostic tools. All tool names are prefixed with 'forgeai_'.

### File System Tools

**forgeai_readFile(path)** - Read file contents
**forgeai_writeFile(path, content)** - Write or update files
**forgeai_listDirectory(path)** - List directory contents
**forgeai_listFiles(pattern)** - Find files by glob pattern (e.g., "**/*.ts")
**forgeai_searchInFiles(query, pattern)** - Search text content across files
**forgeai_findFiles(include, exclude)** - Search with include/exclude patterns
**forgeai_createDirectory(path)** - Create new directory
**forgeai_deleteFile(path)** - Delete file or directory
**forgeai_copyFile(source, destination)** - Copy files
**forgeai_renameFile(oldPath, newPath)** - Rename or move files
**forgeai_getFileStats(path)** - Get file metadata
**forgeai_watchFiles(pattern)** - Watch files for changes
**forgeai_generateDiff(file, originalContent, newContent, language)** - Generate code diff preview

### Terminal Tools

**forgeai_runCommand(command, cwd, timeout)** - Execute shell command and wait for completion
**forgeai_createTerminal(name, cwd, command)** - Create terminal for long-running processes

### Git Tools

**forgeai_gitStatus()** - Get current Git status
**forgeai_gitCommit(message, files)** - Stage and commit changes
**forgeai_gitPush()** - Push commits to remote
**forgeai_gitPull()** - Pull commits from remote
**forgeai_gitCreateBranch(name, checkout)** - Create new branch

### Diagnostics Tools

**forgeai_getErrors()** - Get all errors and warnings in workspace
**forgeai_getDiagnostics(paths)** - Get diagnostics for specific files

### Tool Usage Best Practices

**Search First**: Use forgeai_searchInFiles and forgeai_listFiles to find things quickly instead of browsing directories manually.

**Read Before Modify**: Always read files before modifying them to understand the current structure.

**Verify Changes**: After making changes, run appropriate verification (builds, tests) when relevant.

**Handle Errors Gracefully**: When commands fail, analyze the error and fix the underlying issue automatically.

**Use Correct Tool Names**: All tools are prefixed with 'forgeai_'. Never use tool names without this prefix.`;
}

export function getTerminalGuidelines(): string {
  return `### Terminal Command Guidelines

**Short Commands**: Use forgeai_runCommand for commands that complete quickly (tests, builds, installs)
**Long Processes**: Use forgeai_createTerminal for dev servers and watch processes

**Error Recovery**: When commands fail:
1. Analyze the error message
2. Fix the root cause (install dependencies, correct paths, fix syntax)
3. Retry the operation
4. Only escalate if you can't resolve it`;
}
