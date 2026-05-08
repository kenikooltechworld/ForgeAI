import React, { useActionState, useRef, useState } from 'react';
import { Settings as SettingsIcon, Paperclip, X, Mic, Send } from 'lucide-react';
import { useConversationStore } from '../../store/conversationStore';

interface MessageInputProps {
  conversationId?: string;
}

interface AttachedImage {
  name: string;
  dataUrl: string;
  size: number;
}

function MessageInput({ conversationId }: MessageInputProps) {
  const addMessage = useConversationStore((state) => state.addMessage);
  const conversations = useConversationStore((state) => state.conversations);
  const tabs = useConversationStore((state) => state.tabs);
  const renameTab = useConversationStore((state) => state.renameTab);
  const language = useConversationStore((state) => state.language);
  const setLanguage = useConversationStore((state) => state.setLanguage);
  const openSettings = useConversationStore((state) => state.openSettings);

  // State for attached images
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // State for message history navigation
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentDraft, setCurrentDraft] = useState('');

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

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check if adding these files would exceed the limit
    if (attachedImages.length + files.length > 10) {
      alert(
        `You can only attach up to 10 images at once. Currently attached: ${attachedImages.length}`
      );
      return;
    }

    const newImages: AttachedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        continue;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert(`Image ${file.name} is too large. Maximum size is 5MB.`);
        continue;
      }

      // Read file as data URL
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

      newImages.push({
        name: file.name,
        dataUrl,
        size: file.size,
      });
    }

    setAttachedImages((prev) => [...prev, ...newImages]);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle paste event for images
  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const newImages: AttachedImage[] = [];
    let imageCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Check if item is an image
      if (item.type.startsWith('image/')) {
        imageCount++;

        // Check if adding this image would exceed the limit
        if (attachedImages.length + imageCount > 10) {
          alert(
            `You can only attach up to 10 images at once. Currently attached: ${attachedImages.length}`
          );
          break;
        }

        event.preventDefault(); // Prevent default paste behavior for images

        const file = item.getAsFile();
        if (!file) continue;

        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert(`Pasted image is too large. Maximum size is 5MB.`);
          continue;
        }

        // Read file as data URL
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        newImages.push({
          name: file.name || `pasted-image-${Date.now()}.png`,
          dataUrl,
          size: file.size,
        });
      }
    }

    if (newImages.length > 0) {
      setAttachedImages((prev) => [...prev, ...newImages]);
    }
  };

  // Remove attached image
  const removeImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Open file picker
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  // useActionState for form handling (React 19)
  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const content = formData.get('message') as string;

      if (!content.trim() || !conversationId) {
        return { success: false, error: 'Message cannot be empty' };
      }

      try {
        // Add to message history
        setMessageHistory((prev) => [...prev, content]);
        setHistoryIndex(-1);
        setCurrentDraft('');

        // Get conversation to check if this is the first message
        const conversation = conversations.find((c) => c.id === conversationId);
        const isFirstMessage = !conversation || conversation.messages.length === 0;

        // Add user message optimistically with images
        const userMessage = {
          id: crypto.randomUUID(),
          role: 'user' as const,
          content,
          timestamp: Date.now(),
          images: attachedImages.length > 0 ? attachedImages : undefined,
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
            images: attachedImages.map((img) => ({
              name: img.name,
              dataUrl: img.dataUrl,
            })),
          });
        }

        // Clear the form and attached images on success
        const form = document.querySelector('form');
        if (form) {
          form.reset();
        }
        setAttachedImages([]);

        return { success: true, error: null };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
    { success: false, error: null }
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Arrow up - navigate to previous message
    if (e.key === 'ArrowUp' && !e.shiftKey) {
      const textarea = e.currentTarget;
      const cursorAtStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0;

      if (cursorAtStart && messageHistory.length > 0) {
        e.preventDefault();

        // Save current draft if we're at the beginning
        if (historyIndex === -1) {
          setCurrentDraft(textarea.value);
        }

        const newIndex = Math.min(historyIndex + 1, messageHistory.length - 1);
        setHistoryIndex(newIndex);
        textarea.value = messageHistory[messageHistory.length - 1 - newIndex];
      }
    }

    // Arrow down - navigate to next message
    if (e.key === 'ArrowDown' && !e.shiftKey) {
      const textarea = e.currentTarget;
      const cursorAtEnd =
        textarea.selectionStart === textarea.value.length &&
        textarea.selectionEnd === textarea.value.length;

      if (cursorAtEnd && historyIndex > -1) {
        e.preventDefault();

        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);

        if (newIndex === -1) {
          // Restore draft
          textarea.value = currentDraft;
        } else {
          textarea.value = messageHistory[messageHistory.length - 1 - newIndex];
        }
      }
    }

    // Enter - submit form
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
        <div className="mb-2 p-2 rounded border text-sm bg-error-bg border-error text-error">
          {state.error}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <form action={formAction} className="flex flex-col gap-2">
        {/* Unified input container */}
        <div className="flex gap-2 p-3 rounded bg-(--vscode-input-background) focus-within:ring-1 focus-within:ring-(--vscode-focusBorder)">
          {/* Left side: Images and textarea */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {/* Image previews - horizontal scroll, fixed size */}
            {attachedImages.length > 0 && (
              <div className="flex gap-1 overflow-x-auto pb-1">
                {attachedImages.map((image, index) => (
                  <div
                    key={index}
                    className="relative group rounded border border-(--vscode-input-border) overflow-hidden flex-shrink-0"
                  >
                    <img src={image.dataUrl} alt={image.name} className="h-8 w-8 object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-0 right-0 p-0.5 rounded-bl bg-(--vscode-button-background) text-(--vscode-button-foreground) opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              name="message"
              placeholder="Ask ForgeAI anything..."
              disabled={isPending || !conversationId}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              className="w-full bg-transparent text-(--vscode-input-foreground) placeholder:text-(--vscode-input-placeholderForeground) resize-none focus:outline-none border-0"
              rows={2}
            />
          </div>

          {/* Right side: Send button (fixed height) */}
          <button
            type="submit"
            disabled={isPending || !conversationId}
            className="p-2 rounded hover:bg-(--vscode-toolbar-hoverBackground) disabled:opacity-50 disabled:cursor-not-allowed self-start flex-shrink-0"
            title={isPending ? 'Sending...' : 'Send message'}
          >
            <Send size={12} style={{ color: 'var(--vscode-button-foreground)' }} />
          </button>
        </div>

        {/* Bottom row: Language dropdown and action buttons */}
        <div className="flex gap-2 items-center">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="p-2 rounded bg-transparent text-(--vscode-input-foreground) text-xs cursor-pointer hover:bg-(--vscode-list-hoverBackground) focus:outline-none border-0"
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
            onClick={handleAttachClick}
            className="p-2 rounded hover:bg-(--vscode-toolbar-hoverBackground)"
            title="Attach image"
          >
            <Paperclip size={12} style={{ color: 'var(--vscode-button-foreground)' }} />
          </button>
          <button
            type="button"
            className="p-2 rounded hover:bg-(--vscode-toolbar-hoverBackground)"
            title="Voice input"
          >
            <Mic size={12} style={{ color: 'var(--vscode-button-foreground)' }} />
          </button>
          <button
            type="button"
            onClick={openSettings}
            className="p-2 rounded hover:bg-(--vscode-toolbar-hoverBackground)"
            title="Settings"
          >
            <SettingsIcon size={12} style={{ color: 'var(--vscode-button-foreground)' }} />
          </button>
        </div>
      </form>

      <div className="mt-2 text-xs text-(--vscode-descriptionForeground)">
        Press Enter to send, Shift+Enter for new line, ↑/↓ to navigate history
      </div>
    </div>
  );
}

export default MessageInput;
