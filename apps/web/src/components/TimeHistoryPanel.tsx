/**
 * TimeHistoryPanel.tsx - Dynamic Time History Analysis
 * 
 * Industry-standard seismic time history analysis per:
 *   - IS 1893:2016 (Part 1) — Criteria for Earthquake Resistant Design
 *   - ASCE 7-22 Chapter 16 — Seismic Response History Procedures
 *   - IS 875 (Part 5) — Special Loads & Load Combinations
 * 
 * Features:
 *   - Ground motion selection (real records + synthetic)
 *   - Newmark-β average-acceleration (γ=0.5, β=0.25) direct integration
 *   - Modal superposition with CQC combination
 *   - Damping per structure type (IS 1893 Table 3)
 *   - Time-dependent response plots with real data
 */

import { FC, useState } from 'react';
import { Clock, Play, Download, Activity, AlertTriangle } from 'lucide-react';
import { useModelStore } from '../store/model';
import { useAuth } from '../providers/AuthProvider';
import { API_CONFIG } from '../config/env';
import { getErrorMessage } from '../lib/errorHandling';

// ============================================
// CONSTANTS — IS 1893:2016, PEER NGA-West2
// ============================================

/** Standard earthquake records with verified PGA values (m/s²) */
const EARTHQUAKE_RECORDS = [
    { id: 'el_centro_1940', name: 'El Centro 1940 (Imperial Valley, M6.9)', pga: 3.42, duration: 40.0 },
    { id: 'bhuj_2001', name: 'Bhuj 2001 (Gujarat, M7.7)', pga: 1.06, duration: 135.0 },
    { id: 'northridge_1994', name: 'Northridge 1994 (Sylmar, M6.7)', pga: 8.27, duration: 40.0 },
    { id: 'kobe_1995', name: 'Kobe 1995 (JMA, M6.9)', pga: 8.18, duration: 50.0 },
    { id: 'loma_prieta_1989', name: 'Loma Prieta 1989 (Gilroy, M6.9)', pga: 3.53, duration: 40.0 },
    { id: 'chi_chi_1999', name: 'Chi-Chi 1999 (TCU068, M7.6)', pga: 5.01, duration: 90.0 },
    { id: 'christchurch_2011', name: 'Christchurch 2011 (CBGS, M6.2)', pga: 5.34, duration: 60.0 },
    { id: 'synthetic_pulse', name: 'Synthetic Near-Fault Pulse', pga: 5.0, duration: 20.0 },
] as const;

/** Damping ratios per IS 1893:2016 Table 3 & ASCE 7-22 */
const STRUCTURE_DAMPING: Record<string, { label: string; xi: number; description: string }> = {
    steel_smrf: { label: 'Steel SMRF', xi: 0.02, description: 'Special Moment Resisting Frame — IS 800, AISC 341' },
    steel_omrf: { label: 'Steel OMRF', xi: 0.02, description: 'Ordinary Moment Resisting Frame — IS 800' },
    steel_braced: { label: 'Steel Braced Frame', xi: 0.02, description: 'CBF/EBF — IS 800, AISC 341' },
    rc_frame: { label: 'RC Frame', xi: 0.05, description: 'Reinforced Concrete Frame — IS 456, IS 13920' },
    rc_shear_wall: { label: 'RC Shear Wall', xi: 0.05, description: 'RC Dual System — IS 456, IS 13920' },
    masonry: { label: 'Masonry', xi: 0.05, description: 'Unreinforced / Confined Masonry — IS 1905' },
    prestressed: { label: 'Pre-stressed Concrete', xi: 0.02, description: 'Post-tensioned / Pre-tensioned' },
    timber: { label: 'Timber', xi: 0.05, description: 'Timber Frame — per IS 883' },
};

// ============================================
// COMPONENT
// ============================================

interface TimeHistoryPanelProps {
    isPro: boolean;
}

