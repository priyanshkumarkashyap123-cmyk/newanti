/**
 * OptimizationResultPanel — FSD optimization results with member table,
 * utilization bars, and per-member SFD/BMD diagram viewer.
 *
 * Consumes FSDResult from the Rust API. Renders:
 *  1. Summary card (weight savings, iterations, convergence)
 *  2. Member table with UR bars, governing check, pass/fail
 *  3. Expandable SFD/BMD per member using ForceDiagramRenderer
 *  4. Detailed UtilizationBreakdown for selected member
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, CheckCircle, XCircle,
  TrendingDown, BarChart3, Layers, ArrowUpDown,
} from 'lucide-react';
import ForceDiagramRenderer, {
  type MemberDiagramData,
} from '../../diagrams/ForceDiagramRenderer';
import { UtilizationBreakdown, type UtilizationData } from './UtilizationBreakdown';

// ═══════════════════════════════════════════════════════════════
// FSD RESULT TYPES  (mirrors Rust FSDResult / MemberEnvelopeSummary)
// ═══════════════════════════════════════════════════════════════

export interface FSDResultData {
  converged: boolean;
  iterations_used: number;
  final_sections: Record<string, string>;
  initial_weight_kg: number;
  final_weight_kg: number;
  weight_savings_pct: number;
  design_checks: DesignCheckData[];
  max_ur: number;
  unique_sections: number;
  message: string;
  history?: IterationHistoryData[];
  member_envelopes?: MemberEnvelopeData[];
}

export interface DesignCheckData {
  member_id: string;
  section_name: string;
  utilization_ratio: number;
  passed: boolean;
  governing_check: string;
  demand_kn: number;
  capacity_kn: number;
  interaction_ur: number;
  ltb_ur: number;
  deflection_ur: number;
  web_crippling_ur: number;
  connection_adequate: boolean;
}

export interface MemberEnvelopeData {
  member_id: string;
  section_name: string;
  governing_ur: number;
  governing_check: string;
  governing_combo: string;
  max_axial_kn: number;
  max_shear_kn: number;
  max_moment_knm: number;
  flexure_ur: number;
  shear_ur: number;
  compression_ur: number;
  interaction_ur: number;
  ltb_ur: number;
  deflection_ur: number;
  web_crippling_ur: number;
  connection_adequate: boolean;
  passed: boolean;
}

export interface IterationHistoryData {
  iteration: number;
  total_weight_kg: number;
  max_ur: number;
  avg_ur: number;
  num_failing_members: number;
  num_section_changes: number;
  convergence_metric: number;
}

/** Optional per-member diagram data (from post-processor). */
export interface MemberDiagramDataMap {
  [memberId: string]: MemberDiagramData;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

interface Props {
  result: FSDResultData;
  /** Pre-computed member diagrams keyed by member id */
  memberDiagrams?: MemberDiagramDataMap;
  onClose?: () => void;
}

type SortKey = 'member_id' | 'section' | 'ur' | 'check';
type SortDir = 'asc' | 'desc';

const urColor = (ur: number) => {
  if (ur > 1.0) return 'text-red-400';
  if (ur > 0.9) return 'text-orange-400';
  if (ur > 0.7) return 'text-yellow-400';
  return 'text-green-400';
};

const urBg = (ur: number) => {
  if (ur > 1.0) return 'bg-red-500';
  if (ur > 0.9) return 'bg-orange-500';
  if (ur > 0.7) return 'bg-yellow-500';
  return 'bg-green-500';
};

export const OptimizationResultPanel: React.FC<Props> = ({
  result, memberDiagrams, onClose,
}) => {
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [showDiagram, setShowDiagram] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('ur');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Prefer envelope data if available, fall back to design_checks
  const members = useMemo(() => {
    if (result.member_envelopes && result.member_envelopes.length > 0) {
      return result.member_envelopes.map((e) => ({
        id: e.member_id,
        section: e.section_name,
        ur: e.governing_ur,
        check: e.governing_check,
        combo: e.governing_combo,
        passed: e.passed,
        envelope: e,
      }));
    }
    return result.design_checks.map((c) => ({
      id: c.member_id,
      section: c.section_name,
      ur: c.utilization_ratio,
      check: c.governing_check,
      combo: '',
      passed: c.passed,
      envelope: null as MemberEnvelopeData | null,
    }));
  }, [result]);

  const sorted = useMemo(() => {
    const arr = [...members];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'member_id': cmp = a.id.localeCompare(b.id, undefined, { numeric: true }); break;
        case 'section': cmp = a.section.localeCompare(b.section); break;
        case 'ur': cmp = a.ur - b.ur; break;
        case 'check': cmp = a.check.localeCompare(b.check); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [members, sortKey, sortDir]);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'ur' ? 'desc' : 'asc');
    }
  }, [sortKey]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedMember((prev) => (prev === id ? null : id));
    setShowDiagram(false);
  }, []);

  const selectedEnvelope = expandedMember
    ? members.find((m) => m.id === expandedMember)?.envelope ?? null
    : null;

  const utilizationData: UtilizationData | null = useMemo(() => {
    if (!selectedEnvelope) {
      // Fall back to design check if no envelope
      if (!expandedMember) return null;
      const dc = result.design_checks.find((c) => c.member_id === expandedMember);
      if (!dc) return null;
      return {
        flexure_ur: dc.utilization_ratio,
        shear_ur: 0,
        compression_ur: 0,
        interaction_ur: dc.interaction_ur,
        ltb_ur: dc.ltb_ur,
        deflection_ur: dc.deflection_ur,
        web_crippling_ur: dc.web_crippling_ur,
        connection_adequate: dc.connection_adequate,
        governing_check: dc.governing_check,
        governing_ur: dc.utilization_ratio,
        passed: dc.passed,
      };
    }
    return {
      flexure_ur: selectedEnvelope.flexure_ur,
      shear_ur: selectedEnvelope.shear_ur,
      compression_ur: selectedEnvelope.compression_ur,
      interaction_ur: selectedEnvelope.interaction_ur,
      ltb_ur: selectedEnvelope.ltb_ur,
      deflection_ur: selectedEnvelope.deflection_ur,
      web_crippling_ur: selectedEnvelope.web_crippling_ur,
      connection_adequate: selectedEnvelope.connection_adequate,
      governing_check: selectedEnvelope.governing_check,
      governing_ur: selectedEnvelope.governing_ur,
      passed: selectedEnvelope.passed,
    };
  }, [selectedEnvelope, expandedMember, result.design_checks]);

  const passingCount = members.filter((m) => m.passed).length;
  const failingCount = members.length - passingCount;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* ── Summary Cards ── */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            FSD Optimization Results
          </h3>
          {onClose && (
            <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300">
              Close
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 text-xs">
          {/* Weight savings */}
          <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-800">
            <div className="text-slate-500 mb-0.5">Weight Saved</div>
            <div className="text-lg font-bold text-emerald-400 flex items-center gap-1">
              <TrendingDown className="w-4 h-4" />
              {result.weight_savings_pct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-600">
              {result.initial_weight_kg.toFixed(0)} → {result.final_weight_kg.toFixed(0)} kg
            </div>
          </div>

          {/* Iterations */}
          <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-800">
            <div className="text-slate-500 mb-0.5">Iterations</div>
            <div className="text-lg font-bold text-blue-400">{result.iterations_used}</div>
            <div className="text-[10px] text-slate-600">
              {result.converged ? 'Converged' : 'Max reached'}
            </div>
          </div>

          {/* Max UR */}
          <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-800">
            <div className="text-slate-500 mb-0.5">Max UR</div>
            <div className={`text-lg font-bold ${urColor(result.max_ur)}`}>
              {(result.max_ur * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-600">{result.unique_sections} unique sections</div>
          </div>

          {/* Pass/Fail */}
          <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-800">
            <div className="text-slate-500 mb-0.5">Members</div>
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-bold">{passingCount}</span>
              <span className="text-slate-600">/</span>
              <span className={`font-bold ${failingCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {failingCount}
              </span>
            </div>
            <div className="text-[10px] text-slate-600">pass / fail</div>
          </div>
        </div>
      </div>

      {/* ── Member Table ── */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 grid grid-cols-[2fr_2fr_1fr_3fr_1fr] px-4 py-2 text-[11px] uppercase tracking-wider text-slate-500">
          <button className="text-left flex items-center gap-1 hover:text-slate-300" onClick={() => toggleSort('member_id')}>
            Member <ArrowUpDown className="w-3 h-3" />
          </button>
          <button className="text-left flex items-center gap-1 hover:text-slate-300" onClick={() => toggleSort('section')}>
            Section <ArrowUpDown className="w-3 h-3" />
          </button>
          <button className="text-left flex items-center gap-1 hover:text-slate-300" onClick={() => toggleSort('ur')}>
            UR <ArrowUpDown className="w-3 h-3" />
          </button>
          <button className="text-left flex items-center gap-1 hover:text-slate-300" onClick={() => toggleSort('check')}>
            Governing <ArrowUpDown className="w-3 h-3" />
          </button>
          <div className="text-center">Status</div>
        </div>

        {/* Rows */}
        {sorted.map((m) => {
          const isExpanded = expandedMember === m.id;
          return (
            <div key={m.id}>
              <button
                className={`w-full grid grid-cols-[2fr_2fr_1fr_3fr_1fr] px-4 py-2.5 text-sm border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors ${
                  isExpanded ? 'bg-slate-800/60' : ''
                }`}
                onClick={() => toggleExpand(m.id)}
              >
                <span className="text-left flex items-center gap-1.5 text-slate-300">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {m.id}
                </span>
                <span className="text-left text-slate-400 font-mono text-xs">{m.section}</span>
                <span className={`text-left font-mono font-bold ${urColor(m.ur)}`}>
                  {(m.ur * 100).toFixed(1)}%
                </span>
                <span className="text-left text-slate-500 text-xs">{m.check}</span>
                <span className="flex justify-center">
                  {m.passed
                    ? <CheckCircle className="w-4 h-4 text-green-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />}
                </span>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800 space-y-3">
                  {/* UR breakdown */}
                  {utilizationData && (
                    <UtilizationBreakdown
                      data={utilizationData}
                      memberLabel={`${m.id} — ${m.section}`}
                    />
                  )}

                  {/* Envelope forces summary */}
                  {m.envelope && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-slate-800 rounded p-2">
                        <div className="text-slate-500">Max Axial</div>
                        <div className="font-mono text-slate-300">{m.envelope.max_axial_kn.toFixed(1)} kN</div>
                      </div>
                      <div className="bg-slate-800 rounded p-2">
                        <div className="text-slate-500">Max Shear</div>
                        <div className="font-mono text-slate-300">{m.envelope.max_shear_kn.toFixed(1)} kN</div>
                      </div>
                      <div className="bg-slate-800 rounded p-2">
                        <div className="text-slate-500">Max Moment</div>
                        <div className="font-mono text-slate-300">{m.envelope.max_moment_knm.toFixed(2)} kN·m</div>
                      </div>
                    </div>
                  )}

                  {/* SFD/BMD diagram toggle */}
                  {memberDiagrams && memberDiagrams[m.id] && (
                    <div>
                      <button
                        onClick={() => setShowDiagram((v) => !v)}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        {showDiagram ? 'Hide' : 'Show'} SFD / BMD Diagrams
                      </button>
                      {showDiagram && (
                        <div className="mt-2 bg-white rounded-lg overflow-hidden">
                          <ForceDiagramRenderer
                            memberData={memberDiagrams[m.id]}
                            config={{
                              showShear: true,
                              showMoment: true,
                              showAxial: false,
                              showTorsion: false,
                              showValues: true,
                              showGrid: true,
                              colorScheme: 'engineering',
                            }}
                            width={640}
                            height={400}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {m.combo && (
                    <div className="text-[10px] text-slate-600">
                      Governing combination: <span className="text-slate-400">{m.combo}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Convergence History (collapsible) ── */}
      {result.history && result.history.length > 0 && (
        <ConvergenceHistory history={result.history} />
      )}
    </div>
  );
};

// ── Convergence mini-chart ──

const ConvergenceHistory: React.FC<{ history: IterationHistoryData[] }> = ({ history }) => {
  const [open, setOpen] = useState(false);
  const maxW = Math.max(...history.map((h) => h.total_weight_kg));
  const minW = Math.min(...history.map((h) => h.total_weight_kg));
  const range = maxW - minW || 1;

  return (
    <div className="border-t border-slate-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Convergence History ({history.length} iterations)
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1">
          {history.map((h) => {
            const pct = ((h.total_weight_kg - minW) / range) * 100;
            return (
              <div key={h.iteration} className="flex items-center gap-2 text-[11px]">
                <span className="w-5 text-slate-600 text-right">{h.iteration}</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 text-right font-mono text-slate-500">
                  {h.total_weight_kg.toFixed(0)} kg
                </span>
                <span className={`w-12 text-right font-mono ${urColor(h.max_ur)}`}>
                  {(h.max_ur * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OptimizationResultPanel;
