/**
 * Message classification types and interfaces
 */

export enum MessageCategory {
  QUESTION = 'question', // "What is the plan?" "How does this work?"
  PLANNING = 'planning', // "I want to build X" "Create a plan for Y"
  EXECUTION = 'execution', // "Fix this bug" "Implement feature X"
  ANALYSIS = 'analysis', // "Review this code" "Find issues"
  CONVERSATION = 'conversation', // General chat, clarifications
}

export interface ClassificationPattern {
  category: MessageCategory;
  patterns: RegExp[];
  keywords: string[];
  confidence: number;
}

export interface ClassificationResult {
  category: MessageCategory;
  confidence: number;
  reasoning: string;
  fallback?: MessageCategory;
}

export interface ResponseHandler {
  category: MessageCategory;
  systemPrompt: string;
  shouldUseTool: boolean;
}

export interface ClassificationMetrics {
  totalClassifications: number;
  categoryDistribution: Map<MessageCategory, number>;
  averageConfidence: number;
  fallbackRate: number;
}
