
import { FC, useState, useCallback, memo } from 'react';
import {
    MousePointer2,
    Circle,
    Minus,
    Square,
    Anchor,
    ArrowDown,
    Waves,
    Play,
    Loader2,
    BarChart3,
    TrendingUp,
    Table2,
    FileText,
    Undo2,
    Redo2,
    SlidersHorizontal,
} from 'lucide-react';
import { useModelStore, useModelStoreTemporal } from '../store/model';
import useStructuralSolver from '../hooks/useStructuralSolver';
import { ReportGenerator } from '../utils/ReportGenerator';
import { useIsSignedIn } from '../providers/AuthProvider';
import { useSubscription } from '../hooks/useSubscription';
import { PlateCreationDialog } from './dialogs/PlateCreationDialog';
import { useConfirm } from './ui/ConfirmDialog';

// ============================================
// TOOL BUTTON COMPONENT
// ============================================
interface ToolBtnProps {
    icon: FC<{ className?: string }>;
    label: string;
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    variant?: 'default' | 'primary' | 'success' | 'purple' | 'danger';
    shortcut?: string;
}

const ToolBtn = memo<ToolBtnProps>(({
    icon: Icon, label, onClick, isActive = false, disabled = false,
    variant = 'default', shortcut,
}) => {
    const variantClasses: Record<string, string> = {
        default: isActive
            ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm shadow-blue-500/10'
            : 'bg-slate-100/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white hover:border-slate-600/60',
        primary: isActive
            ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
            : 'bg-blue-600/80 text-white border-blue-500/60 hover:bg-blue-500 hover:shadow-md hover:shadow-blue-500/30',
        success: 'bg-emerald-600 text-white border-emerald-500/60 hover:bg-emerald-500 shadow-sm shadow-emerald-600/20 hover:shadow-md hover:shadow-emerald-500/30',
        purple: isActive
            ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 shadow-sm shadow-purple-500/10'
            : 'bg-purple-600/80 text-white border-purple-500/60 hover:bg-purple-500',
        danger: 'bg-red-600/80 text-white border-red-500/60 hover:bg-red-500',
    };

    return (
        <button type="button"
            onClick={onClick}
            disabled={disabled}
            title={shortcut ? `${label} (${shortcut})` : label}
            aria-label={shortcut ? `${label} (${shortcut})` : label}
            className={`
                inline-flex items-center gap-1.5 px-3 py-2 rounded-lg
                text-xs font-medium border transition-all duration-150
                active:scale-[0.97] select-none
                disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                ${variantClasses[variant]}
            `}
        >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">{label}</span>
        </button>
    );
});
ToolBtn.displayName = 'ToolBtn';

// ============================================
// SEPARATOR
// ============================================
const ToolSep: FC = () => (
    <div className="w-px h-7 bg-slate-200/50 dark:bg-slate-700/50 mx-0.5 flex-shrink-0" />
);

// ============================================
// MAIN TOOLBAR
// ============================================

