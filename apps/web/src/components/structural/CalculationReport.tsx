/**
 * ============================================================================
 * STRUCTURAL CALCULATION REPORT — Professional Print-Ready Sheet
 * ============================================================================
 *
 * Industry-standard calculation sheet modelled after Arup / WSP / AECOM
 * design office format with:
 *   • Document header strip with project info, revision & engineer block
 *   • Numbered section headings with ruled dividers
 *   • Input parameter tables with grouped categories
 *   • Step-by-step calculations with formula, substitution & result
 *   • Traffic-light code-compliance table (PASS/WARN/FAIL)
 *   • Executive result banner (ADEQUATE / INADEQUATE)
 *   • Signature & approval block
 *   • Print-optimised @media rules with running header/footer
 *
 * @version 2.0.0
 */


import React, { useRef } from 'react';
import {
  FileText,
  Download,
  Printer,
  Share2,
  Building2,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BookOpen,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalculationResult, CalculationInput, CalculationType, DesignCodeType } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface ReportData {
  projectInfo: {
    projectName: string;
    projectNumber: string;
    clientName: string;
    engineer: string;
    checker: string;
    date: string;
    revision: string;
  };
  calculationType: CalculationType;
  designCode: DesignCodeType;
  inputs: CalculationInput;
  result: CalculationResult;
}

