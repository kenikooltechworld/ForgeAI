/**
 * Examples and usage patterns for the message classification system
 */

import { createMessageRouter, MessageCategory, TEST_EXAMPLES } from './index';

/**
 * Example: Basic classification usage
 */
export function basicClassificationExample() {
  const router = createMessageRouter();

  const examples = [
    'I want to build a landing page',
    'What is the current architecture?',
    'Fix the login bug',
    'Analyze the performance issues',
    'Thanks for the help!',
  ];

  console.log('=== Basic Classification Examples ===');

  examples.forEach((message) => {
    const result = router.route({ userMessage: message }, 'You are a helpful coding assistant.');

    console.log(`Message: "${message}"`);
    console.log(`Category: ${result.classification.category}`);
    console.log(`Confidence: ${result.classification.confidence.toFixed(2)}`);
    console.log(`Should use tools: ${result.shouldUseTool}`);
    console.log(`Max tool calls: ${result.maxToolCalls}`);
    console.log(`Reasoning: ${result.classification.reasoning}`);
    console.log('---');
  });
}

/**
 * Example: Contextual classification
 */
export function contextualClassificationExample() {
  const router = createMessageRouter();

  console.log('=== Contextual Classification Examples ===');

  // Same message, different contexts
  const message = "Let's build something";

  const contexts = [
    {
      description: 'Empty workspace',
      context: {
        userMessage: message,
        workspaceContext: { isEmpty: true, hasErrors: false },
      },
    },
    {
      description: 'Workspace with errors',
      context: {
        userMessage: message,
        workspaceContext: { isEmpty: false, hasErrors: true },
      },
    },
    {
      description: 'Normal workspace',
      context: {
        userMessage: message,
        workspaceContext: { isEmpty: false, hasErrors: false },
      },
    },
  ];

  contexts.forEach(({ description, context }) => {
    const result = router.route(context, 'You are a helpful coding assistant.');

    console.log(`Context: ${description}`);
    console.log(`Category: ${result.classification.category}`);
    console.log(`Reasoning: ${result.classification.reasoning}`);
    console.log('---');
  });
}

/**
 * Example: Follow-up message handling
 */
export function followUpExample() {
  const router = createMessageRouter();

  console.log('=== Follow-up Message Examples ===');

  // Simulate a conversation
  const conversation = [
    "What's the best approach for user authentication?",
    'And what about password hashing?',
    "Okay, let's implement it",
    'Also add rate limiting',
  ];

  conversation.forEach((message, index) => {
    const result = router.route({ userMessage: message }, 'You are a helpful coding assistant.');

    console.log(`Message ${index + 1}: "${message}"`);
    console.log(`Category: ${result.classification.category}`);
    console.log(`Reasoning: ${result.classification.reasoning}`);
    console.log('---');
  });
}

/**
 * Example: Testing classification accuracy
 */
export function accuracyTestExample() {
  const router = createMessageRouter();

  console.log('=== Classification Accuracy Test ===');

  const testResult = router.testRouting(
    TEST_EXAMPLES.map((example) => ({
      message: example.message,
      expected: example.expected,
    })),
    'You are a helpful coding assistant.'
  );

  console.log(`Overall Accuracy: ${(testResult.accuracy * 100).toFixed(1)}%`);
  console.log(`Total Examples: ${testResult.results.length}`);
  console.log(`Correct Classifications: ${testResult.results.filter((r) => r.correct).length}`);

  console.log('\nDetailed Results:');
  testResult.results.forEach((result) => {
    const status = result.correct ? '✅' : '❌';
    console.log(`${status} "${result.message}"`);
    console.log(
      `   Expected: ${result.expected}, Got: ${result.actual} (${result.confidence.toFixed(2)})`
    );
  });

  // Show category distribution
  const categoryStats = new Map<MessageCategory, { correct: number; total: number }>();

  testResult.results.forEach((result) => {
    const stats = categoryStats.get(result.expected) || { correct: 0, total: 0 };
    stats.total++;
    if (result.correct) stats.correct++;
    categoryStats.set(result.expected, stats);
  });

  console.log('\nAccuracy by Category:');
  categoryStats.forEach((stats, category) => {
    const accuracy = ((stats.correct / stats.total) * 100).toFixed(1);
    console.log(`${category}: ${accuracy}% (${stats.correct}/${stats.total})`);
  });
}

/**
 * Example: System prompt modification
 */
export function systemPromptExample() {
  const router = createMessageRouter();

  console.log('=== System Prompt Modification Examples ===');

  const basePrompt = 'You are ForgeAI, a helpful coding assistant.';
  const messages = [
    'What is React?',
    'I want to build a React app',
    'Fix this React component',
    'Review my React code',
  ];

  messages.forEach((message) => {
    const result = router.route({ userMessage: message }, basePrompt);

    console.log(`Message: "${message}"`);
    console.log(`Category: ${result.classification.category}`);
    console.log('System Prompt Preview:');
    console.log(result.systemPrompt.split('\n').slice(0, 5).join('\n') + '...');
    console.log('---');
  });
}

/**
 * Run all examples
 */
export function runAllExamples() {
  basicClassificationExample();
  contextualClassificationExample();
  followUpExample();
  accuracyTestExample();
  systemPromptExample();
}

// Export for easy testing
export const examples = {
  basic: basicClassificationExample,
  contextual: contextualClassificationExample,
  followUp: followUpExample,
  accuracy: accuracyTestExample,
  systemPrompt: systemPromptExample,
  all: runAllExamples,
};
