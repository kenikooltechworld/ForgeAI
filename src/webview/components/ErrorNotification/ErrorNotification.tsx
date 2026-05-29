import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, SkipForward, ExternalLink, X, Pin } from 'lucide-react';

export type ErrorType =
  | 'OLLAMA_CONNECTION'
  | 'OLLAMA_MODEL_NOT_FOUND'
  | 'OLLAMA_TIMEOUT'
  | 'OLLAMA_SERVICE_UNAVAILABLE'
  | 'OLLAMA_BAD_REQUEST'
  | 'CONTEXT_OVERFLOW'
  | 'TOOL_EXECUTION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface ErrorNotificationProps {
  errorType: ErrorType;
  title: string;
  message: string;
  onRetry?: () => void;
  onSkip?: () => void;
  onDismiss: () => void;
  autoDismiss?: boolean; // default: true
  dismissTimeout?: number; // default: 10000ms
}

/**
 * ErrorNotification Component
 * Displays errors in activity stream with appropriate styling and action buttons
 * Task 16.1 - Error notification system with auto-dismiss and pin functionality
 */
export function ErrorNotification({
  errorType,
  title,
  message,
  onRetry,
  onSkip,
  onDismiss,
  autoDismiss = true,
  dismissTimeout = 10000,
}: ErrorNotificationProps) {
  const [isPinned, setIsPinned] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(dismissTimeout);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Auto-dismiss timer with countdown
  useEffect(() => {
    // Only auto-dismiss if explicitly enabled AND timeout > 0
    if (!autoDismiss || dismissTimeout === 0 || isPinned) {
      return;
    }

    startTimeRef.current = Date.now();
    setTimeRemaining(dismissTimeout);

    // Update countdown every 100ms for smooth progress
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, dismissTimeout - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        onDismiss();
      }
    }, 100);

    timerRef.current = intervalId;

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [autoDismiss, dismissTimeout, isPinned, onDismiss]);

  // Handle pin toggle
  const handlePinToggle = () => {
    setIsPinned(!isPinned);
  };

  // Handle retry action
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
    onDismiss();
  };

  // Handle skip action
  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
    onDismiss();
  };

  // Handle report issue action
  const handleReportIssue = () => {
    const issueTitle = encodeURIComponent(`[Error] ${title}`);
    const issueBody = encodeURIComponent(
      `**Error Type:** ${errorType}\n\n**Message:** ${message}\n\n**Additional Context:**\n<!-- Please add any additional context about the error here -->`
    );
    const githubUrl = `https://github.com/yourusername/forgeai/issues/new?title=${issueTitle}&body=${issueBody}`;

    window.vscode.postMessage({
      type: 'openExternal',
      url: githubUrl,
    });
  };

  // Get action buttons based on error type
  const getActionButtons = () => {
    switch (errorType) {
      case 'OLLAMA_CONNECTION':
        return (
          <>
            <button
              onClick={() => {
                window.vscode.postMessage({
                  type: 'openExternal',
                  url: 'https://docs.ollama.com',
                });
              }}
              className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-button-border) bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
            >
              <ExternalLink size={12} />
              Open Docs
            </button>
            {onRetry && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-button-border) bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
          </>
        );

      case 'OLLAMA_MODEL_NOT_FOUND':
        return (
          <>
            <button
              onClick={() => {
                window.vscode.postMessage({
                  type: 'openExternal',
                  url: 'https://docs.ollama.com',
                });
              }}
              className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-button-border) bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
            >
              <ExternalLink size={12} />
              View Models
            </button>
            {onRetry && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-button-border) bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
          </>
        );

      case 'OLLAMA_TIMEOUT':
        return (
          <>
            {onRetry && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-button-border) bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
            {onSkip && (
              <button
                onClick={handleSkip}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-input-border) bg-(--vscode-input-background) text-(--vscode-input-foreground) hover:bg-(--vscode-inputOption-hoverBackground)"
              >
                <SkipForward size={12} />
                Skip
              </button>
            )}
          </>
        );

      case 'OLLAMA_SERVICE_UNAVAILABLE':
      case 'CONTEXT_OVERFLOW':
      case 'OLLAMA_BAD_REQUEST':
        return (
          <>
            {onRetry && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-button-border) bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
          </>
        );

      case 'TOOL_EXECUTION_ERROR':
        return (
          <>
            {onRetry && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-button-border) bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
            {onSkip && (
              <button
                onClick={handleSkip}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-input-border) bg-(--vscode-input-background) text-(--vscode-input-foreground) hover:bg-(--vscode-inputOption-hoverBackground)"
              >
                <SkipForward size={12} />
                Skip
              </button>
            )}
          </>
        );

      case 'NETWORK_ERROR':
        return (
          <>
            {onRetry && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-button-border) bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
            <button
              onClick={() => {
                window.vscode.postMessage({
                  type: 'openExternal',
                  url: 'https://docs.ollama.com/troubleshooting',
                });
              }}
              className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-input-border) bg-(--vscode-input-background) text-(--vscode-input-foreground) hover:bg-(--vscode-inputOption-hoverBackground)"
            >
              <ExternalLink size={12} />
              Check Connection
            </button>
          </>
        );

      case 'UNKNOWN':
      default:
        return (
          <>
            {onRetry && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-button-border) bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            )}
            <button
              onClick={handleReportIssue}
              className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors border-(--vscode-input-border) bg-(--vscode-input-background) text-(--vscode-input-foreground) hover:bg-(--vscode-inputOption-hoverBackground)"
            >
              <ExternalLink size={12} />
              Report Issue
            </button>
          </>
        );
    }
  };

  // Calculate progress percentage for countdown
  const progressPercentage = autoDismiss && dismissTimeout > 0 && !isPinned ? (timeRemaining / dismissTimeout) * 100 : 0;

  return (
    <div
      className="relative rounded border p-3 text-sm border-(--vscode-inputValidation-errorBorder) bg-(--vscode-inputValidation-errorBackground)"
      role="alert"
      aria-live="assertive"
    >
      {/* Progress bar for auto-dismiss countdown (only when auto-dismiss enabled) */}
      {autoDismiss && dismissTimeout > 0 && !isPinned && (
        <div
          className="absolute bottom-0 left-0 h-1 transition-all duration-100 bg-(--vscode-inputValidation-errorBorder)"
          style={{ width: `${progressPercentage}%` }}
          aria-hidden="true"
        />
      )}

      {/* Header with icon, title, and controls */}
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={16}
          className="mt-0.5 flex-shrink-0"
          style={{ color: 'var(--vscode-inputValidation-errorForeground)' }}
          aria-hidden="true"
        />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <div
            className="font-semibold text-(--vscode-inputValidation-errorForeground)"
            style={{ marginBottom: '4px' }}
          >
            {title}
          </div>

          {/* Message */}
          <div
            className="text-(--vscode-inputValidation-errorForeground)"
            style={{ marginBottom: '8px', opacity: 0.9 }}
          >
            {message}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">{getActionButtons()}</div>
        </div>

        {/* Pin and dismiss controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {autoDismiss && (
            <button
              onClick={handlePinToggle}
              className="rounded p-1 transition-colors hover:bg-(--vscode-toolbar-hoverBackground)"
              title={isPinned ? 'Unpin notification' : 'Pin notification'}
              aria-label={isPinned ? 'Unpin notification' : 'Pin notification'}
              aria-pressed={isPinned}
            >
              <Pin
                size={14}
                style={{
                  color: isPinned
                    ? 'var(--vscode-inputValidation-errorForeground)'
                    : 'var(--vscode-descriptionForeground)',
                }}
                fill={isPinned ? 'currentColor' : 'none'}
              />
            </button>
          )}

          <button
            onClick={onDismiss}
            className="rounded p-1 transition-colors hover:bg-(--vscode-toolbar-hoverBackground)"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X size={14} style={{ color: 'var(--vscode-inputValidation-errorForeground)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
