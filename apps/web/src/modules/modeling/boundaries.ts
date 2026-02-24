/**
 * boundaries.ts - Advanced Boundary Conditions Module
 * 
 * Features:
 * - Standard supports (Fixed, Pinned, Roller)
 * - Spring supports (Linear, Compression-only)
 * - Enforced displacements (Prescribed settlements)
 * - Inclined supports (Rotated restraints)
 * - Non-linear members (Tension-only, Compression-only)
 */

// ============================================
// ENUMERATIONS
// ============================================

export type SupportType = 
    | 'none'
    | 'fixed'
    | 'pinned'
    | 'roller'
    | 'roller_x'
    | 'roller_z'
    | 'spring'
    | 'inclined';

export type SpringType = 
    | 'linear'
    | 'compression_only'
    | 'tension_only';

export type MemberBehavior = 
    | 'linear'
    | 'tension_only'      // Cables, bracing
    | 'compression_only'  // Struts
    | 'gap'               // Expansion joint
    | 'hook';             // One-way connector


// ============================================
// STANDARD SUPPORT CONDITIONS
// ============================================

export interface Restraints {
    dx: boolean;  // Translation X
    dy: boolean;  // Translation Y
    dz: boolean;  // Translation Z
    rx: boolean;  // Rotation about X
    ry: boolean;  // Rotation about Y
    rz: boolean;  // Rotation about Z
}

export const SUPPORT_RESTRAINTS: Record<SupportType, Restraints> = {
    none: { dx: false, dy: false, dz: false, rx: false, ry: false, rz: false },
    fixed: { dx: true, dy: true, dz: true, rx: true, ry: true, rz: true },
    pinned: { dx: true, dy: true, dz: true, rx: false, ry: false, rz: false },
    roller: { dx: false, dy: true, dz: false, rx: false, ry: false, rz: false },
    roller_x: { dx: true, dy: true, dz: false, rx: false, ry: false, rz: false },
    roller_z: { dx: false, dy: true, dz: true, rx: false, ry: false, rz: false },
    spring: { dx: false, dy: false, dz: false, rx: false, ry: false, rz: false },
    inclined: { dx: false, dy: false, dz: false, rx: false, ry: false, rz: false },
};


// ============================================
// SPRING SUPPORT
// ============================================

export interface SpringSupport {
    id: string;
    nodeId: string;
    type: SpringType;
    
    // Spring stiffness (kN/m for translation, kN·m/rad for rotation)
    kx?: number;   // Translational spring in X
    ky?: number;   // Translational spring in Y
    kz?: number;   // Translational spring in Z
    krx?: number;  // Rotational spring about X
    kry?: number;  // Rotational spring about Y
    krz?: number;  // Rotational spring about Z
    
    // For compression-only springs
    isActive?: boolean;  // Updated after analysis iteration
    reactionSign?: number;  // +1 compression, -1 tension
}

export interface SpringSupportInput {
    nodeId: string;
    type?: SpringType;
    ky: number;      // Typically vertical spring constant
    kx?: number;
    kz?: number;
}


// ============================================
// ENFORCED DISPLACEMENT
// ============================================

export interface EnforcedDisplacement {
    id: string;
    nodeId: string;
    
    // Prescribed displacements (m for translation, rad for rotation)
    dx?: number;  // Settlement in X
    dy?: number;  // Settlement in Y (support sinking)
    dz?: number;  // Settlement in Z
    rx?: number;  // Prescribed rotation X
    ry?: number;  // Prescribed rotation Y
    rz?: number;  // Prescribed rotation Z
    
    // Which DOFs are enforced
    enforcedDOFs: {
        dx: boolean;
        dy: boolean;
        dz: boolean;
        rx: boolean;
        ry: boolean;
        rz: boolean;
    };
}


// ============================================
// INCLINED SUPPORT
// ============================================

export interface InclinedSupport {
    id: string;
    nodeId: string;
    
    // Rotation angles to define local coordinate system (degrees)
    thetaX: number;  // Rotation about global X
    thetaY: number;  // Rotation about global Y
    thetaZ: number;  // Rotation about global Z
    
    // Restraints in the rotated local system
    restraints: Restraints;
}

/**
 * Calculate transformation matrix for inclined support.
 * Rotates global DOFs to local inclined system.
 */
