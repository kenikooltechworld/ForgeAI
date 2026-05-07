/**
 * Test Results Parser
 * Parses test output from various test frameworks and converts to TestResultsData format
 */

export interface TestCase {
  name: string;
  status: 'passed' | 'failed';
  duration: number; // milliseconds
  error?: string;
}

export interface TestFile {
  fileName: string;
  passed: number;
  failed: number;
  tests: TestCase[];
}

export interface TestResultsData {
  files: TestFile[];
  totalPassed: number;
  totalFailed: number;
  totalDuration: number; // seconds
}

/**
 * Parse test output and extract structured test results
 * Supports: Jest, Vitest, Mocha, Pytest, and other common test frameworks
 */
export class TestResultsParser {
  /**
   * Parse test output from stdout/stderr
   * @param output Test command output
   * @param exitCode Exit code from test command
   * @returns Structured test results data
   */
  public static parse(output: string, exitCode: number): TestResultsData | null {
    // Try different parsers in order
    const parsers = [
      this.parseVitest,
      this.parseJest,
      this.parseMocha,
      this.parsePytest,
      this.parseGeneric,
    ];

    for (const parser of parsers) {
      try {
        const result = parser.call(this, output, exitCode);
        if (result) {
          return result;
        }
      } catch (error) {
        // Continue to next parser
        continue;
      }
    }

    return null;
  }

  /**
   * Parse Vitest output
   */
  private static parseVitest(output: string, exitCode: number): TestResultsData | null {
    // Check if this is Vitest output
    if (!output.includes('Test Files') && !output.includes('PASS') && !output.includes('FAIL')) {
      return null;
    }

    const files: TestFile[] = [];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    // Extract test files and results
    const lines = output.split('\n');
    let currentFile: TestFile | null = null;

    for (const line of lines) {
      // Match test file: ✓ src/utils.test.ts (5)
      const fileMatch = line.match(/[✓✗]\s+(.+\.test\.[jt]sx?)\s+\((\d+)\)/);
      if (fileMatch) {
        if (currentFile) {
          files.push(currentFile);
        }

        const fileName = fileMatch[1];
        const testCount = parseInt(fileMatch[2], 10);
        const isPassed = line.includes('✓');

        currentFile = {
          fileName,
          passed: isPassed ? testCount : 0,
          failed: isPassed ? 0 : testCount,
          tests: [],
        };
      }

      // Match individual test: ✓ should return correct value (2ms)
      const testMatch = line.match(/[✓✗]\s+(.+?)\s+\((\d+)ms\)/);
      if (testMatch && currentFile) {
        const testName = testMatch[1].trim();
        const duration = parseInt(testMatch[2], 10);
        const isPassed = line.includes('✓');

        currentFile.tests.push({
          name: testName,
          status: isPassed ? 'passed' : 'failed',
          duration,
        });

        if (isPassed) {
          totalPassed++;
        } else {
          totalFailed++;
        }
      }

      // Extract total duration: Test Files  2 passed (2) | Duration 1.23s
      const durationMatch = line.match(/Duration\s+([\d.]+)s/);
      if (durationMatch) {
        totalDuration = parseFloat(durationMatch[1]);
      }
    }

    if (currentFile) {
      files.push(currentFile);
    }

    if (files.length === 0) {
      return null;
    }

    return {
      files,
      totalPassed,
      totalFailed,
      totalDuration,
    };
  }

