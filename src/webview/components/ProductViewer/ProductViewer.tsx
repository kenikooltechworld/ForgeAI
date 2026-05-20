import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Trash2, Save, RefreshCw, Edit3, CheckCircle2, Circle, Clock } from 'lucide-react';

interface ProductOverview {
  name: string;
  description: string;
  techStack: string[];
  goals: string[];
  targetUsers: string;
  createdAt: number;
  updatedAt: number;
}

interface Feature {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'planned' | 'in-progress' | 'complete' | 'deferred';
  acceptanceCriteria: string[];
  createdAt: number;
  updatedAt: number;
}

interface ProductData {
  overview: ProductOverview | null;
  features: Feature[];
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'var(--vscode-errorForeground)',
  high: 'var(--vscode-charts-orange)',
  medium: 'var(--vscode-charts-yellow)',
  low: 'var(--vscode-descriptionForeground)',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  complete: <CheckCircle2 size={12} style={{ color: 'var(--vscode-testing-iconPassed)' }} />,
  'in-progress': <Clock size={12} style={{ color: 'var(--vscode-charts-blue)' }} />,
  planned: <Circle size={12} style={{ color: 'var(--vscode-descriptionForeground)' }} />,
  deferred: <Circle size={12} style={{ color: 'var(--vscode-disabledForeground)' }} />,
};

