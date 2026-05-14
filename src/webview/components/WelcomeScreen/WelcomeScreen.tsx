import { useEffect } from 'react';
import { Bug, Sparkles, BookOpen, TestTube, Search, FileText, ClipboardList } from 'lucide-react';
import { useConversationStore } from '../../store/conversationStore';
import MessageInput from '../ActivityStream/MessageInput';

const quickActions = [
  {
    Icon: Bug,
    title: 'Fix a bug',
    description: 'Help me fix a bug in my code',
    prompt:
      "I'll help you fix a bug. Can you describe the issue, or should I analyze recent error logs and test failures?",
  },
  {
    Icon: Sparkles,
    title: 'Build a feature',
    description: 'Create a new feature from requirements',
    prompt: "I'll help you build a feature. What would you like to create?",
  },
  {
    Icon: ClipboardList,
    title: 'Generate spec',
    description: 'Create formal requirements and task plan',
    prompt:
      "I'll create a formal spec with requirements, architecture, and tasks. What feature or system should we spec out?",
  },
  {
    Icon: BookOpen,
    title: 'Explain code',
    description: 'Understand what a function or file does',
    prompt: "I'll explain code for you. Which file or function should I explain?",
  },
  {
    Icon: TestTube,
    title: 'Generate tests',
    description: 'Create test cases for your code',
    prompt: "I'll generate tests. Which file or component needs test coverage?",
  },
  {
    Icon: Search,
    title: 'Review changes',
    description: 'Analyze recent modifications and give feedback',
    prompt:
      "I'll review your changes. Should I analyze your last commit or current working changes?",
  },
  {
    Icon: FileText,
    title: 'Write docs',
    description: 'Generate documentation for your code',
    prompt: "I'll help write documentation. Which code needs documentation?",
  },
];

interface WelcomeScreenProps {
  showThinking: boolean;
  onFirstInteraction: () => void; // Callback when user first interacts
}

function WelcomeScreen({ showThinking, onFirstInteraction }: WelcomeScreenProps) {
  const createTab = useConversationStore((state) => state.createTab);
  const addMessage = useConversationStore((state) => state.addMessage);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const openSettings = useConversationStore((state) => state.openSettings);

  // Create an empty tab with conversation when welcome screen loads (only once)
  useEffect(() => {
    if (!activeConversationId) {
      createTab('New Conversation');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const handleQuickAction = (title: string, prompt: string) => {
    // Mark welcome as seen on first interaction
    onFirstInteraction();

    if (activeConversationId) {
      // Add the AI's prompt as the first message
      addMessage(activeConversationId, {
        id: `message-${Date.now()}`,
        role: 'assistant',
        content: prompt,
        timestamp: Date.now(),
      });
    }
  };

  const handleMessageSent = () => {
    // Mark welcome as seen when user sends first message
    onFirstInteraction();
  };

  return (
    <div className="flex min-h-full flex-col gap-6 p-6 bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
      <header className="space-y-4 text-center">
        <div className="text-lg font-semibold">Welcome to ForgeAI</div>
        <p className="text-sm text-(--vscode-descriptionForeground)">
          Your autonomous AI coding assistant
        </p>
      </header>

      <section className="rounded border border-(--vscode-input-border) bg-(--vscode-sideBar-background) p-4">
        <div className="text-sm font-semibold text-(--vscode-editor-foreground)">
          Connected to GPT-OSS-120B (Cloud)
        </div>
        <div className="mt-1 text-xs text-(--vscode-descriptionForeground)">
          Fast, intelligent, and ready to help
        </div>
      </section>

      <section className="rounded border border-(--vscode-input-border) bg-(--vscode-sideBar-background) p-4">
        <div className="mb-3 text-sm font-semibold text-(--vscode-editor-foreground)">
          What would you like to do?
        </div>
        <div className="grid gap-3 grid-cols-2">
          {quickActions.map((action) => {
            const { Icon } = action;
            return (
              <button
                key={action.title}
                type="button"
                onClick={() => handleQuickAction(action.title, action.prompt)}
                className="flex items-center gap-2 rounded border border-(--vscode-input-border) bg-(--vscode-panel-background) px-4 py-3 text-left text-sm font-semibold text-(--vscode-editor-foreground) transition hover:bg-(--vscode-list-hoverBackground)"
              >
                <Icon size={20} style={{ color: 'var(--vscode-editor-foreground)' }} />
                {action.title}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 text-sm text-(--vscode-descriptionForeground)">
          Or just start typing below...
        </div>
        <div onClick={handleMessageSent}>
          <MessageInput conversationId={activeConversationId || undefined} />
        </div>
      </section>

      <footer className="flex flex-col gap-3 text-sm text-(--vscode-descriptionForeground)">
        <div>Tip: Use Cmd+K anywhere to open the command palette</div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="text-sm text-(--vscode-textLink-foreground) hover:text-(--vscode-textLink-activeForeground)"
          >
            [View Documentation]
          </button>
          <button
            type="button"
            onClick={openSettings}
            className="text-sm text-(--vscode-textLink-foreground) hover:text-(--vscode-textLink-activeForeground)"
          >
            [Settings]
          </button>
        </div>
      </footer>
    </div>
  );
}

export default WelcomeScreen;
