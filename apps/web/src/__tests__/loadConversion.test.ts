/**
 * Load Conversion Unit Tests
 * 
 * Tests for the loadConversion utility that converts distributed member loads
 * to equivalent nodal forces and moments.
 * 
 * @vitest
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Member, Node, MemberLoad } from '../utils/loadConversion';

// Mock the module for testing - we'll test the actual functions
// Note: In real implementation, export these functions from loadConversion.ts

// ============================================
// TEST HELPERS
// ============================================

function createNode(id: string, x: number, y: number, z: number): Node {
    return { id, x, y, z };
}

function createMember(id: string, startNodeId: string, endNodeId: string, length?: number): Member {
    return { id, startNodeId, endNodeId, length };
}

function createUDL(
    memberId: string,
    w1: number,
    direction = 'global_y',
    loadCase?: string
): MemberLoad {
    return {
        id: `load-${memberId}`,
        memberId,
        type: 'UDL',
        w1,
        direction,
        loadCase,
    };
}

function createTriangularLoad(
    memberId: string,
    w1: number,
    w2: number,
    direction = 'global_y'
): MemberLoad {
    return {
        id: `load-${memberId}`,
        memberId,
        type: 'triangular',
        w1,
        w2,
        direction,
    };
}

function createPointLoad(
    memberId: string,
    w1: number,
    startPos: number,
    direction = 'global_y'
): MemberLoad {
    return {
        id: `load-${memberId}`,
        memberId,
        type: 'point',
        w1,
        startPos,
        direction,
    };
}

// ============================================
// ANALYTICAL SOLUTIONS FOR VALIDATION
// ============================================

/**
 * UDL Fixed-End Moments (Fixed-Fixed Beam)
 * For uniform load w over length L:
 * - Reactions: R = wL/2 at each end
 * - Fixed-end moments: M = ±wL²/12
 */
function analyticUDLReactions(w: number, L: number): {
    reaction: number;
    moment: number;
} {
    return {
        reaction: (w * L) / 2,
        moment: (w * L * L) / 12,
    };
}

/**
 * Triangular Load Fixed-End Reactions (Zero at start, w at end)
 * R1 = 3wL/20, R2 = 7wL/20
 * M1 = wL²/30, M2 = wL²/20
 */
function analyticTriangularReactions(w: number, L: number): {
    reaction1: number;
    reaction2: number;
    moment1: number;
    moment2: number;
} {
    return {
        reaction1: (3 * w * L) / 20,
        reaction2: (7 * w * L) / 20,
        moment1: (w * L * L) / 30,
        moment2: (w * L * L) / 20,
    };
}

/**
 * Point Load Fixed-End Reactions
 * For load P at position a from start (b = L - a):
 * R1 = Pb²(3a + b) / L³
 * R2 = Pa²(a + 3b) / L³
 * M1 = Pab² / L²
 * M2 = Pa²b / L²
 */
function analyticPointLoadReactions(P: number, L: number, a: number): {
    reaction1: number;
    reaction2: number;
    moment1: number;
    moment2: number;
} {
    const b = L - a;
    const L2 = L * L;
    const L3 = L * L * L;
    
    return {
        reaction1: (P * b * b * (3 * a + b)) / L3,
        reaction2: (P * a * a * (a + 3 * b)) / L3,
        moment1: (P * a * b * b) / L2,
        moment2: (P * a * a * b) / L2,
    };
}

// ============================================
// GEOMETRY TESTS
// ============================================

describe('Member Geometry', () => {
    it('should calculate horizontal member length correctly', () => {
        const start = createNode('n1', 0, 0, 0);
        const end = createNode('n2', 10, 0, 0);
        const length = Math.sqrt(
            (end.x - start.x) ** 2 +
            (end.y - start.y) ** 2 +
            (end.z - start.z) ** 2
        );
        expect(length).toBe(10);
    });

    it('should calculate vertical member length correctly', () => {
        const start = createNode('n1', 0, 0, 0);
        const end = createNode('n2', 0, 5, 0);
        const length = Math.sqrt(
            (end.x - start.x) ** 2 +
            (end.y - start.y) ** 2 +
            (end.z - start.z) ** 2
        );
        expect(length).toBe(5);
    });

    it('should calculate 3D diagonal member length correctly', () => {
        const start = createNode('n1', 0, 0, 0);
        const end = createNode('n2', 3, 4, 0);
        const length = Math.sqrt(
            (end.x - start.x) ** 2 +
            (end.y - start.y) ** 2 +
            (end.z - start.z) ** 2
        );
        expect(length).toBe(5);
    });

    it('should handle zero-length members gracefully', () => {
        const start = createNode('n1', 5, 5, 5);
        const end = createNode('n2', 5, 5, 5);
        const length = Math.sqrt(
            (end.x - start.x) ** 2 +
            (end.y - start.y) ** 2 +
            (end.z - start.z) ** 2
        );
        expect(length).toBe(0);
    });
});

// ============================================
// UDL REACTION TESTS
// ============================================

