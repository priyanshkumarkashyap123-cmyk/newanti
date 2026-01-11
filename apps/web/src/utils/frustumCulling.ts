/**
 * Frustum Culling Utilities
 * 
 * Provides efficient view frustum culling for large structural models.
 * Used to determine which elements are visible from the current camera view.
 */

import * as THREE from 'three';

// ============================================
// FRUSTUM CULLER CLASS
// ============================================

export class FrustumCuller {
    private frustum: THREE.Frustum;
    private projScreenMatrix: THREE.Matrix4;
    private boundingBox: THREE.Box3;
    private boundingSphere: THREE.Sphere;
    
    constructor() {
        this.frustum = new THREE.Frustum();
        this.projScreenMatrix = new THREE.Matrix4();
        this.boundingBox = new THREE.Box3();
        this.boundingSphere = new THREE.Sphere();
    }
    
    /**
     * Update frustum from camera
     */
    updateFromCamera(camera: THREE.Camera): void {
        this.projScreenMatrix.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    }
    
    /**
     * Check if a point is inside the frustum
     */
    containsPoint(point: THREE.Vector3): boolean {
        return this.frustum.containsPoint(point);
    }
    
    /**
     * Check if a box intersects the frustum
     */
    intersectsBox(box: THREE.Box3): boolean {
        return this.frustum.intersectsBox(box);
    }
    
    /**
     * Check if a sphere intersects the frustum
     */
    intersectsSphere(sphere: THREE.Sphere): boolean {
        return this.frustum.intersectsSphere(sphere);
    }
    
    /**
     * Check if a member (line segment) is visible
     */
    isMemberVisible(
        startX: number, startY: number, startZ: number,
        endX: number, endY: number, endZ: number,
        padding = 0.5
    ): boolean {
        // Create bounding box for the member
        const minX = Math.min(startX, endX) - padding;
        const minY = Math.min(startY, endY) - padding;
        const minZ = Math.min(startZ, endZ) - padding;
        const maxX = Math.max(startX, endX) + padding;
        const maxY = Math.max(startY, endY) + padding;
        const maxZ = Math.max(startZ, endZ) + padding;
        
        this.boundingBox.min.set(minX, minY, minZ);
        this.boundingBox.max.set(maxX, maxY, maxZ);
        
        return this.frustum.intersectsBox(this.boundingBox);
    }
    
    /**
     * Check if a node is visible (point with radius)
     */
    isNodeVisible(
        x: number, y: number, z: number,
        radius = 0.2
    ): boolean {
        this.boundingSphere.center.set(x, y, z);
        this.boundingSphere.radius = radius;
        return this.frustum.intersectsSphere(this.boundingSphere);
    }
}

// ============================================
// DISTANCE CULLER
// ============================================

export class DistanceCuller {
    private cameraPosition: THREE.Vector3;
    private maxDistance: number;
    private maxDistanceSq: number;
    
    constructor(maxDistance = 1000) {
        this.cameraPosition = new THREE.Vector3();
        this.maxDistance = maxDistance;
        this.maxDistanceSq = maxDistance * maxDistance;
    }
    
    /**
     * Update camera position
     */
    updateCameraPosition(camera: THREE.Camera): void {
        this.cameraPosition.copy(camera.position);
    }
    
    /**
     * Set maximum visible distance
     */
    setMaxDistance(distance: number): void {
        this.maxDistance = distance;
        this.maxDistanceSq = distance * distance;
    }
    
    /**
     * Check if a point is within view distance
     */
    isPointInRange(x: number, y: number, z: number): boolean {
        const dx = x - this.cameraPosition.x;
        const dy = y - this.cameraPosition.y;
        const dz = z - this.cameraPosition.z;
        return (dx * dx + dy * dy + dz * dz) <= this.maxDistanceSq;
    }
    
    /**
     * Check if a member is within view distance (uses midpoint)
     */
    isMemberInRange(
        startX: number, startY: number, startZ: number,
        endX: number, endY: number, endZ: number
    ): boolean {
        const midX = (startX + endX) * 0.5;
        const midY = (startY + endY) * 0.5;
        const midZ = (startZ + endZ) * 0.5;
        return this.isPointInRange(midX, midY, midZ);
    }
    
