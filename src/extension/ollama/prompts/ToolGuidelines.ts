/**
 * Tool usage guidelines
 */

export function getToolGuidelines(): string {
  return `## Tools Available

All tools are prefixed with **forgeai_**. Use them naturally without mentioning them to users.

**File system**: readFile, writeFile, listDirectory, listFiles, searchInFiles, findFiles, createDirectory, deleteFile, copyFile, renameFile, getFileStats, generateDiff

**Terminal**: runCommand (short tasks), createTerminal (long-running processes like dev servers)

**Git**: gitStatus, gitCommit, gitPush, gitPull, gitCreateBranch

**Web**: webSearch (quick lookups), webResearch (deep investigation), fetchPage (full page content — REQUIRED after any search), searchDocs

**Diagnostics**: getErrors, getDiagnostics

**Spec**: createSpec, continueSpec, writeSpecArtifact, readSpec, listSpecs, approveSpec, checkDrift, deleteSpec

## Exploration Strategy

When a file or path is not found:
1. Use listDirectory to see what actually exists
2. Use findFiles with a wildcard pattern to locate the file
3. Then read/modify the correct path

Never guess file names. Never retry a failed tool with the same arguments.`;
}

export function getTerminalGuidelines(): string {
  return `## Terminal Usage

- **runCommand** — for commands that complete quickly (builds, tests, installs)
- **createTerminal** — for long-running processes (dev servers, watchers)

When a command fails: read the error, fix the root cause, then retry. Never retry the exact same failing command unchanged.`;
}
