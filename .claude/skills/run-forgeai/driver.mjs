import { OllamaClient } from '../../../src/extension/ollama/OllamaClient';
import { ToolRegistry } from '../../../src/extension/tools/ToolRegistry';
import { ForgeAIWorkspace } from '../../../src/extension/forgeaiWorkspace/ForgeAIWorkspace';
import { Logger } from '../../../src/extension/utils/Logger';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function runSmokeTest() {
  console.log('🚀 Starting ForgeAI Smoke Test...');

  // 1. Setup minimal mock environment
  const tempDir = fs.mkdtempSync('forgeai-test-');
  console.log(`📁 Testing in temp workspace: ${tempDir}`);

  const mockContext = {
    extensionUri: { fsPath: process.cwd() },
    globalStorageUri: { fsPath: path.join(os.tmpdir(), 'forgeai-storage') },
    subscriptions: [],
  };

  const logger = new Logger(mockContext);

  try {
    // 2. Test Ollama Connectivity
    console.log('\n--- Testing Ollama Connection ---');
    const ollama = new OllamaClient('http://localhost:11434', logger);
    const isAvailable = await ollama.isAvailable();
    if (!isAvailable) {
      console.error('❌ Ollama is not available at http://localhost:11434');
      console.log('   (This is expected if Ollama is not running in this container)');
      // We don't fail the whole test if Ollama is missing, but we warn.
    } else {
      console.log('✅ Ollama is available!');
      const response = await ollama.chat({
        model: 'gemma4:31b-cloud', // Using the model from system prompt
        messages: [{ role: 'user', content: 'Hello, are you working?' }],
        stream: false,
      });
      console.log('✅ LLM Response received');
    }

    // 3. Test Tool Registry and File System Tools
    console.log('\n--- Testing Tool Registry ---');
    const toolRegistry = new ToolRegistry(mockContext, logger);
    toolRegistry.registerAllTools();

    const fsTool = toolRegistry.getTool('forgeai_writeFile');
    if (!fsTool) {
      throw new Error('forgeai_writeFile tool not found in registry');
    }

    const testFile = path.join(tempDir, 'smoke-test.txt');
    const testContent = 'Hello from ForgeAI Driver!';

    // Use the tool directly
    await fsTool.execute({
      path: testFile,
      content: testContent
    });

    if (fs.existsSync(testFile) && fs.readFileSync(testFile, 'utf8') === testContent) {
      console.log('✅ FileSystemTool: write operation verified');
    } else {
      throw new Error('FileSystemTool failed to write expected content');
    }

    // 4. Test ForgeAIWorkspace
    console.log('\n--- Testing ForgeAIWorkspace ---');
    const workspace = new ForgeAIWorkspace(tempDir, logger, mockContext);
    await workspace.maybeAutoInitialize();

    const specsDir = path.join(tempDir, '.forgeai', 'specs');
    if (fs.existsSync(specsDir)) {
      console.log('✅ Workspace: Auto-initialization created specs directory');
    } else {
      throw new Error('Workspace failed to create .forgeai/specs directory');
    }

    console.log('\n🎉 ALL SMOKE TESTS PASSED!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ SMOKE TEST FAILED:');
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup temp dir
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Failed to cleanup temp dir:', e);
    }
  }
}

runSmokeTest();
