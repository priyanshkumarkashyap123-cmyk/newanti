/**
 * CheckpointLegalModal.tsx - Context-aware legal consent modal
 * Shows different legal content based on the action point (login, analysis, design, PDF export)
 */

import { FC, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { CONSENT_CHECKPOINTS, type ConsentType } from '../constants/legal';
import { ENGINEERING_DISCLAIMER, TERMS_OF_SERVICE, PRIVACY_POLICY } from '../constants/legal';
import consentService from '../services/ConsentService';

interface CheckpointLegalModalProps {
    open: boolean;
    onAccept: () => void;
    onDecline: () => void;
    checkpointType: ConsentType;
    userId?: string;
    canClose?: boolean; // If false, user MUST accept to proceed
}

export const CheckpointLegalModal: FC<CheckpointLegalModalProps> = ({
    open,
    onAccept,
    onDecline,
    checkpointType,
    userId,
    canClose = false
}) => {
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [agreedPrivacy, setAgreedPrivacy] = useState(false);
    const [agreedDisclaimer, setAgreedDisclaimer] = useState(false);
    const [activeTab, setActiveTab] = useState('disclaimer');

    // Get context-specific content
    const getContextContent = () => {
        switch (checkpointType) {
            case 'signup':
                return {
                    title: 'Accept Legal Terms to Create Account',
                    subtitle: 'You must review and accept all agreements before proceeding',
                    icon: AlertTriangle,
                    color: 'text-red-600',
                    bgColor: 'bg-red-50'
                };
            case 'analysis':
                return {
                    title: '⚠️ Engineering Disclaimer',
                    subtitle: 'Important: BeamLab Ultimate is a computational aid only',
                    icon: AlertTriangle,
                    color: 'text-orange-600',
                    bgColor: 'bg-orange-50'
                };
            case 'design':
                return {
                    title: '⚠️ Design Responsibility Acknowledgment',
                    subtitle: 'You are responsible for verifying all design calculations',
                    icon: AlertTriangle,
                    color: 'text-orange-600',
                    bgColor: 'bg-orange-50'
                };
            case 'pdf_export':
                return {
                    title: 'Report Export - Documentation Requirements',
                    subtitle: 'Confirm that your report will clearly document software usage',
                    icon: AlertTriangle,
                    color: 'text-blue-600',
                    bgColor: 'bg-blue-50'
                };
            case 'initial_landing':
                return {
                    title: 'Legal Consent Required',
                    subtitle: 'Please review and accept the legal terms',
                    icon: AlertTriangle,
                    color: 'text-gray-600',
                    bgColor: 'bg-gray-50'
                };
            default:
                return {
                    title: 'Legal Consent Required',
                    subtitle: 'Please review and accept the legal terms',
                    icon: AlertTriangle,
                    color: 'text-gray-600',
                    bgColor: 'bg-gray-50'
                };
        }
    };

    const context = getContextContent();
    const Icon = context.icon;

    const handleAccept = () => {
        const requiredChecks: Record<ConsentType, boolean> = {
            signup: agreedTerms && agreedPrivacy && agreedDisclaimer,
            analysis: agreedDisclaimer,
            design: agreedDisclaimer,
            pdf_export: agreedDisclaimer,
            initial_landing: agreedDisclaimer
        };

        console.log('[CheckpointLegalModal] Accept clicked', { checkpointType, agreedDisclaimer, requiredChecks: requiredChecks[checkpointType] });

        if (!requiredChecks[checkpointType]) {
            alert('Please agree to all required terms to proceed');
            return;
        }

        // Record consent
        if (userId) {
            consentService.recordConsent(userId, checkpointType);
        }

        console.log('[CheckpointLegalModal] Calling onAccept callback');
        onAccept();
    };

    const handleDecline = () => {
        // Clear checked items
        setAgreedTerms(false);
        setAgreedPrivacy(false);
        setAgreedDisclaimer(false);
        onDecline();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
            <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
                {/* Header */}
                <div className={`p-6 pb-4 bg-gradient-to-r ${context.bgColor} border-b`}>
                    <div className="flex items-start gap-3">
                        <Icon className={`w-8 h-8 ${context.color} mt-1 flex-shrink-0`} />
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-gray-900">
                                {context.title}
                            </h2>
                            <p className={`text-base ${context.color} mt-2`}>
                                {context.subtitle}
                            </p>
                        </div>
                        {canClose && (
                            <button
                                onClick={handleDecline}
                                className="p-1 hover:bg-black/10 rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {checkpointType === 'signup' ? (
                        // Multi-tab view for signup
                        <div className="flex flex-col h-full">
                            {/* Tab buttons */}
                            <div className="flex border-b bg-white">
                                <button
                                    onClick={() => setActiveTab('disclaimer')}
                                    className={`flex-1 px-4 py-3 font-medium text-sm transition-colors ${
                                        activeTab === 'disclaimer'
                                            ? 'border-b-2 border-blue-600 text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Disclaimer
                                </button>
                                <button
                                    onClick={() => setActiveTab('terms')}
                                    className={`flex-1 px-4 py-3 font-medium text-sm transition-colors ${
                                        activeTab === 'terms'
                                            ? 'border-b-2 border-blue-600 text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Terms
                                </button>
                                <button
                                    onClick={() => setActiveTab('privacy')}
                                    className={`flex-1 px-4 py-3 font-medium text-sm transition-colors ${
                                        activeTab === 'privacy'
                                            ? 'border-b-2 border-blue-600 text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Privacy
                                </button>
                            </div>

                            {/* Tab content */}
                            <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
                                {activeTab === 'disclaimer' && (
                                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                                        {ENGINEERING_DISCLAIMER}
                                    </div>
                                )}
                                {activeTab === 'terms' && (
                                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                                        {TERMS_OF_SERVICE}
                                    </div>
                                )}
                                {activeTab === 'privacy' && (
                                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                                        {PRIVACY_POLICY}
                                    </div>
                                )}
                            </div>

                            {/* Checkboxes for signup */}
                            <div className="px-6 py-6 border-t bg-white space-y-4">
                                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <input
                                        type="checkbox"
                                        id="terms-check"
                                        className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        checked={agreedTerms}
                                        onChange={(e) => setAgreedTerms(e.target.checked)}
                                    />
                                    <label htmlFor="terms-check" className="text-sm text-gray-700 cursor-pointer flex-1">
                                        I accept the <span className="font-semibold">Terms of Service</span>
                                    </label>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <input
                                        type="checkbox"
                                        id="privacy-check"
                                        className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        checked={agreedPrivacy}
                                        onChange={(e) => setAgreedPrivacy(e.target.checked)}
                                    />
                                    <label htmlFor="privacy-check" className="text-sm text-gray-700 cursor-pointer flex-1">
                                        I accept the <span className="font-semibold">Privacy Policy</span>
                                    </label>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <input
                                        type="checkbox"
                                        id="disclaimer-check"
                                        className="mt-1 w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                        checked={agreedDisclaimer}
                                        onChange={(e) => setAgreedDisclaimer(e.target.checked)}
                                    />
                                    <label htmlFor="disclaimer-check" className="text-sm text-orange-900 cursor-pointer flex-1">
                                        I acknowledge the <span className="font-semibold">Engineering Disclaimer</span> and understand that I am responsible for verifying all calculations
                                    </label>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Single focused view for action checkpoints
                        <>
                            <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
                                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                                    {ENGINEERING_DISCLAIMER}
                                </div>
                            </div>

                            {/* Single checkbox for action checkpoints */}
                            <div className="px-6 py-6 border-t bg-white space-y-4">
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            id="action-disclaimer-check"
                                            className="mt-1 w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                            checked={agreedDisclaimer}
                                            onChange={(e) => setAgreedDisclaimer(e.target.checked)}
                                        />
                                        <label htmlFor="action-disclaimer-check" className="text-sm text-orange-900 cursor-pointer flex-1">
                                            <span className="font-semibold">I acknowledge and accept</span> that I am responsible for independently verifying all structural analysis and design results before using them in professional projects.
                                        </label>
                                    </div>
                                </div>

                                {checkpointType === 'pdf_export' && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-sm text-blue-900">
                                            <span className="font-semibold">Report Documentation:</span> I will clearly document in my project records that this report was generated using BeamLab Ultimate software, including any assumptions and limitations of the analysis.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 px-6 py-6 border-t bg-gray-50">
                    {canClose && (
                        <button
                            onClick={handleDecline}
                            type="button"
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer pointer-events-auto"
                        >
                            Decline & Exit
                        </button>
                    )}
                    <button
                        onClick={handleAccept}
                        type="button"
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center gap-2 cursor-pointer pointer-events-auto"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        I Accept & Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckpointLegalModal;
