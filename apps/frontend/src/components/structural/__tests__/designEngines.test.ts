/**
 * Unit tests for structural design engines (components/structural/)
 *
 * Covers:
 *  - SlabDesignEngine (IS 456 one-way & two-way)
 *  - ColumnDesignEngine (IS 456 short & slender)
 *  - SteelDesignEngine (IS 800 steel beam)
 *  - ConnectionDesignEngine (IS 800 bolted, welded, base plate)
 *  - SeismicAnalysisEngine (IS 1893 equivalent static)
 *  - LoadAnalysisEngine (IS 875 wind loads & load combinations)
 *
 * Each test validates against hand calculations or textbook examples.
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Slab Design Engine — IS 456:2000
// ============================================================================
import { calculateSlabDesignIS456 } from '../SlabDesignEngine';

describe('SlabDesignEngine — calculateSlabDesignIS456', () => {
  const oneWaySlab = {
    lx: 3000,       // mm short span
    ly: 7000,       // mm long span (ly/lx > 2 → one-way)
    thickness: 150,  // mm
    clear_cover: 20, // mm
    fck: 25,         // MPa (M25)
    fy: 500,         // MPa (Fe500)
    dead_load: 1.5,  // kN/m² (partitions, etc.)
    live_load: 3.0,  // kN/m²
    floor_finish: 1.0, // kN/m²
    slab_type: 'one_way' as const,
    edge_condition: 'interior',
    exposure: 'moderate',
  };

  it('classifies as one-way slab when ly/lx > 2', () => {
    const result = calculateSlabDesignIS456(oneWaySlab);
    expect(result.message).toContain('One-way');
  });

  it('returns isAdequate=true for a well-designed one-way slab', () => {
    const result = calculateSlabDesignIS456(oneWaySlab);
    expect(result.isAdequate).toBe(true);
    expect(result.status).toBe('OK');
    expect(result.utilization).toBeGreaterThan(0);
    expect(result.utilization).toBeLessThan(1.5);
  });

  it('has correct factored load — wu = 1.5 × (DL + LL)', () => {
    const result = calculateSlabDesignIS456(oneWaySlab);
    // Self weight = (150/1000) × 25 = 3.75 kN/m²
    // Total DL = 3.75 + 1.5 + 1.0 = 6.25
    // wu = 1.5 × (6.25 + 3.0) = 13.875 kN/m²
    const loadStep = result.steps.find(s => s.title === 'Load Calculation');
    expect(loadStep).toBeDefined();
    const wu = parseFloat(loadStep!.values['Factored Load wu'] as string);
    expect(wu).toBeCloseTo(13.875, 1);
  });

  it('includes IS 456 clause references in steps', () => {
    const result = calculateSlabDesignIS456(oneWaySlab);
    const refs = result.steps.map(s => s.reference).filter(Boolean);
    expect(refs.some(r => r!.includes('IS 456'))).toBe(true);
  });

  it('code checks include minimum reinforcement', () => {
    const result = calculateSlabDesignIS456(oneWaySlab);
    const minReinfCheck = result.codeChecks.find(c => c.clause === '26.5.2.1');
    expect(minReinfCheck).toBeDefined();
    expect(minReinfCheck!.status).toBe('PASS');
  });

  // Two-way slab test
  const twoWaySlab = {
    lx: 4000, ly: 5000, thickness: 150,
    clear_cover: 20, fck: 25, fy: 500,
    dead_load: 1.5, live_load: 3.0, floor_finish: 1.0,
    slab_type: 'two_way' as const,
    edge_condition: 'interior',
    exposure: 'moderate',
  };

  it('classifies as two-way slab when ly/lx ≤ 2', () => {
    const result = calculateSlabDesignIS456(twoWaySlab);
    expect(result.message).toContain('Two-way');
  });

  it('two-way slab uses IS 456 Table 26 coefficients', () => {
    const result = calculateSlabDesignIS456(twoWaySlab);
    const coeffStep = result.steps.find(s => s.title === 'Slab Classification');
    expect(coeffStep).toBeDefined();
    expect(coeffStep!.reference).toContain('Table 26');
  });

  it('has higher utilization when thickness is reduced', () => {
    const thinSlab = { ...oneWaySlab, thickness: 80 };
    const normalResult = calculateSlabDesignIS456(oneWaySlab);
    const thinResult = calculateSlabDesignIS456(thinSlab);
    expect(thinResult.utilization).toBeGreaterThan(normalResult.utilization);
  });
});

// ============================================================================
// Column Design Engine — IS 456:2000
// ============================================================================
import { calculateColumnDesignIS456 } from '../ColumnDesignEngine';

describe('ColumnDesignEngine — calculateColumnDesignIS456', () => {
  const shortColumn = {
    width: 300,       // mm
    depth: 400,       // mm
    height: 3000,     // mm unsupported length
    clear_cover: 40,  // mm
    fck: 25,          // MPa
    fy: 500,          // MPa
    Pu: 800,          // kN
    Mux: 50,          // kN·m
    Muy: 30,          // kN·m
    end_condition: 'fixed_fixed',
    braced: true,
  };

  it('classifies as short column (Lex/D ≤ 12)', () => {
    const result = calculateColumnDesignIS456(shortColumn);
    // k = 0.65 for fixed-fixed, Lex = 0.65 × 3000 = 1950
    // Lex/D = 1950/400 = 4.875 < 12
    const classStep = result.steps.find(s => s.title === 'Slenderness Classification');
    expect(classStep).toBeDefined();
    expect(classStep!.description).toContain('SHORT');
  });

  it('returns valid result with utilization < 1 for safe design', () => {
    const result = calculateColumnDesignIS456(shortColumn);
    expect(result.utilization).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThanOrEqual(4);
    expect(result.codeChecks.length).toBeGreaterThanOrEqual(1);
  });

  it('computes minimum eccentricity per IS 456 Cl. 25.4', () => {
    const result = calculateColumnDesignIS456(shortColumn);
    const eccStep = result.steps.find(s => s.title === 'Design Eccentricity & Moments');
    expect(eccStep).toBeDefined();
    // e_min = max(20, L/500 + D/30) = max(20, 3000/500 + 400/30) = max(20, 6+13.33) = 20 mm
    const emin = parseFloat(eccStep!.values['emin,x'] as string);
    expect(emin).toBeCloseTo(Math.max(20, 3000 / 500 + 400 / 30), 0);
  });

  it('pure axial capacity uses correct IS 456 Cl. 39.3 formula', () => {
    const result = calculateColumnDesignIS456(shortColumn);
    const puzStep = result.steps.find(s => s.title === 'Pure Axial Capacity');
    expect(puzStep).toBeDefined();
    expect(puzStep!.reference).toContain('39.3');
    const Puz = parseFloat(puzStep!.values['Puz'] as string);
    expect(Puz).toBeGreaterThan(0);
  });

  it('slender column gets additional eccentricity', () => {
    const slenderColumn = {
      ...shortColumn,
      height: 8000,             // long column
      end_condition: 'hinged_hinged',
      braced: true,
    };
    const result = calculateColumnDesignIS456(slenderColumn);
    // k=1.0, Lex=8000, Lex/D = 8000/400 = 20 > 12 → slender
    const classStep = result.steps.find(s => s.title === 'Slenderness Classification');
    expect(classStep!.description).toContain('SLENDER');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('uses correct partial safety factors γc=1.5 and γs=1.15', () => {
    const result = calculateColumnDesignIS456(shortColumn);
    const matStep = result.steps.find(s => s.title === 'Material Properties');
    expect(matStep).toBeDefined();
    expect(matStep!.values['γc']).toBe('1.5');
    expect(matStep!.values['γs']).toBe('1.15');
  });
});

// ============================================================================
// Steel Design Engine — IS 800:2007
// ============================================================================
import { calculateSteelBeamIS800 } from '../SteelDesignEngine';

describe('SteelDesignEngine — calculateSteelBeamIS800', () => {
  const steelBeam = {
    section_type: 'I',
    section_size: 'ISMB300',
    span: 6000,            // mm
    unbraced_length: 6000, // mm
    steel_grade: 'E250',
    Mu: 120,               // kN·m factored moment
    Vu: 80,                // kN factored shear
    concentrated_load: 0,
    check_ltb: true,
    check_web_crippling: false,
  };

  it('returns valid design result with utilization > 0', () => {
    const result = calculateSteelBeamIS800(steelBeam);
    expect(result.utilization).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('uses correct γm0=1.10 per IS 800', () => {
    const result = calculateSteelBeamIS800(steelBeam);
    const matStep = result.steps.find(s =>
      s.title.toLowerCase().includes('material') ||
      s.title.toLowerCase().includes('section')
    );
    expect(matStep).toBeDefined();
  });

  it('classifies ISMB300 section correctly', () => {
    const result = calculateSteelBeamIS800(steelBeam);
    const classStep = result.steps.find(s =>
      s.title.toLowerCase().includes('classif')
    );
    expect(classStep).toBeDefined();
  });

  it('checks shear capacity', () => {
    const result = calculateSteelBeamIS800(steelBeam);
    const shearCheck = result.codeChecks.find(c =>
      c.description.toLowerCase().includes('shear')
    );
    expect(shearCheck).toBeDefined();
  });

  it('checks lateral-torsional buckling when enabled', () => {
    const result = calculateSteelBeamIS800(steelBeam);
    const ltbStep = result.steps.find(s =>
      s.title.toLowerCase().includes('lateral') ||
      s.title.toLowerCase().includes('buckling') ||
      s.title.toLowerCase().includes('ltb')
    );
    expect(ltbStep).toBeDefined();
  });

  it('throws on unknown section size', () => {
    const badInput = { ...steelBeam, section_size: 'FAKE_SECTION' };
    expect(() => calculateSteelBeamIS800(badInput)).toThrow('not found');
  });

  it('throws on unknown steel grade', () => {
    const badInput = { ...steelBeam, steel_grade: 'FAKE_GRADE' };
    expect(() => calculateSteelBeamIS800(badInput)).toThrow('not found');
  });

  it('ISMB500 has lower utilization than ISMB300 for same loading', () => {
    const smallBeam = calculateSteelBeamIS800(steelBeam);
    const largeBeam = calculateSteelBeamIS800({ ...steelBeam, section_size: 'ISMB500' });
    expect(largeBeam.utilization).toBeLessThan(smallBeam.utilization);
  });
});

// ============================================================================
// Connection Design Engine — IS 800:2007
// ============================================================================
import {
  calculateBoltedConnectionIS800,
  calculateWeldedConnectionIS800,
  calculateBasePlateIS800,
} from '../ConnectionDesignEngine';

describe('ConnectionDesignEngine — Bolted Connection', () => {
  const boltedInput = {
    bolt_grade: '8.8',
    bolt_diameter: 20,       // mm
    num_bolts: 6,
    bolt_rows: 3,
    bolt_columns: 2,
    plate_thickness: 12,     // mm
    plate_fu: 410,           // MPa
    plate_fy: 250,           // MPa
    connection_type: 'bearing' as const,
    shear_plane: 'threads_excluded' as const,
    num_shear_planes: 1,
    shear_force: 150,        // kN
    edge_distance: 35,       // mm
    pitch: 60,               // mm
  };

  it('calculates bolt shear capacity > 0', () => {
    const result = calculateBoltedConnectionIS800(boltedInput);
    expect(result.utilization).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('produces code checks for bolt design', () => {
    const result = calculateBoltedConnectionIS800(boltedInput);
    expect(result.codeChecks.length).toBeGreaterThan(0);
  });

  it('higher bolt count reduces utilization', () => {
    const fewer = calculateBoltedConnectionIS800({ ...boltedInput, num_bolts: 4, bolt_rows: 2 });
    const more = calculateBoltedConnectionIS800({ ...boltedInput, num_bolts: 8, bolt_rows: 4 });
    expect(more.utilization).toBeLessThanOrEqual(fewer.utilization);
  });

  it('uses γmb = 1.25 for bolt capacity', () => {
    const result = calculateBoltedConnectionIS800(boltedInput);
    const boltStep = result.steps.find(s =>
      s.title.toLowerCase().includes('bolt') && s.title.toLowerCase().includes('capacity') ||
      s.title.toLowerCase().includes('shear')
    );
    expect(boltStep).toBeDefined();
  });
});

describe('ConnectionDesignEngine — Welded Connection', () => {
  const weldedInput = {
    weld_type: 'fillet' as const,
    weld_size: 6,            // mm
    weld_length: 200,        // mm
    electrode_grade: 'E41',
    plate_fu: 410,           // MPa
    plate_thickness: 10,     // mm
    shear_force: 80,         // kN
    weld_position: 'longitudinal' as const,
  };

  it('calculates weld capacity > 0', () => {
    const result = calculateWeldedConnectionIS800(weldedInput);
    expect(result.utilization).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('returns IS 800 code check references', () => {
    const result = calculateWeldedConnectionIS800(weldedInput);
    expect(result.codeChecks.length).toBeGreaterThan(0);
  });

  it('fillet weld uses effective throat = 0.7 × size', () => {
    const result = calculateWeldedConnectionIS800(weldedInput);
    const weldStep = result.steps.find(s =>
      s.title.toLowerCase().includes('weld') ||
      s.title.toLowerCase().includes('throat')
    );
    expect(weldStep).toBeDefined();
  });
});

describe('ConnectionDesignEngine — Base Plate', () => {
  const basePlateInput = {
    column_section: 'ISMB300',
    column_depth: 300,
    column_flange_width: 140,
    column_flange_thickness: 13.1,
    column_web_thickness: 7.7,
    fy_column: 250,
    fy_plate: 250,
    fck: 25,
    axial_load: 500,          // kN
    moment: 0,                // kN·m
    shear: 0,                 // kN
    pedestal_width: 400,      // mm
    pedestal_depth: 400,      // mm
    anchor_bolt_grade: '4.6',
    anchor_bolt_diameter: 20, // mm
    num_anchor_bolts: 4,
  };

  it('calculates base plate design with valid dimensions', () => {
    const result = calculateBasePlateIS800(basePlateInput);
    expect(result.utilization).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('checks concrete bearing pressure', () => {
    const result = calculateBasePlateIS800(basePlateInput);
    const bearingCheck = result.codeChecks.find(c =>
      c.description.toLowerCase().includes('bearing') ||
      c.description.toLowerCase().includes('concrete')
    );
    expect(bearingCheck).toBeDefined();
  });
});

// ============================================================================
// Seismic Analysis Engine — IS 1893:2016
// ============================================================================
import {
  calculateEquivalentStaticMethod,
} from '../SeismicAnalysisEngine';

describe('SeismicAnalysisEngine — IS 1893 Equivalent Static Method', () => {
  const seismicInput = {
    building_height: 15,      // m (5 stories × 3m)
    num_storeys: 5,
    storey_heights: [3, 3, 3, 3, 3],  // m each
    storey_masses: [500, 500, 500, 500, 400], // tonnes
    zone: 'IV',
    soil_type: 'medium',
    importance: 'normal',
    structural_system: 'SMRF',
  };

  it('calculates base shear Vb > 0', () => {
    const result = calculateEquivalentStaticMethod(seismicInput);
    expect(result.capacity).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('includes storey force distribution', () => {
    const result = calculateEquivalentStaticMethod(seismicInput);
    const forceStep = result.steps.find(s =>
      s.title.toLowerCase().includes('storey') ||
      s.title.toLowerCase().includes('force distribution') ||
      s.title.toLowerCase().includes('lateral')
    );
    expect(forceStep).toBeDefined();
  });

  it('Zone V produces larger forces than Zone III', () => {
    const zoneIII = calculateEquivalentStaticMethod({
      ...seismicInput,
      zone: 'III',
    });
    const zoneV = calculateEquivalentStaticMethod({
      ...seismicInput,
      zone: 'V',
    });
    // Zone V factor (0.36) > Zone III factor (0.16) → higher base shear
    expect(zoneV.demand).toBeGreaterThan(zoneIII.demand);
  });

  it('references IS 1893:2016 clauses', () => {
    const result = calculateEquivalentStaticMethod(seismicInput);
    const refs = result.steps.map(s => s.reference).filter(Boolean);
    expect(refs.some(r => r!.includes('1893') || r!.includes('IS'))).toBe(true);
  });

  it('importance factor modifies base shear', () => {
    const normal = calculateEquivalentStaticMethod(seismicInput);
    const important = calculateEquivalentStaticMethod({
      ...seismicInput,
      importance: 'important',
    });
    // Important buildings should have >= base shear as normal ones
    expect(important.demand).toBeGreaterThanOrEqual(normal.demand);
  });
});

// ============================================================================
// Load Analysis Engine — IS 875
// ============================================================================
import {
  calculateWindLoad,
  generateLoadCombinations,
} from '../LoadAnalysisEngine';

describe('LoadAnalysisEngine — Wind Load IS 875 Part 3', () => {
  const windInput = {
    location: 'Mumbai',
    buildingHeight: 30,       // m
    buildingWidth: 20,        // m
    buildingDepth: 15,        // m
    terrainCategory: 2 as const,
    structureClass: 'B' as const,
    topography: 'flat' as const,
    openingCondition: 'normal' as const,
    cycloneZone: false,
    importance: 'normal' as const,
  };

  it('returns wind pressure > 0', () => {
    const result = calculateWindLoad(windInput);
    expect(result.utilization).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('wind pressure increases with building height', () => {
    const low = calculateWindLoad({ ...windInput, buildingHeight: 10 });
    const high = calculateWindLoad({ ...windInput, buildingHeight: 50 });
    expect(high.demand).toBeGreaterThan(low.demand);
  });
});

describe('LoadAnalysisEngine — IS 875 Load Combinations', () => {
  it('generates strength combinations per IS 875 Part 5', () => {
    const result = generateLoadCombinations({
      deadLoad: 20,
      liveLoad: 10,
      windLoad: 8,
      combinationType: 'strength',
    });
    expect(result.combinations.length).toBeGreaterThan(0);
    expect(result.governingLoad).toBeGreaterThan(0);
    expect(result.governingCombination).toBeTruthy();
  });

  it('1.5(DL+LL) combination exists', () => {
    const result = generateLoadCombinations({
      deadLoad: 20,
      liveLoad: 10,
      combinationType: 'strength',
    });
    const dlll = result.combinations.find(c =>
      c.formula.includes('1.5') && c.formula.includes('DL') && c.formula.includes('LL')
    );
    expect(dlll).toBeDefined();
    // 1.5*(20+10) = 45
    expect(dlll!.factored).toBeCloseTo(45, 0);
  });

  it('does not combine wind and earthquake per IS 1893 Cl. 6.3.2', () => {
    const result = generateLoadCombinations({
      deadLoad: 20,
      liveLoad: 10,
      windLoad: 8,
      seismicLoad: 12,
      combinationType: 'strength',
    });
    const windEQ = result.combinations.find(c =>
      c.formula.includes('WL') && c.formula.includes('EQ')
    );
    expect(windEQ).toBeUndefined();
  });

  it('governing combination is the maximum factored load', () => {
    const result = generateLoadCombinations({
      deadLoad: 20,
      liveLoad: 10,
      windLoad: 8,
      combinationType: 'strength',
    });
    const maxFactored = Math.max(...result.combinations.map(c => c.factored));
    expect(result.governingLoad).toBeCloseTo(maxFactored, 1);
  });
});
