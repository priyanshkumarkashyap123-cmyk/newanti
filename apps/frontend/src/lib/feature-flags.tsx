/**
 * ============================================================================
 * FEATURE FLAGS SYSTEM
 * ============================================================================
 * 
 * Industry-standard feature flag management:
 * - Local and remote flag sources
 * - User/organization targeting
 * - Percentage rollouts
 * - A/B testing support
 * - Override capabilities
 * - Analytics integration
 * 
 * Industry Parity: LaunchDarkly, Flagsmith, Unleash
 * ============================================================================
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// TYPES
// ============================================================================

export type FlagValue = boolean | string | number | object;

export interface FeatureFlag {
    /** Unique flag key */
    key: string;
    /** Display name */
    name: string;
    /** Description */
    description?: string;
    /** Default value */
    defaultValue: FlagValue;
    /** Current value (after evaluation) */
    value: FlagValue;
    /** Flag type */
    type: 'boolean' | 'string' | 'number' | 'json';
    /** Enabled state */
    enabled: boolean;
    /** Rollout percentage (0-100) */
    rolloutPercentage?: number;
    /** User targeting rules */
    targeting?: TargetingRule[];
    /** Tags for organization */
    tags?: string[];
    /** Created timestamp */
    createdAt: string;
    /** Last modified timestamp */
    updatedAt: string;
}

export interface TargetingRule {
    /** Rule ID */
    id: string;
    /** Attribute to match (e.g., 'userId', 'email', 'plan') */
    attribute: string;
    /** Operator */
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn' | 'matches';
    /** Values to match against */
    values: string[];
    /** Value to serve if matched */
    serveValue: FlagValue;
    /** Rule priority (lower = higher priority) */
    priority: number;
}

export interface UserContext {
    /** Unique user identifier */
    userId?: string;
    /** User email */
    email?: string;
    /** Organization/tenant ID */
    organizationId?: string;
    /** Subscription plan */
    plan?: 'free' | 'pro' | 'enterprise';
    /** User role */
    role?: 'user' | 'admin' | 'owner';
    /** Custom attributes */
    custom?: Record<string, string | number | boolean>;
}

export interface FeatureFlagConfig {
    /** Remote flags endpoint */
    remoteUrl?: string;
    /** Refresh interval in ms */
    refreshInterval?: number;
    /** Enable local overrides */
    allowOverrides?: boolean;
    /** Default user context */
    defaultContext?: UserContext;
    /** Analytics callback */
    onFlagEvaluated?: (flag: string, value: FlagValue, context: UserContext) => void;
}

// ============================================================================
// DEFAULT FLAGS
// ============================================================================

