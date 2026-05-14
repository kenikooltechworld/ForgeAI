/**
 * Platform Adaptation Type Definitions
 * Task 1.9: Create platform adaptation type definitions
 * Requirements: 4.1, 4.2
 */

/** Supported platforms */
export type Platform =
  | 'web'
  | 'ios'
  | 'android'
  | 'macos'
  | 'windows'
  | 'vscode-extension'
  | 'browser-extension';

/** Platform-specific design guidelines reference */
export interface PlatformDesign {
  /** Target platform */
  platform: Platform;
  /** Design system name (e.g., "Material Design 3", "Apple HIG") */
  designSystem: string;
  /** Primary navigation pattern */
  navigationPattern: 'bottom-tabs' | 'sidebar' | 'hamburger' | 'top-tabs' | 'rail';
  /** Touch target minimum size */
  touchTargetMinSize: {
    width: number;
    height: number;
    unit: 'px' | 'dp' | 'pt';
  };
  /** Default typography scale factor */
  typographyScale: number;
  /** Default spacing scale factor */
  spacingScale: number;
  /** Platform-specific color adjustments */
  colorAdjustments?: {
    statusBar?: string;
    navigationBar?: string;
    surfaceElevation?: string;
  };
}

/** Adaptation rules for a specific platform */
export interface PlatformAdaptation {
  /** Target platform */
  platform: Platform;
  /** Component substitutions (e.g., use BottomSheet instead of Modal on mobile) */
  componentSubstitutions: Record<string, string>;
  /** Layout adjustments */
  layoutAdjustments: {
    /** Content max width */
    maxContentWidth?: string;
    /** Side padding */
    sidePadding: string;
    /** Grid columns */
    gridColumns: number;
    /** Gap between grid items */
    gridGap: string;
  };
  /** Navigation adaptations */
  navigationAdaptations: {
    /** Primary navigation type */
    primaryNav: 'bottom-tabs' | 'sidebar' | 'hamburger' | 'top-tabs' | 'rail';
    /** Visible item count in primary nav */
    visibleItemCount: number;
    /** Show labels with icons */
    showLabels: boolean;
  };
  /** Animation preferences */
  animationPreferences: {
    /** Prefer reduced motion */
    prefersReducedMotion: boolean;
    /** Default transition type */
    defaultTransition: 'slide' | 'fade' | 'scale' | 'none';
  };
}

/** Responsive breakpoint with layout rules */
export interface ResponsiveBreakpoint {
  /** Breakpoint name */
  name: string;
  /** Min-width CSS value */
  minWidth: string;
  /** Max-width CSS value (optional) */
  maxWidth?: string;
  /** Number of columns */
  columns: number;
  /** Margin/gutter size */
  gutter: string;
  /** Container padding */
  padding: string;
  /** Touch target scaling */
  touchTargetScale: number;
}
