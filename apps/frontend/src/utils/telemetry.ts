/**
 * Performance Telemetry Utilities
 * 
 * Tracks and reports performance metrics for the structural analyzer.
 * Monitors Core Web Vitals, rendering performance, and solver metrics.
 * 
 * @version 1.0.0
 */

import { logger } from '../lib/logging/logger';

// ============================================
// CORE WEB VITALS
// ============================================

export interface WebVitalsMetrics {
    LCP: number | null;  // Largest Contentful Paint
    FID: number | null;  // First Input Delay
    CLS: number | null;  // Cumulative Layout Shift
    FCP: number | null;  // First Contentful Paint
    TTFB: number | null; // Time to First Byte
    INP: number | null;  // Interaction to Next Paint
}

export interface PerformanceMetrics {
    webVitals: WebVitalsMetrics;
    rendering: RenderingMetrics;
    solver: SolverMetrics;
    memory: MemoryMetrics;
}

export interface RenderingMetrics {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
    gpuMemory: number | null;
}

export interface SolverMetrics {
    matrixAssemblyTime: number;
    factorizationTime: number;
    backSubstitutionTime: number;
    totalSolveTime: number;
    dof: number;
    iterations?: number;
}

export interface MemoryMetrics {
    usedJSHeapSize: number | null;
    totalJSHeapSize: number | null;
    jsHeapSizeLimit: number | null;
}

// ============================================
// PERFORMANCE OBSERVER
// ============================================

class PerformanceTelemetry {
    private metrics: PerformanceMetrics;
    private observers: PerformanceObserver[] = [];
    private listeners: ((metrics: PerformanceMetrics) => void)[] = [];
    private frameCount = 0;
    private lastFrameTime = 0;
    private fpsHistory: number[] = [];

    constructor() {
        this.metrics = this.createEmptyMetrics();
        this.initObservers();
    }

    private createEmptyMetrics(): PerformanceMetrics {
        return {
            webVitals: {
                LCP: null,
                FID: null,
                CLS: null,
                FCP: null,
                TTFB: null,
                INP: null,
            },
            rendering: {
                fps: 0,
                frameTime: 0,
                drawCalls: 0,
                triangles: 0,
                gpuMemory: null,
            },
            solver: {
                matrixAssemblyTime: 0,
                factorizationTime: 0,
                backSubstitutionTime: 0,
                totalSolveTime: 0,
                dof: 0,
            },
            memory: {
                usedJSHeapSize: null,
                totalJSHeapSize: null,
                jsHeapSizeLimit: null,
            },
        };
    }

    private initObservers(): void {
        if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
            return;
        }

