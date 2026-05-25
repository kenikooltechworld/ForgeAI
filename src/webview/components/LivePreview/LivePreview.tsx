import { useState, useEffect, lazy, Suspense } from 'react';
import { FileText, TestTube, File, Terminal, Search, ListChecks } from 'lucide-react';
import FilePreview from './FilePreview';
import CodeDiff from './CodeDiff';
import TerminalOutput from './TerminalOutput';
import TestResults, { TestResultsData } from './TestResults';
import DiagnosticsView, { DiagnosticsData } from './DiagnosticsView';
import { useConversationStore } from '../../store/conversationStore';

// Lazy load TaskTracker for code splitting
const TaskTracker = lazy(() => import('../TaskTracker/TaskTracker'));

type PreviewType = 'diff' | 'test' | 'file' | 'terminal' | 'diagnostics' | 'taskTracker' | 'empty';

interface LivePreviewProps {
  type?: PreviewType;
  data?: any;
}

/**
 * LivePreview - Right panel component for displaying code changes, test results, and file previews
 *
 * Features:
 * - Empty state with icon and message
 * - Code diff view (future)
 * - Test results view (future)
 * - File preview view (future)
 * - Tab switching between views
 * - VS Code theme integration
 *
 * Requirements: 13.4, 21.1, 21.2
 */

/**
 * TaskTrackerWrapper - Wraps TaskTracker with conversation store integration
 * Creates new chat tabs when user clicks Run Task or Run All
 */
interface PhaseInfo {
  number: number;
  title: string;
}

function normalizeTask(task: any, phases: PhaseInfo[]): any {
  const phaseTitle = phases.find((p) => p.number === task.phase)?.title || String(task.phase);
  const statusMap: Record<string, string> = {
    pending: 'pending',
    in_progress: 'in_progress',
    complete: 'complete',
    failed: 'failed',
    skipped: 'failed',
  };
  return {
    id: task.id,
    phase: phaseTitle,
    description: task.description,
    status: statusMap[task.status] || task.status,
    dependencies: task.dependencies || [],
    acceptanceCriteria: task.instructions || task.acceptanceCriteria || [],
    subtasks: task.subTasks || task.subtasks,
    output: task.output,
    error: task.error,
    durationMs:
      task.durationMs || task.completedAt
        ? (task.completedAt || Date.now()) - (task.startedAt || Date.now())
        : undefined,
    retries: task.retryCount ?? task.retries ?? 0,
  };
}

function TaskTrackerWrapper({
  tasks,
  phases,
  specId,
}: {
  tasks: any[];
  phases: PhaseInfo[];
  specId: string;
}) {
  const normalizedTasks = tasks.map((t) => normalizeTask(t, phases));

  const createTab = useConversationStore((state) => state.createTab);
  const addMessage = useConversationStore((state) => state.addMessage);

  const sendTaskToChat = (taskId: string, title: string, prompt: string) => {
    const conversationId = createTab(title);
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: prompt,
      timestamp: Date.now(),
    };
    addMessage(conversationId, userMessage);

    // Send to extension host with task execution metadata
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'sendMessage',
        conversationId,
        content: prompt,
        conversationHistory: [],
        model: 'gpt-oss:120b-cloud',
        isTaskExecution: true,
        specId,
        taskId,
      });
    }
  };

  const handleRunTask = (taskId: string) => {
    const task = normalizedTasks.find((t) => t.id === taskId);
    if (!task) return;

    const prompt = `Execute Task ${task.id}: ${task.description}

Follow the sequential TDD workflow:
1. Write tests FIRST for this task
2. Implement the minimum code to pass tests
3. Run ALL validation: tests (100% pass), TypeScript (zero errors), lint (zero errors)
4. Mark task complete ONLY at 100%
5. Then proceed to the next task if applicable

Task Details:
- Phase: ${task.phase}
- Description: ${task.description}
- Acceptance Criteria: ${task.acceptanceCriteria?.join('\n') || 'N/A'}
- Dependencies: ${task.dependencies?.join(', ') || 'None'}

Execute this task now. Show your work at every step.`;

    sendTaskToChat(taskId, `Task ${task.id}`, prompt);
  };

  const handleRunAll = () => {
    const pendingTasks = normalizedTasks.filter((t) => t.status !== 'complete');
    if (pendingTasks.length === 0) return;

    const prompt = `Execute ALL remaining tasks sequentially from spec ${specId}.

Follow the strict sequential TDD workflow for EACH task:
1. Write tests FIRST
2. Implement minimum code
3. Validate: tests (100%), TypeScript (zero errors), lint (zero errors)
4. Mark task complete at 100%
5. ONLY then move to next task

Tasks to execute:
${pendingTasks.map((t) => `- [ ] ${t.id}: ${t.description}`).join('\n')}

Start with the first pending task. Show your work at every step.`;

    sendTaskToChat('all', 'Run All Tasks', prompt);
  };

  return (
    <TaskTracker
      tasks={normalizedTasks}
      onRunTask={handleRunTask}
      onPauseTask={(taskId) => {
        window.vscode?.postMessage({ type: 'pauseTask', taskId });
      }}
      onRetryTask={handleRunTask}
      onRunAll={handleRunAll}
      onRunPhase={(phase) => {
        const phaseTasks = normalizedTasks.filter(
          (t) => t.phase === phase && t.status !== 'complete'
        );
        const prompt = `Execute all pending tasks in Phase: ${phase}

${phaseTasks.map((t) => `- [ ] ${t.id}: ${t.description}`).join('\n')}

Follow sequential TDD: tests first, then implement, validate at 100%, mark complete, then next task.`;
        sendTaskToChat(`phase-${phase}`, `Phase ${phase}`, prompt);
      }}
    />
  );
}

