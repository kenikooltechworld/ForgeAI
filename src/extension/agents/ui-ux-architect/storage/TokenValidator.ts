/**
 * Token Naming Validator
 * Task 5.4: Validate semantic naming conventions, catch anti-patterns
 * Requirements: 6.5
 */

import type { DesignTokens } from '../types/design-tokens';

/** Validation result for a single token */
export interface TokenValidationIssue {
  /** Token path (e.g., "colors.primary.500") */
  path: string;
  /** Issue description */
  message: string;
  /** Severity */
  severity: 'error' | 'warning';
  /** Suggested fix */
  suggestion?: string;
}

/** Anti-pattern: literal value in name (e.g., "red-500" instead of "primary-500") */
const LITERAL_COLOR_NAMES = /\b(red|green|blue|yellow|orange|purple|pink|gray|grey|black|white)\b/i;

/** Anti-pattern: pixel value in spacing name (e.g., "spacing-16px") */
const PIXEL_VALUE_PATTERN = /\d+px$/i;

/** Anti-pattern: hex value in token name */
const HEX_IN_NAME = /[0-9a-f]{3,6}$/i;

/**
 * Validate token naming conventions.
 */
export function validateTokenNaming(tokens: DesignTokens): TokenValidationIssue[] {
  const issues: TokenValidationIssue[] = [];

  // Check color scale names for literal colors
  for (const [scaleName] of Object.entries(tokens.colors)) {
    if (LITERAL_COLOR_NAMES.test(scaleName)) {
      issues.push({
        path: `colors.${scaleName}`,
        message: `Color scale uses literal color name "${scaleName}"`,
        severity: 'warning',
        suggestion: 'Use semantic names like "primary", "secondary", "accent", "neutral"',
      });
    }
    if (HEX_IN_NAME.test(scaleName)) {
      issues.push({
        path: `colors.${scaleName}`,
        message: `Color scale name contains hex-like value "${scaleName}"`,
        severity: 'error',
        suggestion: 'Use semantic names, not hex values',
      });
    }
  }

  // Check spacing scale for pixel values in names
  for (const [key] of Object.entries(tokens.spacing.scale)) {
    if (PIXEL_VALUE_PATTERN.test(key)) {
      issues.push({
        path: `spacing.scale.${key}`,
        message: `Spacing token name contains pixel value "${key}"`,
        severity: 'warning',
        suggestion: 'Use scale numbers (0, 1, 2, 4, 8) instead of pixel values',
      });
    }
  }

  // Check semantic color naming
  const expectedSemanticCategories = ['background', 'text', 'border', 'interactive'];
  for (const category of expectedSemanticCategories) {
    if (!(category in tokens.semanticColors)) {
      issues.push({
        path: `semanticColors.${category}`,
        message: `Missing semantic color category "${category}"`,
        severity: 'warning',
        suggestion: `Add semanticColors.${category} for theme-aware colors`,
      });
    }
  }

  return issues;
}

/**
 * Check if all token names follow the naming convention.
 */
export function isNamingValid(tokens: DesignTokens): boolean {
  const issues = validateTokenNaming(tokens);
  return !issues.some((i) => i.severity === 'error');
}
