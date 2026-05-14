import ReactMarkdown from 'react-markdown';
import { memo } from 'react';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CodeBlock } from './CodeBlock';
import 'katex/dist/katex.min.css';

interface MarkdownRendererWithMathProps {
  content: string;
}

/**
 * MarkdownRendererWithMath - Enhanced markdown renderer with math equation support
 *
 * Features:
 * - All features from MarkdownRenderer
 * - LaTeX math equations (inline: $E=mc^2$, block: $$...$$)
 * - KaTeX rendering
 *
 * Note: Adds ~120KB to bundle size. Use only if AI generates math equations.
 */
export const MarkdownRendererWithMath = memo(function MarkdownRendererWithMath({
  content,
}: MarkdownRendererWithMathProps) {
  const components: Components = {
    // Reuse all components from MarkdownRenderer
    p: ({ node, ...props }) => (
      <p
        style={{
          margin: '8px 0',
          lineHeight: '1.6',
          color: 'var(--vscode-editor-foreground)',
        }}
        {...props}
      />
    ),
    h1: ({ node, ...props }) => (
      <h1
        style={{
          fontSize: '1.5em',
          fontWeight: 'bold',
          margin: '16px 0 8px 0',
          color: 'var(--vscode-editor-foreground)',
        }}
        {...props}
      />
    ),
    h2: ({ node, ...props }) => (
      <h2
        style={{
          fontSize: '1.3em',
          fontWeight: 'bold',
          margin: '14px 0 7px 0',
          color: 'var(--vscode-editor-foreground)',
        }}
        {...props}
      />
    ),
    h3: ({ node, ...props }) => (
      <h3
        style={{
          fontSize: '1.1em',
          fontWeight: 'bold',
          margin: '12px 0 6px 0',
          color: 'var(--vscode-editor-foreground)',
        }}
        {...props}
      />
    ),
    a: ({ node, href, children, ...props }) => {
      const isExternal = href?.startsWith('http');
      return (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          style={{
            color: 'var(--vscode-textLink-foreground)',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
            e.currentTarget.style.color = 'var(--vscode-textLink-activeForeground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
            e.currentTarget.style.color = 'var(--vscode-textLink-foreground)';
          }}
          {...props}
        >
          {children}
          {isExternal && ' ↗'}
        </a>
      );
    },
    code: CodeBlock,
    ul: ({ node, ...props }) => (
      <ul
        style={{
          margin: '8px 0',
          paddingLeft: '24px',
          color: 'var(--vscode-editor-foreground)',
        }}
        {...props}
      />
    ),
    ol: ({ node, ...props }) => (
      <ol
        style={{
          margin: '8px 0',
          paddingLeft: '24px',
          color: 'var(--vscode-editor-foreground)',
        }}
        {...props}
      />
    ),
    li: ({ node, ...props }) => (
      <li
        style={{
          margin: '4px 0',
          lineHeight: '1.6',
        }}
        {...props}
      />
    ),
    blockquote: ({ node, ...props }) => (
      <blockquote
        style={{
          borderLeft: '4px solid var(--vscode-textBlockQuote-border)',
          backgroundColor: 'var(--vscode-textBlockQuote-background)',
          margin: '8px 0',
          padding: '8px 12px',
          color: 'var(--vscode-editor-foreground)',
          fontStyle: 'italic',
        }}
        {...props}
      />
    ),
    hr: ({ node, ...props }) => (
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--vscode-panel-border)',
          margin: '16px 0',
        }}
        {...props}
      />
    ),
    strong: ({ node, ...props }) => (
      <strong
        style={{
          fontWeight: 'bold',
          color: 'var(--vscode-editor-foreground)',
        }}
        {...props}
      />
    ),
    em: ({ node, ...props }) => (
      <em
        style={{
          fontStyle: 'italic',
          color: 'var(--vscode-editor-foreground)',
        }}
        {...props}
      />
    ),
    img: ({ node, src, alt, ...props }) => (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          maxWidth: '100%',
          height: 'auto',
          borderRadius: '4px',
          margin: '8px 0',
        }}
        {...props}
      />
    ),
    table: ({ node, ...props }) => (
      <div className="scrollable-modern" style={{ overflowX: 'auto', margin: '16px 0' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            border: '1px solid var(--vscode-panel-border)',
          }}
          {...props}
        />
      </div>
    ),
    thead: ({ node, ...props }) => (
      <thead
        style={{
          backgroundColor: 'var(--vscode-editor-background)',
        }}
        {...props}
      />
    ),
    tbody: ({ node, ...props }) => <tbody {...props} />,
    tr: ({ node, ...props }) => (
      <tr
        style={{
          borderBottom: '1px solid var(--vscode-panel-border)',
        }}
        {...props}
      />
    ),
    th: ({ node, ...props }) => (
      <th
        style={{
          border: '1px solid var(--vscode-panel-border)',
          padding: '8px 12px',
          textAlign: 'left',
          fontWeight: 'bold',
          color: 'var(--vscode-editor-foreground)',
          backgroundColor: 'var(--vscode-sideBar-background)',
        }}
        {...props}
      />
    ),
    td: ({ node, ...props }) => (
      <td
        style={{
          border: '1px solid var(--vscode-panel-border)',
          padding: '8px 12px',
          color: 'var(--vscode-editor-foreground)',
        }}
        {...props}
      />
    ),
    input: ({ node, ...props }) => (
      <input
        disabled
        style={{
          marginRight: '8px',
          cursor: 'not-allowed',
        }}
        {...props}
      />
    ),
    del: ({ node, ...props }) => (
      <del
        style={{
          color: 'var(--vscode-descriptionForeground)',
          textDecoration: 'line-through',
        }}
        {...props}
      />
    ),
  };

  return (
    <div
      style={{
        color: 'var(--vscode-editor-foreground)',
        fontSize: 'var(--vscode-editor-font-size)',
        fontFamily: 'var(--vscode-font-family)',
      }}
    >
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
