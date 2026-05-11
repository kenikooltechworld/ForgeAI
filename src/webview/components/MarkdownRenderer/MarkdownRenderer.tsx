import ReactMarkdown from 'react-markdown';
import { memo } from 'react';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

/**
 * MarkdownRenderer - Renders markdown content with VS Code theme integration
 *
 * Features:
 * - Safe by default (no dangerouslySetInnerHTML)
 * - VS Code CSS variables for theming
 * - Custom component styling
 * - Automatic XSS protection
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const components: Components = {
    // Paragraphs
    p: ({ node, ...props }) => <p className="markdown-p" {...props} />,

    // Headings
    h1: ({ node, ...props }) => <h1 className="markdown-h1" {...props} />,
    h2: ({ node, ...props }) => <h2 className="markdown-h2" {...props} />,
    h3: ({ node, ...props }) => <h3 className="markdown-h3" {...props} />,

    // Links
    a: ({ node, href, children, ...props }) => {
      const isExternal = href?.startsWith('http');
      return (
        <a
          className="markdown-a"
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          {...props}
        >
          {children}
          {isExternal && ' ↗'}
        </a>
      );
    },

    // Code (inline and block) - handled by CodeBlock component
    code: CodeBlock,

    // Lists
    ul: ({ node, ...props }) => <ul className="markdown-ul" {...props} />,
    ol: ({ node, ...props }) => <ol className="markdown-ol" {...props} />,
    li: ({ node, ...props }) => <li className="markdown-li" {...props} />,

    // Blockquotes
    blockquote: ({ node, ...props }) => <blockquote className="markdown-blockquote" {...props} />,

    // Horizontal rule
    hr: ({ node, ...props }) => <hr className="markdown-hr" {...props} />,

    // Strong (bold)
    strong: ({ node, ...props }) => <strong className="markdown-strong" {...props} />,

    // Emphasis (italic)
    em: ({ node, ...props }) => <em className="markdown-em" {...props} />,

    // Images
    img: ({ node, src, alt, ...props }) => (
      <img src={src} alt={alt} loading="lazy" className="markdown-img" {...props} />
    ),

    // Tables (GitHub Flavored Markdown)
    table: ({ node, ...props }) => (
      <div className="markdown-table-wrap">
        <table className="markdown-table" {...props} />
      </div>
    ),
    thead: ({ node, ...props }) => <thead className="markdown-thead" {...props} />,
    tbody: ({ node, ...props }) => <tbody {...props} />,
    tr: ({ node, ...props }) => <tr className="markdown-tr" {...props} />,
    th: ({ node, ...props }) => <th className="markdown-th" {...props} />,
    td: ({ node, ...props }) => <td className="markdown-td" {...props} />,

    // Task lists (GitHub Flavored Markdown)
    input: ({ node, ...props }) => <input disabled className="markdown-input" {...props} />,

    // Strikethrough (GitHub Flavored Markdown)
    del: ({ node, ...props }) => <del className="markdown-del" {...props} />,
  };

  return (
    <div className="markdown-root">
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
