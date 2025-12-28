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

import { FC, useState, useEffect, useCallback } from 'react';
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
import { useModelStore } from '../store/model';
import { SmartSidebar } from './layout/SmartSidebar';
import { ViewportManager } from './ViewportManager';
import { Toolbar } from './Toolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { ResultsTable } from './ResultsTable';

// New workflow components
import { AnalysisWorkflow } from './AnalysisWorkflow';
import { AnalysisProgressModal, type AnalysisStage } from './AnalysisProgressModal';
import { QuickStartModal } from './QuickStartModal';
import { ResultsToolbar } from './results/ResultsToolbar';
import { AICommandCenter } from './ai';
import { LoadInputDialog } from './ui/LoadInputDialog';
import { TutorialOverlay } from './TutorialOverlay';
import { StructureWizard } from './StructureWizard';
import { FoundationDesignDialog } from './FoundationDesignDialog';
import { IS875LoadDialog } from './IS875LoadDialog';
import { GeometryToolsPanel } from './GeometryToolsPanel';
import { InteroperabilityDialog } from './InteroperabilityDialog';
import type { Node, Member } from '../store/model';

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
            {notification?.show && (
                <div className={`
                    fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg
                    flex items-center gap-3 max-w-md
                    ${notification.type === 'error' ? 'bg-red-600' : ''}
                    ${notification.type === 'warning' ? 'bg-yellow-600' : ''}
                    ${notification.type === 'success' ? 'bg-green-600' : ''}
                    ${notification.type === 'info' ? 'bg-blue-600' : ''}
                `}>
                    <span className="text-white text-sm">{notification.message}</span>
                    <button
                        onClick={hideNotification}
                        className="text-white/70 hover:text-white"
                    >
                        ×
                    </button>
                </div>
            )}
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
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                    {isAnalyzing ? 'Analyzing...' : 'Ready'}
                </span>
                <span>Mode: {activeCategory}</span>
                <span>Tool: {activeTool || 'None'}</span>
            </div>
            <div className="flex items-center gap-4">
                <span>Nodes: {nodes.size}</span>
                <span>Members: {members.size}</span>
                <span>Units: kN, m</span>
                {analysisResults && (
                    <span className="text-green-400">✓ Results Available</span>
                )}
            </div>
        </div>
    );
};

// ============================================
// MAIN MODERN MODELER COMPONENT
// ============================================

