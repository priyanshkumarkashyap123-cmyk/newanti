/**
 * PostProcessingDesignStudio — STAAD-Pro-class post-processing & design panel
 *
 * Designed for structural engineers:
 *   • Member-by-member design summary (PASS / FAIL / utilization bars)
 *   • RC Beam design — section properties, reinforcement selection, cross-section SVG
 *   • RC Column design — interaction diagram, rebar layout
 *   • Steel design — AISC 360 / IS 800 checks, governing clause
 *   • Section properties table (A, I, Z, r, J)
 *   • Deflection compliance check (span/depth ratio vs code limit)
 *   • Export design report (PDF-ready summary)
 *
 * Consumes data from the Zustand model store (analysisResults + members + nodes).
 */

import React, { FC, useState, useMemo, useCallback, Fragment } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  BarChart3,
  Ruler,
  Shield,
  Layers,
  Grid3X3,
  ArrowUpDown,
  Columns3,
  Filter,
  Printer,
  FileText,
  Building2,
  Box,
  CircleDot,
  Minus,
  Plus,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";

import {
  useModelStore,
  type AnalysisResults,
  type Member,
  type MemberForceData,
} from "../../store/model";
import {
  RCBeamDesigner,
  type BeamDesignResult,
  type BeamInputs,
} from "../../utils/RCBeamDesigner";
import {
  MemberDesignService,
  type DesignInput,
  type DesignResult as MemberDesignResult,
  type DesignCheck,
} from "../../services/MemberDesignService";

// ============================================
// TYPES
// ============================================

interface DesignStudioProps {
  onClose: () => void;
}

type TabId =
  | "summary"
  | "rcBeam"
  | "rcColumn"
  | "steel"
  | "section"
  | "deflection";

interface MemberDesignRow {
  id: string;
  label: string;
  length: number;
  materialType: "steel" | "concrete" | "custom";
  sectionType: string;
  // forces (max envelope)
  maxAxial: number;
  maxShearY: number;
  maxMomentZ: number;
  // design result
  utilization: number;
  status: "PASS" | "FAIL" | "WARNING";
  governing: string;
  designResult: MemberDesignResult;
}

type SortKey =
  | "id"
  | "length"
  | "utilization"
  | "maxMomentZ"
  | "maxShearY"
  | "maxAxial";

// ============================================
// HELPERS
// ============================================

/** Compute member length from node coordinates */
function memberLength(
  m: Member,
  nodes: Map<string, { x: number; y: number; z?: number }>,
): number {
  const n1 = nodes.get(m.startNodeId);
  const n2 = nodes.get(m.endNodeId);
  if (!n1 || !n2) return 5;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const dz = (n2.z ?? 0) - (n1.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
}

/** Status badge colors */
const statusColors = {
  PASS: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-400",
    border: "border-emerald-500",
    dot: "bg-emerald-500",
  },
  FAIL: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    border: "border-red-500",
    dot: "bg-red-500",
  },
  WARNING: {
    bg: "bg-amber-500/20",
    text: "text-amber-400",
    border: "border-amber-500",
    dot: "bg-amber-500",
  },
};

/** Utilization bar color */
function utilizationColor(u: number): string {
  if (u <= 0.6) return "bg-emerald-500";
  if (u <= 0.8) return "bg-lime-500";
  if (u <= 0.9) return "bg-amber-500";
  if (u <= 1.0) return "bg-orange-500";
  return "bg-red-500";
}

function utilizationTextColor(u: number): string {
  if (u <= 0.6) return "text-emerald-400";
  if (u <= 0.8) return "text-lime-400";
  if (u <= 0.9) return "text-amber-400";
  if (u <= 1.0) return "text-orange-400";
  return "text-red-400";
}

/** Format kN with sign */
function fmtForce(v: number): string {
  return v.toFixed(2);
}

// ============================================
// SVG Cross-Section Drawing for RC Beam
// ============================================

