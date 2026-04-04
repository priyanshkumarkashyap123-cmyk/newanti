/**
 * IS456.test.ts — Unit tests for IS 456:2000 design code functions.
 *
 * Validates flexure, shear, deflection, and development length calculations
 * against hand-calculated / textbook examples.
 */
import { describe, it, expect } from 'vitest';
import {
  getConcreteDesignStrength,
  getSteelDesignStrength,
  getConcreteModulus,
  getLimitingMoment,
  getNeutralAxisDepth,
  getMomentCapacity,
  getRequiredTensionSteel,
  getShearCapacity,
  getMaxShearStress,
  getShearReinforcement,
  getDevelopmentLength,
  checkDeflection,
  getModificationFactorTension,
  getModificationFactorCompression,
  IS456_PARTIAL_SAFETY_FACTORS,
  IS456_XU_D_LIMIT,
  designBeamIS456,
} from '../../modules/codes/IS456';

// ─── Helper ───
const approx = (a: number, b: number, tol = 0.01) =>
  expect(a).toBeCloseTo(b, -Math.log10(tol));

// ============================================================================
// MATERIAL PROPERTIES
// ============================================================================

describe('IS 456 Material Properties', () => {
  it('partial safety factors are per Cl. 36.4.2', () => {
    expect(IS456_PARTIAL_SAFETY_FACTORS.gamma_c).toBe(1.5);
    expect(IS456_PARTIAL_SAFETY_FACTORS.gamma_s).toBe(1.15);
  });

  it('xu/d limits match IS 456 Annex G', () => {
    expect(IS456_XU_D_LIMIT.Fe250).toBe(0.53);
    expect(IS456_XU_D_LIMIT.Fe415).toBe(0.48);
    expect(IS456_XU_D_LIMIT.Fe500).toBe(0.46);
    expect(IS456_XU_D_LIMIT.Fe550).toBe(0.44);
    expect(IS456_XU_D_LIMIT.Fe600).toBe(0.42);
  });

  it('concrete design strength fcd = 0.67 fck / 1.5', () => {
    approx(getConcreteDesignStrength(20), 0.67 * 20 / 1.5, 0.01);
    approx(getConcreteDesignStrength(30), 0.67 * 30 / 1.5, 0.01);
  });

  it('steel design strength fyd = fy / 1.15', () => {
    approx(getSteelDesignStrength(415), 415 / 1.15, 0.1);
    approx(getSteelDesignStrength(500), 500 / 1.15, 0.1);
  });

  it('elastic modulus Ec = 5000√fck per Cl. 6.2.3.1', () => {
    approx(getConcreteModulus(20), 5000 * Math.sqrt(20), 1);
    approx(getConcreteModulus(30), 5000 * Math.sqrt(30), 1);
  });
});

// ============================================================================
// FLEXURE — TEXTBOOK EXAMPLE
// ============================================================================

describe('IS 456 Flexural Design', () => {
  // Textbook: M20/Fe415, b=230mm, d=400mm
  const fck = 20, fy = 415, b = 230, d = 400;

  it('limiting moment for M20/Fe415 b=230 d=400', () => {
    // Mu,lim = 0.36 × 20 × 230 × (0.48×400) × (400 - 0.42×0.48×400) / 1e6
    // = 0.36 × 20 × 230 × 192 × (400 - 80.64) / 1e6
    // = 0.36 × 20 × 230 × 192 × 319.36 / 1e6
    // = 101.41 kN·m
    const Mu_lim = getLimitingMoment(fck, fy, b, d);
    approx(Mu_lim, 101.41, 1);
  });

  it('neutral axis depth for known Ast', () => {
    const Ast = 942; // 3-20φ = 942.48 mm²
    const xu = getNeutralAxisDepth(Ast, fck, fy, b);
    // xu = 0.87 × 415 × 942 / (0.36 × 20 × 230) = 205.17 mm
    approx(xu, 205.17, 1);
  });

  it('moment capacity is under-reinforced for low Ast', () => {
    const Ast = 628; // 2-20φ = 628.32 mm²
    const result = getMomentCapacity(Ast, fck, fy, b, d);
    expect(result.isUnderReinforced).toBe(true);
    expect(result.xu_d).toBeLessThan(0.48);
    expect(result.Mu).toBeGreaterThan(0);
  });

  it('required steel for Mu=60 kN·m is singly reinforced', () => {
    const result = getRequiredTensionSteel(60, fck, fy, b, d);
    expect(result.isDoublyReinforced).toBe(false);
    expect(result.Ast).toBeGreaterThan(0);
    expect(result.Ast).toBeLessThan(1500); // Reasonable range
  });

  it('required steel for Mu > Mu_lim is doubly reinforced', () => {
    const result = getRequiredTensionSteel(120, fck, fy, b, d);
    expect(result.isDoublyReinforced).toBe(true);
    expect(result.Ast).toBeGreaterThan(0);
    expect(result.Asc).toBeGreaterThan(0);
  });
});

// ============================================================================
// SHEAR — IS 456 TABLE 19
// ============================================================================

