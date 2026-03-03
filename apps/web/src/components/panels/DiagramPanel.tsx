/**
 * DiagramPanel Component
 * 
 * Comprehensive panel for displaying structural analysis diagrams:
 * - Shear Force Diagram (SFD)
 * - Bending Moment Diagram (BMD)
 * - Axial Force Diagram (AFD)
 * - Deflection Diagram
 * - Member Design Results
 */

import React, { useState, useMemo, useCallback } from 'react';
import { ForceDiagramRenderer, MemberDiagramData, DiagramConfig } from '../diagrams/ForceDiagramRenderer';
import { ForcePoint } from '../../utils/MemberForcesCalculator';
import { MemberDesignService, DesignInput, DesignResult, DesignCheck } from '../../services/MemberDesignService';

// ============================================
// TYPES
// ============================================

interface MemberForceData {
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

interface DiagramPanelProps {
    memberForces: Record<string, MemberForceData>;
    selectedMemberId?: string;
    onMemberSelect?: (memberId: string) => void;
}

// ============================================
// STYLES
// ============================================

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column' as const,
        height: '100%',
        backgroundColor: '#0f172a',
        color: '#f1f5f9',
        fontFamily: 'Inter, system-ui, sans-serif',
    },
    header: {
        padding: '12px 16px',
        borderBottom: '1px solid rgba(71, 85, 105, 0.5)',
        backgroundColor: '#1e293b',
    },
    title: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        color: '#f8fafc',
    },
    subtitle: {
        margin: '4px 0 0 0',
        fontSize: '12px',
        color: '#94a3b8',
    },
    tabs: {
        display: 'flex',
        borderBottom: '1px solid rgba(71, 85, 105, 0.5)',
        backgroundColor: '#1e293b',
    },
    tab: {
        padding: '10px 16px',
        border: 'none',
        background: 'transparent',
        color: '#94a3b8',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderBottom: '2px solid transparent',
    },
    tabActive: {
        color: '#3b82f6',
        borderBottomColor: '#3b82f6',
    },
    content: {
        flex: 1,
        overflow: 'auto',
        padding: '16px',
    },
    memberSelector: {
        marginBottom: '16px',
    },
    select: {
        width: '100%',
        padding: '8px 12px',
        backgroundColor: '#334155',
        border: '1px solid #475569',
        borderRadius: '6px',
        color: '#f1f5f9',
        fontSize: '14px',
    },
    diagramContainer: {
        backgroundColor: '#1e293b',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
    },
    diagramTitle: {
        fontSize: '14px',
        fontWeight: 500,
        marginBottom: '12px',
        color: '#cbd5e1',
    },
    controls: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '12px',
        marginBottom: '16px',
    },
    controlGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    checkbox: {
        width: '16px',
        height: '16px',
        accentColor: '#3b82f6',
    },
    label: {
        fontSize: '13px',
        color: '#94a3b8',
    },
    designResults: {
        backgroundColor: '#1e293b',
        borderRadius: '8px',
        padding: '16px',
    },
    checkRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        marginBottom: '8px',
        backgroundColor: '#0f172a',
        borderRadius: '6px',
        borderLeft: '3px solid',
    },
    checkPass: {
        borderLeftColor: '#22c55e',
    },
    checkFail: {
        borderLeftColor: '#ef4444',
    },
    checkWarning: {
        borderLeftColor: '#f59e0b',
    },
    checkName: {
        fontWeight: 500,
        fontSize: '13px',
    },
    utilizationBar: {
        width: '100px',
        height: '6px',
        backgroundColor: '#334155',
        borderRadius: '3px',
        overflow: 'hidden',
        marginRight: '10px',
    },
    utilizationFill: {
        height: '100%',
        borderRadius: '3px',
        transition: 'width 0.3s',
    },
    utilizationText: {
        fontSize: '12px',
        fontWeight: 600,
        minWidth: '45px',
        textAlign: 'right' as const,
    },
    overallStatus: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        backgroundColor: '#0f172a',
        borderRadius: '8px',
        marginBottom: '16px',
    },
    statusBadge: {
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
    },
    forceTable: {
        width: '100%',
        borderCollapse: 'collapse' as const,
        marginTop: '12px',
    },
    tableHeader: {
        textAlign: 'left' as const,
        padding: '8px 12px',
        backgroundColor: '#0f172a',
        fontSize: '12px',
        color: '#94a3b8',
        fontWeight: 500,
    },
    tableCell: {
        padding: '10px 12px',
        borderBottom: '1px solid rgba(71, 85, 105, 0.5)',
        fontSize: '13px',
    },
    noData: {
        textAlign: 'center' as const,
        padding: '40px',
        color: '#64748b',
    },
};

