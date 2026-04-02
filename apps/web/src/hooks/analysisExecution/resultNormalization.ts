import type { MemberForceData } from "../../store/model";

interface NodeDisplacementResult {
  nodeId: string;
  DX: number;
  DY: number;
  DZ: number;
  RX: number;
  RY: number;
  RZ: number;
}

interface PlateResult {
  stress_xx: number;
  stress_yy: number;
  stress_xy: number;
  moment_xx: number;
  moment_yy: number;
  moment_xy: number;
  displacement: number;
  von_mises: number;
}

export interface AnalysisResultShape {
  success: boolean;
  displacements?: Record<string, NodeDisplacementResult | number[]>;
  reactions?: Record<string, number[]>;
  memberForces?: Record<string, any>;
  plateResults?: Record<string, PlateResult>;
  equilibriumCheck?: unknown;
  conditionNumber?: number;
  stats?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
}

export interface NormalizedAnalysisResult {
  displacements?: Record<string, number[]>;
  reactions?: Record<string, number[]>;
  memberForces?: Record<string, MemberForceData>;
  stats?: Record<string, unknown>;
}

export function normalizeAnalysisResult(result: AnalysisResultShape): NormalizedAnalysisResult {
  const responseData = result as Record<string, any>;

  const displacements: Record<string, number[]> = {};
  for (const [nodeId, disp] of Object.entries(responseData.displacements || {})) {
    const d = disp as { dx?: number; dy?: number; dz?: number; rx?: number; ry?: number; rz?: number } | number[];
    if (Array.isArray(d)) {
      displacements[nodeId] = [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, d[3] ?? 0, d[4] ?? 0, d[5] ?? 0];
    } else {
      displacements[nodeId] = [d.dx ?? 0, d.dy ?? 0, d.dz ?? 0, d.rx ?? 0, d.ry ?? 0, d.rz ?? 0];
    }
  }

  const reactions: Record<string, number[]> | undefined = responseData.reactions && Object.keys(responseData.reactions).length > 0 ? (responseData.reactions as Record<string, number[]>) : undefined;

  let memberForces: Record<string, MemberForceData> | undefined;
  const rawMemberForces = responseData.member_forces ?? responseData.memberForces;
  if (rawMemberForces && Object.keys(rawMemberForces).length > 0) {
    memberForces = {};
    for (const [memberId, mf] of Object.entries(rawMemberForces)) {
      const f = mf as any;
      const normalized: MemberForceData = {
        axial: f.axial_start ?? f.axial ?? 0,
        shearY: f.shear_y_start ?? f.shear_y ?? f.shear ?? 0,
        shearZ: f.shear_z_start ?? f.shear_z ?? f.shearZ ?? f.shear ?? 0,
        momentY: f.moment_y_start ?? f.moment_y ?? f.momentY ?? 0,
        momentZ: f.moment_z_start ?? f.moment_z ?? f.momentZ ?? f.momentStart ?? 0,
        torsion: f.torsion_start ?? f.torsion ?? 0,
        momentStart: f.moment_z_start ?? f.momentStart ?? f.momentZ ?? 0,
        momentEnd: f.moment_z_end ?? f.momentEnd ?? f.momentZ ?? 0,
      } as MemberForceData;
      memberForces[memberId] = normalized;
    }
  }

  return {
    displacements,
    reactions,
    memberForces,
    stats: responseData.stats,
  };
}