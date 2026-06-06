/**
 * SpecSyncEngine
 *
 * Detects drift between the spec and the implemented codebase.
 * Requirements: 15
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SpecSyncReport {
  specPath: string;
  generatedAt: number;
  totalTasks: number;
  completedTasks: number;
  missingImplementations: string[];
  extraImplementations: string[];
  outdatedImplementations: Array<{ taskId: string; reason: string }>;
  driftScore: number;
  summary: string;
}

export class SpecSyncEngine {
  private readonly specDir: string;
  private readonly workspaceRoot: string;

  constructor(specDir: string, workspaceRoot: string) {
    this.specDir = specDir;
    this.workspaceRoot = workspaceRoot;
  }

  public analyze(): SpecSyncReport {
    const statusPath = path.join(this.specDir, 'status.json');
    let tasks: Array<{ id: string; status: string; expectedArtifacts: string[] }> = [];
    if (fs.existsSync(statusPath)) {
      try {
        const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8')) as {
          tasks?: Array<{ id: string; status: string; expectedArtifacts: string[] }>;
        };
        tasks = status.tasks || [];
      } catch {
        // ignore malformed status
      }
    }

    const missingImplementations: string[] = [];
    const extraImplementations: string[] = [];
    const outdatedImplementations: Array<{ taskId: string; reason: string }> = [];
    let completedTasks = 0;

    for (const task of tasks) {
      if (task.status === 'complete') {
        completedTasks++;
      }
      for (const artifact of task.expectedArtifacts) {
        const absolute = path.isAbsolute(artifact) ? artifact : path.join(this.workspaceRoot, artifact);
        if (!fs.existsSync(absolute)) {
          if (task.status === 'complete') {
            outdatedImplementations.push({
              taskId: task.id,
              reason: `Expected artifact missing: ${artifact}`,
            });
          } else {
            missingImplementations.push(artifact);
          }
        }
      }
    }

    const totalTasks = tasks.length || 1;
    const driftScore = Math.round(
      ((missingImplementations.length + outdatedImplementations.length) / totalTasks) * 100
    );

    return {
      specPath: this.specDir,
      generatedAt: Date.now(),
      totalTasks: tasks.length,
      completedTasks,
      missingImplementations,
      extraImplementations,
      outdatedImplementations,
      driftScore,
      summary: `Spec sync: ${completedTasks}/${tasks.length} tasks complete, drift score ${driftScore}%`,
    };
  }
}
