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
import { AlertCircle, AlertTriangle, Info, XCircle, Wrench, CheckCircle } from 'lucide-react';
import type { ValidationError } from '../utils/structuralValidation';
import { useModelStore } from '../store/model';

interface ValidationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    errors: ValidationError[];
    warnings: ValidationError[];
    onProceedAnyway?: () => void;
    onRevalidate?: () => void;
}

export const ValidationDialog: React.FC<ValidationDialogProps> = ({
    isOpen,
    onClose,
    errors,
    warnings,
    onProceedAnyway,
    onRevalidate
}) => {
    const [fixResults, setFixResults] = useState<{ fixed: string[]; errors: string[] } | null>(null);
    const [isFixing, setIsFixing] = useState(false);
    const autoFixModel = useModelStore(state => state.autoFixModel);
    
    const criticalErrors = errors.filter(e => e.type === 'critical');
    const regularErrors = errors.filter(e => e.type === 'error');
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
                                <AlertTriangle className="h-5 w-5 text-yellow-500" />
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
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
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

                    {/* Warnings */}
                    {warnings.map((warning, idx) => (
                        <div key={`warning-${idx}`} className="border border-yellow-300 bg-yellow-50 p-4 rounded-lg flex gap-3">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-semibold text-yellow-900 mb-2">{warning.message}</div>
                                <div className="text-yellow-800">
                                    {warning.details}
                                    {warning.affectedItems && warning.affectedItems.length > 0 && (
                                        <div className="mt-2 text-xs">
                                            <strong>Affected:</strong> {warning.affectedItems.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

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
