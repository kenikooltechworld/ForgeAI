import React from "react";
import { vscodeTheme } from "../../utils/vscodeTheme";
import { useConversationStore } from "../../store/conversationStore";
import { PlusIcon } from "../../icons";

/**
 * TabBar Component
 *
 * Displays conversation tabs with "New Conversation" button.
 * Shows active tab with distinct styling.
 *
 * Requirements: 16.1, 16.2, 16.4, 16.5, 37.1
 */
export class TabBar extends React.Component {
  private handleNewConversation = () => {
    const { createConversation } = useConversationStore.getState();
    createConversation();
  };

  private handleTabClick = (conversationId: string) => {
    const { setCurrentConversation } = useConversationStore.getState();
    setCurrentConversation(conversationId);
  };

  private handleCloseTab = (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const { deleteConversation } = useConversationStore.getState();
    deleteConversation(conversationId);
  };

  public render(): React.ReactNode {
    const { conversations, currentConversation } = useConversationStore.getState();

    return (
      <div
        className="flex items-center gap-1 px-2 py-1 border-b"
        style={{
          backgroundColor: vscodeTheme.tab.inactiveBackground,
          borderBottomColor: vscodeTheme.panel.border,
        }}
      >
        {/* Conversation Tabs */}
        {conversations.map((conv) => {
          const isActive = currentConversation?.id === conv.id;
          return (
            <div
              key={conv.id}
              className="flex items-center gap-2 px-3 py-1 rounded-t cursor-pointer min-w-0 max-w-[200px]"
              style={{
                backgroundColor: isActive
                  ? vscodeTheme.tab.activeBackground
                  : vscodeTheme.tab.inactiveBackground,
                color: isActive
                  ? vscodeTheme.tab.activeForeground
                  : vscodeTheme.tab.inactiveForeground,
              }}
              onClick={() => this.handleTabClick(conv.id)}
            >
              <span className="truncate text-sm">{conv.title}</span>
              <button
                className="hover:opacity-70"
                onClick={(e) => this.handleCloseTab(conv.id, e)}
                aria-label="Close tab"
              >
                ×
              </button>
            </div>
          );
        })}

        {/* New Conversation Button */}
        <button
          className="flex items-center gap-1 px-2 py-1 rounded hover:opacity-70"
          style={{
            color: vscodeTheme.button.foreground,
          }}
          onClick={this.handleNewConversation}
          aria-label="New conversation"
        >
          <PlusIcon size={16} />
          <span className="text-sm">New</span>
        </button>
      </div>
    );
  }
}
