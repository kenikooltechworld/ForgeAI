import React from 'react';
import { useConversationStore } from '../../store/conversationStore';
import { Loader2, CheckCircle2, Circle, Database, Globe } from 'lucide-react';

interface ResearchProgressProps {
  conversationId: string;
}

export const ResearchProgress: React.FC<ResearchProgressProps> = ({ conversationId }) => {
  const researchMode = useConversationStore((state) => state.researchMode);
  const state = researchMode[conversationId];

  if (!state || !state.active) return null;

  const completedCount = state.topics.filter((t: any) => t.status === 'complete').length;
  const progress = state.totalTopics > 0 ? (completedCount / state.totalTopics) * 100 : 0;

  return (
    <div className="mb-3 rounded border border-(--vscode-panel-border) bg-(--vscode-editor-background) p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-(--vscode-button-background)" />
          <span className="text-xs font-semibold text-(--vscode-editor-foreground)">
            Research in Progress
          </span>
        </div>
        <span className="text-xs text-(--vscode-descriptionForeground)">
          {completedCount}/{state.totalTopics} topics
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-(--vscode-panel-border) mb-2">
        <div
          className="h-full rounded-full bg-(--vscode-button-background) transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Topic list */}
      <div className="space-y-1 max-h-24 overflow-y-auto scrollable-modern">
        {state.topics.map((topic: any, idx: number) => (
          <div
            key={topic.slug}
            className="flex items-center gap-2 text-xs"
          >
            {topic.status === 'complete' ? (
              <CheckCircle2 size={12} className="text-green-500 shrink-0" />
            ) : topic.status === 'researching' ? (
              <Loader2 size={12} className="animate-spin text-(--vscode-button-background) shrink-0" />
            ) : (
              <Circle size={12} className="text-(--vscode-descriptionForeground) shrink-0" />
            )}
            <span
              className={`truncate ${
                topic.status === 'complete'
                  ? 'text-(--vscode-descriptionForeground)'
                  : 'text-(--vscode-editor-foreground)'
              }`}
              title={topic.query}
            >
              {topic.query}
            </span>
            {topic.findingsCount !== undefined && (
              <span className="ml-auto shrink-0 text-(--vscode-descriptionForeground)">
                {topic.findingsCount} finding{topic.findingsCount !== 1 ? 's' : ''}
              </span>
            )}
            {topic.sourceTypes && topic.sourceTypes.length > 0 && (
              <span className="flex gap-1 shrink-0">
                {topic.sourceTypes.includes('rag') && (
                  <span title="RAG">
                    <Database size={10} className="text-(--vscode-button-background)" />
                  </span>
                )}
                {topic.sourceTypes.includes('web') && (
                  <span title="Web">
                    <Globe size={10} className="text-blue-400" />
                  </span>
                )}
              </span>
            )}
          </div>
        ))}
      </div>

      {state.status === 'complete' && (
        <div className="mt-2 text-xs text-green-500 flex items-center gap-1">
          <CheckCircle2 size={12} />
          Research complete — {state.totalFindings} total findings
        </div>
      )}
    </div>
  );
};

export default ResearchProgress;
