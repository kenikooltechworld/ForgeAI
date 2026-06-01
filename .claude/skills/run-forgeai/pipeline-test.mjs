import { SpecWriterAgent } from '../../../src/extension/spec/generators/SpecWriterAgent';
import { ArchitectAgent } from '../../../src/extension/spec/generators/ArchitectAgent';
import { TaskDecomposerAgent } from '../../../src/extension/spec/generators/TaskDecomposerAgent';
import * as fs from 'fs';
import * as path from 'path';

async function runPipeline() {
  const specDir = '.forgeai/specs/001-command-history-viewer';
  if (!fs.existsSync(specDir)) {
    fs.mkdirSync(specDir, { recursive: true });
  }

  const mockDeps = {
    executeLLM: async (systemPrompt, userPrompt) => {
      console.log(`\\n[LLM Call] System Prompt: ${systemPrompt.substring(0, 100)}...`);
      console.log(`[LLM Call] User Prompt: ${userPrompt.substring(0, 100)}...`);

      if (systemPrompt.includes('SpecWriter Agent')) {
        return `# Requirements Document: Command History Viewer...`;
      }
      if (systemPrompt.includes('Architect Agent')) {
        return `# Technical Plan: Command History Viewer...`;
      }
      if (systemPrompt.includes('TaskDecomposer Agent')) {
        return `# Implementation Plan: Command History Viewer...`;
      }
      return 'default response';
    },
    readConstitution: async () => 'Project Constitution: No cloud APIs.',
    readMemory: async (file) => `Memory for ${file}: Base la-context`,
  };

  console.log('--- Starting Pipeline Test ---');

  const sw = new SpecWriterAgent(mockDeps);
  const architect = new ArchitectAgent(mockDeps);
  const td = new TaskDecomposerAgent(mockDeps);

  const reqs = await sw.generate(specDir, 'I want a command history viewer.');
  console.log('✅ Requirements generated');

  const plan = await architect.generate(specDir, reqs.content);
  console.log('✅ Plan generated');

  const tasks = await td.generate(specDir, reqs.content, plan.content);
  console.log('✅ Tasks generated');

  console.log('\\n--- Pipeline Complete ---');
}

runPipeline().catch(console.error);
