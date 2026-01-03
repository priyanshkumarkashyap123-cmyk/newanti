import { analyzeStructure3D } from "./solver3d";
import { BeamTheory } from "./solver3d";
console.log("==========================================");
console.log("VERIFYING 3D SOLVER (solver3d.ts)");
console.log("==========================================");
const L = 2;
const P = -10;
const E = 2e8;
const Iz = 1e-4;
const Iy = 1e-4;
const G = 8e7;
const J = 1e-4;
const nodes = [
  { id: "n1", x: 0, y: 0, z: 0 },
  { id: "n2", x: 2, y: 0, z: 0 }
];
const material = { E, G, rho: 7850 };
const section = { A: 0.01, Iy, Iz, J };
const members = [
  { id: "m1", startNodeId: "n1", endNodeId: "n2", material, section, theory: BeamTheory.EULER_BERNOULLI }
];
const loads = [
  { nodeId: "n2", fy: P }
];
const request = {
  nodes: nodes.map((n) => ({ ...n, restraints: n.id === "n1" ? { dx: true, dy: true, dz: true, rx: true, ry: true, rz: true } : void 0 })),
  members,
  loads
};
try {
  const result = analyzeStructure3D(request);
  const n2Disp = result.displacements["n2"];
  if (!n2Disp) throw new Error("Node n2 results not found");
  const Dy_calc = n2Disp.dy;
  const Dy_theory = P * Math.pow(L, 3) / (3 * E * Iz);
  console.log(`
Test Case 1: Cantilever Bending (Fy = ${P} kN)`);
  console.log(`Length: ${L} m, E: ${E / 1e6} GPa, Iz: ${Iz} m4`);
  console.log(`Tip Disp Actual: ${Dy_calc.toExponential(4)} m`);
  console.log(`Tip Disp Theory: ${Dy_theory.toExponential(4)} m`);
  const error = Math.abs((Dy_calc - Dy_theory) / Dy_theory) * 100;
  console.log(`Error: ${error.toFixed(4)}%`);
  if (error < 0.1) console.log("\u2705 Bending Verification Passed");
  else console.log("\u274C Bending Verification Failed");
  const T = 5;
  const loads2 = [
    { nodeId: "n2", mx: T }
  ];
  const result2 = analyzeStructure3D({ ...request, loads: loads2 });
  const n2Disp2 = result2.displacements["n2"];
  if (!n2Disp2) throw new Error("Node n2 results (torsion) not found");
  const Rx_calc = n2Disp2.rx;
  const Rx_theory = T * L / (G * J);
  console.log(`
Test Case 2: Cantilever Torsion (Mx = ${T} kNm)`);
  console.log(`Torque: ${T} kNm, G: ${G / 1e6} GPa, J: ${J} m4`);
  console.log(`Rotation Actual: ${Rx_calc.toExponential(4)} rad`);
  console.log(`Rotation Theory: ${Rx_theory.toExponential(4)} rad`);
  const error2 = Math.abs((Rx_calc - Rx_theory) / Rx_theory) * 100;
  console.log(`Error: ${error2.toFixed(4)}%`);
  if (error2 < 0.1) console.log("\u2705 Torsion Verification Passed");
  else console.log("\u274C Torsion Verification Failed");
} catch (err) {
  console.error("Verification Error:", err);
}
//# sourceMappingURL=verify_solver3d.js.map