function ProductViewer() {
  const [data, setData] = useState<ProductData>({ overview: null, features: [] });
  const [loading, setLoading] = useState(true);
  const [editOverview, setEditOverview] = useState(false);
  const [draftOverview, setDraftOverview] = useState<Partial<ProductOverview>>({});
  const [showFeatureForm, setShowFeatureForm] = useState(false);
  const [draftFeature, setDraftFeature] = useState<Partial<Feature>>({});

  useEffect(() => {
    window.vscode?.postMessage({ type: 'getProduct' });
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data as Record<string, unknown>;
      if (message.type === 'productData') {
        setData({
          overview: (message.overview as ProductOverview | null) ?? null,
          features: Array.isArray(message.features) ? (message.features as Feature[]) : [],
        });
        setLoading(false);
      }
      if (message.type === 'productSaved' || message.type === 'productFeatureDeleted') {
        window.vscode?.postMessage({ type: 'getProduct' });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleSaveOverview = useCallback(() => {
    window.vscode?.postMessage({
      type: 'saveProductOverview',
      overview: {
        ...data.overview,
        ...draftOverview,
      },
    });
    setEditOverview(false);
  }, [data.overview, draftOverview]);

  const handleSaveFeature = useCallback(() => {
    if (!draftFeature.title) return;
    window.vscode?.postMessage({
      type: 'saveProductFeature',
      feature: {
        id: draftFeature.id ?? `feat-${Date.now()}`,
        title: draftFeature.title,
        description: draftFeature.description ?? '',
        priority: draftFeature.priority ?? 'medium',
        status: draftFeature.status ?? 'planned',
        acceptanceCriteria: draftFeature.acceptanceCriteria ?? [],
        createdAt: draftFeature.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      },
    });
    setShowFeatureForm(false);
    setDraftFeature({});
  }, [draftFeature]);

  const handleDeleteFeature = useCallback((id: string) => {
    if (confirm('Delete this feature?')) {
      window.vscode?.postMessage({ type: 'deleteProductFeature', id });
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw size={16} className="animate-spin text-(--vscode-descriptionForeground)" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3 text-xs text-(--vscode-foreground)">
      {/* Overview */}
      <div className="mb-3 rounded border border-(--vscode-panel-border) p-3">
        <div className="mb-2 flex items-center gap-2">
          <Package size={14} />
          <span className="font-semibold">Product Overview</span>
          <button
            onClick={() => {
              setEditOverview(!editOverview);
              setDraftOverview(data.overview ?? {});
            }}
            className="ml-auto rounded p-1 hover:bg-(--vscode-list-hoverBackground)"
            type="button"
          >
            {editOverview ? <Save size={12} /> : <Edit3 size={12} />}
          </button>
        </div>
        {editOverview ? (
          <div className="flex flex-col gap-2">
            <input
              className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs text-(--vscode-input-foreground)"
              placeholder="Project name"
              value={draftOverview.name ?? ''}
              onChange={(e) => setDraftOverview((p) => ({ ...p, name: e.target.value }))}
            />
            <textarea
              className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs text-(--vscode-input-foreground)"
              placeholder="Description"
              rows={3}
              value={draftOverview.description ?? ''}
              onChange={(e) => setDraftOverview((p) => ({ ...p, description: e.target.value }))}
            />
            <input
              className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs text-(--vscode-input-foreground)"
              placeholder="Tech stack (comma-separated)"
              value={(draftOverview.techStack ?? []).join(', ')}
              onChange={(e) =>
                setDraftOverview((p) => ({
                  ...p,
                  techStack: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                }))
              }
            />
            <button
              onClick={handleSaveOverview}
              className="flex items-center justify-center gap-1 rounded bg-(--vscode-button-background) px-2 py-1 text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
              type="button"
            >
              <Save size={12} /> Save
            </button>
          </div>
        ) : (
          <>
            <p className="mb-1 font-medium">{data.overview?.name ?? 'Untitled Project'}</p>
            <p className="mb-2 text-(--vscode-descriptionForeground)">{data.overview?.description ?? 'No description yet.'}</p>
            {data.overview && data.overview.techStack.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.overview.techStack.map((t) => (
                  <span key={t} className="rounded bg-(--vscode-badge-background) px-1.5 py-0.5 text-[10px]">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Features */}
      <div className="flex-1 rounded border border-(--vscode-panel-border) p-3">
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 size={14} />
          <span className="font-semibold">Features ({data.features.length})</span>
          <button
            onClick={() => setShowFeatureForm(true)}
            className="ml-auto rounded p-1 hover:bg-(--vscode-list-hoverBackground)"
            type="button"
          >
            <Plus size={12} />
          </button>
        </div>

        {showFeatureForm && (
          <div className="mb-2 flex flex-col gap-2 rounded border border-(--vscode-panel-border) p-2">
            <input
              className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs"
              placeholder="Feature title"
              value={draftFeature.title ?? ''}
              onChange={(e) => setDraftFeature((p) => ({ ...p, title: e.target.value }))}
            />
            <textarea
              className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs"
              placeholder="Description"
              rows={2}
              value={draftFeature.description ?? ''}
              onChange={(e) => setDraftFeature((p) => ({ ...p, description: e.target.value }))}
            />
            <div className="flex gap-2">
              <select
                className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs"
                value={draftFeature.priority ?? 'medium'}
                onChange={(e) => setDraftFeature((p) => ({ ...p, priority: e.target.value as Feature['priority'] }))}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs"
                value={draftFeature.status ?? 'planned'}
                onChange={(e) => setDraftFeature((p) => ({ ...p, status: e.target.value as Feature['status'] }))}
              >
                <option value="planned">Planned</option>
                <option value="in-progress">In Progress</option>
                <option value="complete">Complete</option>
                <option value="deferred">Deferred</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveFeature}
                className="rounded bg-(--vscode-button-background) px-2 py-1 text-(--vscode-button-foreground)"
                type="button"
              >
                Save
              </button>
              <button
                onClick={() => { setShowFeatureForm(false); setDraftFeature({}); }}
                className="rounded px-2 py-1 text-(--vscode-descriptionForeground) hover:bg-(--vscode-list-hoverBackground)"
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {data.features.length === 0 && (
            <p className="text-(--vscode-descriptionForeground)">No features yet. Click + to add one.</p>
          )}
          {data.features.map((f) => (
            <div
              key={f.id}
              className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-(--vscode-list-hoverBackground)"
            >
              <span className="mt-0.5">{STATUS_ICONS[f.status]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="truncate font-medium">{f.title}</span>
                  <span
                    className="rounded px-1 py-0 text-[9px] font-medium uppercase"
                    style={{ color: PRIORITY_COLORS[f.priority], backgroundColor: 'var(--vscode-badge-background)' }}
                  >
                    {f.priority}
                  </span>
                </div>
                <p className="truncate text-(--vscode-descriptionForeground)">{f.description}</p>
              </div>
              <button
                onClick={() => handleDeleteFeature(f.id)}
                className="rounded p-1 text-(--vscode-descriptionForeground) hover:text-(--vscode-errorForeground) hover:bg-(--vscode-list-hoverBackground)"
                type="button"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProductViewer;
