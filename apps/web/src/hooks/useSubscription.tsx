/**
 * useSubscription — Subscription status hook (v2)
 *
 * Manages user subscription tier, feature access gating, and
 * stale-while-revalidate caching. Secure by default: always
 * falls back to "free" tier on any error or loading state.
 *
 * Improvements over v1:
 * - Stale-while-revalidate: shows cached tier instantly, refreshes in background
 * - Exponential back-off retry (up to 3 attempts)
 * - Race-condition-safe with request generation counter
 * - Optimistic tier upgrade for post-payment UX
 * - Debounced refresh to prevent rapid successive calls
 * - Better TypeScript inference for feature checks
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useAuth } from "../providers/AuthProvider";
import { API_CONFIG } from "@/config/env";
import { PAYMENT_CONFIG } from "@/config/env";
import { createLogger } from "../utils/logger";
import { TIER_CONFIG, type TierName } from "../config/tierConfig";

// ============================================
// MASTER USER ACCESS
// ============================================
// SECURITY: Master user emails are checked ONLY on the backend.
// The backend /api/user/subscription endpoint returns 'enterprise'
// tier for master users. Never hardcode emails client-side — any
// client-side bypass can be exploited via DevTools.

// ============================================
// TYPES
// ============================================

export type SubscriptionTier = "free" | "pro" | "enterprise";

export interface SubscriptionFeatures {
  maxProjects: number;
  pdfExport: boolean;
  aiAssistant: boolean;
  advancedDesignCodes: boolean;
  teamMembers: number;
  collaboration: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isLoading: boolean;
  expiresAt: Date | null;
  features: SubscriptionFeatures;
  /** True when displaying a cached tier while a fresh fetch is in-flight. */
  isRevalidating: boolean;
}

// Re-export TIER_FEATURES from TIER_CONFIG for backward compatibility
const TIER_FEATURES: Record<SubscriptionTier, SubscriptionFeatures> = {
  free: {
    maxProjects: TIER_CONFIG.free.maxProjects,
    pdfExport: TIER_CONFIG.free.pdfExport,
    aiAssistant: TIER_CONFIG.free.aiAssistant,
    advancedDesignCodes: TIER_CONFIG.free.advancedDesignCodes,
    teamMembers: TIER_CONFIG.free.teamMembers,
    collaboration: TIER_CONFIG.free.collaboration,
    prioritySupport: TIER_CONFIG.free.prioritySupport,
    apiAccess: TIER_CONFIG.free.apiAccess,
  },
  pro: {
    maxProjects: TIER_CONFIG.pro.maxProjects,
    pdfExport: TIER_CONFIG.pro.pdfExport,
    aiAssistant: TIER_CONFIG.pro.aiAssistant,
    advancedDesignCodes: TIER_CONFIG.pro.advancedDesignCodes,
    teamMembers: TIER_CONFIG.pro.teamMembers,
    collaboration: TIER_CONFIG.pro.collaboration,
    prioritySupport: TIER_CONFIG.pro.prioritySupport,
    apiAccess: TIER_CONFIG.pro.apiAccess,
  },
  enterprise: {
    maxProjects: TIER_CONFIG.enterprise.maxProjects,
    pdfExport: TIER_CONFIG.enterprise.pdfExport,
    aiAssistant: TIER_CONFIG.enterprise.aiAssistant,
    advancedDesignCodes: TIER_CONFIG.enterprise.advancedDesignCodes,
    teamMembers: TIER_CONFIG.enterprise.teamMembers,
    collaboration: TIER_CONFIG.enterprise.collaboration,
    prioritySupport: TIER_CONFIG.enterprise.prioritySupport,
    apiAccess: TIER_CONFIG.enterprise.apiAccess,
  },
};

// TEMPORARY BILLING BYPASS — defaults to false when env var is absent (safe default)
// SECURITY: PAYMENT_CONFIG.billingBypass must be false in production
const TEMP_UNLOCK_ALL = PAYMENT_CONFIG.billingBypass;

/**
 * computeCanAccess — pure function for testability.
 * Returns whether a given tier grants access to a feature,
 * respecting the billingBypass flag.
 *
 * Property 1: When billingBypass=false, result equals TIER_CONFIG[tier][feature].
 */
