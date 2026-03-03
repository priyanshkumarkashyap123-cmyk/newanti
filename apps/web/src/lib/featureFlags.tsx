/**
 * Feature Flags System
 * 
 * Industry Standard: Feature toggles for safe rollouts, A/B testing, and gradual releases
 * 
 * Supports:
 * - Local development overrides
 * - User-based targeting
 * - Percentage rollouts
 * - A/B testing variants
 * - Remote configuration (can be extended to use LaunchDarkly, Flagsmith, etc.)
 */

import { useEffect, useState, useMemo, createContext, useContext, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
  variants?: Record<string, unknown>;
  rolloutPercentage?: number;
  targetUsers?: string[];
  targetGroups?: string[];
  metadata?: Record<string, unknown>;
}

export interface FeatureFlagUser {
  id: string;
  email?: string;
  groups?: string[];
  attributes?: Record<string, unknown>;
}

export interface FeatureFlagsConfig {
  flags: Record<string, FeatureFlag>;
  defaultEnabled?: boolean;
  user?: FeatureFlagUser;
}

export interface FeatureFlagsContextValue {
  flags: Record<string, FeatureFlag>;
  isEnabled: (key: string) => boolean;
  getVariant: <T = unknown>(key: string, defaultValue?: T) => T | undefined;
  setUser: (user: FeatureFlagUser | undefined) => void;
  refresh: () => Promise<void>;
  isLoading: boolean;
}

// ============================================================================
// Feature Flag Definitions
// ============================================================================

/**
 * Define all feature flags here
 * 
 * This is the single source of truth for all features
 */
export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // UI Features
  NEW_DASHBOARD: {
    key: 'NEW_DASHBOARD',
    enabled: true,
    description: 'Enable new unified dashboard',
    rolloutPercentage: 100,
  },
  
  DARK_MODE: {
    key: 'DARK_MODE',
    enabled: true,
    description: 'Enable dark mode toggle',
  },
  
  THREE_D_VISUALIZATION: {
    key: 'THREE_D_VISUALIZATION',
    enabled: true,
    description: 'Enable 3D structural visualization',
  },
  
  AI_ANALYSIS: {
    key: 'AI_ANALYSIS',
    enabled: true,
    description: 'Enable AI-powered structural analysis',
    rolloutPercentage: 100,
  },
  
  // Analysis Features
  ADVANCED_BEAM_ANALYSIS: {
    key: 'ADVANCED_BEAM_ANALYSIS',
    enabled: true,
    description: 'Enable advanced beam analysis with nonlinear materials',
  },
  
  CONCRETE_DESIGN: {
    key: 'CONCRETE_DESIGN',
    enabled: true,
    description: 'Enable IS 456 concrete design',
  },
  
  STEEL_DESIGN: {
    key: 'STEEL_DESIGN',
    enabled: true,
    description: 'Enable IS 800 steel design',
  },
  
  SEISMIC_ANALYSIS: {
    key: 'SEISMIC_ANALYSIS',
    enabled: true,
    description: 'Enable IS 1893 seismic analysis',
    rolloutPercentage: 100,
  },
  
  // Export Features
  PDF_EXPORT: {
    key: 'PDF_EXPORT',
    enabled: true,
    description: 'Enable PDF report export',
  },
  
  EXCEL_EXPORT: {
    key: 'EXCEL_EXPORT',
    enabled: true,
    description: 'Enable Excel data export',
  },
  
  CAD_EXPORT: {
    key: 'CAD_EXPORT',
    enabled: false,
    description: 'Enable CAD file export',
    rolloutPercentage: 0,
  },
  
  // Collaboration Features
  REAL_TIME_COLLAB: {
    key: 'REAL_TIME_COLLAB',
    enabled: false,
    description: 'Enable real-time collaboration',
    rolloutPercentage: 0,
    targetGroups: ['beta-testers'],
  },
  
  // A/B Test Example
  NEW_ONBOARDING: {
    key: 'NEW_ONBOARDING',
    enabled: true,
    description: 'A/B test for new onboarding flow',
    rolloutPercentage: 50,
    variants: {
      control: { flow: 'classic' },
      treatment: { flow: 'interactive', steps: 5 },
    },
  },
};

