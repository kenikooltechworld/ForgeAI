import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useConversationStore } from '../../store/conversationStore';

interface StorageQuotaErrorProps {
  onClose: () => void;
}

/**
 * StorageQuotaError Component (Task 15.2)
 *
 * Displays a user-friendly error message when storage quota is exceeded.
 * Provides [Manage Conversations] button to help users delete old conversations.
 */
export function StorageQuotaError({ onClose }: StorageQuotaErrorProps) {
  const conversations = useConversationStore((state) => state.conversations);
  const tabs = useConversationStore((state) => state.tabs);
  const closeTab = useConversationStore((state) => state.closeTab);

  const handleManageConversations = () => {
    // Show conversation management UI
    // For now, we'll just close the error and let users manually delete tabs
    onClose();
  };

  const handleDeleteOldest = () => {
    // Find oldest conversation and delete it
    if (tabs.length > 0) {
      const oldestTab = tabs.reduce((oldest, current) =>
        current.createdAt < oldest.createdAt ? current : oldest
      );
      closeTab(oldestTab.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="relative w-full max-w-md rounded-lg p-6 shadow-xl"
        style={{
          backgroundColor: 'var(--vscode-editor-background)',
          border: '1px solid var(--vscode-panel-border)',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 hover:bg-(--vscode-toolbar-hoverBackground)"
          style={{ color: 'var(--vscode-foreground)' }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Error icon and title */}
        <div className="mb-4 flex items-start gap-3">
          <div
            className="rounded-full p-2"
            style={{ backgroundColor: 'var(--vscode-inputValidation-errorBackground)' }}
          >
            <AlertTriangle
              size={24}
              style={{ color: 'var(--vscode-inputValidation-errorForeground)' }}
            />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--vscode-foreground)' }}>
              Storage Quota Exceeded
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--vscode-descriptionForeground)' }}>
              Your workspace storage is full. Please delete old conversations to free up space.
            </p>
          </div>
        </div>

        {/* Storage info */}
        <div
          className="mb-4 rounded p-3 text-sm"
          style={{
            backgroundColor: 'var(--vscode-textBlockQuote-background)',
            borderLeft: '3px solid var(--vscode-textBlockQuote-border)',
          }}
        >
          <div style={{ color: 'var(--vscode-foreground)' }}>
            <strong>Current storage:</strong>
          </div>
          <div className="mt-1" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            • {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </div>
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>
            • {tabs.length} tab{tabs.length !== 1 ? 's' : ''}
          </div>
          <div style={{ color: 'var(--vscode-descriptionForeground)' }}>
            • {conversations.reduce((sum, c) => sum + c.messages.length, 0)} total messages
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDeleteOldest}
            className="flex flex-1 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
            }}
          >
            <Trash2 size={16} />
            Delete Oldest
          </button>
          <button
            type="button"
            onClick={handleManageConversations}
            className="flex flex-1 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                'var(--vscode-button-secondaryHoverBackground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
            }}
          >
            Manage Conversations
          </button>
        </div>

        {/* Help text */}
        <p className="mt-4 text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          Tip: Close unused tabs or export important conversations before deleting them.
        </p>
      </div>
    </div>
  );
}
