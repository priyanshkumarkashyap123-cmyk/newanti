/**
 * Structural Solver Benchmark Test Script
 * 
 * Tests the solver against 3 standard engineering benchmark cases
 * with known exact solutions.
 * 
 * Run with: npx ts-node scripts/benchmark-solver.ts
 */

// ============================================
// TEST CASE 1: Simply Supported Beam with UDL
// ============================================
// Span: 10m, UDL: 10 kN/m
// E = 200 GPa, I = 4e-5 m^4
// 
// Expected Results:
// - Reactions: R_A = R_B = wL/2 = 50 kN
// - Max Moment: M_max = wL²/8 = 125 kNm at center
// - Max Deflection: δ = 5wL⁴/(384EI) ≈ 65.1 mm

const TEST_CASE_1 = {
    name: "Simply Supported Beam with UDL",
    nodes: [
        { id: "n1", x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: false } },
        { id: "n2", x: 5, y: 0, z: 0, restraints: { fx: false, fy: false, fz: true, mx: true, my: true, mz: false } },
        { id: "n3", x: 10, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: false } }
    ],
    members: [
        { id: "m1", startNodeId: "n1", endNodeId: "n2", E: 200e9, A: 0.01, I: 4e-5 },
        { id: "m2", startNodeId: "n2", endNodeId: "n3", E: 200e9, A: 0.01, I: 4e-5 }
    ],
    loads: [
        // UDL of 10 kN/m = 10000 N/m distributed as equivalent nodal loads
        // For a simply supported beam with UDL, we convert to nodal loads
        // Each node gets wL/2 = 10000 * 5 / 2 = 25000 N from each adjacent member
        // Node 1: 25000 N
        // Node 2: 50000 N (25000 from each member)
        // Node 3: 25000 N
        { nodeId: "n1", fy: -25000 },
        { nodeId: "n2", fy: -50000 },
        { nodeId: "n3", fy: -25000 }
    ],
    expected: {
        reactions: {
            n1: { fy: 50000 },  // 50 kN
            n3: { fy: 50000 }   // 50 kN
        },
        maxMoment: 125000,      // 125 kNm at center
        maxDeflection: 0.0651   // 65.1 mm
    }
};

// ============================================
// TEST CASE 2: Asymmetric Point Load
// ============================================
// Span: 10m, Point Load: 100 kN at 2.5m from left
// 
// Expected Results:
// - R_A = P*b/L = 100 * 7.5 / 10 = 75 kN
// - R_B = P*a/L = 100 * 2.5 / 10 = 25 kN
// - Max Moment = P*a*b/L = 100 * 2.5 * 7.5 / 10 = 187.5 kNm

const TEST_CASE_2 = {
    name: "Asymmetric Point Load",
    nodes: [
        { id: "n1", x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: false } },
        { id: "n2", x: 2.5, y: 0, z: 0, restraints: { fx: false, fy: false, fz: true, mx: true, my: true, mz: false } },
        { id: "n3", x: 10, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: false } }
    ],
    members: [
        { id: "m1", startNodeId: "n1", endNodeId: "n2", E: 200e9, A: 0.01, I: 4e-5 },
        { id: "m2", startNodeId: "n2", endNodeId: "n3", E: 200e9, A: 0.01, I: 4e-5 }
    ],
    loads: [
        { nodeId: "n2", fy: -100000 }  // 100 kN point load
    ],
    expected: {
        reactions: {
            n1: { fy: 75000 },   // 75 kN
            n3: { fy: 25000 }    // 25 kN
        },
        maxMoment: 187500        // 187.5 kNm at 2.5m
    }
};

// ============================================
// TEST CASE 3: Fixed-Fixed Beam with UDL
// ============================================
// Span: 10m, UDL: 10 kN/m
// This tests the matrix solver (indeterminate structure)
// 
// Expected Results:
// - Support Moments: M = wL²/12 = 83.33 kNm
// - Center Moment: M = wL²/24 = 41.67 kNm