const DEFAULT_FLAGS: Record<string, Omit<FeatureFlag, 'value'>> = {
    // AI Features
    'ai.assistant': {
        key: 'ai.assistant',
        name: 'AI Assistant',
        description: 'Enable AI-powered structural design assistant',
        defaultValue: true,
        type: 'boolean',
        enabled: true,
        tags: ['ai', 'core'],
        createdAt: '2025-01-01',
        updatedAt: '2026-01-31',
    },
    'ai.autoDesign': {
        key: 'ai.autoDesign',
        name: 'AI Auto-Design',
        description: 'Automatic structural member sizing using ML',
        defaultValue: false,
        type: 'boolean',
        enabled: true,
        rolloutPercentage: 50,
        tags: ['ai', 'experimental'],
        createdAt: '2025-06-01',
        updatedAt: '2026-01-31',
    },
    'ai.naturalLanguage': {
        key: 'ai.naturalLanguage',
        name: 'Natural Language Input',
        description: 'Process structural descriptions in natural language',
        defaultValue: true,
        type: 'boolean',
        enabled: true,
        tags: ['ai', 'ux'],
        createdAt: '2025-09-01',
        updatedAt: '2026-01-31',
    },

    // Analysis Features
    'analysis.cloudRendering': {
        key: 'analysis.cloudRendering',
        name: 'Cloud Rendering',
        description: 'Offload heavy visualization to cloud',
        defaultValue: false,
        type: 'boolean',
        enabled: true,
        targeting: [
            {
                id: 'enterprise-only',
                attribute: 'plan',
                operator: 'equals',
                values: ['enterprise'],
                serveValue: true,
                priority: 1,
            },
        ],
        tags: ['rendering', 'enterprise'],
        createdAt: '2025-11-01',
        updatedAt: '2026-01-31',
    },
    'analysis.gpu': {
        key: 'analysis.gpu',
        name: 'GPU Acceleration',
        description: 'Use WebGPU for matrix operations',
        defaultValue: true,
        type: 'boolean',
        enabled: true,
        tags: ['performance'],
        createdAt: '2025-03-01',
        updatedAt: '2026-01-31',
    },
    'analysis.outOfCore': {
        key: 'analysis.outOfCore',
        name: 'Out-of-Core Solver',
        description: 'Handle 1M+ DOF models with disk-backed storage',
        defaultValue: true,
        type: 'boolean',
        enabled: true,
        tags: ['performance', 'enterprise'],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-31',
    },

    // Collaboration Features
    'collab.realtime': {
        key: 'collab.realtime',
        name: 'Real-time Collaboration',
        description: 'Multi-user editing with presence',
        defaultValue: false,
        type: 'boolean',
        enabled: true,
        rolloutPercentage: 25,
        tags: ['collaboration', 'experimental'],
        createdAt: '2026-01-15',
        updatedAt: '2026-01-31',
    },
    'collab.comments': {
        key: 'collab.comments',
        name: 'Comments & Annotations',
        description: 'Add comments to model elements',
        defaultValue: true,
        type: 'boolean',
        enabled: true,
        tags: ['collaboration'],
        createdAt: '2025-08-01',
        updatedAt: '2026-01-31',
    },

    // UI Features
    'ui.darkMode': {
        key: 'ui.darkMode',
        name: 'Dark Mode',
        description: 'Dark theme support',
        defaultValue: true,
        type: 'boolean',
        enabled: true,
        tags: ['ui'],
        createdAt: '2024-06-01',
        updatedAt: '2026-01-31',
    },
    'ui.newDashboard': {
        key: 'ui.newDashboard',
        name: 'New Dashboard',
        description: 'Redesigned project dashboard',
        defaultValue: false,
        type: 'boolean',
        enabled: true,
        rolloutPercentage: 75,
        tags: ['ui', 'experimental'],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-31',
    },
    'ui.advancedVisualization': {
        key: 'ui.advancedVisualization',
        name: 'Advanced Visualization',
        description: '3D stress contours and animations',
        defaultValue: true,
        type: 'boolean',
        enabled: true,
        tags: ['ui', 'visualization'],
        createdAt: '2025-04-01',
        updatedAt: '2026-01-31',
    },

    // Export Features
    'export.ifc': {
        key: 'export.ifc',
        name: 'IFC Export',
        description: 'Export to IFC format for BIM',
        defaultValue: true,
        type: 'boolean',
        enabled: true,
        tags: ['export'],
        createdAt: '2025-01-01',
        updatedAt: '2026-01-31',
    },
    'export.video': {
        key: 'export.video',
        name: 'Video Export',
        description: 'Export animations as MP4/WebM',
        defaultValue: true,
        type: 'boolean',
        enabled: true,
        tags: ['export'],
        createdAt: '2025-07-01',
        updatedAt: '2026-01-31',
    },

    // Beta Features
    'beta.plugins': {
        key: 'beta.plugins',
        name: 'Plugin System',
        description: 'Third-party plugin support',
        defaultValue: false,
        type: 'boolean',
        enabled: true,
        targeting: [
            {
                id: 'beta-testers',
                attribute: 'role',
                operator: 'in',
                values: ['admin', 'owner'],
                serveValue: true,
                priority: 1,
            },
        ],
        tags: ['beta', 'extensibility'],
        createdAt: '2026-01-20',
        updatedAt: '2026-01-31',
    },
    'beta.mlOptimization': {
        key: 'beta.mlOptimization',
        name: 'ML Optimization',
        description: 'Neural network-based structural optimization',
        defaultValue: false,
        type: 'boolean',
        enabled: true,
        rolloutPercentage: 10,
        tags: ['beta', 'ai', 'optimization'],
        createdAt: '2026-01-25',
        updatedAt: '2026-01-31',
    },

    // Limits
    'limits.maxNodes': {
        key: 'limits.maxNodes',
        name: 'Max Nodes',
        description: 'Maximum number of nodes per model',
        defaultValue: 10000,
        type: 'number',
        enabled: true,
        targeting: [
            {
                id: 'pro-limit',
                attribute: 'plan',
                operator: 'equals',
                values: ['pro'],
                serveValue: 50000,
                priority: 2,
            },
            {
                id: 'enterprise-limit',
                attribute: 'plan',
                operator: 'equals',
                values: ['enterprise'],
                serveValue: 1000000,
                priority: 1,
            },
        ],
        tags: ['limits'],
        createdAt: '2025-01-01',
        updatedAt: '2026-01-31',
    },
};

