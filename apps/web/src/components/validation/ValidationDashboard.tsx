import { FC, useState } from 'react';
import { aiValidation, ValidationReport, ValidationResult } from '../../services/AIValidationService';
import {
    Play, CheckCircle, XCircle, AlertTriangle,
    BarChart2, Loader2, RefreshCw, Shield
} from 'lucide-react';

/**
 * ValidationDashboard - UI for running AI benchmark tests
 * 
 * Displays accuracy metrics and test results for AI/PINN predictions.
 */
export const ValidationDashboard: FC = () => {
    const [report, setReport] = useState<ValidationReport | null>(null);
    const [loading, setLoading] = useState(false);

    const runBenchmarks = async () => {
        setLoading(true);
        try {
            const result = await aiValidation.runBenchmarkSuite();
            setReport(result);
        } catch (e) {
            console.error('Benchmark failed:', e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (result: ValidationResult) => {
        if (result.passed) {
            return <CheckCircle className="w-4 h-4 text-green-400" />;
        }
        if (result.errorPercent < result.threshold * 2) {
            return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
        }
        return <XCircle className="w-4 h-4 text-red-400" />;
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-200">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">Validation Dashboard</h2>
                        <p className="text-xs text-zinc-500">Benchmark AI accuracy against analytical solutions</p>
                    </div>
                </div>
                <button
                    onClick={runBenchmarks}
                    disabled={loading}
                    className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all ${loading
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Running...
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4" />
                            Run Benchmarks
                        </>
                    )}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {!report ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                        <BarChart2 className="w-12 h-12 opacity-30" />
                        <p className="text-sm">Click "Run Benchmarks" to validate AI predictions</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 text-center">
                                <div className="text-2xl font-bold text-white">{report.totalTests}</div>
                                <div className="text-xs text-zinc-500">Total Tests</div>
                            </div>
                            <div className="p-4 bg-zinc-900 rounded-lg border border-green-500/20 text-center">
                                <div className="text-2xl font-bold text-green-400">{report.passed}</div>
                                <div className="text-xs text-zinc-500">Passed</div>
                            </div>
                            <div className="p-4 bg-zinc-900 rounded-lg border border-red-500/20 text-center">
                                <div className="text-2xl font-bold text-red-400">{report.failed}</div>
                                <div className="text-xs text-zinc-500">Failed</div>
                            </div>
                            <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 text-center">
                                <div className="text-2xl font-bold text-emerald-400">{report.passRate.toFixed(0)}%</div>
                                <div className="text-xs text-zinc-500">Pass Rate</div>
                            </div>
                        </div>

                        {/* Accuracy Metrics */}
                        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                                Overall Accuracy Metrics
                            </h3>
                            <div className="grid grid-cols-4 gap-4 text-center">
                                <div>
                                    <div className="text-lg font-mono text-blue-400">
                                        {report.overallAccuracy.rmse.toFixed(4)}
                                    </div>
                                    <div className="text-[10px] text-zinc-500">RMSE</div>
                                </div>
                                <div>
                                    <div className="text-lg font-mono text-purple-400">
                                        {report.overallAccuracy.maxErrorPercent.toFixed(2)}%
                                    </div>
                                    <div className="text-[10px] text-zinc-500">Max Error</div>
                                </div>
                                <div>
                                    <div className="text-lg font-mono text-cyan-400">
                                        {report.overallAccuracy.meanError.toFixed(4)}
                                    </div>
                                    <div className="text-[10px] text-zinc-500">Mean Error</div>
                                </div>
                                <div>
                                    <div className="text-lg font-mono text-green-400">
                                        {(report.overallAccuracy.r2 * 100).toFixed(2)}%
                                    </div>
                                    <div className="text-[10px] text-zinc-500">R²</div>
                                </div>
                            </div>
                        </div>

                        {/* Test Results Table */}
                        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                                Test Results
                            </h3>
                            <div className="space-y-2">
                                {report.results.map((result, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded flex items-center justify-between ${result.passed ? 'bg-green-500/5' : 'bg-red-500/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {getStatusIcon(result)}
                                            <div>
                                                <div className="text-xs font-medium text-white">
                                                    {result.description}
                                                </div>
                                                <div className="text-[10px] text-zinc-500">
                                                    {result.testCase}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-mono">
                                                <span className="text-zinc-500">Expected: </span>
                                                <span className="text-white">{result.expected.toFixed(3)}</span>
                                            </div>
                                            <div className="text-xs font-mono">
                                                <span className="text-zinc-500">Actual: </span>
                                                <span className={result.passed ? 'text-green-400' : 'text-red-400'}>
                                                    {result.actual.toFixed(3)}
                                                </span>
                                                <span className="text-zinc-600 ml-2">
                                                    ({result.errorPercent.toFixed(2)}%)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Timestamp */}
                        <div className="text-center text-[10px] text-zinc-600">
                            Report generated: {new Date(report.timestamp).toLocaleString()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ValidationDashboard;
