import { useState } from 'react';
import {
  BookOpen,
  Edit,
  Folder,
  FolderPlus,
  Trash2,
  Copy,
  Scissors,
  BarChart3,
  Search,
  Terminal,
  TestTube,
  Globe,
  GitBranch,
  Wrench,
  Clock,
  Settings as SettingsIcon,
  Check,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

/**
 * Format milliseconds to human-readable time string
 * Examples: 500ms → "500ms", 1500ms → "1s 500ms", 65000ms → "1m 5s"
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.round(ms % 1000);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0) {
    parts.push(`${seconds}s`);
  }
  if (milliseconds > 0 && ms < 60000) {
    parts.push(`${milliseconds}ms`);
  }

  return parts.join(' ');
}

export interface ToolCardProps {
  toolName: string;
  target?: string;
  status: 'Pending' | 'Running' | 'Complete' | 'Error';
  duration?: number;
  error?: string;
  result?: any;
  arguments?: Record<string, any>;
  startTime?: number; // For calculating elapsed time
}

/**
 * Tool Card Component - Displays tool execution status with expandable details
 *
 * Features:
 * - Tool name with contextual icon
 * - Target display (file path, command, etc.)
 * - Status badges with icons and colors
 * - Elapsed time for running tools
 * - Execution duration for completed tools
 * - Expandable details (input parameters and output data)
 * - Error messages with red styling
 * - Progress bar for long-running operations
 * - VS Code theme integration
 *
 * Requirements: 15.1-15.5, 35.1-35.6
 */
function ToolCard({
  toolName,
  target,
  status,
  duration,
  error,
  result,
  arguments: args,
  startTime,
}: ToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time for running tools
  useState(() => {
    if (status === 'Running' && startTime) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100); // Update every 100ms

      return () => clearInterval(interval);
    }
  });

  // Get icon component based on tool name
  const getToolIcon = (name: string) => {
    const iconProps = { size: 16, style: { color: 'var(--vscode-editor-foreground)' } };

    // File operations
    if (name.includes('readFile') || name.includes('Read')) return <BookOpen {...iconProps} />;
    if (name.includes('writeFile') || name.includes('Write')) return <Edit {...iconProps} />;
    if (name.includes('listFiles') || name.includes('listDirectory'))
      return <Folder {...iconProps} />;
    if (name.includes('createDirectory')) return <FolderPlus {...iconProps} />;
    if (name.includes('deleteFile') || name.includes('Delete')) return <Trash2 {...iconProps} />;
    if (name.includes('copyFile') || name.includes('Copy')) return <Copy {...iconProps} />;
    if (name.includes('renameFile') || name.includes('Rename') || name.includes('Move'))
      return <Scissors {...iconProps} />;
    if (name.includes('getFileStats') || name.includes('Stats'))
      return <BarChart3 {...iconProps} />;

    // Search operations
    if (
      name.includes('search') ||
      name.includes('Search') ||
      name.includes('grep') ||
      name.includes('find')
    )
      return <Search {...iconProps} />;

    // Terminal operations
    if (
      name.includes('runCommand') ||
      name.includes('Command') ||
      name.includes('exec') ||
      name.includes('terminal')
    )
      return <Terminal {...iconProps} />;

    // Test operations
    if (name.includes('test') || name.includes('Test')) return <TestTube {...iconProps} />;

    // API operations
    if (
      name.includes('api') ||
      name.includes('Api') ||
      name.includes('API') ||
      name.includes('http')
    )
      return <Globe {...iconProps} />;

    // Git operations
    if (name.includes('git') || name.includes('Git')) return <GitBranch {...iconProps} />;

    // Browser operations
    if (name.includes('browser') || name.includes('Browser')) return <Globe {...iconProps} />;

    // Default tool icon
    return <Wrench {...iconProps} />;
  };

  // Get status badge with icon and color
  const getStatusBadge = () => {
    switch (status) {
      case 'Pending':
        return (
          <div className="flex items-center gap-1">
            <Clock size={16} style={{ color: 'var(--vscode-descriptionForeground)' }} />
            <span className="text-xs text-muted">Pending</span>
          </div>
        );
      case 'Running':
        return (
          <div className="flex items-center gap-1">
            <SettingsIcon
              size={16}
              style={{ color: 'var(--vscode-charts-blue)' }}
              className="animate-spin-slow"
            />
            <span className="text-xs" style={{ color: 'var(--vscode-charts-blue)' }}>
              Running
              {elapsedTime > 0 && ` (${formatDuration(elapsedTime)})`}
            </span>
          </div>
        );
      case 'Complete':
        return (
          <div className="flex items-center gap-1">
            <Check size={16} style={{ color: 'var(--vscode-testing-iconPassed)' }} />
            <span className="text-xs" style={{ color: 'var(--vscode-testing-iconPassed)' }}>
              Complete
              {duration !== undefined && ` (${formatDuration(duration)})`}
            </span>
          </div>
        );
      case 'Error':
        return (
          <div className="flex items-center gap-1">
            <AlertTriangle size={16} style={{ color: 'var(--vscode-errorForeground)' }} />
            <span className="text-xs text-error">Error</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded border border-input bg-sidebar p-3 text-sm">
      {/* Header - Always visible */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          {getToolIcon(toolName)}
          <span className="font-semibold text-editor">{toolName}</span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs bg-transparent border-0 px-2 py-1 cursor-pointer transition flex items-center gap-1"
          style={{
            color: 'var(--vscode-textLink-foreground)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--vscode-textLink-activeForeground)';
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--vscode-textLink-foreground)';
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          {isExpanded ? (
            <>
              Collapse{' '}
              <ChevronUp size={12} style={{ color: 'var(--vscode-textLink-foreground)' }} />
            </>
          ) : (
            <>
              Expand{' '}
              <ChevronDown size={12} style={{ color: 'var(--vscode-textLink-foreground)' }} />
            </>
          )}
        </button>
      </div>

      {/* Target (if provided) */}
      {target && (
        <div className="text-xs text-muted mb-2 break-all">
          <span className="font-semibold">Target:</span> {target}
        </div>
      )}

      {/* Status */}
      <div className="mb-2">{getStatusBadge()}</div>

      {/* Progress bar for running tools */}
      {status === 'Running' && (
        <div className="mt-2 mb-2">
          <div
            className="w-full rounded-full h-2"
            style={{ backgroundColor: 'var(--vscode-progressBar-background)' }}
          >
            <div
              className="h-2 rounded-full animate-pulse"
              style={{
                width: '60%',
                backgroundColor: 'var(--vscode-progressBar-foreground)',
              }}
            />
          </div>
        </div>
      )}

      {/* Error message (if error) */}
      {status === 'Error' && error && (
        <div className="mt-2 p-2 rounded border border-error bg-error-bg">
          <div className="text-xs font-semibold text-error mb-1">Error Message:</div>
          <div className="text-xs text-error break-all">{error}</div>
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-input">
          {/* Input arguments */}
          {args && Object.keys(args).length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-muted mb-1">Input Parameters:</div>
              <div className="p-2 rounded bg-editor text-xs overflow-x-auto scrollable-modern">
                <pre
                  className="text-editor m-0"
                  style={{ fontFamily: 'var(--vscode-editor-font-family)' }}
                >
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Output result */}
          {result && status === 'Complete' && (
            <div>
              <div className="text-xs font-semibold text-muted mb-1">Output Data:</div>
              <div className="p-2 rounded bg-editor text-xs overflow-x-auto scrollable-modern">
                <pre
                  className="text-editor m-0"
                  style={{ fontFamily: 'var(--vscode-editor-font-family)' }}
                >
                  {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Execution info */}
          {status === 'Complete' && duration !== undefined && (
            <div className="mt-2 text-xs text-muted">
              <span className="font-semibold">Execution Time:</span> {duration}ms
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolCard;
