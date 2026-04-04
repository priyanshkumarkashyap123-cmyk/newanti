/**
 * AIDesignWizard.tsx
 * 
 * Intelligent Design Assistant with Step-by-Step Guidance
 * 
 * Features:
 * - Guided design workflow
 * - AI suggestions at each step
 * - Code compliance checking
 * - Automatic optimization
 * - Design history tracking
 */

import React, { useState, useEffect } from 'react';
import { useModelStore } from '../../store/model';
import { useAuth } from '../../providers/AuthProvider';
import { API_CONFIG } from '../../config/env';


// ============================================
// TYPES
// ============================================

export type DesignStep =
    | 'project_setup'
    | 'geometry_input'
    | 'material_selection'
    | 'loading'
    | 'load_combinations'
    | 'analysis'
    | 'member_design'
    | 'connection_design'
    | 'foundation_design'
    | 'report_generation';

export interface WizardState {
    currentStep: DesignStep;
    completedSteps: DesignStep[];
    projectData: any;
    aiSuggestions: AISuggestion[];
    designIssues: DesignIssue[];
}

export interface AISuggestion {
    id: string;
    step: DesignStep;
    type: 'optimization' | 'warning' | 'tip' | 'auto_fix';
    message: string;
    action?: () => void;
    applied: boolean;
}

export interface DesignIssue {
    id: string;
    severity: 'error' | 'warning' | 'info';
    step: DesignStep;
    message: string;
    code?: string;
    fix?: () => void;
}

// ============================================
// STEP CONFIGURATION
// ============================================

const DESIGN_STEPS: Array<{ step: DesignStep; title: string; description: string }> = [
    { step: 'project_setup', title: 'Project Setup', description: 'Define project parameters and design codes' },
    { step: 'geometry_input', title: 'Geometry', description: 'Create structural model or import from CAD/Revit' },
    { step: 'material_selection', title: 'Materials', description: 'Assign material properties to elements' },
    { step: 'loading', title: 'Loading', description: 'Define dead, live, wind, seismic loads' },
    { step: 'load_combinations', title: 'Combinations', description: 'Generate code-compliant load combinations' },
    { step: 'analysis', title: 'Analysis', description: 'Run structural analysis and review results' },
    { step: 'member_design', title: 'Member Design', description: 'Check and optimize member sections' },
    { step: 'connection_design', title: 'Connections', description: 'Design beam-column connections' },
    { step: 'foundation_design', title: 'Foundations', description: 'Size footings and foundation elements' },
    { step: 'report_generation', title: 'Reports', description: 'Generate calculation reports for submission' }
];

// ============================================
// AI DESIGN WIZARD COMPONENT
// ============================================

