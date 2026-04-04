/**
 * ============================================================================
 * AUTO LOAD GENERATOR
 * ============================================================================
 * 
 * Generates all structural loads autonomously:
 * - Dead loads (self-weight + superimposed) per IS 875-1
 * - Live loads per IS 875-2 (22 occupancy categories)
 * - Wind loads per IS 875-3:2015 (full Vb→pz→F procedure)
 * - Seismic forces per IS 1893:2016 (full spectrum → base shear → story distribution)
 * - Load combinations per IS 800/IS 875/ASCE 7/Eurocode EN 1990
 * 
 * Produces actual NodeLoad[] and MemberLoad[] objects that can be
 * applied directly to the model store — not just informational text.
 * 
 * @version 1.0.0
 */

import { SectionLookup, type SteelSection, type SteelMaterial } from './SectionLookup';

// ============================================================================
// TYPES
// ============================================================================

export interface NodeLoad {
  id: string;
  nodeId: string;
  fx?: number; fy?: number; fz?: number;  // kN
  mx?: number; my?: number; mz?: number;  // kN·m
  loadCase: string;
  description?: string;
}

export interface MemberLoad {
  id: string;
  memberId: string;
  type: 'UDL' | 'UVL' | 'point' | 'moment';
  w1?: number; w2?: number;       // kN/m
  P?: number; M?: number;         // kN / kN·m
  a?: number;                     // fraction along member
  direction: 'local_y' | 'local_z' | 'global_x' | 'global_y' | 'global_z' | 'axial';
  loadCase: string;
  description?: string;
}

export interface LoadCase {
  id: string;
  name: string;
  type: 'dead' | 'live' | 'wind' | 'seismic' | 'temperature' | 'self-weight';
  nodeLoads: NodeLoad[];
  memberLoads: MemberLoad[];
}

export interface LoadCombination {
  id: string;
  name: string;
  code: string;
  type: 'ULS' | 'SLS';
  factors: Record<string, number>;  // loadCaseId → factor
}

export interface ProjectLoadConfig {
  occupancyType?: string;
  designCode?: 'IS' | 'ASCE' | 'EC';
  windZone?: number;         // basic wind speed Vb (m/s)
  terrainCategory?: 1 | 2 | 3 | 4;
  seismicZone?: 'II' | 'III' | 'IV' | 'V';
  soilType?: 'I' | 'II' | 'III';
  importanceFactor?: number;
  responseReductionR?: number;
  buildingHeight?: number;  // m
  tributaryWidth?: number;  // m (for beams)
  floorThickness?: number;  // mm (for slab dead load)
  floorFinish?: number;     // kN/m² (finishes & services)
}

// ============================================================================
// CONSTANTS — IS 875 / IS 1893
// ============================================================================

/** Live loads per IS 875 Part 2, Table 1 (kN/m²) */
const LIVE_LOADS: Record<string, number> = {
  'residential': 2.0,
  'office': 2.5,
  'office_heavy': 4.0,
  'classroom': 3.0,
  'assembly_fixed': 4.0,
  'assembly_no_fixed': 5.0,
  'hospital_ward': 2.0,
  'hospital_operating': 3.0,
  'retail': 4.0,
  'warehouse_light': 6.0,
  'warehouse_heavy': 10.0,
  'factory_light': 5.0,
  'factory_heavy': 10.0,
  'library_reading': 3.0,
  'library_stack': 10.0,
  'garages': 5.0,
  'stairs': 5.0,
  'balcony': 4.0,
  'roof_access': 1.5,
  'roof_no_access': 0.75,
  'flat_roof': 1.5,
  'sloped_roof': 0.75,
};

/** Seismic zone factors per IS 1893:2016, Table 3 */
const ZONE_FACTORS: Record<string, number> = {
  'II': 0.10, 'III': 0.16, 'IV': 0.24, 'V': 0.36,
};