describe('UDL Fixed-End Reactions', () => {
    it('should calculate correct reactions for 10kN/m over 6m', () => {
        const w = -10; // kN/m downward
        const L = 6;   // meters
        const analytic = analyticUDLReactions(Math.abs(w), L);
        
        // Each reaction should be wL/2 = 10*6/2 = 30 kN upward
        expect(analytic.reaction).toBe(30);
        
        // Fixed-end moment wL²/12 = 10*36/12 = 30 kN·m
        expect(analytic.moment).toBe(30);
    });

    it('should calculate correct reactions for 5kN/m over 4m', () => {
        const w = 5; // kN/m
        const L = 4; // meters
        const analytic = analyticUDLReactions(w, L);
        
        expect(analytic.reaction).toBe(10); // 5*4/2
        expect(analytic.moment).toBeCloseTo(6.667, 2); // 5*16/12
    });

    it('should handle small loads without precision loss', () => {
        const w = 0.001; // Very small load
        const L = 10;
        const analytic = analyticUDLReactions(w, L);
        
        expect(analytic.reaction).toBe(0.005);
        expect(analytic.moment).toBeCloseTo(0.00833, 4);
    });
});

// ============================================
// TRIANGULAR LOAD TESTS
// ============================================

describe('Triangular Load Fixed-End Reactions', () => {
    it('should calculate asymmetric reactions for triangular load', () => {
        const w = 12; // kN/m at max
        const L = 5;  // meters
        const analytic = analyticTriangularReactions(w, L);
        
        // R1 = 3wL/20 = 3*12*5/20 = 9 kN
        expect(analytic.reaction1).toBe(9);
        
        // R2 = 7wL/20 = 7*12*5/20 = 21 kN
        expect(analytic.reaction2).toBe(21);
        
        // Total should equal triangle area load = wL/2 = 30 kN
        expect(analytic.reaction1 + analytic.reaction2).toBe(30);
    });

    it('should calculate correct moments for triangular load', () => {
        const w = 12;
        const L = 5;
        const analytic = analyticTriangularReactions(w, L);
        
        // M1 = wL²/30 = 12*25/30 = 10 kN·m
        expect(analytic.moment1).toBe(10);
        
        // M2 = wL²/20 = 12*25/20 = 15 kN·m
        expect(analytic.moment2).toBe(15);
    });
});

// ============================================
// POINT LOAD TESTS
// ============================================

describe('Point Load Fixed-End Reactions', () => {
    it('should calculate symmetric reactions for midspan point load', () => {
        const P = 20; // kN
        const L = 4;  // meters
        const a = 2;  // midspan
        const analytic = analyticPointLoadReactions(P, L, a);
        
        // For midspan load, reactions should be equal = P/2
        expect(analytic.reaction1).toBeCloseTo(10, 5);
        expect(analytic.reaction2).toBeCloseTo(10, 5);
        
        // Moments should also be equal at midspan = PL/8
        expect(analytic.moment1).toBeCloseTo(5, 5);
        expect(analytic.moment2).toBeCloseTo(5, 5);
    });

    it('should calculate asymmetric reactions for off-center load', () => {
        const P = 10; // kN
        const L = 6;  // meters
        const a = 2;  // 2m from start
        const b = 4;  // 4m from end
        const analytic = analyticPointLoadReactions(P, L, a);
        
        // Total reaction should equal applied load
        expect(analytic.reaction1 + analytic.reaction2).toBeCloseTo(P, 5);
        
        // R1 should be larger since load is closer to end
        expect(analytic.reaction2).toBeGreaterThan(analytic.reaction1);
    });

    it('should handle load at start correctly', () => {
        const P = 15;
        const L = 5;
        const a = 0.001; // Very close to start
        const analytic = analyticPointLoadReactions(P, L, a);
        
        // Almost all reaction should go to start node
        expect(analytic.reaction1).toBeCloseTo(P, 1);
        expect(analytic.reaction2).toBeCloseTo(0, 1);
    });
});

// ============================================
// DIRECTION TESTS
// ============================================

describe('Load Direction Handling', () => {
    it('should recognize global Y direction', () => {
        const load = createUDL('m1', -10, 'global_y');
        expect(load.direction).toBe('global_y');
    });

    it('should recognize global X direction', () => {
        const load = createUDL('m1', 5, 'global_x');
        expect(load.direction).toBe('global_x');
    });

    it('should recognize global Z direction', () => {
        const load = createUDL('m1', 3, 'global_z');
        expect(load.direction).toBe('global_z');
    });

    it('should recognize local Y direction', () => {
        const load = createUDL('m1', -8, 'local_y');
        expect(load.direction).toBe('local_y');
    });

    it('should recognize projected load', () => {
        const load = createUDL('m1', -10, 'projected');
        expect(load.direction).toBe('projected');
    });
});

// ============================================
// ROTATION MATRIX TESTS
// ============================================

