import { DiscoverySession } from '../discovery/DiscoverySession';

/**
 * Research finding from a single source
 */
export interface ResearchFinding {
  source: 'rag' | 'web' | 'learning-store';
  collection?: string; // RAG collection name
  query: string;
  text: string;
  url?: string;
  relevanceScore: number;
  retrievedAt: number;
}

/**
 * A full research report for a spec topic
 */
export interface ResearchReport {
  sessionId: string;
  topic: string; // derived from user request
  findings: ResearchFinding[];
  ragCoverage: number; // 0-1: % of topics answered by RAG
  sourceTypes: string[]; // e.g. ['rag', 'web']
  webQueriesRun: number;
  learningCorrectionsApplied: number;
  generatedAt: number;
}

/**
 * Research session state
 */
export interface ResearchSession {
  sessionId: string;
  discoverySession: DiscoverySession;
  reports: Record<string, ResearchReport>; // keyed by topic slug
  status: 'researching' | 'complete' | 'failed';
  workspaceRoot: string;
  generatedAt: number;
}

/**
 * Research topics generated from the discovery session
 */
export interface ResearchTopic {
  slug: string;
  query: string;
  rationale: string;
  priority: number; // 1-10, higher = more critical
}
