import React from "react";
import { vscodeTheme } from "../../utils/vscodeTheme";
import { TabBar } from "./TabBar";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { useConversationStore } from "../../store/conversationStore";

/**
 * ActivityStream Component
 *
 * Main activity stream component showing conversation tabs, messages, and input.
 * Three-section layout: TabBar (top), MessageList (middle), MessageInput (bottom).
 *
 * Requirements: 12.1, 12.2, 12.5, 17.1, 21.1, 21.2
 */
export class ActivityStream extends React.Component {
  public render(): React.ReactNode {
    return (
      <div
        className="flex flex-col h-full"
        style={{
          backgroundColor: vscodeTheme.editor.background,
          color: vscodeTheme.editor.foreground,
        }}
      >
        {/* Tab Bar - Top */}
        <TabBar />

        {/* Message List - Middle (scrollable) */}
        <div className="flex-1 overflow-hidden">
          <MessageList />
        </div>

        {/* Message Input - Bottom */}
        <MessageInput />
      </div>
    );
  }
}
