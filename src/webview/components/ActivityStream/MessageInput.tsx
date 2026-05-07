import React, { useActionState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { useConversationStore } from '../../store/conversationStore';

interface MessageInputProps {
  conversationId?: string;
}

function MessageInput({ conversationId }: MessageInputProps) {
  const addMessage = useConversationStore((state) => state.addMessage);
  const conversations = useConversationStore((state) => state.conversations);
  const tabs = useConversationStore((state) => state.tabs);
  const renameTab = useConversationStore((state) => state.renameTab);
  const language = useConversationStore((state) => state.language);
  const setLanguage = useConversationStore((state) => state.setLanguage);
  const openSettings = useConversationStore((state) => state.openSettings);

  // Language options
  const languages = [
    { code: 'English', flag: '🇬🇧', name: 'English' },
    { code: 'Nigerian Pidgin', flag: '🇳🇬', name: 'Pidgin' },
    { code: 'Yoruba', flag: '🇳🇬', name: 'Yoruba' },
    { code: 'Igbo', flag: '🇳🇬', name: 'Igbo' },
    { code: 'Hausa', flag: '🇳🇬', name: 'Hausa' },
    { code: 'French', flag: '🇫🇷', name: 'Français' },
    { code: 'Spanish', flag: '🇪🇸', name: 'Español' },
    { code: 'Portuguese', flag: '🇵🇹', name: 'Português' },
    { code: 'Swahili', flag: '🇰🇪', name: 'Swahili' },
    { code: 'Arabic', flag: '🇸🇦', name: 'العربية' },
    { code: 'Chinese (Simplified)', flag: '🇨🇳', name: '简体中文' },
    { code: 'Hindi', flag: '🇮🇳', name: 'हिन्दी' },
    { code: 'Japanese', flag: '🇯🇵', name: '日本語' },
    { code: 'Korean', flag: '🇰🇷', name: '한국어' },
    { code: 'German', flag: '🇩🇪', name: 'Deutsch' },
    { code: 'Italian', flag: '🇮🇹', name: 'Italiano' },
    { code: 'Russian', flag: '🇷🇺', name: 'Русский' },
  ];

  const currentLanguage = languages.find((lang) => lang.code === language) || languages[0];

  // useActionState for form handling (React 19)
  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const content = formData.get('message') as string;

      if (!content.trim() || !conversationId) {
        return { success: false, error: 'Message cannot be empty' };
      }

      try {
        // Get conversation to check if this is the first message
        const conversation = conversations.find((c) => c.id === conversationId);
        const isFirstMessage = !conversation || conversation.messages.length === 0;

        // Add user message optimistically
        const userMessage = {
          id: crypto.randomUUID(),
          role: 'user' as const,
          content,
          timestamp: Date.now(),
        };

        addMessage(conversationId, userMessage);

        // If this is the first message, update the tab/conversation title
        if (isFirstMessage) {
          // Find the tab associated with this conversation
          const tab = tabs.find((t) => t.conversationId === conversationId);
          if (tab) {
            // Truncate the message to 50 characters for the title
            const title = content.length > 50 ? `${content.substring(0, 50)}...` : content;
            renameTab(tab.id, title);
          }
        }

        // Get conversation history for context
        const conversationHistory = conversation?.messages || [];

        // Get the model for this conversation
        const model = conversation?.model || 'gpt-oss:120b-cloud';

        // Send to extension host with conversation history and model
        if (window.vscode) {
          window.vscode.postMessage({
            type: 'sendMessage',
            conversationId,
            content,
            conversationHistory,
            model, // Include selected model
          });
        }

        // Clear the form on success
        const form = document.querySelector('form');
        if (form) {
          form.reset();
        }

        return { success: true, error: null };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
    { success: false, error: null }
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <div className="border-t border-(--vscode-input-border) p-4 bg-(--vscode-editor-background)">
      {state.error && (
        <div
          className="mb-2 p-2 rounded border text-sm"
          style={{
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            borderColor: 'rgba(255, 0, 0, 0.2)',
            color: '#ff4444',
          }}
        >
          {state.error}
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-2">
        {/* Input and Send button on same line */}
        <div className="flex gap-2">
          <textarea
            name="message"
            placeholder="Ask ForgeAI anything..."
            disabled={isPending || !conversationId}
            onKeyDown={handleKeyDown}
            className="flex-1 p-3 rounded bg-(--vscode-input-background) text-(--vscode-input-foreground) border border-(--vscode-input-border) placeholder:text-(--vscode-input-placeholderForeground) resize-none focus:outline-none"
            rows={3}
          />

          <button
            type="submit"
            disabled={isPending || !conversationId}
            className="px-4 py-2 rounded bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground) disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            {isPending ? 'Sending...' : 'Send'}
          </button>
        </div>

        {/* Icon buttons below */}
        <div className="flex gap-2 items-center">
          {/* Language selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="p-2 rounded bg-(--vscode-input-background) text-(--vscode-input-foreground) border border-(--vscode-input-border) text-xs cursor-pointer hover:bg-(--vscode-list-hoverBackground) focus:outline-none"
            title="Select language for AI responses"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="p-2 rounded hover:bg-(--vscode-toolbar-hoverBackground)"
            title="Attach file"
          >
            📎
          </button>
          <button
            type="button"
            className="p-2 rounded hover:bg-(--vscode-toolbar-hoverBackground)"
            title="Voice input"
          >
            🎤
          </button>
          <button
            type="button"
            onClick={openSettings}
            className="p-2 rounded hover:bg-(--vscode-toolbar-hoverBackground)"
            title="Settings"
          >
            <SettingsIcon size={16} style={{ color: 'var(--vscode-button-foreground)' }} />
          </button>
        </div>
      </form>

      <div className="mt-2 text-xs text-(--vscode-descriptionForeground)">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}

export default MessageInput;
