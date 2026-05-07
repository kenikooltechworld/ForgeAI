import { useState } from 'react';
import { Terminal, Check, X } from 'lucide-react';

/**
 * Terminal Output Component
 *
 * Displays command execution results with stdout, stderr, and exit code.
 * Follows Task 4.9 requirements and UI/UX architecture patterns.
 *
 * Requirements: 5.7, 5.8
 */

export interface TerminalOutputProps {
  command: string;
  cwd?: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timestamp?: number;
  onRunAgain?: () => void;
}

export function TerminalOutput({
  command,
  cwd,
  stdout,
  stderr,
  exitCode,
  timestamp,
  onRunAgain,
}: TerminalOutputProps) {
  const [copied, setCopied] = useState(false);

  const isSuccess = exitCode === 0;
  const duration = timestamp ? Date.now() - timestamp : 0;

  const handleCopy = () => {
    const output = `Command: ${command}\n${cwd ? `Directory: ${cwd}\n` : ''}Exit Code: ${exitCode}\n\n${stdout ? `STDOUT:\n${stdout}\n\n` : ''}${stderr ? `STDERR:\n${stderr}\n` : ''}`;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunAgain = () => {
    if (onRunAgain) {
      onRunAgain();
    }
  };

  return (
    <div className="flex flex-col h-full bg-editor text-editor">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-input">
        <div className="flex items-center gap-2">
          <Terminal size={20} style={{ color: 'var(--vscode-editor-foreground)' }} />
          <span className="font-semibold">Terminal Output</span>
        </div>
      </div>

      {/* Command Info */}
      <div className="p-3 border-b border-input bg-input">
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted">Command:</span>
            <code className="font-mono">{command}</code>
          </div>
          {cwd && (
            <div className="flex items-center gap-2">
              <span className="text-muted">Directory:</span>
              <code className="font-mono text-xs">{cwd}</code>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-muted">Exit Code:</span>
            <span
              className={`font-mono font-semibold ${isSuccess ? 'text-success' : 'text-error'}`}
            >
              {exitCode}
            </span>
            {isSuccess ? (
              <span className="flex items-center gap-1 text-success">
                <Check size={16} style={{ color: 'var(--vscode-testing-iconPassed)' }} />
                Success
              </span>
            ) : (
              <span className="flex items-center gap-1 text-error">
                <X size={16} style={{ color: 'var(--vscode-testing-iconFailed)' }} />
                Failed
              </span>
            )}
          </div>
          {duration > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted">Time:</span>
              <span className="font-mono text-xs">{(duration / 1000).toFixed(1)}s</span>
            </div>
          )}
        </div>
      </div>

      {/* Output Content */}
      <div className="flex-1 overflow-auto p-3">
        {/* STDOUT */}
        {stdout && (
          <div className="mb-4">
            <div className="text-xs text-muted mb-1 font-semibold">STDOUT:</div>
            <pre className="font-mono text-sm whitespace-pre-wrap break-words bg-editor-widget p-2 rounded">
              {stdout}
            </pre>
          </div>
        )}

        {/* STDERR */}
        {stderr && (
          <div className="mb-4">
            <div className="text-xs text-error mb-1 font-semibold">STDERR:</div>
            <pre className="font-mono text-sm whitespace-pre-wrap break-words bg-editor-widget p-2 rounded text-error">
              {stderr}
            </pre>
          </div>
        )}

        {/* Empty state */}
        {!stdout && !stderr && (
          <div className="text-center text-muted py-8">
            <div className="text-4xl mb-2">📭</div>
            <div>No output</div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 p-3 border-t border-input">
        <button
          onClick={handleCopy}
          className="px-3 py-1 rounded bg-button text-button text-sm flex items-center gap-1"
        >
          {copied ? (
            <>
              <Check size={14} style={{ color: 'var(--vscode-button-foreground)' }} />
              Copied
            </>
          ) : (
            'Copy Output'
          )}
        </button>
        {onRunAgain && (
          <button
            onClick={handleRunAgain}
            className="px-3 py-1 rounded bg-button text-button text-sm"
          >
            Run Again
          </button>
        )}
      </div>
    </div>
  );
}

export default TerminalOutput;
