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
  fetchPage?: (
    url: string
  ) => Promise<{
    title: string;
    content: string;
    url: string;
    method?: string;
    truncated?: boolean;
    status?: number | null;
  }>;
  executeLLM: (systemPrompt: string, userPrompt: string) => Promise<string>;
  workspaceRoot: string;
}

const SIMILARITY_THRESHOLD = 0.7;

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
      topics,
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

    // Compile all research into a single markdown file
    this.compileResearchMarkdown(session);

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
    _discoverySession: DiscoverySession
  ): Promise<ResearchReport> {
    // Check cache (session-scoped)
    const cached = this.cache.get(sessionId, topic.slug);
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
    const needsWeb = topRagScore > SIMILARITY_THRESHOLD || ragResults.length < 3;

    if (needsWeb) {
      try {
        const webResult = await this.deps.webSearch.performSearch(topic.query);
        webQueriesRun++;

        // Store snippets as preliminary findings
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

        // CRITICAL: Fetch ACTUAL page content for top URLs — not just snippets
        let pagesFetched = 0;
        let pagesFailed = 0;
        if (this.deps.fetchPage && webResult.results.length > 0) {
          // Try up to 5 URLs, skipping failures, to maximize chances of success
          const candidates = webResult.results.slice(0, 5);
          for (const r of candidates) {
            try {
              const page = await this.deps.fetchPage(r.url);
              findings.push({
                source: 'web-page',
                query: topic.query,
                text: `📄 ${page.title} (${page.method || 'fetch'})\n${page.content}`,
                url: page.url,
                relevanceScore: 0.85, // full page content is more valuable
                retrievedAt: Date.now(),
              });
              pagesFetched++;
            } catch (fetchErr) {
              pagesFailed++;
              // Surface the failure in the research report so it's visible
              findings.push({
                source: 'web-page',
                query: topic.query,
                text:
                  `⚠️ Failed to fetch page content for: ${r.url}\n` +
                  `Error: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}\n` +
                  `Falling back to snippet only.`,
                url: r.url,
                relevanceScore: 0.1,
                retrievedAt: Date.now(),
              });
            }
          }
        }

        // Summary finding for this topic's web research
        if (pagesFetched > 0 || pagesFailed > 0) {
          findings.push({
            source: 'web',
            query: topic.query,
            text: `📊 Fetch summary: ${pagesFetched} pages fetched successfully, ${pagesFailed} failed (attempted ${pagesFetched + pagesFailed} total).`,
            relevanceScore: 0.0,
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

    // 5. Cache (session-scoped)
    this.cache.set(sessionId, topic.slug, topic.query, report);

    return report;
  }

  /**
   * Persist the research session to disk.
   */
  private persistSession(session: ResearchSession): void {
    this.cache.persistSession(session);
  }

  /**
   * Compile all research into a single markdown file at `.forgeai/research/sessions/{sessionId}/research.md`.
   * This replaces scattered per-topic cache files with one authoritative document
   * containing findings, sources, and coverage metrics ordered by priority.
   */
  compileResearchMarkdown(session: ResearchSession): string {
    const lines: string[] = [];
    const now = new Date(session.generatedAt).toISOString();
    const userRequest = session.discoverySession.userRequest;

    lines.push(`# Research Report: ${userRequest}`);
    lines.push('');
    lines.push(`**Session:** ${session.sessionId}`);
    lines.push(`**Generated:** ${now}`);
    lines.push(`**Topics:** ${session.topics.length}`);
    lines.push(
      `**Answered by RAG:** ${session.topics.filter((t) => {
        const report = session.reports[t.slug];
        if (!report) return false;
        const bestRag = report.findings
          .filter((f) => f.source === 'rag')
          .sort((a, b) => b.relevanceScore - a.relevanceScore)[0];
        return bestRag && bestRag.relevanceScore >= SIMILARITY_THRESHOLD;
      }).length} / ${session.topics.length}`
    );
    lines.push('');

    for (const topic of session.topics) {
      const report = session.reports[topic.slug];
      lines.push(`## ${topic.priority}. ${topic.query}  \`(priority: ${topic.priority})\``);
      lines.push('');
      lines.push(`> ${topic.rationale}`);
      lines.push('');

      if (report) {
        const sourceCounts: Record<string, number> = {};
        for (const f of report.findings) {
          sourceCounts[f.source] = (sourceCounts[f.source] || 0) + 1;
        }
        const coverage = `${Math.round(report.ragCoverage * 100)}%`;
        lines.push(`**Coverage:** ${coverage} RAG | **Sources:** ${JSON.stringify(sourceCounts)} | **Web queries:** ${report.webQueriesRun}`);
        lines.push('');

        const sources = ['rag', 'web-page', 'web', 'learning-store'];
        for (const src of sources) {
          const srcFindings = report.findings.filter((f) => f.source === src);
          if (srcFindings.length === 0) continue;

          const label =
            src === 'rag'
              ? '### Local Documentation (RAG)'
              : src === 'web-page'
                ? '### Official Docs & Pages (Fetched)'
                : src === 'web'
                  ? '### Web Search Results'
                  : '### User Corrections';
          lines.push(label);
          lines.push('');

          for (const f of srcFindings.slice(0, 5)) {
            lines.push(`#### ${f.text.split('\n')[0].slice(0, 120)}`);
            lines.push('');
            lines.push(f.text.slice(0, 8000));
            lines.push('');
            if (f.url) {
              lines.push(`**Source:** <${f.url}>`);
              lines.push('');
            }
          }
        }
      } else {
        lines.push('_No research findings collected._');
        lines.push('');
      }
    }

    const markdown = lines.join('\n');

    const slug = session.discoverySession.userRequest
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'research';
    const filename = `${slug}-2026.md`;
    const researchDir = path.join(session.workspaceRoot, '.forgeai', 'research');
    if (!fs.existsSync(researchDir)) {
      fs.mkdirSync(researchDir, { recursive: true });
    }
    fs.writeFileSync(path.join(researchDir, filename), markdown, 'utf-8');

    return markdown;
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
          finding.source === 'rag'
            ? '🧠 RAG'
            : finding.source === 'web' || finding.source === 'web-page'
              ? '🌐 Web'
              : '👤 User';
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
