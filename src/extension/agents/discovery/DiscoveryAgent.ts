/**
 * DiscoveryAgent
 * Multi-turn conversational requirements elicitation.
 * Replaces the one-shot ClarifierAgent with a stateful conversation.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  DiscoveryAgentDeps,
  DiscoverySession,
  DiscoveryMessage,
  DiscoveryConstraint,
  DiscoveryPreference,
} from './DiscoverySession';

export { DiscoveryAgentDeps, DiscoverySession };

export class DiscoveryAgent {
  constructor(private readonly deps: DiscoveryAgentDeps) {}

  /**
   * Start a new discovery session from the user's initial request.
   */
  public async startSession(userRequest: string, workspaceRoot: string): Promise<DiscoverySession> {
    const session: DiscoverySession = {
      sessionId: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userRequest,
      status: 'discovering',
      messages: [{ role: 'user', content: userRequest, timestamp: new Date().toISOString() }],
      constraints: [],
      preferences: [],
      ambiguitiesResolved: [],
      turnCount: 1,
      maxTurns: 15,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const firstQuestion = await this.generateNextQuestion(session);
    session.currentQuestion = firstQuestion;
    session.messages.push({
      role: 'ai',
      content: firstQuestion,
      timestamp: new Date().toISOString(),
    });

    await this.persistSession(session, workspaceRoot);
    return session;
  }

  /**
   * Handle a user reply in an existing discovery session.
   */
  public async handleReply(
    session: DiscoverySession,
    userReply: string,
    workspaceRoot: string
  ): Promise<DiscoverySession> {
    // Record user reply
    session.messages.push({
      role: 'user',
      content: userReply,
      timestamp: new Date().toISOString(),
    });
    session.turnCount++;

    // Extract constraints and preferences from the reply
    const extracted = await this.extractConstraintsAndPreferences(session);
    session.constraints.push(...extracted.constraints);
    session.preferences.push(...extracted.preferences);

    // Check if user is signalling completion
    if (this.isProceedSignal(userReply)) {
      session.status = 'satisfied';
      session.currentQuestion = undefined;
      session.updatedAt = new Date().toISOString();
      await this.persistSession(session, workspaceRoot);
      return session;
    }

    // Check max turns
    if (session.turnCount >= session.maxTurns) {
      session.status = 'timeout';
      session.currentQuestion = undefined;
      session.updatedAt = new Date().toISOString();
      await this.persistSession(session, workspaceRoot);
      return session;
    }

    // Generate next question
    const nextQuestion = await this.generateNextQuestion(session);
    session.currentQuestion = nextQuestion;
    session.messages.push({
      role: 'ai',
      content: nextQuestion,
      timestamp: new Date().toISOString(),
    });
    session.updatedAt = new Date().toISOString();

    await this.persistSession(session, workspaceRoot);
    return session;
  }

  /**
   * Generate the next clarifying question based on session state.
   */
  private async generateNextQuestion(session: DiscoverySession): Promise<string> {
    const [constitution, productMemory, techMemory] = await Promise.all([
      this.deps.readConstitution(),
      this.deps.readMemory('product'),
      this.deps.readMemory('tech'),
    ]);

    const systemPrompt = `You are a staff software engineer conducting a requirements discovery session.
Your job is to ask ONE focused, high-value clarifying question at a time.

## Rules
- Ask only ONE question per response (no lists)
- Focus on: scope, constraints, user experience, edge cases, integrations
- Respect user constraints already stated (do not ask about things the user already ruled out)
- Reference the project constitution and tech stack when relevant
- Keep questions conversational, not robotic
- If enough information is gathered, ask: "Are you ready to proceed, or is there anything else I should know?"
- Do NOT use markdown headings or bullet lists. Just a single paragraph question.

## Output Format
Respond with ONLY the question text. No preamble, no labels.`;

    const conversationHistory = session.messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Engineer'}: ${m.content}`)
      .join('\n\n');

    const userPrompt = `## Project Constitution
${constitution}

## Product Context
${productMemory}

## Tech Stack
${techMemory}

## Conversation So Far
${conversationHistory}

## Constraints Already Identified
${session.constraints.map((c) => `- ${c.text}`).join('\n') || 'None yet'}

## Preferences Already Identified
${session.preferences.map((p) => `- ${p.text}`).join('\n') || 'None yet'}

## Instructions
Ask the next most important clarifying question. Only one question. Keep it conversational.`;

    const response = await this.deps.executeLLM(systemPrompt, userPrompt);
    return response.trim();
  }

  /**
   * Extract constraints and preferences from the latest user message.
   */
  private async extractConstraintsAndPreferences(
    session: DiscoverySession
  ): Promise<{ constraints: DiscoveryConstraint[]; preferences: DiscoveryPreference[] }> {
    const systemPrompt = `You are an requirements analyst. Extract constraints and preferences from the user's message.

## Rules
- Constraint: Something the user does NOT want or a hard limit (e.g., "no modals", "must work offline", "under 2MB bundle")
- Preference: Something the user WANTS or likes (e.g., "I like GitHub's UI", "dark mode default", "use Zustand")
- Only extract NEW items not already in the lists below
- Be concise: one short phrase per item

## Output Format
Return ONLY valid JSON with this exact shape:
{
  "constraints": [{"text": "...", "category": "ui|tech|scope|integration|other"}],
  "preferences": [{"text": "..."}]
}`;

    const latestUserMessage = session.messages.filter((m) => m.role === 'user').pop()?.content || '';
    const existingConstraints = session.constraints.map((c) => c.text).join('\n');
    const existingPreferences = session.preferences.map((p) => p.text).join('\n');

    const userPrompt = `## User's Latest Message
${latestUserMessage}

## Already Known Constraints
${existingConstraints || 'None'}

## Already Known Preferences
${existingPreferences || 'None'}

Extract any new constraints and preferences from the latest message only.`;

    try {
      const response = await this.deps.executeLLM(systemPrompt, userPrompt);
      const parsed = JSON.parse(response);
      const constraints: DiscoveryConstraint[] = (parsed.constraints || [])
        .filter((c: { text: string }) => c.text && !session.constraints.some((ec) => ec.text === c.text))
        .map((c: { text: string; category?: string }) => ({
          text: c.text,
          sourceMessageIndex: session.messages.length - 1,
          category: c.category,
        }));
      const preferences: DiscoveryPreference[] = (parsed.preferences || [])
        .filter((p: { text: string }) => p.text && !session.preferences.some((ep) => ep.text === p.text))
        .map((p: { text: string }) => ({
          text: p.text,
          sourceMessageIndex: session.messages.length - 1,
        }));
      return { constraints, preferences };
    } catch {
      return { constraints: [], preferences: [] };
    }
  }

  /**
   * Detect if the user wants to proceed to the next phase.
   */
  private isProceedSignal(reply: string): boolean {
    const signals = [
      /proceed/i,
      /let'?s\s+(go|start|move)/i,
      /looks?\s+good/i,
      /sounds?\s+good/i,
      /that'?s\s+(enough|fine|ok|okay)/i,
      /i'?m\s+ready/i,
      /move\s+on/i,
      /next\s+step/i,
      /generate\s+(the\s+)?spec/i,
      /create\s+(the\s+)?spec/i,
    ];
    return signals.some((pattern) => pattern.test(reply));
  }

  /**
   * Persist session to disk.
   */
  private async persistSession(session: DiscoverySession, workspaceRoot: string): Promise<void> {
    const discoveryDir = path.join(workspaceRoot, '.forgeai', 'discovery');
    fs.mkdirSync(discoveryDir, { recursive: true });
    const filePath = path.join(discoveryDir, `${session.sessionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  /**
   * Load a session from disk.
   */
  public static loadSession(sessionId: string, workspaceRoot: string): DiscoverySession | undefined {
    const filePath = path.join(workspaceRoot, '.forgeai', 'discovery', `${sessionId}.json`);
    if (!fs.existsSync(filePath)) return undefined;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as DiscoverySession;
  }

  /**
   * List all saved sessions.
   */
  public static listSessions(workspaceRoot: string): DiscoverySession[] {
    const discoveryDir = path.join(workspaceRoot, '.forgeai', 'discovery');
    if (!fs.existsSync(discoveryDir)) return [];
    const files = fs.readdirSync(discoveryDir).filter((f) => f.endsWith('.json'));
    return files
      .map((f) => {
        const raw = fs.readFileSync(path.join(discoveryDir, f), 'utf-8');
        try {
          return JSON.parse(raw) as DiscoverySession;
        } catch {
          return undefined;
        }
      })
      .filter((s): s is DiscoverySession => s !== undefined)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}
