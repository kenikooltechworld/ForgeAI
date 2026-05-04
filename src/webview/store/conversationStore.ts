import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Conversation Store
 *
 * Manages conversation state using Zustand v5.
 * Stores messages, conversation history, and UI state.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  thinking?: string[];
  tools?: ToolExecution[];
}

export interface ToolExecution {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  status: "pending" | "success" | "error";
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface OnboardingState {
  hasSeenThinkingTooltip: boolean;
  hasSeenToolTooltip: boolean;
  hasSeenCodeChangeTooltip: boolean;
}

interface ConversationState {
  // Current conversation
  currentConversation: Conversation | null;
  conversations: Conversation[];

  // UI state
  isWelcomeScreenVisible: boolean;
  isLoading: boolean;

  // Onboarding state
  onboarding: OnboardingState;

  // Actions
  createConversation: (initialMessage?: string) => void;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setCurrentConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  hideWelcomeScreen: () => void;
  showWelcomeScreen: () => void;
  setLoading: (isLoading: boolean) => void;
  markOnboardingTooltipSeen: (tooltip: keyof OnboardingState) => void;
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentConversation: null,
      conversations: [],
      isWelcomeScreenVisible: true,
      isLoading: false,
      onboarding: {
        hasSeenThinkingTooltip: false,
        hasSeenToolTooltip: false,
        hasSeenCodeChangeTooltip: false,
      },

      // Create a new conversation
      createConversation: (initialMessage?: string) => {
        const newConversation: Conversation = {
          id: `conv-${Date.now()}`,
          title: initialMessage
            ? initialMessage.slice(0, 50) + (initialMessage.length > 50 ? "..." : "")
            : "New Conversation",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          currentConversation: newConversation,
          isWelcomeScreenVisible: false,
        }));

        // If there's an initial message, add it
        if (initialMessage) {
          get().addMessage({
            role: "user",
            content: initialMessage,
          });
        }
      },

      // Add a message to the current conversation
      addMessage: (message) => {
        const { currentConversation } = get();
        if (!currentConversation) {
          // Create a conversation if none exists
          get().createConversation();
          return;
        }

        const newMessage: Message = {
          ...message,
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
        };

        set((state) => {
          const updatedConversation = {
            ...currentConversation,
            messages: [...currentConversation.messages, newMessage],
            updatedAt: Date.now(),
          };

          return {
            currentConversation: updatedConversation,
            conversations: state.conversations.map((conv) =>
              conv.id === currentConversation.id ? updatedConversation : conv
            ),
          };
        });
      },

      // Update a specific message
      updateMessage: (id, updates) => {
        const { currentConversation } = get();
        if (!currentConversation) {return;}

        set((state) => {
          const updatedConversation = {
            ...currentConversation,
            messages: currentConversation.messages.map((msg) =>
              msg.id === id ? { ...msg, ...updates } : msg
            ),
            updatedAt: Date.now(),
          };

          return {
            currentConversation: updatedConversation,
            conversations: state.conversations.map((conv) =>
              conv.id === currentConversation.id ? updatedConversation : conv
            ),
          };
        });
      },

      // Set the current conversation
      setCurrentConversation: (id) => {
        const conversation = get().conversations.find((conv) => conv.id === id);
        if (conversation) {
          set({
            currentConversation: conversation,
            isWelcomeScreenVisible: false,
          });
        }
      },

      // Delete a conversation
      deleteConversation: (id) => {
        set((state) => {
          const updatedConversations = state.conversations.filter((conv) => conv.id !== id);
          const isCurrentDeleted = state.currentConversation?.id === id;

          return {
            conversations: updatedConversations,
            currentConversation: isCurrentDeleted
              ? updatedConversations[0] || null
              : state.currentConversation,
            isWelcomeScreenVisible: isCurrentDeleted && updatedConversations.length === 0,
          };
        });
      },

      // Hide welcome screen
      hideWelcomeScreen: () => {
        set({ isWelcomeScreenVisible: false });
      },

      // Show welcome screen
      showWelcomeScreen: () => {
        set({ isWelcomeScreenVisible: true });
      },

      // Set loading state
      setLoading: (isLoading) => {
        set({ isLoading });
      },

      // Mark onboarding tooltip as seen
      markOnboardingTooltipSeen: (tooltip) => {
        set((state) => ({
          onboarding: {
            ...state.onboarding,
            [tooltip]: true,
          },
        }));
      },
    }),
    {
      name: "forgeai-conversation-storage",
      partialize: (state) => ({
        conversations: state.conversations,
        currentConversation: state.currentConversation,
        onboarding: state.onboarding,
      }),
    }
  )
);
