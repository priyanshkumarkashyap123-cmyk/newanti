/**
 * useSubscription — SubscriptionProvider + useSubscription hook
 *
 * Fetches /api/subscription and /api/user/quota in parallel on mount.
 * Serves cached tier from localStorage during loading to prevent layout shift.
 * Requirements: 6.2, 6.4, 7.1, 7.2, 7.3, 7.6
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Tier = 'free' | 'pro' | 'enterprise';

export interface FeatureFlags {
    collaboration: boolean;
    pdfExport: boolean;
    aiAssistant: boolean;
    advancedDesignCodes: boolean;
    apiAccess: boolean;
}

export interface TierFeatures {
    maxProjectsPerDay: number | null; // null = unlimited
    maxComputeUnitsPerDay: number | null;
    features: FeatureFlags;
}

export interface QuotaState {
    projectsRemaining: number | null;
    computeUnitsRemaining: number | null;
    projectsCreated: number;
    computeUnitsUsed: number;
    localComputeAvailable: boolean;
}

export interface SubscriptionContextValue {
    tier: Tier;
    features: TierFeatures | null;
    quota: QuotaState | null;
    webGpuAvailable: boolean;
    isLoading: boolean;
    canAccess: (feature: keyof FeatureFlags) => boolean;
    refreshTier: () => Promise<void>;
}

const TIER_CACHE_KEY = 'beamlab:tier-cache';

const defaultContext: SubscriptionContextValue = {
    tier: 'free',
    features: null,
    quota: null,
    webGpuAvailable: false,
    isLoading: true,
    canAccess: () => false,
    refreshTier: async () => {},
};

const SubscriptionContext = createContext<SubscriptionContextValue>(defaultContext);

function getCachedTier(): Tier {
    try {
        const cached = localStorage.getItem(TIER_CACHE_KEY);
        if (cached === 'pro' || cached === 'enterprise') return cached;
    } catch { /* SSR or storage unavailable */ }
    return 'free';
}

function setCachedTier(tier: Tier): void {
    try {
        localStorage.setItem(TIER_CACHE_KEY, tier);
    } catch { /* storage unavailable */ }
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }): React.ReactElement {
    const [tier, setTier] = useState<Tier>(getCachedTier);
    const [features, setFeatures] = useState<TierFeatures | null>(null);
    const [quota, setQuota] = useState<QuotaState | null>(null);
    const [webGpuAvailable, setWebGpuAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [subRes, quotaRes] = await Promise.all([
                fetch('/api/subscription'),
                fetch('/api/user/quota'),
            ]);

            if (subRes.ok) {
                const subJson = await subRes.json();
                const data = subJson.data ?? subJson;
                const newTier: Tier = data.tier ?? 'free';
                setTier(newTier);
                setCachedTier(newTier);
                setFeatures(data.features ?? null);
            }

            if (quotaRes.ok) {
                const quotaJson = await quotaRes.json();
                const qData = quotaJson.data ?? quotaJson;
                setQuota({
                    projectsRemaining: qData.projectsRemaining ?? null,
                    computeUnitsRemaining: qData.computeUnitsRemaining ?? null,
                    projectsCreated: qData.projectsCreated ?? 0,
                    computeUnitsUsed: qData.computeUnitsUsed ?? 0,
                    localComputeAvailable: qData.localComputeAvailable ?? false,
                });
            }
        } catch { /* network error — keep cached tier */ }
        finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const canAccess = useCallback((feature: keyof FeatureFlags): boolean => {
        return features?.features?.[feature] ?? false;
    }, [features]);

    const refreshTier = useCallback(async () => {
        await fetchData();
    }, [fetchData]);

    const value: SubscriptionContextValue = {
        tier, features, quota, webGpuAvailable, isLoading, canAccess, refreshTier,
    };

    return React.createElement(SubscriptionContext.Provider, { value }, children);
}

export function useSubscription(): SubscriptionContextValue {
    return useContext(SubscriptionContext);
}