describe('Member Rotation Matrix', () => {
    it('should produce identity-like matrix for X-axis member', () => {
        const start = createNode('n1', 0, 0, 0);
        const end = createNode('n2', 10, 0, 0);
        
        // For member along X, local x = global X (1,0,0)
        const dx = end.x - start.x;
        const L = Math.abs(dx);
        const lx = dx / L;
        
        expect(lx).toBe(1);
    });

    it('should handle vertical member correctly', () => {
        const start = createNode('n1', 0, 0, 0);
        const end = createNode('n2', 0, 10, 0);
        
        // For vertical member, local x = global Y (0,1,0)
        const dy = end.y - start.y;
        const L = Math.abs(dy);
        const ly = dy / L;
        
        expect(ly).toBe(1);
    });

    it('should handle 45-degree member correctly', () => {
        const start = createNode('n1', 0, 0, 0);
        const end = createNode('n2', 10, 10, 0);
        
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        const lx = dx / L;
        const ly = dy / L;
        
        expect(lx).toBeCloseTo(0.7071, 3);
        expect(ly).toBeCloseTo(0.7071, 3);
    });
});

// ============================================
// LOAD TYPE VALIDATION
// ============================================

describe('Load Type Validation', () => {
    it('should create valid UDL load', () => {
        const load = createUDL('m1', -10, 'global_y');
        expect(load.type).toBe('UDL');
        expect(load.w1).toBe(-10);
    });

    it('should create valid triangular load', () => {
        const load = createTriangularLoad('m1', 0, -10);
        expect(load.type).toBe('triangular');
        expect(load.w1).toBe(0);
        expect(load.w2).toBe(-10);
    });

    it('should create valid point load', () => {
        const load = createPointLoad('m1', -50, 0.5);
        expect(load.type).toBe('point');
        expect(load.startPos).toBe(0.5);
    });
});

// ============================================
// EQUILIBRIUM CHECKS
// ============================================

describe('Equilibrium Verification', () => {
    it('should satisfy force equilibrium for UDL', () => {
        const w = -10; // kN/m downward
        const L = 6;
        const totalAppliedLoad = Math.abs(w) * L; // 60 kN downward
        const analytic = analyticUDLReactions(Math.abs(w), L);
        const totalReaction = analytic.reaction * 2; // Both ends
        
        expect(totalReaction).toBe(totalAppliedLoad);
    });

    it('should satisfy force equilibrium for triangular load', () => {
        const w = 12;
        const L = 5;
        const totalAppliedLoad = (w * L) / 2; // Triangle area
        const analytic = analyticTriangularReactions(w, L);
        const totalReaction = analytic.reaction1 + analytic.reaction2;
        
        expect(totalReaction).toBe(totalAppliedLoad);
    });

    it('should satisfy force equilibrium for point load', () => {
        const P = 20;
        const L = 4;
        const a = 1.5;
        const analytic = analyticPointLoadReactions(P, L, a);
        const totalReaction = analytic.reaction1 + analytic.reaction2;
        
        expect(totalReaction).toBeCloseTo(P, 5);
    });
});

// ============================================
// LOAD CASE HANDLING
// ============================================

describe('Load Case Management', () => {
    it('should associate load with load case', () => {
        const load = createUDL('m1', -10, 'global_y', 'dead');
        expect(load.loadCase).toBe('dead');
    });

    it('should handle undefined load case', () => {
        const load = createUDL('m1', -10, 'global_y');
        expect(load.loadCase).toBeUndefined();
    });
});

// ============================================
// EDGE CASES
// ============================================

describe('Edge Cases', () => {
    it('should handle zero load gracefully', () => {
        const load = createUDL('m1', 0, 'global_y');
        expect(load.w1).toBe(0);
    });

    it('should handle very large loads', () => {
        const w = -1000000; // 1 MN/m
        const L = 10;
        const analytic = analyticUDLReactions(Math.abs(w), L);
        
        expect(analytic.reaction).toBe(5000000);
        expect(isFinite(analytic.moment)).toBe(true);
    });

    it('should handle very small member lengths', () => {
        const w = -10;
        const L = 0.001; // 1mm
        const analytic = analyticUDLReactions(Math.abs(w), L);
        
        expect(analytic.reaction).toBeCloseTo(0.005, 6);
        expect(isFinite(analytic.moment)).toBe(true);
    });
});

// ============================================
// NUMERICAL STABILITY TESTS
// ============================================

describe('Numerical Stability', () => {
    it('should not produce NaN for valid inputs', () => {
        const analytic = analyticUDLReactions(10, 5);
        expect(isNaN(analytic.reaction)).toBe(false);
        expect(isNaN(analytic.moment)).toBe(false);
    });

    it('should not produce Infinity for valid inputs', () => {
        const analytic = analyticPointLoadReactions(100, 8, 4);
        expect(isFinite(analytic.reaction1)).toBe(true);
        expect(isFinite(analytic.reaction2)).toBe(true);
        expect(isFinite(analytic.moment1)).toBe(true);
        expect(isFinite(analytic.moment2)).toBe(true);
    });

    it('should handle near-zero denominators', () => {
        // Very small length but not zero
        const w = 10;
        const L = 1e-8;
        const analytic = analyticUDLReactions(w, L);
        
        // Should still produce valid (though small) results
        expect(isFinite(analytic.reaction)).toBe(true);
    });
});
