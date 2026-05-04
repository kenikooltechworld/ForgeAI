import React from "react";
import { vscodeTheme } from "../../utils/vscodeTheme";
import { useConversationStore } from "../../store/conversationStore";
import { MessageSquareIcon, BrainIcon } from "../../icons";
import { OnboardingTooltip } from "../OnboardingTooltip";

/**
 * MessageList Component
 *
 * Displays messages in chronological order with user and assistant messages.
 * Shows empty state when no messages exist.
 * Shows onboarding tooltip after first message is sent.
 *
 * Requirements: 12.2, 12.6, 21.1, 21.2, 22.5
 */
export class MessageList extends React.Component {
  private messagesEndRef = React.createRef<HTMLDivElement>();
  private firstMessageRef = React.createRef<HTMLDivElement>();

  componentDidUpdate() {
    // Auto-scroll to bottom when new messages arrive
    this.scrollToBottom();
  }

  private scrollToBottom = () => {
    this.messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  private handleTooltipDismiss = () => {
    const { markOnboardingTooltipSeen } = useConversationStore.getState();
    markOnboardingTooltipSeen("hasSeenThinkingTooltip");
  };

  public render(): React.ReactNode {
    const { currentConversation, onboarding } = useConversationStore.getState();

    if (!currentConversation || currentConversation.messages.length === 0) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full p-8 text-center"
          style={{
            color: vscodeTheme.descriptionForeground,
          }}
        >
          <MessageSquareIcon size={48} />
          <p className="mt-4 text-lg">No messages yet</p>
          <p className="mt-2 text-sm">Start a conversation by typing a message below</p>
        </div>
      );
    }

    const shouldShowTooltip =
      currentConversation.messages.length >= 1 && !onboarding.hasSeenThinkingTooltip;

    return (
      <div className="h-full overflow-y-auto p-4 space-y-4 relative">
        {currentConversation.messages.map((message, index) => {
          const isUser = message.role === "user";
          const isFirstMessage = index === 0;

          return (
            <div
              key={message.id}
              ref={isFirstMessage ? this.firstMessageRef : undefined}
              className="flex gap-3 relative"
              style={{
                flexDirection: isUser ? "row-reverse" : "row",
              }}
            >
              {/* Avatar */}
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: isUser
                    ? vscodeTheme.button.background
                    : vscodeTheme.badge.background,
                  color: isUser ? vscodeTheme.button.foreground : vscodeTheme.badge.foreground,
                }}
              >
                {isUser ? <MessageSquareIcon size={16} /> : <BrainIcon size={16} />}
              </div>

              {/* Message Content */}
              <div
                className="flex-1 px-4 py-3 rounded-lg max-w-[80%]"
                style={{
                  backgroundColor: isUser
                    ? vscodeTheme.input.background
                    : vscodeTheme.editor.background,
                  color: vscodeTheme.editor.foreground,
                  border: `1px solid ${vscodeTheme.input.border}`,
                }}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <div
                  className="mt-2 text-xs"
                  style={{
                    color: vscodeTheme.descriptionForeground,
                  }}
                >
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>

              {/* Onboarding Tooltip - Show after first message */}
              {isFirstMessage && shouldShowTooltip && (
                <div className="absolute top-full left-12 mt-2">
                  <OnboardingTooltip
                    id="thinking-tooltip"
                    content="💡 Tip: ForgeAI shows its thinking process. Click any thinking block to see detailed reasoning."
                    onDismiss={this.handleTooltipDismiss}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Auto-scroll anchor */}
        <div ref={this.messagesEndRef} />
      </div>
    );
  }
}
