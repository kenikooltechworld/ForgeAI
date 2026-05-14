/**
 * Color Contrast Utilities
 * Task 6.2: WCAG contrast ratio calculation and compliance checking
 * Requirements: 1.4, 5.2, 15.2
 */

/** WCAG compliance level */
export type WCAGLevel = 'AA' | 'AAA';

/** Contrast check result */
export interface ContrastCheckResult {
  /** Foreground color */
  foreground: string;
  /** Background color */
  background: string;
  /** Calculated contrast ratio (1:1 to 21:1) */
  ratio: number;
  /** Whether it passes AA for normal text */
  passesAANormal: boolean;
  /** Whether it passes AA for large text */
  passesAALarge: boolean;
  /** Whether it passes AAA for normal text */
  passesAAANormal: boolean;
  /** Whether it passes AAA for large text */
  passesAAALarge: boolean;
}

/** Minimum contrast ratios per WCAG 2.1 */
const WCAG_THRESHOLDS: Record<WCAGLevel, { normal: number; large: number }> = {
  AA: { normal: 4.5, large: 3.0 },
  AAA: { normal: 7.0, large: 4.5 },
};

/**
 * Parse a hex color string to RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

/**
 * Calculate relative luminance of an RGB color.
 * Formula from WCAG 2.1.
 */
function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

/**
 * Calculate contrast ratio between two hex colors.
 */
export function calculateContrastRatio(foreground: string, background: string): number {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) {
    return 1;
  }

  const lum1 = relativeLuminance(fg);
  const lum2 = relativeLuminance(bg);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check WCAG compliance for a color pair.
 */
export function checkContrast(foreground: string, background: string): ContrastCheckResult {
  const ratio = calculateContrastRatio(foreground, background);

  return {
    foreground,
    background,
    ratio,
    passesAANormal: ratio >= WCAG_THRESHOLDS.AA.normal,
    passesAALarge: ratio >= WCAG_THRESHOLDS.AA.large,
    passesAAANormal: ratio >= WCAG_THRESHOLDS.AAA.normal,
    passesAAALarge: ratio >= WCAG_THRESHOLDS.AAA.large,
  };
}

/**
 * Check if a color pair passes a specific WCAG level.
 */
export function passesWCAG(
  foreground: string,
  background: string,
  level: WCAGLevel,
  textSize: 'normal' | 'large' = 'normal'
): boolean {
  const result = checkContrast(foreground, background);
  const threshold = WCAG_THRESHOLDS[level][textSize];
  return result.ratio >= threshold;
}

/**
 * Adjust a color to achieve target contrast against a background.
 * Simple approach: lighten or darken the foreground.
 */
export function adjustForContrast(
  foreground: string,
  background: string,
  targetRatio: number
): string {
  const rgb = hexToRgb(foreground);
  if (!rgb) return foreground;

  let adjusted = foreground;
  let ratio = calculateContrastRatio(adjusted, background);

  // Try lightening
  let step = 0;
  while (ratio < targetRatio && step < 20) {
    rgb.r = Math.min(255, rgb.r + 10);
    rgb.g = Math.min(255, rgb.g + 10);
    rgb.b = Math.min(255, rgb.b + 10);
    adjusted = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
    ratio = calculateContrastRatio(adjusted, background);
    step++;
  }

  // If lightening failed, try darkening from original
  if (ratio < targetRatio) {
    rgb.r = Math.max(0, parseInt(foreground.slice(1, 3), 16) - 10);
    rgb.g = Math.max(0, parseInt(foreground.slice(3, 5), 16) - 10);
    rgb.b = Math.max(0, parseInt(foreground.slice(5, 7), 16) - 10);

    step = 0;
    while (ratio < targetRatio && step < 20) {
      rgb.r = Math.max(0, rgb.r - 10);
      rgb.g = Math.max(0, rgb.g - 10);
      rgb.b = Math.max(0, rgb.b - 10);
      adjusted = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
      ratio = calculateContrastRatio(adjusted, background);
      step++;
    }
  }

  return adjusted;
}
