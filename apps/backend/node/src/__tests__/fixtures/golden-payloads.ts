/**
 * Golden fixture for load contract validation tests.
 * These are known-good payloads that must always pass Zod validation.
 */

/** Minimal valid analysis request with all load types */
export const GOLDEN_ANALYSIS_REQUEST = {
  schema_version: 2,
  nodes: [
    { id: 'N1', x: 0, y: 0, z: 0 },
    { id: 'N2', x: 6, y: 0, z: 0 },
    { id: 'N3', x: 12, y: 0, z: 0 },
  ],
  members: [
    { id: 'M1', startNodeId: 'N1', endNodeId: 'N2', E: 200e6, A: 0.01, I: 1e-4 },
    { id: 'M2', startNodeId: 'N2', endNodeId: 'N3', E: 200e6, A: 0.01, I: 1e-4 },
  ],
  loads: [
    { nodeId: 'N2', fy: -50 },
  ],
  memberLoads: [
    { id: 'ML1', memberId: 'M1', type: 'UDL', w1: -10, direction: 'global_y', startPos: 0, endPos: 1 },
    { id: 'ML2', memberId: 'M2', type: 'point', P: -25, a: 0.5, direction: 'global_y', startPos: 0, endPos: 1 },
  ],
  floorLoads: [
    { id: 'FL1', pressure: -5, yLevel: 3, xMin: 0, xMax: 12, zMin: -3, zMax: 3 },
  ],
  propertyAssignments: [
    {
      id: 'PROP1',
      name: 'ISMB 300',
      sectionType: 'I-BEAM',
      dimensions: { height: 300, width: 140, webThickness: 7.5, flangeThickness: 12.4 },
      mechanics: {
        area_m2: 0.00587,
        iyy_m4: 8.603e-5,
        izz_m4: 4.539e-6,
        j_m4: 3.622e-7,
      },
      material: {
        id: 'MAT_STEEL',
        family: 'steel',
        E_kN_m2: 200e6,
        nu: 0.3,
        fy_mpa: 250,
      },
      assignment: {
        mode: 'selected',
        memberIds: ['M1', 'M2'],
      },
      source: 'database',
    },
  ],
  memberGroups: [
    { id: 'GRP1', name: 'Main Beams', memberIds: ['M1', 'M2'], propertyAssignmentId: 'PROP1' },
  ],
  loadCases: [
    { id: 'LC_DL', name: 'Dead Load', type: 'dead', loads: [{ id: 'L1', nodeId: 'N2', fy: -30 }], memberLoads: [] },
    { id: 'LC_LL', name: 'Live Load', type: 'live', loads: [{ id: 'L2', nodeId: 'N2', fy: -20 }], memberLoads: [] },
    { id: 'LC_WL', name: 'Wind Load', type: 'wind', loads: [{ id: 'L3', nodeId: 'N3', fx: 15 }], memberLoads: [] },
  ],
  loadCombinations: [
    { id: 'COMB1', name: '1.5(DL+LL)', factors: [{ loadCaseId: 'LC_DL', factor: 1.5 }, { loadCaseId: 'LC_LL', factor: 1.5 }] },
    { id: 'COMB2', name: '1.5(DL+WL)', factors: [{ loadCaseId: 'LC_DL', factor: 1.5 }, { loadCaseId: 'LC_WL', factor: 1.5 }] },
  ],
  dofPerNode: 3,
  options: {
    method: 'spsolve' as const,
    includeSelfWeight: false,
    pDelta: false,
  },
};

/** Invalid: combination mixes wind + seismic (violates IS 1893 Cl. 6.3.2) */
export const INVALID_WIND_SEISMIC_COMBO = {
  schema_version: 2,
  nodes: [
    { id: 'N1', x: 0, y: 0, z: 0 },
    { id: 'N2', x: 6, y: 0, z: 0 },
  ],
  members: [
    { id: 'M1', startNodeId: 'N1', endNodeId: 'N2', E: 200e6, A: 0.01, I: 1e-4 },
  ],
  loads: [],
  loadCases: [
    { id: 'LC_DL', name: 'Dead Load', type: 'dead', loads: [], memberLoads: [] },
    { id: 'LC_WL', name: 'Wind Load', type: 'wind', loads: [], memberLoads: [] },
    { id: 'LC_EQ', name: 'Seismic',   type: 'seismic', loads: [], memberLoads: [] },
  ],
  loadCombinations: [
    {
      id: 'BAD_COMBO',
      name: '1.2(DL+WL+EQ)',
      factors: [
        { loadCaseId: 'LC_DL', factor: 1.2 },
        { loadCaseId: 'LC_WL', factor: 1.2 },
        { loadCaseId: 'LC_EQ', factor: 1.2 },
      ],
    },
  ],
};

/** Seismic profile for IS 1893 Zone IV */
export const GOLDEN_SEISMIC_PROFILE = {
  code: 'IS_1893' as const,
  zone: 'IV' as const,
  soilType: 'medium' as const,
  importanceFactor: 1.5,
  responseReduction: 5.0,
  buildingHeight_m: 30,
  buildingType: 'rc_frame' as const,
  storyWeights: [
    { storyId: 'S1', height_m: 3.5, weight_kN: 2500 },
    { storyId: 'S2', height_m: 7.0, weight_kN: 2500 },
    { storyId: 'S3', height_m: 10.5, weight_kN: 2500 },
    { storyId: 'S4', height_m: 14.0, weight_kN: 2500 },
    { storyId: 'S5', height_m: 17.5, weight_kN: 2500 },
    { storyId: 'S6', height_m: 21.0, weight_kN: 2500 },
    { storyId: 'S7', height_m: 24.5, weight_kN: 2500 },
    { storyId: 'S8', height_m: 28.0, weight_kN: 2000 },
  ],
};

/** Wind profile for IS 875 Part 3 */
export const GOLDEN_WIND_PROFILE = {
  code: 'IS_875_3' as const,
  basicWindSpeed_m_s: 47,
  terrainCategory: 2,
  buildingClass: 'B' as const,
  topography: 'flat' as const,
  riskCoefficient: 1.0,
  heightPressures: [
    { height_m: 0, pressure_kN_m2: 0.60 },
    { height_m: 10, pressure_kN_m2: 0.60 },
    { height_m: 15, pressure_kN_m2: 0.64 },
    { height_m: 20, pressure_kN_m2: 0.70 },
    { height_m: 30, pressure_kN_m2: 0.78 },
    { height_m: 50, pressure_kN_m2: 0.88 },
  ],
};
