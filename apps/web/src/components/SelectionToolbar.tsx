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
  X,
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

  if (!open) return null;

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
      active: "text-blue-400 border-b-2 border-blue-500 bg-blue-500/5",
      inactive: "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
    },
    level: {
      active: "text-green-400 border-b-2 border-green-500 bg-green-500/5",
      inactive: "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
    },
    parallel: {
      active: "text-orange-400 border-b-2 border-orange-500 bg-orange-500/5",
      inactive: "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
    },
    property: {
      active: "text-purple-400 border-b-2 border-purple-500 bg-purple-500/5",
      inactive: "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
    },
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900">
          <div className="flex items-center gap-3">
            <Box className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Advanced Selection
              </h2>
              <p className="text-[11px] text-slate-400">
                Professional tools for complex structures
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Quick Actions Bar ───────────────────────────────────── */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-800 bg-slate-900/80">
          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5" /> Select All
          </button>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>
          <button
            onClick={invertSelection}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" /> Invert
          </button>
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={addMode}
              onChange={(e) => setAddMode(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-blue-500 w-3.5 h-3.5 focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-[11px] text-slate-400">Add to selection</span>
          </label>
        </div>

        {/* ── Tab Strip ───────────────────────────────────────────── */}
        <div className="flex border-b border-slate-800">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const styles = TAB_STYLES[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors
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
              <p className="text-xs text-slate-400">
                Enter IDs separated by commas. Ranges supported:{" "}
                <span className="text-slate-300 font-mono">N1-N10,N15</span>
              </p>

              {/* Entity type selector */}
              <div className="flex gap-1.5 p-1 bg-slate-800/60 rounded-lg">
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
                  <button
                    key={e.key}
                    onClick={() => {
                      setIdType(e.key);
                      setIdInput("");
                    }}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      idType === e.key
                        ? "bg-blue-600 text-white shadow-lg"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
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
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
              />

              <button
                onClick={handleSelectByIds}
                disabled={!idInput.trim()}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  idInput.trim()
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 active:scale-[.98]"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                Select{" "}
                {idType === "node"
                  ? "Nodes"
                  : idType === "member"
                    ? "Members"
                    : "Plates"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ─── BY LEVEL / Y-COORDINATE ─────────────────────── */}
          {tab === "level" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Select all nodes &amp; members at a floor elevation
                (Y-coordinate).
              </p>

              {/* Quick-pick level buttons */}
              {uniqueLevels.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    Quick Pick
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueLevels.map((y) => (
                      <button
                        key={y}
                        onClick={() => setLevelY(y)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          Math.abs(levelY - y) < 0.001
                            ? "bg-green-600 text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
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
                  <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    Elevation (m)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={levelY}
                    onChange={(e) => setLevelY(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-green-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    Tolerance (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={levelTol}
                    onChange={(e) =>
                      setLevelTol(parseFloat(e.target.value) || 0.1)
                    }
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleSelectByLevel}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-green-900/30 active:scale-[.98]"
              >
                Select at Y&thinsp;=&thinsp;{levelY.toFixed(2)}&thinsp;m
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ─── PARALLEL TO AXIS ────────────────────────────── */}
          {tab === "parallel" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Select all members aligned with a global axis.
              </p>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "x" as const, label: "X-Axis", desc: "Beams (EW)" },
                  { key: "y" as const, label: "Y-Axis", desc: "Columns" },
                  { key: "z" as const, label: "Z-Axis", desc: "Beams (NS)" },
                ].map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setParallel(a.key)}
                    className={`py-3 rounded-lg font-medium transition-all text-center ${
                      parallel === a.key
                        ? "bg-orange-600 text-white shadow-lg"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <span className="text-sm">{a.label}</span>
                    <div className="text-[10px] opacity-70 mt-0.5">
                      {a.desc}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleSelectParallel}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-orange-900/30 active:scale-[.98]"
              >
                Select Parallel to {parallel.toUpperCase()}-Axis
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ─── BY PROPERTY ─────────────────────────────────── */}
          {tab === "property" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Select members sharing a common section or shape type.
              </p>

              {/* Property field selector */}
              <div className="flex gap-1.5 p-1 bg-slate-800/60 rounded-lg">
                <button
                  onClick={() => {
                    setPropField("sectionId");
                    setPropValue("");
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    propField === "sectionId"
                      ? "bg-purple-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Section ID
                </button>
                <button
                  onClick={() => {
                    setPropField("sectionType");
                    setPropValue("");
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    propField === "sectionType"
                      ? "bg-purple-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Shape Type
                </button>
              </div>

              {propField === "sectionId" ? (
                uniqueSections.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 bg-slate-800/40 rounded-lg border border-slate-800">
                    No sections assigned yet.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueSections.map((s) => (
                      <button
                        key={s}
                        onClick={() => setPropValue(s)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          propValue === s
                            ? "bg-purple-600 text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )
              ) : uniqueSectionTypes.length === 0 ? (
                <div className="p-3 text-xs text-slate-500 bg-slate-800/40 rounded-lg border border-slate-800">
                  No section shapes assigned yet.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {uniqueSectionTypes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setPropValue(s)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        propValue === s
                          ? "bg-purple-600 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={handleSelectByProperty}
                disabled={!propValue}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  propValue
                    ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/30 active:scale-[.98]"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                Select by {propField === "sectionId" ? "Section" : "Shape"}:{" "}
                {propValue || "—"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <MousePointer2 className="w-3 h-3 text-blue-400" />
              <span className="font-medium text-white">
                {selectedIds.size}
              </span>{" "}
              selected
            </span>
            <span className="text-slate-600">|</span>
            <span>{selectedNodeCount} nodes</span>
            <span>{selectedMemberCount} members</span>
            {selectedPlateCount > 0 && <span>{selectedPlateCount} plates</span>}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectionToolbar;
