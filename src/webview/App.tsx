import {
  useEffect,
  useState,
  useCallback,
  lazy,
  Suspense,
  Component,
  ErrorInfo,
  ReactNode,
} from 'react';
import { MessageSquare } from 'lucide-react';
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen';
import SplitScreen from './components/SplitScreen/SplitScreen';
import { useVSCodeMessage } from './hooks/useVSCodeMessage';
import { useConversationStore } from './store/conversationStore';
import { StorageQuotaError } from './components/StorageQuotaError';

// Lazy load Settings panel for code splitting
const Settings = lazy(() => import('./components/Settings/Settings'));

// Error Boundary for Settings component
class SettingsErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ForgeAI] Settings component error:', error, errorInfo);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-(--vscode-editor-background) p-6 rounded border border-(--vscode-input-border) max-w-md">
            <h2 className="text-lg font-semibold mb-2 text-(--vscode-editor-foreground)">
              Settings Error
            </h2>
            <p className="text-sm text-(--vscode-descriptionForeground) mb-4">
              Failed to load settings. Please try again.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onError();
              }}
              className="px-4 py-2 rounded bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type SettingsPayload = { showThinking: boolean };
type OnboardingStatePayload = {
  hasSeenThinkingTooltip: boolean;
  hasSeenToolTooltip: boolean;
  hasSeenCodeChangeTooltip: boolean;
  hasSeenWelcomeScreen?: boolean; // Track if user has seen welcome screen
};

function App() {
  const [showThinking, setShowThinking] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);
  const [showStorageQuotaError, setShowStorageQuotaError] = useState(false);

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
  const showTaskTracker = useConversationStore((state) => state.showTaskTracker);
  const updateTaskTracker = useConversationStore((state) => state.updateTaskTracker);
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

  // Storage quota error handler (Task 15.2)
  useEffect(() => {
    const handleStorageQuotaExceeded = () => {
      setShowStorageQuotaError(true);
    };

    window.addEventListener('storageQuotaExceeded', handleStorageQuotaExceeded);
    return () => window.removeEventListener('storageQuotaExceeded', handleStorageQuotaExceeded);
  }, []);

  useEffect(() => {
    window.vscode?.postMessage({ type: 'getSettings' });
    window.vscode?.postMessage({ type: 'getOnboardingState' });
    window.vscode?.postMessage({ type: 'getLanguage' });
    window.vscode?.postMessage({ type: 'getSelectedModel' });
    window.vscode?.postMessage({ type: 'getAutonomyLevel' });
  }, []);

  // Wrap message handler in useCallback to prevent infinite re-renders
  const handleMessage = useCallback(
    (message: any) => {
      if (message.type === 'settings') {
        const payload = message.payload as SettingsPayload;
        setShowThinking(payload.showThinking);
        setIsReady(true);
      } else if (message.type === 'onboardingState') {
        const payload = message.payload as OnboardingStatePayload;
        loadOnboardingState(payload);
        setHasSeenWelcome(payload.hasSeenWelcomeScreen || false);
      } else if (message.type === 'language') {
        setLanguage(message.language || 'English');
      } else if (message.type === 'selectedModel') {
        if (message.model) {
          setSelectedModel(message.model);
        }
      } else if (message.type === 'autonomyLevel') {
        if (message.level) {
          setAutonomyLevel(message.level);
        }
      } else if (message.type === 'storageQuotaExceeded') {
        setShowStorageQuotaError(true);
      } else if (message.type === 'themeChanged') {
        setIsReady(false);
        setTimeout(() => setIsReady(true), 0);
      } else if (message.type === 'showDiff') {
        showDiff(message.data);
      } else if (message.type === 'showFile') {
        showFile(message.data);
      } else if (message.type === 'showTerminalOutput') {
        showTerminal(message.data);
      } else if (message.type === 'showTestResults') {
        showTest(message.data);
      } else if (message.type === 'openTaskTracker') {
        showTaskTracker(message.spec || { tasks: [] });
      } else if (message.type === 'loadSpec') {
        showTaskTracker(message.spec || { tasks: [] });
      } else if (message.type === 'updateTask') {
        if (message.task?.id) {
          updateTaskTracker(message.task.id, message.task);
        }
      } else if (message.type === 'toolExecutionStart') {
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
      showTaskTracker,
      updateTaskTracker,
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

      {/* Settings Panel - Lazy loaded with error boundary */}
      {showSettings && (
        <SettingsErrorBoundary onError={closeSettings}>
          <Suspense
            fallback={
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="text-(--vscode-editor-foreground)">Loading settings...</div>
              </div>
            }
          >
            <Settings onClose={closeSettings} />
          </Suspense>
        </SettingsErrorBoundary>
      )}

      {/* Storage Quota Error Dialog (Task 15.2) */}
      {showStorageQuotaError && (
        <StorageQuotaError onClose={() => setShowStorageQuotaError(false)} />
      )}
    </div>
  );
}

export default App;
