/**
 * useSubscription - Subscription status hook
 * Manages user subscription tier and feature access
 */

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';

// ============================================
// SUBSCRIPTION TYPES
// ============================================

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface SubscriptionStatus {
    tier: SubscriptionTier;
    isLoading: boolean;
    expiresAt: Date | null;
    features: {
        maxProjects: number;
        pdfExport: boolean;
        aiAssistant: boolean;
        advancedDesignCodes: boolean;
        teamMembers: number;
        prioritySupport: boolean;
        apiAccess: boolean;
    };
}

// Feature limits by tier
const TIER_FEATURES = {
    free: {
        maxProjects: 3,
        pdfExport: false,
        aiAssistant: false,
        advancedDesignCodes: false,
        teamMembers: 1,
        prioritySupport: false,
        apiAccess: false
    },
    pro: {
        maxProjects: -1, // unlimited
        pdfExport: true,
        aiAssistant: true,
        advancedDesignCodes: true,
        teamMembers: 5,
        prioritySupport: true,
        apiAccess: false
    },
    enterprise: {
        maxProjects: -1,
        pdfExport: true,
        aiAssistant: true,
        advancedDesignCodes: true,
        teamMembers: -1, // unlimited
        prioritySupport: true,
        apiAccess: true
    }
};

// ============================================
// SUBSCRIPTION CONTEXT
// ============================================

interface SubscriptionContextType {
    subscription: SubscriptionStatus;
    canAccess: (feature: keyof SubscriptionStatus['features']) => boolean;
    requiresUpgrade: (feature: keyof SubscriptionStatus['features']) => boolean;
    refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

// ============================================
// SUBSCRIPTION PROVIDER
// ============================================

interface SubscriptionProviderProps {
    children: ReactNode;
}

export const SubscriptionProvider = ({ children }: SubscriptionProviderProps) => {
    const [subscription, setSubscription] = useState<SubscriptionStatus>({
        tier: 'free',
        isLoading: true,
        expiresAt: null,
        features: TIER_FEATURES.free
    });

    // Handle Clerk auth gracefully
    let isSignedIn = false;
    let userId: string | null = null;
    try {
        const auth = useAuth();
        isSignedIn = auth.isSignedIn ?? false;
        userId = auth.userId ?? null;
    } catch {
        // Not in ClerkProvider
    }

    const fetchSubscription = async () => {
        if (!isSignedIn || !userId) {
            setSubscription({
                tier: 'free',
                isLoading: false,
                expiresAt: null,
                features: TIER_FEATURES.free
            });
            return;
        }

        try {
            // For now, return free tier - replace with actual API call when backend is ready
            // const response = await fetch(`/api/subscription/${userId}`);
            // const data = await response.json();

            // Mock: Check localStorage for demo purposes
            const savedTier = localStorage.getItem('beamlab_subscription_tier') as SubscriptionTier | null;
            const tier = savedTier || 'free';

            setSubscription({
                tier,
                isLoading: false,
                expiresAt: tier !== 'free' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
                features: TIER_FEATURES[tier]
            });
        } catch (error) {
            console.error('Failed to fetch subscription:', error);
            setSubscription(prev => ({ ...prev, isLoading: false }));
        }
    };

    useEffect(() => {
        fetchSubscription();
    }, [isSignedIn, userId]);

    const canAccess = (feature: keyof SubscriptionStatus['features']): boolean => {
        const value = subscription.features[feature];
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        return false;
    };

    const requiresUpgrade = (feature: keyof SubscriptionStatus['features']): boolean => {
        return !canAccess(feature);
    };

    const refreshSubscription = async () => {
        setSubscription(prev => ({ ...prev, isLoading: true }));
        await fetchSubscription();
    };

    return (
        <SubscriptionContext.Provider value={{ subscription, canAccess, requiresUpgrade, refreshSubscription }}>
            {children}
        </SubscriptionContext.Provider>
    );
};

// ============================================
// HOOK
// ============================================

export const useSubscription = (): SubscriptionContextType => {
    const context = useContext(SubscriptionContext);

    // Return default values if not in provider (for components outside the provider)
    if (!context) {
        return {
            subscription: {
                tier: 'free',
                isLoading: false,
                expiresAt: null,
                features: TIER_FEATURES.free
            },
            canAccess: () => false,
            requiresUpgrade: () => true,
            refreshSubscription: async () => { }
        };
    }

    return context;
};

// ============================================
// HELPER: Check if tier has access to feature
// ============================================

export const tierHasFeature = (tier: SubscriptionTier, feature: keyof SubscriptionStatus['features']): boolean => {
    const value = TIER_FEATURES[tier][feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return false;
};

// For demo: Set subscription tier
export const setDemoSubscriptionTier = (tier: SubscriptionTier) => {
    localStorage.setItem('beamlab_subscription_tier', tier);
    window.location.reload();
};
