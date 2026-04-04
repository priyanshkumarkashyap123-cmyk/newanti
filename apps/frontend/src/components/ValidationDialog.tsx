/**
 * Validation Dialog Component
 * Shows structural validation errors and warnings before analysis
 */

import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { AlertCircle, AlertTriangle, Info, XCircle, Wrench, CheckCircle, BookOpen, Lightbulb, Target } from 'lucide-react';
import type { ValidationError } from '../utils/structuralValidation';
import { useModelStore } from '../store/model';

interface ValidationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    errors: ValidationError[];
    warnings: ValidationError[];
    info: ValidationError[];
    onProceedAnyway?: () => void;
    onRevalidate?: () => void;
    onApplySuggestion?: (suggestion: NonNullable<ValidationError['suggestions']>[0]) => void;
}

export const ValidationDialog: React.FC<ValidationDialogProps> = ({
    isOpen,
    onClose,
    errors,
    warnings,    info,    onProceedAnyway,
    onRevalidate,
    onApplySuggestion
}) => {
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [fixResults, setFixResults] = useState<{ fixed: string[]; errors: string[] } | null>(null);
    const [isFixing, setIsFixing] = useState(false);
    const autoFixModel = useModelStore(state => state.autoFixModel);

    const toggleExpanded = (id: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedItems(newExpanded);
    };
    
    const criticalErrors = errors.filter(e => e.type === 'critical');
    const regularErrors = errors.filter(e => e.type === 'error');
    const infoMessages = info;
    const actualWarnings = warnings.filter(w => w.type !== 'info');
    const hasCriticalErrors = criticalErrors.length > 0;

    const handleAutoFix = async () => {
        setIsFixing(true);
        try {
            const results = autoFixModel();
            setFixResults(results);
            
            // After fixing, trigger revalidation if callback provided
            if (results.fixed.length > 0 && onRevalidate) {
                setTimeout(() => {
                    onRevalidate();
                }, 500);
            }
        } catch (error) {
            console.error('Auto-fix failed:', error);
            setFixResults({ fixed: [], errors: ['Auto-fix failed: ' + String(error)] });
        } finally {
            setIsFixing(false);
        }
    };

    const handleClose = () => {
        setFixResults(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {hasCriticalErrors ? (
                            <>
                                <XCircle className="h-5 w-5 text-red-500" />
                                Structure Validation Failed
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                Structure Validation Warnings
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {hasCriticalErrors
                            ? 'Critical errors detected that must be fixed before analysis'
                            : 'Issues detected in your structure. Review before proceeding.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Auto-Fix Results */}
                    {fixResults && fixResults.fixed.length > 0 && (
                        <div className="border border-green-300 bg-green-50 p-4 rounded-lg flex gap-3">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-semibold text-green-900 mb-2">Auto-Fix Applied</div>
                                <div className="text-green-800 text-sm">
                                    <ul className="list-disc list-inside space-y-1">
                                        {fixResults.fixed.map((fix, idx) => (
                                            <li key={idx}>{fix}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Critical Errors */}
                    {criticalErrors.map((error, idx) => (
                        <div key={`critical-${idx}`} className="border border-red-300 bg-red-50 p-4 rounded-lg flex gap-3">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-bold text-red-900 mb-2">{error.message}</div>
                                <div className="text-red-800 whitespace-pre-line">
                                    {error.details}
                                    {error.affectedItems && error.affectedItems.length > 0 && (
                                        <div className="mt-2 text-xs">
                                            <strong>Affected:</strong> {error.affectedItems.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Regular Errors */}
                    {regularErrors.map((error, idx) => (
                        <div key={`error-${idx}`} className="border border-red-300 bg-red-50 p-4 rounded-lg flex gap-3">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-semibold text-red-900 mb-2">{error.message}</div>
                                <div className="text-red-800">
                                    {error.details}
                                    {error.affectedItems && error.affectedItems.length > 0 && (
                                        <div className="mt-2 text-xs">
                                            <strong>Affected:</strong> {error.affectedItems.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Info Messages */}
                    {infoMessages.map((info, idx) => (
                        <div key={`info-${idx}`} className="border border-green-300 bg-green-50 p-4 rounded-lg flex gap-3">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-semibold text-green-900 mb-2">{info.message}</div>
                                <div className="text-green-800">
                                    {info.details}
                                    {info.affectedItems && info.affectedItems.length > 0 && (
                                        <div className="mt-2 text-xs">
                                            <strong>Affected:</strong> {info.affectedItems.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Warnings */}
                    {warnings.map((warning, idx) => {
                        const isExpanded = expandedItems.has(`warning-${idx}`);
                        const hasEducational = warning.educational;
                        const hasSuggestions = warning.suggestions && warning.suggestions.length > 0;

                        return (
                            <div key={`warning-${idx}`} className={`border rounded-lg p-4 flex gap-3 ${
                                warning.severity === 'low' ? 'border-blue-300 bg-blue-50' :
                                warning.severity === 'medium' ? 'border-yellow-300 bg-yellow-50' :
                                'border-orange-300 bg-orange-50'
                            }`}>
                                <div className="flex-shrink-0 mt-0.5">
                                    {warning.severity === 'low' ? (
                                        <Info className="h-4 w-4 text-blue-600" />
                                    ) : (
                                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <div className={`font-semibold mb-2 ${
                                            warning.severity === 'low' ? 'text-blue-900' :
                                            warning.severity === 'medium' ? 'text-yellow-900' :
                                            'text-orange-900'
                                        }`}>
                                            {warning.message}
                                            {warning.category && (
                                                <span className="ml-2 text-xs font-normal px-2 py-1 rounded-full bg-white/50">
                                                    {warning.category}
                                                </span>
                                            )}
                                        </div>
                                        {(hasEducational || hasSuggestions) && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleExpanded(`warning-${idx}`)}
                                                className="text-xs"
                                            >
                                                {isExpanded ? 'Less' : 'More'}
                                            </Button>
                                        )}
                                    </div>

                                    <div className={`${
                                        warning.severity === 'low' ? 'text-blue-800' :
                                        warning.severity === 'medium' ? 'text-yellow-800' :
                                        'text-orange-800'
                                    }`}>
                                        {warning.details}
                                        {warning.affectedItems && warning.affectedItems.length > 0 && (
                                            <div className="mt-2 text-xs">
                                                <strong>Affected:</strong> {warning.affectedItems.join(', ')}
                                            </div>
                                        )}
                                    </div>

                                    {/* Educational Content */}
                                    {isExpanded && hasEducational && warning.educational && (
                                        <div className="mt-3 p-3 bg-white/70 rounded-lg border">
                                            <div className="flex items-center gap-2 mb-2">
                                                <BookOpen className="h-4 w-4 text-gray-600" />
                                                <span className="font-medium text-gray-900">Learn: {warning.educational.concept}</span>
                                            </div>
                                            <p className="text-sm text-gray-700 mb-2">{warning.educational.explanation}</p>
                                            <p className="text-sm font-medium text-gray-900">Why it matters: {warning.educational.whyImportant}</p>
                                        </div>
                                    )}

                                    {/* Suggestions */}
                                    {isExpanded && hasSuggestions && (
                                        <div className="mt-3 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Lightbulb className="h-4 w-4 text-green-600" />
                                                <span className="font-medium text-green-900">Suggested Fixes</span>
                                            </div>
                                            {warning.suggestions!.map((suggestion, sidx) => (
                                                <div key={sidx} className="flex items-center justify-between p-2 bg-white/50 rounded border">
                                                    <div className="flex-1">
                                                        <div className="font-medium text-sm text-gray-900">{suggestion.action}</div>
                                                        <div className="text-xs text-gray-600">{suggestion.description}</div>
                                                        <div className="flex gap-2 mt-1">
                                                            <span className={`text-xs px-2 py-0.5 rounded ${
                                                                suggestion.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                                                                suggestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-red-100 text-red-800'
                                                            }`}>
                                                                {suggestion.difficulty}
                                                            </span>
                                                            <span className={`text-xs px-2 py-0.5 rounded ${
                                                                suggestion.impact === 'high' ? 'bg-blue-100 text-blue-800' :
                                                                suggestion.impact === 'medium' ? 'bg-purple-100 text-purple-800' :
                                                                'bg-gray-100 text-gray-800'
                                                            }`}>
                                                                {suggestion.impact} impact
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {onApplySuggestion && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => onApplySuggestion(suggestion)}
                                                            className="ml-2"
                                                        >
                                                            <Target className="h-3 w-3 mr-1" />
                                                            Apply
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Help section */}
                    <div className="border border-blue-300 bg-blue-50 p-4 rounded-lg flex gap-3">
                        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <div className="font-semibold text-blue-900 mb-2">Quick Fixes</div>
                            <div className="text-blue-800 text-sm">
                                <ul className="list-disc list-inside space-y-1">
                                    <li><strong>Unstable:</strong> Add supports - Pin (2 restraints) or Fixed (3 restraints)</li>
                                    <li><strong>Zero-length:</strong> Delete duplicate nodes or move them apart</li>
                                    <li><strong>Disconnected:</strong> Delete unused nodes or connect with members</li>
                                    <li><strong>Mechanism:</strong> Add more members or supports to stabilize</li>
                                </ul>
                                <div className="mt-3">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={handleAutoFix}
                                        disabled={isFixing}
                                        className="bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300"
                                    >
                                        <Wrench className="h-4 w-4 mr-2" />
                                        {isFixing ? 'Fixing...' : 'Auto-Fix Common Issues'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleClose}>
                        Close
                    </Button>
                    <Button 
                        variant="secondary" 
                        onClick={handleAutoFix}
                        disabled={isFixing}
                    >
                        <Wrench className="h-4 w-4 mr-2" />
                        {isFixing ? 'Fixing...' : 'Auto-Fix'}
                    </Button>
                    {!hasCriticalErrors && onProceedAnyway && (
                        <Button variant="default" onClick={onProceedAnyway}>
                            Proceed Anyway
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
