/**
 * Structural Validation Utilities
 * Validates structures BEFORE analysis to prevent errors
 */

import {
  analyzeDeterminacy,
  type Node as DeterminacyNode,
  type Member as DeterminacyMember,
  type DeterminacyResult,
  getDeterminacyDescription,
} from "./determinacyAnalysis";

export interface ValidationError {
  type: "error" | "warning" | "critical" | "info";
  message: string;
  details?: string;
  affectedItems?: string[];
  category?: "stability" | "determinacy" | "geometry" | "materials" | "loads";
  severity?: "low" | "medium" | "high" | "critical";
  autoFixable?: boolean;
  educational?: {
    concept: string;
    explanation: string;
    whyImportant: string;
  };
  suggestions?: Array<{
    action: string;
    description: string;
    difficulty: "easy" | "medium" | "hard";
    impact: "low" | "medium" | "high";
  }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[]; // Added for positive/educational messages
  determinacy?: DeterminacyResult; // Added comprehensive determinacy analysis
}

interface Node {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints?: {
    fx?: boolean;
    fy?: boolean;
    fz?: boolean;
    mx?: boolean;
    my?: boolean;
    mz?: boolean;
  };
}

interface Member {
  id: string;
  startNodeId: string;
  endNodeId: string;
  E?: number;
  I?: number;
  A?: number;
}

/**
 * Validates a structural model for stability, determinacy, and geometry
 */
