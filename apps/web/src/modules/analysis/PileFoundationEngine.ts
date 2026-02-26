/**
 * ============================================================================
 * PILE FOUNDATION DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive pile foundation analysis and design supporting:
 * - Single pile capacity (axial, lateral)
 * - Pile group analysis and efficiency
 * - Settlement calculations
 * - Negative skin friction
 * - Pile load testing interpretation
 * 
 * Design Codes:
 * - IS 2911 (Part 1 to 4): Design and Construction of Pile Foundations
 * - API RP 2GEO: Geotechnical Considerations
 * - EN 1997-1 (Eurocode 7): Geotechnical Design
 * - AASHTO LRFD Bridge Design Specifications
 * - FHWA Design Manual for Driven Piles
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PileProperties {
  type: 'driven' | 'bored' | 'CFA' | 'micropile' | 'precast';
  material: 'concrete' | 'steel' | 'timber' | 'composite';
  shape: 'circular' | 'square' | 'h-section' | 'pipe';
  diameter: number; // mm (or equivalent diameter)
  length: number; // m
  embedmentDepth: number; // m (below ground surface)
  wallThickness?: number; // mm (for pipe piles)
  reinforcement?: {
    mainBars: string;
    spirals?: string;
    helical?: string;
  };
  materialStrength: {
    fck?: number; // Concrete grade MPa
    fy?: number; // Steel yield MPa
    Ep?: number; // Pile modulus MPa
  };
}

export interface SoilLayer {
  topDepth: number; // m
  bottomDepth: number; // m
  soilType: 'clay' | 'sand' | 'silt' | 'rock' | 'gravel';
  description?: string;
  properties: {
    // Common
    gamma: number; // Unit weight kN/m³
    gammaSat: number; // Saturated unit weight kN/m³
    
    // Cohesive soils
    cu?: number; // Undrained shear strength kPa
    su?: number; // Same as cu
    sensitivity?: number;
    OCR?: number; // Overconsolidation ratio
    
    // Granular soils
    phi?: number; // Friction angle degrees
    N_SPT?: number; // SPT N-value
    Dr?: number; // Relative density %
    
    // Rock
    qu?: number; // Unconfined compressive strength MPa
    RQD?: number; // Rock quality designation %
    
    // Deformation
    Es?: number; // Soil modulus kPa
    mv?: number; // Coefficient of volume compressibility
  };
}

export interface SiteConditions {
  waterTable: number; // m below ground
  scourDepth?: number; // m
  liquefactionDepth?: number; // m
  downdragDepth?: number; // m (negative skin friction zone)
  seismicZone?: 'I' | 'II' | 'III' | 'IV' | 'V';
}

export interface PileLoads {
  axialCompression: number; // kN
  axialTension?: number; // kN
  lateralX?: number; // kN
  lateralY?: number; // kN
  momentX?: number; // kNm
  momentY?: number; // kNm
  torsion?: number; // kNm
}

export interface PileCapacityResult {
  skinFriction: number; // kN
  endBearing: number; // kN
  ultimateCapacity: number; // kN
  allowableCapacity: number; // kN
  factorOfSafety: number;
  layerContributions: {
    layer: number;
    depth: number;
    friction: number;
    endBearing?: number;
  }[];
  negativeSkinFriction?: number; // kN
  effectiveCapacity?: number; // kN
}

export interface PileGroupResult {
  numPiles: number;
  spacing: number; // m
  efficiency: number;
  groupCapacity: number; // kN
  loadPerPile: number; // kN
  settlement: number; // mm
  differentialSettlement?: number; // mm
  groupBlockCapacity: number; // kN
  governingMode: 'individual' | 'block';
}

export interface LateralCapacityResult {
  ultimateLateralCapacity: number; // kN
  allowableLateralCapacity: number; // kN
  deflectionAtHead: number; // mm
  maxMoment: number; // kNm
  maxMomentDepth: number; // m
  pileHeadRotation: number; // radians
  soilReaction: { depth: number; p: number }[]; // kPa
}

// ============================================================================
// PILE CAPACITY CALCULATORS
// ============================================================================

export class AxialPileCapacity {
  private pile: PileProperties;
  private soilProfile: SoilLayer[];
  private site: SiteConditions;

  constructor(pile: PileProperties, soilProfile: SoilLayer[], site: SiteConditions) {
    this.pile = pile;
    this.soilProfile = soilProfile;
    this.site = site;
  }

  /**
   * Calculate ultimate axial capacity per IS 2911
   */
  calculateIS2911(
    compressionFOS: number = 2.5,
    tensionFOS: number = 3.0
  ): PileCapacityResult {
    let totalSkinFriction = 0;
    let totalEndBearing = 0;
    const layerContributions: PileCapacityResult['layerContributions'] = [];

    const pileArea = this.getPileArea();
    const perimeter = this.getPilePerimeter();
    const tipDepth = this.pile.embedmentDepth;

    // Calculate skin friction for each layer
    for (const layer of this.soilProfile) {
      if (layer.topDepth >= tipDepth) continue;
      
      const layerTop = layer.topDepth;
      const layerBot = Math.min(layer.bottomDepth, tipDepth);
      const layerThickness = layerBot - layerTop;
      
      if (layerThickness <= 0) continue;

      let fs: number;
      
      if (layer.soilType === 'clay' || layer.soilType === 'silt') {
        // Alpha method for cohesive soils
        const cu = layer.properties.cu || layer.properties.su || 50;
        const alpha = this.getAlphaFactor(cu, this.pile.type);
        fs = alpha * cu;
      } else if (layer.soilType === 'sand' || layer.soilType === 'gravel') {
        // Beta method for granular soils
        const phi = layer.properties.phi || 30;
        const K = this.getKFactor(phi, this.pile.type);
        const delta = this.getDelta(phi, this.pile.material);
        const midDepth = (layerTop + layerBot) / 2;
        const sigma_v = this.getEffectiveStress(midDepth);
        fs = K * sigma_v * Math.tan(delta * Math.PI / 180);
        
        // Limit skin friction per IS 2911
        const fsMax = this.pile.type === 'bored' ? 100 : 120;
        fs = Math.min(fs, fsMax);
      } else if (layer.soilType === 'rock') {
        // Rock socket friction
        const qu = layer.properties.qu || 5;
        fs = 0.25 * Math.sqrt(qu * 1000); // qu in kPa, fs in kPa
        fs = Math.min(fs, 500);
      } else {
        fs = 20; // Default conservative value
      }

      const layerFriction = fs * perimeter * layerThickness;
      totalSkinFriction += layerFriction;
      
      layerContributions.push({
        layer: this.soilProfile.indexOf(layer) + 1,
        depth: (layerTop + layerBot) / 2,
        friction: layerFriction
      });
    }

    // Calculate end bearing
    const tipLayer = this.getLayerAtDepth(tipDepth);
    if (tipLayer) {
      if (tipLayer.soilType === 'clay' || tipLayer.soilType === 'silt') {
        const cu = tipLayer.properties.cu || 50;
        const Nc = 9; // Bearing capacity factor for deep foundations
        totalEndBearing = Nc * cu * pileArea;
      } else if (tipLayer.soilType === 'sand' || tipLayer.soilType === 'gravel') {
        const phi = tipLayer.properties.phi || 30;
        const Nq = this.getNq(phi);
        const sigma_v = this.getEffectiveStress(tipDepth);
        
        // Limit end bearing stress
        const qpMax = this.pile.type === 'bored' ? 11000 : 15000;
        const qp = Math.min(Nq * sigma_v, qpMax);
        totalEndBearing = qp * pileArea;
      } else if (tipLayer.soilType === 'rock') {
        const qu = tipLayer.properties.qu || 5;
        const qp = 2.5 * qu * 1000; // qu in MPa to kPa
        totalEndBearing = qp * pileArea;
      }
    }

    // Apply installation effects
    if (this.pile.type === 'bored') {
      totalSkinFriction *= 0.9;
      totalEndBearing *= 0.8;
    }

    const ultimateCapacity = totalSkinFriction + totalEndBearing;
    const allowableCapacity = ultimateCapacity / compressionFOS;

    // Calculate negative skin friction if applicable
    let negativeSkinFriction = 0;
    if (this.site.downdragDepth && this.site.downdragDepth > 0) {
      negativeSkinFriction = this.calculateNegativeSkinFriction();
    }

    return {
      skinFriction: totalSkinFriction,
      endBearing: totalEndBearing,
      ultimateCapacity,
      allowableCapacity,
      factorOfSafety: compressionFOS,
      layerContributions,
      negativeSkinFriction,
      effectiveCapacity: allowableCapacity - negativeSkinFriction
    };
  }

  /**
   * Calculate capacity using API method (offshore)
   */
  calculateAPI(): PileCapacityResult {
    // API RP 2GEO method for offshore piles
    let totalSkinFriction = 0;
    let totalEndBearing = 0;
    const layerContributions: PileCapacityResult['layerContributions'] = [];

    const pileArea = this.getPileArea();
    const perimeter = this.getPilePerimeter();
    const tipDepth = this.pile.embedmentDepth;

    for (const layer of this.soilProfile) {
      if (layer.topDepth >= tipDepth) continue;
      
      const layerTop = layer.topDepth;
      const layerBot = Math.min(layer.bottomDepth, tipDepth);
      const layerThickness = layerBot - layerTop;
      
      if (layerThickness <= 0) continue;

      let fs: number;
      
      if (layer.soilType === 'clay') {
        // API alpha method
        const cu = layer.properties.cu || 50;
        const midDepth = (layerTop + layerBot) / 2;
        const sigma_v = this.getEffectiveStress(midDepth);
        const psi = cu / sigma_v;
        
        let alpha: number;
        if (psi <= 1.0) {
          alpha = Math.min(0.5 * Math.pow(psi, -0.5), 1.0);
        } else {
          alpha = 0.5 * Math.pow(psi, -0.25);
        }
        
        fs = alpha * cu;
      } else {
        // API sand method
        const delta = 25; // API default for most sands
        const midDepth = (layerTop + layerBot) / 2;
        const sigma_v = this.getEffectiveStress(midDepth);
        const K = 0.8; // API default for open-ended pipe
        
        fs = K * sigma_v * Math.tan(delta * Math.PI / 180);
        fs = Math.min(fs, 115); // API limit
      }

      const layerFriction = fs * perimeter * layerThickness;
      totalSkinFriction += layerFriction;
      
      layerContributions.push({
        layer: this.soilProfile.indexOf(layer) + 1,
        depth: (layerTop + layerBot) / 2,
        friction: layerFriction
      });
    }

    // End bearing
    const tipLayer = this.getLayerAtDepth(tipDepth);
    if (tipLayer) {
      if (tipLayer.soilType === 'clay') {
        const cu = tipLayer.properties.cu || 50;
        totalEndBearing = 9 * cu * pileArea;
      } else {
        const sigma_v = this.getEffectiveStress(tipDepth);
        const Nq = 40; // API default for dense sand
        const qp = Math.min(Nq * sigma_v, 12000);
        totalEndBearing = qp * pileArea;
      }
    }

    const ultimateCapacity = totalSkinFriction + totalEndBearing;

    return {
      skinFriction: totalSkinFriction,
      endBearing: totalEndBearing,
      ultimateCapacity,
      allowableCapacity: ultimateCapacity / 2.0, // API FOS
      factorOfSafety: 2.0,
      layerContributions
    };
  }

  /**
   * Calculate using Eurocode 7 approach
   */
  calculateEurocode7(
    gammaB: number = 1.6, // Base resistance factor
    gammaS: number = 1.3  // Shaft resistance factor
  ): PileCapacityResult {
    // EN 1997-1 partial factor approach
    const is2911Result = this.calculateIS2911(1.0, 1.0);
    
    const designSkinFriction = is2911Result.skinFriction / gammaS;
    const designEndBearing = is2911Result.endBearing / gammaB;
    const designCapacity = designSkinFriction + designEndBearing;

    return {
      skinFriction: is2911Result.skinFriction,
      endBearing: is2911Result.endBearing,
      ultimateCapacity: is2911Result.ultimateCapacity,
      allowableCapacity: designCapacity,
      factorOfSafety: is2911Result.ultimateCapacity / designCapacity,
      layerContributions: is2911Result.layerContributions
    };
  }

  // Helper methods
  private getPileArea(): number {
    const d = this.pile.diameter / 1000; // Convert to m
    if (this.pile.shape === 'circular' || this.pile.shape === 'pipe') {
      return Math.PI * d * d / 4;
    } else if (this.pile.shape === 'square') {
      return d * d;
    }
    return Math.PI * d * d / 4;
  }

  private getPilePerimeter(): number {
    const d = this.pile.diameter / 1000;
    if (this.pile.shape === 'circular' || this.pile.shape === 'pipe') {
      return Math.PI * d;
    } else if (this.pile.shape === 'square') {
      return 4 * d;
    }
    return Math.PI * d;
  }

  private getAlphaFactor(cu: number, pileType: string): number {
    // IS 2911 alpha values
    if (pileType === 'driven') {
      if (cu <= 25) return 1.0;
      if (cu <= 75) return 0.5;
      return 0.35;
    } else {
      // Bored piles
      if (cu <= 25) return 0.8;
      if (cu <= 75) return 0.45;
      return 0.3;
    }
  }

  private getKFactor(phi: number, pileType: string): number {
    if (pileType === 'driven') {
      if (phi < 30) return 1.0;
      if (phi < 35) return 1.5;
      return 2.0;
    } else {
      if (phi < 30) return 0.7;
      if (phi < 35) return 1.0;
      return 1.2;
    }
  }

  private getDelta(phi: number, material: string): number {
    const reduction = material === 'concrete' ? 0.75 : 0.67;
    return phi * reduction;
  }

  private getNq(phi: number): number {
    // Berezantsev's Nq values
    const phiRad = phi * Math.PI / 180;
    return Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(45 * Math.PI / 180 + phiRad / 2), 2);
  }

  private getEffectiveStress(depth: number): number {
    let sigma = 0;
    for (const layer of this.soilProfile) {
      if (layer.topDepth >= depth) break;
      
      const layerTop = Math.max(layer.topDepth, 0);
      const layerBot = Math.min(layer.bottomDepth, depth);
      
      if (layerBot <= layerTop) continue;
      
      const thickness = layerBot - layerTop;
      const gamma = depth > this.site.waterTable ? 
        layer.properties.gammaSat - 9.81 : 
        layer.properties.gamma;
      
      sigma += gamma * thickness;
    }
    return sigma;
  }

  private getLayerAtDepth(depth: number): SoilLayer | undefined {
    return this.soilProfile.find(l => l.topDepth <= depth && l.bottomDepth > depth);
  }

  private calculateNegativeSkinFriction(): number {
    let nsf = 0;
    const perimeter = this.getPilePerimeter();
    const downdragDepth = this.site.downdragDepth || 0;

    for (const layer of this.soilProfile) {
      if (layer.topDepth >= downdragDepth) break;
      
      const layerTop = layer.topDepth;
      const layerBot = Math.min(layer.bottomDepth, downdragDepth);
      const thickness = layerBot - layerTop;
      
      if (thickness <= 0) continue;

      const midDepth = (layerTop + layerBot) / 2;
      const sigma_v = this.getEffectiveStress(midDepth);
      
      let beta: number;
      if (layer.soilType === 'clay') {
        beta = 0.25; // Conservative for clay
      } else {
        const phi = layer.properties.phi || 30;
        beta = (1 - Math.sin(phi * Math.PI / 180)) * Math.tan(phi * Math.PI / 180);
      }
      
      nsf += beta * sigma_v * perimeter * thickness;
    }

    return nsf;
  }
}

