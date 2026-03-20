/**
 * engine/propertyResolver.ts — Property Assignment Resolution Engine
 *
 * Resolves effective section/material properties for each member using
 * a three-tier precedence hierarchy:
 *
 *   Priority 1 (highest): Explicit member binding (member.propertyAssignmentId)
 *   Priority 2:           Group-level binding (group → propertyAssignmentId)
 *   Priority 3 (lowest):  Global default property (first propertyAssignment with
 *                          no specific memberIds / groupIds scope)
 *
 * If no property assignment is found at any level, the member's own
 * inline properties (E, A, I, …) are used as-is (backward-compatible).
 */

import type {
  Member,
  MemberGroup,
  PropertyAssignmentPayload,
  SectionMechanics,
  PropertyReductionFactors,
} from '../store/modelTypes';
import { deriveG } from '../contracts/units';

// ─── Resolved Property ──────────────────────────────────────────────────────

/** Fully resolved property set for a single member ready for solver payload. */
export interface ResolvedMemberProperty {
  memberId: string;
  /** Which PropertyAssignmentPayload.id was used, or null if inline fallback. */
  sourcePropertyId: string | null;
  /** How the property was resolved. */
  resolution: 'explicit' | 'group' | 'global_default' | 'inline_fallback';

  // Analysis-ready values (SI frontend units: kN/m², m², m⁴)
  E_kN_m2: number;
  G_kN_m2: number;
  A_m2: number;
  Iy_m4: number;
  Iz_m4: number;
  J_m4: number;
  rho_kg_m3: number;

  // Optional Timoshenko shear areas
  Ay_m2?: number;
  Az_m2?: number;

  // Reduction factors (all default to 1.0)
  reductionFactors: Required<PropertyReductionFactors>;

  // Orientation
  betaAngleDeg: number;

  // Offsets
  startOffset?: { x: number; y: number; z: number };
  endOffset?: { x: number; y: number; z: number };

  // Behavior
  tensionOnly: boolean;
  compressionOnly: boolean;

  // Design metadata
  fy_mpa?: number;
  fck_mpa?: number;
}

// ─── Resolution Engine ──────────────────────────────────────────────────────

const DEFAULT_REDUCTION: Required<PropertyReductionFactors> = {
  axial: 1.0,
  shearY: 1.0,
  shearZ: 1.0,
  torsion: 1.0,
  bendingY: 1.0,
  bendingZ: 1.0,
};

/**
 * Resolve effective properties for every member in the model.
 *
 * @param members       All members in the model
 * @param assignments   PropertyAssignmentPayload array from store
 * @param groups        MemberGroup array from store
 * @returns             Map<memberId, ResolvedMemberProperty>
 */
export function resolveAllMemberProperties(
  members: Iterable<Member>,
  assignments: PropertyAssignmentPayload[],
  groups: MemberGroup[],
): Map<string, ResolvedMemberProperty> {
  // Pre-index: propertyId → payload
  const propById = new Map<string, PropertyAssignmentPayload>();
  for (const pa of assignments) propById.set(pa.id, pa);

  // Pre-index: memberId → groupId (first winning group)
  const memberToGroup = new Map<string, string>();
  for (const g of groups) {
    for (const mid of g.memberIds) {
      if (!memberToGroup.has(mid)) memberToGroup.set(mid, g.id);
    }
  }

  // Pre-index: groupId → propertyAssignmentId (from group definition)
  const groupToProp = new Map<string, string>();
  for (const g of groups) {
    if (g.propertyAssignmentId) groupToProp.set(g.id, g.propertyAssignmentId);
  }

  // Pre-index: assignments scoped to specific memberIds
  const assignmentsByMemberId = new Map<string, PropertyAssignmentPayload>();
  for (const pa of assignments) {
    if (pa.assignment.memberIds) {
      for (const mid of pa.assignment.memberIds) {
        if (!assignmentsByMemberId.has(mid)) {
          assignmentsByMemberId.set(mid, pa);
        }
      }
    }
  }

  // Find global default (assignment with no scoped memberIds/groupIds)
  const globalDefault = assignments.find(
    (pa) =>
      (!pa.assignment.memberIds || pa.assignment.memberIds.length === 0) &&
      (!pa.assignment.groupIds || pa.assignment.groupIds.length === 0),
  ) ?? null;

  const result = new Map<string, ResolvedMemberProperty>();

  for (const member of members) {
    const resolved = resolveSingle(
      member,
      propById,
      memberToGroup,
      groupToProp,
      assignmentsByMemberId,
      globalDefault,
    );
    result.set(member.id, resolved);
  }

  return result;
}

function resolveSingle(
  member: Member,
  propById: Map<string, PropertyAssignmentPayload>,
  memberToGroup: Map<string, string>,
  groupToProp: Map<string, string>,
  assignmentsByMemberId: Map<string, PropertyAssignmentPayload>,
  globalDefault: PropertyAssignmentPayload | null,
): ResolvedMemberProperty {
  // Priority 1: Explicit binding on member
  if (member.propertyAssignmentId) {
    const pa = propById.get(member.propertyAssignmentId);
    if (pa) return fromPayload(member.id, pa, 'explicit');
  }

  // Priority 1b: Assignment scoped to this memberId
  const scopedPa = assignmentsByMemberId.get(member.id);
  if (scopedPa) return fromPayload(member.id, scopedPa, 'explicit');

  // Priority 2: Group-level binding
  const groupId = member.groupId ?? memberToGroup.get(member.id);
  if (groupId) {
    const groupPropId = groupToProp.get(groupId);
    if (groupPropId) {
      const pa = propById.get(groupPropId);
      if (pa) return fromPayload(member.id, pa, 'group');
    }
  }

  // Priority 3: Global default
  if (globalDefault) return fromPayload(member.id, globalDefault, 'global_default');

  // Fallback: inline member properties
  return fromInline(member);
}