export const ModernModeler: FC = () => {
    const showResults = useModelStore((state) => state.showResults);
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const loads = useModelStore((state) => state.loads);
    const memberLoads = useModelStore((state) => state.memberLoads);
    const analysisResults = useModelStore((state) => state.analysisResults);
    const setAnalysisResults = useModelStore((state) => state.setAnalysisResults);
    const setIsAnalyzing = useModelStore((state) => state.setIsAnalyzing);
    const { setCategory } = useUIStore();

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [inspectorCollapsed, setInspectorCollapsed] = useState(false);

    // Workflow state
    const [activeStep, setActiveStep] = useState(0);

    // Analysis state
    const [isAnalyzing, setIsAnalyzingLocal] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [analysisStage, setAnalysisStage] = useState<AnalysisStage>('validating');
    const [analysisError, setAnalysisError] = useState<string | undefined>();
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [analysisStats, setAnalysisStats] = useState<{ nodes: number; members: number; dof: number; timeMs: number } | undefined>();

    // Quick start modal
    const [showQuickStart, setShowQuickStart] = useState(false);

    // Tutorial overlay for first-time users
    const [showTutorial, setShowTutorial] = useState(false);

    // Modal states from uiStore (for cross-component access)
    const modals = useUIStore((s) => s.modals);
    const openModal = useUIStore((s) => s.openModal);
    const closeModal = useUIStore((s) => s.closeModal);

    // Alias modal states for cleaner code
    const showStructureWizard = modals.structureWizard;
    const showFoundationDesign = modals.foundationDesign;
    const showIS875Load = modals.is875Load;
    const showGeometryTools = modals.geometryTools;
    const showInterop = modals.interoperability;

    const loadStructure = useModelStore((state) => state.loadStructure);

    // UDL Load Dialog state
    const [showLoadDialog, setShowLoadDialog] = useState(false);
    const [loadDialogMemberId, setLoadDialogMemberId] = useState<string | undefined>();
    const selectedIds = useModelStore((state) => state.selectedIds);
    const activeTool = useModelStore((state) => state.activeTool);

    // Watch for member selection when memberLoad tool is active
    useEffect(() => {
        if (activeTool === 'memberLoad' && selectedIds.size === 1) {
            const selectedId = Array.from(selectedIds)[0];
            // Check if it's a member (not a node)
            if (selectedId && members.has(selectedId)) {
                setLoadDialogMemberId(selectedId);
                setShowLoadDialog(true);
            }
        }
    }, [selectedIds, activeTool, members]);

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
    }, [searchParams]);

    // Handle step click
    const handleStepClick = useCallback((step: number) => {
        setActiveStep(step);
        // Switch to appropriate category
        const category = STEP_TO_CATEGORY[step];
        if (category) {
            setCategory(category);
        }
    }, [setCategory]);

    // Run analysis
    const handleRunAnalysis = useCallback(async () => {
        setIsAnalyzingLocal(true);
        setIsAnalyzing(true);
        setShowProgressModal(true);
        setAnalysisStage('validating');
        setAnalysisProgress(10);
        setAnalysisError(undefined);

        try {
            // Build model data for analysis
            const modelData = {
                nodes: Array.from(nodes.values()).map(n => ({
                    id: n.id,
                    x: n.x,
                    y: n.y,
                    z: n.z,
                    restraints: n.restraints
                })),
                members: Array.from(members.values()).map(m => ({
                    id: m.id,
                    startNodeId: m.startNodeId,
                    endNodeId: m.endNodeId,
                    E: m.E ?? 200e9,
                    A: m.A ?? 0.01,
                    I: m.I ?? 1e-4
                })),
                loads: loads.map(l => ({
                    nodeId: l.nodeId,
                    fx: l.fx,
                    fy: l.fy,
                    fz: l.fz
                })),
                dofPerNode: 3 as const
            };

            const startTime = Date.now();

            // Run analysis with progress callback
            const result = await analysisService.analyze(modelData, (stage, progress) => {
                setAnalysisStage(stage as AnalysisStage);
                setAnalysisProgress(progress);
            });

            const endTime = Date.now();

            if (result.success) {
                // Convert results to store format
                const displacements = new Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>();
                const reactions = new Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>();
                const memberForces = new Map<string, { axial: number; shearY: number; shearZ: number; momentY: number; momentZ: number; torsion: number }>();

                // Parse displacements
                if (result.displacements) {
                    Object.entries(result.displacements).forEach(([nodeId, disp]) => {
                        const d = disp as number[];
                        displacements.set(nodeId, {
                            dx: d[0] ?? 0,
                            dy: d[1] ?? 0,
                            dz: d[2] ?? 0,
                            rx: d[3] ?? 0,
                            ry: d[4] ?? 0,
                            rz: d[5] ?? 0
                        });
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

                // Parse member forces
                if (result.memberForces) {
                    Object.entries(result.memberForces).forEach(([memberId, forces]) => {
                        const f = forces as { axial?: number };
                        memberForces.set(memberId, {
                            axial: f.axial ?? 0,
                            shearY: 0,
                            shearZ: 0,
                            momentY: 0,
                            momentZ: 0,
                            torsion: 0
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
                setActiveStep(4); // Move to results step
            } else {
                setAnalysisStage('error');
                setAnalysisError(result.error || 'Analysis failed');
            }
        } catch (err) {
            setAnalysisStage('error');
            setAnalysisError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsAnalyzingLocal(false);
            setIsAnalyzing(false);
        }
    }, [nodes, members, loads, setAnalysisResults, setIsAnalyzing]);

    // Close progress modal and show results
    const handleCloseProgressModal = useCallback(() => {
        setShowProgressModal(false);
        if (analysisStage === 'complete') {
            setCategory('ANALYSIS');
        }
    }, [analysisStage, setCategory]);

    return (
        <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
            {/* Top Bar - Header + Category Switcher */}
            <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 flex-shrink-0">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">⬡</span>
                        <span className="font-bold text-lg">BeamLab</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded">
                            ULTIMATE
                        </span>
                    </div>
                </div>

                {/* Category Tabs */}
                <CategorySwitcher />

                {/* Right actions */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>● {nodes.size} nodes</span>
                        <span>━ {members.size} members</span>
                        <span>↓ {loads.length + memberLoads.length} loads</span>
                    </div>
                    <button
                        onClick={() => setShowQuickStart(true)}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Quick Start"
                    >
                        <HelpCircle className="w-4 h-4" />
                    </button>
                    <button className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors">
                        ⚡ Upgrade
                    </button>
                </div>
            </header>

            {/* Workflow Stepper */}
            <AnalysisWorkflow
                activeStep={activeStep}
                onStepClick={handleStepClick}
                onRunAnalysis={handleRunAnalysis}
                isAnalyzing={isAnalyzing}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Smart Sidebar */}
                {sidebarCollapsed ? (
                    <div className="w-10 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-2 flex-shrink-0">
                        <button
                            onClick={() => setSidebarCollapsed(false)}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
                            title="Show Sidebar"
                        >
                            <PanelLeftOpen className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="w-64 flex-shrink-0 flex flex-col bg-zinc-900 border-r border-zinc-800">
                        <div className="flex items-center justify-between px-2 py-2 border-b border-zinc-800">
                            <span className="text-xs font-bold text-zinc-400 uppercase px-1">Tools</span>
                            <button
                                onClick={() => setSidebarCollapsed(true)}
                                className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded"
                                title="Hide Sidebar"
                            >
                                <PanelLeftClose className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <SmartSidebar />
                        </div>
                        {/* AI Command Center */}
                        <div className="border-t border-zinc-800">
                            <AICommandCenter />
                        </div>
                    </div>
                )}

                {/* Center - 3D Canvas */}
                <div className="flex-1 bg-zinc-950 relative">
                    <ViewportManager />
                    <Toolbar />
                </div>

                {/* Right Panel - Inspector */}
                <InspectorPanel
                    collapsed={inspectorCollapsed}
                    onToggle={() => setInspectorCollapsed(!inspectorCollapsed)}
                />
            </div>

            {/* Results Table - conditional */}
            {showResults && <ResultsTable />}

            {/* Results Toolbar - show after analysis */}
            {analysisResults && (
                <ResultsToolbar />
            )}

            {/* Bottom Bar - Status */}
            <StatusBar isAnalyzing={isAnalyzing} />

            {/* Modals */}
            <AnalysisProgressModal
                isOpen={showProgressModal}
                stage={analysisStage}
                progress={analysisProgress}
                error={analysisError}
                onClose={handleCloseProgressModal}
                stats={analysisStats}
            />

            <QuickStartModal
                isOpen={showQuickStart}
                onClose={() => setShowQuickStart(false)}
                onOpenWizard={() => openModal('structureWizard')}
                onOpenFoundation={() => openModal('foundationDesign')}
                onOpenLoads={() => openModal('is875Load')}
            />

            {/* UDL Load Dialog - opens when memberLoad tool is active and member is selected */}
            <LoadInputDialog
                isOpen={showLoadDialog}
                onClose={() => {
                    setShowLoadDialog(false);
                    setLoadDialogMemberId(undefined);
                }}
                targetMemberId={loadDialogMemberId}
            />

            {/* Tutorial Overlay for first-time users */}
            <TutorialOverlay
                isOpen={showTutorial}
                onClose={() => setShowTutorial(false)}
                onComplete={() => setShowTutorial(false)}
            />

            {/* Structure Wizard for generating parametric structures */}
            <StructureWizard
                isOpen={showStructureWizard}
                onClose={() => closeModal('structureWizard')}
                onGenerate={(structure) => {
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
        </div>
    );
};

export default ModernModeler;

