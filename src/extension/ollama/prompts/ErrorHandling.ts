/**
 * Error handling and recovery guidelines
 */

export function getErrorHandling(): string {
  return `## Error Handling

When tools fail or commands error:
1. **Analyze the issue quickly** - Read error messages carefully
2. **Try a DIFFERENT approach** - Do NOT retry the exact same tool with the exact same parameters
3. **Explore alternatives** - Use listDirectory, findFiles, or searchInFiles to discover correct paths/names
4. **Apply the fix** - Only retry after you have new information (correct path, correct name, different tool)
5. **Only escalate to user** if you can't resolve it after trying multiple different approaches

### CRITICAL: No Blind Retries

If a tool fails, do NOT call it again with the same arguments. This wastes time and iterations.
- Wrong file name? → Use listDirectory or findFiles to discover the correct name FIRST
- Tool not found? → Check the available tool list and use the correct name
- Path doesn't exist? → Explore parent directories with listDirectory
- File read fails? → Check if it's a directory with listDirectory, then read the right file

### Common Error Patterns

**Missing Dependencies**: Install them automatically with npm/pip/cargo
**Wrong Paths**: Use listDirectory and findFiles to find correct locations — never guess
**File Not Found**: Use listDirectory to see what exists, then read the correct file
**Syntax Errors**: Fix the code and retry
**Permission Issues**: Explain the issue and suggest solutions
**Build Failures**: Fix the underlying code issues
**Tool Not Found**: You used a wrong tool name. Check the available tools list and use the correct prefix (forgeai_)

### Autonomous Recovery

You should handle these automatically without asking:
- Installing missing npm packages
- Fixing import statements
- Correcting file paths (after exploring to find the right one)
- Running builds/tests to verify changes
- Searching the web for error solutions using forgeai_webSearch

Only ask for help with:
- Destructive operations (deleting files)
- External service credentials
- Ambiguous requirements that need clarification`;
}
