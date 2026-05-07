import { useState, useEffect } from 'react';
import { FileText, TestTube, File, Terminal, Search } from 'lucide-react';
import FilePreview from './FilePreview';
import CodeDiff from './CodeDiff';
import TerminalOutput from './TerminalOutput';
import TestResults, { TestResultsData } from './TestResults';
import DiagnosticsView, { DiagnosticsData } from './DiagnosticsView';

type PreviewType = 'diff' | 'test' | 'file' | 'terminal' | 'diagnostics' | 'empty';

interface LivePreviewProps {
  type?: PreviewType;
  data?: any;
}

/**
 * LivePreview - Right panel component for displaying code changes, test results, and file previews
 *
 * Features:
 * - Empty state with icon and message
 * - Code diff view (future)
 * - Test results view (future)
 * - File preview view (future)
 * - Tab switching between views
 * - VS Code theme integration
 *
 * Requirements: 13.4, 21.1, 21.2
 */
export function LivePreview({ type = 'empty', data }: LivePreviewProps) {
  const [activeView, setActiveView] = useState<PreviewType>(type);

  // CRITICAL FIX: Update activeView when type prop changes
  // This ensures the preview panel updates when new content arrives from the extension
  useEffect(() => {
    if (type !== activeView) {
      console.log('[LivePreview] Type changed from', activeView, 'to', type);
      setActiveView(type);
    }
  }, [type]);

  const renderContent = () => {
    switch (activeView) {
      case 'diff':
        // CodeDiff component (Task 5.1)
        if (data && data.file && data.lines) {
          return (
            <CodeDiff
              diff={data}
              onApply={data.onApply}
              onReject={data.onReject}
              onOpenInEditor={data.onOpenInEditor}
            />
          );
        }
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <FileText
              size={64}
              style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '1rem' }}
            />
            <div className="text-lg">Code Diff</div>
            <div className="text-sm">No diff data available</div>
          </div>
        );
      case 'test':
        // TestResults component (Task 9.1)
        if (data && data.files) {
          return <TestResults results={data as TestResultsData} onRunAgain={data.onRunAgain} />;
        }
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <TestTube
              size={64}
              style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '1rem' }}
            />
            <div className="text-lg">Test Results</div>
            <div className="text-sm">No test data available</div>
          </div>
        );
      case 'file':
        // FilePreview component (Task 4.6)
        if (data && data.filePath && data.content) {
          return <FilePreview {...data} />;
        }
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <File
              size={64}
              style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '1rem' }}
            />
            <div className="text-lg">File Preview</div>
            <div className="text-sm">No file data available</div>
          </div>
        );
      case 'terminal':
        // TerminalOutput component (Task 4.9)
        if (data && data.command) {
          return <TerminalOutput {...data} />;
        }
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <Terminal
              size={64}
              style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '1rem' }}
            />
            <div className="text-lg">Terminal Output</div>
            <div className="text-sm">No terminal output available</div>
          </div>
        );
      case 'diagnostics':
        // DiagnosticsView component (Task 12.2)
        if (data && typeof data.total === 'number') {
          return <DiagnosticsView diagnostics={data as DiagnosticsData} />;
        }
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <Search
              size={64}
              style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '1rem' }}
            />
            <div className="text-lg">Diagnostics</div>
            <div className="text-sm">No diagnostics data available</div>
          </div>
        );
      case 'empty':
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <File
              size={64}
              style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '1rem' }}
            />
            <div className="text-lg">Code changes and previews</div>
            <div className="text-sm">will appear here</div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-editor">
      {activeView !== 'empty' && (
        <div
          className="flex items-center justify-between p-2 border-b border-input"
          style={{ flexShrink: 0 }}
        >
          <div className="flex gap-1" style={{ flexWrap: 'wrap', maxWidth: 'calc(100% - 40px)' }}>
            <button
              onClick={() => setActiveView('diff')}
              className={
                activeView === 'diff'
                  ? 'px-2 py-1 rounded text-xs bg-button text-button'
                  : 'px-2 py-1 rounded text-xs hover:opacity-80'
              }
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Code Diff
            </button>
            <button
              onClick={() => setActiveView('test')}
              className={
                activeView === 'test'
                  ? 'px-2 py-1 rounded text-xs bg-button text-button'
                  : 'px-2 py-1 rounded text-xs hover:opacity-80'
              }
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Test Results
            </button>
            <button
              onClick={() => setActiveView('file')}
              className={
                activeView === 'file'
                  ? 'px-2 py-1 rounded text-xs bg-button text-button'
                  : 'px-2 py-1 rounded text-xs hover:opacity-80'
              }
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              File Preview
            </button>
            <button
              onClick={() => setActiveView('terminal')}
              className={
                activeView === 'terminal'
                  ? 'px-2 py-1 rounded text-xs bg-button text-button'
                  : 'px-2 py-1 rounded text-xs hover:opacity-80'
              }
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Terminal
            </button>
            <button
              onClick={() => setActiveView('diagnostics')}
              className={
                activeView === 'diagnostics'
                  ? 'px-2 py-1 rounded text-xs bg-button text-button'
                  : 'px-2 py-1 rounded text-xs hover:opacity-80'
              }
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Diagnostics
            </button>
          </div>

          <button
            onClick={() => setActiveView('empty')}
            className="p-1 hover:opacity-80 rounded text-lg"
            aria-label="Close preview"
            style={{ flexShrink: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {renderContent()}
      </div>
    </div>
  );
}

export default LivePreview;