function fromPayload(
  memberId: string,
  pa: PropertyAssignmentPayload,
  resolution: 'explicit' | 'group' | 'global_default',
): ResolvedMemberProperty {
  const E = pa.material.E_kN_m2;
  const nu = pa.material.nu;
  const G = pa.material.G_kN_m2 ?? deriveG(E, nu);

  return {
    memberId,
    sourcePropertyId: pa.id,
    resolution,
    E_kN_m2: E,
    G_kN_m2: G,
    A_m2: pa.mechanics.area_m2,
    Iy_m4: pa.mechanics.iyy_m4,
    Iz_m4: pa.mechanics.izz_m4,
    J_m4: pa.mechanics.j_m4,
    rho_kg_m3: pa.material.rho_kg_m3 ?? 7850,
    Ay_m2: pa.mechanics.ay_m2,
    Az_m2: pa.mechanics.az_m2,
    reductionFactors: {
      ...DEFAULT_REDUCTION,
      ...pa.reductionFactors,
    },
    betaAngleDeg: pa.orientation?.betaAngleDeg ?? 0,
    startOffset: pa.offsets?.startGlobal_m ?? pa.offsets?.startLocal_m,
    endOffset: pa.offsets?.endGlobal_m ?? pa.offsets?.endLocal_m,
    tensionOnly: pa.behavior?.tensionOnly ?? false,
    compressionOnly: pa.behavior?.compressionOnly ?? false,
    fy_mpa: pa.material.fy_mpa,
    fck_mpa: pa.material.fck_mpa,
  };
}

function fromInline(member: Member): ResolvedMemberProperty {
  const E = member.E ?? Number.NaN;
  const G = member.G ?? (Number.isFinite(E) ? deriveG(E, 0.3) : Number.NaN);
  const I_fallback = member.I ?? Number.NaN;

  return {
    memberId: member.id,
    sourcePropertyId: null,
    resolution: 'inline_fallback',
    E_kN_m2: E,
    G_kN_m2: G,
    A_m2: member.A ?? Number.NaN,
    Iy_m4: member.Iy ?? I_fallback,
    Iz_m4: member.Iz ?? I_fallback,
    J_m4: member.J ?? (Number.isFinite(I_fallback) ? I_fallback * 0.5 : Number.NaN),
    rho_kg_m3: member.rho ?? 7850,
    reductionFactors: { ...DEFAULT_REDUCTION },
    betaAngleDeg: member.betaAngle ?? 0,
    startOffset: member.startOffset,
    endOffset: member.endOffset,
    tensionOnly: false,
    compressionOnly: false,
  };
}

// ─── Diagnostics ────────────────────────────────────────────────────────────

export interface PropertyDiagnostic {
  type: 'missing_property' | 'orphan_assignment' | 'duplicate_binding' | 'invalid_material_section';
  severity: 'error' | 'warning';
  memberId?: string;
  propertyId?: string;
  message: string;
}

/**
 * Check for property-related issues in the model.
 */
export function diagnosePropertyAssignments(
  members: Iterable<Member>,
  assignments: PropertyAssignmentPayload[],
  groups: MemberGroup[],
): PropertyDiagnostic[] {
  const diagnostics: PropertyDiagnostic[] = [];
  const memberIds = new Set<string>();
  for (const m of members) memberIds.add(m.id);

  // Check for orphan assignments (reference non-existent members)
  for (const pa of assignments) {
    if (pa.assignment.memberIds) {
      for (const mid of pa.assignment.memberIds) {
        if (!memberIds.has(mid)) {
          diagnostics.push({
            type: 'orphan_assignment',
            severity: 'warning',
            propertyId: pa.id,
            memberId: mid,
            message: `Property "${pa.name}" references non-existent member ${mid}`,
          });
        }
      }
    }
  }

  // Check for members with no resolvable property and no inline E/A/I
  const resolved = resolveAllMemberProperties(members, assignments, groups);
  for (const [mid, rp] of resolved) {
    if (rp.resolution === 'inline_fallback') {
      // Check if inline properties are defined
      const member = [...(members as Iterable<Member>)].find((m) => m.id === mid);
      if (
        member &&
        member.E === undefined &&
        member.A === undefined &&
        member.I === undefined &&
        member.Iy === undefined &&
        member.Iz === undefined &&
        member.J === undefined
      ) {
        diagnostics.push({
          type: 'missing_property',
          severity: 'error',
          memberId: mid,
          message: `Member ${mid} has no property assignment and no inline properties`,
        });
      }
    }
  }

  // Check for invalid material-section pairings
  for (const pa of assignments) {
    if (pa.material.family === 'concrete' && pa.material.fy_mpa && !pa.material.fck_mpa) {
      diagnostics.push({
        type: 'invalid_material_section',
        severity: 'warning',
        propertyId: pa.id,
        message: `Property "${pa.name}": concrete material has fy but no fck`,
      });
    }
    if (pa.material.family === 'steel' && pa.material.fck_mpa && !pa.material.fy_mpa) {
      diagnostics.push({
        type: 'invalid_material_section',
        severity: 'warning',
        propertyId: pa.id,
        message: `Property "${pa.name}": steel material has fck but no fy`,
      });
    }
  }

  return diagnostics;
}
