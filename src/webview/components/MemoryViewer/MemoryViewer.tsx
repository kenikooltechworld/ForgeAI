import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Heart, Lightbulb, Plus, Trash2, Tag, Clock } from 'lucide-react';

interface MemoryEntry {
  id: string;
  category: 'finding' | 'preference' | 'learning';
  title: string;
  content: string;
  source?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

const CATS = {
  finding: { label: 'Findings', icon: BookOpen, color: 'var(--vscode-charts-blue)' },
  preference: { label: 'Preferences', icon: Heart, color: 'var(--vscode-charts-red)' },
  learning: { label: 'Learnings', icon: Lightbulb, color: 'var(--vscode-charts-yellow)' },
};

function MemoryViewer() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [active, setActive] = useState<'all' | 'finding' | 'preference' | 'learning'>('all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'finding' as MemoryEntry['category'], tags: '', source: '' });

  useEffect(() => {
    setLoading(true);
    window.vscode?.postMessage({ type: 'listMemory', category: active === 'all' ? undefined : active });
  }, [active]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const m = e.data as Record<string, unknown>;
      if (m.type === 'memoryList' && Array.isArray(m.entries)) {
        setEntries(m.entries as MemoryEntry[]);
        setLoading(false);
      }
      if (m.type === 'memorySaved' || m.type === 'memoryDeleted') {
        window.vscode?.postMessage({ type: 'listMemory', category: active === 'all' ? undefined : active });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [active]);

  const save = useCallback(() => {
    if (!form.title.trim() || !form.content.trim()) return;
    const entry: MemoryEntry = {
      id: `mem-${Date.now()}`,
      category: form.category,
      title: form.title.trim(),
      content: form.content.trim(),
      source: form.source.trim() || undefined,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    window.vscode?.postMessage({ type: 'saveMemory', entry });
    setShowForm(false);
    setForm({ title: '', content: '', category: 'finding', tags: '', source: '' });
  }, [form]);

  const del = useCallback((id: string) => {
    window.vscode?.postMessage({ type: 'deleteMemory', id });
  }, []);

  const fmt = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex h-full flex-col bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
      <div className="flex items-center justify-between border-b border-(--vscode-panel-border) px-3 py-2">
        <h2 className="text-sm font-semibold">Memory</h2>
        <button onClick={() => setShowForm((p) => !p)} className="flex items-center gap-1 rounded bg-(--vscode-button-background) px-2 py-1 text-xs text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)" type="button"><Plus size={12} /> Add</button>
      </div>

      <div className="flex gap-1 border-b border-(--vscode-panel-border) px-2 py-1">
        {(['all', 'finding', 'preference', 'learning'] as const).map((c) => (
          <button key={c} onClick={() => setActive(c)} className={`rounded px-2 py-1 text-xs ${active === c ? 'bg-(--vscode-button-background) text-(--vscode-button-foreground)' : 'text-(--vscode-descriptionForeground) hover:bg-(--vscode-list-hoverBackground)'}`} type="button">{c === 'all' ? 'All' : CATS[c].label}</button>
        ))}
      </div>

      {showForm && (
        <div className="border-b border-(--vscode-panel-border) p-3 flex flex-col gap-2">
          <input type="text" placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs outline-none focus:border-(--vscode-focusBorder)" />
          <textarea placeholder="Content..." value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} rows={3} className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs outline-none focus:border-(--vscode-focusBorder)" />
          <div className="flex gap-2">
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as MemoryEntry['category'] }))} className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs outline-none">
              <option value="finding">Finding</option>
              <option value="preference">Preference</option>
              <option value="learning">Learning</option>
            </select>
            <input type="text" placeholder="Tags (comma separated)" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} className="flex-1 rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs outline-none focus:border-(--vscode-focusBorder)" />
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="rounded bg-(--vscode-button-background) px-3 py-1 text-xs text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)" type="button">Save</button>
            <button onClick={() => setShowForm(false)} className="rounded px-3 py-1 text-xs text-(--vscode-descriptionForeground) hover:bg-(--vscode-list-hoverBackground)" type="button">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-xs text-(--vscode-descriptionForeground)">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-center text-xs text-(--vscode-descriptionForeground)">No memory entries yet.</div>
        ) : (
          entries.map((entry) => {
            const cfg = CATS[entry.category];
            const Icon = cfg.icon;
            return (
              <div key={entry.id} className="border-b border-(--vscode-panel-border) p-3 hover:bg-(--vscode-list-hoverBackground)">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon size={14} style={{ color: cfg.color }} />
                    <span className="text-xs font-medium">{entry.title}</span>
                  </div>
                  <button onClick={() => del(entry.id)} className="text-(--vscode-descriptionForeground) hover:text-(--vscode-errorForeground)" type="button"><Trash2 size={12} /></button>
                </div>
                <p className="mt-1 text-xs text-(--vscode-descriptionForeground) whitespace-pre-wrap">{entry.content}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-(--vscode-descriptionForeground)">
                  {entry.source && <span className="rounded bg-(--vscode-badge-background) px-1.5 py-0.5 text-(--vscode-badge-foreground)">{entry.source}</span>}
                  {entry.tags.map((t) => (
                    <span key={t} className="flex items-center gap-0.5"><Tag size={8} />{t}</span>
                  ))}
                  <span className="flex items-center gap-0.5 ml-auto"><Clock size={8} />{fmt(entry.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default MemoryViewer;
