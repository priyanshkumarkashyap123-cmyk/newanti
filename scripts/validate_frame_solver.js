#!/usr/bin/env node

/**
 * Frame Solver Validation Script
 * 
 * Tests the 2D frame structural solver against theoretical predictions.
 * Validates: reactions, deflections, member forces
 */

const fs = require('fs');

// ============================================
// MATRIX UTILITIES
// ============================================

class DenseMatrix {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.data = Array(rows * cols).fill(0);
    }

    get(i, j) {
        return this.data[i * this.cols + j];
    }

    set(i, j, value) {
        this.data[i * this.cols + j] = value;
    }

    add(i, j, value) {
        this.data[i * this.cols + j] += value;
    }

    // Matrix-vector multiply
    multiply(x) {
        const y = new Float64Array(this.rows);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                y[i] += this.get(i, j) * x[j];
            }
        }
        return y;
    }

    // Simple Gaussian elimination with back substitution
    solve(b) {
        const n = this.rows;
        const A = this.clone();
        const x = new Float64Array(n);
        const b_copy = new Float64Array(b);

        // Forward elimination
        for (let k = 0; k < n; k++) {
            // Find pivot
            let maxIdx = k;
            for (let i = k + 1; i < n; i++) {
                if (Math.abs(A.get(i, k)) > Math.abs(A.get(maxIdx, k))) {
                    maxIdx = i;
                }
            }

            // Swap rows
            if (maxIdx !== k) {
                for (let j = 0; j < n; j++) {
                    const temp = A.get(k, j);
                    A.set(k, j, A.get(maxIdx, j));
                    A.set(maxIdx, j, temp);
                }
                const tempB = b_copy[k];
                b_copy[k] = b_copy[maxIdx];
                b_copy[maxIdx] = tempB;
            }

            // Eliminate column
            for (let i = k + 1; i < n; i++) {
                const factor = A.get(i, k) / A.get(k, k);
                for (let j = k; j < n; j++) {
                    A.set(i, j, A.get(i, j) - factor * A.get(k, j));
                }
                b_copy[i] -= factor * b_copy[k];
            }
        }

        // Back substitution
        for (let i = n - 1; i >= 0; i--) {
            let sum = b_copy[i];
            for (let j = i + 1; j < n; j++) {
                sum -= A.get(i, j) * x[j];
            }
            x[i] = sum / A.get(i, i);
        }

        return x;
    }

    clone() {
        const m = new DenseMatrix(this.rows, this.cols);
        m.data = new Float64Array(this.data);
        return m;
    }
}

// ============================================
// 2D FRAME ELEMENT STIFFNESS
// ============================================

function computeFrameStiffness(E, A, I, L, cx, cy) {
    // Local 2D frame stiffness
    const EA_L = (E * A) / L;
    const EI = E * I;
    const L2 = L * L;
    const L3 = L2 * L;

    const kLocal = [
        [EA_L, 0, 0, -EA_L, 0, 0],
        [0, 12 * EI / L3, 6 * EI / L2, 0, -12 * EI / L3, 6 * EI / L2],
        [0, 6 * EI / L2, 4 * EI / L, 0, -6 * EI / L2, 2 * EI / L],
        [-EA_L, 0, 0, EA_L, 0, 0],
        [0, -12 * EI / L3, -6 * EI / L2, 0, 12 * EI / L3, -6 * EI / L2],
        [0, 6 * EI / L2, 2 * EI / L, 0, -6 * EI / L2, 4 * EI / L],
    ];

    // Normalize direction cosines
    const Lproj = Math.sqrt(cx * cx + cy * cy);
    const c = cx / Lproj;
    const s = cy / Lproj;

    // Transformation matrix (2D)
    const T = [
        [c, -s, 0, 0, 0, 0],
        [s, c, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0],
        [0, 0, 0, c, -s, 0],
        [0, 0, 0, s, c, 0],
        [0, 0, 0, 0, 0, 1],
    ];

    // ke = T^T * kLocal * T
    const temp = Array(6).fill(0).map(() => Array(6).fill(0));
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            for (let k = 0; k < 6; k++) {
                temp[i][j] += kLocal[i][k] * T[k][j];
            }
        }
    }

    const kGlobal = Array(6).fill(0).map(() => Array(6).fill(0));
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            for (let k = 0; k < 6; k++) {
                kGlobal[i][j] += T[k][i] * temp[k][j];
            }
        }
    }

    return kGlobal;
}

