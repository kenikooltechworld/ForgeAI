# Tailwind CSS v4.0 Research — 2026

**Project:** ForgeAI - Autonomous AI Coding Assistant  
**Research Date:** May 3, 2026  
**Focus:** Tailwind CSS v4.0 Installation, Configuration, and VS Code Integration  
**Primary Sources:**
- [Tailwind CSS v4.0 Official Blog](https://tailwindcss.com/blog/tailwindcss-v4)
- [Tailwind CSS Official Documentation](https://tailwindcss.com/docs/)
- [Tailwind CSS v4.0 with Vite Guide](https://tailwind-css.colrlab.com/tailwind-css-vite/)

---

## Executive Summary

Tailwind CSS v4.0 represents a complete rewrite of the framework, released in January 2026. The most significant changes are:

1. **CSS-First Configuration** - No more `tailwind.config.js`, configure directly in CSS using `@theme` directive
2. **Simplified Installation** - Just `@import "tailwindcss"` in your CSS file
3. **First-Party Vite Plugin** - `@tailwindcss/vite` for optimal performance
4. **Zero Configuration** - Automatic content detection, no need to configure file paths
5. **5x Faster Builds** - Complete rewrite with 3.78x faster full builds and 8.8x faster incremental builds
6. **Modern CSS Features** - Built on cascade layers, `@property`, `color-mix()`, and logical properties

**Key Breaking Changes from v3:**
- No more `tailwind.config.js` file (use CSS `@theme` instead)
- No more `@tailwind base/components/utilities` directives (use `@import "tailwindcss"` instead)
- Renamed `bg-gradient-*` to `bg-linear-*`
- New syntax for CSS variables: `bg-(--variable-name)` instead of `bg-[var(--variable-name)]`

---

## Installation with Vite (Recommended)

### Step 1: Install Dependencies

```bash
npm install tailwindcss @tailwindcss/vite
```

**Note:** Only 2 packages needed! No `autoprefixer` or `postcss` required.

### Step 2: Configure Vite Plugin

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Add Tailwind plugin
  ],
});
```

### Step 3: Import Tailwind in CSS

```css
/* src/webview/styles/globals.css */
@import "tailwindcss";

/* That's it! No @tailwind directives needed */
```

### Step 4: Start Using Tailwind

```tsx
<div className="flex items-center gap-4 p-6 bg-blue-500 text-white">
  <h1 className="text-3xl font-bold">Hello Tailwind v4!</h1>
</div>
```

---

## CSS-First Configuration with @theme

### Basic Configuration

```css
@import "tailwindcss";

@theme {
  /* Custom fonts */
  --font-display: "Satoshi", "sans-serif";
  --font-mono: "JetBrains Mono", monospace;
  
  /* Custom breakpoints */
  --breakpoint-3xl: 1920px;
  --breakpoint-4xl: 2560px;
  
  /* Custom colors (OKLCH format) */
  --color-brand-50: oklch(0.99 0.01 264);
  --color-brand-100: oklch(0.97 0.03 264);
  --color-brand-500: oklch(0.55 0.22 264);
  --color-brand-900: oklch(0.25 0.15 264);
  
  /* Custom spacing scale */
  --spacing: 0.25rem; /* Base unit for all spacing */
  
  /* Custom easing functions */
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);
}
```

### VS Code Theme Integration

```css
@import "tailwindcss";

@theme {
  /* Your custom theme variables */
  --font-display: "Segoe UI", "sans-serif";
  --spacing: 0.25rem;
}

/* VS Code CSS variables are automatically available */
/* Use them with the NEW v4.0 syntax */

body {
  /* Access VS Code variables directly */
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background-color: var(--vscode-editor-background);
}
```

---

## New v4.0 Syntax for CSS Variables

### ✅ CORRECT v4.0 Syntax

```tsx
{/* Use parentheses with double dashes */}
<div className="bg-(--vscode-editor-background)">
<div className="text-(--vscode-editor-foreground)">
<div className="border-(--vscode-input-border)">
  
{/* Works with any CSS variable */}
<div className="bg-(--my-custom-color)">
<div className="text-(--brand-primary)">
```

### ❌ OLD v3.x Syntax (Don't Use)

```tsx
{/* This is the OLD way - don't use in v4.0 */}
<div className="bg-[var(--vscode-editor-background)]">
<div className="text-[var(--vscode-editor-foreground)]">
```

---

## Dynamic Utility Values (No Configuration Needed)

### Spacing Utilities

```tsx
{/* Any numeric value works automatically */}
<div className="mt-29">  {/* margin-top: calc(var(--spacing) * 29) */}
<div className="w-17">   {/* width: calc(var(--spacing) * 17) */}
<div className="px-42">  {/* padding-inline: calc(var(--spacing) * 42) */}
```

### Grid Utilities

```tsx
{/* Create grids of any size */}
<div className="grid grid-cols-15">
<div className="grid grid-cols-23">
```

### Data Attributes

```tsx
{/* Target custom data attributes without configuration */}
<div data-current className="opacity-75 data-current:opacity-100">
<div data-loading className="data-loading:animate-pulse">
```

---

## Automatic Content Detection

Tailwind v4.0 automatically detects your template files without configuration!

### What's Automatically Detected:

- ✅ All files in your project (except `.gitignore` entries)
- ✅ Automatically ignores `node_modules/`
- ✅ Automatically ignores binary files (images, videos, fonts, etc.)
- ✅ Automatically ignores build outputs (`dist/`, `.next/`, etc.)

### Manual Source Addition (if needed)

```css
@import "tailwindcss";

