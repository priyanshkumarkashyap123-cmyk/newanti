/**
 * IS456DesignPanel.tsx - IS 456:2000 Concrete Design Checks
 * 
 * Pro Feature: Design code compliance checks
 * Shows utilization ratios for concrete members
 */

import { FC, useMemo } from 'react';
import {
    Check,
    X,
    AlertTriangle,
    ChevronDown,
    Crown
} from 'lucide-react';
import { useModelStore } from '../store/model';
import { IS456_Design, IS456_CONCRETE_GRADES, IS456_REBAR_GRADES } from '../utils/ISCodeDesign';

// ============================================
// TYPES
// ============================================

interface DesignCheck {
    name: string;
    demand: number;
    capacity: number;
    ratio: number;
    unit: string;
    status: 'pass' | 'warning' | 'fail';
}

interface MemberDesignResult {
    memberId: string;
    memberName: string;
    checks: DesignCheck[];
    overallUtilization: number;
    status: 'pass' | 'warning' | 'fail';
}

interface IS456DesignPanelProps {
    isPro?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export const IS456DesignPanel: FC<IS456DesignPanelProps> = ({ isPro = false }) => {
    const members = useModelStore((s) => s.members);
    const nodes = useModelStore((s) => s.nodes);
    const analysisResults = useModelStore((s) => s.analysisResults);

    // Default concrete and rebar grades
    const concreteGrade = IS456_CONCRETE_GRADES.find(g => g.grade === 'M25')!;
    const rebarGrade = IS456_REBAR_GRADES.find(g => g.grade === 'Fe500')!;

    // Calculate design results
    const designResults = useMemo<MemberDesignResult[]>(() => {
        if (!analysisResults || !isPro) return [];

        const results: MemberDesignResult[] = [];

        members.forEach((member, memberId) => {
            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);
            if (!startNode || !endNode) return;

            // Get member forces
            const forces = analysisResults.memberForces.get(memberId);
            if (!forces) return;

            // Calculate member length
            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const dz = endNode.z - startNode.z;
            const length = Math.sqrt(dx * dx + dy * dy + dz * dz) * 1000; // mm

            // Assume typical beam section: 300x500mm
            const b = 300;  // mm (width)
            const D = 500;  // mm (total depth)
            const cover = IS456_Design.clearCover('moderate');
            const d = D - cover - 10; // mm (effective depth, assuming 20mm bars)

            // Get applied moment and shear (from analysis or assume from axial)
            const Mu = Math.abs(forces.momentY) * 1e6; // N.mm (convert from kN.m)
            const Vu = Math.abs(forces.shearY) * 1e3;  // N (convert from kN)

            const checks: DesignCheck[] = [];

            // 1. Flexural Check
            const Mu_lim = IS456_Design.limitingMoment(concreteGrade.fck, b, d, rebarGrade.fy);
            const flexureRatio = Mu / Mu_lim;
            checks.push({
                name: 'Flexure (Moment)',
                demand: Mu / 1e6, // kN.m
                capacity: Mu_lim / 1e6, // kN.m
                ratio: flexureRatio,
                unit: 'kN.m',
                status: flexureRatio > 1 ? 'fail' : flexureRatio > 0.9 ? 'warning' : 'pass'
            });

            // 2. Shear Check
            const pt = 0.8; // Assume 0.8% steel
            const tauC = IS456_Design.shearStrengthConcrete(concreteGrade.fck, pt);
            const Vc = tauC * b * d; // N (concrete shear capacity)
            const shearRatio = Vu / Vc;
            checks.push({
                name: 'Shear',
                demand: Vu / 1e3, // kN
                capacity: Vc / 1e3, // kN
                ratio: shearRatio,
                unit: 'kN',
                status: shearRatio > 1 ? 'fail' : shearRatio > 0.9 ? 'warning' : 'pass'
            });

            // 3. Deflection Check (span/depth ratio)
            const spanDepthLimit = IS456_Design.spanDepthRatio('simply_supported');
            const actualSpanDepth = length / d;
            const deflectionRatio = actualSpanDepth / spanDepthLimit;
            checks.push({
                name: 'Deflection (L/d)',
                demand: actualSpanDepth,
                capacity: spanDepthLimit,
                ratio: deflectionRatio,
                unit: '',
                status: deflectionRatio > 1 ? 'fail' : deflectionRatio > 0.9 ? 'warning' : 'pass'
            });

            // 4. Minimum Reinforcement Check
            const As_min = IS456_Design.minTensionReinforcement(b, d, rebarGrade.fy);
            const As_provided = 0.008 * b * d; // Assume 0.8% provided
            const minSteelRatio = As_min / As_provided;
            checks.push({
                name: 'Min Steel',
                demand: As_min,
                capacity: As_provided,
                ratio: minSteelRatio,
                unit: 'mm²',
                status: minSteelRatio > 1 ? 'fail' : 'pass'
            });

            const overallUtilization = Math.max(...checks.map(c => c.ratio));
            const status = checks.some(c => c.status === 'fail') ? 'fail'
                : checks.some(c => c.status === 'warning') ? 'warning' : 'pass';

            results.push({
                memberId,
                memberName: `M${memberId.slice(-4)}`,
                checks,
                overallUtilization,
                status
            });
        });

        return results;
    }, [members, nodes, analysisResults, isPro, concreteGrade, rebarGrade]);