// ============================================
// COMPONENT
// ============================================

export const DiagramPanel: React.FC<DiagramPanelProps> = React.memo(({
    memberForces,
    selectedMemberId: externalSelectedId,
    onMemberSelect,
}) => {
    const [activeTab, setActiveTab] = useState<'diagrams' | 'design' | 'forces'>('diagrams');
    const [internalSelectedId, setInternalSelectedId] = useState<string>('');
    const [colorScheme, setColorScheme] = useState<'engineering' | 'modern' | 'contrast'>('engineering');
    const [config, setConfig] = useState<Partial<DiagramConfig>>({
        showShear: true,
        showMoment: true,
        showAxial: false,
        showTorsion: false,
        showGrid: true,
        showValues: true,
        colorScheme: 'engineering',
        scale: 50,
    });

    // Use external or internal selected ID
    const selectedMemberId = externalSelectedId || internalSelectedId;
    const setSelectedMemberId = onMemberSelect || setInternalSelectedId;

    // Get member IDs
    const memberIds = useMemo(() => Object.keys(memberForces), [memberForces]);

    // Get selected member data
    const selectedMemberForces = useMemo(() => {
        if (!selectedMemberId) return null;
        return memberForces[selectedMemberId];
    }, [memberForces, selectedMemberId]);

    // Convert to diagram data
    const diagramData = useMemo((): MemberDiagramData | null => {
        if (!selectedMemberForces?.diagramData) return null;
        
        const { diagramData: dd } = selectedMemberForces;
        const forcePoints: ForcePoint[] = dd.x_values.map((x, i) => ({
            x,
            Mz: dd.moment_y[i] || 0,
            Fy: dd.shear_y[i] || 0,
            My: dd.moment_z[i] || 0,
            Fz: dd.shear_z[i] || 0,
            Fx: dd.axial[i] || 0,
            Tx: dd.torsion[i] || 0,
        }));

        // Calculate extremes
        const shearValues = forcePoints.map(p => Math.max(Math.abs(p.Fy || 0), Math.abs(p.Fz || 0)));
        const momentValues = forcePoints.map(p => Math.max(Math.abs(p.Mz || 0), Math.abs(p.My || 0)));
        const axialValues = forcePoints.map(p => p.Fx || 0);

        return {
            memberId: selectedMemberId,
            length: dd.x_values[dd.x_values.length - 1] || 1,
            startNode: { x: 0, y: 0, z: 0 },
            endNode: { x: dd.x_values[dd.x_values.length - 1] || 1, y: 0, z: 0 },
            forcePoints,
            maxValues: {
                shear: Math.max(...shearValues, 0.001),
                moment: Math.max(...momentValues, 0.001),
                axial: Math.max(...axialValues, 0.001),
            },
            minValues: {
                shear: Math.min(...shearValues),
                moment: Math.min(...momentValues),
                axial: Math.min(...axialValues),
            },
        };
    }, [selectedMemberForces, selectedMemberId]);

    // Design results (mock section properties for demo)
    const designResult = useMemo((): DesignResult | null => {
        if (!selectedMemberForces) return null;

        const input: DesignInput = {
            memberId: selectedMemberId,
            memberType: 'beam',
            material: {
                type: 'steel',
                grade: 'Fe250',
                fy: 250,
                fu: 410,
                Es: 200,
            },
            section: {
                type: 'rectangular',
                width: 200,
                depth: 400,
            },
            forces: {
                axial: selectedMemberForces.axial,
                shearY: selectedMemberForces.shearY,
                shearZ: selectedMemberForces.shearZ,
                momentY: selectedMemberForces.momentY,
                momentZ: selectedMemberForces.momentZ,
                torsion: selectedMemberForces.torsion,
            },
            geometry: {
                length: 5, // Assumed
                kFactor: 1.0,
                laterallyBraced: true,
            },
            code: 'IS800',
        };

        return MemberDesignService.design(input);
    }, [selectedMemberForces, selectedMemberId]);

    // Handle config change
    const handleConfigChange = useCallback((key: keyof DiagramConfig) => {
        setConfig(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
    }, []);

    // Render tabs
    const renderTabs = () => (
        <div style={styles.tabs}>
            {(['diagrams', 'design', 'forces'] as const).map(tab => (
                <button type="button"
                    key={tab}
                    className="py-[10px] px-4 border-none bg-transparent text-[#94a3b8] text-[13px] cursor-pointer transition-all duration-200 border-b-2 border-b-transparent"
                    style={activeTab === tab ? { color: '#3b82f6', borderBottomColor: '#3b82f6' } : undefined}
                    onClick={() => setActiveTab(tab)}
                >
                    {tab === 'diagrams' && '📊 Diagrams'}
                    {tab === 'design' && '🔧 Design'}
                    {tab === 'forces' && '📋 Forces'}
                </button>
            ))}
        </div>
    );

    // Render member selector
    const renderMemberSelector = () => (
        <div style={styles.memberSelector}>
            <select
                style={styles.select}
                value={selectedMemberId}
                onChange={e => setSelectedMemberId(e.target.value)}
            >
                <option value="">Select a member...</option>
                {memberIds.map(id => (
                    <option key={id} value={id}>
                        Member {id}
                    </option>
                ))}
            </select>
        </div>
    );

    // Render diagram controls
    const renderControls = () => (
        <div style={styles.controls}>
            <div style={styles.controlGroup}>
                <input
                    type="checkbox"
                    id="showShear"
                    style={styles.checkbox}
                    checked={config.showShear}
                    onChange={() => handleConfigChange('showShear')}
                />
                <label htmlFor="showShear" style={styles.label}>Shear (V)</label>
            </div>
            <div style={styles.controlGroup}>
                <input
                    type="checkbox"
                    id="showMoment"
                    style={styles.checkbox}
                    checked={config.showMoment}
                    onChange={() => handleConfigChange('showMoment')}
                />
                <label htmlFor="showMoment" style={styles.label}>Moment (M)</label>
            </div>
            <div style={styles.controlGroup}>
                <input
                    type="checkbox"
                    id="showAxial"
                    style={styles.checkbox}
                    checked={config.showAxial}
                    onChange={() => handleConfigChange('showAxial')}
                />
                <label htmlFor="showAxial" style={styles.label}>Axial (N)</label>
            </div>
            <div style={styles.controlGroup}>
                <input
                    type="checkbox"
                    id="showGrid"
                    style={styles.checkbox}
                    checked={config.showGrid}
                    onChange={() => handleConfigChange('showGrid')}
                />
                <label htmlFor="showGrid" style={styles.label}>Grid</label>
            </div>
            <div style={styles.controlGroup}>
                <select
                    className="w-auto py-2 px-3 bg-[#334155] border border-[#475569] rounded-md text-[#f1f5f9] text-sm"
                    value={colorScheme}
                    onChange={e => {
                        const scheme = e.target.value as 'engineering' | 'modern' | 'contrast';
                        setColorScheme(scheme);
                        setConfig(prev => ({ ...prev, colorScheme: scheme }));
                    }}
                >
                    <option value="engineering">Engineering</option>
                    <option value="modern">Modern</option>
                    <option value="contrast">High Contrast</option>
                </select>
            </div>
        </div>
    );

    // Render diagrams tab
    const renderDiagramsTab = () => {
        if (!selectedMemberId) {
            return <div style={styles.noData}>Select a member to view diagrams</div>;
        }

        if (!diagramData) {
            return (
                <div style={styles.noData}>
                    No diagram data available for this member.<br />
                    Run analysis to generate force diagrams.
                </div>
            );
        }

        return (
            <>
                {renderControls()}
                
                {/* Shear Force Diagram */}
                {config.showShear && (
                    <div style={styles.diagramContainer}>
                        <div style={styles.diagramTitle}>
                            📈 Shear Force Diagram (SFD) — Max: {diagramData.maxValues.shear.toFixed(2)} kN
                        </div>
                        <ForceDiagramRenderer
                            memberData={diagramData}
                            config={{ ...config, showMoment: false, showAxial: false }}
                            width={500}
                            height={200}
                        />
                    </div>
                )}

                {/* Bending Moment Diagram */}
                {config.showMoment && (
                    <div style={styles.diagramContainer}>
                        <div style={styles.diagramTitle}>
                            📉 Bending Moment Diagram (BMD) — Max: {diagramData.maxValues.moment.toFixed(2)} kN·m
                        </div>
                        <ForceDiagramRenderer
                            memberData={diagramData}
                            config={{ ...config, showShear: false, showAxial: false }}
                            width={500}
                            height={200}
                        />
                    </div>
                )}

                {/* Axial Force Diagram */}
                {config.showAxial && (
                    <div style={styles.diagramContainer}>
                        <div style={styles.diagramTitle}>
                            ↔️ Axial Force Diagram (AFD) — Max: {diagramData.maxValues.axial.toFixed(2)} kN
                        </div>
                        <ForceDiagramRenderer
                            memberData={diagramData}
                            config={{ ...config, showShear: false, showMoment: false }}
                            width={500}
                            height={150}
                        />
                    </div>
                )}
            </>
        );
    };

    // Render design check row
    const renderDesignCheck = (check: DesignCheck) => {
        const statusStyle = check.status === 'PASS' ? styles.checkPass
            : check.status === 'FAIL' ? styles.checkFail
            : styles.checkWarning;
        
        const fillColor = check.status === 'PASS' ? '#22c55e'
            : check.status === 'FAIL' ? '#ef4444'
            : '#f59e0b';
        
        const utilPercent = Math.min(check.utilization * 100, 100);

        return (
            <div key={check.name} className="flex justify-between items-center py-[10px] px-3 mb-2 bg-[#0f172a] rounded-md border-l-[3px] border-solid" style={statusStyle}>
                <div>
                    <div style={styles.checkName}>{check.name}</div>
                    <div className="text-[11px] text-[#94a3b8] mt-0.5">
                        {check.description}
                    </div>
                </div>
                <div className="flex items-center">
                    <div style={styles.utilizationBar}>
                        <div
                            className="h-full rounded-[3px] transition-[width] duration-300"
                            style={{
                                width: `${utilPercent}%`,
                                backgroundColor: fillColor,
                            }}
                        />
                    </div>
                    <div className="text-xs font-semibold min-w-[45px] text-right" style={{ color: fillColor }}>
                        {(check.utilization * 100).toFixed(1)}%
                    </div>
                </div>
            </div>
        );
    };

    // Render design tab
    const renderDesignTab = () => {
        if (!selectedMemberId) {
            return <div style={styles.noData}>Select a member to view design results</div>;
        }

        if (!designResult) {
            return <div style={styles.noData}>No design results available</div>;
        }

        const statusColor = designResult.overallStatus === 'PASS' ? '#22c55e'
            : designResult.overallStatus === 'FAIL' ? '#ef4444'
            : '#f59e0b';

        return (
            <div style={styles.designResults}>
                {/* Overall Status */}
                <div style={styles.overallStatus}>
                    <div>
                        <div className="text-sm font-semibold">Overall Status</div>
                        <div className="text-xs text-[#94a3b8] mt-1">
                            Max Utilization: {(designResult.overallUtilization * 100).toFixed(1)}%
                        </div>
                    </div>
                    <div
                        className="py-1.5 px-3 rounded-[20px] text-xs font-semibold uppercase"
                        style={{
                            backgroundColor: statusColor + '20',
                            color: statusColor,
                        }}
                    >
                        {designResult.overallStatus}
                    </div>
                </div>

                {/* Individual Checks */}
                <div className="mt-4">
                    <div className="text-[13px] text-[#94a3b8] mb-3">
                        Design Checks (IS 800:2007)
                    </div>
                    {designResult.checks.map(renderDesignCheck)}
                </div>

                {/* Recommendations */}
                {designResult.recommendations && designResult.recommendations.length > 0 && (
                    <div className="mt-4 p-3 bg-[#0f172a] rounded-md">
                        <div className="text-[13px] text-[#94a3b8] mb-2">
                            💡 Recommendations
                        </div>
                        {designResult.recommendations.map((rec, i) => (
                            <div key={i} className="text-xs text-[#cbd5e1] mt-1">
                                • {rec}
                            </div>
                        ))}
                    </div>
                )}

                {/* Reinforcement Design */}
                {designResult.reinforcement && (
                    <div className="mt-4 p-3 bg-[#0f172a] rounded-md">
                        <div className="text-[13px] text-[#94a3b8] mb-2">
                            🔩 Reinforcement Design
                        </div>
                        <div className="text-xs text-[#cbd5e1]">
                            <div>Main Bars: {designResult.reinforcement.mainBars.count} × Ø{designResult.reinforcement.mainBars.diameter}mm</div>
                            <div>Area: {designResult.reinforcement.mainBars.area.toFixed(0)} mm² ({designResult.reinforcement.mainBars.ratio.toFixed(2)}%)</div>
                            <div>Stirrups: Ø{designResult.reinforcement.stirrups.diameter}mm @ {designResult.reinforcement.stirrups.spacing}mm c/c</div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Render forces table
    const renderForcesTab = () => {
        if (!selectedMemberId || !selectedMemberForces) {
            return <div style={styles.noData}>Select a member to view force values</div>;
        }

        const forces = selectedMemberForces;

        return (
            <div style={styles.diagramContainer}>
                <div style={styles.diagramTitle}>Member Forces Summary</div>
                <table style={styles.forceTable}>
                    <thead>
                        <tr>
                            <th style={styles.tableHeader}>Force Type</th>
                            <th style={styles.tableHeader}>Value</th>
                            <th style={styles.tableHeader}>Unit</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={styles.tableCell}>Axial Force (N)</td>
                            <td className="py-[10px] px-3 border-b border-[rgba(71,85,105,0.5)] text-[13px]" style={{ color: forces.axial > 0 ? '#22c55e' : '#ef4444' }}>
                                {forces.axial.toFixed(3)}
                            </td>
                            <td style={styles.tableCell}>kN</td>
                        </tr>
                        <tr>
                            <td style={styles.tableCell}>Shear Force Y (Vy)</td>
                            <td style={styles.tableCell}>{forces.shearY.toFixed(3)}</td>
                            <td style={styles.tableCell}>kN</td>
                        </tr>
                        <tr>
                            <td style={styles.tableCell}>Shear Force Z (Vz)</td>
                            <td style={styles.tableCell}>{forces.shearZ.toFixed(3)}</td>
                            <td style={styles.tableCell}>kN</td>
                        </tr>
                        <tr>
                            <td style={styles.tableCell}>Bending Moment Y (My)</td>
                            <td style={styles.tableCell}>{forces.momentY.toFixed(3)}</td>
                            <td style={styles.tableCell}>kN·m</td>
                        </tr>
                        <tr>
                            <td style={styles.tableCell}>Bending Moment Z (Mz)</td>
                            <td style={styles.tableCell}>{forces.momentZ.toFixed(3)}</td>
                            <td style={styles.tableCell}>kN·m</td>
                        </tr>
                        <tr>
                            <td style={styles.tableCell}>Torsion (T)</td>
                            <td style={styles.tableCell}>{forces.torsion.toFixed(3)}</td>
                            <td style={styles.tableCell}>kN·m</td>
                        </tr>
                    </tbody>
                </table>

                {/* Diagram data points */}
                {forces.diagramData && (
                    <div className="mt-5">
                        <div style={styles.diagramTitle}>Force Distribution ({forces.diagramData.x_values.length} points)</div>
                        <div className="max-h-[200px] overflow-auto">
                            <table style={styles.forceTable}>
                                <thead>
                                    <tr>
                                        <th style={styles.tableHeader}>x (m)</th>
                                        <th style={styles.tableHeader}>Shear Y</th>
                                        <th style={styles.tableHeader}>Moment Y</th>
                                        <th style={styles.tableHeader}>Axial</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {forces.diagramData.x_values.slice(0, 20).map((x, i) => (
                                        <tr key={i}>
                                            <td style={styles.tableCell}>{x.toFixed(3)}</td>
                                            <td style={styles.tableCell}>{forces.diagramData!.shear_y[i]?.toFixed(3)}</td>
                                            <td style={styles.tableCell}>{forces.diagramData!.moment_y[i]?.toFixed(3)}</td>
                                            <td style={styles.tableCell}>{forces.diagramData!.axial[i]?.toFixed(3)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>Structural Diagrams & Design</h3>
                <p style={styles.subtitle}>
                    SFD, BMD, AFD visualization and member design checks
                </p>
            </div>

            {renderTabs()}

            <div style={styles.content}>
                {renderMemberSelector()}
                
                {activeTab === 'diagrams' && renderDiagramsTab()}
                {activeTab === 'design' && renderDesignTab()}
                {activeTab === 'forces' && renderForcesTab()}
            </div>
        </div>
    );
});

(DiagramPanel as unknown as { displayName: string }).displayName = 'DiagramPanel';

export default DiagramPanel;
