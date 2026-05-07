import { useState } from 'react';
import {
  TestTube,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/**
 * Test file result with individual test cases
 */
interface TestFile {
  fileName: string;
  passed: number;
  failed: number;
  tests: TestCase[];
}

/**
 * Individual test case result
 */
interface TestCase {
  name: string;
  status: 'passed' | 'failed';
  duration: number; // milliseconds
  error?: string;
}

/**
 * Test results data structure
 */
export interface TestResultsData {
  files: TestFile[];
  totalPassed: number;
  totalFailed: number;
  totalDuration: number; // seconds
}

interface TestResultsProps {
  results: TestResultsData;
  onRunAgain?: () => void;
}

/**
 * TestResults Component (Task 9.1)
 * Displays test execution results in the preview panel
 *
 * Requirements: 13.2
 * Design: LivePreview component with test results view
 * UI/UX: Professional test results view with pass/fail status
 */
function TestResults({ results, onRunAgain }: TestResultsProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [showErrorDetails, setShowErrorDetails] = useState<Set<string>>(new Set());

  const totalTests = results.totalPassed + results.totalFailed;
  const allPassed = results.totalFailed === 0;

  /**
   * Toggle file expansion to show/hide individual tests
   */
  const toggleFileExpansion = (fileName: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      return next;
    });
  };

  /**
   * Toggle error details for a specific test
   */
  const toggleErrorDetails = (testId: string) => {
    setShowErrorDetails((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  /**
   * Get status icon component and color for test file
   */
  const getFileStatus = (file: TestFile) => {
    if (file.failed === 0) {
      return { Icon: CheckCircle, color: 'text-(--vscode-testing-iconPassed)' };
    } else if (file.passed === 0) {
      return { Icon: XCircle, color: 'text-(--vscode-testing-iconFailed)' };
    } else {
      return { Icon: AlertTriangle, color: 'text-(--vscode-testing-iconQueued)' };
    }
  };

  /**
   * Format duration in milliseconds to readable string
   */
  const formatDuration = (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="flex flex-col h-full bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-(--vscode-panel-border)">
        <TestTube size={20} style={{ color: 'var(--vscode-editor-foreground)' }} />
        <h2 className="text-base font-semibold">Test Results</h2>
      </div>

      {/* Test Files List */}
      <div className="flex-1 overflow-y-auto p-4">
        {results.files.map((file) => {
          const status = getFileStatus(file);
          const isExpanded = expandedFiles.has(file.fileName);
          const totalFileTests = file.passed + file.failed;

          return (
            <div key={file.fileName} className="mb-4">
              {/* File Header */}
              <button
                type="button"
                onClick={() => toggleFileExpansion(file.fileName)}
                className="w-full flex items-center gap-2 p-2 rounded hover:bg-(--vscode-list-hoverBackground) transition-colors text-left"
              >
                <status.Icon
                  size={16}
                  style={{
                    color: `var(--vscode-testing-icon${file.failed === 0 ? 'Passed' : file.passed === 0 ? 'Failed' : 'Queued'})`,
                  }}
                />
                <span className="text-sm font-medium flex-1">{file.fileName}</span>
                <span className="text-xs text-(--vscode-descriptionForeground)">
                  ({file.passed}/{totalFileTests} passed)
                </span>
                {isExpanded ? (
                  <ChevronUp size={14} style={{ color: 'var(--vscode-descriptionForeground)' }} />
                ) : (
                  <ChevronDown size={14} style={{ color: 'var(--vscode-descriptionForeground)' }} />
                )}
              </button>

              {/* Individual Tests (when expanded) */}
              {isExpanded && (
                <div className="ml-6 mt-2 space-y-1">
                  {file.tests.map((test, index) => {
                    const testId = `${file.fileName}-${index}`;
                    const showError = showErrorDetails.has(testId);

                    return (
                      <div key={testId} className="text-sm">
                        {/* Test Name and Status */}
                        <div className="flex items-center gap-2 py-1">
                          {test.status === 'passed' ? (
                            <Check
                              size={14}
                              style={{ color: 'var(--vscode-testing-iconPassed)' }}
                            />
                          ) : (
                            <X size={14} style={{ color: 'var(--vscode-testing-iconFailed)' }} />
                          )}
                          <span className="flex-1">{test.name}</span>
                          <span className="text-xs text-(--vscode-descriptionForeground)">
                            ({formatDuration(test.duration)})
                          </span>
                        </div>

                        {/* Error Message (for failed tests) */}
                        {test.status === 'failed' && test.error && (
                          <div className="ml-6 mt-1">
                            <button
                              type="button"
                              onClick={() => toggleErrorDetails(testId)}
                              className="text-xs text-(--vscode-textLink-foreground) hover:underline"
                            >
                              {showError ? 'Hide error' : 'View error'}
                            </button>
                            {showError && (
                              <pre className="mt-1 p-2 rounded bg-(--vscode-textBlockQuote-background) text-(--vscode-errorForeground) text-xs overflow-x-auto whitespace-pre-wrap">
                                {test.error}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Section */}
      <div className="border-t border-(--vscode-panel-border) p-4 bg-(--vscode-sideBar-background)">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {allPassed ? (
              <Check size={16} style={{ color: 'var(--vscode-testing-iconPassed)' }} />
            ) : (
              <X size={16} style={{ color: 'var(--vscode-testing-iconFailed)' }} />
            )}
            <span className="text-sm font-semibold">
              Summary: {results.totalPassed}/{totalTests} tests passed
            </span>
          </div>
          <span className="text-xs text-(--vscode-descriptionForeground)">
            Duration: {results.totalDuration.toFixed(2)}s
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              // Expand all files to show details
              const allFiles = new Set(results.files.map((f) => f.fileName));
              setExpandedFiles(allFiles);
            }}
            className="flex-1 px-3 py-2 text-sm rounded border border-(--vscode-button-border) bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground) hover:bg-(--vscode-button-secondaryHoverBackground) transition-colors"
          >
            View Details
          </button>
          {onRunAgain && (
            <button
              type="button"
              onClick={onRunAgain}
              className="flex-1 px-3 py-2 text-sm rounded border border-(--vscode-button-border) bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground) transition-colors"
            >
              Run Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TestResults;
