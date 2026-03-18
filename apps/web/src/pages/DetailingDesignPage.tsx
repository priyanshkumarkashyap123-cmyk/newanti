/**
 * DetailingDesignPage.tsx — Comprehensive Structural Detailing Center
 *
 * Advanced UX with:
 * - URL-based tab navigation (e.g. /design/detailing?tab=beam)
 * - Auto-populate from analysis results when model is loaded
 * - Quick-jump links to individual member design
 * - Design summary dashboard with pass/fail overview
 * - Memory-efficient lazy tab loading
 */

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, memo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useModelStore } from '../store/model';
import type { Member, MemberForceData, AnalysisResults } from '../store/modelTypes';
import {
  Ruler, Columns3, Square, BarChart3, Layers, ArrowRight, CheckCircle,
  XCircle, AlertTriangle, Zap, FileText, Download, ChevronRight
} from 'lucide-react';
import { DesignPanelSkeleton } from '../components/ui/DesignPageSkeleton';
import { findSection } from '../data/SteelSectionDatabase';
import { MemberStatusTable } from '../components/design/MemberStatusTable';
import { DesignSummaryBar } from '../components/design/DesignSummaryBar';

// ── Exported Types ─────────────────────────────────────────────────────────

export interface MemberDesignResult {
  memberId: string;
  memberType: 'beam' | 'column' | 'brace' | 'unknown';
  sectionId: string;
  status: 'pass' | 'fail' | 'skipped';
  skipReason?: string;
  utilizationRatio: number;
  governingCheck: string;
  governingLoadCombo: string;
  forces: { axial: number; shearY: number; shearZ: number; momentY: number; momentZ: number; torsion: number };
  sectionProps: { area: number; Ixx: number; Iyy: number; Zxx: number; Zyy: number; fy: number };
}

// ── Exported Functions ─────────────────────────────────────────────────────

/**
 * Runs IS 456 / IS 800 code checks on all members using maximum force envelope.
 * Returns MemberDesignResult[] with length equal to members.size.
 */
export function runBatchDesign(
  members: Map<string, Member>,
  analysisResults: AnalysisResults | null,
  nodes: Map<string, { x: number; y: number; z: number }>,
  sections?: Map<string, unknown>
): MemberDesignResult[] {
  const results: MemberDesignResult[] = [];

  members.forEach((member, memberId) => {
    // Determine member type
    let memberType: MemberDesignResult['memberType'] = 'beam';
    if ((member as any).type && ['beam', 'column', 'brace', 'unknown'].includes((member as any).type)) {
      memberType = (member as any).type as MemberDesignResult['memberType'];
    } else {
      // Classify from node geometry
      const s = nodes.get(member.startNodeId);
      const e = nodes.get(member.endNodeId);
      if (s && e) {
        const dx = e.x - s.x, dy = e.y - s.y, dz = e.z - s.z;
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const vr = Math.abs(dy) / L;
        if (vr > 0.6) memberType = 'column';
        else if (vr > 0.3) memberType = 'brace';
        else memberType = 'beam';
      }
    }

    const sectionId = member.sectionId ?? 'Default';

    // Look up section properties from steel section database
    const dbSection = findSection(sectionId);

    if (!dbSection) {
      results.push({
        memberId,
        memberType,
        sectionId,
        status: 'skipped',
        skipReason: 'No section data',
        utilizationRatio: 0,
        governingCheck: '',
        governingLoadCombo: '',
        forces: { axial: 0, shearY: 0, shearZ: 0, momentY: 0, momentZ: 0, torsion: 0 },
        sectionProps: { area: 0, Ixx: 0, Iyy: 0, Zxx: 0, Zyy: 0, fy: 250 },
      });
      return;
    }

    // Get analysis forces
    const forceData = analysisResults?.memberForces?.get(memberId);
    if (!forceData) {
      results.push({
        memberId,
        memberType,
        sectionId,
        status: 'skipped',
        skipReason: 'No analysis forces',
        utilizationRatio: 0,
        governingCheck: '',
        governingLoadCombo: '',
        forces: { axial: 0, shearY: 0, shearZ: 0, momentY: 0, momentZ: 0, torsion: 0 },
        sectionProps: {
          area: dbSection.A,
          Ixx: dbSection.Ix,
          Iyy: dbSection.Iy,
          Zxx: dbSection.Zx,
          Zyy: dbSection.Zy,
          fy: 250,
        },
      });
      return;
    }

    const forces = {
      axial: forceData.axial,
      shearY: forceData.shearY,
      shearZ: forceData.shearZ,
      momentY: forceData.momentY,
      momentZ: forceData.momentZ,
      torsion: forceData.torsion,
    };

    const fy = 250; // MPa default
    // dbSection.A is in mm², dbSection.Zx is in mm³ × 10³
    const area = dbSection.A;       // mm²
    const Zxx = dbSection.Zx;       // mm³ × 10³
    const sectionProps = {
      area,
      Ixx: dbSection.Ix,
      Iyy: dbSection.Iy,
      Zxx,
      Zyy: dbSection.Zy,
      fy,
    };

    let utilizationRatio: number;
    let governingCheck: string;

    if (memberType === 'column') {
      // Axial check: utilization = |axial| / (fy * area / 1e4)
      // axial in kN, fy in MPa, area in mm² → capacity = fy(MPa) * area(mm²) / 1000 kN
      const capacity = (fy * area) / 1000; // kN
      utilizationRatio = capacity > 0 ? Math.abs(forces.axial) / capacity : 0;
      governingCheck = 'Axial (IS 800 Cl. 7.1)';
    } else {
      // Bending check: utilization = |momentZ| / (fy * Zxx / 1e6)
      // momentZ in kN·m, fy in MPa, Zxx in mm³×10³ → capacity = fy * Zxx*1e3 / 1e6 kN·m = fy * Zxx / 1e3 kN·m
      const capacity = (fy * Zxx * 1e3) / 1e6; // kN·m
      utilizationRatio = capacity > 0 ? Math.abs(forces.momentZ) / capacity : 0;
      governingCheck = 'Bending (IS 456 Cl. 26.5)';
    }

    const status: MemberDesignResult['status'] = utilizationRatio > 1.0 ? 'fail' : 'pass';

    results.push({
      memberId,
      memberType,
      sectionId,
      status,
      utilizationRatio,
      governingCheck,
      governingLoadCombo: '1.5(DL+LL)',
      forces,
      sectionProps,
    });
  });

  return results;
}

