/**
 * SteelDesignPage.tsx - Comprehensive Steel Member Design UI
 * Uses Rust AISC design API for 10x faster design checks
 */

import { useState, useEffect } from 'react';
import { Loader2, Play, AlertTriangle, Box } from 'lucide-react';
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
        <div className="steel-design-page p-5 bg-[#1e1e1e] text-white min-h-screen">
            <header className="mb-[30px]">
                <h1 className="text-[32px] mb-2.5">
                    🏗️ Steel Member Design
                </h1>
                <p className="text-[#888] text-sm">
                    ⚡ Powered by Rust API (10x faster than Python) | AISC 360-16 & IS 800
                </p>
            </header>

            {/* Configuration Panel */}
            <div className="bg-[#2d2d2d] p-5 rounded-lg mb-[30px]">
                <h3 className="mb-5">Design Parameters</h3>
                
                <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-5">
                    <div>
                        <label className="block mb-2">
                            Design Code:
                        </label>
                        <select
                            value={designCode}
                            onChange={(e) => setDesignCode(e.target.value as 'AISC360' | 'IS800')}
                            className="w-full p-2.5 bg-[#1e1e1e] text-white border border-[#444] rounded"
                        >
                            <option value="AISC360">AISC 360-16 (USA)</option>
                            <option value="IS800">IS 800:2007 (India)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block mb-2">
                            Member:
                        </label>
                        <select
                            value={selectedMember}
                            onChange={(e) => setSelectedMember(e.target.value)}
                            className="w-full p-2.5 bg-[#1e1e1e] text-white border border-[#444] rounded"
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
                        <label className="block mb-2">
                            Unbraced Length (mm):
                        </label>
                        <input
                            type="number"
                            value={params.Lb}
                            onChange={(e) => setParams({ ...params, Lb: parseFloat(e.target.value) || 3000 })}
                            className="w-full p-2.5 bg-[#1e1e1e] text-white border border-[#444] rounded"
                        />
                    </div>

                    <div>
                        <label className="block mb-2">
                            Kx (Effective Length Factor):
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={params.Kx}
                            onChange={(e) => setParams({ ...params, Kx: parseFloat(e.target.value) || 1.0 })}
                            className="w-full p-2.5 bg-[#1e1e1e] text-white border border-[#444] rounded"
                        />
                    </div>

                    <div>
                        <label className="block mb-2">
                            Ky (Effective Length Factor):
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={params.Ky}
                            onChange={(e) => setParams({ ...params, Ky: parseFloat(e.target.value) || 1.0 })}
                            className="w-full p-2.5 bg-[#1e1e1e] text-white border border-[#444] rounded"
                        />
                    </div>

                    <div>
                        <label className="block mb-2">
                            Cb (LTB Modifier):
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={params.Cb}
                            onChange={(e) => setParams({ ...params, Cb: parseFloat(e.target.value) || 1.0 })}
                            className="w-full p-2.5 bg-[#1e1e1e] text-white border border-[#444] rounded"
                        />
                    </div>
                </div>

                <button type="button"
                    onClick={handleRunDesign}
                    disabled={analyzing || members.length === 0}
                    className="mt-5 py-3 px-8 text-white border-0 rounded text-base font-bold flex items-center justify-center gap-2"
                    style={{
                        background: analyzing ? '#555' : '#2196F3',
                        cursor: analyzing ? 'not-allowed' : 'pointer',
                        opacity: (analyzing || members.length === 0) ? 0.6 : 1,
                    }}
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
                <div className="p-[15px] bg-[#d32f2f22] border border-[#d32f2f] rounded-lg mb-5 flex items-center gap-2.5 text-[#ff6b6b]">
                    <AlertTriangle size={18} />
                    <span><strong>Error:</strong> {error}</span>
                </div>
            )}

            {/* Results Display */}
            {results.length > 0 ? (
                <div className="bg-[#2d2d2d] p-5 rounded-lg">
                    <h3 className="mb-5">Design Check Results</h3>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b-2 border-[#444]">
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
                                        <tr key={idx} className="border-b border-[#333]">
                                            <td className="p-3">{result.memberId}</td>
                                            <td className="p-3 text-[#4fc3f7]">
                                                {result.section.name}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="py-1 px-3 rounded text-xs" style={{ 
                                                    background: statusColor, 
                                                }}>
                                                    {statusIcon} {result.overallStatus}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-bold" style={{ 
                                                color: result.criticalRatio > 1.0 ? '#f44336' : '#4fc3f7',
                                            }}>
                                                {(result.criticalRatio * 100).toFixed(1)}%
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
                    <div className="mt-[30px] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[15px]">
                        <div className="p-5 bg-[#1e1e1e] rounded">
                            <div className="text-[#888] text-xs">TOTAL MEMBERS</div>
                            <div className="text-[28px] text-[#4fc3f7] mt-1">
                                {results.length}
                            </div>
                        </div>
                        
                        <div className="p-5 bg-[#1e1e1e] rounded">
                            <div className="text-[#888] text-xs">PASSING</div>
                            <div className="text-[28px] text-[#4caf50] mt-1">
                                {results.filter(r => r.overallStatus === 'PASS').length}
                            </div>
                        </div>
                        
                        <div className="p-5 bg-[#1e1e1e] rounded">
                            <div className="text-[#888] text-xs">WARNING</div>
                            <div className="text-[28px] text-[#ff9800] mt-1">
                                {results.filter(r => r.overallStatus === 'WARNING').length}
                            </div>
                        </div>
                        
                        <div className="p-5 bg-[#1e1e1e] rounded">
                            <div className="text-[#888] text-xs">FAILING</div>
                            <div className="text-[28px] text-[#f44336] mt-1">
                                {results.filter(r => r.overallStatus === 'FAIL').length}
                            </div>
                        </div>
                    </div>
                </div>
            ) : !analyzing && (
                <div className="bg-[#2d2d2d] p-8 rounded-lg">
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Box size={48} className="text-[#555] mb-4" />
                        <h3 className="text-lg font-semibold text-[#aaa] mb-2">No Design Results</h3>
                        <p className="text-sm text-[#777] max-w-md">
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
                                className="mt-4 py-2 px-6 bg-[#2196F3] text-white rounded text-sm font-medium hover:bg-[#1976D2] transition-colors flex items-center gap-2"
                            >
                                <Play size={16} />
                                Run Steel Design
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Info Section */}
            <div className="mt-[30px] p-[15px] bg-[#424242] rounded-lg text-sm">
                <strong>ℹ️ About Steel Design</strong>
                <p className="mt-2.5 leading-[1.6] text-[#bbb]">
                    This module performs comprehensive steel member design checks according to {designCode} standards.
                    All checks (tension, compression, flexure, shear, combined forces) are performed locally and 
                    validated using the Rust API for 10x faster computation. Ensure you have run structural analysis
                    first to obtain member forces.
                </p>
            </div>
        </div>
    );
}