    /**
     * Get distance from camera to a point
     */
    getDistance(x: number, y: number, z: number): number {
        const dx = x - this.cameraPosition.x;
        const dy = y - this.cameraPosition.y;
        const dz = z - this.cameraPosition.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    /**
     * Get LOD level based on distance (0 = close, 3 = far)
     */
    getLODLevel(x: number, y: number, z: number): number {
        const distance = this.getDistance(x, y, z);
        const ratio = distance / this.maxDistance;
        
        if (ratio < 0.1) return 0;  // Very close - full detail
        if (ratio < 0.3) return 1;  // Close - high detail
        if (ratio < 0.6) return 2;  // Medium - reduced detail
        return 3;                    // Far - minimal detail
    }
}

// ============================================
// COMBINED CULLER (Frustum + Distance)
// ============================================

export class CombinedCuller {
    private frustumCuller: FrustumCuller;
    private distanceCuller: DistanceCuller;
    
    constructor(maxDistance = 1000) {
        this.frustumCuller = new FrustumCuller();
        this.distanceCuller = new DistanceCuller(maxDistance);
    }
    
    /**
     * Update from camera (call once per frame)
     */
    update(camera: THREE.Camera): void {
        this.frustumCuller.updateFromCamera(camera);
        this.distanceCuller.updateCameraPosition(camera);
    }
    
    /**
     * Set maximum visible distance
     */
    setMaxDistance(distance: number): void {
        this.distanceCuller.setMaxDistance(distance);
    }
    
    /**
     * Check if a member should be rendered
     */
    shouldRenderMember(
        startX: number, startY: number, startZ: number,
        endX: number, endY: number, endZ: number,
        useDistanceCulling = true
    ): boolean {
        // First check distance (faster)
        if (useDistanceCulling && !this.distanceCuller.isMemberInRange(
            startX, startY, startZ, endX, endY, endZ
        )) {
            return false;
        }
        
        // Then check frustum
        return this.frustumCuller.isMemberVisible(
            startX, startY, startZ, endX, endY, endZ
        );
    }
    
    /**
     * Check if a node should be rendered
     */
    shouldRenderNode(
        x: number, y: number, z: number,
        useDistanceCulling = true
    ): boolean {
        if (useDistanceCulling && !this.distanceCuller.isPointInRange(x, y, z)) {
            return false;
        }
        return this.frustumCuller.isNodeVisible(x, y, z);
    }
    
    /**
     * Get LOD level for a member
     */
    getMemberLOD(
        startX: number, startY: number, startZ: number,
        endX: number, endY: number, endZ: number
    ): number {
        const midX = (startX + endX) * 0.5;
        const midY = (startY + endY) * 0.5;
        const midZ = (startZ + endZ) * 0.5;
        return this.distanceCuller.getLODLevel(midX, midY, midZ);
    }
}

// ============================================
// REACT HOOK FOR CULLING
// ============================================

import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';

export function useCulling(maxDistance = 1000) {
    const cullerRef = useRef<CombinedCuller | null>(null);
    
    // Lazy initialization
    if (!cullerRef.current) {
        cullerRef.current = new CombinedCuller(maxDistance);
    }
    
    // Update culler every frame
    useFrame(({ camera }) => {
        cullerRef.current?.update(camera);
    });
    
    const shouldRenderMember = useCallback((
        startX: number, startY: number, startZ: number,
        endX: number, endY: number, endZ: number,
        useDistanceCulling = true
    ) => {
        return cullerRef.current?.shouldRenderMember(
            startX, startY, startZ, endX, endY, endZ, useDistanceCulling
        ) ?? true;
    }, []);
    
    const shouldRenderNode = useCallback((
        x: number, y: number, z: number,
        useDistanceCulling = true
    ) => {
        return cullerRef.current?.shouldRenderNode(x, y, z, useDistanceCulling) ?? true;
    }, []);
    
    const getMemberLOD = useCallback((
        startX: number, startY: number, startZ: number,
        endX: number, endY: number, endZ: number
    ) => {
        return cullerRef.current?.getMemberLOD(
            startX, startY, startZ, endX, endY, endZ
        ) ?? 0;
    }, []);
    
    const setMaxDistance = useCallback((distance: number) => {
        cullerRef.current?.setMaxDistance(distance);
    }, []);
    
    return {
        shouldRenderMember,
        shouldRenderNode,
        getMemberLOD,
        setMaxDistance,
    };
}

export default CombinedCuller;
