/**
 * Centralized Icon Exports
 *
 * All lucide-react icons used in ForgeAI are exported from this file.
 * This provides a single source of truth for icons and makes it easy to:
 * - See all icons used in the project
 * - Replace icons consistently
 * - Tree-shake unused icons
 *
 * Usage:
 * import { BugIcon, SparklesIcon } from '@/icons';
 */

// Re-export icons with descriptive names
export {
  // Quick Actions
  Bug as BugIcon,
  Sparkles as SparklesIcon,
  BookOpen as BookOpenIcon,
  TestTube as TestTubeIcon,
  Search as SearchIcon,
  FileText as FileTextIcon,

  // UI Actions
  Send as SendIcon,
  Settings as SettingsIcon,
  HelpCircle as HelpCircleIcon,
  X as CloseIcon,
  Menu as MenuIcon,
  Plus as PlusIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,

  // Status & Feedback
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  AlertCircle as AlertCircleIcon,
  AlertTriangle as AlertTriangleIcon,
  Info as InfoIcon,
  Lightbulb as LightbulbIcon,
  Rocket as RocketIcon,

  // File Operations
  File as FileIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  FileCode as FileCodeIcon,
  FilePlus as FilePlusIcon,
  FileEdit as FileEditIcon,
  Trash2 as TrashIcon,
  Copy as CopyIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,

  // Code & Development
  Code as CodeIcon,
  Terminal as TerminalIcon,
  GitBranch as GitBranchIcon,
  GitCommit as GitCommitIcon,
  GitPullRequest as GitPullRequestIcon,
  Package as PackageIcon,
  Cpu as CpuIcon,
  Zap as ZapIcon,

  // Loading & Progress
  Loader as LoaderIcon,
  Loader2 as Loader2Icon,
  Clock as ClockIcon,

  // Navigation
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  ArrowUp as ArrowUpIcon,
  ArrowDown as ArrowDownIcon,
  ExternalLink as ExternalLinkIcon,

  // Thinking & AI
  Brain as BrainIcon,
  MessageSquare as MessageSquareIcon,
  MessageCircle as MessageCircleIcon,

  // Tools & Actions
  Wrench as WrenchIcon,
  Play as PlayIcon,
  Pause as PauseIcon,
  Square as StopIcon,
  RotateCw as RefreshIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,

  // View & Layout
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Maximize as MaximizeIcon,
  Minimize as MinimizeIcon,
  Sidebar as SidebarIcon,
  Layout as LayoutIcon,

  // Misc
  MoreVertical as MoreVerticalIcon,
  MoreHorizontal as MoreHorizontalIcon,
  Filter as FilterIcon,
  Star as StarIcon,
  Heart as HeartIcon,
  Bookmark as BookmarkIcon,
} from "lucide-react";

/**
 * Icon Size Constants
 *
 * Standard icon sizes used throughout the application.
 * Use these constants for consistency.
 */
export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  "2xl": 48,
} as const;

export type IconSize = keyof typeof ICON_SIZES;

/**
 * Get icon size in pixels
 *
 * @param size - Icon size key
 * @returns Size in pixels
 *
 * @example
 * <BugIcon size={getIconSize('md')} />
 */
export function getIconSize(size: IconSize): number {
  return ICON_SIZES[size];
}
