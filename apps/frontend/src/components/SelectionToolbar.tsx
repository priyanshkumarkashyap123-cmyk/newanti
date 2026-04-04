/**
 * SelectionToolbar.tsx — Professional Selection Tools
 *
 * Industry-standard advanced selection panel matching real structural
 * software (STAAD.Pro, ETABS, SAP2000):
 *
 *   • Select by Node / Member / Plate IDs (ranges: N1-N10,N15)
 *   • Select by Story / Y-Level
 *   • Select members parallel to X / Y / Z axis
 *   • Select by Section / Material property
 *   • Invert / Select All / Clear actions
 *   • Add-to / Replace selection mode
 *   • Stays open for multi-step workflows
 */

import { FC, useState, useMemo, useCallback } from "react";
import {
  Hash,
  Layers,
  Ruler,
  Box,
  MousePointer2,
  RotateCcw,
  CheckSquare,
  Shuffle,
  ArrowRight,
  Building2,
} from "lucide-react";
import { useModelStore } from "../store/model";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

interface SelectionToolbarProps {
  open: boolean;
  onClose: () => void;
}

type TabId = "ids" | "level" | "parallel" | "property";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse "N1,N3-N8,N12" / "M1-M5,M10" into string[] */
function parseIdRange(input: string, prefix: string): string[] {
  const ids: string[] = [];
  const pfx = prefix.toUpperCase();
  const parts = input
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const upper = part.toUpperCase();
    if (upper.includes("-")) {
      const [startStr, endStr] = upper.split("-");
      const startNum = parseInt(startStr.replace(pfx, ""), 10);
      const endNum = parseInt(endStr.replace(pfx, ""), 10);
      if (!isNaN(startNum) && !isNaN(endNum)) {
        const lo = Math.min(startNum, endNum);
        const hi = Math.max(startNum, endNum);
        for (let i = lo; i <= hi; i++) ids.push(`${pfx}${i}`);
      }
    } else {
      // Accept with or without prefix
      const num = parseInt(upper.replace(pfx, ""), 10);
      if (!isNaN(num)) ids.push(`${pfx}${num}`);
      else ids.push(part); // fallback: use as-is
    }
  }
  return ids;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SelectionToolbar: FC<SelectionToolbarProps> = ({
  open,
  onClose,
}) => {
  // Store
  const nodes = useModelStore((s) => s.nodes);
  const members = useModelStore((s) => s.members);
  const plates = useModelStore((s) => s.plates);
  const selectedIds = useModelStore((s) => s.selectedIds);
  const selectMultiple = useModelStore((s) => s.selectMultiple);
  const clearSelection = useModelStore((s) => s.clearSelection);
  const selectAll = useModelStore((s) => s.selectAll);
  const invertSelection = useModelStore((s) => s.invertSelection);
  const selectByCoordinate = useModelStore((s) => s.selectByCoordinate);
  const selectParallel = useModelStore((s) => s.selectParallel);
  const selectByProperty = useModelStore((s) => s.selectByProperty);

  // Local state
  const [tab, setTab] = useState<TabId>("ids");
  const [addMode, setAddMode] = useState(false);

  // ID-based selection
  const [idType, setIdType] = useState<"node" | "member" | "plate">("node");
  const [idInput, setIdInput] = useState("");

  // Level-based selection
  const [levelY, setLevelY] = useState(0);
  const [levelTol, setLevelTol] = useState(0.1);

  // Parallel axis
  const [parallel, setParallel] = useState<"x" | "y" | "z">("y");

  // Property
  const [propField, setPropField] = useState<"sectionId" | "sectionType">(
    "sectionId",
  );
  const [propValue, setPropValue] = useState("");

  // ── Derived data ──────────────────────────────────────────────────────────

  const uniqueLevels = useMemo(() => {
    const levels = new Set<number>();
    nodes.forEach((n) => levels.add(Math.round(n.y * 100) / 100));
    return Array.from(levels).sort((a, b) => a - b);
  }, [nodes]);

  const uniqueSections = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.sectionId) set.add(m.sectionId);
    });
    return Array.from(set).sort();
  }, [members]);

  const uniqueSectionTypes = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.sectionType) set.add(m.sectionType);
    });
    return Array.from(set).sort();
  }, [members]);

  // ── Counts ────────────────────────────────────────────────────────────────

  const selectedNodeCount = useMemo(() => {
    let c = 0;
    selectedIds.forEach((id) => {
      if (nodes.has(id)) c++;
    });
    return c;
  }, [selectedIds, nodes]);

  const selectedMemberCount = useMemo(() => {
    let c = 0;
    selectedIds.forEach((id) => {
      if (members.has(id)) c++;
    });
    return c;
  }, [selectedIds, members]);

  const selectedPlateCount = useMemo(() => {
    let c = 0;
    selectedIds.forEach((id) => {
      if (plates.has(id)) c++;
    });
    return c;
  }, [selectedIds, plates]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleSelectByIds = useCallback(() => {
    const prefix = idType === "node" ? "N" : idType === "member" ? "M" : "P";
    const map =
      idType === "node" ? nodes : idType === "member" ? members : plates;
    const parsed = parseIdRange(idInput, prefix);
    const valid = parsed.filter((id) => map.has(id));
    if (valid.length === 0) return;
    if (!addMode) clearSelection();
    selectMultiple(valid);
  }, [
    idType,
    idInput,
    addMode,
    nodes,
    members,
    plates,
    clearSelection,
    selectMultiple,
  ]);

  const handleSelectByLevel = useCallback(() => {
    const half = levelTol;
    selectByCoordinate("y", levelY - half, levelY + half, addMode);
  }, [levelY, levelTol, addMode, selectByCoordinate]);

  const handleSelectParallel = useCallback(() => {
    selectParallel(parallel, addMode);
  }, [parallel, addMode, selectParallel]);

  const handleSelectByProperty = useCallback(() => {
    if (!propValue) return;
    // sectionType isn't in the typed union for selectByProperty, so handle manually
    if (propField === "sectionType") {
      if (!addMode) clearSelection();
      const ids: string[] = [];
      members.forEach((m, id) => {
        if (m.sectionType === propValue) ids.push(id);
      });
      if (ids.length) selectMultiple(ids);
    } else {
      selectByProperty(propField, propValue, addMode);
    }
  }, [
    propField,
    propValue,
    addMode,
    clearSelection,
    members,
    selectMultiple,
    selectByProperty,
  ]);

  const TABS: Array<{
    id: TabId;
    icon: typeof Hash;
    label: string;
    color: string;
  }> = [
    { id: "ids", icon: Hash, label: "By ID", color: "blue" },
    { id: "level", icon: Building2, label: "By Level", color: "green" },
    { id: "parallel", icon: Ruler, label: "Parallel", color: "orange" },
    { id: "property", icon: Layers, label: "Property", color: "purple" },
  ];

  const TAB_STYLES: Record<TabId, { active: string; inactive: string }> = {
    ids: {
      active: "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 bg-blue-500/5",
      inactive: "text-[#869ab8] hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50",
    },
    level: {
      active: "text-green-600 dark:text-green-400 border-b-2 border-green-500 bg-green-500/5",
      inactive: "text-[#869ab8] hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50",
    },
    parallel: {
      active: "text-orange-600 dark:text-orange-400 border-b-2 border-orange-500 bg-orange-500/5",
      inactive: "text-[#869ab8] hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50",
    },
    property: {
      active: "text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 bg-purple-500/5",
      inactive: "text-[#869ab8] hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50",
    },
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <DialogHeader className="px-5 py-3 border-b border-[#1a2333]">
          <div className="flex items-center gap-3">
            <Box className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            <div>
              <DialogTitle className="text-base font-bold text-[#dae2fd] leading-tight">
                Advanced Selection
              </DialogTitle>
              <DialogDescription className="text-[11px] text-[#869ab8]">
                Professional tools for complex structures
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ── Quick Actions Bar ───────────────────────────────────── */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[#1a2333] bg-[#0b1326]">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            className="flex items-center gap-1.5 text-xs"
          >
            <CheckSquare className="w-3.5 h-3.5" /> Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSelection}
            className="flex items-center gap-1.5 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={invertSelection}
            className="flex items-center gap-1.5 text-xs"
          >
            <Shuffle className="w-3.5 h-3.5" /> Invert
          </Button>
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={addMode}
              onChange={(e) => setAddMode(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 bg-[#131b2e] text-blue-500 w-3.5 h-3.5 focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-[11px] text-[#869ab8]">Add to selection</span>
          </label>
        </div>

        {/* ── Tab Strip ───────────────────────────────────────────── */}
        <div className="flex border-b border-[#1a2333]">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const styles = TAB_STYLES[t.id];
            return (
              <button type="button"
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium tracking-wide transition-colors
                  ${active ? styles.active : styles.inactive}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ─── BY ID ──────────────────────────────────────────── */}
          {tab === "ids" && (
            <div className="space-y-4">
              <p className="text-xs text-[#869ab8]">
                Enter IDs separated by commas. Ranges supported:{" "}
                <span className="text-[#adc6ff] font-mono">N1-N10,N15</span>
              </p>

              {/* Entity type selector */}
              <div className="flex gap-1.5 p-1 bg-[#131b2e] rounded-lg">
                {[
                  {
                    key: "node" as const,
                    label: "Nodes",
                    prefix: "N",
                    count: nodes.size,
                  },
                  {
                    key: "member" as const,
                    label: "Members",
                    prefix: "M",
                    count: members.size,
                  },
                  {
                    key: "plate" as const,
                    label: "Plates",
                    prefix: "P",
                    count: plates.size,
                  },
                ].map((e) => (
                  <button type="button"
                    key={e.key}
                    onClick={() => {
                      setIdType(e.key);
                      setIdInput("");
                    }}
                    className={`flex-1 py-1.5 text-xs font-medium tracking-wide rounded-md transition-all ${
                      idType === e.key
                        ? "bg-blue-600 text-white shadow-lg"
                        : "text-[#869ab8] hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    {e.label} ({e.count})
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSelectByIds()}
                placeholder={
                  idType === "node"
                    ? "e.g. N1,N3-N8,N12"
                    : idType === "member"
                      ? "e.g. M1-M5,M10"
                      : "e.g. P1-P4"
                }
                className="w-full px-3 py-2 bg-[#131b2e] border border-[#1a2333] rounded-lg text-sm text-[#dae2fd] placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
              />

              <Button
                onClick={handleSelectByIds}
                disabled={!idInput.trim()}
                className="w-full flex items-center justify-center gap-2"
              >
                Select{" "}
                {idType === "node"
                  ? "Nodes"
                  : idType === "member"
                    ? "Members"
                    : "Plates"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* ─── BY LEVEL / Y-COORDINATE ─────────────────────── */}
          {tab === "level" && (
            <div className="space-y-4">
              <p className="text-xs text-[#869ab8]">
                Select all nodes &amp; members at a floor elevation
                (Y-coordinate).
              </p>

              {/* Quick-pick level buttons */}
              {uniqueLevels.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                    Quick Pick
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueLevels.map((y) => (
                      <button type="button"
                        key={y}
                        onClick={() => setLevelY(y)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors ${
                          Math.abs(levelY - y) < 0.001
                            ? "bg-green-600 text-white"
                            : "bg-[#131b2e] text-[#adc6ff] hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        Y&thinsp;=&thinsp;{y.toFixed(2)}&thinsp;m
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                    Elevation (m)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={levelY}
                    onChange={(e) => setLevelY(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-[#131b2e] border border-[#1a2333] rounded-lg text-sm text-[#dae2fd] focus:border-green-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                    Tolerance (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={levelTol}
                    onChange={(e) =>
                      setLevelTol(parseFloat(e.target.value) || 0.1)
                    }
                    className="w-full px-3 py-2 bg-[#131b2e] border border-[#1a2333] rounded-lg text-sm text-[#dae2fd] focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <Button
                onClick={handleSelectByLevel}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white"
              >
                Select at Y&thinsp;=&thinsp;{levelY.toFixed(2)}&thinsp;m
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* ─── PARALLEL TO AXIS ────────────────────────────── */}
          {tab === "parallel" && (
            <div className="space-y-4">
              <p className="text-xs text-[#869ab8]">
                Select all members aligned with a global axis.
              </p>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "x" as const, label: "X-Axis", desc: "Beams (EW)" },
                  { key: "y" as const, label: "Y-Axis", desc: "Columns" },
                  { key: "z" as const, label: "Z-Axis", desc: "Beams (NS)" },
                ].map((a) => (
                  <button type="button"
                    key={a.key}
                    onClick={() => setParallel(a.key)}
                    className={`py-3 rounded-lg font-medium tracking-wide transition-all text-center ${
                      parallel === a.key
                        ? "bg-orange-600 text-white shadow-lg"
                        : "bg-[#131b2e] text-[#adc6ff] hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span className="text-sm">{a.label}</span>
                    <div className="text-[10px] opacity-70 mt-0.5">
                      {a.desc}
                    </div>
                  </button>
                ))}
              </div>

              <Button
                onClick={handleSelectParallel}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white"
              >
                Select Parallel to {parallel.toUpperCase()}-Axis
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* ─── BY PROPERTY ─────────────────────────────────── */}
          {tab === "property" && (
            <div className="space-y-4">
              <p className="text-xs text-[#869ab8]">
                Select members sharing a common section or shape type.
              </p>

              {/* Property field selector */}
              <div className="flex gap-1.5 p-1 bg-[#131b2e] rounded-lg">
                <button type="button"
                  onClick={() => {
                    setPropField("sectionId");
                    setPropValue("");
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium tracking-wide rounded-md transition-all ${
                    propField === "sectionId"
                      ? "bg-purple-600 text-white"
                      : "text-[#869ab8] hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  Section ID
                </button>
                <button type="button"
                  onClick={() => {
                    setPropField("sectionType");
                    setPropValue("");
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium tracking-wide rounded-md transition-all ${
                    propField === "sectionType"
                      ? "bg-purple-600 text-white"
                      : "text-[#869ab8] hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  Shape Type
                </button>
              </div>

              {propField === "sectionId" ? (
                uniqueSections.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 dark:text-slate-500 bg-[#131b2e] rounded-lg border border-[#1a2333]">
                    No sections assigned yet.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueSections.map((s) => (
                      <button type="button"
                        key={s}
                        onClick={() => setPropValue(s)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors ${
                          propValue === s
                            ? "bg-purple-600 text-white"
                            : "bg-[#131b2e] text-[#adc6ff] hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )
              ) : uniqueSectionTypes.length === 0 ? (
                <div className="p-3 text-xs text-slate-500 dark:text-slate-500 bg-[#131b2e] rounded-lg border border-[#1a2333]">
                  No section shapes assigned yet.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {uniqueSectionTypes.map((s) => (
                    <button type="button"
                      key={s}
                      onClick={() => setPropValue(s)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors ${
                        propValue === s
                          ? "bg-purple-600 text-white"
                          : "bg-[#131b2e] text-[#adc6ff] hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <Button
                onClick={handleSelectByProperty}
                disabled={!propValue}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
              >
                Select by {propField === "sectionId" ? "Section" : "Shape"}:{" "}
                {propValue || "—"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <DialogFooter className="flex items-center justify-between px-5 py-3 border-t border-[#1a2333] bg-[#131b2e]">
          <div className="flex items-center gap-3 text-[11px] text-[#869ab8]">
            <span className="flex items-center gap-1">
              <MousePointer2 className="w-3 h-3 text-blue-500 dark:text-blue-400" />
              <span className="font-medium tracking-wide text-[#dae2fd]">
                {selectedIds.size}
              </span>{" "}
              selected
            </span>
            <span className="text-slate-600 dark:text-slate-600">|</span>
            <span>{selectedNodeCount} nodes</span>
            <span>{selectedMemberCount} members</span>
            {selectedPlateCount > 0 && <span>{selectedPlateCount} plates</span>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SelectionToolbar;
