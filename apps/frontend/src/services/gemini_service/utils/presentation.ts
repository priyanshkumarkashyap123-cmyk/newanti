import type { AIAction } from '../types';

export const ACTION_ICON_BY_TYPE: Record<AIAction['type'], string> = {
  addNode: '📍',
  addMember: '📏',
  addSupport: '🔩',
  addLoad: '⬇️',
  addPlate: '🧩',
  runAnalysis: '📊',
  optimize: '🎯',
  report: '📄',
};

export const DEFAULT_ACTION_ICON = '•';