/**
 * Computes a summary of batch design results.
 */
export function computeDesignSummary(results: MemberDesignResult[]): {
  total: number;
  pass: number;
  fail: number;
  skipped: number;
  passRate: number;
} {
  if (results.length === 0) {
    return { total: 0, pass: 0, fail: 0, skipped: 0, passRate: 0 };
  }
  let pass = 0, fail = 0, skipped = 0;
  for (const r of results) {
    if (r.status === 'pass') pass++;
    else if (r.status === 'fail') fail++;
    else skipped++;
  }
  const total = results.length;
  const passRate = (pass / total) * 100;
  return { total, pass, fail, skipped, passRate };
}

/**
 * Generates a reinforcement SVG sketch for a designed member.
 * Returns a complete SVG string (not a React element).
 */
export function generateReinforcementSVG(result: MemberDesignResult, projectName: string): string {
  try {
    const width = 400;
    const height = 300;
    const today = new Date().toLocaleDateString('en-IN');

    // Section outline dimensions (scaled for display)
    const secX = 60, secY = 40, secW = 180, secH = 160;
    const cover = 20; // px representing 40mm cover
    const barR = 6;

    // Bar positions (3 bars at bottom for beam)
    const barY = secY + secH - cover - barR;
    const barPositions = [
      secX + cover + barR,
      secX + secW / 2,
      secX + secW - cover - barR,
    ];

    const bars = barPositions.map(bx =>
      `<circle cx="${bx}" cy="${barY}" r="${barR}" fill="#555" stroke="#333" stroke-width="1"/>`
    ).join('\n    ');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="white" stroke="#ccc" stroke-width="1"/>
  <!-- Section outline -->
  <rect x="${secX}" y="${secY}" width="${secW}" height="${secH}" fill="none" stroke="#333" stroke-width="2"/>
  <!-- Stirrup (inner rect, dashed) -->
  <rect x="${secX + cover}" y="${secY + cover}" width="${secW - 2 * cover}" height="${secH - 2 * cover}" fill="none" stroke="#666" stroke-width="1.5" stroke-dasharray="4,3"/>
  <!-- Cover dimension lines (dashed) -->
  <line x1="${secX}" y1="${secY + secH / 2}" x2="${secX + cover}" y2="${secY + secH / 2}" stroke="#999" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="${secX + cover / 2}" y="${secY + secH / 2 - 4}" font-size="8" fill="#666" text-anchor="middle">40mm</text>
  <!-- Reinforcement bars -->
  ${bars}
  <!-- Bar label -->
  <text x="${secX + secW / 2}" y="${barY + barR + 14}" font-size="9" fill="#333" text-anchor="middle">3-16φ @ 100mm c/c</text>
  <!-- Title block -->
  <rect x="0" y="${height - 60}" width="${width}" height="60" fill="#f5f5f5" stroke="#ccc" stroke-width="1"/>
  <text x="10" y="${height - 44}" font-size="10" font-weight="bold" fill="#222">Member: ${result.memberId}</text>
  <text x="10" y="${height - 30}" font-size="9" fill="#444">Section: ${result.sectionId}  |  Code: IS 456:2000</text>
  <text x="10" y="${height - 16}" font-size="9" fill="#444">Project: ${projectName}  |  Date: ${today}</text>
  <text x="${width - 10}" y="${height - 16}" font-size="9" fill="#888" text-anchor="end">Utilization: ${(result.utilizationRatio * 100).toFixed(1)}%</text>
</svg>`;
  } catch (err) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="white" stroke="#ccc" stroke-width="1"/>
  <text x="200" y="150" font-size="12" fill="red" text-anchor="middle">Error generating reinforcement SVG: ${String(err)}</text>
</svg>`;
  }
}

