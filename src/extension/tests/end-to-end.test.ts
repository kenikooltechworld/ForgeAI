import { OllamaClient } from '../ollama/OllamaClient';
import { getConfiguredModel } from '../config/ModelConfig';

async function main() {
  const logger = {
    debug: (...args: unknown[]) => console.log('[DEBUG]', ...args),
    warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
    error: (...args: unknown[]) => console.error('[ERROR]', ...args),
    info: (...args: unknown[]) => console.info('[INFO]', ...args),
  };

  const ollama = new OllamaClient('http://localhost:11434', logger);

  const model = getConfiguredModel();
  console.log('\n=== CONFIGURED MODEL ===');
  console.log('model:', model);

  console.log('\n=== CHECKING OLLAMA ===');
  const up = await ollama.isAvailable();
  console.log('ollama up:', up);
  if (!up) {
    console.error('Ollama not available at http://localhost:11434');
    process.exit(1);
  }

  console.log('\n=== LISTING MODELS ===');
  const models = await ollama.listModels();
  console.log(models.map(m => m.name));
  const modelFound = models.some(m => m.name === model);
  console.log('configured model found on Ollama:', modelFound);

  console.log('\n=== TESTING CHAT (stream) ===');
  const ts = Date.now();
  const stream = ollama.chat({
    model,
    messages: [
      { role: 'system', content: 'You are a test. Reply with exactly: hello world' },
      { role: 'user', content: 'Reply with exactly the two words: hello world' },
    ],
    stream: true,
  });
  let out = '';
  for await (const chunk of stream) {
    out += (chunk as any).message?.content ?? '';
  }
  console.log('latency ms:', Date.now() - ts);
  console.log('response:', out.trim().slice(0, 200));

  console.log('\n=== SPAWN AGENT SMOKE TEST (using real Ollama client) ===');
  // This is the exact call SubAgentSpawner makes:
  //   agentLoop.execute(messages, ..., getConfiguredModel())
  // We exercise the same Arrow here to confirm whether it 404s.
  const { AgentLoop } = await import('../ollama/AgentLoop');
  const loop = new AgentLoop(
    ollama,
    logger,
    undefined,
    undefined
  );

  const msgs = [
    { role: 'system', content: 'Research assistant. Be concise.' },
    { role: 'user', content: 'What is the current stable version of Django? Reply with one line only.' },
  ];
  const result = await ollama.chat({
    model,
    messages: msgs,
    stream: false,
    think: false,
    tools: [],
  });
  console.log('chat response object keys:', Object.keys(result));
  console.log('content:', (result as any).message?.content?.slice(0, 200));
  console.log('\n=== TEST COMPLETE ===');
}

main().catch((e) => {
  console.error('TEST_CRASH:', e);
  process.exit(1);
});
