/**
 * FSDComparisonPanel — Before/After optimization comparison for section-wise design
 *
 * Shows:
 * - Uniform section vs section-wise UR comparison per member
 * - Weight savings from section-wise checking
 * - Haunch recommendations for continuous beams
 * - Economy ratio improvement
 */
import React from 'react';

// ============================================
// TYPES (mirrors Rust FSD structs)
// ============================================

export interface SectionWiseDesignCheck {
    member_id: string;
    section_name: string;
    max_utilization: number;
    min_utilization: number;
    governing_station: number;
    midspan_ur: number;
    support_ur: number;
    passed: boolean;
    economy_ratio: number;
}

export interface HaunchRecommendation {
    member_id: string;
    recommended: boolean;
    haunch_location: string;
    depth_increase_ratio: number;
    estimated_saving_pct: number;
    reason: string;
}

export interface FSDSectionWiseComparison {
    single_point_max_ur: number;
    section_wise_max_ur: number;
    section_wise_more_conservative: boolean;
    haunch_recommendations: HaunchRecommendation[];
    haunch_count: number;
    haunch_saving_pct: number;
}

interface MemberComparison {
    member_id: string;
    section_name: string;
    /** Traditional single-point UR (e.g. from FSD iteration) */
    uniform_ur: number;
    /** Multi-station section-wise max UR */
    section_wise_check: SectionWiseDesignCheck;
    haunch?: HaunchRecommendation;
}

