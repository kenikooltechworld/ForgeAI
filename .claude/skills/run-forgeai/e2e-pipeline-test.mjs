import { SpecWriterAgent } from '../../../src/extension/spec/generators/SpecWriterAgent';
import { ArchitectAgent } from '../../../src/extension/spec/generators/ArchitectAgent';
import { TaskDecomposerAgent } from '../../../src/extension/spec/generators/TaskDecomposerAgent';
import { SpecTaskExecutor } from '../../../src/extension/spec/SpecTaskExecutor';
import { ForgeBrowserSession } from '../../../src/extension/services/ForgeBrowserSession';
import * as fs from 'fs';
import * as path from 'path';

/**
 * E2E Pipeline Smoke Test
 * Verifies the flow: Requirements -> Plan -> Tasks -> (UI/UX Design -> Implement -> Mirror Verify)
 */
async function runE2ETest() {
  const specDir = path.join(process.cwd(), '.forgeai/specs/test-ui-feature');
  if (!fs.existsSync(specDir)) {
    fs.mkdirSync(specDir, { recursive: true });
  }

  // 1. Mock Dependencies
  const mockDeps = {
    executeLLM: async (systemPrompt, userPrompt) => {
      console.log(`[LLM Call] Agent: ${systemPrompt.substring(0, 30)}...`);

      if (systemPrompt.includes('SpecWriter Agent')) {
        return `# Requirements: Login Page\n- Req 1.1: User can enter email\n- Req 1.2: User can submit login`;
      }
      if (systemPrompt.includes('Architect Agent')) {
        return `# Technical Plan: Login Page\n- Use React component\n- File: src/components/Login.tsx`;
      }
      if (systemPrompt.includes('TaskDecomposer Agent')) {
        // Generate a UI task specifically to trigger the Tri-Agent loop
        return `# Implementation Plan\n\n### Task 1.1: Implement Login UI\n**Description**: Create the login form UI\n**Instructions**: Create Login.tsx with an email field and submit button.\n**Expected Artifacts**: src/components/Login.tsx\n**RequirementIds**: ["1.1", "1.2"]\n**Phase**: 1`;
      }
      if (systemPrompt.includes('Master UI/UX Architect')) {
        if (userPrompt.includes('Design the UI/UX')) {
          return `## Design Blueprint\n- Use primary-blue for button\n- Layout: Centered card\n- Verdict: DESIGN COMPLETE`;
        }
        if (userPrompt.includes('Verify the implementation')) {
          return `## Verification Report\n- All elements present in semantic tree\n- Layout matches design\nVerdict: PASS`;
        }
        return `General UI response`;
      }
      if (systemPrompt.includes('Implementer')) {
        return JSON.stringify({
          success: true,
          compilationPassed: true,
          lintPassed: true,
          summary: 'Created Login.tsx with email and submit button',
          artifacts: ['src/components/Login.tsx'],
        });
      }
      if (systemPrompt.includes('Reviewer')) {
        return JSON.stringify({
          success: true,
          summary: 'Final review passed',
        });
      }
      return 'Default response';
    },
    readConstitution: async () => 'Project Constitution: Standard react app.',
    readMemory: async () => 'No memory available.',
  };

  // 2. Generate the Spec
  console.log('--- Stage 1: Generating Spec ---');
  const sw = new SpecWriterAgent(mockDeps);
  const architect = new ArchitectAgent(mockDeps);
  const td = new TaskDecomposerAgent(mockDeps);

  const reqs = await sw.generate(specDir, 'I want a simple login page.');
  const plan = await architect.generate(specDir, reqs.content);
  const tasks = await td.generate(specDir, reqs.content, plan.content);
  console.log('✅ Spec generated successfully');

  // 3. Setup Execution Environment
  console.log('\n--- Stage 2: Executing Spec with Browser Mirror ---');
  const executor = new SpecTaskExecutor();

  // Mock AgentLoop that the executor uses to talk to LLMs
  const mockAgentLoop = {
    execute: async (messages, updateCallback) => {
      const systemPrompt = messages[0].content;
      const userPrompt = messages[1].content;
      const response = await mockDeps.executeLLM(systemPrompt, userPrompt);

      updateCallback({ type: 'chunk', content: response });
      updateCallback({ type: 'complete' });
    },
  };

  // Initialize a real (but headless) browser session to verify the mirroring logic
  const browserSession = new ForgeBrowserSession();
  await browserSession.initialize(() => {}, 'about:blank');

  try {
    const result = await executor.executeSpec(
      specDir,
      mockAgentLoop,
      {},
      browserSession
    );

    console.log(`\n--- Final Result ---`);
    console.log(`Completed: ${result.completed}/${result.spec.tasks.length}`);
    console.log(`Failed: ${result.failed}`);

    if (result.failed === 0) {
      console.log('\n✅ SUCCESS: The full spec-driven pipeline including UI/UX design and Browser Mirror verification worked flawlessly!');
    } else {
      console.error('\n❌ FAILURE: The pipeline failed. See logs above.');
      process.exit(1);
    }
  } finally {
    await browserSession.terminate();
  }
}

runE2ETest().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