export function calculateInclinedTransformationMatrix(
    thetaX: number,
    thetaY: number,
    thetaZ: number
): number[][] {
    // Convert to radians
    const rx = thetaX * Math.PI / 180;
    const ry = thetaY * Math.PI / 180;
    const rz = thetaZ * Math.PI / 180;
    
    // Rotation matrices
    const Rx = [
        [1, 0, 0],
        [0, Math.cos(rx), -Math.sin(rx)],
        [0, Math.sin(rx), Math.cos(rx)]
    ];
    
    const Ry = [
        [Math.cos(ry), 0, Math.sin(ry)],
        [0, 1, 0],
        [-Math.sin(ry), 0, Math.cos(ry)]
    ];
    
    const Rz = [
        [Math.cos(rz), -Math.sin(rz), 0],
        [Math.sin(rz), Math.cos(rz), 0],
        [0, 0, 1]
    ];
    
    // Combined rotation: R = Rz × Ry × Rx
    const multiplyMatrices = (A: number[][], B: number[][]): number[][] => {
        const result: number[][] = [];
        for (let i = 0; i < 3; i++) {
            result[i] = [];
            for (let j = 0; j < 3; j++) {
                result[i][j] = 0;
                for (let k = 0; k < 3; k++) {
                    result[i][j] += A[i][k] * B[k][j];
                }
            }
        }
        return result;
    };
    
    const RzRy = multiplyMatrices(Rz, Ry);
    return multiplyMatrices(RzRy, Rx);
}


// ============================================
// NON-LINEAR MEMBERS
// ============================================

export interface NonLinearMember {
    id: string;
    memberId: string;
    behavior: MemberBehavior;
    
    // For gap elements
    gapSize?: number;  // Initial gap (m)
    
    // Analysis state
    isActive: boolean;  // Current state in iteration
    axialForce?: number;  // Last computed force
    iteration?: number;   // Iteration when state changed
}

export interface TensionOnlyMember extends NonLinearMember {
    behavior: 'tension_only';
    slackLength?: number;  // Length at which member goes slack
}

export interface CompressionOnlyMember extends NonLinearMember {
    behavior: 'compression_only';
    bucklingLoad?: number;  // Critical load for buckling
}


// ============================================
// BOUNDARY CONDITION MANAGER
// ============================================

export interface BoundaryConditions {
    // Standard supports (nodeId -> restraints)
    supports: Map<string, Restraints>;
    
    // Spring supports
    springs: Map<string, SpringSupport>;
    
    // Enforced displacements
    enforcedDisplacements: Map<string, EnforcedDisplacement>;
    
    // Inclined supports
    inclinedSupports: Map<string, InclinedSupport>;
    
    // Non-linear members
    nonLinearMembers: Map<string, NonLinearMember>;
}

export class BoundaryConditionManager {
    private supports: Map<string, Restraints> = new Map();
    private springs: Map<string, SpringSupport> = new Map();
    private enforcedDisplacements: Map<string, EnforcedDisplacement> = new Map();
    private inclinedSupports: Map<string, InclinedSupport> = new Map();
    private nonLinearMembers: Map<string, NonLinearMember> = new Map();
    
    // ===== SUPPORT METHODS =====
    
    addSupport(nodeId: string, type: SupportType): void {
        this.supports.set(nodeId, { ...SUPPORT_RESTRAINTS[type] });
    }
    
    addCustomSupport(nodeId: string, restraints: Partial<Restraints>): void {
        this.supports.set(nodeId, {
            dx: restraints.dx ?? false,
            dy: restraints.dy ?? false,
            dz: restraints.dz ?? false,
            rx: restraints.rx ?? false,
            ry: restraints.ry ?? false,
            rz: restraints.rz ?? false,
        });
    }
    
    removeSupport(nodeId: string): void {
        this.supports.delete(nodeId);
    }
    
    // ===== SPRING METHODS =====
    
    addSpring(input: SpringSupportInput): SpringSupport {
        const spring: SpringSupport = {
            id: `spring_${input.nodeId}`,
            nodeId: input.nodeId,
            type: input.type || 'linear',
            kx: input.kx,
            ky: input.ky,
            kz: input.kz,
            isActive: true,
        };
        this.springs.set(input.nodeId, spring);
        return spring;
    }
    
