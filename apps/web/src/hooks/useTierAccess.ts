/**
 * useTierAccess - Hook for accessing user tier information
 * Provides tier status and feature limits throughout the app
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';

// ============================================
// TYPES
// ============================================

export type UserTier = 'free' | 'pro' | 'enterprise';

export interface TierLimits {
    maxNodes: number;
    maxMembers: number;
    maxProjects: number;
    maxAnalysisPerDay: number;
    maxPdfExportsPerDay: number;
    canSaveProjects: boolean;
    canExportCleanPDF: boolean;
    hasDesignCodes: boolean;
    hasAIFeatures: boolean;
    hasAdvancedAnalysis: boolean;
}

export interface TierAccess {
    tier: UserTier;
    isFree: boolean;
    isPro: boolean;
    isEnterprise: boolean;
    isMasterUser: boolean;
    isAuthenticated: boolean;
    isLoading: boolean;
    limits: TierLimits;
    userEmail: string | null;
}

// ============================================
// TIER LIMITS CONFIGURATION
// ============================================

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
    free: {
        maxNodes: 10,
        maxMembers: 15,
        maxProjects: 1,
        maxAnalysisPerDay: 3,
        maxPdfExportsPerDay: 1,
        canSaveProjects: false,
        canExportCleanPDF: false,
        hasDesignCodes: false,
        hasAIFeatures: true, // Limited AI
        hasAdvancedAnalysis: false,
    },
    pro: {
        maxNodes: Infinity,
        maxMembers: Infinity,
        maxProjects: 10,
        maxAnalysisPerDay: Infinity,
        maxPdfExportsPerDay: Infinity,
        canSaveProjects: true,
        canExportCleanPDF: true,
        hasDesignCodes: true,
        hasAIFeatures: true,
        hasAdvancedAnalysis: true,
    },
    enterprise: {
        maxNodes: Infinity,
        maxMembers: Infinity,
        maxProjects: Infinity,
        maxAnalysisPerDay: Infinity,
        maxPdfExportsPerDay: Infinity,
        canSaveProjects: true,
        canExportCleanPDF: true,
        hasDesignCodes: true,
        hasAIFeatures: true,
        hasAdvancedAnalysis: true,
    },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get effective tier — tier is exclusively determined by the backend API.
 * No client-side overrides to prevent security bypass.
 */
export function getEffectiveTier(
    _email: string | null | undefined,
    storedTier: UserTier = 'free'
): UserTier {
    return storedTier;
}

// ============================================
// MAIN HOOK
// ============================================

export function useTierAccess(): TierAccess {
    const [tier, setTier] = useState<UserTier>('free');
    const [isLoading, setIsLoading] = useState(true);

    // Use unified auth provider (works with both Clerk and in-house auth)
    const { isSignedIn, user, getToken } = useAuth();

    // Derive auth state from unified auth
    const isAuthenticated = !!isSignedIn;
    const userEmail = user?.email || null;

    useEffect(() => {
        const controller = new AbortController();

        const fetchTier = async () => {
            setIsLoading(true);

            try {
                // Fetch tier exclusively from the backend API.
                // No client-side master-user override — the backend already handles it.
                if (isAuthenticated && userEmail) {
                    try {
                        const token = await getToken();
                        const headers: Record<string, string> = {
                            'Content-Type': 'application/json',
                        };

                        if (token) {
                            headers['Authorization'] = `Bearer ${token}`;
                        }

                        const API_URL = import.meta.env.VITE_API_URL || 'https://api.beamlabultimate.tech';
                        const response = await fetch(`${API_URL}/api/user/tier`, {
                            headers,
                            credentials: 'include',
                            signal: controller.signal,
                        });

                        if (response.ok) {
                            const data = await response.json();
                            // Unwrap API envelope: { success, data: { tier, limits }, requestId, ts }
                            const payload = data?.data ?? data;
                            setTier(payload.tier || 'free');
                        }
                    } catch (err) {
                        if (err instanceof DOMException && err.name === 'AbortError') {
                            return;
                        }
                        // SECURITY: On API failure, always default to 'free'.
                        // Never trust localStorage for tier — it can be modified via DevTools.
                        setTier('free');
                    }
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchTier();
        return () => controller.abort();
    }, [isAuthenticated, userEmail, getToken]);

    const effectiveTier = getEffectiveTier(userEmail, tier);
    const limits = TIER_LIMITS[effectiveTier];

    return {
        tier: effectiveTier,
        isFree: effectiveTier === 'free',
        isPro: effectiveTier === 'pro' || effectiveTier === 'enterprise', // Enterprise includes all Pro features
        isEnterprise: effectiveTier === 'enterprise',
        isMasterUser: false, // Master user status is determined server-side only
        isAuthenticated,
        isLoading,
        limits,
        userEmail,
    };
}

// ============================================
// PDF EXPORT TRACKING (for free tier limits)
// ============================================

const PDF_EXPORT_STORAGE_KEY = 'beamlab_pdf_exports';

interface PdfExportRecord {
    date: string;
    count: number;
}

export function getPdfExportCount(): number {
    try {
        const stored = localStorage.getItem(PDF_EXPORT_STORAGE_KEY);
        if (!stored) return 0;

        const record: PdfExportRecord = JSON.parse(stored);
        const today = new Date().toISOString().split('T')[0];

        if (record.date !== today) {
            // New day - reset count
            return 0;
        }

        return record.count;
    } catch {
        return 0;
    }
}

export function incrementPdfExportCount(): number {
    const today = new Date().toISOString().split('T')[0];
    const currentCount = getPdfExportCount();
    const newCount = currentCount + 1;

    const record: PdfExportRecord = {
        date: today,
        count: newCount,
    };

    localStorage.setItem(PDF_EXPORT_STORAGE_KEY, JSON.stringify(record));
    return newCount;
}

export function canExportPdf(tier: UserTier): { allowed: boolean; remaining: number; message?: string } {
    if (tier !== 'free') {
        return { allowed: true, remaining: Infinity };
    }

    const count = getPdfExportCount();
    const limit = TIER_LIMITS.free.maxPdfExportsPerDay;

    if (count >= limit) {
        return {
            allowed: false,
            remaining: 0,
            message: `Daily PDF limit reached (${limit}/day). Upgrade to Pro for unlimited exports.`,
        };
    }

    return { allowed: true, remaining: limit - count };
}

export default useTierAccess;
