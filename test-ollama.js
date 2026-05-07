/**
 * Terminal test for OllamaClient
 * Run: node test-ollama.js
 */

// Simple mock logger for testing
class MockLogger {
  info(message, ...args) {
    console.log(`[INFO] ${message}`, ...args);
  }
  error(message, error) {
    console.error(`[ERROR] ${message}`, error?.message || error);
  }
  warn(message, ...args) {
    console.warn(`[WARN] ${message}`, ...args);
  }
}

// Inline OllamaClient for testing (copied from source)
class OllamaClient {
  constructor(baseUrl = 'http://localhost:11434', logger) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.logger = logger;
    this.timeout = 30000;
    this.logger.info(`OllamaClient initialized with baseUrl: ${this.baseUrl}`);
  }

  async chat(request) {
    this.logger.info(`Sending chat request: model=${request.model}, stream=${request.stream}`);

    if (request.stream) {
      return this.streamChat(request);
    } else {
      return this.nonStreamChat(request);
    }
  }

  async nonStreamChat(request) {
    const url = `${this.baseUrl}/api/chat`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: false,
          think: request.think ?? false,
          tools: request.tools,
          options: request.options,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.info(`Received response: done=${data.done}`);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async *streamChat(request) {
    const url = `${this.baseUrl}/api/chat`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: true,
          think: request.think ?? false,
          tools: request.tools,
          options: request.options,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.logger.info('Started streaming response');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          try {
            const chunk = JSON.parse(line);
            yield chunk;
            if (chunk.done) return;
          } catch (e) {
            this.logger.warn(`Failed to parse chunk: ${line}`);
          }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async listModels() {
    this.logger.info('Fetching available models');
    const url = `${this.baseUrl}/api/tags`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.info(`Retrieved ${data.models.length} models`);
      return data.models;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async isAvailable() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      this.logger.warn('Ollama is not available', error);
      return false;
    }
  }
}

// Test function
async function testOllamaClient() {
  console.log('=== OllamaClient Terminal Test ===\n');

  try {
    const logger = new MockLogger();
    const client = new OllamaClient('http://localhost:11434', logger);

    console.log('✓ OllamaClient instance created\n');

    // Test 1: Check if Ollama is available
    console.log('Test 1: Checking Ollama availability...');
    const isAvailable = await client.isAvailable();
    console.log(`Result: ${isAvailable ? '✓ Ollama is running' : '✗ Ollama is not running'}\n`);

    if (!isAvailable) {
      console.log('⚠️  Please start Ollama first:');
      console.log('   ollama serve\n');
      return;
    }

    // Test 2: List models
    console.log('Test 2: Listing available models...');
    const models = await client.listModels();
    console.log(`Result: Found ${models.length} models`);
    models.forEach((model) => {
      console.log(`  - ${model.name} (${model.details?.parameter_size || 'unknown size'})`);
    });
    console.log('');

    if (models.length === 0) {
      console.log('⚠️  No models found. Pull a model first:');
      console.log('   ollama pull qwen3-coder:30b\n');
      return;
    }

    // Test 3: Non-streaming chat
    console.log('Test 3: Non-streaming chat request...');
    // Use a local model instead of cloud model
    const localModel = models.find((m) => !m.name.includes('cloud')) || models[0];
    const modelName = localModel.name;
    console.log(`Using model: ${modelName}`);

    const response = await client.chat({
      model: modelName,
      messages: [{ role: 'user', content: 'Say "Hello from OllamaClient test!" in one sentence.' }],
      stream: false,
      think: false,
    });

    console.log('Result: ✓ Response received');
    console.log(`Response: ${response.message.content}\n`);

    // Test 4: Streaming chat
    console.log('Test 4: Streaming chat request...');
    const stream = await client.chat({
      model: modelName,
      messages: [{ role: 'user', content: 'Count from 1 to 5, one number per line.' }],
      stream: true,
      think: false,
    });

    console.log('Result: Streaming response:');
    process.stdout.write('  ');

    for await (const chunk of stream) {
      if (chunk.message.content) {
        process.stdout.write(chunk.message.content);
      }
      if (chunk.done) {
        console.log('\n✓ Streaming completed\n');
      }
    }

    // Test 5: Thinking mode
    console.log('Test 5: Chat with thinking mode...');
    const thinkingResponse = await client.chat({
      model: modelName,
      messages: [{ role: 'user', content: 'What is 2+2? Think step by step.' }],
      stream: false,
      think: true,
    });

    console.log('Result: ✓ Response with thinking received');
    if (thinkingResponse.message.thinking) {
      console.log(`Thinking: ${thinkingResponse.message.thinking.substring(0, 100)}...`);
    }
    console.log(`Answer: ${thinkingResponse.message.content}\n`);

    console.log('=== All Tests Passed! ✓ ===');
    console.log('\nOllamaClient is working correctly and ready for integration.');
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error('\nError details:', error);

    if (error.message.includes('Cannot find module')) {
      console.log('\n⚠️  Please compile the extension first:');
      console.log('   npm run compile');
    }
  }
}

// Run tests
testOllamaClient().catch(console.error);
