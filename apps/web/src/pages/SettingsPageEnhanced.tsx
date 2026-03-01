/**
 * SettingsPageEnhanced - BeamLab Ultimate Settings (Advanced Template)
 * Professional dark theme with advanced UI components and tabbed navigation
 */

import { FC, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AdvancedToggle, RangeSlider } from '../components/ui';

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
    const navigate = useNavigate();
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

    const handleSaveSettings = () => {
        // Save to localStorage or backend
// console.log('Settings saved');
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleResetSettings = () => {
        if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
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
            setRenderQuality(75);
            setMaxNodeCount(1000);
        }
    };

    return (
        <div className="min-h-screen bg-background-dark flex flex-col font-display">
            {/* Header */}
            <header className="h-16 bg-surface-dark border-b border-border-dark flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-text-muted hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span className="text-sm font-medium">Back</span>
                    </button>
                    <div className="h-6 w-px bg-border-dark"></div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleResetSettings}
                        className="flex items-center gap-2 h-10 px-4 rounded-lg border border-border-dark text-text-muted hover:text-slate-900 dark:hover:text-white hover:border-text-muted transition-colors text-sm font-medium"
                    >
                        <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                        Reset
                    </button>
                    <button
                        onClick={handleSaveSettings}
                        className="flex items-center gap-2 h-10 px-5 rounded-lg bg-primary hover:bg-primary/90 text-slate-900 dark:text-white text-sm font-bold transition-all shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        {saved ? '✓ Saved' : 'Save Changes'}
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <aside className="w-64 bg-surface-dark border-r border-border-dark flex flex-col p-4 shrink-0">
                    <nav className="space-y-1">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === item.id
                                        ? 'bg-primary text-slate-900 dark:text-white shadow-lg shadow-primary/20'
                                        : 'text-text-muted hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
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
                            <p>BeamLab Ultimate</p>
                            <p className="font-mono">v4.2.0-pro</p>
                            <p className="text-[10px]">© {new Date().getFullYear()} BeamLab</p>
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
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">General Settings</h2>
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
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 uppercase tracking-wider">Data Management</h3>
                                    <div className="bg-surface-dark border border-border-dark rounded-lg p-5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-slate-900 dark:text-white text-sm font-medium">Local Storage Used</p>
                                                <p className="text-text-muted text-xs">45.2 MB of 500 MB</p>
                                            </div>
                                            <button className="text-xs font-bold text-primary hover:underline">Clear Cache</button>
                                        </div>
                                        <div className="w-full h-2 bg-white dark:bg-slate-900 rounded-full overflow-hidden">
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
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Display Settings</h2>
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
                                    <label className="text-slate-500 dark:text-slate-400 text-sm font-medium block mb-2">Grid Spacing</label>
                                    <div className="bg-surface-dark border border-border-dark rounded-lg p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-slate-900 dark:text-white text-sm">Current: {gridSize.toFixed(1)} m</span>
                                            <input
                                                type="number"
                                                value={gridSize}
                                                onChange={(e) => setGridSize(parseFloat(e.target.value) || 1.0)}
                                                step="0.1"
                                                min="0.1"
                                                max="10"
                                                className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-1 text-slate-900 dark:text-white text-sm"
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
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Analysis Preferences</h2>
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
                                        label="GPU Acceleration"
                                        description="Offload matrix operations to compatible NVIDIA GPUs"
                                        statusText={gpuAcceleration ? 'GPU Detected' : 'CPU Only'}
                                        enabled={gpuAcceleration}
                                        onChange={setGpuAcceleration}
                                        icon={<span className="material-symbols-outlined text-[20px]">memory</span>}
                                    />
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
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Performance Settings</h2>
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
                                    <h3 className="text-slate-900 dark:text-white text-sm font-bold">System Information</h3>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <p className="text-text-muted">Browser</p>
                                            <p className="text-slate-900 dark:text-white font-mono">Chrome 120</p>
                                        </div>
                                        <div>
                                            <p className="text-text-muted">WebGL Version</p>
                                            <p className="text-slate-900 dark:text-white font-mono">2.0</p>
                                        </div>
                                        <div>
                                            <p className="text-text-muted">Available Memory</p>
                                            <p className="text-slate-900 dark:text-white font-mono">8 GB</p>
                                        </div>
                                        <div>
                                            <p className="text-text-muted">GPU</p>
                                            <p className="text-slate-900 dark:text-white font-mono">NVIDIA GTX 1060</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Profile Settings */}
                        {activeTab === 'profile' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">User Profile</h2>
                                    <p className="text-text-muted text-sm">Manage your account information and preferences</p>
                                </div>

                                <div className="bg-surface-dark border border-border-dark rounded-lg p-6 space-y-4">
                                    <div>
                                        <label className="text-slate-500 dark:text-slate-400 text-sm font-medium block mb-2">Full Name</label>
                                        <input
                                            type="text"
                                            value={userName}
                                            onChange={(e) => setUserName(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-slate-500 dark:text-slate-400 text-sm font-medium block mb-2">Email Address</label>
                                        <input
                                            type="email"
                                            value={userEmail}
                                            onChange={(e) => setUserEmail(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-slate-500 dark:text-slate-400 text-sm font-medium block mb-2">Organization</label>
                                        <input
                                            type="text"
                                            value={userOrg}
                                            onChange={(e) => setUserOrg(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="bg-surface-dark border border-border-dark rounded-lg p-6">
                                    <h3 className="text-slate-900 dark:text-white text-sm font-bold mb-4">Account Actions</h3>
                                    <div className="flex flex-col gap-3">
                                        <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border-dark hover:border-primary hover:bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white transition-all group">
                                            <span className="text-sm font-medium">Change Password</span>
                                            <span className="material-symbols-outlined text-[18px] text-text-muted group-hover:text-primary">chevron_right</span>
                                        </button>
                                        <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border-dark hover:border-primary hover:bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white transition-all group">
                                            <span className="text-sm font-medium">Export My Data</span>
                                            <span className="material-symbols-outlined text-[18px] text-text-muted group-hover:text-primary">download</span>
                                        </button>
                                        <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-red-900/50 hover:border-red-500 hover:bg-red-500/10 text-red-400 transition-all group">
                                            <span className="text-sm font-medium">Delete Account</span>
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
