
import { analyzeStructure3D } from './solver3d.js';
import { AnalysisRequest3D, Node3D, Member3D, NodeLoad, Material, Section, BeamTheory } from './solver3d.js';

// Type alias for backwards compatibility
type Load3D = NodeLoad;

console.log("==========================================");
console.log("VERIFYING 3D SOLVER (solver3d.ts)");
console.log("==========================================");

// Case 1: Cantilever Beam (Tip Load)
// Length = 2m
// Load = -10 kN (Fy)
// E = 200 GPa, Iz = 1e-4 m4
// Expected Deflection Dy = PL^3 / 3EI

const L = 2.0;
const P = -10.0; // kN
const E = 200e6; // kN/m2 (200 GPa)
const Iz = 1e-4; // m4
const Iy = 1e-4; // m4
const G = 80e6;  // kN/m2
const J = 1e-4;  // m4

const nodes: Node3D[] = [
    { id: 'n1', x: 0, y: 0, z: 0 },
    { id: 'n2', x: 2, y: 0, z: 0 }
];

const material: Material = { E, G, rho: 7850 };
const section: Section = { A: 0.01, Iy, Iz, J };

const members: Member3D[] = [
    { id: 'm1', startNodeId: 'n1', endNodeId: 'n2', material, section, theory: BeamTheory.EULER_BERNOULLI }
];

const loads: Load3D[] = [
    { id: 'load1', nodeId: 'n2', fy: P }
];

// Correct structure for analysis request
const request: AnalysisRequest3D = {
    nodes: nodes.map(n => ({ ...n, restraints: n.id === 'n1' ? { dx: true, dy: true, dz: true, rx: true, ry: true, rz: true } : undefined })),
    members,
    loads
};

try {
    const result = analyzeStructure3D(request);

    // Check Dy at n2 using correct API: result.displacements['n2'].dy
    const n2Disp = result.displacements['n2'];
    if (!n2Disp) throw new Error("Node n2 results not found");
    const Dy_calc = n2Disp.dy; // uy

    const Dy_theory = (P * Math.pow(L, 3)) / (3 * E * Iz);

    console.log(`\nTest Case 1: Cantilever Bending (Fy = ${P} kN)`);
    console.log(`Length: ${L} m, E: ${E / 1e6} GPa, Iz: ${Iz} m4`);
    console.log(`Tip Disp Actual: ${Dy_calc.toExponential(4)} m`);
    console.log(`Tip Disp Theory: ${Dy_theory.toExponential(4)} m`);

    const error = Math.abs((Dy_calc - Dy_theory) / Dy_theory) * 100;
    console.log(`Error: ${error.toFixed(4)}%`);

    if (error < 0.1) console.log("✅ Bending Verification Passed");
    else console.log("❌ Bending Verification Failed");

    // Case 2: Torsion
    // Apply Torque Mx = 5 kNm
    // Rotation Rx = TL / GJ

    const T = 5.0;
    const loads2: Load3D[] = [
        { id: 'load2', nodeId: 'n2', mx: T }
    ];

    const result2 = analyzeStructure3D({ ...request, loads: loads2 });
    const n2Disp2 = result2.displacements['n2'];
    if (!n2Disp2) throw new Error("Node n2 results (torsion) not found");

    const Rx_calc = n2Disp2.rx; // rx (rotation about x)

    const Rx_theory = (T * L) / (G * J);

    console.log(`\nTest Case 2: Cantilever Torsion (Mx = ${T} kNm)`);
    console.log(`Torque: ${T} kNm, G: ${G / 1e6} GPa, J: ${J} m4`);
    console.log(`Rotation Actual: ${Rx_calc.toExponential(4)} rad`);
    console.log(`Rotation Theory: ${Rx_theory.toExponential(4)} rad`);

    const error2 = Math.abs((Rx_calc - Rx_theory) / Rx_theory) * 100;
    console.log(`Error: ${error2.toFixed(4)}%`);

    if (error2 < 0.1) console.log("✅ Torsion Verification Passed");
    else console.log("❌ Torsion Verification Failed");

} catch (err) {
    console.error("Verification Error:", err);
}
