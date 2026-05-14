import * as fs from 'fs';
import * as path from 'path';
import { DiscoverySession } from '../discovery/DiscoverySession';
import { ResearchCache } from './ResearchCache';
import { ResearchLearningStore } from './ResearchLearningStore';
import { ResearchFinding, ResearchReport, ResearchSession, ResearchTopic } from './ResearchSession';

interface RagServiceLike {
  retrieve(
    query: string,
    k?: number,
    collection?: string
  ): Promise<Array<{ text: string; sourceId: string; score: number }>>;
}

interface WebSearchLike {
  performSearch(query: string): Promise<{
    results: Array<{ title: string; url: string; snippet: string }>;
    totalResults: number;
    source: string;
  }>;
}

interface ResearchAgentDeps {
  ragService: RagServiceLike;
  webSearch: WebSearchLike;
  executeLLM: (systemPrompt: string, userPrompt: string) => Promise<string>;
  workspaceRoot: string;
}

const SIMILARITY_THRESHOLD = 0.7;
const RAG_PASS_THRESHOLD = 0.75; // need 75% topics answered by RAG to skip web

/**
 * ResearchAgent — RAG-first, web-second research before spec generation.
 *
 * Flow:
 *  1. Generate research topics from discovery session (via LLM)
 *  2. For each topic:
 *     a. Check cache → return if fresh
 *     b. Query RAG (all collections)
 *     c. If RAG similarity < 0.7 or coverage < 75% → web search
 *     d. Check learning store for user corrections
 *     e. Synthesize findings into ResearchReport
 *  3. Cache report
 *  4. Return session with all reports
 */
export class ResearchAgent {
  private deps: ResearchAgentDeps;
  private cache: ResearchCache;
  private learningStore: ResearchLearningStore;

  constructor(deps: ResearchAgentDeps) {
    this.deps = deps;
    this.cache = new ResearchCache(deps.workspaceRoot);
    this.learningStore = new ResearchLearningStore(deps.workspaceRoot);
  }

  /**
   * Run full research pipeline after discovery is complete.
   */
  async runResearch(
    discoverySession: DiscoverySession,
    onProgress?: (event: {
      type: 'topicStart' | 'topicComplete' | 'complete';
      topicIndex: number;
      totalTopics: number;
      topicSlug?: string;
      topicQuery?: string;
      findingsCount?: number;
      sourceTypes?: string[];
      answeredByRag?: number;
    }) => void
  ): Promise<ResearchSession> {
    const sessionId = `research-${Date.now()}`;
    const workspaceRoot = this.deps.workspaceRoot;

    // 1. Generate research topics from discovery context
    const topics = await this.generateTopics(discoverySession);

    const session: ResearchSession = {
      sessionId,
      discoverySession,
      reports: {},
      status: 'researching',
      workspaceRoot,
      generatedAt: Date.now(),
    };

    // 2. Research each topic
    let answeredByRag = 0;
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      onProgress?.({
        type: 'topicStart',
        topicIndex: i,
        totalTopics: topics.length,
        topicSlug: topic.slug,
        topicQuery: topic.query,
      });

      const report = await this.researchTopic(sessionId, topic, discoverySession);
      session.reports[topic.slug] = report;

      // Count as "RAG answered" if the best RAG finding is above threshold
      const bestRag = report.findings
        .filter((f) => f.source === 'rag')
        .sort((a, b) => b.relevanceScore - a.relevanceScore)[0];
      if (bestRag && bestRag.relevanceScore >= SIMILARITY_THRESHOLD) {
        answeredByRag++;
      }

      onProgress?.({
        type: 'topicComplete',
        topicIndex: i,
        totalTopics: topics.length,
        topicSlug: topic.slug,
        topicQuery: topic.query,
        findingsCount: report.findings.length,
        sourceTypes: report.sourceTypes,
        answeredByRag,
      });
    }

    const totalTopics = topics.length || 1;
    session.status = 'complete';

    onProgress?.({
      type: 'complete',
      topicIndex: totalTopics,
      totalTopics,
      answeredByRag,
    });

    // Persist full session
    this.persistSession(session);

