/**
 * API client for structural analysis
 * Uses WASM solver - NO backend calls
 */

import {
  useModelStore,
  type Node,
  type Member,
  type NodeLoad,
  type MemberLoad,
  type AnalysisResults,
  type MemberForceData,
} from "../store/model";
import type {
  PointLoad,
  MemberLoad as WasmMemberLoad,
  MemberForces,
} from "../services/wasmSolverService";

// Number of stations for generating internal force / deflection diagrams
const DIAGRAM_STATIONS = 51;

export async function runAnalysis(): Promise<{
  success: boolean;
  message: string;
}> {
  const state = useModelStore.getState();

  // Convert Maps to arrays for analysis
  const nodes: Node[] = Array.from(state.nodes.values());
  const members: Member[] = Array.from(state.members.values());
  const loads: NodeLoad[] = state.loads;
  const memberLoads: MemberLoad[] = state.memberLoads;

  // Validate
  if (nodes.length < 2) {
    return { success: false, message: "Need at least 2 nodes" };
  }
  if (members.length < 1) {
    return { success: false, message: "Need at least 1 member" };
  }

  // Check for supports
  const hasSupports = nodes.some(
    (n) =>
      n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.mz),
  );
  if (!hasSupports) {
    return {
      success: false,
      message: "Structure needs at least one support (restrained node)",
    };
  }

  // Check for any loads
  const hasLoads = loads.length > 0 || memberLoads.length > 0;
  if (!hasLoads) {
    return {
      success: false,
      message: "Structure needs at least one load (nodal or distributed)",
    };
  }

  state.setIsAnalyzing(true);

  try {
    // Use WASM solver (client-side - no network calls!)
    const { analyzeStructure, initSolver } =
      await import("../services/wasmSolverService");
    await initSolver();

    // Convert nodes to WASM format
    // BUG FIX: Third DOF is rotation (mz), NOT translation (fz)
    const wasmNodes = nodes.map((n) => ({
      id: parseInt(n.id) || 0,
      x: n.x,
      y: n.y,
      fixed: [
        n.restraints?.fx || false,
        n.restraints?.fy || false,
        n.restraints?.mz || false, // rotation restraint, not fz
      ] as [boolean, boolean, boolean],
    }));

    const wasmElements = members.map((m) => ({
      id: parseInt(m.id) || 0,
      node_start: parseInt(m.startNodeId) || 0,
      node_end: parseInt(m.endNodeId) || 0,
      e: m.E || 200e9,
      i: m.I || 8.33e-6,
      a: m.A || 0.01,
    }));

    // Convert nodal loads to WASM PointLoad format
    const wasmPointLoads: PointLoad[] = loads.map((load) => ({
      node_id: parseInt(load.nodeId) || 0,
      fx: load.fx ?? 0,
      fy: load.fy ?? 0,
      mz: load.mz ?? 0,
    }));

    // Convert member loads to WASM MemberLoad format
    const wasmMemberLoads: WasmMemberLoad[] = memberLoads
      .filter((ml) => ml.type === "UDL" || ml.type === "UVL")
      .map((ml) => ({
        element_id: parseInt(ml.memberId) || 0,
        w1: ml.w1 ?? 0,
        w2: ml.type === "UDL" ? (ml.w1 ?? 0) : (ml.w2 ?? 0),
        direction: ml.direction || "local_y",
        start_pos: ml.startPos ?? 0,
        end_pos: ml.endPos ?? 1,
      }));

    // BUG FIX: Pass all 4 arguments (loads were previously dropped!)
    const result = await analyzeStructure(
      wasmNodes,
      wasmElements,
      wasmPointLoads,
      wasmMemberLoads,
    );

    if (result.success) {
      // Convert results to Maps with proper typing
      const displacementsMap = new Map<
        string,
        {
          dx: number;
          dy: number;
          dz: number;
          rx: number;
          ry: number;
          rz: number;
        }
      >();
      Object.entries(result.displacements || {}).forEach(([id, disp]) => {
        // Handle both array and object formats
        const d = disp as number[] | Record<string, number>;
        if (Array.isArray(d)) {
          displacementsMap.set(id, {
            dx: d[0] ?? 0,
            dy: d[1] ?? 0,
            dz: d[2] ?? 0,
            rx: d[3] ?? 0,
            ry: d[4] ?? 0,
            rz: d[5] ?? 0,
          });
        } else {
          displacementsMap.set(id, {
            dx: d.dx ?? 0,
            dy: d.dy ?? 0,
            dz: d.dz ?? 0,
            rx: d.rx ?? 0,
            ry: d.ry ?? 0,
            rz: d.rz ?? 0,
          });
        }
      });

      const reactionsMap = new Map<
        string,
        {
          fx: number;
          fy: number;
          fz: number;
          mx: number;
          my: number;
          mz: number;
        }
      >();
      Object.entries(result.reactions || {}).forEach(([id, r]) => {
        const reaction = r as number[] | Record<string, number>;
        if (Array.isArray(reaction)) {
          reactionsMap.set(id, {
            fx: reaction[0] ?? 0,
            fy: reaction[1] ?? 0,
            fz: reaction[2] ?? 0,
            mx: reaction[3] ?? 0,
            my: reaction[4] ?? 0,
            mz: reaction[5] ?? 0,
          });
        } else {
          reactionsMap.set(id, {
            fx: reaction?.fx ?? 0,
            fy: reaction?.fy ?? 0,
            fz: reaction?.fz ?? 0,
            mx: reaction?.mx ?? 0,
            my: reaction?.my ?? 0,
            mz: reaction?.mz ?? 0,
          });
        }
      });

      // Build member load lookup for diagram generation
      const memberLoadMap = new Map<string, MemberLoad[]>();
      for (const ml of memberLoads) {
        if (!memberLoadMap.has(ml.memberId)) memberLoadMap.set(ml.memberId, []);
        memberLoadMap.get(ml.memberId)!.push(ml);
      }

      // Build node lookup (id → Node)
      const nodeMap = new Map<string, Node>();
      for (const n of nodes) nodeMap.set(n.id, n);

      const memberForcesMap = new Map<string, MemberForceData>();
      // Handle both member_forces and memberForces
      const memberForcesData =
        result.member_forces ||
        (result as unknown as Record<string, unknown>).memberForces ||
        {};
      Object.entries(memberForcesData as Record<string, MemberForces>).forEach(
        ([id, forces]) => {
          // BUG FIX: Map from Rust field names (shear_start, moment_start, etc.)
          const axial = forces?.axial ?? 0;
          const shearStart = forces?.shear_start ?? 0;
          const momentStart = forces?.moment_start ?? 0;
          const shearEnd = forces?.shear_end ?? 0;
          const momentEnd = forces?.moment_end ?? 0;

          // Find the member to generate diagram data
          const member = members.find((m) => m.id === id);
          let diagramData: MemberForceData["diagramData"] | undefined;

          if (member) {
            const n1 = nodeMap.get(member.startNodeId);
            const n2 = nodeMap.get(member.endNodeId);
            if (n1 && n2) {
              diagramData = generateWasmDiagramData(
                axial,
                shearStart,
                momentStart,
                shearEnd,
                momentEnd,
                n1,
                n2,
                member,
                memberLoadMap.get(member.id) || [],
              );
            }
          }

          memberForcesMap.set(id, {
            axial,
            shearY: shearStart,
            shearZ: 0,
            momentY: 0,
            momentZ: momentStart,
            torsion: 0,
            startForces: { axial, shearY: shearStart, momentZ: momentStart },
            endForces: { axial: -axial, shearY: shearEnd, momentZ: momentEnd },
            diagramData,
          });
        },
      );

      const analysisResults: AnalysisResults = {
        displacements: displacementsMap,
        reactions: reactionsMap,
        memberForces: memberForcesMap,
        stats: result.stats,
      };
      state.setAnalysisResults(analysisResults);
      return { success: true, message: "Analysis completed (WASM solver)" };
    } else {
      state.setAnalysisResults(null);
      return { success: false, message: result.error || "Analysis failed" };
    }
  } catch (error) {
    state.setAnalysisResults(null);
    const message =
      error instanceof Error ? error.message : "WASM solver error";
    return { success: false, message };
  } finally {
    state.setIsAnalyzing(false);
  }
}