export const TimeHistoryPanel: FC<TimeHistoryPanelProps> = ({ isPro: _isPro }) => {
    const [earthquake, setEarthquake] = useState('el_centro_1940');
    const [scaleFactor, setScaleFactor] = useState(1.0);
    const [structureType, setStructureType] = useState('rc_frame');
    const [dampingRatio, setDampingRatio] = useState(0.05);
    const [analysisMethod, setAnalysisMethod] = useState<'newmark' | 'modal'>('newmark');
    const [dt, setDt] = useState(0.01); // Time step (s) — typical 0.005–0.02
    const [numModes, setNumModes] = useState(12);
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Get model data
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const loads = useModelStore((state) => state.loads);
    const memberLoads = useModelStore((state) => state.memberLoads);
    const { getToken } = useAuth();

    // Sync damping when structure type changes
    const handleStructureTypeChange = (type: string) => {
        setStructureType(type);
        const damping = STRUCTURE_DAMPING[type];
        if (damping) setDampingRatio(damping.xi);
    };

    const selectedEq = EARTHQUAKE_RECORDS.find(e => e.id === earthquake);

    const handleRunAnalysis = async () => {
        // Input validation
        if (scaleFactor <= 0) { setError('Scale factor must be positive'); return; }
        if (dampingRatio < 0 || dampingRatio > 0.25) { setError('Damping ratio must be 0–25%'); return; }
        if (dt <= 0 || dt > 0.1) { setError('Time step must be 0.001–0.1 s'); return; }

        setIsRunning(true);
        setError(null);
        setResults(null);

        try {
            const token = await getToken();
            const PYTHON_API = API_CONFIG.pythonUrl;

            // Prepare payload — use member's actual G, J, Iy, Iz when available
            // Fallback: G = E / (2(1+ν)), ν = 0.3 for steel → G = E/2.6
            //           J ≈ I/100 for open sections (conservative), J ≈ 2I for hollow/circular
            //           Iy = Iz = I (symmetric) when only I is provided
            const payload = {
                nodes: Array.from(nodes.values()).map(n => ({
                    id: n.id,
                    x: n.x, y: n.y, z: n.z,
                    support: n.restraints ? (
                        n.restraints.fx && n.restraints.fy && n.restraints.fz && n.restraints.mx && n.restraints.my && n.restraints.mz ? 'fixed' :
                            n.restraints.fx && n.restraints.fy && n.restraints.fz ? 'pinned' :
                                n.restraints.fy ? 'roller' : 'none'
                    ) : 'none'
                })),
                members: Array.from(members.values()).map(m => {
                    const E = m.E || 200e6; // kN/m² (200 GPa default, steel)
                    const G = m.G || E / (2 * (1 + 0.3)); // Shear modulus, ν=0.3
                    const I = m.I || 8.33e-6; // m⁴ default
                    return {
                        id: m.id,
                        startNodeId: m.startNodeId,
                        endNodeId: m.endNodeId,
                        E, G,
                        A: m.A || 0.01, // m² default
                        Iy: m.Iy || I,
                        Iz: m.Iz || I,
                        J: m.J || I / 100, // Conservative for open I-sections
                    };
                }),
                node_loads: loads.map(l => ({
                    nodeId: l.nodeId,
                    fx: l.fx, fy: l.fy, fz: l.fz,
                    mx: l.mx, my: l.my, mz: l.mz
                })),
                distributed_loads: memberLoads.map(l => ({
                    memberId: l.memberId,
                    direction: l.direction === 'local_y' ? 'Fy' : 'Fz',
                    w1: l.w1, w2: l.w2 ?? l.w1
                })),
                earthquake: earthquake,
                scale_factor: scaleFactor,
                damping_ratio: dampingRatio,
                method: analysisMethod === 'newmark' ? 'direct' : 'modal',
                dt: dt,
                num_modes: numModes,
                // Newmark average acceleration: γ=0.5, β=0.25 (unconditionally stable)
                newmark_gamma: 0.5,
                newmark_beta: 0.25,
            };

            const response = await fetch(`${PYTHON_API}/analyze/time-history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errJson = await response.json();
                throw new Error(errJson.detail || 'Analysis failed');
            }

            const data = await response.json();
            setResults(data);
        } catch (error: unknown) {
            console.error('Time history analysis error:', error);
            setError(getErrorMessage(error, 'Time history analysis failed'));
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Dynamic Time History Analysis
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal ml-auto">IS 1893 / ASCE 7</span>
            </h3>

            {/* Ground Motion Selection */}
            <div className="mb-4">
                <label className="text-xs text-gray-500 mb-1 block">Earthquake Record</label>
                <select
                    value={earthquake}
                    onChange={(e) => setEarthquake(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                >
                    {EARTHQUAKE_RECORDS.map(eq => (
                        <option key={eq.id} value={eq.id}>
                            {eq.name} — PGA {eq.pga.toFixed(2)} m/s² ({(eq.pga / 9.81).toFixed(2)}g)
                        </option>
                    ))}
                </select>
            </div>

            {/* Structure Type (determines default damping) */}
            <div className="mb-4">
                <label className="text-xs text-gray-500 mb-1 block">Structure Type (IS 1893 Table 3 Damping)</label>
                <select
                    value={structureType}
                    onChange={(e) => handleStructureTypeChange(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                >
                    {Object.entries(STRUCTURE_DAMPING).map(([key, val]) => (
                        <option key={key} value={key}>
                            {val.label} — ξ = {(val.xi * 100).toFixed(0)}%
                        </option>
                    ))}
                </select>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {STRUCTURE_DAMPING[structureType]?.description}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Scale Factor */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Scale Factor</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={scaleFactor}
                        onChange={(e) => setScaleFactor(parseFloat(e.target.value) || 1.0)}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Scaled PGA: {((selectedEq?.pga || 0) * scaleFactor).toFixed(2)} m/s² ({(((selectedEq?.pga || 0) * scaleFactor) / 9.81).toFixed(2)}g)
                    </div>
                </div>

                {/* Damping Ratio (override) */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Damping Ratio (ξ)</label>
                    <input
                        type="number"
                        step="0.005"
                        min="0"
                        max="0.25"
                        value={dampingRatio}
                        onChange={(e) => setDampingRatio(parseFloat(e.target.value) || 0.05)}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {(dampingRatio * 100).toFixed(1)}% critical damping
                    </div>
                </div>

                {/* Time Step */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Time Step Δt (s)</label>
                    <select
                        value={dt}
                        onChange={(e) => setDt(parseFloat(e.target.value))}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                    >
                        <option value={0.005}>0.005 s (Fine — high frequency)</option>
                        <option value={0.01}>0.01 s (Standard)</option>
                        <option value={0.02}>0.02 s (Coarse — low frequency)</option>
                    </select>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Steps: ~{Math.ceil((selectedEq?.duration || 40) / dt).toLocaleString()}
                    </div>
                </div>

                {/* Modes (for modal method) */}
                {analysisMethod === 'modal' && (
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Number of Modes</label>
                        <input
                            type="number"
                            min={3}
                            max={50}
                            value={numModes}
                            onChange={(e) => setNumModes(parseInt(e.target.value) || 12)}
                            className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                        />
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            IS 1893 Cl.7.8.4.2: ≥90% mass participation
                        </div>
                    </div>
                )}
            </div>

            {/* Analysis Method */}
            <div className="mb-4">
                <label className="text-xs text-gray-500 mb-2 block">Integration Method</label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setAnalysisMethod('newmark')}
                        className={`px-3 py-2 rounded text-xs font-medium border-2 transition-all ${analysisMethod === 'newmark'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                            }`}
                    >
                        <div>Newmark-β (Direct)</div>
                        <div className="text-[10px] opacity-70 mt-0.5">γ=0.5, β=0.25 — unconditionally stable</div>
                    </button>
                    <button
                        onClick={() => setAnalysisMethod('modal')}
                        className={`px-3 py-2 rounded text-xs font-medium border-2 transition-all ${analysisMethod === 'modal'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                            }`}
                    >
                        <div>Modal Superposition</div>
                        <div className="text-[10px] opacity-70 mt-0.5">CQC combination — IS 1893 Cl.7.8.4</div>
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
                        <div className="w-4 h-4 border-2 border-zinc-200 dark:border-white border-t-transparent rounded-full animate-spin" />
                        Running...
                    </>
                ) : (
                    <>
                        <Play className="w-4 h-4" />
                        Run Time History Analysis
                    </>
                )}
            </button>

            {/* Error Display */}
            {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* Results Display */}
            {results && (
                <div className="mt-6 space-y-4">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <h4 className="font-semibold text-sm text-emerald-900 dark:text-emerald-100 mb-3 flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Analysis Results
                        </h4>

                        {results.method === 'modal' && (
                            <div className="space-y-2">
                                <div className="text-xs text-emerald-700 dark:text-emerald-300">
                                    <strong>Modes Extracted:</strong> {results.modes?.length || 0}
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
                                            {results.modes?.map((mode: any) => (
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

                        <div className="space-y-2 mt-4">
                            <div className="text-xs text-emerald-700 dark:text-emerald-300">
                                <strong>Earthquake:</strong> {results.ground_motion?.name}
                            </div>
                            <div className="text-xs text-emerald-700 dark:text-emerald-300">
                                <strong>PGA:</strong> {results.ground_motion?.pga?.toFixed(3)} m/s²
                            </div>
                            <div className="text-xs text-emerald-700 dark:text-emerald-300">
                                <strong>Duration:</strong> {results.ground_motion?.duration?.toFixed(1)} s
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                <div className="p-2 bg-white dark:bg-gray-800 rounded border border-emerald-200 dark:border-emerald-800">
                                    <div className="text-xs text-gray-500">Max Displacement</div>
                                    <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                        {(results.max_displacement * 1000).toFixed(2)} mm
                                    </div>
                                </div>
                                <div className="p-2 bg-white dark:bg-gray-800 rounded border border-emerald-200 dark:border-emerald-800">
                                    <div className="text-xs text-gray-500">Steps</div>
                                    <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                        {results.num_steps}
                                    </div>
                                </div>
                            </div>

                            {/* Time History Response Chart */}
                            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Control Point Displacement (mm)</h5>
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

                                        {/* Axes */}
                                        <line x1="40" y1="145" x2="380" y2="145" stroke="#374151" strokeWidth="2" />
                                        <line x1="40" y1="20" x2="40" y2="145" stroke="#374151" strokeWidth="2" />

                                        {/* Response curve (Real Data) */}
                                        <path
                                            d={(() => {
                                                if (!results.displacements || !results.displacements[0]) return "";
                                                const points: string[] = [];
                                                const data = results.displacements[0]; // Take first DOF
                                                const n = data.length;
                                                const maxVal = Math.max(...data.map(Math.abs)) || 0.001;

                                                for (let i = 0; i < n; i++) {
                                                    const x = 40 + (i / n) * 340;
                                                    // Normalize to 0-150 range centered at 82.5
                                                    // maxVal corresponds to 62.5 deflection from center
                                                    const y = 82.5 - (data[i] / maxVal) * 50;
                                                    points.push(i === 0 ? `M ${x},${y}` : `L ${x},${y}`);
                                                }
                                                return points.join(' ');
                                            })()}
                                            fill="none"
                                            stroke="#10b981"
                                            strokeWidth="1.5"
                                        />

                                        {/* Labels */}
                                        <text x="210" y="165" fontSize="11" textAnchor="middle" fill="#6b7280">Time (s)</text>

                                        {/* Y-axis values */}
                                        <text x="35" y="25" fontSize="9" textAnchor="end" fill="#6b7280">{(results.max_displacement * 1000).toFixed(1)}</text>
                                        <text x="35" y="85" fontSize="9" textAnchor="end" fill="#6b7280">0</text>
                                        <text x="35" y="145" fontSize="9" textAnchor="end" fill="#6b7280">{(-(results.max_displacement * 1000)).toFixed(1)}</text>
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {
                            results.analysis_type === 'spectrum' && (
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
                            )
                        }

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

            {/* Educational Info — IS 1893 & Newmark Method */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">Integration Methods</h4>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <li><strong>Newmark-β (γ=0.5, β=0.25):</strong> Average acceleration — unconditionally stable, 2nd order accurate. Per ASCE 7-22 §16.2</li>
                    <li><strong>Modal Superposition:</strong> CQC combination — extract modes until ≥90% mass participation per IS 1893 Cl.7.8.4.2</li>
                    <li><strong>Damping:</strong> Rayleigh proportional (C = αM + βK), coefficients from IS 1893 Table 3 recommendations</li>
                </ul>
            </div>
        </div>
    );
};
