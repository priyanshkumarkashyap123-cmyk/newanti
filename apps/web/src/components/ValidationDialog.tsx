/**
 * Validation Dialog Component
 * Shows structural validation errors and warnings before analysis
 */

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import type { ValidationError } from '../utils/structuralValidation';

interface ValidationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    errors: ValidationError[];
    warnings: ValidationError[];
    onProceedAnyway?: () => void;
}

export const ValidationDialog: React.FC<ValidationDialogProps> = ({
    isOpen,
    onClose,
    errors,
    warnings,
    onProceedAnyway
}) => {
    const criticalErrors = errors.filter(e => e.type === 'critical');
    const regularErrors = errors.filter(e => e.type === 'error');
    const hasCriticalErrors = criticalErrors.length > 0;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
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
                    {/* Critical Errors */}
                    {criticalErrors.map((error, idx) => (
                        <Alert key={`critical-${idx}`} variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle className="font-bold">{error.message}</AlertTitle>
                            <AlertDescription className="mt-2 whitespace-pre-line">
                                {error.details}
                                {error.affectedItems && error.affectedItems.length > 0 && (
                                    <div className="mt-2 text-xs">
                                        <strong>Affected:</strong> {error.affectedItems.join(', ')}
                                    </div>
                                )}
                            </AlertDescription>
                        </Alert>
                    ))}

                    {/* Regular Errors */}
                    {regularErrors.map((error, idx) => (
                        <Alert key={`error-${idx}`} className="border-red-300 bg-red-50">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertTitle className="text-red-900">{error.message}</AlertTitle>
                            <AlertDescription className="mt-2 text-red-800">
                                {error.details}
                                {error.affectedItems && error.affectedItems.length > 0 && (
                                    <div className="mt-2 text-xs">
                                        <strong>Affected:</strong> {error.affectedItems.join(', ')}
                                    </div>
                                )}
                            </AlertDescription>
                        </Alert>
                    ))}

                    {/* Warnings */}
                    {warnings.map((warning, idx) => (
                        <Alert key={`warning-${idx}`} className="border-yellow-300 bg-yellow-50">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <AlertTitle className="text-yellow-900">{warning.message}</AlertTitle>
                            <AlertDescription className="mt-2 text-yellow-800">
                                {warning.details}
                                {warning.affectedItems && warning.affectedItems.length > 0 && (
                                    <div className="mt-2 text-xs">
                                        <strong>Affected:</strong> {warning.affectedItems.join(', ')}
                                    </div>
                                )}
                            </AlertDescription>
                        </Alert>
                    ))}

                    {/* Help section */}
                    <Alert className="border-blue-300 bg-blue-50">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-900">Quick Fixes</AlertTitle>
                        <AlertDescription className="mt-2 text-blue-800 text-sm">
                            <ul className="list-disc list-inside space-y-1">
                                <li><strong>Unstable:</strong> Add supports - Pin (2 restraints) or Fixed (3 restraints)</li>
                                <li><strong>Zero-length:</strong> Delete duplicate nodes or move them apart</li>
                                <li><strong>Disconnected:</strong> Delete unused nodes or connect with members</li>
                                <li><strong>Mechanism:</strong> Add more members or supports to stabilize</li>
                            </ul>
                        </AlertDescription>
                    </Alert>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
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
