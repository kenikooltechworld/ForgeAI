import { useState } from 'react';

import { AlertTriangle } from 'lucide-react';

interface MaxIterationsWarningProps {
  message: string;
  context?: {
    lastThinking?: string;
    lastContent?: string;
    recentTools?: string[];
    totalIterations?: number;
  };
  onContinue: () => void;
  onCancel: () => void;
}

/**
 * MaxIterationsWarning Component
 *
 * Displays an interactive warning when the agent loop reaches maximum iterations.
 * Shows context about what the agent was doing and provides Continue/Cancel buttons.
 *
 * Requirements: 48.1, 48.2, 20.4
 * Task: 13.2
 */
export function MaxIterationsWarning({
  message,
  context,
  onContinue,
  onCancel,
}: MaxIterationsWarningProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="my-4 rounded border border-[var(--vscode-inputValidation-warningBorder)] bg-[var(--vscode-inputValidation-warningBackground)] p-4"
      role="alert"
      aria-live="polite"
    >
      {/* Header with icon and message */}
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={24}
          style={{ color: 'var(--vscode-editorWarning-foreground)' }}
          aria-hidden="true"
        />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--vscode-editor-foreground)]">
            Maximum Iterations Reached
          </h3>
          <p className="mt-1 text-sm text-[var(--vscode-descriptionForeground)]">
            The agent has completed {context?.totalIterations || 20} iterations but the task may not
            be fully complete.
          </p>

          {/* Context section (expandable) */}
          {context && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-[var(--vscode-textLink-foreground)] hover:underline"
              >
                {isExpanded ? '▼ Hide details' : '▶ Show what the agent was doing'}
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-2 rounded bg-[var(--vscode-editor-background)] p-3 text-xs">
                  {/* Recent tools used */}
                  {context.recentTools && context.recentTools.length > 0 && (
                    <div>
                      <div className="font-semibold text-[var(--vscode-editor-foreground)]">
                        Recent tools used:
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {context.recentTools.map((tool, index) => (
                          <span
                            key={index}
                            className="rounded bg-[var(--vscode-badge-background)] px-2 py-0.5 text-[var(--vscode-badge-foreground)]"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Last thinking */}
                  {context.lastThinking && (
                    <div>
                      <div className="font-semibold text-[var(--vscode-editor-foreground)]">
                        Last reasoning:
                      </div>
                      <div className="mt-1 max-h-32 overflow-y-auto text-[var(--vscode-descriptionForeground)]">
                        {context.lastThinking.slice(0, 300)}
                        {context.lastThinking.length > 300 && '...'}
                      </div>
                    </div>
                  )}

                  {/* Last content */}
                  {context.lastContent && (
                    <div>
                      <div className="font-semibold text-[var(--vscode-editor-foreground)]">
                        Last message:
                      </div>
                      <div className="mt-1 max-h-32 overflow-y-auto text-[var(--vscode-descriptionForeground)]">
                        {context.lastContent.slice(0, 300)}
                        {context.lastContent.length > 300 && '...'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onContinue}
              className="rounded bg-[var(--vscode-button-background)] px-4 py-2 text-sm font-medium text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
            >
              Continue (20 more iterations)
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-[var(--vscode-button-border)] bg-[var(--vscode-button-secondaryBackground)] px-4 py-2 text-sm font-medium text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] focus:outline-none focus:ring-2 focus:ring-[var(--vscode-focusBorder)]"
            >
              Cancel
            </button>
          </div>

          {/* Help text */}
          <p className="mt-3 text-xs text-[var(--vscode-descriptionForeground)]">
            <strong>Continue:</strong> The agent will get 20 more iterations to complete the task.
            <br />
            <strong>Cancel:</strong> Stop here and review what was completed.
          </p>
        </div>
      </div>
    </div>
  );
}
