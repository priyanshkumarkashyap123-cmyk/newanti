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
import { X, ChevronLeft, ChevronRight, Download, Settings, AlertTriangle, CheckCircle } from 'lucide-react';
import { ForceDiagramRenderer, MemberDiagramData, DiagramConfig } from '../diagrams/ForceDiagramRenderer';
import { ForcePoint } from '../../utils/MemberForcesCalculator';
import { MemberDesignService, DesignInput, DesignResult, DesignCheck } from '../../services/MemberDesignService';

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
    onClose?: () => void;
    onNavigate?: (direction: 'prev' | 'next') => void;
}

// ============================================
// COMPONENT
// ============================================

export const MemberDetailPanel: FC<MemberDetailPanelProps> = ({
    memberId,
    memberForces,
    memberLength = 5,
    sectionId = 'ISMB300',
    material = 'steel',
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
            Mz: dd.moment_y?.[i] ?? 0,
            Fy: dd.shear_y?.[i] ?? 0,
            My: dd.moment_z?.[i] ?? 0,
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
        };
    }, [memberForces, memberId, memberLength]);

    // Design results
    const designResult = useMemo((): DesignResult => {
        const input: DesignInput = {
            memberId,
            memberType: 'beam',
            material: material === 'steel' ? {
                type: 'steel',
                grade: 'Fe250',
                fy: 250,
                fu: 410,
                Es: 200,
            } : {
                type: 'concrete',
                grade: 'M25',
                fck: 25,
                fy: 415,
            },
            section: {
                type: 'rectangular',
                width: 200,
                depth: 400,
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
    }, [memberForces, memberId, memberLength, material, designCode]);

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
        <div className="flex flex-col h-full bg-zinc-900 text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-zinc-800">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onNavigate?.('prev')}
                        className="p-1.5 rounded hover:bg-zinc-700 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-lg font-semibold">Member {memberId}</h2>
                        <p className="text-xs text-zinc-400">{sectionId} • L = {memberLength.toFixed(2)}m</p>
                    </div>
                    <button
                        onClick={() => onNavigate?.('next')}
                        className="p-1.5 rounded hover:bg-zinc-700 transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={designCode}
                        onChange={(e) => setDesignCode(e.target.value as any)}
                        className="px-2 py-1 text-sm bg-zinc-700 border border-zinc-600 rounded"
                    >
                        <option value="IS800">IS 800:2007</option>
                        <option value="IS456">IS 456:2000</option>
                        <option value="EC3">Eurocode 3</option>
                        <option value="AISC360">AISC 360</option>
                    </select>
                    <button className="p-1.5 rounded hover:bg-zinc-700">
                        <Download className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-zinc-700">
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
                <span className="text-sm text-zinc-300">
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
                        <button
                            key={type}
                            onClick={() => setActiveDiagram(type)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeDiagram === type
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
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
                        <div key={item.label} className="bg-zinc-800 rounded-lg p-3 text-center">
                            <div className="text-xs text-zinc-500 mb-1">{item.label}</div>
                            <div className={`text-lg font-bold font-mono ${item.color}`}>
                                {item.value.toFixed(2)}
                            </div>
                            <div className="text-xs text-zinc-600">{item.unit}</div>
                        </div>
                    ))}
                </div>

                {/* Force Diagrams */}
                {diagramData && (
                    <div className="bg-zinc-800 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-zinc-400 mb-3">
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

                {/* Design Checks */}
                {showDesign && (
                    <div className="bg-zinc-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-zinc-400">Design Checks ({designCode})</h3>
                            <button
                                onClick={() => setShowDesign(false)}
                                className="text-xs text-zinc-500 hover:text-zinc-300"
                            >
                                Hide
                            </button>
                        </div>
                        
                        <div className="space-y-2">
                            {designResult.checks.map((check) => (
                                <div
                                    key={check.name}
                                    className={`flex items-center justify-between p-3 rounded-lg bg-zinc-900 border-l-3 ${
                                        getStatusColor(check.status).border
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
                                        <div className="text-xs text-zinc-500 mt-1">{check.description}</div>
                                        {check.formula && (
                                            <div className="text-xs text-zinc-600 mt-1 font-mono">{check.formula}</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 ml-4">
                                        <div className="w-24 h-2 bg-zinc-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${
                                                    check.utilization <= 0.7 ? 'bg-green-500' :
                                                    check.utilization <= 0.9 ? 'bg-yellow-500' :
                                                    check.utilization <= 1.0 ? 'bg-orange-500' :
                                                    'bg-red-500'
                                                }`}
                                                style={{ width: `${Math.min(check.utilization * 100, 100)}%` }}
                                            />
                                        </div>
                                        <span className={`text-sm font-bold font-mono w-14 text-right ${
                                            check.utilization <= 0.7 ? 'text-green-400' :
                                            check.utilization <= 0.9 ? 'text-yellow-400' :
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
                    <div className="bg-zinc-800 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-zinc-400 mb-3">Reinforcement Design</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-900 rounded-lg p-3">
                                <div className="text-xs text-zinc-500 mb-2">Main Reinforcement</div>
                                <div className="text-lg font-bold text-blue-400">
                                    {designResult.reinforcement.mainBars.count} × Ø{designResult.reinforcement.mainBars.diameter}
                                </div>
                                <div className="text-xs text-zinc-500 mt-1">
                                    Area: {designResult.reinforcement.mainBars.area.toFixed(0)} mm² ({designResult.reinforcement.mainBars.ratio.toFixed(2)}%)
                                </div>
                            </div>
                            <div className="bg-zinc-900 rounded-lg p-3">
                                <div className="text-xs text-zinc-500 mb-2">Stirrups/Ties</div>
                                <div className="text-lg font-bold text-purple-400">
                                    Ø{designResult.reinforcement.stirrups.diameter} @ {designResult.reinforcement.stirrups.spacing}mm
                                </div>
                                <div className="text-xs text-zinc-500 mt-1">
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
                        <ul className="text-sm text-zinc-300 space-y-1">
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
};

export default MemberDetailPanel;
