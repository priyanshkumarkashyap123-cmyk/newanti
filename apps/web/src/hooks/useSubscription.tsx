/**
 * useSubscription - Subscription status hook
 * Manages user subscription tier and feature access
 */

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { useAuth } from "../providers/AuthProvider";
import { API_CONFIG } from "@/config/env";
import { createLogger } from "../utils/logger";

// ============================================
// MASTER USER ACCESS
// ============================================
// SECURITY: Master user emails are checked ONLY on the backend.
// The backend /api/user/subscription endpoint returns 'enterprise'
// tier for master users. Never hardcode emails client-side — any
// client-side bypass can be exploited by modifying localStorage or spoofing Clerk claims.

// ============================================
// SUBSCRIPTION TYPES
// ============================================

export type SubscriptionTier = "free" | "pro" | "enterprise";

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
    apiAccess: false,
  },
  pro: {
    maxProjects: -1, // unlimited
    pdfExport: true,
    aiAssistant: true,
    advancedDesignCodes: true,
    teamMembers: 5,
    prioritySupport: true,
    apiAccess: false,
  },
  enterprise: {
    maxProjects: -1,
    pdfExport: true,
    aiAssistant: true,
    advancedDesignCodes: true,
    teamMembers: -1, // unlimited
    prioritySupport: true,
    apiAccess: true,
  },
};

// ============================================
// SUBSCRIPTION CONTEXT
// ============================================

interface SubscriptionContextType {
  subscription: SubscriptionStatus;
  canAccess: (feature: keyof SubscriptionStatus["features"]) => boolean;
  requiresUpgrade: (feature: keyof SubscriptionStatus["features"]) => boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);
const subscriptionLogger = createLogger("Subscription");

// ============================================
// SUBSCRIPTION PROVIDER
// ============================================

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider = ({
  children,
}: SubscriptionProviderProps) => {
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    tier: "free",
    isLoading: true,
    expiresAt: null,
    features: TIER_FEATURES.free,
  });

  // Use unified auth hook
  const { isSignedIn, userId, getToken, user } = useAuth();

  const fetchSubscription = useCallback(async (signal?: AbortSignal) => {
    if (!isSignedIn || !userId) {
      setSubscription({
        tier: "free",
        isLoading: false,
        expiresAt: null,
        features: TIER_FEATURES.free,
      });
      return;
    }

    try {
      // Get auth token for API call
      const token = await getToken();

      // Fetch from backend API
      const apiUrl = API_CONFIG.baseUrl;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiUrl}/api/user/subscription`, {
        method: "GET",
        headers,
        credentials: "include",
        signal,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const { tier, features, expiresAt } = result.data;
          // Cache tier in localStorage for quick access on next load
          localStorage.setItem("beamlab_subscription_tier", tier);
          subscriptionLogger.info("Fetched tier from API", { tier, features });
          setSubscription({
            tier: tier as SubscriptionTier,
            isLoading: false,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            features: features || TIER_FEATURES[tier as SubscriptionTier],
          });
          return;
        }
      } else {
        subscriptionLogger.warn("API returned non-OK status", {
          status: response.status,
        });
      }

      // SECURITY: On API failure, always default to 'free' tier.
      // Never trust localStorage for subscription state — it can be
      // modified by the user via DevTools.
      subscriptionLogger.warn('API unavailable, defaulting to free tier');
      setSubscription({
        tier: 'free',
        isLoading: false,
        expiresAt: null,
        features: TIER_FEATURES.free,
      });
    } catch (error) {
      subscriptionLogger.error("Failed to fetch subscription", error);
      // SECURITY: Always default to free tier on error.
      // Never trust localStorage for subscription decisions.
      setSubscription({
        tier: 'free',
        isLoading: false,
        expiresAt: null,
        features: TIER_FEATURES.free,
      });
    }
  }, [isSignedIn, userId, getToken]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        fetchSubscription(controller.signal);
      }
    });
    return () => controller.abort();
  }, [isSignedIn, userId, fetchSubscription]);

  const canAccess = (
    feature: keyof SubscriptionStatus["features"],
  ): boolean => {
    // If still loading and we have a cached tier, use that
    if (subscription.isLoading) {
      const cachedTier = localStorage.getItem(
        "beamlab_subscription_tier",
      ) as SubscriptionTier | null;
      if (cachedTier && cachedTier !== "free") {
        const cachedFeatures = TIER_FEATURES[cachedTier];
        const cachedValue = cachedFeatures[feature];
        if (typeof cachedValue === "boolean") return cachedValue;
        if (typeof cachedValue === "number") return cachedValue !== 0;
      }
      // During loading, default to allowing access to prevent flashing
      return false;
    }
    const value = subscription.features[feature];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    return false;
  };

  const requiresUpgrade = (
    feature: keyof SubscriptionStatus["features"],
  ): boolean => {
    return !canAccess(feature);
  };

  const refreshSubscription = async () => {
    setSubscription((prev) => ({ ...prev, isLoading: true }));
    await fetchSubscription();
  };

  return (
    <SubscriptionContext.Provider
      value={{ subscription, canAccess, requiresUpgrade, refreshSubscription }}
    >
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
        tier: "free",
        isLoading: false,
        expiresAt: null,
        features: TIER_FEATURES.free,
      },
      canAccess: () => false,
      requiresUpgrade: () => true,
      refreshSubscription: async () => {},
    };
  }

  return context;
};

// ============================================
// HELPER: Check if tier has access to feature
// ============================================

export const tierHasFeature = (
  tier: SubscriptionTier,
  feature: keyof SubscriptionStatus["features"],
): boolean => {
  const value = TIER_FEATURES[tier][feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return false;
};

// For demo: Set subscription tier
export const setDemoSubscriptionTier = (tier: SubscriptionTier) => {
  localStorage.setItem("beamlab_subscription_tier", tier);
  window.location.reload();
};