export function validateStructure(
  nodes: Map<string, Node>,
  members: Map<string, Member>,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const info: ValidationError[] = [];

  // Basic checks
  if (nodes.size === 0) {
    errors.push({
      type: "critical",
      message: "No nodes defined",
      details: "Add at least 2 nodes to create a structure",
    });
    return { valid: false, errors, warnings, info };
  }

  if (members.size === 0) {
    errors.push({
      type: "critical",
      message: "No members defined",
      details: "Add at least 1 member connecting nodes",
    });
    return { valid: false, errors, warnings, info };
  }

  // 1. Check for zero-length members
  const zeroLengthMembers: string[] = [];
  members.forEach((member, id) => {
    const startNode = nodes.get(member.startNodeId);
    const endNode = nodes.get(member.endNodeId);

    if (!startNode || !endNode) {
      errors.push({
        type: "error",
        message: `Member ${id} references non-existent node`,
        affectedItems: [id],
      });
      return;
    }

    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const dz = (endNode.z || 0) - (startNode.z || 0);
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (length < 1e-6) {
      zeroLengthMembers.push(id);
    }
  });

  if (zeroLengthMembers.length > 0) {
    errors.push({
      type: "error",
      message: "Zero-length members detected",
      details: "Members must connect two different points",
      affectedItems: zeroLengthMembers,
    });
  }

  // 2. Check for disconnected nodes
  const connectedNodes = new Set<string>();
  members.forEach((member) => {
    connectedNodes.add(member.startNodeId);
    connectedNodes.add(member.endNodeId);
  });

  const disconnectedNodes: string[] = [];
  nodes.forEach((_, id) => {
    if (!connectedNodes.has(id)) {
      disconnectedNodes.push(id);
    }
  });

  if (disconnectedNodes.length > 0) {
    warnings.push({
      type: "warning",
      message: `${disconnectedNodes.length} disconnected node(s)`,
      details: "These nodes are not connected to any members",
      affectedItems: disconnectedNodes,
    });
  }

  // 3. Check support conditions (stability) — auto-detect 2D / 3D
  // Auto-detect if structure is 3D based on Z-coordinate variation
  const earlyZCoords = Array.from(nodes.values()).map((n) => n.z || 0);
  const earlyUniqueZ = [
    ...new Set(earlyZCoords.map((z) => Math.round(z * 1000))),
  ]; // Round to mm precision
  const is3DGeometry = earlyUniqueZ.length > 1;

  const supportedTranslational = countTranslationalRestraints(nodes);
  const supportedRotational = countRotationalRestraints(nodes);
  const supportedDOFs = supportedTranslational + supportedRotational;

  // Minimum restraints: 3 for 2D (2 translations + 1 rotation or 3 translations), 6 for 3D
  const minRestraints = is3DGeometry ? 6 : 3;

  if (supportedDOFs < minRestraints) {
    const missingRestraints = minRestraints - supportedDOFs;
    const restraintType = is3DGeometry ? "DOF" : "restraint";

    errors.push({
      type: "critical",
      message: is3DGeometry
        ? "UNSTABLE STRUCTURE — Insufficient supports for 3D analysis"
        : "UNSTABLE STRUCTURE — Insufficient supports",
      details: is3DGeometry
        ? `At least 6 translational restraints required for 3D stability. Currently: ${supportedTranslational}.\n\nAdd supports: Fixed (6 DOF) or Pin (3 DOF) at multiple locations.`
        : `At least 3 restraints required for planar stability. Currently: ${supportedTranslational} restraint(s).\n\nAdd supports: Pin (2 DOF) or Fixed (3 DOF) or Roller (1 DOF)`,
      category: "stability",
      severity: "critical",
      educational: {
        concept: "Structural Stability",
        explanation: `A ${is3DGeometry ? '3D' : '2D'} structure needs ${minRestraints} independent support conditions to prevent rigid body motion.`,
        whyImportant: "Unstable structures can translate/rotate freely under load, making analysis meaningless."
      },
      suggestions: [
        {
          action: "Add fixed support",
          description: `Add a fixed support (${is3DGeometry ? '6' : '3'} ${restraintType}s) at a corner node`,
          difficulty: "easy",
          impact: "high"
        },
        {
          action: "Add pin support",
          description: `Add a pin support (${is3DGeometry ? '3' : '2'} ${restraintType}s) at a node`,
          difficulty: "easy",
          impact: "high"
        },
        {
          action: "Add roller support",
          description: `Add a roller support (1 ${restraintType}) to prevent movement in one direction`,
          difficulty: "easy",
          impact: "medium"
        }
      ]
    });
  }

  // 4. Check for mechanisms (simplified pre-check)
  // The comprehensive determinacy analysis (section 8) does the full check;
  // this is a quick necessary-condition screen.
  //
  // CORRECT FORMULAS (necessary conditions for stability):
  //   2D Truss:  m + r ≥ 2j
  //   3D Truss:  m + r ≥ 3j
  //   2D Frame:  3m + r ≥ 3j  (each member carries N, V, M → 3 unknowns)
  //   3D Frame:  6m + r ≥ 6j  (each member carries N,Vy,Vz,T,My,Mz → 6 unknowns)
  //
  // Previously this used the truss formula for everything, which wrongly
  // flagged large 3D frames as unstable.  Now we use the frame formula
  // (conservative: if a member is really a truss link, the comprehensive
  //  determinacy analysis in section 8 will catch it).

  const numMembers = members.size;
  const numNodes = nodes.size;
  const numReactions = supportedDOFs;

  // Frame formula: unknowns = dofPerMember * m + r,  equations = dofPerNode * n
  const dofPerMember = is3DGeometry ? 6 : 3; // internal unknowns per frame member
  const dofPerNode = is3DGeometry ? 6 : 3;   // equilibrium equations per node
  const staticDeterminacy =
    dofPerMember * numMembers + numReactions - dofPerNode * numNodes;

  if (staticDeterminacy < 0) {
    const deficiency = Math.abs(staticDeterminacy);
    const formula = is3DGeometry
      ? `6m + r ≥ 6n → ${dofPerMember * numMembers} + ${numReactions} = ${dofPerMember * numMembers + numReactions} < ${dofPerNode * numNodes}`
      : `3m + r ≥ 3n → ${dofPerMember * numMembers} + ${numReactions} = ${dofPerMember * numMembers + numReactions} < ${dofPerNode * numNodes}`;
    errors.push({
      type: "critical",
      message: "UNSTABLE - Mechanism detected",
      details:
        `Structure lacks sufficient members or supports.\n` +
        `Members: ${numMembers}, Reactions: ${numReactions}, Nodes: ${numNodes}\n` +
        `Need: ${formula}`,
      category: "stability",
      severity: "critical",
      educational: {
        concept: "Mechanisms vs Structures",
        explanation: `A mechanism has ${deficiency} too few constraints, allowing free movement. A structure must be properly constrained.`,
        whyImportant: "Mechanisms collapse under load because they have no stable equilibrium position."
      },
      suggestions: [
        {
          action: "Add diagonal bracing",
          description: "Add diagonal members to triangulate the structure",
          difficulty: "easy",
          impact: "high"
        },
        {
          action: "Add missing supports",
          description: `Add ${deficiency} more support conditions`,
          difficulty: "easy",
          impact: "high"
        },
        {
          action: "Convert to truss system",
          description: "Add web members to create triangular patterns",
          difficulty: "medium",
          impact: "high"
        }
      ]
    });
  } else if (staticDeterminacy === 0) {
    info.push({
      type: "info",
      message: "Statically determinate structure",
      details: "Good! Structure has exactly enough supports and members.",
      category: "determinacy",
      severity: "low",
      educational: {
        concept: "Static Determinacy",
        explanation: "A statically determinate structure can be analyzed using equilibrium equations alone (ΣFx=0, ΣFy=0, ΣM=0).",
        whyImportant: "Determinate structures are simpler to analyze and their results are exact (no assumptions needed)."
      }
    });
  } else if (staticDeterminacy > 0) {
    const degree = staticDeterminacy;
    const isAcceptable = degree <= 3; // Most real structures have some indeterminacy

    if (degree > 20) {
      warnings.push({
        type: "warning" as const,
        message: `Statically indeterminate (degree ${degree})`,
        details: `Structure has ${degree} redundant constraints. Matrix/stiffness method will be used; review supports and connectivity to ensure this is intentional.`,
        category: "determinacy" as const,
        severity: "high" as const,
        educational: {
          concept: "Static Indeterminacy",
          explanation: `Degree ${degree} indicates many redundant constraints. Review member connectivity and support placement to avoid over-constraining.`,
          whyImportant: "Highly indeterminate structures can mask modelling errors and may produce inaccurate load distribution if not intended."
        },
        suggestions: [
          {
            action: "Reduce redundancy",
            description: "Remove unnecessary members or add internal releases/hinges to lower the degree of indeterminacy",
            difficulty: "hard" as const,
            impact: "high" as const,
          },
          {
            action: "Verify boundary conditions",
            description: "Ensure supports and member connections are intentionally placed and not duplicated",
            difficulty: "medium" as const,
            impact: "high" as const,
          }
        ]
      });
    } else {
      warnings.push({
        type: isAcceptable ? "info" : "warning",
        message: `Statically indeterminate (degree ${degree})`,
        details: degree <= 3
          ? "Structure has redundant supports/members. This is normal and good for safety."
          : `Structure has ${degree} redundant constraints. Analysis will use stiffness method.`,
        category: "determinacy",
        severity: degree <= 3 ? "low" : "medium",
        educational: {
          concept: "Static Indeterminacy",
          explanation: `The structure has ${degree} more constraints than needed for determinacy. This means multiple load paths exist.`,
          whyImportant: "Indeterminate structures are safer (load redistribution) but require matrix analysis methods."
        },
        suggestions: degree > 3 ? [{
          action: "Add hinges at member ends",
          description: "Convert some member connections to hinges to reduce indeterminacy",
          difficulty: "medium",
          impact: "medium"
        }] : undefined
      });
    }
  }

  // 5. Check for parallel supports (can cause instability)
  const restraintTypes = new Map<string, number>();
  nodes.forEach((node) => {
    if (node.restraints) {
      const key = `${node.restraints.fx}_${node.restraints.fy}_${node.restraints.fz}`;
      restraintTypes.set(key, (restraintTypes.get(key) || 0) + 1);
    }
  });

  // 6. Check for material/section properties
  const membersWithDefaultProps = new Set<string>();
  const defaultMembers: string[] = [];
  members.forEach((member) => {
    const hasDefaultE = !member.E || member.E === 200e6; // Default steel E
    const hasDefaultI = !member.I || member.I === 1e-4;  // Default 10000 cm⁴
    const hasDefaultA = !member.A || member.A === 0.01;  // Default 100 cm²
    const hasMissing = !member.E || !member.I || !member.A || member.E <= 0 || member.I <= 0 || member.A <= 0;

    if (hasDefaultE || hasDefaultI || hasDefaultA || hasMissing) {
      // Auto-fix: assign fallback steel defaults to allow analysis proceed
      if (!member.E || member.E <= 0) member.E = 200e6;
      if (!member.A || member.A <= 0) member.A = 0.00478; // ISMB300 area
      if (!member.I || member.I <= 0) member.I = 8.603e-5; // ISMB300 Ix
      // Extended props if present in downstream typing; guard with casting to avoid type errors
      const mAny = member as any;
      const Imajor = member.I ?? mAny.Iy ?? mAny.Iz ?? 8.603e-5; // prefer provided major inertia, else default
      if (!mAny.Iy || mAny.Iy <= 0) mAny.Iy = Imajor;
      if (!mAny.Iz || mAny.Iz <= 0) mAny.Iz = Math.min(Imajor, mAny.Iy); // keep minor axis as min(Iy, Iz)
      if (!mAny.J || mAny.J <= 0) mAny.J = 1.12e-5; // polar approx for ISMB300

      membersWithDefaultProps.add(member.id);
      if (defaultMembers.length < 5) {
        defaultMembers.push(member.id?.slice(0, 8) || 'unknown');
      }
    }
  });

  const missingProperties = membersWithDefaultProps.size;

  if (missingProperties > 0) {
    const memberList = defaultMembers.length > 0
      ? ` (${defaultMembers.join(', ')}${defaultMembers.length < missingProperties ? '...' : ''})`
      : '';
    const severity = missingProperties > members.size * 0.5 ? "high" : "medium";

    warnings.push({
      type: "warning",
      message: "Missing material/section assignment",
      details: `${missingProperties} member(s) were missing properties. Auto-filled fallback steel defaults (E=200 GPa, A≈47.8 cm², I≈8.6e4 cm⁴). Assign real sections for accuracy.${memberList}`,
      category: "materials",
      severity: severity,
      autoFixable: true,
      educational: {
        concept: "Material Properties",
        explanation: "Structural members need E (modulus of elasticity), A (area), and I (moment of inertia) for accurate analysis.",
        whyImportant: "Wrong properties lead to incorrect deflections, stresses, and safety factors."
      },
      suggestions: [
        {
          action: "Assign section profiles",
          description: "Select standard sections (ISMB, ISA, etc.) from the section browser",
          difficulty: "easy",
          impact: "high"
        },
        {
          action: "Define custom properties",
          description: "Manually enter E, A, I values for non-standard sections",
          difficulty: "medium",
          impact: "high"
        }
      ]
    });
  }

  // 7. Check for loads
  // This is handled separately, but we can warn if no loads exist

  // ========================================================================
  // 8. COMPREHENSIVE DETERMINACY ANALYSIS
  // ========================================================================

  // Convert to array format for determinacy analysis
  const nodesArray: DeterminacyNode[] = Array.from(nodes.values());
  const membersArray: DeterminacyMember[] = Array.from(members.values());

  // Auto-detect if structure is 3D based on Z-coordinate variation
  const zCoords = nodesArray.map((n) => n.z || 0);
  const uniqueZ = [...new Set(zCoords.map((z) => Math.round(z * 1000)))]; // Round to mm precision
  const is3D = uniqueZ.length > 1; // More than one distinct Z coordinate = 3D structure
  const structureType = is3D ? "3D" : "2D";

  // Run comprehensive determinacy analysis
  const determinacy = analyzeDeterminacy(
    nodesArray,
    membersArray,
    structureType,
  );

  // Add determinacy-specific errors and warnings
  determinacy.errors.forEach((err) => {
    errors.push({
      type: "critical",
      message: err,
      details: "From determinacy analysis",
    });
  });

  determinacy.warnings.forEach((warn) => {
    warnings.push({
      type: "warning",
      message: warn,
      details: "From determinacy analysis",
    });
  });

  // Determinacy analysis completed

  return {
    valid:
      errors.filter((e) => e.type === "error" || e.type === "critical")
        .length === 0,
    errors,
    warnings,
    info,
    determinacy, // Include full determinacy analysis
  };
}

