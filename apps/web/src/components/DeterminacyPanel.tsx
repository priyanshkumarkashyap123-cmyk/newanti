/**
 * Determinacy Analysis Panel
 * Displays comprehensive static and kinematic determinacy information
 */

import React from 'react';
import type { DeterminacyResult } from '../utils/determinacyAnalysis';

interface DeterminacyPanelProps {
    result: DeterminacyResult;
}

export const DeterminacyPanel: React.FC<DeterminacyPanelProps> = ({ result }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    📊 Determinacy Analysis
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Complete static and kinematic analysis of structural stability
                </p>
            </div>

            {/* Overall Status */}
            <div className={`p-4 rounded-lg ${
                result.isAnalyzable 
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
                <div className="flex items-center gap-3">
                    <span className="text-2xl">
                        {result.isAnalyzable ? '✅' : '❌'}
                    </span>
                    <div>
                        <p className="font-semibold text-lg">
                            {result.isAnalyzable ? 'Structure is Analyzable' : 'Structure Cannot Be Analyzed'}
                        </p>
                        <p className="text-sm opacity-80">
                            {result.isStable ? 'Stable structure' : 'Unstable - mechanism detected'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Structure Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoCard label="Nodes" value={result.numNodes} />
                <InfoCard label="Members" value={result.numMembers} />
                <InfoCard label="Reactions" value={result.numReactions} />
                <InfoCard label="Free DOF" value={result.freeDOF} />
            </div>

            {/* Static Determinacy */}
            <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="text-xl">🔧</span>
                    Static Determinacy
                </h3>
                <div className={`p-4 rounded-lg ${getStaticDeterminacyColor(result.degreeOfStaticIndeterminacy)}`}>
                    <p className="font-medium mb-1">{result.staticDescription}</p>
                    <div className="text-sm opacity-90">
                        <p>Degree of Static Indeterminacy (DSI) = {result.degreeOfStaticIndeterminacy}</p>
                        {result.degreeOfStaticIndeterminacy < 0 && (
                            <p className="mt-2 text-red-700 dark:text-red-300">
                                ⚠️ Missing {Math.abs(result.degreeOfStaticIndeterminacy)} constraints
                            </p>
                        )}
                        {result.degreeOfStaticIndeterminacy > 0 && (
                            <p className="mt-2 text-blue-700 dark:text-blue-300">
                                ℹ️ Requires stiffness method for analysis
                            </p>
                        )}
                        {result.degreeOfStaticIndeterminacy === 0 && (
                            <p className="mt-2 text-green-700 dark:text-green-300">
                                ✓ Can be solved using equilibrium equations
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Kinematic Stability */}
            <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="text-xl">🏗️</span>
                    Kinematic Stability
                </h3>
                <div className={`p-4 rounded-lg ${getKinematicDeterminacyColor(result.isStable)}`}>
                    <p className="font-medium mb-1">{result.kinematicDescription}</p>
                    <div className="text-sm opacity-90">
                        <p>Degree of Kinematic Indeterminacy (DKI) = {result.degreeOfKinematicIndeterminacy}</p>
                        {!result.isStable && (
                            <p className="mt-2 text-red-700 dark:text-red-300 font-medium">
                                ⚠️ Structure will collapse - add supports or members
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Rigid Body Modes */}
            {result.hasRigidBodyModes && result.rigidBodyModes.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <span className="text-xl">⚠️</span>
                        Rigid Body Modes
                    </h3>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <p className="text-sm mb-2 font-medium">
                            Structure can move without deformation:
                        </p>
                        <ul className="space-y-1">
                            {result.rigidBodyModes.map((mode, idx) => (
                                <li key={idx} className="text-sm flex items-start gap-2">
                                    <span className="text-yellow-600 dark:text-yellow-400">•</span>
                                    <span>{mode}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                        <span className="text-xl">❌</span>
                        Errors
                    </h3>
                    <div className="space-y-2">
                        {result.errors.map((error, idx) => (
                            <div key={idx} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                        <span className="text-xl">⚡</span>
                        Warnings
                    </h3>
                    <div className="space-y-2">
                        {result.warnings.map((warning, idx) => (
                            <div key={idx} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                                <p className="text-sm text-yellow-800 dark:text-yellow-200">{warning}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                        <span className="text-xl">💡</span>
                        Recommendations
                    </h3>
                    <div className="space-y-2">
                        {result.recommendations.map((rec, idx) => (
                            <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                <p className="text-sm text-blue-800 dark:text-blue-200">{rec}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Theory Reference */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <details className="text-sm text-gray-600 dark:text-gray-400">
                    <summary className="cursor-pointer font-medium hover:text-gray-900 dark:hover:text-gray-100">
                        📚 Theory Reference
                    </summary>
                    <div className="mt-3 space-y-2 pl-4">
                        <p className="font-mono text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded">
                            Static Determinacy: DSI = (m + r) - 2j - c
                        </p>
                        <p className="font-mono text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded">
                            Kinematic Stability: DKI = freeDOF - memberConstraints
                        </p>
                        <ul className="text-xs space-y-1 list-disc list-inside">
                            <li>DSI {'<'} 0: Unstable (insufficient constraints)</li>
                            <li>DSI = 0: Statically determinate (equilibrium solvable)</li>
                            <li>DSI {'>'} 0: Statically indeterminate (redundant constraints)</li>
                        </ul>
                    </div>
                </details>
            </div>
        </div>
    );
};

// Helper Components
const InfoCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{label}</p>
    </div>
);

function getStaticDeterminacyColor(dsi: number): string {
    if (dsi < 0) return 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800';
    if (dsi === 0) return 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800';
    return 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800';
}

function getKinematicDeterminacyColor(isStable: boolean): string {
    return isStable 
        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800';
}

export default DeterminacyPanel;
