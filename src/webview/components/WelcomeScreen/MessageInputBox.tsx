import React from "react";
import { SendIcon, ICON_SIZES } from "../../icons";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { vscodeTheme } from "../../utils/vscodeTheme";

/**
 * MessageInputBox Component
 *
 * Displays an input field with send button for user messages.
 * Allows users to type and send messages to the AI assistant.
 *
 * Requirements: 22.4, 21.2, 8.3
 */
interface MessageInputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
}

export class MessageInputBox extends React.Component<MessageInputBoxProps> {
  public render(): React.ReactNode {
    const { value, onChange, onSend, placeholder = "Ask ForgeAI anything..." } = this.props;

    return (
      <div className="mb-6">
        <p className="text-sm mb-3" style={{ color: vscodeTheme.text.description }}>
          Or just start typing below...
        </p>

        <div className="flex gap-2">
          <Input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className="flex-1"
          />
          <Button variant="primary" onClick={onSend} className="flex items-center gap-2">
            <SendIcon size={ICON_SIZES.sm} />
            <span>Send</span>
          </Button>
        </div>
      </div>
    );
  }
}
