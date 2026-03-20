/**
 * AdvancedAnalysisDialog.tsx - Advanced Analysis Options
 * 
 * Central dialog for accessing all advanced analysis features:
 * - P-Delta (Geometric Nonlinear)
 * - Modal Analysis
 * - Response Spectrum (IS 1893)
 * - Buckling Analysis
 * - Cable Analysis
 */

import { FC, useState, useMemo } from 'react';
import {
    Layers,
    Activity,
    Waves,
    Shield,
    Cable,
    Clock,
    ChevronRight,
    Crown,
    Zap,
    Play,
    AlertTriangle,
    CheckCircle2,
    Ban,
    Info,
} from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

import { useModelStore } from '../store/model';
import { useAuth } from '../providers/AuthProvider';
import { API_CONFIG } from '../config/env';
import { getErrorMessage } from '../lib/errorHandling';
import { classifyStructure, type StructureClassification, type AnalysisEligibility } from '../utils/structureClassifier';

// Import panel components
import { PDeltaAnalysisPanel } from './PDeltaAnalysisPanel';
import { ModalAnalysisPanel } from './ModalAnalysisPanel';
import { BucklingAnalysisPanel } from './BucklingAnalysisPanel';
import { TimeHistoryPanel } from './TimeHistoryPanel';
import { TierGate } from './TierGate';

/** Safely format a number, returning 'N/A' for null/undefined/NaN */
function safeFixed(val: unknown, decimals: number = 2): string {
    if (val === null || val === undefined) return 'N/A';
    const n = Number(val);
    if (!Number.isFinite(n)) return 'N/A';
    return n.toFixed(decimals);
}

// ============================================
// TYPES
// ============================================

type AnalysisType = 'pdelta' | 'modal' | 'spectrum' | 'buckling' | 'cable' | 'timehistory';

interface AdvancedAnalysisDialogProps {
    isOpen: boolean;
    onClose: () => void;
    isPro?: boolean;
    initialTab?: AnalysisType;
}

// ============================================
// ANALYSIS OPTIONS
// ============================================

const ANALYSIS_OPTIONS: Array<{
    id: AnalysisType;
    name: string;
    description: string;
    icon: FC<{ className?: string }>;
    color: string;
}> = [
        {
            id: 'pdelta',
            name: 'P-Delta Analysis',
            description: 'Second-order geometric nonlinear analysis for slender structures',
            icon: Layers,
            color: 'blue',
        },
        {
            id: 'modal',
            name: 'Modal Analysis',
            description: 'Extract natural frequencies, periods, and mode shapes',
            icon: Activity,
            color: 'purple',
        },
        {
            id: 'timehistory',
            name: 'Time History Analysis',
            description: 'Dynamic seismic time history with Newmark-beta integration',
            icon: Clock,
            color: 'emerald',
        },
        {
            id: 'spectrum',
            name: 'Response Spectrum',
            description: 'IS 1893:2016 seismic response spectrum analysis',
            icon: Waves,
            color: 'indigo',
        },
        {
            id: 'buckling',
            name: 'Buckling Analysis',
            description: 'Linear stability analysis with critical load factors',
            icon: Shield,
            color: 'red',
        },
        {
            id: 'cable',
            name: 'Cable Analysis',
            description: 'Cable/tension-only members with catenary effects',
            icon: Cable,
            color: 'teal',
        },
    ];

// ============================================
// RESPONSE SPECTRUM PANEL (Inline)
// ============================================

/** IS 1893:2016 Zone factors (Table 3) */
const IS1893_ZONE_FACTORS: Record<number, number> = { 2: 0.10, 3: 0.16, 4: 0.24, 5: 0.36 };

/** IS 1893:2016 Sa/g spectral acceleration coefficient
 *  Soil Type I (Rock): 1+15T for T≤0.10; 2.50 for 0.10<T≤0.40; 1.00/T for T>0.40
 *  Soil Type II (Medium): 1+15T for T≤0.10; 2.50 for 0.10<T≤0.55; 1.36/T for T>0.55
 *  Soil Type III (Soft): 1+15T for T≤0.10; 2.50 for 0.10<T≤0.67; 1.67/T for T>0.67 */
