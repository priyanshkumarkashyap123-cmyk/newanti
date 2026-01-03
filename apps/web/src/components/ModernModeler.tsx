/**
 * ModernModeler.tsx - Unified Modeler Component
 * 
 * Integrates all modern components:
 * - Flex-based layout with collapsible panels
 * - SmartSidebar for context-aware tools
 * - 3D visualization via ViewportManager
 * - Analysis Workflow with guided steps
 * - Quick Start modal for new users
 */

import { FC, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Box,
    Layers,
    Download,
    BarChart3,
    Ruler,
    ChevronLeft,
    ChevronRight,
    PanelLeftClose,
    PanelLeftOpen,
    HelpCircle
} from 'lucide-react';
import { useUIStore, Category } from '../store/uiStore';
import { useModelStore, saveProjectToStorage } from '../store/model';
import { SmartSidebar } from './layout/SmartSidebar';
import { ViewportManager } from './ViewportManager';
// import { Toolbar } from './Toolbar'; // Replaced by Ribbon
import { PropertiesPanel } from './PropertiesPanel';
import { ResultsTable } from './ResultsTable';

// New layout components
import { WorkflowSidebar } from './layout/WorkflowSidebar';
import { EngineeringRibbon } from './layout/EngineeringRibbon';

// New workflow components
import { AnalysisWorkflow } from './AnalysisWorkflow'; // Keep for now if types rely on it or if used in stepper
import { AnalysisProgressModal, type AnalysisStage } from './AnalysisProgressModal';
import { QuickStartModal } from './QuickStartModal';
import { ProjectDetailsDialog } from './ProjectDetailsDialog';
import { ResultsToolbar } from './results/ResultsToolbar';
import { AICommandCenter, AIAssistantChat, AIAssistantButton } from './ai';
import { LoadInputDialog } from './ui/LoadInputDialog';
import { TutorialOverlay } from './TutorialOverlay';
import { StructureWizard } from './StructureWizard';
import { FoundationDesignDialog } from './FoundationDesignDialog';
import { IS875LoadDialog } from './IS875LoadDialog';
import { GeometryToolsPanel } from './GeometryToolsPanel';
import { ValidationErrorDisplay } from './ValidationErrorDisplay';
import { InteroperabilityDialog } from './InteroperabilityDialog';
import { RailwayBridgeDialog } from './RailwayBridgeDialog';
import { MeshingPanel } from './MeshingPanel';
import { LoadDialog } from './LoadDialog';
import WindLoadDialog from './WindLoadDialog';
import SeismicLoadDialog from './SeismicLoadDialog';
import MovingLoadDialog from './MovingLoadDialog';
import ASCE7SeismicLoadDialog from './ASCE7SeismicLoadDialog';
import ASCE7WindLoadDialog from './ASCE7WindLoadDialog';
import LoadCombinationsDialog from './LoadCombinationsDialog';
import { AdvancedAnalysisDialog } from './AdvancedAnalysisDialog';
import { DesignCodesDialog } from './DesignCodesDialog';
import { LegalConsentModal, useCheckLegalConsent } from './LegalConsentModal';
import { CheckpointLegalModal } from './CheckpointLegalModal';
import { ExportDialog } from './ExportDialog';
import { ActionToast, type ToastType } from './ui/ActionToast';
import type { Node, Member } from '../store/model';
import consentService from '../services/ConsentService';
import { useAuth } from '../providers/AuthProvider';

// Quick Commands and Context Menu (STAAD Pro style)
import { useQuickCommands, getDefaultQuickCommands } from './QuickCommandsToolbar';
import { useContextMenu, getNodeContextMenuItems, getMemberContextMenuItems, getEmptyContextMenuItems } from './ContextMenu';

// Analysis service
import { analysisService } from '../services/AnalysisService';

// ============================================
// TYPES
// ============================================

interface TabConfig {
    id: Category;
    label: string;
    icon: React.ReactNode;
}

// ============================================
// CATEGORY TABS CONFIGURATION
// ============================================

const CATEGORY_TABS: TabConfig[] = [
    { id: 'MODELING', label: 'Modeling', icon: <Box className="w-4 h-4" /> },
    { id: 'PROPERTIES', label: 'Properties', icon: <Layers className="w-4 h-4" /> },
    { id: 'LOADING', label: 'Loading', icon: <Download className="w-4 h-4" /> },
    { id: 'ANALYSIS', label: 'Analysis', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'DESIGN', label: 'Design', icon: <Ruler className="w-4 h-4" /> }
];

// Map workflow steps to categories
const STEP_TO_CATEGORY: Category[] = ['MODELING', 'MODELING', 'LOADING', 'ANALYSIS', 'ANALYSIS'];

// ============================================
// CATEGORY SWITCHER
// ============================================

