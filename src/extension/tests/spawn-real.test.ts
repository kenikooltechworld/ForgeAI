import { OllamaClient } from '../ollama/OllamaClient';
import { getConfiguredModel } from '../config/ModelConfig';

async function main() {
  const logger = {
    debug: (...a: unknown[]) => console.log('[DEBUG]', ...a),
    warn: (...a: unknown[]) => console.warn('[WARN]', ...a),
    error: (...a: unknown[]) => console.error('[ERROR]', ...a),
    info: (...a: unknown[]) => console.info('[INFO]', ...a),
  };

  const ollama = new OllamaClient('http://localhost:11434', logger);

  const model = getConfiguredModel();
  console.log('\n=== CONFIGURED MODEL ===');
  console.log('model:', model);

  console.log('\n=== OLLAMA HEALTH ===');
  const up = await ollama.isAvailable();
  console.log('ollama up:', up);
  if (!up) {
    process.exit(1);
  }

  console.log('\n=== AVAILABLE MODELS ===');
  const models = await ollama.listModels();
  console.log(models.map(m => m.name));
  console.log('configured model known:', models.some(m => m.name === model));

  console.log('\n=== STREAMING CHAT (spawn-style call) ===');
  const messages = [
    { role: 'system', content: 'You are a research assistant. Be concise.' },
    { role: 'user', content: 'What is the current stable version of Django? Reply one line only.' },
  ];
  const t0 = Date.now();
  const result = await ollama.chat({
    model,
    messages,
    stream: true,
    think: false,
    tools: [],
  });
  let text = '';
  for await (const chunk of result as any) {
    text += chunk.message?.content ?? '';
  }
  console.log('latencyMs:', Date.now() - t0);
  console.log('response:', text.trim().slice(0, 300));
}

main().catch((e: unknown) => {
  console.error('TEST_CRASH:', e);
  process.exit(1);
});
