import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { File, Check } from 'lucide-react';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  lineNumber: number;
  content: string;
}

interface CodeDiffProps {
  diff: {
    file: string;
    lines: DiffLine[];
    language?: string;
    originalContent?: string; // For undo functionality
  };
  onApply?: () => void;
  onReject?: () => void;
  onOpenInEditor?: () => void;
}

/**
 * CodeDiff Component
 *
 * Displays code changes with visual diff highlighting and action buttons.
 *
 * Features:
 * - File path display in header with icon
 * - Removed lines with red background and "-" prefix
 * - Added lines with green background and "+" prefix
 * - Unchanged lines with normal styling for context (3 lines before/after changes)
 * - Line numbers for all lines
 * - Syntax highlighting based on file extension using VS Code theme
 * - Action buttons: Apply Changes, Reject, Open in Editor
 * - Undo functionality after applying changes
 *
 * Styling:
 * - Uses CSS classes from globals.css (90%+)
 * - Inline styles ONLY for dynamic values
 * - VS Code theme integration via CSS variables
 *
 * Requirements: 13.1, 13.5, 24.1, 24.2, 24.3, 24.4, 24.5, 21.1, 21.2
 */
function CodeDiff({ diff, onApply, onReject, onOpenInEditor }: CodeDiffProps) {
  const [isApplied, setIsApplied] = useState(false);
  const [originalContent, setOriginalContent] = useState<string | null>(null);

  if (!diff) return null;

  // Handle Apply Changes
  const handleApply = () => {
    if (!window.vscode) {
      console.error('VS Code API not available');
      return;
    }

    // Store original content for undo
    if (diff.originalContent) {
      setOriginalContent(diff.originalContent);
    }

    // Generate new content from diff lines
    const newContent = diff.lines
      .filter((line) => line.type !== 'removed')
      .map((line) => line.content)
      .join('\n');

    // Send applyChanges message to extension
    window.vscode.postMessage({
      type: 'applyChanges',
      filePath: diff.file,
      content: newContent,
    });

    setIsApplied(true);

    // Call optional callback
    if (onApply) {
      onApply();
    }
  };

  // Handle Reject
  const handleReject = () => {
    setIsApplied(false);
    setOriginalContent(null);

    // Call optional callback
    if (onReject) {
      onReject();
    }
  };

  // Handle Open in Editor
  const handleOpenInEditor = () => {
    if (!window.vscode) {
      console.error('VS Code API not available');
      return;
    }

    // Find first changed line number
    const firstChangedLine = diff.lines.find(
      (line) => line.type === 'added' || line.type === 'removed'
    );

    // Send openFile message to extension
    window.vscode.postMessage({
      type: 'openFile',
      filePath: diff.file,
      lineNumber: firstChangedLine?.lineNumber,
    });

    // Call optional callback
    if (onOpenInEditor) {
      onOpenInEditor();
    }
  };

  // Handle Undo
  const handleUndo = () => {
    if (!window.vscode || !originalContent) {
      console.error('VS Code API not available or no original content');
      return;
    }

    // Send undoChanges message to extension
    window.vscode.postMessage({
      type: 'undoChanges',
      filePath: diff.file,
      originalContent: originalContent,
    });

    setIsApplied(false);
    setOriginalContent(null);
  };

  // Listen for success/error messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'applyChangesSuccess':
          if (message.filePath === diff.file) {
            console.log('Changes applied successfully');
          }
          break;
        case 'applyChangesError':
          if (message.filePath === diff.file) {
            console.error('Failed to apply changes:', message.error);
            setIsApplied(false);
          }
          break;
        case 'undoChangesSuccess':
          if (message.filePath === diff.file) {
            console.log('Changes undone successfully');
          }
          break;
        case 'undoChangesError':
          if (message.filePath === diff.file) {
            console.error('Failed to undo changes:', message.error);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [diff.file]);

  // Detect theme (dark or light) from VS Code CSS variables
  const isDarkTheme =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--vscode-editor-background')
      .trim()
      .startsWith('#1') || // Dark themes typically start with #1 or #2
    getComputedStyle(document.documentElement)
      .getPropertyValue('--vscode-editor-background')
      .trim()
      .startsWith('#2');

  return (
    <div className="flex flex-col bg-editor" style={{ height: '100%' }}>
      {/* Header with file path and action buttons */}
      <div
        className="flex items-center justify-between p-2 border-input"
        style={{ borderBottomWidth: '1px', flexShrink: 0, gap: '0.5rem', flexWrap: 'wrap' }}
      >
        <div className="flex items-center gap-2" style={{ minWidth: 0, flex: '1 1 auto' }}>
          <File size={16} style={{ color: 'var(--vscode-editor-foreground)', flexShrink: 0 }} />
          <h3 className="text-xs font-semibold text-editor truncate" title={diff.file}>
            {diff.file}
          </h3>
        </div>
        <div className="flex gap-1" style={{ flexShrink: 0, flexWrap: 'wrap' }}>
          {!isApplied ? (
            <>
              <button
                onClick={handleApply}
                className="px-2 py-1 rounded text-xs bg-button text-button hover:bg-button-hover transition"
                title="Apply these changes to the file"
                style={{ whiteSpace: 'nowrap' }}
              >
                Apply
              </button>
              <button
                onClick={handleReject}
                className="px-2 py-1 rounded text-xs btn-secondary transition"
                title="Reject these changes"
                style={{ whiteSpace: 'nowrap' }}
              >
                Reject
              </button>
              <button
                onClick={handleOpenInEditor}
                className="px-2 py-1 rounded text-xs btn-secondary transition"
                title="Open this file in the editor"
                style={{ whiteSpace: 'nowrap' }}
              >
                Open
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleUndo}
                className="px-2 py-1 rounded text-xs bg-button text-button hover:bg-button-hover transition"
                title="Undo the applied changes"
                style={{ whiteSpace: 'nowrap' }}
              >
                Undo
              </button>
              <button
                onClick={handleOpenInEditor}
                className="px-2 py-1 rounded text-xs btn-secondary transition"
                title="Open this file in the editor"
                style={{ whiteSpace: 'nowrap' }}
              >
                Open
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success message after applying */}
      {isApplied && (
        <div
          className="flex items-center gap-2 p-2 text-xs"
          style={{
            backgroundColor: 'var(--vscode-inputValidation-infoBackground)',
            color: 'var(--vscode-inputValidation-infoForeground)',
            borderBottom: '1px solid var(--vscode-inputValidation-infoBorder)',
            flexShrink: 0,
          }}
        >
          <Check size={14} style={{ color: 'var(--vscode-inputValidation-infoForeground)' }} />
          <span>Changes applied. Click Undo to revert.</span>
        </div>
      )}

      {/* Diff content with scrollbar */}
      <div className="flex-1 scrollable-modern" style={{ overflow: 'auto', minHeight: 0 }}>
        <div
          className="border border-input rounded"
          style={{ margin: '0.5rem', minWidth: 'max-content' }}
        >
          {diff.lines.map((line, index) => {
            // Determine background and text color classes based on line type
            let bgClass = 'bg-editor';
            let textClass = 'text-editor';
            let prefix = ' ';

            if (line.type === 'added') {
              bgClass = 'diff-inserted';
              prefix = '+';
            } else if (line.type === 'removed') {
              bgClass = 'diff-removed';
              prefix = '-';
            }

            return (
              <div
                key={index}
                className={`flex font-mono text-xs ${bgClass} ${textClass}`}
                style={{
                  fontFamily: 'Monaco, Menlo, Consolas, monospace',
                  minWidth: 'max-content',
                }}
              >
                {/* Line number */}
                <span
                  className="text-muted px-2 py-1"
                  style={{
                    minWidth: '2.5rem',
                    textAlign: 'right',
                    userSelect: 'none',
                    flexShrink: 0,
                    fontSize: '0.7rem',
                  }}
                >
                  {line.lineNumber}
                </span>

                {/* Diff prefix (+, -, or space) */}
                <span
                  className="px-1 py-1"
                  style={{
                    minWidth: '1.2rem',
                    textAlign: 'center',
                    userSelect: 'none',
                    flexShrink: 0,
                    fontSize: '0.7rem',
                  }}
                >
                  {prefix}
                </span>

                {/* Code content */}
                <span className="px-2 py-1" style={{ whiteSpace: 'pre' }}>
                  {line.content}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CodeDiff;
