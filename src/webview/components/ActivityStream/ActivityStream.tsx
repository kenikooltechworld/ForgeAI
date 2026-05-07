import TabBar from './TabBar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import MessageFilter, { MessageFilterType } from './MessageFilter';
import { MaxIterationsWarning } from './MaxIterationsWarning';
import { useStreamingResponse } from '../../hooks/useStreamingResponse';
import { useConversationStore } from '../../store/conversationStore';
import { useState, useCallback } from 'react';

function ActivityStream() {
  const { isStreaming } = useStreamingResponse();
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const maxIterationsWarning = useConversationStore((state) => state.maxIterationsWarning);
  const clearMaxIterationsWarning = useConversationStore(
    (state) => state.clearMaxIterationsWarning
  );
  const conversations = useConversationStore((state) => state.conversations);
  const [filterType, setFilterType] = useState<MessageFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [resultCount, setResultCount] = useState<number | undefined>(undefined);

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

      {/* Message Filter (filter and search) */}
      <MessageFilter
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
        resultCount={searchQuery ? resultCount : undefined}
      />

      {/* Message List (middle section) */}
      <div className="flex-1 overflow-y-auto">
        <MessageList
          filterType={filterType}
          searchQuery={searchQuery}
          onResultCountChange={handleResultCountChange}
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

        {/* Typing indicator */}
        {isStreaming && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 text-xs text-(--vscode-descriptionForeground)">
              <div className="flex gap-1">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>
                  ●
                </span>
                <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>
                  ●
                </span>
              </div>
              <span>ForgeAI is typing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Message Input (bottom section) */}
      <MessageInput conversationId={activeConversationId || undefined} />
    </div>
  );
}

export default ActivityStream;
