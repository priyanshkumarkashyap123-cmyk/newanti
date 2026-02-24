/**
 * ============================================================================
 * ITERATIVE SECTION OPTIMIZER — Self-Correcting Design Engine
 * ============================================================================
 *
 * Given (L, w, fck, fy, support, code, extraFoS), this module:
 *
 *   1. Checks the DesignKnowledgeBase for an exact hit   → returns instantly
 *   2. Checks bracket interpolation for a near-hit        → returns estimate + confidence
 *   3. If no hit: iterates section dimensions (b × D) from minimum to find
 *      the optimal section where utilisation ≈ 85-95 %
 *   4. Stores the converged result back into the knowledge base
 *
 * Over time this makes the design process faster:
 *   • First design of a 6 m SS beam with 20 kN/m UDL in M25/Fe500 → ~15 iterations
 *   • Second identical query                                       → 0 iterations (cache hit)
 *   • Similar 6.5 m beam                                           → bracket interpolation
 *
 * All calculations delegate to the existing RCBeamDesignEngine so
 * every result is fully IS 456 / ACI 318 / EC2 compliant.
 *
 * @version 1.0.0
 */

import {
  RCBeamDesignEngine,
  type BeamGeometry,
  type BeamLoading,
  type BeamMaterials,
  type BeamDesignResult,
} from '../../modules/concrete/RCBeamDesignEngine';
import {
  type DesignCode,
  type ConcreteGrade,
  type SteelGrade,
  getConcreteGrades,
  getSteelGrades,
} from '../../modules/concrete/RCDesignConstants';
import {
  DesignKnowledgeBase,
  type DesignInputKey,
  type CachedDesignResult,
  type DesignCodeKey,
  type SupportType,
} from './DesignKnowledgeBase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OptimizeRequest {
  /** Span in mm */
  L: number;
  /** UDL in kN/m (service / unfactored) */
  w_service: number;
  /** Load factor (IS 456 default: 1.5 for DL+LL) */
  loadFactor?: number;
  /** Concrete grade string e.g. "M25" */
  concreteGrade?: string;
  /** Steel grade string e.g. "Fe500" */
  steelGrade?: string;
  /** Design code */
  code?: DesignCodeKey;
  /** Support condition */
  support?: SupportType;
  /** Clear cover mm */
  cover?: number;
  /**
   * User-specified additional FoS beyond code requirements.
   * 1.0 = no extra, 1.1 = 10 % extra margin, etc.
   */
  extraFoS?: number;
  /** Target utilisation band (default 0.85 – 0.95) */
  targetUtilization?: { min: number; max: number };
  /** Preferred width mm (if user has a preference) */
  preferredWidth?: number;
  /** Minimum width mm */
  minWidth?: number;
  /** Maximum depth mm */
  maxDepth?: number;
}

