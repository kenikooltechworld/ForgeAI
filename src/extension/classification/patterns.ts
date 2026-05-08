/**
 * Classification patterns for different message categories
 */

import { MessageCategory, ClassificationPattern } from './types';

export const CLASSIFICATION_PATTERNS: ClassificationPattern[] = [
  {
    category: MessageCategory.QUESTION,
    patterns: [
      /^(what|how|why|when|where|which|who)\b/i,
      /\b(what is|how does|why is|explain|tell me about)\b/i,
      /\?(.*plan|.*work|.*structure|.*mean)/i,
      /\b(can you explain|help me understand|show me)\b/i,
    ],
    keywords: ['what', 'how', 'why', 'explain', 'tell me', 'show me', '?', 'help me understand'],
    confidence: 0.8,
  },
  {
    category: MessageCategory.PLANNING,
    patterns: [
      /^(i want to|i need to|let's|can we|should we)\b/i,
      /\b(build|create|make|develop|design|plan)\b/i,
      /\b(what.*plan|create.*plan|plan for|steps to)\b/i,
      /\b(architecture|structure|approach|strategy)\b/i,
    ],
    keywords: [
      'build',
      'create',
      'make',
      'develop',
      'plan',
      'design',
      'want to',
      'need to',
      'architecture',
      'strategy',
    ],
    confidence: 0.9,
  },
  {
    category: MessageCategory.EXECUTION,
    patterns: [
      /^(fix|implement|add|remove|delete|update|change)\b/i,
      /\b(run|execute|start|stop|install|deploy)\b/i,
      /\b(write|code|program|refactor)\b/i,
      /\b(do it|go ahead|proceed|continue)\b/i,
    ],
    keywords: [
      'fix',
      'implement',
      'add',
      'remove',
      'run',
      'execute',
      'write',
      'code',
      'do it',
      'go ahead',
    ],
    confidence: 0.85,
  },
  {
    category: MessageCategory.ANALYSIS,
    patterns: [
      /^(analyze|review|check|examine|inspect|look at)\b/i,
      /\b(find|search|locate|identify)\b.*\b(issues|problems|bugs|errors)\b/i,
      /\b(what.*wrong|what.*issue|debug|investigate)\b/i,
      /\b(performance|security|quality|optimization)\b/i,
    ],
    keywords: [
      'analyze',
      'review',
      'check',
      'examine',
      'find',
      'search',
      'debug',
      'investigate',
      'issues',
      'problems',
    ],
    confidence: 0.8,
  },
  {
    category: MessageCategory.CONVERSATION,
    patterns: [
      /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no)\b/i,
      /\b(good|great|awesome|perfect|nice|cool)\b/i,
      /^(sure|alright|sounds good|looks good)\b/i,
      /\b(continue|next|proceed)\b$/i,
    ],
    keywords: ['hi', 'hello', 'thanks', 'ok', 'yes', 'no', 'good', 'great', 'sure', 'continue'],
    confidence: 0.7,
  },
];

export const CATEGORY_DESCRIPTIONS = {
  [MessageCategory.QUESTION]: 'User is asking for information or explanation',
  [MessageCategory.PLANNING]: 'User wants to create a plan or strategy',
  [MessageCategory.EXECUTION]: 'User wants immediate action or implementation',
  [MessageCategory.ANALYSIS]: 'User wants analysis or investigation',
  [MessageCategory.CONVERSATION]: 'General conversation or acknowledgment',
};
