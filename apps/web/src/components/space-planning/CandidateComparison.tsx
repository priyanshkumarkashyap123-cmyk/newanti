/**
 * ============================================================================
 * CANDIDATE COMPARISON PANEL
 * ============================================================================
 *
 * Side-by-side comparison of multiple solver candidates so the architect
 * can evaluate trade-offs and select the best layout option.
 *
 * Features:
 *   - Mini floor plan preview per candidate
 *   - Score comparison bar chart
 *   - Constraint pass/fail delta matrix
 *   - Per-domain penalty breakdown
 *   - "Select" action to apply chosen candidate
 *   - "Best Pick" recommendation badge
 *
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Crown,
  ArrowRight,
  BarChart3,
  Maximize2,
  Minimize2,
  Sparkles,
  Target,
} from 'lucide-react';
import type {
  SolverCandidate,
  MultiCandidateResult,
  ConstraintDomain,
} from '../../services/space-planning/layoutApiService';

// ============================================================================
// TYPES
// ============================================================================

interface CandidateComparisonProps {
  result: MultiCandidateResult;
  onSelectCandidate: (candidateId: string) => void;
  selectedCandidateId?: string;
  className?: string;
}

// ============================================================================
// DOMAIN LABELS (short form for compact display)
// ============================================================================

const SHORT_DOMAIN_LABELS: Record<string, string> = {
  fsi: 'FSI',
  overlap: 'Overlap',
  min_width: 'Width',
  aspect_ratio: 'Ratio',
  exterior_wall: 'Ext Wall',
  plumbing_cluster: 'Plumbing',
  acoustic_zones: 'Acoustic',
  clearance: 'Clearance',
  grid_snap: 'Grid',
  circulation: 'Circulation',
  span_limits: 'Span',
  staircase: 'Stair',
  fenestration: 'Windows',
  egress: 'Egress',
  solar: 'Solar',
};

// ============================================================================
// MINI FLOOR PLAN PREVIEW
// ============================================================================

const MiniFloorPlan: React.FC<{
  candidate: SolverCandidate;
  isSelected: boolean;
  isBest: boolean;
}> = ({ candidate, isSelected, isBest }) => {
  const boundary = candidate.usableBoundary;
  const maxDim = Math.max(boundary.width, boundary.height);
  const viewSize = 120;
  const scale = (viewSize - 16) / maxDim;

  return (
    <div className="relative">
      <svg
        width={viewSize}
        height={viewSize}
        className={`rounded-lg border-2 transition-all ${
          isSelected
            ? 'border-blue-500 shadow-lg shadow-blue-100 dark:shadow-blue-900/30'
            : 'border-slate-200 dark:border-slate-700'
        }`}
        style={{ background: '#fafafa' }}
      >
        {/* Usable boundary */}
        <rect
          x={8}
          y={8}
          width={boundary.width * scale}
          height={boundary.height * scale}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={1}
          strokeDasharray="3 2"
        />

        {/* Room rectangles */}
        {candidate.placements.map((p) => {
          const x = 8 + (p.position.x - boundary.x) * scale;
          const y = 8 + (p.position.y - boundary.y) * scale;
          const w = p.dimensions.width * scale;
          const h = p.dimensions.height * scale;

          const isViolated =
            !p.width_valid ||
            !p.aspect_ratio_valid ||
            Math.abs(p.area_deviation_pct) > 15;

          return (
            <g key={p.room_id}>
              <rect
                x={x}
                y={y}
                width={Math.max(w, 2)}
                height={Math.max(h, 2)}
                fill={isViolated ? '#fee2e2' : '#e0f2fe'}
                stroke={isViolated ? '#ef4444' : '#94a3b8'}
                strokeWidth={0.5}
                rx={1}
              />
              {w > 15 && h > 8 && (
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="4"
                  fill="#64748b"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {p.name?.slice(0, 6)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Best pick badge */}
      {isBest && (
        <div className="absolute -top-2 -right-2 bg-amber-400 rounded-full p-1 shadow-sm">
          <Crown className="w-3 h-3 text-amber-900" />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SCORE COMPARISON BAR
// ============================================================================

const ScoreBar: React.FC<{
  candidate: SolverCandidate;
  maxScore: number;
  isSelected: boolean;
  isBest: boolean;
}> = ({ candidate, maxScore, isSelected, isBest }) => {
  const score = candidate.report.score;
  const widthPct = maxScore > 0 ? (score / 100) * 100 : 0;
  const color =
    score >= 85
      ? 'bg-green-500'
      : score >= 70
        ? 'bg-amber-500'
        : score >= 50
          ? 'bg-orange-500'
          : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] font-semibold ${
              isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {candidate.label}
          </span>
          {isBest && (
            <span className="text-[8px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1 py-0.5 rounded font-semibold uppercase">
              Best
            </span>
          )}
        </div>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{score}/100</span>
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${widthPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
};

// ============================================================================
// CONSTRAINT MATRIX
// ============================================================================

const ConstraintMatrix: React.FC<{
  candidates: SolverCandidate[];
  selectedId?: string;
}> = ({ candidates, selectedId }) => {
  // Collect all domains from all candidates
  const allDomains = new Set<string>();
  for (const c of candidates) {
    for (const v of c.report.violations) {
      allDomains.add(v.domain);
    }
  }
  const domains = Array.from(allDomains);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[9px]">
        <thead>
          <tr>
            <th className="text-left px-1.5 py-1 text-slate-400 font-medium">Domain</th>
            {candidates.map((c) => (
              <th
                key={c.id}
                className={`text-center px-1.5 py-1 font-medium ${
                  c.id === selectedId
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400'
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {domains.map((domain) => (
            <tr key={domain} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-1.5 py-1 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                {SHORT_DOMAIN_LABELS[domain] || domain}
              </td>
              {candidates.map((c) => {
                const violation = c.report.violations.find((v) => v.domain === domain);
                const passed = violation?.passed ?? true;
                return (
                  <td key={c.id} className="text-center px-1.5 py-1">
                    {passed ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500 mx-auto" />
                    ) : violation?.severity === 'critical' ? (
                      <XCircle className="w-3 h-3 text-red-500 mx-auto" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-amber-500 mx-auto" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// PENALTY COMPARISON
// ============================================================================

const PenaltyComparison: React.FC<{
  candidates: SolverCandidate[];
}> = ({ candidates }) => {
  const maxPenalty = Math.max(...candidates.map((c) => c.report.totalPenalty), 1);

  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
        Total Penalty (lower is better)
      </h4>
      {candidates.map((c) => (
        <div key={c.id} className="flex items-center gap-2">
          <span className="text-[9px] text-slate-400 w-16 text-right">{c.label}</span>
          <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${(c.report.totalPenalty / maxPenalty) * 100}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-slate-500 w-12 text-right">
            {c.report.totalPenalty.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// CANDIDATE DETAIL CARD
// ============================================================================

const CandidateCard: React.FC<{
  candidate: SolverCandidate;
  isSelected: boolean;
  isBest: boolean;
  onSelect: () => void;
}> = ({ candidate, isSelected, isBest, onSelect }) => {
  const r = candidate.report;
  const criticals = r.violations.filter((v) => !v.passed && v.severity === 'critical').length;
  const warnings = r.violations.filter((v) => !v.passed && v.severity === 'warning').length;

  return (
    <motion.div
      layout
      className={`rounded-xl border-2 transition-all cursor-pointer ${
        isSelected
          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 shadow-md'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
      onClick={onSelect}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isBest && <Crown className="w-4 h-4 text-amber-500" />}
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {candidate.label}
            </span>
          </div>
          <div
            className={`text-sm font-bold ${
              r.score >= 85
                ? 'text-green-600'
                : r.score >= 70
                  ? 'text-amber-600'
                  : 'text-red-600'
            }`}
          >
            {r.score}%
          </div>
        </div>

        {/* Mini preview */}
        <div className="flex justify-center">
          <MiniFloorPlan candidate={candidate} isSelected={isSelected} isBest={isBest} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="bg-slate-50 dark:bg-slate-800 rounded px-1.5 py-1">
            <div className="text-[8px] text-slate-400 uppercase">Rooms</div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
              {candidate.placements.length}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded px-1.5 py-1">
            <div className="text-[8px] text-slate-400 uppercase">Penalty</div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
              {r.totalPenalty.toFixed(0)}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded px-1.5 py-1">
            <div className="text-[8px] text-slate-400 uppercase">Iter</div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
              {r.iterationFound}
            </div>
          </div>
        </div>

        {/* Violation summary */}
        <div className="flex items-center gap-2 text-[9px]">
          {criticals > 0 && (
            <span className="flex items-center gap-0.5 text-red-600">
              <XCircle className="w-3 h-3" /> {criticals} critical
            </span>
          )}
          {warnings > 0 && (
            <span className="flex items-center gap-0.5 text-amber-600">
              <AlertTriangle className="w-3 h-3" /> {warnings} warning
            </span>
          )}
          {criticals === 0 && warnings === 0 && (
            <span className="flex items-center gap-0.5 text-green-600">
              <CheckCircle2 className="w-3 h-3" /> All pass
            </span>
          )}
        </div>

        {/* Select button */}
        <button
          className={`w-full py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
            isSelected
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isSelected ? '✓ Selected' : 'Select This Option'}
        </button>
      </div>
    </motion.div>
  );
};

// ============================================================================
// MAIN COMPARISON COMPONENT
// ============================================================================

export const CandidateComparison: React.FC<CandidateComparisonProps> = ({
  result,
  onSelectCandidate,
  selectedCandidateId,
  className = '',
}) => {
  const [showMatrix, setShowMatrix] = useState(false);
  const { candidates, bestCandidateId } = result;

  if (candidates.length === 0) return null;

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Layout Candidates ({candidates.length})
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              showMatrix
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-3 h-3 inline mr-1" />
            Matrix
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Score comparison bars */}
        <div className="space-y-2">
          {candidates.map((c) => (
            <ScoreBar
              key={c.id}
              candidate={c}
              maxScore={100}
              isSelected={c.id === selectedCandidateId}
              isBest={c.id === bestCandidateId}
            />
          ))}
        </div>

        {/* Candidate cards grid */}
        <div className={`grid gap-3 ${candidates.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              isSelected={c.id === selectedCandidateId}
              isBest={c.id === bestCandidateId}
              onSelect={() => onSelectCandidate(c.id)}
            />
          ))}
        </div>

        {/* Expandable constraint matrix */}
        <AnimatePresence>
          {showMatrix && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-2">
                <ConstraintMatrix
                  candidates={candidates}
                  selectedId={selectedCandidateId}
                />
                <PenaltyComparison candidates={candidates} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recommendation */}
        {bestCandidateId && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 rounded-lg border border-amber-200 dark:border-amber-800/30 p-3 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                Recommended: {candidates.find((c) => c.id === bestCandidateId)?.label}
              </p>
              <p className="text-[9px] text-amber-600 dark:text-amber-500 mt-0.5">
                Highest constraint compliance score with lowest total penalty among{' '}
                {candidates.length} generated options.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidateComparison;
