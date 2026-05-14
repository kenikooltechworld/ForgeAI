import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useConversationStore } from '../../store/conversationStore';

interface ThinkingBlockProps {
  thinking: string;
}

function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get thinking visibility from store
  const showThinking = useConversationStore((state) => state.showThinking);

  // Hide thinking block if showThinking is false
  if (!showThinking) {
    return null;
  }

  return (
    <div className="mb-3">
      {/* Collapsed state - minimal "Thinking..." indicator */}
      {!isExpanded && (
        <div className="flex items-center gap-2 text-sm text-(--vscode-descriptionForeground) italic mb-2">
          <span className="animate-pulse">●</span>
          Thinking...
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="hover:opacity-70 transition-opacity"
            title="Show reasoning"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            <ChevronDown size={14} />
          </button>
        </div>
      )}

      {/* Expanded state - full reasoning with subtle border */}
      {isExpanded && (
        <div className="border-l-2 border-(--vscode-panel-border) pl-3 mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-(--vscode-descriptionForeground) italic">
              Thinking process
            </span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-xs text-(--vscode-textLink-foreground) hover:underline flex items-center gap-1"
            >
              Hide <ChevronUp size={12} />
            </button>
          </div>
          <div className="whitespace-pre-wrap text-sm text-(--vscode-descriptionForeground) italic">
            {thinking}
          </div>
        </div>
      )}
    </div>
  );
}

export default ThinkingBlock;
