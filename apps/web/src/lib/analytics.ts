/**
 * Analytics & Event Tracking
 * 
 * Industry Standard: Privacy-focused analytics with consent management
 * 
 * Supports:
 * - Google Analytics 4
 * - Custom events
 * - Page views
 * - User properties
 */

import logger from './logger';

// ============================================================================
// Types
// ============================================================================

export interface AnalyticsEvent {
  name: string;
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  properties?: Record<string, unknown>;
}

export interface PageViewData {
  path: string;
  title: string;
  referrer?: string;
}

export interface UserProperties {
  userId?: string;
  userType?: 'free' | 'pro' | 'enterprise';
  plan?: string;
  [key: string]: unknown;
}

export type ConsentCategory = 'analytics' | 'marketing' | 'functional' | 'necessary';

export interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  necessary: boolean; // Always true
}

// ============================================================================
// Consent Management
// ============================================================================

const CONSENT_KEY = 'analytics_consent';
const DEFAULT_CONSENT: ConsentPreferences = {
  analytics: false,
  marketing: false,
  functional: true,
  necessary: true,
};

let currentConsent: ConsentPreferences = { ...DEFAULT_CONSENT };

/**
 * Load consent preferences from storage
 */
function loadConsent(): ConsentPreferences {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONSENT, ...parsed, necessary: true };
    }
  } catch {
    // Ignore
  }
  return { ...DEFAULT_CONSENT };
}

/**
 * Save consent preferences
 */
function saveConsent(consent: ConsentPreferences): void {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // Ignore
  }
}

/**
 * Get current consent preferences
 */
export function getConsent(): ConsentPreferences {
  return { ...currentConsent };
}

/**
 * Update consent preferences
 */
export function updateConsent(preferences: Partial<ConsentPreferences>): void {
  currentConsent = {
    ...currentConsent,
    ...preferences,
    necessary: true, // Always required
  };
  saveConsent(currentConsent);
  
  // Notify analytics providers
  if (currentConsent.analytics) {
    initGoogleAnalytics();
  }
}

/**
 * Check if a category is consented
 */
export function hasConsent(category: ConsentCategory): boolean {
  return currentConsent[category];
}

/**
 * Reset consent (for testing/opt-out)
 */
export function resetConsent(): void {
  currentConsent = { ...DEFAULT_CONSENT };
  localStorage.removeItem(CONSENT_KEY);
}

// ============================================================================
// Google Analytics Integration
// ============================================================================

// Note: Window.gtag type is declared in utils/performance.ts

let gaInitialized = false;

/**
 * Initialize Google Analytics
 */
export function initGoogleAnalytics(): void {
  if (gaInitialized) return;
  if (!hasConsent('analytics')) return;
  
  const trackingId = import.meta.env.VITE_GA_TRACKING_ID;
  if (!trackingId) return;

  // Load GA script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
  document.head.appendChild(script);

  // Initialize dataLayer
  (window as { dataLayer?: unknown[] }).dataLayer = (window as { dataLayer?: unknown[] }).dataLayer || [];
  
   
  const w = window as any;
  w.gtag = function gtag(...args: unknown[]) {
    w.dataLayer?.push(args);
  };

  w.gtag('js', new Date());
  w.gtag('config', trackingId, {
    anonymize_ip: true,
    cookie_flags: 'SameSite=None;Secure',
  });

  gaInitialized = true;
}

// ============================================================================
// Event Tracking
// ============================================================================

const eventQueue: AnalyticsEvent[] = [];
let isProcessingQueue = false;

/**
 * Track a custom event
 */
export function trackEvent(event: AnalyticsEvent): void {
  if (!hasConsent('analytics')) {
    // Queue for later if consent is pending
    eventQueue.push(event);
    return;
  }

  // Send to GA4
   
  const gtag = (window as any).gtag;
  if (gtag) {
    gtag('event', event.name, {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
      ...event.properties,
    });
  }

  // Log in development
  if (import.meta.env.DEV) {
    logger.log('📊 Analytics Event:', event);
  }
}

/**
 * Track page view
 */
