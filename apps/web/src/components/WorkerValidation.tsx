import { useEffect, useState } from 'react';
import useStructuralSolver from '../hooks/useStructuralSolver';

export function WorkerValidation() {
    const { analyze, prepareModel, isAnalyzing } = useStructuralSolver();
    const [result, setResult] = useState<any>(null);
    const [log, setLog] = useState<string[]>([]);

    const addLog = (msg: string) => setLog(prev => [...prev, msg]);

    const runValidation = async () => {
        setLog(['Starting validation...']);

        // 1. Create a simple 2-node beam model
        const nodes = [
            { id: 'N1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
            { id: 'N2', x: 5, y: 0, z: 0 },
        ];

        const members = [
            { id: 'M1', startNodeId: 'N1', endNodeId: 'N2', E: 200e9, A: 0.01, I: 1e-4 }
        ];

        // 1kN vertical load at N2
        const loads = [
            { id: 'L1', nodeId: 'N2', fy: -1000 }
        ];

        addLog(`Model created: ${nodes.length} nodes, ${members.length} members`);

        // 2. Prepare for worker
        try {
            const modelData = prepareModel(nodes, members, loads, 6);
            addLog('Model data prepared. Sending to worker...');

            // 3. Run Analysis
            const res = await analyze(modelData, (p) => {
                addLog(`[Worker] ${p.stage}: ${p.percent}% - ${p.message}`);
            });

            setResult(res);

            if (res.success) {
                addLog('✅ Analysis Success!');
                addLog(`Method: ${res.stats.method}`);
                addLog(`Time: ${res.stats.totalTimeMs.toFixed(0)}ms`);

                // 4. Verify Results
                // Expected displacement for cantilever tip load: dy = -PL^3 / 3EI
                // P = -1000, L = 5, E = 200e9, I = 1e-4
                // dy = -(-1000 * 125) / (3 * 200e9 * 1e-4) = 125000 / 60000000 = 0.0020833 m

                if (res.displacements) {
                    // N2 index is 1. DOF for y is 1*6 + 1 = 7
                    // Wait, verify node order in prepareModel. It maps original array order.
                    // N1 is index 0, N2 is index 1.
                    const dy = res.displacements[7];
                    addLog(`Displacement Y at N2: ${dy.toExponential(4)} m`);

                    const expected = 0.0020833;
                    const error = Math.abs((dy - expected) / expected);

                    if (error < 0.01) {
                        addLog(`✅ ACCURACY PASSED (Error: ${(error * 100).toFixed(4)}%)`);
                    } else {
                        addLog(`⚠️ ACCURACY WARNING. Expected ${expected.toExponential(4)}, got ${dy.toExponential(4)}`);
                    }
                }

            } else {
                addLog(`❌ Analysis Failed: ${res.error}`);
            }

        } catch (e) {
            addLog(`❌ Exception: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    return (
        <div className="p-4 bg-gray-900 text-white font-mono rounded-lg shadow-lg max-w-2xl text-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-blue-400">Worker Validation</h3>
                <button
                    onClick={runValidation}
                    disabled={isAnalyzing}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                >
                    {isAnalyzing ? 'Running...' : 'Run Test'}
                </button>
            </div>

            <div className="border border-gray-700 bg-black p-2 h-64 overflow-y-auto whitespace-pre-wrap">
                {log.length === 0 ? 'Ready to test.' : log.join('\n')}
            </div>
        </div>
    );
}