/* Add additional sources if needed */
@source "../node_modules/@my-company/ui-lib";
@source "../../packages/shared-components";
```

---

## Performance Improvements

### Benchmark Results (vs v3.4)

| Build Type | v3.4 | v4.0 | Improvement |
|------------|------|------|-------------|
| Full build | 378ms | 100ms | **3.78x faster** |
| Incremental rebuild (new CSS) | 44ms | 5ms | **8.8x faster** |
| Incremental rebuild (no new CSS) | 35ms | 192µs | **182x faster** |

### Why It's Faster:

1. **Complete Rewrite** - Ground-up rewrite optimized for performance
2. **Native Cascade Layers** - Leverages browser-native CSS features
3. **Registered Custom Properties** - Uses `@property` for better performance
4. **Tight Vite Integration** - Purpose-built for modern build tools

---

## Modern CSS Features Used

### 1. Cascade Layers

```css
@layer theme, base, components, utilities;

@layer utilities {
  .mx-6 {
    margin-inline: calc(var(--spacing) * 6);
  }
}
```

### 2. Registered Custom Properties

```css
@property --tw-gradient-from {
  syntax: "<color>";
  inherits: false;
  initial-value: #0000;
}
```

### 3. color-mix() for Opacity

```css
.bg-blue-500\/50 {
  background-color: color-mix(in oklab, var(--color-blue-500) 50%, transparent);
}
```

### 4. Logical Properties

```css
/* Automatically uses logical properties for RTL support */
.mx-6 {
  margin-inline: calc(var(--spacing) * 6); /* Not margin-left/right */
}
```

---

## New Features in v4.0

### 1. Container Queries (Built-in)

```tsx
<div className="@container">
  <div className="grid grid-cols-1 @sm:grid-cols-3 @lg:grid-cols-4">
    {/* Responsive based on container size, not viewport */}
  </div>
</div>

{/* Max-width container queries */}
<div className="@container">
  <div className="grid grid-cols-3 @max-md:grid-cols-1">
    {/* ... */}
  </div>
</div>
```

### 2. 3D Transforms

```tsx
<div className="perspective-distant">
  <article className="rotate-x-51 rotate-z-43 transform-3d">
    {/* 3D transformed element */}
  </article>
</div>
```

### 3. Expanded Gradient APIs

```tsx
{/* Linear gradients with angles */}
<div className="bg-linear-45 from-indigo-500 to-pink-500" />

{/* Conic gradients */}
<div className="bg-conic/[in_hsl_longer_hue] from-red-600 to-red-600" />

{/* Radial gradients */}
<div className="bg-radial-[at_25%_25%] from-white to-zinc-900" />

{/* Gradient interpolation modes */}
<div className="bg-linear-to-r/oklch from-indigo-500 to-teal-400" />
```

### 4. @starting-style Support

```tsx
{/* Animate elements on first display */}
<div popover className="transition-discrete starting:open:opacity-0">
  {/* Fades in when popover opens */}
</div>
```

### 5. not-* Variant

```tsx
{/* Negate variants */}
<div className="not-hover:opacity-75">

{/* Negate media queries */}
<div className="not-supports-hanging-punctuation:px-4">
```

### 6. New Utilities

- `inset-shadow-*` and `inset-ring-*` - Stack up to 4 box shadows
- `field-sizing-*` - Auto-resize textareas
- `color-scheme-*` - Control scrollbar colors in dark mode
- `font-stretch-*` - Variable font width control
- `inert` variant - Style non-interactive elements

---

## Migration from v3.x to v4.0

### 1. Update Dependencies

```bash
npm install tailwindcss@next @tailwindcss/vite
```

### 2. Remove Old Configuration

```bash
# Delete these files
rm tailwind.config.js
rm postcss.config.js
```

### 3. Update Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(), // Replace PostCSS plugin
  ],
});
```

### 4. Update CSS File

```css
/* OLD v3.x */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* NEW v4.0 */
@import "tailwindcss";

@theme {
  /* Your custom theme */
}
```

### 5. Update CSS Variable Syntax

```tsx
{/* OLD v3.x */}
<div className="bg-[var(--my-color)]">

{/* NEW v4.0 */}
<div className="bg-(--my-color)">
```

### 6. Rename Gradient Classes

