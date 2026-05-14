/**
 * Theme Token Generator
 * Task 5.6: Generate light/dark theme-aware semantic tokens
 * Requirements: 15.1, 15.4
 */

import type { SemanticColorTokens, DesignTokens } from '../types/design-tokens';
import { checkContrast } from './ColorContrast';

/** Generated theme pair */
export interface GeneratedTheme {
  /** Light mode semantic tokens */
  light: SemanticColorTokens;
  /** Dark mode semantic tokens */
  dark: SemanticColorTokens;
  /** Contrast compliance results */
  compliance: {
    lightTextOnBackground: boolean;
    darkTextOnBackground: boolean;
  };
}

/**
 * Generate semantic color tokens for light and dark themes from a base color palette.
 */
export function generateThemeTokens(designTokens: DesignTokens): GeneratedTheme {
  const { colors } = designTokens;

  // Light theme: light backgrounds, dark text
  const light: SemanticColorTokens = {
    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
      elevated: '#ffffff',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
      primary: colors.neutral['900'],
      secondary: colors.neutral['600'],
      tertiary: colors.neutral['400'],
      disabled: colors.neutral['300'],
      inverse: '#ffffff',
    },
    border: {
      primary: colors.neutral['200'],
      secondary: colors.neutral['100'],
      focus: colors.primary['500'],
    },
    interactive: {
      default: colors.primary['600'],
      hover: colors.primary['700'],
      active: colors.primary['800'],
      disabled: colors.neutral['300'],
    },
  };

  // Dark theme: dark backgrounds, light text
  const dark: SemanticColorTokens = {
    background: {
      primary: colors.neutral['900'],
      secondary: colors.neutral['800'],
      tertiary: colors.neutral['700'],
      elevated: colors.neutral['800'],
      overlay: 'rgba(0, 0, 0, 0.75)',
    },
    text: {
      primary: colors.neutral['50'],
      secondary: colors.neutral['300'],
      tertiary: colors.neutral['500'],
      disabled: colors.neutral['600'],
      inverse: colors.neutral['900'],
    },
    border: {
      primary: colors.neutral['700'],
      secondary: colors.neutral['800'],
      focus: colors.primary['400'],
    },
    interactive: {
      default: colors.primary['500'],
      hover: colors.primary['400'],
      active: colors.primary['300'],
      disabled: colors.neutral['600'],
    },
  };

  // Verify contrast compliance
  const lightTextCheck = checkContrast(light.text.primary, light.background.primary);
  const darkTextCheck = checkContrast(dark.text.primary, dark.background.primary);

  return {
    light,
    dark,
    compliance: {
      lightTextOnBackground: lightTextCheck.passesAANormal,
      darkTextOnBackground: darkTextCheck.passesAANormal,
    },
  };
}

/**
 * Apply generated themes to a DesignTokens object.
 */
export function applyThemeTokens(designTokens: DesignTokens): DesignTokens {
  const theme = generateThemeTokens(designTokens);
  return {
    ...designTokens,
    semanticColors: theme.light,
  };
}