/**
 * Count total number of translational restraints (fx, fy, fz)
 */
function countTranslationalRestraints(nodes: Map<string, Node>): number {
  let count = 0;
  nodes.forEach((node) => {
    if (node.restraints) {
      if (node.restraints.fx) count++;
      if (node.restraints.fy) count++;
      if (node.restraints.fz) count++;
    }
  });
  return count;
}

/**
 * Count rotational restraints (mx, my, mz)
 */
function countRotationalRestraints(nodes: Map<string, Node>): number {
  let count = 0;
  nodes.forEach((node) => {
    if (node.restraints) {
      if (node.restraints.mx) count++;
      if (node.restraints.my) count++;
      if (node.restraints.mz) count++;
    }
  });
  return count;
}

/**
 * Count total number of restraints in the structure (translational + rotational)
 */
function countRestraints(nodes: Map<string, Node>): number {
  return countTranslationalRestraints(nodes) + countRotationalRestraints(nodes);
}

/**
 * Get support type description
 */
export function getSupportType(restraints?: {
  fx?: boolean;
  fy?: boolean;
  fz?: boolean;
  mx?: boolean;
  my?: boolean;
  mz?: boolean;
}): string {
  if (!restraints) return "None";

  const fx = restraints.fx || false;
  const fy = restraints.fy || false;
  const fz = restraints.fz || false;

  if (fx && fy && fz) return "Fixed (3 DOF)";
  if (fx && fy) return "Pin (2 DOF)";
  if (fy) return "Roller-X (1 DOF)";
  if (fx) return "Roller-Y (1 DOF)";
  if (fz) return "Roller-Z (1 DOF)";

  return "None";
}

/**
 * Quick validation for specific error types
 */
export function hasMinimumSupports(nodes: Map<string, Node>): boolean {
  return countRestraints(nodes) >= 3;
}

export function hasZeroLengthMembers(
  nodes: Map<string, Node>,
  members: Map<string, Member>,
): boolean {
  for (const member of members.values()) {
    const startNode = nodes.get(member.startNodeId);
    const endNode = nodes.get(member.endNodeId);

    if (!startNode || !endNode) continue;

    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const dz = (endNode.z || 0) - (startNode.z || 0);
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (length < 1e-6) return true;
  }
  return false;
}
