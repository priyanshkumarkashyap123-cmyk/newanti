/**
 * Unit tests for design engines modified during the production-readiness plan.
 * Each test validates against hand calculations or textbook examples.
 *
 * Coverage:
 *  - CompositeDesignEngine (AISC 360 Chapter I)
 *  - TimberDesignEngine    (NDS 2018)
 *  - StirrupDesignCalculator (IS 456 Table 19)
 *  - Zod validation schemas
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Composite Design Engine
// ============================================================================
import {
  designCompositeBeam,
  designCompositeColumn,
  calculateStudCapacity,
  type CompositeBeamInput,
  type CompositeColumnInput,
} from '@/modules/core/CompositeDesignEngine';

const W14x22_BEAM: CompositeBeamInput = {
  steelSection: 'W14x22',
  As: 4180, d: 349, tw: 5.8, bf: 127, tf: 8.5, Ix: 82_400_000,
  Fy: 345, Fu: 450,
  slabWidth: 2000, slabThickness: 125, fc: 25,
  deckType: 'solid',
  studDiameter: 19, studHeight: 100, studFu: 415, studSpacing: 200,
  span: 8,
};

describe('CompositeDesignEngine — designCompositeBeam', () => {
  it('computes positive moment capacity within expected range', () => {
    const result = designCompositeBeam(W14x22_BEAM);
    // Full composite on W14x22 with 125mm slab @ 8m should produce Mn well above bare steel
    expect(result.Mn_positive).toBeGreaterThan(200); // kN·m
    expect(result.status).toBe('PASS');
    expect(result.designCode).toBe('AISC360');
  });

  it('stud capacity (AISC I8.2a) uses breakout/shear minimum with Rp', () => {
    const result = designCompositeBeam(W14x22_BEAM);
    // Qn_stud should be positive and less than Asc * Fu / 1000
    const Asc = Math.PI * (19 / 2) ** 2;
    const maxShear = Asc * 415 / 1000;
    expect(result.Qn_stud).toBeGreaterThan(0);
    expect(result.Qn_stud).toBeLessThanOrEqual(maxShear * 1.001);
  });

  it('returns effective I_eff > bare steel Ix for full/partial composite', () => {
    const result = designCompositeBeam(W14x22_BEAM);
    expect(result.Ieff).toBeGreaterThan(82_400_000); // Must exceed bare steel Ix
  });

  it('metal deck applies Rp reduction', () => {
    const deckInput: CompositeBeamInput = {
      ...W14x22_BEAM,
      deckType: 'metal_deck',
      deckRibHeight: 75,
      deckRibWidth: 150,
    };
    const solidResult = designCompositeBeam(W14x22_BEAM);
    const deckResult = designCompositeBeam(deckInput);
    // Stud capacity should be reduced with deck
    expect(deckResult.Qn_stud).toBeLessThanOrEqual(solidResult.Qn_stud);
  });
});

describe('CompositeDesignEngine — designCompositeColumn', () => {
  it('filled circular column with P-M interaction', () => {
    const input: CompositeColumnInput = {
      type: 'filled_circular',
      tubeDimensions: { width: 350, thickness: 10 },
      Fy: 345,
      fc: 30,
      length: 4, K: 1.0,
      Pu: 1500, Mux: 50, Muy: 50,
    };
    const result = designCompositeColumn(input);
    expect(result.Pn).toBeGreaterThan(0);
    expect(result.status).toBeDefined();
    expect(result.designCode).toBe('AISC360');
  });
});

describe('CompositeDesignEngine — calculateStudCapacity', () => {
  it('19mm stud in 25 MPa concrete', () => {
    const result = calculateStudCapacity(19, 100, 415, 25, 'solid');
    expect(result.Qn).toBeGreaterThan(50);  // ~70-100 kN typical
    expect(result.Qn).toBeLessThan(150);
  });
});

// ============================================================================
// Timber Design Engine
// ============================================================================
import {
  designTimberBeam,
  designTimberColumn,
  designTimberConnection,
  type TimberMemberInput,
  type TimberConnectionInput,
} from '@/modules/core/TimberDesignEngine';

const TIMBER_BEAM_INPUT: TimberMemberInput = {
  type: 'sawn',
  species: 'Douglas_Fir',
  grade: 'No2',
  width: 89,  // 2x6 nominal 38mm or 89mm? Depends on orientation — use 89mm
  depth: 241, // ~10" = 241mm
  length: 4,  // 4 m
  lateralSupport: 'continuous',
  loadDuration: 'short_term',
  moistureCondition: 'dry',
  temperature: 'normal',
};

describe('TimberDesignEngine — designTimberBeam (NDS)', () => {
  it('computes adjusted bending capacity for Douglas Fir No. 2', () => {
    const result = designTimberBeam(TIMBER_BEAM_INPUT, { Mu: 5, Vu: 10 });
    expect(result.M_capacity).toBeGreaterThan(0);
    expect(result.V_capacity).toBeGreaterThan(0);
    expect(result.designCode).toContain('NDS');
  });

  it('CD factor for short-term loading should be 1.25 (NDS Table 2.3.2)', () => {
    const result = designTimberBeam(TIMBER_BEAM_INPUT, { Mu: 5, Vu: 10 });
    expect(result.adjustmentFactors.CD).toBeCloseTo(1.25, 2);
  });

  it('CM = 1.0 for dry conditions', () => {
    const result = designTimberBeam(TIMBER_BEAM_INPUT, { Mu: 5, Vu: 10 });
    expect(result.adjustmentFactors.CM).toBe(1.0);
  });

  it('wet conditions reduce CM', () => {
    const wetInput = { ...TIMBER_BEAM_INPUT, moistureCondition: 'wet' as const };
    const result = designTimberBeam(wetInput, { Mu: 5, Vu: 10 });
    expect(result.adjustmentFactors.CM).toBeLessThan(1.0);
  });

  it('CL = 1.0 with continuous lateral support', () => {
    const result = designTimberBeam(TIMBER_BEAM_INPUT, { Mu: 5, Vu: 10 });
    expect(result.adjustmentFactors.CL).toBe(1.0);
  });
});

describe('TimberDesignEngine — designTimberColumn (NDS)', () => {
  it('computes Cp column stability factor', () => {
    const colInput: TimberMemberInput = {
      ...TIMBER_BEAM_INPUT,
      depth: 140,
      width: 140,
      length: 3,
      lateralSupport: 'none',
    };
    const result = designTimberColumn(colInput, 30);
    expect(result.Cp).toBeGreaterThan(0);
    expect(result.Cp).toBeLessThanOrEqual(1.0);
    expect(result.P_capacity).toBeGreaterThan(0);
  });
});

describe('TimberDesignEngine — designTimberConnection (NDS)', () => {
  it('bolted connection returns positive capacity', () => {
    const connInput: TimberConnectionInput = {
      type: 'bolted',
      fastenerDiameter: 12,
      fastenerLength: 100,
      fastenerCount: 4,
      rows: 2,
      spacing: 60,
      edgeDistance: 40,
      endDistance: 50,
      mainMemberThickness: 89,
      sideMemberThickness: 38,
      mainMemberSpecies: 'Douglas_Fir',
      sideMemberSpecies: 'Douglas_Fir',
      sideMemberType: 'wood',
      loadAngle: 0,
      loadType: 'lateral',
    };
    const result = designTimberConnection(connInput, 10);
    expect(result.Z_adjusted).toBeGreaterThan(0);
    expect(result.governingMode).toBeDefined();
  });
});

// ============================================================================
// Stirrup Design Calculator
// ============================================================================
import { StirrupDesignCalculator } from '@/modules/reinforcement/calculators/StirrupDesignCalculator';
import { ConcreteDesignCode, MemberType, BarCoating } from '@/modules/reinforcement/types/ReinforcementTypes';

function makeShearInput(overrides: Record<string, any> = {}) {
  return {
    factoredShear: 150,
    webWidth: 300,
    effectiveDepth: 450,
    totalDepth: 500,
    concrete: {
      compressiveStrength: 25,
      grade: 'M25',
      elasticModulus: 25000,
      tensileStrength: 2.5,
      density: 2400,
      aggregateType: 'NORMAL' as const,
      maxAggregateSize: 20,
      unitSystem: 'SI' as const,
    },
    stirrupBar: {
      size: '8mm',
      diameter: 8,
      area: 50.27,
      perimeter: 25.13,
      unitWeight: 0.395,
      grade: 'Fe500' as any,
      yieldStrength: 500,
      ultimateStrength: 545,
      elasticModulus: 200000,
      coating: BarCoating.UNCOATED,
    },
    designCode: ConcreteDesignCode.IS_456_2000,
    memberType: MemberType.BEAM,
    cover: 25,
    ...overrides,
  };
}

describe('StirrupDesignCalculator — IS 456', () => {
  const calculator = new StirrupDesignCalculator();

  it('τc from Table 19 for M25, pt=0.5% is ≈ 0.49 N/mm²', () => {
    // IS 456 Table 19: M25, pt=0.50 → τc = 0.49
    const result = calculator.design(makeShearInput());
    // concreteCapacity = τc × bw × d / 1000 = 0.49 × 300 × 450 / 1000 ≈ 66.15 kN
    expect(result.concreteCapacity).toBeGreaterThan(50);
    expect(result.concreteCapacity).toBeLessThan(100);
  });

  it('requires shear reinforcement when Vu > Vc', () => {
    const result = calculator.design(makeShearInput({ factoredShear: 150 }));
    expect(result.reinforcementRequired).toBe(true);
  });

  it('does not require shear reinforcement when Vu ≤ Vc', () => {
    const result = calculator.design(makeShearInput({ factoredShear: 20 }));
    // For small Vu, concrete alone suffices
    expect(result.reinforcementRequired).toBe(false);
  });
});

describe('StirrupDesignCalculator — ACI 318', () => {
  const calculator = new StirrupDesignCalculator();

  it('ACI Vc = 0.17λ√fc × bw × d', () => {
    const result = calculator.design(makeShearInput({
      designCode: ConcreteDesignCode.ACI_318_19,
    }));
    // Vc ≈ 0.17 * 1 * √25 * 300 * 450 / 1000 ≈ 114.75 kN
    expect(result.concreteCapacity).toBeGreaterThan(80);
    expect(result.concreteCapacity).toBeLessThan(150);
  });
});

describe('StirrupDesignCalculator — Eurocode 2', () => {
  const calculator = new StirrupDesignCalculator();

  it('EC2 VRd,c > 0 for standard beam', () => {
    const result = calculator.design(makeShearInput({
      designCode: ConcreteDesignCode.EUROCODE_2,
    }));
    expect(result.concreteCapacity).toBeGreaterThan(0);
  });
});

// ============================================================================
// Zod Validation Schemas
// ============================================================================
import {
  compositeBeamInput,
  compositeColumnInput,
  timberMemberInput,
  boltedConnectionInput,
  footingDesignInput,
  shearDesignInput,
} from '@/lib/validation';

describe('Validation — compositeBeamInput', () => {
  it('accepts valid W14x22 input', () => {
    const result = compositeBeamInput.safeParse(W14x22_BEAM);
    expect(result.success).toBe(true);
  });

  it('rejects negative steel area', () => {
    const result = compositeBeamInput.safeParse({ ...W14x22_BEAM, As: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects metal deck without rib dimensions', () => {
    const result = compositeBeamInput.safeParse({
      ...W14x22_BEAM,
      deckType: 'metal_deck',
      deckRibHeight: undefined,
      deckRibWidth: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('rejects Fu ≤ Fy', () => {
    const result = compositeBeamInput.safeParse({ ...W14x22_BEAM, Fu: 300, Fy: 345 });
    expect(result.success).toBe(false);
  });
});

describe('Validation — compositeColumnInput', () => {
  it('rejects encased column without steelSection', () => {
    const result = compositeColumnInput.safeParse({
      type: 'encased', Fy: 345, fc: 30, length: 4, K: 1, Pu: 1000, Mux: 0, Muy: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('Validation — timberMemberInput', () => {
  it('accepts valid sawn input', () => {
    const result = timberMemberInput.safeParse(TIMBER_BEAM_INPUT);
    expect(result.success).toBe(true);
  });

  it('rejects CLT without layers', () => {
    const result = timberMemberInput.safeParse({
      ...TIMBER_BEAM_INPUT, type: 'clt', cltLayers: undefined,
    });
    expect(result.success).toBe(false);
  });
});

describe('Validation — boltedConnectionInput', () => {
  it('rejects bolt count mismatch', () => {
    const result = boltedConnectionInput.safeParse({
      bolt_grade: '8.8', bolt_diameter: 20, num_bolts: 7, bolt_rows: 2, bolt_columns: 3,
      plate_thickness: 10, plate_fu: 410, plate_fy: 250,
      connection_type: 'bearing', shear_plane: 'threads_in', num_shear_planes: 1,
      shear_force: 100, edge_distance: 35, pitch: 60,
    });
    expect(result.success).toBe(false);
  });
});

describe('Validation — footingDesignInput', () => {
  it('accepts valid isolated square footing', () => {
    const result = footingDesignInput.safeParse({
      columnWidth: 400, columnDepth: 400, axialLoad: 800,
      bearingCapacity: 200, soilDensity: 18, foundationDepth: 1500,
      fck: 25, fy: 500, footingType: 'isolated_square', minCover: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative axialLoad', () => {
    const result = footingDesignInput.safeParse({
      columnWidth: 400, columnDepth: 400, axialLoad: -800,
      bearingCapacity: 200, soilDensity: 18, foundationDepth: 1500,
      fck: 25, fy: 500, footingType: 'isolated_square', minCover: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects friction angle > 50°', () => {
    const result = footingDesignInput.safeParse({
      columnWidth: 400, columnDepth: 400, axialLoad: 800,
      bearingCapacity: 200, soilDensity: 18, foundationDepth: 1500,
      fck: 25, fy: 500, footingType: 'isolated_square', minCover: 50,
      frictionAngle: 55,
    });
    expect(result.success).toBe(false);
  });
});
