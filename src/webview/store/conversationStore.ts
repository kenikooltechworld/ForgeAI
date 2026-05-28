import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Conversation, Message } from '@types';

interface OnboardingState {
  hasSeenThinkingTooltip: boolean;
  hasSeenToolTooltip: boolean;
  hasSeenCodeChangeTooltip: boolean;
}

export interface Tab {
  id: string;
  title: string;
  conversationId: string;
  createdAt: number;
}

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  tabs: Tab[];
  tabOrder: string[]; // Array of tab IDs in display order
  onboarding: OnboardingState;
  language: string; // User's preferred language
  showSettings: boolean; // Settings panel visibility
  selectedModel: string; // Currently selected Ollama model
  showThinking: boolean; // Thinking visibility toggle
  autonomyLevel: 'supervised' | 'semi-autonomous' | 'autonomous'; // Autonomy level setting

  // Preview panel state
  previewType: 'empty' | 'diff' | 'file' | 'terminal' | 'test' | 'taskTracker';
  previewData: any | null;

  // Max iterations state
  maxIterationsWarning: {
    conversationId: string | null;
    message: string | null;
    context: any | null;
  };

  // Conversation actions
  addConversation: (conversation: Conversation) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  setActiveConversationId: (id: string) => void;
  removeConversation: (id: string) => void;
  clearConversation: (id: string) => void;

  // Tab actions
  createTab: (title?: string) => string; // Returns new tab ID
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;
  duplicateTab: (id: string) => string; // Returns new tab ID
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  reorderTabs: (newOrder: string[]) => void;
  exportConversation: (id: string) => void;

  // Language actions
  setLanguage: (language: string) => void;

  // Onboarding actions
  setOnboardingTooltipSeen: (tooltipType: keyof OnboardingState) => void;
  setOnboardingTooltipSeenPermanently: (tooltipType: keyof OnboardingState) => void;
  loadOnboardingState: (state: OnboardingState) => void;

  // Preview actions
  showDiff: (diffData: any) => void;
  showFile: (fileData: any) => void;
  showTerminal: (terminalData: any) => void;
  showTest: (testData: any) => void;
  showTaskTracker: (taskData: any) => void;
  updateTaskTracker: (taskId: string, updates: any) => void;
  clearPreview: () => void;

  // Max iterations actions
  showMaxIterationsWarning: (conversationId: string, message: string, context: any) => void;
  clearMaxIterationsWarning: () => void;

  // Settings actions
  openSettings: () => void;
  closeSettings: () => void;

  // Model selection actions
  setSelectedModel: (model: string) => void;
  updateConversationModel: (conversationId: string, model: string) => void;

  // Thinking visibility actions
  setShowThinking: (show: boolean) => void;
  toggleThinking: () => void;

  // Autonomy level actions
  setAutonomyLevel: (level: 'supervised' | 'semi-autonomous' | 'autonomous') => void;
}

