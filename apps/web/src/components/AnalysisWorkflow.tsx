/**
 * AnalysisWorkflow - Guided Step-by-Step Workflow Component
 * 
 * Provides a visual workflow stepper for structural analysis:
 * 1. Define Geometry (Nodes & Members)
 * 2. Apply Supports (Boundary Conditions)
 * 3. Add Loads (Forces & Moments)
 * 4. Run Analysis
 * 5. View Results
 */

import React from 'react';
import { FC, useMemo } from 'react';
import { useModelStore } from '../store/model';
import {
    Circle,
    Columns,
    Lock,
    ArrowDown,
    Play,
    BarChart3,
    Check,
    AlertCircle
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface WorkflowStep {
    id: string;
    label: string;
    icon: React.ElementType;
    description: string;
}

interface AnalysisWorkflowProps {
    activeStep: number;
    onStepClick: (step: number) => void;
    onRunAnalysis: () => void;
    isAnalyzing: boolean;
}

// ============================================
// WORKFLOW STEPS
// ============================================

const WORKFLOW_STEPS: WorkflowStep[] = [
    {
        id: 'geometry',
        label: 'Geometry',
        icon: Circle,
        description: 'Add nodes and members'
    },
    {
        id: 'supports',
        label: 'Supports',
        icon: Lock,
        description: 'Define boundary conditions'
    },
    {
        id: 'loads',
        label: 'Loads',
        icon: ArrowDown,
        description: 'Apply forces and moments'
    },
    {
        id: 'analyze',
        label: 'Analyze',
        icon: Play,
        description: 'Run structural analysis'
    },
    {
        id: 'results',
        label: 'Results',
        icon: BarChart3,
        description: 'View analysis results'
    }
];

// ============================================
// COMPONENT
// ============================================

export const AnalysisWorkflow: FC<AnalysisWorkflowProps> = ({
    activeStep,
    onStepClick,
    onRunAnalysis,
    isAnalyzing
}) => {
    // Get model state for validation
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);
    const loads = useModelStore((s) => s.loads);
    const memberLoads = useModelStore((s) => s.memberLoads); // UDL, UVL, point loads on members
    const analysisResults = useModelStore((s) => s.analysisResults);

    // Check completion status of each step
    const stepStatus = useMemo(() => {
        const hasNodes = nodes.size > 0;
        const hasMembers = members.size > 0;
        const hasSupports = Array.from(nodes.values()).some(
            (n) => n.restraints && Object.values(n.restraints).some(Boolean)
        );
        // Check for any loads: nodal OR member loads (UDL/UVL)
        const hasLoads = loads.length > 0 || memberLoads.length > 0;
        const hasResults = analysisResults !== null;

        return {
            geometry: hasNodes && hasMembers,
            supports: hasSupports,
            loads: hasLoads,
            analyze: hasNodes && hasMembers && hasSupports && hasLoads,
            results: hasResults
        };
    }, [nodes, members, loads, memberLoads, analysisResults]);

    // Validation messages for current step
    const getValidationMessage = (stepIndex: number): string | null => {
        switch (stepIndex) {
            case 0:
                if (nodes.size === 0) return 'Add at least one node';
                if (members.size === 0) return 'Add at least one member';
                return null;
            case 1:
                if (!stepStatus.supports) return 'Add at least one support';
                return null;
            case 2:
                if (!stepStatus.loads) return 'Add at least one load (nodal or distributed)';
                return null;
            case 3:
                if (!stepStatus.analyze) return 'Complete previous steps first';
                return null;
            default:
                return null;
        }
    };

    const currentValidation = getValidationMessage(activeStep);

    return (
        <div className="flex flex-col bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            {/* Workflow Steps */}
            <div className="flex items-center justify-between px-4 py-2">
                {WORKFLOW_STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = index === activeStep;
                    const isComplete = stepStatus[step.id as keyof typeof stepStatus];
                    const isPast = index < activeStep;
                    const isClickable = index <= activeStep + 1 || isComplete;

                    return (
                        <div key={step.id} className="flex items-center flex-1">
                            {/* Step Indicator */}
                            <button type="button"
                                onClick={() => isClickable && onStepClick(index)}
                                disabled={!isClickable}
                                className={`
                                    flex items-center gap-2 px-3 py-2 rounded-lg transition-all
                                    ${isActive
                                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                                        : isComplete || isPast
                                            ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                                            : 'text-slate-500 dark:text-slate-500'
                                    }
                                    ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
                                `}
                            >
                                <div className={`
                                    relative w-8 h-8 rounded-full flex items-center justify-center
                                    ${isActive
                                        ? 'bg-blue-600 text-white'
                                        : isComplete
                                            ? 'bg-green-600 text-white'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                    }
                                `}>
                                    {isComplete && !isActive ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <Icon className="w-4 h-4" />
                                    )}
                                </div>
                                <div className="hidden md:block">
                                    <div className={`text-sm font-medium ${isActive ? '' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {step.label}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {step.description}
                                    </div>
                                </div>
                            </button>

                            {/* Connector Line */}
                            {index < WORKFLOW_STEPS.length - 1 && (
                                <div className={`
                                    flex-1 h-0.5 mx-2
                                    ${isPast || isComplete
                                        ? 'bg-green-500'
                                        : 'bg-slate-200 dark:bg-slate-700'
                                    }
                                `} />
                            )}
                        </div>
                    );
                })}

                {/* Run Analysis Button */}
                <button type="button"
                    onClick={onRunAnalysis}
                    disabled={!stepStatus.analyze || isAnalyzing}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ml-4
                        ${stepStatus.analyze && !isAnalyzing
                            ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/25'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                        }
                    `}
                >
                    {isAnalyzing ? (
                        <>
                            <div className="w-4 h-4 border-2 border-slate-200 dark:border-white border-t-transparent rounded-full animate-spin" />
                            <span>Analyzing...</span>
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4" />
                            <span>Run Analysis</span>
                        </>
                    )}
                </button>
            </div>

            {/* Validation Message */}
            {currentValidation && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-amber-700 dark:text-amber-400">
                        {currentValidation}
                    </span>
                </div>
            )}
        </div>
    );
};

export default AnalysisWorkflow;