/** Terrain roughness coefficients k2 per IS 875-3, Table 2 */
const TERRAIN_K2: Record<number, Record<number, number>> = {
  // height(m): category → k2
  10: { 1: 1.05, 2: 1.00, 3: 0.91, 4: 0.80 },
  15: { 1: 1.09, 2: 1.05, 3: 0.97, 4: 0.80 },
  20: { 1: 1.12, 2: 1.07, 3: 1.01, 4: 0.80 },
  30: { 1: 1.15, 2: 1.12, 3: 1.06, 4: 0.97 },
  50: { 1: 1.20, 2: 1.17, 3: 1.12, 4: 1.10 },
};

// ============================================================================
// AUTO LOAD GENERATOR
// ============================================================================

export class AutoLoadGenerator {
  private config: ProjectLoadConfig;
  private idCounter = 0;

  constructor(config: ProjectLoadConfig = {}) {
    this.config = {
      occupancyType: 'residential',
      designCode: 'IS',
      windZone: 39,            // m/s (default: Zone II, Vb=39)
      terrainCategory: 2,
      seismicZone: 'III',
      soilType: 'II',
      importanceFactor: 1.0,
      responseReductionR: 5.0,
      buildingHeight: 10,
      tributaryWidth: 5,
      floorThickness: 150,     // mm
      floorFinish: 1.5,        // kN/m²
      ...config,
    };
  }

  private nextId(prefix: string): string {
    return `${prefix}_${++this.idCounter}`;
  }

  // ============================================================================
  // DEAD LOADS (IS 875 Part 1)
  // ============================================================================

  /**
   * Generate dead loads for all members
   */
  generateDeadLoads(
    members: Array<{ id: string; sectionName?: string; type?: 'beam' | 'column' | 'brace' }>,
  ): LoadCase {
    const memberLoads: MemberLoad[] = [];
    const tributaryWidth = this.config.tributaryWidth || 5;
    const floorDL = this.computeFloorDeadLoad();

    for (const member of members) {
      const memberType = member.type || 'beam';

      // Self-weight
      const section = member.sectionName ? SectionLookup.getSection(member.sectionName) : null;
      const selfWeight = section ? section.weight * 9.81 / 1000 : 0.5; // kN/m

      memberLoads.push({
        id: this.nextId('DL'),
        memberId: member.id,
        type: 'UDL',
        w1: -selfWeight,
        direction: 'global_y',
        loadCase: 'DL',
        description: `Self-weight: ${selfWeight.toFixed(2)} kN/m`,
      });

      // Superimposed dead load on beams (floor slab + finishes)
      if (memberType === 'beam') {
        const superimposedDL = floorDL * tributaryWidth; // kN/m
        if (superimposedDL > 0) {
          memberLoads.push({
            id: this.nextId('DL'),
            memberId: member.id,
            type: 'UDL',
            w1: -superimposedDL,
            direction: 'global_y',
            loadCase: 'DL',
            description: `Floor DL: ${superimposedDL.toFixed(2)} kN/m (${floorDL.toFixed(2)} kN/m² × ${tributaryWidth}m trib.)`,
          });
        }
      }
    }

    return {
      id: 'DL',
      name: 'Dead Load',
      type: 'dead',
      nodeLoads: [],
      memberLoads,
    };
  }

  /**
   * Compute floor dead load intensity (kN/m²)
   */
  private computeFloorDeadLoad(): number {
    const slabThickM = (this.config.floorThickness || 150) / 1000;
    const concreteWeight = 25; // kN/m³
    const slabWeight = slabThickM * concreteWeight; // kN/m²
    const finishes = this.config.floorFinish || 1.5; // kN/m²
    return slabWeight + finishes; // typically 3.75 + 1.5 = 5.25 kN/m²
  }

  // ============================================================================
  // LIVE LOADS (IS 875 Part 2)
  // ============================================================================

