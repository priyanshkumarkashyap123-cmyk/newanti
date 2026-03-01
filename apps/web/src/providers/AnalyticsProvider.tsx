/**
 * AnalyticsProvider.tsx
 *
 * Product analytics tracking for understanding user behavior
 * Tracks key events like signups, feature usage, conversions
 */

import {
  createContext,
  useContext,
  useCallback,
  FC,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { API_CONFIG } from "../config/env";

// ============================================
// ANALYTICS TYPES
// ============================================

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: Date;
  sessionId: string;
  userId?: string;
}

interface AnalyticsContextType {
  track: (eventName: string, properties?: Record<string, any>) => void;
  identify: (userId: string, traits?: Record<string, any>) => void;
  page: (pageName: string, properties?: Record<string, any>) => void;
  trackTiming: (category: string, variable: string, time: number) => void;
}

// ============================================
// EVENT NAMES (Type-safe event catalog)
// ============================================

export const ANALYTICS_EVENTS = {
  // User Journey
  LANDING_PAGE_VIEW: "landing_page_view",
  PRICING_PAGE_VIEW: "pricing_page_view",
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  SIGNIN_COMPLETED: "signin_completed",
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_COMPLETED: "onboarding_completed",
  ONBOARDING_SKIPPED: "onboarding_skipped",

  // Feature Usage
  PROJECT_CREATED: "project_created",
  PROJECT_OPENED: "project_opened",
  PROJECT_DELETED: "project_deleted",
  MODEL_CREATED: "model_created",
  ANALYSIS_RUN: "analysis_run",
  ANALYSIS_COMPLETED: "analysis_completed",
  ANALYSIS_FAILED: "analysis_failed",
  REPORT_GENERATED: "report_generated",
  REPORT_EXPORTED: "report_exported",

  // AI Features
  AI_QUERY_SENT: "ai_query_sent",
  AI_MODEL_GENERATED: "ai_model_generated",
  AI_SUGGESTION_ACCEPTED: "ai_suggestion_accepted",
  AI_SUGGESTION_REJECTED: "ai_suggestion_rejected",

  // Collaboration
  PROJECT_SHARED: "project_shared",
  COMMENT_ADDED: "comment_added",
  TEAM_MEMBER_INVITED: "team_member_invited",

  // Conversion
  TRIAL_STARTED: "trial_started",
  PLAN_SELECTED: "plan_selected",
  CHECKOUT_STARTED: "checkout_started",
  PAYMENT_COMPLETED: "payment_completed",
  PAYMENT_FAILED: "payment_failed",
  SUBSCRIPTION_UPGRADED: "subscription_upgraded",
  SUBSCRIPTION_DOWNGRADED: "subscription_downgraded",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",

  // Engagement
  TOUR_STARTED: "tour_started",
  TOUR_COMPLETED: "tour_completed",
  TOUR_SKIPPED: "tour_skipped",
  HELP_ACCESSED: "help_accessed",
  SUPPORT_CONTACTED: "support_contacted",
  FEEDBACK_SUBMITTED: "feedback_submitted",

  // Error Tracking
  ERROR_OCCURRED: "error_occurred",
  SOLVER_TIMEOUT: "solver_timeout",
  FILE_IMPORT_FAILED: "file_import_failed",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// ============================================
// ANALYTICS CONTEXT
// ============================================

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

// ============================================
// ANALYTICS PROVIDER
// ============================================

interface AnalyticsProviderProps {
  children: ReactNode;
  debug?: boolean;
}

// Generate or retrieve session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem("analytics_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("analytics_session_id", sessionId);
  }
  return sessionId;
};

