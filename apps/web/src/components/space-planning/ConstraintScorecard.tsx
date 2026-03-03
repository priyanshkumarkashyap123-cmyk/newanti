/**
 * ============================================================================
 * CONSTRAINT SCORECARD PANEL
 * ============================================================================
 *
 * Architect-grade right-rail panel showing real-time pass/fail status for
 * all 10+ constraint domains from the v2 CSP solver:
 *
 *   - FSI / FAR compliance
 *   - Room overlap detection
 *   - Minimum width enforcement
 *   - Aspect ratio compliance
 *   - Exterior wall access
 *   - Wet-wall clustering (plumbing)
 *   - Acoustic zone separation
 *   - Anthropometric clearances
 *   - Structural grid snap
 *   - Circulation ratio
 *   - Span limits
 *   - Staircase compliance
 *   - Fenestration (window-to-wall)
 *   - Egress travel distance
 *   - Solar orientation scoring
 *
 * Visual hierarchy: Overall score → Critical failures → Warnings → Passed
 *
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ChevronDown,
  ChevronUp,
  Activity,
  Ruler,
  Grid3X3,
  Droplets,
  Volume2,
  DoorOpen,
  Columns3,
  Footprints,
  Move3D,
  Navigation,
  Sun,
  Wind,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  BarChart3,
  Target,
  Gauge,
} from 'lucide-react';
import type {
  ConstraintReport,
  ConstraintViolation,
  ConstraintDomain,
} from '../../services/space-planning/layoutApiService';

// ============================================================================
// TYPES
// ============================================================================

interface ConstraintScorecardProps {
  report: ConstraintReport;
  onViolationClick?: (roomIds: string[]) => void;
  className?: string;
  collapsed?: boolean;
}

// ============================================================================
// DOMAIN ICON MAP
// ============================================================================

const DOMAIN_ICONS: Record<ConstraintDomain, typeof Shield> = {
  fsi: Gauge,
  overlap: Grid3X3,
  min_width: Ruler,
  aspect_ratio: Move3D,
  exterior_wall: DoorOpen,
  plumbing_cluster: Droplets,
  acoustic_zones: Volume2,
  clearance: Footprints,
  grid_snap: Columns3,
  circulation: Footprints,
  span_limits: Columns3,
  staircase: Navigation,
  fenestration: Sun,
  egress: Activity,
  solar: Sun,
};

// ============================================================================
// SCORE RING COMPONENT
// ============================================================================

const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 80 }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 100);
  const color =
    score >= 85
      ? '#22c55e'
      : score >= 70
        ? '#eab308'
        : score >= 50
          ? '#f97316'
          : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          className="text-slate-200 dark:text-slate-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-[8px] text-slate-400 uppercase tracking-wide">score</span>
      </div>
    </div>
  );
};

// ============================================================================
// VIOLATION ROW COMPONENT
// ============================================================================

const ViolationRow: React.FC<{
  violation: ConstraintViolation;
  onRoomClick?: (roomIds: string[]) => void;
}> = ({ violation, onRoomClick }) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = DOMAIN_ICONS[violation.domain] || Shield;

  const statusIcon = violation.passed ? (
    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
  ) : violation.severity === 'critical' ? (
    <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
  ) : violation.severity === 'warning' ? (
    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
  ) : (
    <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
  );

  const bgColor = violation.passed
    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30'
    : violation.severity === 'critical'
      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'
      : violation.severity === 'warning'
        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30'
        : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30';

  return (
    <div className={`rounded-lg border ${bgColor} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex-1 min-w-0 truncate">
          {violation.label}
        </span>
        {statusIcon}
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-slate-400" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 space-y-1.5">
              <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {violation.message}
              </p>

              {/* Value bar if applicable */}
              {violation.value != null && violation.limit != null && (
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>
                      Current: {typeof violation.value === 'number' ? violation.value.toFixed(2) : violation.value}
                    </span>
                    <span>
                      Limit: {typeof violation.limit === 'number' ? violation.limit.toFixed(2) : violation.limit}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        violation.passed ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          ((violation.value as number) / (violation.limit as number)) * 100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Affected rooms */}
              {violation.roomIds && violation.roomIds.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {violation.roomIds.map((id) => (
                    <button
                      key={id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRoomClick?.([id]);
                      }}
                      className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-[9px] text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400 transition-colors cursor-pointer"
                    >
                      {id}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// FSI GAUGE COMPONENT
// ============================================================================

const FSIGauge: React.FC<{ fsi: ConstraintReport['fsi'] }> = ({ fsi }) => {
  if (!fsi) return null;
  const usedPct = ((fsi.fsi_used || 0) / (fsi.fsi_limit || 1)) * 100;
  const isOver = usedPct > 100;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          FSI / FAR
        </span>
        <span
          className={`text-xs font-bold ${isOver ? 'text-red-600' : 'text-green-600'}`}
        >
          {fsi.fsi_used?.toFixed(2)} / {fsi.fsi_limit}
        </span>
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isOver ? 'bg-red-500' : usedPct > 85 ? 'bg-amber-500' : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(usedPct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>Placed: {fsi.total_placed_sqm?.toFixed(1)}m²</span>
        <span>Max: {fsi.max_allowed_sqm?.toFixed(1)}m²</span>
      </div>
    </div>
  );
};

// ============================================================================
// SOLVER STATS BAR
// ============================================================================

const SolverStats: React.FC<{ report: ConstraintReport }> = ({ report }) => (
  <div className="grid grid-cols-3 gap-2 text-center">
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2 py-1.5">
      <div className="text-[9px] text-slate-400 uppercase">Penalty</div>
      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
        {report.totalPenalty.toFixed(0)}
      </div>
    </div>
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2 py-1.5">
      <div className="text-[9px] text-slate-400 uppercase">Iteration</div>
      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
        {report.iterationFound}/{report.totalIterations}
      </div>
    </div>
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2 py-1.5">
      <div className="text-[9px] text-slate-400 uppercase">Domains</div>
      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
        {report.constraintsMet}/{report.constraintsTotal}
      </div>
    </div>
  </div>
);

// ============================================================================
// MAIN SCORECARD COMPONENT
// ============================================================================

export const ConstraintScorecard: React.FC<ConstraintScorecardProps> = ({
  report,
  onViolationClick,
  className = '',
  collapsed: initialCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  const criticalFails = report.violations.filter((v) => !v.passed && v.severity === 'critical');
  const warnings = report.violations.filter((v) => !v.passed && v.severity === 'warning');
  const passed = report.violations.filter((v) => v.passed);
  const infoFails = report.violations.filter((v) => !v.passed && v.severity === 'info');

  const headerIcon =
    criticalFails.length > 0 ? (
      <ShieldX className="w-5 h-5 text-red-500" />
    ) : warnings.length > 0 ? (
      <ShieldAlert className="w-5 h-5 text-amber-500" />
    ) : (
      <ShieldCheck className="w-5 h-5 text-green-500" />
    );

  const headerLabel =
    criticalFails.length > 0
      ? `${criticalFails.length} Critical Issue${criticalFails.length > 1 ? 's' : ''}`
      : warnings.length > 0
        ? `${warnings.length} Warning${warnings.length > 1 ? 's' : ''}`
        : 'All Constraints Passed';

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <ScoreRing score={report.score} size={56} />
        <div className="flex-1 text-left">
          <div className="flex items-center gap-1.5">
            {headerIcon}
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {headerLabel}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {report.constraintsMet} of {report.constraintsTotal} domains satisfied
          </p>
        </div>
        {isCollapsed ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Solver stats */}
              <SolverStats report={report} />

              {/* FSI gauge */}
              <FSIGauge fsi={report.fsi} />

              {/* Critical violations */}
              {criticalFails.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Critical
                  </h4>
                  {criticalFails.map((v) => (
                    <ViolationRow
                      key={v.domain}
                      violation={v}
                      onRoomClick={onViolationClick}
                    />
                  ))}
                </div>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Warnings
                  </h4>
                  {warnings.map((v) => (
                    <ViolationRow
                      key={v.domain}
                      violation={v}
                      onRoomClick={onViolationClick}
                    />
                  ))}
                </div>
              )}

              {/* Info-level fails */}
              {infoFails.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                    <Info className="w-3 h-3" /> Suggestions
                  </h4>
                  {infoFails.map((v) => (
                    <ViolationRow
                      key={v.domain}
                      violation={v}
                      onRoomClick={onViolationClick}
                    />
                  ))}
                </div>
              )}

              {/* Passed */}
              {passed.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Passed ({passed.length})
                  </h4>
                  {passed.map((v) => (
                    <ViolationRow
                      key={v.domain}
                      violation={v}
                      onRoomClick={onViolationClick}
                    />
                  ))}
                </div>
              )}

              {/* Anthropometric issues */}
              {report.anthropometricIssues.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800/30 p-2.5">
                  <h4 className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase mb-1">
                    Anthropometric Notes
                  </h4>
                  <ul className="space-y-0.5">
                    {report.anthropometricIssues.map((issue, i) => (
                      <li
                        key={i}
                        className="text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1"
                      >
                        <span className="mt-0.5">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Solar scores summary */}
              {report.solarScores.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800/30 p-2.5">
                  <h4 className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase mb-1.5 flex items-center gap-1">
                    <Sun className="w-3 h-3" /> Solar Scores
                  </h4>
                  <div className="grid grid-cols-2 gap-1">
                    {report.solarScores.map((s) => (
                      <div
                        key={s.room_id}
                        className="flex items-center justify-between bg-white dark:bg-slate-800 rounded px-2 py-1"
                      >
                        <span className="text-[9px] text-slate-500 truncate max-w-[60%]">
                          {s.room_id}
                        </span>
                        <span
                          className={`text-[9px] font-semibold ${
                            s.solar_score >= 0.7
                              ? 'text-green-600'
                              : s.solar_score >= 0.4
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }`}
                        >
                          {(s.solar_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ConstraintScorecard;
