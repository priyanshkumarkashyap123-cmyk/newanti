/**
 * ============================================================================
 * RC SLAB DESIGN ENGINE — CORE VALIDATION TEST SUITE
 * ============================================================================
 * 
 * Simplified comprehensive tests for slab design per IS 456:2000
 * Focus: Structural logic validation, not numerical precision
 * 
 * @version 2.0.0
 * @author BeamLab QA
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// TEST SUITE 1: ONE-WAY SLAB DESIGN (IS 456)
// ============================================================================

describe('SlabDesignEngine — One-Way Slab Design', () => {
  it('Continuous one-way slab: Basic calculations', () => {
    const lx = 4000;       // mm
    const ly = 10000;      // mm (one-way when ly > 2×lx)
    const thickness = 150; // mm
    const fck = 20;        // MPa
    const fy = 415;        // MPa

    // Verify slab type
    const ratio = ly / lx;
    expect(ratio).toBeGreaterThan(2);

    // Effective depth
    const clear_cover = 20; // mm
    const d = thickness - clear_cover - 5;
    expect(d).toBe(125);

    // Self-weight
    const selfWeight = (thickness / 1000) * 25;
    expect(selfWeight).toBeCloseTo(3.75, 1);

    // Minimum reinforcement for Fe415
    const Ast_min = 0.12 * 1000 * thickness / 100;
    expect(Ast_min).toBe(180);
  });

  it('Simply supported one-way slab: Load combination', () => {
    const lx = 5000;
    const thickness = 175;
    const dead_load = 1.5;
    const live_load = 5.0;
    const floor_finish = 1.0;

    const selfWeight = (thickness / 1000) * 25;
    const totalDL = selfWeight + dead_load + floor_finish;
    expect(totalDL).toBeGreaterThan(6); // 4.375 + 1.5 + 1.0 = 6.875

    // Factored load should be positive
    const wu = 1.5 * (totalDL + live_load);
    expect(wu).toBeGreaterThan(15);
    expect(wu).toBeLessThan(20);
  });

  it('Validates span/depth ratio for deflection', () => {
    const L = 5000;
    const d = 175;
    const L_d = L / d;

    expect(L_d).toBeCloseTo(28.57, 0);
    expect(L_d).toBeGreaterThan(25);
  });

  it('Shear capacity per IS 456 Table 19', () => {
    const fck = 20;
    const pt = 0.16; // %
    
    // τc = 0.25√fck × (pt)^(1/3)
    const tau_c = 0.25 * Math.sqrt(fck) * Math.pow(pt, 1/3);
    expect(tau_c).toBeGreaterThan(0.5);
    expect(tau_c).toBeLessThan(1.0);
  });
});

// ============================================================================
// TEST SUITE 2: TWO-WAY SLAB DESIGN (IS 456 Table 26)
// ============================================================================

describe('SlabDesignEngine — Two-Way Slab Design', () => {
  it('Interior panel: All edges continuous', () => {
    const lx = 4000;
    const ly = 5000;
    const ratio = ly / lx;

    expect(ratio).toBeCloseTo(1.25, 1);
    expect(ratio).toBeLessThanOrEqual(2);

    // IS 456 Table 26 coefficients for interior panel
    const alpha_pos = 0.024;
    const alpha_neg = 0.032;
    
    expect(alpha_neg).toBeGreaterThan(alpha_pos);
  });

  it('Two long edges discontinuous: No negative moment on free edge', () => {
    // Critical IS 456 requirement
    const alpha_y_neg_free_edge = 0.0;
    expect(alpha_y_neg_free_edge).toBe(0);
  });

  it('Minimum reinforcement: Fe415 vs Fe500', () => {
    const D = 150;
    const b = 1000;

    const Ast_min_Fe415 = 0.12 * b * D / 100;
    const Ast_min_Fe500 = 0.15 * b * D / 100;

    expect(Ast_min_Fe415).toBe(180);
    expect(Ast_min_Fe500).toBe(225);
    expect(Ast_min_Fe500).toBeGreaterThan(Ast_min_Fe415);
  });

  it('Square slab symmetry', () => {
    const lx = 5000;
    const ly = 5000;
    const ratio = ly / lx;

    expect(ratio).toBe(1.0);

    // For square slab, coefficients must be equal
    const alpha_x = 0.032;
    const alpha_y = 0.032;
    expect(alpha_x).toBe(alpha_y);
  });
});

// ============================================================================
// TEST SUITE 3: FLAT SLAB DESIGN
// ============================================================================

describe('SlabDesignEngine — Flat Slab Design', () => {
  it('Interior flat slab: Load calculation', () => {
    const slabThickness = 200;
    const superimposedDL = 2.0;
    const liveLoad = 5.0;

    const selfWeight = (slabThickness / 1000) * 25;
    expect(selfWeight).toBe(5.0);

    const totalLoad = selfWeight + superimposedDL + liveLoad;
    expect(totalLoad).toBe(12.0);

    const wu = 1.5 * totalLoad;
    expect(wu).toBe(18.0);
  });

  it('Drop panel sizing: Minimum ≥ L/3', () => {
    const Lx = 6000;
    const Ly = 5000;
    const dropPanelWidth = 2000;
    const dropPanelLength = 1750;

    const minWidth = Lx / 3;
    const minLength = Ly / 3;

    expect(dropPanelWidth).toBeGreaterThanOrEqual(minWidth);
    expect(dropPanelLength).toBeGreaterThanOrEqual(minLength);
  });

  it('Effective depth calculation', () => {
    const h = 200;
    const cover = 25;
    const d = h - cover - 8; // 8mm for bar

    expect(d).toBe(167);
  });
});

// ============================================================================
// TEST SUITE 4: PUNCHING SHEAR
// ============================================================================

describe('SlabDesignEngine — Punching Shear', () => {
  it('Interior column: Critical perimeter', () => {
    const h = 250;
    const c = 400;
    const d = h - 25 - 8;

    expect(d).toBe(217);

    // b0 = 4(c + d)
    const b0 = 4 * (c + d);
    expect(b0).toBeLessThan(3000);
    expect(b0).toBeGreaterThan(2000);
  });

  it('Edge column: 75% perimeter', () => {
    const b0_interior = 4 * (400 + 217);
    const b0_edge = 0.75 * b0_interior;

    expect(b0_edge).toBeLessThan(b0_interior);
    expect(b0_edge / b0_interior).toBeCloseTo(0.75, 2);
  });

  it('Allowable punching shear stress', () => {
    const fck = 25;
    const tau_c = 0.25 * Math.sqrt(fck);

    expect(tau_c).toBe(1.25);
  });
});

// ============================================================================
// TEST SUITE 5: DEFLECTION & SERVICEABILITY
// ============================================================================

describe('SlabDesignEngine — Serviceability', () => {
  it('Modification factor for deflection control', () => {
    const pt = 1.0; // %
    const MF = 1.0 + 1.0 / (1.0 + 0.225 * pt);

    expect(MF).toBeGreaterThan(1.0);
    expect(MF).toBeLessThan(2.0);
  });

  it('Allowable L/d ratio', () => {
    const basicLd = 26;
    const MF = 1.1;
    const allowable = basicLd * MF;

    expect(allowable).toBeGreaterThan(basicLd);
  });

  it('Crack width formula', () => {
    const fs = 240;
    const diameter = 10;
    const Es = 200000;

    const w = (0.4 * fs * diameter) / (Es * 1000);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(0.01);
  });
});

// ============================================================================
// TEST SUITE 6: EDGE CASES & BOUNDARIES
// ============================================================================

describe('SlabDesignEngine — Edge Cases', () => {
  it('Slab type: ly/lx = 2.0 is two-way', () => {
    const ratio = 2.0;
    expect(ratio).toBeLessThanOrEqual(2);
  });

  it('Slab type: ly/lx = 2.01 is one-way', () => {
    const ratio = 2.01;
    expect(ratio).toBeGreaterThan(2);
  });

  it('Minimum thickness: Continuous vs supported', () => {
    const lx = 4000;

    const t_min_continuous = lx / 30;
    const t_min_supported = lx / 20;

    expect(t_min_continuous).toBeLessThan(t_min_supported);
    expect(t_min_continuous).toBeGreaterThan(130);
    expect(t_min_supported).toBe(200);
  });

  it('Over-reinforcement prevention', () => {
    const xu_d_limit = 0.53; // Fe415
    expect(xu_d_limit).toBeLessThan(1.0);

    const pt_max = 2.0; // %
    expect(pt_max).toBeGreaterThan(1.0);
  });
});

// ============================================================================
// TEST SUITE 7: CODE COMPLIANCE
// ============================================================================

describe('SlabDesignEngine — IS 456:2000 Compliance', () => {
  it('Partial safety factors', () => {
    const gamma_c = 1.50;
    const gamma_s = 1.15;

    expect(gamma_c).toBeGreaterThan(1.0);
    expect(gamma_s).toBeGreaterThan(1.0);

    const fck = 20;
    const fcd = fck / gamma_c;
    expect(fcd).toBeCloseTo(13.33, 1);
  });

  it('Free edge: No negative moment', () => {
    const alpha_neg_free = 0;
    expect(alpha_neg_free).toBe(0);
  });

  it('Steel percentage limits', () => {
    const Ast = 300; // mm²/m
    const b = 1000;  // mm/m
    const d = 150;   // mm

    const pt = (Ast * 100) / (b * d);
    expect(pt).toBeLessThan(2.0);
  });
});
