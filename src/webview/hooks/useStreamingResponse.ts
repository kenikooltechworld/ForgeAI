import { useEffect, useRef, useState } from 'react';
import { useConversationStore } from '../store/conversationStore';

interface StreamChunkMessage {
  type: 'streamChunk';
  conversationId: string;
  data: {
    thinking?: string;
    content?: string;
    toolCalls?: any[];
    tokenUsage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  };
  done: boolean;
}

interface StreamErrorMessage {
  type: 'streamError';
  conversationId: string;
  errorType: string;
  errorMessage: string;
  actionButton?: {
    label: string;
    url: string;
  };
}

export function useStreamingResponse() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAssistantMessageId, setCurrentAssistantMessageId] = useState<string | null>(null);
  const currentAssistantMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'streamChunk') {
        const chunk = message as StreamChunkMessage;
        setIsStreaming(true);

        // Extension sends accumulated content and thinking, so we just use them directly
        const currentContent = chunk.data.content || '';
        const currentThinking = chunk.data.thinking || '';

        // Convert token usage format: completionTokens represents thinking+content tokens
        const tokenUsage = chunk.data.tokenUsage
          ? {
              thinkingTokens: chunk.data.tokenUsage.completionTokens, // Tokens for thinking + content
              totalTokens: chunk.data.tokenUsage.totalTokens, // Total tokens (prompt + completion)
            }
          : undefined;

        // Token usage tracking (silent)
        if (chunk.done && tokenUsage) {
          // Final chunk with token usage
        } else if (chunk.done && !tokenUsage) {
          // Final chunk without token usage
        }

        const store = useConversationStore.getState();

        // If no current assistant message, create one
        if (!currentAssistantMessageIdRef.current) {
          const messageId = crypto.randomUUID();
          currentAssistantMessageIdRef.current = messageId;
          setCurrentAssistantMessageId(messageId);

          store.addMessage(chunk.conversationId, {
            id: messageId,
            role: 'assistant',
            content: currentContent,
            thinking: currentThinking,
            tokenUsage,
            timestamp: Date.now(),
          });
        } else {
          // Update existing assistant message with the accumulated content and thinking from extension
          const updatedConversations = store.conversations.map((conv) => {
            if (conv.id === chunk.conversationId) {
              return {
                ...conv,
                messages: conv.messages.map((msg) => {
                  if (msg.id === currentAssistantMessageIdRef.current) {
                    return {
                      ...msg,
                      content: currentContent,
                      thinking: currentThinking,
                      tokenUsage,
                    };
                  }
                  return msg;
                }),
              };
            }
            return conv;
          });

          // Update store
          useConversationStore.setState({ conversations: updatedConversations });
        }

        // If done, reset streaming state
        if (chunk.done) {
          setIsStreaming(false);
          currentAssistantMessageIdRef.current = null;
          setCurrentAssistantMessageId(null);
        }
      } else if (message.type === 'streamError') {
        const errorMsg = message as StreamErrorMessage;
        setIsStreaming(false);
        currentAssistantMessageIdRef.current = null;
        setCurrentAssistantMessageId(null);

        const store = useConversationStore.getState();

        // Add error message to conversation
        store.addMessage(errorMsg.conversationId, {
          id: crypto.randomUUID(),
          role: 'error',
          content: errorMsg.errorMessage,
          timestamp: Date.now(),
          error: {
            type: errorMsg.errorType,
            message: errorMsg.errorMessage,
            actionButton: errorMsg.actionButton,
          },
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return { isStreaming, currentAssistantMessageId };
}