export const AIDesignWizard: React.FC<{
    onComplete?: (projectData: any) => void;
    initialData?: any;
}> = ({ onComplete, initialData }) => {    const { getToken } = useAuth();    const [state, setState] = useState<WizardState>({
        currentStep: 'project_setup',
        completedSteps: [],
        projectData: initialData || {},
        aiSuggestions: [],
        designIssues: []
    });

    const [isAIProcessing, setIsAIProcessing] = useState(false);

    const currentStepIndex = DESIGN_STEPS.findIndex(s => s.step === state.currentStep);
    const currentStepConfig = DESIGN_STEPS[currentStepIndex];

    /**
     * Get AI suggestions for current step
     */
    const getAISuggestions = async (step: DesignStep): Promise<AISuggestion[]> => {
        setIsAIProcessing(true);

        try {
            // Get current model data from store
            const modelStore = useModelStore.getState();
            const model = {
                nodes: Array.from(modelStore.nodes.values()),
                members: Array.from(modelStore.members.values()),
                // Include other relevant data
            };

            const payload = {
                model,
                step,
                analysis_results: modelStore.analysisResults ? {
                    // Simplified results for AI analysis
                    max_displacement: 0, // Calculate or extract
                    failed_members: []   // Extract
                } : null
            };

            const token = await getToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(`${API_CONFIG.baseUrl}/api/ai/recommendations`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to fetch suggestions');

            const data = await response.json();
            if (data.success && Array.isArray(data.suggestions)) {
                setIsAIProcessing(false);
                return data.suggestions.map((s: any) => ({
                    ...s,
                    applied: false // Backend doesn't track applied state per session
                }));
            }
        } catch (error) {
            console.error("AI Suggestion Error:", error);
            // Fallback to offline heuristic or empty
        }

        setIsAIProcessing(false);
        return [];
    };

    /**
     * Validate current step
     */
    const validateStep = async (step: DesignStep): Promise<DesignIssue[]> => {
        const issues: DesignIssue[] = [];

        switch (step) {
            case 'geometry_input':
                // Check for disconnected nodes, missing supports, etc.
                if (!state.projectData.hasSupports) {
                    issues.push({
                        id: 'issue_1',
                        severity: 'error',
                        step,
                        message: 'Structure has no supports defined. Add at least one support.',
                        code: 'GEOM_001'
                    });
                }
                break;

            case 'loading':
                if (!state.projectData.hasLiveLoad) {
                    issues.push({
                        id: 'issue_2',
                        severity: 'warning',
                        step,
                        message: 'No live load defined. Most codes require live load consideration.',
                        code: 'LOAD_001'
                    });
                }
                break;

            case 'member_design':
                // Check for failed members
                break;
        }

        return issues;
    };

    /**
     * Navigate to next step
     */
    const nextStep = async () => {
        const issues = await validateStep(state.currentStep);
        const errors = issues.filter(i => i.severity === 'error');

        if (errors.length > 0) {
            setState(prev => ({ ...prev, designIssues: issues }));
            return;
        }

        const nextIndex = currentStepIndex + 1;
        if (nextIndex < DESIGN_STEPS.length) {
            const nextStepConfig = DESIGN_STEPS[nextIndex];
            const suggestions = await getAISuggestions(nextStepConfig.step);

            setState(prev => ({
                ...prev,
                currentStep: nextStepConfig.step,
                completedSteps: [...prev.completedSteps, prev.currentStep],
                aiSuggestions: suggestions,
                designIssues: issues.filter(i => i.severity !== 'error')
            }));
        } else {
            onComplete?.(state.projectData);
        }
    };

    /**
     * Navigate to previous step
     */
    const prevStep = () => {
        if (currentStepIndex > 0) {
            setState(prev => ({
                ...prev,
                currentStep: DESIGN_STEPS[currentStepIndex - 1].step
            }));
        }
    };

    /**
     * Jump to specific step
     */
    const goToStep = (step: DesignStep) => {
        if (state.completedSteps.includes(step) || step === state.currentStep) {
            setState(prev => ({ ...prev, currentStep: step }));
        }
    };

    /**
     * Apply AI suggestion
     */
    const applySuggestion = (suggestionId: string) => {
        setState(prev => ({
            ...prev,
            aiSuggestions: prev.aiSuggestions.map(s =>
                s.id === suggestionId ? { ...s, applied: true } : s
            )
        }));

        const suggestion = state.aiSuggestions.find(s => s.id === suggestionId);
        suggestion?.action?.();
    };

    // Load suggestions on step change
    useEffect(() => {
        getAISuggestions(state.currentStep).then(suggestions => {
            setState(prev => ({ ...prev, aiSuggestions: suggestions }));
        });
    }, [state.currentStep]);

    return (
        <div className="bg-[#0b1326] rounded-xl overflow-hidden">
            {/* Progress Header */}
            <div className="bg-[#131b2e] px-4 py-3 border-b border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-[#dae2fd] flex items-center gap-2">
                        <span>🧙‍♂️</span>
                        AI Design Wizard
                    </h2>
                    <span className="text-sm text-[#869ab8]">
                        Step {currentStepIndex + 1} of {DESIGN_STEPS.length}
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="flex gap-1">
                    {DESIGN_STEPS.map((step, i) => (
                        <button type="button"
                            key={step.step}
                            onClick={() => goToStep(step.step)}
                            className={`flex-1 h-2 rounded-full transition-colors ${i < currentStepIndex ? 'bg-green-500' :
                                i === currentStepIndex ? 'bg-blue-500' :
                                    'bg-slate-700'
                                } ${state.completedSteps.includes(step.step) ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                            title={step.title}
                        />
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <div className="p-6">
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-[#dae2fd] mb-1">
                        {currentStepConfig.title}
                    </h3>
                    <p className="text-[#869ab8]">{currentStepConfig.description}</p>
                </div>

                {/* AI Suggestions */}
                {state.aiSuggestions.length > 0 && (
                    <div className="mb-6 space-y-2">
                        <h4 className="text-sm font-medium tracking-wide text-blue-400 flex items-center gap-1">
                            <span>💡</span> AI Suggestions
                        </h4>
                        {state.aiSuggestions.map(suggestion => (
                            <div
                                key={suggestion.id}
                                className={`p-3 rounded-lg border flex items-start gap-3 ${suggestion.applied ? 'bg-green-500/10 border-green-500/30' :
                                    suggestion.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                                        suggestion.type === 'optimization' ? 'bg-purple-500/10 border-purple-500/30' :
                                            'bg-blue-500/10 border-blue-500/30'
                                    }`}
                            >
                                <span className="text-lg">
                                    {suggestion.type === 'warning' ? '⚠️' :
                                        suggestion.type === 'optimization' ? '🚀' :
                                            suggestion.type === 'auto_fix' ? '🔧' : '💡'}
                                </span>
                                <div className="flex-1">
                                    <p className="text-sm text-slate-700 dark:text-slate-200">{suggestion.message}</p>
                                </div>
                                {suggestion.action && !suggestion.applied && (
                                    <button type="button"
                                        onClick={() => applySuggestion(suggestion.id)}
                                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-400"
                                    >
                                        Apply
                                    </button>
                                )}
                                {suggestion.applied && (
                                    <span className="text-green-400 text-sm">✓ Applied</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Design Issues */}
                {state.designIssues.length > 0 && (
                    <div className="mb-6 space-y-2">
                        <h4 className="text-sm font-medium tracking-wide text-red-400 flex items-center gap-1">
                            <span>⚠️</span> Issues Found
                        </h4>
                        {state.designIssues.map(issue => (
                            <div
                                key={issue.id}
                                className={`p-3 rounded-lg border ${issue.severity === 'error' ? 'bg-red-500/10 border-red-500/30' :
                                    issue.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                                        'bg-blue-500/10 border-blue-500/30'
                                    }`}
                            >
                                <p className="text-sm text-slate-700 dark:text-slate-200">
                                    {issue.code && <span className="font-mono text-xs mr-2">[{issue.code}]</span>}
                                    {issue.message}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Step-specific content would go here */}
                <div className="bg-[#131b2e] rounded-lg p-8 text-center text-slate-500">
                    Step content for "{currentStepConfig.title}"
                </div>
            </div>

            {/* Navigation Footer */}
            <div className="px-6 py-4 bg-[#131b2e] border-t border-slate-700 flex justify-between">
                <button type="button"
                    onClick={prevStep}
                    disabled={currentStepIndex === 0}
                    className="px-4 py-2 bg-slate-700 text-[#dae2fd] rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    ← Previous
                </button>

                <div className="flex items-center gap-2">
                    {isAIProcessing && (
                        <span className="text-sm text-blue-400 animate-pulse">AI analyzing...</span>
                    )}
                </div>

                <button type="button"
                    onClick={nextStep}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-400"
                >
                    {currentStepIndex === DESIGN_STEPS.length - 1 ? 'Complete' : 'Next →'}
                </button>
            </div>
        </div>
    );
};

export default AIDesignWizard;
