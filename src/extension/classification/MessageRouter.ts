/**
 * Message routing system that integrates classification with execution
 */

import { MessageClassifier } from './MessageClassifier';
import { ResponseHandlerManager } from './ResponseHandlers';
import { MessageCategory, ClassificationResult } from './types';

export interface RoutingContext {
  userMessage: string;
  workspaceContext?: any;
  sessionHistory?: string[];
}

export interface RoutingResult {
  classification: ClassificationResult;
  systemPrompt: string;
  shouldUseTool: boolean;
  maxToolCalls: number;
  metadata: {
    category: MessageCategory;
    confidence: number;
    reasoning: string;
    timestamp: number;
  };
}

export class MessageRouter {
  private classifier = new MessageClassifier();
  private handlerManager = new ResponseHandlerManager();
  private routingHistory: RoutingResult[] = [];

  /**
   * Route a message and return execution parameters
   */
  route(context: RoutingContext, baseSystemPrompt: string): RoutingResult {
    // 1. Classify the message
    const classification = this.classifier.classify(context.userMessage);

    // 2. Apply context-based adjustments
    const adjustedClassification = this.applyContextualAdjustments(classification, context);

    // 3. Build category-specific system prompt
    const systemPrompt = this.handlerManager.buildSystemPrompt(
      adjustedClassification.category,
      baseSystemPrompt
    );

    // 4. Get execution parameters
    const shouldUseTool = this.handlerManager.shouldUseTool(adjustedClassification.category);
    const maxToolCalls = this.handlerManager.getMaxToolCalls(adjustedClassification.category);

    // 5. Create routing result
    const result: RoutingResult = {
      classification: adjustedClassification,
      systemPrompt,
      shouldUseTool,
      maxToolCalls,
      metadata: {
        category: adjustedClassification.category,
        confidence: adjustedClassification.confidence,
        reasoning: adjustedClassification.reasoning,
        timestamp: Date.now(),
      },
    };

    // 6. Store in history
    this.routingHistory.push(result);

    return result;
  }

  /**
   * Apply contextual adjustments to classification
   */
  private applyContextualAdjustments(
    classification: ClassificationResult,
    context: RoutingContext
  ): ClassificationResult {
    let adjustedClassification = { ...classification };

    // Check for follow-up patterns
    if (this.isFollowUpMessage(context)) {
      adjustedClassification = this.handleFollowUp(classification, context);
    }

    // Check for continuation patterns
    if (this.isContinuationMessage(context)) {
      adjustedClassification = this.handleContinuation(classification, context);
    }

    // Apply workspace context
    if (context.workspaceContext) {
      adjustedClassification = this.applyWorkspaceContext(
        adjustedClassification,
        context.workspaceContext
      );
    }

    return adjustedClassification;
  }

  /**
   * Check if this is a follow-up message
   */
  private isFollowUpMessage(context: RoutingContext): boolean {
    const followUpPatterns = [
      /^(and|also|additionally|furthermore|moreover)\b/i,
      /\b(after that|then|next|following)\b/i,
      /^(what about|how about|can you also)\b/i,
    ];

    return followUpPatterns.some((pattern) => pattern.test(context.userMessage));
  }

  /**
   * Check if this is a continuation message
   */
  private isContinuationMessage(context: RoutingContext): boolean {
    const continuationPatterns = [
      /^(continue|proceed|go ahead|keep going)\b/i,
      /^(yes|ok|okay|sure|alright)\b/i,
      /^(do it|go for it|sounds good)\b/i,
    ];

    return continuationPatterns.some((pattern) => pattern.test(context.userMessage));
  }

  /**
   * Handle follow-up messages
   */
  private handleFollowUp(
    classification: ClassificationResult,
    context: RoutingContext
  ): ClassificationResult {
    // Get the last routing result
    const lastResult = this.routingHistory[this.routingHistory.length - 1];

    if (lastResult) {
      // If the last message was planning, this follow-up might be execution
      if (
        lastResult.classification.category === MessageCategory.PLANNING &&
        classification.category === MessageCategory.CONVERSATION
      ) {
        return {
          ...classification,
          category: MessageCategory.EXECUTION,
          reasoning: `Follow-up to planning - likely execution intent: ${classification.reasoning}`,
        };
      }

      // If the last message was a question, this might be more questions
      if (
        lastResult.classification.category === MessageCategory.QUESTION &&
        classification.confidence < 0.6
      ) {
        return {
          ...classification,
          category: MessageCategory.QUESTION,
          reasoning: `Follow-up question: ${classification.reasoning}`,
        };
      }
    }

    return classification;
  }

  /**
   * Handle continuation messages
   */
  private handleContinuation(
    classification: ClassificationResult,
    context: RoutingContext
  ): ClassificationResult {
    // Get the last routing result
    const lastResult = this.routingHistory[this.routingHistory.length - 1];

    if (lastResult && classification.category === MessageCategory.CONVERSATION) {
      // Continue with the same category as the last message
      return {
        ...classification,
        category: lastResult.classification.category,
        reasoning: `Continuation of ${lastResult.classification.category}: ${classification.reasoning}`,
      };
    }

    return classification;
  }

  /**
   * Apply workspace context to classification
   */
  private applyWorkspaceContext(
    classification: ClassificationResult,
    workspaceContext: any
  ): ClassificationResult {
    // If workspace has errors/issues and message is vague, lean toward analysis
    if (workspaceContext.hasErrors && classification.confidence < 0.6) {
      return {
        ...classification,
        category: MessageCategory.ANALYSIS,
        reasoning: `Workspace has errors - interpreting as analysis request: ${classification.reasoning}`,
      };
    }

    // If workspace is empty and message mentions building, lean toward planning
    if (
      workspaceContext.isEmpty &&
      classification.category === MessageCategory.EXECUTION &&
      /\b(build|create|make)\b/i.test(classification.reasoning)
    ) {
      return {
        ...classification,
        category: MessageCategory.PLANNING,
        reasoning: `Empty workspace + build request - interpreting as planning: ${classification.reasoning}`,
      };
    }

    return classification;
  }

  /**
   * Get routing history
   */
  getHistory(): RoutingResult[] {
    return [...this.routingHistory];
  }

  /**
   * Clear routing history
   */
  clearHistory(): void {
    this.routingHistory = [];
  }

  /**
   * Get classification metrics
   */
  getMetrics() {
    return this.classifier.getMetrics();
  }

  /**
   * Test the routing system
   */
  testRouting(
    examples: Array<{
      message: string;
      expected: MessageCategory;
      context?: Partial<RoutingContext>;
    }>,
    baseSystemPrompt: string = ''
  ): {
    accuracy: number;
    results: Array<{
      message: string;
      expected: MessageCategory;
      actual: MessageCategory;
      correct: boolean;
      confidence: number;
    }>;
  } {
    const results = examples.map((example) => {
      const context: RoutingContext = {
        userMessage: example.message,
        ...example.context,
      };

      const routing = this.route(context, baseSystemPrompt);

      return {
        message: example.message,
        expected: example.expected,
        actual: routing.classification.category,
        correct: routing.classification.category === example.expected,
        confidence: routing.classification.confidence,
      };
    });

    const correct = results.filter((r) => r.correct).length;
    const accuracy = correct / results.length;

    return { accuracy, results };
  }
}
