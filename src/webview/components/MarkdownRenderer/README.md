# MarkdownRenderer Component

Professional markdown rendering for ForgeAI's AI responses.

## Quick Start

### Basic Usage (Recommended)

```tsx
import { MarkdownRenderer } from './components/MarkdownRenderer';

function AIMessage({ content }: { content: string }) {
  return <MarkdownRenderer content={content} />;
}
```

### With Math Support (Optional)

```tsx
import { MarkdownRendererWithMath } from './components/MarkdownRenderer';

function AIMessageWithMath({ content }: { content: string }) {
  return <MarkdownRendererWithMath content={content} />;
}
```

## Components

### MarkdownRenderer (Default)

**Features:**

- ✅ Basic markdown (headings, lists, bold, italic, links)
- ✅ Syntax highlighting (100+ languages)
- ✅ GitHub Flavored Markdown (tables, task lists, strikethrough)
- ✅ VS Code theme integration
- ✅ Secure by default (XSS protection)

**Bundle:** 592KB gzipped

**Use for:** Most AI responses

### MarkdownRendererWithMath

**Features:**

- ✅ All features from MarkdownRenderer
- ✅ LaTeX math equations (inline and block)
- ✅ KaTeX rendering

**Bundle:** 1,539KB gzipped (+947KB for KaTeX CSS)

**Use for:** AI responses with math equations

### CodeBlock

**Features:**

- ✅ Syntax highlighting for 100+ languages
- ✅ Automatic VS Code theme detection
- ✅ Line numbers
- ✅ Long line wrapping

**Used internally by:** MarkdownRenderer and MarkdownRendererWithMath

## Supported Markdown

### Basic Markdown

```markdown
# Heading 1

## Heading 2

### Heading 3

**Bold** and _italic_

[Link](https://example.com)

- List item
- List item

1. Numbered item
2. Numbered item

> Blockquote

---

`inline code`
```

### Code Blocks

````markdown
```javascript
console.log('Hello, World!');
```

```python
print("Hello, World!")
```

```typescript
interface User {
  name: string;
}
```
````

### GitHub Flavored Markdown

**Tables:**

```markdown
| Column 1 | Column 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
```

**Task Lists:**

```markdown
- [x] Completed
- [ ] Pending
```

**Strikethrough:**

```markdown
~~Crossed out~~
```

**Autolinks:**

```markdown
https://github.com
```

### Math (MarkdownRendererWithMath only)

**Inline:**

```markdown
The formula is $E = mc^2$.
```

**Block:**

```markdown
$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

## Supported Languages

### Popular Languages

- JavaScript/TypeScript: `js`, `jsx`, `ts`, `tsx`
- Python: `python`, `py`
- HTML/CSS: `html`, `css`, `scss`
- Shell: `bash`, `sh`, `shell`
- JSON/YAML: `json`, `yaml`
- SQL: `sql`
- Markdown: `markdown`, `md`

### And 100+ more...

## VS Code Theme Integration

### Automatic Detection

- ✅ Light mode
- ✅ Dark mode
- ✅ High contrast mode
- ✅ Theme switching

### CSS Variables Used

- `--vscode-editor-foreground`
- `--vscode-editor-background`
- `--vscode-textCodeBlock-background`
- `--vscode-textLink-foreground`
- `--vscode-panel-border`
- And more...

## Security

### Built-in Protection

- ✅ No `dangerouslySetInnerHTML`
- ✅ XSS protection
- ✅ URL sanitization
- ✅ External links safe

### Blocked Attacks

- ❌ `javascript:` protocol
- ❌ `<script>` tags
- ❌ Event handlers
- ❌ Data URLs

## Performance

### Current Performance

- Short responses (< 500 tokens): < 1s
- Medium responses (500-2000 tokens): 2-4s
- Long responses (2000+ tokens): 4-8s

### Optimization (Phase 3 - Pending)

- Debouncing: 98% fewer re-renders
- Lazy loading: Faster initial load
- Code splitting: Smaller bundles

## Bundle Size

| Component                | Gzipped Size |
| ------------------------ | ------------ |
| MarkdownRenderer         | 592KB        |
| MarkdownRendererWithMath | 1,539KB      |

## API Reference

### MarkdownRenderer Props

```tsx
interface MarkdownRendererProps {
  content: string; // Markdown string to render
}
```

### MarkdownRendererWithMath Props

```tsx
interface MarkdownRendererWithMathProps {
  content: string; // Markdown string with math to render
}
```

### CodeBlock Props

```tsx
interface CodeBlockProps {
  inline?: boolean; // Is inline code?
  className?: string; // Language class (e.g., "language-javascript")
  children: React.ReactNode; // Code content
}
```

## Examples

### Basic AI Response

```tsx
<MarkdownRenderer content="# Hello\n\nThis is **bold** text." />
```

### Code Block

````tsx
<MarkdownRenderer content="```js\nconsole.log('test');\n```" />
````

### Table

```tsx
<MarkdownRenderer content="| A | B |\n|---|---|\n| 1 | 2 |" />
```

### Math

```tsx
<MarkdownRendererWithMath content="The formula is $E = mc^2$." />
```

## Troubleshooting

### Code blocks not highlighting

- Check language is specified: ` ```javascript `
- Verify language is supported
- Check VS Code theme is loaded

### Math not rendering

- Use `MarkdownRendererWithMath` instead of `MarkdownRenderer`
- Check KaTeX CSS is loaded
- Verify math syntax is correct

### Theme not matching VS Code

- Check VS Code CSS variables are available
- Verify body has theme class (`vscode-dark` or `vscode-light`)
- Check MutationObserver is working

### Performance issues

- Use default `MarkdownRenderer` (not math version)
- Wait for Phase 3 streaming optimization
- Consider debouncing updates manually

## Contributing

### Adding New Features

1. Update `MarkdownRenderer.tsx` or `CodeBlock.tsx`
2. Add tests
3. Update documentation
4. Check bundle size impact

### Adding New Plugins

1. Install plugin: `npm install plugin-name`
2. Import in component
3. Add to `remarkPlugins` or `rehypePlugins` array
4. Test thoroughly
5. Document usage

## License

MIT
