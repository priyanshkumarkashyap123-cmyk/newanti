/**
 * AnalysisDesignPanel.tsx - Comprehensive Analysis & Design Results Panel
 * 
 * Features:
 * - Structural analysis results display
 * - Steel design checks (AISC 360-16)
 * - RC design checks (IS 456 / ACI 318)
 * - Member selection and property assignment
 * - Export capabilities
 */

import { FC, useState, useMemo, useCallback } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useModelStore, AnalysisResults, Member } from '../store/model';
import {
    MATERIALS_DATABASE,
    STEEL_SECTIONS,
    Material,
    SectionProperties,
    getMaterialById,
    getSectionById
} from '../data/SectionDatabase';
import {
    performSteelDesignCheck,
    SteelDesignResults,
    formatDesignResult,
    DesignParameters,
    optimizeMember
} from '../services/SteelDesignService';
import { generateDesignReport } from '../services/PDFReportService';
import { generateDXF, downloadDXF } from '../services/DXFExportService';
import { generateIFC, downloadIFC } from '../services/IFCExportService';
import { StatusBadge } from './ui/StatusBadge';

// ============================================
// TYPES
// ============================================

interface AnalysisDesignPanelProps {
    isOpen: boolean;
    onClose: () => void;
    analysisResults?: AnalysisResults | null;
}

interface MemberDesignConfig {
    memberId: string;
    section: SectionProperties;
    material: Material;
    Lb: number;  // Unbraced length
    Kx: number;
    Ky: number;
}

// ============================================
// COMPONENT
// ============================================

