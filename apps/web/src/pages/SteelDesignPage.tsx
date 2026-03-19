/**
 * SteelDesignPage.tsx - Comprehensive Steel Member Design UI
 * Uses Rust AISC design API for 10x faster design checks
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Play, AlertTriangle, Box, ArrowLeft, CheckCircle2, XCircle, Download } from 'lucide-react';
import { useToast } from '../components/ui/ToastSystem';
import { FieldLabel } from '../components/ui/FieldLabel';
import { Button } from '../components/ui/button';
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
import { exportRowsToCsv, exportObjectToPdf } from '../utils/designExport';
import { motion, AnimatePresence } from 'framer-motion';
import { SteelSectionPreview } from '../components/design/SteelSectionPreview';

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

    const resultSummary = useMemo(() => {
        const passing = results.filter((r) => r.overallStatus === 'PASS').length;
        const warning = results.filter((r) => r.overallStatus === 'WARNING').length;
        const failing = results.filter((r) => r.overallStatus === 'FAIL').length;
        return { passing, warning, failing };
    }, [results]);

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

    const handleExportCsv = () => {
        if (!results.length) return;
        const rows = results.map((r) => ({
            memberId: r.memberId,
            section: r.section.name,
            overallStatus: r.overallStatus,
            criticalRatio: Number(r.criticalRatio.toFixed(4)),
            governingCheck: r.governingCheck,
            code: designCode,
        }));
        exportRowsToCsv(`steel_design_${new Date().toISOString().slice(0, 10)}.csv`, rows);
    };

    const handleExportPdf = async () => {
        if (!results.length) return;
        await exportObjectToPdf(
            `steel_design_${new Date().toISOString().slice(0, 10)}.pdf`,
            'Steel Design Results',
            {
                code: designCode,
                summary: resultSummary,
                generatedAt: new Date().toISOString(),
                results,
            },
        );
    };

    const renderUtilizationGauge = (ratio: number) => {
        const percentage = Math.min(ratio * 100, 100);
        const color = ratio > 1.0 ? 'text-rose-500' : ratio > 0.8 ? 'text-amber-500' : 'text-emerald-500';
        const strokeColor = ratio > 1.0 ? '#f43f5e' : ratio > 0.8 ? '#f59e0b' : '#10b981';
        
        return (
            <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-200 dark:text-slate-800" />
                    <motion.circle 
                        cx="32" cy="32" r="28" stroke={strokeColor} strokeWidth="4" fill="transparent" 
                        strokeDasharray={175.9}
                        initial={{ strokeDashoffset: 175.9 }}
                        animate={{ strokeDashoffset: 175.9 - (175.9 * percentage) / 100 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                </svg>
                <span className={`absolute text-[10px] font-black ${color}`}>
                    {percentage.toFixed(0)}%
                </span>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white pb-12">
            <header className="border-b border-slate-200 dark:border-white/[0.08] bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <button type="button" onClick={() => navigate('/stream')} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-500 transition-colors mb-1 uppercase tracking-widest">
                            <ArrowLeft className="w-3 h-3" /> Dashboard
                        </button>
                        <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                            Steel Design Suite
                        </h1>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Button 
                            onClick={handleRunDesign} 
                            disabled={analyzing || members.length === 0}
                            className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                        >
                            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                            {analyzing ? 'Checking...' : 'Run Analysis'}
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Configuration */}
                    <div className="lg:col-span-1 space-y-6">
                        <section className="bg-white dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-sm">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 dark:border-white/[0.05] pb-3">
                                Structural Context
                            </h3>
                            
                            <div className="space-y-4">
                                <Select
                                    label="Regulatory Code"
                                    value={designCode}
                                    onChange={(v) => setDesignCode(v as 'AISC360' | 'IS800')}
                                    options={[
                                        { value: 'AISC360', label: 'AISC 360-16 (LRFD)' },
                                        { value: 'IS800', label: 'IS 800:2007 (LSM)' }
                                    ]}
                                />
                                
                                <Select
                                    label="Target Member"
                                    value={selectedMember}
                                    onChange={(v) => setSelectedMember(v)}
                                    options={[
                                        { value: '', label: 'Batch Process (All)' },
                                        ...members.map(m => ({ value: m.id, label: `${m.id} [${m.sectionId}]` }))
                                    ]}
                                />

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-white/[0.05]">
                                    <NumberInput
                                        label="Unbraced Lb"
                                        value={params.Lb}
                                        onChange={(v) => setParams({ ...params, Lb: v })}
                                        min={1}
                                    />
                                    <NumberInput
                                        label="Kx Factor"
                                        value={params.Kx ?? 1.0}
                                        onChange={(v) => setParams({ ...params, Kx: v })}
                                        step={0.1}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Summary Stats (Mobile/Top) */}
                        <AnimatePresence>
                        {results.length > 0 && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-3 gap-3"
                            >
                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center">
                                    <div className="text-xl font-black text-emerald-500">{resultSummary.passing}</div>
                                    <div className="text-[9px] font-bold text-emerald-600/60 uppercase tracking-widest mt-1 text-center">Safe</div>
                                </div>
                                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-center">
                                    <div className="text-xl font-black text-amber-500">{resultSummary.warning}</div>
                                    <div className="text-[9px] font-bold text-amber-600/60 uppercase tracking-widest mt-1 text-center">Warn</div>
                                </div>
                                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center">
                                    <div className="text-xl font-black text-rose-500">{resultSummary.failing}</div>
                                    <div className="text-[9px] font-bold text-rose-600/60 uppercase tracking-widest mt-1 text-center">Fail</div>
                                </div>
                            </motion.div>
                        )}
                        </AnimatePresence>
                    </div>

                    {/* Right: Results Dashboard */}
                    <div className="lg:col-span-2 space-y-6">
                        {error && (
                            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-500 text-sm font-medium">
                                <AlertTriangle className="w-4 h-4" /> {error}
                            </div>
                        )}

                        <AnimatePresence mode="wait">
                        {results.length > 0 ? (
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold flex items-center gap-2">
                                        Check Results <span className="text-xs font-normal text-slate-400">({results.length} members processed)</span>
                                    </h3>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="xs" onClick={handleExportCsv} className="h-8 text-[10px] font-bold">
                                            CSV
                                        </Button>
                                        <Button variant="outline" size="xs" onClick={() => { void handleExportPdf(); }} className="h-8 text-[10px] font-bold">
                                            PDF
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {results.map((result) => (
                                        <motion.div 
                                            key={result.memberId}
                                            whileHover={{ x: 4 }}
                                            className="group relative bg-white dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 flex items-center justify-between hover:border-blue-500/30 transition-all cursor-default"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="bg-slate-100 dark:bg-white/5 p-2 rounded-lg">
                                                   <SteelSectionPreview section={result.section} width={60} height={60} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black flex items-center gap-2">
                                                        {result.memberId}
                                                        <span className="text-[10px] text-slate-400 font-normal">[{result.section.name}]</span>
                                                    </div>
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                                        Governing: <span className="text-blue-500">{result.governingCheck}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="hidden sm:block text-right">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Critical Ratio</div>
                                                    {renderUtilizationGauge(result.criticalRatio)}
                                                </div>
                                                
                                                <div className={`p-2 rounded-full ${
                                                    result.overallStatus === 'PASS' ? 'bg-emerald-500/10 text-emerald-500' :
                                                    result.overallStatus === 'WARNING' ? 'bg-amber-500/10 text-amber-500' :
                                                    'bg-rose-500/10 text-rose-500'
                                                }`}>
                                                    {result.overallStatus === 'PASS' ? <CheckCircle2 className="w-5 h-5" /> :
                                                     result.overallStatus === 'WARNING' ? <AlertTriangle className="w-5 h-5" /> :
                                                     <XCircle className="w-5 h-5" />}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        ) : !analyzing && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="bg-white/50 dark:bg-slate-900/20 backdrop-blur-sm rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/[0.05] p-20 text-center"
                            >
                                <Box className="w-16 h-16 text-slate-300 dark:text-slate-800 mx-auto mb-6" />
                                <h3 className="text-lg font-bold text-slate-400 mb-2">Awaiting Structural Data</h3>
                                <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                                    Configure your design parameters on the left and run the design engine to compute member capacities.
                                </p>
                            </motion.div>
                        )}
                        </AnimatePresence>
                    </div>
                </div>
            </main>
        </div>
    );
}

const renderResults = () => null; // Cleanup helper
