import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AlertTriangle, Shield, FileText, Lock } from 'lucide-react';
import {
    TERMS_OF_SERVICE,
    PRIVACY_POLICY,
    ENGINEERING_DISCLAIMER,
    CONSENT_SUMMARY
} from '../constants/legal';

const CONSENT_STORAGE_KEY = 'beamlab_legal_consent_v1';

interface ConsentState {
    terms: boolean;
    privacy: boolean;
    disclaimer: boolean;
    verification: boolean;
    liability: boolean;
}

interface LegalConsentModalProps {
    open: boolean;
    onAccept: () => void;
    canClose?: boolean; // If false, user MUST accept to proceed
}

export function LegalConsentModal({ open, onAccept, canClose = false }: LegalConsentModalProps) {
    const [consents, setConsents] = useState<ConsentState>({
        terms: false,
        privacy: false,
        disclaimer: false,
        verification: false,
        liability: false
    });

    const allConsentsGiven = Object.values(consents).every(v => v === true);

    const handleConsentChange = (key: keyof ConsentState, checked: boolean) => {
        setConsents(prev => ({ ...prev, [key]: checked }));
    };

    const handleAccept = () => {
        if (!allConsentsGiven) return;

        // Store consent in localStorage with timestamp
        const consentData = {
            ...consents,
            timestamp: new Date().toISOString(),
            version: 'v1'
        };
        localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentData));

        onAccept();
    };

    return (
        <Dialog open={open} onOpenChange={canClose ? undefined : () => { }}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 z-[100]">
                <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-red-50 to-orange-50 border-b">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-8 h-8 text-red-600 mt-1 flex-shrink-0" />
                        <div>
                            <DialogTitle className="text-2xl font-bold text-gray-900">
                                {CONSENT_SUMMARY.title}
                            </DialogTitle>
                            <DialogDescription className="text-base text-gray-700 mt-2">
                                {CONSENT_SUMMARY.subtitle}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* Legal Documents Tabs */}
                    <Tabs defaultValue="disclaimer" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="disclaimer" className="gap-2">
                                <Shield className="w-4 h-4" />
                                Engineering Disclaimer
                            </TabsTrigger>
                            <TabsTrigger value="terms" className="gap-2">
                                <FileText className="w-4 h-4" />
                                Terms of Service
                            </TabsTrigger>
                            <TabsTrigger value="privacy" className="gap-2">
                                <Lock className="w-4 h-4" />
                                Privacy Policy
                            </TabsTrigger>
                        </TabsList>

                        <div className="mt-4 border rounded-lg">
                            <TabsContent value="disclaimer" className="m-0">
                                <ScrollArea className="h-[300px] p-4">
                                    <div className="prose prose-sm max-w-none">
                                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                            {ENGINEERING_DISCLAIMER}
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="terms" className="m-0">
                                <ScrollArea className="h-[300px] p-4">
                                    <div className="prose prose-sm max-w-none">
                                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                            {TERMS_OF_SERVICE}
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="privacy" className="m-0">
                                <ScrollArea className="h-[300px] p-4">
                                    <div className="prose prose-sm max-w-none">
                                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                            {PRIVACY_POLICY}
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        </div>
                    </Tabs>

                    {/* Consent Checkboxes */}
                    <div className="space-y-4 bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                        <p className="font-semibold text-gray-900 mb-3">Required Acknowledgments:</p>

                        {CONSENT_SUMMARY.checkboxes.map((checkbox) => (
                            <div
                                key={checkbox.id}
                                className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${checkbox.highlight
                                    ? 'bg-red-50 border border-red-200'
                                    : 'bg-white border border-gray-200'
                                    }`}
                            >
                                <Checkbox
                                    id={checkbox.id}
                                    checked={consents[checkbox.id as keyof ConsentState]}
                                    onCheckedChange={(checked: boolean | 'indeterminate') =>
                                        handleConsentChange(checkbox.id as keyof ConsentState, checked as boolean)
                                    }
                                    className="mt-1"
                                />
                                <label
                                    htmlFor={checkbox.id}
                                    className={`text-sm leading-relaxed cursor-pointer flex-1 ${checkbox.highlight ? 'font-semibold text-red-900' : 'text-gray-700'
                                        }`}
                                >
                                    {checkbox.label}
                                    {checkbox.required && <span className="text-red-600 ml-1">*</span>}
                                </label>
                            </div>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        {canClose && (
                            <Button variant="outline" onClick={() => window.history.back()}>
                                Cancel
                            </Button>
                        )}
                        <Button
                            onClick={handleAccept}
                            disabled={!allConsentsGiven}
                            className={`min-w-[200px] ${allConsentsGiven
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-gray-300 cursor-not-allowed'
                                }`}
                        >
                            {allConsentsGiven ? '✓ I Accept All Terms' : 'Please Review & Check All Boxes'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Hook to check if user has given legal consent
 */
export function useCheckLegalConsent() {
    const [hasConsent, setHasConsent] = useState<boolean | null>(null);

    useEffect(() => {
        // Defer to avoid synchronous setState at effect start
        queueMicrotask(() => {
            const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
            if (stored) {
                try {
                    const data = JSON.parse(stored);
                    // Check if consent is still valid (you can add expiration logic here)
                    const isValid = data.version === 'v1' &&
                        data.terms &&
                        data.privacy &&
                        data.disclaimer &&
                        data.verification &&
                        data.liability;
                    setHasConsent(isValid);
                } catch {
                    setHasConsent(false);
                }
            } else {
                setHasConsent(false);
            }
        });
    }, []);

    const clearConsent = () => {
        localStorage.removeItem(CONSENT_STORAGE_KEY);
        setHasConsent(false);
    };

    return { hasConsent, clearConsent };
}
