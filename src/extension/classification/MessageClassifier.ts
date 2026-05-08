/**
 * Message classification engine
 */

import { MessageCategory, ClassificationResult, ClassificationMetrics } from './types';
import { CLASSIFICATION_PATTERNS, CATEGORY_DESCRIPTIONS } from './patterns';

export class MessageClassifier {
  private metrics: ClassificationMetrics = {
    totalClassifications: 0,
    categoryDistribution: new Map(),
    averageConfidence: 0,
    fallbackRate: 0,
  };

  /**
   * Classify a user message into a category
   */
  classify(message: string): ClassificationResult {
    const scores = new Map<MessageCategory, number>();
    const matchDetails = new Map<MessageCategory, string[]>();

    // Initialize scores
    Object.values(MessageCategory).forEach((category) => {
      scores.set(category, 0);
      matchDetails.set(category, []);
    });

    // Score each category
    for (const pattern of CLASSIFICATION_PATTERNS) {
      let score = 0;
      const details: string[] = [];

      // Pattern matching (higher weight)
      for (const regex of pattern.patterns) {
        if (regex.test(message)) {
          score += 0.4;
          details.push(`matches pattern: ${regex.source}`);
        }
      }

      // Keyword matching (lower weight)
      const lowerMessage = message.toLowerCase();
      for (const keyword of pattern.keywords) {
        if (lowerMessage.includes(keyword)) {
          score += 0.15;
          details.push(`contains keyword: "${keyword}"`);
        }
      }

      // Apply confidence multiplier
      score *= pattern.confidence;
      scores.set(pattern.category, score);
      matchDetails.set(pattern.category, details);
    }

    // Find highest scoring category
    const sortedScores = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);

    const [topCategory, topScore] = sortedScores[0];
    const [secondCategory, secondScore] = sortedScores[1] || [MessageCategory.CONVERSATION, 0];

    // Determine confidence and fallback
    const confidence = Math.min(topScore, 1.0);
    const fallback = secondScore > 0.3 ? secondCategory : MessageCategory.CONVERSATION;

    // Use fallback if confidence is too low
    const finalCategory = confidence > 0.4 ? topCategory : MessageCategory.CONVERSATION;
    const finalConfidence = confidence > 0.4 ? confidence : 0.5;

    const result: ClassificationResult = {
      category: finalCategory,
      confidence: finalConfidence,
      reasoning: this.generateReasoning(
        message,
        finalCategory,
        finalConfidence,
        matchDetails.get(finalCategory) || []
      ),
      fallback: fallback !== finalCategory ? fallback : undefined,
    };

    // Update metrics
    this.updateMetrics(result);

    return result;
  }

  /**
   * Generate human-readable reasoning for classification
   */
  private generateReasoning(
    message: string,
    category: MessageCategory,
    score: number,
    details: string[]
  ): string {
    const categoryDesc = CATEGORY_DESCRIPTIONS[category];
    const confidence = (score * 100).toFixed(0);

    let reasoning = `Classified as ${category} (${confidence}% confidence) - ${categoryDesc}`;

    if (details.length > 0) {
      reasoning += `. Matches: ${details.slice(0, 3).join(', ')}`;
    }

    return reasoning;
  }

  /**
   * Update classification metrics
   */
  private updateMetrics(result: ClassificationResult): void {
    this.metrics.totalClassifications++;

    // Update category distribution
    const currentCount = this.metrics.categoryDistribution.get(result.category) || 0;
    this.metrics.categoryDistribution.set(result.category, currentCount + 1);

    // Update average confidence
    const totalConfidence =
      this.metrics.averageConfidence * (this.metrics.totalClassifications - 1) + result.confidence;
    this.metrics.averageConfidence = totalConfidence / this.metrics.totalClassifications;

    // Update fallback rate
    if (result.fallback) {
      this.metrics.fallbackRate =
        (this.metrics.fallbackRate * (this.metrics.totalClassifications - 1) + 1) /
        this.metrics.totalClassifications;
    } else {
      this.metrics.fallbackRate =
        (this.metrics.fallbackRate * (this.metrics.totalClassifications - 1)) /
        this.metrics.totalClassifications;
    }
  }

  /**
   * Get classification metrics
   */
  getMetrics(): ClassificationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalClassifications: 0,
      categoryDistribution: new Map(),
      averageConfidence: 0,
      fallbackRate: 0,
    };
  }

  /**
   * Test classification with multiple examples
   */
  testClassification(examples: Array<{ message: string; expected: MessageCategory }>): {
    accuracy: number;
    results: Array<{
      message: string;
      expected: MessageCategory;
      actual: MessageCategory;
      correct: boolean;
    }>;
  } {
    const results = examples.map((example) => {
      const classification = this.classify(example.message);
      return {
        message: example.message,
        expected: example.expected,
        actual: classification.category,
        correct: classification.category === example.expected,
      };
    });

    const correct = results.filter((r) => r.correct).length;
    const accuracy = correct / results.length;

    return { accuracy, results };
  }
}