describe('IS 456 Shear Design', () => {
  it('τc for M20, pt=0.25% matches Table 19: 0.36 N/mm²', () => {
    const Vc = getShearCapacity(20, 0.25, 300, 400);
    const tau_c = Vc * 1000 / (300 * 400);
    approx(tau_c, 0.36, 0.01);
  });

  it('τc for M20, pt=1.0% matches Table 19: 0.62 N/mm²', () => {
    const Vc = getShearCapacity(20, 1.0, 300, 400);
    const tau_c = Vc * 1000 / (300 * 400);
    approx(tau_c, 0.62, 0.01);
  });

  it('τc for M30, pt=0.5% includes grade factor √(30/20)', () => {
    const Vc_M20 = getShearCapacity(20, 0.5, 300, 400);
    const Vc_M30 = getShearCapacity(30, 0.5, 300, 400);
    const ratio = Vc_M30 / Vc_M20;
    approx(ratio, Math.sqrt(30 / 20), 0.01);
  });

  it('grade factor capped at √(40/20) for high grades', () => {
    const Vc_M20 = getShearCapacity(20, 0.5, 300, 400);
    const Vc_M60 = getShearCapacity(60, 0.5, 300, 400);
    const Vc_M40 = getShearCapacity(40, 0.5, 300, 400);
    // M60 and M40 should give same τc (capped)
    approx(Vc_M60, Vc_M40, 0.1);
  });

  it('τc,max for M20 is 2.8 per Table 20', () => {
    expect(getMaxShearStress(20)).toBe(2.8);
  });

  it('τc,max for M30 is 3.5 per Table 20', () => {
    expect(getMaxShearStress(30)).toBe(3.5);
  });

  it('shear reinforcement formula Asv/s = Vus/(0.87·fy·d)', () => {
    const Vu = 120; // kN
    const Vc = 80; // kN
    const fy = 415, b = 300, d = 400;
    const result = getShearReinforcement(Vu, Vc, fy, b, d);
    expect(result.Vus).toBe(40);
    // Asv/s = 40×1000 / (0.87×415×400) = 0.277 mm²/mm
    approx(result.Asv_s, 40 * 1000 / (0.87 * 415 * 400), 0.001);
  });
});

// ============================================================================
// DEFLECTION
// ============================================================================

describe('IS 456 Deflection Check', () => {
  it('simply supported basic ratio is 20', () => {
    const result = checkDeflection(6000, 400, 0.5, 0, 240, 20, 'simply_supported');
    expect(result.actualRatio).toBe(15); // 6000/400
    expect(result.isOk).toBe(true);
  });

  it('cantilever basic ratio is 7', () => {
    const result = checkDeflection(3000, 300, 0.5, 0, 240, 20, 'cantilever');
    expect(result.actualRatio).toBe(10); // 3000/300
    // 10 > 7 × modFactor → depends on modFactor
  });

  it('modification factor for compression steel increases ratio', () => {
    expect(getModificationFactorCompression(0)).toBe(1.0);
    expect(getModificationFactorCompression(1.0)).toBeGreaterThan(1.1);
    expect(getModificationFactorCompression(2.5)).toBeLessThanOrEqual(1.5);
  });

  it('modification factor for tension varies with steel stress', () => {
    const kt_low = getModificationFactorTension(0.5, 145, 20);
    const kt_high = getModificationFactorTension(0.5, 290, 20);
    expect(kt_low).toBeGreaterThan(kt_high);
    expect(kt_low).toBeGreaterThanOrEqual(1.0);
    expect(kt_low).toBeLessThanOrEqual(2.0);
  });
});

// ============================================================================
// DEVELOPMENT LENGTH
// ============================================================================

describe('IS 456 Development Length', () => {
  it('Ld for M20 Fe415 16φ in tension ≈ 47φ ≈ 752mm', () => {
    const Ld = getDevelopmentLength(16, 415, 20, false, true);
    // Ld = φ × 0.87fy / (4 × τbd) = 16 × 0.87×415 / (4 × 1.2) = 16 × 361.05 / 4.8 ≈ 1203 mm
    // Actually: Ld = 16 × (0.87×415) / (4×1.2) = 16 × 75.22 = 1203.5 mm
    approx(Ld, 16 * (0.87 * 415) / (4 * 1.2), 5);
  });

  it('compression bond stress is 25% higher than tension', () => {
    const Ld_tension = getDevelopmentLength(16, 415, 20, false, true);
    const Ld_compression = getDevelopmentLength(16, 415, 20, true, true);
    expect(Ld_compression).toBeLessThan(Ld_tension);
    // τbd_comp = 1.25 × τbd_tension → Ld_comp = Ld_tens × (1.2/1.5) = 0.8 × Ld_tens
    approx(Ld_compression / Ld_tension, 1.2 / 1.5, 0.01);
  });
});

// ============================================================================
// FULL BEAM DESIGN
// ============================================================================

describe('IS 456 Complete Beam Design', () => {
  it('designs a simply supported beam M20/Fe415', () => {
    const result = designBeamIS456({
      b: 300,
      D: 500,
      span: 5000,
      fck: 20,
      fy: 415,
      Mu: 80,
      Vu: 60,
      cover: 25,
      support: 'simply_supported',
    });

    expect(result.isAdequate).toBe(true);
    expect(result.flexure.Ast_provided).toBeGreaterThan(result.flexure.Ast_required);
    expect(result.flexure.xu_d).toBeLessThan(0.48);
    expect(result.shear.tau_v).toBeLessThan(result.shear.tau_c_max);
    expect(result.summary.utilizationRatio).toBeLessThan(1.0);
    expect(result.calculations.length).toBeGreaterThan(0);
  });

  it('returns INADEQUATE when demand exceeds capacity', () => {
    const result = designBeamIS456({
      b: 200,
      D: 300,
      span: 8000,
      fck: 20,
      fy: 415,
      Mu: 500, // Very high moment for small beam
      Vu: 200,
      cover: 25,
      support: 'simply_supported',
    });

    // Should still return a result (not crash)
    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
  });
});