  /**
   * Parse Jest output
   */
  private static parseJest(output: string, exitCode: number): TestResultsData | null {
    // Check if this is Jest output
    if (!output.includes('PASS') && !output.includes('FAIL') && !output.includes('Test Suites')) {
      return null;
    }

    const files: TestFile[] = [];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    // Similar parsing logic for Jest
    // (Simplified for now - can be expanded)

    const lines = output.split('\n');
    let currentFile: TestFile | null = null;

    for (const line of lines) {
      // Match test file: PASS src/utils.test.ts
      const fileMatch = line.match(/(PASS|FAIL)\s+(.+\.test\.[jt]sx?)/);
      if (fileMatch) {
        if (currentFile) {
          files.push(currentFile);
        }

        const status = fileMatch[1];
        const fileName = fileMatch[2];

        currentFile = {
          fileName,
          passed: 0,
          failed: 0,
          tests: [],
        };
      }

      // Match individual test: ✓ should return correct value (2 ms)
      const testMatch = line.match(/[✓✗]\s+(.+?)\s+\((\d+)\s*ms\)/);
      if (testMatch && currentFile) {
        const testName = testMatch[1].trim();
        const duration = parseInt(testMatch[2], 10);
        const isPassed = line.includes('✓');

        currentFile.tests.push({
          name: testName,
          status: isPassed ? 'passed' : 'failed',
          duration,
        });

        if (isPassed) {
          currentFile.passed++;
          totalPassed++;
        } else {
          currentFile.failed++;
          totalFailed++;
        }
      }
    }

    if (currentFile) {
      files.push(currentFile);
    }

    // Extract duration from summary
    const durationMatch = output.match(/Time:\s+([\d.]+)\s*s/);
    if (durationMatch) {
      totalDuration = parseFloat(durationMatch[1]);
    }

    if (files.length === 0) {
      return null;
    }

    return {
      files,
      totalPassed,
      totalFailed,
      totalDuration,
    };
  }

  /**
   * Parse Mocha output
   */
  private static parseMocha(output: string, exitCode: number): TestResultsData | null {
    // Check if this is Mocha output
    if (!output.includes('passing') && !output.includes('failing')) {
      return null;
    }

    // Simplified Mocha parser
    const files: TestFile[] = [];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    // Extract summary: 17 passing (2s)
    const passingMatch = output.match(/(\d+)\s+passing/);
    if (passingMatch) {
      totalPassed = parseInt(passingMatch[1], 10);
    }

    const failingMatch = output.match(/(\d+)\s+failing/);
    if (failingMatch) {
      totalFailed = parseInt(failingMatch[1], 10);
    }

    const durationMatch = output.match(/\((\d+(?:\.\d+)?)\s*s\)/);
    if (durationMatch) {
      totalDuration = parseFloat(durationMatch[1]);
    }

    // Create a single file entry (Mocha doesn't always show file names)
    if (totalPassed > 0 || totalFailed > 0) {
      files.push({
        fileName: 'test suite',
        passed: totalPassed,
        failed: totalFailed,
        tests: [],
      });
    }

    if (files.length === 0) {
      return null;
    }

    return {
      files,
      totalPassed,
      totalFailed,
      totalDuration,
    };
  }

  /**
   * Parse Pytest output
   */
  private static parsePytest(output: string, exitCode: number): TestResultsData | null {
    // Check if this is Pytest output
    if (!output.includes('passed') && !output.includes('failed') && !output.includes('pytest')) {
      return null;
    }

    const files: TestFile[] = [];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    // Extract summary: 17 passed in 2.3s
    const summaryMatch = output.match(/(\d+)\s+passed(?:,\s+(\d+)\s+failed)?\s+in\s+([\d.]+)s/);
    if (summaryMatch) {
      totalPassed = parseInt(summaryMatch[1], 10);
      totalFailed = summaryMatch[2] ? parseInt(summaryMatch[2], 10) : 0;
      totalDuration = parseFloat(summaryMatch[3]);
    }

    // Create a single file entry
    if (totalPassed > 0 || totalFailed > 0) {
      files.push({
        fileName: 'test suite',
        passed: totalPassed,
        failed: totalFailed,
        tests: [],
      });
    }

    if (files.length === 0) {
      return null;
    }

    return {
      files,
      totalPassed,
      totalFailed,
      totalDuration,
    };
  }

  /**
   * Generic parser for unknown test frameworks
   * Attempts to extract basic pass/fail counts
   */
  private static parseGeneric(output: string, exitCode: number): TestResultsData | null {
    // Look for common patterns
    const passedMatch = output.match(/(\d+)\s+(?:passed|pass|ok)/i);
    const failedMatch = output.match(/(\d+)\s+(?:failed|fail|error)/i);

    if (!passedMatch && !failedMatch) {
      return null;
    }

    const totalPassed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
    const totalFailed = failedMatch ? parseInt(failedMatch[1], 10) : 0;

    // Estimate duration from exit code (0 = success, non-zero = failure)
    const totalDuration = 0;

    const files: TestFile[] = [
      {
        fileName: 'test suite',
        passed: totalPassed,
        failed: totalFailed,
        tests: [],
      },
    ];

    return {
      files,
      totalPassed,
      totalFailed,
      totalDuration,
    };
  }
}
