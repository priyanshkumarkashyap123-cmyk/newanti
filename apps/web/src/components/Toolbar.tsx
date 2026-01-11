
import { FC, useState } from 'react';
import { useModelStore } from '../store/model';
import useStructuralSolver from '../hooks/useStructuralSolver';
import { ReportGenerator } from '../utils/ReportGenerator';
import { useIsSignedIn } from '../providers/AuthProvider';
import { useSubscription } from '../hooks/useSubscription';
import { PlateCreationDialog } from './dialogs/PlateCreationDialog';

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
    const { undo, redo, pastStates, futureStates } = useModelStore.temporal.getState();
    const [message, setMessage] = useState<string | null>(null);
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
    const [showPlateDialog, setShowPlateDialog] = useState(false);

    // Subscription for feature gating
    const { subscription, canAccess } = useSubscription();

    const { analyze, prepareModel } = useStructuralSolver();

    const handleAnalyze = async () => {
        // Security: Require login before analysis
        if (!isSignedIn) {
            const shouldLogin = window.confirm(
                '🔒 Sign in required\n\nPlease sign in to run structural analysis.\n\nClick OK to go to login page.'
            );
            if (shouldLogin) {
                window.location.href = '/sign-in';
            }
            return;
        }

        setMessage(null);
        // Sync store loading state
        useModelStore.getState().setIsAnalyzing(true);

        try {
            // 1. Prepare Data
            // We need to capture the arrays used for input so we can map results back correctly
            // (Worker returns arrays, we need Maps with IDs)
            const state = useModelStore.getState();
            const nodesArray = Array.from(state.nodes.values());
            const membersArray = Array.from(state.members.values());
            const loadsArray = state.loads;

            const modelData = prepareModel(
                nodesArray,
                membersArray,
                loadsArray
            );

            // 2. Run Analysis (Worker)
            const result = await analyze(modelData, (progress) => {
                setMessage(`${progress.message} (${progress.percent}%)`);
            });

            if (result.success && result.displacements) {
                // 3. Map Results back to Store format
                // Displacements key: nodeId -> { dx, dy, ... }
                const displacementMap = new Map();
                const reactionMap = new Map(); // TODO: Worker should calculate reactions

                // The worker preserves node order from input array
                nodesArray.forEach((node, index) => {
                    const offset = index * 6; // 6 DOF
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

                    // Placeholders for reactions (if calculated)
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

                // Member Forces (if computed)
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

                setMessage(`✅ Analysis Complete! (${result.stats.totalTimeMs.toFixed(0)}ms)`);
                state.setShowResults(true);
                state.setShowDeflectedShape(true);
            } else {
                throw new Error(result.error || 'Unknown analysis error');
            }

        } catch (error) {
            console.error('Analysis failed:', error);
            setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Analysis failed'}`);
        } finally {
            useModelStore.getState().setIsAnalyzing(false);
            setTimeout(() => {
                if (message?.startsWith('✅')) setMessage(null);
            }, 5000);
        }
    };

    const handleExportPDF = () => {
        // Feature gate: PDF export requires Pro subscription
        // Skip check if still loading subscription status
        if (!subscription.isLoading && !canAccess('pdfExport')) {
            // Show limited export for free users
            const shouldUpgrade = window.confirm(
                '📄 PDF Export - Pro Feature\n\n' +
                'Full PDF reports with calculations require a Pro subscription.\n\n' +
                'Free tier users can view results on screen.\n\n' +
                'Click OK to view pricing, or Cancel to continue.'
            );
            if (shouldUpgrade) {
                window.location.href = '/pricing';
            }
            return;
        }

        // Check if analysis has been run
        if (!analysisResults) {
            if (!window.confirm('No analysis results found. Run analysis before exporting for a complete report.\n\nExport anyway?')) {
                return;
            }
        } else {
            // Prompt to save before export
            if (!window.confirm('Export PDF Report?\n\nThis will generate a BeamLab Ultimate report with your analysis results.')) {
                return;
            }
        }

        // Find canvas element
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        const screenshot = ReportGenerator.captureCanvas(canvas);

        const report = new ReportGenerator({
            projectName: 'Structural Analysis',
            company: 'BeamLab Ultimate',
        });
        report.generateReport(screenshot);
        setMessage('✅ PDF Report exported: BeamLab_Ultimate_Report.pdf');
        setTimeout(() => setMessage(null), 4000);
    };

    const getBtnStyle = (isActive: boolean) => ({
        ...btnStyle,
        background: isActive ? '#007bff' : 'rgba(255, 255, 255, 0.1)',
        borderColor: isActive ? '#007bff' : 'rgba(255, 255, 255, 0.2)',
    });

    const getToggleBtnStyle = (isActive: boolean) => ({
        ...btnStyle,
        background: isActive ? '#9333ea' : 'rgba(255, 255, 255, 0.1)',
        borderColor: isActive ? '#9333ea' : 'rgba(255, 255, 255, 0.2)',
    });

    return (
        <>
            {message && (
                <div style={{
                    position: 'absolute',
                    bottom: 80,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: message.includes('✓') ? '#2e7d32' : '#c62828',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    zIndex: 300
                }}>
                    {message}
                </div>
            )}

            {/* Displacement Scale Slider - Show only when results exist */}
            {analysisResults && (
                <div style={{
                    position: 'absolute',
                    bottom: 80,
                    right: 20,
                    zIndex: 200,
                    background: 'rgba(0, 0, 0, 0.8)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <label style={{ color: 'white', fontSize: '12px', fontWeight: 500 }}>
                        📏 Deflection Scale: {displacementScale}x
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="500"
                        value={displacementScale}
                        onChange={(e) => setDisplacementScale(Number(e.target.value))}
                        style={{ width: 150, cursor: 'pointer' }}
                    />
                </div>
            )}

            <div style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 200,
                display: 'flex',
                gap: '10px',
                background: 'rgba(0, 0, 0, 0.8)',
                padding: '10px 20px',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => undo()} disabled={pastStates.length === 0} style={{ ...btnStyle, opacity: pastStates.length === 0 ? 0.5 : 1 }}>Undo</button>
                    <button onClick={() => redo()} disabled={futureStates.length === 0} style={{ ...btnStyle, opacity: futureStates.length === 0 ? 0.5 : 1 }}>Redo</button>
                </div>

                <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />

                {/* Modeling Tools */}
                <button onClick={() => setTool('select')} style={getBtnStyle(activeTool === 'select')}>👆 Select</button>
                <button onClick={() => setTool('node')} style={getBtnStyle(activeTool === 'node')}>● Node</button>
                <button onClick={() => setTool('member')} style={getBtnStyle(activeTool === 'member')}>╱ Member</button>
                <button onClick={() => setShowPlateDialog(true)} style={{ ...btnStyle, background: '#7c3aed', borderColor: '#6d28d9' }}>▢ Plate</button>

                <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />

                {/* Boundary & Loads */}
                <button onClick={() => setTool('support')} style={getBtnStyle(activeTool === 'support')}>📌 Support</button>
                <button onClick={() => setTool('load')} style={getBtnStyle(activeTool === 'load')}>⬇️ Node Load</button>
                <button onClick={() => setTool('memberLoad')} style={getBtnStyle(activeTool === 'memberLoad')}>〰️ UDL/UVL</button>

                <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />

                {/* Analysis */}
                <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    style={{ ...btnStyle, background: '#4caf50', borderColor: '#388e3c', opacity: isAnalyzing ? 0.5 : 1 }}
                >
                    {isAnalyzing ? '⏳...' : '▶️ Run Analysis'}
                </button>

                {/* Post-processing - Show only when results exist */}
                {analysisResults && (
                    <>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />

                        {/* Diagram Toggles */}
                        <button onClick={() => setShowSFD(!showSFD)} style={getToggleBtnStyle(showSFD)}>
                            📊 SFD
                        </button>
                        <button onClick={() => setShowBMD(!showBMD)} style={getToggleBtnStyle(showBMD)}>
                            📈 BMD
                        </button>
                        <button onClick={() => setShowResults(!showResults)} style={getToggleBtnStyle(showResults)}>
                            📋 Results
                        </button>

                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />

                        {/* Export */}
                        <button onClick={handleExportPDF} style={{ ...btnStyle, background: '#2563eb', borderColor: '#1d4ed8' }}>
                            📄 PDF
                        </button>
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

// Styles
const btnStyle = {
    background: '#333',
    color: 'white',
    border: '1px solid #555',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s'
};

