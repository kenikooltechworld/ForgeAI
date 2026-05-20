import { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  Check,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react';

interface SpecInfo {
  id: string;
  title: string;
  path: string;
}

interface WorkspaceStatusState {
  initialized: boolean;
  specs: SpecInfo[];
  memoryCount: number;
  productExists: boolean;
  hooksExist: boolean;
  loading: boolean;
}

const DIRECTORIES = [
  {
    name: 'memory',
    label: 'Memory',
    description: 'Research findings & preferences',
    key: 'memoryCount' as const,
  },
  {
    name: 'product',
    label: 'Product',
    description: 'Project overview & roadmap',
    key: 'productExists' as const,
  },
  { name: 'spec', label: 'Spec', description: 'Kiro-style spec artifacts', key: 'specs' as const },
  {
    name: 'hooks',
    label: 'Hooks',
    description: 'Event-driven automation',
    key: 'hooksExist' as const,
  },
];

function WorkspaceStatus() {
  const [status, setStatus] = useState<WorkspaceStatusState>({
    initialized: false,
    specs: [],
    memoryCount: 0,
    productExists: false,
    hooksExist: false,
    loading: true,
  });
  const [expanded, setExpanded] = useState(true);

  // Request workspace status on mount
  useEffect(() => {
    window.vscode?.postMessage({ type: 'getWorkspaceStatus' });
  }, []);

  // Listen for workspace status updates
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data as Record<string, unknown>;
      if (message.type === 'workspaceStatus') {
        setStatus({
          initialized: Boolean(message.initialized),
          specs: Array.isArray(message.specs) ? (message.specs as SpecInfo[]) : [],
          memoryCount: typeof message.memoryCount === 'number' ? message.memoryCount : 0,
          productExists: Boolean(message.productExists),
          hooksExist: Boolean(message.hooksExist),
          loading: false,
        });
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleInit = useCallback(() => {
    setStatus((prev) => ({ ...prev, loading: true }));
    window.vscode?.postMessage({ type: 'initWorkspace' });
  }, []);

  const handleRefresh = useCallback(() => {
    setStatus((prev) => ({ ...prev, loading: true }));
    window.vscode?.postMessage({ type: 'getWorkspaceStatus' });
  }, []);

  return (
    <div className="border-b border-(--vscode-panel-border) bg-(--vscode-editor-background)">
      {/* Header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-(--vscode-foreground) hover:bg-(--vscode-list-hoverBackground)"
        type="button"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="flex-1 text-left">ForgeAI Workspace</span>
        <span
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
          style={{
            backgroundColor: status.initialized
              ? 'var(--vscode-testing-iconPassed)'
              : 'var(--vscode-errorForeground)',
            color: 'var(--vscode-button-foreground)',
            opacity: 0.9,
          }}
        >
          {status.initialized ? (
            <>
              <Check size={10} />
              Ready
            </>
          ) : (
            <>
              <AlertCircle size={10} />
              Not Ready
            </>
          )}
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3">
          {!status.initialized ? (
            <div className="flex flex-col gap-2 rounded border border-(--vscode-panel-border) p-3">
              <p className="text-xs text-(--vscode-descriptionForeground)">
                Initialize the .forgeai/ workspace to enable spec-driven development, memory, and
                hooks.
              </p>
              <button
                onClick={handleInit}
                disabled={status.loading}
                className="flex items-center justify-center gap-2 rounded bg-(--vscode-button-background) px-3 py-1.5 text-xs text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground) disabled:opacity-50"
                type="button"
              >
                {status.loading ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <FolderOpen size={12} />
                )}
                {status.loading ? 'Initializing...' : 'Init Workspace'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {/* Directory list */}
              {DIRECTORIES.map((dir) => {
                let badge: string | null = null;
                let badgeColor = 'var(--vscode-descriptionForeground)';
                if (dir.key === 'memoryCount' && status.memoryCount > 0) {
                  badge = `${status.memoryCount} entries`;
                  badgeColor = 'var(--vscode-charts-blue)';
                } else if (dir.key === 'productExists' && status.productExists) {
                  badge = '✓';
                  badgeColor = 'var(--vscode-testing-iconPassed)';
                } else if (dir.key === 'specs' && status.specs.length > 0) {
                  badge = `${status.specs.length} specs`;
                  badgeColor = 'var(--vscode-charts-purple)';
                } else if (dir.key === 'hooksExist' && status.hooksExist) {
                  badge = '✓';
                  badgeColor = 'var(--vscode-testing-iconPassed)';
                }
                return (
                  <div
                    key={dir.name}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs text-(--vscode-foreground) hover:bg-(--vscode-list-hoverBackground)"
                  >
                    <Folder
                      size={12}
                      style={{ color: 'var(--vscode-symbolIcon-folderForeground)' }}
                    />
                    <span className="font-medium">{dir.label}</span>
                    <span className="text-(--vscode-descriptionForeground)">
                      — {dir.description}
                    </span>
                    {badge && (
                      <span
                        className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          color: badgeColor,
                          backgroundColor: 'var(--vscode-badge-background)',
                        }}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Specs */}
              {status.specs.length > 0 && (
                <div className="mt-1 border-t border-(--vscode-panel-border) pt-2">
                  <span className="px-2 text-[10px] font-medium uppercase text-(--vscode-descriptionForeground)">
                    Specs
                  </span>
                  {status.specs.map((spec) => (
                    <div
                      key={spec.id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-xs text-(--vscode-foreground) hover:bg-(--vscode-list-hoverBackground)"
                    >
                      <FileText
                        size={12}
                        style={{ color: 'var(--vscode-symbolIcon-fileForeground)' }}
                      />
                      <span>{spec.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                className="mt-1 flex items-center justify-center gap-1 rounded px-2 py-1 text-[10px] text-(--vscode-descriptionForeground) hover:bg-(--vscode-list-hoverBackground)"
                type="button"
              >
                <RefreshCw size={10} />
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WorkspaceStatus;