export const Toolbar: FC = () => {
    const isSignedIn = useIsSignedIn();
    const activeTool = useModelStore((state) => state.activeTool);
    const setTool = useModelStore((state) => state.setTool);
    const isAnalyzing = useModelStore((state) => state.isAnalyzing);
    const analysisResults = useModelStore((state) => state.analysisResults);
    const displacementScale = useModelStore((state) => state.displacementScale);
    const setDisplacementScale = useModelStore((state) => state.setDisplacementScale);
    const showSFD = useModelStore((state) => state.showSFD);
    const showBMD = useModelStore((state) => state.showBMD);
    const showResults = useModelStore((state) => state.showResults);
    const setShowSFD = useModelStore((state) => state.setShowSFD);
    const setShowBMD = useModelStore((state) => state.setShowBMD);
    const setShowResults = useModelStore((state) => state.setShowResults);
    const { undo, redo, pastStates, futureStates } = useModelStoreTemporal.getState();
    const [message, setMessage] = useState<string | null>(null);
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
    const [showPlateDialog, setShowPlateDialog] = useState(false);

    // Subscription for feature gating
    const { subscription, canAccess } = useSubscription();
    const confirm = useConfirm();

    const { analyze, prepareModel } = useStructuralSolver();

    const handleAnalyze = useCallback(async () => {
        // Security: Require login before analysis
        if (!isSignedIn) {
            const shouldLogin = await confirm({
                title: 'Sign In Required',
                message: 'Please sign in to run structural analysis.',
                confirmText: 'Go to Login',
                cancelText: 'Cancel',
                variant: 'info',
            });
            if (shouldLogin) {
                window.location.href = '/sign-in';
            }
            return;
        }

        setMessage(null);
        useModelStore.getState().setIsAnalyzing(true);

        try {
            const state = useModelStore.getState();
            const nodesArray = Array.from(state.nodes.values());
            const membersArray = Array.from(state.members.values());
            const loadsArray = state.loads;

            const modelData = prepareModel(nodesArray, membersArray, loadsArray);

            const result = await analyze(modelData, (progress) => {
                setMessage(`${progress.message} (${progress.percent}%)`);
            });

            if (result.success && result.displacements) {
                const displacementMap = new Map();
                const reactionMap = new Map();

                nodesArray.forEach((node, index) => {
                    const offset = index * 6;
                    if (result.displacements && offset < result.displacements.length) {
                        displacementMap.set(node.id, {
                            dx: result.displacements[offset + 0] || 0,
                            dy: result.displacements[offset + 1] || 0,
                            dz: result.displacements[offset + 2] || 0,
                            rx: result.displacements[offset + 3] || 0,
                            ry: result.displacements[offset + 4] || 0,
                            rz: result.displacements[offset + 5] || 0
                        });
                    }
                    if (result.reactions && offset < result.reactions.length) {
                        reactionMap.set(node.id, {
                            fx: result.reactions[offset + 0] || 0,
                            fy: result.reactions[offset + 1] || 0,
                            fz: result.reactions[offset + 2] || 0,
                            mx: result.reactions[offset + 3] || 0,
                            my: result.reactions[offset + 4] || 0,
                            mz: result.reactions[offset + 5] || 0
                        });
                    }
                });

                const memberForcesMap = new Map();
                if (result.memberForces && Array.isArray(result.memberForces)) {
                    result.memberForces.forEach((mf: any) => {
                        memberForcesMap.set(mf.id, mf);
                    });
                }

                state.setAnalysisResults({
                    displacements: displacementMap,
                    reactions: reactionMap,
                    memberForces: memberForcesMap
                });

                setMessage(`Analysis Complete — ${result.stats.totalTimeMs.toFixed(0)}ms`);
                state.setShowResults(true);
                state.setShowDeflectedShape(true);
            } else {
                throw new Error(result.error || 'Unknown analysis error');
            }
        } catch (error) {
            console.error('Analysis failed:', error);
            setMessage(`Error: ${error instanceof Error ? error.message : 'Analysis failed'}`);
        } finally {
            useModelStore.getState().setIsAnalyzing(false);
            setTimeout(() => {
                setMessage((prev) => prev?.startsWith('Analysis Complete') ? null : prev);
            }, 5000);
        }
    }, [isSignedIn, analyze, prepareModel]);

    const handleExportPDF = useCallback(async () => {
        if (!subscription.isLoading && !canAccess('pdfExport')) {
            const shouldUpgrade = await confirm({
                title: 'PDF Export — Pro Feature',
                message: 'Full PDF reports with calculations require a Pro subscription. Free tier users can view results on screen.',
                confirmText: 'View Pricing',
                cancelText: 'Cancel',
                variant: 'warning',
            });
            if (shouldUpgrade) window.location.href = '/pricing';
            return;
        }

        if (!analysisResults) {
            const proceed = await confirm({
                title: 'No Analysis Results',
                message: 'No analysis results found. Run analysis before exporting for a complete report. Export anyway?',
                confirmText: 'Export Anyway',
                cancelText: 'Cancel',
                variant: 'warning',
            });
            if (!proceed) return;
        } else {
            const proceed = await confirm({
                title: 'Export PDF Report',
                message: 'This will generate a professional report with your analysis results.',
                confirmText: 'Export',
                cancelText: 'Cancel',
                variant: 'info',
            });
            if (!proceed) return;
        }

        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        const screenshot = ReportGenerator.captureCanvas(canvas);

        const report = await ReportGenerator.create({
            projectName: 'Structural Analysis',
            company: 'BeamLab',
        });
        report.generateReport(screenshot);
        setMessage('PDF Report exported successfully');
        setTimeout(() => setMessage(null), 4000);
    }, [subscription, canAccess, analysisResults]);

    const isSuccess = message?.startsWith('Analysis Complete') || message?.startsWith('PDF');
    const isError = message?.startsWith('Error');

    return (
        <>
            {/* Status Message Toast */}
            {message && (
                <div
                    role="alert"
                    aria-live="assertive"
                    className={`
                    absolute bottom-20 left-1/2 -translate-x-1/2 z-[300]
                    px-4 py-2.5 rounded-lg text-sm font-medium
                    shadow-lg border backdrop-blur-sm
                    animate-fade-in
                    ${isSuccess
                        ? 'bg-emerald-900/90 text-emerald-200 border-emerald-700/50'
                        : isError
                            ? 'bg-red-900/90 text-red-200 border-red-700/50'
                            : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-200 border-slate-200/50 dark:border-slate-700/50'
                    }
                `}>
                    {message}
                </div>
            )}

            {/* Displacement Scale Slider */}
            {analysisResults && (
                <div className="absolute bottom-20 right-5 z-[200] bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                        <label htmlFor="deflection-scale" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                            Deflection Scale
                        </label>
                        <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded" aria-live="polite">
                            {displacementScale}×
                        </span>
                    </div>
                    <input
                        id="deflection-scale"
                        type="range"
                        min="1"
                        max="500"
                        value={displacementScale}
                        aria-valuemin={1}
                        aria-valuemax={500}
                        aria-valuenow={displacementScale}
                        aria-label={`Deflection scale: ${displacementScale}x`}
                        onChange={(e) => setDisplacementScale(Number(e.target.value))}
                        className="w-40 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500
                                   [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-blue-500/30
                                   [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all
                                   [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-webkit-slider-thumb]:hover:scale-110"
                    />
                </div>
            )}

            {/* Main Floating Toolbar */}
            <div
                role="toolbar"
                aria-label="Modeling tools"
                className="
                absolute bottom-5 left-1/2 -translate-x-1/2 z-[200]
                flex items-center gap-1.5
                bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md
                px-4 py-2.5 rounded-2xl
                shadow-2xl shadow-black/40
                border border-slate-200/40 dark:border-slate-700/40
                ring-1 ring-white/[0.03]
            ">
                {/* Undo / Redo */}
                <div className="flex items-center gap-1">
                    <button type="button"
                        onClick={() => undo()}
                        disabled={pastStates.length === 0}
                        title="Undo (Ctrl+Z)"
                        aria-label="Undo"
                        className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-700/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Undo2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button type="button"
                        onClick={() => redo()}
                        disabled={futureStates.length === 0}
                        title="Redo (Ctrl+Shift+Z)"
                        aria-label="Redo"
                        className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-700/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Redo2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                <ToolSep />

                {/* Modeling Tools */}
                <ToolBtn icon={MousePointer2} label="Select" onClick={() => setTool('select')} isActive={activeTool === 'select'} shortcut="V" />
                <ToolBtn icon={Circle} label="Node" onClick={() => setTool('node')} isActive={activeTool === 'node'} shortcut="N" />
                <ToolBtn icon={Minus} label="Member" onClick={() => setTool('member')} isActive={activeTool === 'member'} shortcut="M" />
                <ToolBtn icon={Square} label="Plate" onClick={() => setShowPlateDialog(true)} variant="purple" shortcut="P" />

                <ToolSep />

                {/* Boundary & Loads */}
                <ToolBtn icon={Anchor} label="Support" onClick={() => setTool('support')} isActive={activeTool === 'support'} shortcut="S" />
                <ToolBtn icon={ArrowDown} label="Node Load" onClick={() => setTool('load')} isActive={activeTool === 'load'} shortcut="L" />
                <ToolBtn icon={Waves} label="UDL/UVL" onClick={() => setTool('memberLoad')} isActive={activeTool === 'memberLoad'} shortcut="U" />

                <ToolSep />

                {/* Analysis */}
                <ToolBtn
                    icon={isAnalyzing ? Loader2 : Play}
                    label={isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    variant="success"
                    shortcut="F5"
                />

                {/* Post-processing */}
                {analysisResults && (
                    <>
                        <ToolSep />
                        <ToolBtn icon={BarChart3} label="SFD" onClick={() => setShowSFD(!showSFD)} isActive={showSFD} variant={showSFD ? 'purple' : 'default'} />
                        <ToolBtn icon={TrendingUp} label="BMD" onClick={() => setShowBMD(!showBMD)} isActive={showBMD} variant={showBMD ? 'purple' : 'default'} />
                        <ToolBtn icon={Table2} label="Results" onClick={() => setShowResults(!showResults)} isActive={showResults} variant={showResults ? 'purple' : 'default'} />
                        <ToolSep />
                        <ToolBtn icon={FileText} label="PDF" onClick={handleExportPDF} variant="primary" />
                    </>
                )}
            </div>

            {/* Plate Creation Dialog */}
            <PlateCreationDialog
                isOpen={showPlateDialog}
                onClose={() => setShowPlateDialog(false)}
            />
        </>
    );
};

