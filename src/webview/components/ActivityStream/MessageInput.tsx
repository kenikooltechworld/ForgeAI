import React from "react";
import { vscodeTheme } from "../../utils/vscodeTheme";
import { useConversationStore } from "../../store/conversationStore";
import { SendIcon } from "../../icons";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

/**
 * MessageInput Component
 *
 * Text input box with Send button for user message entry.
 * Handles Enter key submission and Shift+Enter for newlines.
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 21.1, 21.2
 */
export class MessageInput extends React.Component<{}, { value: string; isLoading: boolean }> {
  constructor(props: {}) {
    super(props);
    this.state = {
      value: "",
      isLoading: false,
    };
  }

  private handleSend = () => {
    const { value } = this.state;
    if (!value.trim()) {return;}

    const { addMessage, currentConversation, createConversation } = useConversationStore.getState();

    // Create conversation if none exists
    if (!currentConversation) {
      createConversation(value);
    } else {
      // Add user message
      addMessage({
        role: "user",
        content: value,
      });
    }

    // Clear input
    this.setState({ value: "" });

    // TODO: Send message to extension host for AI processing
    // This will be implemented in Task 3.4
  };

  private handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.handleSend();
    }
  };

  private handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    this.setState({ value: event.target.value });
  };

  public render(): React.ReactNode {
    const { value, isLoading } = this.state;

    return (
      <div
        className="flex items-end gap-2 p-4 border-t"
        style={{
          backgroundColor: vscodeTheme.input.background,
          borderTopColor: vscodeTheme.panel.border,
        }}
      >
        {/* Text Input */}
        <textarea
          className="flex-1 px-3 py-2 rounded resize-none"
          style={{
            backgroundColor: vscodeTheme.input.background,
            color: vscodeTheme.input.foreground,
            border: `1px solid ${vscodeTheme.input.border}`,
            minHeight: "40px",
            maxHeight: "120px",
          }}
          placeholder="Ask ForgeAI anything..."
          value={value}
          onChange={this.handleChange}
          onKeyDown={this.handleKeyDown}
          disabled={isLoading}
          rows={1}
        />

        {/* Send Button */}
        <Button
          onClick={this.handleSend}
          disabled={!value.trim() || isLoading}
          aria-label="Send message"
        >
          <SendIcon size={16} />
        </Button>
      </div>
    );
  }
}
