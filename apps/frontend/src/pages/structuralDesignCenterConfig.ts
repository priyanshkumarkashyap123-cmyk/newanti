import type { ComponentType, CSSProperties } from 'react';

export interface NavItemConfig {
  id: string;
  label: string;
  description: string;
  codes: string[];
  badge?: 'new' | 'beta' | 'pro';
  route?: string;
}

export interface NavCategoryConfig {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  color: string;
  gradient: string;
  items: NavItemConfig[];
}

import { Box, Building2, Cable, Columns, Grid3X3 } from 'lucide-react';

export const NAVIGATION: NavCategoryConfig[] = [
  {
    id: 'concrete',
    label: 'Concrete Design',
    icon: Columns,
    color: 'text-blue-400',
    gradient: 'from-blue-600 to-blue-700',
    items: [
      { id: 'rc-beam', label: 'RC Beam', description: 'Beam design', codes: ['IS 456', 'ACI 318'] },
      { id: 'rc-column', label: 'RC Column', description: 'Column design', codes: ['IS 456', 'ACI 318'] },
      { id: 'rc-slab', label: 'RC Slab', description: 'Slab design', codes: ['IS 456'] },
      { id: 'rc-footing', label: 'RC Footing', description: 'Footing design', codes: ['IS 456'] },
    ],
  },
  {
    id: 'steel',
    label: 'Steel Design',
    icon: Building2,
    color: 'text-emerald-400',
    gradient: 'from-emerald-600 to-emerald-700',
    items: [
      { id: 'steel-member', label: 'Steel Member', description: 'Member checks', codes: ['IS 800', 'AISC 360'] },
      { id: 'steel-connection', label: 'Connection', description: 'Connection design', codes: ['IS 800', 'AISC 360'] },
      { id: 'steel-base-plate', label: 'Base Plate', description: 'Base plate checks', codes: ['IS 800'] },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis Tools',
    icon: Grid3X3,
    color: 'text-purple-400',
    gradient: 'from-purple-600 to-purple-700',
    items: [
      { id: 'analysis', label: 'Analysis Hub', description: 'Analysis workflows', codes: ['DSM'] },
      { id: 'plate-shell', label: 'Plate/Shell', description: 'Plate-shell module', codes: ['FEM'] },
      { id: 'bar-bending', label: 'Bar Bending', description: 'BBS workflow', codes: ['IS 2502'] },
      { id: 'section-database', label: 'Section DB', description: 'Section browser', codes: ['Catalog'] },
    ],
  },
  {
    id: 'bridges',
    label: 'Bridge/Cable',
    icon: Cable,
    color: 'text-amber-400',
    gradient: 'from-amber-600 to-amber-700',
    items: [
      { id: 'bridge-deck', label: 'Bridge Deck', description: 'Deck checks', codes: ['IRC'] },
      { id: 'bridge-pier', label: 'Bridge Pier', description: 'Pier checks', codes: ['IRC'] },
      { id: 'cable-design', label: 'Cable Design', description: 'Cable element checks', codes: ['Cable'] },
      { id: 'foundation', label: 'Foundation', description: 'Foundation module', codes: ['IS 456'] },
    ],
  },
  {
    id: 'overview',
    label: 'Overview',
    icon: Box,
    color: 'text-slate-300',
    gradient: 'from-slate-600 to-slate-700',
    items: [{ id: 'dashboard', label: 'Dashboard', description: 'Design center dashboard', codes: ['Summary'] }],
  },
];

export const legacyModuleRouteMap: Record<string, string> = {
  'rc-beam': '/design/rc-beam',
  'rc-column': '/design/rc-column',
  'rc-slab': '/design/rc-slab',
  'rc-footing': '/design/rc-footing',
  'steel-member': '/design/steel-member',
  'steel-connection': '/design/steel-connection',
  'steel-base-plate': '/design/steel-base-plate',
  'plate-shell': '/plate-shell',
  'bar-bending': '/bar-bending',
  'section-database': '/section-database',
  foundation: '/foundation-design',
  analysis: '/analysis',
};

export function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const deltaMs = now - date.getTime();
  const deltaMin = Math.floor(deltaMs / 60000);
  if (deltaMin < 1) return 'just now';
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h ago`;
  const deltaDay = Math.floor(deltaHr / 24);
  return `${deltaDay}d ago`;
}

export function getModuleLabel(moduleId: string): string {
  for (const category of NAVIGATION) {
    const item = category.items.find((entry) => entry.id === moduleId);
    if (item) return item.label;
  }
  return 'Dashboard';
}