export const AnalyticsProvider: FC<AnalyticsProviderProps> = ({
  children,
  debug = false,
}) => {
  const sessionId = getSessionId();
  const batchRef = useRef<AnalyticsEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush queued events to the API in a single batch request
  const flushBatch = useCallback(async () => {
    if (batchRef.current.length === 0) return;
    const events = batchRef.current.splice(0, batchRef.current.length);

    try {
      const res = await fetch(`${API_CONFIG.baseUrl}/api/analytics/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
        credentials: "include",
      });
      if (!res.ok && debug) {
        console.warn("[Analytics] Batch flush failed:", res.status);
      }
    } catch {
      // Network error — keep events in localStorage as fallback
      try {
        const stored = JSON.parse(
          localStorage.getItem("analytics_events") || "[]",
        );
        stored.push(...events);
        if (stored.length > 200) stored.splice(0, stored.length - 200);
        localStorage.setItem("analytics_events", JSON.stringify(stored));
      } catch {
        /* quota exceeded — drop silently */
      }
    }
  }, [debug]);

  // Auto-flush every 5 seconds if there are pending events
  useEffect(() => {
    const interval = setInterval(() => {
      flushBatch();
    }, 5000);
    return () => {
      clearInterval(interval);
      flushBatch();
    };
  }, [flushBatch]);

  // Send event to analytics backend
  const sendEvent = useCallback(
    async (event: AnalyticsEvent) => {
      if (debug) {
        console.log("[Analytics]", event.name, event.properties);
      }

      // Queue for batched delivery
      batchRef.current.push(event);

      // Flush immediately if batch is large
      if (batchRef.current.length >= 10) {
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = setTimeout(() => flushBatch(), 100);
      }
    },
    [debug, flushBatch],
  );

  // Track custom event
  const track = useCallback(
    (eventName: string, properties?: Record<string, any>) => {
      const event: AnalyticsEvent = {
        name: eventName,
        properties: {
          ...properties,
          url: window.location.href,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
        },
        timestamp: new Date(),
        sessionId,
        userId: localStorage.getItem("user_id") || undefined,
      };
      sendEvent(event);
    },
    [sessionId, sendEvent],
  );

  // Identify user
  const identify = useCallback(
    (userId: string, traits?: Record<string, any>) => {
      localStorage.setItem("user_id", userId);
      track("user_identified", { userId, ...traits });
    },
    [track],
  );

  // Track page view
  const page = useCallback(
    (pageName: string, properties?: Record<string, any>) => {
      track("page_view", {
        pageName,
        path: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        ...properties,
      });
    },
    [track],
  );

  // Track timing metrics
  const trackTiming = useCallback(
    (category: string, variable: string, time: number) => {
      track("timing", { category, variable, time });
    },
    [track],
  );

  // Track initial page load
  useEffect(() => {
    page(document.title);

    // Track performance timing
    if (window.performance) {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      if (loadTime > 0) {
        trackTiming("page", "load_time", loadTime);
      }
    }
  }, [page, trackTiming]);

  const value: AnalyticsContextType = {
    track,
    identify,
    page,
    trackTiming,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
};

// ============================================
// ANALYTICS HOOK
// ============================================

export const useAnalytics = (): AnalyticsContextType => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    // Return no-op functions if provider not found
    return {
      track: () => {},
      identify: () => {},
      page: () => {},
      trackTiming: () => {},
    };
  }
  return context;
};

// ============================================
// ANALYTICS HELPER HOOKS
// ============================================

/**
 * Track when a component mounts (useful for tracking feature views)
 */
export const useTrackMount = (
  eventName: string,
  properties?: Record<string, unknown>,
) => {
  const { track } = useAnalytics();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      track(eventName, properties);
    }
  }, [track, eventName, properties]);
};

/**
 * Track time spent on a page/component
 */
export const useTrackTimeSpent = (pageName: string) => {
  const { trackTiming } = useAnalytics();

  useEffect(() => {
    const startTime = Date.now();

    return () => {
      const timeSpent = Date.now() - startTime;
      trackTiming("engagement", `time_on_${pageName}`, timeSpent);
    };
  }, [pageName, trackTiming]);
};

/**
 * Track conversion funnel step
 */
export const useFunnelStep = (
  funnelName: string,
  stepName: string,
  stepNumber: number,
) => {
  const { track } = useAnalytics();

  useEffect(() => {
    track("funnel_step", {
      funnel: funnelName,
      step: stepName,
      stepNumber,
    });
  }, [funnelName, stepName, stepNumber, track]);
};

export default AnalyticsProvider;