// ============================================================================
// Feature Flag Utilities
// ============================================================================

/**
 * Hash function for consistent percentage rollout
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Check if user is in rollout percentage
 */
function isInRollout(userId: string, flagKey: string, percentage: number): boolean {
  const hash = hashString(`${userId}-${flagKey}`);
  return (hash % 100) < percentage;
}

/**
 * Get A/B test variant for user
 */
function getVariantForUser<T>(
  userId: string,
  flagKey: string,
  variants: Record<string, T>
): T | undefined {
  const variantKeys = Object.keys(variants);
  if (variantKeys.length === 0) return undefined;
  
  const hash = hashString(`${userId}-${flagKey}`);
  const index = hash % variantKeys.length;
  return variants[variantKeys[index]];
}

// ============================================================================
// Feature Flags Service
// ============================================================================

class FeatureFlagsService {
  private flags: Record<string, FeatureFlag>;
  private user?: FeatureFlagUser;
  private listeners: Set<() => void> = new Set();
  private localOverrides: Record<string, boolean> = {};

  constructor(initialFlags: Record<string, FeatureFlag> = FEATURE_FLAGS) {
    this.flags = { ...initialFlags };
    this.loadLocalOverrides();
  }

  /**
   * Load dev overrides from localStorage
   */
  private loadLocalOverrides(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('feature_flags_overrides');
      if (stored) {
        this.localOverrides = JSON.parse(stored);
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Set current user for targeting
   */
  setUser(user: FeatureFlagUser | undefined): void {
    this.user = user;
    this.notifyListeners();
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(key: string): boolean {
    // Check local overrides first (for development)
    if (key in this.localOverrides) {
      return this.localOverrides[key];
    }

    const flag = this.flags[key];
    if (!flag) return false;

    // Base enabled check
    if (!flag.enabled) return false;

    // Check user targeting
    if (flag.targetUsers && this.user) {
      if (!flag.targetUsers.includes(this.user.id)) {
        return false;
      }
    }

    // Check group targeting
    if (flag.targetGroups && this.user?.groups) {
      const hasGroup = flag.targetGroups.some((g) => this.user?.groups?.includes(g));
      if (!hasGroup) return false;
    }

    // Check percentage rollout
    if (flag.rolloutPercentage !== undefined && this.user) {
      return isInRollout(this.user.id, key, flag.rolloutPercentage);
    }

    return true;
  }

  /**
   * Get variant for A/B test
   */
  getVariant<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const flag = this.flags[key];
    if (!flag?.variants || !this.user) {
      return defaultValue;
    }

    if (!this.isEnabled(key)) {
      return defaultValue;
    }

    return getVariantForUser(this.user.id, key, flag.variants) as T ?? defaultValue;
  }

  /**
   * Get all flags
   */
  getFlags(): Record<string, FeatureFlag> {
    return { ...this.flags };
  }

  /**
   * Update flags (from remote)
   */
  updateFlags(newFlags: Record<string, FeatureFlag>): void {
    this.flags = { ...this.flags, ...newFlags };
    this.notifyListeners();
  }

  /**
   * Refresh flags from remote (stub - can integrate with LaunchDarkly, etc.)
   */
  async refresh(): Promise<void> {
    // In production, fetch from feature flag service:
    // const response = await fetch('/api/feature-flags');
    // const flags = await response.json();
    // this.updateFlags(flags);
    
    // For now, just use static flags
    this.notifyListeners();
  }

  /**
   * Set local override (for development)
   */
  setOverride(key: string, enabled: boolean): void {
    this.localOverrides[key] = enabled;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('feature_flags_overrides', JSON.stringify(this.localOverrides));
    }
    
    this.notifyListeners();
  }

  /**
   * Clear all overrides
   */
  clearOverrides(): void {
    this.localOverrides = {};
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('feature_flags_overrides');
    }
    
    this.notifyListeners();
  }

