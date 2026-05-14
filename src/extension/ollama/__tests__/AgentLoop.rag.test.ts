import { AgentLoop } from '../AgentLoop';

describe('AgentLoop RAG integration', () => {
  test('retrieves RAG context for user message when ragService is provided', async () => {
    const ragService = {
      retrieve: jest.fn().mockResolvedValue([
        {
          chunkId: 'chunk-1',
          sourceId: 'reactjs',
          url: 'https://react.dev/reference/react/useEffect',
          contentHash: 'hash',
          text: 'useEffect lets you synchronize a component with an external system.',
          score: 0.1,
        },
      ]),
    };

    async function* chatStream() {
      yield {
        model: 'gpt-oss:120b-cloud',
        created_at: new Date().toISOString(),
        message: {
          content: 'Here is the answer.',
        },
        done: true,
      };
    }

    const ollamaClient = {
      chat: jest.fn().mockResolvedValue(chatStream()),
    } as any;

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    const agentLoop = new AgentLoop(ollamaClient, logger, undefined, ragService as any);
    const onUpdate = jest.fn();

    await agentLoop.execute(
      [
        {
          role: 'user',
          content: 'How do I use useEffect?',
        },
      ],
      onUpdate,
      [],
      'gpt-oss:120b-cloud',
      { maxIterations: 1 }
    );

    expect(ragService.retrieve).toHaveBeenCalledWith({
      query: 'How do I use useEffect?',
      topK: 6,
    });
    expect(ollamaClient.chat).toHaveBeenCalled();
  });
});
