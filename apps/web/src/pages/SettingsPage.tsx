/**
 * SettingsPage - BeamLab Ultimate Settings
 * General, Display, and Analysis Preferences
 */

import { FC, useState } from 'react';
import { Link } from 'react-router-dom';

// ============================================
// TYPES
// ============================================

type TabId = 'general' | 'display' | 'analysis';

interface ToggleProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    label: string;
    description?: string;
}

// ============================================
// TOGGLE COMPONENT
// ============================================

const Toggle: FC<ToggleProps> = ({ enabled, onChange, label, description }) => (
    <div className="flex items-center justify-between py-4">
        <div>
            <p className="text-sm font-medium text-white">{label}</p>
            {description && <p className="text-xs text-text-muted mt-1">{description}</p>}
        </div>
        <button
            onClick={() => onChange(!enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-border-dark'}`}
        >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
    </div>
);

// ============================================
// SETTINGS PAGE COMPONENT
// ============================================

export const SettingsPage: FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>('general');

    // General settings state
    const [language, setLanguage] = useState('en');
    const [unitSystem, setUnitSystem] = useState('metric');
    const [autoSave, setAutoSave] = useState(true);

    // Display settings state
    const [darkMode, setDarkMode] = useState(true);
    const [showGrid, setShowGrid] = useState(true);
    const [showAxes, setShowAxes] = useState(true);
    const [nodeLabels, setNodeLabels] = useState(true);
    const [memberLabels, setMemberLabels] = useState(false);

    // Analysis settings state
    const [solver, setSolver] = useState('direct');
    const [meshDensity, setMeshDensity] = useState('medium');
    const [hardwareAcceleration, setHardwareAcceleration] = useState(true);

    const TABS: { id: TabId; label: string; icon: string }[] = [
        { id: 'general', label: 'General', icon: 'settings' },
        { id: 'display', label: 'Display', icon: 'visibility' },
        { id: 'analysis', label: 'Analysis', icon: 'science' },
    ];

    return (
        <div className="min-h-screen bg-background-dark font-display">
            {/* Header */}
            <header className="border-b border-border-dark bg-surface-dark">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center gap-4">
                        <Link to="/dashboard" className="text-text-muted hover:text-white transition-colors">
                            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>arrow_back</span>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Settings</h1>
                            <p className="text-sm text-text-muted">Customize your BeamLab experience</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Tabs */}
                    <nav className="flex flex-row md:flex-col gap-2 md:w-48 flex-shrink-0">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                        ? 'bg-primary text-white'
                                        : 'text-text-muted hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    {/* Tab Content */}
                    <div className="flex-1 bg-surface-dark border border-border-dark rounded-xl p-6">
                        {activeTab === 'general' && (
                            <div className="space-y-6">
                                <h2 className="text-lg font-bold text-white mb-4">General Settings</h2>

                                {/* Language */}
                                <div className="py-4 border-b border-border-dark">
                                    <label className="block text-sm font-medium text-white mb-2">Language</label>
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="w-full max-w-xs h-10 px-3 bg-background-dark border border-border-dark rounded-lg text-white focus:border-primary focus:outline-none"
                                    >
                                        <option value="en">English</option>
                                        <option value="es">Español</option>
                                        <option value="hi">हिन्दी</option>
                                    </select>
                                </div>

                                {/* Unit System */}
                                <div className="py-4 border-b border-border-dark">
                                    <label className="block text-sm font-medium text-white mb-2">Unit System</label>
                                    <div className="flex gap-3">
                                        {['metric', 'imperial'].map((system) => (
                                            <button
                                                key={system}
                                                onClick={() => setUnitSystem(system)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${unitSystem === system
                                                        ? 'bg-primary text-white'
                                                        : 'bg-background-dark text-text-muted hover:text-white border border-border-dark'
                                                    }`}
                                            >
                                                {system.charAt(0).toUpperCase() + system.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-text-muted mt-2">
                                        {unitSystem === 'metric' ? 'kN, m, MPa' : 'kip, ft, ksi'}
                                    </p>
                                </div>

                                {/* Auto-save */}
                                <Toggle
                                    enabled={autoSave}
                                    onChange={setAutoSave}
                                    label="Auto-save"
                                    description="Automatically save your work every 5 minutes"
                                />
                            </div>
                        )}

                        {activeTab === 'display' && (
                            <div className="space-y-1">
                                <h2 className="text-lg font-bold text-white mb-4">Display Settings</h2>

                                <div className="divide-y divide-border-dark">
                                    <Toggle
                                        enabled={darkMode}
                                        onChange={setDarkMode}
                                        label="Dark Mode"
                                        description="Use dark theme throughout the application"
                                    />
                                    <Toggle
                                        enabled={showGrid}
                                        onChange={setShowGrid}
                                        label="Show Grid"
                                        description="Display grid lines in the 3D viewport"
                                    />
                                    <Toggle
                                        enabled={showAxes}
                                        onChange={setShowAxes}
                                        label="Show Axes"
                                        description="Display X, Y, Z axis indicators"
                                    />
                                    <Toggle
                                        enabled={nodeLabels}
                                        onChange={setNodeLabels}
                                        label="Node Labels"
                                        description="Show node ID labels in the viewport"
                                    />
                                    <Toggle
                                        enabled={memberLabels}
                                        onChange={setMemberLabels}
                                        label="Member Labels"
                                        description="Show member ID labels in the viewport"
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'analysis' && (
                            <div className="space-y-6">
                                <h2 className="text-lg font-bold text-white mb-4">Analysis Preferences</h2>

                                {/* Solver */}
                                <div className="py-4 border-b border-border-dark">
                                    <label className="block text-sm font-medium text-white mb-2">Solver Configuration</label>
                                    <select
                                        value={solver}
                                        onChange={(e) => setSolver(e.target.value)}
                                        className="w-full max-w-xs h-10 px-3 bg-background-dark border border-border-dark rounded-lg text-white focus:border-primary focus:outline-none"
                                    >
                                        <option value="direct">Direct Solver (Fast)</option>
                                        <option value="iterative">Iterative Solver</option>
                                        <option value="sparse">Sparse Matrix Solver</option>
                                    </select>
                                </div>

                                {/* Mesh Density */}
                                <div className="py-4 border-b border-border-dark">
                                    <label className="block text-sm font-medium text-white mb-2">Mesh Density</label>
                                    <div className="flex gap-3">
                                        {['coarse', 'medium', 'fine'].map((density) => (
                                            <button
                                                key={density}
                                                onClick={() => setMeshDensity(density)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${meshDensity === density
                                                        ? 'bg-primary text-white'
                                                        : 'bg-background-dark text-text-muted hover:text-white border border-border-dark'
                                                    }`}
                                            >
                                                {density.charAt(0).toUpperCase() + density.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Hardware Acceleration */}
                                <Toggle
                                    enabled={hardwareAcceleration}
                                    onChange={setHardwareAcceleration}
                                    label="Hardware Acceleration"
                                    description="Use GPU for faster rendering (WebGL 2.0)"
                                />

                                {/* Performance Info */}
                                <div className="p-4 bg-background-dark rounded-lg border border-border-dark">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="material-symbols-outlined text-accent" style={{ fontSize: '24px' }}>speed</span>
                                        <span className="text-sm font-bold text-white">Performance Stats</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <span className="text-text-muted">GPU: </span>
                                            <span className="text-white font-mono">WebGL 2.0</span>
                                        </div>
                                        <div>
                                            <span className="text-text-muted">Memory: </span>
                                            <span className="text-white font-mono">128 MB</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
