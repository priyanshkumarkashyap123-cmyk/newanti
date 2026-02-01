/**
 * GenerativeDesignPanel.tsx
 * 
 * UI component for topology optimization / generative design
 * Exposes TopologyOptimizer to users with visualization
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    TopologyOptimizer,
    createCantileverOptimizer,
    createMBBBeamOptimizer,
    OptimizationResult,
    BoundaryCondition,
    LoadCondition,
    DesignAlternative,
    OptimizationDomain
} from '../../modules/optimization/TopologyOptimizer';
import { auditTrail } from '../../services/AuditTrailService';

// ============================================
// TYPES
// ============================================

interface GenerativeDesignPanelProps {
    onDesignComplete?: (result: OptimizationResult) => void;
    initialConfig?: {
        width: number;
        height: number;
        volumeFraction: number;
    };
}

interface DesignCase {
    id: string;
    name: string;
    description: string;
    icon: string;
}

const DESIGN_CASES: DesignCase[] = [
    { id: 'cantilever', name: 'Cantilever', description: 'Fixed at left, load at right', icon: '⬛▶' },
    { id: 'mbb', name: 'MBB Beam', description: 'Simply supported with central load', icon: '◀━▶' },
    { id: 'lbracket', name: 'L-Bracket', description: 'Fixed at top, load at side', icon: '⌐' },
    { id: 'custom', name: 'Custom', description: 'Define your own boundary conditions', icon: '✏️' },
];

// ============================================
// DENSITY VISUALIZATION
// ============================================

const DensityVisualization: React.FC<{
    densities: number[][];
    width: number;
    height: number;
}> = ({ densities, width, height }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !densities.length) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const nelx = densities[0].length;
        const nely = densities.length;
        const cellWidth = width / nelx;
        const cellHeight = height / nely;

        ctx.clearRect(0, 0, width, height);

        for (let j = 0; j < nely; j++) {
            for (let i = 0; i < nelx; i++) {
                const density = densities[j][i];
                const gray = Math.floor((1 - density) * 255);
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                ctx.fillRect(i * cellWidth, j * cellHeight, cellWidth + 1, cellHeight + 1);
            }
        }
    }, [densities, width, height]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="border border-gray-600 rounded-lg"
        />
    );
};

// ============================================
// MAIN PANEL
// ============================================

export const GenerativeDesignPanel: React.FC<GenerativeDesignPanelProps> = ({
    onDesignComplete,
    initialConfig
}) => {
    // State
    const [selectedCase, setSelectedCase] = useState<string>('cantilever');
    const [config, setConfig] = useState({
        nelx: 80,
        nely: 40,
        volumeFraction: 0.4,
        load: 1000,
        ...initialConfig
    });
    const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
    const [result, setResult] = useState<OptimizationResult | null>(null);
    const [progress, setProgress] = useState(0);
    const [alternatives, setAlternatives] = useState<DesignAlternative[]>([]);

    const runOptimization = useCallback(async () => {
        setStatus('running');
        setProgress(0);
        setResult(null);
        setAlternatives([]);

        try {
            let optimizer: TopologyOptimizer;
            let supports: BoundaryCondition[];
            let loads: LoadCondition[];

            if (selectedCase === 'cantilever') {
                const setup = createCantileverOptimizer(
                    config.nelx, config.nely, config.load, config.volumeFraction
                );
                optimizer = setup.optimizer;
                supports = setup.supports;
                loads = setup.loads;
            } else if (selectedCase === 'mbb') {
                const setup = createMBBBeamOptimizer(
                    config.nelx, config.nely, config.load, config.volumeFraction
                );
                optimizer = setup.optimizer;
                supports = setup.supports;
                loads = setup.loads;
            } else {
                // Custom case: create with domain config
                const domain: OptimizationDomain = {
                    width: config.nelx * 10,
                    height: config.nely * 10,
                    nelx: config.nelx,
                    nely: config.nely
                };
                optimizer = new TopologyOptimizer(domain, { volumeFraction: config.volumeFraction });
                supports = [{ type: 'fixed', nodeIndices: [0], direction: 'xy' }];
                loads = [{ nodeIndex: config.nelx, fx: 0, fy: -config.load }];
            }

            // Run optimization
            const optResult = optimizer.optimize(supports, loads);
            setResult(optResult);

            // Generate alternatives
            const alts = optimizer.generateAlternatives(
                supports, loads,
                [0.3, 0.35, 0.45, 0.5].filter(v => v !== config.volumeFraction)
            );
            setAlternatives(alts);

            setStatus('complete');
            setProgress(100);

            // Log to audit trail
            auditTrail.log('optimization', 'generative_design',
                `Topology optimization complete: ${optResult.iterations} iterations, compliance ${optResult.compliance.toFixed(2)}`,
                { aiGenerated: true, metadata: { result: optResult, alternatives: alts.length } }
            );

            onDesignComplete?.(optResult);

        } catch (error) {
            console.error('Optimization failed:', error);
            setStatus('error');
        }
    }, [selectedCase, config, onDesignComplete]);

    // ==========================================
    // RENDER
    // ==========================================

    return (
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                    </svg>
                    <h3 className="font-semibold text-white">Generative Design</h3>
                </div>
                {status === 'complete' && result && (
                    <span className="text-emerald-400 text-sm font-medium">
                        Compliance: {result.compliance.toFixed(2)}
                    </span>
                )}
            </div>

            <div className="p-4">
                {/* Design Case Selection */}
                <div className="mb-4">
                    <label className="text-gray-400 text-sm block mb-2">Design Case</label>
                    <div className="grid grid-cols-4 gap-2">
                        {DESIGN_CASES.map(dc => (
                            <button
                                key={dc.id}
                                onClick={() => setSelectedCase(dc.id)}
                                className={`p-3 rounded-lg border transition-all ${selectedCase === dc.id
                                        ? 'border-emerald-500 bg-emerald-500/20 text-white'
                                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                                    }`}
                            >
                                <div className="text-xl mb-1">{dc.icon}</div>
                                <div className="text-xs font-medium">{dc.name}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Parameters */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="text-gray-400 text-sm block mb-1">Width (elements)</label>
                        <input
                            type="number"
                            value={config.nelx}
                            onChange={e => setConfig(c => ({ ...c, nelx: parseInt(e.target.value) || 40 }))}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                            min={20}
                            max={150}
                        />
                    </div>
                    <div>
                        <label className="text-gray-400 text-sm block mb-1">Height (elements)</label>
                        <input
                            type="number"
                            value={config.nely}
                            onChange={e => setConfig(c => ({ ...c, nely: parseInt(e.target.value) || 20 }))}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                            min={10}
                            max={100}
                        />
                    </div>
                    <div>
                        <label className="text-gray-400 text-sm block mb-1">Volume Fraction</label>
                        <input
                            type="number"
                            value={config.volumeFraction}
                            onChange={e => setConfig(c => ({ ...c, volumeFraction: parseFloat(e.target.value) || 0.4 }))}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                            min={0.1}
                            max={0.9}
                            step={0.05}
                        />
                    </div>
                </div>

                {/* Run Button */}
                {status === 'idle' && (
                    <button
                        onClick={runOptimization}
                        className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-medium flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Generate Optimal Design
                    </button>
                )}

                {/* Running State */}
                {status === 'running' && (
                    <div className="text-center py-8">
                        <div className="animate-spin w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-gray-400 mb-2">Optimizing topology...</p>
                        <p className="text-emerald-400 text-sm">Using SIMP method with filter</p>
                    </div>
                )}

                {/* Results */}
                {status === 'complete' && result && (
                    <>
                        {/* Main Result */}
                        <div className="mb-4 bg-gray-800 rounded-lg p-4">
                            <h4 className="text-white font-medium mb-3">Optimized Design</h4>
                            <div className="flex justify-center mb-4">
                                <DensityVisualization
                                    densities={result.densities}
                                    width={400}
                                    height={200}
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-400 block">Iterations</span>
                                    <span className="text-white font-mono">{result.iterations}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block">Compliance</span>
                                    <span className="text-white font-mono">{result.compliance.toFixed(4)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block">Volume</span>
                                    <span className="text-white font-mono">{(config.volumeFraction * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Alternatives */}
                        {alternatives.length > 0 && (
                            <div className="mb-4">
                                <h4 className="text-white font-medium mb-3">Design Alternatives</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    {alternatives.map((alt, idx) => (
                                        <div key={idx} className="bg-gray-800 rounded-lg p-3">
                                            <DensityVisualization
                                                densities={alt.result.densities}
                                                width={120}
                                                height={60}
                                            />
                                            <div className="mt-2 text-xs text-gray-400">
                                                Vol: {(alt.volumeFraction * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setStatus('idle');
                                    setResult(null);
                                }}
                                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-medium"
                            >
                                New Design
                            </button>
                            <button
                                onClick={() => {
                                    // Export as image
                                    const canvas = document.querySelector('canvas');
                                    if (canvas) {
                                        const link = document.createElement('a');
                                        link.download = 'topology_design.png';
                                        link.href = canvas.toDataURL();
                                        link.click();
                                    }
                                }}
                                className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
                            >
                                Export Image
                            </button>
                        </div>
                    </>
                )}

                {/* Error State */}
                {status === 'error' && (
                    <div className="text-center py-8 text-red-400">
                        <p>Optimization failed. Please adjust parameters.</p>
                        <button
                            onClick={() => setStatus('idle')}
                            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GenerativeDesignPanel;