  /**
   * Generate live loads on beams
   */
  generateLiveLoads(
    members: Array<{ id: string; type?: 'beam' | 'column' | 'brace' }>,
  ): LoadCase {
    const occupancy = this.config.occupancyType || 'residential';
    const liveLoadIntensity = LIVE_LOADS[occupancy] || 2.0; // kN/m²
    const tributaryWidth = this.config.tributaryWidth || 5;
    const llPerMeter = liveLoadIntensity * tributaryWidth;

    const memberLoads: MemberLoad[] = [];

    for (const member of members) {
      if ((member.type || 'beam') === 'beam') {
        memberLoads.push({
          id: this.nextId('LL'),
          memberId: member.id,
          type: 'UDL',
          w1: -llPerMeter, // downward
          direction: 'global_y',
          loadCase: 'LL',
          description: `Live load: ${llPerMeter.toFixed(2)} kN/m (${liveLoadIntensity} kN/m² × ${tributaryWidth}m trib., ${occupancy})`,
        });
      }
    }

    return {
      id: 'LL',
      name: `Live Load (${occupancy})`,
      type: 'live',
      nodeLoads: [],
      memberLoads,
    };
  }

  // ============================================================================
  // WIND LOADS (IS 875 Part 3:2015)
  // ============================================================================

  /**
   * Generate wind loads on the structure
   */
  generateWindLoads(
    nodes: Array<{ id: string; x: number; y: number; z: number }>,
    members: Array<{ id: string; startNodeId: string; endNodeId: string; type?: string }>,
  ): LoadCase {
    const Vb = this.config.windZone || 39;  // m/s
    const k1 = 1.0;  // Risk coefficient (IS 875-3, Cl. 6.3.1)
    const k2 = this.getK2();
    const k3 = 1.0;  // Topography factor

    const Vz = Vb * k1 * k2 * k3; // Design wind speed
    const pz = 0.6 * Vz * Vz / 1000; // kN/m² (wind pressure)

    // Apply to the windward face nodes with Cp = +0.8, leeward Cp = -0.5
    const maxX = Math.max(...nodes.map(n => n.x));
    const minX = Math.min(...nodes.map(n => n.x));
    const midX = (maxX + minX) / 2;

    const nodeLoads: NodeLoad[] = [];
    const memberLoads: MemberLoad[] = [];

    // Identify columns (vertical members)
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const columns = members.filter(m => {
      const sn = nodeMap.get(m.startNodeId);
      const en = nodeMap.get(m.endNodeId);
      if (!sn || !en) return false;
      const dx = Math.abs(en.x - sn.x);
      const dy = Math.abs(en.y - sn.y);
      return dy > dx * 2; // Predominantly vertical
    });

    // Apply lateral wind as UDL on columns
    const tributaryWidth = this.config.tributaryWidth || 5;
    for (const col of columns) {
      const sn = nodeMap.get(col.startNodeId)!;
      const en = nodeMap.get(col.endNodeId)!;
      const colX = (sn.x + en.x) / 2;
      const Cp = colX <= midX ? 0.8 : -0.5; // windward / leeward
      const windForce = pz * Cp * tributaryWidth; // kN/m

      memberLoads.push({
        id: this.nextId('WL'),
        memberId: col.id,
        type: 'UDL',
        w1: windForce,
        direction: 'global_x',
        loadCase: 'WL',
        description: `Wind: ${windForce.toFixed(2)} kN/m (pz=${pz.toFixed(3)} kN/m², Cp=${Cp}, trib=${tributaryWidth}m)`,
      });
    }

    // Apply uplift on roof beams
    const maxY = Math.max(...nodes.map(n => n.y));
    const roofBeams = members.filter(m => {
      const sn = nodeMap.get(m.startNodeId);
      const en = nodeMap.get(m.endNodeId);
      if (!sn || !en) return false;
      return sn.y >= maxY * 0.8 && en.y >= maxY * 0.8 && Math.abs(en.y - sn.y) < Math.abs(en.x - sn.x);
    });

    for (const beam of roofBeams) {
      const CpRoof = -0.7; // suction on roof
      const windUplift = pz * CpRoof * tributaryWidth;

      memberLoads.push({
        id: this.nextId('WL'),
        memberId: beam.id,
        type: 'UDL',
        w1: windUplift,
        direction: 'global_y',
        loadCase: 'WL',
        description: `Wind uplift on roof: ${windUplift.toFixed(2)} kN/m`,
      });
    }

    return {
      id: 'WL',
      name: `Wind Load (Vb=${Vb} m/s)`,
      type: 'wind',
      nodeLoads,
      memberLoads,
    };
  }

