import React, { useState } from 'react';
import { API_CONFIG } from '../../config/env';

interface MemberResult {
    memberId: string;
    status: string;
    overallRatio: number;
    checks: {
        name: string;
        demand: number;
        capacity: number;
        ratio: number;
        status: string;
        unit?: string;
    }[];
    details: any;
}

export const RCDesignPanel: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<MemberResult | null>(null);
    const [formData, setFormData] = useState({
        width: 300,
        depth: 450,
        length: 3000,
        axial: 0,
        momentZ: 100, // Major moment
        shearY: 50,  // Shear
        fck: 25,
        fy: 500
    });

    const handleDesign = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/design/concrete/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'IS456',
                    members: [{
                        id: 'MB1',
                        type: 'beam',
                        ...formData,
                        forces: {
                            axial: formData.axial,
                            momentZ: formData.momentZ,
                            shearY: formData.shearY,
                            momentY: 0, shearZ: 0, torsion: 0
                        }
                    }]
                })
            });
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                setResult(data[0]);
            }
        } catch (error) {
            console.error('Design failed', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 p-6 bg-white dark:bg-zinc-900 min-h-screen text-zinc-900 dark:text-white">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
                RC Beam/Column Design (IS 456)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="space-y-4 bg-zinc-100/50 dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <h3 className="text-lg font-semibold text-emerald-300">Member Parameters</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">Width (mm)</label>
                            <input
                                type="number"
                                value={formData.width}
                                onChange={e => setFormData({ ...formData, width: parseFloat(e.target.value) })}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">Depth (mm)</label>
                            <input
                                type="number"
                                value={formData.depth}
                                onChange={e => setFormData({ ...formData, depth: parseFloat(e.target.value) })}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">Moment (kNm)</label>
                            <input
                                type="number"
                                value={formData.momentZ}
                                onChange={e => setFormData({ ...formData, momentZ: parseFloat(e.target.value) })}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">Shear (kN)</label>
                            <input
                                type="number"
                                value={formData.shearY}
                                onChange={e => setFormData({ ...formData, shearY: parseFloat(e.target.value) })}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-1">Axial (kN)</label>
                            <input
                                type="number"
                                value={formData.axial}
                                onChange={e => setFormData({ ...formData, axial: parseFloat(e.target.value) })}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-white"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleDesign}
                        disabled={loading}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-all disabled:opacity-50"
                    >
                        {loading ? 'Designing...' : 'Check Member'}
                    </button>
                </div>

                {/* Results Panel */}
                <div className="bg-zinc-100/50 dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <h3 className="text-lg font-semibold text-emerald-300 mb-4">Design Results</h3>

                    {result ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                <span>Status {result.memberId}</span>
                                <span className={`font-bold ${result.status === 'pass' ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                    {result.status.toUpperCase()}
                                </span>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Reinforcement Details</h4>
                                <div className="p-3 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700 font-mono text-sm grid grid-cols-2 gap-2">
                                    {Object.entries(result.details).map(([key, value]) => (
                                        <div key={key}>
                                            <span className="text-zinc-500 dark:text-zinc-400 block text-xs">{key}</span>
                                            <span>{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Checks</h4>
                                <div className="space-y-1">
                                    {result.checks.map((check, i) => (
                                        <div key={i} className="text-xs text-zinc-500 dark:text-zinc-400 p-2 bg-white/50 dark:bg-zinc-900/50 rounded border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                            <span>{check.name}</span>
                                            <div className="text-right">
                                                <div className="text-zinc-900 dark:text-white">{check.demand.toFixed(1)} / {check.capacity.toFixed(1)} {check.unit}</div>
                                                <div className={`${check.ratio > 1 ? 'text-red-400' : 'text-green-400'}`}>
                                                    Ratio: {check.ratio.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                            Run check to see results
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
