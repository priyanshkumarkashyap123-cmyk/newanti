/**
 * ConnectedValidationDashboard.tsx
 *
 * Production-ready ValidationDashboard connected to real analysis data
 * This version receives actual WASM solver results and displays live accuracy
 */

import React, { useState, useEffect, useMemo } from 'react';
import { aiValidation, ValidationResult } from '../../services/AIValidationService';

// ============================================
// TYPES
// ============================================

interface AnalysisResults {
    nodes: Array<{
        id: string;
        displacement?: { x: number; y: number; z: number; rx: number; ry: number; rz: number };
        reaction?: { fx: number; fy: number; fz: number; mx: number; my: number; mz: number };
    }>;
    members: Array<{
        id: string;
        forces?: {
            axial: number;
            shearY: number;
            shearZ: number;
            torsion: number;
            momentY: number;
            momentZ: number;
        };
    }>;
    converged: boolean;
    iterations?: number;
    timestamp: Date;
}

interface ExpectedResults {
    nodeId: string;
    displacement?: number;
    reaction?: number;
    tolerance?: number;
}

interface ConnectedValidationDashboardProps {
    analysisResults?: AnalysisResults;
    expectedResults?: ExpectedResults[];
    onValidationComplete?: (result: { passed: boolean; accuracy: number }) => void;
    autoValidate?: boolean;
}

// ============================================
// ACCURACY BADGE COMPONENT
// ============================================