    // Summary stats
    const summary = useMemo(() => {
        const total = designResults.length;
        const passing = designResults.filter(r => r.status === 'pass').length;
        const warnings = designResults.filter(r => r.status === 'warning').length;
        const failing = designResults.filter(r => r.status === 'fail').length;
        return { total, passing, warnings, failing };
    }, [designResults]);

    if (!isPro) {
        return (
            <div className="p-6 bg-zinc-900 rounded-xl text-center">
                <Crown className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                <h3 className="text-lg font-bold text-white mb-2">Pro Feature</h3>
                <p className="text-zinc-400 text-sm mb-4">
                    IS 456:2000 design checks are available with Pro
                </p>
                <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white font-medium">
                    Upgrade to Pro
                </button>
            </div>
        );
    }

    if (!analysisResults) {
        return (
            <div className="p-6 bg-zinc-900 rounded-xl text-center">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                <h3 className="text-lg font-bold text-white mb-2">Run Analysis First</h3>
                <p className="text-zinc-400 text-sm">
                    Design checks require analysis results
                </p>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-orange-600 to-red-600">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">IS 456:2000 Design Check</h2>
                        <p className="text-sm text-white/70">
                            {concreteGrade.grade} Concrete • {rebarGrade.grade} Rebar
                        </p>
                    </div>
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 rounded text-yellow-400 text-xs">
                        <Crown className="w-3 h-3" /> PRO
                    </span>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-4 gap-4 p-4 border-b border-zinc-800">
                <div className="text-center">
                    <div className="text-2xl font-bold text-white">{summary.total}</div>
                    <div className="text-xs text-zinc-500">Total</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{summary.passing}</div>
                    <div className="text-xs text-zinc-500">Passing</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-400">{summary.warnings}</div>
                    <div className="text-xs text-zinc-500">Warnings</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">{summary.failing}</div>
                    <div className="text-xs text-zinc-500">Failing</div>
                </div>
            </div>

            {/* Results List */}
            <div className="max-h-96 overflow-y-auto">
                {designResults.map((result) => (
                    <details key={result.memberId} className="border-b border-zinc-800 group">
                        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/50">
                            <div className="flex items-center gap-3">
                                {result.status === 'pass' ? (
                                    <Check className="w-5 h-5 text-green-400" />
                                ) : result.status === 'warning' ? (
                                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                                ) : (
                                    <X className="w-5 h-5 text-red-400" />
                                )}
                                <span className="font-medium text-white">{result.memberName}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-sm ${result.overallUtilization > 1 ? 'text-red-400' :
                                        result.overallUtilization > 0.9 ? 'text-yellow-400' : 'text-green-400'
                                    }`}>
                                    {(result.overallUtilization * 100).toFixed(0)}%
                                </span>
                                <ChevronDown className="w-4 h-4 text-zinc-500 group-open:rotate-180 transition-transform" />
                            </div>
                        </summary>
                        <div className="px-4 pb-4 space-y-2">
                            {result.checks.map((check, i) => (
                                <div key={i} className="flex items-center justify-between text-sm py-2 border-t border-zinc-800/50">
                                    <span className="text-zinc-400">{check.name}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-zinc-500">
                                            {check.demand.toFixed(1)} / {check.capacity.toFixed(1)} {check.unit}
                                        </span>
                                        <span className={`w-16 text-right font-medium ${check.status === 'pass' ? 'text-green-400' :
                                                check.status === 'warning' ? 'text-yellow-400' : 'text-red-400'
                                            }`}>
                                            {(check.ratio * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </details>
                ))}
            </div>
        </div>
    );
};

export default IS456DesignPanel;
