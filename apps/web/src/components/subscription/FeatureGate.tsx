/**
 * FeatureGate — renders children only when the user has access to a feature.
 * Shows an upgrade prompt when the feature is gated.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import React, { useState } from 'react';
import { useSubscription, type SubscriptionFeatures } from '../../hooks/useSubscription';

interface FeatureGateProps {
    feature: keyof SubscriptionFeatures;
    children: React.ReactNode;
    /** Optional fallback instead of the default upgrade prompt */
    fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps): React.ReactElement {
    const { canAccess, subscription } = useSubscription();

    if (subscription.isLoading) return React.createElement(React.Fragment, null);

    if (!canAccess(feature)) {
        return React.createElement(
            React.Fragment,
            null,
            fallback ?? React.createElement(UpgradePrompt, { feature })
        );
    }

    return React.createElement(React.Fragment, null, children);
}

interface UpgradePromptProps {
    feature: keyof SubscriptionFeatures;
}

function UpgradePrompt({ feature }: UpgradePromptProps): React.ReactElement {
    const [dismissed, setDismissed] = useState(false);

    const labels: Record<string, string> = {
        collaboration: 'Collaboration',
        pdfExport: 'PDF Export',
        aiAssistant: 'AI Assistant',
        advancedDesignCodes: 'Advanced Design Codes',
        apiAccess: 'API Access',
    };

    if (dismissed) return React.createElement(React.Fragment, null);

    return React.createElement(
        'div',
        {
            role: 'alert',
            'aria-label': `${labels[feature]} requires an upgrade`,
            style: {
                padding: '12px 16px',
                background: '#1e1e2e',
                border: '1px solid #444',
                borderRadius: 8,
                color: '#ccc',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
            },
        },
        React.createElement('span', null, `${labels[feature]} is not available on your current plan.`),
        React.createElement(
            'button',
            {
                onClick: () => setDismissed(true),
                'aria-label': 'Dismiss',
                style: { marginLeft: 'auto', background: 'none', border: 'none', color: '#888', cursor: 'pointer' },
            },
            '✕'
        )
    );
}