export interface CalculationReportProps {
  data: ReportData;
  onExportPDF?: () => void;
  onPrint?: () => void;
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Engineering number formatter with locale thousands separator */
const eng = (v: number | string | undefined, decimals = 2): string => {
  if (v === undefined || v === null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return String(v);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Top header strip — repeated on every printed page via @page rules */
const ReportHeader: React.FC<{ projectInfo: ReportData['projectInfo'] }> = ({ projectInfo }) => (
  <div className="border-b-[3px] border-slate-900 pb-3 mb-6">
    {/* Row 1: Company / Project title */}
    <div className="flex justify-between items-start mb-3">
      <div>
        <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none mb-0.5">
          {projectInfo.projectName}
        </h1>
        <p className="text-[11px] text-slate-500 font-medium">
          Project No: <span className="font-mono font-bold text-slate-700">{projectInfo.projectNumber}</span>
        </p>
      </div>
      <div className="text-right flex items-center gap-3">
        <div>
          <div className="flex items-center gap-1.5 justify-end">
            <Building2 className="h-6 w-6 text-blue-700" />
            <span className="text-lg font-black text-blue-700 tracking-tight">BeamLab</span>
          </div>
          <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.15em] mt-0.5">
            Structural Engineering Software
          </p>
        </div>
      </div>
    </div>

    {/* Row 2: Meta grid */}
    <div className="border border-slate-300 rounded-sm overflow-hidden text-[10px]">
      <table className="w-full text-left">
        <tbody>
          <tr className="border-b border-slate-200">
            <td className="px-2.5 py-1.5 font-bold text-slate-500 bg-slate-50 w-[14%]">Client</td>
            <td className="px-2.5 py-1.5 text-slate-800 font-medium w-[36%]">{projectInfo.clientName}</td>
            <td className="px-2.5 py-1.5 font-bold text-slate-500 bg-slate-50 w-[14%]">Designed by</td>
            <td className="px-2.5 py-1.5 text-slate-800 font-medium w-[36%]">{projectInfo.engineer}</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5 font-bold text-slate-500 bg-slate-50">Date</td>
            <td className="px-2.5 py-1.5 text-slate-800 font-medium">{projectInfo.date}</td>
            <td className="px-2.5 py-1.5 font-bold text-slate-500 bg-slate-50">Checked by</td>
            <td className="px-2.5 py-1.5 text-slate-800 font-medium">{projectInfo.checker || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

/** Numbered section heading */
const SectionTitle: React.FC<{ number: number; children: React.ReactNode; icon?: React.ReactNode }> = ({
  number,
  children,
  icon,
}) => (
  <div className="flex items-baseline gap-2.5 border-b-2 border-slate-200 dark:border-slate-800 pb-1 mb-4 mt-10 first:mt-0 print:break-before-auto">
    <span className="text-[12px] font-black text-slate-500 dark:text-slate-400">{number}.0</span>
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-[14px] font-extrabold uppercase tracking-wide text-slate-900">{children}</h2>
    </div>
  </div>
);

/** Sub-section heading */
const SubTitle: React.FC<{ label: string }> = ({ label }) => (
  <h3 className="text-[12px] font-bold text-slate-700 border-b border-slate-200 pb-0.5 mb-2 mt-5">{label}</h3>
);

/** Grouped input-parameter table */
const InputTable: React.FC<{ inputs: CalculationInput; title: string }> = ({ inputs, title }) => {
  const entries = Object.entries(inputs);
  if (entries.length === 0) return null;
  return (
    <div className="mb-5">
      <SubTitle label={title} />
      <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px]">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300">
              <th className="px-3 py-1.5 font-bold text-slate-600 w-1/2">Parameter</th>
              <th className="px-3 py-1.5 font-bold text-slate-600">Value</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, value], idx) => (
              <tr key={key} className={idx % 2 === 0 ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-50/70'}>
                <td className="px-3 py-1.5 text-slate-700 font-medium">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </td>
                <td className="px-3 py-1.5 text-slate-900 font-mono font-medium">
                  {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** Traffic-light status icon */
const StatusIcon: React.FC<{ status: 'PASS' | 'FAIL' | 'WARNING' | 'OK' }> = ({ status }) => {
  switch (status) {
    case 'PASS':
    case 'OK':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    case 'WARNING':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
    case 'FAIL':
      return <XCircle className="h-3.5 w-3.5 text-red-600" />;
    default:
      return null;
  }
};

/** Status pill with colour-coded background */
const StatusPill: React.FC<{ status: 'PASS' | 'FAIL' | 'WARNING' | 'OK' }> = ({ status }) => {
  const style =
    status === 'PASS' || status === 'OK'
      ? 'bg-green-100 text-green-800 border-green-300'
      : status === 'WARNING'
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-red-100 text-red-800 border-red-300';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${style}`}>
      <StatusIcon status={status} />
      {status}
    </span>
  );
};

// ============================================================================
// CODE & CALCULATION TYPE LOOKUPS
// ============================================================================

const CODE_INFO: Record<string, { name: string; title: string }> = {
  IS_456: { name: 'IS 456:2000', title: 'Plain and Reinforced Concrete — Code of Practice' },
  IS_800: { name: 'IS 800:2007', title: 'General Construction in Steel — Code of Practice' },
  IS_1343: { name: 'IS 1343:2012', title: 'Prestressed Concrete — Code of Practice' },
  IS_1893: { name: 'IS 1893:2016', title: 'Criteria for Earthquake Resistant Design' },
  IS_1905: { name: 'IS 1905:1987', title: 'Structural Use of Unreinforced Masonry' },
  IS_883: { name: 'IS 883:1994', title: 'Design of Structural Timber in Building' },
  IS_2911: { name: 'IS 2911', title: 'Design and Construction of Pile Foundations' },
  ACI_318: { name: 'ACI 318-19', title: 'Building Code Requirements for Structural Concrete' },
  AISC_360: { name: 'AISC 360-22', title: 'Specification for Structural Steel Buildings' },
  ASCE_7: { name: 'ASCE 7-22', title: 'Minimum Design Loads for Buildings' },
  EC2: { name: 'EN 1992-1-1', title: 'Eurocode 2: Design of Concrete Structures' },
  EC3: { name: 'EN 1993-1-1', title: 'Eurocode 3: Design of Steel Structures' },
  EC8: { name: 'EN 1998-1', title: 'Eurocode 8: Design for Earthquake Resistance' },
};

const CALC_TYPE_LABELS: Record<string, string> = {
  beam_design: 'RC Beam Design',
  column_design: 'RC Column Design',
  slab_design: 'RC Slab Design',
  steel_beam: 'Steel Beam Design',
  steel_column: 'Steel Column Design',
  base_plate: 'Base Plate Design',
  bolted_connection: 'Bolted Connection Design',
  combined_footing: 'Combined Footing Design',
  connection: 'Connection Design',
  continuous_beam: 'Continuous Beam Analysis',
  deflection_analysis: 'Deflection Analysis',
  foundation: 'Foundation Design',
  influence_line: 'Influence Line Analysis',
  isolated_footing: 'Isolated Footing Design',
  load_combination: 'Load Combination',
  masonry_wall: 'Masonry Wall Design',
  pile: 'Pile Design',
  portal_frame: 'Portal Frame Analysis',
  prestressed_beam: 'Prestressed Concrete Beam',
  retaining_wall: 'Retaining Wall Design',
  seismic_analysis: 'Seismic Analysis',
  seismic_equivalent_static: 'Equivalent Static Seismic Analysis',
  seismic_response_spectrum: 'Response Spectrum Analysis',
  shear_wall: 'Shear Wall Design',
  timber_beam: 'Timber Beam Design',
  welded_connection: 'Welded Connection Design',
  wind_load: 'Wind Load Analysis',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const CalculationReport: React.FC<CalculationReportProps> = ({
  data,
  onExportPDF,
  onPrint,
  className,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const { projectInfo, calculationType, designCode, inputs, result } = data;

  const codeInfo = CODE_INFO[designCode] || { name: designCode, title: '' };
  const calcLabel = CALC_TYPE_LABELS[calculationType] || calculationType;

  const utilizationPct = (result.utilization * 100).toFixed(1);
  const utilizationColor =
    result.utilization <= 0.7
      ? '#16a34a'
      : result.utilization <= 1.0
        ? '#d97706'
        : '#dc2626';

  return (
    <div className={cn('bg-slate-100 dark:bg-slate-800', className)}>
      {/* ─── Sticky toolbar (hidden in print) ─── */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2.5">
          <FileText className="h-5 w-5 text-slate-500" />
          <span className="font-bold text-slate-700 text-sm">Calculation Sheet</span>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">Rev {projectInfo.revision}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onExportPDF}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
          <button
            onClick={onPrint || (() => window.print())}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-zinc-900 dark:text-white text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors">
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </div>

      {/* ─── Print @page rules ─── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 18mm 15mm 22mm 15mm;
            @top-left   { content: "${projectInfo.projectName} — ${projectInfo.projectNumber}"; font-size: 7.5pt; color: #94a3b8; }
            @top-right  { content: "Rev ${projectInfo.revision}  |  ${projectInfo.date}"; font-size: 7.5pt; color: #94a3b8; }
            @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 7.5pt; color: #94a3b8; }
            @bottom-right { content: "BeamLab™"; font-size: 7pt; color: #cbd5e1; }
          }
        }
      `}</style>

      {/* ─── Report body ─── */}
      <div
        ref={reportRef}
        className="max-w-[210mm] mx-auto px-10 py-8 print:px-0 print:py-0 print:max-w-none"
        style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
      >
        <ReportHeader projectInfo={projectInfo} />

        {/* ── Title block ── */}
        <div className="text-center mb-8">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1">Design Calculation Sheet</p>
          <h1 className="text-2xl font-black text-slate-900 mb-1.5">{calcLabel}</h1>
          <p className="text-[11px] text-slate-500 font-medium">
            As per <span className="font-bold text-slate-700">{codeInfo.name}</span>
            {codeInfo.title && <span className="text-slate-500 dark:text-slate-400"> — {codeInfo.title}</span>}
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 1 — EXECUTIVE RESULT SUMMARY
            ═══════════════════════════════════════════════════ */}
        <SectionTitle number={1} icon={<ClipboardCheck className="h-4 w-4 text-blue-700" />}>
          Executive Result Summary
        </SectionTitle>

        <div
          className={cn(
            'rounded-sm border-2 p-5 mb-6 print:border-[3px]',
            result.isAdequate
              ? 'border-green-500 bg-green-50/60'
              : 'border-red-500 bg-red-50/60',
          )}
        >
          <div className="flex items-center gap-3 mb-2">
            <StatusIcon status={result.status} />
            <h3 className="text-lg font-black uppercase tracking-wide">
              Design {result.isAdequate ? 'ADEQUATE' : 'INADEQUATE'}
            </h3>
          </div>
          <p className="text-[12px] text-slate-700 leading-relaxed mb-4">{result.message}</p>

          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-300/60">
            <div className="text-center">
              <p className="text-2xl font-black text-slate-900">{eng(result.capacity, 1)}</p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                Capacity ({calculationType.includes('axial') || calculationType.includes('column') ? 'kN' : calculationType.includes('shear') ? 'kN' : 'kN·m'})
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-slate-900">{eng(result.demand, 1)}</p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                Demand ({calculationType.includes('axial') || calculationType.includes('column') ? 'kN' : calculationType.includes('shear') ? 'kN' : 'kN·m'})
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black" style={{ color: utilizationColor }}>
                {utilizationPct}%
              </p>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">Utilization</p>
            </div>
          </div>

          {/* Utilization bar */}
          <div className="mt-4 h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(result.utilization * 100, 100)}%`,
                backgroundColor: utilizationColor,
              }}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 2 — INPUT PARAMETERS
            ═══════════════════════════════════════════════════ */}
        <SectionTitle number={2} icon={<Calculator className="h-4 w-4 text-blue-700" />}>
          Input Parameters
        </SectionTitle>

        <div className="grid grid-cols-2 gap-x-6 gap-y-0">
          <InputTable
            inputs={Object.fromEntries(
              Object.entries(inputs).filter(([k]) =>
                ['width', 'depth', 'effective_depth', 'span', 'clear_cover', 'length', 'height', 'diameter'].includes(k),
              ),
            )}
            title="Geometry"
          />
          <InputTable
            inputs={Object.fromEntries(
              Object.entries(inputs).filter(([k]) =>
                ['fck', 'fy', 'steel_grade', 'concrete_grade', 'Es', 'Ec'].includes(k),
              ),
            )}
            title="Materials"
          />
          <InputTable
            inputs={Object.fromEntries(
              Object.entries(inputs).filter(([k]) =>
                ['Mu', 'Vu', 'Pu', 'Mux', 'Muy', 'Tu', 'w', 'P', 'load'].some((p) => k.includes(p)),
              ),
            )}
            title="Applied Loads"
          />
          <InputTable
            inputs={Object.fromEntries(
              Object.entries(inputs).filter(([k]) =>
                ['design_type', 'exposure', 'end_condition', 'bracing', 'sway', 'fire_rating'].includes(k),
              ),
            )}
            title="Design Options"
          />
        </div>

        {/* Catch-all for any inputs not captured by the above categories */}
        {(() => {
          const categorizedKeys = new Set([
            'width', 'depth', 'effective_depth', 'span', 'clear_cover', 'length', 'height', 'diameter',
            'fck', 'fy', 'steel_grade', 'concrete_grade', 'Es', 'Ec',
            'design_type', 'exposure', 'end_condition', 'bracing', 'sway', 'fire_rating',
          ]);
          const loadPatterns = ['Mu', 'Vu', 'Pu', 'Mux', 'Muy', 'Tu', 'w', 'P', 'load'];
          const uncategorized = Object.fromEntries(
            Object.entries(inputs).filter(([k]) =>
              !categorizedKeys.has(k) && !loadPatterns.some((p) => k.includes(p))
            )
          );
          return Object.keys(uncategorized).length > 0 ? (
            <InputTable inputs={uncategorized} title="Other Parameters" />
          ) : null;
        })()}

        {/* ═══════════════════════════════════════════════════
            SECTION 3 — DETAILED CALCULATIONS
            ═══════════════════════════════════════════════════ */}
        <SectionTitle number={3} icon={<BookOpen className="h-4 w-4 text-blue-700" />}>
          Detailed Calculations
        </SectionTitle>

        {result.steps.map((step, idx) => (
          <div key={idx} className="mb-6 pl-4 border-l-[3px] border-blue-200 print:break-inside-avoid">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[10px] font-black text-blue-400 shrink-0">Step {idx + 1}</span>
              <h4 className="text-[12px] font-bold text-slate-800">{step.title}</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-2">{step.description}</p>

            {step.formula && (
              <div className="bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 mb-2 font-mono text-[11px] text-slate-700 overflow-x-auto">
                {step.formula}
              </div>
            )}

            {Object.keys(step.values).length > 0 && (
              <div className="border border-slate-200 rounded-sm overflow-hidden text-[10px] mb-2">
                <table className="w-full text-left">
                  <tbody>
                    {Object.entries(step.values).map(([key, val], vi) => (
                      <tr key={key} className={vi % 2 === 0 ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-50/70'}>
                        <td className="px-2.5 py-1 text-slate-500 font-medium w-1/2">{key}</td>
                        <td className="px-2.5 py-1 text-slate-800 font-mono font-bold">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {step.reference && (
              <p className="text-[10px] text-blue-600 italic flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Ref: {step.reference}
              </p>
            )}
          </div>
        ))}

        {/* ═══════════════════════════════════════════════════
            SECTION 4 — CODE COMPLIANCE CHECKS
            ═══════════════════════════════════════════════════ */}
        <SectionTitle number={4} icon={<CheckCircle2 className="h-4 w-4 text-blue-700" />}>
          Code Compliance Summary
        </SectionTitle>

        <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-8">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-zinc-900 dark:text-white">
                <th className="px-3 py-2 font-bold">Clause</th>
                <th className="px-3 py-2 font-bold">Check Description</th>
                <th className="px-3 py-2 font-bold text-center">Required</th>
                <th className="px-3 py-2 font-bold text-center">Provided</th>
                <th className="px-3 py-2 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.codeChecks.map((check, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-50/70'}>
                  <td className="px-3 py-2 font-mono text-[10px] font-bold text-slate-700">{check.clause}</td>
                  <td className="px-3 py-2 text-slate-700">{check.description}</td>
                  <td className="px-3 py-2 text-center font-mono text-slate-500">{check.required}</td>
                  <td className="px-3 py-2 text-center font-mono font-bold text-slate-800">{check.provided}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusPill status={check.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ═══════════════════════════════════════════════════
            SECTION 5 — WARNINGS & RECOMMENDATIONS
            ═══════════════════════════════════════════════════ */}
        {result.warnings.length > 0 && (
          <>
            <SectionTitle number={5} icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}>
              Warnings & Recommendations
            </SectionTitle>
            <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 mb-8">
              <ul className="space-y-1.5 text-[11px] text-slate-700 leading-relaxed">
                {result.warnings.map((warning, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            APPENDIX — SIGNATURES & APPROVAL
            ═══════════════════════════════════════════════════ */}
        <div className="mt-16 pt-6 border-t-[3px] border-slate-900 print:break-before-page">
          <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-slate-900 mb-6">
            Signatures & Approval
          </h2>
          <div className="grid grid-cols-3 gap-8">
            {[
              { role: 'Prepared by', name: projectInfo.engineer, title: 'Structural Engineer' },
              { role: 'Checked by', name: projectInfo.checker || '________________', title: 'Senior Engineer' },
              { role: 'Approved by', name: '________________', title: 'Project Manager' },
            ].map((sig) => (
              <div key={sig.role}>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{sig.role}</p>
                <div className="h-14 border-b-2 border-slate-400 mb-1.5" />
                <p className="text-[12px] font-bold text-slate-900">{sig.name}</p>
                <p className="text-[10px] text-slate-500">{sig.title}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Date: _______________</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center space-y-0.5">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              This is a computer-generated document. All calculations should be independently verified.
            </p>
            <p className="text-[9px] text-slate-600 dark:text-slate-300">
              Generated by BeamLab Structural Engineering Software v2.0 &mdash; © {new Date().getFullYear()} BeamLab Engineering Pvt. Ltd.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculationReport;