interface FSDComparisonPanelProps {
    members: MemberComparison[];
    comparison?: FSDSectionWiseComparison;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const ComparisonBar: React.FC<{
    label: string;
    before: number;
    after: number;
    unit?: string;
    beforeLabel?: string;
    afterLabel?: string;
}> = ({ label, before, after, unit = '', beforeLabel = 'Uniform', afterLabel = 'Section-wise' }) => {
    const maxVal = Math.max(before, after, 0.01);
    const delta = before > 0 ? ((after - before) / before * 100).toFixed(1) : '—';
    const increased = after > before;

    return (
        <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>{label}</span>
                <span className={increased ? 'text-yellow-500' : 'text-green-500'}>
                    {increased ? '+' : ''}{delta}%
                </span>
            </div>
            <div className="flex gap-1">
                <div className="flex-1">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                        <div
                            className="h-full bg-blue-400"
                            style={{ width: `${(before / maxVal) * 100}%` }}
                        />
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {beforeLabel}: {before.toFixed(3)}{unit ? ` ${unit}` : ''}
                    </div>
                </div>
                <div className="flex-1">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                        <div
                            className={`h-full ${increased ? 'bg-orange-400' : 'bg-green-400'}`}
                            style={{ width: `${(after / maxVal) * 100}%` }}
                        />
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {afterLabel}: {after.toFixed(3)}{unit ? ` ${unit}` : ''}
                    </div>
                </div>
            </div>
        </div>
    );
};

const HaunchCard: React.FC<{ haunch: HaunchRecommendation }> = ({ haunch }) => {
    if (!haunch.recommended) return null;

    return (
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 mt-2">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                    ⚡ Haunch Recommended
                </span>
                <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                    {haunch.haunch_location.replace('_', ' ')}
                </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">{haunch.reason}</p>
            <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span>Depth increase: <strong>{(haunch.depth_increase_ratio * 100).toFixed(0)}%</strong></span>
                <span>Est. saving: <strong>{haunch.estimated_saving_pct.toFixed(0)}%</strong> vs upsizing</span>
            </div>
        </div>
    );
};

const URGradientBar: React.FC<{ check: SectionWiseDesignCheck }> = ({ check }) => {
    // Simple 3-segment visualization: support | midspan | support
    const segments = [
        { label: 'Supp.', ur: check.support_ur },
        { label: 'Mid', ur: check.midspan_ur },
        { label: 'Supp.', ur: check.support_ur },
    ];

    return (
        <div className="flex gap-0.5 h-5 rounded overflow-hidden">
            {segments.map((seg, i) => {
                const pct = Math.min(seg.ur, 1.5) / 1.5 * 100;
                const color = seg.ur > 1.0
                    ? 'bg-red-400'
                    : seg.ur > 0.8
                        ? 'bg-yellow-400'
                        : 'bg-green-400';
                return (
                    <div key={i} className="flex-1 bg-slate-200 dark:bg-slate-700 relative" title={`${seg.label}: UR=${seg.ur.toFixed(3)}`}>
                        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] text-slate-700 dark:text-slate-200 font-mono">
                            {seg.ur.toFixed(2)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const FSDComparisonPanel: React.FC<FSDComparisonPanelProps> = ({ members, comparison }) => {
    if (members.length === 0) {
        return (
            <div className="text-sm text-slate-400 p-4 text-center">
                No section-wise optimization data available.
            </div>
        );
    }

    const totalHaunches = comparison?.haunch_count ?? members.filter(m => m.haunch?.recommended).length;
    const avgEconomy = members.reduce((sum, m) => sum + m.section_wise_check.economy_ratio, 0) / members.length;
    const allPassed = members.every(m => m.section_wise_check.passed);

    return (
        <div className="space-y-4">
            {/* ── Summary Header ── */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Section-Wise Optimization Summary
                    </h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        allPassed
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                    }`}>
                        {allPassed ? 'ALL PASS' : 'INADEQUATE'}
                    </span>
                </div>

                {/* Key metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div>
                        <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {members.length}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Members Checked</div>
                    </div>
                    <div>
                        <div className={`text-lg font-bold ${avgEconomy > 2.0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {avgEconomy.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Avg Economy Ratio</div>
                    </div>
                    <div>
                        <div className="text-lg font-bold text-blue-600">
                            {totalHaunches}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Haunch Suggestions</div>
                    </div>
                    {comparison && (
                        <div>
                            <div className="text-lg font-bold text-green-600">
                                {comparison.haunch_saving_pct.toFixed(1)}%
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Est. Haunch Savings</div>
                        </div>
                    )}
                </div>

                {/* Global comparison bar */}
                {comparison && (
                    <div className="mt-4">
                        <ComparisonBar
                            label="Governing UR"
                            before={comparison.single_point_max_ur}
                            after={comparison.section_wise_max_ur}
                            beforeLabel="Single-point"
                            afterLabel="21-station"
                        />
                        {comparison.section_wise_more_conservative && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                Section-wise check is more conservative — captures peak demands between nodes.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* ── Per-Member Cards ── */}
            {members.map((m) => {
                const sw = m.section_wise_check;
                return (
                    <div key={m.member_id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {m.member_id}
                                </span>
                                <span className="text-xs text-slate-400">{m.section_name}</span>
                            </div>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                sw.passed
                                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                    : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                            }`}>
                                {sw.passed ? 'SAFE' : 'FAIL'}
                            </span>
                        </div>

                        {/* UR gradient bar */}
                        <div className="mb-2">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                UR Distribution (Support → Midspan → Support)
                            </div>
                            <URGradientBar check={sw} />
                        </div>

                        {/* Comparison bars */}
                        <ComparisonBar
                            label="Max Utilization"
                            before={m.uniform_ur}
                            after={sw.max_utilization}
                        />

                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
                            <div>
                                <span className="text-slate-400">Governing Stn:</span>{' '}
                                <span className="font-mono text-slate-700 dark:text-slate-200">{sw.governing_station}/20</span>
                            </div>
                            <div>
                                <span className="text-slate-400">Economy:</span>{' '}
                                <span className={`font-mono ${sw.economy_ratio > 2.0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {sw.economy_ratio.toFixed(2)}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400">Min UR:</span>{' '}
                                <span className="font-mono text-slate-700 dark:text-slate-200">{sw.min_utilization.toFixed(3)}</span>
                            </div>
                        </div>

                        {/* Haunch recommendation */}
                        {m.haunch && <HaunchCard haunch={m.haunch} />}
                    </div>
                );
            })}

            {/* ── Engineering Note ── */}
            <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-2">
                <strong>Note:</strong> Section-wise checking evaluates capacity at 21 stations along each span.
                Economy ratio = max UR / min UR — values &gt; 2.0 indicate potential for haunches or curtailment.
                Haunch heuristic triggers when support UR / midspan UR &gt; 1.5.
            </div>
        </div>
    );
};