    return session;
  }

  /**
   * Generate research topics from the discovery session using an LLM.
   */
  async generateTopics(discoverySession: DiscoverySession): Promise<ResearchTopic[]> {
    const { constraints, preferences, userRequest } = discoverySession;

    const systemPrompt = `You are a technical research planner. Given a user request and extracted constraints/preferences, generate 3-5 focused research topics.

Each topic must be a JSON object with:
- "slug": kebab-case identifier
- "query": the actual search query string
- "rationale": why this matters for the spec
- "priority": 1-10 (higher = more critical)

Return ONLY a JSON array. No markdown, no explanation.`;

    const userPrompt = `User request: ${userRequest}
Constraints: ${constraints.map((c) => c.text).join('; ') || 'none'}
Preferences: ${preferences.map((p) => p.text).join('; ') || 'none'}

Generate research topics:`;

    const raw = await this.deps.executeLLM(systemPrompt, userPrompt);

    try {
      const cleaned = raw
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const topics = JSON.parse(cleaned) as ResearchTopic[];
      return topics.slice(0, 5);
    } catch {
      // Fallback: derive single topic from user request
      return [
        {
          slug: 'main-topic',
          query: userRequest,
          rationale: 'Primary user request',
          priority: 10,
        },
      ];
    }
  }

  /**
   * Research a single topic: cache → RAG → web → learning store → synthesize.
   */
  private async researchTopic(
    sessionId: string,
    topic: ResearchTopic,
    discoverySession: DiscoverySession
  ): Promise<ResearchReport> {
    // Check cache
    const cached = this.cache.get(topic.query);
    if (cached && !cached.stale) {
      return cached.report;
    }

    const findings: ResearchFinding[] = [];
    let webQueriesRun = 0;

    // 1. Query RAG (all collections)
    const ragResults = await this.deps.ragService.retrieve(topic.query, 5);
    for (const r of ragResults) {
      findings.push({
        source: 'rag',
        query: topic.query,
        text: r.text,
        relevanceScore: r.score || 0,
        retrievedAt: Date.now(),
      });
    }

    // 2. Web fallback if RAG is thin
    const topRagScore = ragResults[0]?.score ?? 0;
    const needsWeb = topRagScore < SIMILARITY_THRESHOLD || ragResults.length < 3;

    if (needsWeb) {
      try {
        const webResult = await this.deps.webSearch.performSearch(topic.query);
        webQueriesRun++;
        for (const r of webResult.results.slice(0, 5)) {
          findings.push({
            source: 'web',
            query: topic.query,
            text: `${r.title}\n${r.snippet}`,
            url: r.url,
            relevanceScore: 0.5, // web results have no embedding score
            retrievedAt: Date.now(),
          });
        }
      } catch {
        // Web search optional — continue without it
      }
    }

    // 3. Check learning store for user corrections
    const corrections = this.learningStore.find(topic.query);
    for (const c of corrections) {
      findings.push({
        source: 'learning-store',
        query: topic.query,
        text: `User correction: ${c.correction} (was: ${c.context})`,
        relevanceScore: 0.95,
        retrievedAt: Date.now(),
      });
    }

    // 4. Synthesize report
    const ragFindings = findings.filter((f) => f.source === 'rag');
    const ragCoverage = ragFindings.length > 0 ? Math.min(1, ragFindings.length / 3) : 0;

    const report: ResearchReport = {
      sessionId,
      topic: topic.query,
      findings,
      ragCoverage,
      webQueriesRun,
      sourceTypes: Array.from(new Set(findings.map((f) => f.source))),
      learningCorrectionsApplied: corrections.length,
      generatedAt: Date.now(),
    };

    // 5. Cache
    this.cache.set(topic.query, report);

    return report;
  }

  /**
   * Persist the research session to disk.
   */
  private persistSession(session: ResearchSession): void {
    const dir = path.join(session.workspaceRoot, '.forgeai', 'research');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, `${session.sessionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  /**
   * Build an enriched prompt context from research for the spec generator.
   */
  buildSpecContext(researchSession: ResearchSession): string {
    const sections: string[] = [];

    for (const report of Object.values(researchSession.reports)) {
      sections.push(`## ${report.topic}\n`);
      for (const finding of report.findings) {
        const badge =
          finding.source === 'rag' ? '🧠 RAG' : finding.source === 'web' ? '🌐 Web' : '👤 User';
        sections.push(`${badge} (score: ${finding.relevanceScore.toFixed(2)})\n${finding.text}\n`);
        if (finding.url) {
          sections.push(`Source: ${finding.url}\n`);
        }
      }
      sections.push('\n');
    }

    return sections.join('\n');
  }
}