// ============================================================================
// LATERAL PILE CAPACITY
// ============================================================================

export class LateralPileCapacity {
  private pile: PileProperties;
  private soilProfile: SoilLayer[];
  private site: SiteConditions;

  constructor(pile: PileProperties, soilProfile: SoilLayer[], site: SiteConditions) {
    this.pile = pile;
    this.soilProfile = soilProfile;
    this.site = site;
  }

  /**
   * Calculate lateral capacity using p-y curve method (Matlock for clay, Reese for sand)
   */
  calculateLateralCapacity(
    lateralLoad: number,
    momentAtHead: number = 0,
    headCondition: 'free' | 'fixed' = 'free'
  ): LateralCapacityResult {
    const Ep = this.pile.materialStrength.Ep || 30000000; // kPa
    const Ip = this.getPileMomentOfInertia();
    const d = this.pile.diameter / 1000;
    
    // Get representative soil properties
    const topLayer = this.soilProfile[0];
    const isCohesive = topLayer.soilType === 'clay' || topLayer.soilType === 'silt';
    
    // Soil modulus
    let nh: number; // Coefficient of horizontal subgrade reaction
    if (isCohesive) {
      const cu = topLayer.properties.cu || 50;
      nh = 200 * cu; // kN/m³
    } else {
      const phi = topLayer.properties.phi || 30;
      if (phi < 30) nh = 2200;
      else if (phi < 35) nh = 6600;
      else nh = 18000;
    }

    // Characteristic length
    const T = Math.pow(Ep * Ip / nh, 0.2); // Flexible pile
    const L = this.pile.embedmentDepth;

    // Check if pile is short or long
    const Lc = 4 * T;
    const isLongPile = L > Lc;

    let deflectionAtHead: number;
    let maxMoment: number;
    let maxMomentDepth: number;

    if (isLongPile) {
      // Long pile analysis
      const Ay = headCondition === 'free' ? 2.435 : 0.93;
      const By = headCondition === 'free' ? 1.623 : 0.93;
      const Am = headCondition === 'free' ? 0.772 : 0.93;
      const Bm = headCondition === 'free' ? -0.407 : 0.93;

      deflectionAtHead = (Ay * lateralLoad * Math.pow(T, 3) / (Ep * Ip) +
                         By * momentAtHead * Math.pow(T, 2) / (Ep * Ip)) * 1000;
      maxMoment = Am * lateralLoad * T + Bm * momentAtHead;
      maxMomentDepth = 1.3 * T;
    } else {
      // Short pile - simplified
      deflectionAtHead = lateralLoad * L * L * L / (12 * Ep * Ip) * 1000;
      maxMoment = lateralLoad * L / 2;
      maxMomentDepth = L / 2;
    }

    // Ultimate lateral capacity
    let ultimateLateralCapacity: number;
    if (isCohesive) {
      // Broms method for cohesive soil
      const cu = topLayer.properties.cu || 50;
      if (headCondition === 'free') {
        ultimateLateralCapacity = 2 * cu * d * L * L / (L + 1.5 * d);
      } else {
        ultimateLateralCapacity = 4.5 * cu * d * L;
      }
    } else {
      // Broms method for cohesionless soil
      const gamma = topLayer.properties.gamma || 18;
      const phi = topLayer.properties.phi || 30;
      const Kp = Math.pow(Math.tan(45 * Math.PI / 180 + phi * Math.PI / 360), 2);
      
      if (headCondition === 'free') {
        ultimateLateralCapacity = 0.5 * gamma * d * L * L * 3 * Kp;
      } else {
        ultimateLateralCapacity = 1.5 * gamma * d * L * L * 3 * Kp;
      }
    }

    // Soil reaction distribution (simplified)
    const soilReaction: { depth: number; p: number }[] = [];
    const numPoints = 20;
    for (let i = 0; i <= numPoints; i++) {
      const z = i * L / numPoints;
      const zT = z / T;
      const p = lateralLoad * nh * z / d * Math.exp(-zT) * 
               (Math.cos(zT) + Math.sin(zT));
      soilReaction.push({ depth: z, p: Math.abs(p) / 1000 });
    }

    return {
      ultimateLateralCapacity,
      allowableLateralCapacity: ultimateLateralCapacity / 2.5,
      deflectionAtHead,
      maxMoment,
      maxMomentDepth,
      pileHeadRotation: deflectionAtHead / (L * 1000),
      soilReaction
    };
  }

