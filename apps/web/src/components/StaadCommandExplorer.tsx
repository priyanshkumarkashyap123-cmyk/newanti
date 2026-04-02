import { FC, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Search, Wrench, Download, Filter, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useUIStore } from '../store/uiStore';
import { useModelStore } from '../store/model';
import {
  getStaadCommandCatalog,
  getStaadCommandStats,
  getStaadCommandCatalogCsv,
} from '../data/staadCommandCatalog';
import type { CommandStatus } from '../data/staadCommandCatalog/types';

interface StaadCommandExplorerProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_STYLES: Record<CommandStatus, string> = {
  ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'coming-soon': 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

const STATUS_LABEL: Record<CommandStatus, string> = {
  ready: 'Ready',
  partial: 'Partial',
  'coming-soon': 'Limited',
};

type StatusFilter = 'all' | CommandStatus;

const MODELING_TOOL_BRIDGE: Record<string, Parameters<ReturnType<typeof useModelStore.getState>['setTool']>[0]> = {
  SELECT: 'select',
  SELECT_RANGE: 'select_range',
  DRAW_NODE: 'node',
  DRAW_BEAM: 'member',
  DRAW_COLUMN: 'member',
  ASSIGN_SUPPORT: 'support',
  ADD_POINT_LOAD: 'load',
  ADD_UDL: 'memberLoad',
};

const downloadBlob = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const StaadCommandExplorer: FC<StaadCommandExplorerProps> = ({ isOpen, onClose }) => {
  const setCategory = useUIStore((s) => s.setCategory);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const showNotification = useUIStore((s) => s.showNotification);
  const setTool = useModelStore((s) => s.setTool);
  const openModal = useUIStore((s) => s.openModal);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const catalog = useMemo(() => getStaadCommandCatalog(), []);
  const stats = useMemo(() => getStaadCommandStats(catalog), [catalog]);

  const filtered = useMemo(() => {
    let result = catalog;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((e) => e.status === statusFilter);
    }

    // Text search
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((entry) =>
        entry.label.toLowerCase().includes(q) ||
        entry.toolId.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.keywords.some((kw) => kw.toLowerCase().includes(q))
      );
    }

    return result;
  }, [catalog, query, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((entry) => {
      const existing = map.get(entry.category) ?? [];
      existing.push(entry);
      map.set(entry.category, existing);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const runCommand = (toolId: string, category: string, status: CommandStatus) => {
    setCategory(category as any);
    setActiveTool(toolId);

    const bridge = MODELING_TOOL_BRIDGE[toolId];
    if (bridge) {
      setTool(bridge);
    }

    // Modal bridge for commands that open specialized dialogs
    const COMMAND_MODAL_BRIDGE: Record<string, string> = {
      ADD_SELF_WEIGHT: 'deadLoadGenerator',
      ADD_HYDROSTATIC: 'pressureLoad',
      LOAD_PATTERN: 'is875LiveLoad',
      ENVELOPE: 'loadCombinationsDialog',
      ADD_MOVING_LOAD: 'movingLoadDialog',
      ADD_WIND: 'windLoadDialog',
      ADD_SEISMIC: 'seismicLoadDialog',
    };

    const modal = COMMAND_MODAL_BRIDGE[toolId];
    if (modal) {
      // UIStore modal keys are a strict union; cast to any to avoid TS narrowing here
      openModal(modal as any);
    }

    if (status === 'ready') {
      showNotification('success', `${toolId} activated`);
    } else if (status === 'partial') {
      showNotification('warning', `${toolId} is partially available in current build`);
    } else {
      showNotification('info', `${toolId} opened with guided fallback in this build`);
    }
  };

  const handleExportCsv = () => {
    const csv = getStaadCommandCatalogCsv(catalog);
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(csv, `beamlab-staad-commands-${date}.csv`, 'text/csv;charset=utf-8;');
    showNotification('success', `Exported ${catalog.length} commands to CSV`);
  };

  const filterButtons: { key: StatusFilter; label: string; count: number; color: string }[] = [
    { key: 'all',          label: 'All',         count: stats.total,      color: 'text-slate-600 dark:text-slate-300' },
    { key: 'ready',        label: 'Ready',       count: stats.ready,      color: 'text-emerald-600 dark:text-emerald-300' },
    { key: 'partial',      label: 'Partial',     count: stats.partial,    color: 'text-amber-600 dark:text-amber-300' },
    { key: 'coming-soon',  label: 'Limited',     count: stats.comingSoon, color: 'text-[#869ab8]' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">STAAD Command Explorer</DialogTitle>
              <DialogDescription>
                Complete command inventory mapped to BeamLab UI surfaces — {stats.total} commands
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCsv} className="flex items-center gap-2 shrink-0">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          </div>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-2">
          <div className="p-3 rounded-lg border border-[#1a2333]">
            <div className="text-xs text-slate-500">Total Commands</div>
            <div className="text-xl font-bold text-[#dae2fd]">{stats.total}</div>
          </div>
          <div className="p-3 rounded-lg border border-[#1a2333]/50 bg-emerald-50/70 dark:bg-emerald-950/30">
            <div className="text-xs text-emerald-600 dark:text-emerald-300">Ready</div>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-200">{stats.ready}</div>
          </div>
          <div className="p-3 rounded-lg border border-[#1a2333]/50 bg-amber-50/70 dark:bg-amber-950/30">
            <div className="text-xs text-amber-600 dark:text-amber-300">Partial</div>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-200">{stats.partial}</div>
          </div>
          <div className="p-3 rounded-lg border border-[#1a2333] bg-slate-100/50 dark:bg-slate-800/50">
            <div className="text-xs text-slate-500">Limited</div>
            <div className="text-xl font-bold text-slate-700 dark:text-slate-200">{stats.comingSoon}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
              style={{ width: `${stats.readyPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 whitespace-nowrap">
            {stats.readyPct}% ready
          </span>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setStatusFilter(btn.key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                statusFilter === btn.key
                  ? 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                  : 'border-[#1a2333] text-[#869ab8] hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {btn.label} <span className={`ml-1 ${btn.color}`}>{btn.count}</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID, category, or description…"
            className="pl-9"
          />
        </div>

        {/* Command List */}
        <div className="flex-1 overflow-y-auto border border-[#1a2333] rounded-lg p-3 space-y-4">
          {grouped.length === 0 && (
            <div className="text-center py-8">
              <Search className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No commands matched your search.</p>
              <p className="text-xs text-slate-400 mt-1">
                {statusFilter !== 'all' && (
                  <button type="button" className="underline" onClick={() => setStatusFilter('all')}>
                    Clear status filter
                  </button>
                )}
              </p>
            </div>
          )}

          {grouped.map(([category, commands]) => (
            <div key={category}>
              <h3 className="text-xs font-bold tracking-wider text-[#869ab8] mb-2 flex items-center justify-between">
                <span>{category}</span>
                <span className="font-normal text-slate-400">{commands.length}</span>
              </h3>
              <div className="space-y-1.5">
                {commands.map((command) => (
                  <div
                    key={command.key}
                    className="flex items-start justify-between gap-3 p-2.5 rounded-md border border-[#1a2333] bg-white/70 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{command.label}</span>
                        {command.shortcut && (
                          <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
                            {command.shortcut}
                          </kbd>
                        )}
                        {command.roadmapPhase != null && command.status !== 'ready' && (
                          <span className="text-[9px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 px-1.5 py-0.5 rounded">
                            Guided
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#869ab8] mt-0.5 leading-snug">
                        {command.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded ${STATUS_STYLES[command.status]}`}>
                        {STATUS_LABEL[command.status]}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runCommand(command.toolId, command.category, command.status)}
                        className="h-7 text-xs"
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 text-xs text-slate-500 mt-1 flex-wrap">
          <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Ready — executable now</span>
          <span className="inline-flex items-center gap-1"><Wrench className="w-3.5 h-3.5 text-amber-500" /> Partial — available with limited depth</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="w-3.5 h-3.5 text-slate-500" /> Limited — opens in guided mode</span>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StaadCommandExplorer;
