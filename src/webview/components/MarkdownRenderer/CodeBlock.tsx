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
  children?: React.ReactNode;
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
export const CodeBlock: React.FC<CodeBlockProps> = memo(function CodeBlock({
  inline,
  className,
  children,
}: CodeBlockProps) {
  const theme = useVSCodeTheme();
  const syntaxTheme = theme === 'dark' ? vscDarkPlus : vs;

  // Extract language from className (e.g., "language-javascript")
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  // Inline code - styling handled by globals.css classes
  if (inline) {
    return (
      <code className="markdown-code-inline">
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
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    );
  }

  // Fallback for code blocks without language specification
  return (
    <code>
      {children}
    </code>
  );
});