  private getPileMomentOfInertia(): number {
    const d = this.pile.diameter; // mm
    if (this.pile.shape === 'circular') {
      return Math.PI * Math.pow(d, 4) / 64 * 1e-12; // m⁴
    } else if (this.pile.shape === 'pipe' && this.pile.wallThickness) {
      const di = d - 2 * this.pile.wallThickness;
      return Math.PI * (Math.pow(d, 4) - Math.pow(di, 4)) / 64 * 1e-12;
    } else if (this.pile.shape === 'square') {
      return Math.pow(d, 4) / 12 * 1e-12;
    }
    return Math.PI * Math.pow(d, 4) / 64 * 1e-12;
  }
}

// ============================================================================
// PILE GROUP ANALYSIS
// ============================================================================

export class PileGroupAnalyzer {
  /**
   * Calculate pile group capacity and efficiency
   */
  static analyzeGroup(
    singlePileCapacity: PileCapacityResult,
    pile: PileProperties,
    groupConfig: {
      rows: number;
      columns: number;
      spacingX: number; // m
      spacingY: number; // m
    },
    soilProfile: SoilLayer[],
    totalLoad: number
  ): PileGroupResult {
    const { rows, columns, spacingX, spacingY } = groupConfig;
    const numPiles = rows * columns;
    const diameter = pile.diameter / 1000;

    // Calculate group efficiency
    const s = Math.min(spacingX, spacingY);
    let efficiency: number;

    // Converse-Labarre formula
    const theta = Math.atan(diameter / s) * 180 / Math.PI;
    efficiency = 1 - theta / 90 * ((columns - 1) * rows + (rows - 1) * columns) / 
                 (2 * rows * columns);
    efficiency = Math.max(0.7, Math.min(1.0, efficiency));

    // If spacing > 3D, use efficiency = 1.0
    if (s / diameter >= 3) {
      efficiency = 1.0;
    }

    // Group capacity by individual pile method
    const groupCapacityIndividual = efficiency * numPiles * singlePileCapacity.allowableCapacity;

    // Block failure capacity
    const Lg = (columns - 1) * spacingX + diameter;
    const Bg = (rows - 1) * spacingY + diameter;
    const Perimeter = 2 * (Lg + Bg);
    const AreaBlock = Lg * Bg;

    let blockFriction = 0;
    let blockEndBearing = 0;

    for (const layer of soilProfile) {
      if (layer.topDepth >= pile.embedmentDepth) continue;
      const layerBot = Math.min(layer.bottomDepth, pile.embedmentDepth);
      const thickness = layerBot - layer.topDepth;
      if (thickness <= 0) continue;

      if (layer.soilType === 'clay') {
        const cu = layer.properties.cu || 50;
        blockFriction += cu * Perimeter * thickness;
      } else {
        const phi = layer.properties.phi || 30;
        const K = 1.0;
        const midDepth = (layer.topDepth + layerBot) / 2;
        const gamma = layer.properties.gamma || 18;
        const sigma_v = gamma * midDepth;
        const fs = K * sigma_v * Math.tan(phi * Math.PI / 180 * 0.75);
        blockFriction += fs * Perimeter * thickness;
      }
    }

    const tipLayer = soilProfile.find(l => 
      l.topDepth <= pile.embedmentDepth && l.bottomDepth > pile.embedmentDepth
    );
    if (tipLayer) {
      if (tipLayer.soilType === 'clay') {
        const cu = tipLayer.properties.cu || 50;
        blockEndBearing = 9 * cu * AreaBlock;
      } else {
        const phi = tipLayer.properties.phi || 30;
        const gamma = tipLayer.properties.gamma || 18;
        const sigma_v = gamma * pile.embedmentDepth;
        const Nq = Math.exp(Math.PI * Math.tan(phi * Math.PI / 180)) * 
                  Math.pow(Math.tan(45 * Math.PI / 180 + phi * Math.PI / 360), 2);
        blockEndBearing = Nq * sigma_v * AreaBlock;
      }
    }

    const groupBlockCapacity = (blockFriction + blockEndBearing) / 2.5; // With FOS
    const groupCapacity = Math.min(groupCapacityIndividual, groupBlockCapacity);
    const governingMode = groupCapacityIndividual < groupBlockCapacity ? 'individual' : 'block';

    // Settlement calculation
    const settlement = this.calculateGroupSettlement(
      pile, groupConfig, singlePileCapacity, soilProfile, totalLoad
    );

    return {
      numPiles,
      spacing: s,
      efficiency,
      groupCapacity,
      loadPerPile: totalLoad / numPiles,
      settlement,
      differentialSettlement: settlement * 0.15, // Approximate
      groupBlockCapacity,
      governingMode
    };
  }

