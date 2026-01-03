/**
 * useTierAccess - Hook for accessing user tier information
 * Provides tier status and feature limits throughout the app
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { MASTER_EMAILS } from '../constants/masterUsers';

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
 * Check if email belongs to a master user
 */
export function isMasterUserEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return MASTER_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Get effective tier for a user (master users get enterprise)
 */
export function getEffectiveTier(
    email: string | null | undefined,
    storedTier: UserTier = 'free'
): UserTier {
    if (isMasterUserEmail(email)) {
        return 'enterprise';
    }
    return storedTier;
}

// ============================================
// MAIN HOOK
// ============================================

export function useTierAccess(): TierAccess {
    const [tier, setTier] = useState<UserTier>('free');
    const [isLoading, setIsLoading] = useState(true);

    // Use unified auth provider (works with both Clerk and in-house auth)
    const { isSignedIn, user } = useAuth();
    
    // Derive auth state from unified auth
    const isAuthenticated = !!isSignedIn;
    const userEmail = user?.email || null;

    useEffect(() => {
        const fetchTier = async () => {
            setIsLoading(true);

            try {
                // Check if master user
                if (isMasterUserEmail(userEmail)) {
                    setTier('enterprise');
                    setIsLoading(false);
                    return;
                }

                // Try to fetch tier from API
                if (isAuthenticated && userEmail) {
                    try {
                        const API_URL = import.meta.env.VITE_API_URL || 'https://api.beamlabultimate.tech';
                        const response = await fetch(`${API_URL}/api/user/tier`, {
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            credentials: 'include',
                        });

                        if (response.ok) {
                            const data = await response.json();
                            setTier(data.tier || 'free');
                        }
                    } catch {
                        // API not available - use localStorage cache
                        const cachedTier = localStorage.getItem('beamlab_user_tier');
                        if (cachedTier && ['free', 'pro', 'enterprise'].includes(cachedTier)) {
                            setTier(cachedTier as UserTier);
                        }
                    }
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchTier();
    }, [isAuthenticated, userEmail]);

    const effectiveTier = getEffectiveTier(userEmail, tier);
    const limits = TIER_LIMITS[effectiveTier];

    return {
        tier: effectiveTier,
        isFree: effectiveTier === 'free',
        isPro: effectiveTier === 'pro',
        isEnterprise: effectiveTier === 'enterprise',
        isMasterUser: isMasterUserEmail(userEmail),
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