export function LivePreview({ type = 'empty', data }: LivePreviewProps) {
  const [activeView, setActiveView] = useState<PreviewType>(type);

  // CRITICAL FIX: Update activeView when type prop changes
  // This ensures the preview panel updates when new content arrives from the extension
  useEffect(() => {
    if (type !== activeView) {
      console.log('[LivePreview] Type changed from', activeView, 'to', type);
      setActiveView(type);
    }
  }, [type]);

  const renderContent = () => {
    switch (activeView) {
      case 'diff':
        // CodeDiff component (Task 5.1)
        if (data && data.file && data.lines) {
          return (
            <CodeDiff
              diff={data}
              onApply={data.onApply}
              onReject={data.onReject}
              onOpenInEditor={data.onOpenInEditor}
            />
          );
        }
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <FileText
              size={64}
              style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '1rem' }}
            />
            <div className="text-lg">Code Diff</div>
            <div className="text-sm">No diff data available</div>
          </div>
        );
      case 'test':
        // TestResults component (Task 9.1)
        if (data && data.files) {
          return <TestResults results={data as TestResultsData} onRunAgain={data.onRunAgain} />;
        }
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <TestTube
              size={64}
              style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '1rem' }}
            />
            <div className="text-lg">Test Results</div>
            <div className="text-sm">No test data available</div>
          </div>
        );
      case 'file':
        // FilePreview component (Task 4.6)
        if (data && data.filePath && data.content) {
          return <FilePreview {...data} />;
        }
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <File
              size={64}
              style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '1rem' }}
            />
            <div className="text-lg">File Preview</div>
            <div className="text-sm">No file data available</div>
          </div>
        );
      case 'terminal':
        // TerminalOutput component (Task 4.9)
        if (data && data.command) {
          return <TerminalOutput {...data} />;
        }
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <Terminal
              size={64}
              style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '1rem' }}
            />
            <div className="text-lg">Terminal Output</div>
            <div className="text-sm">No terminal output available</div>
          </div>
        );
      case 'diagnostics':
        // DiagnosticsView component (Task 12.2)
        if (data && typeof data.total === 'number') {
          return <DiagnosticsView diagnostics={data as DiagnosticsData} />;
        }
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <Search
              size={64}
              style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '1rem' }}
            />
            <div className="text-lg">Diagnostics</div>
            <div className="text-sm">No diagnostics data available</div>
          </div>
        );
      case 'taskTracker':
        return (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-muted">
                <div className="text-sm text-(--vscode-descriptionForeground)">
                  Loading Task Tracker...
                </div>
              </div>
            }
          >
            <TaskTrackerWrapper
              tasks={data?.tasks || []}
              phases={data?.phases || []}
              specId={data?.specId || data?.id || ''}
            />
          </Suspense>
        );
      case 'empty':
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <File
              size={64}
              style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '1rem' }}
            />
            <div className="text-lg">Code changes and previews</div>
            <div className="text-sm">will appear here</div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-editor">
      {activeView !== 'empty' && (
        <div
          className="flex items-center justify-between p-2 border-b border-input"
          style={{ flexShrink: 0 }}
        >
          <div className="flex gap-1" style={{ flexWrap: 'wrap', maxWidth: 'calc(100% - 40px)' }}>
            <button
              onClick={() => setActiveView('diff')}
              className={
                activeView === 'diff'
                  ? 'px-2 py-1 rounded text-xs bg-button text-button'
                  : 'px-2 py-1 rounded text-xs hover:opacity-80'
              }
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Code Diff
            </button>
            <button
              onClick={() => setActiveView('test')}
              className={
                activeView === 'test'
                  ? 'px-2 py-1 rounded text-xs bg-button text-button'
                  : 'px-2 py-1 rounded text-xs hover:opacity-80'
              }
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Test Results
            </button>
            <button
              onClick={() => setActiveView('file')}
              className={
                activeView === 'file'
                  ? 'px-2 py-1 rounded text-xs bg-button text-button'
                  : 'px-2 py-1 rounded text-xs hover:opacity-80'
              }
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              File Preview
            </button>
            <button
              onClick={() => setActiveView('terminal')}
              className={
                activeView === 'terminal'
                  ? 'px-2 py-1 rounded text-xs bg-button text-button'
                  : 'px-2 py-1 rounded text-xs hover:opacity-80'
              }
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Terminal
            </button>
            <button
              onClick={() => setActiveView('diagnostics')}
              className={
                activeView === 'diagnostics'
                  ? 'px-2 py-1 rounded text-xs bg-button text-button'
                  : 'px-2 py-1 rounded text-xs hover:opacity-80'
              }
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Diagnostics
            </button>
            <button
              onClick={() => setActiveView('taskTracker')}
              className={
                activeView === 'taskTracker'
                  ? 'px-2 py-1 rounded text-xs bg-button text-button'
                  : 'px-2 py-1 rounded text-xs hover:opacity-80'
              }
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Tasks
            </button>
          </div>

          <button
            onClick={() => setActiveView('empty')}
            className="p-1 hover:opacity-80 rounded text-lg"
            aria-label="Close preview"
            style={{ flexShrink: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {renderContent()}
      </div>
    </div>
  );
}

export default LivePreview;
