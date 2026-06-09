import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const vscode = {
  workspace: {
    getConfiguration: () => ({
      get: (key, fallback) => fallback,
    }),
    workspaceFolders: [{ uri: { fsPath: 'C:\\Users\\KENIKOOL TECH WORLD\\Desktop\\ForgeAI' } }],
    onDidChangeWorkspaceFolders: () => ({ dispose: () => {} }),
  },
  env: { openExternal: async () => {} },
};

require.cache[require.resolve('vscode')] = { id: require.resolve('vscode'), exports: vscode };

const { OllamaClient } = require('./src/extension/ollama/OllamaClient');
const { AgentLoop } = require('./src/extension/ollama/AgentLoop');
const { getConfiguredModel } = require('./src/extension/config/ModelConfig');
const { buildScopedToolRegistry } = require('./src/extension/agents/SubAgentSpawner');
const { AGENT_REGISTRY } = require('./src/extension/agents/AgentRegistry');

const model = getConfiguredModel();
console.log('CONFIGURED MODEL:', model);

const client = new OllamaClient('http://localhost:11434', {
  debug: console.log,
  warn: console.warn,
  error: console.error,
  info: console.log,
});

console.log('OLLAMA AVAILABLE:', await client.isAvailable());
const models = await client.listModels();
console.log('MODELS:', models.map(m => m.name));

const registry = buildScopedToolRegistry(AGENT_REGISTRY.researcher.allowedTools);
const agentLoop = new AgentLoop(client, {
  debug: console.log,
  warn: console.warn,
  error: console.error,
  info: console.log,
}, registry, null);

const start = Date.now();
const messages = [
  { role: 'system', content: `You are a research agent. IMMEDIATELY write a markdown file to .forgeai/research/test-research.md with ALL findings. Use forgeai_writeFile. Then return a summary.` },
  { role: 'user', content: 'Research: current Django version and MariaDB Python connector. Write everything to .forgeai/research/test-research.md before stopping.' },
];

const result = [];
for await (const chunk of client.chat({ model, messages, stream: true, tools: registry.getDefinitions() })) {
  const delta = chunk.message?.content || '';
  if (delta) process.stdout.write(delta);
  result.push(chunk);
}

console.log('\n\nTIME:', Date.now() - start, 'ms');
const fs = require('fs');
const path = require('path');
const mdPath = path.join('C:\\Users\\KENIKOOL TECH WORLD\\Desktop\\ForgeAI', '.forgeai', 'research', 'test-research.md');
if (fs.existsSync(mdPath)) {
  console.log('MD FILE EXISTS, LENGTH:', fs.statSync(mdPath).size);
  console.log('MD HEAD:\n', fs.readFileSync(mdPath, 'utf-8').slice(0, 500));
} else {
  console.log('MD FILE NOT FOUND at', mdPath);
}