const RCBeamCrossSection: FC<{
  b: number;
  d: number;
  cover: number;
  mainBars: { count: number; diameter: number };
  stirrupDia: number;
  topBars?: { count: number; diameter: number };
}> = ({ b, d, cover, mainBars, stirrupDia, topBars }) => {
  const svgW = 320;
  const svgH = 400;
  const margin = { top: 24, right: 55, bottom: 50, left: 55 };
  const drawW = svgW - margin.left - margin.right;
  const drawH = svgH - margin.top - margin.bottom;

  // Scale to fit while preserving aspect ratio
  const D = d + (cover ?? 40);
  const aspect = b / D;
  let W: number, H: number;
  if (aspect > drawW / drawH) {
    W = drawW;
    H = drawW / aspect;
  } else {
    H = drawH;
    W = drawH * aspect;
  }
  const ox = margin.left + (drawW - W) / 2;
  const oy = margin.top + (drawH - H) / 2;
  const sc = W / b;

  const coverPx = cover * sc;
  const stirPx = Math.max(stirrupDia * sc, 1.5);
  const mainDiaPx = Math.max(mainBars.diameter * sc, 6);
  const topDiaPx = topBars ? Math.max(topBars.diameter * sc, 5) : 5;

  // Stirrup rect with cover offset
  const sx = ox + coverPx;
  const sy = oy + coverPx;
  const sw = W - 2 * coverPx;
  const sh = H - 2 * coverPx;

  // Multi-layer check
  const maxPerRow = 4;
  const needsSecondLayer = mainBars.count > maxPerRow;
  const layer1Count = needsSecondLayer ? maxPerRow : mainBars.count;
  const layer2Count = needsSecondLayer ? mainBars.count - maxPerRow : 0;
  const layerGap = mainDiaPx * 2.5;

  // Bottom bars
  const barY1 = oy + H - coverPx - stirPx - mainDiaPx / 2;
  const barY2 = barY1 - layerGap;
  const spacing1 =
    layer1Count > 1 ? (sw - 2 * stirPx - mainDiaPx) / (layer1Count - 1) : 0;
  const startX = sx + stirPx + mainDiaPx / 2;

  // Top bars positions
  const topBarY = oy + coverPx + stirPx + topDiaPx / 2;
  const topCount = topBars?.count ?? 2;
  const topSpacing =
    topCount > 1 ? (sw - 2 * stirPx - topDiaPx) / (topCount - 1) : 0;
  const topStartX = sx + stirPx + topDiaPx / 2;

  // Neutral axis approximate position (0.45d)
  const naY = oy + 0.45 * d * sc;

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="mx-auto"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <defs>
        <pattern
          id="pds-hatch"
          width={5}
          height={5}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={5}
            stroke="#71717a"
            strokeWidth={0.4}
          />
        </pattern>
        <marker
          id="pds-arrow-cyan"
          viewBox="0 0 10 10"
          refX={10}
          refY={5}
          markerWidth={3}
          markerHeight={3}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" />
        </marker>
      </defs>

      {/* Concrete body with hatch */}
      <rect x={ox} y={oy} width={W} height={H} fill="url(#pds-hatch)" />
      <rect
        x={ox}
        y={oy}
        width={W}
        height={H}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={2}
        rx={2}
      />

      {/* Stirrup with 135° hooks */}
      <rect
        x={sx}
        y={sy}
        width={sw}
        height={sh}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={Math.max(stirPx, 1.8)}
        rx={3}
      />
      {/* 135° hooks */}
      <line
        x1={sx + 8}
        y1={sy}
        x2={sx + 8 + 10 * Math.cos(Math.PI * 0.75)}
        y2={sy + 10 * Math.sin(Math.PI * 0.75)}
        stroke="#3b82f6"
        strokeWidth={Math.max(stirPx, 1.8)}
        strokeLinecap="round"
      />
      <line
        x1={sx + sw - 8}
        y1={sy}
        x2={sx + sw - 8 - 10 * Math.cos(Math.PI * 0.75)}
        y2={sy + 10 * Math.sin(Math.PI * 0.75)}
        stroke="#3b82f6"
        strokeWidth={Math.max(stirPx, 1.8)}
        strokeLinecap="round"
      />

      {/* Bottom tension bars — layer 1 */}
      {Array.from({ length: layer1Count }).map((_, i) => {
        const cx =
          layer1Count === 1
            ? startX + (sw - 2 * stirPx - mainDiaPx) / 2
            : startX + i * spacing1;
        return (
          <circle
            key={`bot1-${i}`}
            cx={cx}
            cy={barY1}
            r={mainDiaPx / 2}
            fill="#ef4444"
            stroke="#991b1b"
            strokeWidth={0.8}
          />
        );
      })}
      {/* Layer 2 */}
      {layer2Count > 0 &&
        (() => {
          const sp2 =
            layer2Count > 1
              ? (sw - 2 * stirPx - mainDiaPx) / (layer2Count - 1)
              : 0;
          return Array.from({ length: layer2Count }).map((_, i) => {
            const cx =
              layer2Count === 1
                ? startX + (sw - 2 * stirPx - mainDiaPx) / 2
                : startX + i * sp2;
            return (
              <circle
                key={`bot2-${i}`}
                cx={cx}
                cy={barY2}
                r={mainDiaPx / 2}
                fill="#ef4444"
                stroke="#991b1b"
                strokeWidth={0.8}
              />
            );
          });
        })()}

      {/* Top (hanger / compression) bars */}
      {Array.from({ length: topCount }).map((_, i) => {
        const cx =
          topCount === 1
            ? topStartX + (sw - 2 * stirPx - topDiaPx) / 2
            : topStartX + i * topSpacing;
        return (
          <circle
            key={`top-${i}`}
            cx={cx}
            cy={topBarY}
            r={topDiaPx / 2}
            fill="#f97316"
            stroke="#9a3412"
            strokeWidth={0.8}
          />
        );
      })}

      {/* Neutral axis */}
      <line
        x1={ox - 4}
        y1={naY}
        x2={ox + W + 4}
        y2={naY}
        stroke="#facc15"
        strokeWidth={0.8}
        strokeDasharray="5,3"
      />
      <text x={ox + W + 6} y={naY + 3} fontSize={7} fill="#facc15">
        N.A.
      </text>

      {/* Cover annotation — bottom */}
      <line
        x1={ox - 5}
        y1={oy + H}
        x2={ox - 5}
        y2={oy + H - coverPx}
        stroke="#22d3ee"
        strokeWidth={0.8}
        markerStart="url(#pds-arrow-cyan)"
        markerEnd="url(#pds-arrow-cyan)"
      />
      <text
        x={ox - 9}
        y={oy + H - coverPx / 2 + 3}
        textAnchor="end"
        fontSize={7}
        fill="#22d3ee"
        fontWeight={600}
      >
        {cover}
      </text>

      {/* Cover annotation — side */}
      <line
        x1={ox}
        y1={oy + H + 5}
        x2={ox + coverPx}
        y2={oy + H + 5}
        stroke="#22d3ee"
        strokeWidth={0.8}
      />
      <line
        x1={ox}
        y1={oy + H + 2}
        x2={ox}
        y2={oy + H + 8}
        stroke="#22d3ee"
        strokeWidth={0.5}
      />
      <line
        x1={ox + coverPx}
        y1={oy + H + 2}
        x2={ox + coverPx}
        y2={oy + H + 8}
        stroke="#22d3ee"
        strokeWidth={0.5}
      />
      <text
        x={ox + coverPx / 2}
        y={oy + H + 16}
        textAnchor="middle"
        fontSize={7}
        fill="#22d3ee"
      >
        {cover}
      </text>

      {/* Width dimension */}
      <line
        x1={ox}
        y1={oy + H + 22}
        x2={ox + W}
        y2={oy + H + 22}
        stroke="#a1a1aa"
        strokeWidth={0.6}
      />
      <line
        x1={ox}
        y1={oy + H + 10}
        x2={ox}
        y2={oy + H + 26}
        stroke="#a1a1aa"
        strokeWidth={0.5}
      />
      <line
        x1={ox + W}
        y1={oy + H + 10}
        x2={ox + W}
        y2={oy + H + 26}
        stroke="#a1a1aa"
        strokeWidth={0.5}
      />
      <line
        x1={ox - 3}
        y1={oy + H + 25}
        x2={ox + 3}
        y2={oy + H + 19}
        stroke="#a1a1aa"
        strokeWidth={0.8}
      />
      <line
        x1={ox + W - 3}
        y1={oy + H + 25}
        x2={ox + W + 3}
        y2={oy + H + 19}
        stroke="#a1a1aa"
        strokeWidth={0.8}
      />
      <text
        x={ox + W / 2}
        y={oy + H + 35}
        textAnchor="middle"
        fontSize={10}
        fill="#a1a1aa"
        fontWeight={500}
      >
        {b} mm
      </text>

      {/* Depth dimension */}
      <line
        x1={ox + W + 22}
        y1={oy}
        x2={ox + W + 22}
        y2={oy + H}
        stroke="#a1a1aa"
        strokeWidth={0.6}
      />
      <line
        x1={ox + W + 10}
        y1={oy}
        x2={ox + W + 26}
        y2={oy}
        stroke="#a1a1aa"
        strokeWidth={0.5}
      />
      <line
        x1={ox + W + 10}
        y1={oy + H}
        x2={ox + W + 26}
        y2={oy + H}
        stroke="#a1a1aa"
        strokeWidth={0.5}
      />
      <line
        x1={ox + W + 19}
        y1={oy + 3}
        x2={ox + W + 25}
        y2={oy - 3}
        stroke="#a1a1aa"
        strokeWidth={0.8}
      />
      <line
        x1={ox + W + 19}
        y1={oy + H + 3}
        x2={ox + W + 25}
        y2={oy + H - 3}
        stroke="#a1a1aa"
        strokeWidth={0.8}
      />
      <text
        x={ox + W + 36}
        y={oy + H / 2}
        textAnchor="middle"
        fontSize={10}
        fill="#a1a1aa"
        fontWeight={500}
        transform={`rotate(-90, ${ox + W + 36}, ${oy + H / 2})`}
      >
        {D.toFixed(0)} mm
      </text>

      {/* Bar callouts */}
      <line
        x1={startX + (layer1Count > 1 ? spacing1 * (layer1Count - 1) : 0)}
        y1={barY1}
        x2={ox + W + 8}
        y2={barY1 - 10}
        stroke="#71717a"
        strokeWidth={0.5}
      />
      <text x={ox + W + 10} y={barY1 - 7} fontSize={7} fill="#e2e8f0">
        {mainBars.count}-T{mainBars.diameter}
      </text>
      <line
        x1={topStartX + (topCount > 1 ? topSpacing * (topCount - 1) : 0)}
        y1={topBarY}
        x2={ox + W + 8}
        y2={topBarY + 10}
        stroke="#71717a"
        strokeWidth={0.5}
      />
      <text x={ox + W + 10} y={topBarY + 13} fontSize={7} fill="#e2e8f0">
        {topCount}-T{topBars?.diameter || 12}
      </text>

      {/* Legend */}
      <g transform={`translate(${margin.left - 10}, ${svgH - 14})`}>
        <circle
          cx={6}
          cy={-2}
          r={4}
          fill="#ef4444"
          stroke="#991b1b"
          strokeWidth={0.5}
        />
        <text x={14} y={2} fontSize={7} fill="#a1a1aa">
          Tension
        </text>
        <circle
          cx={62}
          cy={-2}
          r={3}
          fill="#f97316"
          stroke="#9a3412"
          strokeWidth={0.5}
        />
        <text x={70} y={2} fontSize={7} fill="#a1a1aa">
          Hanger
        </text>
        <rect
          x={110}
          y={-5}
          width={10}
          height={6}
          rx={1}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1}
        />
        <text x={124} y={2} fontSize={7} fill="#a1a1aa">
          Stirrup
        </text>
        <line
          x1={160}
          y1={-2}
          x2={176}
          y2={-2}
          stroke="#facc15"
          strokeWidth={0.8}
          strokeDasharray="4,2"
        />
        <text x={180} y={2} fontSize={7} fill="#a1a1aa">
          N.A.
        </text>
        <line
          x1={200}
          y1={-2}
          x2={212}
          y2={-2}
          stroke="#22d3ee"
          strokeWidth={1}
        />
        <text x={216} y={2} fontSize={7} fill="#a1a1aa">
          Cover
        </text>
      </g>
    </svg>
  );
};