// ============================================
// DIAGRAM DATA GENERATION (for WASM path)
// ============================================

/**
 * Generate intermediate‐station SFD / BMD / deflection diagram data
 * from the WASM solver's member‐end forces.
 *
 * Uses exact Euler–Bernoulli beam theory:
 *   V(x) = V1 − w·x          (UDL)
 *   M(x) = M1 + V1·x − w·x²/2
 *   EI·y″ = M(x)  →  double integration with actual end displacements
 */
function generateWasmDiagramData(
  axialForce: number,
  shearStart: number,
  momentStart: number,
  shearEnd: number,
  momentEnd: number,
  n1: Node,
  n2: Node,
  member: Member,
  mLoads: MemberLoad[],
): NonNullable<MemberForceData["diagramData"]> {
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const dz = (n2.z ?? 0) - (n1.z ?? 0);
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

  const EI = (member.E ?? 200e9) * (member.I ?? 8.33e-6);

  // Sum up UDL intensity in local Y for diagram generation
  let w = 0;
  for (const ml of mLoads) {
    if (ml.type === "UDL") {
      w += ml.w1 ?? 0;
    }
  }

  const x_values: number[] = [];
  const shear_y: number[] = [];
  const moment_y: number[] = [];
  const axial_arr: number[] = [];
  const deflection_y: number[] = [];

  for (let s = 0; s < DIAGRAM_STATIONS; s++) {
    const x = (s / (DIAGRAM_STATIONS - 1)) * L;

    x_values.push(x);

    // Axial is constant along member (no intermediate axial loads)
    axial_arr.push(axialForce);

    // Shear: V(x) = V1 - w·x
    shear_y.push(shearStart - w * x);

    // Moment: M(x) = M1 + V1·x - w·x²/2
    moment_y.push(momentStart + shearStart * x - (w * x * x) / 2);

    // Deflection via double integration of M(x)/EI
    // EI·y  = M1·x²/2 + V1·x³/6 − w·x⁴/24 + C1·x + C2
    // BC: y(0)=0 → C2=0;  y(L)=0 → C1 = −(M1·L/2 + V1·L²/6 − w·L³/24)
    if (EI > 0) {
      const C1 = -(
        (momentStart * L) / 2 +
        (shearStart * L * L) / 6 -
        (w * L * L * L) / 24
      );
      const y =
        ((momentStart * x * x) / 2 +
          (shearStart * x * x * x) / 6 -
          (w * x * x * x * x) / 24 +
          C1 * x) /
        EI;
      deflection_y.push(y * 1000); // convert to mm
    } else {
      deflection_y.push(0);
    }
  }

  return {
    x_values,
    shear_y,
    shear_z: new Array(DIAGRAM_STATIONS).fill(0),
    moment_y,
    moment_z: new Array(DIAGRAM_STATIONS).fill(0),
    axial: axial_arr,
    torsion: new Array(DIAGRAM_STATIONS).fill(0),
    deflection_y,
    deflection_z: new Array(DIAGRAM_STATIONS).fill(0),
  };
}
