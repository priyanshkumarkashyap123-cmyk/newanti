/**
 * PHASE 4 SPRINT 1 - TOPOLOGY OPTIMIZATION VALIDATION
 * 
 * File: scripts/validate-optimization.js
 * Command: node scripts/validate-optimization.js
 * 
 * Objectives:
 * 1. Verify Sensitivity Calculation.
 * 2. Verify Optimality Criteria (OC) Update behavior.
 */

// Mock functions from compute-optimization.ts
function computeSensitivity(rho, p, strainEnergy) {
    return -p * Math.pow(rho, p - 1) * strainEnergy;
}

function updateDensitiesOC(densities, sensitivities, volumes, targetVolume, moveLimit = 0.2, eta = 0.5) {
    let l1 = 0, l2 = 1e9;
    const newDensities = new Array(densities.length);

    // Simple Bisection
    for (let iter = 0; iter < 50; iter++) {
        const lmid = 0.5 * (l1 + l2);
        let vol = 0;
        for (let i = 0; i < densities.length; i++) {
            const x = densities[i];
            const dc = sensitivities[i];
            const v = volumes[i];

            // Be = (-dc/v) / lambda
            const Be = (-dc / v) / lmid;
            let x_new = x * Math.pow(Be, eta);
            x_new = Math.max(0.001, Math.max(x - moveLimit, Math.min(1.0, Math.min(x + moveLimit, x_new))));
            newDensities[i] = x_new;
            vol += x_new * v;
        }

        if (vol > targetVolume) l1 = lmid;
        else l2 = lmid;
    }
    return newDensities;
}

function testOptimization() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: 2-Element Material Redistribution');
    console.log('='.repeat(60));

    // Setup: 2 Elements with equal volume
    // Element 1 has HIGH Strain Energy (needs more material)
    // Element 2 has LOW Strain Energy (needs less material)

    const densities = [0.5, 0.5]; // 50% initial
    const volumes = [1.0, 1.0];
    const targetVolume = 1.0; // 50% total

    // Strain Energies (U = u^T K0 u)
    const U1 = 1000; // High Load
    const U2 = 100;  // Low Load

    // Compute Sensitivities (p=3)
    const p = 3;
    const s1 = computeSensitivity(densities[0], p, U1);
    const s2 = computeSensitivity(densities[1], p, U2);

    console.log(`Initial State:`);
    console.log(`  Elem 1: rho=${densities[0]}, Energy=${U1}, Sens=${s1.toFixed(2)}`);
    console.log(`  Elem 2: rho=${densities[1]}, Energy=${U2}, Sens=${s2.toFixed(2)}`);

    // Expect s1 to be more negative than s2 (steeper slope means reducing rho hurts more)
    // s1 = -3 * 0.25 * 1000 = -750
    // s2 = -3 * 0.25 * 100 = -75

    // Update
    const newDensities = updateDensitiesOC(densities, [s1, s2], volumes, targetVolume);

    console.log(`\nUpdated State (Target Vol=${targetVolume}):`);
    console.log(`  Elem 1: rho=${newDensities[0].toFixed(4)} (Expected Increase)`);
    console.log(`  Elem 2: rho=${newDensities[1].toFixed(4)} (Expected Decrease)`);

    const totalVol = newDensities[0] * volumes[0] + newDensities[1] * volumes[1];
    console.log(`  Total Volume: ${totalVol.toFixed(4)}`);

    if (newDensities[0] > densities[0] && newDensities[1] < densities[1]) {
        console.log(`\nPASS: Material redistributed correctly to high-energy element.`);
    } else {
        console.log(`\nFAIL: Incorrect redistribution.`);
    }
}

testOptimization();