function getSaOverG(T: number, soilType: string): number {
    if (T <= 0) return 1.0;
    if (T <= 0.10) return 1 + 15 * T;
    if (soilType === 'I') return T <= 0.40 ? 2.50 : 1.00 / T;
    if (soilType === 'II') return T <= 0.55 ? 2.50 : 1.36 / T;
    /* Type III */ return T <= 0.67 ? 2.50 : 1.67 / T;
}

const ResponseSpectrumPanel: FC<{ isPro: boolean }> = ({ isPro }) => {
    const [zone, setZone] = useState(4);
    const [soilType, setSoilType] = useState('II');
    const [importance, setImportance] = useState(1.0);
    const [response, setResponse] = useState(5.0);
    const [numModes] = useState(12);
    const [direction, setDirection] = useState('X');
    const [damping, setDamping] = useState(0.05);

    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Get model data
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const loads = useModelStore((state) => state.loads);
    const memberLoads = useModelStore((state) => state.memberLoads);
    const { getToken } = useAuth();

    const handleRunSpectrum = async () => {
        setIsRunning(true);
        setError(null);
        setResult(null);

        try {
            const token = await getToken();
            const NODE_API = API_CONFIG.baseUrl; // Use Node API as auth gateway

            // Prepare payload
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
                    const E = m.E || 200e6;
                    const G = m.G || E / (2 * (1 + 0.3)); // ν=0.3 for steel
                    const I = m.I || 8.33e-6;
                    return {
                        id: m.id,
                        startNodeId: m.startNodeId,
                        endNodeId: m.endNodeId,
                        E, G,
                        A: m.A || 0.01,
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
                    direction: l.direction === 'local_y' ? 'Fy' : 'Fz', // Approximation
                    w1: l.w1, w2: l.w2 ?? l.w1,
                    startPos: l.startPos ?? 0, endPos: l.endPos ?? 1,
                    isRatio: true
                })),
                zone: zone,
                zone_factor: IS1893_ZONE_FACTORS[zone] || 0.24,
                soil_type: soilType,
                importance_factor: importance,
                response_reduction: response,
                damping: damping,
                direction: direction,
                num_modes: numModes,
                combination_method: 'CQC'
            };

            const res = await fetch(`${NODE_API}/api/advanced/spectrum`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                let errDetail = 'Analysis failed';
                try {
                    const errJson = await res.json();
                    errDetail = errJson.detail || errJson.message || `Server error (${res.status})`;
                } catch {
                    errDetail = `Server returned status ${res.status}`;
                }
                throw new Error(errDetail);
            }

            const data = await res.json();
            setResult(data);

        } catch (err: unknown) {
            console.error(err);
            setError(getErrorMessage(err, 'Analysis failed'));
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="p-4 h-full flex flex-col">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Waves className="w-4 h-4" />
                IS 1893:2016 Response Spectrum Analysis
            </h3>

            <div className="flex-1 overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* Zone */}
                    <div>
                        <Label className="mb-1 block">Seismic Zone</Label>
                        <select
                            value={zone}
                            onChange={(e) => setZone(parseInt(e.target.value))}
                            className="w-full px-2 py-1.5 border border-[#1a2333] rounded text-sm bg-[#131b2e]"
                        >
                            <option value={2}>Zone II (Low)</option>
                            <option value={3}>Zone III (Moderate)</option>
                            <option value={4}>Zone IV (Severe)</option>
                            <option value={5}>Zone V (Very Severe)</option>
                        </select>
                        <div className="text-xs text-[#869ab8] mt-1">
                            Z = {IS1893_ZONE_FACTORS[zone]?.toFixed(2) ?? '—'}
                        </div>
                    </div>

                    {/* Soil Type */}
                    <div>
                        <Label className="mb-1 block">Soil Type</Label>
                        <select
                            value={soilType}
                            onChange={(e) => setSoilType(e.target.value)}
                            className="w-full px-2 py-1.5 border border-[#1a2333] rounded text-sm bg-[#131b2e]"
                        >
                            <option value="I">Type I - Rock (N &gt; 30)</option>
                            <option value="II">Type II - Medium (10 &lt; N ≤ 30)</option>
                            <option value="III">Type III - Soft (N ≤ 10)</option>
                        </select>
                    </div>

                    {/* Importance Factor */}
                    <div>
                        <Label className="mb-1 block">Importance Factor (I)</Label>
                        <select
                            value={importance}
                            onChange={(e) => setImportance(parseFloat(e.target.value))}
                            className="w-full px-2 py-1.5 border border-[#1a2333] rounded text-sm bg-[#131b2e]"
                        >
                            <option value={1.0}>1.0 - Regular Building</option>
                            <option value={1.2}>1.2 - Important Building</option>
                            <option value={1.5}>1.5 - Critical/Essential</option>
                        </select>
                    </div>

                    {/* Response Reduction */}
                    <div>
                        <Label className="mb-1 block">Response Factor (R)</Label>
                        <select
                            value={response}
                            onChange={(e) => setResponse(parseFloat(e.target.value))}
                            className="w-full px-2 py-1.5 border border-[#1a2333] rounded text-sm bg-[#131b2e]"
                        >
                            <option value={1.5}>1.5 - Unreinforced Masonry (IS 1893 Table 9)</option>
                            <option value={3.0}>3.0 - Ordinary RC Moment Frame</option>
                            <option value={4.0}>4.0 - Steel OMRF / RC Dual System</option>
                            <option value={5.0}>5.0 - Special RC Frame / Steel SMRF / Steel EBF</option>
                        </select>
                    </div>

                    {/* Direction */}
                    <div>
                        <Label className="mb-1 block">Excitation Direction</Label>
                        <select
                            value={direction}
                            onChange={(e) => setDirection(e.target.value)}
                            className="w-full px-2 py-1.5 border border-[#1a2333] rounded text-sm bg-[#131b2e]"
                        >
                            <option value="X">X-Direction</option>
                            <option value="Y">Y-Direction</option>
                            <option value="Z">Z-Direction</option>
                        </select>
                    </div>

                    {/* Damping */}
                    <div>
                        <Label className="mb-1 block">Damping Ratio</Label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="0.2"
                            value={damping}
                            onChange={(e) => setDamping(parseFloat(e.target.value))}
                        />
                    </div>
                </div>

                {/* IS 1893:2016 Design Spectrum — Computed from Sa/g formula */}
                <div className="p-3 bg-[#131b2e] rounded-lg mb-4">
                    <div className="text-xs font-medium tracking-wide tracking-wide text-slate-500 mb-2">
                        Design Spectrum (IS 1893:2016 Fig. 2) — Soil Type {soilType}
                    </div>
                    <div className="h-36 relative">
                        <svg width="100%" height="100%" viewBox="0 0 320 120">
                            {/* Grid */}
                            {[0, 1, 2, 3, 4].map(i => (
                                <line key={`sg-${i}`} x1="40" y1={15 + i * 25} x2="310" y2={15 + i * 25} stroke="#ddd" strokeWidth="0.5" strokeDasharray="2,2" />
                            ))}

                            {/* Axes */}
                            <line x1="40" y1="110" x2="310" y2="110" stroke="#888" strokeWidth="1.5" />
                            <line x1="40" y1="10" x2="40" y2="110" stroke="#888" strokeWidth="1.5" />

                            {/* IS 1893 Sa/g curve — generate from formula */}
                            <path
                                d={(() => {
                                    const pts: string[] = [];
                                    const Z = IS1893_ZONE_FACTORS[zone] || 0.24;
                                    const Ah_scale = (Z / 2) * (importance / response);
                                    for (let i = 0; i <= 60; i++) {
                                        const T = i * 0.067; // 0 to ~4.0 s
                                        const saG = getSaOverG(T, soilType);
                                        const Ah = Ah_scale * saG;
                                        const x = 40 + (T / 4.0) * 270;
                                        // Scale: max Ah ≈ 0.36/2*1.5/1.5*2.5 = 0.45   -> use 0.5 as max
                                        const y = 110 - (Ah / 0.5) * 95;
                                        pts.push(i === 0 ? `M ${x.toFixed(1)},${Math.max(12, y).toFixed(1)}` : `L ${x.toFixed(1)},${Math.max(12, y).toFixed(1)}`);
                                    }
                                    return pts.join(' ');
                                })()}
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth="2"
                            />

                            {/* Fill under curve */}
                            <path
                                d={(() => {
                                    const pts: string[] = [];
                                    const Z = IS1893_ZONE_FACTORS[zone] || 0.24;
                                    const Ah_scale = (Z / 2) * (importance / response);
                                    for (let i = 0; i <= 60; i++) {
                                        const T = i * 0.067;
                                        const saG = getSaOverG(T, soilType);
                                        const Ah = Ah_scale * saG;
                                        const x = 40 + (T / 4.0) * 270;
                                        const y = 110 - (Ah / 0.5) * 95;
                                        pts.push(i === 0 ? `M ${x.toFixed(1)},${Math.max(12, y).toFixed(1)}` : `L ${x.toFixed(1)},${Math.max(12, y).toFixed(1)}`);
                                    }
                                    pts.push('L 310,110 L 40,110 Z');
                                    return pts.join(' ');
                                })()}
                                fill="#6366f1"
                                fillOpacity="0.08"
                            />

                            {/* Axis labels */}
                            <text x="175" y="108" fontSize="8" textAnchor="middle" fill="#888">Period T (s)</text>
                            <text x="12" y="60" fontSize="8" textAnchor="middle" fill="#888" transform="rotate(-90, 12, 60)">Aₕ = (Z/2)(I/R)(Sa/g)</text>

                            {/* X-axis ticks */}
                            {[0, 1, 2, 3, 4].map(t => (
                                <text key={`xt-${t}`} x={40 + (t / 4) * 270} y="118" fontSize="7" textAnchor="middle" fill="#888">{t}</text>
                            ))}
                        </svg>
                    </div>
                    <div className="text-[10px] text-[#869ab8] mt-1">
                        Aₕ = (Z/2) × (I/R) × (Sa/g) = ({(IS1893_ZONE_FACTORS[zone] || 0.24).toFixed(2)}/2) × ({importance}/{response}) × Sa/g
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded text-sm">
                        {error}
                    </div>
                )}

                {/* Results Display */}
                {result && (
                    <div className="space-y-4 mb-4">
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-[#1a2333] rounded-lg">
                            <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Analysis Results</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-slate-500 text-xs">Base Shear ({direction})</div>
                                    <div className="font-mono font-bold">{safeFixed(result.base_shear)} kN</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 text-xs">Modes Used</div>
                                    <div className="font-mono font-bold">{result.modes?.length ?? 0}</div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Contribution Table */}
                        <div className="border border-[#1a2333] rounded-lg overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-[#131b2e] font-semibold">
                                    <tr>
                                        <th className="p-2">Mode</th>
                                        <th className="p-2">Period (s)</th>
                                        <th className="p-2">Mass %</th>
                                        <th className="p-2">Base Shear (kN)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.modal_contributions?.slice(0, 5).map((m: any, i: number) => (
                                        <tr key={i} className="border-t border-[#1a2333]">
                                            <td className="p-1.5">{m.mode ?? i + 1}</td>
                                            <td className="p-1.5">{safeFixed(m.period, 3)}</td>
                                            <td className="p-1.5">{safeFixed(m.contribution_pct)}%</td>
                                            <td className="p-1.5">{safeFixed(m.base_shear)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {result.modal_contributions?.length > 5 && (
                                <div className="p-1.5 text-center text-slate-500 bg-[#131b2e] text-[10px]">
                                    + {result.modal_contributions.length - 5} more modes
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Run Button */}
            <Button
                onClick={handleRunSpectrum}
                disabled={isRunning || !isPro}
                className="w-full"
            >
                {isRunning ? (
                    <>
                        <Clock className="w-4 h-4 animate-spin" />
                        Analyzing...
                    </>
                ) : (
                    <>
                        <Play className="w-4 h-4" />
                        Run Spectrum Analysis
                    </>
                )}
            </Button>

            {/* Info — IS 1893 Design Horizontal Seismic Coefficient */}
            <div className="mt-4 text-xs text-[#869ab8] space-y-1">
                <p>Design horizontal seismic coefficient (IS 1893 Cl.6.4.2):</p>
                <p className="font-mono">A<sub>h</sub> = (Z/2) × (I/R) × (S<sub>a</sub>/g)</p>
                <p>Design base shear: V<sub>B</sub> = A<sub>h</sub> × W</p>
                <p className="mt-1 text-[10px]">CQC modal combination: IS 1893 Cl.7.8.4.4</p>
            </div>
        </div>
    );
};

// ============================================
// CABLE ANALYSIS PANEL (Inline)
// ============================================

const CableAnalysisPanel: FC<{ isPro: boolean }> = ({ isPro: _isPro }) => {
    const [selfWeight, setSelfWeight] = useState(50);
    const [pretension, setPretension] = useState(10);
    const [memberBehavior, setMemberBehavior] = useState<'normal' | 'tension' | 'compression'>('tension');
    const [cableResult, setCableResult] = useState<any>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [cableError, setCableError] = useState<string>('');

    const handleRunCable = async () => {
        setIsRunning(true);
        setCableError('');
        setCableResult(null);
        try {
            const { runCableAnalysis } = await import('../api/advancedAnalysis');
            // Use demo cable structure (span from node 0→1, horizontal cable)
            const request = {
                nodes: [
                    { id: 0, x: 0, y: 0, z: 0 },
                    { id: 1, x: 20, y: 0, z: 0 },
                ],
                members: [
                    { id: 0, startNode: 0, endNode: 1, E: 200e6, A: 0.001, I: 1e-8 },
                ],
                supports: [
                    { nodeId: 0, fx: true, fy: true, fz: true, mx: false, my: false, mz: false },
                    { nodeId: 1, fx: true, fy: true, fz: true, mx: false, my: false, mz: false },
                ],
                cables: [
                    { memberId: 0, selfWeight, pretension, behavior: memberBehavior },
                ],
                loads: [],
            };
            const result = await runCableAnalysis(request);
            setCableResult(result);
        } catch (err: unknown) {
            setCableError(getErrorMessage(err, 'Cable analysis failed'));
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Cable className="w-4 h-4" />
                Cable / Tension-Only Analysis
            </h3>

            <div className="space-y-4">
                {/* Member Type Selection */}
                <div className="p-3 bg-[#131b2e] rounded-lg">
                    <div className="text-xs font-medium tracking-wide tracking-wide text-slate-500 mb-2">Member Behavior</div>
                    <div className="grid grid-cols-3 gap-2">
                        <Button variant="outline" size="sm" className={`text-xs ${memberBehavior === 'normal' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700' : ''}`} onClick={() => setMemberBehavior('normal')}>
                            Normal
                        </Button>
                        <Button variant="outline" size="sm" className={`text-xs ${memberBehavior === 'tension' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700' : ''}`} onClick={() => setMemberBehavior('tension')}>
                            Tension Only
                        </Button>
                        <Button variant="outline" size="sm" className={`text-xs ${memberBehavior === 'compression' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700' : ''}`} onClick={() => setMemberBehavior('compression')}>
                            Compression Only
                        </Button>
                    </div>
                </div>

                {/* Cable Properties */}
                <div className="p-3 bg-[#131b2e] rounded-lg">
                    <div className="text-xs font-medium tracking-wide tracking-wide text-slate-500 mb-2">Cable Properties</div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label>Self-weight (N/m)</Label>
                            <Input
                                type="number"
                                value={selfWeight}
                                onChange={(e) => setSelfWeight(Number(e.target.value))}
                            />
                        </div>
                        <div>
                            <Label>Pretension (kN)</Label>
                            <Input
                                type="number"
                                value={pretension}
                                onChange={(e) => setPretension(Number(e.target.value))}
                            />
                        </div>
                    </div>
                </div>

                {/* Catenary Info */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-[#1a2333]">
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                        <strong>Catenary Effect:</strong> Cable elements automatically calculate
                        sag and equivalent modulus based on the catenary equation:
                        <div className="mt-1 font-mono">
                            E<sub>eq</sub> = E / (1 + (wL)²AE / 12T³)
                        </div>
                    </div>
                </div>

                {/* Error */}
                {cableError && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-[#1a2333] rounded text-xs text-red-600">
                        {cableError}
                    </div>
                )}

                {/* Result */}
                {cableResult && cableResult.cables && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-[#1a2333]">
                        <div className="text-xs font-medium tracking-wide tracking-wide text-green-700 dark:text-green-400 mb-1">Cable Analysis Results</div>
                        {cableResult.cables.map((c: any, i: number) => (
                            <div key={i} className="text-xs text-green-600 dark:text-green-400 space-y-0.5">
                                <div>Span: {safeFixed(c.span)} m | Sag: {safeFixed(c.sag, 4)} m</div>
                                <div>Cable Length: {safeFixed(c.cableLength, 3)} m | Sag Ratio: {safeFixed(c.sagRatio != null ? c.sagRatio * 100 : null)}%</div>
                                <div>E<sub>eq</sub>: {safeFixed(c.equivalentModulus != null ? c.equivalentModulus / 1e6 : null, 1)} MPa (Reduction: {safeFixed(c.modulusReduction != null ? (1 - c.modulusReduction) * 100 : null, 1)}%)</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Run Button */}
                <Button
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                    onClick={handleRunCable}
                    disabled={isRunning}
                >
                    <Play className="w-4 h-4" />
                    {isRunning ? 'Running Cable Analysis...' : 'Run Cable Analysis'}
                </Button>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const AdvancedAnalysisDialog: FC<AdvancedAnalysisDialogProps> = ({
    isOpen,
    onClose,
    isPro = false,
    initialTab = 'pdelta',
}) => {
    const [activeTab, setActiveTab] = useState<AnalysisType>(initialTab);

    // Pull live model data from the store for structure classification
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);
    const plates = useModelStore((s) => s.plates);
    const nodeLoads = useModelStore((s) => s.loads);
    const memberLoads = useModelStore((s) => s.memberLoads);

    // Classify the structure and determine which analyses apply
    const classification = useMemo<StructureClassification>(
        () => classifyStructure(nodes, members, plates, nodeLoads, memberLoads),
        [nodes, members, plates, nodeLoads, memberLoads],
    );

    // Build a quick lookup: analysisId → eligibility
    const eligibilityMap = useMemo(() => {
        const m = new Map<string, AnalysisEligibility>();
        classification.eligibility.forEach((e) => m.set(e.id, e));
        return m;
    }, [classification]);

    const eligibleCount = classification.eligibility.filter((e) => e.eligible).length;
    const totalCount = classification.eligibility.length;

    const activeEligibility = eligibilityMap.get(activeTab);
    const isActiveEligible = activeEligibility?.eligible ?? true;

    const renderPanel = () => {
        // If the selected analysis is NOT eligible, show a blocking overlay instead
        if (!isActiveEligible && activeEligibility) {
            return (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8">
                    <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
                        <Ban className="w-10 h-10 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-100 mb-2">
                        Not Applicable to This Structure
                    </h3>
                    <p className="text-sm text-[#869ab8] max-w-md mb-4">
                        {activeEligibility.reason}
                    </p>
                    {activeEligibility.hint && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-[#1a2333] rounded-lg max-w-md">
                            <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-400 text-left">
                                {activeEligibility.hint}
                            </p>
                        </div>
                    )}
                    <div className="mt-6 p-3 bg-[#131b2e] rounded-lg text-xs text-[#869ab8]">
                        <span className="font-medium tracking-wide tracking-wide">Detected structure:</span> {classification.label}
                    </div>
                </div>
            );
        }

        switch (activeTab) {
            case 'pdelta':
                return <TierGate feature="advancedDesignCodes"><PDeltaAnalysisPanel isPro={isPro} /></TierGate>;
            case 'modal':
                return <TierGate feature="advancedDesignCodes"><ModalAnalysisPanel isPro={isPro} /></TierGate>;
            case 'timehistory':
                return <TierGate feature="advancedDesignCodes"><TimeHistoryPanel isPro={isPro} /></TierGate>;
            case 'spectrum':
                return <TierGate feature="advancedDesignCodes"><ResponseSpectrumPanel isPro={isPro} /></TierGate>;
            case 'buckling':
                return <TierGate feature="advancedDesignCodes"><BucklingAnalysisPanel isPro={isPro} /></TierGate>;
            case 'cable':
                return <TierGate feature="advancedDesignCodes"><CableAnalysisPanel isPro={isPro} /></TierGate>;
            default:
                return null;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
                {/* Header */}
                <DialogHeader className="flex flex-row items-center gap-2 p-4 border-b space-y-0">
                    <Zap className="w-5 h-5 text-blue-500" />
                    <DialogTitle>Advanced Analysis</DialogTitle>
                    {!isPro && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded">
                            <Crown className="w-3 h-3" />
                            Pro
                        </span>
                    )}
                    <DialogDescription className="sr-only">
                        Configure and run advanced structural analysis options
                    </DialogDescription>
                </DialogHeader>

                {/* Structure Classification Banner */}
                <div className="px-4 py-2.5 border-b bg-[#131b2e]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${
                                eligibleCount === totalCount ? 'bg-green-500' :
                                eligibleCount > 0 ? 'bg-amber-500' : 'bg-red-500'
                            }`} />
                            <span className="text-sm font-medium tracking-wide tracking-wide text-[#adc6ff]">
                                {classification.label}
                            </span>
                            <span className="text-xs text-[#869ab8]">
                                — {classification.description}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs font-medium tracking-wide tracking-wide text-[#869ab8]">
                                {eligibleCount}/{totalCount} analyses applicable
                            </span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-72 border-r overflow-y-auto bg-slate-50/50 dark:bg-slate-800/50">
                        {ANALYSIS_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const isActive = activeTab === option.id;
                            const elig = eligibilityMap.get(option.id);
                            const isEligible = elig?.eligible ?? true;

                            // Define color classes statically (Tailwind JIT requires literal class names)
                            const colorClasses = {
                                blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-500', text: 'text-blue-500', textDark: 'text-blue-700 dark:text-blue-400' },
                                purple: { bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-500', text: 'text-purple-500', textDark: 'text-purple-700 dark:text-purple-400' },
                                emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-500', text: 'text-emerald-500', textDark: 'text-emerald-700 dark:text-emerald-400' },
                                indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/30', border: 'border-indigo-500', text: 'text-indigo-500', textDark: 'text-indigo-700 dark:text-indigo-400' },
                                red: { bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-500', text: 'text-red-500', textDark: 'text-red-700 dark:text-red-400' },
                                teal: { bg: 'bg-teal-50 dark:bg-teal-900/30', border: 'border-teal-500', text: 'text-teal-500', textDark: 'text-teal-700 dark:text-teal-400' },
                            };
                            const colors = colorClasses[option.color as keyof typeof colorClasses] || colorClasses.blue;

                            return (
                                <button type="button"
                                    key={option.id}
                                    onClick={() => setActiveTab(option.id)}
                                    className={`
                                        w-full flex items-center gap-3 p-4 text-left transition-all cursor-pointer relative
                                        ${!isEligible ? 'opacity-50' : ''}
                                        ${isActive
                                            ? `${isEligible ? colors.bg : 'bg-[#131b2e]'} border-r-4 ${isEligible ? colors.border : 'border-slate-400'}`
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-r-4 border-transparent'}
                                    `}
                                >
                                    <div className="relative">
                                        <Icon className={`w-5 h-5 flex-shrink-0 ${isActive && isEligible ? colors.text : isEligible ? 'text-[#869ab8]' : 'text-slate-400 dark:text-slate-600'}`} />
                                        {!isEligible && (
                                            <Ban className="w-3 h-3 text-red-400 absolute -top-1 -right-1" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-sm font-semibold ${isActive && isEligible ? colors.textDark : isEligible ? 'text-[#adc6ff]' : 'text-[#424754]'}`}>
                                                {option.name}
                                            </span>
                                            {isEligible ? (
                                                <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                                            ) : (
                                                <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                            )}
                                        </div>
                                        <div className={`text-xs truncate mt-0.5 ${isEligible ? 'text-[#869ab8]' : 'text-[#869ab8]'}`}>
                                            {isEligible ? option.description : (elig?.reason.slice(0, 60) + (elig && elig.reason.length > 60 ? '…' : ''))}
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isActive && isEligible ? colors.text : 'text-slate-400 dark:text-slate-600'}`} />
                                </button>
                            );
                        })}
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {renderPanel()}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AdvancedAnalysisDialog;