  /**
   * Get terrain roughness factor k2
   */
  private getK2(): number {
    const h = this.config.buildingHeight || 10;
    const cat = this.config.terrainCategory || 2;

    // Interpolate from table
    const heights = [10, 15, 20, 30, 50];
    let lowerH = 10, upperH = 50;
    for (let i = 0; i < heights.length - 1; i++) {
      if (h >= heights[i] && h <= heights[i + 1]) {
        lowerH = heights[i];
        upperH = heights[i + 1];
        break;
      }
    }

    const k2Lower = TERRAIN_K2[lowerH]?.[cat] || 1.0;
    const k2Upper = TERRAIN_K2[upperH]?.[cat] || 1.0;

    if (lowerH === upperH) return k2Lower;
    const ratio = (h - lowerH) / (upperH - lowerH);
    return k2Lower + ratio * (k2Upper - k2Lower);
  }

  // ============================================================================
  // SEISMIC LOADS (IS 1893:2016)
  // ============================================================================

  /**
   * Generate seismic loads as story lateral forces
   */
  generateSeismicLoads(
    nodes: Array<{ id: string; x: number; y: number; z: number }>,
    members: Array<{ id: string; startNodeId: string; endNodeId: string; sectionName?: string }>,
    totalWeight?: number, // kN (if known)
  ): LoadCase {
    const Z = ZONE_FACTORS[this.config.seismicZone || 'III'];
    const I = this.config.importanceFactor || 1.0;
    const R = this.config.responseReductionR || 5.0;

    // Calculate Sa/g from approximate time period
    const h = this.config.buildingHeight || 10;
    const T = 0.085 * Math.pow(h, 0.75); // Steel MRF (IS 1893, Cl 7.6.2)

    // Sa/g for medium soil (Type II)
    let SaG: number;
    if (T <= 0.10) SaG = 1 + 15 * T;
    else if (T <= 0.55) SaG = 2.5;
    else if (T <= 4.0) SaG = 1.36 / T;
    else SaG = 0.34;

    const Ah = (Z * I * SaG) / (2 * R);
    const clampedAh = Math.max(Ah, Z * I * 0.5 / (2 * R)); // Minimum per Cl 7.2.2

    // Estimate total seismic weight if not provided
    const W = totalWeight || this.estimateSeismicWeight(nodes, members);
    const Vb = clampedAh * W; // Base shear (kN)

    // Distribute forces to story levels (IS 1893 Cl 7.7.1)
    // Qi = Vb × (Wi × hi²) / Σ(Wj × hj²)
    const storyLevels = this.identifyStoryLevels(nodes);
    const storyWeights = this.distributeWeightToStories(W, storyLevels);

    const denominator = storyLevels.reduce(
      (sum, level, i) => sum + storyWeights[i] * level.height * level.height, 0
    );

    const nodeLoads: NodeLoad[] = [];

    for (let i = 0; i < storyLevels.length; i++) {
      const level = storyLevels[i];
      if (level.height === 0) continue; // Skip base level

      const Qi = denominator > 0
        ? Vb * (storyWeights[i] * level.height * level.height) / denominator
        : 0;

      // Distribute to all nodes at this level
      const nodesAtLevel = level.nodeIds;
      const forcePerNode = nodesAtLevel.length > 0 ? Qi / nodesAtLevel.length : 0;

      for (const nodeId of nodesAtLevel) {
        if (forcePerNode > 0.01) {
          nodeLoads.push({
            id: this.nextId('EQ'),
            nodeId,
            fx: forcePerNode,
            loadCase: 'EQ',
            description: `Seismic story force at h=${level.height.toFixed(1)}m: ${forcePerNode.toFixed(2)} kN (Qi=${Qi.toFixed(2)} kN)`,
          });
        }
      }
    }

    return {
      id: 'EQ',
      name: `Seismic (Zone ${this.config.seismicZone}, T=${T.toFixed(3)}s, Ah=${clampedAh.toFixed(4)}, Vb=${Vb.toFixed(1)} kN)`,
      type: 'seismic',
      nodeLoads,
      memberLoads: [],
    };
  }

