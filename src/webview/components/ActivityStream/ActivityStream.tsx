import TabBar from './TabBar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import MessageFilter, { MessageFilterType } from './MessageFilter';
import { MaxIterationsWarning } from './MaxIterationsWarning';
import { useStreamingResponse } from '../../hooks/useStreamingResponse';
import { useConversationStore } from '../../store/conversationStore';
import { useState, useCallback, useEffect } from 'react';
import { Square } from 'lucide-react';

function ActivityStream() {
  const { isStreaming, currentAssistantMessageId } = useStreamingResponse();
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const maxIterationsWarning = useConversationStore((state) => state.maxIterationsWarning);
  const clearMaxIterationsWarning = useConversationStore(
    (state) => state.clearMaxIterationsWarning
  );
  const conversations = useConversationStore((state) => state.conversations);
  const [filterType, setFilterType] = useState<MessageFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [resultCount, setResultCount] = useState<number | undefined>(undefined);
  const [isAgentLoopRunning, setIsAgentLoopRunning] = useState(false);

  // Listen for agent loop start/stop messages and conversation history requests
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'agentLoopStarted') {
        if (message.conversationId === activeConversationId) {
          setIsAgentLoopRunning(true);
        }
      } else if (message.type === 'agentLoopStopped') {
        if (message.conversationId === activeConversationId) {
          setIsAgentLoopRunning(false);
        }
      } else if (message.type === 'errorSkipped') {
        // User clicked Skip on an error — clear the running state
        // so they can continue the conversation
        if (message.conversationId === activeConversationId) {
          setIsAgentLoopRunning(false);
        }
      } else if (message.type === 'requestConversationHistory') {
        // Handle conversation history request for retry
        if (message.conversationId === activeConversationId && message.purpose === 'retry') {
          const conversation = conversations.find((c) => c.id === message.conversationId);
          if (conversation) {
            // Send conversation history back to extension
            window.vscode?.postMessage({
              type: 'conversationHistoryForRetry',
              conversationId: message.conversationId,
              conversationHistory: conversation.messages,
              model: conversation.model || 'gpt-oss:120b-cloud',
            });
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeConversationId, conversations]);

  const handleStopAgentLoop = useCallback(() => {
    if (!activeConversationId) return;

    // Send stop message to extension
    window.vscode?.postMessage({
      type: 'stopAgentLoop',
      conversationId: activeConversationId,
    });

    // Immediately update UI
    setIsAgentLoopRunning(false);
  }, [activeConversationId]);

  const handleFilterChange = useCallback((filter: MessageFilterType) => {
    setFilterType(filter);
  }, []);

  const handleSearchChange = useCallback((search: string) => {
    setSearchQuery(search);
  }, []);

  const handleResultCountChange = useCallback((count: number) => {
    setResultCount(count);
  }, []);

  const handleContinue = useCallback(() => {
    if (!maxIterationsWarning.conversationId) return;

    // Get conversation history
    const conversation = conversations.find((c) => c.id === maxIterationsWarning.conversationId);
    if (!conversation) return;

    // Send continue message to extension
    window.vscode?.postMessage({
      type: 'continueAfterMaxIterations',
      conversationId: maxIterationsWarning.conversationId,
      conversationHistory: conversation.messages,
    });

    // Clear the warning
    clearMaxIterationsWarning();
  }, [maxIterationsWarning.conversationId, conversations, clearMaxIterationsWarning]);

  const handleCancel = useCallback(() => {
    if (!maxIterationsWarning.conversationId) return;

    // Send cancel message to extension
    window.vscode?.postMessage({
      type: 'cancelAfterMaxIterations',
      conversationId: maxIterationsWarning.conversationId,
    });

    // Clear the warning
    clearMaxIterationsWarning();
  }, [maxIterationsWarning.conversationId, clearMaxIterationsWarning]);

  return (
    <div className="flex h-full flex-col bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
      {/* Tab Bar (top section) */}
      <TabBar />

      {/* Stop Button (shown when agent loop is running) */}
      {isAgentLoopRunning && (
        <div className="flex items-center justify-center gap-2 border-b border-(--vscode-panel-border) bg-(--vscode-editor-background) px-4 py-2">
          <button
            onClick={handleStopAgentLoop}
            className="flex items-center gap-2 rounded bg-(--vscode-button-background) px-3 py-1.5 text-sm font-medium text-(--vscode-button-foreground) transition-colors hover:bg-(--vscode-button-hoverBackground)"
            style={{
              backgroundColor: 'var(--vscode-errorForeground)',
              color: 'var(--vscode-button-foreground)',
            }}
          >
            <Square size={14} />
            Stop
          </button>
          <span className="text-xs text-(--vscode-descriptionForeground)">
            Agent loop is running...
          </span>
        </div>
      )}

      {/* Message Filter (filter and search) */}
      <MessageFilter
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
        resultCount={searchQuery ? resultCount : undefined}
      />

      {/* Message List (middle section) */}
      <div className="flex-1 overflow-y-auto scrollable-modern">
        <MessageList
          filterType={filterType}
          searchQuery={searchQuery}
          onResultCountChange={handleResultCountChange}
          isStreaming={isStreaming}
          currentAssistantMessageId={currentAssistantMessageId}
          isAgentLoopRunning={isAgentLoopRunning}
        />

        {/* Max Iterations Warning */}
        {maxIterationsWarning.conversationId === activeConversationId &&
          maxIterationsWarning.message && (
            <div className="px-4">
              <MaxIterationsWarning
                message={maxIterationsWarning.message}
                context={maxIterationsWarning.context}
                onContinue={handleContinue}
                onCancel={handleCancel}
              />
            </div>
          )}
      </div>

      {/* Message Input (bottom section) */}
      <MessageInput conversationId={activeConversationId || undefined} />
    </div>
  );
}

export default ActivityStream;
