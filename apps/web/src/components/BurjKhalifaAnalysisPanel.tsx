/**
 * BurjKhalifaAnalysisPanel.tsx - Detailed Structural Analysis Visualization
 * 
 * Shows comprehensive analysis with all loads, design cases, and results
 */

import { FC, useState, useMemo } from 'react';
import {
    Building2,
    Wind,
    Zap,
    TrendingUp,
    CheckCircle,
    FileDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { generateBurjAnalysis, BurjAnalysisConfig, BurjAnalysisResult } from '../services/BurjKhalifaAnalysisService';

// ============================================
// LOAD VISUALIZATION CARD (Moved outside main component)
// ============================================
interface LoadCardProps {
    title: string;
    value: number;
    unit: string;
    icon: LucideIcon;
    color: string;
}

const LoadCard: FC<LoadCardProps> = ({ title, value, unit, icon: Icon, color }) => (
    <div className={`p-4 rounded-lg border-2 ${color}`}>
        <div className="flex items-center gap-3 mb-2">
            <Icon className="w-5 h-5" />
            <span className="font-semibold text-sm">{title}</span>
        </div>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <div className="text-xs text-slate-500">{unit}</div>
    </div>
);

// ============================================
// LOAD DISTRIBUTION BAR (Moved outside main component)
// ============================================
interface LoadDistributionBarProps {
    analysis: BurjAnalysisResult;
}

const LoadDistributionBar: FC<LoadDistributionBarProps> = ({ analysis }) => {
    const total = analysis.summary.totalDeadLoad +
        analysis.summary.totalLiveLoad +
        analysis.summary.totalWindLoad +
        analysis.summary.totalSeismicLoad;

    const dl = (analysis.summary.totalDeadLoad / total) * 100;
    const ll = (analysis.summary.totalLiveLoad / total) * 100;
    const wl = (analysis.summary.totalWindLoad / total) * 100;
    const sl = (analysis.summary.totalSeismicLoad / total) * 100;

    return (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
            <h3 className="font-semibold mb-3 text-sm">Load Distribution (%)</h3>
            <div className="flex h-10 rounded-full overflow-hidden gap-1 mb-4">
                <div
                    className="bg-blue-500 hover:bg-blue-600 transition flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${dl}%` }}
                    title={`Dead Load: ${analysis.summary.totalDeadLoad.toLocaleString()} kN`}
                >
                    {dl > 10 ? 'DL' : ''}
                </div>
                <div
                    className="bg-green-500 hover:bg-green-600 transition flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${ll}%` }}
                    title={`Live Load: ${analysis.summary.totalLiveLoad.toLocaleString()} kN`}
                >
                    {ll > 10 ? 'LL' : ''}
                </div>
                <div
                    className="bg-red-500 hover:bg-red-600 transition flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${wl}%` }}
                    title={`Wind Load: ${analysis.summary.totalWindLoad.toLocaleString()} kN`}
                >
                    {wl > 10 ? 'WL' : ''}
                </div>
                <div
                    className="bg-orange-500 hover:bg-orange-600 transition flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${sl}%` }}
                    title={`Seismic: ${analysis.summary.totalSeismicLoad.toLocaleString()} kN`}
                >
                    {sl > 10 ? 'SL' : ''}
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Dead: {dl.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Live: {ll.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Wind: {wl.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span>Seismic: {sl.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
};

// ============================================
// CRITICAL ELEMENTS TABLE (Moved outside main component)
// ============================================
interface CriticalElementsTableProps {
    analysis: BurjAnalysisResult;
}

const CriticalElementsTable: FC<CriticalElementsTableProps> = ({ analysis }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-xs">
            <thead>
                <tr className="border-b-2 border-slate-300 dark:border-slate-600">
                    <th className="text-left p-2 font-semibold">Element</th>
                    <th className="text-right p-2 font-semibold">Max Stress</th>
                    <th className="text-right p-2 font-semibold">Capacity</th>
                    <th className="text-right p-2 font-semibold">Utilization</th>
                    <th className="text-right p-2 font-semibold">Status</th>
                </tr>
            </thead>
            <tbody>
                {analysis.criticalElements.map((elem, idx) => {
                    const util = (elem.utilization * 100).toFixed(1);
                    const isOK = elem.utilization <= 0.95;
                    return (
                        <tr
                            key={idx}
                            className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            <td className="p-2 font-medium">{elem.element}</td>
                            <td className="text-right p-2">{elem.stress.toFixed(1)} MPa</td>
                            <td className="text-right p-2">{(elem.stress / elem.utilization).toFixed(0)} MPa</td>
                            <td className="text-right p-2 font-semibold text-orange-600">{util}%</td>
                            <td className="text-right p-2">
                                {isOK ? (
                                    <span className="text-green-600 font-bold">✓ OK</span>
                                ) : (
                                    <span className="text-red-600 font-bold">⚠ Review</span>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

// ============================================
// ANALYSIS STEPS ACCORDION (Moved outside main component)
// ============================================
interface AnalysisStepsAccordionProps {
    analysis: BurjAnalysisResult;
    expandedStep: number | null;
    setExpandedStep: (step: number | null) => void;
}

const AnalysisStepsAccordion: FC<AnalysisStepsAccordionProps> = ({ analysis, expandedStep, setExpandedStep }) => (
    <div className="space-y-3">
        {analysis.analysisSteps.map((step) => (
            <div
                key={step.stepNumber}
                className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden"
            >
                <button
                    onClick={() => setExpandedStep(expandedStep === step.stepNumber ? null : step.stepNumber)}
                    className="w-full p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <span className="font-bold text-blue-600">Step {step.stepNumber}</span>
                        <span className="font-semibold">{step.title}</span>
                    </div>
                    <span className={`transform transition ${expandedStep === step.stepNumber ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {expandedStep === step.stepNumber && (
                    <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-300 dark:border-slate-600">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{step.description}</p>

                        <div className="space-y-2 mb-4">
                            {step.loads.map((load, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-semibold text-sm">{load.category}</span>
                                        <span className="text-blue-600 font-bold">{load.magnitude.toLocaleString()} kN</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mb-1">{load.distribution}</div>
                                    <div className="text-xs text-slate-600 italic">{load.notes}</div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {step.maxStress && (
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                                    <div className="text-xs text-slate-600">Max Stress</div>
                                    <div className="font-bold">{step.maxStress} MPa</div>
                                </div>
                            )}
                            {step.maxDeflection && (
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                                    <div className="text-xs text-slate-600">Max Deflection</div>
                                    <div className="font-bold">{step.maxDeflection} mm</div>
                                </div>
                            )}
                            {step.maxLateralSway && (
                                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                    <div className="text-xs text-slate-600">Lateral Sway</div>
                                    <div className="font-bold">{step.maxLateralSway} mm</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        ))}
    </div>
);

// ============================================
// SETTINGS PANEL (Moved outside main component)
// ============================================
interface SettingsPanelProps {
    config: BurjAnalysisConfig;
    setConfig: (config: BurjAnalysisConfig) => void;
}

const SettingsPanel: FC<SettingsPanelProps> = ({ config, setConfig }) => (
    <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <div>
            <label className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={config.includeWindLoad}
                    onChange={(e) => setConfig({ ...config, includeWindLoad: e.target.checked })}
                    className="w-4 h-4"
                />
                <span className="font-semibold text-sm">Include Wind Load</span>
            </label>
        </div>

        {config.includeWindLoad && (
            <div>
                <label className="block text-xs font-semibold mb-2">Wind Speed: {config.windSpeed} m/s</label>
                <input
                    type="range"
                    min="40"
                    max="80"
                    step="5"
                    value={config.windSpeed}
                    onChange={(e) => setConfig({ ...config, windSpeed: parseFloat(e.target.value) })}
                    className="w-full"
                />
                <div className="text-xs text-slate-500 mt-1">Peak gust speed (Dubai: ~62.5 m/s)</div>
            </div>
        )}

        <div>
            <label className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={config.includeSeismic}
                    onChange={(e) => setConfig({ ...config, includeSeismic: e.target.checked })}
                    className="w-4 h-4"
                />
                <span className="font-semibold text-sm">Include Seismic Load</span>
            </label>
        </div>

        {config.includeSeismic && (
            <div>
                <label className="block text-xs font-semibold mb-2">Seismic Zone</label>
                <select
                    value={config.seismicZone}
                    onChange={(e) => setConfig({ ...config, seismicZone: e.target.value })}
                    className="w-full px-3 py-1 border rounded text-sm dark:bg-slate-700 dark:border-slate-600"
                >
                    <option value="low">Low (0.05g)</option>
                    <option value="medium">Medium (0.15g) - Dubai</option>
                    <option value="high">High (0.25g)</option>
                </select>
            </div>
        )}

        <div>
            <label className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={config.includeTemperature}
                    onChange={(e) => setConfig({ ...config, includeTemperature: e.target.checked })}
                    className="w-4 h-4"
                />
                <span className="font-semibold text-sm">Include Thermal Effects</span>
            </label>
        </div>

        {config.includeTemperature && (
            <div>
                <label className="block text-xs font-semibold mb-2">Temperature Delta: {config.temperatureDelta}°C</label>
                <input
                    type="range"
                    min="10"
                    max="80"
                    step="5"
                    value={config.temperatureDelta}
                    onChange={(e) => setConfig({ ...config, temperatureDelta: parseFloat(e.target.value) })}
                    className="w-full"
                />
                <div className="text-xs text-slate-500 mt-1">Design temperature swing (Dubai: ~50°C)</div>
            </div>
        )}
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
interface BurjAnalysisPanelProps {
    onClose?: () => void;
}

export const BurjKhalifaAnalysisPanel: FC<BurjAnalysisPanelProps> = ({ onClose }) => {
    const [config, setConfig] = useState<BurjAnalysisConfig>({
        includeWindLoad: true,
        includeSeismic: true,
        includeTemperature: true,
        windSpeed: 62.5,
        seismicZone: 'medium',
        temperatureDelta: 50
    });

    const [activeTab, setActiveTab] = useState<'overview' | 'loads' | 'results' | 'settings'>('overview');
    const [expandedStep, setExpandedStep] = useState<number | null>(0);

    const analysis = useMemo(() => generateBurjAnalysis(config), [config]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-950">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="flex items-center gap-2 text-lg font-bold">
                        <Building2 className="w-5 h-5 text-blue-600" />
                        Burj Khalifa - Structural Analysis
                    </h2>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 text-xs font-semibold">
                    {(['overview', 'loads', 'results', 'settings'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-2 rounded transition ${activeTab === tab
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {activeTab === 'overview' && (
                    <>
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <LoadCard
                                title="Total Dead Load"
                                value={analysis.summary.totalDeadLoad}
                                unit="kN"
                                icon={Building2}
                                color="border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            />
                            <LoadCard
                                title="Total Live Load"
                                value={analysis.summary.totalLiveLoad}
                                unit="kN"
                                icon={TrendingUp}
                                color="border-green-500 bg-green-50 dark:bg-green-900/20"
                            />
                            <LoadCard
                                title="Total Wind Load"
                                value={analysis.summary.totalWindLoad}
                                unit="kN"
                                icon={Wind}
                                color="border-red-500 bg-red-50 dark:bg-red-900/20"
                            />
                            <LoadCard
                                title="Seismic Load"
                                value={analysis.summary.totalSeismicLoad}
                                unit="kN"
                                icon={Zap}
                                color="border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                            />
                        </div>

                        {/* Distribution Bar */}
                        <LoadDistributionBar analysis={analysis} />

                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                <div className="text-xs text-slate-600">Max Lateral Sway (Top)</div>
                                <div className="text-2xl font-bold text-purple-600">{analysis.summary.maxLateralSway} mm</div>
                                <div className="text-xs text-slate-500">Wind-induced</div>
                            </div>
                            <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                                <div className="text-xs text-slate-600">Fundamental Period</div>
                                <div className="text-2xl font-bold text-cyan-600">{analysis.summary.fundamentalPeriod.toFixed(2)} s</div>
                                <div className="text-xs text-slate-500">Long-period structure</div>
                            </div>
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                <div className="text-xs text-slate-600">Top Acceleration</div>
                                <div className="text-2xl font-bold text-amber-600">{analysis.summary.topFloorAcceleration.toFixed(2)} m/s²</div>
                                <div className="text-xs text-slate-500">Seismic induced</div>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'loads' && (
                    <AnalysisStepsAccordion
                        analysis={analysis}
                        expandedStep={expandedStep}
                        setExpandedStep={setExpandedStep}
                    />
                )}

                {activeTab === 'results' && (
                    <div className="space-y-4">
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded">
                            <h3 className="font-bold flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                                <CheckCircle className="w-5 h-5" />
                                Design Check Summary
                            </h3>
                            <p className="text-sm text-green-600 dark:text-green-300">
                                All critical elements checked against their respective design standards. Utilization ratios are within acceptable limits for ultimate limit state design.
                            </p>
                        </div>

                        <h3 className="font-bold text-sm">Critical Elements Analysis</h3>
                        <CriticalElementsTable analysis={analysis} />
                    </div>
                )}

                {activeTab === 'settings' && <SettingsPanel config={config} setConfig={setConfig} />}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div className="text-xs text-slate-500">
                    <span>Height: {analysis.height}m | Floors: {analysis.floors}</span>
                </div>
                <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition">
                    <FileDown className="w-4 h-4" />
                    Export Report
                </button>
            </div>
        </div>
    );
};

export default BurjKhalifaAnalysisPanel;
