/**
 * structureClassifier.ts — Intelligent Structure Classification Engine
 *
 * Inspects the active model (nodes, members, plates, loads, releases) and
 * determines:
 *   1. What TYPE of structure this is (beam, frame, truss, cable, plate/shell…)
 *   2. Which advanced analysis types are APPLICABLE to this structure
 *   3. Why certain analysis types are NOT applicable
 *
 * Used by AdvancedAnalysisDialog to gate analysis options so users cannot
 * run meaningless analyses (e.g. cable analysis on a simple beam).
 */

import type { Node, Member, Plate, MemberLoad, NodeLoad } from '../store/model';

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ────────────────────────────────────────────────────────────────────────────

/** High-level structural classification */
export type StructureCategory =
  | 'simple_beam'
  | 'continuous_beam'
  | 'portal_frame_2d'
  | 'multi_story_frame_2d'
  | 'space_frame_3d'
  | 'truss_2d'
  | 'truss_3d'
  | 'cable_structure'
  | 'plate_shell'
  | 'mixed'
  | 'unknown';

/** Per-analysis eligibility record */
export interface AnalysisEligibility {
  id: 'pdelta' | 'modal' | 'spectrum' | 'buckling' | 'cable' | 'timehistory';
  eligible: boolean;
  /** Short reason shown under the tab when disabled */
  reason: string;
  /** Optional: what the user should do to enable it */
  hint?: string;
}

/** Complete classification result */
export interface StructureClassification {
  /** Primary classification label */
  category: StructureCategory;
  /** Human-friendly name, e.g. "2D Portal Frame" */
  label: string;
  /** One-sentence description of why this classification was chosen */
  description: string;

  // Geometry flags
  is2D: boolean;
  is3D: boolean;
  isTruss: boolean;
  isFrame: boolean;
  hasCableMembers: boolean;
  hasPlates: boolean;

  // Size metrics
  numNodes: number;
  numMembers: number;
  numPlates: number;
  numStories: number; // approximate
  maxHeight: number; // m
  maxSpan: number; // m (horizontal extent)
  slendernessRatio: number; // height / avg width — high → P-Delta relevant

