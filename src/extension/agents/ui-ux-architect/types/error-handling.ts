/**
 * Error Handling Type Definitions
 * Task 1.13: Create error handling type definitions
 * Requirements: 19.1, 19.2, 19.3
 */

/** All possible UI/UX agent error categories */
export type UIUXAgentErrorType =
  | 'design-token-generation-failed'
  | 'color-contrast-insufficient'
  | 'component-hierarchy-invalid'
  | 'platform-unsupported'
  | 'accessibility-check-failed'
  | 'rag-query-failed'
  | 'rag-collection-missing'
  | 'design-system-save-failed'
  | 'token-export-failed'
  | 'browser-capability-unavailable'
  | 'invalid-user-input'
  | 'llm-generation-error'
  | 'unknown';

/** Structured error response for UI/UX agent */
export interface UIUXAgentError {
  /** Error category */
  type: UIUXAgentErrorType;
  /** Human-readable message */
  message: string;
  /** Error code for programmatic handling */
  code: string;
  /** Whether this error is recoverable */
  recoverable: boolean;
  /** Suggested recovery action */
  recoveryHint: string;
  /** Original error (if any) */
  cause?: Error;
  /** Additional context */
  context?: Record<string, unknown>;
}

/** Recovery strategy for a specific error type */
export interface ErrorRecoveryStrategy {
  /** Error type this strategy handles */
  errorType: UIUXAgentErrorType;
  /** Strategy description */
  description: string;
  /** Steps to recover */
  steps: string[];
  /** Fallback strategy if this one fails */
  fallback?: UIUXAgentErrorType;
}

/** Error handling strategies registry */
export const ErrorHandlingStrategies: ErrorRecoveryStrategy[] = [
  {
    errorType: 'color-contrast-insufficient',
    description: 'Adjust colors to meet WCAG contrast requirements',
    steps: [
      'Identify failing color pairs',
      'Lighten background or darken text',
      'Re-run contrast check',
    ],
  },
  {
    errorType: 'rag-query-failed',
    description: 'Retry with simplified query or fallback knowledge',
    steps: [
      'Simplify the query terms',
      'Try alternative keywords',
      'Use built-in default knowledge if available',
    ],
    fallback: 'unknown',
  },
  {
    errorType: 'rag-collection-missing',
    description: 'Seed the missing collection with default data',
    steps: [
      'Check if collection exists in ChromaDB',
      'Run seed script for the collection',
      'Retry the query',
    ],
  },
  {
    errorType: 'design-system-save-failed',
    description: 'Retry with disk space check and alternative path',
    steps: [
      'Check available disk space',
      'Verify .forgeai/design-system/ directory exists',
      'Try saving to alternative path',
    ],
  },
  {
    errorType: 'llm-generation-error',
    description: 'Retry with shorter prompt or different model',
    steps: [
      'Reduce prompt context length',
      'Switch to fallback Ollama model',
      'Retry with simplified request',
    ],
  },
];
