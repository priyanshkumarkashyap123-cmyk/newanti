/**
 * SettingsPage - BeamLab Ultimate Settings
 * Dark theme with sidebar navigation and analysis preferences
 */

import { FC, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Settings, Monitor, BarChart2, User, LogOut, ChevronDown,
    Cpu, Zap, Save, RotateCcw, Check, HardDrive
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type TabId = 'general' | 'display' | 'analysis' | 'profile';

interface NavItem {
    id: TabId;
    label: string;
    icon: FC<{ className?: string }>;
}

// ============================================
// NAV ITEMS
// ============================================

const NAV_ITEMS: NavItem[] = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'display', label: 'Display', icon: Monitor },
    { id: 'analysis', label: 'Analysis Preferences', icon: BarChart2 },
    { id: 'profile', label: 'User Profile', icon: User },
];

// ============================================
// TOGGLE COMPONENT
// ============================================

interface ToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    label: string;
    description?: string;
    statusText?: string;
}

const Toggle: FC<ToggleProps> = ({ enabled, onChange, label, description, statusText }) => (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-5">
        <div className="flex items-start gap-4">
            <div className="p-3 rounded bg-zinc-200/30 dark:bg-zinc-700/30 text-zinc-900 dark:text-white">
                <Cpu className="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-1">
                <p className="text-zinc-900 dark:text-white text-base font-bold">{label}</p>
                {description && <p className="text-zinc-500 dark:text-zinc-400 text-sm">{description}</p>}
                {statusText && (
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{statusText}</span>
                    </div>
                )}
            </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only peer"
            />
            <div className={`
                w-11 h-6 rounded-full peer 
                ${enabled ? 'bg-blue-600' : 'bg-zinc-600'}
                peer-focus:outline-none
                after:content-[''] after:absolute after:top-[2px] 
                ${enabled ? 'after:right-[2px]' : 'after:left-[2px]'}
                after:bg-white after:border-gray-300 after:border 
                after:rounded-full after:h-5 after:w-5 after:transition-all
                transition-colors
            `} />
        </label>
    </div>
);

// ============================================
// SELECT COMPONENT
// ============================================

interface SelectProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
}

const Select: FC<SelectProps> = ({ label, value, onChange, options }) => (
    <div className="flex flex-col gap-2">
        <label className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{label}</label>
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white h-12 px-4 pr-10 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 dark:text-zinc-400 pointer-events-none" />
        </div>
    </div>
);

// ============================================
// INPUT COMPONENT
// ============================================

interface InputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    readOnly?: boolean;
}

const Input: FC<InputProps> = ({ label, value, onChange, type = 'text', placeholder, readOnly }) => (
    <div className="flex flex-col gap-2">
        <label className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            className={`w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 h-12 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm placeholder:text-zinc-500 dark:text-zinc-400 ${readOnly ? 'text-zinc-500 dark:text-zinc-400 cursor-default' : ''}`}
        />
    </div>
);

// ============================================
// SLIDER COMPONENT
// ============================================

interface SliderProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    labels: string[];
    valueLabel: string;
}

const Slider: FC<SliderProps> = ({ label, value, onChange, min, max, labels, valueLabel }) => (
    <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg p-5">
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <label className="text-zinc-900 dark:text-white text-base font-medium">{label}</label>
                <span className="px-2 py-1 rounded bg-blue-600/20 text-blue-400 text-xs font-bold uppercase">
                    {valueLabel}
                </span>
            </div>
            <div className="relative h-10 flex items-center">
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                    style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${value}%, #3f3f46 ${value}%, #3f3f46 100%)`
                    }}
                />
            </div>
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 font-mono uppercase">
                {labels.map((l, i) => (
                    <span key={i}>{l}</span>
                ))}
            </div>
        </div>
    </div>
);

// ============================================
// SETTINGS PAGE COMPONENT
// ============================================

