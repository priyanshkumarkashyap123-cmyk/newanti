/**
 * tierConfig.ts - Subscription Tier Configuration
 *
 * Server-side authoritative tier limits and feature flags.
 * All quota enforcement and feature gating reads from this constant.
 */

export type Tier = 'free' | 'pro' | 'enterprise';

export interface FeatureFlags {
  collaboration: boolean;
  pdfExport: boolean;
  aiAssistant: boolean;
  advancedDesignCodes: boolean;
  apiAccess: boolean;
}

export interface TierConfig {
  maxProjectsPerDay: number; // Infinity for unlimited
  maxComputeUnitsPerDay: number;
  features: FeatureFlags;
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  free: {
    maxProjectsPerDay: 3,
    maxComputeUnitsPerDay: 5,
    features: {
      collaboration: false,
      pdfExport: false,
      aiAssistant: false,
      advancedDesignCodes: false,
      apiAccess: false,
    },
  },
  pro: {
    maxProjectsPerDay: Infinity,
    maxComputeUnitsPerDay: 100,
    features: {
      collaboration: true,
      pdfExport: true,
      aiAssistant: true,
      advancedDesignCodes: true,
      apiAccess: false,
    },
  },
  enterprise: {
    maxProjectsPerDay: Infinity,
    maxComputeUnitsPerDay: Infinity,
    features: {
      collaboration: true,
      pdfExport: true,
      aiAssistant: true,
      advancedDesignCodes: true,
      apiAccess: true,
    },
  },
};
