/**
 * SpecComplianceChecker unit tests
 * Verifies task output against acceptance criteria
 */

import { SpecComplianceChecker } from '../SpecComplianceChecker';
import { ExecutableTask, ParsedSpec } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'compliance-test-'));
}

describe('SpecComplianceChecker', () => {
  let checker: SpecComplianceChecker;
  let tmpDir: string;

  beforeEach(() => {
    checker = new SpecComplianceChecker();
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('check', () => {
    it('should pass when all artifacts exist', () => {
      // Create expected artifact
      fs.writeFileSync(path.join(tmpDir, 'test-file.ts'), 'export const x = 1;');

      const task: ExecutableTask = {
        id: '1.1',
        phase: 1,
        description: 'Create test file',
        instructions: ['Create src/test-file.ts'],
        requirementIds: ['1'],
        propertyTests: [],
        dependencies: [],
        status: 'complete',
        expectedArtifacts: ['test-file.ts'],
        retryCount: 0,
        maxRetries: 2,
        isCheckpoint: false,
        isPropertyTest: false,
        producedArtifacts: ['test-file.ts'],
      };

      const spec: ParsedSpec = {
        id: 'test-spec',
        specPath: tmpDir,
        requirements: [
          {
            id: '1',
            title: 'Test requirement',
            acceptanceCriteria: [
              {
                pattern: 'ubiquitous',
                text: 'THE system SHALL create the file.',
                requirementIds: ['1'],
              },
            ],
            inScope: [],
            outOfScope: [],
          },
        ],
        tasks: [task],
        phases: [],
        dependencyGraph: new Map(),
        phaseTitles: new Map(),
        progress: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 1,
      };

      const result = checker.check(task, spec, tmpDir);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.criterionResults).toHaveLength(3); // artifact + acceptance criterion + instruction check
    });

    it('should fail when artifact is missing', () => {
      const task: ExecutableTask = {
        id: '1.1',
        phase: 1,
        description: 'Create missing file',
        instructions: ['Create src/missing.ts'],
        requirementIds: ['1'],
        propertyTests: [],
        dependencies: [],
        status: 'pending',
        expectedArtifacts: ['missing.ts'],
        retryCount: 0,
        maxRetries: 2,
        isCheckpoint: false,
        isPropertyTest: false,
        producedArtifacts: [],
      };

      const spec: ParsedSpec = {
        id: 'test-spec',
        specPath: tmpDir,
        requirements: [],
        tasks: [task],
        phases: [],
        dependencyGraph: new Map(),
        phaseTitles: new Map(),
        progress: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 1,
      };

      const result = checker.check(task, spec, tmpDir);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should fail when instructions exist but cannot be verified (no artifacts)', () => {
      const task: ExecutableTask = {
        id: '1.1',
        phase: 1,
        description: 'Simple task',
        instructions: ['Do something'],
        requirementIds: [],
        propertyTests: [],
        dependencies: [],
        status: 'pending',
        expectedArtifacts: [],
        retryCount: 0,
        maxRetries: 2,
        isCheckpoint: false,
        isPropertyTest: false,
        producedArtifacts: [],
      };

      const spec: ParsedSpec = {
        id: 'test-spec',
        specPath: tmpDir,
        requirements: [],
        tasks: [task],
        phases: [],
        dependencyGraph: new Map(),
        phaseTitles: new Map(),
        progress: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 1,
      };

      const result = checker.check(task, spec, tmpDir);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should pass when no artifacts and no instructions to verify', () => {
      const task: ExecutableTask = {
        id: '1.1',
        phase: 1,
        description: 'Simple task',
        instructions: [],
        requirementIds: [],
        propertyTests: [],
        dependencies: [],
        status: 'pending',
        expectedArtifacts: [],
        retryCount: 0,
        maxRetries: 2,
        isCheckpoint: false,
        isPropertyTest: false,
        producedArtifacts: [],
      };

      const spec: ParsedSpec = {
        id: 'test-spec',
        specPath: tmpDir,
        requirements: [],
        tasks: [task],
        phases: [],
        dependencyGraph: new Map(),
        phaseTitles: new Map(),
        progress: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 1,
      };

      const result = checker.check(task, spec, tmpDir);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });
  });
});