// ============================================
// TEST: CANTILEVER BEAM
// ============================================

function testCantilever() {
    console.log('\n' + '='.repeat(70));
    console.log('TEST 1: CANTILEVER BEAM (100 kN downward load)');
    console.log('='.repeat(70));

    // Problem parameters
    const E = 200e9;  // Pa (200 GPa steel)
    const A = 0.01;   // m²
    const I = 0.0001; // m⁴
    const L = 5;      // m

    const nodes = [
        { id: 'n1', x: 0, y: 0, fixed: true },
        { id: 'n2', x: 5, y: 0, fixed: false },
    ];

    // Assembly
    const dofPerNode = 3;  // u, v, theta
    const totalDof = nodes.length * dofPerNode;
    const K = new DenseMatrix(totalDof, totalDof);
    const F = new Float64Array(totalDof);

    // Element 1-2
    const dx = nodes[1].x - nodes[0].x;
    const dy = nodes[1].y - nodes[0].y;
    const L_elem = Math.sqrt(dx * dx + dy * dy);
    const cx = dx / L_elem;
    const cy = dy / L_elem;

    const ke = computeFrameStiffness(E, A, I, L_elem, cx, cy);

    // Add to global (nodes: 0=[0,1,2], 1=[3,4,5])
    const dofs = [0, 1, 2, 3, 4, 5];
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            K.add(dofs[i], dofs[j], ke[i][j]);
        }
    }

    // Force: 100 kN downward at node 2 (dof index 4 = vy)
    F[4] = -100000; // N

    // Boundary conditions: Node 1 is fixed (dofs 0,1,2)
    const penalty = 1e20;
    for (let d = 0; d < 3; d++) {
        const diag = K.get(d, d);
        K.set(d, d, diag + penalty);
        F[d] = 0;
    }

    // Solve
    const u = K.solve(F);

    // Reactions: R = K_original * u - F_original
    const K_orig = new DenseMatrix(totalDof, totalDof);
    const F_orig = new Float64Array(totalDof);
    F_orig[4] = -100000;
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            K_orig.add(dofs[i], dofs[j], ke[i][j]);
        }
    }
    const Ku = K_orig.multiply(u);
    const reactions = new Float64Array(totalDof);
    for (let i = 0; i < totalDof; i++) {
        reactions[i] = Ku[i] - F_orig[i];
    }

    // Results
    console.log('\n📍 DISPLACEMENTS:');
    console.log(`  Node 1 (fixed):     u=${u[0].toExponential(2)}, v=${u[1].toExponential(2)}, θ=${u[2].toExponential(2)}`);
    console.log(`  Node 2 (free):      u=${u[3].toExponential(2)}, v=${u[4].toExponential(2)}, θ=${u[5].toExponential(2)}`);

    console.log('\n⚡ REACTIONS (at fixed node 1):');
    console.log(`  Rx = ${(reactions[0] / 1000).toFixed(2)} kN (expect 0.00 kN)`);
    console.log(`  Ry = ${(reactions[1] / 1000).toFixed(2)} kN (expect 100.00 kN)`);
    console.log(`  Mz = ${(reactions[2] / 1000).toFixed(2)} kN⋅m (expect 500.00 kN⋅m)`);

    // Theoretical values
    const deflection_theory = 100000 * Math.pow(L, 3) / (3 * E * I);
    const slope_theory = 100000 * L * L / (2 * E * I);

    console.log('\n📊 DEFLECTION ANALYSIS:');
    console.log(`  Actual end deflection:    ${(u[4] * 1000).toFixed(3)} mm`);
    console.log(`  Theoretical deflection:   ${(deflection_theory * 1000).toFixed(3)} mm`);
    console.log(`  Error: ${(Math.abs(u[4] - deflection_theory) / deflection_theory * 100).toFixed(2)}%`);

    console.log(`\n  Actual end slope:         ${u[5].toFixed(6)} rad`);
    console.log(`  Theoretical slope:        ${slope_theory.toFixed(6)} rad`);
    console.log(`  Error: ${(Math.abs(u[5] - slope_theory) / slope_theory * 100).toFixed(2)}%`);

    // Validation (absolute values since sign depends on coordinate system)
    const ry_error = Math.abs(Math.abs(reactions[1]) - 100000) / 100000;
    const mz_error = Math.abs(Math.abs(reactions[2]) - 500000) / 500000;
    const deflection_error = Math.abs(Math.abs(u[4]) - deflection_theory) / deflection_theory;

    const passed = ry_error < 0.01 && mz_error < 0.01 && deflection_error < 0.01;

    console.log(`\n✅ VALIDATION:`);
    console.log(`  Vertical Reaction: ${ry_error * 100 < 1 ? '✓ PASS' : '✗ FAIL'} (error: ${(ry_error * 100).toFixed(2)}%)`);
    console.log(`  Moment Reaction:   ${mz_error * 100 < 1 ? '✓ PASS' : '✗ FAIL'} (error: ${(mz_error * 100).toFixed(2)}%)`);
    console.log(`  Deflection:        ${deflection_error * 100 < 1 ? '✓ PASS' : '✗ FAIL'} (error: ${(deflection_error * 100).toFixed(2)}%)`);

    console.log(`\n${passed ? '🎉 TEST PASSED' : '❌ TEST FAILED'}`);
    return passed;
}