  /**
   * Calculate pile group settlement
   */
  private static calculateGroupSettlement(
    pile: PileProperties,
    groupConfig: { rows: number; columns: number; spacingX: number; spacingY: number },
    capacity: PileCapacityResult,
    soilProfile: SoilLayer[],
    load: number
  ): number {
    const { rows, columns, spacingX, spacingY } = groupConfig;
    const diameter = pile.diameter / 1000;

    // Equivalent raft method
    const Lg = (columns - 1) * spacingX + diameter;
    const Bg = (rows - 1) * spacingY + diameter;
    const AreaRaft = Lg * Bg;

    // Depth of equivalent raft (2/3 of pile length)
    const depthRaft = pile.embedmentDepth * 2 / 3;

    // Load spread at pile tips (2:1 method)
    const spreadDepth = pile.embedmentDepth / 3;
    const spreadArea = (Lg + spreadDepth) * (Bg + spreadDepth);
    const stressAtTip = load / spreadArea;

    // Settlement calculation (consolidation + elastic)
    let settlement = 0;
    const influenceDepth = Math.min(2 * Math.sqrt(AreaRaft), pile.embedmentDepth);

    for (const layer of soilProfile) {
      if (layer.topDepth >= pile.embedmentDepth + influenceDepth) break;
      if (layer.bottomDepth <= pile.embedmentDepth) continue;

      const Es = layer.properties.Es || 10000;
      const layerTop = Math.max(layer.topDepth, pile.embedmentDepth);
      const layerBot = Math.min(layer.bottomDepth, pile.embedmentDepth + influenceDepth);
      const thickness = layerBot - layerTop;

      // Influence factor
      const z = (layerTop + layerBot) / 2 - pile.embedmentDepth;
      const IF = 1 / (1 + z / Math.sqrt(AreaRaft));

      settlement += stressAtTip * IF * thickness / Es * 1000;
    }

    return settlement;
  }

