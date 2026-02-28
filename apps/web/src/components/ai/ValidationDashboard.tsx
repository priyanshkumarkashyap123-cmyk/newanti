/**
 * ValidationDashboard.tsx
 * 
 * UI component for displaying AI validation results and accuracy metrics
 * Exposes AIValidationService capabilities to users
 */

import React, { useState, useEffect, useCallback } from 'react';
import { aiValidation, AccuracyMetrics, ValidationResult } from '../../services/AIValidationService';
import { auditTrail } from '../../services/AuditTrailService';

// ============================================
// TYPES
// ============================================

interface DashboardProps {
    analysisResults?: {
        deflections: { nodeId: string; value: number }[];
        forces: { memberId: string; moment: number; shear: number }[];
    };
    beamConfig?: {
        L: number;
        E: number;
        I: number;
        loadType: 'point' | 'udl';
        loadValue: number;
    };
    onValidationComplete?: (result: ValidationResult) => void;
}

interface ValidationState {
    status: 'idle' | 'running' | 'complete' | 'error';
    results: ValidationResult[];
    overallAccuracy: number;
    confidence: 'high' | 'medium' | 'low';
}

// ============================================
// ACCURACY BADGE COMPONENT
// ============================================

const AccuracyBadge: React.FC<{ accuracy: number }> = ({ accuracy }) => {
    const getColor = () => {
        if (accuracy >= 95) return 'bg-green-500';
        if (accuracy >= 90) return 'bg-green-400';
        if (accuracy >= 85) return 'bg-yellow-500';
        if (accuracy >= 80) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const getLabel = () => {
        if (accuracy >= 95) return 'Excellent';
        if (accuracy >= 90) return 'Good';
        if (accuracy >= 85) return 'Acceptable';
        if (accuracy >= 80) return 'Review Required';
        return 'Check Results';
    };

    return (
        <div className={`inline-flex items-center px-3 py-1 rounded-full ${getColor()} text-zinc-900 dark:text-white font-semibold`}>
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d={accuracy >= 85 ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"}
                />
            </svg>
            <span>{accuracy.toFixed(1)}%</span>
            <span className="ml-1.5 text-xs opacity-80">{getLabel()}</span>
        </div>
    );
};

// ============================================
// VALIDATION RESULT ROW
// ============================================

const ValidationResultRow: React.FC<{ result: ValidationResult; index: number }> = ({ result, index }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="border border-gray-700 rounded-lg overflow-hidden mb-2">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-100 dark:bg-gray-800 hover:bg-gray-750 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">#{index + 1}</span>
                    <span className="font-medium text-zinc-900 dark:text-white">{result.testCase}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">{result.description}</span>
                </div>
                <div className="flex items-center gap-3">
                    <AccuracyBadge accuracy={result.accuracy.percentage} />
                    <svg
                        className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {expanded && (
                <div className="px-4 py-3 bg-gray-850 border-t border-gray-700">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <span className="text-gray-500 dark:text-gray-400 block">Computed Value</span>
                            <span className="text-zinc-900 dark:text-white font-mono">{result.computed.toFixed(6)}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 dark:text-gray-400 block">Expected Value</span>
                            <span className="text-green-400 font-mono">{result.expected.toFixed(6)}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 dark:text-gray-400 block">Error</span>
                            <span className={`font-mono ${result.accuracy.percentage >= 95 ? 'text-green-400' : 'text-yellow-400'}`}>
                                {result.accuracy.relativeError.toFixed(4)}%
                            </span>
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-700">
                        <span className="text-gray-500 dark:text-gray-400 text-sm block mb-1">Analytical Formula</span>
                        <code className="text-blue-400 text-sm bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded">
                            {result.formula || 'Standard beam theory'}
                        </code>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export const ValidationDashboard: React.FC<DashboardProps> = ({
    analysisResults,
    beamConfig,
    onValidationComplete
}) => {
    const [state, setState] = useState<ValidationState>({
        status: 'idle',
        results: [],
        overallAccuracy: 0,
        confidence: 'medium'
    });

    const [showDetails, setShowDetails] = useState(false);

    const runValidation = useCallback(async () => {
        if (!analysisResults || !beamConfig) return;

        setState(s => ({ ...s, status: 'running' }));

        try {
            // Run quick validation
            const quickResult = aiValidation.quickValidateCantilever(
                analysisResults.deflections[0]?.value || 0,
                beamConfig.L,
                beamConfig.E,
                beamConfig.I,
                beamConfig.loadValue
            );

            // Build validation results
            const computed = analysisResults.deflections[0]?.value || 0;
            const expected = quickResult.analytical;
            const absoluteError = Math.abs(computed - expected);
            const errorPercent = expected !== 0 ? (absoluteError / Math.abs(expected)) * 100 : 0;

            const results: ValidationResult[] = [{
                testCase: 'Cantilever End Deflection',
                description: 'Point load at free end',
                computed: computed,
                expected: expected,
                actual: computed,
                error: absoluteError,
                errorPercent: errorPercent,
                threshold: 5, // 5% tolerance
                accuracy: {
                    percentage: quickResult.accuracy,
                    absoluteError: absoluteError,
                    relativeError: errorPercent / 100
                },
                passed: quickResult.passed,
                formula: 'δ = PL³/(3EI)'
            }];

            const overallAccuracy = results.reduce((sum, r) => sum + r.accuracy.percentage, 0) / results.length;
            const confidence = overallAccuracy >= 95 ? 'high' : overallAccuracy >= 85 ? 'medium' : 'low';

            setState({
                status: 'complete',
                results,
                overallAccuracy,
                confidence
            });

            // Log to audit trail
            auditTrail.log('validation', 'ai_validation_dashboard', `Validation complete: ${overallAccuracy.toFixed(1)}% accuracy`, {
                aiGenerated: false,
                metadata: { results, confidence }
            });

            onValidationComplete?.(results[0]);

        } catch (error) {
            setState(s => ({ ...s, status: 'error' }));
            console.error('Validation failed:', error);
        }
    }, [analysisResults, beamConfig, onValidationComplete]);

    // Auto-run validation when results change
    useEffect(() => {
        if (analysisResults && beamConfig && state.status === 'idle') {
            queueMicrotask(() => runValidation());
        }
    }, [analysisResults, beamConfig, runValidation, state.status]);

    // ==========================================
    // RENDER
    // ==========================================

    return (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                    </svg>
                    <h3 className="font-semibold text-zinc-900 dark:text-white">AI Validation</h3>
                </div>

                {state.status === 'complete' && (
                    <AccuracyBadge accuracy={state.overallAccuracy} />
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                {state.status === 'idle' && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>Run an analysis to see validation results</p>
                        <button
                            onClick={runValidation}
                            disabled={!analysisResults}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
                        >
                            Validate Now
                        </button>
                    </div>
                )}

                {state.status === 'running' && (
                    <div className="text-center py-8">
                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">Validating against analytical solutions...</p>
                    </div>
                )}

                {state.status === 'complete' && (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                                <div className="text-gray-500 dark:text-gray-400 text-sm">Overall Accuracy</div>
                                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{state.overallAccuracy.toFixed(1)}%</div>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                                <div className="text-gray-500 dark:text-gray-400 text-sm">Tests Passed</div>
                                <div className="text-2xl font-bold text-green-400">
                                    {state.results.filter(r => r.passed).length}/{state.results.length}
                                </div>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                                <div className="text-gray-500 dark:text-gray-400 text-sm">Confidence Level</div>
                                <div className={`text-2xl font-bold ${state.confidence === 'high' ? 'text-green-400' :
                                        state.confidence === 'medium' ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                    {state.confidence.toUpperCase()}
                                </div>
                            </div>
                        </div>

                        {/* Toggle Details */}
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center gap-2"
                        >
                            {showDetails ? 'Hide Details' : 'Show Details'}
                            <svg className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {/* Detail Results */}
                        {showDetails && (
                            <div className="mt-4 space-y-2">
                                {state.results.map((result, idx) => (
                                    <ValidationResultRow key={idx} result={result} index={idx} />
                                ))}
                            </div>
                        )}

                        {/* Action Button */}
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={runValidation}
                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-medium"
                            >
                                Re-validate
                            </button>
                            <button
                                onClick={() => {
                                    const report = auditTrail.generateReportMarkdown('Engineer', 'License');
// console.log(report);
                                    alert('Validation report logged to audit trail');
                                }}
                                className="flex-1 py-2 bg-gray-700 text-zinc-900 dark:text-white rounded-lg hover:bg-gray-600 font-medium"
                            >
                                Export Report
                            </button>
                        </div>
                    </>
                )}

                {state.status === 'error' && (
                    <div className="text-center py-8 text-red-400">
                        <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <p>Validation failed. Please try again.</p>
                        <button
                            onClick={runValidation}
                            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                        >
                            Retry
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ValidationDashboard;
