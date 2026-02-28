/**
 * UpgradeModal - Premium Upgrade Prompt
 * Shows when user tries to access Pro/Enterprise features on Free tier
 */

import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription, SubscriptionTier } from '../hooks/useSubscription';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';

// ============================================
// FEATURE INFO
// ============================================

interface FeatureInfo {
    title: string;
    description: string;
    icon: string;
    requiredTier: SubscriptionTier;
}

export const PREMIUM_FEATURES: Record<string, FeatureInfo> = {
    pdfExport: {
        title: 'PDF Report Export',
        description: 'Generate professional, branded PDF reports with calculations, diagrams, and design checks.',
        icon: 'picture_as_pdf',
        requiredTier: 'pro'
    },
    aiAssistant: {
        title: 'AI Design Assistant',
        description: 'Get intelligent suggestions for structural design, optimization, and code compliance.',
        icon: 'smart_toy',
        requiredTier: 'pro'
    },
    advancedDesignCodes: {
        title: 'Advanced Design Codes',
        description: 'Access AISC 360, ACI 318, Eurocode, and other international design standards.',
        icon: 'library_books',
        requiredTier: 'pro'
    },
    teamMembers: {
        title: 'Team Collaboration',
        description: 'Invite team members to collaborate on projects in real-time.',
        icon: 'group',
        requiredTier: 'pro'
    },
    apiAccess: {
        title: 'API Access',
        description: 'Integrate BeamLab analysis engine with your own applications and workflows.',
        icon: 'api',
        requiredTier: 'enterprise'
    },
    unlimitedProjects: {
        title: 'Unlimited Projects',
        description: 'Create and manage unlimited structural analysis projects.',
        icon: 'folder_open',
        requiredTier: 'pro'
    }
};

// ============================================
// UPGRADE MODAL PROPS
// ============================================

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    feature?: keyof typeof PREMIUM_FEATURES;
    customTitle?: string;
    customDescription?: string;
}

// ============================================
// UPGRADE MODAL COMPONENT
// ============================================

export const UpgradeModal: FC<UpgradeModalProps> = ({
    isOpen,
    onClose,
    feature,
    customTitle,
    customDescription
}) => {
    const navigate = useNavigate();
    const { subscription } = useSubscription();

    const featureInfo = feature ? PREMIUM_FEATURES[feature] : null;
    const title = customTitle || featureInfo?.title || 'Premium Feature';
    const description = customDescription || featureInfo?.description || 'This feature requires a Pro subscription.';
    const requiredTier = featureInfo?.requiredTier || 'pro';
    const icon = featureInfo?.icon || 'lock';

    const handleUpgrade = () => {
        onClose();
        navigate('/pricing');
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md p-0 overflow-hidden">
                {/* Header with icon */}
                <div className="bg-gradient-to-br from-accent/20 to-accent/5 p-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-accent rounded-2xl flex items-center justify-center text-steel-blue mb-4 shadow-lg">
                        <span className="material-symbols-outlined text-3xl">{icon}</span>
                    </div>

                    <DialogHeader className="space-y-2">
                        <DialogTitle className="text-2xl font-bold text-steel-blue">{title}</DialogTitle>
                        <DialogDescription asChild>
                            <span className="inline-block mt-2 px-3 py-1 bg-steel-blue/10 text-steel-blue text-xs font-bold rounded-full uppercase">
                                {requiredTier === 'enterprise' ? 'Enterprise' : 'Pro'} Feature
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-steel-blue/70 text-center mb-6">
                        {description}
                    </p>

                    {/* Current tier info */}
                    <div className="bg-gray-50 dark:bg-background-dark rounded-lg p-4 mb-6">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-steel-blue/60">Your current plan:</span>
                            <span className="font-bold text-steel-blue capitalize">{subscription.tier}</span>
                        </div>
                    </div>

                    {/* Pro benefits */}
                    <div className="space-y-3 mb-6">
                        <p className="text-xs font-bold text-steel-blue/60 uppercase tracking-wider">Upgrade to Pro and get:</p>
                        {[
                            'Unlimited projects',
                            'PDF report generation',
                            'AI design assistant',
                            'All design codes (IS, AISC, ACI, Eurocode)',
                            'Priority email support'
                        ].map((benefit, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-steel-blue/80">
                                <span className="material-symbols-outlined text-green-500 text-base">check_circle</span>
                                {benefit}
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={handleUpgrade}
                            className="w-full py-3 bg-accent hover:bg-accent/90 text-steel-blue font-bold shadow-md hover:shadow-lg"
                        >
                            <span className="material-symbols-outlined text-xl">rocket_launch</span>
                            Upgrade to Pro - ₹749/mo
                        </Button>
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="w-full py-3"
                        >
                            Maybe Later
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default UpgradeModal;