```tsx
{/* OLD v3.x */}
<div className="bg-gradient-to-r from-blue-500 to-purple-500">

{/* NEW v4.0 */}
<div className="bg-linear-to-r from-blue-500 to-purple-500">
```

---

## VS Code Extension Integration Example

### Complete Setup for ForgeAI

#### 1. Install Dependencies

```bash
npm install tailwindcss @tailwindcss/vite
```

#### 2. Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/webview'),
    },
  },
});
```

#### 3. Global CSS with VS Code Theme

```css
/* src/webview/styles/globals.css */
@import "tailwindcss";

@theme {
  --font-display: "Segoe UI", "sans-serif";
  --spacing: 0.25rem;
}

/* Global styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  font-weight: var(--vscode-font-weight);
  color: var(--vscode-foreground);
  background-color: var(--vscode-editor-background);
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--vscode-scrollbarSlider-background);
}

::-webkit-scrollbar-thumb {
  background: var(--vscode-scrollbarSlider-background);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--vscode-scrollbarSlider-hoverBackground);
}

::-webkit-scrollbar-thumb:active {
  background: var(--vscode-scrollbarSlider-activeBackground);
}
```

#### 4. React Component with VS Code Theme

```tsx
// Example component using VS Code theme variables
export function ActivityStream() {
  return (
    <div className="
      flex flex-col h-full
      bg-(--vscode-editor-background)
      text-(--vscode-editor-foreground)
      border-r border-(--vscode-panel-border)
    ">
      <div className="
        flex items-center gap-2 p-4
        bg-(--vscode-sideBar-background)
        border-b border-(--vscode-panel-border)
      ">
        <h2 className="text-lg font-semibold">Activity Stream</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {/* Messages */}
      </div>
      
      <div className="
        p-4
        bg-(--vscode-input-background)
        border-t border-(--vscode-input-border)
      ">
        <input
          type="text"
          placeholder="Type a message..."
          className="
            w-full px-3 py-2 rounded
            bg-(--vscode-input-background)
            text-(--vscode-input-foreground)
            border border-(--vscode-input-border)
            focus:border-(--vscode-focusBorder)
            focus:outline-none
          "
        />
      </div>
    </div>
  );
}
```

---

## Best Practices for v4.0

### 1. Use CSS-First Configuration

✅ **DO:** Configure in CSS using `@theme`
```css
@theme {
  --color-brand-500: oklch(0.55 0.22 264);
}
```

❌ **DON'T:** Create a `tailwind.config.js` file

### 2. Use New CSS Variable Syntax

✅ **DO:** Use parentheses syntax
```tsx
<div className="bg-(--my-color)">
```

❌ **DON'T:** Use bracket syntax
```tsx
<div className="bg-[var(--my-color)]">
```

### 3. Leverage Dynamic Utilities

✅ **DO:** Use dynamic values directly
```tsx
<div className="grid grid-cols-15 mt-29">
```

❌ **DON'T:** Configure every value
```css
@theme {
  --grid-cols-15: 15; /* Not needed! */
}
```

### 4. Use Vite Plugin for Best Performance

✅ **DO:** Use `@tailwindcss/vite`
```typescript
import tailwindcss from '@tailwindcss/vite';
```

❌ **DON'T:** Use PostCSS plugin (slower)

### 5. Let Automatic Detection Work

✅ **DO:** Trust automatic content detection

❌ **DON'T:** Manually configure content paths (unless needed)

---

## Troubleshooting

### Styles Not Applying

**Problem:** Tailwind classes don't work

**Solution:**
1. Ensure `@import "tailwindcss"` is in your CSS file
2. Ensure CSS file is imported in your React entry point
3. Check Vite plugin is added to `vite.config.ts`
4. Restart dev server

### CSS Variables Not Working

**Problem:** `bg-(--my-var)` doesn't work

**Solution:**
1. Ensure you're using v4.0 (not v3.x)
2. Use parentheses syntax: `bg-(--var)` not `bg-[var(--var)]`
3. Ensure CSS variable is defined in `:root` or `@theme`

### Build Errors

**Problem:** Build fails with module errors

**Solution:**
1. Ensure `vite.config.ts` uses ESM syntax (`import` not `require`)
2. Ensure `package.json` has `"type": "module"`
3. Update to latest Vite and Tailwind versions

---

## Resources

- [Tailwind CSS v4.0 Official Blog](https://tailwindcss.com/blog/tailwindcss-v4)
- [Tailwind CSS Official Documentation](https://tailwindcss.com/docs/)
- [Tailwind CSS v4.0 with Vite Guide](https://tailwind-css.colrlab.com/tailwind-css-vite/)
- [Tailwind CSS GitHub](https://github.com/tailwindlabs/tailwindcss)

---

**Research Completed:** May 3, 2026  
**Next Steps:** Implement Tailwind CSS v4.0 in ForgeAI with VS Code theme integration
