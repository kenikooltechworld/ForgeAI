/**
 * SpecReader unit tests
 * Verifies parsing of requirements.md and tasks.md into executable tasks
 */

import { SpecReader } from '../SpecReader';
import { ParsedSpec, TaskStatus } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'specreader-test-'));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('SpecReader', () => {
  let reader: SpecReader;
  let tmpDir: string;

  beforeEach(() => {
    reader = new SpecReader();
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  describe('parseRequirements', () => {
    it('should parse simple requirements with EARS criteria', () => {
      const content = `
### Requirement 1: User Authentication
**User Story:** As a user, I want to log in, so that I can access my account.
#### Acceptance Criteria
1. WHEN the user enters valid credentials THEN the system SHALL authenticate them.
2. THE system SHALL reject invalid credentials.

### Requirement 2: Data Export
**User Story:** As a user, I want to export my data, so that I have a backup.
#### Acceptance Criteria
1. WHEN the user clicks export THEN the system SHALL generate a file.
`;
      const reqs = reader.parseRequirements(content);
      expect(reqs).toHaveLength(2);
      expect(reqs[0].id).toBe('1');
      expect(reqs[0].title).toBe('User Authentication');
      expect(reqs[0].userStory).toBe(
        'As a user, I want to log in, so that I can access my account.'
      );
      expect(reqs[0].acceptanceCriteria).toHaveLength(2);
      expect(reqs[0].acceptanceCriteria[0].pattern).toBe('event-driven');
      expect(reqs[0].acceptanceCriteria[1].pattern).toBe('ubiquitous');
    });

    it('should detect optional pattern with WHERE clause', () => {
      const content = `
### Requirement 3: Dark Mode
#### Acceptance Criteria
1. WHERE the user prefers dark mode THEN the system SHALL use dark colors.
`;
      const reqs = reader.parseRequirements(content);
      expect(reqs[0].acceptanceCriteria[0].pattern).toBe('optional');
    });

    it('should detect unwanted behavior with IF clause', () => {
      const content = `
### Requirement 4: Error Handling
#### Acceptance Criteria
1. IF the database is unreachable THEN the system SHALL show a retry button.
`;
      const reqs = reader.parseRequirements(content);
      expect(reqs[0].acceptanceCriteria[0].pattern).toBe('unwanted-behavior');
    });

    it('should return empty array for empty content', () => {
      expect(reader.parseRequirements('')).toHaveLength(0);
    });
  });

  describe('parseTasks', () => {
    it('should parse tasks with phases and instructions', () => {
      const content = `
### Phase 1: Foundation
- [ ] 1.1 Create auth module
  - Implement login form
  - Add password validation
  _Requirements: 1_

- [ ] 1.2 Add session management
  - Store session tokens securely
  _Requirements: 1_

### Phase 2: Features
- [ ] 2.1 Implement data export
  - Support CSV and JSON formats
  _Requirements: 2_

- [x] 2.2 Add export progress bar
  _Requirements: 2_
`;
      const { tasks } = reader.parseTasks(content);
      expect(tasks).toHaveLength(4);

      // Task 1.1
      expect(tasks[0].id).toBe('1.1');
      expect(tasks[0].phase).toBe(1);
      expect(tasks[0].description).toBe('Create auth module');
      expect(tasks[0].status).toBe('pending');
      expect(tasks[0].instructions).toContain('Implement login form');
      expect(tasks[0].instructions).toContain('Add password validation');
      expect(tasks[0].requirementIds).toEqual(['1']);

      // Task 2.2 should be complete (checked)
      const task22 = tasks.find((t) => t.id === '2.2');
      expect(task22?.status).toBe('complete');
    });

    it('should detect checkpoints', () => {
      const content = `
### Phase 1: Foundation
- [ ] 1.1 Checkpoint - Review auth module
  - Verify login works
`;
      const { tasks } = reader.parseTasks(content);
      expect(tasks[0].isCheckpoint).toBe(true);
    });

    it('should infer dependencies between tasks', () => {
      const content = `
### Phase 1: Foundation
- [ ] 1.1 First task
- [ ] 1.2 Second task
### Phase 2: Build
- [ ] 2.1 Third task
`;
      const { tasks } = reader.parseTasks(content);
      const t12 = tasks.find((t) => t.id === '1.2');
      const t21 = tasks.find((t) => t.id === '2.1');

      expect(t12?.dependencies).toContain('1.1');
      expect(t21?.dependencies).toContain('1.2');
    });
  });

  describe('parseSpecDirectory', () => {
    it('should parse a complete spec directory', async () => {
      fs.writeFileSync(
        path.join(tmpDir, 'requirements.md'),
        `### Requirement 1: Test Feature
**User Story:** As a user, I want tests to pass.
#### Acceptance Criteria
1. THE system SHALL pass all tests.
`
      );
      fs.writeFileSync(
        path.join(tmpDir, 'tasks.md'),
        `### Phase 1: Setup
- [ ] 1.1 Write tests
  - Create test files
  _Requirements: 1_
`
      );

      const spec = await reader.parseSpecDirectory(tmpDir);
      expect(spec.id).toBe(path.basename(tmpDir));
      expect(spec.requirements).toHaveLength(1);
      expect(spec.tasks).toHaveLength(1);
      expect(spec.phases).toHaveLength(1);
      expect(spec.progress).toBe(0);
    });

    it('should handle missing files gracefully', async () => {
      const spec = await reader.parseSpecDirectory(tmpDir);
      expect(spec.requirements).toHaveLength(0);
      expect(spec.tasks).toHaveLength(0);
      expect(spec.progress).toBe(0);
    });

    it('should load saved status from .status file', async () => {
      fs.writeFileSync(
        path.join(tmpDir, 'requirements.md'),
        `### Requirement 1: Test
#### Acceptance Criteria
1. THE system SHALL work.
`
      );
      fs.writeFileSync(
        path.join(tmpDir, 'tasks.md'),
        `### Phase 1: Setup
- [ ] 1.1 Do something
- [ ] 1.2 Do more
`
      );
      fs.writeFileSync(
        path.join(tmpDir, '.status'),
        JSON.stringify({
          specId: 'test',
          updatedAt: Date.now(),
          progress: 50,
          tasks: [
            {
              id: '1.1',
              status: 'complete',
              retryCount: 0,
              producedArtifacts: [],
              error: undefined,
            },
            {
              id: '1.2',
              status: 'pending',
              retryCount: 0,
              producedArtifacts: [],
              error: undefined,
            },
          ],
        })
      );

      const spec = await reader.parseSpecDirectory(tmpDir);
      const t11 = spec.tasks.find((t) => t.id === '1.1');
      const t12 = spec.tasks.find((t) => t.id === '1.2');
      expect(t11?.status).toBe('complete');
      expect(t12?.status).toBe('pending');
      expect(spec.progress).toBe(50);
    });
  });

  describe('getNextTask', () => {
    it('should return the first ready task', async () => {
      fs.writeFileSync(
        path.join(tmpDir, 'tasks.md'),
        `### Phase 1: Setup
- [ ] 1.1 First
- [ ] 1.2 Second (depends on 1.1)
`
      );

      const spec = await reader.parseSpecDirectory(tmpDir);
      const next = reader.getNextTask(spec);
      expect(next?.id).toBe('1.1');
    });

    it('should return null when no tasks are ready', async () => {
      fs.writeFileSync(
        path.join(tmpDir, 'tasks.md'),
        `### Phase 1: Setup
- [x] 1.1 First
`
      );

      const spec = await reader.parseSpecDirectory(tmpDir);
      const next = reader.getNextTask(spec);
      expect(next).toBeNull();
    });
  });

  describe('saveStatus', () => {
    it('should persist task status to .status file', async () => {
      fs.writeFileSync(
        path.join(tmpDir, 'tasks.md'),
        `### Phase 1: Setup
- [ ] 1.1 First task
`
      );

      const spec = await reader.parseSpecDirectory(tmpDir);
      spec.tasks[0].status = 'complete' as TaskStatus;
      spec.tasks[0].producedArtifacts = ['src/test.ts'];
      spec.progress = 100;
      reader.saveStatus(spec);

      const statusPath = path.join(tmpDir, '.status');
      expect(fs.existsSync(statusPath)).toBe(true);

      const saved = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
      expect(saved.progress).toBe(100);
      expect(saved.tasks[0].status).toBe('complete');
      expect(saved.tasks[0].producedArtifacts).toEqual(['src/test.ts']);
    });
  });
});
