import React, { useState } from 'react';
import {
  FileText,
  Pencil,
  FolderOpen,
  Search,
  FileSearch,
  Terminal,
  GitBranch,
  AlertCircle,
  FolderPlus,
  Trash2,
  Copy,
  Eye,
  Globe,
  BookOpen,
  MousePointer,
  Camera,
  ArrowDown,
  X,
  Loader,
  Check,
  Link,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { AgentActivityItem } from '../../types';

interface AgentAnnouncementProps {
  activities: AgentActivityItem[];
}

const iconMap: Record<string, LucideIcon> = {
  'file-text': FileText,
  pencil: Pencil,
  'folder-open': FolderOpen,
  search: Search,
  'file-search': FileSearch,
  terminal: Terminal,
  'git-branch': GitBranch,
  'git-commit': GitBranch,
  'alert-circle': AlertCircle,
  'folder-plus': FolderPlus,
  'trash-2': Trash2,
  copy: Copy,
  eye: Eye,
  globe: Globe,
  'book-open': BookOpen,
  'mouse-pointer': MousePointer,
  'form-input': MousePointer,
  camera: Camera,
  'arrow-down': ArrowDown,
  x: X,
  loader: Loader,
  check: Check,
  link: Link,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
};

/**
 * Format duration in ms to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Extract basename from a file path for display
 */
function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

const ActivityRow: React.FC<{ activity: AgentActivityItem }> = ({ activity }) => {
  const [expanded, setExpanded] = useState(false);
  const IconComponent = activity.icon && iconMap[activity.icon] ? iconMap[activity.icon] : Loader;

  const isComplete = activity.type === 'complete';
  const hasMetadata = !!activity.metadata;
  const canExpand = hasMetadata && (activity.metadata?.fileNames || activity.metadata?.query);

  return (
    <div className="flex flex-col">
      <button
        onClick={() => canExpand && setExpanded(!expanded)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs w-full text-left transition-colors ${
          canExpand ? 'hover:bg-(--vscode-list-hoverBackground) cursor-pointer' : 'cursor-default'
        }`}
      >
        {/* Icon - green tint for complete, blue-ish for start */}
        <IconComponent
          size={14}
          className={`flex-shrink-0 ${
            isComplete ? 'text-green-400' : 'text-(--vscode-textLink-foreground)'
          }`}
        />

        {/* Main text */}
        <span className="text-(--vscode-foreground) truncate flex-1">{activity.text}</span>

        {/* File name tag */}
        {activity.metadata?.fileName && (
          <span className="px-1.5 py-0.5 rounded bg-(--vscode-badge-background) text-(--vscode-badge-foreground) text-[10px] font-mono truncate max-w-[120px]">
            {basename(activity.metadata.fileName)}
          </span>
        )}

        {/* Multiple file names as count */}
        {activity.metadata?.fileNames && activity.metadata.fileNames.length > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-(--vscode-badge-background) text-(--vscode-badge-foreground) text-[10px]">
            {activity.metadata.fileNames.length === 1
              ? basename(activity.metadata.fileNames[0])
              : `${activity.metadata.fileNames.length} files`}
          </span>
        )}

        {/* Result count */}
        {activity.metadata?.count !== undefined && (
          <span className="text-(--vscode-descriptionForeground) text-[10px]">
            {activity.metadata.count} results
          </span>
        )}

        {/* Duration */}
        {activity.metadata?.duration !== undefined && (
          <span className="text-(--vscode-descriptionForeground) text-[10px]">
            {formatDuration(activity.metadata.duration)}
          </span>
        )}

        {/* URL for fetches */}
        {activity.metadata?.url && (
          <span className="text-(--vscode-textLink-foreground) text-[10px] truncate max-w-[150px]">
            {activity.metadata.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </span>
        )}

        {/* Expand chevron */}
        {canExpand && (
          <span className="text-(--vscode-descriptionForeground)">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
      </button>

      {/* Expanded details */}
      {expanded && canExpand && (
        <div className="pl-6 pr-2 pb-1 text-xs text-(--vscode-descriptionForeground)">
          {activity.metadata?.fileNames && activity.metadata.fileNames.length > 1 && (
            <ul className="space-y-0.5">
              {activity.metadata.fileNames.map((f, i) => (
                <li key={i} className="font-mono text-[10px]">
                  {f}
                </li>
              ))}
            </ul>
          )}
          {activity.metadata?.query && (
            <span className="italic">&ldquo;{activity.metadata.query}&rdquo;</span>
          )}
        </div>
      )}
    </div>
  );
};

export const AgentAnnouncement: React.FC<AgentAnnouncementProps> = ({ activities }) => {
  // Show only the last N activities to prevent overflow
  const maxVisible = 8;
  const visibleActivities =
    activities.length > maxVisible ? activities.slice(-maxVisible) : activities;
  const hiddenCount = activities.length - visibleActivities.length;

  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-(--vscode-panel-border) bg-(--vscode-editor-inactiveSelectionBackground) overflow-hidden">
      {hiddenCount > 0 && (
        <div className="px-2 py-1 text-[10px] text-(--vscode-descriptionForeground) text-center border-b border-(--vscode-panel-border)">
          {hiddenCount} earlier {hiddenCount === 1 ? 'activity' : 'activities'} hidden
        </div>
      )}
      {visibleActivities.map((activity) => (
        <ActivityRow key={activity.id} activity={activity} />
      ))}
    </div>
  );
};
