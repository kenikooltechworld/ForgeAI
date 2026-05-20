import { useState, useEffect, useCallback } from 'react';
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, Save, RefreshCw } from 'lucide-react';

interface Hook {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  autoApprove: boolean;
  triggers: Array<{ type: string; pattern?: string; phase?: string; command?: string }>;
  actions: Array<{ type: string; prompt?: string; command?: string; message?: string }>;
  createdAt: number;
  updatedAt: number;
}

function HookViewer() {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draftHook, setDraftHook] = useState<Partial<Hook>>({
    enabled: true,
    autoApprove: false,
    triggers: [{ type: 'file', pattern: '**/*.{ts,tsx}' }],
    actions: [{ type: 'message', message: 'File changed — reviewing...' }],
  });

  const fetchHooks = useCallback(() => {
    window.vscode?.postMessage({ type: 'listHooks' });
  }, []);

  useEffect(() => {
    fetchHooks();
  }, [fetchHooks]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data as Record<string, unknown>;
      if (message.type === 'hookList') {
        setHooks(Array.isArray(message.hooks) ? (message.hooks as Hook[]) : []);
        setLoading(false);
      }
      if (
        message.type === 'hookSaved' ||
        message.type === 'hookDeleted' ||
        message.type === 'hookToggled'
      ) {
        fetchHooks();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fetchHooks]);

  const handleSave = useCallback(() => {
    if (!draftHook.name) return;
    window.vscode?.postMessage({
      type: 'saveHook',
      hook: {
        id: draftHook.id ?? `hook-${Date.now()}`,
        name: draftHook.name,
        description: draftHook.description ?? '',
        enabled: draftHook.enabled ?? true,
        autoApprove: draftHook.autoApprove ?? false,
        triggers: draftHook.triggers ?? [],
        actions: draftHook.actions ?? [],
        createdAt: draftHook.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      },
    });
    setShowForm(false);
    setDraftHook({
      enabled: true,
      autoApprove: false,
      triggers: [{ type: 'file', pattern: '**/*.{ts,tsx}' }],
      actions: [{ type: 'message', message: 'File changed — reviewing...' }],
    });
  }, [draftHook]);

  const handleDelete = useCallback((id: string) => {
    if (confirm('Delete this hook?')) {
      window.vscode?.postMessage({ type: 'deleteHook', id });
    }
  }, []);

  const handleToggle = useCallback((id: string) => {
    window.vscode?.postMessage({ type: 'toggleHook', id });
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw size={16} className="animate-spin text-(--vscode-descriptionForeground)" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs text-(--vscode-foreground)">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-(--vscode-panel-border) px-3 py-2">
        <Zap size={14} />
        <span className="font-semibold">Hooks ({hooks.length})</span>
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto rounded p-1 hover:bg-(--vscode-list-hoverBackground)"
          type="button"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* New hook form */}
      {showForm && (
        <div className="flex flex-col gap-2 border-b border-(--vscode-panel-border) px-3 py-2">
          <input
            className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs"
            placeholder="Hook name"
            value={draftHook.name ?? ''}
            onChange={(e) => setDraftHook((p) => ({ ...p, name: e.target.value }))}
          />
          <textarea
            className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs"
            placeholder="Description"
            rows={2}
            value={draftHook.description ?? ''}
            onChange={(e) => setDraftHook((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={draftHook.enabled ?? true}
                onChange={(e) => setDraftHook((p) => ({ ...p, enabled: e.target.checked }))}
              />
              Enabled
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={draftHook.autoApprove ?? false}
                onChange={(e) => setDraftHook((p) => ({ ...p, autoApprove: e.target.checked }))}
              />
              Auto-approve
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded bg-(--vscode-button-background) px-2 py-1 text-(--vscode-button-foreground)"
              type="button"
            >
              <Save size={10} className="inline mr-1" /> Save
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded px-2 py-1 text-(--vscode-descriptionForeground) hover:bg-(--vscode-list-hoverBackground)"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hook list */}
      <div className="flex-1 overflow-y-auto">
        {hooks.length === 0 && (
          <p className="px-3 py-2 text-(--vscode-descriptionForeground)">
            No hooks yet. Hooks trigger actions when files change, specs update, or commands run.
          </p>
        )}
        {hooks.map((hook) => (
          <div
            key={hook.id}
            className="flex items-start gap-2 border-b border-(--vscode-panel-border) px-3 py-2 hover:bg-(--vscode-list-hoverBackground)"
          >
            <button onClick={() => handleToggle(hook.id)} className="mt-0.5 shrink-0" type="button">
              {hook.enabled ? (
                <ToggleRight size={16} style={{ color: 'var(--vscode-testing-iconPassed)' }} />
              ) : (
                <ToggleLeft size={16} style={{ color: 'var(--vscode-disabledForeground)' }} />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="font-medium">{hook.name}</span>
                {hook.autoApprove && (
                  <span
                    className="rounded px-1 py-0 text-[9px] font-medium"
                    style={{
                      color: 'var(--vscode-charts-orange)',
                      backgroundColor: 'var(--vscode-badge-background)',
                    }}
                  >
                    Auto
                  </span>
                )}
              </div>
              <p className="truncate text-(--vscode-descriptionForeground)">{hook.description}</p>
              <p className="mt-0.5 text-[10px] text-(--vscode-descriptionForeground)">
                Triggers: {hook.triggers.map((t) => t.type).join(', ')} | Actions:{' '}
                {hook.actions.map((a) => a.type).join(', ')}
              </p>
            </div>
            <button
              onClick={() => handleDelete(hook.id)}
              className="rounded p-1 text-(--vscode-descriptionForeground) hover:text-(--vscode-errorForeground) hover:bg-(--vscode-list-hoverBackground)"
              type="button"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HookViewer;