    /**
     * Update compression-only spring state after analysis.
     * Deactivates spring if reaction shows tension (uplift).
     */
    updateCompressionOnlySpring(nodeId: string, reactionY: number): boolean {
        const spring = this.springs.get(nodeId);
        if (!spring || spring.type !== 'compression_only') {
            return false;
        }
        
        const wasActive = spring.isActive;
        // Positive reaction = compression (support pushing up)
        // Negative reaction = tension (uplift) → deactivate
        spring.isActive = reactionY >= 0;
        spring.reactionSign = Math.sign(reactionY);
        
        // Return true if state changed (requires re-analysis)
        return wasActive !== spring.isActive;
    }
    
    // ===== ENFORCED DISPLACEMENT METHODS =====
    
    addEnforcedDisplacement(
        nodeId: string,
        displacements: Partial<{dx: number; dy: number; dz: number; rx: number; ry: number; rz: number}>
    ): EnforcedDisplacement {
        const enforced: EnforcedDisplacement = {
            id: `enforced_${nodeId}`,
            nodeId,
            ...displacements,
            enforcedDOFs: {
                dx: displacements.dx !== undefined,
                dy: displacements.dy !== undefined,
                dz: displacements.dz !== undefined,
                rx: displacements.rx !== undefined,
                ry: displacements.ry !== undefined,
                rz: displacements.rz !== undefined,
            }
        };
        this.enforcedDisplacements.set(nodeId, enforced);
        return enforced;
    }
    
    // ===== INCLINED SUPPORT METHODS =====
    
    addInclinedSupport(
        nodeId: string,
        angles: { thetaX: number; thetaY: number; thetaZ: number },
        restraints: Partial<Restraints>
    ): InclinedSupport {
        const inclined: InclinedSupport = {
            id: `inclined_${nodeId}`,
            nodeId,
            thetaX: angles.thetaX,
            thetaY: angles.thetaY,
            thetaZ: angles.thetaZ,
            restraints: {
                dx: restraints.dx ?? true,
                dy: restraints.dy ?? true,
                dz: restraints.dz ?? false,
                rx: restraints.rx ?? false,
                ry: restraints.ry ?? false,
                rz: restraints.rz ?? false,
            }
        };
        this.inclinedSupports.set(nodeId, inclined);
        return inclined;
    }
    
    getInclinedTransformation(nodeId: string): number[][] | null {
        const inclined = this.inclinedSupports.get(nodeId);
        if (!inclined) return null;
        
        return calculateInclinedTransformationMatrix(
            inclined.thetaX,
            inclined.thetaY,
            inclined.thetaZ
        );
    }
    
    // ===== NON-LINEAR MEMBER METHODS =====
    
    addTensionOnlyMember(memberId: string): NonLinearMember {
        const member: TensionOnlyMember = {
            id: `tension_${memberId}`,
            memberId,
            behavior: 'tension_only',
            isActive: true,
        };
        this.nonLinearMembers.set(memberId, member);
        return member;
    }
    
    addCompressionOnlyMember(memberId: string, bucklingLoad?: number): NonLinearMember {
        const member: CompressionOnlyMember = {
            id: `compression_${memberId}`,
            memberId,
            behavior: 'compression_only',
            bucklingLoad,
            isActive: true,
        };
        this.nonLinearMembers.set(memberId, member);
        return member;
    }
    
    /**
     * Update tension-only member state after analysis.
     * Deactivates member if force shows compression.
     */
    updateTensionOnlyMember(memberId: string, axialForce: number): boolean {
        const member = this.nonLinearMembers.get(memberId);
        if (!member || member.behavior !== 'tension_only') {
            return false;
        }
        
        const wasActive = member.isActive;
        // Positive axial = tension, Negative = compression
        member.isActive = axialForce >= 0;
        member.axialForce = axialForce;
        
        return wasActive !== member.isActive;
    }
    
    /**
     * Update compression-only member state after analysis.
     * Deactivates member if force shows tension.
     */
    updateCompressionOnlyMember(memberId: string, axialForce: number): boolean {
        const member = this.nonLinearMembers.get(memberId);
        if (!member || member.behavior !== 'compression_only') {
            return false;
        }
        
        const wasActive = member.isActive;
        // Negative axial = compression, Positive = tension
        member.isActive = axialForce <= 0;
        member.axialForce = axialForce;
        
        return wasActive !== member.isActive;
    }
    
    // ===== EXPORT FOR SOLVER =====
    
