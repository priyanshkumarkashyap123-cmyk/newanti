/**
 * tierConfig.ts — Single TIER_CONFIG source of truth (client-side)
 *
 * Merges TIER_FEATURES (from useSubscription.tsx) and TIER_LIMITS
 * (from useTierAccess.ts) into one record keyed by tier.
 *
 * No imports from hook files — avoids circular dependencies.
 * Both useSubscription and useTierAccess read from this file.
 */

export type TierName = 'free' | 'pro' | 'enterprise';

export interface TierConfigEntry {
  // SubscriptionFeatures fields
  maxProjects: number;
  pdfExport: boolean;
  aiAssistant: boolean;
  advancedDesignCodes: boolean;
  teamMembers: number;
  prioritySupport: boolean;
  apiAccess: boolean;
  // TierLimits fields
  maxNodes: number;
  maxMembers: number;
  maxAnalysisPerDay: number;
  maxPdfExportsPerDay: number;
  canSaveProjects: boolean;
  canExportCleanPDF: boolean;
  hasDesignCodes: boolean;
  hasAIFeatures: boolean;
  hasAdvancedAnalysis: boolean;
}

export const TIER_CONFIG: Record<TierName, TierConfigEntry> = {
  free: {
    // Feature flags
    maxProjects: 3,
    pdfExport: false,
    aiAssistant: false,
    advancedDesignCodes: false,
    teamMembers: 1,
    prioritySupport: false,
    apiAccess: false,
    // Numeric limits
    maxNodes: 10,
    maxMembers: 15,
    maxAnalysisPerDay: 3,
    maxPdfExportsPerDay: 1,
    canSaveProjects: false,
    canExportCleanPDF: false,
    hasDesignCodes: false,
    hasAIFeatures: false,
    hasAdvancedAnalysis: false,
  },
  pro: {
    maxProjects: -1, // unlimited
    pdfExport: true,
    aiAssistant: true,
    advancedDesignCodes: true,
    teamMembers: 5,
    prioritySupport: true,
    apiAccess: false,
    maxNodes: Infinity,
    maxMembers: Infinity,
    maxAnalysisPerDay: Infinity,
    maxPdfExportsPerDay: Infinity,
    canSaveProjects: true,
    canExportCleanPDF: true,
    hasDesignCodes: true,
    hasAIFeatures: true,
    hasAdvancedAnalysis: true,
  },
  enterprise: {
    maxProjects: -1,
    pdfExport: true,
    aiAssistant: true,
    advancedDesignCodes: true,
    teamMembers: -1, // unlimited
    prioritySupport: true,
    apiAccess: true,
    maxNodes: Infinity,
    maxMembers: Infinity,
    maxAnalysisPerDay: Infinity,
    maxPdfExportsPerDay: Infinity,
    canSaveProjects: true,
    canExportCleanPDF: true,
    hasDesignCodes: true,
    hasAIFeatures: true,
    hasAdvancedAnalysis: true,
  },
} as const;

/**
 * Derive limits from a tier name — used by useTierAccess for consistency check.
 * Returns the full TierConfigEntry for the given tier.
 */
export function deriveLimitsFromTier(tier: TierName): TierConfigEntry {
  return TIER_CONFIG[tier] ?? TIER_CONFIG.free;
}
