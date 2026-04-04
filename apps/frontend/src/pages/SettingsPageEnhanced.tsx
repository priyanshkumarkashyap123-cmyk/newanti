/**
 * SettingsPageEnhanced - BeamLab Settings (Advanced Template)
 * Professional dark theme with advanced UI components and tabbed navigation
 */

import { FC, useState, useEffect, useRef } from 'react';
import { AdvancedToggle, RangeSlider } from '../components/ui';
import { useConfirm } from '../components/ui/ConfirmDialog';
import {
    detectLocalComputeCapability,
    getComputePreference,
    setComputePreference,
    type ComputePreference,
    type LocalComputeCapability,
} from '../utils/computePreference';

// ============================================
// TYPES
// ============================================

type TabId = 'general' | 'display' | 'analysis' | 'profile' | 'performance';

interface NavItem {
    id: TabId;
    label: string;
    icon: string; // Material icon name
}

// ============================================
// SETTINGS PAGE
// ============================================

export const SettingsPageEnhanced: FC = () => {
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState<TabId>('general');

    useEffect(() => { document.title = 'Settings | BeamLab'; }, []);

    // General settings
    const [autoSave, setAutoSave] = useState(true);
    const [cloudSync, setCloudSync] = useState(false);
    const [notifications, setNotifications] = useState(true);

    // Display settings
    const [darkMode, setDarkMode] = useState(true);
    const [gridVisible, setGridVisible] = useState(true);
    const [gridSize, setGridSize] = useState(1.0);
    const [axesVisible, setAxesVisible] = useState(true);

    // Analysis settings
    const [autoAnalyze, setAutoAnalyze] = useState(false);
    const [meshDensity, setMeshDensity] = useState(50);
    const [solverPrecision, setSolverPrecision] = useState(3);
    const [gpuAcceleration, setGpuAcceleration] = useState(false);
    const [computePreference, setComputePreferenceState] = useState<ComputePreference>(getComputePreference());
    const [localCapability, setLocalCapability] = useState<LocalComputeCapability | null>(null);
    const [capabilityLoading, setCapabilityLoading] = useState(false);

    // Performance settings
    const [renderQuality, setRenderQuality] = useState(75);
    const [maxNodeCount, setMaxNodeCount] = useState(1000);

    // User profile
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userOrg, setUserOrg] = useState('');

    // Save feedback
    const [saved, setSaved] = useState(false);

    const navItems: NavItem[] = [
        { id: 'general', label: 'General', icon: 'settings' },
        { id: 'display', label: 'Display', icon: 'monitor' },
        { id: 'analysis', label: 'Analysis', icon: 'analytics' },
        { id: 'performance', label: 'Performance', icon: 'speed' },
        { id: 'profile', label: 'Profile', icon: 'person' },
    ];

    const getMeshLabel = () => {
        if (meshDensity < 25) return 'Coarse';
        if (meshDensity < 50) return 'Normal';
        if (meshDensity < 75) return 'Fine';
        return 'Ultra';
    };

    const getPrecisionLabel = () => {
        return `1e-${solverPrecision}`;
    };

    useEffect(() => {
        let active = true;
        setCapabilityLoading(true);
        detectLocalComputeCapability()
            .then((capability) => {
                if (!active) return;
                setLocalCapability(capability);
                // Keep old toggle in sync with real compute preference
                setGpuAcceleration(getComputePreference() === 'local');
            })
            .finally(() => {
                if (active) setCapabilityLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const updateComputePreference = (pref: ComputePreference) => {
        setComputePreference(pref);
        setComputePreferenceState(pref);
        setGpuAcceleration(pref === 'local');
    };

    const handleSaveSettings = () => {
        setSaved(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    };

    const handleResetSettings = async () => {
        if (await confirm({ title: 'Reset Settings', message: 'Are you sure you want to reset all settings to defaults?', variant: 'warning' })) {
            // Reset all settings
            setAutoSave(true);
            setCloudSync(false);
            setNotifications(true);
            setDarkMode(true);
            setGridVisible(true);
            setGridSize(1.0);
            setAutoAnalyze(false);
            setMeshDensity(50);
            setSolverPrecision(3);
            setGpuAcceleration(false);
            updateComputePreference('auto');
            setRenderQuality(75);
            setMaxNodeCount(1000);
        }
    };

    return (
        <div className="flex flex-col font-display">
            {/* Action Bar */}
            <div className="h-14 border-b border-[#1a2333] flex items-center justify-end px-6 shrink-0 bg-[#0b1326]">
                <div className="flex items-center gap-3">
                    <button type="button"
                        onClick={handleResetSettings}
                        className="flex items-center gap-2 h-9 px-4 rounded-lg border border-[#1a2333] text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500 transition-colors text-sm font-medium tracking-wide"
                    >
                        <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                        Reset
                    </button>
                    <button type="button"
                        onClick={handleSaveSettings}
                        className="flex items-center gap-2 h-9 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        {saved ? '✓ Saved' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <aside className="w-64 bg-surface-dark border-r border-border-dark flex flex-col p-4 shrink-0">
                    <nav className="space-y-1">
                        {navItems.map((item) => (
                            <button type="button"
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium tracking-wide transition-all ${activeTab === item.id
                                        ? 'bg-primary text-[#dae2fd] shadow-lg shadow-primary/20'
                                        : 'text-text-muted hover:bg-[#131b2e] hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    {/* Version Info */}
                    <div className="mt-auto pt-4 border-t border-border-dark">
                        <div className="text-xs text-text-muted space-y-1">
                            <p>BeamLab</p>
                            <p className="font-mono">v4.2.0-pro</p>
                            <p className="text-[10px]">© {new Date().getFullYear()} BeamLab Ultimate</p>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-3xl">
                        {/* General Settings */}
                        {activeTab === 'general' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-[#dae2fd] mb-2">General Settings</h2>
                                    <p className="text-text-muted text-sm">Configure core application behavior and data management</p>
                                </div>

                                <div className="space-y-4">
                                    <AdvancedToggle
                                        label="Auto-Save"
                                        description="Automatically save your work every 5 minutes"
                                        statusText={autoSave ? 'Enabled' : 'Disabled'}
                                        enabled={autoSave}
                                        onChange={setAutoSave}
                                        icon={<span className="material-symbols-outlined text-[20px]">save</span>}
                                    />

                                    <AdvancedToggle
                                        label="Cloud Synchronization"
                                        description="Sync projects across devices using cloud storage"
                                        statusText={cloudSync ? 'Syncing' : 'Local Only'}
                                        enabled={cloudSync}
                                        onChange={setCloudSync}
                                        icon={<span className="material-symbols-outlined text-[20px]">cloud</span>}
                                    />

                                    <AdvancedToggle
                                        label="Push Notifications"
                                        description="Receive desktop notifications for analysis completion and errors"
                                        enabled={notifications}
                                        onChange={setNotifications}
                                        icon={<span className="material-symbols-outlined text-[20px]">notifications</span>}
                                    />
                                </div>

                                <div className="pt-4">
                                    <h3 className="text-sm font-bold text-[#dae2fd] mb-3 uppercase tracking-wider">Data Management</h3>
                                    <div className="bg-surface-dark border border-border-dark rounded-lg p-5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[#dae2fd] text-sm font-medium tracking-wide">Local Storage Used</p>
                                                <p className="text-text-muted text-xs">45.2 MB of 500 MB</p>
                                            </div>
                                            <button type="button" className="text-xs font-bold text-primary hover:underline">Clear Cache</button>
                                        </div>
                                        <div className="w-full h-2 bg-[#0b1326] rounded-full overflow-hidden">
                                            <div className="h-full bg-primary rounded-full" style={{ width: '9%' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Display Settings */}
                        {activeTab === 'display' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-[#dae2fd] mb-2">Display Settings</h2>
                                    <p className="text-text-muted text-sm">Customize viewport appearance and visual preferences</p>
                                </div>

                                <div className="space-y-4">
                                    <AdvancedToggle
                                        label="Dark Mode"
                                        description="Use dark interface theme (recommended for extended use)"
                                        enabled={darkMode}
                                        onChange={setDarkMode}
                                        icon={<span className="material-symbols-outlined text-[20px]">dark_mode</span>}
                                    />

                                    <AdvancedToggle
                                        label="Show Grid"
                                        description="Display construction grid in viewport"
                                        enabled={gridVisible}
                                        onChange={setGridVisible}
                                        icon={<span className="material-symbols-outlined text-[20px]">grid_on</span>}
                                    />

                                    <AdvancedToggle
                                        label="Show Axes"
                                        description="Display global X, Y, Z coordinate axes"
                                        enabled={axesVisible}
                                        onChange={setAxesVisible}
                                        icon={<span className="material-symbols-outlined text-[20px]">contrast</span>}
                                    />
                                </div>

                                <div>
                                    <label className="text-[#869ab8] text-sm font-medium tracking-wide block mb-2">Grid Spacing</label>
                                    <div className="bg-surface-dark border border-border-dark rounded-lg p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[#dae2fd] text-sm">Current: {gridSize.toFixed(1)} m</span>
                                            <input
                                                type="number"
                                                value={gridSize}
                                                onChange={(e) => setGridSize(parseFloat(e.target.value) || 1.0)}
                                                step="0.1"
                                                min="0.1"
                                                max="10"
                                                className="w-24 bg-[#0b1326] border border-[#1a2333] rounded px-3 py-1 text-[#dae2fd] text-sm"
                                            />
                                        </div>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="10"
                                            step="0.1"
                                            value={gridSize}
                                            onChange={(e) => setGridSize(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Analysis Settings */}
                        {activeTab === 'analysis' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-[#dae2fd] mb-2">Analysis Preferences</h2>
                                    <p className="text-text-muted text-sm">Configure solver behavior and computation settings</p>
                                </div>

                                <div className="space-y-4">
                                    <AdvancedToggle
                                        label="Auto-Analyze on Model Change"
                                        description="Automatically run analysis when model is modified"
                                        enabled={autoAnalyze}
                                        onChange={setAutoAnalyze}
                                        icon={<span className="material-symbols-outlined text-[20px]">autorenew</span>}
                                    />

                                    <AdvancedToggle
                                        label="Use My Device for Analysis"
                                        description="Run supported analysis locally using WASM/WebGPU when your laptop is capable"
                                        statusText={gpuAcceleration ? 'Local preferred' : 'Cloud preferred'}
                                        enabled={gpuAcceleration}
                                        onChange={(enabled) => updateComputePreference(enabled ? 'local' : 'cloud')}
                                        icon={<span className="material-symbols-outlined text-[20px]">memory</span>}
                                    />
                                </div>

                                <div className="bg-surface-dark border border-border-dark rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[#dae2fd] text-sm font-semibold">Compute Mode</p>
                                            <p className="text-text-muted text-xs">
                                                Choose where structural analysis should run.
                                            </p>
                                        </div>
                                        <div className="text-[11px] px-2 py-1 rounded-md border border-[#1a2333] text-slate-600 dark:text-slate-300">
                                            {capabilityLoading ? 'Detecting hardware...' : (localCapability?.reason ?? 'Capability unknown')}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateComputePreference('auto')}
                                            className={`px-3 py-2 rounded-lg border text-xs font-semibold transition ${computePreference === 'auto'
                                                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                                                : 'border-[#1a2333] text-slate-600 dark:text-slate-300 hover:border-blue-400'
                                                }`}
                                        >
                                            Auto (recommended)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateComputePreference('local')}
                                            className={`px-3 py-2 rounded-lg border text-xs font-semibold transition ${computePreference === 'local'
                                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                                                : 'border-[#1a2333] text-slate-600 dark:text-slate-300 hover:border-emerald-400'
                                                }`}
                                        >
                                            My Device (WASM/WebGPU)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateComputePreference('cloud')}
                                            className={`px-3 py-2 rounded-lg border text-xs font-semibold transition ${computePreference === 'cloud'
                                                ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                                                : 'border-[#1a2333] text-slate-600 dark:text-slate-300 hover:border-purple-400'
                                                }`}
                                        >
                                            Cloud GPU
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                                        <div className="rounded-md border border-[#1a2333] px-2 py-1">
                                            <span className="text-text-muted">WebGPU</span>
                                            <p className="text-[#dae2fd] font-medium tracking-wide">{localCapability?.webGpuAvailable ? 'Available' : 'Unavailable'}</p>
                                        </div>
                                        <div className="rounded-md border border-[#1a2333] px-2 py-1">
                                            <span className="text-text-muted">CPU Cores</span>
                                            <p className="text-[#dae2fd] font-medium tracking-wide">{localCapability?.cpuCores ?? 'Unknown'}</p>
                                        </div>
                                        <div className="rounded-md border border-[#1a2333] px-2 py-1">
                                            <span className="text-text-muted">Device Memory</span>
                                            <p className="text-[#dae2fd] font-medium tracking-wide">{localCapability?.deviceMemoryGb ? `${localCapability.deviceMemoryGb} GB` : 'Unknown'}</p>
                                        </div>
                                        <div className="rounded-md border border-[#1a2333] px-2 py-1">
                                            <span className="text-text-muted">Local Node Limit</span>
                                            <p className="text-[#dae2fd] font-medium tracking-wide">~{localCapability?.maxRecommendedLocalNodes ?? 0}</p>
                                        </div>
                                    </div>
                                </div>

                                <RangeSlider
                                    label="Global Mesh Density"
                                    value={meshDensity}
                                    onChange={setMeshDensity}
                                    min={0}
                                    max={100}
                                    labels={['Coarse', 'Normal', 'Fine', 'Ultra']}
                                    valueLabel={getMeshLabel()}
                                />

                                <RangeSlider
                                    label="Solver Precision"
                                    value={solverPrecision}
                                    onChange={setSolverPrecision}
                                    min={1}
                                    max={8}
                                    step={1}
                                    labels={['1e-1', '1e-4', '1e-8']}
                                    valueLabel={getPrecisionLabel()}
                                />

                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-blue-400 text-[20px] mt-0.5">info</span>
                                        <div>
                                            <p className="text-blue-400 text-sm font-bold mb-1">Analysis Tips</p>
                                            <p className="text-blue-300 text-xs leading-relaxed">
                                                Higher mesh density increases accuracy but requires more computation time.
                                                Precision below 1e-3 may cause convergence issues for large models.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Performance Settings */}
                        {activeTab === 'performance' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-[#dae2fd] mb-2">Performance Settings</h2>
                                    <p className="text-text-muted text-sm">Optimize application speed and resource usage</p>
                                </div>

                                <RangeSlider
                                    label="3D Render Quality"
                                    value={renderQuality}
                                    onChange={setRenderQuality}
                                    min={25}
                                    max={100}
                                    step={25}
                                    labels={['Low', 'Medium', 'High', 'Ultra']}
                                    valueLabel={renderQuality >= 90 ? 'Ultra' : renderQuality >= 60 ? 'High' : renderQuality >= 40 ? 'Medium' : 'Low'}
                                />

                                <RangeSlider
                                    label="Max Node Count (Free Tier)"
                                    value={maxNodeCount}
                                    onChange={setMaxNodeCount}
                                    min={100}
                                    max={5000}
                                    step={100}
                                    labels={['100', '2500', '5000']}
                                    valueLabel={maxNodeCount.toString()}
                                />

                                <div className="bg-surface-dark border border-border-dark rounded-lg p-5 space-y-3">
                                    <h3 className="text-[#dae2fd] text-sm font-bold">System Information</h3>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <p className="text-text-muted">Browser</p>
                                            <p className="text-[#dae2fd] font-mono">Chrome 120</p>
                                        </div>
                                        <div>
                                            <p className="text-text-muted">WebGL Version</p>
                                            <p className="text-[#dae2fd] font-mono">2.0</p>
                                        </div>
                                        <div>
                                            <p className="text-text-muted">Available Memory</p>
                                            <p className="text-[#dae2fd] font-mono">8 GB</p>
                                        </div>
                                        <div>
                                            <p className="text-text-muted">GPU</p>
                                            <p className="text-[#dae2fd] font-mono">NVIDIA GTX 1060</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Profile Settings */}
                        {activeTab === 'profile' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-[#dae2fd] mb-2">User Profile</h2>
                                    <p className="text-text-muted text-sm">Manage your account information and preferences</p>
                                </div>

                                <div className="bg-surface-dark border border-border-dark rounded-lg p-6 space-y-4">
                                    <div>
                                        <label className="text-[#869ab8] text-sm font-medium tracking-wide block mb-2">Full Name</label>
                                        <input
                                            type="text"
                                            value={userName}
                                            onChange={(e) => setUserName(e.target.value)}
                                            className="w-full bg-[#0b1326] border border-[#1a2333] rounded-lg px-4 py-3 text-[#dae2fd] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[#869ab8] text-sm font-medium tracking-wide block mb-2">Email Address</label>
                                        <input
                                            type="email"
                                            value={userEmail}
                                            onChange={(e) => setUserEmail(e.target.value)}
                                            className="w-full bg-[#0b1326] border border-[#1a2333] rounded-lg px-4 py-3 text-[#dae2fd] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[#869ab8] text-sm font-medium tracking-wide block mb-2">Organization</label>
                                        <input
                                            type="text"
                                            value={userOrg}
                                            onChange={(e) => setUserOrg(e.target.value)}
                                            className="w-full bg-[#0b1326] border border-[#1a2333] rounded-lg px-4 py-3 text-[#dae2fd] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="bg-surface-dark border border-border-dark rounded-lg p-6">
                                    <h3 className="text-[#dae2fd] text-sm font-bold mb-4">Account Actions</h3>
                                    <div className="flex flex-col gap-3">
                                        <button type="button" className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border-dark hover:border-primary hover:bg-[#131b2e] text-[#dae2fd] transition-all group">
                                            <span className="text-sm font-medium tracking-wide">Change Password</span>
                                            <span className="material-symbols-outlined text-[18px] text-text-muted group-hover:text-primary">chevron_right</span>
                                        </button>
                                        <button type="button" className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border-dark hover:border-primary hover:bg-[#131b2e] text-[#dae2fd] transition-all group">
                                            <span className="text-sm font-medium tracking-wide">Export My Data</span>
                                            <span className="material-symbols-outlined text-[18px] text-text-muted group-hover:text-primary">download</span>
                                        </button>
                                        <button type="button" className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-red-900/50 hover:border-red-500 hover:bg-red-500/10 text-red-400 transition-all group">
                                            <span className="text-sm font-medium tracking-wide">Delete Account</span>
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Build Version */}
                    <div className="mt-8 pt-4 border-t border-border-dark text-center">
                        <p className="text-xs text-slate-600">
                            BeamLab v0.1.0 • Build {new Date().toISOString().slice(0, 10).replace(/-/g, '')}
                        </p>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SettingsPageEnhanced;