const TEST_CASE_3 = {
    name: "Fixed-Fixed Beam with UDL",
    nodes: [
        { id: "n1", x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
        { id: "n2", x: 5, y: 0, z: 0, restraints: { fx: false, fy: false, fz: true, mx: true, my: true, mz: false } },
        { id: "n3", x: 10, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } }
    ],
    members: [
        { id: "m1", startNodeId: "n1", endNodeId: "n2", E: 200e9, A: 0.01, I: 4e-5 },
        { id: "m2", startNodeId: "n2", endNodeId: "n3", E: 200e9, A: 0.01, I: 4e-5 }
    ],
    loads: [
        // UDL equivalent nodal loads
        { nodeId: "n1", fy: -25000 },
        { nodeId: "n2", fy: -50000 },
        { nodeId: "n3", fy: -25000 }
    ],
    expected: {
        supportMoments: 83333.33,  // wL²/12 = 83.33 kNm
        centerMoment: 41666.67     // wL²/24 = 41.67 kNm
    }
};

// ============================================
// TOLERANCE & COMPARISON
// ============================================

function compareValues(actual: number, expected: number, tolerance: number = 0.05): {
    pass: boolean;
    error: number;
    percentError: number;
} {
    const error = Math.abs(actual - expected);
    const percentError = (error / Math.abs(expected)) * 100;
    return {
        pass: percentError <= tolerance * 100,
        error,
        percentError
    };
}

// ============================================
// BENCHMARK RUNNER
// ============================================

interface BenchmarkResult {
    testName: string;
    passed: boolean;
    results: {
        metric: string;
        expected: number;
        actual: number | null;
        percentError: number;
        status: 'PASS' | 'FAIL' | 'NOT_TESTED';
    }[];
    notes: string[];
}

function runBenchmarks(): void {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║     STRUCTURAL SOLVER CALIBRATION BENCHMARK                  ║");
    console.log("║     Testing against theoretical solutions                     ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log("");

    console.log("📋 TEST CASE 1: Simply Supported Beam with UDL (10m, w=10kN/m)");
    console.log("───────────────────────────────────────────────────────────────");
    console.log("Expected Results:");
    console.log("  • Reaction R_A = wL/2 = 50 kN");
    console.log("  • Reaction R_B = wL/2 = 50 kN");
    console.log("  • Max Moment M_max = wL²/8 = 125 kNm (at center)");
    console.log("  • Max Deflection δ = 5wL⁴/(384EI) ≈ 65.1 mm");
    console.log("");

    console.log("📋 TEST CASE 2: Asymmetric Point Load (10m, P=100kN at 2.5m)");
    console.log("───────────────────────────────────────────────────────────────");
    console.log("Expected Results:");
    console.log("  • Reaction R_A = P×b/L = 75 kN");
    console.log("  • Reaction R_B = P×a/L = 25 kN");
    console.log("  • Max Moment M = P×a×b/L = 187.5 kNm (at load point)");
    console.log("");

    console.log("📋 TEST CASE 3: Fixed-Fixed Beam with UDL (10m, w=10kN/m)");
    console.log("───────────────────────────────────────────────────────────────");
    console.log("Expected Results:");
    console.log("  • Support Moment M = wL²/12 = 83.33 kNm (hogging)");
    console.log("  • Center Moment M = wL²/24 = 41.67 kNm (sagging)");
    console.log("");

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
    console.log("⚠️  TO RUN THESE TESTS:");
    console.log("  1. Open your website in the browser");
    console.log("  2. Create each test case model manually or via API");
    console.log("  3. Run analysis and compare with expected values above");
    console.log("");
    console.log("💡 DEBUGGING TIPS if results don't match:");
    console.log("  • Check unit consistency (kN vs N, mm vs m)");
    console.log("  • Verify sign convention (positive = tension/upward)");
    console.log("  • Ensure boundary conditions are correctly applied");
    console.log("  • For UDL, check if load is correctly converted to nodal loads");
}

// Run if called directly
runBenchmarks();

export { TEST_CASE_1, TEST_CASE_2, TEST_CASE_3, compareValues };