  /**
   * Subscribe to changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const featureFlags = new FeatureFlagsService();

// ============================================================================
// React Context
// ============================================================================

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

export interface FeatureFlagsProviderProps {
  children: ReactNode;
  user?: FeatureFlagUser;
  initialFlags?: Record<string, FeatureFlag>;
}

export function FeatureFlagsProvider({
  children,
  user,
  initialFlags,
}: FeatureFlagsProviderProps): JSX.Element {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>(
    initialFlags ?? featureFlags.getFlags()
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      featureFlags.setUser(user);
    }
  }, [user]);

  useEffect(() => {
    return featureFlags.subscribe(() => {
      setFlags(featureFlags.getFlags());
    });
  }, []);

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      flags,
      isEnabled: (key: string) => featureFlags.isEnabled(key),
      getVariant: <T,>(key: string, defaultValue?: T) =>
        featureFlags.getVariant(key, defaultValue),
      setUser: (u) => featureFlags.setUser(u),
      refresh: async () => {
        setIsLoading(true);
        await featureFlags.refresh();
        setIsLoading(false);
      },
      isLoading,
    }),
    [flags, isLoading]
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Access feature flags context
 */
export function useFeatureFlags(): FeatureFlagsContextValue {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
}

/**
 * Check if a feature is enabled
 */
export function useFeatureFlag(key: string): boolean {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(key);
}

/**
 * Get A/B test variant
 */
export function useFeatureVariant<T = unknown>(
  key: string,
  defaultValue?: T
): T | undefined {
  const { getVariant } = useFeatureFlags();
  return getVariant(key, defaultValue);
}

// ============================================================================
// React Components
// ============================================================================

interface FeatureProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditional rendering based on feature flag
 */
export function Feature({ flag, children, fallback = null }: FeatureProps): JSX.Element | null {
  const enabled = useFeatureFlag(flag);
  return <>{enabled ? children : fallback}</>;
}

interface ABTestProps<T> {
  flag: string;
  variants: Record<string, ReactNode>;
  defaultVariant?: string;
}

/**
 * A/B test component
 */
export function ABTest<T>({
  flag,
  variants,
  defaultVariant,
}: ABTestProps<T>): JSX.Element | null {
  const variant = useFeatureVariant<string>(flag);
  const variantKey = variant ?? defaultVariant;
  
  if (!variantKey || !(variantKey in variants)) {
    return null;
  }
  
  return <>{variants[variantKey]}</>;
}

// ============================================================================
// Dev Tools
// ============================================================================

/**
 * Feature Flags DevTools component
 * 
 * Shows all flags and allows overriding them in development
 */
export function FeatureFlagsDevTools(): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const { flags, isEnabled, refresh, isLoading } = useFeatureFlags();
  const [, forceUpdate] = useState(0);

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  const handleOverride = (key: string, enabled: boolean) => {
    featureFlags.setOverride(key, enabled);
    forceUpdate((n) => n + 1);
  };

  const handleClearOverrides = () => {
    featureFlags.clearOverrides();
    forceUpdate((n) => n + 1);
  };

  if (!isOpen) {
    return (
      <button type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 px-3 py-2 bg-gray-800 text-white border-none rounded-lg cursor-pointer text-xs z-[9992]"
      >
        🚩 Flags
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 left-4 w-80 max-h-[400px] bg-gray-800 text-white rounded-lg p-4 overflow-auto z-[9992] text-xs"
    >
      <div className="flex justify-between mb-3">
        <strong>🚩 Feature Flags</strong>
        <button type="button" onClick={() => setIsOpen(false)} className="bg-transparent border-none text-white cursor-pointer">✕</button>
      </div>
      
      <div className="flex gap-2 mb-3">
        <button type="button"
          onClick={() => refresh()}
          disabled={isLoading}
          className="px-2 py-1 bg-blue-500 text-white border-none rounded cursor-pointer text-[11px]"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
        <button type="button"
          onClick={handleClearOverrides}
          className="px-2 py-1 bg-gray-500 text-white border-none rounded cursor-pointer text-[11px]"
        >
          Clear Overrides
        </button>
      </div>
      
      <div className="flex flex-col gap-2">
        {Object.entries(flags).map(([key, flag]) => (
          <div
            key={key}
            className="flex items-center justify-between p-2 bg-gray-700 rounded"
          >
            <div>
              <div className="font-medium">{key}</div>
              <div className="text-gray-400 text-[10px]">{flag.description}</div>
            </div>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={isEnabled(key)}
                onChange={(e) => handleOverride(key, e.target.checked)}
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

// All types are already exported inline above
