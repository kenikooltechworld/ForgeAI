/**
 * Task Tracker Panel — Phase 5.2
 * Shows spec task progress with run/pause/retry per task
 */

import { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Circle,
  ChevronDown,
  ChevronRight,
  Terminal,
  ListChecks,
  Lock,
} from 'lucide-react';

export type TaskStatus = 'pending' | 'in_progress' | 'running' | 'complete' | 'failed' | 'paused';
export type SubtaskStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface Subtask {
  id: string;
  description: string;
  category: 'backend' | 'frontend';
  status: SubtaskStatus;
  details?: string;
}

export interface ExecutableTask {
  id: string;
  phase: string;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  acceptanceCriteria: string[];
  subtasks?: Subtask[];
  output?: string;
  error?: string;
  durationMs?: number;
  retries: number;
}

interface TaskTrackerProps {
  tasks: ExecutableTask[];
  onRunTask: (taskId: string) => void;
  onPauseTask: (taskId: string) => void;
  onRetryTask: (taskId: string) => void;
  onRunAll: () => void;
  onRunPhase: (phase: string) => void;
}

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'complete':
      return <CheckCircle size={14} className="text-green-400" />;
    case 'failed':
      return <XCircle size={14} className="text-red-400" />;
    case 'running':
    case 'in_progress':
      return <Clock size={14} className="text-amber-400 animate-pulse" />;
    case 'paused':
      return <Pause size={14} className="text-purple-400" />;
    default:
      return <Circle size={14} className="text-(--vscode-descriptionForeground)" />;
  }
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const styles: Record<string, string> = {
    pending: 'bg-(--vscode-badge-background) text-(--vscode-badge-foreground)',
    running: 'bg-amber-500/20 text-amber-400',
    in_progress: 'bg-amber-500/20 text-amber-400',
    complete: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    paused: 'bg-purple-500/20 text-purple-400',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${styles[status]}`}>
      {status === 'in_progress' ? 'in progress' : status}
    </span>
  );
}

function SubtaskProgress({ subtasks }: { subtasks: Subtask[] }) {
  const backend = subtasks.filter((s) => s.category === 'backend');
  const frontend = subtasks.filter((s) => s.category === 'frontend');

  const backendComplete = backend.filter((s) => s.status === 'complete').length;
  const frontendComplete = frontend.filter((s) => s.status === 'complete').length;
  const backendPct = backend.length > 0 ? (backendComplete / backend.length) * 100 : 0;
  const frontendPct = frontend.length > 0 ? (frontendComplete / frontend.length) * 100 : 0;

  return (
    <div className="flex items-center gap-2 text-[10px]">
      {backend.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-(--vscode-textLink-foreground)">BE</span>
          <div className="w-12 h-1.5 bg-(--vscode-editor-inactiveSelectionBackground) rounded-full overflow-hidden">
            <div
              className="h-full bg-(--vscode-textLink-foreground) rounded-full transition-all"
              style={{ width: `${backendPct}%` }}
            />
          </div>
        </div>
      )}
      {frontend.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-green-400">FE</span>
          <div className="w-12 h-1.5 bg-(--vscode-editor-inactiveSelectionBackground) rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400 rounded-full transition-all"
              style={{ width: `${frontendPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SubtaskItem({ subtask }: { subtask: Subtask }) {
  const catColors = {
    backend: 'text-(--vscode-textLink-foreground)',
    frontend: 'text-green-400',
  };
  const statusIcons: Record<SubtaskStatus, React.ReactNode> = {
    pending: <Circle size={10} className="text-(--vscode-descriptionForeground)" />,
    running: <Clock size={10} className="text-amber-400 animate-pulse" />,
    complete: <CheckCircle size={10} className="text-green-400" />,
    failed: <XCircle size={10} className="text-red-400" />,
  };

  return (
    <div className="flex items-center gap-1.5 py-0.5">
      {statusIcons[subtask.status]}
      <span className={`text-[10px] font-medium uppercase ${catColors[subtask.category]}`}>
        {subtask.category}
      </span>
      <span className="text-xs text-(--vscode-editor-foreground)">{subtask.description}</span>
      {subtask.details && subtask.status === 'running' && (
        <span className="text-[10px] text-(--vscode-descriptionForeground) italic truncate max-w-[200px]">
          — {subtask.details}
        </span>
      )}
    </div>
  );
}

export default function TaskTracker({
  tasks,
  onRunTask,
  onPauseTask,
  onRetryTask,
  onRunAll,
  onRunPhase,
}: TaskTrackerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showOutput, setShowOutput] = useState<string | null>(null);

  const grouped = tasks.reduce(
    (acc, task) => {
      if (!acc[task.phase]) acc[task.phase] = [];
      acc[task.phase].push(task);
      return acc;
    },
    {} as Record<string, ExecutableTask[]>
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const completed = tasks.filter((t) => t.status === 'complete').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const running = tasks.filter((t) => t.status === 'running').length;
  const progress = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;

  // Determine which tasks are locked based on sequential completion
  const firstPendingIndex = tasks.findIndex((t) => t.status !== 'complete');
  const isTaskLocked = (taskId: string): boolean => {
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx <= 0) return false; // First task is always unlocked
    // A task is locked if any task before it is not complete
    return tasks.slice(0, idx).some((t) => t.status !== 'complete');
  };

  // Derive phase order from first occurrence of each phase in the task list
  const phaseFirstIndex = new Map<string, number>();
  tasks.forEach((task, idx) => {
    if (!phaseFirstIndex.has(task.phase)) {
      phaseFirstIndex.set(task.phase, idx);
    }
  });
  const allPhases = Object.keys(grouped).sort(
    (a, b) => (phaseFirstIndex.get(a) ?? 0) - (phaseFirstIndex.get(b) ?? 0)
  );

  return (
    <div className="h-full flex flex-col bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-(--vscode-panel-border)">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks size={16} className="text-(--vscode-symbolIcon-colorForeground)" />
            <h2 className="text-sm font-semibold">Task Tracker</h2>
          </div>
          <button
            onClick={onRunAll}
            disabled={firstPendingIndex > 0}
            title={
              firstPendingIndex > 0
                ? 'Complete previous tasks first to unlock'
                : 'Run all tasks sequentially'
            }
            className={`text-xs px-3 py-1.5 rounded flex items-center gap-1 ${
              firstPendingIndex > 0
                ? 'opacity-50 cursor-not-allowed bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground)'
                : 'bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)'
            }`}
          >
            <Play size={12} /> Run All
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mt-2 text-[10px] text-(--vscode-descriptionForeground)">
          <span className="flex items-center gap-1">
            <CheckCircle size={10} className="text-green-400" /> {completed}
          </span>
          <span className="flex items-center gap-1">
            <XCircle size={10} className="text-red-400" /> {failed}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} className="text-amber-400" /> {running}
          </span>
          <span className="flex items-center gap-1">
            <Circle size={10} /> {tasks.length - completed - failed - running}
          </span>
        </div>

        {/* Progress */}
        <div className="mt-2">
          <div className="h-1.5 bg-(--vscode-editor-inactiveSelectionBackground) rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {allPhases.map((phase) => {
          const phaseTasks = grouped[phase];
          const phaseComplete = phaseTasks.filter((t) => t.status === 'complete').length;
          const phaseHasLocked = phaseTasks.some((t) => isTaskLocked(t.id));
          return (
            <div key={phase} className="mb-3">
              <div className="flex items-center justify-between px-2 py-1">
                <h3 className="text-xs font-semibold text-(--vscode-descriptionForeground) uppercase tracking-wide">
                  {phase}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-(--vscode-descriptionForeground)">
                    {phaseComplete}/{phaseTasks.length}
                  </span>
                  <button
                    onClick={() => onRunPhase(phase)}
                    disabled={phaseHasLocked}
                    className={`p-0.5 rounded ${
                      phaseHasLocked
                        ? 'opacity-30 cursor-not-allowed'
                        : 'hover:bg-(--vscode-toolbar-hoverBackground)'
                    }`}
                    title={phaseHasLocked ? 'Complete previous tasks first' : `Run ${phase}`}
                  >
                    <Play size={10} />
                  </button>
                </div>
              </div>
              {phaseTasks.map((task) => (
                <div
                  key={task.id}
                  className={`rounded border border-(--vscode-panel-border) mb-1 overflow-hidden ${
                    isTaskLocked(task.id) && task.status === 'pending' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button onClick={() => toggle(task.id)} className="shrink-0">
                      {expanded.has(task.id) ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </button>
                    <StatusIcon status={task.status} />
                    <span className="text-xs flex-1 truncate">{task.description}</span>
                    {task.subtasks && task.subtasks.length > 0 && (
                      <SubtaskProgress subtasks={task.subtasks} />
                    )}
                    <StatusBadge status={task.status} />
                    {task.retries > 0 && (
                      <span className="text-[10px] text-(--vscode-descriptionForeground)">
                        {task.retries} retry{task.retries > 1 ? 'ies' : ''}
                      </span>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-1 items-center">
                      {isTaskLocked(task.id) && task.status === 'pending' && (
                        <span title="Locked: complete previous tasks first">
                          <Lock size={12} className="text-(--vscode-descriptionForeground)" />
                        </span>
                      )}
                      {task.status === 'pending' && !isTaskLocked(task.id) && (
                        <button
                          onClick={() => onRunTask(task.id)}
                          className="p-1 rounded hover:bg-(--vscode-toolbar-hoverBackground)"
                          title="Run"
                        >
                          <Play size={12} />
                        </button>
                      )}
                      {task.status === 'running' && (
                        <button
                          onClick={() => onPauseTask(task.id)}
                          className="p-1 rounded hover:bg-(--vscode-toolbar-hoverBackground)"
                          title="Pause"
                        >
                          <Pause size={12} />
                        </button>
                      )}
                      {task.status === 'failed' && (
                        <button
                          onClick={() => onRetryTask(task.id)}
                          className="p-1 rounded hover:bg-(--vscode-toolbar-hoverBackground)"
                          title="Retry"
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {expanded.has(task.id) && (
                    <div className="px-3 pb-3 border-t border-(--vscode-panel-border) bg-(--vscode-editor-inactiveSelectionBackground)/30">
                      {/* Acceptance Criteria */}
                      <div className="mt-2">
                        <h4 className="text-[10px] font-semibold uppercase text-(--vscode-descriptionForeground) mb-1">
                          Acceptance Criteria
                        </h4>
                        <ul className="space-y-0.5">
                          {task.acceptanceCriteria.map((c, i) => (
                            <li
                              key={i}
                              className="text-xs text-(--vscode-editor-foreground) flex items-start gap-1"
                            >
                              <CheckCircle size={10} className="shrink-0 mt-0.5 text-green-400" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Dependencies */}
                      {task.dependencies.length > 0 && (
                        <div className="mt-2">
                          <h4 className="text-[10px] font-semibold uppercase text-(--vscode-descriptionForeground) mb-1">
                            Dependencies
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {task.dependencies.map((dep) => (
                              <span
                                key={dep}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-(--vscode-badge-background) text-(--vscode-badge-foreground)"
                              >
                                {dep}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Subtasks */}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="mt-2">
                          <h4 className="text-[10px] font-semibold uppercase text-(--vscode-descriptionForeground) mb-1">
                            Subtasks
                          </h4>
                          <div className="space-y-0">
                            {task.subtasks.map((st) => (
                              <SubtaskItem key={st.id} subtask={st} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Output / Error toggle */}
                      {(task.output || task.error) && (
                        <button
                          onClick={() => setShowOutput(showOutput === task.id ? null : task.id)}
                          className="mt-2 text-[10px] flex items-center gap-1 text-(--vscode-textLink-foreground) hover:underline"
                        >
                          <Terminal size={10} />
                          {showOutput === task.id ? 'Hide' : 'View'} Output
                        </button>
                      )}

                      {showOutput === task.id && (
                        <pre className="mt-1 p-2 rounded bg-(--vscode-terminal-background) text-(--vscode-terminal-foreground) text-[10px] overflow-auto max-h-32 font-mono">
                          {task.error || task.output}
                        </pre>
                      )}

                      {task.durationMs && (
                        <div className="mt-1 text-[10px] text-(--vscode-descriptionForeground)">
                          Duration: {(task.durationMs / 1000).toFixed(1)}s
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