        // LCP Observer
        try {
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
                if (lastEntry) {
                    this.metrics.webVitals.LCP = lastEntry.startTime;
                    this.notifyListeners();
                }
            });
            lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
            this.observers.push(lcpObserver);
        } catch (e) {
            logger.debug('LCP observer not supported');
        }

        // FID Observer
        try {
            const fidObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry: PerformanceEntry & { processingStart?: number }) => {
                    if (entry.processingStart) {
                        this.metrics.webVitals.FID = entry.processingStart - entry.startTime;
                    }
                });
                this.notifyListeners();
            });
            fidObserver.observe({ type: 'first-input', buffered: true });
            this.observers.push(fidObserver);
        } catch (e) {
            logger.debug('FID observer not supported');
        }

        // CLS Observer
        try {
            let clsValue = 0;
            const clsObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry: PerformanceEntry & { hadRecentInput?: boolean; value?: number }) => {
                    if (!entry.hadRecentInput && entry.value) {
                        clsValue += entry.value;
                        this.metrics.webVitals.CLS = clsValue;
                    }
                });
                this.notifyListeners();
            });
            clsObserver.observe({ type: 'layout-shift', buffered: true });
            this.observers.push(clsObserver);
        } catch (e) {
            logger.debug('CLS observer not supported');
        }

        // FCP Observer
        try {
            const fcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    if (entry.name === 'first-contentful-paint') {
                        this.metrics.webVitals.FCP = entry.startTime;
                    }
                });
                this.notifyListeners();
            });
            fcpObserver.observe({ type: 'paint', buffered: true });
            this.observers.push(fcpObserver);
        } catch (e) {
            logger.debug('FCP observer not supported');
        }

        // TTFB from Navigation Timing
        if (performance.getEntriesByType) {
            const navEntries = performance.getEntriesByType('navigation');
            if (navEntries.length > 0) {
                const nav = navEntries[0] as PerformanceNavigationTiming;
                this.metrics.webVitals.TTFB = nav.responseStart - nav.requestStart;
            }
        }
    }

    /**
     * Update FPS metrics (call from animation loop)
     */
    updateFPS(timestamp: number): void {
        this.frameCount++;
        
        if (this.lastFrameTime === 0) {
            this.lastFrameTime = timestamp;
            return;
        }

        const delta = timestamp - this.lastFrameTime;
        if (delta >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / delta);
            this.fpsHistory.push(fps);
            if (this.fpsHistory.length > 60) {
                this.fpsHistory.shift();
            }
            
            this.metrics.rendering.fps = fps;
            this.metrics.rendering.frameTime = delta / this.frameCount;
            
            this.frameCount = 0;
            this.lastFrameTime = timestamp;
            this.notifyListeners();
        }
    }

    /**
     * Update rendering metrics from Three.js renderer
     */
    updateRenderingMetrics(info: {
        render: { calls: number; triangles: number };
        memory?: { geometries: number; textures: number };
    }): void {
        this.metrics.rendering.drawCalls = info.render.calls;
        this.metrics.rendering.triangles = info.render.triangles;
    }

    /**
     * Update solver metrics
     */
    updateSolverMetrics(metrics: Partial<SolverMetrics>): void {
        Object.assign(this.metrics.solver, metrics);
        this.notifyListeners();
    }

    /**
     * Update memory metrics
     */
    updateMemoryMetrics(): void {
        if (typeof performance !== 'undefined' && (performance as Performance & { memory?: MemoryMetrics }).memory) {
            const memory = (performance as Performance & { memory: MemoryMetrics }).memory;
            this.metrics.memory = {
                usedJSHeapSize: memory.usedJSHeapSize,
                totalJSHeapSize: memory.totalJSHeapSize,
                jsHeapSizeLimit: memory.jsHeapSizeLimit,
            };
        }
    }

    /**
     * Subscribe to metrics updates
     */
    subscribe(callback: (metrics: PerformanceMetrics) => void): () => void {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener(this.metrics));
    }

    /**
     * Get current metrics
     */
    getMetrics(): PerformanceMetrics {
        this.updateMemoryMetrics();
        return { ...this.metrics };
    }

    /**
     * Get average FPS
     */
    getAverageFPS(): number {
        if (this.fpsHistory.length === 0) return 0;
        return Math.round(
            this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
        );
    }

    /**
     * Log metrics to console
     */
    logMetrics(): void {
        logger.info('Performance Metrics - Web Vitals', {
            LCP: this.metrics.webVitals.LCP?.toFixed(0) ?? 'N/A',
            FID: this.metrics.webVitals.FID?.toFixed(0) ?? 'N/A',
            CLS: this.metrics.webVitals.CLS?.toFixed(3) ?? 'N/A',
            FCP: this.metrics.webVitals.FCP?.toFixed(0) ?? 'N/A',
            TTFB: this.metrics.webVitals.TTFB?.toFixed(0) ?? 'N/A',
        });

        logger.info('Performance Metrics - Rendering', {
            fps: this.metrics.rendering.fps,
            avgFps: this.getAverageFPS(),
            frameTimeMs: this.metrics.rendering.frameTime.toFixed(2),
            drawCalls: this.metrics.rendering.drawCalls,
            triangles: this.metrics.rendering.triangles,
        });

        if (this.metrics.solver.totalSolveTime > 0) {
            logger.info('Performance Metrics - Solver', {
                dof: this.metrics.solver.dof,
                assemblyTimeMs: this.metrics.solver.matrixAssemblyTime.toFixed(0),
                factorizationTimeMs: this.metrics.solver.factorizationTime.toFixed(0),
                totalTimeMs: this.metrics.solver.totalSolveTime.toFixed(0),
            });
        }

        if (this.metrics.memory.usedJSHeapSize) {
            logger.info('Performance Metrics - Memory', {
                usedMB: (this.metrics.memory.usedJSHeapSize / 1024 / 1024).toFixed(1),
                totalMB: (this.metrics.memory.totalJSHeapSize! / 1024 / 1024).toFixed(1),
                limitMB: (this.metrics.memory.jsHeapSizeLimit! / 1024 / 1024).toFixed(1),
            });
        }
    }

    /**
     * Cleanup observers
     */
    destroy(): void {
        this.observers.forEach((observer) => observer.disconnect());
        this.observers = [];
        this.listeners = [];
    }
}

// ============================================
// TIMING UTILITIES
// ============================================

export function measureTime<T>(fn: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    return { result, duration };
}

export async function measureTimeAsync<T>(
    fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
}

export function createTimer(name: string) {
    const start = performance.now();
    return {
        stop: () => {
            const duration = performance.now() - start;
            logger.debug('Timer completed', { name, durationMs: duration.toFixed(2) });
            return duration;
        },
    };
}

// ============================================
// MARK & MEASURE UTILITIES
// ============================================

export function mark(name: string): void {
    if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark(name);
    }
}

export function measure(name: string, startMark: string, endMark?: string): number | null {
    if (typeof performance === 'undefined' || !performance.measure) {
        return null;
    }
    
    try {
        if (endMark) {
            performance.measure(name, startMark, endMark);
        } else {
            performance.measure(name, startMark);
        }
        
        const entries = performance.getEntriesByName(name, 'measure');
        if (entries.length > 0) {
            return entries[entries.length - 1].duration;
        }
    } catch (e) {
        logger.debug('Performance measure failed', { error: e });
    }
    
    return null;
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let telemetryInstance: PerformanceTelemetry | null = null;

export function getTelemetry(): PerformanceTelemetry {
    if (!telemetryInstance) {
        telemetryInstance = new PerformanceTelemetry();
    }
    return telemetryInstance;
}

export function destroyTelemetry(): void {
    if (telemetryInstance) {
        telemetryInstance.destroy();
        telemetryInstance = null;
    }
}

// ============================================
// REACT HOOK
// ============================================

import { useEffect, useState } from 'react';

export function usePerformanceMetrics(): PerformanceMetrics | null {
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    
    useEffect(() => {
        const telemetry = getTelemetry();
        queueMicrotask(() => {
            setMetrics(telemetry.getMetrics());
        });
        
        const unsubscribe = telemetry.subscribe((newMetrics) => {
            queueMicrotask(() => {
                setMetrics({ ...newMetrics });
            });
        });
        
        return unsubscribe;
    }, []);
    
    return metrics;
}

export default PerformanceTelemetry;
