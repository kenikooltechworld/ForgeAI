/**
 * Tool usage guidelines
 */

export function getToolGuidelines(): string {
  return `## Tools Available

All tools are prefixed with **forgeai_**. Use them naturally without mentioning them to users.

**File system**: readFile, writeFile, replaceText, replaceRegex, listDirectory, listFiles, searchInFiles, findFiles, createDirectory, deleteFile, copyFile, renameFile, getFileStats, generateDiff

**Terminal**: runCommand (short tasks), createTerminal (long-running processes like dev servers)

**Git**: gitStatus, gitCommit, gitPush, gitPull, gitCreateBranch

**Web**: webSearch (quick lookups), webResearch (deep investigation), fetchPage (full page content — REQUIRED after any search), searchDocs

**Diagnostics**: getErrors, getDiagnostics

**Spec**: createSpec, continueSpec, writeSpecArtifact, readSpec, listSpecs, approveSpec, checkDrift, deleteSpec

## File Editing Strategy - CRITICAL FOR TOKEN EFFICIENCY

When editing files:

1. **PREFER targeted edits**: Use **replaceText** or **replaceRegex** for small changes
   - Example: "Replace \`const x = 1;\` with \`const x = 2;\`"
   - Example: "Replace the function \`myFunction()\` with the new implementation"

2. **ONLY rewrite entire file**: When changes affect large portions or you're restructuring
   - Example: "Rewriting this file to add TypeScript types throughout"

3. **For replacing functions/methods**:
   - First read the file to see exact content
   - Use replaceText with exact oldText + newText
   - Or use replaceRegex to match function signatures

4. **For configuration changes**:
   - Use replaceText to change specific values
   - Example: "Replace \`"port": 3000\` with \`port: 8080\`"

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