// ============================================================================
// FEATURE FLAGS STORE
// ============================================================================

interface FeatureFlagsState {
    flags: Record<string, FeatureFlag>;
    overrides: Record<string, FlagValue>;
    context: UserContext;
    isLoading: boolean;
    lastFetched: number | null;
    error: string | null;

    // Actions
    setContext: (context: UserContext) => void;
    updateContext: (updates: Partial<UserContext>) => void;
    setOverride: (key: string, value: FlagValue) => void;
    removeOverride: (key: string) => void;
    clearOverrides: () => void;
    fetchFlags: (url?: string) => Promise<void>;
    evaluateFlag: (key: string) => FlagValue;
    isEnabled: (key: string) => boolean;
    getString: (key: string, defaultValue?: string) => string;
    getNumber: (key: string, defaultValue?: number) => number;
    getJson: <T>(key: string, defaultValue?: T) => T;
}

export const useFeatureFlags = create<FeatureFlagsState>()(
    persist(
        (set, get) => ({
            flags: Object.fromEntries(
                Object.entries(DEFAULT_FLAGS).map(([key, flag]) => [
                    key,
                    { ...flag, value: flag.defaultValue },
                ])
            ),
            overrides: {},
            context: {},
            isLoading: false,
            lastFetched: null,
            error: null,

            setContext: (context) => set({ context }),

            updateContext: (updates) =>
                set((state) => ({
                    context: { ...state.context, ...updates },
                })),

            setOverride: (key, value) =>
                set((state) => ({
                    overrides: { ...state.overrides, [key]: value },
                })),

            removeOverride: (key) =>
                set((state) => {
                    const { [key]: _, ...rest } = state.overrides;
                    return { overrides: rest };
                }),

            clearOverrides: () => set({ overrides: {} }),

            fetchFlags: async (url) => {
                if (!url) return;
                
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch flags: ${response.status}`);
                    }
                    const remoteFlags = await response.json();
                    
                    set((state) => ({
                        flags: { ...state.flags, ...remoteFlags },
                        isLoading: false,
                        lastFetched: Date.now(),
                    }));
                } catch (error) {
                    set({
                        isLoading: false,
                        error: error instanceof Error ? error.message : 'Failed to fetch flags',
                    });
                }
            },

            evaluateFlag: (key) => {
                const state = get();
                
                // Check override first
                if (key in state.overrides) {
                    return state.overrides[key];
                }

                const flag = state.flags[key];
                if (!flag) {
                    console.warn(`Feature flag "${key}" not found`);
                    return false;
                }

                if (!flag.enabled) {
                    return flag.defaultValue;
                }

                // Evaluate targeting rules
                if (flag.targeting && flag.targeting.length > 0) {
                    const sortedRules = [...flag.targeting].sort((a, b) => a.priority - b.priority);
                    
                    for (const rule of sortedRules) {
                        if (evaluateRule(rule, state.context)) {
                            return rule.serveValue;
                        }
                    }
                }

                // Evaluate percentage rollout
                if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
                    const hash = hashString(state.context.userId || 'anonymous' + key);
                    const bucket = hash % 100;
                    if (bucket >= flag.rolloutPercentage) {
                        return flag.defaultValue;
                    }
                }

                return flag.value;
            },

            isEnabled: (key) => {
                const value = get().evaluateFlag(key);
                return Boolean(value);
            },

            getString: (key, defaultValue = '') => {
                const value = get().evaluateFlag(key);
                return typeof value === 'string' ? value : defaultValue;
            },

            getNumber: (key, defaultValue = 0) => {
                const value = get().evaluateFlag(key);
                return typeof value === 'number' ? value : defaultValue;
            },

            getJson: <T,>(key: string, defaultValue?: T): T => {
                const value = get().evaluateFlag(key);
                return (typeof value === 'object' ? value : defaultValue) as T;
            },
        }),
        {
            name: 'feature-flags-storage',
            partialize: (state) => ({
                overrides: state.overrides,
                context: state.context,
            }),
        }
    )
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function evaluateRule(rule: TargetingRule, context: UserContext): boolean {
    const value = getContextValue(rule.attribute, context);
    if (value === undefined) return false;

    const stringValue = String(value);

    switch (rule.operator) {
        case 'equals':
            return rule.values.includes(stringValue);
        case 'contains':
            return rule.values.some((v) => stringValue.includes(v));
        case 'startsWith':
            return rule.values.some((v) => stringValue.startsWith(v));
        case 'endsWith':
            return rule.values.some((v) => stringValue.endsWith(v));
        case 'in':
            return rule.values.includes(stringValue);
        case 'notIn':
            return !rule.values.includes(stringValue);
        case 'matches':
            return rule.values.some((pattern) => {
                try {
                    return new RegExp(pattern).test(stringValue);
                } catch {
                    return false;
                }
            });
        default:
            return false;
    }
}

function getContextValue(attribute: string, context: UserContext): string | number | boolean | undefined {
    if (attribute in context) {
        return context[attribute as keyof UserContext] as string | number | boolean;
    }
    if (attribute.startsWith('custom.') && context.custom) {
        const customKey = attribute.slice(7);
        return context.custom[customKey];
    }
    return undefined;
}

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

// ============================================================================
// REACT HOOKS
// ============================================================================

import { useMemo, useEffect } from 'react';

/**
 * Hook to check if a feature is enabled
 */
export function useFeature(key: string): boolean {
    const isEnabled = useFeatureFlags((state) => state.isEnabled);
    return useMemo(() => isEnabled(key), [isEnabled, key]);
}

/**
 * Hook to get a feature flag value
 */
export function useFlag<T extends FlagValue>(key: string, defaultValue?: T): T {
    const evaluateFlag = useFeatureFlags((state) => state.evaluateFlag);
    return useMemo(() => (evaluateFlag(key) as T) ?? (defaultValue as T), [evaluateFlag, key, defaultValue]);
}

/**
 * Hook to get all flags with a specific tag
 */
export function useFlagsByTag(tag: string): FeatureFlag[] {
    const flags = useFeatureFlags((state) => state.flags);
    return useMemo(
        () => Object.values(flags).filter((flag) => flag.tags?.includes(tag)),
        [flags, tag]
    );
}

/**
 * Hook to auto-refresh flags from remote
 */
export function useRemoteFlags(url: string, refreshInterval: number = 60000): void {
    const fetchFlags = useFeatureFlags((state) => state.fetchFlags);

    useEffect(() => {
        fetchFlags(url);
        const interval = setInterval(() => fetchFlags(url), refreshInterval);
        return () => clearInterval(interval);
    }, [url, refreshInterval, fetchFlags]);
}

// ============================================================================
// FEATURE GATE COMPONENT
// ============================================================================

import React from 'react';

interface FeatureGateProps {
    feature: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
    feature,
    children,
    fallback = null,
}) => {
    const isEnabled = useFeature(feature);
    return <>{isEnabled ? children : fallback}</>;
};

// ============================================================================
// A/B TEST COMPONENT
// ============================================================================

interface ABTestProps {
    experiment: string;
    variants: {
        control: React.ReactNode;
        treatment: React.ReactNode;
    };
}

export const ABTest: React.FC<ABTestProps> = ({ experiment, variants }) => {
    const isEnabled = useFeature(experiment);
    return <>{isEnabled ? variants.treatment : variants.control}</>;
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    useFeatureFlags,
    useFeature,
    useFlag,
    useFlagsByTag,
    useRemoteFlags,
    FeatureGate,
    ABTest,
    DEFAULT_FLAGS,
};
