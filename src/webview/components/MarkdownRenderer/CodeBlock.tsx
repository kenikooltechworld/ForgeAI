import { memo, useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}

/**
 * CodeBlock - Renders code with syntax highlighting
 *
 * Features:
 * - Syntax highlighting for 100+ languages
 * - VS Code theme integration (auto light/dark)
 * - Line numbers for block code
 * - Inline code styling
 * - Fallback for unknown languages
 */
export const CodeBlock = memo(function CodeBlock({
  inline,
  className,
  children,
  ...props
}: CodeBlockProps) {
  const theme = useVSCodeTheme();
  const syntaxTheme = theme === 'dark' ? vscDarkPlus : vs;

  // Extract language from className (e.g., "language-javascript")
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  // Inline code - simple styling with VS Code variables
  if (inline) {
    return (
      <code
        style={{
          backgroundColor: 'var(--vscode-textCodeBlock-background)',
          color: 'var(--vscode-textPreformat-foreground)',
          padding: '2px 4px',
          borderRadius: '3px',
          fontFamily: 'var(--vscode-editor-font-family)',
          fontSize: '0.9em',
        }}
        {...props}
      >
        {children}
      </code>
    );
  }

  // Block code with syntax highlighting
  if (language) {
    return (
      <SyntaxHighlighter
        language={language}
        style={syntaxTheme}
        showLineNumbers
        wrapLongLines
        customStyle={{
          margin: 0,
          borderRadius: '4px',
          fontFamily: 'var(--vscode-editor-font-family)',
          fontSize: 'var(--vscode-editor-font-size)',
          // Override background to better match VS Code
          backgroundColor: 'var(--vscode-textCodeBlock-background)',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'var(--vscode-editor-font-family)',
          },
        }}
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    );
  }

  // Fallback for code blocks without language specification
  return (
    <code
      style={{
        display: 'block',
        backgroundColor: 'var(--vscode-textCodeBlock-background)',
        color: 'var(--vscode-editor-foreground)',
        padding: '12px',
        borderRadius: '4px',
        overflow: 'auto',
        fontFamily: 'var(--vscode-editor-font-family)',
        fontSize: 'var(--vscode-editor-font-size)',
        whiteSpace: 'pre',
      }}
      {...props}
    >
      {children}
    </code>
  );
});