const CategorySwitcher: FC = () => {
    const { activeCategory, setCategory, notification, hideNotification } = useUIStore();

    return (
        <>
            <div className="flex items-center gap-1 px-2">
                {CATEGORY_TABS.map((tab) => {
                    const isActive = activeCategory === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setCategory(tab.id)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg
                                text-sm font-medium transition-all duration-200
                                ${isActive
                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                }
                            `}
                        >
                            {tab.icon}
                            <span className="hidden lg:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Notification Toast */}

        </>
    );
};

// ============================================
// INSPECTOR PANEL
// ============================================

const InspectorPanel: FC<{ collapsed: boolean; onToggle: () => void }> = ({ collapsed, onToggle }) => {
    const selectedIds = useModelStore((state) => state.selectedIds);

    if (collapsed) {
        return (
            <div className="w-10 h-full bg-zinc-900 border-l border-zinc-800 flex flex-col items-center py-2">
                <button
                    onClick={onToggle}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
                    title="Show Properties"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="w-72 h-full bg-zinc-900 border-l border-zinc-800 flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Properties
                </h3>
                <button
                    onClick={onToggle}
                    className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded"
                    title="Hide Properties"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                <PropertiesPanel />
            </div>
            <div className="p-3 border-t border-zinc-800">
                <p className="text-[10px] text-zinc-500 text-center">
                    {selectedIds.size === 0
                        ? 'Select an element to view properties'
                        : `${selectedIds.size} item(s) selected`
                    }
                </p>
            </div>
        </div>
    );
};

// ============================================
// STATUS BAR
// ============================================

const StatusBar: FC<{ isAnalyzing: boolean }> = ({ isAnalyzing }) => {
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const analysisResults = useModelStore((state) => state.analysisResults);
    const { activeCategory, activeTool } = useUIStore();

    return (
        <div className="h-7 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between px-4 text-xs text-zinc-500 flex-shrink-0">
            <div className="flex items-center gap-6">
                <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                    {isAnalyzing ? 'Analyzing...' : 'Ready'}
                </span>
                <span className="h-3 w-px bg-zinc-700" />
                <span>Mode: <span className="text-zinc-400">{activeCategory}</span></span>
                <span className="h-3 w-px bg-zinc-700" />
                <span>Tool: <span className="text-zinc-400">{activeTool || 'None'}</span></span>
            </div>
            <div className="flex items-center gap-6">
                <span>Nodes: <span className="text-zinc-400 font-mono">{nodes.size}</span></span>
                <span className="h-3 w-px bg-zinc-700" />
                <span>Members: <span className="text-zinc-400 font-mono">{members.size}</span></span>
                <span className="h-3 w-px bg-zinc-700" />
                <span>Units: <span className="text-zinc-400">kN, m</span></span>
                {analysisResults && (
                    <>
                        <span className="h-3 w-px bg-zinc-700" />
                        <span className="text-green-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            Results Available
                        </span>
                    </>
                )}
            </div>
        </div>
    );
};

// ============================================
// MAIN MODERN MODELER COMPONENT
// ============================================

export const ModernModeler: FC = () => {
    const { getToken } = useAuth();
    const showResults = useModelStore((state) => state.showResults);
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const loads = useModelStore((state) => state.loads);
    const memberLoads = useModelStore((state) => state.memberLoads);
    const analysisResults = useModelStore((state) => state.analysisResults);
    const setAnalysisResults = useModelStore((state) => state.setAnalysisResults);
    const setIsAnalyzing = useModelStore((state) => state.setIsAnalyzing);
    // UI Store
    const { activeCategory, setCategory, notification, hideNotification, showNotification } = useUIStore();

    const [inspectorCollapsed, setInspectorCollapsed] = useState(false);

    // Analysis state
    const [isAnalyzing, setIsAnalyzingLocal] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [analysisStage, setAnalysisStage] = useState<AnalysisStage>('validating');
    const [analysisError, setAnalysisError] = useState<string | undefined>();
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [analysisStats, setAnalysisStats] = useState<{ nodes: number; members: number; dof: number; timeMs: number } | undefined>();
    const [showResultsToolbar, setShowResultsToolbar] = useState(false);

    // Validation state
    const [validationErrors, setValidationErrors] = useState<any | null>(null);
    const [showValidationErrors, setShowValidationErrors] = useState(false);

    // Export state
    const [showExportDialog, setShowExportDialog] = useState(false);

    // AI Assistant state
    const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

    // Feedback state


    // Quick start modal
    const [showQuickStart, setShowQuickStart] = useState(false);
    const [showProjectDetails, setShowProjectDetails] = useState(false);
    const [isNewProject, setIsNewProject] = useState(false);
    const [showLegalConsent, setShowLegalConsent] = useState(false);
    const [pendingAction, setPendingAction] = useState<'analysis' | 'design' | 'pdf_export' | null>(null);
    const [currentCheckpointType, setCurrentCheckpointType] = useState<'analysis' | 'design' | 'pdf_export'>('analysis');
    const { hasConsent } = useCheckLegalConsent();
    const { openModal } = useUIStore();

    // Handler for new project from QuickStart
    const handleNewProject = useCallback(() => {
        setShowQuickStart(false);
        setIsNewProject(true);
        setShowProjectDetails(true);
    }, []);

    // Auto-save project after analysis completes
    const handleProjectSave = useCallback(() => {
        saveProjectToStorage();
        showNotification('success', 'Project saved successfully!');
    }, [showNotification]);

    // Import new layout components handled at top of file

    // Run analysis
    const handleRunAnalysis = useCallback(async () => {
        // Check legal consent for analysis
        setPendingAction('analysis');
        setCurrentCheckpointType('analysis');
        setShowLegalConsent(true);

        // Don't proceed with actual analysis yet
        return;
    }, []);

    // Actual analysis execution (called after consent)
    const executeAnalysis = useCallback(async () => {

        setIsAnalyzingLocal(true);
        setIsAnalyzing(true);
        setShowProgressModal(true);
        setAnalysisStage('validating');
        setAnalysisProgress(10);
        setAnalysisError(undefined);

        const startTime = Date.now();

        try {
            // Check if we have member loads (UDL, point loads on members)
            const hasMemberLoads = memberLoads.length > 0;

            // Build model data for analysis
            const nodesArray = Array.from(nodes.values()).map(n => ({
                id: n.id,
                x: n.x,
                y: n.y,
                z: n.z,
                restraints: n.restraints,
                // Convert restraints to support type for Python API
                support: n.restraints ? (
                    n.restraints.fx && n.restraints.fy && n.restraints.fz && n.restraints.mx && n.restraints.my && n.restraints.mz
                        ? 'fixed'
                        : n.restraints.fx && n.restraints.fy && n.restraints.fz
                            ? 'pinned'
                            : n.restraints.fy
                                ? 'roller_x'
                                : 'none'
                ) : 'none'
            }));

            const membersArray = Array.from(members.values()).map(m => ({
                id: m.id,
                startNodeId: m.startNodeId,
                endNodeId: m.endNodeId,
                E: m.E ?? 200e6,  // 200 GPa in kN/m²
                G: (m.E ?? 200e6) / 2.6,  // Approximate shear modulus
                A: m.A ?? 0.01,
                Iy: m.I ?? 1e-4,
                Iz: m.I ?? 1e-4,
                J: (m.I ?? 1e-4) * 2,  // Approximate torsion constant
                I: m.I ?? 1e-4
            }));

            let result: { success: boolean; displacements?: Record<string, number[]>; reactions?: Record<string, number[]>; memberForces?: Record<string, any>; stats?: any; error?: string };

            // Use Python API for frame analysis with member loads
            if (hasMemberLoads) {
                setAnalysisStage('assembling');
                setAnalysisProgress(30);

                // Convert direction format: local_y -> Fy, global_y -> FY
                const convertDirection = (dir: string): string => {
                    switch (dir) {
                        case 'local_y': return 'Fy';
                        case 'local_z': return 'Fz';
                        case 'global_x': return 'FX';
                        case 'global_y': return 'FY';
                        case 'global_z': return 'FZ';
                        case 'axial': return 'Fx';
                        default: return 'Fy';
                    }
                };

                // Build distributed_loads from memberLoads
                const distributed_loads = memberLoads
                    .filter(ml => ml.type === 'UDL' || ml.type === 'UVL')
                    .map(ml => ({
                        memberId: ml.memberId,
                        direction: convertDirection(ml.direction),
                        w1: ml.w1 ?? 0,
                        w2: ml.type === 'UDL' ? (ml.w1 ?? 0) : (ml.w2 ?? ml.w1 ?? 0),
                        startPos: ml.startPos ?? 0,
                        endPos: ml.endPos ?? 1,
                        isRatio: true
                    }));

                // Build node_loads from nodal loads
                const node_loads = loads.map(l => ({
                    nodeId: l.nodeId,
                    fx: l.fx ?? 0,
                    fy: l.fy ?? 0,
                    fz: l.fz ?? 0,
                    mx: l.mx ?? 0,
                    my: l.my ?? 0,
                    mz: l.mz ?? 0
                }));

                // Call Python API for frame analysis
                const PYTHON_API = import.meta.env['VITE_PYTHON_API_URL'] || 'https://api.beamlabultimate.tech';

                try {
                    setAnalysisStage('solving');
                    setAnalysisProgress(50);

                    const token = await getToken();
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }

                    const response = await fetch(`${PYTHON_API}/analyze/frame`, {
                        method: 'POST',
                        headers,
                        credentials: 'include',
                        body: JSON.stringify({
                            nodes: nodesArray,
                            members: membersArray,
                            node_loads,
                            distributed_loads
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ detail: 'Analysis server error' }));

                        // Check if this is a validation error
                        if (errorData.validation_results) {
                            setValidationErrors(errorData.validation_results);
                            setShowValidationErrors(true);
                            throw new Error('Model validation failed. Please fix the errors shown.');
                        }

                        throw new Error(errorData.detail || `Server error: ${response.status}`);
                    }

                    const pythonResult = await response.json();

                    if (pythonResult.success) {
                        // Convert members array to dictionary keyed by memberId
                        const membersDict: Record<string, any> = {};
                        if (Array.isArray(pythonResult.members)) {
                            for (const member of pythonResult.members) {
                                if (member.memberId) {
                                    membersDict[member.memberId] = member;
                                }
                            }
                        }

                        // Convert nodes array to dictionary keyed by nodeId
                        const nodesDict: Record<string, any> = {};
                        if (Array.isArray(pythonResult.nodes)) {
                            for (const node of pythonResult.nodes) {
                                if (node.nodeId) {
                                    nodesDict[node.nodeId] = node;
                                }
                            }
                        }

                        result = {
                            success: true,
                            displacements: nodesDict,
                            reactions: {},
                            memberForces: membersDict,
                            stats: { ...pythonResult.metadata, usedPythonApi: true }
                        };

                        // Extract reactions from nodes with restraints
                        if (pythonResult.nodes) {
                            const nodesList = Array.isArray(pythonResult.nodes) ? pythonResult.nodes : Object.values(pythonResult.nodes);
                            nodesList.forEach((data: any) => {
                                const nodeId = data.nodeId || data.node_id;
                                const node = nodes.get(nodeId);
                                if (node?.restraints && (node.restraints.fx || node.restraints.fy || node.restraints.fz)) {
                                    // Check if there's reaction data
                                    const hasReaction = data.reaction || data.RxnFX !== undefined;
                                    if (hasReaction) {
                                        result.reactions![nodeId] = [
                                            data.reaction?.fx ?? data.RxnFX ?? 0,
                                            data.reaction?.fy ?? data.RxnFY ?? 0,
                                            data.reaction?.fz ?? data.RxnFZ ?? 0,
                                            data.reaction?.mx ?? data.RxnMX ?? 0,
                                            data.reaction?.my ?? data.RxnMY ?? 0,
                                            data.reaction?.mz ?? data.RxnMZ ?? 0
                                        ];
                                    }
                                }
                            });
                        }
                    } else {
                        result = { success: false, error: pythonResult.error || 'Python analysis failed' };
                    }
                } catch (err) {
                    result = {
                        success: false,
                        error: err instanceof Error ? err.message : 'Failed to connect to analysis server'
                    };
                }
            } else {
                // Use local solver for simple models without member loads
                const modelData = {
                    nodes: nodesArray,
                    members: membersArray,
                    loads: loads.map(l => ({
                        nodeId: l.nodeId,
                        fx: l.fx,
                        fy: l.fy,
                        fz: l.fz
                    })),
                    dofPerNode: 3 as const
                };

                // Run analysis with progress callback
                const token = await getToken();
                result = await analysisService.analyze(modelData, (stage, progress) => {
                    setAnalysisStage(stage as AnalysisStage);
                    setAnalysisProgress(progress);
                }, token);
            }

            const endTime = Date.now();

            if (result.success) {
                // Convert results to store format
                const displacements = new Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>();
                const reactions = new Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>();
                const memberForces = new Map<string, {
                    axial: number; shearY: number; shearZ: number; momentY: number; momentZ: number; torsion: number;
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
                }>();

                // Parse displacements - handle both PyNite object format and array format
                if (result.displacements) {
                    Object.entries(result.displacements).forEach(([nodeId, disp]) => {
                        // PyNite returns {displacement: {dx, dy, dz, rx, ry, rz}}, simple solver returns [dx, dy, dz, rx, ry, rz]
                        if (Array.isArray(disp)) {
                            displacements.set(nodeId, {
                                dx: disp[0] ?? 0,
                                dy: disp[1] ?? 0,
                                dz: disp[2] ?? 0,
                                rx: disp[3] ?? 0,
                                ry: disp[4] ?? 0,
                                rz: disp[5] ?? 0
                            });
                        } else if (typeof disp === 'object' && disp !== null) {
                            const d = disp as Record<string, any>;
                            // Check if it has nested displacement object (PyNite format) or direct values
                            const displacement = d.displacement ?? d;
                            displacements.set(nodeId, {
                                dx: displacement.dx ?? displacement.DX ?? 0,
                                dy: displacement.dy ?? displacement.DY ?? 0,
                                dz: displacement.dz ?? displacement.DZ ?? 0,
                                rx: displacement.rx ?? displacement.RX ?? 0,
                                ry: displacement.ry ?? displacement.RY ?? 0,
                                rz: displacement.rz ?? displacement.RZ ?? 0
                            });
                        }
                    });
                }

                // Parse reactions
                if (result.reactions) {
                    Object.entries(result.reactions).forEach(([nodeId, react]) => {
                        const r = react as number[];
                        reactions.set(nodeId, {
                            fx: r[0] ?? 0,
                            fy: r[1] ?? 0,
                            fz: r[2] ?? 0,
                            mx: r[3] ?? 0,
                            my: r[4] ?? 0,
                            mz: r[5] ?? 0
                        });
                    });
                }

                // Parse member forces - extract from rich PyNite data including diagram arrays
                if (result.memberForces) {
                    Object.entries(result.memberForces).forEach(([memberId, forces]) => {
                        const f = forces as {
                            axial?: number | number[];
                            shear_y?: number[];
                            shear_z?: number[];
                            moment_y?: number[];
                            moment_z?: number[];
                            torsion?: number[];
                            x_values?: number[];
                            deflection_y?: number[];
                            deflection_z?: number[];
                            max_shear_y?: number;
                            max_shear_z?: number;
                            max_moment_y?: number;
                            max_moment_z?: number;
                        };

                        // Handle both array (PyNite) and scalar (simple solver) formats
                        const getMaxAbs = (arr: number[] | undefined): number => {
                            if (!arr || arr.length === 0) return 0;
                            return Math.max(Math.abs(Math.min(...arr)), Math.abs(Math.max(...arr)));
                        };

                        // Use max values if available, otherwise calculate from arrays
                        const axialVal = f.max_shear_y !== undefined
                            ? (Array.isArray(f.axial) ? getMaxAbs(f.axial) : (f.axial ?? 0))
                            : (typeof f.axial === 'number' ? f.axial : getMaxAbs(f.axial as number[] | undefined));
                        const shearY = f.max_shear_y ?? getMaxAbs(f.shear_y);
                        const shearZ = f.max_shear_z ?? getMaxAbs(f.shear_z);
                        const momentY = f.max_moment_y ?? getMaxAbs(f.moment_y);
                        const momentZ = f.max_moment_z ?? getMaxAbs(f.moment_z);
                        const torsionVal = getMaxAbs(f.torsion);

                        // Store diagram data arrays if available (from PyNite)
                        const diagramData = (f.x_values && f.shear_y) ? {
                            x_values: f.x_values,
                            shear_y: f.shear_y,
                            shear_z: f.shear_z || [],
                            moment_y: f.moment_y || [],
                            moment_z: f.moment_z || [],
                            axial: Array.isArray(f.axial) ? f.axial : [],
                            torsion: f.torsion || [],
                            deflection_y: f.deflection_y || [],
                            deflection_z: f.deflection_z || []
                        } : undefined;

                        memberForces.set(memberId, {
                            axial: axialVal as number,
                            shearY,
                            shearZ,
                            momentY,
                            momentZ,
                            torsion: torsionVal,
                            diagramData
                        });
                    });
                }

                setAnalysisResults({
                    displacements,
                    reactions,
                    memberForces
                });

                setAnalysisStage('complete');
                setAnalysisProgress(100);
                setAnalysisStats({
                    nodes: nodes.size,
                    members: members.size,
                    dof: result.stats?.totalDof ?? nodes.size * 3,
                    timeMs: endTime - startTime
                });
                // Show results toolbar after successful analysis
                setShowResultsToolbar(true);
                showNotification('success', 'Analysis completed successfully!');
                // setActiveStep(4); // Move to results step
            } else {
                setAnalysisStage('error');
                setAnalysisError(result.error || 'Analysis failed');
                // showNotification('error', `Analysis failed: ${result.error}`);

                // Trigger AI diagnosis for the error automatically
                // We use a custom event or store update to notify the AI assistant
                const event = new CustomEvent('ai-diagnose-error', {
                    detail: { error: result.error || 'Unknown analysis error' }
                });
                window.dispatchEvent(event);

                setIsAIAssistantOpen(true);
                showNotification('error', 'Analysis failed. AI Architect is analyzing the issue...');
            }
        } catch (err) {
            setAnalysisStage('error');
            setAnalysisError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsAnalyzingLocal(false);
            setIsAnalyzing(false);
        }
    }, [nodes, members, loads, memberLoads, setAnalysisResults, setIsAnalyzing, hasConsent]);

    // Listener for Ribbon Analysis Trigger
    useEffect(() => {
        const handleTrigger = () => handleRunAnalysis();
        const handleExport = () => setShowExportDialog(true);

        document.addEventListener('trigger-analysis', handleTrigger);
        document.addEventListener('trigger-export', handleExport);

        return () => {
            document.removeEventListener('trigger-analysis', handleTrigger);
            document.removeEventListener('trigger-export', handleExport);
        };
    }, [handleRunAnalysis]);

    // Close progress modal and show results
    const handleCloseProgressModal = useCallback(() => {
        setShowProgressModal(false);
        if (analysisStage === 'complete') {
            setCategory('ANALYSIS');
        }
    }, [analysisStage, setCategory]);

    // Workflow state
    // const [activeStep, setActiveStep] = useState(0); // Removed
    // const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Removed

    // Quick start modal
    // const [showQuickStart, setShowQuickStart] = useState(false); // Moved to top

    // Tutorial overlay for first-time users
    const [showTutorial, setShowTutorial] = useState(false);

    // Legal consent state
    // const { hasConsent } = useCheckLegalConsent(); // Moved to top
    // const [showLegalConsent, setShowLegalConsent] = useState(false); // Moved to top

    // Modal states from uiStore (for cross-component access)
    const modals = useUIStore((s) => s.modals);
    // const openModal = useUIStore((s) => s.openModal); // Moved to top
    const closeModal = useUIStore((s) => s.closeModal);

    // Alias modal states for cleaner code
    const showStructureWizard = modals.structureWizard;
    const showFoundationDesign = modals.foundationDesign;
    const showIS875Load = modals.is875Load;
    const showGeometryTools = modals.geometryTools;
    const showInterop = modals.interoperability;
    const showRailwayBridge = modals.railwayBridge;
    const showLoadingManager = modals.loadDialog;

    const loadStructure = useModelStore((state) => state.loadStructure);

    // UDL Load Dialog state
    const [showLoadDialog, setShowLoadDialog] = useState(false);
    const [loadDialogMemberId, setLoadDialogMemberId] = useState<string | undefined>();
    const selectedIds = useModelStore((state) => state.selectedIds);
    const activeTool = useModelStore((state) => state.activeTool);

    // Quick Commands Toolbar (Spacebar)
    const quickCommandActions = {
        onAddNode: () => useModelStore.getState().setTool('node'),
        onAddBeam: () => useModelStore.getState().setTool('member'),
        onAddLoad: () => openModal('loadDialog'),
        onAssignSection: () => openModal('structureWizard'),
        onAssignSupport: () => useModelStore.getState().setTool('support'),
        onRunAnalysis: handleRunAnalysis,
        onFitView: () => document.dispatchEvent(new CustomEvent('fit-view')),
        onToggleGrid: () => document.dispatchEvent(new CustomEvent('toggle-grid')),
        onSelect: () => useModelStore.getState().setTool('select'),
        onMove: () => useModelStore.getState().setTool('select'),
    };
    const { QuickCommandsToolbar } = useQuickCommands(getDefaultQuickCommands(quickCommandActions));

    // Context Menu (Right-click)
    const contextMenu = useContextMenu();

    // Track previous selection to avoid reopening dialog on same member
    const previousSelectionRef = useRef<string | undefined>();

    // Watch for member selection when memberLoad tool is active
    useEffect(() => {
        if (activeTool === 'memberLoad' && selectedIds.size === 1) {
            const selectedId = Array.from(selectedIds)[0];
            // Check if it's a member (not a node) and not the same as previous selection
            // Use members.has() to verify it's a member, not a node
            if (selectedId && members.has(selectedId) && selectedId !== previousSelectionRef.current) {
                previousSelectionRef.current = selectedId;
                setLoadDialogMemberId(selectedId);
                setShowLoadDialog(true);
            }
        } else {
            // Reset previous selection when tool changes or selection is cleared
            previousSelectionRef.current = undefined;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIds, activeTool]); // Don't depend on members - it only changes when members are added/removed

    // Show quick start on first load if model is empty
    useEffect(() => {
        if (nodes.size === 0 && members.size === 0) {
            const timer = setTimeout(() => setShowQuickStart(true), 500);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [nodes.size, members.size]);

    // URL Parameter Handling - Connect Capabilities page to dialogs
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const mode = searchParams.get('mode');
        const tool = searchParams.get('tool');
        const code = searchParams.get('code');
        const panel = searchParams.get('panel');
        const exportType = searchParams.get('export');
        const type = searchParams.get('type');

        // Handle tool-specific dialogs
        if (tool === 'foundation') {
            openModal('foundationDesign');
            return;
        }
        if (mode === 'loading' || tool === 'wind' || tool === 'seismic' || tool === 'combinations') {
            openModal('is875Load');
            return;
        }
        if (panel === 'templates' || tool === 'architect') {
            openModal('structureWizard');
            return;
        }
        if (tool === 'geometry' || mode === 'geometry') {
            openModal('geometryTools');
            return;
        }
        if (exportType || tool === 'import' || tool === 'export') {
            openModal('interoperability');
            return;
        }

        // Handle analysis types - run analysis
        if (mode === 'analysis' && type) {
            // Trigger analysis workflow
            setShowProgressModal(true);
            handleRunAnalysis();
        }

        // Handle AI mode
        if (mode === 'ai') {
            // Would open AI Command Center
            setShowQuickStart(true);
        }

        // Handle design codes
        if (mode === 'design' && code) {
            // Open design panel with specific code
            setShowQuickStart(true);
        }
    }, [searchParams, openModal, handleRunAnalysis]);

    // Handle step click
    // const handleStepClick = useCallback((step: number) => { // Removed
    //     setActiveStep(step);
    //     // Switch to appropriate category
    //     const category = STEP_TO_CATEGORY[step];
    //     if (category) {
    //         setCategory(category);
    //     }
    // }, [setCategory]);

    return (
        <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
            {/* Top Bar - Minimal Header */}
            <header className="h-8 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 flex-shrink-0 select-none">
                {/* Logo Area */}
                <div className="flex items-center gap-2">
                    <span className="text-xl text-blue-500">⬡</span>
                    <span className="font-bold text-sm tracking-tight">BeamLab <span className="text-xs font-normal text-zinc-500">ULTIMATE</span></span>
                </div>

                {/* Window Controls / User */}
                <div className="flex items-center gap-3">

                    <span className="text-xs text-zinc-600">v24.01.00</span>
                </div>
            </header>

            {/* Main Application Layout (Flex Row) */}
            <div className="flex-1 flex overflow-hidden">

                {/* 1. Workflow Sidebar (Left) */}
                <div className="w-48 flex-shrink-0 h-full z-20 shadow-xl">
                    <WorkflowSidebar
                        activeCategory={activeCategory}
                        onCategoryChange={setCategory}
                    />
                </div>

                {/* 2. Main Workspace (Ribbon + Canvas) */}
                <div className="flex-1 flex flex-col min-w-0">

                    {/* Top Ribbon */}
                    <div className="flex-shrink-0 z-10 shadow-md">
                        <EngineeringRibbon activeCategory={activeCategory} />
                    </div>

                    {/* 3D Canvas Area */}
                    <div
                        className="flex-1 bg-zinc-900 relative"
                        onContextMenu={(e) => {
                            // Determine what was clicked and show appropriate context menu
                            const selectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : undefined;
                            if (selectedId && nodes.has(selectedId)) {
                                contextMenu.show(e, getNodeContextMenuItems(selectedId, {
                                    onEdit: () => { },
                                    onAddBeamFrom: () => useModelStore.getState().setTool('member'),
                                    onAssignSupport: () => useModelStore.getState().setTool('support'),
                                    onAssignLoad: () => openModal('loadDialog'),
                                    onDelete: () => useModelStore.getState().removeNode(selectedId)
                                }));
                            } else if (selectedId && members.has(selectedId)) {
                                contextMenu.show(e, getMemberContextMenuItems(selectedId, {
                                    onEdit: () => { },
                                    onAssignSection: () => openModal('structureWizard'),
                                    onAssignMaterial: () => { },
                                    onInsertNode: () => { },
                                    onSplit: () => { },
                                    onAssignLoad: () => openModal('loadDialog'),
                                    onReleases: () => { },
                                    onDelete: () => useModelStore.getState().removeMember(selectedId)
                                }));
                            } else {
                                contextMenu.show(e, getEmptyContextMenuItems({
                                    onAddNodeHere: () => useModelStore.getState().setTool('node'),
                                    onPaste: () => { },
                                    onFitView: () => document.dispatchEvent(new CustomEvent('fit-view')),
                                    onToggleGrid: () => document.dispatchEvent(new CustomEvent('toggle-grid')),
                                    onViewSettings: () => { }
                                }));
                            }
                        }}
                    >
                        <ViewportManager />

                        {/* Status Bar Overlay */}
                        <div className="absolute bottom-0 w-full z-10">
                            <StatusBar isAnalyzing={isAnalyzing} />
                        </div>
                    </div>
                </div>

                {/* 3. Right Inspector Panel (Context Aware) */}
                <InspectorPanel
                    collapsed={inspectorCollapsed}
                    onToggle={() => setInspectorCollapsed(!inspectorCollapsed)}
                />
            </div>

            {/* Modals & Overlays */}

            {/* Modals & Overlays */}

            {notification?.show && (
                <ActionToast
                    message={notification.message}
                    type={notification.type as any}
                    onClose={hideNotification}
                />
            )}

            <ExportDialog
                isOpen={showExportDialog}
                onClose={() => setShowExportDialog(false)}
            />

            {showProgressModal && (
                <AnalysisProgressModal
                    isOpen={showProgressModal}
                    stage={analysisStage}
                    progress={analysisProgress}
                    error={analysisError}
                    onClose={() => setShowProgressModal(false)}
                    stats={analysisStats}
                />
            )}

            {/* Results Toolbar - Shows after successful analysis */}
            {showResultsToolbar && analysisResults && (
                <ResultsToolbar onClose={() => setShowResultsToolbar(false)} />
            )}

            {showQuickStart && (
                <QuickStartModal
                    isOpen={showQuickStart}
                    onClose={() => setShowQuickStart(false)}
                    onNewProject={handleNewProject}
                    onOpenWizard={() => openModal('structureWizard')}
                    onOpenFoundation={() => openModal('foundationDesign')}
                    onOpenLoads={() => openModal('is875Load')}
                />
            )}

            {/* Project Details Dialog */}
            <ProjectDetailsDialog
                isOpen={showProjectDetails}
                onClose={() => setShowProjectDetails(false)}
                onSave={handleProjectSave}
                isNewProject={isNewProject}
            />

            {/* Checkpoint Legal Modals for different actions */}
            {showLegalConsent && (
                <CheckpointLegalModal
                    open={showLegalConsent}
                    checkpointType={currentCheckpointType}
                    onAccept={() => {
                        setShowLegalConsent(false);

                        // Record consent and execute pending action
                        if (pendingAction === 'analysis') {
                            consentService.recordConsent(`user-${Date.now()}`, 'analysis');
                            setTimeout(() => executeAnalysis(), 100);
                        } else if (pendingAction === 'design') {
                            consentService.recordConsent(`user-${Date.now()}`, 'design');
                            // Trigger design check
                            document.dispatchEvent(new CustomEvent('trigger-design'));
                        } else if (pendingAction === 'pdf_export') {
                            consentService.recordConsent(`user-${Date.now()}`, 'pdf_export');
                            // Trigger PDF export
                            document.dispatchEvent(new CustomEvent('trigger-pdf-export'));
                        }
                        setPendingAction(null);
                    }}
                    onDecline={() => {
                        setShowLegalConsent(false);
                        setPendingAction(null);
                        showNotification('info', `${currentCheckpointType} requires legal consent to proceed`);
                    }}
                    canClose={true}
                />
            )}

            {/* Global Dialogs triggered by Ribbon */}
            <StructureWizard isOpen={useUIStore.getState().modals.structureWizard} onClose={() => useUIStore.getState().closeModal('structureWizard')} onGenerate={(structure) => {
                // Convert generated structure to model format
                const nodes: Node[] = structure.nodes.map(n => ({
                    id: n.id,
                    x: n.x,
                    y: n.y,
                    z: n.z,
                    restraints: n.restraints
                }));
                const members: Member[] = structure.members.map(m => ({
                    id: m.id,
                    startNodeId: m.startNodeId,
                    endNodeId: m.endNodeId,
                    sectionId: 'ISMB300'
                }));
                loadStructure(nodes, members);
                closeModal('structureWizard');
            }}
            />

            {/* Foundation Design Dialog */}
            <FoundationDesignDialog
                isOpen={showFoundationDesign}
                onClose={() => closeModal('foundationDesign')}
            />

            {/* IS 875 Load Generator Dialog */}
            <IS875LoadDialog
                isOpen={showIS875Load}
                onClose={() => closeModal('is875Load')}
            />

            {/* Geometry Tools Panel */}
            <GeometryToolsPanel
                isOpen={showGeometryTools}
                onClose={() => closeModal('geometryTools')}
            />

            {/* Import/Export Dialog */}
            <InteroperabilityDialog
                isOpen={showInterop}
                onClose={() => closeModal('interoperability')}
            />

            {/* Railway Bridge Design Dialog */}
            <RailwayBridgeDialog
                isOpen={showRailwayBridge}
                onClose={() => closeModal('railwayBridge')}
            />

            {/* FEA Meshing Panel */}
            <MeshingPanel
                isOpen={modals.meshing}
                onClose={() => closeModal('meshing')}
            />

            {/* Comprehensive Loading Manager */}
            <LoadDialog
                isOpen={showLoadingManager}
                onClose={() => closeModal('loadDialog')}
            />

            {/* Wind Load Generator (IS 875) */}
            <WindLoadDialog />

            {/* Seismic Load Generator (IS 1893) */}
            <SeismicLoadDialog />

            {/* Moving Load Analysis (IRC 6 / AASHTO) */}
            <MovingLoadDialog />

            {/* Advanced Analysis Dialog (P-Delta, Modal, Buckling, Spectrum) */}
            <AdvancedAnalysisDialog
                isOpen={modals.advancedAnalysis}
                onClose={() => closeModal('advancedAnalysis')}
            />

            {/* Design Codes Dialog */}
            <DesignCodesDialog
                isOpen={modals.designCodes}
                onClose={() => closeModal('designCodes')}
            />

            {/* ASCE 7 Seismic Load Generator */}
            <ASCE7SeismicLoadDialog />

            {/* ASCE 7 Wind Load Generator */}
            <ASCE7WindLoadDialog />

            {/* Load Combinations Dialog */}
            <LoadCombinationsDialog />

            {/* Legal Consent Modal - Required before analysis */}
            <LegalConsentModal
                open={showLegalConsent}
                onAccept={() => {
                    setShowLegalConsent(false);
                    // Re-run analysis after consent is given
                    setTimeout(() => handleRunAnalysis(), 100);
                }}
                canClose={false}
            />

            {/* Validation Error Display */}
            {showValidationErrors && validationErrors && (
                <ValidationErrorDisplay
                    results={validationErrors}
                    onDismiss={() => {
                        setShowValidationErrors(false);
                        setValidationErrors(null);
                    }}
                    onAutoFix={(issue) => {
                        // TODO: Implement auto-fix functionality
                        console.log('Auto-fix for issue:', issue);
                    }}
                />
            )}

            {/* AI Assistant Components */}
            <AIAssistantChat
                isOpen={isAIAssistantOpen}
                onClose={() => setIsAIAssistantOpen(false)}
            />
            <AIAssistantButton
                onClick={() => setIsAIAssistantOpen(!isAIAssistantOpen)}
            />
        </div>
    );
};

export default ModernModeler;
