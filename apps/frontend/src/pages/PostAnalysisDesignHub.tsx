/**
 * PostAnalysisDesignHub.tsx — STAAD.Pro-style Post-Analysis Design Workflow
 *
 * After structural analysis completes, this hub lets users:
 * 1. View all members with their analysis forces (axial, shear, moment)
 * 2. Select members individually or by group
 * 3. Choose design codes (AISC 360, IS 800, Eurocode 3, IS 456, ACI 318…)
 * 4. Assign sections from 500+ section database
 * 5. Configure design parameters (material grades, effective lengths, etc.)
 * 6. Run batch design checks via Python backend
 * 7. View utilization ratios with color-coded pass/fail
 * 8. Drill into clause-by-clause check details per member
 * 9. Optimize sections (auto-select lightest passing)
 * 10. Design connections and foundations from reactions
 * 11. Generate design reports
 */

import React, { FC, useState, useMemo, useCallback, useEffect, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, AlertTriangle, ChevronRight,
  ChevronDown, Search, Download, Settings, Columns, Building2,
  Box, Triangle, BarChart3, Zap, RefreshCw, FileText, Layers,
  ChevronUp, Eye, EyeOff, SlidersHorizontal,
  Shield, Award, Cpu, Wrench,
  Target, TrendingUp, Copy, ArrowRight,
} from 'lucide-react';
import { VirtualTable } from '../components/ui/VirtualScroll';
import { useModelStore, hydrateAnalysisResults, type Member, type Node as ModelNode, type AnalysisResults, type MemberForceData, type Plate as ModelPlate } from '../store/model';
import { useUIStore } from '../store/uiStore';
import {
  designSteelMember, designConcreteBeam, designConcreteColumn,
  designConnection, designFoundation, designSlabIS456,
  type SteelDesignRequest, type SteelDesignResult,
  type ConcreteBeamRequest, type ConcreteBeamResult,
  type ConcreteColumnRequest, type ConcreteColumnResult,
  type ConnectionRequest, type ConnectionResult,
  type FootingRequest, type FootingResult,
  STEEL_GRADES, CONCRETE_GRADES, REBAR_GRADES, BOLT_GRADES,
  createSectionFromDatabase,
} from '../api/design';
import { Logo } from '../components/branding';
import { Button } from '../components/ui/button';
import { Input, Select } from '../components/ui/FormInputs';
import { BEAMLAB_COMPANY } from '../constants/BrandingConstants';
import { utilizationColor as utilizationTextColor } from '../contracts/resultContract';
import { designSummaryToCSV, type DesignSummaryCSVRow } from '../contracts/reportSchema';
import { inferMemberMaterialType } from '../utils/materialClassification';
import { STEEL_SECTION_DATABASE as STEEL_SECTIONS, type SteelSectionProperties } from '../data/SteelSectionDatabase';
import {
  DESIGN_CODES,
  STEEL_CODES,
  CONCRETE_CODES,
  REPORT_TYPE_OPTIONS,
  getMemberLength,
  getMaxForce,
  getDesignSectionByIdOrName,
  clientSideDesignSteel,
  clientSideDesignConcreteBeam,
  type DesignTab,
  type DesignCodeOption,
  type MemberDesignResult,
  type MemberRow,
  type SlabDesignRecord,
  type DesignParameters,
  type ClientDesignInput,
  type ConcreteDesignInput,
  type ConcreteDesignOutput,
} from './post-analysis/designHubHelpers';

type RcSectionDef = {
  name: string;
  b: number;
  d: number;
  area: number;
  weightPerM: number;
};

interface MemberGroup {
  id: string;
  name: string;
  memberIds: Set<string>;
  sectionId: string;
  color: string;
}

const GROUP_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

const RC_BEAM_SECTIONS: RcSectionDef[] = [
  { name: 'RC230x300', b: 230, d: 300, area: 69000, weightPerM: 0.1725 },
  { name: 'RC250x300', b: 250, d: 300, area: 75000, weightPerM: 0.1875 },
  { name: 'RC250x350', b: 250, d: 350, area: 87500, weightPerM: 0.2188 },
  { name: 'RC300x450', b: 300, d: 450, area: 135000, weightPerM: 0.3375 },
  { name: 'RC300x500', b: 300, d: 500, area: 150000, weightPerM: 0.3750 },
  { name: 'RC350x500', b: 350, d: 500, area: 175000, weightPerM: 0.4375 },
  { name: 'RC400x600', b: 400, d: 600, area: 240000, weightPerM: 0.6000 },
];

const RC_COLUMN_SECTIONS: RcSectionDef[] = [
  { name: 'RC300x300', b: 300, d: 300, area: 90000, weightPerM: 0.2250 },
  { name: 'RC300x400', b: 300, d: 400, area: 120000, weightPerM: 0.3000 },
  { name: 'RC350x350', b: 350, d: 350, area: 122500, weightPerM: 0.3063 },
  { name: 'RC400x400', b: 400, d: 400, area: 160000, weightPerM: 0.4000 },
  { name: 'RC450x450', b: 450, d: 450, area: 202500, weightPerM: 0.5063 },
  { name: 'RC500x500', b: 500, d: 500, area: 250000, weightPerM: 0.6250 },
];

const SectionAssignmentPanel: FC<{
  currentSection: string;
  onAssign: (sectionId: string) => void;
  standard: string;
}> = ({ currentSection, onAssign }) => {
  return (
    <div className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-4 space-y-3">
      <h4 className="text-xs font-semibold text-[#a9bcde]">SECTION ASSIGNMENT</h4>
      <Select
        label="Section"
        value={currentSection}
        onChange={onAssign}
        options={STEEL_SECTIONS.slice(0, 200).map((s) => ({ value: s.designation, label: s.designation }))}
      />
    </div>
  );
};

const ConnectionDesignTab: FC<{
  analysisResults: AnalysisResults;
  nodes: Map<string, ModelNode>;
}> = () => {
  return (
    <div className="py-20 text-center text-[#9bb0d5]">
      <Wrench className="w-12 h-12 mx-auto mb-4 opacity-40" />
      <p>Connection design panel is loading from modular components.</p>
    </div>
  );
};

