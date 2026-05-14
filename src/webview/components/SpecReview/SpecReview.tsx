/**
 * Spec Review Panel — Phase 5.1
 * Renders requirements.md with approve/reject, EARS highlighting
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, X, FileText } from 'lucide-react';

interface Requirement {
  id: string;
  category: string;
  text: string;
  earsType?: 'universal' | 'existence' | 'event' | 'optional' | 'unwanted';
  status: 'pending' | 'approved' | 'rejected';
}

interface SpecReviewProps {
  title?: string;
  requirements: Requirement[];
  onApprove: (reqId: string) => void;
  onReject: (reqId: string, reason: string) => void;
  onApproveAll: () => void;
}

function EARSBadge({ type }: { type: Requirement['earsType'] }) {
  if (!type) return null;
  const colors: Record<string, string> = {
    universal: 'bg-blue-500/20 text-blue-400',
    existence: 'bg-green-500/20 text-green-400',
    event: 'bg-amber-500/20 text-amber-400',
    optional: 'bg-purple-500/20 text-purple-400',
    unwanted: 'bg-red-500/20 text-red-400',
  };
  const labels: Record<string, string> = {
    universal: 'Universal',
    existence: 'Existence',
    event: 'Event',
    optional: 'Optional',
    unwanted: 'Unwanted',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${colors[type]}`}>
      {labels[type]}
    </span>
  );
}

function StatusBadge({ status }: { status: Requirement['status'] }) {
  const styles: Record<string, string> = {
    pending: 'bg-(--vscode-badge-background) text-(--vscode-badge-foreground)',
    approved: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function SpecReview({
  title = 'Spec Review',
  requirements,
  onApprove,
  onReject,
  onApproveAll,
}: SpecReviewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const grouped = requirements.reduce((acc, req) => {
    if (!acc[req.category]) acc[req.category] = [];
    acc[req.category].push(req);
    return acc;
  }, {} as Record<string, Requirement[]>);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approvedCount = requirements.filter((r) => r.status === 'approved').length;
  const progress = requirements.length > 0 ? (approvedCount / requirements.length) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-(--vscode-panel-border)">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-(--vscode-symbolIcon-colorForeground)" />
            <h2 className="text-sm font-semibold">{title}</h2>
          </div>
          <button
            onClick={onApproveAll}
            className="text-xs px-3 py-1.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center gap-1"
          >
            <Check size={12} /> Approve All
          </button>
        </div>
        {/* Progress */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-(--vscode-descriptionForeground) mb-1">
            <span>Progress</span>
            <span>{approvedCount}/{requirements.length}</span>
          </div>
          <div className="h-1.5 bg-(--vscode-editor-inactiveSelectionBackground) rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Requirements */}
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {Object.entries(grouped).map(([category, reqs]) => (
          <div key={category} className="mb-3">
            <h3 className="text-xs font-semibold text-(--vscode-descriptionForeground) uppercase tracking-wide px-2 py-1">
              {category}
            </h3>
            {reqs.map((req) => (
              <div
                key={req.id}
                className="rounded border border-(--vscode-panel-border) mb-1 overflow-hidden"
              >
                <button
                  onClick={() => toggle(req.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-(--vscode-list-hoverBackground)"
                >
                  {expanded.has(req.id) ? (
                    <ChevronDown size={14} className="shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="shrink-0" />
                  )}
                  <span className="text-xs flex-1 truncate">{req.text}</span>
                  <EARSBadge type={req.earsType} />
                  <StatusBadge status={req.status} />
                </button>

                {expanded.has(req.id) && (
                  <div className="px-3 pb-3 border-t border-(--vscode-panel-border) bg-(--vscode-editor-inactiveSelectionBackground)/30">
                    <p className="text-xs mt-2 text-(--vscode-editor-foreground)">{req.text}</p>
                    <div className="flex gap-2 mt-3">
                      {req.status !== 'approved' && (
                        <button
                          onClick={() => onApprove(req.id)}
                          className="text-xs px-3 py-1.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center gap-1"
                        >
                          <Check size={12} /> Approve
                        </button>
                      )}
                      {req.status !== 'rejected' && (
                        <button
                          onClick={() => setRejectingId(rejectingId === req.id ? null : req.id)}
                          className="text-xs px-3 py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center gap-1"
                        >
                          <X size={12} /> Reject
                        </button>
                      )}
                    </div>

                    {rejectingId === req.id && (
                      <div className="mt-2">
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason for rejection..."
                          className="w-full text-xs p-2 rounded border border-(--vscode-input-border) bg-(--vscode-input-background) text-(--vscode-input-foreground) resize-none"
                          rows={2}
                        />
                        <button
                          onClick={() => {
                            onReject(req.id, rejectReason);
                            setRejectingId(null);
                            setRejectReason('');
                          }}
                          className="mt-1 text-xs px-3 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        >
                          Submit Rejection
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
