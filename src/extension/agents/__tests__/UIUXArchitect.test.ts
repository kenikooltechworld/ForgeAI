/**
 * Unit tests for UI/UX Architect Agent
 * Phase 2.7: Testing — ColorContrast, TokenValidator, TokenFormatters, DesignSystemStorage
 * Requirements: All property tests from ui-ux-architect-agent/tasks.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  calculateContrastRatio,
  checkContrast,
  passesWCAG,
  adjustForContrast,
} from '../ui-ux-architect/storage/ColorContrast';
import { validateTokenNaming, isNamingValid } from '../ui-ux-architect/storage/TokenValidator';
import {
  formatAsJSON,
  formatAsCSS,
  formatAsTailwind,
} from '../ui-ux-architect/storage/TokenFormatters';
import { DesignSystemStorage } from '../ui-ux-architect/storage/DesignSystemStorage';
import type { DesignTokens } from '../ui-ux-architect/types/design-tokens';

// ─── Test Fixtures ──────────────────────────────────────────────────────

function createTestTokens(): DesignTokens {
  return {
    name: 'Test Design System',
    version: '1.0.0',
    colors: {
      primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
        950: '#172554',
      },
      secondary: {
        50: '#fdf4ff',
        100: '#fae8ff',
        200: '#f0abfc',
        300: '#e879f9',
        400: '#d946ef',
        500: '#c026d3',
        600: '#a21caf',
        700: '#86198f',
        800: '#701a75',
        900: '#4a044e',
        950: '#2e012e',
      },
      accent: {
        50: '#fff7ed',
        100: '#ffedd5',
        200: '#fed7aa',
        300: '#fdba74',
        400: '#fb923c',
        500: '#f97316',
        600: '#ea580c',
        700: '#c2410c',
        800: '#9a3412',
        900: '#7c2d12',
        950: '#431407',
      },
      neutral: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
        950: '#020617',
      },
      success: {
        50: '#f0fdf4',
        100: '#dcfce7',
        200: '#bbf7d0',
        300: '#86efac',
        400: '#4ade80',
        500: '#22c55e',
        600: '#16a34a',
        700: '#15803d',
        800: '#166534',
        900: '#14532d',
        950: '#052e16',
      },
      warning: {
        50: '#fffbeb',
        100: '#fef3c7',
        200: '#fde68a',
        300: '#fcd34d',
        400: '#fbbf24',
        500: '#f59e0b',
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f',
        950: '#451a03',
      },
      error: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d',
        950: '#450a0a',
      },
      info: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
        950: '#172554',
      },
    },
    semanticColors: {
      background: {
        primary: '#ffffff',
        secondary: '#f8fafc',
        tertiary: '#f1f5f9',
        elevated: '#ffffff',
        overlay: 'rgba(0,0,0,0.5)',
      },
      text: {
        primary: '#0f172a',
        secondary: '#475569',
        tertiary: '#94a3b8',
        disabled: '#cbd5e1',
        inverse: '#ffffff',
      },
      border: {
        primary: '#e2e8f0',
        secondary: '#f1f5f9',
        focus: '#3b82f6',
      },
      interactive: {
        default: '#2563eb',
        hover: '#1d4ed8',
        active: '#1e40af',
        disabled: '#cbd5e1',
      },
    },
    typography: {
      fontFamily: { primary: 'Inter', mono: 'JetBrains Mono', fallback: 'Arial' },
      heading: {
        h1: { size: '2.5rem', lineHeight: '1.2', weight: 700, letterSpacing: '-0.02em' },
        h2: { size: '2rem', lineHeight: '1.2', weight: 600, letterSpacing: '-0.02em' },
        h3: { size: '1.5rem', lineHeight: '1.2', weight: 600, letterSpacing: '-0.01em' },
        h4: { size: '1.25rem', lineHeight: '1.2', weight: 600, letterSpacing: '-0.01em' },
        h5: { size: '1.125rem', lineHeight: '1.2', weight: 500, letterSpacing: '0' },
        h6: { size: '1rem', lineHeight: '1.2', weight: 500, letterSpacing: '0' },
      },
      body: {
        large: { size: '1.125rem', lineHeight: '1.6', weight: 400, letterSpacing: '0' },
        medium: { size: '1rem', lineHeight: '1.6', weight: 400, letterSpacing: '0' },
        small: { size: '0.875rem', lineHeight: '1.5', weight: 400, letterSpacing: '0.01em' },
      },
      ui: {
        label: { size: '0.875rem', lineHeight: '1.4', weight: 500, letterSpacing: '0' },
        caption: { size: '0.75rem', lineHeight: '1.4', weight: 400, letterSpacing: '0.01em' },
        button: { size: '0.875rem', lineHeight: '1', weight: 600, letterSpacing: '0.01em' },
        input: { size: '1rem', lineHeight: '1.5', weight: 400, letterSpacing: '0' },
      },
    },
    spacing: {
      base: '0.25rem',
      scale: {
        0: '0',
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        32: '8rem',
        40: '10rem',
        48: '12rem',
        64: '16rem',
      },
    },
    shadows: {
      elevation: {
        0: 'none',
        1: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        2: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        3: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        4: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        6: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
        8: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        12: '0 35px 60px -15px rgb(0 0 0 / 0.3)',
        16: '0 50px 100px -20px rgb(0 0 0 / 0.35)',
        24: '0 80px 128px -20px rgb(0 0 0 / 0.4)',
      },
    },
    animation: {
      duration: { instant: '0ms', fast: '150ms', normal: '300ms', slow: '500ms' },
      easing: {
        default: 'cubic-bezier(0.4,0,0.2,1)',
        easeIn: 'cubic-bezier(0.4,0,1,1)',
        easeOut: 'cubic-bezier(0,0,0.2,1)',
        easeInOut: 'cubic-bezier(0.4,0,0.2,1)',
        spring: 'cubic-bezier(0.34,1.56,0.64,1)',
      },
    },
    radius: {
      scale: {
        none: '0',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
    },
    breakpoints: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
  };
}

// ─── Color Contrast Tests (Property 1: Color Contrast Compliance) ─────────

describe('ColorContrast', () => {
  describe('calculateContrastRatio', () => {
    test('should return 21:1 for black on white', () => {
      expect(calculateContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    });

    test('should return 1:1 for same colors', () => {
      expect(calculateContrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 1);
    });

    test('should return ~4.5:1 for #767676 on white (WCAG AA threshold)', () => {
      expect(calculateContrastRatio('#767676', '#ffffff')).toBeCloseTo(4.5, 0.5);
    });
  });

  describe('checkContrast', () => {
    test('should pass AA for black on white', () => {
      const result = checkContrast('#000000', '#ffffff');
      expect(result.passesAANormal).toBe(true);
      expect(result.passesAALarge).toBe(true);
      expect(result.passesAAANormal).toBe(true);
      expect(result.passesAAALarge).toBe(true);
    });

    test('should fail AA for light gray on white', () => {
      const result = checkContrast('#cccccc', '#ffffff');
      expect(result.passesAANormal).toBe(false);
    });
  });

  describe('passesWCAG', () => {
    test('should return true for AA black on white', () => {
      expect(passesWCAG('#000000', '#ffffff', 'AA', 'normal')).toBe(true);
    });

    test('should return false for AAA light gray on white', () => {
      expect(passesWCAG('#cccccc', '#ffffff', 'AAA', 'normal')).toBe(false);
    });
  });

  describe('adjustForContrast', () => {
    test('should adjust color to meet target ratio', () => {
      const adjusted = adjustForContrast('#cccccc', '#ffffff', 4.5);
      const ratio = calculateContrastRatio(adjusted, '#ffffff');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});

// ─── Token Validator Tests (Property 7: Semantic Token Naming) ──────────

describe('TokenValidator', () => {
  test('should pass for valid semantic naming', () => {
    const tokens = createTestTokens();
    expect(isNamingValid(tokens)).toBe(true);
  });

  test('should flag literal color names', () => {
    const tokens = createTestTokens();
    (tokens.colors as any)['red'] = tokens.colors.primary;
    const issues = validateTokenNaming(tokens);
    const literalIssue = issues.find((i) => i.message.includes('literal color'));
    expect(literalIssue).toBeDefined();
    expect(literalIssue?.severity).toBe('warning');
  });

  test('should flag pixel values in spacing names', () => {
    const tokens = createTestTokens();
    (tokens.spacing.scale as any)['16px'] = '1rem';
    const issues = validateTokenNaming(tokens);
    const pixelIssue = issues.find((i) => i.path.includes('16px'));
    expect(pixelIssue).toBeDefined();
  });

  test('should warn on missing semantic categories', () => {
    const tokens = createTestTokens();
    delete (tokens.semanticColors as any).background;
    const issues = validateTokenNaming(tokens);
    const missingIssue = issues.find((i) => i.message.includes('Missing semantic'));
    expect(missingIssue).toBeDefined();
  });
});

// ─── Token Formatter Tests (Property 6: Serialization Round-Trip) ─────────

describe('TokenFormatters', () => {
  const tokens = createTestTokens();

  test('formatAsJSON should produce valid JSON containing token name', () => {
    const json = formatAsJSON(tokens);
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe('Test Design System');
    expect(parsed.tokens.color).toBeDefined();
  });

  test('formatAsCSS should produce CSS custom properties', () => {
    const css = formatAsCSS(tokens);
    expect(css).toContain('--color-primary-500:');
    expect(css).toContain(':root {');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  test('formatAsTailwind should produce Tailwind config', () => {
    const tw = formatAsTailwind(tokens);
    expect(tw).toContain('module.exports');
    expect(tw).toContain('theme');
    expect(tw).toContain('colors');
  });
});

// ─── DesignSystemStorage Tests ────────────────────────────────────────────

describe('DesignSystemStorage', () => {
  let tmpDir: string;
  let storage: DesignSystemStorage;
  let paths: ReturnType<DesignSystemStorage['getPaths']>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeai-test-'));
    storage = new DesignSystemStorage(tmpDir);
    paths = storage.getPaths();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('should not exist initially', () => {
    expect(storage.exists()).toBe(false);
  });

  test('save should persist tokens and metadata', () => {
    const tokens = createTestTokens();
    storage.save(tokens);

    expect(fs.existsSync(paths.tokensJson)).toBe(true);
    expect(fs.existsSync(paths.metadata)).toBe(true);
    expect(storage.exists()).toBe(true);
  });

  test('load should return saved tokens', () => {
    const tokens = createTestTokens();
    storage.save(tokens);

    const loaded = storage.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Test Design System');
    expect(loaded?.colors.primary[500]).toBe('#3b82f6');
  });

  test('loadMetadata should return metadata', () => {
    const tokens = createTestTokens();
    storage.save(tokens);

    const meta = storage.loadMetadata();
    expect(meta).not.toBeNull();
    expect(meta?.name).toBe('Test Design System');
    expect(meta?.tokenCategories).toContain('colors');
  });

  test('delete should remove all files', () => {
    const tokens = createTestTokens();
    storage.save(tokens);
    expect(storage.exists()).toBe(true);

    storage.delete();
    expect(storage.exists()).toBe(false);
  });

  test('load should return null for nonexistent system', () => {
    expect(storage.load()).toBeNull();
    expect(storage.loadMetadata()).toBeNull();
  });
});

// ─── Property Tests (EARS-style) ──────────────────────────────────────────

describe('Property Tests', () => {
  test('Property 1: ANY color pair SHALL have contrast ratio between 1 and 21', () => {
    const colors = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080'];
    for (const fg of colors) {
      for (const bg of colors) {
        const ratio = calculateContrastRatio(fg, bg);
        expect(ratio).toBeGreaterThanOrEqual(1);
        expect(ratio).toBeLessThanOrEqual(21);
      }
    }
  });

  test('Property 6: WHEN tokens are saved THEN load SHALL return identical tokens', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeai-pt6-'));
    const s = new DesignSystemStorage(tmpDir);
    const tokens = createTestTokens();
    s.save(tokens);
    const loaded = s.load();
    expect(loaded).toEqual(tokens);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('Property 7: WHEN tokens use semantic names THEN validation SHALL pass', () => {
    const tokens = createTestTokens();
    expect(isNamingValid(tokens)).toBe(true);
  });
});
