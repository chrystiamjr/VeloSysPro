import React from 'react';
import {
  AlertTriangle,
  Zap,
  Rocket,
  Calendar,
  HardDrive,
  ShieldCheck,
  Settings,
  FolderOpen,
  RotateCcw,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
  Clock,
  FileText,
  Sliders,
  Plus,
  Play,
  User,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  LucideProps,
} from 'lucide-react';

export type IconName =
  | 'alert-triangle'
  | 'zap'
  | 'rocket'
  | 'calendar'
  | 'hard-drive'
  | 'shield-check'
  | 'settings'
  | 'folder-open'
  | 'rotate-ccw'
  | 'trash'
  | 'refresh-cw'
  | 'check-circle'
  | 'x-circle'
  | 'info'
  | 'clock'
  | 'file-text'
  | 'sliders'
  | 'plus'
  | 'play'
  | 'user'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'chevrons-left'
  | 'chevrons-right';

const iconMap: Record<IconName, React.FC<LucideProps>> = {
  'alert-triangle': AlertTriangle,
  zap: Zap,
  rocket: Rocket,
  calendar: Calendar,
  'hard-drive': HardDrive,
  'shield-check': ShieldCheck,
  settings: Settings,
  'folder-open': FolderOpen,
  'rotate-ccw': RotateCcw,
  trash: Trash2,
  'refresh-cw': RefreshCw,
  'check-circle': CheckCircle2,
  'x-circle': XCircle,
  info: Info,
  clock: Clock,
  'file-text': FileText,
  sliders: Sliders,
  plus: Plus,
  play: Play,
  user: User,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'chevrons-left': ChevronsLeft,
  'chevrons-right': ChevronsRight,
};

export interface IconProps extends LucideProps {
  name: IconName;
  className?: string;
  size?: number;
}

export const Icon: React.FC<IconProps> = ({ name, className = 'w-4 h-4', size, ...props }) => {
  const Component = iconMap[name] || Info;
  return <Component className={className} size={size} {...props} />;
};
