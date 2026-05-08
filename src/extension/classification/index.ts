/**
 * Message classification system exports
 */

import { MessageCategory } from './types';
import { MessageRouter } from './MessageRouter';

export { MessageCategory } from './types';
export type {
  ClassificationResult,
  ClassificationPattern,
  ResponseHandler,
  ClassificationMetrics,
} from './types';

export { MessageClassifier } from './MessageClassifier';
export { ResponseHandlerManager } from './ResponseHandlers';
export { MessageRouter } from './MessageRouter';
export type { RoutingContext, RoutingResult } from './MessageRouter';

export { CLASSIFICATION_PATTERNS, CATEGORY_DESCRIPTIONS } from './patterns';
export { RESPONSE_HANDLERS } from './ResponseHandlers';

// Convenience function to create a configured message router
export function createMessageRouter(): MessageRouter {
  return new MessageRouter();
}

// Test examples for validation
export const TEST_EXAMPLES = [
  {
    message: 'I want to build a landing page',
    expected: MessageCategory.PLANNING,
    description: "Planning request with 'want to build'",
  },
  {
    message: 'What is the plan for the landing page?',
    expected: MessageCategory.QUESTION,
    description: "Question starting with 'What' and containing '?'",
  },
  {
    message: 'Fix the authentication bug',
    expected: MessageCategory.EXECUTION,
    description: "Execution request starting with 'Fix'",
  },
  {
    message: 'Review this code for issues',
    expected: MessageCategory.ANALYSIS,
    description: "Analysis request with 'Review' and 'issues'",
  },
  {
    message: 'Thanks, that looks good!',
    expected: MessageCategory.CONVERSATION,
    description: 'Conversational acknowledgment',
  },
  {
    message: 'How does authentication work in this app?',
    expected: MessageCategory.QUESTION,
    description: "Question starting with 'How does'",
  },
  {
    message: 'Create a new React component',
    expected: MessageCategory.EXECUTION,
    description: 'Direct execution request',
  },
  {
    message: "What's the best approach for user management?",
    expected: MessageCategory.PLANNING,
    description: 'Planning question about approach',
  },
  {
    message: 'Find all the TODO comments',
    expected: MessageCategory.ANALYSIS,
    description: 'Analysis request to find items',
  },
  {
    message: "Okay, let's proceed",
    expected: MessageCategory.CONVERSATION,
    description: 'Conversational continuation',
  },
] as const;
