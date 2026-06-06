/**
 * HealthScanner
 *
 * Project health checks: lint, tests, TypeScript, git status, and broken imports.
 * Requirements: 8
 */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface HealthCheckResult {
  name: string;
  passed: boolean;
  output: string;
  durationMs: number;
}

export interface HealthReport {
  projectRoot: string;
  generatedAt: number;
  overallHealthy: boolean;
  checks: HealthCheckResult[];
  summary: string;
}

export class HealthScanner {
  constructor(private readonly projectRoot: string) {}

  public async runAll(): Promise<HealthReport> {
    const checks = await Promise.all([
      this.runCheck('TypeScript', async () => this.runCommand('npx tsc --noEmit', 60000)),
      this.runCheck('ESLint', async () => this.runCommand('npx eslint --ext .ts,.tsx src/ --max-warnings=0', 60000)),
      this.runCheck('Tests', async () => this.runCommand('npx jest --passWithNoTests --silent', 120000)),
      this.runCheck('Git status', async () => this.runGitStatus()),
      this.runCheck('Dependencies', async () => this.runDependencyCheck()),
    ]);

    const overallHealthy = checks.every((c) => c.passed);

    return {
      projectRoot: this.projectRoot,
      generatedAt: Date.now(),
      overallHealthy,
      checks,
      summary: overallHealthy ? 'Project healthy' : `Project has ${checks.filter((c) => !c.passed).length} failing checks`,
    };
  }

  private async runCheck(name: string, fn: () => Promise<{ passed: boolean; output: string; durationMs: number }>): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const result = await fn();
      return {
        name,
        passed: result.passed,
        output: result.output,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        name,
        passed: false,
        output: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
      };
    }
  }

  private async runCommand(command: string, timeoutMs: number): Promise<{ passed: boolean; output: string; durationMs: number }> {
    return new Promise((resolve) => {
      const proc = cp.spawn(command, { shell: true, cwd: this.projectRoot });
      let stdout = '';
      let stderr = '';
      const start = Date.now();
      const timer = setTimeout(() => {
        proc.kill();
        resolve({ passed: false, output: `Command timed out after ${timeoutMs}ms: ${command}`, durationMs: Date.now() - start });
      }, timeoutMs);

      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        clearTimeout(timer);
        const passed = code === 0;
        const output = passed ? stdout || 'OK' : stderr || stdout || `Exit code: ${code}`;
        resolve({ passed, output, durationMs: Date.now() - start });
      });
    });
  }

  private async runGitStatus(): Promise<{ passed: boolean; output: string; durationMs: number }> {
    const start = Date.now();
    const gitDir = path.join(this.projectRoot, '.git');
    if (!fs.existsSync(gitDir)) {
      return { passed: true, output: 'Not a git repo — skipped', durationMs: Date.now() - start };
    }

    const result = await this.runCommand('git status --porcelain', 10000);
    if (result.passed) {
      return { passed: true, output: 'Working tree clean', durationMs: Date.now() - start };
    }

    const changed = result.output.trim().split('\n').filter(Boolean).length;
    return {
      passed: false,
      output: `Dirty working tree: ${changed} changed file(s). ${result.output}`,
      durationMs: Date.now() - start,
    };
  }

  private async runDependencyCheck(): Promise<{ passed: boolean; output: string; durationMs: number }> {
    const start = Date.now();
    const packagePath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(packagePath)) {
      return { passed: true, output: 'No package.json — skipped', durationMs: Date.now() - start };
    }

    const lockfile = fs.existsSync(path.join(this.projectRoot, 'package-lock.json'))
      ? 'npm ci'
      : 'npm install';

    const result = await this.runCommand(lockfile, 120000);
    return { ...result, durationMs: Date.now() - start };
  }
}
