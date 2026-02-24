/**
 * ============================================================================
 * DETERMINACY ANALYSIS - Complete Implementation
 * ============================================================================
 *
 * This module provides comprehensive analysis of:
 * 1. Static Determinacy/Indeterminacy
 * 2. Kinematic Determinacy/Stability
 * 3. Degree of Static Indeterminacy (DSI)
 * 4. Degree of Kinematic Indeterminacy (DKI)
 *
 * References:
 * - Structural Analysis by Hibbeler (Chapter 2)
 * - Matrix Structural Analysis by McGuire, Gallagher & Ziemian
 * - Theory of Structures by Timoshenko
 *
 * @version 1.0.0
 * @author BeamLab Engineering Team
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Node {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints?: {
    fx?: boolean; // Translation X restrained
    fy?: boolean; // Translation Y restrained
    fz?: boolean; // Translation Z restrained
    mx?: boolean; // Rotation about X restrained
    my?: boolean; // Rotation about Y restrained
    mz?: boolean; // Rotation about Z restrained
  };
}

export interface Member {
  id: string;
  startNodeId: string;
  endNodeId: string;
  releaseStart?: {
    mx?: boolean;
    my?: boolean;
    mz?: boolean;
  };
  releaseEnd?: {
    mx?: boolean;
    my?: boolean;
    mz?: boolean;
  };
  type?: "frame" | "truss" | "beam"; // Truss has pinned ends by default
}

export interface DeterminacyResult {
  // Static Determinacy
  isStaticallyDeterminate: boolean;
  degreeOfStaticIndeterminacy: number; // DSI (positive = indeterminate, negative = unstable)
  staticDescription: string;

  // Kinematic Stability
  isKinematicallyDeterminate: boolean; // Is structure stable?
  isStable: boolean; // Same as kinematically determinate
  degreeOfKinematicIndeterminacy: number; // DKI (negative = unstable mechanism)
  kinematicDescription: string;

  // Analysis details
  totalDOF: number;
  restrainedDOF: number;
  freeDOF: number;
  numMembers: number;
  numNodes: number;
  numReactions: number;
  internalReleases: number;

  // Rigid body modes
  hasRigidBodyModes: boolean;
  rigidBodyModes: string[];

  // Recommendations
  isAnalyzable: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export type StructureType = "2D" | "3D";

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Comprehensive determinacy analysis for structural systems
 *
 * @param nodes - Array of structural nodes with restraints
 * @param members - Array of structural members
 * @param structureType - '2D' or '3D' analysis
 * @returns Complete determinacy analysis result
 */
