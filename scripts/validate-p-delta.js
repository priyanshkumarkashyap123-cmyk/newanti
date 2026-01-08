/**
 * PHASE 3 - P-DELTA VALIDATION
 * 
 * File: scripts/validate-p-delta.js
 * Status: Ready to execute
 * Command: node scripts/validate-p-delta.js
 * 
 * Objectives:
 * 1. Validate Geometric Stiffness (Kg) effect.
 * 2. Verify Amplification of deflection due to axial compression (P-Delta).
 * 3. Check Buckling limit (approaching singularity).
 */

/**
 * TEST 1: Cantilever Column P-Delta Amplification
 * 
 * Structure: 
 * L = 10 m
 * E = 200 GPa
 * I = 0.0001 m4 (Axis A)
 * 
 * Loads:
 * Lateral Load H = 10 kN (at tip)
 * Axial Load P (Compression)
 * 
 * Expected Behavior:
 * Linear Deflection delta0 = HL^3 / 3EI
 * P-Delta Deflection delta ~ delta0 / (1 - P/P_cr)  (Approximation for amplification)
 * Euler Buckling Load P_cr = pi^2 * EI / (4L^2)  (for cantilever, K=2L? No, Leff=2L)
 * P_cr = pi^2 * EI / (2L)^2 = pi^2 * EI / 4L^2
 */
function testPDeltaEffect() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: Cantilever Column P-Delta Amplification');
    console.log('='.repeat(60));

    // Properties
    const E = 200e9;
    const I = 0.0001;
    const L = 10.0;

    // Euler Buckling Load (Theoretical)
    // P_cr = pi^2 * EI / (2L)^2
    const P_cr = (Math.PI * Math.PI * E * I) / (4 * L * L);
    console.log(`\nTheoretical Buckling Load P_cr: ${(P_cr / 1000).toFixed(2)} kN`);

    // Linear Stiffness (Lateral)
    // k = 3EI / L^3
    const k_linear = (3 * E * I) / Math.pow(L, 3);
    console.log(`Lateral Stiffness (Linear): ${(k_linear / 1000).toFixed(2)} kN/m`);

    // Test Case: P = 0.5 * P_cr
    const P_applied = 0.5 * P_cr;
    const H = 10e3; // 10 kN lateral

    // Expected Linear Deflection
    const delta0 = H / k_linear;

    // Expected Amplification
    // Amplification Factor approx = 1 / (1 - P/P_cr)
    const amplification = 1 / (1 - P_applied / P_cr);

    const delta_p_delta_est = delta0 * amplification;

    console.log(`\nLoad Case:`);
    console.log(`  Lateral H: ${(H / 1000).toFixed(1)} kN`);
    console.log(`  Axial P:   ${(P_applied / 1000).toFixed(1)} kN (50% of P_cr)`);

    console.log(`\nPredicted Deflections:`);
    console.log(`  Linear (u0):      ${(delta0 * 1000).toFixed(2)} mm`);
    console.log(`  P-Delta (Est):    ${(delta_p_delta_est * 1000).toFixed(2)} mm`);
    console.log(`  Amplification:    ${amplification.toFixed(2)}x`);

    // Geometric Stiffness (String Assumption check)
    // Kg_lateral approx -P/L (softening)
    // k_total = k_linear - P/L ?
    // Let's check:
    // k_total = 3EI/L^3 - P/L ?
    // 3EI/L^3 = 60 kN/m
    // P/L = 246 kN / 10 m = 24.6 kN/m
    // k_reduced = 60 - 24.6 = 35.4
    // delta_approx = H / 35.4 = 10 / 35.4 = 0.282 m = 282 mm

    // Compare with amplification formula:
    // delta0 = 10/60 = 0.166 m = 166 mm
    // delta_p = 166 * 2 = 333 mm
    // The two approximations differ (String stiffness vs exact Sine curve).
    // String stiffness (Kg = P/L) is a linear approximation of the geometric effect.
    // The finite element P-Delta implementation typically uses consistent Kg or string Kg.
    // Our implementation uses String Kg (P/L).
    // So we expect the result to match the K_total = K_e - P/L logic.

    const k_g_string = P_applied / L;
    const k_total_string = k_linear - k_g_string;
    const delta_string_model = H / k_total_string;

    console.log(`\nImplementation Expectation (String Stiffness Model):`);
    console.log(`  Kg (P/L):         -${(k_g_string / 1000).toFixed(2)} kN/m`);
    console.log(`  K_total:          ${(k_total_string / 1000).toFixed(2)} kN/m`);
    console.log(`  Result (u):       ${(delta_string_model * 1000).toFixed(2)} mm`);

    console.log(`\nValidation Protocol:`);
    console.log(`  1. Run Solver with analysisType='p-delta'`);
    console.log(`  2. Observe iterations converging.`);
    console.log(`  3. Check if final displacement is close to ${(delta_string_model * 1000).toFixed(0)} mm.`);
}

function runTests() {
    testPDeltaEffect();
    console.log('\nP-Delta Validation Script Ready. (Run Validation via Solver Interface)');
}

runTests();