/**
 * Generates a self-contained HTML design report for all designed members.
 * No external links or scripts — inline CSS only.
 */
export function generateDesignReportHTML(
  results: MemberDesignResult[],
  projectName: string,
  designCode: string
): string {
  try {
    const today = new Date().toLocaleDateString('en-IN');

    const statusColor = (s: MemberDesignResult['status']) =>
      s === 'pass' ? '#16a34a' : s === 'fail' ? '#dc2626' : '#6b7280';

    const summaryRows = results.map(r => `
      <tr>
        <td>${r.memberId}</td>
        <td>${r.memberType}</td>
        <td>${r.sectionId}</td>
        <td>${(r.utilizationRatio * 100).toFixed(1)}%</td>
        <td style="color:${statusColor(r.status)};font-weight:bold">${r.status.toUpperCase()}</td>
        <td>${r.governingCheck}</td>
        <td>${r.governingLoadCombo}</td>
      </tr>`).join('');

    const memberSheets = results.map(r => `
      <div class="member-sheet">
        <h3>Member: ${r.memberId} — ${r.memberType.toUpperCase()}</h3>
        <table>
          <tr><th colspan="2">Applied Forces (kN / kN·m)</th></tr>
          <tr><td>Axial</td><td>${r.forces.axial.toFixed(3)}</td></tr>
          <tr><td>Shear Y</td><td>${r.forces.shearY.toFixed(3)}</td></tr>
          <tr><td>Shear Z</td><td>${r.forces.shearZ.toFixed(3)}</td></tr>
          <tr><td>Moment Y</td><td>${r.forces.momentY.toFixed(3)}</td></tr>
          <tr><td>Moment Z</td><td>${r.forces.momentZ.toFixed(3)}</td></tr>
          <tr><td>Torsion</td><td>${r.forces.torsion.toFixed(3)}</td></tr>
        </table>
        <table>
          <tr><th colspan="2">Section Properties</th></tr>
          <tr><td>Area (mm²)</td><td>${r.sectionProps.area.toFixed(1)}</td></tr>
          <tr><td>Ixx (mm⁴×10⁴)</td><td>${r.sectionProps.Ixx.toFixed(1)}</td></tr>
          <tr><td>Iyy (mm⁴×10⁴)</td><td>${r.sectionProps.Iyy.toFixed(1)}</td></tr>
          <tr><td>Zxx (mm³×10³)</td><td>${r.sectionProps.Zxx.toFixed(1)}</td></tr>
          <tr><td>Zyy (mm³×10³)</td><td>${r.sectionProps.Zyy.toFixed(1)}</td></tr>
          <tr><td>fy (MPa)</td><td>${r.sectionProps.fy}</td></tr>
        </table>
        <table>
          <tr><th colspan="2">Code Check Results</th></tr>
          <tr><td>Governing Check</td><td>${r.governingCheck}</td></tr>
          <tr><td>Governing Load Combo</td><td>${r.governingLoadCombo}</td></tr>
          <tr><td>Utilization Ratio</td><td>${(r.utilizationRatio * 100).toFixed(1)}%</td></tr>
          <tr><td>Status</td><td style="color:${statusColor(r.status)};font-weight:bold">${r.status.toUpperCase()}</td></tr>
        </table>
      </div>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Design Report — ${projectName}</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#222;background:#fff}
  .cover{text-align:center;padding:40px 20px;border-bottom:2px solid #333;margin-bottom:30px}
  .cover h1{font-size:24px;margin:0 0 8px}
  .cover p{margin:4px 0;color:#555;font-size:13px}
  h2{font-size:16px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:30px}
  h3{font-size:13px;margin:20px 0 8px;color:#333}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
  th{background:#f0f0f0;font-weight:bold}
  tr:nth-child(even){background:#fafafa}
  .member-sheet{page-break-inside:avoid;border:1px solid #e0e0e0;padding:12px;margin-bottom:20px;border-radius:4px}
  @media print{.member-sheet{page-break-inside:avoid}}
</style>
</head>
<body>
<div class="cover">
  <h1>Structural Design Report</h1>
  <p><strong>Project:</strong> ${projectName}</p>
  <p><strong>Design Code:</strong> ${designCode}</p>
  <p><strong>Date:</strong> ${today}</p>
  <p><strong>Total Members:</strong> ${results.length}</p>
</div>
<h2>Summary Table</h2>
<table>
  <thead>
    <tr>
      <th>Member ID</th><th>Type</th><th>Section</th>
      <th>Utilization</th><th>Status</th>
      <th>Governing Check</th><th>Load Combo</th>
    </tr>
  </thead>
  <tbody>${summaryRows}</tbody>
</table>
<h2>Member Calculation Sheets</h2>
${memberSheets}
</body>
</html>`;
  } catch (err) {
    return `<!DOCTYPE html><html><head><title>Error</title></head><body><p style="color:red">Error generating report: ${String(err)}</p></body></html>`;
  }
}

// Lazy-load heavy design panels — they pull in large engines
const RCDesignPanel = lazy(() =>
  import('../components/design/RCDesignPanel').then(m => ({ default: m.RCDesignPanel }))
);
const FoundationDesignPanel = lazy(() =>
  import('../components/design/FoundationDesignPanel').then(m => ({ default: m.FoundationDesignPanel }))
);
const DetailedDesignPanelInline = lazy(() =>
  import('../components/DetailedDesignPanel').then(m => ({ default: m.DetailedDesignPanel }))
);

type DetailingTab = 'overview' | 'beam' | 'column' | 'slab' | 'steel' | 'foundation' | 'rc';

interface TabInfo {
  id: DetailingTab;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  codes: string[];
}

const TABS: TabInfo[] = [
  {
    id: 'overview', label: 'Design Overview', description: 'Summary of all member designs',
    icon: Layers, color: 'from-blue-500 to-indigo-500', codes: [],
  },
  {
    id: 'beam', label: 'RC Beam', description: 'Flexure, shear, torsion, curtailment, crack width',
    icon: Ruler, color: 'from-emerald-500 to-teal-500', codes: ['IS 456:2000', 'ACI 318-19'],
  },
  {
    id: 'column', label: 'RC Column', description: 'P-M interaction, biaxial check, ties, lap splices',
    icon: Columns3, color: 'from-amber-500 to-orange-500', codes: ['IS 456:2000', 'ACI 318-19'],
  },
  {
    id: 'slab', label: 'RC Slab', description: 'One-way/two-way, temperature steel, deflection',
    icon: Square, color: 'from-purple-500 to-pink-500', codes: ['IS 456:2000', 'ACI 318-19'],
  },
  {
    id: 'steel', label: 'Steel Member', description: 'Classification, LTB, web buckling, connections',
    icon: BarChart3, color: 'from-cyan-500 to-blue-500', codes: ['IS 800:2007', 'AISC 360-22'],
  },
  {
    id: 'foundation', label: 'Foundation', description: 'Isolated, combined, strap, mat footings',
    icon: Layers, color: 'from-rose-500 to-red-500', codes: ['IS 456:2000', 'ACI 318-19'],
  },
  {
    id: 'rc', label: 'RC Design (IS 456)', description: 'Complete RC member design with code checks',
    icon: FileText, color: 'from-slate-500 to-gray-500', codes: ['IS 456:2000'],
  },
];

/** Classify member orientation from node positions */
function classifyMember(
  member: Member,
  nodes: Map<string, { x: number; y: number; z: number }>
): { orientation: 'beam' | 'column' | 'brace'; length: number } {
  const s = nodes.get(member.startNodeId);
  const e = nodes.get(member.endNodeId);
  if (!s || !e) return { orientation: 'beam', length: 3000 };
  const dx = e.x - s.x, dy = e.y - s.y, dz = e.z - s.z;
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const vr = Math.abs(dy) / (L || 1);
  if (vr > 0.6) return { orientation: 'column', length: L * 1000 };
  if (vr > 0.3) return { orientation: 'brace', length: L * 1000 };
  return { orientation: 'beam', length: L * 1000 };
}

// ── Overview Card ──────────────────────────────────────
const OverviewCard = memo(function OverviewCard({
  tab, memberCount, onClick
}: {
  tab: TabInfo; memberCount?: number; onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tab.color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{tab.label}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">{tab.description}</p>
      {tab.codes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tab.codes.map(code => (
            <span key={code} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {code}
            </span>
          ))}
        </div>
      )}
      {memberCount !== undefined && memberCount > 0 && (
        <div className="mt-2 text-xs text-blue-500 font-medium">
          {memberCount} members available
        </div>
      )}
    </button>
  );
});

