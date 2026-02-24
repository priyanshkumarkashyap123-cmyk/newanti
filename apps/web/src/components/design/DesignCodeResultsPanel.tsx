/**
 * DesignCodeResultsPanel.tsx - Wired to Real Analysis
 * 
 * Displays design code checks with actual member forces from WASM solver.
 */

import { FC, useState, useEffect } from 'react';
import { useModelStore } from '../../store/model';
import { wasmSolver } from '../../services/wasmSolverService';
import { codeCompliance, CodeCheck } from '../../services/CodeComplianceEngine';
import {
    CheckCircle, XCircle, AlertTriangle,
    FileText, Play, Loader2, ChevronDown, ChevronRight
} from 'lucide-react';

interface MemberResult {
    memberId: string;
    checks: CodeCheck[];
    overallStatus: 'PASS' | 'FAIL' | 'WARNING';
    utilization: number;
}

export const DesignCodeResultsPanel: FC = () => {
    const [results, setResults] = useState<MemberResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedMember, setExpandedMember] = useState<string | null>(null);
    const [selectedCode, setSelectedCode] = useState<'IS800' | 'AISC360' | 'EC3'>('IS800');

    const model = useModelStore();

    const runDesignChecks = async () => {
        if (model.members.size === 0) return;

        setLoading(true);
        try {
            // 1. Run structural analysis
            const nodesArray = Array.from(model.nodes.values());
            const membersArray = Array.from(model.members.values());
            
            const analysisResults = await wasmSolver.analyze(
                nodesArray as any,
                membersArray as any,
                [] as any,
                (model.memberLoads || []) as any
            );

            // 2. Run design code checks for each member
            const memberResults: MemberResult[] = [];

            for (const member of membersArray) {
                // Safely access member forces with optional chaining
                const forces = (analysisResults as any)?.member_forces?.[member.id];
                
                const memberForces = {
                    axial: forces?.axial || 0,
                    shearY: forces?.shearY || 0,
                    shearZ: 0,
                    momentY: forces?.momentZ || 0, // Assuming 2D/3D mapping
                    momentZ: 0,
                    torsion: 0
                };

                const section = {
                    name: member.sectionId || 'ISMB 300',
                    area: 5800,
                    Ix: 86000000,
                    Iy: 4530000,
                    Zx: 573000,
                    Zy: 64700,
                    depth: 300,
                    width: 140,
                    webThickness: 7.5,
                    flangeThickness: 12.4,
                    ry: 28
                };

                const material = {
                    name: 'E250',
                    fy: 250,
                    fu: 410,
                    E: 200000
                };

                // Get length
                const startNode = model.nodes.get(member.startNodeId);
                const endNode = model.nodes.get(member.endNodeId);
                const length = startNode && endNode
                    ? Math.sqrt((endNode.x - startNode.x) ** 2 + (endNode.y - startNode.y) ** 2 + (endNode.z - startNode.z) ** 2) * 1000
                    : 3000;

                // Transform properties to match MemberProperties interface
                const memberProps: any = {
                    section,
                    material,
                    length,
                    effectiveLengthY: length,
                    effectiveLengthZ: length
                };

                // Run full compliance report which includes all checks
                const report = codeCompliance.checkSteelMember(
                    memberProps,
                    memberForces
                );
                
                const checks = report.checks;
                const maxUtil = report.maxUtilization;
                const hasFail = checks.some(c => c.status === 'FAIL');
                const hasWarn = checks.some(c => c.status === 'WARNING');

                memberResults.push({
                    memberId: member.id,
                    checks,
                    overallStatus: hasFail ? 'FAIL' : hasWarn ? 'WARNING' : 'PASS',
                    utilization: maxUtil
                });
            }

            setResults(memberResults);
        } catch (e) {
            console.error('Design check failed:', e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PASS': return <CheckCircle className="w-4 h-4 text-green-400" />;
            case 'FAIL': return <XCircle className="w-4 h-4 text-red-400" />;
            default: return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
        }
    };

    const getUtilColor = (util: number) => {
        if (util <= 0.7) return 'text-green-400';
        if (util <= 0.9) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-200">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <h2 className="text-sm font-bold">Design Code Checks</h2>
                    </div>
                    <button
                        onClick={runDesignChecks}
                        disabled={loading || model.members.size === 0}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        {loading ? 'Checking...' : 'Run Checks'}
                    </button>
                </div>

                {/* Code selector */}
                <div className="flex gap-2">
                    {(['IS800', 'AISC360', 'EC3'] as const).map(code => (
                        <button
                            key={code}
                            onClick={() => setSelectedCode(code)}
                            className={`px-3 py-1 rounded text-xs ${selectedCode === code
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                        >
                            {code}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4">
                {results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                        <FileText className="w-12 h-12 opacity-30 mb-4" />
                        <p className="text-sm">Run design checks to see results</p>
                        <p className="text-xs mt-1">{model.members.size} members in model</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="p-3 bg-green-500/10 rounded border border-green-500/20 text-center">
                                <div className="text-xl font-bold text-green-400">
                                    {results.filter(r => r.overallStatus === 'PASS').length}
                                </div>
                                <div className="text-[10px] text-zinc-400">PASS</div>
                            </div>
                            <div className="p-3 bg-yellow-500/10 rounded border border-yellow-500/20 text-center">
                                <div className="text-xl font-bold text-yellow-400">
                                    {results.filter(r => r.overallStatus === 'WARNING').length}
                                </div>
                                <div className="text-[10px] text-zinc-400">WARNING</div>
                            </div>
                            <div className="p-3 bg-red-500/10 rounded border border-red-500/20 text-center">
                                <div className="text-xl font-bold text-red-400">
                                    {results.filter(r => r.overallStatus === 'FAIL').length}
                                </div>
                                <div className="text-[10px] text-zinc-400">FAIL</div>
                            </div>
                        </div>

                        {/* Member results */}
                        {results.map(result => (
                            <div key={result.memberId} className="bg-zinc-900 rounded border border-zinc-800">
                                <button
                                    onClick={() => setExpandedMember(
                                        expandedMember === result.memberId ? null : result.memberId
                                    )}
                                    className="w-full p-3 flex items-center justify-between hover:bg-zinc-800/50"
                                >
                                    <div className="flex items-center gap-3">
                                        {getStatusIcon(result.overallStatus)}
                                        <span className="text-xs font-medium">{result.memberId}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-mono ${getUtilColor(result.utilization)}`}>
                                            {(result.utilization * 100).toFixed(0)}%
                                        </span>
                                        {expandedMember === result.memberId
                                            ? <ChevronDown className="w-4 h-4" />
                                            : <ChevronRight className="w-4 h-4" />
                                        }
                                    </div>
                                </button>

                                {expandedMember === result.memberId && (
                                    <div className="px-3 pb-3 space-y-1 border-t border-zinc-800">
                                        {result.checks.map((check, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between py-2 text-xs"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(check.status)}
                                                    <span className="text-zinc-300">{check.title}</span>
                                                    <span className="text-zinc-500">({check.clause})</span>
                                                </div>
                                                <span className={getUtilColor(check.ratio)}>
                                                    {(check.ratio * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DesignCodeResultsPanel;
