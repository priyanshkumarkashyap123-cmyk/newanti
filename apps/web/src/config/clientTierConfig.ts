/**
 * clientTierConfig.ts - Client-Side Subscription Tier Configuration
 *
 * Mirrors the server-side tierConfig shape but is standalone — no imports from apps/api.
 * Used by useTierAccess and TierGate to enforce feature gating on the client.
 */

export type ClientTier = 'free' | 'pro' | 'enterprise';

export interface ClientTierLimits {
  maxNodes: number;
  maxMembers: number;
  maxProjects: number;
  maxAnalysisPerDay: number;
  maxPdfExportsPerDay: number;
  hasAdvancedAnalysis: boolean;
  hasDesignCodes: boolean;
  hasAIFeatures: boolean;
  canExportCleanPDF: boolean;
}

export const CLIENT_TIER_CONFIG: Record<ClientTier, ClientTierLimits> = {
  free: {
    maxNodes: 10,
    maxMembers: 15,
    maxProjects: 3,
    maxAnalysisPerDay: 3,
    maxPdfExportsPerDay: 1,
    hasAdvancedAnalysis: false,
    hasDesignCodes: false,
    hasAIFeatures: false,
    canExportCleanPDF: false,
  },
  pro: {
    maxNodes: Infinity,
    maxMembers: Infinity,
    maxProjects: Infinity,
    maxAnalysisPerDay: Infinity,
    maxPdfExportsPerDay: Infinity,
    hasAdvancedAnalysis: true,
    hasDesignCodes: true,
    hasAIFeatures: true,
    canExportCleanPDF: true,
  },
  enterprise: {
    maxNodes: Infinity,
    maxMembers: Infinity,
    maxProjects: Infinity,
    maxAnalysisPerDay: Infinity,
    maxPdfExportsPerDay: Infinity,
    hasAdvancedAnalysis: true,
    hasDesignCodes: true,
    hasAIFeatures: true,
    canExportCleanPDF: true,
  },
} as const;
