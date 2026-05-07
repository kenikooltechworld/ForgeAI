import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { MessageSquare } from 'lucide-react';
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen';
import SplitScreen from './components/SplitScreen/SplitScreen';
import { useVSCodeMessage } from './hooks/useVSCodeMessage';
import { useConversationStore } from './store/conversationStore';

// Lazy load Settings panel for code splitting
const Settings = lazy(() => import('./components/Settings/Settings'));

type SettingsPayload = { showThinking: boolean };
type OnboardingStatePayload = {
  hasSeenThinkingTooltip: boolean;
  hasSeenToolTooltip: boolean;
  hasSeenCodeChangeTooltip: boolean;
  hasSeenWelcomeScreen?: boolean; // Track if user has seen welcome screen
};

function App() {
  console.log('[ForgeAI] App component mounting');
  const [showThinking, setShowThinking] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);

  // Get conversations from store to determine which view to show
  const conversations = useConversationStore((state) => state.conversations);
  const loadOnboardingState = useConversationStore((state) => state.loadOnboardingState);
  const createTab = useConversationStore((state) => state.createTab);
  const setLanguage = useConversationStore((state) => state.setLanguage);
  const showSettings = useConversationStore((state) => state.showSettings);
  const closeSettings = useConversationStore((state) => state.closeSettings);
  const toggleThinking = useConversationStore((state) => state.toggleThinking);
  const setSelectedModel = useConversationStore((state) => state.setSelectedModel);
  const setAutonomyLevel = useConversationStore((state) => state.setAutonomyLevel);

  // Get preview actions from store
  const showDiff = useConversationStore((state) => state.showDiff);
  const showFile = useConversationStore((state) => state.showFile);
  const showTerminal = useConversationStore((state) => state.showTerminal);
  const showTest = useConversationStore((state) => state.showTest);
  const addMessage = useConversationStore((state) => state.addMessage);
  const updateMessage = useConversationStore((state) => state.updateMessage);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const showMaxIterationsWarning = useConversationStore((state) => state.showMaxIterationsWarning);

  // Keyboard shortcut handler (Requirement 49.4)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+/ (Mac) or Ctrl+/ (Windows/Linux) to toggle thinking visibility
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        toggleThinking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleThinking]);

  useEffect(() => {
    console.log('[ForgeAI] App useEffect - requesting settings and onboarding state');
    window.vscode?.postMessage({ type: 'getSettings' });
    window.vscode?.postMessage({ type: 'getOnboardingState' });

    // Load language preference from VS Code settings
    window.vscode?.postMessage({ type: 'getLanguage' });

    // Load selected model from globalState
    window.vscode?.postMessage({ type: 'getSelectedModel' });

    // Load autonomy level from globalState
    window.vscode?.postMessage({ type: 'getAutonomyLevel' });
  }, []);

  // Wrap message handler in useCallback to prevent infinite re-renders
  const handleMessage = useCallback(
    (message: any) => {
      console.log('[ForgeAI] Received message:', message);
      if (message.type === 'settings') {
        const payload = message.payload as SettingsPayload;
        console.log('[ForgeAI] Settings received:', payload);
        setShowThinking(payload.showThinking);
        setIsReady(true);
      } else if (message.type === 'onboardingState') {
        const payload = message.payload as OnboardingStatePayload;
        console.log('[ForgeAI] Onboarding state received:', payload);
        loadOnboardingState(payload);
        // Check if user has seen welcome screen (stored in global state)
        setHasSeenWelcome(payload.hasSeenWelcomeScreen || false);
      } else if (message.type === 'language') {
        console.log('[ForgeAI] Language setting received:', message.language);
        setLanguage(message.language || 'English');
      } else if (message.type === 'selectedModel') {
        console.log('[ForgeAI] Selected model received:', message.model);
        if (message.model) {
          setSelectedModel(message.model);
        }
      } else if (message.type === 'autonomyLevel') {
        console.log('[ForgeAI] Autonomy level received:', message.level);
        if (message.level) {
          setAutonomyLevel(message.level);
        }
      } else if (message.type === 'showDiff') {
        console.log('[ForgeAI] Show diff message received:', message.data);
        showDiff(message.data);
      } else if (message.type === 'showFile') {
        console.log('[ForgeAI] Show file message received:', message.data);
        showFile(message.data);
      } else if (message.type === 'showTerminalOutput') {
        console.log('[ForgeAI] Show terminal output message received:', message.data);
        showTerminal(message.data);
      } else if (message.type === 'showTestResults') {
        console.log('[ForgeAI] Show test results message received:', message.data);
        showTest(message.data);
      } else if (message.type === 'toolExecutionStart') {
        console.log('[ForgeAI] Tool execution start:', message.data);
        if (activeConversationId) {
          const toolMessage: any = {
            id: message.data.messageId || crypto.randomUUID(),
            role: 'tool',
            content: '',
            timestamp: Date.now(),
            toolExecution: {
              toolName: message.data.toolName,
              target: message.data.target,
              status: 'Running',
              arguments: message.data.arguments,
            },
          };
          addMessage(activeConversationId, toolMessage);
        }
      } else if (message.type === 'toolExecutionComplete') {
        console.log('[ForgeAI] Tool execution complete:', message.data);
        if (activeConversationId) {
          updateMessage(activeConversationId, message.data.messageId, {
            toolExecution: {
              toolName: message.data.toolName,
              target: message.data.target,
              status: 'Complete',
              duration: message.data.duration,
              result: message.data.result,
              arguments: message.data.arguments,
            },
          });
        }
      } else if (message.type === 'toolExecutionError') {
        console.log('[ForgeAI] Tool execution error:', message.data);
        if (activeConversationId) {
          updateMessage(activeConversationId, message.data.messageId, {
            toolExecution: {
              toolName: message.data.toolName,
              target: message.data.target,
              status: 'Error',
              duration: message.data.duration,
              error: message.data.error,
              arguments: message.data.arguments,
            },
          });
        }
      } else if (message.type === 'maxIterationsWarning') {
        console.log('[ForgeAI] Max iterations warning:', message.data);
        showMaxIterationsWarning(
          message.conversationId,
          message.data.message,
          message.data.context
        );
      }
    },
    [
      loadOnboardingState,
      setLanguage,
      setSelectedModel,
      setAutonomyLevel,
      showDiff,
      showFile,
      showTerminal,
      showTest,
      addMessage,
      updateMessage,
      activeConversationId,
      showMaxIterationsWarning,
    ]
  );

  useVSCodeMessage(handleMessage);

  // Mark welcome screen as seen when user interacts
  const markWelcomeAsSeen = useCallback(() => {
    setHasSeenWelcome(true);
    // Persist to global state
    window.vscode?.postMessage({
      type: 'setOnboardingState',
      payload: { hasSeenWelcomeScreen: true },
    });
  }, []);

  console.log(
    '[ForgeAI] App render - isReady:',
    isReady,
    'conversations:',
    conversations.length,
    'hasSeenWelcome:',
    hasSeenWelcome
  );

  if (!isReady) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
        <div className="text-center text-sm text-(--vscode-descriptionForeground)">
          Loading ForgeAI...
        </div>
      </div>
    );
  }

  const hasConversations = conversations.length > 0;

  // Show WelcomeScreen ONLY on first launch (hasSeenWelcome === false)
  if (!hasSeenWelcome && !hasConversations) {
    return (
      <div className="h-full bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
        <WelcomeScreen showThinking={showThinking} onFirstInteraction={markWelcomeAsSeen} />
      </div>
    );
  }

  // Show Empty State when no conversations (but user has seen welcome before)
  if (!hasConversations) {
    return (
      <div className="h-full bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
        <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
          <MessageSquare size={64} style={{ color: 'var(--vscode-descriptionForeground)' }} />
          <div className="text-center">
            <h2 className="text-lg font-semibold text-(--vscode-editor-foreground)">
              Start a conversation with ForgeAI
            </h2>
            <p className="mt-2 text-sm text-(--vscode-descriptionForeground)">Try asking:</p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-(--vscode-descriptionForeground)">
            <div>• "Fix the authentication bug in login.ts"</div>
            <div>• "Add a user dashboard with charts"</div>
            <div>• "Explain how the payment flow works"</div>
            <div>• "Generate unit tests for UserService"</div>
            <div>• "Review my last commit for issues"</div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => createTab('New Conversation')}
              className="rounded bg-(--vscode-button-background) px-4 py-2 text-sm text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
            >
              Start New Conversation
            </button>
          </div>
          <div className="text-xs text-(--vscode-descriptionForeground)">
            Or use Cmd+K to open command palette
          </div>
        </div>
      </div>
    );
  }

  // Show SplitScreen with ActivityStream (left) and LivePreview (right)
  return (
    <div className="h-full bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
      <SplitScreen />

      {/* Settings Panel - Lazy loaded */}
      {showSettings && (
        <Suspense fallback={<div className="settings-loading">Loading settings...</div>}>
          <Settings onClose={closeSettings} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
