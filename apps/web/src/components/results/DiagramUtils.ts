import * as THREE from 'three';

/**
 * Calculate Local Axes based on start, end, and beta angle
 */
export const calculateLocalAxes = (start: THREE.Vector3, end: THREE.Vector3, betaAngleDeg: number) => {
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const L = start.distanceTo(end);

    // Initial Local Z and Y (without beta)
    const localY = new THREE.Vector3();
    const localZ = new THREE.Vector3();

    // Check if vertical
    const isVertical = Math.abs(dir.y) > 0.999;

    if (isVertical) {
        // Vertical member
        // For PyNite/Standard: 
        // If Y is up (Global Y), Local y is -Global X, Local z is +Global Z
        // If Y is down, Local y is +Global X, Local z is +Global Z
        if (dir.y > 0) {
            localZ.set(0, 0, 1); // Global Z
            localY.set(-1, 0, 0); // -Global X
        } else {
            localZ.set(0, 0, 1); // Global Z
            localY.set(1, 0, 0); // +Global X
        }
    } else {
        // Horizontal/Inclined member
        // Local z = GlobalY cross dir
        // Local y = dir cross Local z
        const globalY = new THREE.Vector3(0, 1, 0);
        localZ.crossVectors(dir, globalY).normalize();
        localY.crossVectors(localZ, dir).normalize();
    }

    // Apply Beta Angle (Rotation about Local X / dir)
    if (betaAngleDeg !== 0) {
        const rad = THREE.MathUtils.degToRad(betaAngleDeg);
        localY.applyAxisAngle(dir, rad);
        localZ.applyAxisAngle(dir, rad);
    }

    return { localX: dir, localY, localZ };
};