// ============================================
// TAB COMPONENTS
// ============================================

// ---- 1. MEMBER DESIGN SUMMARY TABLE ----

const SummaryTab: FC<{
  rows: MemberDesignRow[];
  onSelectMember: (id: string) => void;
  selectedId: string | null;
}> = ({ rows, onSelectMember, selectedId }) => {
  const [sortKey, setSortKey] = useState<SortKey>("utilization");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "PASS" | "FAIL" | "WARNING"
  >("all");

  const sorted = useMemo(() => {
    let filtered = rows;
    if (filterText) {
      const lc = filterText.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.id.toLowerCase().includes(lc) || r.label.toLowerCase().includes(lc),
      );
    }
    if (filterStatus !== "all") {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }
    const copy = [...filtered];
    copy.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      switch (sortKey) {
        case "id":
          va = a.id;
          vb = b.id;
          break;
        case "length":
          va = a.length;
          vb = b.length;
          break;
        case "utilization":
          va = a.utilization;
          vb = b.utilization;
          break;
        case "maxMomentZ":
          va = Math.abs(a.maxMomentZ);
          vb = Math.abs(b.maxMomentZ);
          break;
        case "maxShearY":
          va = Math.abs(a.maxShearY);
          vb = Math.abs(b.maxShearY);
          break;
        case "maxAxial":
          va = Math.abs(a.maxAxial);
          vb = Math.abs(b.maxAxial);
          break;
      }
      if (typeof va === "string" && typeof vb === "string")
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc
        ? (va as number) - (vb as number)
        : (vb as number) - (va as number);
    });
    return copy;
  }, [rows, sortKey, sortAsc, filterText, filterStatus]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const passCount = rows.filter((r) => r.status === "PASS").length;
  const failCount = rows.filter((r) => r.status === "FAIL").length;
  const warnCount = rows.filter((r) => r.status === "WARNING").length;

  const SortHeader: FC<{ label: string; k: SortKey; className?: string }> = ({
    label,
    k,
    className,
  }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-800 dark:text-slate-200 select-none whitespace-nowrap ${className ?? ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k && <ArrowUpDown className="w-3 h-3" />}
      </span>
    </th>
  );

  return (
    <div className="flex flex-col h-full">
      {/* KPI Banner */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-slate-300/60 dark:border-slate-700/60 bg-slate-100/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${statusColors.PASS.dot}`}
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">{passCount} Pass</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${statusColors.WARNING.dot}`}
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">{warnCount} Warning</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${statusColors.FAIL.dot}`}
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">{failCount} Fail</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{rows.length} members</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-slate-300/40 dark:border-slate-700/40 bg-slate-100/30 dark:bg-slate-800/30">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search members..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-slate-700 dark:text-slate-300"
        >
          <option value="all">All Statuses</option>
          <option value="PASS">Pass Only</option>
          <option value="FAIL">Fail Only</option>
          <option value="WARNING">Warnings</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
            <tr>
              <SortHeader label="Member" k="id" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Type
              </th>
              <SortHeader label="Length (m)" k="length" />
              <SortHeader label="Axial (kN)" k="maxAxial" />
              <SortHeader label="Shear (kN)" k="maxShearY" />
              <SortHeader label="Moment (kN·m)" k="maxMomentZ" />
              <SortHeader
                label="Utilization"
                k="utilization"
                className="min-w-[160px]"
              />
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Governing
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {sorted.map((row) => {
              const sc = statusColors[row.status];
              const isSelected = selectedId === row.id;
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelectMember(row.id)}
                  className={`cursor-pointer transition-colors ${isSelected ? "bg-blue-100/30 dark:bg-blue-900/30 border-l-2 border-l-blue-500" : "hover:bg-slate-100/60 dark:hover:bg-slate-800/60"}`}
                >
                  <td className="px-3 py-2.5 font-mono font-medium text-slate-800 dark:text-slate-200">
                    {row.label}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 capitalize">
                    {row.materialType}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                    {row.length.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                    {fmtForce(row.maxAxial)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                    {fmtForce(row.maxShearY)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                    {fmtForce(row.maxMomentZ)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${utilizationColor(row.utilization)}`}
                          style={{
                            width: `${Math.min(row.utilization * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span
                        className={`text-xs font-bold font-mono w-12 text-right ${utilizationTextColor(row.utilization)}`}
                      >
                        {(row.utilization * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${sc.bg} ${sc.text}`}
                    >
                      {row.status === "PASS" ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : row.status === "FAIL" ? (
                        <XCircle className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 max-w-[120px] truncate">
                    {row.governing}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-slate-500 text-sm">
            No members match the filters.
          </div>
        )}
      </div>
    </div>
  );
};

// ---- 2. RC BEAM DESIGN TAB ----

const RCBeamTab: FC<{
  rows: MemberDesignRow[];
  selectedId: string | null;
  onSelectMember: (id: string) => void;
}> = ({ rows, selectedId, onSelectMember }) => {
  const concreteRows = useMemo(
    () => rows.filter((r) => r.materialType === "concrete"),
    [rows],
  );
  const [designCode, setDesignCode] = useState<"IS456" | "ACI318">("IS456");
  const [fck, setFck] = useState(25);
  const [fy, setFy] = useState(415);
  const [cover, setCover] = useState(40);
  const [beamB, setBeamB] = useState(300);
  const [beamD, setBeamD] = useState(500);

  const activeMember =
    concreteRows.find((r) => r.id === selectedId) ?? concreteRows[0];

  const rcResult = useMemo((): BeamDesignResult | null => {
    if (!activeMember) return null;
    const b = beamB;
    const d = beamD - cover - 25; // effective depth
    const inputs: BeamInputs = {
      Mu: Math.abs(activeMember.maxMomentZ),
      Vu: Math.abs(activeMember.maxShearY),
      b,
      d,
      fc: fck,
      fy,
      cover,
      units: "SI",
    };
    try {
      return RCBeamDesigner.design(inputs);
    } catch {
      return null;
    }
  }, [activeMember, fck, fy, cover, designCode, beamB, beamD]);

  if (concreteRows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center space-y-3 max-w-xs">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100/60 dark:bg-slate-800/60 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-slate-500 opacity-50" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No Concrete Members Found</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            This model does not contain any members with concrete material properties.
            Assign a concrete material type (e.g., M20, M25) to one or more members to enable RC beam design.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Member Sidebar */}
      <div className="w-56 border-r border-slate-300/60 dark:border-slate-700/60 bg-slate-100/40 dark:bg-slate-800/40 flex flex-col">
        <div className="px-3 py-2 border-b border-slate-300/40 dark:border-slate-700/40 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Concrete Members ({concreteRows.length})
        </div>
        <div className="flex-1 overflow-auto scroll-smooth">
          {concreteRows.map((r) => (
            <button type="button"
              key={r.id}
              onClick={() => onSelectMember(r.id)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-slate-200/60 dark:border-slate-800/60 transition-colors ${
                r.id === activeMember?.id
                  ? "bg-blue-900/30 text-blue-300 border-l-2 border-l-blue-400"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/40 dark:hover:bg-slate-700/40 border-l-2 border-l-transparent"
              }`}
            >
              <div className="font-mono font-medium truncate">{r.label}</div>
              <div className="text-xs text-slate-500 truncate">
                M = {Math.abs(r.maxMomentZ).toFixed(1)} kN·m, V ={" "}
                {Math.abs(r.maxShearY).toFixed(1)} kN
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Design Panel */}
      <div className="flex-1 overflow-auto p-5 space-y-5">
        {activeMember && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  RC Beam Design — Member {activeMember.label}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  L = {activeMember.length.toFixed(2)} m
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={designCode}
                  onChange={(e) => setDesignCode(e.target.value as any)}
                  className="text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
                >
                  <option value="IS456">IS 456:2000</option>
                  <option value="ACI318">ACI 318-19</option>
                </select>
              </div>
            </div>

            {/* Input Parameters */}
            <div className="bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-300/40 dark:border-slate-700/40">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Material & Section Parameters
              </h4>
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <label className="text-xs text-slate-500">
                    f'c / fck (MPa)
                  </label>
                  <input
                    type="number"
                    value={fck}
                    min={15}
                    max={100}
                    onChange={(e) => setFck(+e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">fy (MPa)</label>
                  <input
                    type="number"
                    value={fy}
                    min={250}
                    max={600}
                    onChange={(e) => setFy(+e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">
                    Clear cover (mm)
                  </label>
                  <input
                    type="number"
                    value={cover}
                    min={20}
                    max={75}
                    onChange={(e) => setCover(+e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Width b (mm)</label>
                  <input
                    type="number"
                    value={beamB}
                    min={150}
                    max={1000}
                    onChange={(e) => setBeamB(+e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">
                    Total Depth D (mm)
                  </label>
                  <input
                    type="number"
                    value={beamD}
                    min={200}
                    max={2000}
                    onChange={(e) => setBeamD(+e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Applied Forces */}
            <div className="bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-300/40 dark:border-slate-700/40">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Applied Forces (Factored)
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 mb-1">Mu (Moment)</div>
                  <div className="text-xl font-bold font-mono text-purple-400">
                    {Math.abs(activeMember.maxMomentZ).toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">kN·m</div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 mb-1">Vu (Shear)</div>
                  <div className="text-xl font-bold font-mono text-blue-400">
                    {Math.abs(activeMember.maxShearY).toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">kN</div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 mb-1">Nu (Axial)</div>
                  <div
                    className={`text-xl font-bold font-mono ${activeMember.maxAxial >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {activeMember.maxAxial.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">kN</div>
                </div>
              </div>
            </div>

            {rcResult && (
              <>
                {/* Flexure Design Results */}
                <div className="bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-300/40 dark:border-slate-700/40">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    Flexure Design
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        rcResult.flexure.status === "OK"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {rcResult.flexure.status}
                    </span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">
                          A<sub>s,required</sub>
                        </span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.flexure.As_required.toFixed(1)} mm²
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">
                          A<sub>s,provided</sub>
                        </span>
                        <span className="font-mono text-blue-400 font-bold">
                          {rcResult.flexure.As_provided.toFixed(1)} mm²
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">
                          A<sub>s,min</sub>
                        </span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {rcResult.flexure.As_min.toFixed(1)} mm²
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">
                          A<sub>s,max</sub>
                        </span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {rcResult.flexure.As_max.toFixed(1)} mm²
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Reinforcement</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {rcResult.flexure.numBars} – Ø
                          {rcResult.flexure.barSize}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Steel ratio ρ</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {(rcResult.flexure.rho * 100).toFixed(3)} %
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">N.A. depth c</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.flexure.c.toFixed(1)} mm
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Comp. block a</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.flexure.a.toFixed(1)} mm
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm border-t border-slate-300/40 dark:border-slate-700/40 pt-2">
                        <span className="text-slate-500 dark:text-slate-400">
                          φM<sub>n</sub> (Capacity)
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {rcResult.flexure.phi_Mn.toFixed(2)} kN·m
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">
                          M<sub>u</sub> / φM<sub>n</sub>
                        </span>
                        <span
                          className={`font-mono font-bold ${Math.abs(activeMember.maxMomentZ) / rcResult.flexure.phi_Mn <= 1 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {rcResult.flexure.phi_Mn > 0
                            ? (
                                (Math.abs(activeMember.maxMomentZ) /
                                  rcResult.flexure.phi_Mn) *
                                100
                              ).toFixed(1) + "%"
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                    {/* Cross-section SVG */}
                    <div className="flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-lg p-2">
                      <RCBeamCrossSection
                        b={beamB}
                        d={beamD}
                        cover={cover}
                        mainBars={{
                          count: rcResult.flexure.numBars,
                          diameter: parseInt(rcResult.flexure.barSize) || 16,
                        }}
                        stirrupDia={parseInt(rcResult.shear.stirrupSize) || 8}
                        topBars={{ count: 2, diameter: 12 }}
                      />
                      <div className="text-xs text-slate-500 mt-1 text-center">
                        Cross-Section Detail
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shear Design Results */}
                <div className="bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-300/40 dark:border-slate-700/40">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    Shear Design
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        rcResult.shear.status === "OK" ||
                        rcResult.shear.status === "MIN_STIRRUPS"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {rcResult.shear.status}
                    </span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">
                          V<sub>u</sub> (Applied)
                        </span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.shear.Vu.toFixed(2)} kN
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">
                          φV<sub>c</sub> (Concrete)
                        </span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.shear.phi_Vc.toFixed(2)} kN
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">
                          V<sub>s,required</sub>
                        </span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.shear.Vs_required.toFixed(2)} kN
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm border-t border-slate-300/40 dark:border-slate-700/40 pt-2">
                        <span className="text-slate-500 dark:text-slate-400">Stirrup Size</span>
                        <span className="font-mono text-blue-400 font-bold">
                          Ø{rcResult.shear.stirrupSize}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Spacing</span>
                        <span className="font-mono text-blue-400 font-bold">
                          {rcResult.shear.spacing} mm c/c
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Max Spacing</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {rcResult.shear.maxSpacing} mm
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">No. of Legs</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.shear.numLegs}
                        </span>
                      </div>
                    </div>
                    {/* Shear capacity visual */}
                    <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-4 flex flex-col justify-center">
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                        Shear Capacity Breakdown
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <span>Concrete (φVc)</span>
                            <span className="font-mono">
                              {rcResult.shear.phi_Vc.toFixed(1)} kN
                            </span>
                          </div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-full"
                              style={{
                                width: `${Math.min((rcResult.shear.phi_Vc / Math.max(rcResult.shear.Vu, 0.01)) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <span>Steel (φVs)</span>
                            <span className="font-mono">
                              {(rcResult.shear.Vs_required * 0.75).toFixed(1)}{" "}
                              kN
                            </span>
                          </div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${Math.min(((rcResult.shear.Vs_required * 0.75) / Math.max(rcResult.shear.Vu, 0.01)) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="border-t border-slate-300/60 dark:border-slate-700/60 pt-2">
                          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <span>Demand (Vu)</span>
                            <span className="font-mono text-amber-400">
                              {rcResult.shear.Vu.toFixed(1)} kN
                            </span>
                          </div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500/60 rounded-full"
                              style={{ width: "100%" }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reinforcement Summary (IS 456 / ACI notation) */}
                <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">
                    Reinforcement Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">
                        IS 456 Notation
                      </div>
                      <div className="font-mono text-slate-900 dark:text-slate-100 bg-slate-50/60 dark:bg-slate-900/60 rounded px-3 py-2">
                        {rcResult.summaryIS}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">
                        ACI Notation
                      </div>
                      <div className="font-mono text-slate-900 dark:text-slate-100 bg-slate-50/60 dark:bg-slate-900/60 rounded px-3 py-2">
                        {rcResult.summaryACI}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm font-mono text-emerald-400 bg-slate-50/60 dark:bg-slate-900/60 rounded px-3 py-2">
                    {rcResult.reinforcementString}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ---- 3. STEEL DESIGN TAB ----

const SteelDesignTab: FC<{
  rows: MemberDesignRow[];
  selectedId: string | null;
  onSelectMember: (id: string) => void;
}> = ({ rows, selectedId, onSelectMember }) => {
  const steelRows = useMemo(
    () =>
      rows.filter(
        (r) => r.materialType === "steel" || r.materialType === "custom",
      ),
    [rows],
  );
  const activeMember =
    steelRows.find((r) => r.id === selectedId) ?? steelRows[0];

  if (steelRows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center space-y-2">
          <Columns3 className="w-12 h-12 mx-auto opacity-30" />
          <p>No steel members found in the model.</p>
          <p className="text-xs">
            Assign steel material type to members to use steel design.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Member Sidebar */}
      <div className="w-56 border-r border-slate-300/60 dark:border-slate-700/60 bg-slate-100/40 dark:bg-slate-800/40 flex flex-col">
        <div className="px-3 py-2 border-b border-slate-300/40 dark:border-slate-700/40 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Steel Members ({steelRows.length})
        </div>
        <div className="flex-1 overflow-auto">
          {steelRows.map((r) => {
            const sc = statusColors[r.status];
            return (
              <button type="button"
                key={r.id}
                onClick={() => onSelectMember(r.id)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-slate-200/60 dark:border-slate-800/60 transition-colors ${
                  r.id === activeMember?.id
                    ? "bg-blue-900/30 text-blue-300 border-l-2 border-l-blue-400"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/40 dark:hover:bg-slate-700/40 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium truncate">{r.label}</span>
                  <span className={`text-xs font-bold ${sc.text}`}>
                    {(r.utilization * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${utilizationColor(r.utilization)}`}
                    style={{ width: `${Math.min(r.utilization * 100, 100)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Design Detail */}
      <div className="flex-1 overflow-auto p-5 space-y-5">
        {activeMember && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Steel Design — Member {activeMember.label}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  L = {activeMember.length.toFixed(2)} m •{" "}
                  {activeMember.sectionType}
                </p>
              </div>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusColors[activeMember.status].bg}`}
              >
                {activeMember.status === "PASS" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span
                  className={`font-bold text-sm ${statusColors[activeMember.status].text}`}
                >
                  {activeMember.status} —{" "}
                  {(activeMember.utilization * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Forces */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Pu (Axial)",
                  value: activeMember.maxAxial,
                  color:
                    activeMember.maxAxial > 0
                      ? "text-green-400"
                      : "text-red-400",
                },
                {
                  label: "Vu (Shear)",
                  value: activeMember.maxShearY,
                  color: "text-blue-400",
                },
                {
                  label: "Mu (Moment)",
                  value: activeMember.maxMomentZ,
                  color: "text-purple-400",
                },
              ].map((f) => (
                <div
                  key={f.label}
                  className="bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-3 text-center border border-slate-300/40 dark:border-slate-700/40"
                >
                  <div className="text-xs text-slate-500">{f.label}</div>
                  <div className={`text-xl font-bold font-mono ${f.color}`}>
                    {fmtForce(f.value)}
                  </div>
                  <div className="text-xs text-slate-500">
                    kN{f.label.includes("Moment") ? "·m" : ""}
                  </div>
                </div>
              ))}
            </div>

            {/* Design Checks */}
            <div className="bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-300/40 dark:border-slate-700/40">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Design Checks
              </h4>
              <div className="space-y-2">
                {activeMember.designResult.checks.map((check, i) => {
                  const sc = statusColors[check.status];
                  return (
                    <div
                      key={i}
                      className="bg-white dark:bg-slate-900 rounded-lg p-3 border-l-[3px]"
                      style={{
                        borderLeftColor:
                          check.status === "PASS"
                            ? "#10b981"
                            : check.status === "FAIL"
                              ? "#ef4444"
                              : "#f59e0b",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {check.name}
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${sc.bg} ${sc.text} font-semibold`}
                          >
                            {check.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-28 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${utilizationColor(check.utilization)}`}
                              style={{
                                width: `${Math.min(check.utilization * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <span
                            className={`text-xs font-bold font-mono w-12 text-right ${utilizationTextColor(check.utilization)}`}
                          >
                            {(check.utilization * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {check.description}
                      </div>
                      {check.formula && (
                        <div className="text-xs text-slate-600 mt-0.5 font-mono">
                          {check.formula}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommendations */}
            {activeMember.designResult.recommendations &&
              activeMember.designResult.recommendations.length > 0 && (
                <div className="bg-blue-900/15 border border-blue-500/30 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
                    Recommendations
                  </h4>
                  <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                    {activeMember.designResult.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
};

// ---- 4. SECTION PROPERTIES TAB ----

const SectionPropertiesTab: FC<{
  members: Map<string, Member>;
  nodes: Map<string, { x: number; y: number; z?: number }>;
}> = ({ members, nodes }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const memberList = useMemo(() => {
    const list: { id: string; m: Member; length: number }[] = [];
    members.forEach((m, id) => {
      list.push({ id, m, length: memberLength(m, nodes) });
    });
    return list;
  }, [members, nodes]);

  const sectionIcon = (type?: string) => {
    switch (type) {
      case "I-BEAM":
        return <Columns3 className="w-4 h-4 text-blue-400" />;
      case "RECTANGLE":
        return <Box className="w-4 h-4 text-amber-400" />;
      case "CIRCLE":
        return <CircleDot className="w-4 h-4 text-green-400" />;
      case "TUBE":
        return <Grid3X3 className="w-4 h-4 text-purple-400" />;
      case "C-CHANNEL":
        return <Minus className="w-4 h-4 text-cyan-400" />;
      case "L-ANGLE":
        return <Plus className="w-4 h-4 text-orange-400" />;
      default:
        return <Box className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-8"></th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Member
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Section
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Length (m)
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              A (m²)
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              I<sub>z</sub> (m⁴)
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              I<sub>y</sub> (m⁴)
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              J (m⁴)
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              E (kN/m²)
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {memberList.map(({ id, m, length }) => {
            const isExpanded = expandedId === id;
            return (
              <Fragment key={id}>
                <tr
                  onClick={() => setExpandedId(isExpanded ? null : id)}
                  className="cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <td className="px-3 py-2.5 text-slate-500">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-medium text-slate-800 dark:text-slate-200">
                    M{id}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {sectionIcon(m.sectionType)}
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-[160px]" title={m.sectionType ?? "Default"}>
                        {m.sectionType ?? "Default"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {length.toFixed(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {(m.A ?? 0).toExponential(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {(m.I ?? 0).toExponential(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {(m.Iy ?? m.I ?? 0).toExponential(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {(m.J ?? 0).toExponential(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {(m.E ?? 200e6).toExponential(2)}
                  </td>
                </tr>
                {/* Expanded detail row */}
                {isExpanded && (
                  <tr className="bg-slate-100/40 dark:bg-slate-800/40">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid grid-cols-3 gap-6">
                        {/* Geometric Properties */}
                        <div>
                          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                            Geometric Properties
                          </h5>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Area (A)</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {(m.A ?? 0).toExponential(4)} m²
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                I<sub>z</sub> (Major)
                              </span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {(m.I ?? 0).toExponential(4)} m⁴
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                I<sub>y</sub> (Minor)
                              </span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {(m.Iy ?? m.I ?? 0).toExponential(4)} m⁴
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">J (Torsion)</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {(m.J ?? 0).toExponential(4)} m⁴
                              </span>
                            </div>
                            {m.A && m.I ? (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    r<sub>z</sub> (Gyration)
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {(Math.sqrt(m.I / m.A) * 1000).toFixed(1)}{" "}
                                    mm
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Z<sub>z</sub> (Elastic)
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {(() => {
                                      const d = m.dimensions;
                                      const depth =
                                        d?.height ??
                                        d?.rectHeight ??
                                        d?.diameter ??
                                        Math.sqrt(
                                          (12 * (m.I ?? 1)) / (m.A ?? 1),
                                        ) * 1000;
                                      return (
                                        (m.I ?? 0) /
                                        (depth / 2 / 1000)
                                      ).toExponential(3);
                                    })()}{" "}
                                    m³
                                  </span>
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {/* Section Dimensions */}
                        <div>
                          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                            Section Dimensions
                          </h5>
                          {m.dimensions ? (
                            <div className="space-y-1.5 text-sm">
                              {m.dimensions.height != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Height</span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.height} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.width != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Width</span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.width} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.webThickness != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Web t<sub>w</sub>
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.webThickness} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.flangeThickness != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Flange t<sub>f</sub>
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.flangeThickness} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.rectWidth != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Width b</span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.rectWidth} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.rectHeight != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Depth d</span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.rectHeight} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.diameter != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Diameter
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.diameter} mm
                                  </span>
                                </div>
                              )}
                              {m.dimensions.thickness != null && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Thickness
                                  </span>
                                  <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {m.dimensions.thickness} mm
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">
                              No explicit dimensions set — using computed A, I.
                            </p>
                          )}
                        </div>

                        {/* Material Properties */}
                        <div>
                          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                            Material Properties
                          </h5>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Material</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200 capitalize">
                                {(m.E ?? 200e6) < 50e6 ? "concrete" : "steel"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">E (Elastic)</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {((m.E ?? 200e6) / 1e6).toFixed(0)} GPa
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">G (Shear)</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {((m.G ?? 77e6) / 1e6).toFixed(0)} GPa
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">ρ (Density)</span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {m.rho ?? 7850} kg/m³
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                β (Rotation)
                              </span>
                              <span className="font-mono text-slate-800 dark:text-slate-200">
                                {m.betaAngle ?? 0}°
                              </span>
                            </div>
                            {m.releases && (
                              <div className="flex justify-between">
                                <span className="text-slate-500">Releases</span>
                                <span className="font-mono text-amber-400 text-xs">
                                  {[
                                    m.releases.startMoment && "Mz-start",
                                    m.releases.endMoment && "Mz-end",
                                  ]
                                    .filter(Boolean)
                                    .join(", ") || "None"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ---- 5. DEFLECTION CHECK TAB ----

const DeflectionCheckTab: FC<{
  rows: MemberDesignRow[];
  analysisResults: AnalysisResults;
  members: Map<string, Member>;
  nodes: Map<string, { x: number; y: number; z?: number }>;
}> = ({ rows, analysisResults, members, nodes }) => {
  const [limitRatio, setLimitRatio] = useState(250); // L/250 (IS 800) or L/360 (AISC)

  const deflectionData = useMemo(() => {
    return rows
      .map((row) => {
        const mf = analysisResults.memberForces.get(row.id);
        const member = members.get(row.id);
        if (!mf || !member) return null;

        const dd = mf.diagramData;
        let maxDeflY = 0;
        let maxDeflZ = 0;
        if (dd?.deflection_y) {
          maxDeflY = Math.max(...dd.deflection_y.map(Math.abs));
        }
        if (dd?.deflection_z) {
          maxDeflZ = Math.max(...dd.deflection_z.map(Math.abs));
        }
        const maxDefl = Math.max(maxDeflY, maxDeflZ);
        const len = row.length;
        // Convert to mm (deflection from solver is in m)
        const deflMM = maxDefl * 1000;
        const allowable = (len * 1000) / limitRatio;
        const ratio = allowable > 0 ? deflMM / allowable : 0;

        return {
          ...row,
          deflMM,
          allowableMM: allowable,
          ratio,
          actualSpanRatio: deflMM > 0 ? (len * 1000) / deflMM : Infinity,
          status: ratio <= 1 ? ("PASS" as const) : ("FAIL" as const),
        };
      })
      .filter(Boolean) as Array<
      MemberDesignRow & {
        deflMM: number;
        allowableMM: number;
        ratio: number;
        actualSpanRatio: number;
        status: "PASS" | "FAIL";
      }
    >;
  }, [rows, analysisResults, members, nodes, limitRatio]);

  const passCount = deflectionData.filter((d) => d.status === "PASS").length;
  const failCount = deflectionData.filter((d) => d.status === "FAIL").length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-5 py-3 border-b border-slate-300/60 dark:border-slate-700/60 bg-slate-100/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Deflection Compliance
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-slate-500 dark:text-slate-400">Limit: L /</label>
          <select
            value={limitRatio}
            onChange={(e) => setLimitRatio(+e.target.value)}
            className="text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
          >
            <option value={180}>180 (floor, live)</option>
            <option value={240}>240 (floor, total)</option>
            <option value={250}>250 (IS 800)</option>
            <option value={300}>300 (roof, snow)</option>
            <option value={325}>325 (IS 456)</option>
            <option value={360}>360 (AISC floor)</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-emerald-400">{passCount} Pass</span>
          <span className="text-sm text-red-400">{failCount} Fail</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Member
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Span (m)
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Max Defl (mm)
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Allowable (mm)
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Actual L/δ
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase min-w-[140px]">
                Ratio
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {deflectionData.map((d) => {
              const sc = statusColors[d.status];
              return (
                <tr
                  key={d.id}
                  className="hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <td className="px-3 py-2.5 font-mono text-slate-800 dark:text-slate-200">
                    {d.label}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {d.length.toFixed(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {d.deflMM.toFixed(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {d.allowableMM.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">
                    {d.actualSpanRatio === Infinity
                      ? "∞"
                      : `L/${d.actualSpanRatio.toFixed(0)}`}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${utilizationColor(d.ratio)}`}
                          style={{ width: `${Math.min(d.ratio * 100, 100)}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-bold font-mono w-12 text-right ${utilizationTextColor(d.ratio)}`}
                      >
                        {(d.ratio * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${sc.bg} ${sc.text}`}
                    >
                      {d.status === "PASS" ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {d.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const TABS: {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  shortLabel: string;
}[] = [
  {
    id: "summary",
    label: "Design Summary",
    shortLabel: "Summary",
    icon: <BarChart3 className="w-4 h-4" />,
  },
  {
    id: "rcBeam",
    label: "RC Beam Design",
    shortLabel: "RC Beam",
    icon: <Building2 className="w-4 h-4" />,
  },
  {
    id: "steel",
    label: "Steel Design",
    shortLabel: "Steel",
    icon: <Columns3 className="w-4 h-4" />,
  },
  {
    id: "section",
    label: "Section Properties",
    shortLabel: "Sections",
    icon: <Layers className="w-4 h-4" />,
  },
  {
    id: "deflection",
    label: "Deflection Check",
    shortLabel: "Deflection",
    icon: <Ruler className="w-4 h-4" />,
  },
];

export const PostProcessingDesignStudio: FC<DesignStudioProps> = ({
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Dialog handles Escape key natively

  // Store hooks
  const analysisResults = useModelStore((s) => s.analysisResults);
  const members = useModelStore((s) => s.members);
  const nodes = useModelStore((s) => s.nodes);

  // Build design rows for all members
  const designRows = useMemo((): MemberDesignRow[] => {
    if (!analysisResults?.memberForces) return [];
    const rows: MemberDesignRow[] = [];

    members.forEach((m, id) => {
      const forces = analysisResults.memberForces.get(id);
      if (!forces) return;

      const len = memberLength(m, nodes);
      const matType = (m.E ?? 200e6) < 50e6 ? "concrete" : "steel";

      // Derive width/depth from dimensions or infer from A/I
      const sp = m.dimensions;
      const width =
        sp?.width ??
        sp?.rectWidth ??
        (m.A ? Math.round(Math.sqrt(m.A * 1e6) * 0.5) : 200);
      const depth =
        sp?.height ??
        sp?.rectHeight ??
        (m.A && m.I ? Math.round(Math.sqrt((12 * m.I) / m.A) * 1000) : 400);

      let sectionType: "rectangular" | "circular" | "I-section" = "rectangular";
      const st = (m.sectionType ?? "").toLowerCase();
      if (st.includes("circ") || st === "circle") sectionType = "circular";
      else if (st.includes("i") || st === "i-beam" || st.includes("channel"))
        sectionType = "I-section";

      const input: DesignInput = {
        memberId: id,
        memberType:
          Math.abs(forces.axial) > Math.abs(forces.momentZ) * 0.5
            ? "beam-column"
            : "beam",
        material:
          matType === "steel"
            ? {
                type: "steel",
                grade: "Fe250",
                fy: 250,
                fu: 410,
                Es: 200,
              }
            : {
                type: "concrete",
                grade: "M25",
                fck: 25,
                fy: 415,
              },
        section: {
          type: sectionType,
          width,
          depth,
          ...(sp?.flangeThickness
            ? { flangeThickness: sp.flangeThickness }
            : {}),
          ...(sp?.webThickness ? { webThickness: sp.webThickness } : {}),
        },
        forces,
        geometry: {
          length: len,
          kFactor: 1.0,
          laterallyBraced: true,
        },
        code: matType === "steel" ? "IS800" : "IS456",
      };

      let designResult: MemberDesignResult;
      try {
        designResult = MemberDesignService.design(input);
      } catch {
        designResult = {
          memberId: id,
          overallStatus: "WARNING",
          overallUtilization: 0,
          checks: [],
          recommendations: [
            "Design calculation failed — check section properties.",
          ],
        };
      }

      rows.push({
        id,
        label: `M${id}`,
        length: len,
        materialType: matType as "steel" | "concrete" | "custom",
        sectionType: m.sectionType ?? "Default",
        maxAxial: forces.axial,
        maxShearY: forces.shearY,
        maxMomentZ: forces.momentZ,
        utilization: designResult.overallUtilization,
        status: designResult.overallStatus,
        governing: designResult.checks[0]?.name ?? "–",
        designResult,
      });
    });

    return rows;
  }, [analysisResults, members, nodes]);

  // Export handler
  const handleExport = useCallback(() => {
    const lines: string[] = [];
    lines.push("STRUCTURAL DESIGN REPORT");
    lines.push(`Date: ${new Date().toLocaleDateString()}`);
    lines.push(`Members: ${designRows.length}`);
    lines.push(
      `Pass: ${designRows.filter((r) => r.status === "PASS").length} | Fail: ${designRows.filter((r) => r.status === "FAIL").length} | Warning: ${designRows.filter((r) => r.status === "WARNING").length}`,
    );
    lines.push("");
    lines.push("MEMBER DESIGN SUMMARY");
    lines.push("=".repeat(100));
    lines.push(
      "Member".padEnd(10) +
        "Type".padEnd(12) +
        "Length(m)".padEnd(12) +
        "Axial(kN)".padEnd(14) +
        "Shear(kN)".padEnd(14) +
        "Moment(kNm)".padEnd(14) +
        "Util(%)".padEnd(10) +
        "Status".padEnd(8) +
        "Governing",
    );
    lines.push("-".repeat(100));
    for (const r of designRows) {
      lines.push(
        r.label.padEnd(10) +
          r.materialType.padEnd(12) +
          r.length.toFixed(2).padStart(8).padEnd(12) +
          fmtForce(r.maxAxial).padStart(10).padEnd(14) +
          fmtForce(r.maxShearY).padStart(10).padEnd(14) +
          fmtForce(r.maxMomentZ).padStart(10).padEnd(14) +
          (r.utilization * 100).toFixed(1).padStart(6).padEnd(10) +
          r.status.padEnd(8) +
          r.governing,
      );
    }
    lines.push("");

    // Detailed design checks per member
    for (const r of designRows) {
      lines.push("");
      lines.push(`── Member ${r.label} (${r.materialType}) ──`);
      lines.push(
        `Length: ${r.length.toFixed(3)} m | Overall: ${r.status} (${(r.utilization * 100).toFixed(1)}%)`,
      );
      for (const c of r.designResult.checks) {
        lines.push(
          `  ${c.name}: ${c.status} (${(c.utilization * 100).toFixed(1)}%) — ${c.description}`,
        );
        if (c.formula) lines.push(`    Formula: ${c.formula}`);
      }
      if (r.designResult.reinforcement) {
        const rf = r.designResult.reinforcement;
        lines.push(
          `  Reinforcement: ${rf.mainBars.count}×Ø${rf.mainBars.diameter} (${rf.mainBars.area.toFixed(0)} mm², ${rf.mainBars.ratio.toFixed(2)}%)`,
        );
        lines.push(
          `  Stirrups: Ø${rf.stirrups.diameter}@${rf.stirrups.spacing} mm c/c, ${rf.stirrups.legs}-legged`,
        );
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Design_Report_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [designRows]);

  if (!analysisResults) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>No Analysis Results</DialogTitle>
            <DialogDescription>Run an analysis first to access the design studio.</DialogDescription>
          </DialogHeader>
          <div className="text-center py-4">
            <AlertTriangle className="w-12 h-12 mx-auto text-amber-400 mb-4" />
            <p className="text-slate-700 dark:text-slate-300 mb-2">No analysis results available.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-none w-screen h-screen p-0 rounded-none flex flex-col gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Post-Processing Design Studio</DialogTitle>
        </DialogHeader>
        {/* Title Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Post-Processing Design Studio
            </h2>
            <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">
              {designRows.length} members
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-5 py-1.5 bg-slate-100/60 dark:bg-slate-800/60 border-b border-slate-300/40 dark:border-slate-700/40 shrink-0 overflow-x-auto">
        {TABS.map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "summary" && (
          <SummaryTab
            rows={designRows}
            onSelectMember={setSelectedMemberId}
            selectedId={selectedMemberId}
          />
        )}
        {activeTab === "rcBeam" && (
          <RCBeamTab
            rows={designRows}
            selectedId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
          />
        )}
        {activeTab === "steel" && (
          <SteelDesignTab
            rows={designRows}
            selectedId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
          />
        )}
        {activeTab === "section" && (
          <SectionPropertiesTab members={members} nodes={nodes} />
        )}
        {activeTab === "deflection" && (
          <DeflectionCheckTab
            rows={designRows}
            analysisResults={analysisResults}
            members={members}
            nodes={nodes}
          />
        )}
      </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostProcessingDesignStudio;
