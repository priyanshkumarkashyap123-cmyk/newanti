/**
 * SettingsPage - BeamLab Settings
 * Dark theme with sidebar navigation and analysis preferences
 */

import { FC, useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Settings, Monitor, BarChart2, User, LogOut, ChevronDown,
    Cpu, Zap, Save, RotateCcw, Check, HardDrive,
    Ruler, Keyboard, Bell, CreditCard
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../providers/AuthProvider';
import { useSubscription } from '../hooks/useSubscription';

// ============================================
// TYPES
// ============================================

type TabId = 'general' | 'display' | 'analysis' | 'profile' | 'units' | 'shortcuts' | 'notifications' | 'subscription';

interface NavItem {
    id: TabId;
    label: string;
    icon: FC<{ className?: string }>;
}

// ============================================
// NAV ITEMS
// ============================================

const NAV_ITEMS: NavItem[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'general', label: 'General', icon: Settings },
    { id: 'units', label: 'Units & Precision', icon: Ruler },
    { id: 'display', label: 'Appearance', icon: Monitor },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'analysis', label: 'Analysis Preferences', icon: BarChart2 },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
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
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[#1a2333] bg-[#131b2e] p-5">
        <div className="flex items-start gap-4">
            <div className="p-3 rounded bg-slate-200/30 dark:bg-slate-700/30 text-[#dae2fd]">
                <Cpu className="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-1">
                <p className="text-[#dae2fd] text-base font-bold">{label}</p>
                {description && <p className="text-[#869ab8] text-sm">{description}</p>}
                {statusText && (
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs text-[#869ab8]">{statusText}</span>
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
                w-10 h-[22px] rounded-full peer 
                ${enabled ? 'bg-blue-500' : 'bg-slate-600'}
                peer-focus:outline-none
                after:content-[''] after:absolute after:top-[2px] 
                ${enabled ? 'after:right-[2px]' : 'after:left-[2px]'}
                after:bg-white after:border-slate-300 after:border 
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
        <label className="text-[#869ab8] text-sm font-medium tracking-wide tracking-wide">{label}</label>
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] h-12 px-4 pr-10 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#869ab8] pointer-events-none" />
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
        <label className="text-[#869ab8] text-sm font-medium tracking-wide tracking-wide">{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            className={`w-full rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] h-12 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm placeholder:text-slate-500 dark:placeholder:text-slate-400 ${readOnly ? 'text-[#869ab8] cursor-default' : ''}`}
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
    <div className="bg-[#131b2e] border border-[#1a2333] rounded-lg p-5">
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <label className="text-[#dae2fd] text-base font-medium tracking-wide tracking-wide">{label}</label>
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
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" 
                />
            </div>
            <div className="flex justify-between text-xs text-[#869ab8] font-mono uppercase">
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
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('analysis');
    const navigate = useNavigate();
    const { signOut, user } = useAuth();
    const { subscription } = useSubscription();

    // ============================================
    // SETTINGS PERSISTENCE via localStorage
    // ============================================
    const SETTINGS_KEY = 'beamlab_settings';

    const loadSettings = () => {
        try {
            const stored = localStorage.getItem(SETTINGS_KEY);
            if (stored) return JSON.parse(stored);
        } catch { /* ignore */ }
        return null;
    };

    const savedSettings = loadSettings();

    // Settings State — initialized from localStorage or defaults
    // Analysis tab
    const [solverEngine, setSolverEngine] = useState(savedSettings?.solverEngine ?? 'linear_static');
    const [precision, setPrecision] = useState(savedSettings?.precision ?? 'double');
    const [maxIterations, setMaxIterations] = useState(savedSettings?.maxIterations ?? '1000');
    const [tolerance, setTolerance] = useState(savedSettings?.tolerance ?? '1e-6');
    const [meshDensity, setMeshDensity] = useState(savedSettings?.meshDensity ?? 75);
    const [adaptiveMesh, setAdaptiveMesh] = useState(savedSettings?.adaptiveMesh ?? false);
    const [parallelProcessing, setParallelProcessing] = useState(savedSettings?.parallelProcessing ?? true);
    const [gpuAcceleration, setGpuAcceleration] = useState(savedSettings?.gpuAcceleration ?? true);
    const [autoSaveResults, setAutoSaveResults] = useState(savedSettings?.autoSaveResults ?? false);
    const [generateReport, setGenerateReport] = useState(savedSettings?.generateReport ?? true);
    const [settingsSaved, setSettingsSaved] = useState(false);

    // General tab
    const [language, setLanguage] = useState(savedSettings?.language ?? 'en');
    const [unitSystem, setUnitSystem] = useState(savedSettings?.unitSystem ?? 'si');

    // Display tab
    const [theme, setTheme] = useState(savedSettings?.theme ?? 'dark');
    const [showGrid, setShowGrid] = useState(savedSettings?.showGrid ?? true);

    // Profile tab
    const [displayName, setDisplayName] = useState(savedSettings?.displayName ?? (user?.fullName || 'Engineer'));
    const [role, setRole] = useState(savedSettings?.role ?? 'Structural Engineer');
    const [organization, setOrganization] = useState(savedSettings?.organization ?? '');
    const [licenseNo, setLicenseNo] = useState(savedSettings?.licenseNo ?? '');

    // Units tab
    const [lengthUnit, setLengthUnit] = useState(savedSettings?.lengthUnit ?? 'm');
    const [sectionDimUnit, setSectionDimUnit] = useState(savedSettings?.sectionDimUnit ?? 'mm');
    const [forceUnit, setForceUnit] = useState(savedSettings?.forceUnit ?? 'kN');
    const [momentUnit, setMomentUnit] = useState(savedSettings?.momentUnit ?? 'kNm');
    const [stressUnit, setStressUnit] = useState(savedSettings?.stressUnit ?? 'MPa');
    const [tempUnit, setTempUnit] = useState(savedSettings?.tempUnit ?? 'C');

    // Notifications tab
    const [notifAnalysis, setNotifAnalysis] = useState(savedSettings?.notifAnalysis ?? true);
    const [notifWarnings, setNotifWarnings] = useState(savedSettings?.notifWarnings ?? true);
    const [notifShared, setNotifShared] = useState(savedSettings?.notifShared ?? true);
    const [notifUpdates, setNotifUpdates] = useState(savedSettings?.notifUpdates ?? false);
    const [notifMarketing, setNotifMarketing] = useState(savedSettings?.notifMarketing ?? false);

    useEffect(() => { document.title = 'Settings | BeamLab'; }, []);

    // Auto-save settings to localStorage whenever they change
    useEffect(() => {
        const settings = {
            solverEngine, precision, maxIterations, tolerance,
            meshDensity, adaptiveMesh, parallelProcessing, gpuAcceleration,
            autoSaveResults, generateReport,
            language, unitSystem, theme, showGrid,
            displayName, role, organization, licenseNo,
            lengthUnit, sectionDimUnit, forceUnit, momentUnit, stressUnit, tempUnit,
            notifAnalysis, notifWarnings, notifShared, notifUpdates, notifMarketing,
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }, [solverEngine, precision, maxIterations, tolerance, meshDensity, adaptiveMesh, parallelProcessing, gpuAcceleration, autoSaveResults, generateReport, language, unitSystem, theme, showGrid, displayName, role, organization, licenseNo, lengthUnit, sectionDimUnit, forceUnit, momentUnit, stressUnit, tempUnit, notifAnalysis, notifWarnings, notifShared, notifUpdates, notifMarketing]);

    const handleSaveSettings = () => {
        const settings = {
            solverEngine, precision, maxIterations, tolerance,
            meshDensity, adaptiveMesh, parallelProcessing, gpuAcceleration,
            autoSaveResults, generateReport,
            language, unitSystem, theme, showGrid,
            displayName, role, organization, licenseNo,
            lengthUnit, sectionDimUnit, forceUnit, momentUnit, stressUnit, tempUnit,
            notifAnalysis, notifWarnings, notifShared, notifUpdates, notifMarketing,
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        setSettingsSaved(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSettingsSaved(false), 2000);
    };

    const handleResetDefaults = () => {
        setSolverEngine('linear_static');
        setPrecision('double');
        setMaxIterations('1000');
        setTolerance('1e-6');
        setMeshDensity(75);
        setAdaptiveMesh(false);
        setParallelProcessing(true);
        setGpuAcceleration(true);
        setAutoSaveResults(false);
        setGenerateReport(true);
        setLanguage('en');
        setUnitSystem('si');
        setTheme('dark');
        setShowGrid(true);
        setDisplayName(user?.fullName || 'Engineer');
        setRole('Structural Engineer');
        setOrganization('');
        setLicenseNo('');
        setLengthUnit('m');
        setSectionDimUnit('mm');
        setForceUnit('kN');
        setMomentUnit('kNm');
        setStressUnit('MPa');
        setTempUnit('C');
        setNotifAnalysis(true);
        setNotifWarnings(true);
        setNotifShared(true);
        setNotifUpdates(false);
        setNotifMarketing(false);
        localStorage.removeItem(SETTINGS_KEY);
    };

    const getMeshLabel = () => {
        if (meshDensity >= 75) return 'High';
        if (meshDensity >= 50) return 'Normal';
        if (meshDensity >= 25) return 'Fine';
        return 'Coarse';
    };

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch { /* ignore */ }
        navigate('/');
    };

    // Subscription display helpers
    const tierLabel = subscription.tier === 'enterprise' ? 'Enterprise' : subscription.tier === 'pro' ? 'Professional' : 'Free';
    const tierBadge = subscription.tier === 'enterprise' ? '🏢 ENT' : subscription.tier === 'pro' ? '🏆 PRO' : '🆓 FREE';

    return (
        <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] flex">
            {/* Sidebar */}
            <aside className="w-60 flex-shrink-0 flex flex-col border-r border-[#1a2333] bg-[#0b1326]">
                {/* App Header */}
                <div className="p-6 border-b border-[#1a2333]/50">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-lg">B</div>
                        <div>
                            <h1 className="text-[#dae2fd] text-lg font-bold leading-none tracking-tight">BeamLab</h1>
                            <p className="text-[#869ab8] text-xs font-normal mt-1">Ultimate Edition v4.2.0</p>
                        </div>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1">
                    <div className="px-3 mb-2 text-xs font-semibold text-[#869ab8] uppercase tracking-wider">Settings</div>
                    {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <Button
                                key={item.id}
                                variant="ghost"
                                size="default"
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full justify-start gap-3 px-3 py-2.5 rounded transition-colors text-left ${isActive
                                        ? 'bg-blue-600/10 border-l-2 border-blue-500 text-[#dae2fd]'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-[#869ab8] hover:text-slate-900 dark:hover:text-white border-l-2 border-transparent'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-500' : ''}`} />
                                <p className="text-sm font-medium tracking-wide tracking-wide">{item.label}</p>
                            </Button>
                        );
                    })}
                </nav>

                {/* Sign Out */}
                <div className="p-4 border-t border-[#1a2333]/50">
                    <Button
                        variant="ghost"
                        size="default"
                        onClick={handleSignOut}
                        className="w-full justify-start gap-2 text-[#869ab8] hover:text-slate-900 dark:hover:text-white text-sm font-medium tracking-wide tracking-wide transition-colors px-2 py-2"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0b1326] relative">
                {/* Header */}
                <header className="flex-shrink-0 h-16 border-b border-[#1a2333] flex items-center justify-between px-8 bg-[#0b1326] backdrop-blur-md sticky top-0 z-10">
                    <h2 className="text-xl font-bold tracking-tight text-[#dae2fd]">
                        {NAV_ITEMS.find(n => n.id === activeTab)?.label}
                    </h2>
                    <div className="flex gap-3">
                        <Button variant="outline" size="sm" onClick={handleResetDefaults} className="flex items-center gap-2 border-[#1a2333] text-[#869ab8] hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white">
                            <RotateCcw className="w-4 h-4" />
                            Reset Defaults
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSaveSettings} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20">
                            {settingsSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                            {settingsSaved ? 'Saved!' : 'Save Changes'}
                        </Button>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-3xl flex flex-col gap-8 pb-12">

                        {activeTab === 'analysis' && (
                            <>
                                {/* Solver Configuration */}
                                <section className="flex flex-col gap-5">
                                    <div className="border-b border-[#1a2333] pb-2">
                                        <h3 className="text-[#dae2fd] text-lg font-medium tracking-wide tracking-wide">Solver Configuration</h3>
                                        <p className="text-[#869ab8] text-sm mt-1">Configure the core computational engine parameters.</p>
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
                                    <div className="border-b border-[#1a2333] pb-2">
                                        <h3 className="text-[#dae2fd] text-lg font-medium tracking-wide tracking-wide">Meshing & Discretization</h3>
                                        <p className="text-[#869ab8] text-sm mt-1">Control the density and quality of the finite element mesh.</p>
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
                                    <div className="border-b border-[#1a2333] pb-2">
                                        <h3 className="text-[#dae2fd] text-lg font-medium tracking-wide tracking-wide">Performance & Hardware</h3>
                                        <p className="text-[#869ab8] text-sm mt-1">Manage computational resources and hardware acceleration.</p>
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
                                    <div className="border-b border-[#1a2333] pb-2">
                                        <h3 className="text-[#dae2fd] text-lg font-medium tracking-wide tracking-wide">Output Handling</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <label className="flex items-center p-4 rounded-lg border border-[#1a2333] bg-[#131b2e] cursor-pointer hover:border-blue-500/50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={autoSaveResults}
                                                onChange={(e) => setAutoSaveResults(e.target.checked)}
                                                className="w-5 h-5 rounded border-slate-600 bg-[#0b1326] text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="ml-3">
                                                <span className="block text-sm font-medium tracking-wide tracking-wide text-[#dae2fd]">Auto-save Intermediate Results</span>
                                                <span className="block text-xs text-[#869ab8]">Save state after each iteration step (uses more disk space)</span>
                                            </div>
                                        </label>
                                        <label className="flex items-center p-4 rounded-lg border border-[#1a2333] bg-[#131b2e] cursor-pointer hover:border-blue-500/50 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={generateReport}
                                                onChange={(e) => setGenerateReport(e.target.checked)}
                                                className="w-5 h-5 rounded border-slate-600 bg-[#0b1326] text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="ml-3">
                                                <span className="block text-sm font-medium tracking-wide tracking-wide text-[#dae2fd]">Generate Analysis Report</span>
                                                <span className="block text-xs text-[#869ab8]">Create PDF summary after analysis completes</span>
                                            </div>
                                        </label>
                                    </div>
                                </section>
                            </>
                        )}

                        {activeTab === 'general' && (
                            <section className="flex flex-col gap-5">
                                <div className="border-b border-[#1a2333] pb-2">
                                    <h3 className="text-[#dae2fd] text-lg font-medium tracking-wide tracking-wide">General Settings</h3>
                                    <p className="text-[#869ab8] text-sm mt-1">Configure basic application preferences.</p>
                                </div>
                                <Select
                                    label="Language"
                                    value={language}
                                    onChange={setLanguage}
                                    options={[
                                        { value: 'en', label: 'English' },
                                        { value: 'es', label: 'Español' },
                                        { value: 'de', label: 'Deutsch' },
                                    ]}
                                />
                                <Select
                                    label="Unit System"
                                    value={unitSystem}
                                    onChange={setUnitSystem}
                                    options={[
                                        { value: 'si', label: 'SI (Metric)' },
                                        { value: 'imperial', label: 'Imperial (US)' },
                                    ]}
                                />
                            </section>
                        )}

                        {activeTab === 'display' && (
                            <section className="flex flex-col gap-5">
                                <div className="border-b border-[#1a2333] pb-2">
                                    <h3 className="text-[#dae2fd] text-lg font-medium tracking-wide tracking-wide">Display Settings</h3>
                                    <p className="text-[#869ab8] text-sm mt-1">Customize the visual appearance.</p>
                                </div>
                                <Select
                                    label="Theme"
                                    value={theme}
                                    onChange={setTheme}
                                    options={[
                                        { value: 'dark', label: 'Dark (Default)' },
                                        { value: 'light', label: 'Light' },
                                        { value: 'system', label: 'System' },
                                    ]}
                                />
                                <Toggle
                                    enabled={showGrid}
                                    onChange={setShowGrid}
                                    label="Show Grid Lines"
                                    description="Display grid lines in the 3D viewport."
                                />
                            </section>
                        )}

                        {activeTab === 'profile' && (
                            <section className="flex flex-col gap-5">
                                <div className="border-b border-[#1a2333] pb-2">
                                    <h3 className="text-[#dae2fd] text-lg font-medium tracking-wide tracking-wide">User Profile</h3>
                                    <p className="text-[#869ab8] text-sm mt-1">Manage your account information.</p>
                                </div>
                                <div className="flex items-center gap-4 p-4 rounded-lg border border-[#1a2333] bg-[#131b2e]">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                                    <div>
                                        <p className="text-[#dae2fd] font-bold">{user?.fullName || displayName}</p>
                                        <p className="text-[#869ab8] text-sm">{user?.email || 'user@beamlabultimate.tech'}</p>
                                    </div>
                                </div>
                                <Input
                                    label="Display Name"
                                    value={displayName}
                                    onChange={setDisplayName}
                                    placeholder="Your name"
                                />
                                <Input
                                    label="Role"
                                    value={role}
                                    onChange={setRole}
                                    placeholder="Your role"
                                />
                                <Input
                                    label="Organization"
                                    value={organization}
                                    onChange={setOrganization}
                                    placeholder="Company name"
                                />
                                <Input
                                    label="License No."
                                    value={licenseNo}
                                    onChange={setLicenseNo}
                                    placeholder="SE-2024-XXXX"
                                />
                            </section>
                        )}

                        {/* Units & Precision - per Figma §17.3 */}
                        {activeTab === 'units' && (
                            <section className="flex flex-col gap-5">
                                <div className="border-b border-[#1a2333] pb-2">
                                    <h3 className="text-[#dae2fd] text-lg font-medium tracking-wide tracking-wide">Units & Precision</h3>
                                    <p className="text-[#869ab8] text-sm mt-1">Configure measurement units for your projects.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium tracking-wide tracking-wide text-slate-400">Preset:</span>
                                    {['SI (Metric)', 'Imperial', 'MKS', 'Custom'].map((preset) => (
                                        <label key={preset} className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer">
                                            <input type="radio" name="unitPreset" defaultChecked={preset === 'SI (Metric)'}
                                                className="accent-blue-500" />
                                            {preset}
                                        </label>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Select label="Length" value={lengthUnit} onChange={setLengthUnit} options={[
                                        { value: 'm', label: 'meters (m)' },
                                        { value: 'mm', label: 'millimeters (mm)' },
                                        { value: 'ft', label: 'feet (ft)' },
                                        { value: 'in', label: 'inches (in)' },
                                    ]} />
                                    <Select label="Section Dimensions" value={sectionDimUnit} onChange={setSectionDimUnit} options={[
                                        { value: 'mm', label: 'millimeters (mm)' },
                                        { value: 'cm', label: 'centimeters (cm)' },
                                        { value: 'in', label: 'inches (in)' },
                                    ]} />
                                    <Select label="Force" value={forceUnit} onChange={setForceUnit} options={[
                                        { value: 'kN', label: 'kilonewtons (kN)' },
                                        { value: 'N', label: 'newtons (N)' },
                                        { value: 'kip', label: 'kips' },
                                        { value: 'kgf', label: 'kgf' },
                                    ]} />
                                    <Select label="Moment" value={momentUnit} onChange={setMomentUnit} options={[
                                        { value: 'kNm', label: 'kN·m' },
                                        { value: 'kNmm', label: 'kN·mm' },
                                        { value: 'kipft', label: 'kip·ft' },
                                    ]} />
                                    <Select label="Stress" value={stressUnit} onChange={setStressUnit} options={[
                                        { value: 'MPa', label: 'MPa (N/mm²)' },
                                        { value: 'kPa', label: 'kPa' },
                                        { value: 'psi', label: 'psi' },
                                        { value: 'ksi', label: 'ksi' },
                                    ]} />
                                    <Select label="Temperature" value={tempUnit} onChange={setTempUnit} options={[
                                        { value: 'C', label: '°C' },
                                        { value: 'F', label: '°F' },
                                    ]} />
                                </div>
                                <div className="border-t border-slate-700 pt-4">
                                    <h4 className="text-sm font-medium tracking-wide tracking-wide text-slate-300 mb-3">Display Format</h4>
                                    <div className="flex flex-col gap-2">
                                        {['1,234.56 (comma thousands)', '1.234,56 (European)', '1234.56 (no separator)'].map((fmt, i) => (
                                            <label key={fmt} className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                                                <input type="radio" name="numFormat" defaultChecked={i === 0} className="accent-blue-500" />
                                                {fmt}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <Button variant="outline" size="sm">Reset to Default</Button>
                                    <Button size="sm">Save</Button>
                                </div>
                            </section>
                        )}

                        {/* Keyboard Shortcuts - per Figma §17.5 */}
                        {activeTab === 'shortcuts' && (
                            <section className="flex flex-col gap-5">
                                <div className="border-b border-[#1a2333] pb-2">
                                    <h3 className="text-[#dae2fd] text-lg font-medium tracking-wide tracking-wide">Keyboard Shortcuts</h3>
                                    <p className="text-[#869ab8] text-sm mt-1">Customize your keyboard shortcuts.</p>
                                </div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-sm font-medium tracking-wide tracking-wide text-slate-400">Preset:</span>
                                    {['Default', 'STAAD-like', 'AutoCAD-like'].map((preset) => (
                                        <label key={preset} className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer">
                                            <input type="radio" name="shortcutPreset" defaultChecked={preset === 'Default'} className="accent-blue-500" />
                                            {preset}
                                        </label>
                                    ))}
                                </div>
                                {[
                                    { category: 'General', shortcuts: [
                                        { action: 'Save', key: '⌘S' },
                                        { action: 'Undo', key: '⌘Z' },
                                        { action: 'Redo', key: '⌘⇧Z' },
                                        { action: 'Delete', key: '⌫' },
                                        { action: 'Select All', key: '⌘A' },
                                        { action: 'Command Palette', key: '⌘K' },
                                    ]},
                                    { category: 'Modeling', shortcuts: [
                                        { action: 'Add Node', key: 'N' },
                                        { action: 'Add Member', key: 'M' },
                                        { action: 'Add Support', key: 'S' },
                                        { action: 'Add Load', key: 'L' },
                                        { action: 'Move', key: 'G' },
                                        { action: 'Rotate', key: 'R' },
                                    ]},
                                    { category: 'View', shortcuts: [
                                        { action: 'Zoom to Fit', key: 'F' },
                                        { action: 'Top View', key: 'Numpad 7' },
                                        { action: 'Front View', key: 'Numpad 1' },
                                        { action: 'Toggle Wireframe', key: 'W' },
                                    ]},
                                    { category: 'Analysis', shortcuts: [
                                        { action: 'Run Analysis', key: 'F5' },
                                        { action: 'Show BMD', key: 'B' },
                                        { action: 'Show SFD', key: 'V' },
                                        { action: 'Show Deformed', key: 'D' },
                                    ]},
                                ].map((group) => (
                                    <div key={group.category}>
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{group.category}</h4>
                                        <div className="border border-slate-700 rounded-lg overflow-hidden">
                                            {group.shortcuts.map((s, i) => (
                                                <div key={s.action} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-slate-700' : ''}`}>
                                                    <span className="text-slate-300">{s.action}</span>
                                                    <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 font-mono">{s.key}</kbd>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-end gap-3 pt-4">
                                    <Button variant="outline" size="sm">Reset All</Button>
                                    <Button variant="outline" size="sm">Export Shortcuts</Button>
                                </div>
                            </section>
                        )}

                        {/* Notifications - per Figma §17 */}
                        {activeTab === 'notifications' && (
                            <section className="flex flex-col gap-5">
                                <div className="border-b border-[#1a2333] pb-2">
                                    <h3 className="text-[#dae2fd] text-lg font-medium tracking-wide tracking-wide">Notifications</h3>
                                    <p className="text-[#869ab8] text-sm mt-1">Control how you receive notifications.</p>
                                </div>
                                <Toggle enabled={notifAnalysis} onChange={setNotifAnalysis} label="Analysis Completed" description="Get notified when an analysis run finishes." />
                                <Toggle enabled={notifWarnings} onChange={setNotifWarnings} label="Design Warnings" description="Receive alerts for elements exceeding utilization limits." />
                                <Toggle enabled={notifShared} onChange={setNotifShared} label="Shared Projects" description="Get notified when someone shares a project with you." />
                                <Toggle enabled={notifUpdates} onChange={setNotifUpdates} label="Product Updates" description="Receive emails about new features and updates." />
                                <Toggle enabled={notifMarketing} onChange={setNotifMarketing} label="Marketing Emails" description="Occasional tips, case studies, and offers." />
                            </section>
                        )}

                        {/* Subscription - per Figma §17.6 */}
                        {activeTab === 'subscription' && (
                            <section className="flex flex-col gap-5">
                                <div className="border-b border-[#1a2333] pb-2">
                                    <h3 className="text-[#dae2fd] text-lg font-medium tracking-wide tracking-wide">Subscription & Billing</h3>
                                    <p className="text-[#869ab8] text-sm mt-1">Manage your plan and billing information.</p>
                                </div>
                                <div className="p-5 rounded-lg border border-slate-700 bg-slate-800">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-bold text-white">Professional</span>
                                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded">🏆 PRO</span>
                                            </div>
                                            <p className="text-sm text-slate-400 mt-1">● Active · Next billing: Feb 15, 2025</p>
                                        </div>
                                        <p className="text-2xl font-bold text-white">₹4,999<span className="text-sm text-slate-400 font-normal">/month</span></p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {['Unlimited projects', 'All analysis types', 'All design codes', 'AI features (100/day)', 'BIM integration', 'Priority support'].map((f) => (
                                            <div key={f} className="flex items-center gap-2 text-slate-300">
                                                <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                                                {f}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium tracking-wide tracking-wide text-slate-300 mb-3">Usage This Month</h4>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'AI Queries', used: 47, max: 100, unit: '/day' },
                                            { label: 'Storage', used: 2.3, max: 50, unit: ' GB' },
                                            { label: 'Team Members', used: 3, max: 5, unit: '' },
                                        ].map((u) => (
                                            <div key={u.label} className="flex items-center gap-3">
                                                <span className="text-sm text-slate-400 w-28">{u.label}</span>
                                                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(u.used / u.max) * 100}%` }} />
                                                </div>
                                                <span className="text-xs text-slate-400 w-20 text-right">{u.used}/{u.max}{u.unit}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button variant="premium" size="sm">Upgrade to Enterprise →</Button>
                                    <Button variant="outline" size="sm">Cancel Subscription</Button>
                                </div>
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
