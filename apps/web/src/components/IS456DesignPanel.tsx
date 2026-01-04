/**
 * IS456DesignPanel.tsx - IS 456:2000 Concrete Design Checks
 * 
 * Pro Feature: Design code compliance checks
 * Shows utilization ratios for concrete members
 */

import { FC, useMemo, useState } from 'react';
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

    // State for results
    const [apiResults, setApiResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleRunCheck = async () => {
        if (!analysisResults) return;
        setIsLoading(true);
        try {
            const designInputs = members.keys().map(id => {
                const member = members.get(id)!;
                const startNode = nodes.get(member.startNodeId)!;
                const endNode = nodes.get(member.endNodeId)!;
                const dx = endNode.x - startNode.x;
                const dy = endNode.y - startNode.y;
                const dz = endNode.z - startNode.z;
                const length = Math.sqrt(dx * dx + dy * dy + dz * dz) * 1000; // mm

                const forces = analysisResults.memberForces.get(id);

                return {
                    id,
                    type: Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > Math.abs(dz) ? 'column' : 'beam', // Simple heuristic
                    width: (member.width || 0.3) * 1000,
                    depth: (member.depth || 0.5) * 1000,
                    length,
                    forces: {
                        axial: forces?.axial || 0,
                        shearY: forces?.shearY || 0,
                        shearZ: forces?.shearZ || 0,
                        torsion: forces?.torsion || 0,
                        momentY: forces?.momentY || 0,
                        momentZ: forces?.momentZ || 0
                    },
                    fck: concreteGrade.fck,
                    fy: rebarGrade.fy,
                    cover: 25
                };
            }).filter(Boolean);

            const results = await import('../api/design').then(m => m.designConcreteMembers(Array.from(designInputs)));
            setApiResults(results);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Use API results instead of local calculation
    const designResults = useMemo(() => {
        if (apiResults.length > 0) return apiResults;
        return [];
    }, [apiResults]);

    // ... (keep existing summary logic)
    // Summary stats
    const summary = useMemo(() => {
        const total = designResults.length;
        const passing = designResults.filter((r: any) => r.status === 'pass').length;
        const warnings = designResults.filter((r: any) => r.status === 'warning').length;
        const failing = designResults.filter((r: any) => r.status === 'fail').length;
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
                    <button
                        onClick={handleRunCheck}
                        disabled={isLoading}
                        className="px-4 py-1.5 bg-white text-orange-600 rounded-md text-sm font-bold hover:bg-zinc-100 disabled:opacity-50"
                    >
                        {isLoading ? 'Checking...' : 'Run Check'}
                    </button>
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
                {designResults.map((result: any) => (
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
                                <span className="font-medium text-white">{result.memberId}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-sm ${result.overallRatio > 1 ? 'text-red-400' :
                                    result.overallRatio > 0.9 ? 'text-yellow-400' : 'text-green-400'
                                    }`}>
                                    {(result.overallRatio * 100).toFixed(0)}%
                                </span>
                                <ChevronDown className="w-4 h-4 text-zinc-500 group-open:rotate-180 transition-transform" />
                            </div>
                        </summary>
                        <div className="px-4 pb-4 space-y-2">
                            {/* Rebar Details */}
                            <div className="grid grid-cols-2 gap-4 mb-4 p-2 bg-zinc-800/50 rounded text-xs border border-zinc-700">
                                {Object.entries(result.details || {}).map(([key, value]) => (
                                    <div key={key}>
                                        <div className="text-zinc-500 capitalize">{key.replace('_', ' ')}</div>
                                        <div className="text-white font-mono">{String(value)}</div>
                                    </div>
                                ))}
                            </div>

                            {result.checks.map((check: any, i: number) => (
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
                {designResults.length === 0 && !isLoading && (
                    <div className="p-8 text-center text-zinc-500 text-sm">
                        Click "Run Check" to verify member capacities
                    </div>
                )}
            </div>
        </div>
    );
};

export default IS456DesignPanel;
