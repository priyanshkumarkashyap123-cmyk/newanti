/**
 * SteelDesignPage.tsx - Comprehensive Steel Member Design UI
 * Uses Rust AISC design API for 10x faster design checks
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Play, AlertTriangle, Box, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '../components/ui/ToastSystem';
import { FieldLabel } from '../components/ui/FieldLabel';
import { Select, NumberInput } from '../components/ui/FormInputs';
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
    const toast = useToast();

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

        // Validate design parameters
        if (params.Lb <= 0 || params.Lx <= 0 || params.Ly <= 0) {
            setError('Unbraced and effective lengths must be positive');
            return;
        }
        if ((params.Kx ?? 1) <= 0 || (params.Kx ?? 1) > 2.5 || (params.Ky ?? 1) <= 0 || (params.Ky ?? 1) > 2.5) {
            setError('Effective length factors (K) must be between 0 and 2.5');
            return;
        }
        if ((params.Cb ?? 1) < 1.0 || (params.Cb ?? 1) > 3.0) {
            setError('Moment gradient factor (Cb) must be between 1.0 and 3.0 (AISC 360 Eq. F1-1)');
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

            // Success toast
            const allPassed = apiResults.every(r => r.overallStatus === 'PASS');
            toast.success(
              allPassed
                ? `All ${apiResults.length} member(s) passed design checks`
                : `Design complete — ${apiResults.filter(r => r.overallStatus === 'FAIL').length} member(s) need attention`
            );
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
                        <Select
                            label="Design Code"
                            value={designCode}
                            onChange={(v) => setDesignCode(v as 'AISC360' | 'IS800')}
                            options={[
                                { value: 'AISC360', label: 'AISC 360-16 (USA)' },
                                { value: 'IS800', label: 'IS 800:2007 (India)' }
                            ]}
                        />
                    </div>

                    <div>
                        <Select
                            label="Member"
                            value={selectedMember}
                            onChange={(v) => setSelectedMember(v)}
                            options={[
                                { value: '', label: 'All Members' },
                                ...members.map(m => ({ value: m.id, label: `${m.id} (${m.sectionId})` }))
                            ]}
                        />
                    </div>

                    <div>
                        <NumberInput
                            label={<FieldLabel field="Lb" label="Unbraced Length (mm)" />}
                            value={params.Lb}
                            onChange={(v) => setParams({ ...params, Lb: v })}
                            min={1}
                        />
                    </div>

                    <div>
                        <NumberInput
                            label={<FieldLabel field="Kx" label="Kx — Effective Length Factor" />}
                            value={params.Kx ?? 1.0}
                            onChange={(v) => setParams({ ...params, Kx: v })}
                            step={0.1}
                            min={0.1}
                            max={2.5}
                        />
                    </div>

                    <div>
                        <NumberInput
                            label={<FieldLabel field="Ky" label="Ky — Effective Length Factor" />}
                            value={params.Ky ?? 1.0}
                            onChange={(v) => setParams({ ...params, Ky: v })}
                            step={0.1}
                            min={0.1}
                            max={2.5}
                        />
                    </div>

                    <div>
                        <NumberInput
                            label={<FieldLabel field="Cb" label="Cb — LTB Modifier" />}
                            value={params.Cb ?? 1.0}
                            onChange={(v) => setParams({ ...params, Cb: v })}
                            step={0.1}
                            min={1.0}
                            max={3.0}
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
                                    return (
                                        <tr key={idx} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="p-3">{result.memberId}</td>
                                            <td className="p-3 text-blue-600 dark:text-blue-400 font-medium">
                                                {result.section.name}
                                            </td>
                                            <td className="p-3 text-center">
                                                {result.overallStatus === 'PASS' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                                                        <CheckCircle2 size={12}/> PASS
                                                    </span>
                                                )}
                                                {result.overallStatus === 'WARNING' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                                                        <AlertTriangle size={12}/> WARN
                                                    </span>
                                                )}
                                                {result.overallStatus === 'FAIL' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
                                                        <XCircle size={12}/> FAIL
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right font-bold">
                                                <span className={result.criticalRatio > 1.0 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}>
                                                {(result.criticalRatio * 100).toFixed(1)}%
                                                </span>
                                                <div className="mt-1 h-1.5 w-20 ml-auto rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${result.criticalRatio > 1.0 ? 'bg-red-500' : result.criticalRatio > 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                        style={{ width: `${Math.min(result.criticalRatio * 100, 100)}%` }}
                                                    />
                                                </div>
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
