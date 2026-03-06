/**
 * useDisposable.ts - Hook for automatic Three.js resource disposal
 * 
 * Ensures geometries, materials, and textures created in useMemo
 * are properly disposed when the component unmounts or deps change.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type Disposable = THREE.BufferGeometry | THREE.Material | THREE.Texture | { dispose: () => void };

/**
 * Track a disposable Three.js resource for automatic cleanup.
 * Call this after each useMemo that creates a geometry/material.
 * 
 * @example
 * const geometry = useMemo(() => new THREE.BoxGeometry(1,1,1), []);
 * useDisposable(geometry);
 */
export function useDisposable<T extends Disposable | null | undefined>(resource: T): void {
  const prevRef = useRef<T | null>(null);

  useEffect(() => {
    // Dispose previous resource if it changed
    if (prevRef.current && prevRef.current !== resource) {
      prevRef.current.dispose();
    }
    prevRef.current = resource ?? null;

    return () => {
      if (resource) {
        resource.dispose();
      }
    };
  }, [resource]);
}

/**
 * Track multiple disposable resources for automatic cleanup.
 * 
 * @example
 * const { geo, mat } = useMemo(() => ({
 *   geo: new THREE.BoxGeometry(1,1,1),
 *   mat: new THREE.MeshStandardMaterial()
 * }), []);
 * useDisposables([geo, mat]);
 */
export function useDisposables(resources: (Disposable | null | undefined)[]): void {
  const prevRef = useRef<(Disposable | null | undefined)[]>([]);

  useEffect(() => {
    // Dispose any previous resources not in the new set
    prevRef.current.forEach((prev) => {
      if (prev && !resources.includes(prev)) {
        prev.dispose();
      }
    });
    prevRef.current = [...resources];

    return () => {
      resources.forEach((r) => {
        if (r) r.dispose();
      });
    };
  }, [resources]);
}

/**
 * Dispose all geometries and materials in a Three.js group recursively.
 * Useful for cleanup in useEffect return functions.
 */
export function disposeGroup(group: THREE.Group | THREE.Object3D): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }
    if (child instanceof THREE.InstancedMesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
      child.dispose();
    }
  });
}