export function analyzeDeterminacy(
  nodes: Node[],
  members: Member[],
  structureType: StructureType = "2D",
): DeterminacyResult {
  const n = nodes.length; // Number of joints/nodes
  const m = members.length; // Number of members

  const dofPerNode = structureType === "2D" ? 3 : 6; // DOF per node
  const totalDOF = n * dofPerNode;

  // Count reactions from supports
  const { restrainedDOF, reactionComponents } = countRestraints(
    nodes,
    structureType,
  );
  const freeDOF = totalDOF - restrainedDOF;

  // Count internal releases
  const internalReleases = countInternalReleases(members, structureType);

  // Initialize result
  const result: DeterminacyResult = {
    isStaticallyDeterminate: false,
    degreeOfStaticIndeterminacy: 0,
    staticDescription: "",
    isKinematicallyDeterminate: false,
    isStable: false,
    degreeOfKinematicIndeterminacy: 0,
    kinematicDescription: "",
    totalDOF,
    restrainedDOF,
    freeDOF,
    numMembers: m,
    numNodes: n,
    numReactions: restrainedDOF,
    internalReleases,
    hasRigidBodyModes: false,
    rigidBodyModes: [],
    isAnalyzable: false,
    errors: [],
    warnings: [],
    recommendations: [],
  };

  // ========================================================================
  // KINEMATIC DETERMINACY (STABILITY) ANALYSIS
  // ========================================================================

  /**
   * For structure to be stable (kinematically determinate):
   * Total constraints (supports + member contributions) >= Total DOF
   *
   * For frames: member constraints = number of internal force/moment resultants
   * For trusses: member constraints = 1 per member (axial only)
   *
   * DKI = freeDOF - memberConstraints
   * But this simplification doesn't always work for 3D structures.
   *
   * A more robust approach: Check if the structure can resist arbitrary loading
   * without mechanism motion. We use the equilibrium matrix rank approach.
   *
   * Simplified check for stability:
   * - For 2D: Need at least 3 independent reactions + proper member connectivity
   * - For 3D: Need at least 6 independent reactions + proper member connectivity
   */

  // Use a more practical stability check
  const minReactionsNeeded = structureType === "2D" ? 3 : 6;
  const hasMinReactions = restrainedDOF >= minReactionsNeeded;

  // Check member connectivity - each unrestrained node needs to be connected
  const memberConstraints = calculateMemberConstraints(members, structureType);

  // Alternative DKI calculation: For frame structures
  // In frame analysis, each member provides full rigidity between its nodes
  // The structure is stable if the connectivity matrix has sufficient rank

  // Simplified stability: If we have enough supports and all nodes are connected
  const connectedNodes = new Set<string>();
  members.forEach((m) => {
    connectedNodes.add(m.startNodeId);
    connectedNodes.add(m.endNodeId);
  });
  const allNodesConnected = nodes.every(
    (n) =>
      connectedNodes.has(n.id) ||
      (n.restraints && Object.values(n.restraints).some((v) => v)),
  );

  // For typical frame structures: if we have proper supports, it's stable
  // The DKI approach is more relevant for mechanisms/trusses
  const isTruss = members.every((m) => isTrussMember(m));

  let DKI: number;
  if (isTruss) {
    // For trusses: DKI = 2n - (m + r) for 2D, 3n - (m + r) for 3D
    const j = nodes.length;
    const m_count = members.length;
    if (structureType === "2D") {
      DKI = 2 * j - m_count - restrainedDOF;
    } else {
      DKI = 3 * j - m_count - restrainedDOF;
    }
  } else {
    // For frames: More permissive - frames are inherently more stable
    // Each member provides full rigidity, so we mainly check support adequacy
    // DKI = freeDOF - memberConstraints (but memberConstraints now properly calculated)
    DKI = freeDOF - memberConstraints;
  }

  result.degreeOfKinematicIndeterminacy = DKI;

  // Stability decision - be more practical for frame structures
  if (isTruss) {
    result.isStable = DKI <= 0 && hasMinReactions && allNodesConnected;
  } else {
    // Frame structures: stable if properly supported and connected
    result.isStable = hasMinReactions && allNodesConnected && DKI <= 0;
    // Override for large indeterminate frames - they're definitely stable
    if (DKI < -10 && hasMinReactions) {
      result.isStable = true;
    }
  }

  result.isKinematicallyDeterminate = DKI === 0 && result.isStable;

  if (!result.isStable) {
    if (!hasMinReactions) {
      result.kinematicDescription = `UNSTABLE - Insufficient supports (need ${minReactionsNeeded}, have ${restrainedDOF})`;
      result.errors.push(
        `Insufficient supports: need at least ${minReactionsNeeded} restraints for ${structureType}, found ${restrainedDOF}`,
      );
    } else if (!allNodesConnected) {
      result.kinematicDescription = "UNSTABLE - Disconnected nodes present";
      result.errors.push("Some nodes are not connected to any members");
    } else {
      result.kinematicDescription = `UNSTABLE - Mechanism (${Math.abs(DKI)} DOF unrestrained)`;
      result.errors.push(
        `Structure is unstable - behaves as a mechanism with ${Math.abs(DKI)} degrees of freedom`,
      );
    }
    result.hasRigidBodyModes = true;
    result.rigidBodyModes = identifyRigidBodyModes(nodes, structureType);
    result.recommendations.push(
      "Add supports or members to eliminate rigid body motion",
    );
  } else if (DKI === 0) {
    result.kinematicDescription = "STABLE - Kinematically determinate";
  } else {
    result.kinematicDescription = `STABLE - Highly constrained (${Math.abs(DKI)} redundant DOF)`;
  }

  // ========================================================================
  // STATIC DETERMINACY ANALYSIS
  // ========================================================================

  /**
   * STANDARD FORMULAS:
   *
   * 2D FRAMES/BEAMS:
   *   DSI = (m + r) - 2j - c
   *   where: m = members, r = reactions, j = joints, c = condition equations
   *
   * 3D FRAMES:
   *   DSI = (m + r) - 3j - c
   *
   * 2D TRUSSES (all pinned):
   *   DSI = (m + r) - 2j
   *
   * 3D TRUSSES (all pinned):
   *   DSI = (m + r) - 3j
   *
   * If DSI < 0: UNSTABLE (insufficient constraints)
   * If DSI = 0: STATICALLY DETERMINATE
   * If DSI > 0: STATICALLY INDETERMINATE (degree = DSI)
   *
   * Note: Internal releases (hinges) reduce degree of indeterminacy
   */

  // Note: isTruss already defined above

  let DSI: number;

  if (structureType === "2D") {
    if (isTruss) {
      // 2D Truss: DSI = (m + r) - 2j
      DSI = m + restrainedDOF - 2 * n;
    } else {
      // 2D Frame: DSI = 3m + r - 3n - c
      // Each member contributes 3 internal unknowns (axial, shear, moment)
      // Each joint provides 3 equilibrium equations (ΣFx, ΣFy, ΣM)
      // Releases reduce indeterminacy
      DSI = 3 * m + restrainedDOF - 3 * n - internalReleases;
    }
  } else {
    // 3D Analysis
    if (isTruss) {
      // 3D Truss: DSI = (m + r) - 3j
      DSI = m + restrainedDOF - 3 * n;
    } else {
      // 3D Frame: DSI = 6m + r - 6n - c
      // Each member contributes 6 internal unknowns (3 forces + 3 moments)
      // Each joint provides 6 equilibrium equations (ΣFx, ΣFy, ΣFz, ΣMx, ΣMy, ΣMz)
      DSI = 6 * m + restrainedDOF - 6 * n - internalReleases;
    }
  }

  result.degreeOfStaticIndeterminacy = DSI;
  result.isStaticallyDeterminate = DSI === 0;

  if (DSI < 0) {
    result.staticDescription = `UNSTABLE - Deficient structure (${Math.abs(DSI)} constraints missing)`;
    result.errors.push(
      `Structure is statically unstable with deficiency of ${Math.abs(DSI)}`,
    );
  } else if (DSI === 0) {
    result.staticDescription =
      "STATICALLY DETERMINATE - Can be solved using equilibrium equations alone";
    // Only show as info, not warning - determinate structures are perfectly fine
    result.recommendations.push(
      "Tip: Determinate structures are simple to analyze but may be sensitive to settlements",
    );
  } else {
    result.staticDescription = `STATICALLY INDETERMINATE to degree ${DSI}`;
    // This is NOT an error - just informational. Indeterminate structures are common and good!
    result.recommendations.push(
      `Structure has ${DSI} degrees of redundancy - will use matrix/stiffness method for analysis (standard practice)`,
    );
  }

  // ========================================================================
  // DETAILED STABILITY CHECKS
  // ========================================================================

  // Note: Minimum support requirements already checked in kinematic stability section above
  // Only add error if not already flagged
  const minRestraints = structureType === "2D" ? 3 : 6;
  if (
    restrainedDOF < minRestraints &&
    !result.errors.some((e) => e.includes("Insufficient supports"))
  ) {
    result.errors.push(
      `Insufficient supports: need at least ${minRestraints} restraints for ${structureType} stability, found ${restrainedDOF}`,
    );
    result.recommendations.push(
      structureType === "2D"
        ? "Add: 1 Fixed support (3 restraints) OR 1 Pin + 1 Roller (3 total) OR equivalent"
        : "Add: 1 Fixed support (6 restraints) OR 2 Pins + 1 Roller (6 total) OR equivalent",
    );
  }

  // Check for proper constraint arrangement
  const hasProperArrangement = checkConstraintArrangement(
    nodes,
    members,
    structureType,
  );
  if (!hasProperArrangement.valid) {
    result.errors.push(hasProperArrangement.message);
    result.recommendations.push(...hasProperArrangement.recommendations);
  }

  // Check for parallel supports (geometric instability)
  const parallelCheck = checkParallelSupports(nodes, structureType);
  if (!parallelCheck.valid) {
    result.warnings.push(parallelCheck.message);
    result.recommendations.push(...parallelCheck.recommendations);
  }

  // ========================================================================
  // FINAL ANALYZABILITY CHECK
  // ========================================================================

  result.isAnalyzable = result.isStable && result.errors.length === 0;

  if (!result.isAnalyzable) {
    result.errors.push("Structure CANNOT be analyzed - fix errors first");
  } else if (DSI > 0) {
    result.recommendations.push(
      "Use Direct Stiffness Method or Matrix Analysis for indeterminate structures",
    );
  } else if (DSI === 0) {
    result.recommendations.push(
      "Can use either Equilibrium Method or Stiffness Method",
    );
  }

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Count total restrained DOFs from supports
 */
function countRestraints(
  nodes: Node[],
  structureType: StructureType,
): {
  restrainedDOF: number;
  reactionComponents: string[];
} {
  let count = 0;
  const components: string[] = [];

  nodes.forEach((node) => {
    if (!node.restraints) return;

    const r = node.restraints;

    if (r.fx) {
      count++;
      components.push(`${node.id}-Fx`);
    }
    if (r.fy) {
      count++;
      components.push(`${node.id}-Fy`);
    }
    if (r.mz) {
      count++;
      components.push(`${node.id}-Mz`);
    }

    if (structureType === "3D") {
      if (r.fz) {
        count++;
        components.push(`${node.id}-Fz`);
      }
      if (r.mx) {
        count++;
        components.push(`${node.id}-Mx`);
      }
      if (r.my) {
        count++;
        components.push(`${node.id}-My`);
      }
    }
  });

  return { restrainedDOF: count, reactionComponents: components };
}

/**
 * Count internal releases (hinges, moment releases)
 */
function countInternalReleases(
  members: Member[],
  structureType: StructureType,
): number {
  let count = 0;

  members.forEach((member) => {
    // Start releases
    if (member.releaseStart) {
      if (member.releaseStart.mz) count++;
      if (structureType === "3D") {
        if (member.releaseStart.mx) count++;
        if (member.releaseStart.my) count++;
      }
    }

    // End releases
    if (member.releaseEnd) {
      if (member.releaseEnd.mz) count++;
      if (structureType === "3D") {
        if (member.releaseEnd.mx) count++;
        if (member.releaseEnd.my) count++;
      }
    }
  });

  return count;
}

/**
 * Determine if member is a truss member (both ends pinned)
 * Supports both old format (releaseStart/releaseEnd) and new store format (releases)
 */
function isTrussMember(member: Member): boolean {
  if (member.type === "truss") return true;

  // Check if both ends have moment releases (old format)
  const startPinnedOld = member.releaseStart?.mz === true;
  const endPinnedOld = member.releaseEnd?.mz === true;

  if (startPinnedOld && endPinnedOld) return true;

  // Check new store format (releases.mzStart/mzEnd)
  const storeReleases = (member as any).releases;
  if (storeReleases) {
    const startPinnedNew =
      storeReleases.mzStart === true || storeReleases.startMoment === true;
    const endPinnedNew =
      storeReleases.mzEnd === true || storeReleases.endMoment === true;
    if (startPinnedNew && endPinnedNew) return true;
  }

  return false;
}

/**
 * Calculate constraints provided by members
 *
 * For FRAME/BEAM members:
 * - 2D: Each member provides 3 constraint equations (axial, shear, moment equilibrium)
 * - 3D: Each member provides 6 constraint equations (3 forces + 3 moments)
 *
 * For TRUSS members (pinned at both ends):
 * - Both 2D and 3D: Each member provides 1 constraint (axial only)
 *
 * The key insight: A rigid member connecting two nodes removes the relative
 * motion DOFs between those nodes. For frames this is more restrictive.
 */
function calculateMemberConstraints(
  members: Member[],
  structureType: StructureType,
): number {
  let totalConstraints = 0;

  members.forEach((member) => {
    if (isTrussMember(member)) {
      // Truss members only resist axial forces - 1 constraint
      totalConstraints += 1;
    } else {
      // Frame/beam members resist axial, shear, and bending
      if (structureType === "2D") {
        // 2D frame: resists axial + shear + moment = 3 internal forces
        // But actually provides 3 constraint equations per member
        totalConstraints += 3;
      } else {
        // 3D frame: resists Fx, Fy, Fz, Mx, My, Mz = 6 internal forces
        // Provides 6 constraint equations per member
        totalConstraints += 6;
      }
    }

    // Reduce for releases
    if (member.releaseStart) {
      if (member.releaseStart.mz) totalConstraints -= 1;
      if (structureType === "3D") {
        if (member.releaseStart.mx) totalConstraints -= 1;
        if (member.releaseStart.my) totalConstraints -= 1;
      }
    }
    if (member.releaseEnd) {
      if (member.releaseEnd.mz) totalConstraints -= 1;
      if (structureType === "3D") {
        if (member.releaseEnd.mx) totalConstraints -= 1;
        if (member.releaseEnd.my) totalConstraints -= 1;
      }
    }
  });

  return totalConstraints;
}

/**
 * Identify rigid body modes (possible movements)
 */
function identifyRigidBodyModes(
  nodes: Node[],
  structureType: StructureType,
): string[] {
  const modes: string[] = [];

  // Check what movements are not restrained
  let hasXRestraint = false;
  let hasYRestraint = false;
  let hasZRestraint = false;
  let hasRotationRestraint = false;

  nodes.forEach((node) => {
    if (node.restraints) {
      if (node.restraints.fx) hasXRestraint = true;
      if (node.restraints.fy) hasYRestraint = true;
      if (node.restraints.fz) hasZRestraint = true;
      if (node.restraints.mz || node.restraints.mx || node.restraints.my) {
        hasRotationRestraint = true;
      }
    }
  });

  if (!hasXRestraint) modes.push("Rigid body translation in X-direction");
  if (!hasYRestraint) modes.push("Rigid body translation in Y-direction");
  if (structureType === "3D" && !hasZRestraint)
    modes.push("Rigid body translation in Z-direction");
  if (!hasRotationRestraint)
    modes.push(
      `Rigid body rotation about ${structureType === "2D" ? "Z-axis" : "global axes"}`,
    );

  return modes;
}

/**
 * Check if supports are properly arranged to prevent instability
 */
function checkConstraintArrangement(
  nodes: Node[],
  members: Member[],
  structureType: StructureType,
): { valid: boolean; message: string; recommendations: string[] } {
  const recommendations: string[] = [];

  // Get all support nodes
  const supportNodes = nodes.filter(
    (n) =>
      n.restraints &&
      (n.restraints.fx ||
        n.restraints.fy ||
        n.restraints.fz ||
        n.restraints.mx ||
        n.restraints.my ||
        n.restraints.mz),
  );

  if (supportNodes.length === 0) {
    return {
      valid: false,
      message: "No supports found",
      recommendations: [
        "Add at least one support to prevent rigid body motion",
      ],
    };
  }

  // For 2D structures: supports must not be collinear (except for special cases)
  if (structureType === "2D" && supportNodes.length >= 2) {
    // Check if all supports lie on same line
    const points = supportNodes.map((n) => ({ x: n.x, y: n.y }));

    if (points.length >= 3) {
      const areCollinear = checkCollinearity(points);
      if (areCollinear) {
        recommendations.push(
          "Supports are collinear - may cause rotational instability",
        );
        recommendations.push("Add a support not on the same line");
      }
    }
  }

  return {
    valid: true,
    message: "Support arrangement is acceptable",
    recommendations,
  };
}

/**
 * Check if points are collinear
 */
function checkCollinearity(points: { x: number; y: number }[]): boolean {
  if (points.length < 3) return false;

  const p1 = points[0];
  const p2 = points[1];
  const tolerance = 1e-6;

  for (let i = 2; i < points.length; i++) {
    const p3 = points[i];

    // Calculate cross product
    const cross = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);

    if (Math.abs(cross) > tolerance) {
      return false; // Not collinear
    }
  }

  return true; // All points are collinear
}

