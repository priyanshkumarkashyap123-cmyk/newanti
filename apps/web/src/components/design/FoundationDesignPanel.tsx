import React, { useState } from 'react';
import { API_CONFIG } from '../../config/env';
import { Card } from '../ui/card'; // Assuming standardized Card exists, or I will use div/standard UI
// I will using Tailwind classes and standard HTML elements to avoid dependency issues if internal UI lib is complex
// But I should check if I can use existing UI components.
// I saw "EnhancedBeamDesignDialog.tsx" uses "Dialog", "Button", "Input", "Label".
// I'll try to stick to standard Tailwind.

interface FoundationResult {
    success: boolean;
    dimensions: { length: number; width: number; depth: number };
    reinforcement: { bottom_x: string; bottom_y: string; Ast_x: number; Ast_y: number };
    checks: string[];
    status: string;
    ratios: { bearing: number; punching: number; flexure: number };
}

export const FoundationDesignPanel: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<FoundationResult | null>(null);
    const [formData, setFormData] = useState({
        load_p: 1000,
        load_mx: 0,
        load_my: 0,
        sbc: 200,
        soil_type: 'Medium Clay'
    });

    const handleDesign = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/design/foundation/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'isolated',
                    ...formData
                })
            });
            const data = await response.json();
            setResult(data);
        } catch (error) {
            console.error('Design failed', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 p-6 bg-white dark:bg-slate-900 min-h-screen text-slate-900 dark:text-white">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Foundation Design (IS 456)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="space-y-4 bg-slate-100/50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-blue-300">Design Parameters</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Axial Load (kN)</label>
                            <input
                                type="number"
                                value={formData.load_p}
                                onChange={e => setFormData({ ...formData, load_p: parseFloat(e.target.value) })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Checking SBC (kPa)</label>
                            <input
                                type="number"
                                value={formData.sbc}
                                onChange={e => setFormData({ ...formData, sbc: parseFloat(e.target.value) })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Moment Mx (kNm)</label>
                            <input
                                type="number"
                                value={formData.load_mx}
                                onChange={e => setFormData({ ...formData, load_mx: parseFloat(e.target.value) })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Moment My (kNm)</label>
                            <input
                                type="number"
                                value={formData.load_my}
                                onChange={e => setFormData({ ...formData, load_my: parseFloat(e.target.value) })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 text-slate-900 dark:text-white"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleDesign}
                        disabled={loading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-all disabled:opacity-50"
                    >
                        {loading ? 'Designing...' : 'Design Footing'}
                    </button>
                </div>

                {/* Results Panel */}
                <div className="bg-slate-100/50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-purple-300 mb-4">Design Results</h3>

                    {result ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                <span>Status</span>
                                <span className={`font-bold ${result.status === 'PASS' ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                    {result.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-3 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-center">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">Length</div>
                                    <div className="text-xl font-mono">{result.dimensions.length}m</div>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-center">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">Width</div>
                                    <div className="text-xl font-mono">{result.dimensions.width}m</div>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-center">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">Depth</div>
                                    <div className="text-xl font-mono">{result.dimensions.depth}m</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Reinforcement</h4>
                                <div className="p-3 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 font-mono text-sm">
                                    <div>X: {result.reinforcement.bottom_x}</div>
                                    <div>Y: {result.reinforcement.bottom_y}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400">Checks</h4>
                                <div className="space-y-1">
                                    {result.checks.map((check, i) => (
                                        <div key={i} className="text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                                            <span>{check.split('=')[0]}</span>
                                            <span className="text-slate-900 dark:text-white">{check.split('=')[1]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                            Run design to see results
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
