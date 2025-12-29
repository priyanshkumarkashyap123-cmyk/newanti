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

import { FC, useState } from 'react';
import {
    X,
    Layers,
    Activity,
    Waves,
    Shield,
    Cable,
    ChevronRight,
    Crown,
    Zap,
    Play,
} from 'lucide-react';

// Import panel components
import { PDeltaAnalysisPanel } from './PDeltaAnalysisPanel';
import { ModalAnalysisPanel } from './ModalAnalysisPanel';
import { BucklingAnalysisPanel } from './BucklingAnalysisPanel';

// ============================================
// TYPES
// ============================================

type AnalysisType = 'pdelta' | 'modal' | 'spectrum' | 'buckling' | 'cable';

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

const ResponseSpectrumPanel: FC<{ isPro: boolean }> = ({ isPro }) => {
    const [zone, setZone] = useState(4);
    const [soilType, setSoilType] = useState('II');
    const [importance, setImportance] = useState(1.0);
    const [response, setResponse] = useState(5.0);
    const [numModes, setNumModes] = useState(12);

    if (!isPro) {
        return (
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-semibold text-indigo-700 dark:text-indigo-400">
                        Response Spectrum - Pro Feature
                    </h3>
                </div>
                <p className="text-sm text-indigo-600 dark:text-indigo-300">
                    Upgrade to Pro for IS 1893:2016 seismic analysis with CQC/SRSS modal combination.
                </p>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Waves className="w-4 h-4" />
                IS 1893:2016 Response Spectrum Analysis
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Zone */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Seismic Zone</label>
                    <select
                        value={zone}
                        onChange={(e) => setZone(parseInt(e.target.value))}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                    >
                        <option value={2}>Zone II (Low)</option>
                        <option value={3}>Zone III (Moderate)</option>
                        <option value={4}>Zone IV (Severe)</option>
                        <option value={5}>Zone V (Very Severe)</option>
                    </select>
                    <div className="text-xs text-gray-400 mt-1">
                        Z = {[0, 0.10, 0.10, 0.16, 0.24, 0.36][zone]}
                    </div>
                </div>

                {/* Soil Type */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Soil Type</label>
                    <select
                        value={soilType}
                        onChange={(e) => setSoilType(e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                    >
                        <option value="I">Type I - Rock (N &gt; 30)</option>
                        <option value="II">Type II - Medium (10 &lt; N ≤ 30)</option>
                        <option value="III">Type III - Soft (N ≤ 10)</option>
                    </select>
                </div>

                {/* Importance Factor */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Importance Factor (I)</label>
                    <select
                        value={importance}
                        onChange={(e) => setImportance(parseFloat(e.target.value))}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                    >
                        <option value={1.0}>1.0 - Regular Building</option>
                        <option value={1.2}>1.2 - Important Building</option>
                        <option value={1.5}>1.5 - Critical/Essential</option>
                    </select>
                </div>

                {/* Response Reduction */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Response Factor (R)</label>
                    <select
                        value={response}
                        onChange={(e) => setResponse(parseFloat(e.target.value))}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                    >
                        <option value={3.0}>3.0 - Unreinforced Masonry</option>
                        <option value={4.0}>4.0 - Ordinary RC Frame</option>
                        <option value={5.0}>5.0 - Special RC Frame</option>
                        <option value={5.0}>5.0 - Steel Frame (SMRF)</option>
                    </select>
                </div>

                {/* Number of Modes */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Number of Modes</label>
                    <input
                        type="number"
                        min={1}
                        max={50}
                        value={numModes}
                        onChange={(e) => setNumModes(parseInt(e.target.value) || 12)}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
                    />
                </div>

                {/* Combination Method */}
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Combination</label>
                    <select className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-600">
                        <option value="CQC">CQC (Complete Quadratic)</option>
                        <option value="SRSS">SRSS (Square Root Sum)</option>
                    </select>
                </div>
            </div>

            {/* Design Spectrum Preview */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                <div className="text-xs font-medium text-gray-500 mb-2">Design Spectrum</div>
                <div className="h-32 relative">
                    <svg width="100%" height="100%" viewBox="0 0 300 100">
                        {/* Axes */}
                        <line x1="30" y1="90" x2="290" y2="90" stroke="#888" strokeWidth="1" />
                        <line x1="30" y1="10" x2="30" y2="90" stroke="#888" strokeWidth="1" />
                        
                        {/* Spectrum curve (simplified) */}
                        <path
                            d={`M 30,60 L 50,${90 - zone * 8} L 100,${90 - zone * 8} C 150,${90 - zone * 8} 180,70 290,85`}
                            fill="none"
                            stroke="#6366f1"
                            strokeWidth="2"
                        />
                        
                        {/* Labels */}
                        <text x="160" y="98" fontSize="8" textAnchor="middle" fill="#888">Period (T)</text>
                        <text x="10" y="50" fontSize="8" textAnchor="middle" fill="#888" transform="rotate(-90, 10, 50)">Sa/g</text>
                    </svg>
                </div>
            </div>

            {/* Run Button */}
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors">
                <Play className="w-4 h-4" />
                Run Spectrum Analysis
            </button>

            {/* Info */}
            <div className="mt-4 text-xs text-gray-500">
                <p>Design base shear: V<sub>B</sub> = A<sub>h</sub> × W</p>
                <p className="mt-1">where A<sub>h</sub> = (Z/2) × (I/R) × (S<sub>a</sub>/g)</p>
            </div>
        </div>
    );
};

// ============================================
// CABLE ANALYSIS PANEL (Inline)
// ============================================

const CableAnalysisPanel: FC<{ isPro: boolean }> = ({ isPro }) => {
    if (!isPro) {
        return (
            <div className="p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-lg border border-teal-200 dark:border-teal-800">
                <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-5 h-5 text-teal-500" />
                    <h3 className="font-semibold text-teal-700 dark:text-teal-400">
                        Cable Analysis - Pro Feature
                    </h3>
                </div>
                <p className="text-sm text-teal-600 dark:text-teal-300">
                    Upgrade to Pro for cable elements with catenary effects and tension-only analysis.
                </p>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Cable className="w-4 h-4" />
                Cable / Tension-Only Analysis
            </h3>

            <div className="space-y-4">
                {/* Member Type Selection */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 mb-2">Member Behavior</div>
                    <div className="grid grid-cols-3 gap-2">
                        <button className="p-2 text-center border rounded text-xs hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                            Normal
                        </button>
                        <button className="p-2 text-center border rounded text-xs border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700">
                            Tension Only
                        </button>
                        <button className="p-2 text-center border rounded text-xs hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                            Compression Only
                        </button>
                    </div>
                </div>

                {/* Cable Properties */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 mb-2">Cable Properties</div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-gray-400">Self-weight (N/m)</label>
                            <input
                                type="number"
                                defaultValue={50}
                                className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">Pretension (kN)</label>
                            <input
                                type="number"
                                defaultValue={10}
                                className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                            />
                        </div>
                    </div>
                </div>

                {/* Catenary Info */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                        <strong>Catenary Effect:</strong> Cable elements automatically calculate 
                        sag and equivalent modulus based on the catenary equation:
                        <div className="mt-1 font-mono">
                            E<sub>eq</sub> = E / (1 + (wL)²AE / 12T³)
                        </div>
                    </div>
                </div>

                {/* Run Button */}
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors">
                    <Play className="w-4 h-4" />
                    Run Cable Analysis
                </button>
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

    if (!isOpen) return null;

    const renderPanel = () => {
        switch (activeTab) {
            case 'pdelta':
                return <PDeltaAnalysisPanel isPro={isPro} />;
            case 'modal':
                return <ModalAnalysisPanel isPro={isPro} />;
            case 'spectrum':
                return <ResponseSpectrumPanel isPro={isPro} />;
            case 'buckling':
                return <BucklingAnalysisPanel isPro={isPro} />;
            case 'cable':
                return <CableAnalysisPanel isPro={isPro} />;
            default:
                return null;
        }
    };

    const getTabColor = (id: AnalysisType) => {
        const option = ANALYSIS_OPTIONS.find((o) => o.id === id);
        return option?.color || 'gray';
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-blue-500" />
                        <h2 className="font-semibold text-lg">Advanced Analysis</h2>
                        {!isPro && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded">
                                <Crown className="w-3 h-3" />
                                Pro
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                        {ANALYSIS_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const isActive = activeTab === option.id;
                            
                            return (
                                <button
                                    key={option.id}
                                    onClick={() => setActiveTab(option.id)}
                                    className={`
                                        w-full flex items-center gap-3 p-3 text-left transition-all
                                        ${isActive 
                                            ? `bg-${option.color}-50 dark:bg-${option.color}-900/30 border-r-2 border-${option.color}-500`
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                                    `}
                                >
                                    <Icon className={`w-5 h-5 ${isActive ? `text-${option.color}-500` : 'text-gray-400'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-medium ${isActive ? `text-${option.color}-700 dark:text-${option.color}-400` : ''}`}>
                                            {option.name}
                                        </div>
                                        <div className="text-xs text-gray-400 truncate">
                                            {option.description}
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 ${isActive ? `text-${option.color}-500` : 'text-gray-300'}`} />
                                </button>
                            );
                        })}
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto">
                        {renderPanel()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdvancedAnalysisDialog;
