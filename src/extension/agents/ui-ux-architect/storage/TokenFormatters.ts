/**
 * Token Export Formatters
 * Task 5.2: JSON (Style Dictionary), CSS custom properties, Tailwind config
 * Requirements: 6.1, 6.2, 6.3
 */

import type { DesignTokens } from '../types/design-tokens';

/** Supported export formats */
export type TokenFormat = 'json' | 'css' | 'tailwind';

/**
 * Format tokens as Style Dictionary compatible JSON.
 */
export function formatAsJSON(tokens: DesignTokens): string {
  const color: Record<string, { value: string }> = {};
  Object.assign(color, flattenColorScale(tokens.colors.primary, 'primary'));
  Object.assign(color, flattenColorScale(tokens.colors.secondary, 'secondary'));
  Object.assign(color, flattenColorScale(tokens.colors.accent, 'accent'));
  Object.assign(color, flattenColorScale(tokens.colors.neutral, 'neutral'));
  Object.assign(color, flattenColorScale(tokens.colors.success, 'success'));
  Object.assign(color, flattenColorScale(tokens.colors.warning, 'warning'));
  Object.assign(color, flattenColorScale(tokens.colors.error, 'error'));
  Object.assign(color, flattenColorScale(tokens.colors.info, 'info'));

  const sd = {
    color,
    semantic: tokens.semanticColors,
    font: {
      family: tokens.typography.fontFamily,
      size: Object.fromEntries(
        Object.entries(tokens.typography.heading).map(([k, v]) => [k, v.size])
      ),
      lineHeight: Object.fromEntries(
        Object.entries(tokens.typography.heading).map(([k, v]) => [k, v.lineHeight])
      ),
      weight: Object.fromEntries(
        Object.entries(tokens.typography.heading).map(([k, v]) => [k, v.weight])
      ),
    },
    spacing: tokens.spacing.scale,
    shadow: tokens.shadows.elevation,
    animation: tokens.animation,
    radius: tokens.radius.scale,
    breakpoint: tokens.breakpoints,
  };

  return JSON.stringify(
    {
      name: tokens.name,
      version: tokens.version,
      tokens: sd,
    },
    null,
    2
  );
}

/**
 * Format tokens as CSS custom properties.
 */
export function formatAsCSS(tokens: DesignTokens): string {
  const lines: string[] = [
    `/* Design System: ${tokens.name} */`,
    `/* Version: ${tokens.version} */`,
    '',
    ':root {',
  ];

  // Colors
  for (const [scaleName, scale] of Object.entries(tokens.colors)) {
    for (const [weight, value] of Object.entries(scale as Record<string, string>)) {
      lines.push(`  --color-${scaleName}-${weight}: ${value};`);
    }
  }

  // Semantic colors (light mode)
  lines.push('');
  lines.push('  /* Semantic Colors — Light Mode */');
  for (const [category, values] of Object.entries(tokens.semanticColors)) {
    for (const [key, value] of Object.entries(values as Record<string, string>)) {
      lines.push(`  --semantic-${category}-${key}: ${value};`);
    }
  }

  // Typography
  lines.push('');
  lines.push('  /* Typography */');
  lines.push(`  --font-primary: ${tokens.typography.fontFamily.primary};`);
  lines.push(`  --font-mono: ${tokens.typography.fontFamily.mono};`);
  for (const [key, val] of Object.entries(tokens.typography.heading)) {
    lines.push(`  --font-heading-${key}-size: ${val.size};`);
    lines.push(`  --font-heading-${key}-line-height: ${val.lineHeight};`);
    lines.push(`  --font-heading-${key}-weight: ${val.weight};`);
  }

  // Spacing
  lines.push('');
  lines.push('  /* Spacing */');
  for (const [key, value] of Object.entries(tokens.spacing.scale)) {
    lines.push(`  --spacing-${key}: ${value};`);
  }

  // Shadows
  lines.push('');
  lines.push('  /* Shadows */');
  for (const [key, value] of Object.entries(tokens.shadows.elevation)) {
    lines.push(`  --shadow-${key}: ${value};`);
  }

  // Radius
  lines.push('');
  lines.push('  /* Border Radius */');
  for (const [key, value] of Object.entries(tokens.radius.scale)) {
    lines.push(`  --radius-${key}: ${value};`);
  }

  // Breakpoints
  lines.push('');
  lines.push('  /* Breakpoints */');
  for (const [key, value] of Object.entries(tokens.breakpoints)) {
    lines.push(`  --breakpoint-${key}: ${value};`);
  }

  lines.push('}');
  lines.push('');

  // Dark mode
  lines.push('@media (prefers-color-scheme: dark) {');
  lines.push('  :root {');
  for (const [category, values] of Object.entries(tokens.semanticColors)) {
    for (const [key, value] of Object.entries(values as Record<string, string>)) {
      const darkValue = invertIfColor(value);
      lines.push(`    --semantic-${category}-${key}: ${darkValue};`);
    }
  }
  lines.push('  }');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Format tokens as Tailwind CSS configuration.
 */
export function formatAsTailwind(tokens: DesignTokens): string {
  const colors: Record<string, string> = {};
  for (const [scaleName, scale] of Object.entries(tokens.colors)) {
    for (const [weight, value] of Object.entries(scale as Record<string, string>)) {
      colors[`${scaleName}-${weight}`] = value;
    }
  }

  const fontSize: Record<string, [string, { lineHeight: string; letterSpacing: string }]> = {};
  for (const [key, val] of Object.entries(tokens.typography.heading)) {
    fontSize[key] = [val.size, { lineHeight: val.lineHeight, letterSpacing: val.letterSpacing }];
  }

  const spacing: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens.spacing.scale)) {
    spacing[key] = value;
  }

  const borderRadius: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens.radius.scale)) {
    borderRadius[key] = value;
  }

  const boxShadow: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens.shadows.elevation)) {
    boxShadow[key] = value;
  }

  const config = {
    theme: {
      extend: {
        colors,
        fontSize,
        spacing,
        borderRadius,
        boxShadow,
        screens: tokens.breakpoints,
        fontFamily: {
          sans: [tokens.typography.fontFamily.primary],
          mono: [tokens.typography.fontFamily.mono],
        },
      },
    },
  };

  return `/** @type {import('tailwindcss').Config} */
module.exports = ${JSON.stringify(config, null, 2)};`;
}

// ─── helpers ──────────────────────────────────────────────────────────────

function flattenColorScale(scale: unknown, prefix: string): Record<string, { value: string }> {
  const result: Record<string, { value: string }> = {};
  for (const [weight, value] of Object.entries(scale as Record<string, string>)) {
    result[`${prefix}-${weight}`] = { value };
  }
  return result;
}

/** Naive dark-mode inversion for demo purposes */
function invertIfColor(value: string): string {
  if (value.startsWith('#') && value.length === 7) {
    const r = 255 - parseInt(value.slice(1, 3), 16);
    const g = 255 - parseInt(value.slice(3, 5), 16);
    const b = 255 - parseInt(value.slice(5, 7), 16);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return value;
}
