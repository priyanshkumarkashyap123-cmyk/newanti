/**
 * gpuQuality.ts - Centralized GPU/Device quality detection & render settings
 *
 * Uses detect-gpu to probe the actual GPU tier and memory,
 * then exposes a singleton RenderQualityManager that every
 * rendering component can query for quality-appropriate defaults.
 *
 * Quality tiers:
 *   low    – integrated / mobile GPU, < 4 GB VRAM
 *   medium – mid-range discrete GPU
 *   high   – desktop discrete GPU with plenty of headroom
 */

import { getGPUTier, TierResult } from 'detect-gpu';

// ─── Types ────────────────────────────────────────────────────────

export type QualityTier = 'low' | 'medium' | 'high';

export interface RenderQualityProfile {
    tier: QualityTier;

    // Shadow maps
    shadowMapSize: number;
    enableShadows: boolean;

    // Post-processing
    enableSSAO: boolean;
    enableBloom: boolean;
    enableSMAA: boolean;
    enableFXAA: boolean;
    enableHDR: boolean;

    // Geometry budgets
    maxInstances: number;          // InstancedMesh cap
    ultraLightThreshold: number;   // Switch to ultra-light renderer above this
    maxLights: number;

    // Canvas
    pixelRatio: number;            // Clamp device pixel ratio
    antialias: boolean;

    // Misc
    enableAnimations: boolean;     // CSS / framer-motion animations
}

// ─── Presets ──────────────────────────────────────────────────────

const LOW: RenderQualityProfile = {
    tier: 'low',
    shadowMapSize: 512,
    enableShadows: false,
    enableSSAO: false,
    enableBloom: false,
    enableSMAA: false,
    enableFXAA: true,         // Cheap
    enableHDR: false,
    maxInstances: 20_000,
    ultraLightThreshold: 5_000,
    maxLights: 2,
    pixelRatio: 1,
    antialias: false,
    enableAnimations: false,
};

const MEDIUM: RenderQualityProfile = {
    tier: 'medium',
    shadowMapSize: 1024,
    enableShadows: true,
    enableSSAO: false,
    enableBloom: false,
    enableSMAA: true,
    enableFXAA: false,
    enableHDR: false,
    maxInstances: 80_000,
    ultraLightThreshold: 10_000,
    maxLights: 3,
    pixelRatio: Math.min(window.devicePixelRatio, 1.5),
    antialias: false,
    enableAnimations: true,
};

const HIGH: RenderQualityProfile = {
    tier: 'high',
    shadowMapSize: 2048,
    enableShadows: true,
    enableSSAO: true,
    enableBloom: true,
    enableSMAA: true,
    enableFXAA: false,
    enableHDR: true,
    maxInstances: 200_000,
    ultraLightThreshold: 20_000,
    maxLights: 4,
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    antialias: true,
    enableAnimations: true,
};

const PROFILES: Record<QualityTier, RenderQualityProfile> = {
    low: LOW,
    medium: MEDIUM,
    high: HIGH,
};

// ─── Singleton Manager ───────────────────────────────────────────

class _RenderQualityManager {
    private _profile: RenderQualityProfile = MEDIUM; // safe default
    private _gpuTier: TierResult | null = null;
    private _ready = false;
    private _initPromise: Promise<void> | null = null;
    private _listeners: Set<(profile: RenderQualityProfile) => void> = new Set();

    /** Call once at app startup (e.g. in main.tsx). Awaitable. */
    init(): Promise<void> {
        if (this._initPromise) return this._initPromise;

        this._initPromise = getGPUTier({
            mobileTiers: [0, 15, 30, 60],
            desktopTiers: [0, 15, 30, 60],
            failIfMajorPerformanceCaveat: false,
            glContext: undefined,
        })
            .then((result) => {
                this._gpuTier = result;

                // detect-gpu returns tier 0-3
                let tier: QualityTier;
                if (result.tier <= 1) tier = 'low';
                else if (result.tier === 2) tier = 'medium';
                else tier = 'high';

                // Override with prefers-reduced-motion
                if (
                    typeof window !== 'undefined' &&
                    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
                ) {
                    tier = 'low';
                }

                // Override: very low device memory → low
                if ((navigator as unknown as { deviceMemory?: number }).deviceMemory !== undefined) {
                    const mem = (navigator as unknown as { deviceMemory: number }).deviceMemory;
                    if (mem <= 2) tier = 'low';
                }

                this._profile = { ...PROFILES[tier] };
                this._ready = true;

                console.info(
                    `[RenderQuality] Detected GPU tier ${result.tier} (${result.gpu ?? 'unknown'}). Using "${tier}" profile.`,
                );

                this._notify();
            })
            .catch((err) => {
                console.warn('[RenderQuality] GPU detection failed, using medium defaults', err);
                this._profile = { ...MEDIUM };
                this._ready = true;
                this._notify();
            });

        return this._initPromise;
    }

    /** Returns current profile. Safe to call before init() completes (returns MEDIUM). */
    get profile(): Readonly<RenderQualityProfile> {
        return this._profile;
    }

    get ready(): boolean {
        return this._ready;
    }

    get gpuInfo(): TierResult | null {
        return this._gpuTier;
    }

    /** Allow manual override (e.g. settings panel). */
    setTier(tier: QualityTier): void {
        this._profile = { ...PROFILES[tier] };
        this._notify();
    }

    /** Subscribe to profile changes. Returns unsubscribe fn. */
    onChange(fn: (profile: RenderQualityProfile) => void): () => void {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    private _notify(): void {
        for (const fn of this._listeners) {
            try { fn(this._profile); } catch { /* ignore */ }
        }
    }
}

/** Singleton – import this everywhere. */
export const RenderQualityManager = new _RenderQualityManager();

// ─── React Hook ──────────────────────────────────────────────────

import { useState, useEffect } from 'react';

/**
 * React hook that returns the current render quality profile
 * and re-renders on tier changes.
 */
export function useRenderQuality(): Readonly<RenderQualityProfile> {
    const [profile, setProfile] = useState<RenderQualityProfile>(RenderQualityManager.profile);

    useEffect(() => {
        // If not initialised yet, kick it off
        RenderQualityManager.init();

        return RenderQualityManager.onChange((p) => setProfile({ ...p }));
    }, []);

    return profile;
}
