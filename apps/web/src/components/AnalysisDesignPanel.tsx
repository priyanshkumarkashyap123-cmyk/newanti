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
import { useUser } from '../store/authStore';
import {
    MATERIALS_DATABASE,
    Material,
    SectionProperties,
    getMaterialById,
    getSectionById
} from '../data/SectionDatabase';
import { STEEL_SECTIONS } from '../data/sectionDatabaseSteelSections';
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
import { PanelErrorBoundary, PanelFallback } from './ui/PanelErrorBoundary';
import {
    MemberDesignConfig,
    buildReportMeta,
    computeDesignSummary,
    computeMemberLengths,
    createDefaultDesignConfig,
} from './analysis-design-panel/helpers';
import {
    DesignCheckRow,
    EmptyState,
    ForceValue,
    PropertyItem,
    SummaryCard,
} from './analysis-design-panel/ui';

// ============================================
// TYPES
// ============================================

interface AnalysisDesignPanelProps {
    isOpen: boolean;
    onClose: () => void;
    analysisResults?: AnalysisResults | null;
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
    const projectInfo = useModelStore((s) => s.projectInfo);
    const user = useUser();

    const [activeTab, setActiveTab] = useState('forces');
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

    // Default design configuration
    const [designConfigs, setDesignConfigs] = useState<Map<string, MemberDesignConfig>>(new Map());
    const [defaultSection, setDefaultSection] = useState<string>('W14x30');
    const [defaultMaterial, setDefaultMaterial] = useState<string>('steel-a36');

    // Calculate member lengths
    const memberLengths = useMemo(() => computeMemberLengths(members, nodes), [members, nodes]);

    // Get design config for member
    const getDesignConfig = useCallback((memberId: string): MemberDesignConfig => {
        const existing = designConfigs.get(memberId);
        if (existing) return existing;

        return createDefaultDesignConfig(memberId, memberLengths, defaultSection, defaultMaterial);
    }, [designConfigs, memberLengths, defaultSection, defaultMaterial]);

    const parseModalResponse = useCallback((nodesPayload: unknown, elementsPayload: unknown, modes: number) => {
        void nodesPayload;
        void elementsPayload;
        void modes;
        return null;
    }, []);

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
    const designSummary = useMemo(() => computeDesignSummary(designResults), [designResults]);

