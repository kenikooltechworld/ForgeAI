import { useState, useEffect, memo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { File, Check } from 'lucide-react';

/**
 * Get current VS Code theme (light or dark)
 */
function getVSCodeTheme(): 'light' | 'dark' {
  const body = document.body;
  if (body.classList.contains('vscode-dark')) return 'dark';
  if (body.classList.contains('vscode-light')) return 'light';
  if (body.classList.contains('vscode-high-contrast')) return 'dark';
  return 'dark'; // default
}

/**
 * Hook to detect VS Code theme changes
 */
function useVSCodeTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getVSCodeTheme());

  useEffect(() => {
    const body = document.body;

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      setTheme(getVSCodeTheme());
    });

    observer.observe(body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format date in human-readable format
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Get language from file extension
 */
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    json: 'json',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sql: 'sql',
    graphql: 'graphql',
    dockerfile: 'docker',
  };
  return languageMap[ext] || 'text';
}

export interface FilePreviewProps {
  filePath: string;
  content: string;
  size?: number;
  lastModified?: number;
  highlightLines?: number[]; // Line numbers to highlight (1-indexed)
}

/**
 * FilePreview Component - Displays file content with syntax highlighting
 *
 * Features:
 * - File path in header
 * - Syntax highlighting based on file extension
 * - Line numbers
 * - File metadata (size, last modified)
 * - Action buttons (Open in Editor, Copy)
 * - Highlight specific lines
 * - VS Code theme integration
 *
 * Requirements: 13.3, 24.5, 21.1, 21.2
 */
export const FilePreview = memo(function FilePreview({
  filePath,
  content,
  size,
  lastModified,
  highlightLines = [],
}: FilePreviewProps) {
  const theme = useVSCodeTheme();
  const syntaxTheme = theme === 'dark' ? vscDarkPlus : vs;
  const language = getLanguageFromPath(filePath);
  const [copySuccess, setCopySuccess] = useState(false);

  // Get file name from path
  const fileName = filePath.split('/').pop() || filePath;

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle open in editor
  const handleOpenInEditor = () => {
    // Send message to extension to open file
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'openFile',
        filePath: filePath,
      });
    }
  };

  // Custom line props for highlighting
  const lineProps = (lineNumber: number) => {
    const isHighlighted = highlightLines.includes(lineNumber);
    return {
      style: {
        backgroundColor: isHighlighted ? 'var(--vscode-editor-lineHighlightBackground)' : undefined,
        display: 'block',
        width: '100%',
      },
    };
  };

  return (
    <div className="flex flex-col h-full bg-editor">
      {/* Header with file path */}
      <div className="flex items-center justify-between p-3 border-b border-input">
        <div className="flex items-center gap-2 flex-1 overflow-hidden">
          <File size={16} style={{ color: 'var(--vscode-editor-foreground)' }} />
          <span className="text-sm font-semibold text-editor truncate" title={filePath}>
            {fileName}
          </span>
          <span className="text-xs text-muted truncate">{filePath}</span>
        </div>
      </div>

      {/* File metadata */}
      {(size !== undefined || lastModified !== undefined) && (
        <div className="flex items-center gap-4 px-3 py-2 text-xs text-muted border-b border-input">
          {size !== undefined && (
            <div>
              <span className="font-semibold">Size:</span> {formatFileSize(size)}
            </div>
          )}
          {lastModified !== undefined && (
            <div>
              <span className="font-semibold">Modified:</span> {formatDate(lastModified)}
            </div>
          )}
        </div>
      )}

      {/* File content with syntax highlighting */}
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={language}
          style={syntaxTheme}
          showLineNumbers={true}
          wrapLines={true}
          lineProps={lineProps}
          customStyle={{
            margin: 0,
            padding: '1rem',
            backgroundColor: 'var(--vscode-editor-background)',
            fontSize: '0.875rem',
            fontFamily: 'var(--vscode-editor-font-family)',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'var(--vscode-editor-font-family)',
            },
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 p-3 border-t border-input">
        <button
          onClick={handleOpenInEditor}
          className="px-3 py-2 text-sm rounded bg-button text-button hover:opacity-80 transition"
        >
          Open in Editor
        </button>
        <button
          onClick={handleCopy}
          className="px-3 py-2 text-sm rounded btn-secondary hover:opacity-80 transition flex items-center gap-1"
        >
          {copySuccess ? (
            <>
              <Check size={14} style={{ color: 'var(--vscode-button-foreground)' }} />
              Copied!
            </>
          ) : (
            'Copy'
          )}
        </button>
      </div>
    </div>
  );
});

export default FilePreview;