  /** Per-analysis eligibility (same order as ANALYSIS_OPTIONS) */
  eligibility: AnalysisEligibility[];
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function isTrussMember(m: Member): boolean {
  if (!m.releases) return false;
  // Both-end moment releases → truss member (axial-only)
  const startMom = m.releases.startMoment || m.releases.mzStart;
  const endMom = m.releases.endMoment || m.releases.mzEnd;
  return !!(startMom && endMom);
}

function isCableMember(m: Member): boolean {
  // Cable if section type is CIRCLE with very small diameter or if it has
  // full bending releases at both ends AND very low I
  if (m.sectionType === 'CIRCLE' && (m.I === undefined || m.I < 1e-8)) {
    // Likely a cable/tendon
    if (m.releases?.startMoment && m.releases?.endMoment) return true;
    if (m.releases?.mzStart && m.releases?.mzEnd) return true;
  }
  return false;
}

function distance(a: Node, b: Node): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

/** Approximate number of stories by counting distinct Y-level clusters */
function estimateStories(nodes: Node[]): number {
  if (nodes.length === 0) return 0;
  const yVals = nodes.map((n) => n.y).sort((a, b) => a - b);
  const tolerance = 0.3; // m — nodes within 0.3 m of each other are same level
  const levels: number[] = [yVals[0]];
  for (let i = 1; i < yVals.length; i++) {
    if (yVals[i] - levels[levels.length - 1] > tolerance) {
      levels.push(yVals[i]);
    }
  }
  return Math.max(levels.length - 1, 0); // stories = levels - 1
}

/** Check if all Z-coords are effectively the same → 2D structure */
function detect2D(nodes: Node[]): boolean {
  if (nodes.length === 0) return true;
  const zVals = nodes.map((n) => n.z ?? 0);
  const zMin = Math.min(...zVals);
  const zMax = Math.max(...zVals);
  return zMax - zMin < 0.001;
}

/** Check if members form columns (vertical members) */
function hasVerticalMembers(members: Member[], nodeMap: Map<string, Node>): boolean {
  for (const m of members) {
    const sn = nodeMap.get(m.startNodeId);
    const en = nodeMap.get(m.endNodeId);
    if (!sn || !en) continue;
    const dx = Math.abs(en.x - sn.x);
    const dy = Math.abs(en.y - sn.y);
    const dz = Math.abs(en.z - sn.z);
    const horiz = Math.sqrt(dx * dx + dz * dz);
    // Primarily vertical if vertical component > 70% of total
    if (dy > 0.01 && dy / Math.sqrt(dx * dx + dy * dy + dz * dz) > 0.7) {
      return true;
    }
  }
  return false;
}

/** Check if model has any lateral (horizontal) loads */
function hasLateralLoads(nodeLoads: NodeLoad[], memberLoads: MemberLoad[]): boolean {
  for (const nl of nodeLoads) {
    if ((nl.fx && Math.abs(nl.fx) > 1e-6) || (nl.fz && Math.abs(nl.fz) > 1e-6)) return true;
  }
  // Horizontal member loads would count too but most UDLs are gravity
  return false;
}

/** Check if model has any gravity loads */
function hasGravityLoads(nodeLoads: NodeLoad[], memberLoads: MemberLoad[]): boolean {
  for (const nl of nodeLoads) {
    if (nl.fy && Math.abs(nl.fy) > 1e-6) return true;
  }
  return memberLoads.length > 0; // member loads are typically gravity
}

/** Check if any node has support restraints */
function hasSupports(nodes: Node[]): boolean {
  return nodes.some((n) => n.restraints && Object.values(n.restraints).some(Boolean));
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN CLASSIFIER
// ────────────────────────────────────────────────────────────────────────────

export function classifyStructure(
  nodes: Map<string, Node>,
  members: Map<string, Member>,
  plates: Map<string, Plate>,
  nodeLoads: NodeLoad[],
  memberLoads: MemberLoad[],
): StructureClassification {
  const nodesArr = Array.from(nodes.values());
  const membersArr = Array.from(members.values());
  const platesArr = Array.from(plates.values());

  const numNodes = nodesArr.length;
  const numMembers = membersArr.length;
  const numPlates = platesArr.length;

  // ── Geometry detection ─────────────────────────────────────────────────
  const is2D = detect2D(nodesArr);
  const is3D = !is2D;

  const trussMembers = membersArr.filter(isTrussMember);
  const cableMembers = membersArr.filter(isCableMember);
  const frameMembers = membersArr.filter((m) => !isTrussMember(m) && !isCableMember(m));

  const isTruss = trussMembers.length > 0 && trussMembers.length === numMembers;
  const isFrame = frameMembers.length > 0;
  const hasCableMembers = cableMembers.length > 0;
  const hasPlateElements = numPlates > 0;
  const hasColumns = hasVerticalMembers(membersArr, nodes);

  // ── Size metrics ────────────────────────────────────────────────────────
  const xVals = nodesArr.map((n) => n.x);
  const yVals = nodesArr.map((n) => n.y);
  const zVals = nodesArr.map((n) => n.z ?? 0);
  const xSpan = nodesArr.length ? Math.max(...xVals) - Math.min(...xVals) : 0;
  const ySpan = nodesArr.length ? Math.max(...yVals) - Math.min(...yVals) : 0;
  const zSpan = nodesArr.length ? Math.max(...zVals) - Math.min(...zVals) : 0;
  const maxHeight = ySpan;
  const maxSpan = Math.max(xSpan, zSpan);
  const avgWidth = is2D ? xSpan : (xSpan + zSpan) / 2;
  const slendernessRatio = avgWidth > 0.01 ? maxHeight / avgWidth : 0;
  const numStories = estimateStories(nodesArr);

  // ── Classify ────────────────────────────────────────────────────────────
  let category: StructureCategory = 'unknown';
  let label = 'Unknown Structure';
  let description = '';

  if (numMembers === 0 && numPlates === 0) {
    category = 'unknown';
    label = 'No Structure';
    description = 'No members or plates defined yet.';
  } else if (hasPlateElements && numMembers === 0) {
    category = 'plate_shell';
    label = 'Plate / Shell Structure';
    description = `Pure plate/shell model with ${numPlates} elements.`;
  } else if (hasCableMembers && cableMembers.length >= numMembers * 0.5) {
    category = 'cable_structure';
    label = 'Cable Structure';
    description = `Cable-dominated structure with ${cableMembers.length} cable members.`;
  } else if (isTruss && is2D) {
    category = 'truss_2d';
    label = '2D Truss';
    description = `Planar truss with ${numMembers} bar elements (all moment-released).`;
  } else if (isTruss && is3D) {
    category = 'truss_3d';
    label = '3D Space Truss';
    description = `Space truss with ${numMembers} bar elements.`;
  } else if (isFrame && is2D) {
    // Distinguish: simple beam, continuous beam, portal frame, multi-story frame
    if (!hasColumns && numMembers <= 3) {
      // All horizontal, 1-3 spans → beam
      category = numMembers === 1 ? 'simple_beam' : 'continuous_beam';
      label = numMembers === 1 ? 'Simple Beam' : 'Continuous Beam';
      description = numMembers === 1
        ? 'Single-span beam element.'
        : `Continuous beam with ${numMembers} spans.`;
    } else if (hasColumns && numStories <= 1) {
      category = 'portal_frame_2d';
      label = '2D Portal Frame';
      description = `Single-story portal frame (${numMembers} members, ${numNodes} nodes).`;
    } else if (hasColumns && numStories > 1) {
      category = 'multi_story_frame_2d';
      label = `2D Multi-Story Frame (${numStories} stories)`;
      description = `Multi-story frame, height ${maxHeight.toFixed(1)} m, ${numMembers} members.`;
    } else {
      category = 'portal_frame_2d';
      label = '2D Frame';
      description = `Planar frame structure (${numMembers} members).`;
    }
  } else if (isFrame && is3D) {
    category = 'space_frame_3d';
    label = '3D Space Frame';
    description = `3D frame with ${numMembers} members across ${numNodes} nodes.`;
  } else if (numMembers > 0 && numPlates > 0) {
    category = 'mixed';
    label = 'Mixed Frame + Plate System';
    description = `Hybrid model: ${numMembers} frame members + ${numPlates} plate elements.`;
  } else {
    category = 'mixed';
    label = 'Mixed Structure';
    description = `${trussMembers.length} truss + ${frameMembers.length} frame + ${cableMembers.length} cable members.`;
  }

  // ── Eligibility rules ──────────────────────────────────────────────────
  const eligibility: AnalysisEligibility[] = [];

  // --- P-Delta ---
  const pDeltaEligible = (() => {
    // P-Delta needs: gravity loads on vertical members (columns) or significant axial loads
    // Applicable to: frames with columns, multi-story, slender structures
    // NOT applicable to: pure beams (no axial-gravity coupling), trusses (already geometric),
    //                     cable structures, plate-only models
    if (category === 'simple_beam' || category === 'continuous_beam') {
      return { ok: false, reason: 'P-Delta is not applicable to beams without columns — no gravity-axial coupling.', hint: 'Add columns to create a frame.' };
    }
    if (isTruss) {
      return { ok: false, reason: 'Trusses carry purely axial loads — P-Delta geometric nonlinearity is implicit in axial behavior.', hint: undefined };
    }
    if (category === 'cable_structure') {
      return { ok: false, reason: 'Cable structures use catenary analysis, not P-Delta.', hint: 'Use Cable Analysis instead.' };
    }
    if (category === 'plate_shell') {
      return { ok: false, reason: 'P-Delta is for frame structures with columns, not plate/shell models.', hint: undefined };
    }
    if (!hasColumns) {
      return { ok: false, reason: 'No vertical (column) members detected — P-Delta requires gravity-loaded columns.', hint: 'Add column members.' };
    }
    return { ok: true, reason: 'Structure has columns subject to gravity loads — second-order effects may be significant.' };
  })();
  eligibility.push({ id: 'pdelta', eligible: pDeltaEligible.ok, reason: pDeltaEligible.reason, hint: pDeltaEligible.hint });

  // --- Modal Analysis ---
  const modalEligible = (() => {
    // Modal analysis extracts natural frequencies/mode shapes.
    // Applicable to: almost any structure with mass and stiffness
    // NOT applicable to: unstable structures (but we let the solver catch that),
    //                     models with < 2 nodes, pure plate models (our solver is frame-based)
    if (numNodes < 2 || numMembers < 1) {
      return { ok: false, reason: 'Need at least 2 nodes and 1 member to extract vibration modes.', hint: 'Define a structural model first.' };
    }
    if (category === 'plate_shell') {
      return { ok: false, reason: 'Our modal solver handles frame/truss members; plate/shell modal not yet supported.', hint: 'Add frame members for modal analysis.' };
    }
    // Modal is generally applicable to beams, frames, trusses
    return { ok: true, reason: 'Vibration modes can be extracted for this structure.' };
  })();
  eligibility.push({ id: 'modal', eligible: modalEligible.ok, reason: modalEligible.reason, hint: modalEligible.hint });

  // --- Time History ---
  const timeHistoryEligible = (() => {
    // Time history = dynamic time-stepping (Newmark-beta). Needs mass + stiffness.
    // Requires: modal analysis prerequisites + at least multi-DOF structure
    // Best for: frames, multi-story buildings, structures with seismic input
    // NOT for: simple beams (use dynamic beam theory), cable structures, plate-only
    if (numNodes < 2 || numMembers < 1) {
      return { ok: false, reason: 'Need structural members for time-history integration.', hint: 'Build a frame model first.' };
    }
    if (category === 'simple_beam') {
      return { ok: false, reason: 'Single-span beams are better analyzed with closed-form dynamic beam theory.', hint: 'Create a frame or multi-span structure.' };
    }
    if (category === 'cable_structure') {
      return { ok: false, reason: 'Cable dynamics require specialized nonlinear time-stepping, not standard Newmark-beta.', hint: undefined };
    }
    if (category === 'plate_shell') {
      return { ok: false, reason: 'Plate/shell time-history not yet supported.', hint: 'Add frame members.' };
    }
    if (isTruss && numMembers < 5) {
      return { ok: false, reason: 'Too few truss members for meaningful dynamic analysis.', hint: 'Expand the truss to 5+ members.' };
    }
    return { ok: true, reason: 'Structure is suitable for seismic time-history analysis.' };
  })();
  eligibility.push({ id: 'timehistory', eligible: timeHistoryEligible.ok, reason: timeHistoryEligible.reason, hint: timeHistoryEligible.hint });

  // --- Response Spectrum ---
  const spectrumEligible = (() => {
    // IS 1893 response spectrum: modal superposition for seismic base shear.
    // Requires: modal analysis (so prerequisites are the same), plus lateral DOFs, plus mass participation.
    // Best for: multi-story frames, significant buildings.
    // NOT for: simple beams, trusses (no lateral DOFs worth analyzing), cable, plate-only.
    if (numNodes < 2 || numMembers < 1) {
      return { ok: false, reason: 'No structural model to analyze.', hint: 'Build a frame first.' };
    }
    if (category === 'simple_beam' || category === 'continuous_beam') {
      return { ok: false, reason: 'Beams do not have significant lateral seismic response — response spectrum is for multi-DOF systems.', hint: 'Create a frame or multi-story structure.' };
    }
    if (isTruss) {
      return { ok: false, reason: 'Trusses typically lack lateral mass participation needed for meaningful spectrum analysis.', hint: 'Use a frame model for seismic analysis.' };
    }
    if (category === 'cable_structure') {
      return { ok: false, reason: 'Cable structures require nonlinear dynamic analysis, not linear spectrum superposition.', hint: undefined };
    }
    if (category === 'plate_shell') {
      return { ok: false, reason: 'Plate/shell spectrum analysis not yet supported.', hint: 'Add frame members.' };
    }
    if (!hasColumns) {
      return { ok: false, reason: 'Response spectrum requires vertical elements (columns) to develop lateral base shear.', hint: 'Add columns to your model.' };
    }
    return { ok: true, reason: 'Multi-DOF frame — IS 1893 spectrum analysis is applicable.' };
  })();
  eligibility.push({ id: 'spectrum', eligible: spectrumEligible.ok, reason: spectrumEligible.reason, hint: spectrumEligible.hint });

  // --- Buckling ---
  const bucklingEligible = (() => {
    // Linear stability / eigenvalue buckling. Needs axial loads.
    // Applicable to: frames with columns, trusses, any compressed member.
    // NOT for: cable structures (no compression), pure beams without axial load,
    //          plate-only (our solver doesn't do plate buckling).
    if (numNodes < 2 || numMembers < 1) {
      return { ok: false, reason: 'No structural model to analyze.', hint: 'Build a model first.' };
    }
    if (category === 'cable_structure') {
      return { ok: false, reason: 'Cables are tension-only members — they cannot buckle.', hint: undefined };
    }
    if (category === 'plate_shell') {
      return { ok: false, reason: 'Plate buckling analysis requires shell eigenvalue formulation (not yet supported).', hint: 'Use frame members for Euler buckling.' };
    }
    if (category === 'simple_beam' || category === 'continuous_beam') {
      // Beams can have lateral-torsional buckling, but that requires axial loads
      // For our solver: we check Euler column buckling → needs axial compression
      return { ok: false, reason: 'Euler buckling analysis requires compression members (columns). Beams without axial load do not buckle.', hint: 'Add columns or apply axial compression.' };
    }
    // Trusses: can buckle (compressed members)
    // Frames with columns: can buckle
    return { ok: true, reason: 'Compression members present — critical buckling load can be determined.' };
  })();
  eligibility.push({ id: 'buckling', eligible: bucklingEligible.ok, reason: bucklingEligible.reason, hint: bucklingEligible.hint });

  // --- Cable Analysis ---
  const cableEligible = (() => {
    // Cable/catenary analysis. Only for structures that actually have cable members
    // or tension-only elements.
    if (!hasCableMembers) {
      if (isTruss) {
        return { ok: false, reason: 'No cable members detected. Truss members are rigid bars, not cables.', hint: 'Add cable elements (CIRCLE section with full moment releases) to use cable analysis.' };
      }
      if (isFrame) {
        return { ok: false, reason: 'No cable members detected in this frame model.', hint: 'Add cable elements (CIRCLE section with both-end moment releases) for catenary analysis.' };
      }
      return { ok: false, reason: 'No cable members found in the model.', hint: 'Define cable elements first.' };
    }
    return { ok: true, reason: `${cableMembers.length} cable element(s) detected — catenary analysis will compute sag and effective modulus.` };
  })();
  eligibility.push({ id: 'cable', eligible: cableEligible.ok, reason: cableEligible.reason, hint: cableEligible.hint });

  return {
    category,
    label,
    description,
    is2D,
    is3D,
    isTruss,
    isFrame,
    hasCableMembers,
    hasPlates: hasPlateElements,
    numNodes,
    numMembers,
    numPlates,
    numStories,
    maxHeight,
    maxSpan,
    slendernessRatio,
    eligibility,
  };
}
