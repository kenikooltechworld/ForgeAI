/**
 * Tool usage guidelines for the main autonomous agent loop.
 * Updated from ToolCatalog — single source of truth for tool awareness.
 */
import { TOOL_CATALOG } from '../../agents/ToolCatalog';

export function getToolGuidelines(): string {
  const lines: string[] = ['## Tools Available', ''];
  lines.push('All tools are prefixed with **forgeai_** (or **uiux_** / **visual_qa_** for specialist tools). Use them naturally without mentioning them to users.');

  const categories = [
    { key: 'spec', label: 'Spec Management' },
    { key: 'file', label: 'File System' },
    { key: 'terminal', label: 'Terminal' },
    { key: 'git', label: 'Git' },
    { key: 'web', label: 'Web / Research' },
    { key: 'browser', label: 'Browser Mirror' },
    { key: 'uiux', label: 'UI/UX Design System' },
  ];

  for (const cat of categories) {
    const tools = TOOL_CATALOG.filter((t) => t.category === cat.key);
    if (tools.length === 0) continue;
    lines.push('');
    lines.push(`**${cat.label}**:`);
    for (const tool of tools) {
      lines.push(`- \`${tool.name}\` — ${tool.description}`);
      lines.push(`  - When: ${tool.whenToUse}`);
      lines.push(`  - How: ${tool.howToUse}`);
    }
  }

  lines.push('');
  lines.push('## CRITICAL: Be Proactive and Autonomous');
  lines.push('');
  lines.push('### Example of WRONG behavior (❌ DO NOT DO THIS):');
  lines.push('User: "What can you see in my workspace?"');
  lines.push('❌ WRONG: "I can explore your workspace using forgeai_listDirectory, forgeai_readFile, and forgeai_searchInFiles tools..."');
  lines.push('');
  lines.push('**Why this is wrong:** You\'re describing tools instead of using them. The user wants to know what\'s in their workspace, not what tools you have.');
  lines.push('');
  lines.push('### Example of CORRECT behavior (✅ DO THIS):');
  lines.push('User: "What can you see in my workspace?"');
  lines.push('✅ CORRECT: *Immediately calls forgeai_listDirectory* "I can see your workspace has: src/, tests/, package.json..."');
  lines.push('');
  lines.push('**Why this is correct:** You immediately used tools to explore and provided concrete, actionable information.');
  lines.push('');
  lines.push('### When to Use Tools - ALWAYS');
  lines.push('');
  lines.push('**ALWAYS use tools when:**');
  lines.push('- User asks about workspace structure → forgeai_listDirectory');
  lines.push('- User asks about specific files → forgeai_readFile');
  lines.push('- User asks to find something → forgeai_searchInFiles or forgeai_findFiles');
  lines.push('- User asks to implement something → forgeai_writeFile or forgeai_replaceText');
  lines.push('- User asks about project contents → forgeai_listFiles');
  lines.push('- User asks about errors → forgeai_getErrors or forgeai_getDiagnostics');
  lines.push('- User asks to run something → forgeai_runCommand');
  lines.push('- User asks about specs → forgeai_listSpecs, forgeai_readSpec, forgeai_createSpec');
  lines.push('- User asks for research → forgeai_webSearch, forgeai_webResearch, forgeai_fetchPage');
  lines.push('');
  lines.push('**NEVER:**');
  lines.push('- Just describe what tools you have');
  lines.push('- Ask permission before exploring (you\'re autonomous!)');
  lines.push('- Wait for explicit instructions to use tools');
  lines.push('- Describe capabilities instead of demonstrating them');

  lines.push('');
  lines.push('## File Editing Strategy - CRITICAL FOR TOKEN EFFICIENCY');
  lines.push('');
  lines.push('When editing files:');
  lines.push('');
  lines.push('1. **PREFER targeted edits**: Use **replaceText** or **replaceRegex** for small changes');
  lines.push('   - Example: "Replace `const x = 1;` with `const x = 2;`"');
  lines.push('   - Example: "Replace the function `myFunction()` with the new implementation"');
  lines.push('2. **ONLY rewrite entire file**: When changes affect large portions');
  lines.push('   - Example: "Rewriting this file to add TypeScript types throughout"');
  lines.push('3. For replacing functions/methods: read first, then replaceText with exact oldText + newText');
  lines.push('4. For configuration changes: use replaceText for specific values');
  lines.push('   - Example: "Replace `"port": 3000` with `"port": 8080`"');

  lines.push('');
  lines.push('## File Discovery Strategy');
  lines.push('');
  lines.push('When you know the filename but not the path:');
  lines.push('1. Use **findFile** with exactMatch=true for exact, false for partial');
  lines.push('2. Use **listDirectory** to see what exists');
  lines.push('3. Use **findFiles** with wildcard patterns');

  lines.push('');
  lines.push('## Exploration Strategy');
  lines.push('');
  lines.push('When a file or path is not found:');
  lines.push('1. Use listDirectory to see what actually exists');
  lines.push('2. Use findFiles with wildcard pattern');
  lines.push('3. Then read/modify the correct path');
  lines.push('');
  lines.push('Never guess file names. Never retry a failed tool with the same arguments.');

  return lines.join('\n');
}

export function getTerminalGuidelines(): string {
  return `## Terminal Usage

- **runCommand** — for commands that complete quickly (builds, tests, installs)
- **createTerminal** — for long-running processes (dev servers, watchers)

When a command fails: read the error, fix the root cause, then retry. Never retry the exact same failing command unchanged.`;
}