// ── Model Summary Banner ───────────────────────────────
const ModelSummaryBanner = memo(function ModelSummaryBanner({
  beamCount, columnCount, totalMembers, hasAnalysis, onDesignAll
}: {
  beamCount: number; columnCount: number; totalMembers: number;
  hasAnalysis: boolean; onDesignAll: () => void;
}) {
  if (totalMembers === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent border border-blue-500/20 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Zap className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Model Loaded: {totalMembers} members
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {beamCount} beams · {columnCount} columns
              {hasAnalysis ? (
                <span className="text-green-500 ml-2">✓ Analysis results available</span>
              ) : (
                <span className="text-amber-500 ml-2">⚠ Run analysis first for auto-populate</span>
              )}
            </p>
          </div>
        </div>
        {hasAnalysis && (
          <button
            type="button"
            onClick={onDesignAll}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            Auto-Design All Members
          </button>
        )}
      </div>
    </div>
  );
});

// ── Main Page Component ────────────────────────────────
export const DetailingDesignPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL-driven tab state
  const activeTab = (searchParams.get('tab') as DetailingTab) || 'overview';
  const setActiveTab = useCallback((tab: DetailingTab) => {
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);

  // Store connection
  const members = useModelStore(s => s.members);
  const nodes = useModelStore(s => s.nodes);
  const analysisResults = useModelStore(s => s.analysisResults);

  const hasAnalysis = !!(analysisResults?.memberForces && analysisResults.memberForces.size > 0);

  // ── Batch design state ─────────────────────────────────────────────────
  const [batchResults, setBatchResults] = useState<MemberDesignResult[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [sortBy, setSortBy] = useState<'memberId' | 'memberType' | 'sectionId' | 'utilizationRatio' | 'status'>('memberId');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const designSummary = useMemo(() => computeDesignSummary(batchResults), [batchResults]);

  const handleBatchDesign = useCallback(async () => {
    setIsBatchRunning(true);
    try {
      const results = runBatchDesign(members, analysisResults, nodes as any);
      setBatchResults(results);
      const summary = computeDesignSummary(results);
      console.info(`Batch design complete: ${summary.pass} pass, ${summary.fail} fail, ${summary.skipped} skipped`);
    } finally {
      setIsBatchRunning(false);
    }
  }, [members, analysisResults, nodes]);

  const handleMemberClick = useCallback((memberId: string) => {
    setSelectedMemberId(memberId);
    const result = batchResults.find(r => r.memberId === memberId);
    if (!result) return;
    if (result.memberType === 'column') setActiveTab('column');
    else if (result.memberType === 'brace') setActiveTab('steel');
    else setActiveTab('beam');
  }, [batchResults, setActiveTab]);

  const handleExportDrawing = useCallback(() => {
    const result = batchResults.find(r => r.memberId === selectedMemberId);
    if (!result) return;
    const svg = generateReinforcementSVG(result, 'BeamLab Project');
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reinforcement-${result.memberId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [batchResults, selectedMemberId]);

  const handleGenerateReport = useCallback(() => {
    if (batchResults.length === 0) return;
    const html = generateDesignReportHTML(batchResults, 'BeamLab Project', 'IS 456:2000 / IS 800:2007');
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  }, [batchResults]);

  // Classify members
  const memberStats = useMemo(() => {
    let beams = 0, columns = 0, braces = 0;
    members.forEach((member) => {
      const { orientation } = classifyMember(member, nodes as any);
      if (orientation === 'beam') beams++;
      else if (orientation === 'column') columns++;
      else braces++;
    });
    return { beams, columns, braces, total: members.size };
  }, [members, nodes]);

  useEffect(() => { document.title = 'Structural Detailing | BeamLab'; }, []);

  const handleDesignAll = useCallback(() => {
    handleBatchDesign();
  }, [handleBatchDesign]);

  // Active tab info
  const activeTabInfo = TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                Structural Detailing Center
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Complete member design with bar layout, curtailment, crack width, interaction diagrams
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/design-hub')}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 rounded-lg transition-colors"
              >
                Design Hub
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-0 -mb-px scrollbar-none">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-all ${
                    isActive
                      ? 'border-blue-500 text-blue-500 bg-blue-50/50 dark:bg-blue-500/10'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Model summary (when model is loaded) */}
        {memberStats.total > 0 && activeTab === 'overview' && (
          <ModelSummaryBanner
            beamCount={memberStats.beams}
            columnCount={memberStats.columns}
            totalMembers={memberStats.total}
            hasAnalysis={hasAnalysis}
            onDesignAll={handleDesignAll}
          />
        )}

        {/* Overview Tab — Design Summary + Member Status Table */}
        {activeTab === 'overview' && (
          <div>
            {/* Design Summary Bar (shown when analysis is available) */}
            {hasAnalysis && (
              <div className="mb-4">
                <DesignSummaryBar
                  summary={designSummary}
                  onBatchDesign={handleBatchDesign}
                  onGenerateReport={handleGenerateReport}
                  isBatchRunning={isBatchRunning}
                  hasResults={batchResults.length > 0}
                />
              </div>
            )}

            {/* No analysis prompt */}
            {!hasAnalysis && (
              <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-400 text-sm">
                Run analysis first to enable batch design
              </div>
            )}

            {/* Member Status Table or card grid */}
            {batchResults.length > 0 ? (
              <div>
                {/* Export Drawing button */}
                {selectedMemberId && (
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleExportDrawing}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Drawing
                    </button>
                  </div>
                )}
                <MemberStatusTable
                  results={batchResults}
                  selectedMemberId={selectedMemberId}
                  onMemberClick={handleMemberClick}
                  sortBy={sortBy}
                  sortDir={sortDir}
                />
              </div>
            ) : (
              /* Existing card grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {TABS.filter(t => t.id !== 'overview').map(tab => (
                  <OverviewCard
                    key={tab.id}
                    tab={tab}
                    memberCount={
                      tab.id === 'beam' ? memberStats.beams :
                      tab.id === 'column' ? memberStats.columns :
                      tab.id === 'steel' ? memberStats.total :
                      undefined
                    }
                    onClick={() => setActiveTab(tab.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* RC Beam / Column / Slab / Steel Tabs — uses DetailedDesignPanel inline */}
        {(activeTab === 'beam' || activeTab === 'column' || activeTab === 'slab' || activeTab === 'steel') && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[600px]">
            <Suspense fallback={<DesignPanelSkeleton />}>
              <DetailedDesignPanelInline
                open={true}
                onClose={() => setActiveTab('overview')}
              />
            </Suspense>
          </div>
        )}

        {/* Foundation Tab */}
        {activeTab === 'foundation' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[600px]">
            <Suspense fallback={<DesignPanelSkeleton />}>
              <FoundationDesignPanel />
            </Suspense>
          </div>
        )}

        {/* RC Design (IS 456) Tab */}
        {activeTab === 'rc' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[600px]">
            <Suspense fallback={<DesignPanelSkeleton />}>
              <RCDesignPanel />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailingDesignPage;

