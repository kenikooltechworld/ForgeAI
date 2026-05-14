/**
 * State Management Type Definitions
 * Task 1.14: Create state management type definitions
 * Requirements: 14.1, 14.2, 14.3
 */

import type { DesignTokens } from './design-tokens';
import type { ComponentLibrary } from './component-library';
import type { InformationArchitecture } from './information-architecture';
import type { Platform } from './platform-adaptation';

/** Design system management state */
export interface DesignSystemState {
  /** Currently loaded design system */
  currentDesignSystem?: {
    tokens: DesignTokens;
    components: ComponentLibrary;
    informationArchitecture: InformationArchitecture;
  };
  /** Path to the saved design system */
  designSystemPath?: string;
  /** Whether a design system is currently loaded */
  isLoaded: boolean;
  /** Last modified timestamp */
  lastModified: number;
  /** Unsaved changes flag */
  hasUnsavedChanges: boolean;
}

/** RAG knowledge base state */
export interface RAGState {
  /** Which collections are initialized */
  initializedCollections: string[];
  /** Which collections failed initialization */
  failedCollections: string[];
  /** Total documents ingested */
  totalDocuments: number;
  /** Whether the knowledge base is ready for queries */
  isReady: boolean;
  /** Last ingestion timestamp */
  lastIngestedAt?: number;
}

/** Detected project context for design suggestions */
export interface ProjectDesignContext {
  /** Detected UI framework */
  uiFramework?: 'react' | 'vue' | 'angular' | 'svelte' | 'unknown';
  /** Detected styling approach */
  stylingApproach?: 'tailwind' | 'css-modules' | 'styled-components' | 'emotion' | 'css-in-js' | 'unknown';
  /** Detected existing design system */
  existingDesignSystem?:
    | 'mui'
    | 'chakra'
    | 'radix'
    | 'mantine'
    | 'shadcn'
    | 'antd'
    | 'none'
    | 'unknown';
  /** Detected platforms (from package.json or config) */
  targetPlatforms: Platform[];
  /** Whether TypeScript is used */
  usesTypeScript: boolean;
  /** Tailwind config path (if applicable) */
  tailwindConfigPath?: string;
  /** Existing CSS custom properties found */
  existingCSSVariables?: string[];
  /** Project root path */
  projectRoot: string;
}

/** Complete UI/UX agent state */
export interface UIUXAgentState {
  /** Design system state */
  designSystem: DesignSystemState;
  /** RAG knowledge base state */
  rag: RAGState;
  /** Detected project context */
  projectContext: ProjectDesignContext;
  /** Current operation in progress */
  currentOperation?: string;
  /** Operation progress (0-100) */
  operationProgress: number;
}