export function trackPageView(data: PageViewData): void {
  if (!hasConsent('analytics')) return;

   
  const gtag = (window as any).gtag;
  if (gtag) {
    gtag('event', 'page_view', {
      page_path: data.path,
      page_title: data.title,
      page_referrer: data.referrer,
    });
  }

  if (import.meta.env.DEV) {
    logger.log('📊 Page View:', data);
  }
}

/**
 * Set user properties
 */
export function setUserProperties(properties: UserProperties): void {
  if (!hasConsent('analytics')) return;

   
  const gtag = (window as any).gtag;
  if (gtag) {
    gtag('set', 'user_properties', properties);
    
    if (properties.userId) {
      gtag('config', import.meta.env.VITE_GA_TRACKING_ID, {
        user_id: properties.userId,
      });
    }
  }
}

/**
 * Process queued events after consent
 */
export function processEventQueue(): void {
  if (isProcessingQueue || !hasConsent('analytics')) return;
  
  isProcessingQueue = true;
  
  while (eventQueue.length > 0) {
    const event = eventQueue.shift();
    if (event) {
      trackEvent(event);
    }
  }
  
  isProcessingQueue = false;
}

// ============================================================================
// Common Events
// ============================================================================

export const analytics = {
  // User events
  userSignUp: (method: string) =>
    trackEvent({ name: 'sign_up', category: 'engagement', properties: { method } }),
  
  userSignIn: (method: string) =>
    trackEvent({ name: 'login', category: 'engagement', properties: { method } }),
  
  userSignOut: () =>
    trackEvent({ name: 'sign_out', category: 'engagement' }),

  // Project events
  projectCreated: (projectType?: string) =>
    trackEvent({ name: 'project_created', category: 'projects', properties: { projectType } }),
  
  projectOpened: (projectId: string) =>
    trackEvent({ name: 'project_opened', category: 'projects', properties: { projectId } }),
  
  projectSaved: (projectId: string) =>
    trackEvent({ name: 'project_saved', category: 'projects', properties: { projectId } }),

  // Analysis events
  analysisStarted: (analysisType: string) =>
    trackEvent({ name: 'analysis_started', category: 'analysis', properties: { analysisType } }),
  
  analysisCompleted: (analysisType: string, duration: number) =>
    trackEvent({
      name: 'analysis_completed',
      category: 'analysis',
      value: duration,
      properties: { analysisType, duration },
    }),
  
  analysisError: (analysisType: string, error: string) =>
    trackEvent({ name: 'analysis_error', category: 'analysis', properties: { analysisType, error } }),

  // Export events
  reportGenerated: (format: string) =>
    trackEvent({ name: 'report_generated', category: 'export', properties: { format } }),
  
  dataExported: (format: string) =>
    trackEvent({ name: 'data_exported', category: 'export', properties: { format } }),

  // Feature usage
  featureUsed: (featureName: string) =>
    trackEvent({ name: 'feature_used', category: 'features', properties: { featureName } }),
  
  aiAssistantUsed: (action: string) =>
    trackEvent({ name: 'ai_assistant_used', category: 'ai', properties: { action } }),

  // Errors
  errorOccurred: (errorType: string, errorMessage: string) =>
    trackEvent({ name: 'error', category: 'errors', properties: { errorType, errorMessage } }),

  // Performance
  pageLoadTime: (path: string, duration: number) =>
    trackEvent({ name: 'page_load_time', category: 'performance', value: duration, properties: { path } }),
  
  apiLatency: (endpoint: string, duration: number) =>
    trackEvent({ name: 'api_latency', category: 'performance', value: duration, properties: { endpoint } }),
};

// ============================================================================
// React Integration
// ============================================================================

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to track page views on route change
 */
export function usePageTracking(): void {
  const location = useLocation();

  useEffect(() => {
    trackPageView({
      path: location.pathname + location.search,
      title: document.title,
      referrer: document.referrer,
    });
  }, [location]);
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize analytics
 */
export function initAnalytics(): void {
  // Load consent preferences
  currentConsent = loadConsent();

  // Initialize GA if consented
  if (currentConsent.analytics) {
    initGoogleAnalytics();
    processEventQueue();
  }
}
