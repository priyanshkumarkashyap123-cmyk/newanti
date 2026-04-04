/**
 * clientTierConfig.ts - Client-Side Subscription Tier Configuration
 *
 * Mirrors the server-side tierConfig shape and derives values from the canonical
 * client-side `tierConfig.ts` source of truth.
 *
 * This avoids drift between multiple tier config definitions.
 */

import { TIER_CONFIG } from './tierConfig';

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
    maxNodes: TIER_CONFIG.free.maxNodes,
    maxMembers: TIER_CONFIG.free.maxMembers,
    maxProjects: TIER_CONFIG.free.maxProjects,
    maxAnalysisPerDay: TIER_CONFIG.free.maxAnalysisPerDay,
    maxPdfExportsPerDay: TIER_CONFIG.free.maxPdfExportsPerDay,
    hasAdvancedAnalysis: TIER_CONFIG.free.hasAdvancedAnalysis,
    hasDesignCodes: TIER_CONFIG.free.hasDesignCodes,
    hasAIFeatures: TIER_CONFIG.free.hasAIFeatures,
    canExportCleanPDF: TIER_CONFIG.free.canExportCleanPDF,
  },
  pro: {
    maxNodes: TIER_CONFIG.pro.maxNodes,
    maxMembers: TIER_CONFIG.pro.maxMembers,
    maxProjects: TIER_CONFIG.pro.maxProjects,
    maxAnalysisPerDay: TIER_CONFIG.pro.maxAnalysisPerDay,
    maxPdfExportsPerDay: TIER_CONFIG.pro.maxPdfExportsPerDay,
    hasAdvancedAnalysis: TIER_CONFIG.pro.hasAdvancedAnalysis,
    hasDesignCodes: TIER_CONFIG.pro.hasDesignCodes,
    hasAIFeatures: TIER_CONFIG.pro.hasAIFeatures,
    canExportCleanPDF: TIER_CONFIG.pro.canExportCleanPDF,
  },
  enterprise: {
    maxNodes: TIER_CONFIG.enterprise.maxNodes,
    maxMembers: TIER_CONFIG.enterprise.maxMembers,
    maxProjects: TIER_CONFIG.enterprise.maxProjects,
    maxAnalysisPerDay: TIER_CONFIG.enterprise.maxAnalysisPerDay,
    maxPdfExportsPerDay: TIER_CONFIG.enterprise.maxPdfExportsPerDay,
    hasAdvancedAnalysis: TIER_CONFIG.enterprise.hasAdvancedAnalysis,
    hasDesignCodes: TIER_CONFIG.enterprise.hasDesignCodes,
    hasAIFeatures: TIER_CONFIG.enterprise.hasAIFeatures,
    canExportCleanPDF: TIER_CONFIG.enterprise.canExportCleanPDF,
  },
} as const;