    exportForSolver(): {
        restraints: Record<string, Restraints>;
        springs: Array<{ nodeId: string; kx: number; ky: number; kz: number }>;
        enforcedDisplacements: Array<{ nodeId: string; dx?: number; dy?: number; dz?: number }>;
        inclinedSupports: Array<{ nodeId: string; transformation: number[][] }>;
        inactiveMembers: string[];
    } {
        // Standard restraints
        const restraints: Record<string, Restraints> = {};
        this.supports.forEach((r, nodeId) => {
            restraints[nodeId] = r;
        });
        
        // Active springs
        const springs = Array.from(this.springs.values())
            .filter(s => s.isActive !== false)
            .map(s => ({
                nodeId: s.nodeId,
                kx: s.kx || 0,
                ky: s.ky || 0,
                kz: s.kz || 0,
            }));
        
        // Enforced displacements
        const enforcedDisplacements = Array.from(this.enforcedDisplacements.values())
            .map(e => ({
                nodeId: e.nodeId,
                dx: e.enforcedDOFs.dx ? e.dx : undefined,
                dy: e.enforcedDOFs.dy ? e.dy : undefined,
                dz: e.enforcedDOFs.dz ? e.dz : undefined,
            }));
        
        // Inclined supports with transformation
        const inclinedSupports = Array.from(this.inclinedSupports.values())
            .map(i => ({
                nodeId: i.nodeId,
                transformation: calculateInclinedTransformationMatrix(i.thetaX, i.thetaY, i.thetaZ)
            }));
        
        // Inactive (turned off) members
        const inactiveMembers = Array.from(this.nonLinearMembers.values())
            .filter(m => !m.isActive)
            .map(m => m.memberId);
        
        return {
            restraints,
            springs,
            enforcedDisplacements,
            inclinedSupports,
            inactiveMembers
        };
    }
    
    // ===== ITERATIVE ANALYSIS HELPER =====
    
    /**
     * Check if any non-linear elements need state update.
     * Used for iterative analysis convergence.
     */
    requiresIteration(): boolean {
        // Check for compression-only springs
        for (const spring of this.springs.values()) {
            if (spring.type === 'compression_only') return true;
        }
        
        // Check for non-linear members
        return this.nonLinearMembers.size > 0;
    }
    
    /**
     * Reset all non-linear elements to initial state.
     */
    resetNonLinearStates(): void {
        this.springs.forEach(s => { s.isActive = true; });
        this.nonLinearMembers.forEach(m => { m.isActive = true; });
    }
    
    getState(): BoundaryConditions {
        return {
            supports: new Map(this.supports),
            springs: new Map(this.springs),
            enforcedDisplacements: new Map(this.enforcedDisplacements),
            inclinedSupports: new Map(this.inclinedSupports),
            nonLinearMembers: new Map(this.nonLinearMembers),
        };
    }
}


// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create elastic foundation springs for a series of nodes.
 * Commonly used for beams on elastic foundation (Winkler model).
 */
export function createElasticFoundation(
    nodeIds: string[],
    subgradeModulus: number,  // kN/m³
    tributaryLength: number,  // m
    tributaryWidth: number = 1  // m (typically beam width)
): SpringSupportInput[] {
    // Spring constant = subgrade modulus × tributary area
    const ky = subgradeModulus * tributaryLength * tributaryWidth;
    
    return nodeIds.map(nodeId => ({
        nodeId,
        type: 'compression_only' as SpringType,
        ky,
    }));
}

/**
 * Create typical bridge bearing support.
 */
export function createBridgeBearing(
    nodeId: string,
    bearingType: 'fixed' | 'guided' | 'free'
): Restraints {
    switch (bearingType) {
        case 'fixed':
            // Elastomeric bearing - all translations restrained
            return { dx: true, dy: true, dz: true, rx: false, ry: false, rz: false };
        case 'guided':
            // Guided bearing - allows movement in one direction
            return { dx: false, dy: true, dz: true, rx: false, ry: false, rz: false };
        case 'free':
            // Free bearing - allows movement in both horizontal directions
            return { dx: false, dy: true, dz: false, rx: false, ry: false, rz: false };
    }
}

/**
 * Typical soil spring stiffness values (kN/m³).
 */
export const SUBGRADE_MODULUS = {
    LOOSE_SAND: 5000,
    MEDIUM_SAND: 15000,
    DENSE_SAND: 50000,
    SOFT_CLAY: 10000,
    MEDIUM_CLAY: 25000,
    STIFF_CLAY: 50000,
    ROCK: 500000,
};


// ============================================
// EXPORT DEFAULT INSTANCE
// ============================================

export const boundaryManager = new BoundaryConditionManager();

export default BoundaryConditionManager;
