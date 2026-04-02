import React from 'react';
import { Download, Printer, Share2, TableProperties, Layout, FileCode } from 'lucide-react';
import { TierGate } from '../../components/TierGate';
import type { DesignCodeId, MemberModelType, CalculationPart } from '../../services/reports';
import type { Member } from '../../store/model';

export const docRef = (n: number, m: number) =>
  `BL-${String(n * 1000 + m * 10 + 1).padStart(6, '0')}`;

export const eng = (v: number | undefined, decimals = 2): string => {
  if (v === undefined || v === null) return '—';
  return v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const fmtDate = (date: Date) =>
  date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export const fmtTime = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const resolveDesignCode = (code?: string | null): DesignCodeId => (code as DesignCodeId) || 'IS800';

export const MODEL_TYPE_OPTIONS: Array<{ value: MemberModelType; label: string }> = [
  { value: 'beam', label: 'Beam' },
  { value: 'column', label: 'Column' },
  { value: 'brace', label: 'Brace' },
  { value: 'generic', label: 'Generic' },
];

export const CALC_PART_OPTIONS: Array<{ value: CalculationPart; label: string }> = [
  { value: 'axial', label: 'Axial' },
  { value: 'bending_major', label: 'Bending Major' },
  { value: 'bending_minor', label: 'Bending Minor' },
  { value: 'shear_major', label: 'Shear Major' },
  { value: 'shear_minor', label: 'Shear Minor' },
  { value: 'torsion', label: 'Torsion' },
  { value: 'combined_interaction', label: 'Interaction' },
  { value: 'serviceability', label: 'Serviceability' },
];

export const deriveMemberModelType = (
  member: Member,
  nodeMap: Map<string, { x: number; y: number; z: number }>,
): MemberModelType => {
  const start = nodeMap.get(member.startNodeId);
  const end = nodeMap.get(member.endNodeId);
  if (!start || !end) return 'generic';

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (L <= 1e-9) return 'generic';

  const verticalRatio = Math.abs(dy) / L;
  if (verticalRatio >= 0.8) return 'column';
  if (verticalRatio <= 0.1) return 'beam';
  return 'brace';
};

export const SectionHeading = ({
  number,
  title,
  className = '',
}: {
  number: string;
  title: string;
  className?: string;
}) => (
  <div className={`flex items-baseline gap-3 border-b-2 border-[#1a2333] pb-1.5 mb-5 mt-10 print:break-before-auto ${className}`}>
    <span className="text-sm font-black text-slate-500 tracking-wider">{number}</span>
    <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-slate-900">{title}</h2>
  </div>
);

export const SubHeading = ({ number, title }: { number: string; title: string }) => (
  <div className="flex items-baseline gap-2 border-b border-slate-300 pb-1 mb-3 mt-6">
    <span className="text-xs font-bold text-[#869ab8]">{number}</span>
    <h3 className="text-[13px] font-bold text-slate-700">{title}</h3>
  </div>
);

export const KpiCard = ({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: string | number;
  unit?: string;
  status?: 'pass' | 'warn' | 'fail' | 'info';
}) => {
  const ring =
    status === 'pass'
      ? 'border-l-green-500'
      : status === 'warn'
        ? 'border-l-amber-500'
        : status === 'fail'
          ? 'border-l-red-500'
          : 'border-l-blue-500';
  return (
    <div className={`border border-slate-200 border-l-4 ${ring} rounded-sm px-4 py-3 print:bg-white`}>
      <p className="text-[10px] font-bold text-[#869ab8] uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-lg font-black text-slate-900 leading-tight">
        {value}
        {unit && <span className="text-xs font-medium tracking-wide text-[#869ab8] ml-1">{unit}</span>}
      </p>
    </div>
  );
};

export const StatusPill = ({ status }: { status: 'PASS' | 'FAIL' | 'WARN' | 'N/A' }) => {
  const map = {
    PASS: 'bg-green-100 text-green-800 border-green-300',
    FAIL: 'bg-red-100 text-red-800 border-red-300',
    WARN: 'bg-amber-100 text-amber-800 border-amber-300',
    'N/A': 'bg-slate-100 text-slate-500 border-slate-300',
  };
  return <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${map[status]}`}>{status}</span>;
};

export const SignatureBlock = ({ role, name, title }: { role: string; name: string; title: string }) => (
  <div>
    <p className="text-[10px] font-bold text-[#869ab8] uppercase tracking-wider mb-2">{role}</p>
    <div className="h-16 border-b-2 border-slate-400 mb-2" />
    <p className="text-[12px] font-bold text-slate-900">{name}</p>
    <p className="text-[10px] text-slate-500">{title}</p>
    <p className="text-[10px] text-[#869ab8] mt-1">Date: _______________</p>
  </div>
);

export const FloatingActionButton = ({
  onClick,
  title,
  icon: Icon,
  label,
  className,
}: {
  onClick?: () => void;
  title?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className: string;
}) => (
  <button type="button" onClick={onClick} className={className} title={title}>
    <Icon className="w-5 h-5" />
    <span className="hidden md:inline">{label}</span>
  </button>
);

export const FloatingActionBar = ({
  onExportPDF,
  onPrint,
  onShare,
  onExportDXF,
  onExportIFC,
  onExportExcel,
}: {
  onExportPDF: () => void;
  onPrint: () => void;
  onShare: () => void;
  onExportDXF: () => void;
  onExportIFC: () => void;
  onExportExcel: () => void;
}) => (
  <>
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 print:hidden">
      <div className="flex items-center gap-2 p-2 rounded-xl bg-[#131b2e] shadow-xl border border-[#1a2333]">
        <TierGate feature="pdfExport">
          <button type="button" onClick={onExportPDF} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#4d8eff] to-[#3b72cc] hover:from-[#3b72cc] hover:to-[#2a5599] text-white shadow-[0_0_15px_rgba(77,142,255,0.3)] hover:shadow-[0_0_20px_rgba(77,142,255,0.5)] font-bold text-sm transition-all shadow-lg shadow-blue-500/20">
            <Download className="w-5 h-5" />
            Download PDF
          </button>
        </TierGate>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        <button type="button" onClick={onPrint} className="flex items-center gap-2 px-6 py-3 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium tracking-wide text-sm transition-colors">
          <Printer className="w-5 h-5" />
          Print
        </button>
        <button type="button" onClick={onShare} className="flex items-center gap-2 px-6 py-3 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium tracking-wide text-sm transition-colors">
          <Share2 className="w-5 h-5" />
          Share
        </button>
      </div>
    </div>

    <div className="fixed bottom-6 right-6 z-40 print:hidden flex flex-col gap-3">
      <FloatingActionButton onClick={onExportDXF} title="Export DXF (AutoCAD)" icon={Layout} label="DXF" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#131b2e] border border-[#1a2333] shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all text-slate-500 dark:text-slate-300 font-medium tracking-wide text-sm" />
      <FloatingActionButton onClick={onExportIFC} title="Export IFC (BIM)" icon={FileCode} label="IFC" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#131b2e] border border-[#1a2333] shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all text-slate-500 dark:text-slate-300 font-medium tracking-wide text-sm" />
      <FloatingActionButton onClick={onExportExcel} title="Export Results to Excel (CSV)" icon={TableProperties} label="Excel" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#131b2e] border border-[#1a2333] shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all text-slate-500 dark:text-slate-300 font-medium tracking-wide text-sm" />
    </div>
  </>
);