export interface OptimizeResult {
  /** Was this a cache hit, bracket interpolation, or fresh computation? */
  source: 'cache' | 'interpolation' | 'computed';
  /** Confidence 0-1 (1.0 for cache, variable for interpolation, 1.0 for computed) */
  confidence: number;
  /** Optimal width mm */
  b: number;
  /** Optimal total depth mm */
  D: number;
  /** Effective depth mm */
  d: number;
  /** Required tension steel mm² */
  Ast: number;
  /** Required compression steel mm² */
  Asc: number;
  /** Utilisation ratio */
  utilization: number;
  /** Moment capacity kN·m */
  Mu_capacity: number;
  /** Shear capacity kN */
  Vu_capacity: number;
  /** Selected bars */
  tensionBars: { diameter: number; count: number; area: number }[];
  compressionBars: { diameter: number; count: number; area: number }[];
  /** Overall status */
  status: string;
  /** Full design result from RCBeamDesignEngine */
  fullResult: BeamDesignResult;
  /** Number of iterations to converge (0 for cache hits) */
  iterations: number;
  /** Time taken ms */
  timeMs: number;
  /** Suggestions for user */
  suggestions: string[];
  /** How many similar designs the KB has seen */
  similarDesignCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard beam widths (IS 456 practice)
// ─────────────────────────────────────────────────────────────────────────────
const STANDARD_WIDTHS = [150, 200, 230, 250, 300, 350, 400, 450, 500];
const DEPTH_STEP = 25; // mm — depth increments

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve grade objects from string & code
// ─────────────────────────────────────────────────────────────────────────────

function findConcreteGrade(gradeStr: string, code: DesignCode): ConcreteGrade {
  const grades = getConcreteGrades(code);
  return grades.find((g) => g.grade === gradeStr) ?? grades.find((g) => g.fck === 25)!;
}

function findSteelGrade(gradeStr: string, code: DesignCode): SteelGrade {
  const grades = getSteelGrades(code);
  return grades.find((g) => g.grade === gradeStr) ?? grades.find((g) => g.fy === 500)!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factored loads for different support conditions
// ─────────────────────────────────────────────────────────────────────────────

function computeDesignForces(
  w_factored: number,
  L_m: number,
  support: SupportType,
): { Mu: number; Vu: number } {
  switch (support) {
    case 'simply-supported':
      return {
        Mu: (w_factored * L_m * L_m) / 8,   // kN·m
        Vu: (w_factored * L_m) / 2,          // kN
      };
    case 'cantilever':
      return {
        Mu: (w_factored * L_m * L_m) / 2,
        Vu: w_factored * L_m,
      };
    case 'fixed-fixed':
      return {
        Mu: (w_factored * L_m * L_m) / 12,  // Mid-span moment (support moment is wL²/12)
        Vu: (w_factored * L_m) / 2,
      };
    case 'continuous':
      // Conservative: use 0.7 × SS moment for typical interior span
      return {
        Mu: 0.7 * (w_factored * L_m * L_m) / 8,
        Vu: 0.6 * (w_factored * L_m) / 2,
      };
    default:
      return {
        Mu: (w_factored * L_m * L_m) / 8,
        Vu: (w_factored * L_m) / 2,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main optimizer
// ─────────────────────────────────────────────────────────────────────────────

export async function optimizeSection(req: OptimizeRequest): Promise<OptimizeResult> {
  const t0 = performance.now();
  await DesignKnowledgeBase.init();

  // ── Defaults ───────────────────────────────────────────────────────────
  const code: DesignCodeKey = req.code ?? 'IS456';
  const support: SupportType = req.support ?? 'simply-supported';
  const loadFactor = req.loadFactor ?? 1.5;
  const extraFoS = req.extraFoS ?? 1.0;
  const cover = req.cover ?? 25;
  const targetUtil = req.targetUtilization ?? { min: 0.80, max: 0.95 };

  const concreteGrade = findConcreteGrade(req.concreteGrade ?? 'M25', code as DesignCode);
  const steelGrade = findSteelGrade(req.steelGrade ?? 'Fe500', code as DesignCode);

  const w_factored = req.w_service * loadFactor * extraFoS; // kN/m
  const L_m = req.L / 1000; // mm → m
  const { Mu, Vu } = computeDesignForces(w_factored, L_m, support);

  const inputKey: DesignInputKey = {
    memberType: 'beam',
    code,
    support,
    L: req.L,
    w: w_factored,
    fck: concreteGrade.fck,
    fy: steelGrade.fy,
    extraFoS,
  };

  // ── 1. Exact cache hit ─────────────────────────────────────────────────
  const cached = DesignKnowledgeBase.getExact(inputKey);
  if (cached) {
    const elapsed = performance.now() - t0;
    return {
      source: 'cache',
      confidence: 1.0,
      b: cached.b,
      D: cached.D,
      d: cached.d,
      Ast: cached.Ast,
      Asc: cached.Asc,
      utilization: cached.utilization,
      Mu_capacity: cached.Mu_capacity,
      Vu_capacity: cached.Vu_capacity,
      tensionBars: cached.tensionBars,
      compressionBars: cached.compressionBars,
      status: cached.status,
      fullResult: cached.fullResult,
      iterations: 0,
      timeMs: elapsed,
      suggestions: [`Instant result from ${DesignKnowledgeBase.cacheSize} cached designs`],
      similarDesignCount: DesignKnowledgeBase.totalBracketEntries,
    };
  }

  // ── 2. Bracket interpolation (use as starting estimate) ────────────────
  let startB = req.preferredWidth ?? req.minWidth ?? 230;
  let startD = Math.max(300, Math.round(L_m * 1000 / 16)); // Thumb rule: L/16

  const interp = DesignKnowledgeBase.interpolate(inputKey);
  if (interp && interp.confidence >= 0.7) {
    startB = interp.b;
    startD = interp.D;
  }

  // Snap to standard widths
  const widths = req.preferredWidth
    ? [req.preferredWidth]
    : STANDARD_WIDTHS.filter((w) => w >= (req.minWidth ?? 150));

  // ── 3. Iterative design ────────────────────────────────────────────────
  let bestResult: BeamDesignResult | null = null;
  let bestB = startB;
  let bestD = startD;
  let bestUtil = 0;
  let iterations = 0;
  const maxIter = 100;

  for (const width of widths) {
    // Start depth from rule-of-thumb, iterate up/down
    const minDepth = Math.max(width, 250);
    const maxDepth = req.maxDepth ?? 1200;

    // Binary search for optimal depth at this width
    let lo = minDepth;
    let hi = maxDepth;

    while (hi - lo > DEPTH_STEP && iterations < maxIter) {
      iterations++;
      const midD = Math.round((lo + hi) / 2 / DEPTH_STEP) * DEPTH_STEP;

      const geometry: BeamGeometry = {
        type: 'rectangular',
        b: width,
        D: midD,
        cover,
        L: req.L,
      };
      const loading: BeamLoading = {
        Mu,
        Vu,
        loadType: 'UDL',
        supportCondition: support,
      };
      const materials: BeamMaterials = {
        concreteGrade,
        steelGrade,
        code: code as DesignCode,
      };

      const engine = new RCBeamDesignEngine(geometry, loading, materials);
      const result = engine.design();
      const util = result.flexure.utilizationRatio;

      if (util <= 1.0 && result.flexure.status === 'safe') {
        // Section works — try smaller
        if (util >= targetUtil.min && util <= targetUtil.max) {
          // In the sweet spot!
          bestResult = result;
          bestB = width;
          bestD = midD;
          bestUtil = util;
          break; // No need to search more at this width
        }
        if (util < targetUtil.min) {
          // Over-designed — reduce depth
          hi = midD;
        } else {
          // Slightly over-utilised but still safe
          bestResult = result;
          bestB = width;
          bestD = midD;
          bestUtil = util;
          hi = midD;
        }
      } else {
        // Section fails — increase depth
        lo = midD + DEPTH_STEP;
      }

      // Track best feasible
      if (
        util <= 1.0 &&
        result.flexure.status === 'safe' &&
        (!bestResult || Math.abs(util - 0.9) < Math.abs(bestUtil - 0.9))
      ) {
        bestResult = result;
        bestB = width;
        bestD = midD;
        bestUtil = util;
      }
    }

    // If we found a good solution in the target band, stop trying other widths
    if (bestUtil >= targetUtil.min && bestUtil <= targetUtil.max) break;
  }

  // ── Fallback: if nothing worked, do a generous section ─────────────────
  if (!bestResult) {
    const bFallback = widths[widths.length - 1] ?? 300;
    const dFallback = req.maxDepth ?? 900;
    const geometry: BeamGeometry = {
      type: 'rectangular',
      b: bFallback,
      D: dFallback,
      cover,
      L: req.L,
    };
    const loading: BeamLoading = { Mu, Vu, loadType: 'UDL', supportCondition: support };
    const materials: BeamMaterials = { concreteGrade, steelGrade, code: code as DesignCode };
    const engine = new RCBeamDesignEngine(geometry, loading, materials);
    bestResult = engine.design();
    bestB = bFallback;
    bestD = dFallback;
    bestUtil = bestResult.flexure.utilizationRatio;
    iterations++;
  }

  // ── Build suggestions ──────────────────────────────────────────────────
  const suggestions: string[] = [];
  if (bestUtil < 0.7) {
    suggestions.push(
      `Section is under-utilised (${(bestUtil * 100).toFixed(0)}%). Consider reducing depth to ${bestD - 50}mm.`,
    );
  }
  if (bestUtil > 0.95) {
    suggestions.push(
      `Section is heavily loaded (${(bestUtil * 100).toFixed(0)}%). Consider ${bestD + 50}mm depth for safety margin.`,
    );
  }
  if (extraFoS > 1.0) {
    suggestions.push(`Extra FoS of ${extraFoS}× applied on top of code requirements.`);
  }
  if (interp) {
    suggestions.push(
      `Started from knowledge base estimate (confidence ${(interp.confidence * 100).toFixed(0)}%).`,
    );
  }
  suggestions.push(
    `Knowledge base: ${DesignKnowledgeBase.cacheSize} exact designs, ${DesignKnowledgeBase.totalBracketEntries} bracket entries.`,
  );

  // ── Store result in knowledge base ─────────────────────────────────────
  const cachedResult: CachedDesignResult = {
    key: inputKey,
    b: bestB,
    D: bestD,
    d: bestD - cover - 25,
    Ast: bestResult.flexure.Ast_required,
    Asc: bestResult.flexure.Asc_required,
    utilization: bestUtil,
    Mu_capacity: bestResult.flexure.Mu_capacity,
    Vu_capacity: bestResult.shear.Vn_capacity,
    tensionBars: bestResult.flexure.tensionBars,
    compressionBars: bestResult.flexure.compressionBars,
    status: bestResult.summary.overallStatus,
    computedAt: new Date().toISOString(),
    fullResult: bestResult,
  };
  await DesignKnowledgeBase.store(cachedResult);

  const elapsed = performance.now() - t0;

  return {
    source: interp && interp.confidence >= 0.7 ? 'interpolation' : 'computed',
    confidence: interp && interp.confidence >= 0.7 ? interp.confidence : 1.0,
    b: bestB,
    D: bestD,
    d: bestD - cover - 25,
    Ast: bestResult.flexure.Ast_required,
    Asc: bestResult.flexure.Asc_required,
    utilization: bestUtil,
    Mu_capacity: bestResult.flexure.Mu_capacity,
    Vu_capacity: bestResult.shear.Vn_capacity,
    tensionBars: bestResult.flexure.tensionBars,
    compressionBars: bestResult.flexure.compressionBars,
    status: bestResult.summary.overallStatus,
    fullResult: bestResult,
    iterations,
    timeMs: elapsed,
    suggestions,
    similarDesignCount: DesignKnowledgeBase.totalBracketEntries,
  };
}

/**
 * Quick estimation without running the full optimizer.
 * Returns an approximate section from the knowledge base if available,
 * or a rule-of-thumb estimate otherwise.
 */
export function quickEstimate(req: OptimizeRequest): {
  b: number;
  D: number;
  Ast: number;
  source: 'knowledge-base' | 'rule-of-thumb';
  confidence: number;
} {
  const code: DesignCodeKey = req.code ?? 'IS456';
  const support: SupportType = req.support ?? 'simply-supported';
  const extraFoS = req.extraFoS ?? 1.0;
  const loadFactor = req.loadFactor ?? 1.5;
  const w_factored = req.w_service * loadFactor * extraFoS;

  const concreteGrade = findConcreteGrade(req.concreteGrade ?? 'M25', code as DesignCode);
  const steelGrade = findSteelGrade(req.steelGrade ?? 'Fe500', code as DesignCode);

  const inputKey: DesignInputKey = {
    memberType: 'beam',
    code,
    support,
    L: req.L,
    w: w_factored,
    fck: concreteGrade.fck,
    fy: steelGrade.fy,
    extraFoS,
  };

  // Try exact
  const exact = DesignKnowledgeBase.getExact(inputKey);
  if (exact) {
    return { b: exact.b, D: exact.D, Ast: exact.Ast, source: 'knowledge-base', confidence: 1.0 };
  }

  // Try interpolation
  const interp = DesignKnowledgeBase.interpolate(inputKey);
  if (interp && interp.confidence >= 0.4) {
    return { b: interp.b, D: interp.D, Ast: interp.Ast, source: 'knowledge-base', confidence: interp.confidence };
  }

  // Rule of thumb: L/span-depth ratio
  const L_m = req.L / 1000;
  let spanDepthRatio: number;
  switch (support) {
    case 'cantilever': spanDepthRatio = 7; break;
    case 'simply-supported': spanDepthRatio = 16; break;
    case 'fixed-fixed': spanDepthRatio = 21; break;
    case 'continuous': spanDepthRatio = 20; break;
    default: spanDepthRatio = 16;
  }
  const D_est = Math.ceil((L_m * 1000 / spanDepthRatio) / 25) * 25;
  const b_est = Math.max(230, Math.ceil(D_est / 2.5 / 50) * 50);
  // Very rough Ast estimate: Mu / (0.87 * fy * 0.9 * d)
  const { Mu } = computeDesignForces(w_factored, L_m, support);
  const d_est = D_est - 50;
  const Ast_est = (Mu * 1e6) / (0.87 * steelGrade.fy * 0.9 * d_est);

  return { b: b_est, D: D_est, Ast: Math.round(Ast_est), source: 'rule-of-thumb', confidence: 0.3 };
}

export default { optimizeSection, quickEstimate };
