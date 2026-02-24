/**
 * PHASE 3 SPRINT 2 - DYNAMIC ANALYSIS VALIDATION
 * 
 * File: scripts/validate-dynamic.js
 * Command: node scripts/validate-dynamic.js
 * 
 * Objectives:
 * 1. Verify Natural Frequency calculation logic.
 * 2. Predict SDOF Time History response.
 */

function testSDOF() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: SDOF Natural Frequency & Period');
    console.log('='.repeat(60));

    // Properties
    const k = 1000; // N/m
    const m = 10;   // kg

    // Theoretical Natural Frequency (rad/s)
    // wn = sqrt(k/m)
    const wn = Math.sqrt(k / m);

    // Frequency (Hz)
    // f = wn / 2pi
    const f = wn / (2 * Math.PI);

    // Period (s)
    // T = 1/f
    const T = 1 / f;

    console.log(`System Properties:`);
    console.log(`  Stiffness k: ${k} N/m`);
    console.log(`  Mass m:      ${m} kg`);
    console.log(`\nTheoretical Results:`);
    console.log(`  Natural Freq (wn): ${wn.toFixed(4)} rad/s`);
    console.log(`  Frequency (f):     ${f.toFixed(4)} Hz`);
    console.log(`  Period (T):        ${T.toFixed(4)} s`);

    // Verify Newmark-Beta Stability Condition
    // Average Acceleration (gamma=0.5, beta=0.25) is unconditionally stable.
    // However, accuracy depends on time step dt.
    // Rule of thumb: dt <= T / 10
    const dt_recommended = T / 20;
    console.log(`\nRecommended Time Step (dt <= T/20): ${dt_recommended.toFixed(4)} s`);

    // Simulation Prototype (Explicit Euler for simple check, Newmark is implemented in worker)
    // Let's simualte 1 cycle using Newmark logic manually to verify algorithm steps.

    console.log(`\nManual Newmark-Beta Step Verification (1 step):`);
    const dt = 0.01;
    const beta = 0.25;
    const gamma = 0.5;

    // Initial State
    let u = 1.0; // Initial displacement 1m
    let v = 0.0;
    let a = (0 - k * u) / m; // Initial accel (F=0 => ma + ku = 0 => a = -ku/m)
    // a = -1000*1 / 10 = -100 m/s2

    console.log(`  Time 0.00s: u=${u.toFixed(4)}, v=${v.toFixed(4)}, a=${a.toFixed(4)}`);

    // Step 1
    // Coefficients
    const a0 = 1 / (beta * dt * dt);
    const a1 = gamma / (beta * dt);
    const a2 = 1 / (beta * dt);
    const a3 = 1 / (2 * beta) - 1;

    // Effective Stiffness K_hat
    const K_hat = k + a0 * m;

    // Effective Load F_hat
    const F_ext = 0;
    // F_hat = F_ext + M*(a0*u + a2*v + a3*a)
    const F_hat = F_ext + m * (a0 * u + a2 * v + a3 * a);

    // Solve K_hat * u_next = F_hat
    const u_next = F_hat / K_hat;

    // Update Kinematics
    const du = u_next - u;
    const a_next = a0 * du - a2 * v - a3 * a; // Derived form
    const v_next = v + dt * ((1 - gamma) * a + gamma * a_next);

    console.log(`  Time ${dt.toFixed(2)}s:`);
    console.log(`    K_hat: ${K_hat.toFixed(2)}`);
    console.log(`    F_hat: ${F_hat.toFixed(2)}`);
    console.log(`    u_next: ${u_next.toFixed(4)}`);
    console.log(`    v_next: ${v_next.toFixed(4)}`);
    console.log(`    a_next: ${a_next.toFixed(4)}`);

    // Analytical Solution at t=0.01
    // u(t) = u0 * cos(wn*t)
    const u_exact = 1.0 * Math.cos(wn * dt);
    console.log(`    u_EXACT: ${u_exact.toFixed(4)}`);
    console.log(`    Diff: ${Math.abs(u_next - u_exact).toFixed(6)}`);

    // If Diff is small, Newmark logic is correct (for 1 step).
}

testSDOF();