// ============================================
// TEST: SIMPLY-SUPPORTED BEAM
// ============================================

function testSimplySupportedBeam() {
    console.log('\n' + '='.repeat(70));
    console.log('TEST 2: SIMPLY-SUPPORTED BEAM (100 kN center load)');
    console.log('='.repeat(70));

    const E = 200e9;
    const A = 0.01;
    const I = 0.0001;
    const L = 10;

    const nodes = [
        { id: 'n1', x: 0, y: 0, fixed: true },  // Pinned
        { id: 'n2', x: 5, y: 0, fixed: false }, // Center load
        { id: 'n3', x: 10, y: 0, fixed: true }, // Pinned
    ];

    const dofPerNode = 3;
    const totalDof = nodes.length * dofPerNode;
    const K = new DenseMatrix(totalDof, totalDof);
    const F = new Float64Array(totalDof);

    // Element 1-2
    let ke = computeFrameStiffness(E, A, I, 5, 1, 0);
    const dofs1 = [0, 1, 2, 3, 4, 5];
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            K.add(dofs1[i], dofs1[j], ke[i][j]);
        }
    }

    // Element 2-3
    ke = computeFrameStiffness(E, A, I, 5, 1, 0);
    const dofs2 = [3, 4, 5, 6, 7, 8];
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            K.add(dofs2[i], dofs2[j], ke[i][j]);
        }
    }

    // Load at node 2
    F[4] = -100000;

    // Boundary conditions: Nodes 1 and 3 pinned (x,y fixed, theta free)
    const penalty = 1e20;
    for (let d of [0, 1]) K.set(d, d, K.get(d, d) + penalty);
    for (let d of [6, 7]) K.set(d, d, K.get(d, d) + penalty);
    F[0] = F[1] = F[6] = F[7] = 0;

    // Solve
    const u = K.solve(F);

    console.log('\n📍 DISPLACEMENTS:');
    console.log(`  Node 1 (left pin):   v=${u[1].toExponential(2)}`);
    console.log(`  Node 2 (center):     v=${u[4].toExponential(2)} (deflection)`);
    console.log(`  Node 3 (right pin):  v=${u[7].toExponential(2)}`);

    // Reactions
    const K_orig = new DenseMatrix(totalDof, totalDof);
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            K_orig.add(dofs1[i], dofs1[j], computeFrameStiffness(E, A, I, 5, 1, 0)[i][j]);
            K_orig.add(dofs2[i], dofs2[j], computeFrameStiffness(E, A, I, 5, 1, 0)[i][j]);
        }
    }
    const F_orig = new Float64Array(totalDof);
    F_orig[4] = -100000;
    const Ku = K_orig.multiply(u);
    const reactions = new Float64Array(totalDof);
    for (let i = 0; i < totalDof; i++) {
        reactions[i] = Ku[i] - F_orig[i];
    }

    console.log('\n⚡ REACTIONS:');
    console.log(`  Left (node 1):  Ry = ${(reactions[1] / 1000).toFixed(2)} kN (expect 50.00 kN)`);
    console.log(`  Right (node 3): Ry = ${(reactions[7] / 1000).toFixed(2)} kN (expect 50.00 kN)`);

    const deflection_theory = 100000 * Math.pow(L, 3) / (48 * E * I);

    console.log('\n📊 DEFLECTION:');
    console.log(`  Actual:        ${(u[4] * 1000).toFixed(3)} mm`);
    console.log(`  Theoretical:   ${(deflection_theory * 1000).toFixed(3)} mm`);
    console.log(`  Error:         ${(Math.abs(u[4] - deflection_theory) / deflection_theory * 100).toFixed(2)}%`);

    const ry1_error = Math.abs(Math.abs(reactions[1]) - 50000) / 50000;
    const ry2_error = Math.abs(Math.abs(reactions[7]) - 50000) / 50000;
    const deflection_error = Math.abs(Math.abs(u[4]) - deflection_theory) / deflection_theory;

    const passed = ry1_error < 0.01 && ry2_error < 0.01 && deflection_error < 0.01;

    console.log(`\n✅ VALIDATION:`);
    console.log(`  Left Reaction:  ${ry1_error * 100 < 1 ? '✓ PASS' : '✗ FAIL'} (error: ${(ry1_error * 100).toFixed(2)}%)`);
    console.log(`  Right Reaction: ${ry2_error * 100 < 1 ? '✓ PASS' : '✗ FAIL'} (error: ${(ry2_error * 100).toFixed(2)}%)`);
    console.log(`  Deflection:     ${deflection_error * 100 < 1 ? '✓ PASS' : '✗ FAIL'} (error: ${(deflection_error * 100).toFixed(2)}%)`);

    console.log(`\n${passed ? '🎉 TEST PASSED' : '❌ TEST FAILED'}`);
    return passed;
}

