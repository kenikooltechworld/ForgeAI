# Message Classification System

A smart message classification system that categorizes user messages and routes them to appropriate response handlers. This system bridges the current ForgeAI implementation to the future multi-agent orchestration system.

## Overview

The classification system analyzes user messages and categorizes them into one of five types:

- **QUESTION** - Information requests ("What is the plan?", "How does this work?")
- **PLANNING** - Strategy and planning requests ("I want to build X", "What's the best approach?")
- **EXECUTION** - Direct action requests ("Fix this bug", "Implement feature X")
- **ANALYSIS** - Investigation requests ("Review this code", "Find issues")
- **CONVERSATION** - General chat and acknowledgments ("Thanks!", "Looks good")

## Key Features

### 🎯 Intelligent Classification

- Pattern-based matching with confidence scores
- Keyword analysis with contextual weighting
- Fallback categories for ambiguous messages
- Contextual adjustments based on workspace state

### 🔄 Category-Specific Behavior

- **Questions**: Focus on information gathering, limited tool usage
- **Planning**: Ask clarifying questions, create structured plans
- **Execution**: Immediate action with full tool access
- **Analysis**: Thorough investigation with targeted tool usage
- **Conversation**: Natural responses, minimal tool usage

### 📊 Metrics and Monitoring

- Classification accuracy tracking
- Category distribution analysis
- Confidence score monitoring
- Fallback rate measurement

### 🧠 Context Awareness

- Follow-up message detection
- Continuation pattern recognition
- Workspace state consideration
- Session history integration

## Usage

### Basic Classification

```typescript
import { createMessageRouter } from './classification';

const router = createMessageRouter();

const result = router.route(
  { userMessage: 'I want to build a landing page' },
  'You are a helpful coding assistant.'
);

console.log(result.classification.category); // "planning"
console.log(result.shouldUseTool); // false
console.log(result.maxToolCalls); // 2
```

### Integration with AgentLoop

The system is automatically integrated with `AgentLoop`. When you send a message, it will be classified and the appropriate system prompt and tool restrictions will be applied.

```typescript
// The AgentLoop now automatically:
// 1. Classifies incoming messages
// 2. Applies category-specific system prompts
// 3. Adjusts tool usage permissions
// 4. Sets appropriate iteration limits
```

### Testing Classification

```typescript
import { TEST_EXAMPLES } from './classification';

const router = createMessageRouter();
const testResult = router.testRouting(TEST_EXAMPLES, basePrompt);

console.log(`Accuracy: ${testResult.accuracy * 100}%`);
```

## Architecture

```
User Message
     ↓
MessageClassifier
     ↓
Classification Result
     ↓
ResponseHandlerManager
     ↓
Category-Specific System Prompt
     ↓
AgentLoop Execution
```

### Core Components

1. **MessageClassifier** - Analyzes messages and assigns categories
2. **ResponseHandlerManager** - Manages category-specific behavior
3. **MessageRouter** - Orchestrates classification and routing
4. **Pattern Definitions** - Configurable classification patterns

## Classification Patterns

### Question Patterns

- Starts with question words (what, how, why, etc.)
- Contains question marks
- Uses inquiry phrases ("tell me about", "explain")

### Planning Patterns

- Contains intention words ("want to", "need to")
- Mentions creation/building ("build", "create", "develop")
- Asks about approaches or strategies

### Execution Patterns

- Starts with action verbs ("fix", "implement", "add")
- Contains direct commands ("run", "execute")
- Uses imperative language

### Analysis Patterns

- Contains investigation words ("analyze", "review", "check")
- Mentions finding issues ("find bugs", "identify problems")
- Asks about debugging or optimization

### Conversation Patterns

- Greetings and acknowledgments
- Positive feedback ("good", "thanks")
- Continuation phrases ("ok", "sure")

## Configuration

### Adjusting Classification Patterns

Edit `src/extension/classification/patterns.ts` to modify classification behavior:

```typescript
export const CLASSIFICATION_PATTERNS: ClassificationPattern[] = [
  {
    category: MessageCategory.PLANNING,
    patterns: [
      /^(i want to|i need to)\b/i,
      // Add new patterns here
    ],
    keywords: ['build', 'create', 'plan'],
    confidence: 0.9,
  },
];
```

### Customizing Response Handlers

Edit `src/extension/classification/ResponseHandlers.ts` to modify category behavior:

```typescript
{
  category: MessageCategory.PLANNING,
  systemPrompt: `# Response Mode: Planning

  Your custom planning instructions here...`,
  shouldUseTool: false,
  maxToolCalls: 2
}
```

## Metrics and Monitoring

### Classification Metrics

```typescript
const metrics = router.getMetrics();

console.log(`Total classifications: ${metrics.totalClassifications}`);
console.log(`Average confidence: ${metrics.averageConfidence}`);
console.log(`Fallback rate: ${metrics.fallbackRate}`);

// Category distribution
metrics.categoryDistribution.forEach((count, category) => {
  console.log(`${category}: ${count} messages`);
});
```

### Routing History

```typescript
const history = router.getHistory();

history.forEach((result) => {
  console.log(`${result.metadata.timestamp}: ${result.classification.category}`);
});
```

## Testing

Run the test suite:

```bash
npm test -- src/extension/classification/__tests__/
```

Run examples:

```typescript
import { examples } from './classification/examples';

examples.accuracy(); // Test classification accuracy
examples.basic(); // Basic classification examples
examples.all(); // Run all examples
```

## Future Evolution

This classification system is designed to evolve into the full multi-agent orchestration system:

- **Categories → Agents**: Each category will become a specialized agent
- **Patterns → Intelligence**: Pattern matching will evolve into learned behavior
- **Routing → Orchestration**: Simple routing will become complex workflow management

### Migration Path

1. **Phase 1** ✅ - Message classification and routing
2. **Phase 2** - Enhanced contextual understanding
3. **Phase 3** - Specialized agent implementations
4. **Phase 4** - Full multi-agent orchestration with LangGraph

## Troubleshooting

### Low Classification Accuracy

1. Check if new message patterns need to be added
2. Adjust confidence thresholds in patterns
3. Review keyword lists for completeness
4. Test with more diverse examples

### Incorrect Tool Usage

1. Verify `shouldUseTool` settings in response handlers
2. Check `maxToolCalls` limits
3. Review system prompt instructions
4. Test category-specific behavior

### Performance Issues

1. Monitor classification metrics
2. Optimize pattern matching regexes
3. Reduce unnecessary contextual processing
4. Cache classification results if needed

## Contributing

When adding new classification patterns:

1. Add patterns to `patterns.ts`
2. Update test examples in `index.ts`
3. Add corresponding response handler
4. Test accuracy with new examples
5. Update documentation

## Examples

See `src/extension/classification/examples.ts` for comprehensive usage examples and testing patterns.
