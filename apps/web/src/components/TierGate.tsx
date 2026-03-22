/**
 * TierGate - Feature access wrapper component
 *
 * Renders children when the current user has access to the given feature.
 * When access is denied, renders a locked overlay that opens UpgradeModal on click.
 * A custom `fallback` prop overrides the default locked overlay.
 */

import { useState, type ReactNode } from 'react';
import { useSubscription, type SubscriptionFeatures } from '../hooks/useSubscription';
import { UpgradeModal } from './UpgradeModal';

// ============================================
// TYPES
// ============================================

interface TierGateProps {
    /** The feature key to check access for */
    feature: keyof SubscriptionFeatures;
    /** Content to render when access is granted */
    children: ReactNode;
    /** Custom fallback to render when access is denied (overrides default locked overlay) */
    fallback?: ReactNode;
}

const FEATURE_LABELS: Partial<Record<keyof SubscriptionFeatures, string>> = {
    advancedDesignCodes: 'Advanced Design Codes',
    aiAssistant: 'AI Assistant',
    pdfExport: 'PDF Export',
    prioritySupport: 'Priority Support',
    apiAccess: 'API Access',
    teamMembers: 'Team Collaboration',
    collaboration: 'Collaboration',
    maxProjects: 'Projects',
};

const REQUIRED_TIER: Partial<Record<keyof SubscriptionFeatures, 'pro' | 'enterprise'>> = {
    apiAccess: 'enterprise',
    advancedDesignCodes: 'pro',
    aiAssistant: 'pro',
    pdfExport: 'pro',
    prioritySupport: 'pro',
    teamMembers: 'pro',
    collaboration: 'pro',
    maxProjects: 'pro',
};

// ============================================
// LOCKED OVERLAY
// ============================================

interface LockedOverlayProps {
    onClick: () => void;
    feature: keyof SubscriptionFeatures;
}

const LockedOverlay = ({ onClick, feature }: LockedOverlayProps) => {
    const featureLabel = FEATURE_LABELS[feature] ?? 'This feature';
    const requiredTier = REQUIRED_TIER[feature] ?? 'pro';

    return (
    <div
        role="button"
        tabIndex={0}
        aria-label={`Upgrade to ${requiredTier} to access ${featureLabel}`}
        data-gated="true"
        onClick={onClick}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
        className="relative flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-8 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors min-h-[120px]"
    >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/15 text-xl">
            🔒
        </div>
        <div className="text-center">
            <p className="text-sm font-semibold text-slate-700 dark:text-white/80">{featureLabel} · {requiredTier.toUpperCase()} plan</p>
            <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">Upgrade to unlock this workflow</p>
        </div>
    </div>
    );
};

// ============================================
// TIER GATE COMPONENT
// ============================================

export const TierGate = ({ feature, children, fallback }: TierGateProps) => {
    const { canAccess } = useSubscription();
    const [showModal, setShowModal] = useState(false);

    if (canAccess(feature)) {
        return <>{children}</>;
    }

    // Custom fallback overrides the default locked overlay + modal
    if (fallback !== undefined) {
        return <>{fallback}</>;
    }

    return (
        <>
            <LockedOverlay feature={feature} onClick={() => setShowModal(true)} />
            <UpgradeModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                feature={feature as string}
            />
        </>
    );
};

export default TierGate;
