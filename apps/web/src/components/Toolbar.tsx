
import { FC, useState } from 'react';
import { useModelStore } from '../store/model';
import { runLocalAnalysis } from '../api/localAnalysis';
import { ReportGenerator } from '../utils/ReportGenerator';

export const Toolbar: FC = () => {
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

    const handleAnalyze = () => {
        setMessage(null);
        const result = runLocalAnalysis();
        setMessage(result.message);
        setTimeout(() => setMessage(null), 5000);
    };

    const handleExportPDF = () => {
        // Find canvas element
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        const screenshot = ReportGenerator.captureCanvas(canvas);

        const report = new ReportGenerator({
            projectName: 'Structural Analysis',
            company: 'BeamLab Ultimate',
        });
        report.generateReport(screenshot);
        setMessage('PDF Report generated ✓');
        setTimeout(() => setMessage(null), 3000);
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

