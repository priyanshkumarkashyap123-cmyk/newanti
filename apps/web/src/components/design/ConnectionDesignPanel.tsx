import React, { useState } from 'react';
import { API_CONFIG } from '../../config/env';
import { exportRowsToCsv, exportObjectToPdf } from '../../utils/designExport';
// Using standard UI elements

interface ConnectionResult {
    connection: string;
    capacity: number;
    ratio: number;
    status: string;
    checks: string[];
}

export const ConnectionDesignPanel: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ConnectionResult | null>(null);
    const [connType, setConnType] = useState('shear_bolt');
    const [formData, setFormData] = useState({
        load_shear: 50,
        load_moment: 0,
        load_axial: 0,
        beam_depth: 300,
        bolt_grade: '8.8',
        bolt_diameter: 20,
        plate_width: 200, // For base plate
        plate_length: 200 // For base plate
    });

    const handleDesign = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_CONFIG.baseUrl}/design/connection/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: connType,
                    ...formData
                })
            });
            const data = await response.json();
            if (data.success) {
                setResult(data.result);
            } else {
                console.error(data.detail);
            }
        } catch (error) {
            console.error('Design failed', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCsv = () => {
        if (!result) return;
        exportRowsToCsv(`connection_design_${new Date().toISOString().slice(0, 10)}.csv`, [{
            connectionType: connType,
            status: result.status,
            ratio: Number(result.ratio.toFixed(4)),
            capacity: Number(result.capacity.toFixed(3)),
            checks: result.checks.join(' | '),
        }]);
    };

    const handleExportPdf = async () => {
        if (!result) return;
        await exportObjectToPdf(
            `connection_design_${new Date().toISOString().slice(0, 10)}.pdf`,
            'Connection Design Results',
            {
                generatedAt: new Date().toISOString(),
                connectionType: connType,
                input: formData,
                result,
            },
        );
    };

    return (
        <div className="space-y-6 p-6 bg-[#0b1326] min-h-screen text-[#dae2fd]">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                Steel Connection Design (IS 800)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="space-y-4 bg-slate-100/50 dark:bg-slate-800/50 p-6 rounded-xl border border-[#1a2333]">
                    <h3 className="text-lg font-semibold text-orange-300">Connection Parameters</h3>

                    <div>
                        <label className="block text-sm text-[#869ab8] mb-1">Connection Type</label>
                        <select
                            value={connType}
                            onChange={(e) => setConnType(e.target.value)}
                            className="w-full bg-[#0b1326] border border-[#1a2333] rounded p-2 text-[#dae2fd]"
                        >
                            <option value="shear_bolt">Shear (Bolted)</option>
                            <option value="moment_bolt">Moment (End Plate)</option>
                            <option value="base_plate">Base Plate</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-[#869ab8] mb-1">Shear Load (kN)</label>
                            <input
                                type="number"
                                value={formData.load_shear}
                                onChange={e => setFormData({ ...formData, load_shear: parseFloat(e.target.value) })}
                                className="w-full bg-[#0b1326] border border-[#1a2333] rounded p-2 text-[#dae2fd]"
                            />
                        </div>

                        {(connType !== 'shear_bolt') && (
                            <>
                                <div>
                                    <label className="block text-sm text-[#869ab8] mb-1">Moment (kNm)</label>
                                    <input
                                        type="number"
                                        value={formData.load_moment}
                                        onChange={e => setFormData({ ...formData, load_moment: parseFloat(e.target.value) })}
                                        className="w-full bg-[#0b1326] border border-[#1a2333] rounded p-2 text-[#dae2fd]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-[#869ab8] mb-1">Axial (kN)</label>
                                    <input
                                        type="number"
                                        value={formData.load_axial}
                                        onChange={e => setFormData({ ...formData, load_axial: parseFloat(e.target.value) })}
                                        className="w-full bg-[#0b1326] border border-[#1a2333] rounded p-2 text-[#dae2fd]"
                                    />
                                </div>
                            </>
                        )}

                        {(connType !== 'base_plate') && (
                            <div>
                                <label className="block text-sm text-[#869ab8] mb-1">Beam Depth (mm)</label>
                                <input
                                    type="number"
                                    value={formData.beam_depth}
                                    onChange={e => setFormData({ ...formData, beam_depth: parseFloat(e.target.value) })}
                                    className="w-full bg-[#0b1326] border border-[#1a2333] rounded p-2 text-[#dae2fd]"
                                />
                            </div>
                        )}

                        {(connType === 'base_plate') && (
                            <>
                                <div>
                                    <label className="block text-sm text-[#869ab8] mb-1">Plate Width (mm)</label>
                                    <input
                                        type="number"
                                        value={formData.plate_width}
                                        onChange={e => setFormData({ ...formData, plate_width: parseFloat(e.target.value) })}
                                        className="w-full bg-[#0b1326] border border-[#1a2333] rounded p-2 text-[#dae2fd]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-[#869ab8] mb-1">Plate Length (mm)</label>
                                    <input
                                        type="number"
                                        value={formData.plate_length}
                                        onChange={e => setFormData({ ...formData, plate_length: parseFloat(e.target.value) })}
                                        className="w-full bg-[#0b1326] border border-[#1a2333] rounded p-2 text-[#dae2fd]"
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm text-[#869ab8] mb-1">Bolt Dia (mm)</label>
                            <select
                                value={formData.bolt_diameter}
                                onChange={(e) => setFormData({ ...formData, bolt_diameter: parseFloat(e.target.value) })}
                                className="w-full bg-[#0b1326] border border-[#1a2333] rounded p-2 text-[#dae2fd]"
                            >
                                <option value="16">16</option>
                                <option value="20">20</option>
                                <option value="24">24</option>
                                <option value="30">30</option>
                            </select>
                        </div>
                    </div>

                    <button type="button"
                        onClick={handleDesign}
                        disabled={loading}
                        className="w-full py-3 bg-orange-600 hover:bg-orange-500 rounded-lg font-semibold transition-all disabled:opacity-50"
                    >
                        {loading ? 'Analyzing...' : 'Check Connection'}
                    </button>
                </div>

                {/* Results Panel */}
                <div className="bg-slate-100/50 dark:bg-slate-800/50 p-6 rounded-xl border border-[#1a2333]">
                    <h3 className="text-lg font-semibold text-orange-300 mb-4">Check Results</h3>

                    {result ? (
                        <div className="space-y-4">
                            <div className="p-3 bg-[#0b1326] rounded border border-[#1a2333] text-sm font-mono whitespace-pre-wrap">
                                {result.connection}
                            </div>

                            <div className="flex items-center justify-between p-3 bg-[#0b1326] rounded-lg border border-[#1a2333]">
                                <span>Design Status</span>
                                <span className={`font-bold ${result.status === 'PASS' ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                    {result.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 bg-[#0b1326] rounded border border-[#1a2333] text-center">
                                    <div className="text-xs text-[#869ab8]">Capacity</div>
                                    <div className="text-xl font-mono">{result.capacity.toFixed(1)} kN/kNm</div>
                                </div>
                                <div className="p-3 bg-[#0b1326] rounded border border-[#1a2333] text-center">
                                    <div className="text-xs text-[#869ab8]">Ratio</div>
                                    <div className="text-xl font-mono">{result.ratio.toFixed(2)}</div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h4 className="text-sm font-medium tracking-wide text-[#869ab8]">Detailed Checks</h4>
                                {result.checks.map((check, i) => (
                                    <div key={i} className="text-xs text-[#869ab8] p-2 bg-white/50 dark:bg-slate-900/50 rounded border border-[#1a2333]">
                                        {check}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={handleExportCsv}
                                    className="w-full py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg font-semibold transition-all"
                                >
                                    Export CSV
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { void handleExportPdf(); }}
                                    className="w-full py-2 bg-orange-600 hover:bg-orange-500 rounded-lg font-semibold transition-all"
                                >
                                    Export PDF
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[#869ab8]">
                            Run check to see results
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