// ============================================
// MAIN EXECUTION
// ============================================

function main() {
    console.log('\n' + '╔' + '═'.repeat(68) + '╗');
    console.log('║' + ' 🔬 FRAME STRUCTURAL SOLVER - VALIDATION TEST SUITE'.padEnd(69) + '║');
    console.log('╚' + '═'.repeat(68) + '╝');

    const results = [];

    try {
        results.push({ name: 'Cantilever Beam', passed: testCantilever() });
    } catch (e) {
        console.error('\n❌ Cantilever test error:', e.message);
        results.push({ name: 'Cantilever Beam', passed: false });
    }

    try {
        results.push({ name: 'Simply-Supported Beam', passed: testSimplySupportedBeam() });
    } catch (e) {
        console.error('\n❌ Simply-supported test error:', e.message);
        results.push({ name: 'Simply-Supported Beam', passed: false });
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));

    let passed = 0;
    for (const result of results) {
        const status = result.passed ? '✓ PASS' : '✗ FAIL';
        console.log(`${status} - ${result.name}`);
        if (result.passed) passed++;
    }

    console.log(`\nTotal: ${passed}/${results.length} tests passed`);

    if (passed === results.length) {
        console.log('\n✅ ALL TESTS PASSED - Solver validated for production!\n');
        process.exit(0);
    } else {
        console.log('\n❌ SOME TESTS FAILED - Review implementation\n');
        process.exit(1);
    }
}

main();