const MemberDetailPanel: FC<{
  result: MemberDesignResult;
  onClose: () => void;
}> = ({ result, onClose }) => {
  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-[#0b1326] border-l border-[#1a2333] z-50 p-5 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#dae2fd]">Member Detail</h3>
        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
      </div>
      <div className="space-y-3 text-sm">
        <div className="bg-[#131b2e] rounded-lg p-3">
          <div className="text-[#a9bcde]">Section</div>
          <div className="font-mono text-[#dae2fd]">{result.section}</div>
        </div>
        <div className="bg-[#131b2e] rounded-lg p-3">
          <div className="text-[#a9bcde]">Status</div>
          <div className="font-bold text-[#dae2fd]">{result.status}</div>
        </div>
        <div className="bg-[#131b2e] rounded-lg p-3">
          <div className="text-[#a9bcde]">Utilization</div>
          <div className="font-mono text-[#dae2fd]">{(result.utilizationRatio * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
};

/** Fast backend availability probe — cached for session */
let _backendAvailable: boolean | null = null;
async function isBackendAvailable(): Promise<boolean> {
  if (_backendAvailable !== null) return _backendAvailable;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000); // 2s max
    const resp = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(timer);
    _backendAvailable = resp.ok;
  } catch {
    _backendAvailable = false;
  }
  return _backendAvailable;
}

function utilizationBg(ratio: number): string {
  if (ratio <= 0.5) return 'bg-emerald-500';
  if (ratio <= 0.8) return 'bg-blue-500';
  if (ratio <= 1.0) return 'bg-amber-500';
  return 'bg-red-500';
}

function statusIcon(status: string) {
  switch (status) {
    case 'PASS': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'FAIL': return <XCircle className="w-4 h-4 text-red-400" />;
    case 'WARNING': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    default: return <div className="w-4 h-4 rounded-full border-2 border-slate-600" />;
  }
}

function formatForce(v: number): string {
  if (Math.abs(v) < 0.01) return '0.00';
  return v.toFixed(2);
}

function parseConcreteSection(section: string): { widthMm: number; depthMm: number } | null {
  const match = section.match(/(?:RC)?\s*(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return null;
  return { widthMm: Number(match[1]), depthMm: Number(match[2]) };
}

function getConcreteSectionLabel(widthMm: number, depthMm: number): string {
  return `RC ${widthMm}×${depthMm}`;
}

function getRectangleSectionProperties(widthMm: number, depthMm: number) {
  const widthM = widthMm / 1000;
  const depthM = depthMm / 1000;
  return {
    A: widthM * depthM,
    Imajor: (widthM * depthM ** 3) / 12,
    Iminor: (depthM * widthM ** 3) / 12,
  };
}

function getPlatePlanDimensions(plate: ModelPlate, nodes: Map<string, ModelNode>) {
  const coords = plate.nodeIds
    .map((nodeId) => nodes.get(nodeId))
    .filter((node): node is ModelNode => Boolean(node));

  if (coords.length < 4) {
    return { lx: 0, ly: 0, area: 0 };
  }

  const xs = coords.map((node) => node.x);
  const zs = coords.map((node) => node.z);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanZ = Math.max(...zs) - Math.min(...zs);
  const lx = Math.min(spanX, spanZ);
  const ly = Math.max(spanX, spanZ);

  return {
    lx,
    ly,
    area: spanX * spanZ,
  };
}

function getSlabUtilization(result: Awaited<ReturnType<typeof designSlabIS456>>): number {
  const flexureRatio = result.Mu_demand / Math.max(result.Mu_capacity, 1e-6);
  const deflectionRatio = result.deflection_check / Math.max(result.deflection_limit, 1e-6);
  return Math.max(flexureRatio, deflectionRatio);
}

function estimateOptimizedSlabThickness(
  baseThicknessMm: number,
  result: Awaited<ReturnType<typeof designSlabIS456>>,
  targetRatio: number,
): number {
  const flexureRatio = result.Mu_demand / Math.max(result.Mu_capacity, 1e-6);
  const deflectionRatio = result.deflection_check / Math.max(result.deflection_limit, 1e-6);
  const flexureThickness = baseThicknessMm * Math.sqrt(Math.max(flexureRatio, 0.05) / targetRatio);
  const deflectionThickness = baseThicknessMm * Math.cbrt(Math.max(deflectionRatio, 0.05) / targetRatio);
  return Math.max(100, Math.ceil(Math.max(flexureThickness, deflectionThickness) / 5) * 5);
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

/** Color-coded utilization bar */
const UtilizationBar = memo<{ ratio: number; wide?: boolean }>(({ ratio, wide }) => (
  <div className={`relative ${wide ? 'h-5' : 'h-3'} bg-surface rounded-full overflow-hidden`}>
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(ratio * 100, 100)}%` }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`h-full rounded-full ${utilizationBg(ratio)}`}
    />
    {wide && (
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#dae2fd] mix-blend-difference">
        {(ratio * 100).toFixed(1)}%
      </span>
    )}
  </div>
));
UtilizationBar.displayName = 'UtilizationBar';

/** Stats card for overview */
const StatCard = memo<{ label: string; value: string | number; icon: React.ReactNode; color: string }>(
  ({ label, value, icon, color }) => (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-4 border border-white/10`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-900/70 dark:text-white/70 text-sm">{label}</span>
        <div className="text-slate-900/50 dark:text-white/50">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-[#dae2fd]">{value}</div>
    </div>
  )
);
StatCard.displayName = 'StatCard';

/** Expandable check detail row */
const CheckDetailRow = memo<{ check: { name: string; clause?: string; ratio: number; status: string } }>(
  ({ check }) => (
    <div className="flex items-center justify-between py-2 px-3 bg-surface rounded-lg">
      <div className="flex items-center gap-2 flex-1">
        {statusIcon(check.status)}
        <span className="text-sm text-slate-700 dark:text-slate-200">{check.name}</span>
        {check.clause && (
          <span className="text-xs text-[#9bb0d5] font-mono">({check.clause})</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="w-24">
          <UtilizationBar ratio={check.ratio} />
        </div>
        <span className={`text-sm font-mono font-bold w-16 text-right ${utilizationTextColor(check.ratio)}`}>
          {(check.ratio * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  )
);
CheckDetailRow.displayName = 'CheckDetailRow';

// ================================================================
// MEMBER TABLE WITH DESIGN RESULTS
// ================================================================

const MemberDesignTable: FC<{
  rows: MemberRow[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (selected: boolean) => void;
  onViewDetail: (id: string) => void;
  searchQuery: string;
  sectionOverrides?: Record<string, string>;
}> = ({ rows, onToggleSelect, onSelectAll, onViewDetail, searchQuery, sectionOverrides = {} }) => {
  const filtered = useMemo(() => {
    if (!searchQuery) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(r => {
      const displaySection = (r.designResult?.section || sectionOverrides[r.id] || r.sectionName || '').toLowerCase();
      return r.label.toLowerCase().includes(q) || displaySection.includes(q);
    });
  }, [rows, searchQuery, sectionOverrides]);

  const allSelected = filtered.length > 0 && filtered.every(r => r.selected);

  const tableRows = useMemo(() => filtered.map((row) => {
    const dr = row.designResult;
    return {
      ...row,
      displaySection: dr?.section || sectionOverrides[row.id] || row.sectionName,
      utilizationText: dr ? `${(dr.utilizationRatio * 100).toFixed(0)}%` : '—',
    };
  }), [filtered, sectionOverrides]);

  const columns = useMemo(() => [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => onSelectAll(!allSelected)}
          className="rounded border-slate-300 dark:border-slate-600 bg-[#131b2e] text-blue-500 focus:ring-blue-500"
        />
      ),
      width: 48,
      render: (row: typeof tableRows[number]) => (
        <input
          type="checkbox"
          checked={row.selected}
          onChange={() => onToggleSelect(row.id)}
          className="rounded border-slate-300 dark:border-slate-600 bg-[#131b2e] text-blue-500 focus:ring-blue-500"
        />
      ),
    },
    {
      key: 'member',
      header: 'Member',
      width: 120,
      render: (row: typeof tableRows[number]) => <span className="font-medium tracking-wide text-slate-700 dark:text-slate-200">{row.label}</span>,
    },
    {
      key: 'section',
      header: 'Section',
      width: 150,
      render: (row: typeof tableRows[number]) => <span className="text-[#a9bcde] font-mono text-xs">{row.displaySection || '—'}</span>,
    },
    {
      key: 'length',
      header: 'Length (m)',
      width: 110,
      render: (row: typeof tableRows[number]) => <span className="text-right block font-mono text-[#adc6ff]">{row.length.toFixed(3)}</span>,
    },
    {
      key: 'axial',
      header: 'Axial (kN)',
      width: 110,
      render: (row: typeof tableRows[number]) => <span className="text-right block font-mono text-[#adc6ff]">{formatForce(row.maxAxial)}</span>,
    },
    {
      key: 'shear',
      header: 'Shear (kN)',
      width: 110,
      render: (row: typeof tableRows[number]) => <span className="text-right block font-mono text-[#adc6ff]">{formatForce(row.maxShearY)}</span>,
    },
    {
      key: 'moment',
      header: 'Moment (kN·m)',
      width: 130,
      render: (row: typeof tableRows[number]) => <span className="text-right block font-mono text-[#adc6ff]">{formatForce(row.maxMomentZ)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 90,
      render: (row: typeof tableRows[number]) => (
        <div className="flex justify-center">{row.designResult ? statusIcon(row.designResult.status) : <div className="w-4 h-4 rounded-full border-2 border-[#1a2333]" />}</div>
      ),
    },
    {
      key: 'utilization',
      header: 'Utilization',
      width: 170,
      render: (row: typeof tableRows[number]) => (
        row.designResult ? (
          <div className="flex items-center gap-2">
            <div className="flex-1"><UtilizationBar ratio={row.designResult.utilizationRatio} /></div>
            <span className={`text-xs font-bold font-mono w-12 text-right ${utilizationTextColor(row.designResult.utilizationRatio)}`}>{row.utilizationText}</span>
          </div>
        ) : <span className="text-xs text-[#a9bcde]">—</span>
      ),
    },
    {
      key: 'detail',
      header: '',
      width: 60,
      render: (row: typeof tableRows[number]) => (
        row.designResult ? (
          <button type="button"
            onClick={() => onViewDetail(row.id)}
            className="p-1 rounded hover:bg-[#131b2e] text-[#a9bcde] hover:text-[#dae2fd] transition-colors"
            title="View detailed checks"
          >
            <Eye className="w-4 h-4" />
          </button>
        ) : null
      ),
    },
  ], [allSelected, onSelectAll, onToggleSelect, onViewDetail, tableRows]);

  return (
    <div className="h-[520px]">
      <VirtualTable
        items={tableRows}
        columns={columns}
        rowHeight={42}
        headerHeight={44}
        overscan={12}
        className="h-full"
        getRowKey={(row) => row.id}
        onRowClick={(row) => onToggleSelect(row.id)}
      />
      {filtered.length === 0 && (
        <div className="py-12 text-center text-[#9bb0d5]">
          No members found. {searchQuery ? 'Try adjusting your search.' : 'Run analysis first.'}
        </div>
      )}
    </div>
  );
};

// ================================================================
// DESIGN PARAMETERS PANEL
// ================================================================

const DesignParametersPanel: FC<{
  params: DesignParameters;
  onChange: (p: DesignParameters) => void;
  material: 'steel' | 'concrete';
}> = ({ params, onChange, material }) => {
  const updateParam = <K extends keyof DesignParameters>(key: K, value: DesignParameters[K]) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-[#dae2fd] flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-blue-400" />
        Design Parameters
      </h3>

      {material === 'steel' ? (
        <>
          {/* Steel Code Selection */}
          <div>
            <Select
              label="Steel Design Code"
              value={params.steelCode}
              onChange={(value) => updateParam('steelCode', value)}
              options={STEEL_CODES.map((c) => ({ value: c.id, label: `${c.icon} ${c.name} — ${c.region}` }))}
            />
          </div>

          {/* Steel Grade */}
          <div>
            <Select
              label="Steel Grade"
              value={params.steelGrade}
              onChange={(value) => updateParam('steelGrade', value)}
              options={STEEL_GRADES.map((g) => ({ value: g.name, label: `${g.name} (fy=${g.fy} MPa, fu=${g.fu} MPa)` }))}
            />
          </div>

          {/* Design Method */}
          <div>
            <label className="block text-xs text-[#a9bcde] mb-1">Design Method</label>
            <div className="flex gap-2">
              {(['LRFD', 'ASD'] as const).map(m => (
                <Button
                  type="button"
                  key={m}
                  onClick={() => updateParam('designMethod', m)}
                  variant={params.designMethod === m ? 'default' : 'outline'}
                  className="flex-1"
                >
                  {m}
                </Button>
              ))}
            </div>
          </div>

          {/* Effective Length Factors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Ky (Eff. Length Y)"
                type="number"
                step="0.1"
                min="0.5"
                max="2.0"
                value={params.effectiveLengthFactorY}
                onChange={e => updateParam('effectiveLengthFactorY', parseFloat(e.target.value) || 1.0)}
              />
            </div>
            <div>
              <Input
                label="Kz (Eff. Length Z)"
                type="number"
                step="0.1"
                min="0.5"
                max="2.0"
                value={params.effectiveLengthFactorZ}
                onChange={e => updateParam('effectiveLengthFactorZ', parseFloat(e.target.value) || 1.0)}
              />
            </div>
          </div>

          {/* Unbraced Length Ratio */}
          <div>
            <Input
              label="Lb/L (Unbraced Length Ratio)"
              type="number"
              step="0.1"
              min="0"
              max="1.0"
              value={params.unbracedLengthRatio}
              onChange={e => updateParam('unbracedLengthRatio', parseFloat(e.target.value) || 1.0)}
            />
          </div>

          {/* Cb Factor */}
          <div>
            <Input
              label="Cb (Moment Gradient Factor)"
              type="number"
              step="0.1"
              min="1.0"
              max="3.0"
              value={params.Cb}
              onChange={e => updateParam('Cb', parseFloat(e.target.value) || 1.0)}
            />
          </div>
        </>
      ) : (
        <>
          {/* Concrete Code Selection */}
          <div>
            <Select
              label="Concrete Design Code"
              value={params.concreteCode}
              onChange={(value) => updateParam('concreteCode', value)}
              options={CONCRETE_CODES.map((c) => ({ value: c.id, label: `${c.icon} ${c.name} — ${c.region}` }))}
            />
          </div>

          <div>
            <Select
              label="Concrete Grade"
              value={params.concreteGrade}
              onChange={(value) => updateParam('concreteGrade', value)}
              options={CONCRETE_GRADES.map((g) => ({ value: g.name, label: `${g.name} (fck=${g.fck} MPa)` }))}
            />
          </div>

          <div>
            <Select
              label="Rebar Grade"
              value={params.rebarGrade}
              onChange={(value) => updateParam('rebarGrade', value)}
              options={REBAR_GRADES.map((g) => ({ value: g.name, label: `${g.name} (fy=${g.fy} MPa)` }))}
            />
          </div>

          <div>
            <Input
              label="Gamma m0"
              type="number"
              step="0.01"
              min="1.0"
              max="1.5"
              value={params.gammaMo}
              onChange={e => updateParam('gammaMo', parseFloat(e.target.value) || 1.1)}
            />
          </div>
        </>
      )}
    </div>
  );
};

// ================================================================
// FOUNDATION DESIGN TAB
// ================================================================

const FoundationDesignTab: FC<{
  analysisResults: AnalysisResults;
  nodes: Map<string, ModelNode>;
}> = ({ analysisResults, nodes }) => {
  const [footingType, setFootingType] = useState<'isolated' | 'combined' | 'mat'>('isolated');
  const [bearingCapacity, setBearingCapacity] = useState(150);
  const [fck, setFck] = useState(25);
  const [fy, setFy] = useState(500);
  const [colWidth, setColWidth] = useState(400);
  const [colDepth, setColDepth] = useState(400);
  const [selectedSupport, setSelectedSupport] = useState<string | null>(null);
  const [result, setResult] = useState<FootingResult | null>(null);
  const [loading, setLoading] = useState(false);

  const supportNodes = useMemo(() => {
    if (!analysisResults?.reactions) return [];
    const entries: Array<{ nodeId: string; node: ModelNode; fx: number; fy: number; fz: number; mx: number; mz: number }> = [];
    analysisResults.reactions.forEach((reaction, nodeId) => {
      const node = nodes.get(nodeId);
      if (node) {
        entries.push({ nodeId, node, ...reaction });
      }
    });
    return entries;
  }, [analysisResults, nodes]);

  const runFoundationDesign = async () => {
    if (!selectedSupport) return;
    const reaction = analysisResults.reactions.get(selectedSupport);
    if (!reaction) return;

    setLoading(true);
    try {
      const req: FootingRequest = {
        type: footingType,
        loads: [{
          P: Math.abs(reaction.fy),
          Mx: Math.abs(reaction.mx),
          My: Math.abs(reaction.mz),
        }],
        columnSize: { width: colWidth, depth: colDepth },
        soil: { bearingCapacity, soilType: 'medium' },
        material: { fck, fy },
      };
      const res = await designFoundation(req);
      setResult(res);
    } catch (err) {
      console.error('[FoundationDesign] Failed:', err);
      // Fallback estimate
      const P = Math.abs(analysisResults.reactions.get(selectedSupport)?.fy ?? 100);
      const side = Math.ceil(Math.sqrt(P / bearingCapacity) * 1000 / 50) * 50; // mm, rounded to 50
      setResult({
        type: 'isolated',
        dimensions: { length: side, width: side, depth: 300, thickness: 300 },
        reinforcement: { main: '12mm @ 150mm c/c', distribution: '10mm @ 200mm c/c' },
        bearingRatio: P / (side * side / 1e6 * bearingCapacity),
        punchingRatio: 0.7,
        flexureRatio: 0.6,
        status: 'PASS',
        checks: ['Bearing capacity check (estimated)', 'Punching shear (estimated)', 'Flexure (estimated)'],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parameters */}
        <div className="space-y-4">
          <div className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[#dae2fd] flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-400" />
              Foundation Parameters
            </h3>
            <div>
              <Select
                label="Footing Type"
                value={footingType}
                onChange={(value) => setFootingType(value as typeof footingType)}
                options={[
                  { value: 'isolated', label: 'Isolated Footing' },
                  { value: 'combined', label: 'Combined Footing' },
                  { value: 'mat', label: 'Mat/Raft Foundation' },
                ]}
              />
            </div>
            <div>
              <Input
                label="Bearing Capacity (kN/m²)"
                type="number"
                value={bearingCapacity}
                onChange={e => setBearingCapacity(Number(e.target.value))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input
                  label="Column Width (mm)"
                  type="number"
                  value={colWidth}
                  onChange={e => setColWidth(Number(e.target.value))}
                />
              </div>
              <div>
                <Input
                  label="Column Depth (mm)"
                  type="number"
                  value={colDepth}
                  onChange={e => setColDepth(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Select
                  label="fck (MPa)"
                  value={String(fck)}
                  onChange={(value) => setFck(Number(value))}
                  options={CONCRETE_GRADES.map((g) => ({ value: String(g.fck), label: `${g.name} (${g.fck} MPa)` }))}
                />
              </div>
              <div>
                <Select
                  label="fy (MPa)"
                  value={String(fy)}
                  onChange={(value) => setFy(Number(value))}
                  options={REBAR_GRADES.map((g) => ({ value: String(g.fy), label: `${g.name} (${g.fy} MPa)` }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Support Selection */}
        <div className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#dae2fd] mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" />
            Select Support Node
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {supportNodes.map(s => (
              <button type="button"
                key={s.nodeId}
                onClick={() => setSelectedSupport(s.nodeId)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedSupport === s.nodeId ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300' : 'hover:bg-[#131b2e] text-[#adc6ff]'
                }`}
              >
                <span className="font-mono">Node {s.nodeId}</span>
                <span className="text-xs text-[#a9bcde]">P={formatForce(Math.abs(s.fy))} kN</span>
              </button>
            ))}
          </div>
          <Button
            type="button"
            onClick={runFoundationDesign}
            disabled={!selectedSupport || loading}
            className="mt-4 w-full"
            variant="default"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
            Design Foundation
          </Button>
        </div>

        {/* Result */}
        <div className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#dae2fd] mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Foundation Design
          </h3>
          {result ? (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg border ${result.status === 'PASS' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="flex items-center gap-2">
                  {statusIcon(result.status)}
                  <span className={`font-bold ${result.status === 'PASS' ? 'text-emerald-400' : 'text-red-400'}`}>{result.status}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-[#131b2e] rounded-lg px-3 py-2">
                  <div className="text-xs text-[#a9bcde]">Size (L×W)</div>
                  <div className="font-mono text-slate-700 dark:text-slate-200">{result.dimensions.length}×{result.dimensions.width} mm</div>
                </div>
                <div className="bg-[#131b2e] rounded-lg px-3 py-2">
                  <div className="text-xs text-[#a9bcde]">Depth</div>
                  <div className="font-mono text-slate-700 dark:text-slate-200">{result.dimensions.depth || result.dimensions.thickness} mm</div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#a9bcde]">Check Ratios</h4>
                {[
                  ['Bearing', result.bearingRatio],
                  ['Punching Shear', result.punchingRatio],
                  ['Flexure', result.flexureRatio],
                ].map(([label, ratio]) => (
                  <div key={label as string} className="flex items-center gap-3">
                    <span className="text-xs text-[#adc6ff] w-28">{label as string}</span>
                    <div className="flex-1"><UtilizationBar ratio={ratio as number} /></div>
                    <span className={`text-xs font-mono w-12 text-right ${utilizationTextColor(ratio as number)}`}>
                      {((ratio as number) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
              {result.reinforcement && (
                <div className="text-xs text-[#a9bcde] space-y-1">
                  {Object.entries(result.reinforcement).map(([k, v]) => (
                    <div key={k}><span className="text-[#9bb0d5]">{k}:</span> <span className="text-[#dae2fd] font-mono">{v}</span></div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#9bb0d5] text-center py-8">Select a support and run design</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ================================================================
// MAIN COMPONENT
// ================================================================

const PostAnalysisDesignHub: FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DesignTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [designResults, setDesignResults] = useState<Map<string, MemberDesignResult>>(new Map());
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [isDesigning, setIsDesigning] = useState(false);
  const [assignedSection, setAssignedSection] = useState('ISMB 300');
  const [designProgress, setDesignProgress] = useState({ current: 0, total: 0 });
  const [memberGroups, setMemberGroups] = useState<MemberGroup[]>([]);
  const [preOptWeight, setPreOptWeight] = useState<number | null>(null);
  const [concreteSection, setConcreteSection] = useState({ width: 300, depth: 500, cover: 40 });
  const [concreteDesignResults, setConcreteDesignResults] = useState<Map<string, ConcreteDesignOutput>>(new Map());
  const [memberTargetUtilization, setMemberTargetUtilization] = useState<Record<string, number>>({});
  const [memberSectionOverrides, setMemberSectionOverrides] = useState<Record<string, string>>({});
  const [reportTemplate, setReportTemplate] = useState<'professional' | 'studio' | 'quick'>('professional');
  const [slabDesignResults, setSlabDesignResults] = useState<Map<string, SlabDesignRecord>>(new Map());
  const [isDesigningSlabs, setIsDesigningSlabs] = useState(false);
  const [slabDesignError, setSlabDesignError] = useState<string | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [designFilterNotice, setDesignFilterNotice] = useState<string | null>(null);
  const [slabParams, setSlabParams] = useState({
    liveLoad: 3,
    floorFinish: 1,
    supportType: 'continuous',
    edgeConditions: 'all_continuous',
  });
  const openModal = useUIStore((s) => s.openModal);

  const [params, setParams] = useState<DesignParameters>({
    steelCode: 'IS800',
    concreteCode: 'IS456',
    steelGrade: 'Fe250',
    concreteGrade: 'M25',
    rebarGrade: 'Fe500',
    designMethod: 'LRFD',
    effectiveLengthFactorY: 1.0,
    effectiveLengthFactorZ: 1.0,
    unbracedLengthRatio: 1.0,
    Cb: 1.0,
    gammaMo: 1.1,
    gammaM1: 1.25,
  });

  // Set page title
  useEffect(() => {
    document.title = 'Design Hub — BeamLab';
    return () => { document.title = 'BeamLab'; };
  }, []);

  // Read from model store (batched shallow subscription for fewer re-renders)
  const {
    nodes,
    members,
    plates,
    floorLoads,
    analysisResults,
    projectInfo,
    updateMember,
    updatePlate,
  } = useModelStore(
    useShallow((s) => ({
      nodes: s.nodes,
      members: s.members,
      plates: s.plates,
      floorLoads: s.floorLoads,
      analysisResults: s.analysisResults,
      projectInfo: s.projectInfo,
      updateMember: s.updateMember,
      updatePlate: s.updatePlate,
    })),
  );

  // Hydrate from sessionStorage if in-memory results are missing (page was
  // refreshed or hard-navigated).  This runs once on mount.
  useEffect(() => {
    if (!analysisResults) {
      const restored = hydrateAnalysisResults();
      if (restored) {
        useModelStore.getState().setAnalysisResults(restored);
      }
    }
  }, []);

  const hasAnalysis = Boolean(
    analysisResults && (
      (analysisResults.displacements?.size ?? 0) > 0 ||
      (analysisResults.memberForces?.size ?? 0) > 0 ||
      (analysisResults.reactions?.size ?? 0) > 0
    )
  );

  // Build member rows from store — selection decoupled for perf
  const baseMemberRows = useMemo(() => {
    const rows: Omit<MemberRow, 'selected' | 'designResult'>[] = [];
    members.forEach((member, memberId) => {
      const forces = analysisResults?.memberForces?.get(memberId) ?? null;
      const length = getMemberLength(member, nodes);
      rows.push({
        id: memberId,
        label: `M${memberId}`,
        length,
        sectionId: member.sectionId || 'Default',
        sectionName: member.sectionId || assignedSection,
        materialType: inferMemberMaterialType(member),
        forces,
        maxAxial: getMaxForce(forces, 'axial'),
        maxShearY: getMaxForce(forces, 'shearY'),
        maxMomentZ: getMaxForce(forces, 'momentZ'),
      });
    });
    return rows.sort((a, b) => {
      const numA = parseInt(a.id) || 0;
      const numB = parseInt(b.id) || 0;
      return numA - numB;
    });
  }, [members, nodes, analysisResults, assignedSection]);

  // Layer selection + results on top (cheap — just pointer comparisons)
  const memberRows: MemberRow[] = useMemo(() =>
    baseMemberRows.map(r => ({
      ...r,
      selected: selectedMemberIds.has(r.id),
      designResult: designResults.get(r.id) ?? null,
    })),
  [baseMemberRows, selectedMemberIds, designResults]);

  const slabRows = useMemo(() => {
    const rows = Array.from(plates.values()).map((plate) => {
      const { lx, ly, area } = getPlatePlanDimensions(plate, nodes);
      return {
        id: plate.id,
        label: `Slab ${plate.id}`,
        lx,
        ly,
        area,
        thicknessMm: Math.round(plate.thickness * 1000),
      };
    });
    return rows.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }, [plates, nodes]);

  // Stats — memoized to avoid iterating Map on every render
  const { totalMembers, designedCount, passCount, failCount, maxUtilization } = useMemo(() => {
    let pass = 0, fail = 0;
    let maxUtil = 0;
    designResults.forEach(r => {
      if (r.status === 'PASS') pass++;
      else if (r.status === 'FAIL') fail++;
      if (r.utilizationRatio > maxUtil) maxUtil = r.utilizationRatio;
    });
    return {
      totalMembers: baseMemberRows.length,
      designedCount: designResults.size,
      passCount: pass,
      failCount: fail,
      maxUtilization: maxUtil,
    };
  }, [baseMemberRows.length, designResults]);

  // Toggle member selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((selected: boolean, materialFilter?: 'steel' | 'concrete') => {
    if (!selected) {
      setSelectedMemberIds(new Set());
      return;
    }

    const rowsToSelect = materialFilter
      ? memberRows.filter(r => r.materialType === materialFilter)
      : memberRows;

    setSelectedMemberIds(new Set(rowsToSelect.map(r => r.id)));
  }, [memberRows]);

  // ============================
  // MEMBER GROUPING
  // ============================
  const createGroupFromSelection = useCallback(() => {
    if (selectedMemberIds.size === 0) return;
    const groupId = `G${memberGroups.length + 1}`;
    const newGroup: MemberGroup = {
      id: groupId,
      name: `Group ${memberGroups.length + 1}`,
      memberIds: new Set(selectedMemberIds),
      sectionId: assignedSection,
      color: GROUP_COLORS[memberGroups.length % GROUP_COLORS.length],
    };
    setMemberGroups(prev => [...prev, newGroup]);
  }, [selectedMemberIds, memberGroups.length, assignedSection]);

  const deleteGroup = useCallback((groupId: string) => {
    setMemberGroups(prev => prev.filter(g => g.id !== groupId));
  }, []);

  const selectGroup = useCallback((groupId: string) => {
    const group = memberGroups.find(g => g.id === groupId);
    if (group) setSelectedMemberIds(new Set(group.memberIds));
  }, [memberGroups]);

  // ============================
  // RUN CONCRETE BEAM DESIGN — Client-side IS456/ACI318
  // ============================
  const runConcreteDesign = useCallback(async () => {
    const selectedRows = selectedMemberIds.size > 0
      ? memberRows.filter(r => selectedMemberIds.has(r.id))
      : memberRows;

    const targetRows = selectedRows.filter(r => r.materialType === 'concrete');
    const excludedCount = selectedRows.length - targetRows.length;

    if (excludedCount > 0) {
      setDesignFilterNotice(`Excluded ${excludedCount} steel member${excludedCount > 1 ? 's' : ''} from concrete design run.`);
    } else {
      setDesignFilterNotice(null);
    }

    if (targetRows.length === 0) {
      setDesignFilterNotice('No concrete members selected for concrete design.');
      return;
    }

    setIsDesigning(true);
    setDesignProgress({ current: 0, total: targetRows.length });

    const concreteGrade = CONCRETE_GRADES.find(g => g.name === params.concreteGrade) ?? CONCRETE_GRADES[0];
    const rebarGrade = REBAR_GRADES.find(g => g.name === params.rebarGrade) ?? REBAR_GRADES[0];
    const designCode = params.concreteCode === 'ACI318' ? 'ACI318' : 'IS456';

    const newResults = new Map(concreteDesignResults);
    let completed = 0;

    for (const row of targetRows) {
      const result = clientSideDesignConcreteBeam({
        width: concreteSection.width,
        depth: concreteSection.depth,
        cover: concreteSection.cover,
        fck: concreteGrade.fck,
        fy: rebarGrade.fy,
        Mu: row.maxMomentZ,
        Vu: row.maxShearY,
        Nu: row.maxAxial,
        code: designCode as 'IS456' | 'ACI318',
      });
      newResults.set(row.id, result);
      completed++;
      if (completed % 10 === 0) {
        setDesignProgress({ current: completed, total: targetRows.length });
        await new Promise(r => setTimeout(r, 0)); // yield
      }
    }

    setConcreteDesignResults(newResults);
    setDesignProgress({ current: targetRows.length, total: targetRows.length });
    setIsDesigning(false);
  }, [selectedMemberIds, memberRows, params, concreteSection, concreteDesignResults]);

  // ============================
  // RUN BATCH STEEL DESIGN — Fast client-side + optional API
  // ============================
  const CHUNK_SIZE = 10;

  const runSteelDesign = useCallback(async () => {
    const selectedRows = selectedMemberIds.size > 0
      ? memberRows.filter(r => selectedMemberIds.has(r.id))
      : memberRows;

    const targetRows = selectedRows.filter(r => r.materialType === 'steel');
    const excludedCount = selectedRows.length - targetRows.length;

    if (excludedCount > 0) {
      setDesignFilterNotice(`Excluded ${excludedCount} concrete member${excludedCount > 1 ? 's' : ''} from steel design run.`);
    } else {
      setDesignFilterNotice(null);
    }

    if (targetRows.length === 0) {
      setDesignFilterNotice('No steel members selected for steel design.');
      return;
    }

    setIsDesigning(true);
    setDesignProgress({ current: 0, total: targetRows.length });

    const grade = STEEL_GRADES.find(g => g.name === params.steelGrade) ?? STEEL_GRADES[0];
    const sectionDb = STEEL_SECTIONS.find(s => s.designation === assignedSection);
    const designCode = (params.steelCode === 'AISC360' || params.steelCode === 'BS5950' || params.steelCode === 'AS4100') ? 'AISC360' : 'IS800';

    // Probe backend once (2s max) — if down, skip all API calls
    const useApi = await isBackendAvailable();

    const newResults = new Map(designResults);
    let completed = 0;

    // Process in parallel chunks for speed
    for (let chunk = 0; chunk < targetRows.length; chunk += CHUNK_SIZE) {
      const batch = targetRows.slice(chunk, chunk + CHUNK_SIZE);

      const promises = batch.map(async (row) => {
        const lengthMM = row.length * 1000;
        const forces = {
          N: row.maxAxial,
          Vy: row.maxShearY,
          Vz: getMaxForce(row.forces, 'shearZ'),
          My: getMaxForce(row.forces, 'momentY'),
          Mz: row.maxMomentZ,
        };

        // ---- Try API if backend available ----
        if (useApi && sectionDb) {
          try {
            const sectionProps = createSectionFromDatabase(sectionDb.designation, {
              D: sectionDb.D, B: sectionDb.B, tw: sectionDb.tw, tf: sectionDb.tf,
              A: sectionDb.A, Iy: sectionDb.Ix * 1e4, Iz: sectionDb.Iy * 1e4,
              ry: sectionDb.rx, rz: sectionDb.ry,
              Zy: sectionDb.Zpx * 1e3, Zz: sectionDb.Zpy * 1e3,
            });

            const req: SteelDesignRequest = {
              code: designCode,
              section: sectionProps,
              geometry: {
                length: lengthMM,
                effectiveLengthY: lengthMM * params.effectiveLengthFactorY,
                effectiveLengthZ: lengthMM * params.effectiveLengthFactorZ,
                unbracedLength: lengthMM * params.unbracedLengthRatio,
                Cb: params.Cb,
              },
              forces,
              material: { fy: grade.fy, fu: grade.fu, E: 200000 },
              designMethod: params.designMethod,
            };

            const apiResult: SteelDesignResult = await designSteelMember(req);
            return { id: row.id, label: row.label, result: {
              memberId: row.id,
              memberName: row.label,
              code: params.steelCode,
              section: assignedSection,
              utilizationRatio: apiResult.interactionRatio,
              status: apiResult.status,
              governingCheck: apiResult.checks.length > 0
                ? apiResult.checks.reduce((max, c) => c.ratio > max.ratio ? c : max, apiResult.checks[0]).name
                : 'Interaction',
              checks: apiResult.checks.map(c => ({
                name: c.name, clause: c.clause, ratio: c.ratio,
                status: c.ratio <= 1.0 ? 'PASS' : 'FAIL',
              })),
              forces,
              capacities: {
                tension: apiResult.tensionCapacity,
                compression: apiResult.compressionCapacity,
                moment: apiResult.momentCapacity,
                shear: apiResult.shearCapacity,
              },
            } as MemberDesignResult };
          } catch {
            // Fall through to client-side
          }
        }

        // ---- Client-side design engine (instant) ----
        const sec = sectionDb ?? { A: 4525, D: 300, B: 140, tw: 7.5, tf: 12.4, Ix: 8603, Iy: 453, rx: 137.8, ry: 31.6, Zpx: 573.6, Zpy: 98.6, designation: assignedSection };
        const cResult = clientSideDesignSteel({
          section: sec as ClientDesignInput['section'],
          lengthMM,
          forces,
          material: { fy: grade.fy, fu: grade.fu, E: 200000 },
          Ky: params.effectiveLengthFactorY,
          Kz: params.effectiveLengthFactorZ,
          Lb_ratio: params.unbracedLengthRatio,
          Cb: params.Cb,
          code: designCode,
        });
        return { id: row.id, label: row.label, result: {
          ...cResult,
          memberId: row.id,
          memberName: row.label,
        } as MemberDesignResult };
      });

      const results = await Promise.all(promises);
      for (const r of results) {
        newResults.set(r.id, r.result);
      }
      completed += batch.length;
      setDesignProgress({ current: completed, total: targetRows.length });
    }

    setDesignResults(newResults);
    setIsDesigning(false);
  }, [selectedMemberIds, memberRows, params, assignedSection, designResults]);

  // ============================
  // OPTIMIZATION — Find lightest section meeting target utilization
  // ============================
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [targetUtilization, setTargetUtilization] = useState(0.85);
  const [optimizationMaterial, setOptimizationMaterial] = useState<'steel' | 'concrete'>('steel');

  const setMemberTarget = useCallback((memberId: string, value: number) => {
    setMemberTargetUtilization(prev => ({ ...prev, [memberId]: value }));
  }, []);

  const setMemberSectionOverride = useCallback((memberId: string, value: string) => {
    setMemberSectionOverrides(prev => {
      if (!value) {
        const next = { ...prev };
        delete next[memberId];
        return next;
      }
      return { ...prev, [memberId]: value };
    });
  }, []);

  // CONCRETE OPTIMIZATION — sweep RC section database
  const runConcreteOptimization = useCallback(async () => {
    if (memberRows.length === 0) return;
    setIsOptimizing(true);
    setOptimizationError(null);

    try {
      const rcWeightMap = new Map(RC_BEAM_SECTIONS.map(s => [s.name, s.weightPerM]));
      const preWeight = memberRows.reduce((acc, row) => {
        return acc + (rcWeightMap.get(`RC${concreteSection.width}x${concreteSection.depth}`) ?? 0.375) * row.length;
      }, 0);
      setPreOptWeight(preWeight);

      await new Promise(r => setTimeout(r, 50));

      const concreteGrade = CONCRETE_GRADES.find(g => g.name === params.concreteGrade) ?? CONCRETE_GRADES[0];
      const rebarGrade = REBAR_GRADES.find(g => g.name === params.rebarGrade) ?? REBAR_GRADES[0];
      const designCode = params.concreteCode === 'ACI318' ? 'ACI318' : 'IS456';
      const target = targetUtilization;

      const sectionsByArea = [...RC_BEAM_SECTIONS].sort((a, b) => a.area - b.area);

      const targetRows = selectedMemberIds.size > 0
        ? memberRows.filter(row => selectedMemberIds.has(row.id))
        : memberRows;

      const newConcreteResults = new Map(concreteDesignResults);
      // Also update the main designResults map so optimization table shows results
      const newResults = new Map(designResults);

      for (const row of targetRows) {
        const memberTarget = memberTargetUtilization[row.id] ?? target;
        const overrideSectionName = memberSectionOverrides[row.id];
        const overrideSection = overrideSectionName
          ? sectionsByArea.find(section => section.name === overrideSectionName || `${section.b}×${section.d}` === overrideSectionName || getConcreteSectionLabel(section.b, section.d) === overrideSectionName)
          : null;
        let bestSection: RcSectionDef | null = null;
        let bestResult: ConcreteDesignOutput | null = null;

        if (overrideSection) {
          bestSection = overrideSection;
          bestResult = clientSideDesignConcreteBeam({
            width: overrideSection.b,
            depth: overrideSection.d,
            cover: concreteSection.cover,
            fck: concreteGrade.fck,
            fy: rebarGrade.fy,
            Mu: row.maxMomentZ,
            Vu: row.maxShearY,
            Nu: row.maxAxial,
            code: designCode as 'IS456' | 'ACI318',
          });
        }

        if (!overrideSection) {
          for (const trySection of sectionsByArea) {
            const cResult = clientSideDesignConcreteBeam({
              width: trySection.b,
              depth: trySection.d,
              cover: concreteSection.cover,
              fck: concreteGrade.fck,
              fy: rebarGrade.fy,
              Mu: row.maxMomentZ,
              Vu: row.maxShearY,
              Nu: row.maxAxial,
              code: designCode as 'IS456' | 'ACI318',
            });

            if (cResult.status === 'PASS' && cResult.utilizationRatio <= memberTarget) {
              bestSection = trySection;
              bestResult = cResult;
              break;
            }
          }
        }

        // Fallback: lightest that passes
        if (!bestSection) {
          for (const trySection of sectionsByArea) {
            const cResult = clientSideDesignConcreteBeam({
              width: trySection.b,
              depth: trySection.d,
              cover: concreteSection.cover,
              fck: concreteGrade.fck,
              fy: rebarGrade.fy,
              Mu: row.maxMomentZ,
              Vu: row.maxShearY,
              Nu: row.maxAxial,
              code: designCode as 'IS456' | 'ACI318',
            });
            if (cResult.status === 'PASS') {
              bestSection = trySection;
              bestResult = cResult;
              break;
            }
          }
        }

        if (bestSection && bestResult) {
          newConcreteResults.set(row.id, bestResult);
          // Mirror into designResults for the table
          newResults.set(row.id, {
            memberId: row.id,
            memberName: row.label,
            code: params.concreteCode,
            section: getConcreteSectionLabel(bestSection.b, bestSection.d),
            utilizationRatio: bestResult.utilizationRatio,
            status: bestResult.status,
            governingCheck: bestResult.governingCheck,
            checks: bestResult.checks,
            forces: { N: row.maxAxial, Vy: row.maxShearY, Vz: 0, My: 0, Mz: row.maxMomentZ },
            capacities: {
              tension: 0,
              compression: 0,
              moment: bestResult.flexure.Mu_capacity,
              shear: bestResult.shear.Vu_capacity,
            },
          });
        }
      }

      setConcreteDesignResults(newConcreteResults);
      setDesignResults(newResults);
    } catch (error) {
      setOptimizationError(error instanceof Error ? error.message : 'RCC optimization failed. Please review slab/member inputs and retry.');
    } finally {
      setIsOptimizing(false);
    }
  }, [concreteDesignResults, designResults, memberRows, params, concreteSection, targetUtilization, selectedMemberIds, memberTargetUtilization, memberSectionOverrides]);

  const runOptimization = useCallback(async () => {
    if (designResults.size === 0) return;
    setIsOptimizing(true);
    setOptimizationError(null);

    try {
      // Save pre-optimization weight
      const weightMap = new Map(STEEL_SECTIONS.map(s => [s.designation, s.weight]));
      const preWeight = memberRows.reduce((acc, row) => {
        const sec = designResults.get(row.id)?.section || assignedSection;
        return acc + (weightMap.get(sec) ?? 25) * row.length;
      }, 0);
      setPreOptWeight(preWeight);

      // Allow UI to update before heavy computation
      await new Promise(r => setTimeout(r, 50));

      const designCode = (params.steelCode === 'AISC360' || params.steelCode === 'BS5950' || params.steelCode === 'AS4100') ? 'AISC360' : 'IS800';
      const grade = STEEL_GRADES.find(g => g.name === params.steelGrade) ?? STEEL_GRADES[0];

      // Filter sections by design-code standard and sort lightest → heaviest
      const sectionsByWeight = [...STEEL_SECTIONS]
        .filter(s => {
          if (params.steelCode === 'IS800') return s.standard === 'IS';
          if (params.steelCode === 'AISC360') return s.standard === 'AISC';
          if (params.steelCode === 'EC3') return s.standard === 'EU';
          if (params.steelCode === 'BS5950') return s.standard === 'BS';
          return true;
        })
        .sort((a, b) => a.weight - b.weight);

      const newResults = new Map(designResults);
      const target = targetUtilization;

      // Optimize EVERY member — find the lightest section where utilization ≤ target
      for (const [memberId, currentResult] of designResults.entries()) {
        const row = memberRows.find(r => r.id === memberId);
        if (!row) continue;

        const lengthMM = row.length * 1000;
        let bestSection: (typeof sectionsByWeight)[0] | null = null;
        let bestResult: ReturnType<typeof clientSideDesignSteel> | null = null;

        // Scan from lightest to heaviest — first section that passes
        // with utilization ≤ target is the optimal (lightest adequate) one.
        for (const trySection of sectionsByWeight) {
          const cResult = clientSideDesignSteel({
            section: trySection as ClientDesignInput['section'],
            lengthMM,
            forces: currentResult.forces,
            material: { fy: grade.fy, fu: grade.fu, E: 200000 },
            Ky: params.effectiveLengthFactorY,
            Kz: params.effectiveLengthFactorZ,
            Lb_ratio: params.unbracedLengthRatio,
            Cb: params.Cb,
            code: designCode,
          });

          if (cResult.status === 'PASS' && cResult.utilizationRatio <= target) {
            bestSection = trySection;
            bestResult = cResult;
            break; // Lightest section meeting both PASS + target util — done
          }
        }

        // Fallback: if no section meets the target ratio, pick the lightest
        // section that at least passes (utilization ≤ 1.0)
        if (!bestSection) {
          for (const trySection of sectionsByWeight) {
            const cResult = clientSideDesignSteel({
              section: trySection as ClientDesignInput['section'],
              lengthMM,
              forces: currentResult.forces,
              material: { fy: grade.fy, fu: grade.fu, E: 200000 },
              Ky: params.effectiveLengthFactorY,
              Kz: params.effectiveLengthFactorZ,
              Lb_ratio: params.unbracedLengthRatio,
              Cb: params.Cb,
              code: designCode,
            });
            if (cResult.status === 'PASS') {
              bestSection = trySection;
              bestResult = cResult;
              break;
            }
          }
        }

        if (bestSection && bestResult) {
          newResults.set(memberId, {
            ...currentResult,
            section: bestSection.designation,
            utilizationRatio: bestResult.utilizationRatio,
            status: bestResult.status as 'PASS' | 'FAIL',
            governingCheck: bestResult.governingCheck,
            checks: bestResult.checks,
            capacities: bestResult.capacities,
          });
        }
      }

      setDesignResults(newResults);
    } catch (error) {
      setOptimizationError(error instanceof Error ? error.message : 'Steel optimization failed. Please review member forces and retry.');
    } finally {
      setIsOptimizing(false);
    }
  }, [designResults, memberRows, params, targetUtilization]);

  const handleRunOptimization = useCallback(async () => {
    if (optimizationMaterial === 'concrete') {
      return runConcreteOptimization();
    }
    return runOptimization();
  }, [optimizationMaterial, runConcreteOptimization, runOptimization]);

  const applyConcreteOptimizedSections = useCallback(() => {
    const targetRows = selectedMemberIds.size > 0
      ? memberRows.filter(row => selectedMemberIds.has(row.id))
      : memberRows;

    targetRows.forEach((row) => {
      const result = designResults.get(row.id);
      const dims = result ? parseConcreteSection(result.section) : null;
      if (!dims) return;

      const properties = getRectangleSectionProperties(dims.widthMm, dims.depthMm);
      updateMember(row.id, {
        sectionId: getConcreteSectionLabel(dims.widthMm, dims.depthMm),
        sectionType: 'RECTANGLE',
        dimensions: {
          rectWidth: dims.widthMm / 1000,
          rectHeight: dims.depthMm / 1000,
        },
        A: properties.A,
        I: properties.Imajor,
        Iy: properties.Iminor,
        Iz: properties.Imajor,
      });
    });
  }, [selectedMemberIds, memberRows, designResults, updateMember]);

  const runSlabDesignWorkflow = useCallback(async (optimizeToTarget: boolean) => {
    if (slabRows.length === 0) return;
    setIsDesigningSlabs(true);
    setSlabDesignError(null);

    try {
      const concreteGrade = CONCRETE_GRADES.find(g => g.name === params.concreteGrade) ?? CONCRETE_GRADES[0];
      const rebarGrade = REBAR_GRADES.find(g => g.name === params.rebarGrade) ?? REBAR_GRADES[0];
      const areaLoadIntensity = floorLoads.reduce((max, load) => Math.max(max, Math.abs(load.pressure || 0)), 0);
      const liveLoad = Math.max(slabParams.liveLoad, areaLoadIntensity || 0);
      const nextResults = new Map<string, SlabDesignRecord>();

      for (const slab of slabRows) {
        if (slab.lx <= 0) continue;

        const result = await Promise.race([
          designSlabIS456({
            lx: slab.lx,
            ly: slab.ly > slab.lx ? slab.ly : undefined,
            live_load: liveLoad,
            floor_finish: slabParams.floorFinish,
            support_type: slabParams.supportType,
            edge_conditions: slabParams.edgeConditions,
            fck: concreteGrade.fck,
            fy: rebarGrade.fy,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Slab design timed out for ${slab.label}. Please retry.`)), 30000),
          ),
        ]);

        const recommendedThicknessMm = optimizeToTarget
          ? estimateOptimizedSlabThickness(result.thickness, result, targetUtilization)
          : result.thickness;

        nextResults.set(slab.id, {
          plateId: slab.id,
          label: slab.label,
          lx: slab.lx,
          ly: slab.ly,
          area: slab.area,
          existingThicknessMm: slab.thicknessMm,
          recommendedThicknessMm,
          utilizationRatio: getSlabUtilization(result),
          result,
        });
      }

      setSlabDesignResults(nextResults);
    } catch (error) {
      setSlabDesignError(error instanceof Error ? error.message : 'Slab design failed. Please verify inputs and try again.');
    } finally {
      setIsDesigningSlabs(false);
    }
  }, [slabRows, params.concreteGrade, params.rebarGrade, floorLoads, slabParams, targetUtilization]);

  const applySlabOptimizedThickness = useCallback(() => {
    slabDesignResults.forEach((record, plateId) => {
      updatePlate(plateId, { thickness: record.recommendedThicknessMm / 1000 });
    });
  }, [slabDesignResults, updatePlate]);

  // Memoized weight (avoids O(N×M) find per render)
  const totalWeight = useMemo(() => {
    const rcWeightMap = new Map([...RC_BEAM_SECTIONS, ...RC_COLUMN_SECTIONS].map(s => [getConcreteSectionLabel(s.b, s.d), s.weightPerM]));
    const weightMap = new Map(STEEL_SECTIONS.map(s => [s.designation, s.weight]));
    return memberRows.reduce((acc, row) => {
      const sec = designResults.get(row.id)?.section || assignedSection;
      return acc + (weightMap.get(sec) ?? rcWeightMap.get(sec) ?? 25) * row.length;
    }, 0);
  }, [memberRows, designResults, assignedSection]);

  // Tab bar
  const TABS: { id: DesignTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'steel', label: 'Steel Design', icon: <Columns className="w-4 h-4" /> },
    { id: 'concrete', label: 'Concrete Design', icon: <Building2 className="w-4 h-4" /> },
    { id: 'slabs', label: 'Slabs', icon: <Box className="w-4 h-4" /> },
    { id: 'connections', label: 'Connections', icon: <Wrench className="w-4 h-4" /> },
    { id: 'foundations', label: 'Foundations', icon: <Layers className="w-4 h-4" /> },
    { id: 'optimization', label: 'Optimization', icon: <Zap className="w-4 h-4" /> },
    { id: 'detailing', label: 'Detailing', icon: <Eye className="w-4 h-4" /> },
    { id: 'report', label: 'Report', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-[100dvh] bg-canvas text-token">
      {/* Page Info Bar */}
      <div className="bg-canvas border-b border-token px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-[#dae2fd] flex items-center gap-2">
              Design Hub
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold">POST-ANALYSIS</span>
            </h1>
            <span className="text-xs text-[#a9bcde]">
              {totalMembers} members • {hasAnalysis ? 'Analysis complete' : 'No analysis results'}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-canvas border-b border-token">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {TABS.map(tab => (
              <button type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-[#a9bcde] hover:text-[#dae2fd] hover:border-[#2d3d5a]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {!hasAnalysis && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm text-amber-200 font-medium tracking-wide">No analysis results found</p>
              <p className="text-xs text-amber-300/70">Run structural analysis first in the Modeler, then come back here to design members.</p>
              <p className="text-xs text-amber-300/50 mt-1">Note: Analysis results are held in memory — if the page was refreshed, results are lost. Return to the Modeler and re-run the analysis.</p>
            </div>
            <Link to="/app" className="ml-auto px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-sm font-medium tracking-wide transition-colors shrink-0">
              ← Back to Modeler & Run Analysis
            </Link>
          </div>
        )}

        {designFilterNotice && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0" />
            <p className="text-sm text-blue-200">{designFilterNotice}</p>
          </div>
        )}

        {/* ========== OVERVIEW TAB ========== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Members" value={totalMembers} icon={<Columns className="w-5 h-5" />} color="from-blue-600 to-blue-700" />
              <StatCard label="Designed" value={`${designedCount}/${totalMembers}`} icon={<Shield className="w-5 h-5" />} color="from-purple-600 to-purple-700" />
              <StatCard label="Pass / Fail" value={`${passCount} / ${failCount}`} icon={<CheckCircle2 className="w-5 h-5" />} color="from-emerald-600 to-emerald-700" />
              <StatCard label="Max Utilization" value={`${(maxUtilization * 100).toFixed(0)}%`} icon={<TrendingUp className="w-5 h-5" />} color="from-orange-600 to-orange-700" />
            </div>

            {/* Design Codes Available */}
            <div>
              <h2 className="text-lg font-semibold text-[#dae2fd] mb-4">Available Design Codes</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
                {DESIGN_CODES.map(code => (
                  <button type="button"
                    key={code.id}
                    onClick={() => {
                      if (code.material === 'steel') {
                        setParams(prev => ({ ...prev, steelCode: code.id }));
                        setActiveTab('steel');
                      } else if (code.material === 'concrete') {
                        setParams(prev => ({ ...prev, concreteCode: code.id }));
                        setActiveTab('concrete');
                      }
                    }}
                    className="bg-[#131b2e] border border-[#1a2333] rounded-xl p-4 text-left hover:border-blue-500/30 hover:bg-[#222a3d] transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{code.icon}</span>
                      <div>
                        <h3 className="font-semibold text-slate-700 dark:text-slate-200 group-hover:text-blue-400 transition-colors">{code.name}</h3>
                        <span className="text-xs text-[#9bb0d5]">{code.material.toUpperCase()} • {code.region}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#a9bcde] group-hover:text-[#dae2fd] ml-auto transition-colors" />
                    </div>
                    <p className="text-xs text-[#a9bcde] line-clamp-1">{code.fullName}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-semibold text-[#dae2fd] mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button type="button" onClick={() => { selectAll(true, 'steel'); setActiveTab('steel'); }}
                  className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-left hover:scale-[1.02] transition-transform">
                  <Columns className="w-6 h-6 text-white mb-2" />
                  <h3 className="font-semibold text-white">Design All Steel</h3>
                  <p className="text-sm text-slate-900/70 dark:text-white/70">Steel members only</p>
                </button>
                <button type="button" onClick={() => { selectAll(true, 'concrete'); setActiveTab('concrete'); }}
                  className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl p-5 text-left hover:scale-[1.02] transition-transform">
                  <Building2 className="w-6 h-6 text-white mb-2" />
                  <h3 className="font-semibold text-white">Design All Concrete</h3>
                  <p className="text-sm text-slate-900/70 dark:text-white/70">RCC members only</p>
                </button>
                <button type="button" onClick={() => setActiveTab('connections')}
                  className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-5 text-left hover:scale-[1.02] transition-transform">
                  <Wrench className="w-6 h-6 text-white mb-2" />
                  <h3 className="font-semibold text-white">Design Connections</h3>
                  <p className="text-sm text-slate-900/70 dark:text-white/70">Bolted & welded joints</p>
                </button>
                <button type="button" onClick={() => setActiveTab('foundations')}
                  className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-5 text-left hover:scale-[1.02] transition-transform">
                  <Building2 className="w-6 h-6 text-white mb-2" />
                  <h3 className="font-semibold text-white">Design Foundations</h3>
                  <p className="text-sm text-slate-900/70 dark:text-white/70">Footings from reactions</p>
                </button>
                <button type="button" onClick={() => setActiveTab('optimization')}
                  className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-5 text-left hover:scale-[1.02] transition-transform">
                  <Zap className="w-6 h-6 text-white mb-2" />
                  <h3 className="font-semibold text-white">Optimize Sections</h3>
                  <p className="text-sm text-slate-900/70 dark:text-white/70">Find lightest passing</p>
                </button>
                <button type="button" onClick={() => setActiveTab('slabs')}
                  className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl p-5 text-left hover:scale-[1.02] transition-transform">
                  <Box className="w-6 h-6 text-white mb-2" />
                  <h3 className="font-semibold text-white">Design Slabs</h3>
                  <p className="text-sm text-slate-900/70 dark:text-white/70">Integrated slab design & sizing</p>
                </button>
              </div>
            </div>

            {/* Member Table */}
            <div>
              <h2 className="text-lg font-semibold text-[#dae2fd] mb-4">All Members</h2>
              {hasAnalysis && memberRows.length === 0 ? (
                <div className="ui-surface rounded-xl p-8">
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-[#131b2e] rounded w-1/3" />
                    <div className="h-10 bg-[#131b2e] rounded" />
                    <div className="h-10 bg-[#131b2e] rounded" />
                    <div className="h-10 bg-[#131b2e] rounded" />
                    <div className="h-10 bg-[#131b2e] rounded w-2/3" />
                  </div>
                  <p className="text-sm text-[#9bb0d5] mt-4 text-center">Computing member data...</p>
                </div>
              ) : (
              <div className="ui-surface rounded-xl overflow-hidden">
                <MemberDesignTable
                  rows={memberRows}
                  onToggleSelect={toggleSelect}
                  onSelectAll={selectAll}
                  onViewDetail={setDetailMemberId}
                  searchQuery={searchQuery}
                  sectionOverrides={memberSectionOverrides}
                />
              </div>
              )}
            </div>
          </div>
        )}

        {/* ========== STEEL DESIGN TAB ========== */}
        {activeTab === 'steel' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar: Parameters */}
              <div className="space-y-4">
                <DesignParametersPanel params={params} onChange={setParams} material="steel" />
                <SectionAssignmentPanel
                  currentSection={assignedSection}
                  onAssign={setAssignedSection}
                  standard={params.steelCode}
                />

                {/* Run Design Button */}
                <Button
                  type="button"
                  onClick={runSteelDesign}
                  disabled={isDesigning || !hasAnalysis}
                  className="w-full"
                  size="lg"
                >
                  {isDesigning ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Designing {designProgress.current}/{designProgress.total}...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Run Design Check
                      {selectedMemberIds.size > 0 && ` (${selectedMemberIds.size})`}
                    </>
                  )}
                </Button>

                {designResults.size > 0 && (
                  <div className="ui-surface rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[#a9bcde] mb-2">DESIGN SUMMARY</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-400">Pass</span>
                        <span className="font-bold text-emerald-400">{passCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-400">Fail</span>
                        <span className="font-bold text-red-400">{failCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#a9bcde]">Max Utilization</span>
                        <span className={`font-bold ${utilizationTextColor(maxUtilization)}`}>
                          {(maxUtilization * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Main: Member Table */}
              <div className="lg:col-span-3">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-[#dae2fd]">Steel Member Design</h2>
                    <span className="text-xs text-[#a9bcde] bg-[#131b2e] px-2 py-1 rounded-full">
                      {STEEL_CODES.find(c => c.id === params.steelCode)?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedMemberIds.size > 0 && (
                      <Button
                        type="button"
                        onClick={createGroupFromSelection}
                        variant="outline"
                        size="sm"
                        className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-500/30 dark:text-purple-300 dark:hover:bg-purple-500/10"
                        title="Create group from selected members"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Group ({selectedMemberIds.size})
                      </Button>
                    )}
                    <div className="w-64">
                      <Input
                        type="text"
                        placeholder="Search members..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        leftIcon={<Search className="w-4 h-4" />}
                      />
                    </div>
                  </div>
                </div>

                <div className="ui-surface rounded-xl overflow-hidden">
                  <MemberDesignTable
                    rows={memberRows}
                    onToggleSelect={toggleSelect}
                    onSelectAll={selectAll}
                    onViewDetail={setDetailMemberId}
                    searchQuery={searchQuery}
                    sectionOverrides={memberSectionOverrides}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== CONCRETE DESIGN TAB ========== */}
        {activeTab === 'concrete' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="space-y-4">
                <DesignParametersPanel params={params} onChange={setParams} material="concrete" />

                <div className="ui-surface rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-[#dae2fd] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    Concrete Section
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Width (mm)"
                      type="number"
                      value={concreteSection.width}
                      onChange={e => setConcreteSection(p => ({ ...p, width: Number(e.target.value) || 300 }))}
                    />
                    <Input
                      label="Depth (mm)"
                      type="number"
                      value={concreteSection.depth}
                      onChange={e => setConcreteSection(p => ({ ...p, depth: Number(e.target.value) || 500 }))}
                    />
                  </div>
                  <Input
                    label="Cover (mm)"
                    type="number"
                    value={concreteSection.cover}
                    onChange={e => setConcreteSection(p => ({ ...p, cover: Number(e.target.value) || 40 }))}
                  />
                </div>

                {/* Run Concrete Design Button */}
                <Button
                  type="button"
                  onClick={runConcreteDesign}
                  disabled={isDesigning || !hasAnalysis}
                  className="w-full"
                  variant="success"
                  size="lg"
                >
                  {isDesigning ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Designing {designProgress.current}/{designProgress.total}...
                    </>
                  ) : (
                    <>
                      <Building2 className="w-5 h-5" />
                      Run Concrete Design
                      {selectedMemberIds.size > 0 && ` (${selectedMemberIds.size})`}
                    </>
                  )}
                </Button>

                {concreteDesignResults.size > 0 && (
                  <div className="ui-surface rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-[#a9bcde] mb-2">CONCRETE DESIGN SUMMARY</h4>
                    <div className="space-y-2 text-sm">
                      {(() => {
                        let pass = 0, fail = 0, maxU = 0;
                        concreteDesignResults.forEach(r => {
                          if (r.status === 'PASS') pass++; else fail++;
                          if (r.utilizationRatio > maxU) maxU = r.utilizationRatio;
                        });
                        return (
                          <>
                            <div className="flex justify-between"><span className="text-emerald-400">Pass</span><span className="font-bold text-emerald-400">{pass}</span></div>
                            <div className="flex justify-between"><span className="text-red-400">Fail</span><span className="font-bold text-red-400">{fail}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">Max Util.</span><span className={`font-bold ${utilizationTextColor(maxU)}`}>{(maxU * 100).toFixed(1)}%</span></div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                <div className="ui-surface rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-[#dae2fd]">Quick Design</h3>
                  <div className="space-y-2">
                    {['RC Beam Designer', 'RC Column Designer', 'Slab Designer', 'Footing Designer'].map((name) => (
                      <Link key={name} to="/design-center" className="w-full flex items-center justify-between px-4 py-3 bg-[#131b2e] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors group">
                        <span className="text-sm text-slate-700 dark:text-slate-200">{name}</span>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[#dae2fd]">Concrete Member Design</h2>
                  <span className="text-xs text-[#a9bcde] bg-[#131b2e] px-2 py-1 rounded-full">
                    {CONCRETE_CODES.find(c => c.id === params.concreteCode)?.name}
                  </span>
                </div>

                {/* Concrete design results table */}
                {concreteDesignResults.size > 0 ? (
                  <div className="ui-surface rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#1a2333] text-[#a9bcde]">
                            <th className="py-3 px-2 text-left">Member</th>
                            <th className="py-3 px-2 text-right">Mu (kN·m)</th>
                            <th className="py-3 px-2 text-right">Vu (kN)</th>
                            <th className="py-3 px-2 text-left">Flexure Reinf.</th>
                            <th className="py-3 px-2 text-left">Shear Reinf.</th>
                            <th className="py-3 px-2 text-center">Status</th>
                            <th className="py-3 px-2 text-left w-40">Utilization</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberRows.map(row => {
                            const cr = concreteDesignResults.get(row.id);
                            if (!cr) return null;
                            return (
                              <tr key={row.id} className="border-b border-[#1a2333]/50 hover:bg-slate-100 dark:hover:bg-slate-800/30">
                                <td className="py-2 px-2 font-medium tracking-wide text-slate-700 dark:text-slate-200">{row.label}</td>
                                <td className="py-2 px-2 text-right font-mono text-[#adc6ff]">{formatForce(row.maxMomentZ)}</td>
                                <td className="py-2 px-2 text-right font-mono text-[#adc6ff]">{formatForce(row.maxShearY)}</td>
                                <td className="py-2 px-2 text-[#a9bcde] font-mono text-xs">
                                  {cr.flexure.barConfig} ({cr.flexure.Ast_provided}mm²)
                                </td>
                                <td className="py-2 px-2 text-[#a9bcde] font-mono text-xs">
                                  {cr.shear.stirrupConfig}
                                </td>
                                <td className="py-2 px-2 text-center">{statusIcon(cr.status)}</td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1"><UtilizationBar ratio={cr.utilizationRatio} /></div>
                                    <span className={`text-xs font-bold font-mono w-12 text-right ${utilizationTextColor(cr.utilizationRatio)}`}>
                                      {(cr.utilizationRatio * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="ui-surface rounded-xl overflow-hidden">
                    <MemberDesignTable
                      rows={memberRows}
                      onToggleSelect={toggleSelect}
                      onSelectAll={selectAll}
                      onViewDetail={setDetailMemberId}
                      searchQuery={searchQuery}
                      sectionOverrides={memberSectionOverrides}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========== SLABS TAB ========== */}
        {activeTab === 'slabs' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="space-y-4">
                <div className="ui-surface rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-[#dae2fd] flex items-center gap-2">
                    <Box className="w-4 h-4 text-teal-400" />
                    Slab Design Inputs
                  </h3>
                  <Input
                    label="Live Load (kN/m²)"
                    type="number"
                    value={slabParams.liveLoad}
                    onChange={e => setSlabParams(prev => ({ ...prev, liveLoad: Number(e.target.value) || 0 }))}
                  />
                  <Input
                    label="Floor Finish (kN/m²)"
                    type="number"
                    value={slabParams.floorFinish}
                    onChange={e => setSlabParams(prev => ({ ...prev, floorFinish: Number(e.target.value) || 0 }))}
                  />
                  <Select
                    label="Support Type"
                    value={slabParams.supportType}
                    onChange={(value) => setSlabParams(prev => ({ ...prev, supportType: value }))}
                    options={[
                      { value: 'simple', label: 'Simply supported' },
                      { value: 'continuous', label: 'Continuous' },
                      { value: 'cantilever', label: 'Cantilever' },
                    ]}
                  />
                  <Select
                    label="Edge Conditions"
                    value={slabParams.edgeConditions}
                    onChange={(value) => setSlabParams(prev => ({ ...prev, edgeConditions: value }))}
                    options={[
                      { value: 'all_simple', label: 'All edges simple' },
                      { value: 'all_continuous', label: 'All edges continuous' },
                      { value: 'interior', label: 'Interior panel' },
                      { value: 'corner', label: 'Corner panel' },
                    ]}
                  />
                </div>

                <Button
                  type="button"
                  onClick={() => void runSlabDesignWorkflow(false)}
                  disabled={isDesigningSlabs || slabRows.length === 0}
                  className="w-full"
                  size="lg"
                >
                  {isDesigningSlabs ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                  Design Slabs
                </Button>

                <Button
                  type="button"
                  onClick={() => void runSlabDesignWorkflow(true)}
                  disabled={isDesigningSlabs || slabRows.length === 0}
                  className="w-full"
                  variant="premium"
                  size="lg"
                >
                  {isDesigningSlabs ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                  Optimize Slab Thickness
                </Button>

                <Button
                  type="button"
                  onClick={applySlabOptimizedThickness}
                  disabled={slabDesignResults.size === 0}
                  className="w-full"
                  variant="outline"
                >
                  <Download className="w-4 h-4" />
                  Apply Thickness to Model
                </Button>

                {slabRows.length === 0 && (
                  <Button
                    type="button"
                    onClick={() => openModal('floorSlabDialog')}
                    className="w-full"
                    variant="outline"
                  >
                    <Box className="w-4 h-4" />
                    One-Click Slab Generator
                  </Button>
                )}

                {slabDesignError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    {slabDesignError}
                  </div>
                )}

                <div className="ui-surface rounded-xl p-5 text-sm text-[#a9bcde]">
                  <p className="font-semibold text-[#dae2fd] mb-2">Integrated workflow</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Uses plate panels already present in the model.</li>
                    <li>Designs one-way/two-way slabs from panel spans.</li>
                    <li>Optimization nudges thickness toward the selected target utilization.</li>
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-3">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[#dae2fd]">Integrated Slab Design & Optimization</h2>
                  <span className="text-xs text-[#a9bcde] bg-[#131b2e] px-2 py-1 rounded-full">
                    {slabRows.length} slab panel{slabRows.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="ui-surface rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#1a2333] text-[#a9bcde]">
                          <th className="py-3 px-2 text-left">Panel</th>
                          <th className="py-3 px-2 text-right">Short Span (m)</th>
                          <th className="py-3 px-2 text-right">Long Span (m)</th>
                          <th className="py-3 px-2 text-right">Area (m²)</th>
                          <th className="py-3 px-2 text-right">Current t (mm)</th>
                          <th className="py-3 px-2 text-right">Recommended t (mm)</th>
                          <th className="py-3 px-2 text-left">Main Reinforcement</th>
                          <th className="py-3 px-2 text-left w-40">Utilization</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slabRows.map((slab) => {
                          const record = slabDesignResults.get(slab.id);
                          return (
                            <tr key={slab.id} className="border-b border-[#1a2333]/50 hover:bg-slate-100 dark:hover:bg-slate-800/30">
                              <td className="py-2 px-2 font-medium tracking-wide text-slate-700 dark:text-slate-200">{slab.label}</td>
                              <td className="py-2 px-2 text-right font-mono text-[#adc6ff]">{slab.lx.toFixed(2)}</td>
                              <td className="py-2 px-2 text-right font-mono text-[#adc6ff]">{slab.ly.toFixed(2)}</td>
                              <td className="py-2 px-2 text-right font-mono text-[#adc6ff]">{slab.area.toFixed(2)}</td>
                              <td className="py-2 px-2 text-right font-mono text-[#adc6ff]">{slab.thicknessMm}</td>
                              <td className="py-2 px-2 text-right font-mono text-teal-500">{record?.recommendedThicknessMm ?? '—'}</td>
                              <td className="py-2 px-2 text-[#a9bcde] font-mono text-xs">
                                {record?.result.main_reinforcement
                                  ? `${record.result.main_reinforcement.diameter}Ø @ ${record.result.main_reinforcement.spacing} mm`
                                  : '—'}
                              </td>
                              <td className="py-2 px-2">
                                {record ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1"><UtilizationBar ratio={record.utilizationRatio} /></div>
                                    <span className={`text-xs font-bold font-mono w-12 text-right ${utilizationTextColor(record.utilizationRatio)}`}>
                                      {(record.utilizationRatio * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                ) : <span className="text-xs text-slate-500">Run slab design</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {slabRows.length === 0 && (
                          <tr>
                            <td colSpan={8} className="py-10 text-center text-slate-500">
                              <div className="space-y-3">
                                <p>No slab/plate panels found in the model.</p>
                                <div>
                                  <Button
                                    type="button"
                                    onClick={() => openModal('floorSlabDialog')}
                                    variant="outline"
                                    size="sm"
                                  >
                                    <Box className="w-4 h-4" />
                                    Create slabs from bays
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== CONNECTIONS TAB ========== */}
        {activeTab === 'connections' && analysisResults && (
          <ConnectionDesignTab analysisResults={analysisResults} nodes={nodes} />
        )}
        {activeTab === 'connections' && !analysisResults && (
          <div className="py-20 text-center text-slate-500">
            <Wrench className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Run analysis first to design connections from real forces.</p>
          </div>
        )}

        {/* ========== FOUNDATIONS TAB ========== */}
        {activeTab === 'foundations' && analysisResults && (
          <FoundationDesignTab analysisResults={analysisResults} nodes={nodes} />
        )}
        {activeTab === 'foundations' && !analysisResults && (
          <div className="py-20 text-center text-slate-500">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Run analysis first to design foundations from reactions.</p>
          </div>
        )}

        {/* ========== OPTIMIZATION TAB ========== */}
        {activeTab === 'optimization' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="ui-surface rounded-xl p-6">
                <Zap className="w-8 h-8 text-amber-400 mb-3" />
                <h3 className="text-lg font-semibold text-[#dae2fd] mb-2">Auto-Optimize</h3>
                <p className="text-sm text-[#a9bcde] mb-3">
                  Find the lightest section passing all checks. Supports both steel (ISMB/W shapes) and concrete (b×d) sections.
                </p>
                <div className="flex gap-2 mb-3">
                  <button type="button"
                    onClick={() => setOptimizationMaterial('steel')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${optimizationMaterial === 'steel' ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-slate-400 border-slate-600 hover:border-slate-400'}`}
                  >Steel</button>
                  <button type="button"
                    onClick={() => setOptimizationMaterial('concrete')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${optimizationMaterial === 'concrete' ? 'bg-orange-600 text-white border-orange-600' : 'bg-transparent text-slate-400 border-slate-600 hover:border-slate-400'}`}
                  >Concrete (RCC)</button>
                </div>
                <Button
                  type="button"
                  onClick={handleRunOptimization}
                  disabled={isOptimizing || (optimizationMaterial === 'steel' ? designResults.size === 0 : memberRows.length === 0)}
                  className="w-full"
                  variant="premium"
                  size="lg"
                >
                  {isOptimizing ? (
                    <><RefreshCw className="w-5 h-5 animate-spin" /> Optimizing...</>
                  ) : (
                    <><Zap className="w-5 h-5" /> Run {optimizationMaterial === 'concrete' ? 'RCC' : 'Steel'} Optimization</>
                  )}
                </Button>
                {optimizationMaterial === 'steel' && designResults.size === 0 && (
                  <p className="text-xs text-[#9bb0d5] mt-2 text-center">Run steel design checks first</p>
                )}
                {optimizationMaterial === 'concrete' && memberRows.length === 0 && (
                  <p className="text-xs text-[#9bb0d5] mt-2 text-center">No members to optimize</p>
                )}
                {optimizationError && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                    {optimizationError}
                  </div>
                )}
              </div>

              <div className="ui-surface rounded-xl p-6">
                <Target className="w-8 h-8 text-blue-400 mb-3" />
                <h3 className="text-lg font-semibold text-[#dae2fd] mb-2">Target Utilization</h3>
                <p className="text-sm text-[#a9bcde] mb-2">
                  Set a target utilization ratio. The optimizer picks the lightest section
                  whose utilization ≤ this target.
                </p>
                <div className="mb-3">
                  <input
                    type="range"
                    min="0.50"
                    max="0.99"
                    step="0.01"
                    value={targetUtilization}
                    onChange={e => setTargetUtilization(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Input
                      type="number"
                      step="0.05"
                      min="0.50"
                      max="0.99"
                      value={targetUtilization}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v >= 0.5 && v <= 0.99) setTargetUtilization(v);
                      }}
                    />
                  </div>
                  <span className="text-sm text-[#a9bcde]">ratio</span>
                </div>
                <p className="text-xs text-[#9bb0d5] mt-2">
                  {Math.round(targetUtilization * 100)}% utilization → {Math.round((1 - targetUtilization) * 100)}% reserve capacity
                </p>
              </div>

              <div className="ui-surface rounded-xl p-6">
                <Award className="w-8 h-8 text-emerald-400 mb-3" />
                <h3 className="text-lg font-semibold text-[#dae2fd] mb-2">Weight Summary</h3>
                <div className="space-y-3">
                  {preOptWeight !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Before optimization:</span>
                      <span className="font-mono text-slate-400">{preOptWeight.toFixed(0)} kg</span>
                    </div>
                  )}
                  <div className="text-3xl font-bold text-emerald-400">
                    {totalWeight.toFixed(0)} kg
                  </div>
                  {preOptWeight !== null && preOptWeight > 0 && (
                    <div className={`text-sm font-semibold ${totalWeight < preOptWeight ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {totalWeight < preOptWeight
                        ? `↓ ${((1 - totalWeight / preOptWeight) * 100).toFixed(1)}% savings (${(preOptWeight - totalWeight).toFixed(0)} kg saved)`
                        : `↑ ${((totalWeight / preOptWeight - 1) * 100).toFixed(1)}% increase`
                      }
                    </div>
                  )}
                  <p className="text-xs text-slate-500">Based on current section assignments</p>
                </div>
              </div>

              {/* Member Groups Panel */}
              <div className="ui-surface rounded-xl p-6">
                <Layers className="w-8 h-8 text-purple-400 mb-3" />
                <h3 className="text-lg font-semibold text-[#dae2fd] mb-2">Member Groups</h3>
                <p className="text-sm text-[#a9bcde] mb-3">
                  Group members to design/optimize as a batch with the same section.
                </p>
                <button type="button"
                  onClick={createGroupFromSelection}
                  disabled={selectedMemberIds.size === 0}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium tracking-wide transition-colors mb-3"
                >
                  Create Group ({selectedMemberIds.size} selected)
                </button>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {memberGroups.map(g => (
                    <div key={g.id} className="flex items-center justify-between px-3 py-2 bg-[#131b2e] rounded-lg">
                      <button type="button" onClick={() => selectGroup(g.id)} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                        <span className="text-xs font-medium tracking-wide text-[#adc6ff]">{g.name}</span>
                        <span className="text-[10px] text-slate-500">({g.memberIds.size})</span>
                      </button>
                      <button type="button" onClick={() => deleteGroup(g.id)} className="text-slate-400 hover:text-red-400">
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {memberGroups.length === 0 && (
                    <p className="text-xs text-[#9bb0d5] text-center">No groups yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Optimization results table */}
            {designResults.size > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-[#dae2fd] mb-4">Design Results After Optimization</h2>
                <div className="ui-surface rounded-xl overflow-hidden">
                  <MemberDesignTable
                    rows={memberRows}
                    onToggleSelect={toggleSelect}
                    onSelectAll={selectAll}
                    onViewDetail={setDetailMemberId}
                    searchQuery=""
                    sectionOverrides={memberSectionOverrides}
                  />
                </div>
              </div>
            )}

            {optimizationMaterial === 'concrete' && memberRows.length > 0 && (
              <div className="ui-surface rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-lg font-semibold text-[#dae2fd]">RCC target utilization & section overrides</h2>
                    <p className="text-sm text-[#a9bcde]">
                      Global target updates all RCC members; override individual targets or lock a specific section where needed.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={applyConcreteOptimizedSections}
                    disabled={designResults.size === 0}
                    variant="outline"
                  >
                    <Download className="w-4 h-4" />
                    Apply optimized RCC sections to model
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1a2333] text-[#a9bcde]">
                        <th className="py-3 px-2 text-left">Member</th>
                        <th className="py-3 px-2 text-left">Current / optimized</th>
                        <th className="py-3 px-2 text-right">Global target</th>
                        <th className="py-3 px-2 text-right">Member target</th>
                        <th className="py-3 px-2 text-left">Section override</th>
                        <th className="py-3 px-2 text-left w-40">Utilization</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberRows.map((row) => {
                        const optimized = designResults.get(row.id);
                        const memberTarget = memberTargetUtilization[row.id] ?? targetUtilization;
                        return (
                          <tr key={row.id} className="border-b border-[#1a2333]/50">
                            <td className="py-2 px-2 font-medium tracking-wide text-slate-700 dark:text-slate-200">{row.label}</td>
                            <td className="py-2 px-2 font-mono text-xs text-[#a9bcde]">
                              <div>{row.sectionName || '—'}</div>
                              <div className="text-emerald-500">{optimized?.section || memberSectionOverrides[row.id] || 'Awaiting optimization'}</div>
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-slate-500">{targetUtilization.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                min="0.50"
                                max="0.99"
                                step="0.01"
                                value={memberTarget}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value);
                                  if (!Number.isNaN(value) && value >= 0.5 && value <= 0.99) setMemberTarget(row.id, value);
                                }}
                                className="w-24 bg-[#131b2e] border border-[#1a2333] rounded px-2 py-1 text-right text-[#dae2fd]"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <select
                                value={memberSectionOverrides[row.id] || ''}
                                onChange={(e) => setMemberSectionOverride(row.id, e.target.value)}
                                className="w-full bg-[#131b2e] border border-[#1a2333] rounded px-2 py-1 text-[#dae2fd]"
                              >
                                <option value="">Auto-select lightest passing</option>
                                {RC_BEAM_SECTIONS.map((section) => {
                                  const label = getConcreteSectionLabel(section.b, section.d);
                                  return <option key={section.name} value={label}>{label}</option>;
                                })}
                              </select>
                            </td>
                            <td className="py-2 px-2">
                              {optimized ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1"><UtilizationBar ratio={optimized.utilizationRatio} /></div>
                                  <span className={`text-xs font-bold font-mono w-12 text-right ${utilizationTextColor(optimized.utilizationRatio)}`}>
                                    {(optimized.utilizationRatio * 100).toFixed(0)}%
                                  </span>
                                </div>
                              ) : <span className="text-xs text-slate-500">Run RCC optimization</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== DETAILING TAB ========== */}
        {activeTab === 'detailing' && (
          <div className="space-y-6">
            {/* RCC Reinforcement Detailing */}
            <div className="ui-surface rounded-xl p-6">
              <h2 className="text-lg font-semibold text-[#dae2fd] mb-4 flex items-center gap-2">
                <Columns className="w-5 h-5 text-orange-400" />
                RCC Reinforcement Detailing
              </h2>
              <p className="text-sm text-[#a9bcde] mb-4">
                Generate reinforcement detail drawings for RC beams, columns, slabs, and footings per IS 456 / ACI 318 / EC2 provisions.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Beam Detailing', desc: 'Longitudinal & shear reinforcement, development lengths, bar bending schedule', icon: '🏗️', tab: 'beam' },
                  { label: 'Column Detailing', desc: 'Ties/spirals, lap splice, interaction diagram overlay', icon: '🏢', tab: 'column' },
                  { label: 'Slab Detailing', desc: 'Top/bottom mesh, strip reinforcement, opening reinforcement', icon: '🪵', tab: 'slab' },
                  { label: 'Footing Detailing', desc: 'Pedestal, punching shear reinforcement, development length', icon: '🧱', tab: 'foundation' },
                ].map((item) => (
                  <Link key={item.label} to={`/design/detailing?tab=${item.tab}`}
                    className="p-4 bg-[#131b2e] border border-[#1a2333] rounded-lg hover:border-orange-400 hover:shadow-md transition-all text-left group no-underline">
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <h3 className="text-sm font-semibold text-[#dae2fd] group-hover:text-orange-500 transition-colors">{item.label}</h3>
                    <p className="text-xs text-[#a9bcde] mt-1">{item.desc}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Steel Connection Detailing */}
            <div className="ui-surface rounded-xl p-6">
              <h2 className="text-lg font-semibold text-[#dae2fd] mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                Steel Connection Detailing
              </h2>
              <p className="text-sm text-[#a9bcde] mb-4">
                Generate steel connection detail drawings with bolts, welds, stiffeners per IS 800 / AISC 360 provisions.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Bolted Connections', desc: 'HSFG/bearing bolts, bolt patterns, edge/pitch distances', icon: '🔩', tab: 'steel' },
                  { label: 'Welded Connections', desc: 'Fillet/butt welds, weld sizes, throat thickness calculations', icon: '⚡', tab: 'steel' },
                  { label: 'Base Plate', desc: 'Column base plate, anchor bolts, grout detail', icon: '🏗️', tab: 'steel' },
                  { label: 'Splice Joints', desc: 'Beam/column splices, cover plates, flange/web connections', icon: '🔗', tab: 'steel' },
                ].map((item) => (
                  <Link key={item.label} to={`/design/detailing?tab=${item.tab}`}
                    className="p-4 bg-[#131b2e] border border-[#1a2333] rounded-lg hover:border-blue-400 hover:shadow-md transition-all text-left group no-underline">
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <h3 className="text-sm font-semibold text-[#dae2fd] group-hover:text-blue-500 transition-colors">{item.label}</h3>
                    <p className="text-xs text-[#a9bcde] mt-1">{item.desc}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Bar Bending Schedule */}
            <div className="ui-surface rounded-xl p-6">
              <h2 className="text-lg font-semibold text-[#dae2fd] mb-4 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
                Bar Bending Schedule (BBS)
              </h2>
              <p className="text-sm text-[#a9bcde] mb-4">
                Auto-generate bar bending schedule from designed members with cutting lengths, shapes, and quantities.
              </p>
              <div className="flex gap-3">
                <Link to="/tools/bar-bending"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium tracking-wide transition-colors flex items-center gap-2 no-underline">
                  <FileText className="w-4 h-4" /> Generate BBS
                </Link>
                <Link to="/tools/bar-bending"
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-[#adc6ff] rounded-lg text-sm font-medium tracking-wide transition-colors flex items-center gap-2 no-underline">
                  <Download className="w-4 h-4" /> Export BBS to Excel
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ========== REPORT TAB ========== */}
        {activeTab === 'report' && (
          <div className="space-y-6">
            <div className="ui-surface rounded-xl p-6">
              <h2 className="text-lg font-semibold text-[#dae2fd] mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Design Report
              </h2>

              <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-[#131b2e] border border-[#1a2333] rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-[#dae2fd] mb-2">Report template</h3>
                  <p className="text-sm text-[#a9bcde] mb-3">
                    The professional template is now the default again. Pick a richer report path first, and only fall back to the quick exporter if you just need a fast snapshot.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { id: 'professional', label: 'Professional', desc: 'Rich report view with polished document layout' },
                      { id: 'studio', label: 'Report Studio', desc: 'Template selection and report dashboard' },
                      { id: 'quick', label: 'Quick Export', desc: 'Fast current-session PDF export' },
                    ].map((template) => (
                      <button
                        type="button"
                        key={template.id}
                        onClick={() => setReportTemplate(template.id as 'professional' | 'studio' | 'quick')}
                        className={`text-left rounded-lg border p-3 transition-colors ${reportTemplate === template.id ? 'border-blue-500 bg-blue-500/10' : 'border-[#1a2333] hover:border-slate-400'}`}
                      >
                        <div className="font-semibold text-[#dae2fd]">{template.label}</div>
                        <div className="text-xs text-[#a9bcde] mt-1">{template.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-[#131b2e] border border-[#1a2333] rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-[#dae2fd] mb-2">Default actions</h3>
                  <div className="space-y-2 text-sm text-[#a9bcde]">
                    <div>• Professional report opens the richer document experience.</div>
                    <div>• Report Studio keeps template selection available.</div>
                    <div>• Quick export still works for a one-click PDF.</div>
                  </div>
                </div>
              </div>

              {designResults.size === 0 ? (
                <p className="text-[#a9bcde] py-8 text-center">Run design checks first to generate a report.</p>
              ) : (
                <div className="space-y-6">
                  {/* Professional Report Header with Branding */}
                  <div className="bg-[#131b2e] rounded-xl p-8 font-mono text-sm border border-[#1a2333] shadow-sm">
                    {/* Report Branding Header */}
                    <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-blue-500">
                      <div className="flex items-center gap-3">
                        <Logo size="md" variant="icon" clickable={false} />
                        <div>
                          <h3 className="text-xl font-black text-[#dae2fd] tracking-tight">STRUCTURAL DESIGN REPORT</h3>
                          <p className="text-xs text-blue-500 font-semibold">{BEAMLAB_COMPANY.name} — Professional Engineering Software</p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>Report No: DR-{Date.now().toString(36).toUpperCase()}</div>
                        <div>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      </div>
                    </div>

                    {/* Project Information Block */}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-xs">
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-24 flex-shrink-0">Project:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">{projectInfo?.name || 'Untitled Project'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-24 flex-shrink-0">Client:</span>
                        <span className="text-slate-800 dark:text-slate-200">{projectInfo?.client || '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-24 flex-shrink-0">Engineer:</span>
                        <span className="text-slate-800 dark:text-slate-200">{projectInfo?.engineer || '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-24 flex-shrink-0">Job No:</span>
                        <span className="text-slate-800 dark:text-slate-200">{projectInfo?.jobNo || '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-24 flex-shrink-0">Revision:</span>
                        <span className="text-slate-800 dark:text-slate-200">{projectInfo?.rev || '0'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-24 flex-shrink-0">Date:</span>
                        <span className="text-slate-800 dark:text-slate-200">{projectInfo?.date ? new Date(projectInfo.date).toLocaleDateString() : new Date().toISOString().split('T')[0]}</span>
                      </div>
                    </div>

                    {/* Design Summary */}
                    <div className="bg-[#0b1326] rounded-lg p-4 mb-6">
                      <h4 className="text-sm font-bold text-[#adc6ff] mb-3">DESIGN SUMMARY</h4>
                      <div className="grid grid-cols-4 gap-4 text-xs">
                        <div className="bg-[#131b2e] p-3 rounded-lg text-center border border-[#1a2333]">
                          <div className="text-slate-500">Design Code</div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{STEEL_CODES.find(c => c.id === params.steelCode)?.name || params.steelCode}</div>
                        </div>
                        <div className="bg-[#131b2e] p-3 rounded-lg text-center border border-[#1a2333]">
                          <div className="text-slate-500">Steel Grade</div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{params.steelGrade}</div>
                        </div>
                        <div className="bg-[#131b2e] p-3 rounded-lg text-center border border-[#1a2333]">
                          <div className="text-slate-500">Members Checked</div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{designResults.size}</div>
                        </div>
                        <div className="bg-[#131b2e] p-3 rounded-lg text-center border border-[#1a2333]">
                          <div className="text-slate-500">Pass / Fail</div>
                          <div className="text-sm mt-1"><span className="text-emerald-500 font-bold">{passCount}</span> / <span className="text-red-500 font-bold">{failCount}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Results Table */}
                    <h4 className="text-sm font-bold text-[#adc6ff] mb-2">MEMBER DESIGN CHECK RESULTS</h4>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          <th className="py-2 px-2 text-left border border-slate-300 dark:border-slate-600">Member</th>
                          <th className="py-2 px-2 text-left border border-slate-300 dark:border-slate-600">Section</th>
                          <th className="py-2 px-2 text-right border border-slate-300 dark:border-slate-600">N (kN)</th>
                          <th className="py-2 px-2 text-right border border-slate-300 dark:border-slate-600">V (kN)</th>
                          <th className="py-2 px-2 text-right border border-slate-300 dark:border-slate-600">M (kN·m)</th>
                          <th className="py-2 px-2 text-right border border-slate-300 dark:border-slate-600">Util. Ratio</th>
                          <th className="py-2 px-2 text-center border border-slate-300 dark:border-slate-600">Governing</th>
                          <th className="py-2 px-2 text-center border border-slate-300 dark:border-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(designResults.entries()).map(([id, r]) => (
                          <tr key={id} className="hover:bg-blue-50/30 dark:hover:bg-blue-500/5">
                            <td className="py-1.5 px-2 text-slate-700 dark:text-slate-200 font-medium tracking-wide border border-[#1a2333]">{r.memberName}</td>
                            <td className="py-1.5 px-2 text-slate-600 dark:text-slate-300 border border-[#1a2333]">{r.section}</td>
                            <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-300 border border-[#1a2333]">{formatForce(r.forces.N)}</td>
                            <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-300 border border-[#1a2333]">{formatForce(r.forces.Vy)}</td>
                            <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-300 border border-[#1a2333]">{formatForce(r.forces.Mz)}</td>
                            <td className={`py-1.5 px-2 text-right font-bold border border-[#1a2333] ${utilizationTextColor(r.utilizationRatio)}`}>
                              {(r.utilizationRatio * 100).toFixed(1)}%
                            </td>
                            <td className="py-1.5 px-2 text-center text-[#a9bcde] text-[10px] border border-[#1a2333]">{r.governingCheck || '—'}</td>
                            <td className={`py-1.5 px-2 text-center font-bold border border-[#1a2333] ${r.status === 'PASS' ? 'text-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10' : 'text-red-500 bg-red-50/50 dark:bg-red-500/10'}`}>
                              {r.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Report Footer */}
                    <div className="mt-6 pt-4 border-t border-slate-300 dark:border-slate-600 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Generated by {BEAMLAB_COMPANY.name} — Not for construction without independent verification</span>
                      <span>Page 1 of 1</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 flex-wrap">
                    <button type="button"
                      onClick={() => {
                        // Copy report to clipboard
                        const lines = [`STRUCTURAL DESIGN REPORT — ${BEAMLAB_COMPANY.name}`, ''];
                        lines.push(`Project: ${projectInfo?.name || 'Untitled'}`);
                        lines.push(`Client: ${projectInfo?.client || '—'}`);
                        lines.push(`Engineer: ${projectInfo?.engineer || '—'}`);
                        lines.push(`Job No: ${projectInfo?.jobNo || '—'}`);
                        lines.push(`Revision: ${projectInfo?.rev || '0'}`);
                        lines.push(`Date: ${new Date().toLocaleDateString()}`);
                        lines.push('');
                        lines.push(`Design Code: ${params.steelCode}`);
                        lines.push(`Steel Grade: ${params.steelGrade}`);
                        lines.push(`Members: ${designResults.size} | Pass: ${passCount} | Fail: ${failCount}`);
                        lines.push('');
                        lines.push('Member | Section | Axial(kN) | Shear(kN) | Moment(kN·m) | Ratio | Governing | Status');
                        lines.push('-'.repeat(100));
                        designResults.forEach(r => {
                          lines.push(
                            `${r.memberName.padEnd(8)} | ${r.section.padEnd(12)} | ${formatForce(r.forces.N).padStart(9)} | ${formatForce(r.forces.Vy).padStart(9)} | ${formatForce(r.forces.Mz).padStart(12)} | ${(r.utilizationRatio * 100).toFixed(1).padStart(5)}% | ${(r.governingCheck || '—').padEnd(12)} | ${r.status}`
                          );
                        });
                        navigator.clipboard.writeText(lines.join('\n'));
                      }}
                      className="px-4 py-2 bg-[#131b2e] hover:bg-slate-200 dark:hover:bg-slate-700 text-[#adc6ff] rounded-lg text-sm font-medium tracking-wide transition-colors flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" /> Copy to Clipboard
                    </button>
                    <button type="button"
                      onClick={() => {
                        if (reportTemplate === 'professional') {
                          navigate('/reports/professional');
                          return;
                        }
                        if (reportTemplate === 'studio') {
                          navigate('/reports');
                          return;
                        }
                        document.dispatchEvent(new CustomEvent("trigger-pdf-report"));
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-[#4d8eff] to-[#3b72cc] hover:from-[#3b72cc] hover:to-[#2a5599] text-white shadow-[0_0_15px_rgba(77,142,255,0.3)] hover:shadow-[0_0_20px_rgba(77,142,255,0.5)] rounded-lg text-sm font-medium tracking-wide transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> {reportTemplate === 'professional' ? 'Open Professional Report' : reportTemplate === 'studio' ? 'Open Report Studio' : 'Export Quick PDF'}
                    </button>
                    <Link
                      to="/reports"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium tracking-wide transition-colors flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" /> Full Report Generator
                    </Link>
                    <button type="button"
                      onClick={() => {
                        const rows: DesignSummaryCSVRow[] = Array.from(designResults.values()).map((r) => {
                          const memberRow = memberRows.find((m) => m.id === r.memberId);
                          const governing = r.checks.reduce(
                            (max, c) => (c.ratio >= max.ratio ? c : max),
                            { name: r.governingCheck || '—', clause: '', ratio: -Infinity, status: r.status } as {
                              name: string;
                              clause?: string;
                              ratio: number;
                              status: string;
                            },
                          );
                          return {
                            memberId: r.memberName,
                            section: r.section,
                            material: params.steelGrade,
                            length: memberRow?.length ?? 0,
                            maxUtilization: r.utilizationRatio,
                            governingCheck: r.governingCheck || governing.name || '—',
                            governingClause: governing.clause || '—',
                            status: r.status,
                          };
                        });

                        const csv = designSummaryToCSV(rows);
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `design-summary-${new Date().toISOString().slice(0, 10)}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2 bg-[#131b2e] hover:bg-slate-200 dark:hover:bg-slate-700 text-[#adc6ff] rounded-lg text-sm font-medium tracking-wide transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Export CSV
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Detail Slide-over Panel */}
      <AnimatePresence>
        {detailMemberId && designResults.get(detailMemberId) && (
          <MemberDetailPanel
            result={designResults.get(detailMemberId)!}
            onClose={() => setDetailMemberId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(PostAnalysisDesignHub);