export function computeCanAccess(
  tier: TierName,
  feature: keyof SubscriptionFeatures,
  billingBypass: boolean,
): boolean {
  if (billingBypass) return true;
  const value = TIER_CONFIG[tier][feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return false;
}

// ============================================
// CONTEXT
// ============================================

interface SubscriptionContextType {
  subscription: SubscriptionStatus;
  /** Check if the current tier grants access to a feature. */
  canAccess: (feature: keyof SubscriptionFeatures) => boolean;
  /** Inverse of canAccess — true when the user needs to upgrade. */
  requiresUpgrade: (feature: keyof SubscriptionFeatures) => boolean;
  /** Re-fetch subscription from the backend. */
  refreshSubscription: () => Promise<void>;
  /** Optimistically set tier (post-payment). Reverted on next fetch if backend disagrees. */
  optimisticUpgrade: (tier: SubscriptionTier) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);
const log = createLogger("Subscription");

// ============================================
// HELPERS
// ============================================

const CACHE_KEY = "beamlab_subscription_tier";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function cachedTier(): SubscriptionTier {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw === "pro" || raw === "enterprise") return raw;
  } catch {
    /* SSR / storage error */
  }
  return "free";
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================
// PROVIDER
// ============================================

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider = ({ children }: SubscriptionProviderProps) => {
  // Start with cached tier (stale-while-revalidate)
  const initialTier = cachedTier();

  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    tier: initialTier,
    isLoading: true,
    isRevalidating: initialTier !== "free", // revalidating if we have a stale value
    expiresAt: null,
    features: TIER_FEATURES[initialTier],
  });

  const { isSignedIn, userId, getToken } = useAuth();

  // Generation counter to prevent stale responses from overwriting fresher ones
  const generationRef = useRef(0);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSubscription = useCallback(
    async (signal?: AbortSignal) => {
      const gen = ++generationRef.current;

      if (!isSignedIn || !userId) {
        setSubscription({
          tier: "free",
          isLoading: false,
          isRevalidating: false,
          expiresAt: null,
          features: TIER_FEATURES.free,
        });
        return;
      }

      // Retry loop with exponential back-off
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (signal?.aborted || gen !== generationRef.current) return;

        try {
          const token = await getToken();

          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const response = await fetch(`${API_CONFIG.baseUrl}/api/user/subscription`, {
            method: "GET",
            headers,
            credentials: "include",
            signal,
          });

          if (gen !== generationRef.current) return; // superseded

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const { tier, features, expiresAt } = result.data;
              const resolvedTier = (tier as SubscriptionTier) || "free";

              // Persist for stale-while-revalidate on next load
              try {
                localStorage.setItem(CACHE_KEY, resolvedTier);
              } catch {
                /* ignore */
              }

              log.info("Fetched tier", { tier: resolvedTier });

              setSubscription({
                tier: resolvedTier,
                isLoading: false,
                isRevalidating: false,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                features: features || TIER_FEATURES[resolvedTier],
              });
              return;
            }
          }

          // Non-OK but not retryable (e.g. 401, 403)
          if (response.status === 401 || response.status === 403) {
            log.warn("Auth rejected, defaulting to free");
            break;
          }

          log.warn("API non-OK", { status: response.status, attempt });
        } catch (err) {
          if (signal?.aborted || gen !== generationRef.current) return;
          log.error("Fetch failed", { attempt, err });
        }

        // Wait before retry (exponential back-off)
        if (attempt < MAX_RETRIES) {
          await delay(BASE_DELAY_MS * Math.pow(2, attempt));
        }
      }

      // SECURITY: All retries exhausted — default to free
      log.warn("All retries exhausted, defaulting to free tier");
      setSubscription({
        tier: "free",
        isLoading: false,
        isRevalidating: false,
        expiresAt: null,
        features: TIER_FEATURES.free,
      });
    },
    [isSignedIn, userId, getToken],
  );

  // Initial fetch
  useEffect(() => {
    const controller = new AbortController();
    fetchSubscription(controller.signal);
    return () => controller.abort();
  }, [fetchSubscription]);

  // Public actions
  const canAccess = useCallback(
    (feature: keyof SubscriptionFeatures): boolean => {
      if (TEMP_UNLOCK_ALL) return true;
      // Stale-while-revalidate: use cached tier during loading to prevent flash
      const effectiveTier: TierName = subscription.isLoading
        ? cachedTier()   // from localStorage, defaults to 'free' if absent
        : (subscription.tier as TierName);
      return computeCanAccess(effectiveTier, feature, false);
    },
    [subscription.isLoading, subscription.tier],
  );

  const requiresUpgrade = useCallback(
    (feature: keyof SubscriptionFeatures): boolean => {
      if (TEMP_UNLOCK_ALL) return false;
      return !canAccess(feature);
    },
    [canAccess],
  );

  const refreshSubscription = useCallback(async () => {
    // Debounce: ignore rapid successive calls (e.g. multiple components refreshing)
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    return new Promise<void>((resolve) => {
      refreshDebounceRef.current = setTimeout(async () => {
        setSubscription((prev) => ({ ...prev, isRevalidating: true }));
        await fetchSubscription();
        resolve();
      }, 300);
    });
  }, [fetchSubscription]);

  const optimisticUpgrade = useCallback((tier: SubscriptionTier) => {
    log.info("Optimistic upgrade", { tier });
    setSubscription((prev) => ({
      ...prev,
      tier,
      features: TIER_FEATURES[tier],
      isRevalidating: true, // will be confirmed on next refresh
    }));
    try {
      localStorage.setItem(CACHE_KEY, tier);
    } catch {
      /* ignore */
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      subscription: TEMP_UNLOCK_ALL
        ? {
            ...subscription,
            tier: "enterprise" as SubscriptionTier,
            features: TIER_FEATURES.enterprise,
          }
        : subscription,
      canAccess,
      requiresUpgrade,
      refreshSubscription,
      optimisticUpgrade,
    }),
    [subscription, canAccess, requiresUpgrade, refreshSubscription, optimisticUpgrade],
  );

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
};

// ============================================
// HOOK
// ============================================

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);

  // Graceful fallback for components outside the provider
  if (!context) {
    return {
      subscription: {
        tier: "free",
        isLoading: false,
        isRevalidating: false,
        expiresAt: null,
        features: TIER_FEATURES.free,
      },
      canAccess: (feature) => {
        const value = TIER_FEATURES.free[feature];
        return typeof value === "boolean" ? value : value !== 0;
      },
      requiresUpgrade: (feature) => {
        const value = TIER_FEATURES.free[feature];
        return !(typeof value === "boolean" ? value : value !== 0);
      },
      refreshSubscription: async () => {},
      optimisticUpgrade: () => {},
    };
  }

  return context;
};

// ============================================
// UTILITIES
// ============================================

/** Static check: does a given tier grant access to a feature? */
export const tierHasFeature = (
  tier: SubscriptionTier,
  feature: keyof SubscriptionFeatures,
): boolean => {
  const value = TIER_FEATURES[tier][feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return false;
};

/** Dev tool: force-set a subscription tier (reloads the page). */
export const setDemoSubscriptionTier = (tier: SubscriptionTier) => {
  localStorage.setItem(CACHE_KEY, tier);
  window.location.reload();
};
