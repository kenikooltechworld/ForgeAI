/**
 * Test script to verify if Ollama returns token counts in streaming mode
 * Run with: node test-token-usage.js
 */

async function testTokenUsage() {
  console.log('🧪 Testing Ollama token usage in streaming mode...\n');

  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-oss:120b-cloud',
      messages: [{ role: 'user', content: 'Say hello in one sentence' }],
      stream: true,
      think: true,
    }),
  });

  if (!response.ok) {
    console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let chunkCount = 0;
  let foundTokens = false;

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
        chunkCount++;

        console.log(`\n📦 Chunk ${chunkCount}:`);
        console.log(`   done: ${chunk.done}`);
        console.log(
          `   thinking: ${chunk.message.thinking ? `"${chunk.message.thinking.substring(0, 50)}..."` : 'null'}`
        );
        console.log(
          `   content: ${chunk.message.content ? `"${chunk.message.content.substring(0, 50)}..."` : 'null'}`
        );
        console.log(`   prompt_eval_count: ${chunk.prompt_eval_count ?? 'undefined'}`);
        console.log(`   eval_count: ${chunk.eval_count ?? 'undefined'}`);

        if (chunk.prompt_eval_count !== undefined || chunk.eval_count !== undefined) {
          foundTokens = true;
          console.log('   ✅ TOKEN COUNTS FOUND!');
        }

        if (chunk.done) {
          console.log('\n🏁 Final chunk received');
          console.log(`   Full chunk: ${JSON.stringify(chunk, null, 2)}`);
        }
      } catch (e) {
        console.error(`❌ Failed to parse: ${line}`);
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total chunks: ${chunkCount}`);
  console.log(`   Token counts found: ${foundTokens ? '✅ YES' : '❌ NO'}`);

  if (!foundTokens) {
    console.log('\n⚠️  ISSUE IDENTIFIED:');
    console.log('   Ollama is NOT returning token counts in streaming mode.');
    console.log('   This is likely a limitation of the model or Ollama version.');
    console.log('\n💡 SOLUTIONS:');
    console.log('   1. Check if gpt-oss:120b-cloud supports token counts');
    console.log('   2. Try a different model (e.g., qwen3-coder:30b)');
    console.log('   3. Use non-streaming mode for final chunk to get token counts');
    console.log('   4. Calculate approximate token count client-side');
  }
}

testTokenUsage().catch(console.error);