    // Apply section to selected members
    const applyToSelected = () => {
        const section = getSectionById(defaultSection);
        const material = getMaterialById(defaultMaterial);
        if (!section || !material) return;

        const newConfigs = new Map(designConfigs);
        selectedIds.forEach(id => {
            if (members.has(id)) {
                const baseConfig = createDefaultDesignConfig(id, memberLengths, defaultSection, defaultMaterial);
                newConfigs.set(id, {
                    ...baseConfig,
                    section,
                    material,
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
            buildReportMeta(projectInfo, user as { fullName?: string; email?: string } | null),
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
            {
                name: projectInfo?.name ?? 'Untitled Project',
                author: (user as { fullName?: string; email?: string } | null)?.fullName
                    ?? (user as { fullName?: string; email?: string } | null)?.email
                    ?? 'Engineer'
            },
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
                    const existing = STEEL_SECTIONS.find((s: SectionProperties) => s.name === result.section.name);
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

    const handleModalAnalysis = () => {
        return parseModalResponse(nodes, members, 3);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-[500px] bg-surface-dark border-l border-border-dark shadow-2xl z-40 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-dark">
                <div>
                    <h2 className="text-lg font-bold text-[#dae2fd] flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">analytics</span>
                        Analysis & Design
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                        Structural analysis and design check results
                    </p>
                </div>
                <button type="button"
                    onClick={onClose}
                    className="text-text-muted hover:text-slate-900 dark:hover:text-white p-2 transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            {/* Summary Cards */}
            {analysisResults && (
                <div className="grid grid-cols-4 gap-2 p-4 bg-white/50 dark:bg-slate-900/50">
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
                <Tabs.List className="flex border-b border-border-dark bg-slate-100/30 dark:bg-slate-900/30">
                    <Tabs.Trigger
                        value="forces"
                        className={`flex-1 px-4 py-3 text-sm font-medium tracking-wide transition-colors ${activeTab === 'forces'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-text-muted hover:text-slate-900 dark:hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">functions</span>
                        Forces
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="design"
                        className={`flex-1 px-4 py-3 text-sm font-medium tracking-wide transition-colors ${activeTab === 'design'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-text-muted hover:text-slate-900 dark:hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">engineering</span>
                        Design
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="sections"
                        className={`flex-1 px-4 py-3 text-sm font-medium tracking-wide transition-colors ${activeTab === 'sections'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-text-muted hover:text-slate-900 dark:hover:text-white'
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
                                        className={`bg-[#0b1326] rounded-lg p-3 border cursor-pointer transition-all ${selectedMemberId === memberId
                                            ? 'border-primary'
                                            : 'border-border-dark hover:border-text-muted'
                                            }`}
                                        onClick={() => setSelectedMemberId(memberId)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-bold text-[#dae2fd]">Member {memberId}</span>
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
                                    className={`bg-[#0b1326] rounded-lg p-3 border transition-all ${result.overallStatus === 'FAIL'
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
                                            <span className="text-sm font-bold text-[#dae2fd]">Member {memberId}</span>
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
                        <div className="bg-[#0b1326] rounded-lg p-4 border border-border-dark">
                            <h3 className="text-sm font-bold text-[#dae2fd] mb-3">Assign Section & Material</h3>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-text-muted block mb-1">Section</label>
                                    <select
                                        value={defaultSection}
                                        onChange={(e) => setDefaultSection(e.target.value)}
                                        className="w-full bg-[#131b2e] border border-border-dark rounded-lg px-3 py-2 text-[#dae2fd] text-sm"
                                    >
                                        {STEEL_SECTIONS.map((s: SectionProperties) => (
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
                                        className="w-full bg-[#131b2e] border border-border-dark rounded-lg px-3 py-2 text-[#dae2fd] text-sm"
                                    >
                                        {MATERIALS_DATABASE.filter(m => m.type === 'steel').map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} — fy = {m.fy} MPa
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex gap-2">
                                    <button type="button"
                                        onClick={applyToSelected}
                                        disabled={selectedIds.size === 0}
                                        className="flex-1 px-4 py-2 text-sm font-medium tracking-wide rounded-lg bg-primary text-[#dae2fd] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                                    >
                                        Apply ({selectedIds.size})
                                    </button>
                                    <button type="button"
                                        onClick={handleOptimize}
                                        disabled={selectedIds.size === 0 || !analysisResults}
                                        className="flex-1 px-4 py-2 text-sm font-medium tracking-wide rounded-lg bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500 transition-colors flex items-center justify-center gap-2"
                                        title="Auto-select lightest passing section"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
                                        Auto-Select
                                    </button>
                                    <button type="button"
                                        onClick={() => {
                                            const section = getSectionById(defaultSection);
                                            const material = getMaterialById(defaultMaterial);
                                            if (!section || !material) return;

                                            const newConfigs = new Map<string, MemberDesignConfig>();
                                            members.forEach((_, id) => {
                                                const baseConfig = createDefaultDesignConfig(id, memberLengths, defaultSection, defaultMaterial);
                                                newConfigs.set(id, {
                                                    ...baseConfig,
                                                    section,
                                                    material,
                                                });
                                            });
                                            setDesignConfigs(newConfigs);
                                        }}
                                        className="px-4 py-2 text-sm font-medium tracking-wide rounded-lg bg-slate-200 dark:bg-slate-700 text-[#dae2fd] hover:bg-slate-600 transition-colors"
                                    >
                                        Apply to All
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Section Properties Display */}
                        {defaultSection && (
                            <div className="bg-[#0b1326] rounded-lg p-4 border border-border-dark">
                                <h3 className="text-sm font-bold text-[#dae2fd] mb-3">Section Properties</h3>
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
                        <div className="bg-[#0b1326] rounded-lg p-4 border border-border-dark">
                            <h3 className="text-sm font-bold text-[#dae2fd] mb-3">
                                Member Assignments ({designConfigs.size}/{members.size})
                            </h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {Array.from(members.keys()).map(memberId => {
                                    const config = designConfigs.get(memberId);
                                    return (
                                        <div
                                            key={memberId}
                                            className="flex items-center justify-between py-1.5 px-2 rounded bg-slate-100/50 dark:bg-slate-800/50 text-xs"
                                        >
                                            <span className="text-[#dae2fd] font-medium tracking-wide">M{memberId}</span>
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
            <div className="p-4 border-t border-border-dark bg-white/50 dark:bg-slate-900/50">
                <div className="flex gap-2">
                    <button type="button"
                        onClick={handleExportDXF}
                        className="flex-1 px-4 py-2 text-sm font-medium tracking-wide rounded-lg bg-slate-200 dark:bg-slate-700 text-[#dae2fd] hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        DXF
                    </button>
                    <button type="button"
                        onClick={handleExportIFC}
                        className="flex-1 px-4 py-2 text-sm font-medium tracking-wide rounded-lg bg-slate-200 dark:bg-slate-700 text-[#dae2fd] hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[16px]">domain</span>
                        IFC
                    </button>
                    <button type="button"
                        onClick={handleExportPDF}
                        disabled={!analysisResults}
                        className="flex-1 px-4 py-2 text-sm font-medium tracking-wide rounded-lg bg-primary text-[#dae2fd] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                        Report
                    </button>
                </div>
            </div>
        </div>
    );
};

/** Wrapped export — consumers get error boundary for free */
const AnalysisDesignPanelWithBoundary: FC<AnalysisDesignPanelProps> = (props) => (
    <PanelErrorBoundary fallback={<PanelFallback name="Analysis & Design" />}>
        <AnalysisDesignPanel {...props} />
    </PanelErrorBoundary>
);

export default AnalysisDesignPanelWithBoundary;