export const AnalysisDesignPanel: FC<AnalysisDesignPanelProps> = ({
    isOpen,
    onClose,
    analysisResults
}) => {
    const members = useModelStore((s) => s.members);
    const nodes = useModelStore((s) => s.nodes);
    const selectedIds = useModelStore((s) => s.selectedIds);

    const [activeTab, setActiveTab] = useState('forces');
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

    // Default design configuration
    const [designConfigs, setDesignConfigs] = useState<Map<string, MemberDesignConfig>>(new Map());
    const [defaultSection, setDefaultSection] = useState<string>('W14x30');
    const [defaultMaterial, setDefaultMaterial] = useState<string>('steel-a36');

    // Calculate member lengths
    const memberLengths = useMemo(() => {
        const lengths = new Map<string, number>();
        members.forEach((member, id) => {
            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);
            if (startNode && endNode) {
                const dx = endNode.x - startNode.x;
                const dy = endNode.y - startNode.y;
                const dz = endNode.z - startNode.z;
                lengths.set(id, Math.sqrt(dx * dx + dy * dy + dz * dz) * 1000); // Convert to mm
            }
        });
        return lengths;
    }, [members, nodes]);

    // Get design config for member
    const getDesignConfig = useCallback((memberId: string): MemberDesignConfig => {
        const existing = designConfigs.get(memberId);
        if (existing) return existing;

        const length = memberLengths.get(memberId) || 3000;
        return {
            memberId,
            section: getSectionById(defaultSection) || STEEL_SECTIONS[0],
            material: getMaterialById(defaultMaterial) || MATERIALS_DATABASE[0],
            Lb: length,
            Kx: 1.0,
            Ky: 1.0
        };
    }, [designConfigs, memberLengths, defaultSection, defaultMaterial]);

    // Perform design checks for all members
    const designResults = useMemo(() => {
        if (!analysisResults) return new Map<string, SteelDesignResults>();

        const results = new Map<string, SteelDesignResults>();

        members.forEach((member, id) => {
            const forces = analysisResults.memberForces.get(id);
            if (!forces) return;

            const config = getDesignConfig(id);
            const length = memberLengths.get(id) || 3000;

            const params: DesignParameters = {
                Lb: config.Lb,
                Lx: length * config.Kx,
                Ly: length * config.Ky,
                Kx: config.Kx,
                Ky: config.Ky,
                Cb: 1.0
            };

            const memberForces = {
                axial: forces.axial,
                shearY: forces.shearY,
                shearZ: forces.shearZ,
                momentY: forces.momentY,
                momentZ: forces.momentZ
            };

            const result = performSteelDesignCheck(
                id,
                config.section,
                config.material,
                memberForces,
                params
            );

            results.set(id, result);
        });

        return results;
    }, [analysisResults, members, getDesignConfig, memberLengths]);

    // Summary statistics
    const designSummary = useMemo(() => {
        let passed = 0;
        let failed = 0;
        let warnings = 0;
        let maxRatio = 0;
        let criticalMember = '';

        designResults.forEach((result, id) => {
            if (result.overallStatus === 'PASS') passed++;
            else if (result.overallStatus === 'FAIL') failed++;
            else warnings++;

            if (result.criticalRatio > maxRatio) {
                maxRatio = result.criticalRatio;
                criticalMember = id;
            }
        });

        return { passed, failed, warnings, maxRatio, criticalMember, total: designResults.size };
    }, [designResults]);

    // Apply section to selected members
    const applyToSelected = () => {
        const section = getSectionById(defaultSection);
        const material = getMaterialById(defaultMaterial);
        if (!section || !material) return;

        const newConfigs = new Map(designConfigs);
        selectedIds.forEach(id => {
            if (members.has(id)) {
                const length = memberLengths.get(id) || 3000;
                newConfigs.set(id, {
                    memberId: id,
                    section,
                    material,
                    Lb: length,
                    Kx: 1.0,
                    Ky: 1.0
                });
            }
        });
        setDesignConfigs(newConfigs);
    };

    const handleExportPDF = () => {
        if (!analysisResults) return;

        // Convert members Map to array for report
        const memberList = Array.from(members.values());
        const nodeList = Array.from(nodes.values());

        generateDesignReport(
            {
                name: "BeamLab Project", // TODO: Get actual project name
                engineer: "Engineer",    // TODO: Get actual user name
                date: new Date().toLocaleDateString(),
                description: "Automated Design Report"
            },
            memberList,
            nodeList,
            analysisResults,
            designResults
        );
    };

    const handleExportDXF = () => {
        const dxfContent = generateDXF(nodes, members);
        downloadDXF(dxfContent, "BeamLab_Model.dxf");
    };

    const handleExportIFC = () => {
        const ifcContent = generateIFC(
            { name: "BeamLab Project", author: "Engineer" },
            nodes,
            members
        );
        downloadIFC(ifcContent, "BeamLab_Model.ifc");
    };

    const handleOptimize = async () => {
        if (selectedIds.size === 0 || !analysisResults) return;

        const newConfigs = new Map(designConfigs);
        let optimizedCount = 0;

        for (const id of selectedIds) {
            if (!members.has(id)) continue;
            const forces = analysisResults.memberForces.get(id);
            if (!forces) continue;

            const config = getDesignConfig(id);
            const length = memberLengths.get(id) || 3000;

            // Optimizing currently assumes I-Beam for simplicity or existing type
            // We use the shape type of the CURRENTLY assigned (or default) section
            const shapeType = config.section.type || "I-BEAM";

            try {
                const result = await optimizeMember(
                    'AISC360-16',
                    shapeType,
                    {
                        length,
                        fy: config.material.fy || 250,
                        E: config.material.E || 200000
                    },
                    {
                        axial: forces.axial,
                        shearY: forces.shearY,
                        shearZ: forces.shearZ,
                        momentY: forces.momentY,
                        momentZ: forces.momentZ
                    }
                );

                if (result && result.section) {
                    // Try to match with existing loaded sections to ensure compatibility
                    // Or fallback to the object returned if compatible
                    const existing = STEEL_SECTIONS.find(s => s.name === result.section.name);
                    if (existing) {
                        newConfigs.set(id, {
                            ...config,
                            section: existing
                        });
                        optimizedCount++;
                    }
                }
            } catch (e) {
                console.error(`Failed to optimize member ${id}`, e);
            }
        }

        if (optimizedCount > 0) {
            setDesignConfigs(newConfigs);
            // Optionally notify user
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-[500px] bg-surface-dark border-l border-border-dark shadow-2xl z-40 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-dark">
                <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">analytics</span>
                        Analysis & Design
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                        Structural analysis and design check results
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="text-text-muted hover:text-zinc-900 dark:hover:text-white p-2 transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            {/* Summary Cards */}
            {analysisResults && (
                <div className="grid grid-cols-4 gap-2 p-4 bg-white/50 dark:bg-zinc-900/50">
                    <SummaryCard
                        label="Passed"
                        value={designSummary.passed}
                        color="green"
                        icon="check_circle"
                    />
                    <SummaryCard
                        label="Failed"
                        value={designSummary.failed}
                        color="red"
                        icon="cancel"
                    />
                    <SummaryCard
                        label="Warnings"
                        value={designSummary.warnings}
                        color="yellow"
                        icon="warning"
                    />
                    <SummaryCard
                        label="Max Ratio"
                        value={`${(designSummary.maxRatio * 100).toFixed(0)}%`}
                        color={designSummary.maxRatio > 1 ? 'red' : designSummary.maxRatio > 0.9 ? 'yellow' : 'blue'}
                        icon="speed"
                    />
                </div>
            )}

            {/* Tabs */}
            <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <Tabs.List className="flex border-b border-border-dark bg-zinc-100/30 dark:bg-zinc-900/30">
                    <Tabs.Trigger
                        value="forces"
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'forces'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-text-muted hover:text-zinc-900 dark:hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">functions</span>
                        Forces
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="design"
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'design'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-text-muted hover:text-zinc-900 dark:hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">engineering</span>
                        Design
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="sections"
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'sections'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-text-muted hover:text-zinc-900 dark:hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">view_column</span>
                        Sections
                    </Tabs.Trigger>
                </Tabs.List>

                {/* Forces Tab */}
                <Tabs.Content value="forces" className="flex-1 overflow-auto p-4">
                    {!analysisResults ? (
                        <EmptyState message="Run analysis to see member forces" icon="play_arrow" />
                    ) : (
                        <div className="space-y-3">
                            {Array.from(members.keys()).map(memberId => {
                                const forces = analysisResults.memberForces.get(memberId);
                                if (!forces) return null;

                                return (
                                    <div
                                        key={memberId}
                                        className={`bg-white dark:bg-zinc-900 rounded-lg p-3 border cursor-pointer transition-all ${selectedMemberId === memberId
                                            ? 'border-primary'
                                            : 'border-border-dark hover:border-text-muted'
                                            }`}
                                        onClick={() => setSelectedMemberId(memberId)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-bold text-zinc-900 dark:text-white">Member {memberId}</span>
                                            <span className="text-xs text-text-muted font-mono">
                                                L = {((memberLengths.get(memberId) || 0) / 1000).toFixed(2)} m
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <ForceValue label="Axial" value={forces.axial} unit="kN" />
                                            <ForceValue label="Shear Y" value={forces.shearY} unit="kN" />
                                            <ForceValue label="Shear Z" value={forces.shearZ} unit="kN" />
                                            <ForceValue label="Moment Y" value={forces.momentY} unit="kN·m" />
                                            <ForceValue label="Moment Z" value={forces.momentZ} unit="kN·m" />
                                            <ForceValue label="Torsion" value={forces.torsion} unit="kN·m" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Tabs.Content>

                {/* Design Tab */}
                <Tabs.Content value="design" className="flex-1 overflow-auto p-4">
                    {!analysisResults ? (
                        <EmptyState message="Run analysis to perform design checks" icon="engineering" />
                    ) : (
                        <div className="space-y-3">
                            {Array.from(designResults.entries()).map(([memberId, result]) => (
                                <div
                                    key={memberId}
                                    className={`bg-white dark:bg-zinc-900 rounded-lg p-3 border transition-all ${result.overallStatus === 'FAIL'
                                        ? 'border-red-500/50'
                                        : result.overallStatus === 'WARNING'
                                            ? 'border-yellow-500/50'
                                            : 'border-border-dark'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="absolute top-2 right-2">
                                                <StatusBadge
                                                    variant={result.overallStatus === 'PASS' ? 'pass' : result.overallStatus === 'FAIL' ? 'critical' : 'warning'}
                                                >
                                                    {result.overallStatus}
                                                </StatusBadge>
                                            </div>
                                            <span className="text-sm font-bold text-zinc-900 dark:text-white">Member {memberId}</span>
                                        </div>
                                        <span className={`text-sm font-bold font-mono ${result.criticalRatio > 1 ? 'text-red-400' :
                                            result.criticalRatio > 0.9 ? 'text-yellow-400' :
                                                'text-green-400'
                                            }`}>
                                            {(result.criticalRatio * 100).toFixed(1)}%
                                        </span>
                                    </div>

                                    <div className="text-xs text-text-muted mb-2">
                                        {result.section.name} | {result.material.name}
                                    </div>

                                    <div className="space-y-1.5">
                                        {result.compressionCheck && (
                                            <DesignCheckRow check={result.compressionCheck} />
                                        )}
                                        {result.tensionCheck && (
                                            <DesignCheckRow check={result.tensionCheck} />
                                        )}
                                        {result.flexureXCheck && (
                                            <DesignCheckRow check={result.flexureXCheck} />
                                        )}
                                        {result.shearVyCheck && (
                                            <DesignCheckRow check={result.shearVyCheck} />
                                        )}
                                        {result.combinedCheck && (
                                            <DesignCheckRow check={result.combinedCheck} />
                                        )}
                                    </div>

                                    <div className="mt-2 pt-2 border-t border-border-dark text-[10px] text-text-muted">
                                        Governing: {result.governingCheck}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Tabs.Content>

                {/* Sections Tab */}
                <Tabs.Content value="sections" className="flex-1 overflow-auto p-4">
                    <div className="space-y-4">
                        {/* Quick Apply */}
                        <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-border-dark">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">Assign Section & Material</h3>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-text-muted block mb-1">Section</label>
                                    <select
                                        value={defaultSection}
                                        onChange={(e) => setDefaultSection(e.target.value)}
                                        className="w-full bg-zinc-100 dark:bg-zinc-800 border border-border-dark rounded-lg px-3 py-2 text-zinc-900 dark:text-white text-sm"
                                    >
                                        {STEEL_SECTIONS.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} — {s.weight.toFixed(1)} kg/m
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs text-text-muted block mb-1">Material</label>
                                    <select
                                        value={defaultMaterial}
                                        onChange={(e) => setDefaultMaterial(e.target.value)}
                                        className="w-full bg-zinc-100 dark:bg-zinc-800 border border-border-dark rounded-lg px-3 py-2 text-zinc-900 dark:text-white text-sm"
                                    >
                                        {MATERIALS_DATABASE.filter(m => m.type === 'steel').map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} — fy = {m.fy} MPa
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={applyToSelected}
                                        disabled={selectedIds.size === 0}
                                        className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-zinc-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                                    >
                                        Apply ({selectedIds.size})
                                    </button>
                                    <button
                                        onClick={handleOptimize}
                                        disabled={selectedIds.size === 0 || !analysisResults}
                                        className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500 transition-colors flex items-center justify-center gap-2"
                                        title="Auto-select lightest passing section"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
                                        Auto-Select
                                    </button>
                                    <button
                                        onClick={() => {
                                            const section = getSectionById(defaultSection);
                                            const material = getMaterialById(defaultMaterial);
                                            if (!section || !material) return;

                                            const newConfigs = new Map<string, MemberDesignConfig>();
                                            members.forEach((_, id) => {
                                                const length = memberLengths.get(id) || 3000;
                                                newConfigs.set(id, {
                                                    memberId: id,
                                                    section,
                                                    material,
                                                    Lb: length,
                                                    Kx: 1.0,
                                                    Ky: 1.0
                                                });
                                            });
                                            setDesignConfigs(newConfigs);
                                        }}
                                        className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white hover:bg-zinc-600 transition-colors"
                                    >
                                        Apply to All
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Section Properties Display */}
                        {defaultSection && (
                            <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-border-dark">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">Section Properties</h3>
                                {(() => {
                                    const section = getSectionById(defaultSection);
                                    if (!section) return null;

                                    return (
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <PropertyItem label="A" value={section.A} unit="mm²" />
                                            <PropertyItem label="Ix" value={section.Ix} unit="mm⁴" />
                                            <PropertyItem label="Iy" value={section.Iy} unit="mm⁴" />
                                            <PropertyItem label="Sx" value={section.Sx} unit="mm³" />
                                            <PropertyItem label="Zx" value={section.Zx} unit="mm³" />
                                            <PropertyItem label="rx" value={section.rx} unit="mm" />
                                            <PropertyItem label="ry" value={section.ry} unit="mm" />
                                            <PropertyItem label="J" value={section.J} unit="mm⁴" />
                                            <PropertyItem label="Weight" value={section.weight} unit="kg/m" />
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Assigned Sections List */}
                        <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-border-dark">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">
                                Member Assignments ({designConfigs.size}/{members.size})
                            </h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {Array.from(members.keys()).map(memberId => {
                                    const config = designConfigs.get(memberId);
                                    return (
                                        <div
                                            key={memberId}
                                            className="flex items-center justify-between py-1.5 px-2 rounded bg-zinc-100/50 dark:bg-zinc-800/50 text-xs"
                                        >
                                            <span className="text-zinc-900 dark:text-white font-medium">M{memberId}</span>
                                            <span className="text-text-muted">
                                                {config?.section.name || 'Not assigned'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </Tabs.Content>
            </Tabs.Root>

            {/* Footer */}
            <div className="p-4 border-t border-border-dark bg-white/50 dark:bg-zinc-900/50">
                <div className="flex gap-2">
                    <button
                        onClick={handleExportDXF}
                        className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white hover:bg-zinc-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        DXF
                    </button>
                    <button
                        onClick={handleExportIFC}
                        className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white hover:bg-zinc-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[16px]">domain</span>
                        IFC
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={!analysisResults}
                        className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-zinc-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                        Report
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// SUB-COMPONENTS
// ============================================

const SummaryCard: FC<{ label: string; value: string | number; color: string; icon: string }> = ({
    label, value, color, icon
}) => {
    const colorClasses: Record<string, string> = {
        green: 'bg-green-500/10 text-green-400 border-green-500/30',
        red: 'bg-red-500/10 text-red-400 border-red-500/30',
        yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    };

    return (
        <div className={`rounded-lg p-3 border ${colorClasses[color]}`}>
            <div className="flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-[14px]">{icon}</span>
                <span className="text-[10px] uppercase font-medium opacity-70">{label}</span>
            </div>
            <p className="text-lg font-bold">{value}</p>
        </div>
    );
};

const ForceValue: FC<{ label: string; value: number; unit: string }> = ({ label, value, unit }) => (
    <div className="bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1">
        <p className="text-text-muted text-[10px]">{label}</p>
        <p className={`font-mono font-medium ${value < 0 ? 'text-blue-400' : 'text-zinc-900 dark:text-white'}`}>
            {value.toFixed(2)} <span className="text-text-muted text-[10px]">{unit}</span>
        </p>
    </div>
);

const PropertyItem: FC<{ label: string; value: number; unit: string }> = ({ label, value, unit }) => (
    <div className="bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1.5">
        <p className="text-text-muted text-[10px]">{label}</p>
        <p className="text-zinc-900 dark:text-white font-mono text-xs">
            {value > 1e5 ? value.toExponential(2) : value.toLocaleString()}
            <span className="text-text-muted text-[10px] ml-0.5">{unit}</span>
        </p>
    </div>
);

const DesignCheckRow: FC<{ check: { checkType: string; ratio: number; status: string; details: string } }> = ({ check }) => {
    const statusColor = check.status === 'PASS' ? 'text-green-400' :
        check.status === 'FAIL' ? 'text-red-400' : 'text-yellow-400';

    return (
        <div className="flex items-center justify-between text-xs py-1 px-2 bg-zinc-100/50 dark:bg-zinc-800/50 rounded">
            <span className="text-text-muted">{check.checkType}</span>
            <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full ${check.ratio > 1 ? 'bg-red-500' : check.ratio > 0.9 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                        style={{ width: `${Math.min(check.ratio * 100, 100)}%` }}
                    />
                </div>
                <span className={`font-mono font-medium ${statusColor}`}>
                    {(check.ratio * 100).toFixed(0)}%
                </span>
            </div>
        </div>
    );
};

const EmptyState: FC<{ message: string; icon: string }> = ({ message, icon }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <span className="material-symbols-outlined text-[48px] text-text-muted/50 mb-3">{icon}</span>
        <p className="text-text-muted">{message}</p>
    </div>
);

export default AnalysisDesignPanel;