  /**
   * Identify story levels from node positions
   */
  private identifyStoryLevels(
    nodes: Array<{ id: string; x: number; y: number; z: number }>
  ): Array<{ height: number; nodeIds: string[] }> {
    const heightMap = new Map<number, string[]>();

    for (const node of nodes) {
      const roundedH = Math.round(node.y * 100) / 100;
      if (!heightMap.has(roundedH)) {
        heightMap.set(roundedH, []);
      }
      heightMap.get(roundedH)!.push(node.id);
    }

    return Array.from(heightMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([height, nodeIds]) => ({ height, nodeIds }));
  }

  /**
   * Distribute total weight to story levels (simplified)
   */
  private distributeWeightToStories(totalWeight: number, levels: Array<{ height: number; nodeIds: string[] }>): number[] {
    // Distribute weight equally to non-base levels
    const nonBase = levels.filter(l => l.height > 0);
    const perLevel = nonBase.length > 0 ? totalWeight / nonBase.length : totalWeight;
    return levels.map(l => l.height > 0 ? perLevel : 0);
  }

  /**
   * Estimate seismic weight from members
   */
  private estimateSeismicWeight(
    nodes: Array<{ id: string; x: number; y: number; z: number }>,
    members: Array<{ id: string; startNodeId: string; endNodeId: string; sectionName?: string }>,
  ): number {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    let steelWeight = 0;

    for (const m of members) {
      const sn = nodeMap.get(m.startNodeId);
      const en = nodeMap.get(m.endNodeId);
      if (!sn || !en) continue;

      const length = Math.sqrt(
        (en.x - sn.x) ** 2 + (en.y - sn.y) ** 2 + (en.z - sn.z) ** 2
      );

      const section = m.sectionName ? SectionLookup.getSection(m.sectionName) : null;
      const wPerM = section ? section.weight * 9.81 / 1000 : 0.5; // kN/m
      steelWeight += wPerM * length;
    }

    // Add floor dead + live load contribution (full DL + 25% LL for seismic weight per IS 1893)
    const floorArea = this.estimateFloorArea(nodes);
    const floorDL = this.computeFloorDeadLoad();
    const ll = LIVE_LOADS[this.config.occupancyType || 'residential'] || 2.0;

    return steelWeight + floorArea * (floorDL + 0.25 * ll);
  }

