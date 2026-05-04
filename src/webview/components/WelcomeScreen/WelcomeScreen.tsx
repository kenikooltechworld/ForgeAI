import React from "react";
import { vscodeTheme } from "../../utils/vscodeTheme";
import { WelcomeHeader } from "./WelcomeHeader";
import { ModelStatusCard } from "./ModelStatusCard";
import { QuickActionsGrid } from "./QuickActionsGrid";
import { MessageInputBox } from "./MessageInputBox";
import { TipSection } from "./TipSection";
import { FooterLinks } from "./FooterLinks";
import { useConversationStore } from "../../store/conversationStore";

/**
 * WelcomeScreen Component
 *
 * Displays the first launch experience for ForgeAI.
 * Composed of smaller, reusable components for better maintainability.
 * Shows welcome message, model status, quick action buttons, and input box.
 *
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 21.1, 21.2, 8.3, 41.2, 41.3
 */
export class WelcomeScreen extends React.Component<{}, { inputValue: string }> {
  constructor(props: {}) {
    super(props);
    this.state = {
      inputValue: "",
    };
  }

  private handleQuickAction = (action: string) => {
    // Get the store actions
    const { createConversation } = useConversationStore.getState();

    // Map actions to pre-filled prompts
    const prompts: Record<string, string> = {
      "fix-bug":
        "I'll help you fix a bug. Can you describe the issue, or should I analyze recent error logs and test failures?",
      "build-feature": "I'll help you build a feature. What would you like to create?",
      "explain-code": "I'll explain code for you. Which file or function should I explain?",
      "generate-tests": "I'll generate tests. Which file or component needs test coverage?",
      "review-changes":
        "I'll review your changes. Should I analyze your last commit or current working changes?",
      "write-docs": "I'll help write documentation. Which code needs documentation?",
    };

    const prompt = prompts[action];
    if (prompt) {
      createConversation(prompt);
    }
  };

  private handleSendMessage = () => {
    const { inputValue } = this.state;
    if (!inputValue.trim()) {return;}

    // Get the store actions
    const { createConversation } = useConversationStore.getState();

    // Create conversation with user message
    createConversation(inputValue);

    // Clear input
    this.setState({ inputValue: "" });
  };

  private handleInputChange = (value: string) => {
    this.setState({ inputValue: value });
  };

  private handleViewDocumentation = () => {
    // Will be implemented later
    console.log("View documentation clicked");
  };

  private handleSettings = () => {
    // Will be implemented later
    console.log("Settings clicked");
  };

  public render(): React.ReactNode {
    return (
      <div
        className="flex flex-col h-full p-6 overflow-y-auto"
        style={{
          backgroundColor: vscodeTheme.editor.background,
          color: vscodeTheme.editor.foreground,
        }}
      >
        <WelcomeHeader />
        <ModelStatusCard />
        <QuickActionsGrid onActionClick={this.handleQuickAction} />
        <MessageInputBox
          value={this.state.inputValue}
          onChange={this.handleInputChange}
          onSend={this.handleSendMessage}
        />
        <TipSection />
        <FooterLinks
          onDocumentationClick={this.handleViewDocumentation}
          onSettingsClick={this.handleSettings}
        />
      </div>
    );
  }
}
