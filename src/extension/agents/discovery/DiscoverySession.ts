/**
 * DiscoverySession — Stateful multi-turn requirements elicitation
 * Phase 1 of the Chief Engineer Spec Flow
 */

export interface DiscoveryMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface DiscoveryConstraint {
  text: string;
  sourceMessageIndex: number;
  category?: 'ui' | 'tech' | 'scope' | 'integration' | 'other';
}

export interface DiscoveryPreference {
  text: string;
  sourceMessageIndex: number;
}

export interface AmbiguityResolution {
  question: string;
  answer: string;
  messageIndex: number;
}

export interface DiscoverySession {
  sessionId: string;
  userRequest: string;
  status: 'discovering' | 'satisfied' | 'timeout' | 'abandoned';
  messages: DiscoveryMessage[];
  constraints: DiscoveryConstraint[];
  preferences: DiscoveryPreference[];
  ambiguitiesResolved: AmbiguityResolution[];
  currentQuestion?: string;
  turnCount: number;
  maxTurns: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryAgentDeps {
  executeLLM: (systemPrompt: string, userPrompt: string) => Promise<string>;
  readConstitution: () => Promise<string>;
  readMemory: (file: 'product' | 'structure' | 'tech') => Promise<string>;
}
