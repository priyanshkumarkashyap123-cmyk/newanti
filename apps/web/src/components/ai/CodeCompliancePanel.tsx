/**
 * CodeCompliancePanel.tsx
 * 
 * UI component for displaying code compliance check results
 * Exposes CodeComplianceEngine to users with visual utilization bars
 */

import React, { useState, useCallback } from 'react';
import {
    codeCompliance,
    CodeCheck,
    ComplianceReport,
    SteelSection,
    SteelMaterial,
    MemberProperties,
    MemberForces,
    STEEL_GRADES
} from '../../services/CodeComplianceEngine';
import { auditTrail } from '../../services/AuditTrailService';

// ============================================
// TYPES
// ============================================

interface CompliancePanelProps {
    member?: {
        section: SteelSection;
        material: SteelMaterial;
        length: number;
        effectiveLengthFactorY?: number;
        effectiveLengthFactorZ?: number;
    };
    forces?: MemberForces;
    code?: 'IS_800' | 'AISC_360' | 'EUROCODE_3';
    onCheckComplete?: (report: ComplianceReport) => void;
}

// ============================================
// UTILIZATION BAR COMPONENT
// ============================================

const UtilizationBar: React.FC<{ ratio: number; showLabel?: boolean }> = ({ ratio, showLabel = true }) => {
    const percentage = Math.min(ratio * 100, 150);

    const getColor = () => {
        if (ratio <= 0.7) return 'bg-green-500';
        if (ratio <= 0.9) return 'bg-yellow-500';
        if (ratio <= 1.0) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const getBgColor = () => {
        if (ratio <= 0.7) return 'bg-green-900/30';
        if (ratio <= 0.9) return 'bg-yellow-900/30';
        if (ratio <= 1.0) return 'bg-orange-900/30';
        return 'bg-red-900/30';
    };

    return (
        <div className="flex items-center gap-2">
            <div className={`relative flex-1 h-3 rounded-full ${getBgColor()} overflow-hidden`}>
                <div
                    className={`absolute inset-y-0 left-0 ${getColor()} rounded-full transition-all duration-300`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
                {ratio > 1 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-white font-bold">OVER</span>
                    </div>
                )}
            </div>
            {showLabel && (
                <span className={`text-sm font-mono w-14 text-right ${ratio > 1 ? 'text-red-400' : 'text-gray-400'}`}>
                    {(ratio * 100).toFixed(1)}%
                </span>
            )}
        </div>
    );
};

// ============================================
// CHECK ROW COMPONENT
// ============================================

const CheckRow: React.FC<{ check: CodeCheck }> = ({ check }) => {
    const [expanded, setExpanded] = useState(false);

    const getStatusIcon = () => {
        switch (check.status) {
            case 'PASS':
                return (
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                );
            case 'FAIL':
                return (
                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                );
            case 'WARNING':
                return (
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                );
        }
    };

    return (
        <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-center gap-3 bg-gray-800 hover:bg-gray-750"
            >
                {getStatusIcon()}
                <div className="flex-1 text-left">
                    <div className="text-white font-medium">{check.title}</div>
                    <div className="text-gray-400 text-sm">Clause {check.clause}</div>
                </div>
                <div className="w-32">
                    <UtilizationBar ratio={check.ratio} />
                </div>
                <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="px-4 py-3 bg-gray-850 border-t border-gray-700">
                    <div className="text-sm text-gray-300 mb-3">{check.description}</div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                            <span className="text-gray-400 block">Demand</span>
                            <span className="text-white font-mono">{check.demand.toFixed(2)} {check.unit}</span>
                        </div>
                        <div>
                            <span className="text-gray-400 block">Capacity</span>
                            <span className="text-green-400 font-mono">{check.capacity.toFixed(2)} {check.unit}</span>
                        </div>
                    </div>

                    {check.formula && (
                        <div className="mb-3">
                            <span className="text-gray-400 text-sm block mb-1">Formula</span>
                            <code className="text-blue-400 text-sm bg-gray-900 px-2 py-1 rounded">
                                {check.formula}
                            </code>
                        </div>
                    )}

                    {check.recommendation && (
                        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span className="text-yellow-200 text-sm">{check.recommendation}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN PANEL COMPONENT
// ============================================

export const CodeCompliancePanel: React.FC<CompliancePanelProps> = ({
    member,
    forces,
    code = 'IS_800',
    onCheckComplete
}) => {
    const [report, setReport] = useState<ComplianceReport | null>(null);
    const [loading, setLoading] = useState(false);

    const runCheck = useCallback(() => {
        if (!member || !forces) return;

        setLoading(true);

        // Build member properties
        const memberProps: MemberProperties = {
            section: member.section,
            material: member.material,
            length: member.length,
            effectiveLengthY: (member.effectiveLengthFactorY || 1.0) * member.length,
            effectiveLengthZ: (member.effectiveLengthFactorZ || 1.0) * member.length
        };

        // Run compliance check
        setTimeout(() => {
            const result = codeCompliance.checkSteelMember(memberProps, forces);
            setReport(result);
            setLoading(false);

            // Log to audit trail
            auditTrail.log('design_check', 'code_compliance_panel',
                `Code compliance check: ${result.overallStatus}, max util ${(result.maxUtilization * 100).toFixed(1)}%`,
                { aiGenerated: false, metadata: result }
            );

            onCheckComplete?.(result);
        }, 500);
    }, [member, forces, onCheckComplete]);

    // ==========================================
    // RENDER
    // ==========================================

    return (
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                    </svg>
                    <h3 className="font-semibold text-white">Code Compliance - {code.replace('_', ' ')}</h3>
                </div>

                {report && (
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${report.overallStatus === 'COMPLIANT' ? 'bg-green-500/20 text-green-400' :
                            report.overallStatus === 'WARNINGS' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                        }`}>
                        {report.overallStatus}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                {!member && (
                    <div className="text-center py-8 text-gray-400">
                        <p>Select a member to check code compliance</p>
                    </div>
                )}

                {member && !report && !loading && (
                    <div className="text-center py-8">
                        <div className="mb-4">
                            <div className="text-white font-medium">{member.section.name}</div>
                            <div className="text-gray-400 text-sm">{member.material.grade} Steel</div>
                        </div>
                        <button
                            onClick={runCheck}
                            disabled={!forces}
                            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 font-medium"
                        >
                            Run Code Check
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="text-center py-8">
                        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-gray-400">Checking against {code.replace('_', ' ')}...</p>
                    </div>
                )}

                {report && !loading && (
                    <>
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-gray-800 rounded-lg p-4">
                                <div className="text-gray-400 text-sm">Max Utilization</div>
                                <div className={`text-2xl font-bold ${report.maxUtilization <= 0.9 ? 'text-green-400' :
                                        report.maxUtilization <= 1.0 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                    {(report.maxUtilization * 100).toFixed(1)}%
                                </div>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-4">
                                <div className="text-gray-400 text-sm">Checks Passed</div>
                                <div className="text-2xl font-bold text-green-400">
                                    {report.checks.filter(c => c.status === 'PASS').length}/{report.checks.length}
                                </div>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-4">
                                <div className="text-gray-400 text-sm">Critical Check</div>
                                <div className="text-lg font-medium text-white truncate">
                                    {report.criticalCheck || 'None'}
                                </div>
                            </div>
                        </div>

                        {/* Utilization Summary */}
                        <div className="bg-gray-800 rounded-lg p-4 mb-4">
                            <div className="text-gray-400 text-sm mb-2">Overall Utilization</div>
                            <UtilizationBar ratio={report.maxUtilization} />
                        </div>

                        {/* Check Results */}
                        <div className="space-y-2">
                            {report.checks.map((check, idx) => (
                                <CheckRow key={check.id || idx} check={check} />
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={runCheck}
                                className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 font-medium"
                            >
                                Re-check
                            </button>
                            <button
                                onClick={() => {
                                    const summary = codeCompliance.generateSummary([report]);
                                    console.log(summary);
                                    alert('Report generated - check console');
                                }}
                                className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
                            >
                                Generate Report
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CodeCompliancePanel;
