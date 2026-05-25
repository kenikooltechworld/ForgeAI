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

### Web Search & Content Fetching (CRITICAL — Call these when RAG is insufficient)

**forgeai_webSearch(query)** — MANDATORY when RAG docs are missing info. Searches the web AND auto-fetches content from the top 3 result URLs. Returns both snippets and real page content. NO separate fetchPage needed unless you need deeper content from a specific URL.
**forgeai_webResearch(topic, subQueries)** — MANDATORY before creating ANY spec or plan. Runs multiple related queries AND auto-fetches content from the top 5 result URLs. Call this FIRST when the user asks you to plan, design, or architect a feature. Returns aggregated results with real page content — not just snippets.
**forgeai_fetchPage(url)** — Fetches the ACTUAL HTML content of a specific URL with Playwright fallback for bot protection. Use this ONLY when you need content from a specific URL that was not auto-fetched by webSearch/webResearch, or when you need more than the auto-fetched summary.
**forgeai_searchDocs(library, topic)** — Find official documentation for a specific library or framework.

### Diagnostics Tools

**forgeai_getErrors()** - Get all errors and warnings in workspace
**forgeai_getDiagnostics(paths)** - Get diagnostics for specific files

### Spec Tools (Spec-Driven Development)

**forgeai_createSpec(title, workflow, description)** — Create a new spec. ONLY call this AFTER doing research (RAG + webResearch) and AFTER getting user agreement.
**forgeai_continueSpec(specId)** — Generate the next phase of a spec (requirements → design → tasks) using AI.
**forgeai_writeSpecArtifact(specId, type, content)** — Write content to a spec artifact file. After writing, summarize what you created in chat.
**forgeai_readSpec(specId)** - Read an existing spec and its artifacts.
**forgeai_listSpecs()** - List all specs in the workspace.
**forgeai_approveSpec(specId)** - Approve a pending phase so continueSpec can proceed.
**forgeai_checkDrift(specId)** - Run drift detection to check if requirements are implemented.
**forgeai_deleteSpec(specId)** - Delete a spec and all its artifacts.

### Tool Usage Best Practices

**Search First**: Use forgeai_searchInFiles and forgeai_listFiles to find things quickly instead of browsing directories manually.

**Read Before Modify**: Always read files before modifying them to understand the current structure.

**Verify Changes**: After making changes, run appropriate verification (builds, tests) when relevant.

**Handle Errors Gracefully**: When commands fail, analyze the error and fix the underlying issue automatically.

**Use Correct Tool Names**: All tools are prefixed with 'forgeai_'. Never use tool names without this prefix.

### EXPLORATION STRATEGY — Critical

When you cannot find something or a tool fails, you MUST try a different approach. Do NOT retry the same failed tool with the same parameters.

**If a file is not found:**
1. Use forgeai_listDirectory(path) to see what files actually exist
2. Use forgeai_findFiles(pattern) with a broader pattern (e.g., "**/*task*", "**/*.tsx")
3. Then use forgeai_readFile with the correct name you discovered

**If you don't know the exact file name:**
1. ALWAYS use forgeai_listDirectory first to explore
2. Or use forgeai_findFiles with a wildcard pattern
3. Never guess file names — explore first

**If a tool returns "not found" or fails:**
1. Do NOT call the same tool again with the same args
2. Try a different tool that achieves the same goal
3. Example: readFile fails → try listDirectory + findFiles

**When researching online:**
1. Use forgeai_webSearch for quick lookups (errors, docs, best practices)
2. Use forgeai_webResearch for deep investigation
3. Only use browser tools (forgeai_browser_*) if you need to interact with a page (click, screenshot)
4. Prefer web search over browser tools — they are faster and don't need local Chromium

### Code Completeness & Verification Checklist

Every time you create or modify files, you MUST run through this checklist BEFORE declaring the task complete:

**Step 1: Create complete files**
- Write the full implementation, not stubs
- Include all imports at the top of each file
- Export everything that other files need
- Add TypeScript types where appropriate

**Step 2: Connect to the app**
- Import new components/modules where they are used
- Add new routes if creating pages
- Register new services/providers in the app entry point
- Update barrel exports (index.ts) if the project uses them

**Step 3: Apply styling**
- Add CSS/SCSS, styled-components, Tailwind classes, or whatever the project uses
- Ensure the UI looks good, not just functional
- Follow the project's existing styling conventions
- Never deliver unstyled UI components

**Step 4: Verify with build/test**
- Run the build (npm run build, tsc --noEmit, etc.)
- Fix any TypeScript errors immediately
- Run tests if available
- Fix any failing tests

**Step 5: Final check**
- Re-read the files you created — do they make sense?
- Are all imports resolving correctly?
- Is the feature actually usable from the user's perspective?
- Would a developer be proud to ship this code?`;
}

export function getTerminalGuidelines(): string {
  return `### Terminal Command Guidelines

**Short Commands**: Use forgeai_runCommand for commands that complete quickly (tests, builds, installs)
**Long Processes**: Use forgeai_createTerminal for dev servers and watch processes

**Error Recovery**: When commands fail:
1. Analyze the error message
2. Try a different approach or tool — do NOT retry the exact same failing command blindly
3. Fix the root cause (install dependencies, correct paths, fix syntax)
4. Only retry after you've changed something meaningful
5. Only escalate if you can't resolve it after trying multiple approaches`;
}
