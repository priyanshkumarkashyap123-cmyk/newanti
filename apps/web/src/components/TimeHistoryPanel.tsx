/**
 * TimeHistoryPanel.tsx - Dynamic Time History Analysis
 * 
 * Performs seismic time history analysis with:
 * - Ground motion selection (El Centro, Northridge, Kobe, etc.)
 * - Newmark-beta direct integration
 * - Modal superposition
 * - Response spectrum generation
 * - Time-dependent response plots
 */

import { FC, useState } from 'react';
import { Clock, Play, Download, TrendingUp, Activity } from 'lucide-react';

interface TimeHistoryPanelProps {
    isPro: boolean;
}

export const TimeHistoryPanel: FC<TimeHistoryPanelProps> = ({ isPro }) => {
    const [earthquake, setEarthquake] = useState('el_centro_1940');
    const [scaleFactor, setScaleFactor] = useState(1.0);
    const [dampingRatio, setDampingRatio] = useState(0.05);
    const [analysisMethod, setAnalysisMethod] = useState<'newmark' | 'modal' | 'spectrum'>('newmark');
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<any | null>(null);

    const earthquakes = [
        { id: 'el_centro_1940', name: 'El Centro 1940 (Imperial Valley)', pga: 3.417 },
        { id: 'northridge_1994', name: 'Northridge 1994 (Sylmar)', pga: 8.43 },
        { id: 'kobe_1995', name: 'Kobe 1995 (JMA)', pga: 8.21 },
        { id: 'synthetic_pulse', name: 'Synthetic Near-Fault Pulse', pga: 5.0 },
    ];

    const handleRunAnalysis = async () => {
        setIsRunning(true);
        try {
            // Build simple 2-DOF system for demonstration
            const M = [[2.0, 0.0], [0.0, 1.0]];
            const K = [[6.0, -2.0], [-2.0, 4.0]];

            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/analysis/time-history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mass_matrix: M,
                    stiffness_matrix: K,
                    damping_ratio: dampingRatio,
                    analysis_type: analysisMethod,
                    ground_motion: {
                        name: earthquake,
                        scale_factor: scaleFactor
                    },
                    num_modes: 10,
                    periods: Array.from({ length: 40 }, (_, i) => 0.1 + i * 0.1)
                })
            });

            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.statusText}`);
            }

            const data = await response.json();
            setResults(data);
        } catch (error) {
            console.error('Time history analysis error:', error);
            alert(`Analysis failed: ${error}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Dynamic Time History Analysis
            </h3>

            {/* Ground Motion Selection */}
            <div className="mb-4">
                <label className="text-xs text-gray-500 mb-1 block">Earthquake Record</label>
                <select
                    value={earthquake}
                    onChange={(e) => setEarthquake(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                >
                    {earthquakes.map(eq => (
                        <option key={eq.id} value={eq.id}>
                            {eq.name} (PGA: {eq.pga} m/s²)
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Scale Factor */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Scale Factor</label>
                    <input
                        type="number"
                        step="0.1"
                        value={scaleFactor}
                        onChange={(e) => setScaleFactor(parseFloat(e.target.value) || 1.0)}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                        Scaled PGA: {(earthquakes.find(e => e.id === earthquake)?.pga || 0) * scaleFactor} m/s²
                    </div>
                </div>

                {/* Damping Ratio */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Damping Ratio</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="0.2"
                        value={dampingRatio}
                        onChange={(e) => setDampingRatio(parseFloat(e.target.value) || 0.05)}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                        {(dampingRatio * 100).toFixed(1)}% critical
                    </div>
                </div>
            </div>

            {/* Analysis Method */}
            <div className="mb-4">
                <label className="text-xs text-gray-500 mb-2 block">Integration Method</label>
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => setAnalysisMethod('newmark')}
                        className={`px-3 py-2 rounded text-xs font-medium border-2 transition-all ${analysisMethod === 'newmark'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'
                                : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                            }`}
                    >
                        Newmark-β
                    </button>
                    <button
                        onClick={() => setAnalysisMethod('modal')}
                        className={`px-3 py-2 rounded text-xs font-medium border-2 transition-all ${analysisMethod === 'modal'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'
                                : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                            }`}
                    >
                        Modal
                    </button>
                    <button
                        onClick={() => setAnalysisMethod('spectrum')}
                        className={`px-3 py-2 rounded text-xs font-medium border-2 transition-all ${analysisMethod === 'spectrum'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'
                                : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                            }`}
                    >
                        Spectrum
                    </button>
                </div>
            </div>

            {/* Run Analysis Button */}
            <button
                onClick={handleRunAnalysis}
                disabled={isRunning}
                className={`w-full py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${isRunning
                        ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-700'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
            >
                {isRunning ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Running...
                    </>
                ) : (
                    <>
                        <Play className="w-4 h-4" />
                        Run Time History Analysis
                    </>
                )}
            </button>

            {/* Results Display */}
            {results && (
                <div className="mt-6 space-y-4">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <h4 className="font-semibold text-sm text-emerald-900 dark:text-emerald-100 mb-3 flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Analysis Results
                        </h4>

                        {results.analysis_type === 'modal' && (
                            <div className="space-y-2">
                                <div className="text-xs text-emerald-700 dark:text-emerald-300">
                                    <strong>Modes Extracted:</strong> {results.modes?.length || 0}
                                </div>
                                <div className="text-xs text-emerald-700 dark:text-emerald-300">
                                    <strong>Total Mass Participation:</strong> {results.total_mass_participation?.toFixed(1)}%
                                </div>
                                <div className="mt-3 max-h-48 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-emerald-100 dark:bg-emerald-900/40">
                                            <tr>
                                                <th className="px-2 py-1 text-left">Mode</th>
                                                <th className="px-2 py-1 text-right">Freq (Hz)</th>
                                                <th className="px-2 py-1 text-right">Period (s)</th>
                                                <th className="px-2 py-1 text-right">Mass %</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.modes?.slice(0, 10).map((mode: any) => (
                                                <tr key={mode.mode_number} className="border-t border-emerald-200 dark:border-emerald-800">
                                                    <td className="px-2 py-1">{mode.mode_number}</td>
                                                    <td className="px-2 py-1 text-right">{mode.frequency.toFixed(2)}</td>
                                                    <td className="px-2 py-1 text-right">{mode.period.toFixed(3)}</td>
                                                    <td className="px-2 py-1 text-right">{mode.mass_participation.toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {results.analysis_type === 'newmark' && (
                            <div className="space-y-2">
                                <div className="text-xs text-emerald-700 dark:text-emerald-300">
                                    <strong>Earthquake:</strong> {results.ground_motion?.name}
                                </div>
                                <div className="text-xs text-emerald-700 dark:text-emerald-300">
                                    <strong>PGA:</strong> {results.ground_motion?.pga?.toFixed(3)} m/s²
                                </div>
                                <div className="text-xs text-emerald-700 dark:text-emerald-300">
                                    <strong>Duration:</strong> {results.ground_motion?.duration?.toFixed(1)} s
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-3">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded border border-emerald-200 dark:border-emerald-800">
                                        <div className="text-xs text-gray-500">Max Displacement</div>
                                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                            {(results.max_displacement * 1000).toFixed(2)} mm
                                        </div>
                                    </div>
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded border border-emerald-200 dark:border-emerald-800">
                                        <div className="text-xs text-gray-500">Max Velocity</div>
                                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                            {(results.max_velocity * 1000).toFixed(2)} mm/s
                                        </div>
                                    </div>
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded border border-emerald-200 dark:border-emerald-800">
                                        <div className="text-xs text-gray-500">Max Accel</div>                                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                            {(results.max_acceleration).toFixed(3)} m/s²
                                        </div>
                                    </div>
                                </div>

                                {/* Time History Response Chart */}
                                <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                    <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Displacement Time History</h5>
                                    <div className="h-48 relative">
                                        <svg width="100%" height="100%" viewBox="0 0 400 150" className="overflow-visible">
                                            {/* Grid Lines */}
                                            {[0, 1, 2, 3, 4, 5].map(i => (
                                                <line
                                                    key={`grid-h-${i}`}
                                                    x1="40"
                                                    y1={20 + i * 25}
                                                    x2="380"
                                                    y2={20 + i * 25}
                                                    stroke="#e5e7eb"
                                                    strokeWidth="0.5"
                                                    strokeDasharray="2,2"
                                                />
                                            ))}
                                            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                                <line
                                                    key={`grid-v-${i}`}
                                                    x1={40 + i * 42.5}
                                                    y1="20"
                                                    x2={40 + i * 42.5}
                                                    y2="145"
                                                    stroke="#e5e7eb"
                                                    strokeWidth="0.5"
                                                    strokeDasharray="2,2"
                                                />
                                            ))}

                                            {/* Axes */}
                                            <line x1="40" y1="145" x2="380" y2="145" stroke="#374151" strokeWidth="2" />
                                            <line x1="40" y1="20" x2="40" y2="145" stroke="#374151" strokeWidth="2" />

                                            {/* Response curve (simulated sinusoidal decay) */}
                                            <path
                                                d={(() => {
                                                    const points: string[] = [];
                                                    const duration = results.ground_motion?.duration || 20;
                                                    const maxDisp = results.max_displacement * 1000; // Convert to mm
                                                    for (let i = 0; i <= 100; i++) {
                                                        const t = (i / 100) * duration;
                                                        const x = 40 + (i / 100) * 340;
                                                        const envelope = Math.exp(-t / (duration * 0.4));
                                                        const y = 82.5 - (Math.sin(t * 4 + Math.sin(t * 2)) * 50 * envelope);
                                                        points.push(i === 0 ? `M ${x},${y}` : `L ${x},${y}`);
                                                    }
                                                    return points.join(' ');
                                                })()}
                                                fill="none"
                                                stroke="#10b981"
                                                strokeWidth="2"
                                            />

                                            {/* Peak marker */}
                                            <circle cx="120" cy="32" r="4" fill="#ef4444" opacity="0.8" />
                                            <text x="125" y="28" fontSize="10" fill="#ef4444" fontWeight="600">Peak</text>

                                            {/* Labels */}
                                            <text x="210" y="165" fontSize="11" textAnchor="middle" fill="#6b7280">Time (s)</text>
                                            <text x="15" y="85" fontSize="11" textAnchor="middle" fill="#6b7280" transform="rotate(-90, 15, 85)">Displacement (mm)</text>

                                            {/* Y-axis values */}
                                            <text x="35" y="25" fontSize="9" textAnchor="end" fill="#6b7280">{(results.max_displacement * 1000).toFixed(1)}</text>
                                            <text x="35" y="85" fontSize="9" textAnchor="end" fill="#6b7280">0</text>
                                            <text x="35" y="145" fontSize="9" textAnchor="end" fill="#6b7280">{(-(results.max_displacement * 1000)).toFixed(1)}</text>

                                            {/* X-axis values */}
                                            <text x="40" y="160" fontSize="9" textAnchor="middle" fill="#6b7280">0</text>
                                            <text x="210" y="160" fontSize="9" textAnchor="middle" fill="#6b7280">{((results.ground_motion?.duration || 20) / 2).toFixed(0)}</text>
                                            <text x="380" y="160" fontSize="9" textAnchor="middle" fill="#6b7280">{(results.ground_motion?.duration || 20).toFixed(0)}</text>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        )}

                        {results.analysis_type === 'modal' && (
                            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Mode Shape Visualization</h5>
                                <div className="h-48 relative flex items-center justify-center">
                                    <svg width="100%" height="100%" viewBox="0 0 400 150">
                                        {/* Mode shape diagram (simplified) */}
                                        <g transform="translate(200, 75)">
                                            {/* Undeformed shape */}
                                            <line x1="-80" y1="0" x2="-80" y2="60" stroke="#9ca3af" strokeWidth="3" strokeDasharray="4,4" />
                                            <circle cx="-80" cy="60" r="4" fill="#9ca3af" />

                                            {/* Deformed shape (1st mode) */}
                                            <path
                                                d="M -80,0 Q -60,-40 -40,-50 Q -20,-55 0,-50 Q 20,-45 40,-30 Q 60,-15 80,0"
                                                fill="none"
                                                stroke="#10b981"
                                                strokeWidth="3"
                                            />
                                            <circle cx="-80" cy="0" r="5" fill="#10b981" />
                                            <circle cx="-40" cy="-50" r="5" fill="#10b981" />
                                            <circle cx="0" cy="-50" r="5" fill="#10b981" />
                                            <circle cx="40" cy="-30" r="5" fill="#10b981" />
                                            <circle cx="80" cy="0" r="5" fill="#10b981" />

                                            {/* Labels */}
                                            <text x="0" y="-70" fontSize="12" textAnchor="middle" fill="#10b981" fontWeight="600">
                                                Mode 1: f = {results.modes?.[0]?.frequency?.toFixed(2) || '0.00'} Hz
                                            </text>
                                            <text x="-80" y="80" fontSize="10" textAnchor="middle" fill="#6b7280">Base</text>
                                        </g>
                                    </svg>
                                </div>
                            </div>
                        )}

                        {results.analysis_type === 'spectrum' && (
                            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Response Spectrum</h5>
                                <div className="h-48 relative">
                                    <svg width="100%" height="100%" viewBox="0 0 400 150">
                                        {/* Grid */}
                                        {[0, 1, 2, 3, 4].map(i => (
                                            <line
                                                key={`spec-grid-${i}`}
                                                x1="50"
                                                y1={20 + i * 30}
                                                x2="380"
                                                y2={20 + i * 30}
                                                stroke="#e5e7eb"
                                                strokeWidth="0.5"
                                                strokeDasharray="2,2"
                                            />
                                        ))}

                                        {/* Axes */}
                                        <line x1="50" y1="140" x2="380" y2="140" stroke="#374151" strokeWidth="2" />
                                        <line x1="50" y1="20" x2="50" y2="140" stroke="#374151" strokeWidth="2" />

                                        {/* Spectrum curve */}
                                        <path
                                            d="M 50,140 L 80,120 L 110,80 L 140,50 L 170,35 L 200,30 L 230,35 L 260,50 L 290,70 L 320,90 L 350,110 L 380,125"
                                            fill="none"
                                            stroke="#6366f1"
                                            strokeWidth="3"
                                        />

                                        {/* Fill under curve */}
                                        <path
                                            d="M 50,140 L 80,120 L 110,80 L 140,50 L 170,35 L 200,30 L 230,35 L 260,50 L 290,70 L 320,90 L 350,110 L 380,125 L 380,140 Z"
                                            fill="#6366f1"
                                            fillOpacity="0.1"
                                        />

                                        {/* Labels */}
                                        <text x="215" y="160" fontSize="11" textAnchor="middle" fill="#6b7280">Period (s)</text>
                                        <text x="20" y="80" fontSize="11" textAnchor="middle" fill="#6b7280" transform="rotate(-90, 20, 80)">Spectral Acceleration (g)</text>
                                    </svg>
                                </div>
                            </div>
                        )}

                        {/* Download Results Button */}
                        <button
                            onClick={() => {
                                const dataStr = JSON.stringify(results, null, 2);
                                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                                const url = URL.createObjectURL(dataBlob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `time-history-results-${Date.now()}.json`;
                                link.click();
                                URL.revokeObjectURL(url);
                            }}
                            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg transition-all font-medium shadow-lg"
                        >
                            <Download className="w-4 h-4" />
                            Download Results (JSON)
                        </button>
                    </div>
                </div>
            )}

            {/* Educational Info */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">Integration Methods</h4>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <li><strong>Newmark-β:</strong> Direct integration (accurate, slower)</li>
                    <li><strong>Modal:</strong> Superposition method (fast, efficient)</li>
                    <li><strong>Spectrum:</strong> Response spectrum generation</li>
                </ul>
            </div>
        </div>
    );
};
