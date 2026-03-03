/**
 * MemberDetailPanel - Detailed Member Analysis View
 * 
 * Shows comprehensive member analysis results:
 * - Interactive force diagrams (SFD, BMD, AFD)
 * - Design checks with utilization ratios
 * - Reinforcement design for concrete members
 * - Critical section identification
 */

import React, { FC, useState, useMemo } from 'react';
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
            case 'PASS': return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500' };
            case 'FAIL': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500' };
            case 'WARNING': return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500' };
        }
    };

    return (
        <div className="flex flex-col h-full w-[400px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xl border border-slate-200 dark:border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                <div className="flex items-center gap-3">
                    <button type="button"
                        onClick={() => onNavigate?.('prev')}
                        className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-lg font-semibold">Member {memberId}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{sectionId} • L = {memberLength.toFixed(2)}m</p>
                    </div>
                    <button type="button"
                        onClick={() => onNavigate?.('next')}
                        className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={designCode}
                        onChange={(e) => setDesignCode(e.target.value as any)}
                        className="px-2 py-1 text-sm bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded"
                    >
                        <option value="IS800">IS 800:2007</option>
                        <option value="IS456">IS 456:2000</option>
                        <option value="EC3">Eurocode 3</option>
                        <option value="AISC360">AISC 360</option>
                    </select>
                    <button type="button" aria-label="Download" title="Download" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
                        <Download className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={onClose} aria-label="Close" title="Close" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Design Status Banner */}
            <div className={`flex items-center justify-between px-4 py-2 ${getStatusColor(designResult.overallStatus).bg}`}>
                <div className="flex items-center gap-2">
                    {designResult.overallStatus === 'PASS' ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    )}
                    <span className={`font-medium ${getStatusColor(designResult.overallStatus).text}`}>
                        {designResult.overallStatus === 'PASS' ? 'Design OK' :
                            designResult.overallStatus === 'WARNING' ? 'Check Required' : 'Design Failed'}
                    </span>
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                    Max Utilization: <strong className={getStatusColor(designResult.overallStatus).text}>
                        {(designResult.overallUtilization * 100).toFixed(1)}%
                    </strong>
                </span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* Diagram Type Selector */}
                <div className="flex gap-2">
                    {(['ALL', 'SFD', 'BMD', 'AFD'] as const).map(type => (
                        <button type="button"
                            key={type}
                            onClick={() => setActiveDiagram(type)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeDiagram === type
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            {type === 'ALL' ? 'All Diagrams' : type}
                        </button>
                    ))}
                </div>

                {/* Force Summary */}
                <div className="grid grid-cols-6 gap-3">
                    {[
                        { label: 'Axial', value: memberForces.axial, unit: 'kN', color: memberForces.axial > 0 ? 'text-green-400' : 'text-red-400' },
                        { label: 'Shear Y', value: memberForces.shearY, unit: 'kN', color: 'text-blue-400' },
                        { label: 'Shear Z', value: memberForces.shearZ, unit: 'kN', color: 'text-blue-400' },
                        { label: 'Moment Y', value: memberForces.momentY, unit: 'kN·m', color: 'text-purple-400' },
                        { label: 'Moment Z', value: memberForces.momentZ, unit: 'kN·m', color: 'text-purple-400' },
                        { label: 'Torsion', value: memberForces.torsion, unit: 'kN·m', color: 'text-orange-400' },
                    ].map(item => (
                        <div key={item.label} className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-center">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{item.label}</div>
                            <div className={`text-lg font-bold font-mono ${item.color}`}>
                                {item.value.toFixed(2)}
                            </div>
                            <div className="text-xs text-slate-500">{item.unit}</div>
                        </div>
                    ))}
                </div>

                {/* Force Diagrams */}
                {diagramData && (
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                            {activeDiagram === 'ALL' ? 'Combined Force Diagrams' :
                                activeDiagram === 'SFD' ? 'Shear Force Diagram' :
                                    activeDiagram === 'BMD' ? 'Bending Moment Diagram' :
                                        'Axial Force Diagram'}
                        </h3>
                        <ForceDiagramRenderer
                            memberData={diagramData}
                            config={getConfig(activeDiagram)}
                            width={700}
                            height={activeDiagram === 'ALL' ? 350 : 250}
                        />
                    </div>
                )}

                {/* Section Cut Query */}
                {showSectionCut && sectionCutForces && (
                    <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-500/30">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-blue-400 flex items-center gap-2">
                                ✂️ Section Cut Query
                            </h3>
                            <button type="button"
                                onClick={() => setShowSectionCut(false)}
                                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                                Hide
                            </button>
                        </div>

                        {/* Position Slider */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs text-slate-500 dark:text-slate-400">Position along member</label>
                                <span className="text-sm font-mono text-blue-400">
                                    x = {sectionCutForces.x.toFixed(3)} m ({(sectionCutPosition * 100).toFixed(1)}%)
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={sectionCutPosition}
                                onChange={(e) => setSectionCutPosition(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                <span>Start (0)</span>
                                <span>Mid (L/2)</span>
                                <span>End (L)</span>
                            </div>
                        </div>

                        {/* Forces at Section */}
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                { label: 'Shear Y', value: sectionCutForces.shearY, unit: 'kN', color: 'text-blue-400' },
                                { label: 'Shear Z', value: sectionCutForces.shearZ, unit: 'kN', color: 'text-blue-400' },
                                { label: 'Moment Y', value: sectionCutForces.momentY, unit: 'kN·m', color: 'text-purple-400' },
                                { label: 'Moment Z', value: sectionCutForces.momentZ, unit: 'kN·m', color: 'text-purple-400' },
                                { label: 'Axial', value: sectionCutForces.axial, unit: 'kN', color: sectionCutForces.axial > 0 ? 'text-green-400' : 'text-red-400' },
                                { label: 'Torsion', value: sectionCutForces.torsion, unit: 'kN·m', color: 'text-orange-400' },
                                { label: 'Deflection Y', value: sectionCutForces.deflectionY, unit: 'mm', color: 'text-cyan-400' },
                                { label: 'Deflection Z', value: sectionCutForces.deflectionZ, unit: 'mm', color: 'text-cyan-400' },
                            ].map(item => (
                                <div key={item.label} className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-3 text-center">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{item.label}</div>
                                    <div className={`text-[11px] font-semibold font-sans ${item.color}`}>
                                        {item.value.toFixed(3)}
                                    </div>
                                    <div className="text-xs text-slate-500">{item.unit}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Design Checks */}
                {showDesign && (
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Design Checks ({designCode})</h3>
                            <button type="button"
                                onClick={() => setShowDesign(false)}
                                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                                Hide
                            </button>
                        </div>

                        <div className="space-y-2">
                            {designResult.checks.map((check) => (
                                <div
                                    key={check.name}
                                    className={`flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border-l-3 ${getStatusColor(check.status).border
                                        }`}
                                    style={{ borderLeftWidth: '3px' }}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{check.name}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(check.status).bg} ${getStatusColor(check.status).text}`}>
                                                {check.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{check.description}</div>
                                        {check.formula && (
                                            <div className="text-xs text-slate-500 mt-1 font-mono">{check.formula}</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 ml-4">
                                        <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                            className={`h-full rounded-full transition-all ${check.utilization <= 0.6 ? 'bg-emerald-500' :
                                                    check.utilization <= 0.7 ? 'bg-green-500' :
                                                        check.utilization <= 0.8 ? 'bg-lime-500' :
                                                            check.utilization <= 0.9 ? 'bg-amber-500' :
                                                                check.utilization <= 1.0 ? 'bg-orange-500' :
                                                                    'bg-red-500'
                                                    }`}
                                                style={{ width: `${Math.min(check.utilization * 100, 100)}%` }}
                                            />
                                        </div>
                                        <span className={`text-sm font-bold font-mono w-14 text-right ${check.utilization <= 0.6 ? 'text-emerald-400' :
                                            check.utilization <= 0.7 ? 'text-green-400' :
                                                check.utilization <= 0.8 ? 'text-lime-400' :
                                                    check.utilization <= 0.9 ? 'text-amber-400' :
                                                        check.utilization <= 1.0 ? 'text-orange-400' :
                                                            'text-red-400'
                                            }`}>
                                            {(check.utilization * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Reinforcement Design (for concrete) */}
                {designResult.reinforcement && (
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Reinforcement Design</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Main Reinforcement</div>
                                <div className="text-lg font-bold text-blue-400">
                                    {designResult.reinforcement.mainBars.count} × Ø{designResult.reinforcement.mainBars.diameter}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Area: {designResult.reinforcement.mainBars.area.toFixed(0)} mm² ({designResult.reinforcement.mainBars.ratio.toFixed(2)}%)
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-lg p-3">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Stirrups/Ties</div>
                                <div className="text-lg font-bold text-purple-400">
                                    Ø{designResult.reinforcement.stirrups.diameter} @ {designResult.reinforcement.stirrups.spacing}mm
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {designResult.reinforcement.stirrups.legs}-legged stirrups
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Recommendations */}
                {designResult.recommendations && designResult.recommendations.length > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-blue-400 mb-2">💡 Recommendations</h3>
                        <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                            {designResult.recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="text-blue-400">•</span>
                                    {rec}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
});

(MemberDetailPanel as unknown as { displayName: string }).displayName = 'MemberDetailPanel';

export default MemberDetailPanel;
