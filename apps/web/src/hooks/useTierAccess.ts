/**
 * useTierAccess - Hook for accessing user tier information
 *
 * Reads tier and feature access exclusively from SubscriptionContext,
 * eliminating the dual-fetch race condition (Bug Condition C1 root cause 4).
 * No independent /api/user/limits call is made here.
 */

import { useSubscription } from './useSubscription';
import { TIER_CONFIG, type TierName, type TierConfigEntry } from '../config/tierConfig';

// ============================================
// TYPES
// ============================================

export type UserTier = TierName;

export type TierLimits = TierConfigEntry;

/**
 * TIER_LIMITS — backward-compatible re-export of TIER_CONFIG.
 * Existing callers of TIER_LIMITS continue to work without changes.
 */
export const TIER_LIMITS = TIER_CONFIG;

export interface TierAccess {
    tier: UserTier;
    isFree: boolean;
    isPro: boolean;
    isEnterprise: boolean;
    isLoading: boolean;
    limits: TierLimits;
    canAccess: (feature: keyof import('./useSubscription').SubscriptionFeatures) => boolean;
}

// ============================================
// MAIN HOOK
// ============================================

export function useTierAccess(): TierAccess {
    const { subscription, canAccess } = useSubscription();

    const tier = (subscription.tier as UserTier) ?? 'free';
    const limits = TIER_CONFIG[tier] ?? TIER_CONFIG.free;

    return {
        tier,
        isFree: tier === 'free',
        isPro: tier === 'pro' || tier === 'enterprise',
        isEnterprise: tier === 'enterprise',
        isLoading: subscription.isLoading,
        limits,
        canAccess,
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
    const limits = TIER_CONFIG[tier] ?? TIER_CONFIG.free;
    if (limits.maxPdfExportsPerDay === Infinity) {
        return { allowed: true, remaining: Infinity };
    }
    const used = getPdfExportCount();
    const remaining = Math.max(0, limits.maxPdfExportsPerDay - used);
    return {
        allowed: remaining > 0,
        remaining,
        message: remaining === 0 ? `Daily PDF export limit reached (${limits.maxPdfExportsPerDay}/day). Upgrade to Pro for unlimited exports.` : undefined,
    };
}

export default useTierAccess;
