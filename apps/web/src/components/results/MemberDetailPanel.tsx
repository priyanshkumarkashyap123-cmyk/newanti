/**
 * MemberDetailPanel - Detailed Member Analysis View
 * 
 * Shows comprehensive member analysis results:
 * - Interactive force diagrams (SFD, BMD, AFD)
 * - Design checks with utilization ratios
 * - Reinforcement design for concrete members
 * - Critical section identification
 */

import React, { FC, useState, useMemo, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { ForceDiagramRenderer, MemberDiagramData, DiagramConfig, SupportType } from '../diagrams/ForceDiagramRenderer';
import { ForcePoint } from '../../utils/MemberForcesCalculator';
import { MemberDesignService, DesignInput, DesignResult } from '../../services/MemberDesignService';

// ============================================
// TYPES
// ============================================

export interface MemberForceData {
    axial: number;
    shearY: number;
    shearZ: number;
    momentY: number;
    momentZ: number;
    torsion: number;
    diagramData?: {
        x_values: number[];
        shear_y: number[];
        shear_z: number[];
        moment_y: number[];
        moment_z: number[];
        axial: number[];
        torsion: number[];
        deflection_y: number[];
        deflection_z: number[];
    };
}

interface MemberDetailPanelProps {
    memberId: string;
    memberForces: MemberForceData;
    memberLength?: number;
    sectionId?: string;
    material?: 'steel' | 'concrete';
    /** Actual section properties from model — if provided, design uses them instead of defaults */
    sectionProps?: {
        A?: number;       // Cross-section area (m²)
        I?: number;       // Moment of inertia (m⁴)
        Iy?: number;      // Minor-axis MOI (m⁴)
        width?: number;   // Section width (mm)
        depth?: number;   // Section depth (mm)
        tf?: number;      // Flange thickness (mm)
        tw?: number;      // Web thickness (mm)
        fy?: number;      // Yield strength (MPa)
        sectionType?: string; // e.g. 'W', 'I', 'HSS', 'rectangular', 'circular'
    };
    /** Support condition at start and end of member */
    startSupport?: SupportType;
    endSupport?: SupportType;
    onClose?: () => void;
    onNavigate?: (direction: 'prev' | 'next') => void;
}

// ============================================
// COMPONENT
// ============================================

export const MemberDetailPanel: FC<MemberDetailPanelProps> = React.memo(({
    memberId,
    memberForces,
    memberLength = 5,
    sectionId = 'Default',
    material = 'steel',
    sectionProps,
    startSupport = 'free',
    endSupport = 'free',
    onClose,
    onNavigate
}) => {
    const [activeDiagram, setActiveDiagram] = useState<'SFD' | 'BMD' | 'AFD' | 'ALL'>('ALL');
    const [showDesign, setShowDesign] = useState(true);
    const [designCode, setDesignCode] = useState<'IS800' | 'IS456' | 'EC3' | 'AISC360'>('IS800');

    // Responsive diagram width — measured from actual container
    const diagramContainerRef = useRef<HTMLDivElement>(null);
    const [diagramWidth, setDiagramWidth] = useState(640);
    useEffect(() => {
        const el = diagramContainerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                // Subtract 32px for p-4 horizontal padding (16px each side)
                setDiagramWidth(Math.max(320, Math.floor(entry.contentRect.width) - 32));
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Convert to diagram data
    const diagramData = useMemo((): MemberDiagramData | null => {
        const dd = memberForces.diagramData;
        if (!dd?.x_values) return null;

        const forcePoints: ForcePoint[] = dd.x_values.map((x, i) => ({
            x,
            Mz: dd.moment_z?.[i] ?? 0,
            Fy: dd.shear_y?.[i] ?? 0,
            My: dd.moment_y?.[i] ?? 0,
            Fz: dd.shear_z?.[i] ?? 0,
            Fx: dd.axial?.[i] ?? 0,
            Tx: dd.torsion?.[i] ?? 0,
        }));

        const shearValues = forcePoints.map(p => Math.max(Math.abs(p.Fy), Math.abs(p.Fz ?? 0)));
        const momentValues = forcePoints.map(p => Math.max(Math.abs(p.Mz), Math.abs(p.My ?? 0)));
        const axialValues = forcePoints.map(p => p.Fx ?? 0);

        const length = dd.x_values[dd.x_values.length - 1] ?? memberLength ?? 1;

        return {
            memberId,
            length,
            startNode: { x: 0, y: 0, z: 0 },
            endNode: { x: length, y: 0, z: 0 },
            forcePoints,
            maxValues: {
                shear: Math.max(...shearValues, 0.01),
                moment: Math.max(...momentValues, 0.01),
                axial: Math.max(...axialValues.map(Math.abs), 0.01),
            },
            minValues: {
                shear: 0,
                moment: 0,
                axial: Math.min(...axialValues, 0),
            },
            startSupport,
            endSupport,
        };
    }, [memberForces, memberId, memberLength, startSupport, endSupport]);

    // Section Cut Query - state and interpolation
    const [sectionCutPosition, setSectionCutPosition] = useState(0.5); // 0 to 1 ratio
    const [showSectionCut, setShowSectionCut] = useState(true);

    const sectionCutForces = useMemo(() => {
        const dd = memberForces.diagramData;
        if (!dd?.x_values || dd.x_values.length < 2) return null;

        const length = dd.x_values[dd.x_values.length - 1] || memberLength;
        const x = sectionCutPosition * length;

        // Find bounding indices for interpolation
        let i = 0;
        while (i < dd.x_values.length - 1 && dd.x_values[i + 1] < x) i++;

        const x1 = dd.x_values[i] || 0;
        const x2 = dd.x_values[i + 1] || x1;
        const t = x2 !== x1 ? (x - x1) / (x2 - x1) : 0;

        // Linear interpolation helper
        const lerp = (arr: number[] | undefined, idx: number): number => {
            if (!arr || arr.length === 0) return 0;
            const v1 = arr[idx] ?? 0;
            const v2 = arr[idx + 1] ?? v1;
            return v1 + t * (v2 - v1);
        };

        return {
            x: x,
            shearY: lerp(dd.shear_y, i),
            shearZ: lerp(dd.shear_z, i),
            momentY: lerp(dd.moment_y, i),
            momentZ: lerp(dd.moment_z, i),
            axial: lerp(dd.axial, i),
            torsion: lerp(dd.torsion, i),
            deflectionY: lerp(dd.deflection_y, i),
            deflectionZ: lerp(dd.deflection_z, i),
        };
    }, [memberForces.diagramData, sectionCutPosition, memberLength]);

    // Design results — uses actual section properties when available
    const designResult = useMemo((): DesignResult => {
        // Derive section dimensions from actual properties
        const sp = sectionProps;
        const actualWidth = sp?.width ?? (sp?.A ? Math.round(Math.sqrt(sp.A * 1e6) * 0.5) : 200); // mm
        const actualDepth = sp?.depth ?? (sp?.A && sp?.I 
            ? Math.round(Math.sqrt(12 * sp.I / sp.A) * 1000)  // d ≈ sqrt(12*I/A), m→mm
            : 400); // mm
        const actualFy = sp?.fy ?? 250;

        // Infer section type
        let sectionType: 'rectangular' | 'circular' | 'I-section' = 'rectangular';
        const st = sp?.sectionType?.toLowerCase() ?? '';
        if (st.includes('circ') || st.includes('pipe') || st.includes('chs')) {
            sectionType = 'circular';
        } else if (st.includes('i') || st.includes('w') || st.includes('hss') || st.includes('ismb') || st.includes('ismc')) {
            sectionType = 'I-section';
        }

        const input: DesignInput = {
            memberId,
            memberType: 'beam',
            material: material === 'steel' ? {
                type: 'steel',
                grade: actualFy >= 345 ? 'Fe345' : actualFy >= 300 ? 'Fe300' : 'Fe250',
                fy: actualFy,
                fu: actualFy >= 345 ? 490 : actualFy >= 300 ? 440 : 410,
                Es: 200,
            } : {
                type: 'concrete',
                grade: 'M25',
                fck: 25,
                fy: 415,
            },
            section: {
                type: sectionType as any,
                width: actualWidth,
                depth: actualDepth,
                ...(sp?.tf ? { flangeThickness: sp.tf } : {}),
                ...(sp?.tw ? { webThickness: sp.tw } : {}),
            },
            forces: memberForces,
            geometry: {
                length: memberLength,
                kFactor: 1.0,
                laterallyBraced: true,
            },
            code: designCode as 'IS800' | 'IS456' | 'EC3' | 'AISC360',
        };

        return MemberDesignService.design(input);
    }, [memberForces, memberId, memberLength, material, designCode, sectionProps]);

    // Diagram config
    const getConfig = (type: 'SFD' | 'BMD' | 'AFD' | 'ALL'): Partial<DiagramConfig> => ({
        showShear: type === 'SFD' || type === 'ALL',
        showMoment: type === 'BMD' || type === 'ALL',
        showAxial: type === 'AFD' || type === 'ALL',
        showTorsion: false,
        showGrid: true,
        showValues: true,
        colorScheme: 'engineering',
        scale: 1,
    });

    // Status colors
    const getStatusColor = (status: 'PASS' | 'FAIL' | 'WARNING') => {
        switch (status) {
            case 'PASS': return { bg: 'bg-[#4edea3]/10', text: 'text-[#4edea3]', border: 'border-[#4edea3]/30', fill: 'bg-[#4edea3]' };
            case 'FAIL': return { bg: 'bg-[#ff516a]/10', text: 'text-[#ff516a]', border: 'border-[#ff516a]/30', fill: 'bg-[#ff516a]' };
            case 'WARNING': return { bg: 'bg-[#ffb2b7]/10', text: 'text-[#ffb2b7]', border: 'border-[#ffb2b7]/30', fill: 'bg-[#ffb2b7]' };
        }
    };

    return (
        <div className="flex flex-col h-full w-full min-w-0 bg-[#0b1326] text-[#dae2fd] border border-[#424754]/30 overflow-hidden font-['Inter']">
            
            {/* Header Area */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#424754]/30 bg-[#131b2e] shrink-0">
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <button type="button" 
                            onClick={() => onNavigate?.('prev')}
                            className="p-1.5 rounded-lg hover:bg-[#222a3d] text-[#8c909f] hover:text-[#dae2fd] transition-colors border border-transparent hover:border-[#424754]/50"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl font-['Manrope'] font-extrabold tracking-tight text-[#dae2fd]">
                            Member {memberId} <span className="text-[#424754] font-normal mx-1">/</span> <span className="text-[#adc6ff]">Design Analysis</span>
                        </h1>
                        <button type="button" 
                            onClick={() => onNavigate?.('next')}
                            className="p-1.5 rounded-lg hover:bg-[#222a3d] text-[#8c909f] hover:text-[#dae2fd] transition-colors border border-transparent hover:border-[#424754]/50"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-[#8c909f] text-sm mt-1 ml-11">
                        {sectionId} • Span Length: {memberLength.toFixed(2)}m
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select 
                        value={designCode}
                        onChange={(e) => setDesignCode(e.target.value as any)}
                        className="px-4 py-2 text-sm bg-[#060e20] text-[#dae2fd] border border-[#424754]/30 rounded-lg focus:outline-none focus:border-[#adc6ff]/50 focus:ring-1 focus:ring-[#adc6ff] transition-all"
                    >
                        <option value="IS800">IS 800:2007</option>
                        <option value="IS456">IS 456:2000</option>
                        <option value="EC3">Eurocode 3</option>
                        <option value="AISC360">AISC 360</option>
                    </select>
                    <button type="button" className="bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-[#424754]/30 flex items-center gap-2 shadow-sm">
                        <Download className="w-4 h-4" /> Generate PDF
                    </button>
                    <button type="button" onClick={onClose} aria-label="Close" title="Close" className="p-2 ml-2 rounded-lg hover:bg-[#ff516a]/10 text-[#8c909f] hover:text-[#ff516a] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Design Status Banner */}
            <div className={`flex items-center justify-between px-6 py-3 border-b border-[#424754]/30 shadow-sm z-10 ${getStatusColor(designResult.overallStatus).bg}`}>
                <div className="flex items-center gap-3">
                    {designResult.overallStatus === 'PASS' ? (
                        <CheckCircle className={`w-5 h-5 ${getStatusColor(designResult.overallStatus).text}`} />
                    ) : (
                        <AlertTriangle className={`w-5 h-5 ${getStatusColor(designResult.overallStatus).text}`} />
                    )}
                    <span className={`font-bold font-['Manrope'] tracking-wide ${getStatusColor(designResult.overallStatus).text}`}>
                        {designResult.overallStatus === 'PASS' ? 'STRUCTURAL DESIGN OK' : 
                            designResult.overallStatus === 'WARNING' ? 'CHECK REQUIRED' : 'DESIGN FAILED'}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-[#dae2fd]">Maximum Utilization Profile:</span>
                    <strong className={`font-mono text-xl ${getStatusColor(designResult.overallStatus).text}`}>
                        {(designResult.overallUtilization * 100).toFixed(1)}%
                    </strong>
                </div>
            </div>

            {/* Scrollable Bento Grid Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#0b1326] space-y-6">
                
                {/* Visual Analysis Matrix */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Col: Analysis Cards */}
                    <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
                        
                        {/* Summary & Force Parameters */}
                        <section className="bg-[#131b2e] rounded-xl p-6 border border-[#424754]/20 shadow-sm hover:border-[#424754]/50 transition-colors">
                            <div className="flex items-center gap-2 mb-6">
                                <h3 className="font-['Manrope'] font-bold text-sm tracking-widest text-[#8c909f] uppercase mb-0">
                                    Force Parameters
                                </h3>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { label: 'Axial Load (Fx)', value: memberForces.axial, unit: 'kN', c: memberForces.axial > 0 ? 'text-[#4edea3]' : 'text-[#ff516a]' },
                                    { label: 'Shear Force Y (Vy)', value: memberForces.shearY, unit: 'kN', c: 'text-[#adc6ff]' },
                                    { label: 'Shear Force Z (Vz)', value: memberForces.shearZ, unit: 'kN', c: 'text-[#adc6ff]' },
                                    { label: 'Design Moment (My)', value: memberForces.momentY, unit: 'kN·m', c: 'text-[#d8e2ff]' },
                                    { label: 'Design Moment (Mz)', value: memberForces.momentZ, unit: 'kN·m', c: 'text-[#d8e2ff]' },
                                    { label: 'Torsion (Tx)', value: memberForces.torsion, unit: 'kN·m', c: 'text-[#ffb2b7]' }
                                ].map(item => (
                                    <div key={item.label} className="flex justify-between items-baseline group border-b border-[#424754]/20 pb-2">
                                        <span className="text-[#dae2fd] text-sm font-medium">{item.label}</span>
                                        <span className={`font-mono font-bold text-lg ${item.c}`}>
                                            {item.value.toFixed(2)} <span className="text-xs font-normal text-[#8c909f] ml-1">{item.unit}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Section Cut Query */}
                        {showSectionCut && sectionCutForces && (
                            <section className="bg-[#00285d]/20 relative rounded-xl p-6 border border-[#4d8eff]/30 shadow-inner overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#4d8eff]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="font-['Manrope'] font-bold text-sm tracking-widest text-[#adc6ff] uppercase flex items-center gap-2 relative z-10">
                                        Position Query
                                    </h3>
                                    <button type="button" onClick={() => setShowSectionCut(false)} className="text-[10px] text-[#8c909f] hover:text-[#dae2fd] uppercase font-bold tracking-wider relative z-10">
                                        Hide
                                    </button>
                                </div>

                                <div className="mb-6 relative z-10">
                                    <div className="flex items-center justify-between mb-3 leading-none">
                                        <label className="text-xs text-[#8c909f] font-bold uppercase tracking-wider">Length Ratio</label>
                                        <span className="text-base font-mono text-[#adc6ff] font-bold bg-[#131b2e] px-2 py-0.5 rounded border border-[#4d8eff]/30">
                                            x = {sectionCutForces.x.toFixed(3)}m
                                        </span>
                                    </div>
                                    <input 
                                        type="range"
                                        min="0" 
                                        max="1" 
                                        step="0.01"
                                        value={sectionCutPosition}
                                        onChange={(e) => setSectionCutPosition(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-[#424754]/50 rounded-lg appearance-none cursor-pointer accent-[#adc6ff]"
                                    />
                                    <div className="flex justify-between text-[11px] text-[#8c909f] mt-3 font-mono font-medium">
                                        <span>0.0m</span>
                                        <span>{(memberLength/2).toFixed(2)}m</span>
                                        <span>{memberLength.toFixed(2)}m</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 relative z-10">
                                    {[
                                        { label: 'Shear Z', value: sectionCutForces.shearZ, unit: 'kN', color: 'text-[#adc6ff]' },
                                        { label: 'Moment Y', value: sectionCutForces.momentY, unit: 'kN·m', color: 'text-[#d8e2ff]' },
                                        { label: 'Deflection Y', value: sectionCutForces.deflectionY, unit: 'mm', color: 'text-[#4edea3]' },
                                        { label: 'Deflection Z', value: sectionCutForces.deflectionZ, unit: 'mm', color: 'text-[#4edea3]' }
                                    ].map(item => (
                                        <div key={item.label} className="bg-[#0b1326]/80 rounded-lg border border-[#424754]/30 p-3 hover:border-[#adc6ff]/50 transition-colors">
                                            <div className="text-[10px] text-[#8c909f] mb-1 font-bold uppercase tracking-widest">{item.label}</div>
                                            <div className={`text-base font-bold font-mono ${item.color}`}>
                                                {item.value.toFixed(3)} <span className="text-[10px] font-normal text-[#8c909f]">{item.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Right Col: Diagrams */}
                    <div className="col-span-12 xl:col-span-8 flex flex-col gap-6">
                        
                        {/* Diagrams Section */}
                        {diagramData && (
                            <section ref={diagramContainerRef} className="bg-[#131b2e] rounded-xl p-6 border border-[#424754]/20 shadow-sm flex-1 min-h-[400px] flex flex-col bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#131b2e] via-[#0b1326] to-[#0b1326] relative overflow-hidden">
                                <div className="flex items-center justify-between mb-6 relative z-10">
                                    <h3 className="font-['Manrope'] font-bold text-sm tracking-widest text-[#8c909f] uppercase flex items-center gap-2">
                                        Force Diagrams
                                    </h3>
                                    <div className="flex bg-[#0b1326] rounded-lg border border-[#424754]/30 p-1">
                                        {(['ALL', 'SFD', 'BMD', 'AFD'] as const).map(type => (
                                            <button type="button" 
                                                key={type}
                                                onClick={() => setActiveDiagram(type)}
                                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeDiagram === type 
                                                    ? 'bg-[#222a3d] text-[#adc6ff] shadow-sm border border-[#424754]/50' 
                                                    : 'text-[#8c909f] hover:text-[#dae2fd] hover:bg-[#131b2e] border border-transparent'
                                                }`}
                                            >
                                                {type === 'ALL' ? 'Combined' : type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1 bg-transparent rounded-lg border border-[#424754]/30 p-4 relative z-10 flex items-center justify-center min-h-[300px] hover:border-[#adc6ff]/30 transition-colors backdrop-blur-sm">
                                    <ForceDiagramRenderer 
                                        memberData={diagramData} 
                                        config={{...getConfig(activeDiagram), colorScheme: 'dark', scale: 1.12}} 
                                        width={diagramWidth - 32} // padding offset
                                        height={activeDiagram === 'ALL' ? 400 : 300} 
                                    />
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                {/* Bottom Row - Calculation Matrix */}
                {showDesign && (
                    <section className="bg-[#131b2e] rounded-xl p-6 border border-[#424754]/20 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-['Manrope'] font-bold text-sm tracking-widest text-[#dae2fd] uppercase">
                                Calculation Matrix <span className="text-[#8c909f] font-normal mx-2">|</span> <span className="text-[#adc6ff]">Governing Code Checks</span>
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {designResult.checks.map((check) => (
                                <div key={check.name} className="bg-[#0b1326] p-5 rounded-xl border border-[#424754]/30 hover:border-[#424754]/60 transition-colors relative overflow-hidden group">
                                    {/* Sub-status Indicator Strip */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getStatusColor(check.status).fill}`} />
                                    
                                    <div className="pl-3">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="text-base font-bold text-[#dae2fd] mb-1">{check.name}</h4>
                                                <p className="text-xs text-[#8c909f] leading-snug break-words max-w-[90%]">{check.description}</p>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded bg-[#131b2e] uppercase tracking-wider border ${getStatusColor(check.status).text} ${getStatusColor(check.status).border}`}>
                                                {check.status}
                                            </span>
                                        </div>

                                        <div className="mt-5 flex items-end justify-between">
                                            {check.formula ? (
                                                <div className="px-3 py-1.5 bg-[#131b2e] rounded border border-[#424754]/30 text-xs font-mono text-[#adc6ff] font-medium">
                                                    {check.formula}
                                                </div>
                                            ) : <div/> }

                                            <div className="flex flex-col items-end gap-1.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-32 h-2.5 bg-[#222a3d] rounded-full overflow-hidden border border-[#424754]/30">
                                                        <div 
                                                            className={`h-full rounded-full transition-all ${
                                                                check.utilization <= 0.6 ? 'bg-[#4edea3]' : 
                                                                check.utilization <= 0.8 ? 'bg-[#00a572]' : 
                                                                check.utilization <= 0.9 ? 'bg-[#ffb2b7]' : 
                                                                'bg-[#ff516a]'
                                                            }`}
                                                            style={{ width: `${Math.min(check.utilization * 100, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-base font-bold font-mono w-14 text-right ${
                                                        check.utilization <= 0.8 ? 'text-[#4edea3]' : 
                                                        check.utilization <= 0.9 ? 'text-[#ffb2b7]' : 'text-[#ff516a]'
                                                    }`}>
                                                        {(check.utilization * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-[#8c909f] uppercase tracking-widest font-bold">Utilization</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Concrete Reinforcement Detail Card */}
                {designResult.reinforcement && (
                    <section className="bg-[#131b2e] rounded-xl p-6 border border-[#424754]/20 shadow-sm relative overflow-hidden">
                        <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#adc6ff]/5 rounded-full blur-3xl pointer-events-none"></div>
                        <h3 className="font-['Manrope'] font-bold text-sm tracking-widest text-[#dae2fd] uppercase mb-5 relative z-10">
                            Reinforcement Detailing
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 relative z-10">
                            <div className="bg-[#0b1326] p-6 rounded-xl border border-[#424754]/30 shadow-inner group transition-colors hover:border-[#adc6ff]/50">
                                <div className="text-xs font-bold text-[#8c909f] uppercase tracking-widest mb-3">Main Tensile Steel</div>
                                <div className="text-3xl font-bold font-mono text-[#adc6ff] mb-3 pb-3 border-b border-[#424754]/30">
                                    {designResult.reinforcement.mainBars.count} <span className="text-[#8c909f] text-xl px-1">+×</span> Ø{designResult.reinforcement.mainBars.diameter}
                                </div>
                                <div className="text-sm text-[#8c909f] font-medium flex justify-between items-center">
                                    <span>Area Required: <span className="text-[#dae2fd] font-bold">{designResult.reinforcement.mainBars.area.toFixed(0)} mm²</span></span>
                                    <span className="px-2 py-1 bg-[#222a3d] border border-[#424754]/30 rounded text-xs text-[#d8e2ff] font-bold shadow-sm">
                                        ρ = {designResult.reinforcement.mainBars.ratio.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                            <div className="bg-[#0b1326] p-6 rounded-xl border border-[#424754]/30 shadow-inner group transition-colors hover:border-[#adc6ff]/50">
                                <div className="text-xs font-bold text-[#8c909f] uppercase tracking-widest mb-3">Transverse Stirrups</div>
                                <div className="text-3xl font-bold font-mono text-[#d8e2ff] mb-3 pb-3 border-b border-[#424754]/30">
                                    Ø{designResult.reinforcement.stirrups.diameter} <span className="text-[#8c909f] text-xl font-sans px-1">@</span> {designResult.reinforcement.stirrups.spacing}mm
                                </div>
                                <div className="text-sm text-[#dae2fd] font-medium">
                                    {designResult.reinforcement.stirrups.legs}-legged shear ties
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* AI / Insight Recommendations */}
                {designResult.recommendations && designResult.recommendations.length > 0 && (
                    <section className="bg-gradient-to-br from-[#00285d]/30 to-[#0b1326] border border-[#4d8eff]/30 rounded-xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-['Manrope'] font-bold text-sm tracking-widest text-[#adc6ff] uppercase flex items-center gap-2">
                                Structural Insights &amp; Weight Optimization
                            </h3>
                        </div>
                        <ul className="space-y-3">
                            {designResult.recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-3 bg-[#131b2e]/60 p-4 rounded-lg border border-[#4d8eff]/20 hover:border-[#4d8eff]/40 transition-colors">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#4d8eff] mt-2 flex-shrink-0 shadow-[0_0_8px_#4d8eff]" />
                                    <span className="text-sm font-medium text-[#dae2fd] leading-relaxed">{rec}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

            </div>
        </div>
    );
});

(MemberDetailPanel as unknown as { displayName: string }).displayName = 'MemberDetailPanel';

export default MemberDetailPanel;
