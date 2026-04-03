/**
 * CameraFitController.tsx — Auto-fit / Zoom-to-Extents for the 3D viewport
 *
 * Industry-standard behaviour found in STAAD, ETABS, SkyCiv, etc.:
 *  1. When a model is first loaded or changes significantly, the camera automatically
 *     frames the entire structure so every node is visible and clickable.
 *  2. When the user presses the "Fit View" button (or Home key), it re-frames.
 *  3. OrbitControls maxDistance is dynamically extended so it never clips a large model.
 *
 * Usage:
 *   Placed *inside* the R3F <Canvas> tree, alongside <OrbitControls>.
 *   It subscribes to the Zustand model store and to the "fit-view" DOM custom event.
 */

import React from 'react';
import { useEffect, useRef, useCallback } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useModelStore } from "../../store/model";

/** Minimal interface for OrbitControls-like camera controls */
interface OrbitControlsLike {
  target: THREE.Vector3;
  maxDistance?: number;
  minDistance?: number;
  update: () => void;
}

// ── helpers ──────────────────────────────────────────────────────────

/** Compute the axis-aligned bounding box that encloses every node. */
function computeModelBounds(
  nodes: Map<string, { x: number; y: number; z: number }>,
): THREE.Box3 | null {
  if (nodes.size === 0) return null;

  const box = new THREE.Box3();
  for (const n of nodes.values()) {
    box.expandByPoint(new THREE.Vector3(n.x, n.y, n.z));
  }
  return box;
}

/**
 * Minimum visible extent in any axis (metres).
 * Avoids degenerate framing for single-node or collinear models.
 */
const MIN_EXTENT = 2;

/**
 * How much visual "breathing room" around the model (multiplier on the
 * bounding-sphere radius used for camera distance).
 */
const FIT_PADDING = 1.6;

// ── component ────────────────────────────────────────────────────────

