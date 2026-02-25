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

      // Member-count-per-node for pin-support detection
      const memberCountPerNode = new Map<string, number>();
      for (const mm of members) {
        memberCountPerNode.set(mm.startNodeId, (memberCountPerNode.get(mm.startNodeId) ?? 0) + 1);
        memberCountPerNode.set(mm.endNodeId, (memberCountPerNode.get(mm.endNodeId) ?? 0) + 1);
      }
      const isPinSupport = (nodeId: string): boolean => {
        const nd = nodeMap.get(nodeId);
        if (!nd?.restraints) return false;
        const r = nd.restraints;
        const hasTranslation = r.fx || r.fy || r.fz;
        const hasMomentZ = r.mz;
        const singleMember = (memberCountPerNode.get(nodeId) ?? 0) <= 1;
        return !!hasTranslation && !hasMomentZ && singleMember;
      };

      const memberForcesMap = new Map<string, MemberForceData>();
      // Handle both member_forces and memberForces
      const memberForcesData =
        result.member_forces ||
        (result as unknown as Record<string, unknown>).memberForces ||
        {};
      Object.entries(memberForcesData as Record<string, MemberForces>).forEach(
        ([id, forces]) => {
          // Extract member end forces from either 3D (forces_i/forces_j) or legacy scalar format
          const fi = (forces as any)?.forces_i as number[] | undefined;
          const fj = (forces as any)?.forces_j as number[] | undefined;
          let axial = fi ? fi[0] / 1000 : (forces?.axial ?? 0);
          let shearStart = fi ? fi[1] / 1000 : (forces?.shear_start ?? 0);
          let momentStart = fi ? fi[5] / 1000 : (forces?.moment_start ?? 0);
          let shearEnd = fj ? fj[1] / 1000 : (forces?.shear_end ?? 0);
          let momentEnd = fj ? fj[5] / 1000 : (forces?.moment_end ?? 0);

          // Find the member to generate diagram data
          const member = members.find((m) => m.id === id);

          // Zero released DOFs — a released DOF carries no internal force
          if (member?.releases) {
            const rel = member.releases;
            if (rel.mzStart || (rel as Record<string, unknown>).startMoment) momentStart = 0;
            if (rel.mzEnd || (rel as Record<string, unknown>).endMoment) momentEnd = 0;
            if (rel.fyStart) shearStart = 0;
            if (rel.fyEnd) shearEnd = 0;
            if (rel.fxStart || rel.fxEnd) axial = 0;
          }
          // Pin/roller support zeroing — moment is zero at simple supports
          if (member) {
            if (isPinSupport(member.startNodeId)) momentStart = 0;
            if (isPinSupport(member.endNodeId)) momentEnd = 0;
          }
          // Clean numerical noise
          const peak = Math.max(Math.abs(axial), Math.abs(shearStart), Math.abs(momentStart), Math.abs(shearEnd), Math.abs(momentEnd));
          if (peak > 1e-15) {
            const tol = peak * 1e-6;
            if (Math.abs(axial) < tol) axial = 0;
            if (Math.abs(shearStart) < tol) shearStart = 0;
            if (Math.abs(momentStart) < tol) momentStart = 0;
            if (Math.abs(shearEnd) < tol) shearEnd = 0;
            if (Math.abs(momentEnd) < tol) momentEnd = 0;
          }
          let diagramData: MemberForceData["diagramData"] | undefined;

          if (member) {
            const n1 = nodeMap.get(member.startNodeId);
            const n2 = nodeMap.get(member.endNodeId);
            if (n1 && n2) {
              const d1 = displacementsMap.get(member.startNodeId);
              const d2 = displacementsMap.get(member.endNodeId);
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
                d1,
                d2,
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
 * Uses exact Euler–Bernoulli beam theory with equilibrium-derived UDL:
 *   w = (V1 + V2) / L  (from vertical equilibrium of TOTAL end forces)
 *   V(x) = V1 − w·x
 *   M(x) = M1 + V1·x − w·x²/2
 *   EI·y″ = M(x)  →  double integration with y(0)=y(L)=0
 *
 * The end forces already include all load effects (UDL, point loads, etc.)
 * via the solver's FEF term. We do NOT re-read member loads from the store
 * to avoid double-counting.
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
  _mLoads: MemberLoad[], // kept for API compatibility, no longer used
  dispStart?: { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number },
  dispEnd?: { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number },
): NonNullable<MemberForceData["diagramData"]> {
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const dz = (n2.z ?? 0) - (n1.z ?? 0);
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

  const EI = (member.E ?? 200e9) * (member.I ?? 8.33e-6);

  // Back-calculate equivalent distributed load from equilibrium of TOTAL end forces.
  // Vertical equilibrium: V1 - w*L + V2 = 0 → w = (V1 + V2) / L
  // This is exact and avoids double-counting since V1/V2 already include FEF.
  const w = L > 1e-12 ? (shearStart + shearEnd) / L : 0;

  // ─── Pre-compute local y-axis displacement BCs (once per member) ───
  // Used for deflection computation with actual solver displacements
  let dy_i_local = 0;
  let dy_j_local = 0;
  if (dispStart || dispEnd) {
    const lx_ax = dx / L, ly_ax = dy / L, lz_ax = dz / L;
    let yx = 0, yy = 0, yz = 0;
    if (Math.abs(lz_ax) < 0.999) {
      yx = -ly_ax; yy = lx_ax; yz = 0;
      const yn = Math.sqrt(yx * yx + yy * yy + yz * yz);
      if (yn > 1e-12) { yx /= yn; yy /= yn; yz /= yn; }
    } else {
      yx = 1; yy = 0; yz = 0;
    }
    if (dispStart) {
      dy_i_local = dispStart.dx * yx + dispStart.dy * yy + dispStart.dz * yz;
    }
    if (dispEnd) {
      dy_j_local = dispEnd.dx * yx + dispEnd.dy * yy + dispEnd.dz * yz;
    }
  }

  const x_values: number[] = [];
  const shear_y: number[] = [];
  const moment_y: number[] = [];
  const axial_arr: number[] = [];
  const deflection_y: number[] = [];

  // Pre-compute deflection integration constants (closed-form for polynomial M(x))
  // EI·y = -M1·x²/2 + V1·x³/6 − w·x⁴/24 + C1·x + C2
  // y(0) = dy_i → C2 = dy_i · EI
  // y(L) = dy_j → C1 = (dy_j·EI + M1·L²/2 − V1·L³/6 + w·L⁴/24 − C2) / L
  let defl_C1 = 0;
  let defl_C2 = 0;
  if (EI > 0) {
    defl_C2 = dy_i_local * EI;
    defl_C1 = L > 1e-12
      ? (dy_j_local * EI + (momentStart * L * L) / 2 - (shearStart * L * L * L) / 6 + (w * L * L * L * L) / 24 - defl_C2) / L
      : 0;
  }

  for (let s = 0; s < DIAGRAM_STATIONS; s++) {
    const x = (s / (DIAGRAM_STATIONS - 1)) * L;

    x_values.push(x);

    // Axial is constant along member (no intermediate axial loads)
    axial_arr.push(axialForce);

    // Shear: V(x) = V1 - w·x
    shear_y.push(shearStart - w * x);

    // Moment: M_internal(x) = -M1 + V1·x - w·x²/2 (negate FEM moment for internal BMD)
    moment_y.push(-momentStart + shearStart * x - (w * x * x) / 2);

    // Deflection via closed-form double integration of M(x)/EI
    // with actual solver nodal displacement BCs
    if (EI > 0) {
      const y =
        ((-momentStart * x * x) / 2 +
          (shearStart * x * x * x) / 6 -
          (w * x * x * x * x) / 24 +
          defl_C1 * x + defl_C2) /
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
    moment_y: new Array(DIAGRAM_STATIONS).fill(0), // weak-axis moment (none computed here)
    moment_z: moment_y, // Primary BMD (Mz about Z-axis) — consumers read moment_z
    axial: axial_arr,
    torsion: new Array(DIAGRAM_STATIONS).fill(0),
    deflection_y,
    deflection_z: new Array(DIAGRAM_STATIONS).fill(0),
  };
}
