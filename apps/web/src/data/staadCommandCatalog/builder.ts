import type { Category } from '../../store/uiStore';
import { CATEGORY_TOOLS } from '../../store/uiStore';
import { COMMAND_DESCRIPTIONS } from './descriptions';
import { COMMAND_KEYWORDS, prettifyWithFallback } from './keywords';
import { COMMAND_ROADMAP_PHASE, PARTIAL_TOOLS, READY_TOOLS } from './status';
import { COMMAND_SHORTCUTS } from './shortcuts';
import type { CommandStatus, StaadCommandEntry, StaadCommandStats } from './types';

const prettifyToolId = (toolId: string): string =>
  toolId
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const getToolStatus = (toolId: string): CommandStatus => {
  if (READY_TOOLS.has(toolId)) return 'ready';
  if (PARTIAL_TOOLS.has(toolId)) return 'partial';
  return 'coming-soon';
};

export const buildStaadCommandCatalog = (): StaadCommandEntry[] => {
  const entries: StaadCommandEntry[] = [];

  (Object.entries(CATEGORY_TOOLS) as [Category, string[]][]).forEach(([category, tools]) => {
    tools.forEach((toolId) => {
      const status = getToolStatus(toolId);
      entries.push({
        key: `${category}:${toolId}`,
        toolId,
        label: prettifyToolId(toolId),
        category,
        status,
        description: COMMAND_DESCRIPTIONS[toolId] ?? `${prettifyToolId(toolId)} — engineering tool`,
        keywords: COMMAND_KEYWORDS[toolId] ?? prettifyWithFallback(toolId),
        shortcut: COMMAND_SHORTCUTS[toolId],
        roadmapPhase: status !== 'ready' ? COMMAND_ROADMAP_PHASE[toolId] : undefined,
      });
    });
  });

  return entries;
};

export const getStaadCommandStats = (catalog: StaadCommandEntry[]): StaadCommandStats => {
  const base = catalog.reduce<Omit<StaadCommandStats, 'readyPct'>>(
    (acc, command) => {
      acc.total += 1;
      if (command.status === 'ready') acc.ready += 1;
      if (command.status === 'partial') acc.partial += 1;
      if (command.status === 'coming-soon') acc.comingSoon += 1;
      return acc;
    },
    { total: 0, ready: 0, partial: 0, comingSoon: 0 }
  );
  return {
    ...base,
    readyPct: base.total > 0 ? Math.round((base.ready / base.total) * 100) : 0,
  };
};

export const getStaadCommandCatalogCsv = (catalog: StaadCommandEntry[]): string => {
  const header = 'Category,Tool ID,Label,Status,Execution Tier,Description';
  const rows = catalog.map((e) => {
    const tier = e.status === 'ready' ? 'Direct' : e.status === 'partial' ? 'Advanced' : 'Guided';
    const desc = e.description.replace(/,/g, ';').replace(/\n/g, ' ');
    return `${e.category},${e.toolId},"${e.label}",${e.status},"${tier}","${desc}"`;
  });
  return [header, ...rows].join('\n');
};