/**
 * Check for parallel support reactions (can cause instability)
 */
function checkParallelSupports(
  nodes: Node[],
  structureType: StructureType,
): { valid: boolean; message: string; recommendations: string[] } {
  const recommendations: string[] = [];

  // Count support types
  let onlyXSupports = 0;
  let onlyYSupports = 0;
  let onlyZSupports = 0;

  nodes.forEach((node) => {
    if (!node.restraints) return;

    const r = node.restraints;
    const xOnly = r.fx && !r.fy && !r.fz;
    const yOnly = r.fy && !r.fx && !r.fz;
    const zOnly = r.fz && !r.fx && !r.fy;

    if (xOnly) onlyXSupports++;
    if (yOnly) onlyYSupports++;
    if (zOnly) onlyZSupports++;
  });

  // If all supports are in same direction, structure can move perpendicular
  if (nodes.length === onlyXSupports) {
    return {
      valid: false,
      message:
        "All supports only restrain X-direction - structure can move in Y",
      recommendations: ["Add supports restraining Y-direction movement"],
    };
  }

  if (nodes.length === onlyYSupports) {
    return {
      valid: false,
      message:
        "All supports only restrain Y-direction - structure can move in X",
      recommendations: ["Add supports restraining X-direction movement"],
    };
  }

  if (structureType === "3D" && nodes.length === onlyZSupports) {
    return {
      valid: false,
      message:
        "All supports only restrain Z-direction - structure can move in XY plane",
      recommendations: ["Add supports restraining XY-plane movement"],
    };
  }

  return {
    valid: true,
    message: "Support directions are acceptable",
    recommendations,
  };
}