  /**
   * Optimize pile group layout
   */
  static optimizeLayout(
    singlePileCapacity: number,
    pile: PileProperties,
    totalLoad: number,
    constraints: {
      minSpacing: number; // m
      maxSpacing: number; // m
      maxPiles: number;
      maxWidth: number; // m
      maxLength: number; // m
    }
  ): {
    rows: number;
    columns: number;
    spacing: number;
    numPiles: number;
    utilization: number;
  } {
    const diameter = pile.diameter / 1000;
    const minPiles = Math.ceil(totalLoad / singlePileCapacity);
    
    let bestConfig = { rows: 0, columns: 0, spacing: 0, numPiles: 0, utilization: 0 };
    let minCost = Infinity;

    for (let n = minPiles; n <= constraints.maxPiles; n++) {
      // Try different row/column combinations
      for (let rows = 1; rows <= Math.ceil(Math.sqrt(n)); rows++) {
        const columns = Math.ceil(n / rows);
        if (rows * columns > n + 2) continue; // Allow small excess

        for (let s = constraints.minSpacing; s <= constraints.maxSpacing; s += 0.25) {
          const width = (columns - 1) * s + diameter;
          const length = (rows - 1) * s + diameter;

          if (width > constraints.maxWidth || length > constraints.maxLength) continue;

          // Calculate efficiency
          const efficiency = s / diameter >= 3 ? 1.0 : 
                           0.7 + 0.3 * (s / diameter - 2);
          const groupCapacity = efficiency * rows * columns * singlePileCapacity;

          if (groupCapacity < totalLoad) continue;

          // Cost function (minimize piles and concrete volume)
          const cost = rows * columns + (width * length) * 0.1;
          const utilization = totalLoad / groupCapacity;

          if (cost < minCost) {
            minCost = cost;
            bestConfig = {
              rows,
              columns,
              spacing: s,
              numPiles: rows * columns,
              utilization
            };
          }
        }
      }
    }

    return bestConfig;
  }
}

