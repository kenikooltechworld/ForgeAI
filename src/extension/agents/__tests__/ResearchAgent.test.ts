import { ResearchAgent } from '../research/ResearchAgent';
import { ResearchSession, ResearchReport, ResearchTopic, ResearchFinding } from '../research/ResearchSession';
import { DiscoverySession } from '../discovery/DiscoverySession';

const mockLLM = jest.fn(async (_system: string, user: string) => {
  // Simple mock that returns structured topic list if asked for topics,
  // otherwise returns a synthesis.
  if (user.includes('generate exactly 5 focused research topics')) {
    return JSON.stringify([
      {
        id: 'topic-1',
        query: 'React 19 server components best practices',
        rationale: 'Project uses React',
        priority: 1,
      },
      {
        id: 'topic-2',
        query: 'PostgreSQL row-level security patterns',
        rationale: 'Database security',
        priority: 2,
      },
    ]);
  }
  if (user.includes('Synthesize the following research findings')) {
    return JSON.stringify({
      findings: [
        { content: 'Use React 19 server components for data fetching', confidence: 0.9, source: 'rag' },
      ],
      sourceTypes: ['rag'],
    });
  }
  if (user.includes('Generate a concise but comprehensive prompt')) {
    return 'Research Context:\nUse React 19 server components.\n';
  }
  return 'default llm response';
});

const mockRag = jest.fn(async (_query: string, _k?: number) => {
  return [
    { text: 'RAG result about React 19', sourceId: 'reactjs', score: 0.95 },
  ];
});

const mockWeb = jest.fn(async (_query: string) => {
  return {
    results: [{ title: 'Web Result', url: 'https://example.com', snippet: 'Web snippet' }],
    totalResults: 1,
    source: 'mock',
  };
});

describe('ResearchAgent', () => {
  let agent: ResearchAgent;
  const workspaceRoot = '/tmp/test-workspace';

  beforeEach(() => {
    agent = new ResearchAgent({
      ragService: { retrieve: mockRag },
      webSearch: { performSearch: mockWeb },
      executeLLM: mockLLM,
      workspaceRoot,
    });
    jest.clearAllMocks();
  });

  it('generates topics from a DiscoverySession', async () => {
    const discovery: DiscoverySession = {
      id: 'd1',
      userRequest: 'Build a React dashboard',
      status: 'complete',
      conversation: [],
      constraints: [{ text: 'Use React 19', type: 'technical' }],
      preferences: [{ text: 'Dark mode', type: 'feature' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const topics = await agent['generateTopics'](discovery);

    expect(topics).toHaveLength(2);
    expect(topics[0]).toMatchObject({ id: 'topic-1', priority: 1 });
    expect(topics[1]).toMatchObject({ id: 'topic-2', priority: 2 });
    expect(mockLLM).toHaveBeenCalledTimes(1);
  });

  it('researches a single topic using RAG first', async () => {
    const topic: ResearchTopic = {
      id: 't1',
      query: 'React 19 patterns',
      rationale: 'Need patterns',
      priority: 1,
    };

    const report = await agent['researchTopic'](topic);

    expect(report.topicId).toBe('t1');
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.sourceTypes).toContain('rag');
    expect(mockRag).toHaveBeenCalledWith('React 19 patterns', 5);
    expect(mockWeb).not.toHaveBeenCalled();
  });

  it('falls back to web search when RAG yields no results', async () => {
    mockRag.mockResolvedValueOnce([]); // no RAG results

    const topic: ResearchTopic = {
      id: 't2',
      query: 'PostgreSQL RLS',
      rationale: 'Security',
      priority: 2,
    };

    const report = await agent['researchTopic'](topic);

    expect(report.sourceTypes).toContain('web');
    expect(mockWeb).toHaveBeenCalledWith('PostgreSQL RLS');
  });

  it('runs a full research session end-to-end', async () => {
    const discovery: DiscoverySession = {
      id: 'd1',
      userRequest: 'Build a React dashboard',
      status: 'complete',
      conversation: [],
      constraints: [],
      preferences: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const session = await agent.runResearch(discovery);

    expect(session.id).toBeTruthy();
    expect(session.discoverySessionId).toBe('d1');
    expect(Object.keys(session.reports).length).toBeGreaterThan(0);
    expect(session.status).toBe('complete');
  });

  it('builds a spec context from a completed session', async () => {
    const session: ResearchSession = {
      id: 'rs1',
      discoverySessionId: 'd1',
      reports: {
        'topic-1': {
          topicId: 'topic-1',
          findings: [
            { content: 'React 19 server components', confidence: 0.9, source: 'rag' },
          ],
          sourceTypes: ['rag'],
          timestamp: Date.now(),
        },
      },
      status: 'complete',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const context = agent.buildSpecContext(session);

    expect(context).toContain('React 19 server components');
    expect(context).toContain('Research Context');
    expect(mockLLM).toHaveBeenCalledTimes(1);
  });
});
