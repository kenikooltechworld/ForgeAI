/**
 * Test script — simulates a ForgeAI planning chat with Ollama
 * Run: node scripts/test-chat.mjs
 */

const OLLAMA_URL = 'http://localhost:11434';
const MODEL = 'gpt-oss:120b-cloud';

const SYSTEM_PROMPT = `# ForgeAI — Spec-Driven Development Assistant

You are ForgeAI, an expert software architect.

## Response Mode: Planning

Your training data is outdated. Before proposing ANY plan or creating ANY spec:

1. **RESEARCH**: Check the RAG documentation in your system prompt
2. **DEEPER RESEARCH**: Call forgeai_webResearch to find current best practices. This tool AUTO-FETCHES top 5 URLs — you DO NOT need to call forgeai_fetchPage after it.
3. **STOP AND CHAT**: Present a comprehensive summary to the user. Include:
   - Recommended tech stack with latest versions
   - Architecture patterns and best practices
   - Security considerations
   - Trade-offs and alternatives
   - Sources you found
4. **ASK BEFORE SPEC**: After your summary, say: "I can formalize this into a detailed spec with requirements, design, and tasks. Shall I proceed?"
5. **CREATE SPEC ONLY WHEN ASKED**: Call forgeai_createSpec ONLY if the user explicitly agrees or asks for it.

## IMPORTANT RULES
- You get ONE webResearch call. After that, STOP and present findings.
- webResearch ALREADY FETCHES the actual page content. Do NOT call forgeai_fetchPage for URLs it returned.
- Do NOT hallucinate tools. Only use tools listed below.
- Do NOT keep searching endlessly. Present findings after 1-2 tool calls.

## Available Tools (ONLY these — no others exist)
- forgeai_webResearch — Deep research, auto-fetches top 5 URLs
- forgeai_webSearch — Quick search, auto-fetches top 3 URLs  
- forgeai_fetchPage — Fetch a SPECIFIC URL for deeper content (only for URLs not covered by webResearch)
- forgeai_createSpec — Create spec (ONLY after user says yes)
- forgeai_writeSpecArtifact — Write spec artifact (requirements/design/tasks)

## NO HALLUCINATIONS
- Do NOT invent versions, APIs, or syntax from memory
- ALWAYS research first
- ALWAYS cite your sources`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'forgeai_webResearch',
      description:
        'MANDATORY deep research before creating any spec or plan. Runs multiple related queries and auto-fetches content from top 5 URLs. Call this FIRST when the user asks to plan, design, or architect a feature.',
      parameters: {
        type: 'object',
        required: ['topic'],
        properties: {
          topic: { type: 'string', description: 'The research topic' },
          subQueries: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional sub-queries (max 3)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forgeai_webSearch',
      description: 'Search the web for a specific query. Auto-fetches top 3 result URLs.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forgeai_fetchPage',
      description: 'Fetch actual page content from a specific URL with Playwright fallback.',
      parameters: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forgeai_createSpec',
      description: 'Create a new spec. ONLY call AFTER research and user agreement.',
      parameters: {
        type: 'object',
        required: ['title', 'workflow'],
        properties: {
          title: { type: 'string' },
          workflow: { type: 'string', enum: ['requirements-first', 'design-first', 'quick-plan'] },
          description: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forgeai_writeSpecArtifact',
      description: 'Write content to a spec artifact file (requirements.md, design.md, tasks.md).',
      parameters: {
        type: 'object',
        required: ['specId', 'type', 'content'],
        properties: {
          specId: { type: 'string' },
          type: { type: 'string', enum: ['requirements', 'design', 'tasks'] },
          content: { type: 'string' },
        },
      },
    },
  },
];

const USER_MESSAGE = 'I want to build a simple booking system with Python/FastAPI and ReactJS';

async function chat(messages) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOLS,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// Simulate tool execution (fake responses for testing)
function simulateTool(name, args) {
  console.log(`\n  🔧 Tool called: ${name}`);
  console.log(`     Args: ${JSON.stringify(args, null, 2).split('\n').join('\n     ')}`);

  if (name === 'forgeai_webResearch') {
    return {
      success: true,
      topic: args.topic,
      fetchSummary: '3 fetched, 2 failed (attempted 5)',
      results: [
        {
          title: 'FastAPI Docs',
          url: 'https://fastapi.tiangolo.com',
          snippet:
            'FastAPI is a modern, fast web framework for building APIs with Python 3.8+ based on standard Python type hints.',
        },
        {
          title: 'React Docs',
          url: 'https://react.dev',
          snippet: 'React v18 with hooks, concurrent rendering, and server components.',
        },
        {
          title: 'SQLAlchemy 2.0',
          url: 'https://docs.sqlalchemy.org',
          snippet: 'SQLAlchemy 2.0 ORM with async support for PostgreSQL.',
        },
      ],
      fetchedContent: [
        {
          title: 'FastAPI Docs',
          url: 'https://fastapi.tiangolo.com',
          method: 'fetch',
          content:
            'FastAPI 0.110+ supports Python 3.11+. Install: pip install fastapi uvicorn[standard]. Create app: from fastapi import FastAPI; app = FastAPI(). Supports JWT auth via python-jose, password hashing via passlib, PostgreSQL via asyncpg + SQLAlchemy 2.0 async.',
        },
        {
          title: 'React v18 Docs',
          url: 'https://react.dev',
          method: 'fetch',
          content:
            'React 18 with React Router v6, TanStack Query for server state, Zustand or Redux Toolkit for client state. Vite for bundling. TypeScript recommended.',
        },
      ],
      formatted:
        '## Research results for booking system with FastAPI + ReactJS\n\nTop results from web research...',
    };
  }
  if (name === 'forgeai_createSpec') {
    return {
      success: true,
      specId: 'booking-system-001',
      message: `Spec "${args.title}" created with workflow "${args.workflow}".`,
    };
  }
  if (name === 'forgeai_writeSpecArtifact') {
    return { success: true, message: `Written ${args.type}.md to spec ${args.specId}` };
  }
  // Reject hallucinated or non-existent tools
  const validTools = [
    'forgeai_webResearch',
    'forgeai_webSearch',
    'forgeai_fetchPage',
    'forgeai_createSpec',
    'forgeai_writeSpecArtifact',
  ];
  if (!validTools.includes(name)) {
    return {
      success: false,
      error: `Tool "${name}" does NOT exist. Only valid tools: ${validTools.join(', ')}`,
    };
  }
  return { success: true, result: `[${name} executed]` };
}

async function run() {
  console.log('='.repeat(60));
  console.log('ForgeAI Chat Test — Booking System Planning');
  console.log('='.repeat(60));
  console.log(`Model: ${MODEL}`);
  console.log(`User: "${USER_MESSAGE}"`);
  console.log('='.repeat(60));

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: USER_MESSAGE },
  ];

  let turn = 1;
  const MAX_TURNS = 10;

  while (turn <= MAX_TURNS) {
    console.log(`\n--- Turn ${turn} ---`);
    console.log('Sending to Ollama...');

    const response = await chat(messages);
    const msg = response.message;

    // Show assistant text
    if (msg.content) {
      console.log(`\n📝 Assistant response:\n${msg.content}`);
    }

    // If no tool calls, we're done
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      console.log('\n✅ No more tool calls — conversation complete.');
      break;
    }

    // Process tool calls
    messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });

    for (const toolCall of msg.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs =
        typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;

      const result = simulateTool(toolName, toolArgs);
      console.log(`\n  ✅ Tool result preview: ${JSON.stringify(result).slice(0, 200)}...`);

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        name: toolName,
      });
    }

    turn++;
  }

  if (turn > MAX_TURNS) {
    console.log('\n⚠️  Reached max turns limit.');
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test complete.');
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