export const CameraFitController: React.FC = () => {
  const { camera, controls, size } = useThree();
  const lastNodeCountRef = useRef(0);
  const hasFittedOnceRef = useRef(false);

  // Read nodes reactively from the store
  const nodes = useModelStore((s) => s.nodes);

  /**
   * Frame the camera so the entire model bounding box is visible.
   * Works with both PerspectiveCamera and OrthographicCamera.
   */
  const fitToModel = useCallback(() => {
    const box = computeModelBounds(nodes);
    if (!box) return;

    // Ensure minimum extent on every axis so the camera doesn't zoom to infinity
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.x < MIN_EXTENT) {
      box.min.x -= MIN_EXTENT / 2;
      box.max.x += MIN_EXTENT / 2;
    }
    if (size.y < MIN_EXTENT) {
      box.min.y -= MIN_EXTENT / 2;
      box.max.y += MIN_EXTENT / 2;
    }
    if (size.z < MIN_EXTENT) {
      box.min.z -= MIN_EXTENT / 2;
      box.max.z += MIN_EXTENT / 2;
    }

    const center = new THREE.Vector3();
    box.getCenter(center);

    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const radius = Math.max(sphere.radius, 1);

    // Perspective: place camera at a distance that fits the sphere inside the FOV
    if (camera instanceof THREE.PerspectiveCamera) {
      const fovRad = THREE.MathUtils.degToRad(camera.fov / 2);
      const distance = (radius / Math.sin(fovRad)) * FIT_PADDING;

      // Keep the current viewing direction, but reposition at the correct distance
      const direction = camera.position
        .clone()
        .sub((controls as unknown as OrbitControlsLike)?.target ?? center)
        .normalize();
      // If direction is zero (camera at target), default to isometric-ish
      if (direction.lengthSq() < 1e-6) {
        direction.set(1, 0.8, 1).normalize();
      }

      camera.position.copy(center).addScaledVector(direction, distance);
      camera.near = distance * 0.001;
      camera.far = distance * 10;
      camera.updateProjectionMatrix();
    }
    // Orthographic: adjust zoom so the box fills the viewport
    else if (camera instanceof THREE.OrthographicCamera) {
      const aspect =
        (camera.right - camera.left) / (camera.top - camera.bottom);
      // Size includes the padding
      const extentX = (box.max.x - box.min.x) * FIT_PADDING;
      const extentY = (box.max.y - box.min.y) * FIT_PADDING;
      const zoom = Math.min(
        (camera.right - camera.left) / extentX,
        (camera.top - camera.bottom) / extentY,
        1000, // sane cap
      );

      // Look along the same axis we're already looking
      const camDir = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .normalize();
      const dist = radius * 5;
      camera.position.copy(center).addScaledVector(camDir, -dist);
      camera.zoom = Math.max(zoom, 0.01);
      camera.updateProjectionMatrix();
    }

    // Update OrbitControls target to the model centre
    if (controls && "target" in controls) {
      (controls as unknown as OrbitControlsLike).target.copy(center);

      // Dynamically adjust maxDistance so the user can still zoom out
      const maxDist = radius * 20;
      if ((controls as unknown as OrbitControlsLike).maxDistance !== undefined) {
        (controls as unknown as OrbitControlsLike).maxDistance = Math.max(maxDist, 200);
      }
      // Also relax minDistance so user can zoom in close on small models
      if ((controls as unknown as OrbitControlsLike).minDistance !== undefined) {
        (controls as unknown as OrbitControlsLike).minDistance = Math.min(0.5, radius * 0.05);
      }
      (controls as unknown as OrbitControlsLike).update();
    }
  }, [camera, controls, nodes]);

  // ── auto-fit on model load / change ──────────────────────────────

  useEffect(() => {
    const count = nodes.size;

    // Auto-fit the first time the model goes from empty → has nodes
    if (count > 0 && !hasFittedOnceRef.current) {
      // Small delay lets the scene finish mounting
      const t = setTimeout(() => {
        fitToModel();
        hasFittedOnceRef.current = true;
      }, 200);
      return () => clearTimeout(t);
    }

    // Also auto-fit if the node count changes by more than 20 % (e.g. demo model loaded)
    if (
      count > 0 &&
      lastNodeCountRef.current > 0 &&
      Math.abs(count - lastNodeCountRef.current) / lastNodeCountRef.current >
        0.2
    ) {
      const t = setTimeout(fitToModel, 150);
      lastNodeCountRef.current = count;
      return () => clearTimeout(t);
    }

    lastNodeCountRef.current = count;
  }, [nodes.size, fitToModel]);

  // ── respond to the DOM "fit-view" custom event ───────────────────

  useEffect(() => {
    const handler = () => fitToModel();
    document.addEventListener("fit-view", handler);
    return () => document.removeEventListener("fit-view", handler);
  }, [fitToModel]);

  // ── respond to "change-view" custom event (ViewCube) ─────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const view = (e as CustomEvent).detail?.view as string;
      if (!view || !controls || !camera) return;

      // Compute model center/radius for positioning
      const box = computeModelBounds(nodes);
      const center = new THREE.Vector3();
      let radius = 10;
      if (box) {
        box.getCenter(center);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        radius = Math.max(sphere.radius, 2);
      }

      const dist = radius * FIT_PADDING * 2;

      // Standard engineering view positions
      const viewPositions: Record<string, THREE.Vector3> = {
        front: new THREE.Vector3(0, 0, dist).add(center),
        back: new THREE.Vector3(0, 0, -dist).add(center),
        left: new THREE.Vector3(-dist, 0, 0).add(center),
        right: new THREE.Vector3(dist, 0, 0).add(center),
        top: new THREE.Vector3(0, dist, 0.001).add(center), // tiny z offset avoids gimbal lock
        iso: new THREE.Vector3(dist * 0.6, dist * 0.5, dist * 0.6).add(center),
      };

      const pos = viewPositions[view];
      if (pos) {
        camera.position.copy(pos);
        if ('target' in controls) {
          (controls as unknown as OrbitControlsLike).target.copy(center);
          (controls as unknown as OrbitControlsLike).update();
        }
        camera.lookAt(center);
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.updateProjectionMatrix();
        } else if (camera instanceof THREE.OrthographicCamera) {
          // React Three Fiber OrthographicCamera without explicit left/right uses default size.
          // By default, zoom scales it. If we want physical height to fit (radius * 2 * padding), we divide sizes by that physical.
          // r3f OrthoCamera by default sets `left = width / -2`, etc. so size in units is width / zoom.
          const requiredHeight = radius * FIT_PADDING * 2;
          const requiredWidth = requiredHeight * (size.width / size.height);
          camera.zoom = size.height / requiredHeight;
          camera.updateProjectionMatrix();
        }
      }
    };
    document.addEventListener("change-view", handler);
    return () => document.removeEventListener("change-view", handler);
  }, [camera, controls, nodes]);

  // ── respond to "zoom-in" / "zoom-out" custom events ──────────────

  useEffect(() => {
    const handleZoomIn = () => {
      if (!camera || !controls) return;
      if (camera instanceof THREE.PerspectiveCamera) {
        const target = (controls as unknown as OrbitControlsLike).target || new THREE.Vector3();
        const dir = camera.position.clone().sub(target);
        dir.multiplyScalar(0.75); // zoom in by 25%
        camera.position.copy(target).add(dir);
      } else if (camera instanceof THREE.OrthographicCamera) {
        camera.zoom *= 1.25;
        camera.updateProjectionMatrix();
      }
      if ('update' in controls) (controls as unknown as OrbitControlsLike).update();
    };

    const handleZoomOut = () => {
      if (!camera || !controls) return;
      if (camera instanceof THREE.PerspectiveCamera) {
        const target = (controls as unknown as OrbitControlsLike).target || new THREE.Vector3();
        const dir = camera.position.clone().sub(target);
        dir.multiplyScalar(1.33); // zoom out by ~25%
        camera.position.copy(target).add(dir);
      } else if (camera instanceof THREE.OrthographicCamera) {
        camera.zoom *= 0.75;
        camera.updateProjectionMatrix();
      }
      if ('update' in controls) (controls as unknown as OrbitControlsLike).update();
    };

    document.addEventListener("zoom-in", handleZoomIn);
    document.addEventListener("zoom-out", handleZoomOut);
    return () => {
      document.removeEventListener("zoom-in", handleZoomIn);
      document.removeEventListener("zoom-out", handleZoomOut);
    };
  }, [camera, controls]);

  // ── respond to "reset-view" custom event ─────────────────────────

  useEffect(() => {
    const handler = () => {
      // Reset = fit to model from isometric angle
      if (!camera || !controls) return;

      const box = computeModelBounds(nodes);
      const center = new THREE.Vector3();
      let radius = 10;
      if (box) {
        box.getCenter(center);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        radius = Math.max(sphere.radius, 2);
      }
      const dist = radius * FIT_PADDING * 2;

      // Isometric default position
      camera.position.set(
        center.x + dist * 0.6,
        center.y + dist * 0.5,
        center.z + dist * 0.6,
      );
      if ('target' in controls) {
        (controls as unknown as OrbitControlsLike).target.copy(center);
        (controls as unknown as OrbitControlsLike).update();
      }
      camera.lookAt(center);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.updateProjectionMatrix();
      }
    };

    document.addEventListener("reset-view", handler);
    return () => document.removeEventListener("reset-view", handler);
  }, [camera, controls, nodes]);

  // ── respond to "Home" key shortcut ───────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Home") {
        e.preventDefault();
        fitToModel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fitToModel]);

  // This component renders nothing — it's purely behavioural
  return null;
};

export default CameraFitController;