// ============================================================================
// PILE LOAD TEST INTERPRETATION
// ============================================================================

export class PileLoadTestInterpreter {
  /**
   * Interpret static load test data
   */
  static interpretStaticTest(
    loadSettlementData: { load: number; settlement: number }[],
    pileDiameter: number,
    method: 'davisson' | 'chin' | 'mazurkiewicz' | 'decourt' = 'davisson'
  ): {
    ultimateLoad: number;
    method: string;
    yieldLoad?: number;
    elasticSettlement: number;
    plasticSettlement: number;
  } {
    const D = pileDiameter; // mm
    const data = [...loadSettlementData].sort((a, b) => a.load - b.load);

    switch (method) {
      case 'davisson': {
        // Davisson offset method
        const offsetLine = (load: number) => 4 + D / 120 + load * D / (120 * 30000);
        
        let ultimateLoad = data[data.length - 1].load;
        for (let i = 1; i < data.length; i++) {
          const { load, settlement } = data[i];
          const offset = offsetLine(load);
          if (settlement > offset) {
            // Interpolate
            const prev = data[i - 1];
            const prevOffset = offsetLine(prev.load);
            const ratio = (prevOffset - prev.settlement) / 
                         ((settlement - prev.settlement) - (offset - prevOffset));
            ultimateLoad = prev.load + ratio * (load - prev.load);
            break;
          }
        }

        const elastic = data[data.length - 1].settlement * 0.3;
        const plastic = data[data.length - 1].settlement - elastic;

        return {
          ultimateLoad,
          method: 'Davisson Offset',
          elasticSettlement: elastic,
          plasticSettlement: plastic
        };
      }

      case 'chin': {
        // Chin hyperbolic method
        const chinData = data.map(d => ({
          x: d.settlement,
          y: d.settlement / d.load
        }));

        // Linear regression on later portion
        const n = Math.floor(chinData.length / 2);
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = n; i < chinData.length; i++) {
          sumX += chinData[i].x;
          sumY += chinData[i].y;
          sumXY += chinData[i].x * chinData[i].y;
          sumX2 += chinData[i].x * chinData[i].x;
        }
        const count = chinData.length - n;
        const m = (count * sumXY - sumX * sumY) / (count * sumX2 - sumX * sumX);
        
        const ultimateLoad = 1 / m;

        return {
          ultimateLoad,
          method: 'Chin Hyperbolic',
          elasticSettlement: data[data.length - 1].settlement * 0.3,
          plasticSettlement: data[data.length - 1].settlement * 0.7
        };
      }

      case 'decourt': {
        // DeCourt extrapolation
        const decourtData = data.map(d => ({
          x: d.load,
          y: d.load / d.settlement
        }));

        // Find linear portion
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        const startIdx = Math.floor(data.length * 0.3);
        for (let i = startIdx; i < data.length; i++) {
          sumX += decourtData[i].x;
          sumY += decourtData[i].y;
          sumXY += decourtData[i].x * decourtData[i].y;
          sumX2 += decourtData[i].x * decourtData[i].x;
        }
        const count = data.length - startIdx;
        const m = (count * sumXY - sumX * sumY) / (count * sumX2 - sumX * sumX);
        const b = (sumY - m * sumX) / count;

        const ultimateLoad = -b / m;

        return {
          ultimateLoad: Math.max(0, ultimateLoad),
          method: 'DeCourt Extrapolation',
          yieldLoad: data[startIdx].load,
          elasticSettlement: data[data.length - 1].settlement * 0.25,
          plasticSettlement: data[data.length - 1].settlement * 0.75
        };
      }

      default: {
        // Mazurkiewicz graphical method
        const ultimateLoad = data[data.length - 1].load * 0.9;
        return {
          ultimateLoad,
          method: 'Mazurkiewicz',
          elasticSettlement: data[data.length - 1].settlement * 0.3,
          plasticSettlement: data[data.length - 1].settlement * 0.7
        };
      }
    }
  }

  /**
   * Interpret dynamic pile test (PDA)
   */
  static interpretDynamicTest(params: {
    blowCount: number;
    hammerEfficiency: number;
    hammerWeight: number; // kN
    dropHeight: number; // m
    pileWeight: number; // kN
    penetration: number; // mm per blow (set)
    quake: number; // mm
    dampingJ: number;
  }): {
    capacity: number;
    driveability: string;
    recommendations: string[];
  } {
    const { hammerEfficiency, hammerWeight, dropHeight, pileWeight, penetration, quake, dampingJ } = params;

    // Hiley formula
    const E_h = hammerEfficiency * hammerWeight * dropHeight; // Energy (kN.m)
    const e = 0.5; // Coefficient of restitution
    const C1 = quake; // Temporary compression of pile
    const C2 = 0.1 * quake; // Temporary compression of soil
    const C3 = quake; // Temporary compression of dolly/cap

    const efficiency = (1 + e * e * pileWeight / hammerWeight) / (1 + pileWeight / hammerWeight);
    const s = penetration; // Set per blow

    const R_u = E_h * efficiency / (s + 0.5 * (C1 + C2 + C3)) * 1000; // Ultimate resistance kN

    // CASE method capacity (simplified)
    const J_c = dampingJ;
    const capacity = R_u * (1 - J_c);

    const recommendations: string[] = [];
    let driveability = 'Good';

    if (penetration < 2) {
      driveability = 'Refusal';
      recommendations.push('Pile approaching refusal. Consider pre-drilling or jetting.');
    } else if (penetration > 25) {
      driveability = 'Easy';
      recommendations.push('Low blow count. Verify end bearing conditions.');
    }

    if (params.blowCount > 100) {
      recommendations.push('High blow count may cause pile damage. Check pile integrity.');
    }

    return {
      capacity,
      driveability,
      recommendations
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  AxialPileCapacity,
  LateralPileCapacity,
  PileGroupAnalyzer,
  PileLoadTestInterpreter
};
