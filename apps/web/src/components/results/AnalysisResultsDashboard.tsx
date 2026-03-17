/**
 * AnalysisResultsDashboard.tsx - Comprehensive Results Visualization Hub
 *
 * A professional, visually stunning dashboard for structural analysis results:
 * - Summary cards with key metrics
 * - Interactive force diagrams (SFD, BMD, AFD)
 * - Heat map visualizations
 * - Deflected shape view
 * - Support reactions display
 * - Export capabilities
 *
 * This is the main entry point for result visualization that engineers will love.
 */

import React, { FC, useState, useMemo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import StabilityView from "./StabilityView";
import DCRatioView from "./DCRatioView";
import HeatmapView from "./HeatmapView";
import LoadCombosView from "./LoadCombosView";
import {
  BarChart2,
  Activity,
  TrendingDown,
  ArrowUpDown,
  Flame,
  FileText,
  Download,
  Share2,
  Printer,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  Grid3X3,
  X,
} from "lucide-react";

// ============================================
// TYPES (re-exported from dashboardTypes for backward compat)
// ============================================

export type {
  NodeResult,
  MemberResult,
  AnalysisResultsData,
  ViewMode,
  DiagramType,
} from "./dashboardTypes";

import type {
  NodeResult,
  MemberResult,
  AnalysisResultsData,
  ViewMode,
  DiagramType,
  AnalysisResultsDashboardProps,
} from "./dashboardTypes";
import {
  formatNumber,
  formatEngineering,
  getUtilizationStatus,
  VIEW_MODES,
  DEFLECTION_LIMITS,
  STATUS_COLORS,
  DIAGRAM_COLORS,
} from "./dashboardTypes";
import { AnalysisSkeleton } from '../ui/AnalysisSkeleton';

const MEMBERS_PER_PAGE = 12;

// ============================================
// SUMMARY CARD COMPONENT
// ============================================

interface SummaryCardProps {
  title: string;
  value: string;
  unit?: string;
  icon: React.ElementType;
  color: string;
  trend?: "up" | "down" | "neutral";
  subtitle?: string;
}

const SummaryCard: FC<SummaryCardProps> = ({
  title,
  value,
  unit,
  icon: Icon,
  color,
  trend,
  subtitle,
}) => (
  <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors animate-slideUp">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
          {title}
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
            {value}
          </span>
          {unit && <span className="text-sm text-slate-500 dark:text-slate-400">{unit}</span>}
        </div>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    {trend && (
      <div className="flex items-center gap-1 mt-2 text-xs">
        {trend === "up" && <ArrowUp className="w-3 h-3 text-red-400" />}
        {trend === "down" && <ArrowDown className="w-3 h-3 text-green-400" />}
        <span className={trend === "up" ? "text-red-400" : "text-green-400"}>
          Within limits
        </span>
      </div>
    )}
  </div>
);

// ============================================
// MEMBER DIAGRAM MINI CARD (Professional)
// ============================================

interface MemberDiagramMiniProps {
  member: MemberResult;
  type: DiagramType;
  isSelected: boolean;
  onClick: () => void;
}

const MemberDiagramMini: FC<MemberDiagramMiniProps> = ({
  member,
  type,
  isSelected,
  onClick,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !member.diagramData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    const W = 280;
    const H = 90;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    let values: number[] = [];
    switch (type) {
      case "SFD":
        values = member.diagramData.shear_values;
        break;
      case "BMD":
        values = member.diagramData.moment_values;
        break;
      case "AFD":
        values = member.diagramData.axial_values;
        break;
      case "DEFLECTION":
        values = member.diagramData.deflection_values;
        break;
      case "BMD_MY":
        values = member.diagramData.moment_y_values ?? [];
        break;
      case "SFD_VZ":
        values = member.diagramData.shear_z_values ?? [];
        break;
    }
    if (!values || values.length === 0) return;

    const colors = DIAGRAM_COLORS[type];
    const pad = { top: 8, right: 8, bottom: 16, left: 8 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const maxVal = Math.max(...values.map(Math.abs), 1e-10);
    const minIdx = values.reduce((mi, v, i) => (v < values[mi] ? i : mi), 0);
    const maxValIdx = values.reduce((mi, v, i) => (v > values[mi] ? i : mi), 0);

    // Determine baseline position (0 line)
    const allPos = values.every((v) => v >= -1e-10);
    const allNeg = values.every((v) => v <= 1e-10);

    // Proper scaling: map value to y coordinate
    const vMax = Math.max(...values);
    const vMin = Math.min(...values);
    const range = Math.max(vMax - vMin, 1e-10);
    const toY = (v: number) => pad.top + plotH * (1 - (v - vMin) / range);
    const toX = (i: number) => pad.left + (i / (values.length - 1)) * plotW;

    // Grid lines (2 horizontal)
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let g = 0; g <= 2; g++) {
      const gy = pad.top + (g / 2) * plotH;
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(pad.left + plotW, gy);
      ctx.stroke();
    }

    // Zero baseline
    const zeroY =
      vMax > 0 && vMin < 0 ? toY(0) : allNeg ? pad.top : pad.top + plotH;
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(pad.left + plotW, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Filled area (positive above baseline, negative below)
    ctx.beginPath();
    ctx.moveTo(toX(0), zeroY);
    values.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
    ctx.lineTo(toX(values.length - 1), zeroY);
    ctx.closePath();

    // Use gradient for positive/negative
    if (vMax > 0 && vMin < 0) {
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      grad.addColorStop(0, colors.fill);
      grad.addColorStop(vMax / range, colors.fill);
      grad.addColorStop(vMax / range, colors.fillNeg);
      grad.addColorStop(1, colors.fillNeg);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = colors.fill;
    }
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1.5;
    values.forEach((v, i) => {
      const x = toX(i);
      const y = toY(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Peak value annotations
    ctx.font = "600 9px Inter, system-ui, sans-serif";

    // Mark the absolute max point
    const peakIdx =
      Math.abs(values[maxValIdx]) >= Math.abs(values[minIdx])
        ? maxValIdx
        : minIdx;
    const peakVal = values[peakIdx];
    const px = toX(peakIdx);
    const py = toY(peakVal);

    // Dot at peak
    ctx.fillStyle = colors.line;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Peak label with background
    const peakText = formatEngineering(peakVal);
    const textW = ctx.measureText(peakText).width;
    const labelX = Math.min(
      Math.max(px - textW / 2, pad.left),
      W - pad.right - textW - 4,
    );
    const labelY = py < pad.top + plotH / 2 ? py - 6 : py + 12;

    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.roundRect(labelX - 2, labelY - 9, textW + 4, 12, 2);
    ctx.fill();
    ctx.fillStyle = colors.line;
    ctx.textAlign = "left";
    ctx.fillText(peakText, labelX, labelY);

    // If min is significantly different from max, show it too
    if (
      Math.abs(values[minIdx]) > 0.1 * maxVal &&
      minIdx !== peakIdx &&
      Math.abs(minIdx - peakIdx) > values.length * 0.15
    ) {
      const mv = values[minIdx];
      const mx = toX(minIdx);
      const my = toY(mv);
      ctx.fillStyle = colors.line;
      ctx.beginPath();
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fill();

      const minText = formatEngineering(mv);
      const minTW = ctx.measureText(minText).width;
      const mlX = Math.min(
        Math.max(mx - minTW / 2, pad.left),
        W - pad.right - minTW - 4,
      );
      const mlY = my > pad.top + plotH / 2 ? my + 12 : my - 6;

      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.beginPath();
      ctx.roundRect(mlX - 2, mlY - 9, minTW + 4, 12, 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(minText, mlX, mlY);
    }

    // X-axis: start/end position labels
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "8px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("0", pad.left, H - 2);
    ctx.textAlign = "right";
    ctx.fillText(`${member.length.toFixed(1)}m`, W - pad.right, H - 2);
  }, [member, type, isSelected]);

  const colors = DIAGRAM_COLORS[type];
  const peakVal = (() => {
    if (!member.diagramData) return 0;
    let vals: number[];
    switch (type) {
      case "SFD":
        vals = member.diagramData.shear_values;
        break;
      case "BMD":
        vals = member.diagramData.moment_values;
        break;
      case "AFD":
        vals = member.diagramData.axial_values;
        break;
      case "DEFLECTION":
        vals = member.diagramData.deflection_values;
        break;
      case "BMD_MY":
        vals = member.diagramData.moment_y_values ?? [];
        break;
      case "SFD_VZ":
        vals = member.diagramData.shear_z_values ?? [];
        break;
      default:
        vals = [];
    }
    if (!vals || vals.length === 0) return 0;
    return vals.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
  })();

  return (
    <div
      onClick={onClick}
      className={`
        relative p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] group
        ${
          isSelected
            ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
            : "border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-100/50 dark:bg-slate-800/50"
        }
      `}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">M{member.id}</span>
          <span className="text-[10px] text-slate-500">
            {member.sectionType || ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-mono text-slate-500 dark:text-slate-400"
            style={{ color: colors.line }}
          >
            {colors.label}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              member.utilization <= 0.7
                ? "bg-green-500/20 text-green-400"
                : member.utilization <= 0.9
                  ? "bg-yellow-500/20 text-yellow-400"
                  : member.utilization <= 1.0
                    ? "bg-orange-500/20 text-orange-400"
                    : "bg-red-500/20 text-red-400"
            }`}
          >
            {(member.utilization * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded bg-white/80 dark:bg-slate-900/80 h-[90px]"
      />

      <div className="flex justify-between mt-1.5 text-[10px]">
        <span className="text-slate-500">
          Peak:{" "}
          <span className="font-mono text-slate-600 dark:text-slate-300">
            {formatEngineering(peakVal)}
          </span>
        </span>
        <span className="text-slate-500">
          L ={" "}
          <span className="font-mono text-slate-600 dark:text-slate-300">
            {member.length.toFixed(2)}
          </span>
          m
        </span>
      </div>
    </div>
  );
};

// ============================================
// EXPANDED MEMBER DIAGRAM (click to view detail)
// ============================================

interface ExpandedDiagramProps {
  member: MemberResult;
  onClose: () => void;
}

const ExpandedDiagram: FC<ExpandedDiagramProps> = ({ member, onClose }) => {
  const canvasRefs = {
    SFD: React.useRef<HTMLCanvasElement>(null),
    BMD: React.useRef<HTMLCanvasElement>(null),
    AFD: React.useRef<HTMLCanvasElement>(null),
    DEFLECTION: React.useRef<HTMLCanvasElement>(null),
    BMD_MY: React.useRef<HTMLCanvasElement>(null),
    SFD_VZ: React.useRef<HTMLCanvasElement>(null),
  };
  const overlayRefs = {
    SFD: React.useRef<HTMLCanvasElement>(null),
    BMD: React.useRef<HTMLCanvasElement>(null),
    AFD: React.useRef<HTMLCanvasElement>(null),
    DEFLECTION: React.useRef<HTMLCanvasElement>(null),
    BMD_MY: React.useRef<HTMLCanvasElement>(null),
    SFD_VZ: React.useRef<HTMLCanvasElement>(null),
  };
  // Store diagram geometry for each type so hover can compute values
  const diagramMeta = React.useRef<
    Record<
      string,
      {
        values: number[];
        xVals: number[];
        pad: { top: number; right: number; bottom: number; left: number };
        plotW: number;
        plotH: number;
        W: number;
        H: number;
        vMax: number;
        vMin: number;
        range: number;
        length: number;
        colors: (typeof DIAGRAM_COLORS)[DiagramType];
      }
    >
  >({});

  const handleCanvasMouseMove = React.useCallback(
    (type: DiagramType, e: React.MouseEvent<HTMLCanvasElement>) => {
      const overlay = overlayRefs[type].current;
      const meta = diagramMeta.current[type];
      if (!overlay || !meta) return;
      const rect = overlay.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dpr = window.devicePixelRatio || 1;
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.scale(dpr, dpr);

      const {
        pad,
        plotW,
        plotH,
        values,
        xVals,
        W,
        H,
        vMax,
        vMin,
        range,
        length: mLen,
        colors,
      } = meta;
      // Only draw if within plot area
      if (
        mx < pad.left ||
        mx > pad.left + plotW ||
        my < pad.top ||
        my > pad.top + plotH
      ) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        return;
      }

      // Compute closest data index
      const frac = (mx - pad.left) / plotW;
      const idx = Math.min(
        Math.max(Math.round(frac * (values.length - 1)), 0),
        values.length - 1,
      );
      const val = values[idx];
      const pos = xVals[idx] ?? (idx / (values.length - 1)) * mLen;
      const toY = (v: number) => pad.top + plotH * (1 - (v - vMin) / range);
      const toX = (i: number) => pad.left + (i / (values.length - 1)) * plotW;
      const cx = toX(idx);
      const cy = toY(val);

      // Crosshair lines
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, pad.top + plotH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad.left, cy);
      ctx.lineTo(pad.left + plotW, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dot on curve
      ctx.fillStyle = colors.line;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Tooltip box
      const text = `${formatEngineering(val)} @ ${pos.toFixed(2)}m`;
      ctx.font = "600 10px Inter, system-ui, sans-serif";
      const tw = ctx.measureText(text).width;
      let lx = cx + 10;
      let ly = cy - 10;
      if (lx + tw + 10 > W - pad.right) lx = cx - tw - 16;
      if (ly - 14 < pad.top) ly = cy + 20;

      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.beginPath();
      ctx.roundRect(lx - 4, ly - 12, tw + 8, 17, 3);
      ctx.fill();
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.fillText(text, lx, ly);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
    [],
  );

  const handleCanvasMouseLeave = React.useCallback((type: DiagramType) => {
    const overlay = overlayRefs[type].current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
  }, []);

  const drawDiagram = React.useCallback(
    (
      canvas: HTMLCanvasElement | null,
      values: number[],
      xVals: number[],
      type: DiagramType,
      length: number,
    ) => {
      if (!canvas || !values || values.length === 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = 160;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.height = `${H}px`;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      // Also size the overlay canvas to match
      const overlay = overlayRefs[type].current;
      if (overlay) {
        overlay.width = W * dpr;
        overlay.height = H * dpr;
        overlay.style.height = `${H}px`;
      }

      const colors = DIAGRAM_COLORS[type];
      const pad = { top: 20, right: 55, bottom: 28, left: 55 };
      const plotW = W - pad.left - pad.right;
      const plotH = H - pad.top - pad.bottom;

      const vMax = Math.max(...values);
      const vMin = Math.min(...values);
      const range = Math.max(vMax - vMin, 1e-10);
      const toY = (v: number) => pad.top + plotH * (1 - (v - vMin) / range);
      const toX = (i: number) => pad.left + (i / (values.length - 1)) * plotW;

      // Store metadata for hover crosshair
      diagramMeta.current[type] = {
        values,
        xVals,
        pad,
        plotW,
        plotH,
        W,
        H,
        vMax,
        vMin,
        range,
        length,
        colors,
      };

      // Grid
      const nGridY = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 0.5;
      ctx.font = "9px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.35)";

      for (let g = 0; g <= nGridY; g++) {
        const gy = pad.top + (g / nGridY) * plotH;
        const gv = vMax - (g / nGridY) * range;
        ctx.beginPath();
        ctx.moveTo(pad.left, gy);
        ctx.lineTo(pad.left + plotW, gy);
        ctx.stroke();
        // Y-axis label
        ctx.textAlign = "right";
        ctx.fillText(formatNumber(gv), pad.left - 4, gy + 3);
      }

      // X-axis ticks
      const nGridX = Math.min(Math.round(length), 8);
      for (let g = 0; g <= nGridX; g++) {
        const gx = pad.left + (g / nGridX) * plotW;
        ctx.beginPath();
        ctx.moveTo(gx, pad.top);
        ctx.lineTo(gx, pad.top + plotH);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillText(
          ((g / nGridX) * length).toFixed(1),
          gx,
          H - pad.bottom + 14,
        );
      }

      // Axis labels
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "8px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Position (m)", pad.left + plotW / 2, H - 2);

      ctx.save();
      ctx.translate(10, pad.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(colors.label, 0, 0);
      ctx.restore();

      // Zero baseline
      if (vMax > 0 && vMin < 0) {
        const zy = toY(0);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(pad.left, zy);
        ctx.lineTo(pad.left + plotW, zy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Fill
      const zy =
        vMax > 0 && vMin < 0 ? toY(0) : vMin >= 0 ? pad.top + plotH : pad.top;
      ctx.beginPath();
      ctx.moveTo(toX(0), zy);
      values.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
      ctx.lineTo(toX(values.length - 1), zy);
      ctx.closePath();
      if (vMax > 0 && vMin < 0) {
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
        grad.addColorStop(0, colors.fill);
        grad.addColorStop(vMax / range, colors.fill);
        grad.addColorStop(vMax / range, colors.fillNeg);
        grad.addColorStop(1, colors.fillNeg);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = colors.fill;
      }
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 2;
      values.forEach((v, i) => {
        if (i === 0) ctx.moveTo(toX(i), toY(v));
        else ctx.lineTo(toX(i), toY(v));
      });
      ctx.stroke();

      // Find peaks
      let maxI = 0,
        minI = 0;
      values.forEach((v, i) => {
        if (v > values[maxI]) maxI = i;
        if (v < values[minI]) minI = i;
      });

      // Annotate max
      const drawAnnotation = (idx: number, color: string) => {
        const v = values[idx];
        const x = toX(idx);
        const y = toY(v);
        const pos = xVals[idx] ?? (idx / (values.length - 1)) * length;

        // Marker
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();

        // Label
        const text = `${formatEngineering(v)} @ ${pos.toFixed(2)}m`;
        ctx.font = "600 10px Inter, system-ui, sans-serif";
        const tw = ctx.measureText(text).width;
        const lx = Math.min(
          Math.max(x - tw / 2, pad.left + 2),
          W - pad.right - tw - 2,
        );
        const ly = y < pad.top + plotH / 2 ? y - 8 : y + 16;

        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.beginPath();
        ctx.roundRect(lx - 3, ly - 11, tw + 6, 15, 3);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.fillText(text, lx, ly);
      };

      drawAnnotation(maxI, colors.line);
      if (
        maxI !== minI &&
        Math.abs(values[minI]) > 0.05 * Math.max(Math.abs(vMax), Math.abs(vMin))
      ) {
        drawAnnotation(minI, "rgba(255,255,255,0.7)");
      }

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.strokeRect(pad.left, pad.top, plotW, plotH);
    },
    [],
  );

  React.useEffect(() => {
    if (!member.diagramData) return;
    const d = member.diagramData;
    drawDiagram(
      canvasRefs.SFD.current,
      d.shear_values,
      d.x_values,
      "SFD",
      member.length,
    );
    drawDiagram(
      canvasRefs.BMD.current,
      d.moment_values,
      d.x_values,
      "BMD",
      member.length,
    );
    drawDiagram(
      canvasRefs.AFD.current,
      d.axial_values,
      d.x_values,
      "AFD",
      member.length,
    );
    drawDiagram(
      canvasRefs.DEFLECTION.current,
      d.deflection_values,
      d.x_values,
      "DEFLECTION",
      member.length,
    );
    if (d.moment_y_values && d.moment_y_values.length > 0) {
      drawDiagram(
        canvasRefs.BMD_MY.current,
        d.moment_y_values,
        d.x_values,
        "BMD_MY",
        member.length,
      );
    }
    if (d.shear_z_values && d.shear_z_values.length > 0) {
      drawDiagram(
        canvasRefs.SFD_VZ.current,
        d.shear_z_values,
        d.x_values,
        "SFD_VZ",
        member.length,
      );
    }
  }, [member, drawDiagram]);

  type ForceKey =
    | "maxShear"
    | "maxMoment"
    | "maxAxial"
    | "maxDeflection"
    | "torsion"
    | "stress";
  const stats: { label: string; key: ForceKey; unit: string }[] = [
    { label: "V_max", key: "maxShear", unit: "kN" },
    { label: "M_max", key: "maxMoment", unit: "kNm" },
    { label: "N_max", key: "maxAxial", unit: "kN" },
    { label: "δ_max", key: "maxDeflection", unit: "mm" },
    { label: "T", key: "torsion", unit: "kNm" },
    { label: "σ", key: "stress", unit: "MPa" },
  ];

  return (
    <div className="bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-600 p-4 animate-slideUp">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Member M{member.id}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {member.sectionType || "General"}
          </span>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            L = {member.length.toFixed(3)} m
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-1 rounded font-medium ${
              member.utilization <= 0.7
                ? "bg-green-500/20 text-green-400"
                : member.utilization <= 0.9
                  ? "bg-yellow-500/20 text-yellow-400"
                  : member.utilization <= 1.0
                    ? "bg-orange-500/20 text-orange-400"
                    : "bg-red-500/20 text-red-400"
            }`}
          >
            D/C: {(member.utilization * 100).toFixed(1)}%
          </span>
          <button type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Force summary strip */}
      <div className="grid grid-cols-6 gap-2 mb-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white/80 dark:bg-slate-900/80 rounded-lg p-2 text-center"
          >
            <div className="text-[10px] text-slate-500">{s.label}</div>
            <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
              {formatEngineering((member[s.key] as number) ?? 0)}
            </div>
            <div className="text-[10px] text-slate-500">{s.unit}</div>
          </div>
        ))}
      </div>

      {/* 2x2 diagram grid (primary: XY-plane) */}
      <div className="grid grid-cols-2 gap-3">
        {(["SFD", "BMD", "AFD", "DEFLECTION"] as DiagramType[]).map((dt) => (
          <div key={dt} className="bg-white/60 dark:bg-slate-900/60 rounded-lg p-2">
            <div
              className="text-[10px] font-medium mb-1"
              style={{ color: DIAGRAM_COLORS[dt].line }}
            >
              {dt === "DEFLECTION" ? "Deflection" : dt} —{" "}
              {DIAGRAM_COLORS[dt].label}
            </div>
            <div className="relative h-[160px]">
              <canvas
                ref={canvasRefs[dt]}
                className="w-full rounded absolute inset-0 h-[160px]"
              />
              <canvas
                ref={overlayRefs[dt]}
                className="w-full rounded absolute inset-0 cursor-crosshair h-[160px]"
                onMouseMove={(e) => handleCanvasMouseMove(dt, e)}
                onMouseLeave={() => handleCanvasMouseLeave(dt)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Weak-axis diagrams (XZ-plane) — shown only when data exists */}
      {member.diagramData &&
        (member.diagramData.moment_y_values?.some((v) => Math.abs(v) > 1e-10) ||
          member.diagramData.shear_z_values?.some(
            (v) => Math.abs(v) > 1e-10,
          )) && (
          <>
            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-3 mb-1">
              Weak-Axis (XZ Plane)
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["SFD_VZ", "BMD_MY"] as DiagramType[]).map((dt) => (
                <div key={dt} className="bg-white/60 dark:bg-slate-900/60 rounded-lg p-2">
                  <div
                    className="text-[10px] font-medium mb-1"
                    style={{ color: DIAGRAM_COLORS[dt].line }}
                  >
                    {DIAGRAM_COLORS[dt].label}
                  </div>
                  <div className="relative h-[160px]">
                    <canvas
                      ref={canvasRefs[dt]}
                      className="w-full rounded absolute inset-0 h-[160px]"
                    />
                    <canvas
                      ref={overlayRefs[dt]}
                      className="w-full rounded absolute inset-0 cursor-crosshair h-[160px]"
                      onMouseMove={(e) => handleCanvasMouseMove(dt, e)}
                      onMouseLeave={() => handleCanvasMouseLeave(dt)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
    </div>
  );
};

// ============================================
// REACTION DISPLAY COMPONENT
// ============================================

interface ReactionDisplayProps {
  nodes: NodeResult[];
}

const ReactionDisplay: FC<ReactionDisplayProps> = ({ nodes }) => {
  const supportNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          n.reaction &&
          (Math.abs(n.reaction.fx) > 0.01 ||
            Math.abs(n.reaction.fy) > 0.01 ||
            Math.abs(n.reaction.fz) > 0.01 ||
            Math.abs(n.reaction.mx ?? 0) > 0.01 ||
            Math.abs(n.reaction.my ?? 0) > 0.01 ||
            Math.abs(n.reaction.mz ?? 0) > 0.01),
      ),
    [nodes],
  );

  // Detect if any node has 3D reactions (Fz, Mx, My)
  const is3D = useMemo(
    () =>
      supportNodes.some(
        (n) =>
          n.reaction &&
          (Math.abs(n.reaction.fz) > 0.01 ||
            Math.abs(n.reaction.mx ?? 0) > 0.01 ||
            Math.abs(n.reaction.my ?? 0) > 0.01),
      ),
    [supportNodes],
  );

  // Reaction cell helper
  const ReactionCell: FC<{
    label: string;
    value: number;
    unit: string;
    colorPos: string;
    colorNeg: string;
  }> = ({ label, value, unit, colorPos, colorNeg }) => (
    <div className="text-center p-2 bg-white dark:bg-slate-900 rounded">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div
        className={`font-mono font-bold ${value >= 0 ? colorPos : colorNeg}`}
      >
        {formatNumber(value)}
      </div>
      <div className="text-xs text-slate-500">{unit}</div>
    </div>
  );

  // Reaction sum row
  const totals = useMemo(() => {
    const sum = { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 };
    supportNodes.forEach((n) => {
      if (!n.reaction) return;
      sum.fx += n.reaction.fx;
      sum.fy += n.reaction.fy;
      sum.fz += n.reaction.fz;
      sum.mx += n.reaction.mx ?? 0;
      sum.my += n.reaction.my ?? 0;
      sum.mz += n.reaction.mz ?? 0;
    });
    return sum;
  }, [supportNodes]);

  return (
    <div className="space-y-4">
      {/* Summary totals */}
      <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Reaction Totals (Equilibrium Check)
        </div>
        <div
          className={`grid ${is3D ? "grid-cols-6" : "grid-cols-3"} gap-2 text-center text-xs`}
        >
          <div>
            <span className="text-slate-500 dark:text-slate-400">ΣFx =</span>{" "}
            <span className="font-mono text-slate-900 dark:text-white">
              {formatNumber(totals.fx)} kN
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">ΣFy =</span>{" "}
            <span className="font-mono text-slate-900 dark:text-white">
              {formatNumber(totals.fy)} kN
            </span>
          </div>
          {is3D && (
            <div>
              <span className="text-slate-500 dark:text-slate-400">ΣFz =</span>{" "}
              <span className="font-mono text-slate-900 dark:text-white">
                {formatNumber(totals.fz)} kN
              </span>
            </div>
          )}
          {is3D && (
            <div>
              <span className="text-slate-500 dark:text-slate-400">ΣMx =</span>{" "}
              <span className="font-mono text-slate-900 dark:text-white">
                {formatNumber(totals.mx)} kNm
              </span>
            </div>
          )}
          {is3D && (
            <div>
              <span className="text-slate-500 dark:text-slate-400">ΣMy =</span>{" "}
              <span className="font-mono text-slate-900 dark:text-white">
                {formatNumber(totals.my)} kNm
              </span>
            </div>
          )}
          <div>
            <span className="text-slate-500 dark:text-slate-400">ΣMz =</span>{" "}
            <span className="font-mono text-slate-900 dark:text-white">
              {formatNumber(totals.mz)} kNm
            </span>
          </div>
        </div>
      </div>

      {/* Per-node reaction cards */}
      <div className="grid grid-cols-2 gap-4">
        {supportNodes.map((node) => (
          <div
            key={node.id}
            className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4 animate-slideIn"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-slate-900 dark:text-white">Node {node.id}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({formatNumber(node.x)}, {formatNumber(node.y)},{" "}
                {formatNumber(node.z)})
              </span>
            </div>

            {node.reaction && (
              <div className="space-y-2">
                {/* Forces row */}
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Forces
                </div>
                <div
                  className={`grid ${is3D ? "grid-cols-3" : "grid-cols-2"} gap-2`}
                >
                  <ReactionCell
                    label="Fx"
                    value={node.reaction.fx}
                    unit="kN"
                    colorPos="text-blue-400"
                    colorNeg="text-red-400"
                  />
                  <ReactionCell
                    label="Fy"
                    value={node.reaction.fy}
                    unit="kN"
                    colorPos="text-green-400"
                    colorNeg="text-red-400"
                  />
                  {is3D && (
                    <ReactionCell
                      label="Fz"
                      value={node.reaction.fz}
                      unit="kN"
                      colorPos="text-cyan-400"
                      colorNeg="text-red-400"
                    />
                  )}
                </div>
                {/* Moments row */}
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">
                  Moments
                </div>
                <div
                  className={`grid ${is3D ? "grid-cols-3" : "grid-cols-1"} gap-2`}
                >
                  {is3D && (
                    <ReactionCell
                      label="Mx"
                      value={node.reaction.mx ?? 0}
                      unit="kNm"
                      colorPos="text-purple-400"
                      colorNeg="text-orange-400"
                    />
                  )}
                  {is3D && (
                    <ReactionCell
                      label="My"
                      value={node.reaction.my ?? 0}
                      unit="kNm"
                      colorPos="text-purple-400"
                      colorNeg="text-orange-400"
                    />
                  )}
                  <ReactionCell
                    label="Mz"
                    value={node.reaction.mz ?? 0}
                    unit="kNm"
                    colorPos="text-purple-400"
                    colorNeg="text-orange-400"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// DETAILED MEMBER TABLE
// ============================================

interface DetailedMemberTableProps {
  members: MemberResult[];
  onSelect: (memberId: string) => void;
}

const DetailedMemberTable: FC<DetailedMemberTableProps> = ({
  members,
  onSelect,
}) => {
  const [sortField, setSortField] = useState<keyof MemberResult>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDir === "asc" ? numA - numB : numB - numA;
    });
  }, [members, sortField, sortDir]);

  const handleSort = (field: keyof MemberResult) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const columns: { key: keyof MemberResult; label: string; unit?: string }[] = [
    { key: "id", label: "ID" },
    { key: "sectionType", label: "Section" },
    { key: "length", label: "Length", unit: "m" },
    { key: "maxShear", label: "Vy", unit: "kN" },
    { key: "maxShearZ", label: "Vz", unit: "kN" },
    { key: "maxMoment", label: "Mz", unit: "kNm" },
    { key: "maxMomentY", label: "My", unit: "kNm" },
    { key: "maxAxial", label: "Axial", unit: "kN" },
    { key: "torsion", label: "T", unit: "kNm" },
    { key: "maxDeflection", label: "Defl.", unit: "mm" },
    { key: "stress", label: "Stress", unit: "MPa" },
    { key: "utilization", label: "D/C" },
  ];

  const ROW_HEIGHT = 36;
  const MAX_VISIBLE_HEIGHT = 480; // ~13 rows visible at once
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: sortedMembers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-medium cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.unit && (
                    <span className="text-slate-500">({col.unit})</span>
                  )}
                  {sortField === col.key && (
                    <ChevronRight
                      className={`w-3 h-3 transform ${
                        sortDir === "asc" ? "-rotate-90" : "rotate-90"
                      }`}
                    />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
      </table>
      <div
        ref={parentRef}
        className="overflow-y-auto"
        style={{ maxHeight: MAX_VISIBLE_HEIGHT }}
      >
        <table className="w-full text-sm">
          <tbody
            className="relative block"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const member = sortedMembers[virtualRow.index];
              if (!member) return null;
              const status = getUtilizationStatus(member.utilization);

              return (
                <tr
                  key={member.id}
                  onClick={() => onSelect(member.id)}
                  className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors absolute top-0 left-0 w-full table-row"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">
                    M{member.id}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {member.sectionType || "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                    {formatNumber(member.length)}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                    {formatNumber(member.maxShear)}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                    {formatNumber(member.maxShearZ ?? 0)}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                    {formatNumber(member.maxMoment)}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                    {formatNumber(member.maxMomentY ?? 0)}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                    {formatNumber(member.maxAxial)}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                    {formatNumber(member.torsion ?? 0)}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                    {formatNumber(member.maxDeflection)}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                    {formatNumber(member.stress)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`
                                            px-2 py-0.5 rounded text-xs font-medium
                                            ${status === "safe" ? "bg-green-500/20 text-green-400" : ""}
                                            ${status === "warning" ? "bg-yellow-500/20 text-yellow-400" : ""}
                                            ${status === "critical" ? "bg-orange-500/20 text-orange-400" : ""}
                                            ${status === "failed" ? "bg-red-500/20 text-red-400" : ""}
                                        `}
                    >
                      {(member.utilization * 100).toFixed(1)}%
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
// MAIN DASHBOARD COMPONENT
// ============================================

export const AnalysisResultsDashboard: FC<AnalysisResultsDashboardProps> = ({
  results,
  onClose,
  onExport,
  onMemberSelect,
  isLoading = false,
  progress = [],
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedDiagramType, setSelectedDiagramType] =
    useState<DiagramType>("BMD");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [memberSearch, setMemberSearch] = useState("");
  const [overviewPage, setOverviewPage] = useState(0);
  const MEMBERS_PER_PAGE = 16;

  const { summary, members, nodes } = results;
  const statusConfig = STATUS_COLORS[summary.status];
  const StatusIcon = statusConfig.icon;

  // Filtered members based on search
  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase();
    return members.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        (m.sectionType || "").toLowerCase().includes(q),
    );
  }, [members, memberSearch]);

  // Selected member object
  const selectedMember = useMemo(
    () =>
      selectedMemberId
        ? (members.find((m) => m.id === selectedMemberId) ?? null)
        : null,
    [members, selectedMemberId],
  );

  const handleMemberSelect = useCallback(
    (memberId: string) => {
      setSelectedMemberId((prev) => (prev === memberId ? null : memberId));
      onMemberSelect?.(memberId);
    },
    [onMemberSelect],
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-fadeIn h-full flex flex-col">
      {/* Loading skeleton */}
      {isLoading && <AnalysisSkeleton steps={progress} />}

      {/* Header */}
      {!isLoading && (
      <div className="flex items-center justify-between px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div
            className={`p-2 rounded-lg ${statusConfig.bg} ${statusConfig.border} border`}
          >
            <StatusIcon className={`w-6 h-6 ${statusConfig.text}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Analysis Results</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {summary.totalNodes} nodes • {summary.totalMembers} members •{" "}
              {summary.totalDOF} DOF
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>Analysis time:</span>
            <span className="font-mono text-slate-900 dark:text-white">
              {summary.analysisTime.toFixed(0)}ms
            </span>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

          <button type="button"
            onClick={() => setShowLegend(!showLegend)}
            className={`p-2 rounded-lg transition-colors ${
              showLegend
                ? "bg-blue-500/20 text-blue-400"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            title={showLegend ? "Hide legend" : "Show legend"}
            aria-label={showLegend ? "Hide legend" : "Show legend"}
          >
            {showLegend ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>

          <button type="button"
            onClick={() => onExport?.("pdf")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            aria-label="Export results as PDF"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          {onClose && (
            <button type="button"
              onClick={onClose}
              autoFocus
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Close dashboard"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-800/30" role="tablist">
        {VIEW_MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = viewMode === mode.id;

          return (
            <button type="button"
              key={mode.id}
              onClick={() => setViewMode(mode.id)}
              role="tab"
              aria-selected={isActive}
              className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                                transition-all border active:scale-[0.98] hover:scale-[1.02]
                                ${
                                  isActive
                                    ? "bg-white text-black border-slate-200 dark:border-white"
                                    : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600"
                                }
                            `}
            >
              <Icon className="w-4 h-4" />
              {mode.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto scroll-smooth p-6 min-h-0">
        {/* Overview Mode */}
        {viewMode === "overview" && (
          <div key="overview" className="space-y-6 animate-slideUp">
            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-4">
              <SummaryCard
                title="Max Displacement"
                value={formatNumber(summary.maxDisplacement)}
                unit="mm"
                icon={TrendingDown}
                color="bg-blue-500/20 text-blue-400"
                trend="down"
              />
              <SummaryCard
                title="Max Stress"
                value={formatNumber(summary.maxStress)}
                unit="MPa"
                icon={Activity}
                color="bg-orange-500/20 text-orange-400"
              />
              <SummaryCard
                title="Max Utilization"
                value={(summary.maxUtilization * 100).toFixed(1)}
                unit="%"
                icon={Flame}
                color={
                  summary.maxUtilization > 1
                    ? "bg-red-500/20 text-red-400"
                    : "bg-green-500/20 text-green-400"
                }
                trend={summary.maxUtilization > 1 ? "up" : "down"}
              />
              <SummaryCard
                title="Total Nodes"
                value={summary.totalNodes.toString()}
                icon={Layers}
                color="bg-purple-500/20 text-purple-400"
              />
              <SummaryCard
                title="Total Members"
                value={summary.totalMembers.toString()}
                icon={Grid3X3}
                color="bg-cyan-500/20 text-cyan-400"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-4">
              <button type="button"
                onClick={() => setViewMode("diagrams")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm transition-colors"
              >
                <BarChart2 className="w-4 h-4" />
                View Force Diagrams
              </button>
              <button type="button"
                onClick={() => setViewMode("heatmap")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm transition-colors"
              >
                <Flame className="w-4 h-4" />
                View Heat Map
              </button>
              <button type="button"
                onClick={() => setViewMode("reactions")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm transition-colors"
              >
                <ArrowDown className="w-4 h-4" />
                View Reactions
              </button>
            </div>

            {/* Member Overview Grid with Pagination */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Member Overview — click for detail
                </h3>
                {members.length > MEMBERS_PER_PAGE && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <button type="button"
                      onClick={() => setOverviewPage((p) => Math.max(0, p - 1))}
                      disabled={overviewPage === 0}
                      className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                    >
                      ‹ Prev
                    </button>
                    <span className="font-mono">
                      {overviewPage * MEMBERS_PER_PAGE + 1}–
                      {Math.min(
                        (overviewPage + 1) * MEMBERS_PER_PAGE,
                        members.length,
                      )}{" "}
                      of {members.length}
                    </span>
                    <button type="button"
                      onClick={() =>
                        setOverviewPage((p) =>
                          Math.min(
                            Math.ceil(members.length / MEMBERS_PER_PAGE) - 1,
                            p + 1,
                          ),
                        )
                      }
                      disabled={
                        (overviewPage + 1) * MEMBERS_PER_PAGE >= members.length
                      }
                      className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                    >
                      Next ›
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 max-h-[420px] overflow-y-auto">
                {members
                  .slice(
                    overviewPage * MEMBERS_PER_PAGE,
                    (overviewPage + 1) * MEMBERS_PER_PAGE,
                  )
                  .map((member) => (
                    <MemberDiagramMini
                      key={member.id}
                      member={member}
                      type="BMD"
                      isSelected={selectedMemberId === member.id}
                      onClick={() => handleMemberSelect(member.id)}
                    />
                  ))}
              </div>
            </div>

            {/* Expanded Diagram for selected member */}
            {selectedMember && (
              <ExpandedDiagram
                member={selectedMember}
                onClose={() => setSelectedMemberId(null)}
              />
            )}

            {/* Node Displacement Summary */}
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                Node Displacements — Most Displaced
              </h3>
              <div className="overflow-x-auto max-h-[180px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-1.5 text-left text-slate-500 dark:text-slate-400 text-xs">
                        Node
                      </th>
                      <th className="px-3 py-1.5 text-left text-slate-500 dark:text-slate-400 text-xs">
                        Δx (mm)
                      </th>
                      <th className="px-3 py-1.5 text-left text-slate-500 dark:text-slate-400 text-xs">
                        Δy (mm)
                      </th>
                      <th className="px-3 py-1.5 text-left text-slate-500 dark:text-slate-400 text-xs">
                        Δz (mm)
                      </th>
                      <th className="px-3 py-1.5 text-left text-slate-500 dark:text-slate-400 text-xs">
                        |Δ| (mm)
                      </th>
                      <th className="px-3 py-1.5 text-left text-slate-500 dark:text-slate-400 text-xs">
                        θz (rad)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...nodes]
                      .map((n) => ({
                        ...n,
                        totalDisp: Math.sqrt(
                          n.displacement.dx ** 2 +
                            n.displacement.dy ** 2 +
                            n.displacement.dz ** 2,
                        ),
                      }))
                      .sort((a, b) => b.totalDisp - a.totalDisp)
                      .slice(0, 8)
                      .map((n) => (
                        <tr
                          key={n.id}
                          className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-3 py-1 font-medium text-slate-900 dark:text-white text-xs">
                            N{n.id}
                          </td>
                          <td className="px-3 py-1 font-mono text-slate-600 dark:text-slate-300 text-xs">
                            {(n.displacement.dx * 1000).toFixed(3)}
                          </td>
                          <td className="px-3 py-1 font-mono text-slate-600 dark:text-slate-300 text-xs">
                            {(n.displacement.dy * 1000).toFixed(3)}
                          </td>
                          <td className="px-3 py-1 font-mono text-slate-600 dark:text-slate-300 text-xs">
                            {(n.displacement.dz * 1000).toFixed(3)}
                          </td>
                          <td className="px-3 py-1 font-mono text-xs">
                            <span
                              className={
                                n.totalDisp * 1000 > 10
                                  ? "text-red-400"
                                  : n.totalDisp * 1000 > 5
                                    ? "text-yellow-400"
                                    : "text-green-400"
                              }
                            >
                              {(n.totalDisp * 1000).toFixed(3)}
                            </span>
                          </td>
                          <td className="px-3 py-1 font-mono text-slate-600 dark:text-slate-300 text-xs">
                            {(n.displacement.rz ?? 0).toFixed(6)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Structure Statistics */}
            <div className="grid grid-cols-4 gap-3">
              {(() => {
                const totalReactionY = nodes.reduce(
                  (s, n) => s + Math.abs(n.reaction?.fy ?? 0),
                  0,
                );
                const totalWeight = totalReactionY; // Approx. total vertical reaction ≈ weight
                const maxMoment =
                  members.length > 0
                    ? Math.max(...members.map((m) => m.maxMoment))
                    : 0;
                const maxShear =
                  members.length > 0
                    ? Math.max(...members.map((m) => m.maxShear))
                    : 0;
                const maxAxial =
                  members.length > 0
                    ? Math.max(...members.map((m) => m.maxAxial))
                    : 0;
                return (
                  <>
                    <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
                      <div className="text-[10px] text-slate-500 uppercase">
                        Total Vert. Reaction
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                        {formatNumber(totalWeight)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">kN</div>
                    </div>
                    <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
                      <div className="text-[10px] text-slate-500 uppercase">
                        Peak Moment
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                        {formatNumber(maxMoment)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">kNm</div>
                    </div>
                    <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
                      <div className="text-[10px] text-slate-500 uppercase">
                        Peak Shear
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                        {formatNumber(maxShear)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">kN</div>
                    </div>
                    <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
                      <div className="text-[10px] text-slate-500 uppercase">
                        Peak Axial
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                        {formatNumber(maxAxial)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">kN</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* ===== EQUILIBRIUM VERIFICATION (Industry Standard) ===== */}
            {results.equilibriumCheck && (
              <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                    {results.equilibriumCheck.pass ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    )}
                    Equilibrium Verification
                  </h3>
                  <span
                    className={`text-xs px-2 py-1 rounded font-mono ${
                      results.equilibriumCheck.pass
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                    }`}
                  >
                    Error:{" "}
                    {results.equilibriumCheck.error_percent < 0.001
                      ? "< 0.001"
                      : results.equilibriumCheck.error_percent.toFixed(4)}
                    %{results.equilibriumCheck.pass ? " — PASS" : " — FAIL"}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-2 text-xs">
                  {["Fx", "Fy", "Fz", "Mx", "My", "Mz"].map((label, i) => {
                    const applied =
                      (results.equilibriumCheck!.applied_forces[i] ?? 0) / 1000; // N→kN
                    const reaction =
                      (results.equilibriumCheck!.reaction_forces[i] ?? 0) /
                      1000;
                    const residual =
                      (results.equilibriumCheck!.residual[i] ?? 0) / 1000;
                    const unit = i < 3 ? "kN" : "kNm";
                    return (
                      <div
                        key={label}
                        className="bg-white dark:bg-slate-900 rounded p-2 text-center"
                      >
                        <div className="text-slate-500 text-[10px] mb-1">
                          Σ{label}
                        </div>
                        <div className="font-mono text-slate-600 dark:text-slate-300">
                          {formatNumber(applied)} {unit}
                        </div>
                        <div className="text-slate-500 text-[10px] mt-1">
                          Reaction
                        </div>
                        <div className="font-mono text-slate-500 dark:text-slate-400">
                          {formatNumber(-reaction)} {unit}
                        </div>
                        <div className="text-slate-500 text-[10px] mt-1">
                          Residual
                        </div>
                        <div
                          className={`font-mono ${Math.abs(residual) < 0.01 ? "text-green-400" : "text-red-400"}`}
                        >
                          {formatNumber(residual)} {unit}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {results.conditionNumber && results.conditionNumber > 1e8 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    <span>
                      Condition number:{" "}
                      {results.conditionNumber.toExponential(1)} —
                      {results.conditionNumber > 1e12
                        ? " Structure may be ill-conditioned. Check for mechanism or very different stiffnesses."
                        : " Moderate conditioning. Results should be verified."}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ===== SERVICEABILITY CHECKS (Industry Standard) ===== */}
            {results.serviceabilityChecks &&
              results.serviceabilityChecks.length > 0 && (
                <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                      {results.serviceabilityChecks.every((c) => c.pass) ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      )}
                      Serviceability — Deflection Limits
                    </h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        results.serviceabilityChecks.every((c) => c.pass)
                          ? "bg-green-500/20 text-green-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {
                        results.serviceabilityChecks.filter((c) => c.pass)
                          .length
                      }
                      /{results.serviceabilityChecks.length} members OK
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white dark:bg-slate-900">
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="px-2 py-1.5 text-left text-slate-500 dark:text-slate-400">
                            Member
                          </th>
                          <th className="px-2 py-1.5 text-right text-slate-500 dark:text-slate-400">
                            L (m)
                          </th>
                          <th className="px-2 py-1.5 text-right text-slate-500 dark:text-slate-400">
                            δ_max (mm)
                          </th>
                          <th className="px-2 py-1.5 text-right text-slate-500 dark:text-slate-400">
                            L/δ
                          </th>
                          <th className="px-2 py-1.5 text-center text-slate-500 dark:text-slate-400">
                            L/240
                          </th>
                          <th className="px-2 py-1.5 text-center text-slate-500 dark:text-slate-400">
                            L/360
                          </th>
                          <th className="px-2 py-1.5 text-center text-slate-500 dark:text-slate-400">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.serviceabilityChecks
                          .sort((a, b) => a.worstRatio - b.worstRatio)
                          .slice(0, 20)
                          .map((check) => {
                            const l240 = check.ratios.find((r) =>
                              r.limit.includes("L/240"),
                            );
                            const l360 = check.ratios.find((r) =>
                              r.limit.includes("L/360"),
                            );
                            return (
                              <tr
                                key={check.memberId}
                                className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                              >
                                <td className="px-2 py-1 font-medium text-slate-900 dark:text-white">
                                  M{check.memberId}
                                </td>
                                <td className="px-2 py-1 text-right font-mono text-slate-600 dark:text-slate-300">
                                  {check.length.toFixed(2)}
                                </td>
                                <td className="px-2 py-1 text-right font-mono text-slate-600 dark:text-slate-300">
                                  {check.maxDeflection.toFixed(3)}
                                </td>
                                <td className="px-2 py-1 text-right font-mono text-slate-600 dark:text-slate-300">
                                  {check.worstRatio === Infinity
                                    ? "∞"
                                    : `L/${Math.round(check.worstRatio)}`}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  {l240 ? (
                                    <span
                                      className={
                                        l240.pass
                                          ? "text-green-400"
                                          : "text-red-400"
                                      }
                                    >
                                      {l240.pass ? "✓" : "✗"}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  {l360 ? (
                                    <span
                                      className={
                                        l360.pass
                                          ? "text-green-400"
                                          : "text-red-400"
                                      }
                                    >
                                      {l360.pass ? "✓" : "✗"}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      check.pass
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-red-500/20 text-red-400"
                                    }`}
                                  >
                                    {check.pass ? "OK" : "FAIL"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-500">
                    Limits per IS 800:2007 Table 6, EN 1993-1-1 §7.2, AISC 360
                    Commentary L3
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Diagrams Mode */}
        {viewMode === "diagrams" && (
          <div key="diagrams" className="space-y-4 animate-slideUp">
            {/* Diagram Type Selector + Search */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {(["SFD", "BMD", "AFD", "DEFLECTION"] as DiagramType[]).map(
                  (type) => (
                    <button type="button"
                      key={type}
                      onClick={() => setSelectedDiagramType(type)}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-all
                        ${
                          selectedDiagramType === type
                            ? "bg-white text-black"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }
                      `}
                    >
                      {type === "DEFLECTION" ? "Deflection" : type}
                    </button>
                  ),
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search member ID or section..."
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 w-56 focus:border-blue-500 focus:outline-none transition-colors"
                />
                <span className="text-xs text-slate-500">
                  {filteredMembers.length} members
                </span>
              </div>
            </div>

            {/* Expanded Diagram for selected member */}
            {selectedMember && (
              <ExpandedDiagram
                member={selectedMember}
                onClose={() => setSelectedMemberId(null)}
              />
            )}

            {/* Member Diagram Grid */}
            <div className="grid grid-cols-3 gap-3 max-h-[520px] overflow-y-auto">
              {filteredMembers.map((member) => (
                <MemberDiagramMini
                  key={member.id}
                  member={member}
                  type={selectedDiagramType}
                  isSelected={selectedMemberId === member.id}
                  onClick={() => handleMemberSelect(member.id)}
                />
              ))}
              {filteredMembers.length === 0 && (
                <div className="col-span-3 text-center text-slate-500 py-8">
                  No members match &quot;{memberSearch}&quot;
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reactions Mode */}
        {viewMode === "reactions" && (
          <div key="reactions" className="animate-slideUp">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
              Support Reactions
            </h3>
            <ReactionDisplay nodes={nodes} />

            {/* Support Displacements / Settlement */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                Support Displacements (Settlement Check)
              </h3>
              {(() => {
                const supports = nodes.filter(
                  (n) =>
                    n.reaction &&
                    (Math.abs(n.reaction.fx) > 0.01 ||
                      Math.abs(n.reaction.fy) > 0.01 ||
                      Math.abs(n.reaction.fz) > 0.01),
                );
                if (supports.length === 0) {
                  return (
                    <div className="text-sm text-slate-500 p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      No support nodes found.
                    </div>
                  );
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">
                            Node
                          </th>
                          <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">
                            Δx (mm)
                          </th>
                          <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">
                            Δy (mm)
                          </th>
                          <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">
                            Δz (mm)
                          </th>
                          <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">
                            θx (rad)
                          </th>
                          <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">
                            θy (rad)
                          </th>
                          <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">
                            θz (rad)
                          </th>
                          <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {supports.map((n) => {
                          const d = n.displacement;
                          const totalDisp = Math.sqrt(
                            d.dx ** 2 + d.dy ** 2 + d.dz ** 2,
                          );
                          const isFixed = totalDisp < 0.001;
                          return (
                            <tr
                              key={n.id}
                              className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                            >
                              <td className="px-3 py-1.5 font-medium text-slate-900 dark:text-white text-xs">
                                N{n.id}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">
                                {(d.dx * 1000).toFixed(4)}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">
                                {(d.dy * 1000).toFixed(4)}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">
                                {(d.dz * 1000).toFixed(4)}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">
                                {(d.rx ?? 0).toFixed(6)}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">
                                {(d.ry ?? 0).toFixed(6)}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">
                                {(d.rz ?? 0).toFixed(6)}
                              </td>
                              <td className="px-3 py-1.5 text-xs">
                                <span
                                  className={`px-2 py-0.5 rounded ${
                                    isFixed
                                      ? "bg-green-500/20 text-green-400"
                                      : "bg-yellow-500/20 text-yellow-400"
                                  }`}
                                >
                                  {isFixed
                                    ? "FIXED"
                                    : `${(totalDisp * 1000).toFixed(3)} mm`}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Detailed Table Mode */}
        {viewMode === "detailed" && (
          <div key="detailed" className="space-y-4 animate-slideUp">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Detailed Member Results
              </h3>
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Filter by ID or section..."
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 w-52 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
            <DetailedMemberTable
              members={filteredMembers}
              onSelect={handleMemberSelect}
            />
            {selectedMember && (
              <ExpandedDiagram
                member={selectedMember}
                onClose={() => setSelectedMemberId(null)}
              />
            )}
          </div>
        )}

        {/* Stability — P-M Interaction, Euler Buckling, Approx. Modal */}
        {viewMode === "stability" && (
          <StabilityView members={members} nodes={nodes} />
        )}


        {/* Load Combinations Reference */}
        {viewMode === "loadCombos" && <LoadCombosView />}


        {/* D/C Ratio Summary with Deflection Limit Checks */}
        {viewMode === "dcRatio" && (
          <DCRatioView members={members} nodes={nodes} onMemberSelect={handleMemberSelect} />
        )}

        {/* Stress / Utilization Heat Map */}
        {viewMode === "heatmap" && (
          <HeatmapView members={members} nodes={nodes} onMemberSelect={handleMemberSelect} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-100/30 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <span>
          {summary.totalNodes > 0 && summary.totalMembers > 0
            ? "Analysis completed successfully"
            : "Analysis completed — no result data available"}
        </span>
        <div className="flex items-center gap-4">
          <button type="button"
            onClick={() => onExport?.("excel")}
            className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button type="button"
            onClick={() => onExport?.("json")}
            className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
          <button type="button"
            onClick={() => onExport?.("pdf")}
            className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>
          <button type="button" className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors">
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResultsDashboard;