// ============================================================================
// UTILITY FUNCTIONS FOR DISPLAY
// ============================================================================

/**
 * Get human-readable description of determinacy
 */
export function getDeterminacyDescription(result: DeterminacyResult): string {
  const lines: string[] = [];

  lines.push(`📊 DETERMINACY ANALYSIS (${result.totalDOF} total DOF)`);
  lines.push("");
  lines.push(
    `Nodes: ${result.numNodes} | Members: ${result.numMembers} | Reactions: ${result.numReactions}`,
  );
  lines.push("");
  lines.push(`🔧 Static: ${result.staticDescription}`);
  lines.push(`🏗️  Kinematic: ${result.kinematicDescription}`);
  lines.push("");

  if (result.degreeOfStaticIndeterminacy !== 0) {
    lines.push(`   DSI = ${result.degreeOfStaticIndeterminacy}`);
  }

  if (result.hasRigidBodyModes) {
    lines.push("");
    lines.push("⚠️  RIGID BODY MODES DETECTED:");
    result.rigidBodyModes.forEach((mode) => lines.push(`   - ${mode}`));
  }

  if (result.errors.length > 0) {
    lines.push("");
    lines.push("❌ ERRORS:");
    result.errors.forEach((err) => lines.push(`   - ${err}`));
  }

  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("⚡ WARNINGS:");
    result.warnings.forEach((warn) => lines.push(`   - ${warn}`));
  }

  if (result.recommendations.length > 0) {
    lines.push("");
    lines.push("💡 RECOMMENDATIONS:");
    result.recommendations.forEach((rec) => lines.push(`   - ${rec}`));
  }

  lines.push("");
  lines.push(`✅ Analyzable: ${result.isAnalyzable ? "YES" : "NO"}`);

  return lines.join("\n");
}

/**
 * Export for use in validation
 */
export function validateDeterminacy(
  nodes: Node[],
  members: Member[],
  structureType: StructureType = "2D",
): { valid: boolean; errors: string[]; warnings: string[] } {
  const result = analyzeDeterminacy(nodes, members, structureType);

  return {
    valid: result.isAnalyzable,
    errors: result.errors,
    warnings: result.warnings,
  };
}
