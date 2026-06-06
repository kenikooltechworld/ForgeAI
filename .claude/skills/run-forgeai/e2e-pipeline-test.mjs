import { SpecWriterAgent } from '../../../src/extension/spec/generators/SpecWriterAgent';
import { ArchitectAgent } from '../../../src/extension/spec/generators/ArchitectAgent';
import { TaskDecomposerAgent } from '../../../src/extension/spec/generators/TaskDecomposerAgent';
import { SpecTaskExecutor } from '../../../src/extension/spec/SpecTaskExecutor';
import { ForgeBrowserSession } from '../../../src/extension/services/ForgeBrowserSession';
import { PerTaskMultiAgentOrchestrator } from '../../../src/extension/spec/PerTaskMultiAgentOrchestrator';
import * as fs from 'fs';
import * as path from 'path';

/**
 * E2E Pipeline Smoke Test
 * Verifies the flow: Requirements -> Plan -> Tasks -> (UI/UX Design -> Implement -> Mirror Verify)
 */
async function runE2ETest() {
  const workspaceRoot = process.cwd();
  const specDir = path.join(workspaceRoot, '.forgeai/specs/test-ui-feature');
  if (fs.existsSync(specDir)) {
    fs.rmSync(specDir, { recursive: true, force: true });
  }
  fs.mkdirSync(specDir, { recursive: true });


  // 1. Mock Dependencies
  const mockDeps = {
    executeLLM: async (systemPrompt, userPrompt) => {
      console.log(`[LLM Call] Agent: ${systemPrompt.substring(0, 30)}...`);

      if (systemPrompt.includes('SpecWriter Agent')) {
        return `# Requirements: Login Page\n\n### Requirement 1.1: Email Input\n**User Story**: As a user, I want to enter my email\n#### Acceptance Criteria\n1. THE system SHALL provide a text field for email\n\n### Requirement 1.2: Submit Button\n**User Story**: As a user, I want to submit the form\n#### Acceptance Criteria\n1. THE system SHALL provide a submit button`;
      }
      if (systemPrompt.includes('Architect Agent')) {
        return `# Technical Plan: Login Page\n- Use React component\n- File: src/components/Login.tsx`;
      }
      if (systemPrompt.includes('TaskDecomposer Agent')) {
        return `# Implementation Plan\n\n### Phase 1: Foundation\n\n- [ ] 1.1 Implement Login UI\n  - Create Login.tsx with an email field and submit button.\n  - Verify visual layout.\n  _Requirements: 1.1, 1.2_`;
      }
      if (systemPrompt.includes('Master UI/UX Architect')) {
        if (userPrompt.includes('Design the UI/UX')) {
          return `## Design Blueprint\n- Use primary-blue for button\n- Layout: Centered card\nVerdict: DESIGN COMPLETE`;
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
    readMemory: async (file) => `Memory for ${file}: Standard react app.`,
    // Add generate method for the UIUXArchitectAgent
    generate: async (systemPrompt, userPrompt) => {
      return await mockDeps.executeLLM(systemPrompt, userPrompt);
    },
    logInfo: (msg) => console.log(`[INFO] ${msg}`),
    logError: (msg, err) => console.error(`[ERROR] ${msg}`, err),
    logWarn: (msg) => console.warn(`[WARN] ${msg}`),
  };

  const mockToolRegistry = {};
  const mockLogger = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${msg}`),
    error: (msg, err) => console.error(`[ERROR] ${msg}`, err),
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

  const orchestrator = new PerTaskMultiAgentOrchestrator(
    workspaceRoot,
    mockToolRegistry,
    mockDeps, // Use mockDeps as ollamaClient
    mockLogger
  );

  const executor = new SpecTaskExecutor(orchestrator);

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

    if (result.failed === 0 && result.completed > 0) {
      console.log('\n✅ SUCCESS: The full spec-driven pipeline including UI/UX design and Browser Mirror verification worked flawlessly!');
    } else if (result.completed === 0) {
      console.error('\n❌ FAILURE: No tasks were parsed from the spec. Check TaskDecomposer mock format.');
      process.exit(1);
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