const AccuracyBadge: React.FC<{ accuracy: number; label: string }> = ({ accuracy, label }) => {
    const getColor = () => {
        if (accuracy >= 99) return 'bg-green-500';
        if (accuracy >= 95) return 'bg-emerald-500';
        if (accuracy >= 90) return 'bg-yellow-500';
        if (accuracy >= 80) return 'bg-orange-500';
        return 'bg-red-500';
    };

    return (
        <div className="bg-[#131b2e] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[#869ab8] text-sm">{label}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium tracking-wide tracking-wide text-[#dae2fd] ${getColor()}`}>
                    {accuracy.toFixed(1)}%
                </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                    className={`h-2 rounded-full ${getColor()}`}
                    style={{ width: `${Math.min(accuracy, 100)}%` }}
                />
            </div>
        </div>
    );
};

// ============================================
// RESULT ROW COMPONENT
// ============================================

const ResultRow: React.FC<{ result: ValidationResult }> = ({ result }) => {
    const passedColor = result.passed ? 'text-green-400' : 'text-red-400';
    const passedIcon = result.passed ? '✓' : '✗';

    return (
        <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
            <div className="flex items-center gap-2">
                <span className={`text-lg ${passedColor}`}>{passedIcon}</span>
                <span className="text-[#dae2fd] text-sm">{result.testCase}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
                <span className="text-[#869ab8]">
                    Exp: <span className="text-[#dae2fd] font-mono">{result.expected.toFixed(4)}</span>
                </span>
                <span className="text-[#869ab8]">
                    Comp: <span className="text-[#dae2fd] font-mono">{result.computed.toFixed(4)}</span>
                </span>
                <span className={`font-mono ${result.accuracy.percentage >= 99 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {result.accuracy.percentage.toFixed(2)}%
                </span>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ConnectedValidationDashboard: React.FC<ConnectedValidationDashboardProps> = ({
    analysisResults,
    expectedResults,
    onValidationComplete,
    autoValidate = true
}) => {
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
    const [isValidating, setIsValidating] = useState(false);
    const [overallAccuracy, setOverallAccuracy] = useState<number | null>(null);

    // Run validation when analysis results change
    useEffect(() => {
        if (analysisResults && autoValidate) {
            runValidation();
        }
    }, [analysisResults, autoValidate]);

    const runValidation = async () => {
        if (!analysisResults) return;

        setIsValidating(true);

        try {
            // Run benchmark suite
            const benchmarkResult = await aiValidation.runBenchmarkSuite();

            // Calculate accuracy from analysis results if expected values provided
            const results: ValidationResult[] = benchmarkResult.results;

            // Add comparisons with expected results
            if (expectedResults && expectedResults.length > 0) {
                for (const expected of expectedResults) {
                    const node = analysisResults.nodes.find(n => n.id === expected.nodeId);
                    if (node && expected.displacement !== undefined && node.displacement) {
                        const computed = Math.sqrt(
                            node.displacement.x ** 2 +
                            node.displacement.y ** 2 +
                            node.displacement.z ** 2
                        );
                        const accuracy = aiValidation.calculateAccuracy(computed, expected.displacement);
                        const tolerance = expected.tolerance || 0.02;

                        results.push({
                            testCase: `Node ${expected.nodeId} Displacement`,
                            description: 'Nodal displacement magnitude check',
                            expected: expected.displacement,
                            computed,
                            actual: computed,
                            error: Math.abs(computed - expected.displacement),
                            errorPercent: accuracy.relativeError * 100,
                            threshold: (expected.tolerance || 0.02) * 100,
                            accuracy,
                            passed: accuracy.relativeError < (expected.tolerance || 0.02),
                            formula: 'Displacement magnitude'
                        });
                    }
                }
            }

            setValidationResults(results);

            // Calculate overall accuracy
            const avgAccuracy = results.length > 0
                ? results.reduce((sum, r) => sum + r.accuracy.percentage, 0) / results.length
                : 0;
            setOverallAccuracy(avgAccuracy);

            // Notify parent
            const allPassed = results.every(r => r.passed);
            onValidationComplete?.({ passed: allPassed, accuracy: avgAccuracy });

        } catch (error) {
            console.error('Validation failed:', error);
        } finally {
            setIsValidating(false);
        }
    };

    // Summary statistics
    const stats = useMemo(() => {
        if (validationResults.length === 0) return null;

        const passed = validationResults.filter(r => r.passed).length;
        const failed = validationResults.filter(r => !r.passed).length;
        const avgAccuracy = validationResults.reduce((sum, r) => sum + r.accuracy.percentage, 0) / validationResults.length;
        const minAccuracy = Math.min(...validationResults.map(r => r.accuracy.percentage));
        const maxError = Math.max(...validationResults.map(r => r.accuracy.absoluteError));

        return { passed, failed, avgAccuracy, minAccuracy, maxError };
    }, [validationResults]);

    // ==========================================
    // RENDER
    // ==========================================

    return (
        <div className="bg-[#0b1326] rounded-xl border border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-[#131b2e] border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <h3 className="font-semibold text-[#dae2fd]">AI Validation Dashboard</h3>
                    {analysisResults && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                            Live Data
                        </span>
                    )}
                </div>
                {!isValidating && analysisResults && (
                    <button type="button"
                        onClick={runValidation}
                        className="text-sm text-blue-400 hover:text-blue-300"
                    >
                        Re-validate
                    </button>
                )}
            </div>

            <div className="p-4">
                {/* No data state */}
                {!analysisResults && !isValidating && validationResults.length === 0 && (
                    <div className="text-center py-8 text-[#869ab8]">
                        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                        </svg>
                        <p className="mb-2">No analysis data available</p>
                        <p className="text-sm">Run an analysis to see validation results</p>
                    </div>
                )}

                {/* Loading state */}
                {isValidating && (
                    <div className="text-center py-8">
                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-[#869ab8]">Validating against analytical solutions...</p>
                    </div>
                )}

                {/* Results */}
                {!isValidating && stats && (
                    <>
                        {/* Accuracy cards */}
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <AccuracyBadge accuracy={stats.avgAccuracy} label="Overall Accuracy" />
                            <div className="bg-[#131b2e] rounded-lg p-4">
                                <span className="text-[#869ab8] text-sm block">Tests Passed</span>
                                <span className="text-2xl font-bold text-green-400">{stats.passed}</span>
                                <span className="text-slate-500">/{validationResults.length}</span>
                            </div>
                            <AccuracyBadge accuracy={stats.minAccuracy} label="Min Accuracy" />
                            <div className="bg-[#131b2e] rounded-lg p-4">
                                <span className="text-[#869ab8] text-sm block">Max Error</span>
                                <span className="text-xl font-bold text-[#dae2fd]">{stats.maxError.toExponential(2)}</span>
                            </div>
                        </div>

                        {/* Analysis info */}
                        {analysisResults && (
                            <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3 mb-4 text-sm">
                                <div className="flex gap-6">
                                    <div>
                                        <span className="text-[#869ab8]">Nodes:</span>
                                        <span className="text-[#dae2fd] ml-2">{analysisResults.nodes.length}</span>
                                    </div>
                                    <div>
                                        <span className="text-[#869ab8]">Members:</span>
                                        <span className="text-[#dae2fd] ml-2">{analysisResults.members.length}</span>
                                    </div>
                                    <div>
                                        <span className="text-[#869ab8]">Converged:</span>
                                        <span className={`ml-2 ${analysisResults.converged ? 'text-green-400' : 'text-red-400'}`}>
                                            {analysisResults.converged ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Results list */}
                        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                            <h4 className="text-[#dae2fd] font-medium tracking-wide tracking-wide mb-2">Validation Results</h4>
                            {validationResults.map((result, idx) => (
                                <ResultRow key={idx} result={result} />
                            ))}
                        </div>

                        {/* Overall status */}
                        <div className={`mt-4 p-3 rounded-lg ${stats.failed === 0
                                ? 'bg-green-500/20 border border-green-500/50'
                                : 'bg-yellow-500/20 border border-yellow-500/50'
                            }`}>
                            <div className="flex items-center gap-2">
                                {stats.failed === 0 ? (
                                    <>
                                        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-green-400 font-medium tracking-wide tracking-wide">All validations passed</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-yellow-400 font-medium tracking-wide tracking-wide">{stats.failed} test(s) need attention</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ConnectedValidationDashboard;
