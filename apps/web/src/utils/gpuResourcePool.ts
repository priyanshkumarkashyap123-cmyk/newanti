/**
 * gpuResourcePool.ts - Shared Geometry & Material Pool
 *
 * Prevents repeated GPU allocation/deallocation of identical resources
 * when components mount/unmount (e.g. switching tabs, toggling renderers).
 *
 * Usage:
 *   const geo = GpuResourcePool.getCylinderGeometry(0.05, 8);
 *   const mat = GpuResourcePool.getStandardMaterial({ metalness: 0.3 });
 *   // Never call .dispose() on pooled resources — the pool owns them.
 *   // Call GpuResourcePool.disposeAll() only on app teardown.
 */

import * as THREE from 'three';

// ─── Pool key helpers ────────────────────────────────────────────

function cylinderKey(radius: number, segments: number, openEnded: boolean): string {
    return `cyl_${radius}_${segments}_${openEnded ? '1' : '0'}`;
}

function sphereKey(radius: number, segments: number): string {
    return `sph_${radius}_${segments}`;
}

function matStdKey(opts: {
    metalness?: number;
    roughness?: number;
    flatShading?: boolean;
    color?: number | string;
}): string {
    return `std_${opts.color ?? 'def'}_${opts.metalness ?? 0.5}_${opts.roughness ?? 0.5}_${opts.flatShading ? '1' : '0'}`;
}

function matBasicKey(opts: { color?: number | string; wireframe?: boolean }): string {
    return `basic_${opts.color ?? 'def'}_${opts.wireframe ? '1' : '0'}`;
}

// ─── Singleton ───────────────────────────────────────────────────

class _GpuResourcePool {
    private _geometries = new Map<string, THREE.BufferGeometry>();
    private _materials = new Map<string, THREE.Material>();
    private _refCounts = new Map<string, number>();

    // ── Geometries ────────────────────────────────────────────

    getCylinderGeometry(
        radius = 0.05,
        segments = 8,
        openEnded = false,
    ): THREE.CylinderGeometry {
        const key = cylinderKey(radius, segments, openEnded);
        if (!this._geometries.has(key)) {
            this._geometries.set(
                key,
                new THREE.CylinderGeometry(radius, radius, 1, segments, 1, openEnded),
            );
            this._refCounts.set(key, 0);
        }
        this._refCounts.set(key, (this._refCounts.get(key) ?? 0) + 1);
        return this._geometries.get(key) as THREE.CylinderGeometry;
    }

    getSphereGeometry(radius = 0.1, segments = 8): THREE.SphereGeometry {
        const key = sphereKey(radius, segments);
        if (!this._geometries.has(key)) {
            this._geometries.set(
                key,
                new THREE.SphereGeometry(radius, segments, segments),
            );
            this._refCounts.set(key, 0);
        }
        this._refCounts.set(key, (this._refCounts.get(key) ?? 0) + 1);
        return this._geometries.get(key) as THREE.SphereGeometry;
    }

    // ── Materials ─────────────────────────────────────────────

    getStandardMaterial(opts: {
        metalness?: number;
        roughness?: number;
        flatShading?: boolean;
        color?: number | string;
    } = {}): THREE.MeshStandardMaterial {
        const key = matStdKey(opts);
        if (!this._materials.has(key)) {
            this._materials.set(
                key,
                new THREE.MeshStandardMaterial({
                    metalness: opts.metalness ?? 0.5,
                    roughness: opts.roughness ?? 0.5,
                    flatShading: opts.flatShading ?? false,
                    ...(opts.color != null ? { color: opts.color } : {}),
                }),
            );
            this._refCounts.set(key, 0);
        }
        this._refCounts.set(key, (this._refCounts.get(key) ?? 0) + 1);
        return this._materials.get(key) as THREE.MeshStandardMaterial;
    }

    getBasicMaterial(opts: {
        color?: number | string;
        wireframe?: boolean;
    } = {}): THREE.MeshBasicMaterial {
        const key = matBasicKey(opts);
        if (!this._materials.has(key)) {
            this._materials.set(
                key,
                new THREE.MeshBasicMaterial({
                    color: opts.color ?? 0xffffff,
                    wireframe: opts.wireframe ?? false,
                }),
            );
            this._refCounts.set(key, 0);
        }
        this._refCounts.set(key, (this._refCounts.get(key) ?? 0) + 1);
        return this._materials.get(key) as THREE.MeshBasicMaterial;
    }

    // ── Release (ref-counted, does NOT dispose unless count = 0) ──

    release(resource: THREE.BufferGeometry | THREE.Material): void {
        for (const [key, val] of this._geometries) {
            if (val === resource) {
                const rc = (this._refCounts.get(key) ?? 1) - 1;
                this._refCounts.set(key, Math.max(0, rc));
                return;
            }
        }
        for (const [key, val] of this._materials) {
            if (val === resource) {
                const rc = (this._refCounts.get(key) ?? 1) - 1;
                this._refCounts.set(key, Math.max(0, rc));
                return;
            }
        }
    }

    // ── Diagnostics ──────────────────────────────────────────

    get stats(): { geometries: number; materials: number } {
        return {
            geometries: this._geometries.size,
            materials: this._materials.size,
        };
    }

    /** Full teardown – call only on app unmount / hot-reload cleanup. */
    disposeAll(): void {
        for (const g of this._geometries.values()) g.dispose();
        for (const m of this._materials.values()) m.dispose();
        this._geometries.clear();
        this._materials.clear();
        this._refCounts.clear();
    }
}

export const GpuResourcePool = new _GpuResourcePool();
