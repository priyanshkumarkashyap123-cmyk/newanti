/**
 * Local structural analysis using the Rust WASM Solver
 * No backend required - runs entirely in the browser using WebAssembly
 */

import { useModelStore, type AnalysisResults } from "../store/model";
import { SparseMatrixAssembler } from "../utils/SparseMatrixAssembler";

// WASM functions are loaded dynamically at runtime to avoid build-time resolution failures.
// The solver-wasm package is built from Rust via wasm-pack and may not exist in CI
// until the WASM build step completes. Dynamic import ensures the main bundle
// always builds successfully.

let wasmModule: any = null;

async function loadSolverWasm() {
  if (wasmModule) return wasmModule;
  try {
    wasmModule = await import(/* @vite-ignore */ "solver-wasm");
    return wasmModule;
  } catch (e) {
    if (import.meta.env.DEV) console.error("Failed to load solver-wasm module:", e);
    return null;
  }
}

export async function runLocalAnalysis(): Promise<{
  success: boolean;
  message: string;
}> {
  const state = useModelStore.getState();

  // basic validation
  if (state.nodes.size < 2)
    return { success: false, message: "Need at least 2 nodes" };
  if (state.members.size < 1)
    return { success: false, message: "Need at least 1 member" };

  const hasSupports = Array.from(state.nodes.values()).some(
    (n) =>
      n.restraints &&
      (n.restraints.fx ||
        n.restraints.fy ||
        n.restraints.fz ||
        n.restraints.mx ||
        n.restraints.my ||
        n.restraints.mz),
  );
  if (!hasSupports)
    return { success: false, message: "Structure needs at least one support" };

  state.setIsAnalyzing(true);

  try {
    // 1. Load and initialize WASM (dynamically)
    const wasm = await loadSolverWasm();
    if (!wasm) {
      return {
        success: false,
        message:
          "solver-wasm module not available. Use the primary WASM solver instead.",
      };
    }
    try {
      await wasm.default();
      // Call init hook to set panic handler
      wasm.init();
    } catch (e) {
      if (import.meta.env.DEV) console.warn("WASM init failed or already initialized:", e);
    }

    // 2. Assemble Sparse Matrix (in JS for now, could be moved to WASM later)
    const startTime = performance.now();

    // Convert Maps to arrays for the assembler
    const nodesArray = Array.from(state.nodes.values());
    const membersArray = Array.from(state.members.values());

    // Convert node loads to the format expected by assembler
    // state.loads is an array of NodeLoad
    const loadsArray = state.loads.map(
      (load: {
        nodeId: string;
        fx?: number;
        fy?: number;
        fz?: number;
        mx?: number;
        my?: number;
        mz?: number;
      }) => ({
        nodeId: load.nodeId,
        fx: load.fx,
        fy: load.fy,
        fz: load.fz,
        mx: load.mx,
        my: load.my,
        mz: load.mz,
      }),
    );

    const assemblerInput = {
      nodes: nodesArray,
      members: membersArray,
      loads: loadsArray,
    };

    const { entries, forces, dof, nodeMapping } =
      SparseMatrixAssembler.assemble(assemblerInput);
    const assemblyTime = performance.now() - startTime;

    // 3. Prepare Input for Solver
    const input = {
      entries,
      forces,
      size: dof,
    };

    // 4. Run WASM Solver
    // Serialize input to JSON string (overhead is small compared to dense matrix transfer)
    const inputJson = JSON.stringify(input);

    const solverStartTime = performance.now();
    const resultJson = wasm.solve_sparse_system_json(inputJson);
    const solverTotalTime = performance.now() - solverStartTime;

    const result = JSON.parse(resultJson);

    if (!result.success) {
      throw new Error(result.error || "Unknown solver error");
    }

    // 5. Map Results back to Model
    // Result.displacements is a flat array [dof]
    // We need to map back to nodes and calculate member forces

    const displacementsMap = new Map();

    // Map node displacements
    state.nodes.forEach((node) => {
      const startIdx = nodeMapping.get(node.id);
      if (startIdx !== undefined) {
        displacementsMap.set(node.id, {
          dx: result.displacements[startIdx + 0],
          dy: result.displacements[startIdx + 1],
          dz: result.displacements[startIdx + 2],
          rx: result.displacements[startIdx + 3] || 0,
          ry: result.displacements[startIdx + 4] || 0,
          rz: result.displacements[startIdx + 5] || 0,
        });
      }
    });

    // Calculate reactions at support nodes
    const reactionsMap = new Map<
      string,
      { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }
    >();

    state.nodes.forEach((node) => {
      if (
        node.restraints &&
        (node.restraints.fx ||
          node.restraints.fy ||
          node.restraints.fz ||
          node.restraints.mx ||
          node.restraints.my ||
          node.restraints.mz)
      ) {
        // For supported DOFs, reaction = applied stiffness forces - applied loads
        // In a properly assembled system, reactions can be calculated from K*u - F for restrained DOFs
        const startIdx = nodeMapping.get(node.id);
        if (startIdx !== undefined) {
          // Calculate reaction forces from member contributions
          let rx = 0,
            ry = 0,
            rz = 0;
          const rmx = 0,
            rmy = 0,
            rmz = 0;

          // Sum contributions from connected members
          state.members.forEach((member) => {
            if (
              member.startNodeId === node.id ||
              member.endNodeId === node.id
            ) {
              const startNode = state.nodes.get(member.startNodeId);
              const endNode = state.nodes.get(member.endNodeId);
              if (!startNode || !endNode) return;

              const dx = endNode.x - startNode.x;
              const dy = endNode.y - startNode.y;
              const dz = endNode.z - startNode.z;
              const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
              if (L < 1e-10) return;

              const E = member.E ?? 200000; // MPa (200 GPa steel)
              const A = member.A ?? 1000; // mm²
              const I = member.I ?? 1e6; // mm⁴

              // Direction cosines
              const cx = dx / L,
                cy = dy / L,
                cz = dz / L;

              // Get displacements at member ends
              const d1 = displacementsMap.get(member.startNodeId) || {
                dx: 0,
                dy: 0,
                dz: 0,
                rx: 0,
                ry: 0,
                rz: 0,
              };
              const d2 = displacementsMap.get(member.endNodeId) || {
                dx: 0,
                dy: 0,
                dz: 0,
                rx: 0,
                ry: 0,
                rz: 0,
              };

              // Axial deformation and force
              const du =
                (d2.dx - d1.dx) * cx +
                (d2.dy - d1.dy) * cy +
                (d2.dz - d1.dz) * cz;
              const axialForce = ((E * A) / L) * du;

              // Transform to global and add to reaction
              if (member.startNodeId === node.id) {
                rx -= axialForce * cx;
                ry -= axialForce * cy;
                rz -= axialForce * cz;
              } else {
                rx += axialForce * cx;
                ry += axialForce * cy;
                rz += axialForce * cz;
              }
            }
          });

          // Only store non-zero reactions for restrained DOFs
          reactionsMap.set(node.id, {
            fx: node.restraints.fx ? rx : 0,
            fy: node.restraints.fy ? ry : 0,
            fz: node.restraints.fz ? rz : 0,
            mx: node.restraints.mx ? rmx : 0,
            my: node.restraints.my ? rmy : 0,
            mz: node.restraints.mz ? rmz : 0,
          });
        }
      }
    });

    // Calculate member forces
    const memberForcesMap = new Map<
      string,
      {
        axial: number;
        shearY: number;
        shearZ: number;
        momentY: number;
        momentZ: number;
        torsion: number;
      }
    >();

    state.members.forEach((member) => {
      const startNode = state.nodes.get(member.startNodeId);
      const endNode = state.nodes.get(member.endNodeId);
      if (!startNode || !endNode) return;

      const dx = endNode.x - startNode.x;
      const dy = endNode.y - startNode.y;
      const dz = endNode.z - startNode.z;
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L < 1e-10) return;

      const E = member.E ?? 200000; // MPa (200 GPa steel)
      const A = member.A ?? 1000; // mm²
      const Ix = member.I ?? 1e6; // mm⁴ (using I for primary axis)
      const Iy = member.I ?? 1e6; // mm⁴ (simplified: same as Ix)
      // J for open sections ≈ Σbt³/3, typically 1–5% of I. Use conservative 1%.
      const J = (member.I ?? 1e6) * 0.01; // mm⁴ (conservative for open sections)
      const G = E / (2 * (1 + 0.3)); // Shear modulus G = E/(2(1+ν)), ν=0.3 for steel

      // Direction cosines
      const cx = dx / L,
        cy = dy / L,
        cz = dz / L;

      // Get displacements at member ends
      const d1 = displacementsMap.get(member.startNodeId) || {
        dx: 0,
        dy: 0,
        dz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
      };
      const d2 = displacementsMap.get(member.endNodeId) || {
        dx: 0,
        dy: 0,
        dz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
      };

      // Transform to local coordinates
      // For simplicity, using small-deformation beam theory

      // Axial deformation and force
      const du =
        (d2.dx - d1.dx) * cx + (d2.dy - d1.dy) * cy + (d2.dz - d1.dz) * cz;
      const axialForce = ((E * A) / L) * du;

      // Transverse deformations (simplified for beams aligned with axes)
      const v1 = d1.dy,
        v2 = d2.dy;
      const theta1 = d1.rz,
        theta2 = d2.rz;

      // Beam bending forces (Euler-Bernoulli)
      const EI_L3 = (E * Ix) / (L * L * L);
      const shearY =
        12 * EI_L3 * (v1 - v2) + ((6 * E * Ix) / (L * L)) * (theta1 + theta2);
      const momentZ_start =
        ((6 * E * Ix) / (L * L)) * (v1 - v2) +
        ((4 * E * Ix) / L) * theta1 +
        ((2 * E * Ix) / L) * theta2;
      const momentZ_end =
        ((6 * E * Ix) / (L * L)) * (v1 - v2) +
        ((2 * E * Ix) / L) * theta1 +
        ((4 * E * Ix) / L) * theta2;

      // Torsion
      const torsion = ((G * J) / L) * (d2.rx - d1.rx);

      memberForcesMap.set(member.id, {
        // Max values as per MemberForceData interface
        axial: Math.max(Math.abs(-axialForce), Math.abs(axialForce)),
        shearY: Math.abs(shearY),
        shearZ: 0, // Simplified
        momentY: 0, // Simplified
        momentZ: Math.max(Math.abs(momentZ_start), Math.abs(momentZ_end)),
        torsion: Math.abs(torsion),
      });
    });

    const analysisResults: AnalysisResults = {
      displacements: displacementsMap,
      reactions: reactionsMap,
      memberForces: memberForcesMap,
    };

    state.setAnalysisResults(analysisResults);
    return {
      success: true,
      message: `Analysis complete in ${(assemblyTime + solverTotalTime).toFixed(0)}ms`,
    };
  } catch (error) {
    state.setAnalysisResults(null);
    if (import.meta.env.DEV) console.error("Analysis failed:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Analysis failed",
    };
  } finally {
    state.setIsAnalyzing(false);
  }
}