// VS Code storage adapter for Zustand persist
const vscodeStorage = createJSONStorage(() => ({
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!window.vscode) {
        resolve(null);
        return;
      }

      // Request state from extension
      window.vscode.postMessage({ type: 'getWorkspaceState', key: name });

      // Listen for response
      const handler = (event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'workspaceState' && message.key === name) {
          window.removeEventListener('message', handler);
          resolve(message.value ? JSON.stringify(message.value) : null);
        }
      };

      window.addEventListener('message', handler);

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 5000);
    });
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (!window.vscode) {
      return;
    }

    try {
      const parsed = JSON.parse(value);
      window.vscode.postMessage({
        type: 'setWorkspaceState',
        key: name,
        value: parsed,
      });
    } catch (error) {
      // Check if this is a quota exceeded error (Task 15.2)
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Notify the app about storage quota error
        window.dispatchEvent(
          new CustomEvent('storageQuotaExceeded', {
            detail: {
              key: name,
              error: error.message,
            },
          })
        );
      }

      throw error;
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (!window.vscode) {
      return;
    }

    window.vscode.postMessage({
      type: 'setWorkspaceState',
      key: name,
      value: undefined,
    });
  },
}));

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      tabs: [],
      tabOrder: [],
      onboarding: {
        hasSeenThinkingTooltip: false,
        hasSeenToolTooltip: false,
        hasSeenCodeChangeTooltip: false,
      },
      language: 'English', // Default language
      showSettings: false, // Settings panel hidden by default
      selectedModel: 'gpt-oss:120b-cloud', // Default model
      showThinking: true, // Show thinking by default (Requirement 49.1)
      autonomyLevel: 'semi-autonomous', // Default autonomy level (Task 10.4)
      previewType: 'empty',
      previewData: null,
      maxIterationsWarning: {
        conversationId: null,
        message: null,
        context: null,
      },

      // Conversation actions
      addConversation: (conversation) =>
        set((state) => ({
          conversations: [...state.conversations, conversation],
          activeConversationId: conversation.id,
        })),

      addMessage: (conversationId, message) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, messages: [...conversation.messages, message] }
              : conversation
          ),
        })),

      updateMessage: (conversationId, messageId, updates) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: conversation.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, ...updates } : msg
                  ),
                }
              : conversation
          ),
        })),

      removeMessage: (conversationId, messageId) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: conversation.messages.filter((msg) => msg.id !== messageId),
                }
              : conversation
          ),
        })),

      setActiveConversationId: (id) => set({ activeConversationId: id }),

      removeConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
        })),

      clearConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.map((c) => (c.id === id ? { ...c, messages: [] } : c)),
        })),

      // Tab actions
      createTab: (title = 'New Conversation') => {
        const state = get();
        const tabId = crypto.randomUUID();
        const conversationId = crypto.randomUUID();

        const newConversation: Conversation = {
          id: conversationId,
          title,
          messages: [],
          createdAt: Date.now(),
          model: state.selectedModel, // Use currently selected model
        };

        const newTab: Tab = {
          id: tabId,
          title,
          conversationId,
          createdAt: Date.now(),
        };

        set((state) => ({
          conversations: [...state.conversations, newConversation],
          tabs: [...state.tabs, newTab],
          tabOrder: [...state.tabOrder, tabId],
          activeConversationId: conversationId,
        }));

        return tabId;
      },

      closeTab: (id) => {
        const state = get();
        const tabIndex = state.tabOrder.indexOf(id);
        const tab = state.tabs.find((t) => t.id === id);

        if (!tab) return;

        // Determine next active tab
        let nextActiveId: string | null = null;
        if (state.activeConversationId === tab.conversationId) {
          // Find adjacent tab (right if available, otherwise left)
          const rightTab = state.tabs.find((t) => t.id === state.tabOrder[tabIndex + 1]);
          const leftTab = state.tabs.find((t) => t.id === state.tabOrder[tabIndex - 1]);
          nextActiveId = rightTab?.conversationId || leftTab?.conversationId || null;
        } else {
          nextActiveId = state.activeConversationId;
        }

        set({
          tabs: state.tabs.filter((t) => t.id !== id),
          tabOrder: state.tabOrder.filter((tid) => tid !== id),
          conversations: state.conversations.filter((c) => c.id !== tab.conversationId),
          activeConversationId: nextActiveId,
        });
      },

      switchTab: (id) => {
        const state = get();
        const tab = state.tabs.find((t) => t.id === id);
        if (tab) {
          set({ activeConversationId: tab.conversationId });
        }
      },

      renameTab: (id, title) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
          conversations: state.conversations.map((c) => {
            const tab = state.tabs.find((t) => t.id === id);
            return tab && c.id === tab.conversationId ? { ...c, title } : c;
          }),
        }));
      },

      duplicateTab: (id) => {
        const state = get();
        const tab = state.tabs.find((t) => t.id === id);
        const conversation = state.conversations.find((c) => c.id === tab?.conversationId);

        if (!tab || !conversation) return '';

        const newTabId = crypto.randomUUID();
        const newConversationId = crypto.randomUUID();

        const newConversation: Conversation = {
          ...conversation,
          id: newConversationId,
          title: `${conversation.title} (Copy)`,
          messages: [...conversation.messages],
          createdAt: Date.now(),
        };

        const newTab: Tab = {
          id: newTabId,
          title: `${tab.title} (Copy)`,
          conversationId: newConversationId,
          createdAt: Date.now(),
        };

        set((state) => ({
          conversations: [...state.conversations, newConversation],
          tabs: [...state.tabs, newTab],
          tabOrder: [...state.tabOrder, newTabId],
          activeConversationId: newConversationId,
        }));

        return newTabId;
      },

      closeOtherTabs: (id) => {
        const state = get();
        const tab = state.tabs.find((t) => t.id === id);

        if (!tab) return;

        set({
          tabs: [tab],
          tabOrder: [id],
          conversations: state.conversations.filter((c) => c.id === tab.conversationId),
          activeConversationId: tab.conversationId,
        });
      },

      closeAllTabs: () => {
        set({
          tabs: [],
          tabOrder: [],
          conversations: [],
          activeConversationId: null,
        });
      },

      reorderTabs: (newOrder) => {
        set({ tabOrder: newOrder });
      },

      exportConversation: (id) => {
        const state = get();
        const tab = state.tabs.find((t) => t.id === id);
        const conversation = state.conversations.find((c) => c.id === tab?.conversationId);

        if (!conversation) return;

        const dataStr = JSON.stringify(conversation, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${conversation.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
      },

      // Language actions
      setLanguage: (language) => {
        set({ language });
        // Persist to VS Code settings
        if (window.vscode) {
          window.vscode.postMessage({
            type: 'setLanguage',
            language,
          });
        }
      },

      // Onboarding actions
      setOnboardingTooltipSeen: (tooltipType) =>
        set((state) => ({
          onboarding: {
            ...state.onboarding,
            [tooltipType]: true,
          },
        })),

      setOnboardingTooltipSeenPermanently: (tooltipType) =>
        set((state) => {
          const newOnboardingState = {
            ...state.onboarding,
            [tooltipType]: true,
          };

          // Persist to globalState via extension message
          if (window.vscode) {
            window.vscode.postMessage({
              type: 'setOnboardingState',
              payload: newOnboardingState,
            });
          }

          return {
            onboarding: newOnboardingState,
          };
        }),

      loadOnboardingState: (state) =>
        set({
          onboarding: state,
        }),

      // Preview actions
      showDiff: (diffData) => set({ previewType: 'diff', previewData: diffData }),
      showFile: (fileData) => set({ previewType: 'file', previewData: fileData }),
      showTerminal: (terminalData) => set({ previewType: 'terminal', previewData: terminalData }),
      showTest: (testData) => set({ previewType: 'test', previewData: testData }),
      showTaskTracker: (taskData) => set({ previewType: 'taskTracker', previewData: taskData }),
      updateTaskTracker: (taskId, updates) =>
        set((state) => {
          if (state.previewType !== 'taskTracker' || !state.previewData?.tasks) {
            return state;
          }

          // Normalize extension-format updates to webview format
          const normalized: any = { ...updates };

          // Map phase number → phase title string
          if (typeof updates.phase === 'number') {
            const phases = state.previewData.phases || [];
            const phaseTitle = phases.find((p: any) => p.number === updates.phase)?.title;
            normalized.phase = phaseTitle || String(updates.phase);
          }

          // Map instructions → acceptanceCriteria
          if (updates.instructions && !updates.acceptanceCriteria) {
            normalized.acceptanceCriteria = updates.instructions;
            delete normalized.instructions;
          }

          // Map retryCount → retries
          if (updates.retryCount !== undefined && updates.retries === undefined) {
            normalized.retries = updates.retryCount;
            delete normalized.retryCount;
          }

          // Map skipped → failed
          if (updates.status === 'skipped') {
            normalized.status = 'failed';
          }

          const tasks = state.previewData.tasks.map((t: any) =>
            t.id === taskId ? { ...t, ...normalized } : t
          );
          return {
            previewData: { ...state.previewData, tasks },
          };
        }),
      clearPreview: () => set({ previewType: 'empty', previewData: null }),

      // Max iterations actions
      showMaxIterationsWarning: (conversationId, message, context) =>
        set({
          maxIterationsWarning: {
            conversationId,
            message,
            context,
          },
        }),
      clearMaxIterationsWarning: () =>
        set({
          maxIterationsWarning: {
            conversationId: null,
            message: null,
            context: null,
          },
        }),

      // Settings actions
      openSettings: () => set({ showSettings: true }),
      closeSettings: () => set({ showSettings: false }),

      // Model selection actions
      setSelectedModel: (model) => {
        set({ selectedModel: model });
        // Persist to globalState via extension message (should persist across sessions)
        if (window.vscode) {
          window.vscode.postMessage({
            type: 'setSelectedModel',
            model,
          });
        }
      },
      updateConversationModel: (conversationId, model) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, model } : c
          ),
        })),

      // Thinking visibility actions
      setShowThinking: (show) => {
        set({ showThinking: show });
        // Persist to globalState via extension message (Requirement 49.5)
        if (window.vscode) {
          window.vscode.postMessage({
            type: 'setShowThinking',
            show,
          });
        }
      },
      toggleThinking: () => {
        const state = get();
        const newValue = !state.showThinking;
        set({ showThinking: newValue });
        // Persist to globalState via extension message (Requirement 49.5)
        if (window.vscode) {
          window.vscode.postMessage({
            type: 'setShowThinking',
            show: newValue,
          });
        }
      },

      // Autonomy level actions
      setAutonomyLevel: (level) => {
        set({ autonomyLevel: level });
        // Persist to globalState via extension message (Task 10.4)
        if (window.vscode) {
          window.vscode.postMessage({
            type: 'setAutonomyLevel',
            level,
          });
        }
      },
    }),
    {
      name: 'forgeai-conversations',
      storage: vscodeStorage,
    }
  )
);
