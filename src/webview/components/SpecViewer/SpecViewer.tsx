import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Save,
  RefreshCw,
  Edit3,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface SpecMeta {
  id: string;
  title: string;
  status: 'draft' | 'requirements' | 'design' | 'tasks' | 'complete';
  createdAt: number;
  updatedAt: number;
  requirementsApproved: boolean;
  designApproved: boolean;
  tasksApproved: boolean;
}

interface SpecArtifact {
  requirements: string;
  design: string;
  tasks: string;
}

interface Spec {
  meta: SpecMeta;
  artifacts: SpecArtifact;
}

const PHASES: Array<{ key: keyof SpecArtifact; label: string; approvedKey: keyof SpecMeta }> = [
  { key: 'requirements', label: 'Requirements', approvedKey: 'requirementsApproved' },
  { key: 'design', label: 'Design', approvedKey: 'designApproved' },
  { key: 'tasks', label: 'Tasks', approvedKey: 'tasksApproved' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--vscode-descriptionForeground)',
  requirements: 'var(--vscode-charts-blue)',
  design: 'var(--vscode-charts-purple)',
  tasks: 'var(--vscode-charts-yellow)',
  complete: 'var(--vscode-testing-iconPassed)',
};

function SpecViewer() {
  const [specs, setSpecs] = useState<SpecMeta[]>([]);
  const [selectedSpec, setSelectedSpec] = useState<Spec | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [activePhase, setActivePhase] = useState<keyof SpecArtifact>('requirements');
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // AI generation state
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [genTitle, setGenTitle] = useState('');
  const [genDesc, setGenDesc] = useState('');
  const [genMode, setGenMode] = useState<'full' | 'quick'>('full');
  const [genProgress, setGenProgress] = useState<{
    active: boolean;
    phase?: string;
    message?: string;
  }>({ active: false });

  const fetchSpecs = useCallback(() => {
    window.vscode?.postMessage({ type: 'listSpecs' });
  }, []);

  useEffect(() => {
    fetchSpecs();
  }, [fetchSpecs]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data as Record<string, unknown>;
      if (message.type === 'specList') {
        setSpecs(Array.isArray(message.specs) ? (message.specs as SpecMeta[]) : []);
        setLoading(false);
      }
      if (message.type === 'specData') {
        const spec = (message.spec as Spec) ?? null;
        setSelectedSpec(spec);
        if (spec) {
          setEditContent(spec.artifacts[activePhase]);
        }
      }
      if (
        message.type === 'specCreated' ||
        message.type === 'specArtifactUpdated' ||
        message.type === 'specPhaseApproved' ||
        message.type === 'specDeleted'
      ) {
        fetchSpecs();
        if (selectedSpec) {
          window.vscode?.postMessage({ type: 'getSpec', id: selectedSpec.meta.id });
        }
      }
      if (message.type === 'specGenerationStarted') {
        setGenProgress({ active: true, message: 'Starting spec generation...' });
        setShowGenerateForm(false);
      }
      if (message.type === 'specGenerationProgress') {
        setGenProgress({
          active: true,
          phase: typeof message.phase === 'string' ? message.phase : undefined,
          message: typeof message.message === 'string' ? message.message : undefined,
        });
      }
      if (message.type === 'specGenerated') {
        setGenProgress({ active: false });
        fetchSpecs();
        const sid = typeof message.specId === 'string' ? message.specId : '';
        if (sid) {
          window.vscode?.postMessage({ type: 'getSpec', id: sid });
        }
      }
      if (message.type === 'specGenerationFailed') {
        setGenProgress({ active: false });
        alert(
          `Spec generation failed: ${typeof message.error === 'string' ? message.error : 'Unknown error'}`
        );
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fetchSpecs, activePhase, selectedSpec]);

  const handleCreate = useCallback(() => {
    if (!newTitle.trim()) return;
    const id = `spec-${Date.now()}`;
    window.vscode?.postMessage({ type: 'createSpec', id, title: newTitle.trim() });
    setShowForm(false);
    setNewTitle('');
  }, [newTitle]);

  const handleGenerate = useCallback(() => {
    if (!genTitle.trim()) return;
    window.vscode?.postMessage({
      type: 'generateSpec',
      title: genTitle.trim(),
      description: genDesc.trim(),
      mode: genMode,
    });
    setGenTitle('');
    setGenDesc('');
    setGenMode('full');
  }, [genTitle, genDesc, genMode]);

  const handleSelectSpec = useCallback((id: string) => {
    window.vscode?.postMessage({ type: 'getSpec', id });
  }, []);

  const handleSaveArtifact = useCallback(() => {
    if (!selectedSpec) return;
    window.vscode?.postMessage({
      type: 'updateSpecArtifact',
      id: selectedSpec.meta.id,
      artifactType: activePhase,
      content: editContent,
    });
    setIsEditing(false);
  }, [selectedSpec, activePhase, editContent]);

  const handleApprove = useCallback(
    (phase: 'requirements' | 'design' | 'tasks') => {
      if (!selectedSpec) return;
      window.vscode?.postMessage({
        type: 'approveSpecPhase',
        id: selectedSpec.meta.id,
        phase,
      });
    },
    [selectedSpec]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm('Delete this spec?')) {
        window.vscode?.postMessage({ type: 'deleteSpec', id });
        if (selectedSpec?.meta.id === id) {
          setSelectedSpec(null);
        }
      }
    },
    [selectedSpec]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw size={16} className="animate-spin text-(--vscode-descriptionForeground)" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs text-(--vscode-foreground)">
      {/* Spec list header */}
      <div className="flex items-center gap-2 border-b border-(--vscode-panel-border) px-3 py-2">
        <FileText size={14} />
        <span className="font-semibold">Specs ({specs.length})</span>
        <button
          onClick={() => setShowGenerateForm(true)}
          className="ml-auto rounded p-1 text-(--vscode-charts-orange) hover:bg-(--vscode-list-hoverBackground)"
          type="button"
          title="Generate with AI"
        >
          <Sparkles size={12} />
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="rounded p-1 hover:bg-(--vscode-list-hoverBackground)"
          type="button"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* AI generate form */}
      {showGenerateForm && (
        <div className="flex flex-col gap-2 border-b border-(--vscode-panel-border) px-3 py-2">
          <input
            className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs"
            placeholder="Feature title (e.g. OAuth2 Authentication)"
            value={genTitle}
            onChange={(e) => setGenTitle(e.target.value)}
          />
          <textarea
            className="rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs"
            placeholder="Short description of what this feature should do..."
            rows={2}
            value={genDesc}
            onChange={(e) => setGenDesc(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-[10px]">
              <input
                type="radio"
                checked={genMode === 'full'}
                onChange={() => setGenMode('full')}
              />
              Full (with approval gates)
            </label>
            <label className="flex items-center gap-1 text-[10px]">
              <input
                type="radio"
                checked={genMode === 'quick'}
                onChange={() => setGenMode('quick')}
              />
              Quick (auto-approve)
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              className="rounded bg-(--vscode-charts-orange) px-2 py-1 text-white text-[10px] font-medium"
              type="button"
            >
              <Sparkles size={10} className="inline mr-1" /> Generate
            </button>
            <button
              onClick={() => {
                setShowGenerateForm(false);
                setGenTitle('');
                setGenDesc('');
              }}
              className="rounded px-2 py-1 text-(--vscode-descriptionForeground) hover:bg-(--vscode-list-hoverBackground) text-[10px]"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Generation progress overlay */}
      {genProgress.active && (
        <div className="flex items-center gap-2 border-b border-(--vscode-panel-border) px-3 py-2 bg-(--vscode-list-hoverBackground)">
          <Loader2 size={12} className="animate-spin text-(--vscode-charts-orange)" />
          <span className="text-[10px] font-medium">
            {genProgress.message ?? 'Generating spec...'}
          </span>
          {genProgress.phase && (
            <span className="ml-auto text-[10px] uppercase text-(--vscode-descriptionForeground)">
              {genProgress.phase}
            </span>
          )}
        </div>
      )}

      {/* New spec form */}
      {showForm && (
        <div className="flex gap-2 border-b border-(--vscode-panel-border) px-3 py-2">
          <input
            className="flex-1 rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) px-2 py-1 text-xs"
            placeholder="Spec title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
          <button
            onClick={handleCreate}
            className="rounded bg-(--vscode-button-background) px-2 py-1 text-(--vscode-button-foreground)"
            type="button"
          >
            Create
          </button>
          <button
            onClick={() => {
              setShowForm(false);
              setNewTitle('');
            }}
            className="rounded px-2 py-1 text-(--vscode-descriptionForeground) hover:bg-(--vscode-list-hoverBackground)"
            type="button"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: spec list */}
        <div className="w-48 overflow-y-auto border-r border-(--vscode-panel-border)">
          {specs.length === 0 && (
            <p className="px-3 py-2 text-(--vscode-descriptionForeground)">No specs yet.</p>
          )}
          {specs.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelectSpec(s.id)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-(--vscode-list-hoverBackground) ${
                selectedSpec?.meta.id === s.id ? 'bg-(--vscode-list-activeSelectionBackground)' : ''
              }`}
              type="button"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[s.status] }}
              />
              <span className="truncate">{s.title}</span>
              {s.status === 'complete' && (
                <CheckCircle2
                  size={12}
                  className="ml-auto shrink-0"
                  style={{ color: 'var(--vscode-testing-iconPassed)' }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Right: spec detail */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedSpec ? (
            <>
              {/* Spec header */}
              <div className="flex items-center gap-2 border-b border-(--vscode-panel-border) px-3 py-2">
                <span className="font-medium">{selectedSpec.meta.title}</span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                  style={{
                    color: STATUS_COLORS[selectedSpec.meta.status],
                    backgroundColor: 'var(--vscode-badge-background)',
                  }}
                >
                  {selectedSpec.meta.status}
                </span>
                <button
                  onClick={() => handleDelete(selectedSpec.meta.id)}
                  className="ml-auto rounded p-1 text-(--vscode-descriptionForeground) hover:text-(--vscode-errorForeground) hover:bg-(--vscode-list-hoverBackground)"
                  type="button"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Phase tabs */}
              <div className="flex border-b border-(--vscode-panel-border)">
                {PHASES.map((phase) => {
                  const isApproved = selectedSpec.meta[phase.approvedKey] as boolean;
                  return (
                    <button
                      key={phase.key}
                      onClick={() => {
                        setActivePhase(phase.key);
                        setEditContent(selectedSpec.artifacts[phase.key]);
                        setIsEditing(false);
                      }}
                      className={`flex items-center gap-1 px-3 py-1 text-xs ${
                        activePhase === phase.key
                          ? 'bg-(--vscode-button-background) text-(--vscode-button-foreground)'
                          : 'text-(--vscode-descriptionForeground) hover:bg-(--vscode-list-hoverBackground)'
                      }`}
                      type="button"
                    >
                      {isApproved ? (
                        <CheckCircle2
                          size={10}
                          style={{ color: 'var(--vscode-testing-iconPassed)' }}
                        />
                      ) : (
                        <Circle size={10} />
                      )}
                      {phase.label}
                    </button>
                  );
                })}
              </div>

              {/* Editor / Viewer */}
              <div className="flex flex-1 flex-col overflow-hidden p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[10px] uppercase text-(--vscode-descriptionForeground)">
                    {PHASES.find((p) => p.key === activePhase)?.label}
                  </span>
                  <button
                    onClick={() => {
                      if (isEditing) {
                        handleSaveArtifact();
                      } else {
                        setIsEditing(true);
                      }
                    }}
                    className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-[10px] bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)"
                    type="button"
                  >
                    {isEditing ? <Save size={10} /> : <Edit3 size={10} />}
                    {isEditing ? 'Save' : 'Edit'}
                  </button>
                  {!isEditing && selectedSpec.meta[`${activePhase}Approved`] !== true && (
                    <button
                      onClick={() => handleApprove(activePhase)}
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] bg-(--vscode-charts-green) text-white hover:opacity-90"
                      type="button"
                    >
                      <CheckCircle2 size={10} /> Approve
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <textarea
                    className="flex-1 resize-none rounded border border-(--vscode-panel-border) bg-(--vscode-input-background) p-2 font-mono text-xs text-(--vscode-input-foreground)"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                ) : (
                  <div className="flex-1 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-(--vscode-foreground)">
                    {editContent || (
                      <span className="italic text-(--vscode-descriptionForeground)">
                        No content yet. Click Edit to write {activePhase}.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-(--vscode-descriptionForeground)">
              Select a spec from the list to view and edit.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpecViewer;
