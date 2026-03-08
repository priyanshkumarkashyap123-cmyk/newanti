/**
 * SteelDesignPage.tsx - Comprehensive Steel Member Design UI
 * Uses Rust AISC design API for 10x faster design checks
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Play, AlertTriangle, Box, ArrowLeft } from 'lucide-react';
import { useModelStore } from '../store/model';
import { useShallow } from 'zustand/react/shallow';
import { 
    performSteelDesignCheck, 
    designSteelMembers, 
    SteelDesignResults,
    MemberForces,
    DesignParameters 
} from '../services/SteelDesignService';
import { getSectionById, Material } from '../data/SectionDatabase';

export function SteelDesignPage() {
    const navigate = useNavigate();
    const store = useModelStore(
      useShallow((s) => ({ members: s.members, nodes: s.nodes, analysisResults: s.analysisResults }))
    );
    const [selectedMember, setSelectedMember] = useState<string>('');
    const [designCode, setDesignCode] = useState<'AISC360' | 'IS800'>('AISC360');
    const [analyzing, setAnalyzing] = useState(false);
    const [results, setResults] = useState<SteelDesignResults[]>([]);
    const [error, setError] = useState<string>('');

    useEffect(() => { document.title = 'Steel Design | BeamLab'; }, []);

    // Default design parameters
    const [params, setParams] = useState<DesignParameters>({
        Lb: 3000,  // 3m unbraced length
        Lx: 3000,  // 3m effective length X
        Ly: 3000,  // 3m effective length Y
        Kx: 1.0,
        Ky: 1.0,
        Cb: 1.0
    });

    const members = Array.from(store.members.values());

    const handleRunDesign = async () => {
        if (members.length === 0) {
            setError('No members in model');
            return;
        }

        setAnalyzing(true);
        setError('');
        setResults([]);

        try {
            // Get analysis results if available
            const analysisResults = store.analysisResults;
            
            if (!analysisResults) {
                setError('Please run structural analysis first');
                setAnalyzing(false);
                return;
            }

            // Prepare design checks for all members (or selected member)
            const membersToCheck = selectedMember 
                ? members.filter(m => m.id === selectedMember)
                : members;

            const designChecks: SteelDesignResults[] = [];

            for (const member of membersToCheck) {
                // Get section properties
                const section = getSectionById(member.sectionId || 'Default');
                if (!section) {
                    console.warn(`Section ${member.sectionId || 'Default'} not found`);
                    continue;
                }

                // Calculate actual member length from node coordinates
                const n1 = store.nodes.get(member.startNodeId);
                const n2 = store.nodes.get(member.endNodeId);
                const memberLength = (n1 && n2)
                    ? Math.sqrt((n2.x - n1.x) ** 2 + (n2.y - n1.y) ** 2 + ((n2.z || 0) - (n1.z || 0)) ** 2) * 1000 // m → mm
                    : params.Lx; // fallback to design parameter

                // Get material (default to steel)
                const material: Material = {
                    id: 'steel-grade-50',
                    name: 'Steel Grade 50',
                    type: 'steel',
                    E: 200000,  // MPa
                    poissonsRatio: 0.3,
                    density: 7850,  // kg/m³
                    fy: 345,    // MPa (Grade 50 steel)
                    fu: 450     // MPa
                };

                // Get member forces from analysis results
                const memberForceData = analysisResults.memberForces?.get(member.id);
                const forces: MemberForces = {
                    axial: memberForceData?.axial || 0,
                    shearY: memberForceData?.shearY || 0,
                    shearZ: memberForceData?.shearZ || 0,
                    momentY: memberForceData?.momentY || 0,
                    momentZ: memberForceData?.momentZ || 0
                };

                // Perform local design check with actual member length
                const memberParams = {
                    ...params,
                    Lx: memberLength,
                    Ly: memberLength,
                    Lb: memberLength,
                };

                const designResult = performSteelDesignCheck(
                    member.id,
                    section,
                    material,
                    forces,
                    memberParams
                );

                designChecks.push(designResult);
            }

            // Send to Rust API for validation and additional checks (10x faster!)
            const apiResults = await designSteelMembers(designChecks, designCode);
            
            setResults(apiResults);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Design check failed');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="steel-design-page p-5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-screen">
            <header className="mb-8">
                <button type="button" onClick={() => navigate('/stream')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold mb-1">
                    Steel Member Design
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Powered by Rust API | AISC 360-16 &amp; IS 800
                </p>
            </header>

            {/* Configuration Panel */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-lg mb-8 border border-slate-200 dark:border-slate-700">
                <h3 className="mb-5 font-semibold">Design Parameters</h3>
                
                <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-5">
                    <div>
                        <label htmlFor="steel-design-code" className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            Design Code:
                        </label>
                        <select
                            id="steel-design-code"
                            value={designCode}
                            onChange={(e) => setDesignCode(e.target.value as 'AISC360' | 'IS800')}
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-colors"
                        >
                            <option value="AISC360">AISC 360-16 (USA)</option>
                            <option value="IS800">IS 800:2007 (India)</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="steel-member" className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            Member:
                        </label>
                        <select
                            id="steel-member"
                            value={selectedMember}
                            onChange={(e) => setSelectedMember(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-colors"
                        >
                            <option value="">All Members</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.id} ({m.sectionId})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="steel-unbraced-length" className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            Unbraced Length (mm):
                        </label>
                        <input
                            id="steel-unbraced-length"
                            type="number"
                            value={params.Lb}
                            onChange={(e) => setParams({ ...params, Lb: parseFloat(e.target.value) || 3000 })}
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-colors"
                        />
                    </div>

                    <div>
                        <label htmlFor="steel-kx" className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            Kx (Effective Length Factor):
                        </label>
                        <input
                            id="steel-kx"
                            type="number"
                            step="0.1"
                            value={params.Kx}
                            onChange={(e) => setParams({ ...params, Kx: parseFloat(e.target.value) || 1.0 })}
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-colors"
                        />
                    </div>

                    <div>
                        <label htmlFor="steel-ky" className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            Ky (Effective Length Factor):
                        </label>
                        <input
                            id="steel-ky"
                            type="number"
                            step="0.1"
                            value={params.Ky}
                            onChange={(e) => setParams({ ...params, Ky: parseFloat(e.target.value) || 1.0 })}
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-colors"
                        />
                    </div>

                    <div>
                        <label htmlFor="steel-cb" className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            Cb (LTB Modifier):
                        </label>
                        <input
                            id="steel-cb"
                            type="number"
                            step="0.1"
                            value={params.Cb}
                            onChange={(e) => setParams({ ...params, Cb: parseFloat(e.target.value) || 1.0 })}
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-colors"
                        />
                    </div>
                </div>

                <button type="button"
                    onClick={handleRunDesign}
                    disabled={analyzing || members.length === 0}
                    className="mt-5 py-3 px-8 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 text-white rounded text-base font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                    {analyzing ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Running Design Checks...
                        </>
                    ) : (
                        <>
                            <Play size={18} />
                            Run Steel Design
                        </>
                    )}
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg mb-5 flex items-center gap-2.5 text-red-600 dark:text-red-400">
                    <AlertTriangle size={18} />
                    <span><strong>Error:</strong> {error}</span>
                </div>
            )}

            {/* Results Display */}
            {results.length > 0 ? (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <h3 className="mb-5 font-semibold">Design Check Results</h3>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b-2 border-slate-300 dark:border-slate-600">
                                    <th className="p-3 text-left">Member</th>
                                    <th className="p-3 text-left">Section</th>
                                    <th className="p-3 text-center">Status</th>
                                    <th className="p-3 text-right">Critical Ratio</th>
                                    <th className="p-3 text-left">Governing Check</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((result, idx) => {
                                    const statusColor = 
                                        result.overallStatus === 'PASS' ? '#4caf50' :
                                        result.overallStatus === 'WARNING' ? '#ff9800' : '#f44336';
                                    
                                    const statusIcon = 
                                        result.overallStatus === 'PASS' ? '✓' :
                                        result.overallStatus === 'WARNING' ? '⚠️' : '✗';

                                    return (
                                        <tr key={idx} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="p-3">{result.memberId}</td>
                                            <td className="p-3 text-blue-600 dark:text-blue-400 font-medium">
                                                {result.section.name}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="py-1 px-3 rounded text-xs" style={{ 
                                                    background: statusColor, 
                                                }}>
                                                    {statusIcon} {result.overallStatus}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-bold">
                                                <span className={result.criticalRatio > 1.0 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}>
                                                {(result.criticalRatio * 100).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm">
                                                {result.governingCheck || 'N/A'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Statistics */}
                    <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">Total Members</div>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                                {results.length}
                            </div>
                        </div>
                        
                        <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">Passing</div>
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                {results.filter(r => r.overallStatus === 'PASS').length}
                            </div>
                        </div>
                        
                        <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">Warning</div>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                                {results.filter(r => r.overallStatus === 'WARNING').length}
                            </div>
                        </div>
                        
                        <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">Failing</div>
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                                {results.filter(r => r.overallStatus === 'FAIL').length}
                            </div>
                        </div>
                    </div>
                </div>
            ) : !analyzing && (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Box size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No Design Results</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                            {members.length === 0 
                                ? 'Add structural members to your model first, then run structural analysis before performing design checks.'
                                : !store.analysisResults
                                    ? 'Run structural analysis first to compute member forces, then click "Run Steel Design" to check all members.'
                                    : 'Click "Run Steel Design" above to perform AISC 360-16 / IS 800 design checks on all members.'}
                        </p>
                        {members.length > 0 && store.analysisResults && (
                            <button 
                                type="button"
                                onClick={handleRunDesign}
                                className="mt-4 py-2 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                <Play size={16} />
                                Run Steel Design
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Info Section */}
            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg text-sm">
                <strong className="text-blue-700 dark:text-blue-400">About Steel Design</strong>
                <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">
                    This module performs comprehensive steel member design checks according to {designCode} standards.
                    All checks (tension, compression, flexure, shear, combined forces) are performed locally and 
                    validated using the Rust API for 10x faster computation. Ensure you have run structural analysis
                    first to obtain member forces.
                </p>
            </div>
        </div>
    );
}
