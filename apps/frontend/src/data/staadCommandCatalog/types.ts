import type { Category } from '../../store/uiStore';

export type CommandStatus = 'ready' | 'partial' | 'coming-soon';

export interface StaadCommandEntry {
  key: string;
  toolId: string;
  label: string;
  category: Category;
  status: CommandStatus;
  description: string;
  keywords: string[];
  shortcut?: string;
  roadmapPhase?: 1 | 2 | 3;
}

export interface StaadCommandStats {
  total: number;
  ready: number;
  partial: number;
  comingSoon: number;
  readyPct: number;
}
