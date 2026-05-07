import { useState } from 'react';
import {
  Search,
  XCircle,
  AlertTriangle,
  Info,
  Lightbulb,
  CheckCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

/**
 * Diagnostic information from VS Code diagnostics API
 */
export interface DiagnosticInfo {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source: string;
  code?: string | number;
}

/**
 * Diagnostics data structure
 */
export interface DiagnosticsData {
  errors: DiagnosticInfo[];
  warnings: DiagnosticInfo[];
  info: DiagnosticInfo[];
  total: number;
}

interface DiagnosticsViewProps {
  diagnostics: DiagnosticsData;
}

/**
 * DiagnosticsView - Display workspace diagnostics (errors, warnings, info)
 *
 * Features:
 * - Grouped by severity (errors, warnings, info)
 * - Clickable file paths to open in editor
 * - Color-coded by severity
 * - Shows file path, line, column, message, source
 * - Collapsible sections
 *
 * Requirements: Task 12.2 - Display diagnostics in LivePreview panel
 */
export function DiagnosticsView({ diagnostics }: DiagnosticsViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['errors', 'warnings'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleFileClick = (filePath: string, line: number) => {
    if (!window.vscode) {
      console.error('VS Code API not available');
      return;
    }

    window.vscode.postMessage({
      type: 'openFile',
      filePath,
      line,
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return XCircle;
      case 'warning':
        return AlertTriangle;
      case 'info':
        return Info;
      case 'hint':
        return Lightbulb;
      default:
        return Info;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-error';
      case 'warning':
        return 'text-warning';
      case 'info':
        return 'text-info';
      case 'hint':
        return 'text-muted';
      default:
        return 'text-editor';
    }
  };

  const renderDiagnosticItem = (diagnostic: DiagnosticInfo, index: number) => {
    const fileName = diagnostic.file.split(/[\\/]/).pop() || diagnostic.file;
    const severityColor = getSeverityColor(diagnostic.severity);
    const SeverityIcon = getSeverityIcon(diagnostic.severity);

    return (
      <div
        key={index}
        className="p-2 mb-2 rounded bg-editor-widget hover:opacity-90 transition-opacity"
      >
        {/* File path - clickable */}
        <button
          type="button"
          onClick={() => handleFileClick(diagnostic.file, diagnostic.line)}
          className="text-link hover:underline text-sm font-mono mb-1 text-left w-full"
        >
          {fileName}:{diagnostic.line}:{diagnostic.column}
        </button>

        {/* Message */}
        <div className={`text-sm ${severityColor} mb-1 flex items-center gap-2`}>
          <SeverityIcon size={16} style={{ color: `var(--vscode-editorError-foreground)` }} />
          {diagnostic.message}
        </div>

        {/* Source and code */}
        <div className="flex gap-2 text-xs text-muted">
          {diagnostic.source && <span>Source: {diagnostic.source}</span>}
          {diagnostic.code && <span>Code: {diagnostic.code}</span>}
        </div>
      </div>
    );
  };

  const renderSection = (
    title: string,
    items: DiagnosticInfo[],
    sectionKey: string,
    IconComponent: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  ) => {
    const isExpanded = expandedSections.has(sectionKey);
    const count = items.length;

    if (count === 0) return null;

    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center justify-between w-full p-2 rounded bg-input hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-2">
            <IconComponent size={18} style={{ color: 'var(--vscode-editor-foreground)' }} />
            <span className="font-semibold">{title}</span>
            <span className="text-muted text-sm">({count})</span>
          </div>
          {isExpanded ? (
            <ChevronDown size={16} style={{ color: 'var(--vscode-descriptionForeground)' }} />
          ) : (
            <ChevronRight size={16} style={{ color: 'var(--vscode-descriptionForeground)' }} />
          )}
        </button>

        {isExpanded && (
          <div className="mt-2 ml-4">
            {items.map((item, index) => renderDiagnosticItem(item, index))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4 bg-editor">
      {/* Header */}
      <div className="mb-4 pb-2 border-b border-input">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Search size={20} style={{ color: 'var(--vscode-editor-foreground)' }} />
          <span>Diagnostics</span>
        </h2>
        <div className="text-sm text-muted mt-1">Total: {diagnostics.total} issues found</div>
      </div>

      {/* No diagnostics */}
      {diagnostics.total === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-muted">
          <CheckCircle
            size={48}
            style={{ color: 'var(--vscode-testing-iconPassed)', marginBottom: '1rem' }}
          />
          <div className="text-lg">No issues found</div>
          <div className="text-sm">Your workspace is clean!</div>
        </div>
      )}

      {/* Errors section */}
      {renderSection('Errors', diagnostics.errors, 'errors', XCircle)}

      {/* Warnings section */}
      {renderSection('Warnings', diagnostics.warnings, 'warnings', AlertTriangle)}

      {/* Info section */}
      {renderSection('Info', diagnostics.info, 'info', Info)}
    </div>
  );
}

export default DiagnosticsView;