  /**
   * Estimate total floor area from node extent
   */
  private estimateFloorArea(nodes: Array<{ x: number; y: number; z: number }>): number {
    if (nodes.length < 2) return 0;
    const xs = nodes.map(n => n.x);
    const zs = nodes.map(n => n.z);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs) || (this.config.tributaryWidth || 5);
    const heights = [...new Set(nodes.map(n => Math.round(n.y * 100) / 100))].filter(h => h > 0);
    return width * depth * heights.length;
  }

  // ============================================================================
  // LOAD COMBINATIONS
  // ============================================================================

  /**
   * Generate all load combinations per design code
   */
  generateCombinations(loadCaseIds: string[]): LoadCombination[] {
    const code = this.config.designCode || 'IS';

    switch (code) {
      case 'IS': return this.isLoadCombinations(loadCaseIds);
      case 'ASCE': return this.asceLoadCombinations(loadCaseIds);
      case 'EC': return this.ecLoadCombinations(loadCaseIds);
      default: return this.isLoadCombinations(loadCaseIds);
    }
  }

  private isLoadCombinations(ids: string[]): LoadCombination[] {
    const has = (id: string) => ids.includes(id);
    const combos: LoadCombination[] = [];

    // IS 800:2007 / IS 875 Load Combinations
    if (has('DL') && has('LL'))
      combos.push({ id: 'ULS_1', name: '1.5(DL+LL)', code: 'IS 800', type: 'ULS', factors: { DL: 1.5, LL: 1.5 } });
    if (has('DL') && has('WL'))
      combos.push({ id: 'ULS_2', name: '1.5(DL+WL)', code: 'IS 800', type: 'ULS', factors: { DL: 1.5, WL: 1.5 } });
    if (has('DL') && has('LL') && has('WL'))
      combos.push({ id: 'ULS_3', name: '1.2(DL+LL+WL)', code: 'IS 800', type: 'ULS', factors: { DL: 1.2, LL: 1.2, WL: 1.2 } });
    if (has('DL') && has('WL'))
      combos.push({ id: 'ULS_4', name: '0.9DL+1.5WL', code: 'IS 800', type: 'ULS', factors: { DL: 0.9, WL: 1.5 } });
    if (has('DL') && has('EQ'))
      combos.push({ id: 'ULS_5', name: '1.5(DL+EQ)', code: 'IS 800', type: 'ULS', factors: { DL: 1.5, EQ: 1.5 } });
    if (has('DL') && has('LL') && has('EQ'))
      combos.push({ id: 'ULS_6', name: '1.2(DL+LL+EQ)', code: 'IS 800', type: 'ULS', factors: { DL: 1.2, LL: 1.2, EQ: 1.2 } });
    if (has('DL') && has('EQ'))
      combos.push({ id: 'ULS_7', name: '0.9DL+1.5EQ', code: 'IS 800', type: 'ULS', factors: { DL: 0.9, EQ: 1.5 } });
    // Serviceability
    if (has('DL') && has('LL'))
      combos.push({ id: 'SLS_1', name: '1.0(DL+LL)', code: 'IS 800', type: 'SLS', factors: { DL: 1.0, LL: 1.0 } });
    if (has('DL') && has('LL') && has('WL'))
      combos.push({ id: 'SLS_2', name: 'DL+0.8LL+0.8WL', code: 'IS 800', type: 'SLS', factors: { DL: 1.0, LL: 0.8, WL: 0.8 } });

    return combos;
  }

  private asceLoadCombinations(ids: string[]): LoadCombination[] {
    const has = (id: string) => ids.includes(id);
    const combos: LoadCombination[] = [];

    combos.push({ id: 'ASCE_1', name: '1.4D', code: 'ASCE 7-22', type: 'ULS', factors: { DL: 1.4 } });
    if (has('DL') && has('LL'))
      combos.push({ id: 'ASCE_2', name: '1.2D+1.6L', code: 'ASCE 7-22', type: 'ULS', factors: { DL: 1.2, LL: 1.6 } });
    if (has('DL') && has('LL') && has('WL'))
      combos.push({ id: 'ASCE_3', name: '1.2D+L+W', code: 'ASCE 7-22', type: 'ULS', factors: { DL: 1.2, LL: 1.0, WL: 1.0 } });
    if (has('DL') && has('WL'))
      combos.push({ id: 'ASCE_4', name: '0.9D+W', code: 'ASCE 7-22', type: 'ULS', factors: { DL: 0.9, WL: 1.0 } });
    if (has('DL') && has('EQ'))
      combos.push({ id: 'ASCE_5', name: '1.2D+E', code: 'ASCE 7-22', type: 'ULS', factors: { DL: 1.2, EQ: 1.0 } });
    if (has('DL') && has('EQ'))
      combos.push({ id: 'ASCE_6', name: '0.9D+E', code: 'ASCE 7-22', type: 'ULS', factors: { DL: 0.9, EQ: 1.0 } });
    if (has('DL') && has('LL'))
      combos.push({ id: 'ASCE_S1', name: 'D+L', code: 'ASCE 7-22', type: 'SLS', factors: { DL: 1.0, LL: 1.0 } });

    return combos;
  }

  private ecLoadCombinations(ids: string[]): LoadCombination[] {
    const has = (id: string) => ids.includes(id);
    const combos: LoadCombination[] = [];

    if (has('DL') && has('LL'))
      combos.push({ id: 'EC_1', name: '1.35G+1.5Q', code: 'EN 1990', type: 'ULS', factors: { DL: 1.35, LL: 1.5 } });
    if (has('DL') && has('LL') && has('WL'))
      combos.push({ id: 'EC_2', name: '1.35G+1.5Q+0.9W', code: 'EN 1990', type: 'ULS', factors: { DL: 1.35, LL: 1.5, WL: 0.9 } });
    if (has('DL') && has('WL'))
      combos.push({ id: 'EC_3', name: '1.35G+1.5W', code: 'EN 1990', type: 'ULS', factors: { DL: 1.35, WL: 1.5 } });
    if (has('DL') && has('WL'))
      combos.push({ id: 'EC_4', name: '1.0G+1.5W', code: 'EN 1990', type: 'ULS', factors: { DL: 1.0, WL: 1.5 } });
    if (has('DL') && has('EQ'))
      combos.push({ id: 'EC_5', name: 'G+E', code: 'EN 1990', type: 'ULS', factors: { DL: 1.0, EQ: 1.0 } });
    if (has('DL') && has('LL'))
      combos.push({ id: 'EC_S1', name: 'G+Q (SLS)', code: 'EN 1990', type: 'SLS', factors: { DL: 1.0, LL: 1.0 } });

    return combos;
  }

  // ============================================================================
  // ALL LOADS IN ONE CALL
  // ============================================================================

  /**
   * Generate ALL load cases and combinations for a structure
   */
  generateAllLoads(
    nodes: Array<{ id: string; x: number; y: number; z: number }>,
    members: Array<{
      id: string;
      startNodeId: string;
      endNodeId: string;
      sectionName?: string;
      type?: 'beam' | 'column' | 'brace';
    }>,
  ): {
    loadCases: LoadCase[];
    combinations: LoadCombination[];
    summary: string;
  } {
    // Classify members by type
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const classifiedMembers = members.map(m => {
      if (m.type) return m;
      const sn = nodeMap.get(m.startNodeId);
      const en = nodeMap.get(m.endNodeId);
      if (!sn || !en) return { ...m, type: 'beam' as const };

      const dx = Math.abs(en.x - sn.x);
      const dy = Math.abs(en.y - sn.y);
      const dz = Math.abs(en.z - sn.z);

      if (dy > dx * 2 && dy > dz * 2) return { ...m, type: 'column' as const };
      if (Math.abs(dx - dy) < Math.max(dx, dy) * 0.3 && dx > 0 && dy > 0) return { ...m, type: 'brace' as const };
      return { ...m, type: 'beam' as const };
    });

    // Generate individual load cases
    const loadCases: LoadCase[] = [];

    const dl = this.generateDeadLoads(classifiedMembers);
    loadCases.push(dl);

    const ll = this.generateLiveLoads(classifiedMembers);
    loadCases.push(ll);

    const wl = this.generateWindLoads(nodes, classifiedMembers);
    if (wl.memberLoads.length > 0 || wl.nodeLoads.length > 0) {
      loadCases.push(wl);
    }

    const eq = this.generateSeismicLoads(nodes, classifiedMembers);
    if (eq.nodeLoads.length > 0) {
      loadCases.push(eq);
    }

    // Generate combinations
    const caseIds = loadCases.map(lc => lc.id);
    const combinations = this.generateCombinations(caseIds);

    // Summary
    const totalMemberLoads = loadCases.reduce((s, c) => s + c.memberLoads.length, 0);
    const totalNodeLoads = loadCases.reduce((s, c) => s + c.nodeLoads.length, 0);

    return {
      loadCases,
      combinations,
      summary: `Generated ${loadCases.length} load cases (${totalMemberLoads} member loads, ${totalNodeLoads} node loads) with ${combinations.length} combinations per ${this.config.designCode} code.`,
    };
  }
}

export default AutoLoadGenerator;
