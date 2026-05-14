/**
 * Design Token Type Definitions
 * Task 1.1: Create design token type definitions
 * Requirements: 1.1, 1.3, 1.5, 1.6
 */

/** Supported color scale weights (50-950) */
export type ColorWeight = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

/** A single color scale with weights from 50 to 950 */
export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

/** All color tokens for a design system */
export interface ColorTokens {
  /** Primary brand color scale */
  primary: ColorScale;
  /** Secondary/accent color scale */
  secondary: ColorScale;
  /** Accent/emphasis color scale */
  accent: ColorScale;
  /** Neutral gray scale */
  neutral: ColorScale;
  /** Success/positive color scale */
  success: ColorScale;
  /** Warning/caution color scale */
  warning: ColorScale;
  /** Error/danger color scale */
  error: ColorScale;
  /** Info/information color scale */
  info: ColorScale;
}

/** Semantic color tokens for theme-aware colors */
export interface SemanticColorTokens {
  /** Background colors */
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    elevated: string;
    overlay: string;
  };
  /** Text/content colors */
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
  };
  /** Border/divider colors */
  border: {
    primary: string;
    secondary: string;
    focus: string;
  };
  /** Interactive element colors */
  interactive: {
    default: string;
    hover: string;
    active: string;
    disabled: string;
  };
}

/** Font family definition */
export interface FontFamily {
  /** Primary font stack (CSS font-family value) */
  primary: string;
  /** Secondary/monospace font stack */
  mono: string;
  /** Fallback font stack */
  fallback: string;
}

/** Individual typography size definition */
export interface TypographySize {
  /** Font size in rem/px */
  size: string;
  /** Line height */
  lineHeight: string;
  /** Font weight */
  weight: number;
  /** Letter spacing */
  letterSpacing: string;
}

/** All typography tokens */
export interface TypographyTokens {
  /** Font families */
  fontFamily: FontFamily;
  /** Heading sizes */
  heading: {
    h1: TypographySize;
    h2: TypographySize;
    h3: TypographySize;
    h4: TypographySize;
    h5: TypographySize;
    h6: TypographySize;
  };
  /** Body text sizes */
  body: {
    large: TypographySize;
    medium: TypographySize;
    small: TypographySize;
  };
  /** UI element text sizes */
  ui: {
    label: TypographySize;
    caption: TypographySize;
    button: TypographySize;
    input: TypographySize;
  };
}

/** Spacing scale token */
export interface SpacingTokens {
  /** Base unit (typically 4px or 0.25rem) */
  base: string;
  /** Scale values */
  scale: {
    0: string;
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: string;
    8: string;
    10: string;
    12: string;
    16: string;
    20: string;
    24: string;
    32: string;
    40: string;
    48: string;
    64: string;
  };
}

/** Shadow/elevation tokens */
export interface ShadowTokens {
  /** Material Design-style elevation levels */
  elevation: {
    0: string;
    1: string;
    2: string;
    3: string;
    4: string;
    6: string;
    8: string;
    12: string;
    16: string;
    24: string;
  };
}

/** Animation timing tokens */
export interface AnimationTokens {
  /** Duration values */
  duration: {
    instant: string;
    fast: string;
    normal: string;
    slow: string;
  };
  /** Easing functions */
  easing: {
    default: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
    spring: string;
  };
}

/** Border radius tokens */
export interface RadiusTokens {
  /** Scale values */
  scale: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
}

/** Breakpoint tokens for responsive design */
export interface BreakpointTokens {
  /** Standard breakpoints */
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

/** Complete design token collection */
export interface DesignTokens {
  /** Name/version of the design system */
  name: string;
  version: string;
  /** Color definitions */
  colors: ColorTokens;
  /** Semantic/theme-aware colors */
  semanticColors: SemanticColorTokens;
  /** Typography definitions */
  typography: TypographyTokens;
  /** Spacing definitions */
  spacing: SpacingTokens;
  /** Shadow/elevation definitions */
  shadows: ShadowTokens;
  /** Animation definitions */
  animation: AnimationTokens;
  /** Border radius definitions */
  radius: RadiusTokens;
  /** Responsive breakpoints */
  breakpoints: BreakpointTokens;
}
