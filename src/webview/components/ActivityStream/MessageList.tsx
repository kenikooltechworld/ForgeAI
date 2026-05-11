import { MessageSquare, Search, ChevronDown } from 'lucide-react';
import { useConversationStore } from '../../store/conversationStore';
import ThinkingBlock from './ThinkingBlock';
import ToolCard from './ToolCard';
import { MarkdownRenderer, StreamingMarkdownRenderer } from '../MarkdownRenderer';
import { ErrorNotification } from '../ErrorNotification';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useStreamingResponse } from '../../hooks/useStreamingResponse';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Message } from '../../types';
import type { MessageFilterType } from './MessageFilter';
import type { ErrorType } from '../ErrorNotification';

interface MessageListProps {
  filterType?: MessageFilterType;
  searchQuery?: string;
  onResultCountChange?: (count: number) => void;
}

function MessageList({
  filterType = 'all',
  searchQuery = '',
  onResultCountChange,
}: MessageListProps) {
  const conversations = useConversationStore((state) => state.conversations);
  const { isStreaming, currentAssistantMessageId } = useStreamingResponse();
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const previousMessageCountRef = useRef(0);

  // Find the active conversation
  const activeConversation = conversations.find((conv) => conv.id === activeConversationId);
  const messages = activeConversation?.messages || [];

  // Filter messages by type and search query
  const filteredMessages = useMemo(() => {
    let filtered = messages;

    // Filter by message type (Requirement 34.2)
    if (filterType !== 'all') {
      filtered = filtered.filter((msg) => {
        if (filterType === 'thinking') {
          // Show messages with thinking content
          return msg.role === 'assistant' && msg.thinking;
        } else if (filterType === 'tool') {
          // Show messages with tool execution
          return msg.toolExecution !== undefined;
        } else {
          // Filter by role
          return msg.role === filterType;
        }
      });
    }

    // Filter by search query (Requirement 34.3)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((msg) => {
        // Search in message content
        if (msg.content && msg.content.toLowerCase().includes(query)) {
          return true;
        }
        // Search in thinking
        if (msg.thinking && msg.thinking.toLowerCase().includes(query)) {
          return true;
        }
        // Search in tool execution target
        if (msg.toolExecution?.target && msg.toolExecution.target.toLowerCase().includes(query)) {
          return true;
        }
        // Search in tool execution tool name
        if (
          msg.toolExecution?.toolName &&
          msg.toolExecution.toolName.toLowerCase().includes(query)
        ) {
          return true;
        }
        return false;
      });
    }

    return filtered;
  }, [messages, filterType, searchQuery]);

  // Update result count when filtered messages change
  useEffect(() => {
    if (onResultCountChange) {
      onResultCountChange(filteredMessages.length);
    }
  }, [filteredMessages.length, onResultCountChange]);

  // Auto-scroll to bottom when new messages are added (only if user hasn't manually scrolled up)
  useEffect(() => {
    if (filteredMessages.length > previousMessageCountRef.current && !isUserScrolling) {
      // New message added, scroll to bottom
      virtuosoRef.current?.scrollToIndex({
        index: filteredMessages.length - 1,
        behavior: 'smooth',
        align: 'end',
      });
    }
    previousMessageCountRef.current = filteredMessages.length;
  }, [filteredMessages.length, isUserScrolling]);

  // Show empty state if no conversation or no messages
  if (!activeConversation || messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 bg-(--vscode-editor-background)">
        {/* Empty state */}
        <div className="flex flex-col items-center gap-3 text-center">
          <MessageSquare size={32} style={{ color: 'var(--vscode-descriptionForeground)' }} />
          <div className="text-sm text-(--vscode-descriptionForeground)">
            Start a conversation with ForgeAI
          </div>
          <div className="text-xs text-(--vscode-descriptionForeground)">
            Type a message below to begin
          </div>
        </div>
      </div>
    );
  }

  // Show "no results" state if filtering/searching returns no messages
  if (filteredMessages.length === 0 && (filterType !== 'all' || searchQuery.trim())) {
    return (
      <div className="flex h-full items-center justify-center p-6 bg-(--vscode-editor-background)">
        <div className="flex flex-col items-center gap-3 text-center">
          <Search size={32} style={{ color: 'var(--vscode-descriptionForeground)' }} />
          <div className="text-sm text-(--vscode-descriptionForeground)">No messages found</div>
          <div className="text-xs text-(--vscode-descriptionForeground)">
            Try adjusting your filter or search query
          </div>
        </div>
      </div>
    );
  }

  // Highlight search matches in text (Requirement 34.3)
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) {
      return text;
    }

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark
          key={index}
          className="bg-(--vscode-editor-findMatchHighlightBackground) text-(--vscode-editor-foreground)"
          style={{ padding: '0 2px', borderRadius: '2px' }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Handle error retry
  const handleErrorRetry = (message: Message) => {
    // Send retry message to extension
    window.vscode.postMessage({
      type: 'retryAfterError',
      conversationId: activeConversationId,
      errorMessage: message,
    });
  };

  // Handle error skip
  const handleErrorSkip = (message: Message) => {
    // Send skip message to extension
    window.vscode.postMessage({
      type: 'skipAfterError',
      conversationId: activeConversationId,
      errorMessage: message,
    });
  };

  // Handle error dismiss
  const handleErrorDismiss = (messageId: string) => {
    // Remove error message from conversation
    if (activeConversationId) {
      const removeMessage = useConversationStore.getState().removeMessage;
      removeMessage(activeConversationId, messageId);
    }
  };

  // Render a single message item
  const renderMessage = (index: number) => {
    const message = filteredMessages[index];

    return (
      <div key={message.id} className="flex flex-col gap-2 px-4 py-2">
        {/* Message role label */}
        <div className="text-xs font-semibold text-(--vscode-descriptionForeground)">
          {message.role === 'user' ? 'You' : message.role === 'error' ? 'Error' : 'ForgeAI'}
        </div>

        {/* Thinking Block (only for assistant messages with thinking) */}
        {message.role === 'assistant' && message.thinking && (
          <ThinkingBlock thinking={message.thinking} />
        )}

        {/* Tool Execution Card (for tool execution messages) */}
        {message.toolExecution && (
          <ToolCard
            toolName={message.toolExecution.toolName}
            target={message.toolExecution.target}
            status={message.toolExecution.status}
            duration={message.toolExecution.duration}
            error={message.toolExecution.error}
            result={message.toolExecution.result}
            arguments={message.toolExecution.arguments}
            startTime={message.toolExecution.status === 'Running' ? message.timestamp : undefined}
          />
        )}

        {/* Error Message */}
        {message.role === 'error' && message.error && (
          <ErrorNotification
            errorType={(message.error.type as ErrorType) || 'UNKNOWN'}
            title={message.error.type || 'Error'}
            message={message.error.message}
            onRetry={() => handleErrorRetry(message)}
            onSkip={() => handleErrorSkip(message)}
            onDismiss={() => handleErrorDismiss(message.id)}
            autoDismiss={true}
            dismissTimeout={10000}
          />
        )}

        {/* Message content (for non-error messages) */}
        {message.role !== 'error' && message.content && (
          <div
            className={`rounded border p-3 text-sm ${
              message.role === 'user'
                ? 'border-(--vscode-input-border) bg-(--vscode-input-background) text-(--vscode-input-foreground)'
                : 'border-(--vscode-input-border) bg-(--vscode-sideBar-background) text-(--vscode-editor-foreground)'
            }`}
          >
            {/* Display attached images for user messages */}
            {message.role === 'user' && message.images && message.images.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {message.images.map((image, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-(--vscode-input-border) overflow-hidden"
                  >
                    <img
                      src={image.dataUrl}
                      alt={image.name}
                      className="h-16 w-16 object-cover"
                      title={image.name}
                    />
                  </div>
                ))}
              </div>
            )}

            {message.role === 'assistant' ? (
              isStreaming && currentAssistantMessageId === message.id ? (
                <StreamingMarkdownRenderer
                  content={message.content}
                  isStreaming={true}
                />
              ) : (
                <MarkdownRenderer content={message.content} />
              )
            ) : (
              <div>{highlightText(message.content, searchQuery)}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Handle scroll state changes
  const handleAtBottomStateChange = (atBottom: boolean) => {
    // If user scrolls away from bottom, mark as user scrolling
    if (!atBottom) {
      setIsUserScrolling(true);
    } else {
      // If user scrolls back to bottom, resume auto-scroll
      setIsUserScrolling(false);
    }
  };

  // Handle "Jump to latest" button click
  const handleJumpToLatest = () => {
    virtuosoRef.current?.scrollToIndex({
      index: filteredMessages.length - 1,
      behavior: 'smooth',
      align: 'end',
    });
    setIsUserScrolling(false);
  };

  // Render virtualized message list
  return (
    <div className="relative h-full bg-(--vscode-editor-background)">
      <Virtuoso
        ref={virtuosoRef}
        data={filteredMessages}
        totalCount={filteredMessages.length}
        overscan={10}
        itemContent={renderMessage}
        followOutput="smooth"
        atBottomStateChange={handleAtBottomStateChange}
        style={{ height: '100%' }}
        components={{
          // Custom footer for spacing
          Footer: () => <div style={{ height: '8px' }} />,
        }}
      />

      {/* Jump to latest button - shown when user has manually scrolled up */}
      {isUserScrolling && (
        <div className="absolute bottom-4 left-1/2 z-50" style={{ transform: 'translateX(-50%)' }}>
          <button
            onClick={handleJumpToLatest}
            className="flex items-center gap-2 rounded px-4 py-2 text-sm shadow-lg transition-colors bg-button text-button hover:bg-button-hover"
          >
            Jump to latest{' '}
            <ChevronDown size={14} style={{ color: 'var(--vscode-button-foreground)' }} />
          </button>
        </div>
      )}
    </div>
  );
}

export default MessageList;
