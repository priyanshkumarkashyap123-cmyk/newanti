/**
 * ResultsTableDock — Docked Bottom Panel for Analysis Results Tables
 *
 * Figma §11 Post-Processing: Tabbed panel at bottom of viewport showing
 * Displacements, Member Forces, Reactions in sortable/filterable tables.
 * Includes load case/combo selector, export buttons, and equilibrium check.
 */

import { FC, memo, useState, useMemo, useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  Download,
  Printer,
  ArrowUpDown,
  Check,
  AlertTriangle,
  X,
  Maximize2,
  Minimize2,
  Filter,
} from "lucide-react";
import { useModelStore, type AnalysisResults } from "../../store/model";

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId = "displacements" | "memberForces" | "reactions";
type SortDir = "asc" | "desc";

interface ResultsTableDockProps {
  analysisResults: AnalysisResults;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNum(v: number | undefined, decimals = 4): string {
  if (v === undefined || v === null) return "—";
  if (Math.abs(v) < 1e-10) return "0.0000";
  return v.toFixed(decimals);
}

function getMaxAbsEntry<T extends Record<string, any>>(
  entries: T[],
  key: keyof T,
): { value: number; index: number } {
  let maxVal = 0;
  let maxIdx = 0;
  entries.forEach((e, i) => {
    const v = e[key];
    if (typeof v !== "number") return;
    const abs = Math.abs(v);
    if (abs > maxVal) {
      maxVal = abs;
      maxIdx = i;
    }
  });
  return { value: (entries[maxIdx]?.[key] as number) ?? 0, index: maxIdx };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const ResultsTableDock: FC<ResultsTableDockProps> = memo(
  ({ analysisResults, onClose }) => {
    const [activeTab, setActiveTab] = useState<TabId>("displacements");
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [sortKey, setSortKey] = useState<string>("id");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [filterText, setFilterText] = useState("");

    // ─── Data extraction ─────────────────────────────────────────────

    const displacementRows = useMemo(() => {
      if (!analysisResults?.displacements) return [];
      return Array.from(analysisResults.displacements.entries()).map(
        ([id, d]) => ({
          id,
          dx: d.dx ?? 0,
          dy: d.dy ?? 0,
          dz: d.dz ?? 0,
          rx: d.rx ?? 0,
          ry: d.ry ?? 0,
          rz: d.rz ?? 0,
        }),
      );
    }, [analysisResults?.displacements]);

    const memberForceRows = useMemo(() => {
      if (!analysisResults?.memberForces) return [];
      return Array.from(analysisResults.memberForces.entries()).map(
        ([id, f]) => ({
          id,
          fx: f.axial ?? 0,
          fy: f.shearY ?? 0,
          fz: f.shearZ ?? 0,
          mx: f.torsion ?? 0,
          my: f.momentY ?? 0,
          mz: f.momentZ ?? 0,
        }),
      );
    }, [analysisResults?.memberForces]);

    const reactionRows = useMemo(() => {
      if (!analysisResults?.reactions) return [];
      return Array.from(analysisResults.reactions.entries()).map(
        ([id, r]) => ({
          id,
          rx: r.fx ?? 0,
          ry: r.fy ?? 0,
          rz: r.fz ?? 0,
          mrx: r.mx ?? 0,
          mry: r.my ?? 0,
          mrz: r.mz ?? 0,
        }),
      );
    }, [analysisResults?.reactions]);

    // ─── Equilibrium check ────────────────────────────────────────────

    const equilibriumOk = useMemo(() => {
      if (!analysisResults?.equilibriumCheck) return null;
      return analysisResults.equilibriumCheck.pass;
    }, [analysisResults?.equilibriumCheck]);

    // ─── Sorting & filtering ──────────────────────────────────────────

    const handleSort = useCallback(
      (key: string) => {
        if (sortKey === key) {
          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
          setSortKey(key);
          setSortDir("asc");
        }
      },
      [sortKey],
    );

    function sortRows<T extends Record<string, any>>(rows: T[]): T[] {
      const filtered = filterText
        ? rows.filter((r) =>
            r.id.toLowerCase().includes(filterText.toLowerCase()),
          )
        : rows;
      return [...filtered].sort((a, b) => {
        const va = a[sortKey] ?? "";
        const vb = b[sortKey] ?? "";
        if (typeof va === "number" && typeof vb === "number") {
          return sortDir === "asc" ? va - vb : vb - va;
        }
        return sortDir === "asc"
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va));
      });
    }

    // ─── Export CSV ──────────────────────────────────────────────────

    const handleExportCSV = useCallback(() => {
      let csv = "";
      let filename = "";
      if (activeTab === "displacements") {
        csv = "Node,δx(m),δy(m),δz(m),θx(rad),θy(rad),θz(rad)\n";
        displacementRows.forEach((r) => {
          csv += `${r.id},${r.dx},${r.dy},${r.dz},${r.rx},${r.ry},${r.rz}\n`;
        });
        filename = "displacements.csv";
      } else if (activeTab === "memberForces") {
        csv = "Member,Fx(kN),Fy(kN),Fz(kN),Mx(kN·m),My(kN·m),Mz(kN·m)\n";
        memberForceRows.forEach((r) => {
          csv += `${r.id},${r.fx},${r.fy},${r.fz},${r.mx},${r.my},${r.mz}\n`;
        });
        filename = "member_forces.csv";
      } else {
        csv = "Node,Rx(kN),Ry(kN),Rz(kN),MRx(kN·m),MRy(kN·m),MRz(kN·m)\n";
        reactionRows.forEach((r) => {
          csv += `${r.id},${r.rx},${r.ry},${r.rz},${r.mrx},${r.mry},${r.mrz}\n`;
        });
        filename = "reactions.csv";
      }
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }, [activeTab, displacementRows, memberForceRows, reactionRows]);

    // ─── Tab config ─────────────────────────────────────────────────

    const tabs = [
      {
        id: "displacements" as TabId,
        label: "Displacements",
        count: displacementRows.length,
      },
      {
        id: "memberForces" as TabId,
        label: "Member Forces",
        count: memberForceRows.length,
      },
      {
        id: "reactions" as TabId,
        label: "Reactions",
        count: reactionRows.length,
      },
    ];

    // ─── Sort indicator ──────────────────────────────────────────────

    const SortHeader: FC<{ col: string; label: string }> = ({ col, label }) => (
      <th
        onClick={() => handleSort(col)}
        className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-blue-400 transition-colors select-none whitespace-nowrap"
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {sortKey === col && (
            <ArrowUpDown className="w-3 h-3 text-blue-400" />
          )}
        </span>
      </th>
    );

    // ─── Heat-map cell coloring ─────────────────────────────────────

    const heatCell = (value: number, maxAbs: number) => {
      if (maxAbs === 0) return "";
      const ratio = Math.abs(value) / maxAbs;
      if (ratio > 0.8)
        return "text-red-400 font-semibold";
      if (ratio > 0.5) return "text-orange-400";
      if (ratio > 0.2) return "text-yellow-400";
      return "";
    };

    // ─── Collapsed bar ─────────────────────────────────────────────

    if (isCollapsed) {
      return (
        <div className="h-7 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-700/40 flex items-center justify-between px-3 flex-shrink-0">
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="font-semibold text-slate-400">Results</span>
            <span className="text-slate-500">
              Nodes: <span className="text-slate-300">{displacementRows.length}</span>
            </span>
            <span className="text-slate-500">
              Members: <span className="text-slate-300">{memberForceRows.length}</span>
            </span>
            <span className="text-slate-500">
              Reactions: <span className="text-slate-300">{reactionRows.length}</span>
            </span>
            {equilibriumOk !== null && (
              <span
                className={`flex items-center gap-1 ${equilibriumOk ? "text-emerald-400" : "text-red-400"}`}
              >
                {equilibriumOk ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {equilibriumOk ? "Equilibrium ✓" : "Equilibrium ✗"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button type="button"
              onClick={() => setIsCollapsed(false)}
              className="p-1 hover:bg-slate-800/60 rounded text-slate-400 hover:text-slate-200 transition-colors"
              title="Expand results panel"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button type="button"
              onClick={onClose}
              className="p-1 hover:bg-slate-800/60 rounded text-slate-400 hover:text-slate-200 transition-colors"
              title="Close results panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      );
    }

    // ─── Compute max abs values for heat-map ────────────────────────

    const maxAbsForces = useMemo(() => {
      if (memberForceRows.length === 0) return { fx: 1, fy: 1, fz: 1, mx: 1, my: 1, mz: 1 };
      return {
        fx: Math.max(...memberForceRows.map((r) => Math.abs(r.fx)), 1e-10),
        fy: Math.max(...memberForceRows.map((r) => Math.abs(r.fy)), 1e-10),
        fz: Math.max(...memberForceRows.map((r) => Math.abs(r.fz)), 1e-10),
        mx: Math.max(...memberForceRows.map((r) => Math.abs(r.mx)), 1e-10),
        my: Math.max(...memberForceRows.map((r) => Math.abs(r.my)), 1e-10),
        mz: Math.max(...memberForceRows.map((r) => Math.abs(r.mz)), 1e-10),
      };
    }, [memberForceRows]);

    const dockHeight = isMaximized ? "h-[60vh]" : "h-[240px]";

    // ─── Render ──────────────────────────────────────────────────────

    return (
      <div
        className={`${dockHeight} flex flex-col bg-white/98 dark:bg-slate-900/98 backdrop-blur-md border-t border-slate-700/40 flex-shrink-0 transition-all duration-200 animate-[slideInUp_200ms_ease-out]`}
      >
        {/* Tab Header Bar */}
        <div className="flex items-center justify-between h-8 px-2 bg-slate-100/80 dark:bg-slate-950/80 border-b border-slate-700/30 flex-shrink-0">
          <div className="flex items-center gap-0.5">
            {tabs.map((tab) => {
              const tabColors: Record<string, { active: string; border: string }> = {
                displacements: { active: 'text-cyan-400', border: 'border-cyan-500' },
                memberForces: { active: 'text-blue-400', border: 'border-blue-500' },
                reactions: { active: 'text-amber-400', border: 'border-amber-500' },
              };
              const colors = tabColors[tab.id] || { active: 'text-blue-400', border: 'border-blue-500' };
              return (
              <button type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-3 py-1 text-[11px] font-semibold rounded-t transition-colors
                  ${
                    activeTab === tab.id
                      ? `${colors.active} bg-slate-800/50 border-b-2 ${colors.border}`
                      : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                  }
                `}
              >
                {tab.label}
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] bg-slate-700/50 text-slate-400">
                  {tab.count}
                </span>
              </button>
              );
            })}

            {/* Equilibrium indicator */}
            {activeTab === "reactions" && equilibriumOk !== null && (
              <span
                className={`ml-3 flex items-center gap-1 text-[10px] font-semibold ${
                  equilibriumOk ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {equilibriumOk ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {equilibriumOk ? "Equilibrium OK" : "Check Equilibrium"}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Filter */}
            <div className="flex items-center gap-1 mr-2">
              <Filter className="w-3 h-3 text-slate-500" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter by ID..."
                className="w-24 h-5 px-1.5 text-[10px] bg-slate-800/50 border border-slate-700/40 rounded text-slate-300 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
              />
            </div>
            <button type="button"
              onClick={handleExportCSV}
              className="p-1 hover:bg-slate-800/60 rounded text-slate-400 hover:text-slate-200 transition-colors"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button type="button"
              onClick={() => window.print()}
              className="p-1 hover:bg-slate-800/60 rounded text-slate-400 hover:text-slate-200 transition-colors"
              title="Print"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1 hover:bg-slate-800/60 rounded text-slate-400 hover:text-slate-200 transition-colors"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button type="button"
              onClick={() => setIsCollapsed(true)}
              className="p-1 hover:bg-slate-800/60 rounded text-slate-400 hover:text-slate-200 transition-colors"
              title="Collapse"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button type="button"
              onClick={onClose}
              className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors"
              title="Close results panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto eng-scroll">
          <table className="w-full text-[11px] font-mono">
            <thead className="sticky top-0 bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-sm z-10">
              <tr>
                {activeTab === "displacements" && (
                  <>
                    <SortHeader col="id" label="Node" />
                    <SortHeader col="dx" label="δx (m)" />
                    <SortHeader col="dy" label="δy (m)" />
                    <SortHeader col="dz" label="δz (m)" />
                    <SortHeader col="rx" label="θx (rad)" />
                    <SortHeader col="ry" label="θy (rad)" />
                    <SortHeader col="rz" label="θz (rad)" />
                  </>
                )}
                {activeTab === "memberForces" && (
                  <>
                    <SortHeader col="id" label="Member" />
                    <SortHeader col="fx" label="Fx (kN)" />
                    <SortHeader col="fy" label="Fy (kN)" />
                    <SortHeader col="fz" label="Fz (kN)" />
                    <SortHeader col="mx" label="Mx (kN·m)" />
                    <SortHeader col="my" label="My (kN·m)" />
                    <SortHeader col="mz" label="Mz (kN·m)" />
                  </>
                )}
                {activeTab === "reactions" && (
                  <>
                    <SortHeader col="id" label="Node" />
                    <SortHeader col="rx" label="Rx (kN)" />
                    <SortHeader col="ry" label="Ry (kN)" />
                    <SortHeader col="rz" label="Rz (kN)" />
                    <SortHeader col="mrx" label="MRx (kN·m)" />
                    <SortHeader col="mry" label="MRy (kN·m)" />
                    <SortHeader col="mrz" label="MRz (kN·m)" />
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {/* Displacements */}
              {activeTab === "displacements" &&
                sortRows(displacementRows).map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-blue-500/5 transition-colors cursor-pointer"
                    onClick={() => useModelStore.getState().selectNode(r.id)}
                  >
                    <td className="px-3 py-1.5 font-semibold text-cyan-400">
                      {r.id}
                    </td>
                    <td className="px-3 py-1.5 text-slate-300 tabular-nums">
                      {formatNum(r.dx)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-300 tabular-nums">
                      {formatNum(r.dy)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-300 tabular-nums">
                      {formatNum(r.dz)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 tabular-nums">
                      {formatNum(r.rx, 6)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 tabular-nums">
                      {formatNum(r.ry, 6)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 tabular-nums">
                      {formatNum(r.rz, 6)}
                    </td>
                  </tr>
                ))}

              {/* Member Forces */}
              {activeTab === "memberForces" &&
                sortRows(memberForceRows).map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-blue-500/5 transition-colors cursor-pointer"
                    onClick={() => {
                      const store = useModelStore.getState();
                      // Try to select as member first; fall back to node selection
                      if (store.members.has(r.id)) {
                        store.selectedIds.clear();
                        store.selectedIds.add(r.id);
                      } else {
                        store.selectNode(r.id);
                      }
                    }}
                  >
                    <td className="px-3 py-1.5 font-semibold text-blue-400">
                      {r.id}
                    </td>
                    <td
                      className={`px-3 py-1.5 tabular-nums ${heatCell(r.fx, maxAbsForces.fx)}`}
                    >
                      {formatNum(r.fx)}
                    </td>
                    <td
                      className={`px-3 py-1.5 tabular-nums ${heatCell(r.fy, maxAbsForces.fy)}`}
                    >
                      {formatNum(r.fy)}
                    </td>
                    <td
                      className={`px-3 py-1.5 tabular-nums ${heatCell(r.fz, maxAbsForces.fz)}`}
                    >
                      {formatNum(r.fz)}
                    </td>
                    <td
                      className={`px-3 py-1.5 tabular-nums ${heatCell(r.mx, maxAbsForces.mx)}`}
                    >
                      {formatNum(r.mx)}
                    </td>
                    <td
                      className={`px-3 py-1.5 tabular-nums ${heatCell(r.my, maxAbsForces.my)}`}
                    >
                      {formatNum(r.my)}
                    </td>
                    <td
                      className={`px-3 py-1.5 tabular-nums ${heatCell(r.mz, maxAbsForces.mz)}`}
                    >
                      {formatNum(r.mz)}
                    </td>
                  </tr>
                ))}

              {/* Reactions */}
              {activeTab === "reactions" &&
                sortRows(reactionRows).map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-blue-500/5 transition-colors cursor-pointer"
                    onClick={() => useModelStore.getState().selectNode(r.id)}
                  >
                    <td className="px-3 py-1.5 font-semibold text-amber-400">
                      {r.id}
                    </td>
                    <td className="px-3 py-1.5 text-slate-300 tabular-nums">
                      {formatNum(r.rx)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-300 tabular-nums">
                      {formatNum(r.ry)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-300 tabular-nums">
                      {formatNum(r.rz)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 tabular-nums">
                      {formatNum(r.mrx)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 tabular-nums">
                      {formatNum(r.mry)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 tabular-nums">
                      {formatNum(r.mrz)}
                    </td>
                  </tr>
                ))}
            </tbody>

            {/* Summary row */}
            {activeTab === "reactions" && reactionRows.length > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-sm border-t border-slate-700/40">
                <tr className="font-semibold text-emerald-400">
                  <td className="px-3 py-1.5">ΣR</td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(reactionRows.reduce((s, r) => s + r.rx, 0))}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(reactionRows.reduce((s, r) => s + r.ry, 0))}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(reactionRows.reduce((s, r) => s + r.rz, 0))}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(reactionRows.reduce((s, r) => s + r.mrx, 0))}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(reactionRows.reduce((s, r) => s + r.mry, 0))}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(reactionRows.reduce((s, r) => s + r.mrz, 0))}
                  </td>
                </tr>
              </tfoot>
            )}

            {activeTab === "memberForces" && memberForceRows.length > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-sm border-t border-slate-700/40">
                <tr className="font-semibold text-red-400">
                  <td className="px-3 py-1.5">Max</td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(getMaxAbsEntry(memberForceRows, "fx").value)}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(getMaxAbsEntry(memberForceRows, "fy").value)}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(getMaxAbsEntry(memberForceRows, "fz").value)}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(getMaxAbsEntry(memberForceRows, "mx").value)}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(getMaxAbsEntry(memberForceRows, "my").value)}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(getMaxAbsEntry(memberForceRows, "mz").value)}
                  </td>
                </tr>
              </tfoot>
            )}

            {activeTab === "displacements" && displacementRows.length > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-sm border-t border-slate-700/40">
                <tr className="font-semibold text-orange-400">
                  <td className="px-3 py-1.5">Max</td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(getMaxAbsEntry(displacementRows, "dx").value)}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(getMaxAbsEntry(displacementRows, "dy").value)}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(getMaxAbsEntry(displacementRows, "dz").value)}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(getMaxAbsEntry(displacementRows, "rx").value, 6)}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(getMaxAbsEntry(displacementRows, "ry").value, 6)}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {formatNum(getMaxAbsEntry(displacementRows, "rz").value, 6)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  },
);
ResultsTableDock.displayName = "ResultsTableDock";

export default ResultsTableDock;
