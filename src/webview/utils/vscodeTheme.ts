/**
 * VS Code Theme Utilities
 *
 * Centralized access to VS Code CSS variables for type safety and consistency.
 * Use these helpers instead of hardcoding CSS variable strings.
 *
 * Requirements: 21.1, 21.2, 21.3, 21.4
 */

/**
 * VS Code Theme Colors
 *
 * Organized by category for easy discovery.
 * All values are CSS variable references that adapt to the current VS Code theme.
 */
export const vscodeTheme = {
  /**
   * Editor colors
   */
  editor: {
    background: "var(--vscode-editor-background)",
    foreground: "var(--vscode-editor-foreground)",
    fontFamily: "var(--vscode-editor-font-family)",
    fontSize: "var(--vscode-editor-font-size)",
    fontWeight: "var(--vscode-editor-font-weight)",
  },

  /**
   * Input field colors
   */
  input: {
    background: "var(--vscode-input-background)",
    foreground: "var(--vscode-input-foreground)",
    border: "var(--vscode-input-border)",
    placeholderForeground: "var(--vscode-input-placeholderForeground)",
  },

  /**
   * Button colors
   */
  button: {
    primary: {
      background: "var(--vscode-button-background)",
      foreground: "var(--vscode-button-foreground)",
      hover: "var(--vscode-button-hoverBackground)",
    },
    secondary: {
      background: "var(--vscode-button-secondaryBackground)",
      foreground: "var(--vscode-button-secondaryForeground)",
      hover: "var(--vscode-button-secondaryHoverBackground)",
    },
  },

  /**
   * Text colors
   */
  text: {
    foreground: "var(--vscode-foreground)",
    description: "var(--vscode-descriptionForeground)",
    link: "var(--vscode-textLink-foreground)",
    linkActive: "var(--vscode-textLink-activeForeground)",
  },

  /**
   * Panel and sidebar colors
   */
  panel: {
    border: "var(--vscode-panel-border)",
    background: "var(--vscode-panel-background)",
  },

  sidebar: {
    background: "var(--vscode-sideBar-background)",
    foreground: "var(--vscode-sideBar-foreground)",
    border: "var(--vscode-sideBar-border)",
  },

  /**
   * Status colors
   */
  status: {
    error: "var(--vscode-errorForeground)",
    warning: "var(--vscode-editorWarning-foreground)",
    info: "var(--vscode-editorInfo-foreground)",
    success: "var(--vscode-testing-iconPassed)",
  },

  /**
   * Tab colors
   */
  tab: {
    activeBackground: "var(--vscode-tab-activeBackground)",
    activeForeground: "var(--vscode-tab-activeForeground)",
    inactiveBackground: "var(--vscode-tab-inactiveBackground)",
    inactiveForeground: "var(--vscode-tab-inactiveForeground)",
    border: "var(--vscode-tab-border)",
  },

  /**
   * List and tree colors
   */
  list: {
    activeBackground: "var(--vscode-list-activeSelectionBackground)",
    activeForeground: "var(--vscode-list-activeSelectionForeground)",
    hoverBackground: "var(--vscode-list-hoverBackground)",
    hoverForeground: "var(--vscode-list-hoverForeground)",
  },

  /**
   * Scrollbar colors
   */
  scrollbar: {
    background: "var(--vscode-scrollbarSlider-background)",
    hover: "var(--vscode-scrollbarSlider-hoverBackground)",
    active: "var(--vscode-scrollbarSlider-activeBackground)",
  },

  /**
   * Focus border
   */
  focus: {
    border: "var(--vscode-focusBorder)",
  },

  /**
   * Diff editor colors
   */
  diff: {
    insertedBackground: "var(--vscode-diffEditor-insertedTextBackground)",
    removedBackground: "var(--vscode-diffEditor-removedTextBackground)",
  },
} as const;

/**
 * Type-safe style object for React inline styles
 */
export interface VSCodeThemeStyles {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  border?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
}

/**
 * Create a style object with VS Code theme colors
 *
 * @example
 * const styles = createThemeStyles({
 *   backgroundColor: vscodeTheme.editor.background,
 *   color: vscodeTheme.editor.foreground,
 * });
 */
export function createThemeStyles(styles: VSCodeThemeStyles): React.CSSProperties {
  return styles;
}

/**
 * Get a CSS variable value at runtime
 *
 * @param variable - CSS variable name (with or without var() wrapper)
 * @returns The computed value of the CSS variable
 *
 * @example
 * const bgColor = getCSSVariable('--vscode-editor-background');
 * const fgColor = getCSSVariable(vscodeTheme.editor.foreground);
 */
export function getCSSVariable(variable: string): string {
  // Remove var() wrapper if present
  const varName = variable.replace(/^var\(/, "").replace(/\)$/, "");

  // Get computed style from document root
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/**
 * Check if the current theme is dark
 *
 * @returns true if the current theme is dark, false otherwise
 *
 * @example
 * if (isDarkTheme()) {
 *   // Apply dark theme specific logic
 * }
 */
export function isDarkTheme(): boolean {
  const bgColor = getCSSVariable(vscodeTheme.editor.background);

  // Parse RGB values and calculate luminance
  // This is a simple heuristic - VS Code themes can be complex
  const rgb = bgColor.match(/\d+/g);
  if (!rgb || rgb.length < 3) {return true;} // Default to dark if can't determine

  const [r, g, b] = rgb.map(Number);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance < 0.5;
}