export const SettingsPage: FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>('analysis');
    const navigate = useNavigate();

    // Settings State
    const [solverEngine, setSolverEngine] = useState('linear_static');
    const [precision, setPrecision] = useState('double');
    const [maxIterations, setMaxIterations] = useState('1000');
    const [tolerance, setTolerance] = useState('1e-6');
    const [meshDensity, setMeshDensity] = useState(75);
    const [adaptiveMesh, setAdaptiveMesh] = useState(false);
    const [parallelProcessing, setParallelProcessing] = useState(true);
    const [gpuAcceleration, setGpuAcceleration] = useState(true);
    const [autoSaveResults, setAutoSaveResults] = useState(false);
    const [generateReport, setGenerateReport] = useState(true);

    const getMeshLabel = () => {
        if (meshDensity >= 75) return 'High';
        if (meshDensity >= 50) return 'Normal';
        if (meshDensity >= 25) return 'Fine';
        return 'Coarse';
    };

    const handleSignOut = () => {
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white flex">
            {/* Sidebar */}
            <aside className="w-72 flex-shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                {/* App Header */}
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800/50">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-lg">B</div>
                        <div>
                            <h1 className="text-white text-lg font-bold leading-none tracking-tight">BeamLab</h1>
                            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-normal mt-1">Ultimate Edition v4.2.0</p>
                        </div>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1">
                    <div className="px-3 mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Settings</div>
                    {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded transition-colors w-full text-left ${isActive
                                        ? 'bg-blue-600/10 border border-blue-600/20 text-zinc-900 dark:text-white'
                                        : 'hover:bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-500' : ''}`} />
                                <p className="text-sm font-medium">{item.label}</p>
                            </button>
                        );
                    })}
                </nav>

                {/* Sign Out */}
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/50">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-sm font-medium transition-colors w-full px-2 py-2"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white dark:bg-zinc-900 relative">
                {/* Header */}
                <header className="flex-shrink-0 h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-8 bg-white dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10">
                    <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                        {NAV_ITEMS.find(n => n.id === activeTab)?.label}
                    </h2>
                    <div className="flex gap-3">
                        <button className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-sm font-medium hover:bg-zinc-100 dark:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center gap-2">
                            <RotateCcw className="w-4 h-4" />
                            Reset Defaults
                        </button>
                        <button className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2">
                            <Save className="w-4 h-4" />
                            Save Changes
                        </button>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-3xl flex flex-col gap-8 pb-12">

                        {activeTab === 'analysis' && (
                            <>
                                {/* Solver Configuration */}
                                <section className="flex flex-col gap-5">
                                    <div className="border-b border-zinc-300 dark:border-zinc-700 pb-2">
                                        <h3 className="text-zinc-900 dark:text-white text-lg font-medium">Solver Configuration</h3>
                                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Configure the core computational engine parameters.</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Select
                                            label="Solver Engine"
                                            value={solverEngine}
                                            onChange={setSolverEngine}
                                            options={[
                                                { value: 'linear_static', label: 'Linear Static (Standard)' },
                                                { value: 'nonlinear_static', label: 'Non-linear Static' },
                                                { value: 'dynamic', label: 'Dynamic / Transient' },
                                                { value: 'buckling', label: 'Buckling Analysis' },
                                            ]}
                                        />
                                        <Select
                                            label="Floating Point Precision"
                                            value={precision}
                                            onChange={setPrecision}
                                            options={[
                                                { value: 'single', label: 'Single Precision (FP32)' },
                                                { value: 'double', label: 'Double Precision (FP64)' },
                                                { value: 'quad', label: 'Quad Precision (FP128)' },
                                            ]}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Input
                                            label="Max Iterations"
                                            value={maxIterations}
                                            onChange={setMaxIterations}
                                            type="number"
                                            placeholder="e.g., 500"
                                        />
                                        <Input
                                            label="Convergence Tolerance"
                                            value={tolerance}
                                            onChange={setTolerance}
                                            placeholder="e.g., 1e-6"
                                        />
                                    </div>
                                </section>

                                {/* Meshing */}
                                <section className="flex flex-col gap-5 pt-4">
                                    <div className="border-b border-zinc-300 dark:border-zinc-700 pb-2">
                                        <h3 className="text-zinc-900 dark:text-white text-lg font-medium">Meshing & Discretization</h3>
                                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Control the density and quality of the finite element mesh.</p>
                                    </div>
                                    <Slider
                                        label="Global Mesh Density"
                                        value={meshDensity}
                                        onChange={setMeshDensity}
                                        min={0}
                                        max={100}
                                        labels={['Coarse', 'Normal', 'Fine', 'Ultra']}
                                        valueLabel={getMeshLabel()}
                                    />
                                    <Toggle
                                        enabled={adaptiveMesh}
                                        onChange={setAdaptiveMesh}
                                        label="Adaptive Mesh Refinement"
                                        description="Automatically refine mesh in high-stress gradient areas."
                                    />
                                </section>

                                {/* Hardware */}
                                <section className="flex flex-col gap-5 pt-4">
                                    <div className="border-b border-zinc-300 dark:border-zinc-700 pb-2">
                                        <h3 className="text-zinc-900 dark:text-white text-lg font-medium">Performance & Hardware</h3>
                                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Manage computational resources and hardware acceleration.</p>
                                    </div>
                                    <Toggle
                                        enabled={parallelProcessing}
                                        onChange={setParallelProcessing}
                                        label="Parallel Processing"
                                        description="Enable multi-threading for faster calculations."
                                    />
                                    <Toggle
                                        enabled={gpuAcceleration}
                                        onChange={setGpuAcceleration}
                                        label="GPU Acceleration (CUDA)"
                                        description="Offload matrix operations to compatible NVIDIA GPUs."
                                        statusText="GPU Detected"
                                    />
                                </section>

                                {/* Output */}
                                <section className="flex flex-col gap-5 pt-4">
                                    <div className="border-b border-zinc-300 dark:border-zinc-700 pb-2">
                                        <h3 className="text-zinc-900 dark:text-white text-lg font-medium">Output Handling</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <label className="flex items-center p-4 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 cursor-pointer hover:border-blue-500/50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={autoSaveResults}
                                                onChange={(e) => setAutoSaveResults(e.target.checked)}
                                                className="w-5 h-5 rounded border-zinc-600 bg-white dark:bg-zinc-900 text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="ml-3">
                                                <span className="block text-sm font-medium text-zinc-900 dark:text-white">Auto-save Intermediate Results</span>
                                                <span className="block text-xs text-zinc-500 dark:text-zinc-400">Save state after each iteration step (uses more disk space)</span>
                                            </div>
                                        </label>
                                        <label className="flex items-center p-4 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 cursor-pointer hover:border-blue-500/50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={generateReport}
                                                onChange={(e) => setGenerateReport(e.target.checked)}
                                                className="w-5 h-5 rounded border-zinc-600 bg-white dark:bg-zinc-900 text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="ml-3">
                                                <span className="block text-sm font-medium text-zinc-900 dark:text-white">Generate Analysis Report</span>
                                                <span className="block text-xs text-zinc-500 dark:text-zinc-400">Create PDF summary after analysis completes</span>
                                            </div>
                                        </label>
                                    </div>
                                </section>
                            </>
                        )}

                        {activeTab === 'general' && (
                            <section className="flex flex-col gap-5">
                                <div className="border-b border-zinc-300 dark:border-zinc-700 pb-2">
                                    <h3 className="text-zinc-900 dark:text-white text-lg font-medium">General Settings</h3>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Configure basic application preferences.</p>
                                </div>
                                <Select
                                    label="Language"
                                    value="en"
                                    onChange={() => { }}
                                    options={[
                                        { value: 'en', label: 'English' },
                                        { value: 'es', label: 'Español' },
                                        { value: 'de', label: 'Deutsch' },
                                    ]}
                                />
                                <Select
                                    label="Unit System"
                                    value="si"
                                    onChange={() => { }}
                                    options={[
                                        { value: 'si', label: 'SI (Metric)' },
                                        { value: 'imperial', label: 'Imperial (US)' },
                                    ]}
                                />
                            </section>
                        )}

                        {activeTab === 'display' && (
                            <section className="flex flex-col gap-5">
                                <div className="border-b border-zinc-300 dark:border-zinc-700 pb-2">
                                    <h3 className="text-zinc-900 dark:text-white text-lg font-medium">Display Settings</h3>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Customize the visual appearance.</p>
                                </div>
                                <Select
                                    label="Theme"
                                    value="dark"
                                    onChange={() => { }}
                                    options={[
                                        { value: 'dark', label: 'Dark (Default)' },
                                        { value: 'light', label: 'Light' },
                                        { value: 'system', label: 'System' },
                                    ]}
                                />
                                <Toggle
                                    enabled={true}
                                    onChange={() => { }}
                                    label="Show Grid Lines"
                                    description="Display grid lines in the 3D viewport."
                                />
                            </section>
                        )}

                        {activeTab === 'profile' && (
                            <section className="flex flex-col gap-5">
                                <div className="border-b border-zinc-300 dark:border-zinc-700 pb-2">
                                    <h3 className="text-zinc-900 dark:text-white text-lg font-medium">User Profile</h3>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Manage your account information.</p>
                                </div>
                                <div className="flex items-center gap-4 p-4 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                                    <div>
                                        <p className="text-white font-bold">User</p>
                                        <p className="text-zinc-500 dark:text-zinc-400 text-sm">user@beamlab.com</p>
                                    </div>
                                </div>
                                <Input
                                    label="Display Name"
                                    value="Engineer"
                                    onChange={() => { }}
                                    placeholder="Your name"
                                />
                            </section>
                        )}
                    </div>
                </div>

                {/* Decorative Background */}
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-blue-600/5 to-transparent pointer-events-none" />
            </main>
        </div>
    );
};

export default SettingsPage;
