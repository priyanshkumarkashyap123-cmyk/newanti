/**
 * ============================================================================
 * QUANTITY SURVEYING & COST ESTIMATION ENGINE
 * ============================================================================
 * 
 * Comprehensive material quantity takeoff and cost estimation for:
 * - Concrete structures (beams, columns, slabs, footings)
 * - Steel structures (frames, connections)
 * - Reinforcement (bars, mesh)
 * - Formwork
 * - Excavation and earthwork
 * - Unit rate cost estimation
 * 
 * Standards:
 * - IS 1200 - Method of Measurement of Building and Civil Engineering Works
 * - SMM7 - Standard Method of Measurement (UK)
 * - CSI MasterFormat (US)
 * - CPWD Specifications
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Material {
  name: string;
  unit: string;
  quantity: number;
  unitRate: number;
  amount: number;
  category: string;
}

export interface QuantityItem {
  itemNo: string;
  description: string;
  unit: string;
  quantity: number;
  length?: number;
  breadth?: number;
  height?: number;
  numbers?: number;
  deductions?: number;
}

export interface ConcreteElement {
  type: 'footing' | 'column' | 'beam' | 'slab' | 'staircase' | 'wall' | 'other';
  grade: string; // M20, M25, etc.
  dimensions: {
    length: number; // m
    width: number; // m
    depth: number; // m
  };
  quantity: number; // Number of elements
  reinforcement?: {
    mainBars?: { diameter: number; count: number; length: number }[];
    stirrups?: { diameter: number; spacing: number; length: number };
    distribution?: { diameter: number; spacing: number };
  };
}

export interface SteelSection {
  designation: string;
  type: 'I-section' | 'channel' | 'angle' | 'tube' | 'plate';
  length: number; // m
  quantity: number;
  weight: number; // kg/m
  connections?: number;
}

export interface CostBreakdown {
  materials: Material[];
  labor: { description: string; unit: string; quantity: number; rate: number; amount: number }[];
  equipment: { description: string; unit: string; quantity: number; rate: number; amount: number }[];
  overheads: number;
  profit: number;
  totalCost: number;
}

export interface UnitRates {
  concrete: Record<string, number>; // Per m³
  reinforcement: Record<string, number>; // Per kg
  formwork: Record<string, number>; // Per m²
  steel: Record<string, number>; // Per kg
  earthwork: Record<string, number>; // Per m³
  masonry: Record<string, number>; // Per m³
}

// ============================================================================
// DEFAULT UNIT RATES (INR - Update as needed)
// ============================================================================

export const DEFAULT_RATES: UnitRates = {
  concrete: {
    'M15': 4500,
    'M20': 5000,
    'M25': 5500,
    'M30': 6200,
    'M35': 7000,
    'M40': 8000,
    'M45': 9000,
    'M50': 10500
  },
  reinforcement: {
    'Fe415': 70,
    'Fe500': 72,
    'Fe500D': 75,
    'Fe550': 78
  },
  formwork: {
    'foundation': 350,
    'column': 500,
    'beam': 550,
    'slab': 400,
    'staircase': 600,
    'wall': 450
  },
  steel: {
    'structural': 80,
    'MS-plate': 75,
    'fabricated': 100,
    'connection': 120
  },
  earthwork: {
    'excavation-soft': 200,
    'excavation-hard': 400,
    'backfilling': 150,
    'disposal': 180
  },
  masonry: {
    'brick-1st': 5500,
    'brick-2nd': 4500,
    'cement-block': 4000,
    'AAC-block': 4200
  }
};

// ============================================================================
// CONCRETE QUANTITY CALCULATOR
// ============================================================================

export class ConcreteQuantityCalculator {
  /**
   * Calculate concrete volume
   */
  static calculateVolume(elements: ConcreteElement[]): {
    itemWiseVolume: { description: string; volume: number; grade: string }[];
    gradeWiseTotal: Record<string, number>;
    totalVolume: number;
  } {
    const itemWise: { description: string; volume: number; grade: string }[] = [];
    const gradeWise: Record<string, number> = {};
    let total = 0;

    for (const element of elements) {
      const volume = element.dimensions.length * 
                     element.dimensions.width * 
                     element.dimensions.depth * 
                     element.quantity;

      itemWise.push({
        description: `${element.type} (${element.quantity} nos)`,
        volume: Math.round(volume * 100) / 100,
        grade: element.grade
      });

      gradeWise[element.grade] = (gradeWise[element.grade] || 0) + volume;
      total += volume;
    }

    // Round all values
    Object.keys(gradeWise).forEach(k => {
      gradeWise[k] = Math.round(gradeWise[k] * 100) / 100;
    });

    return {
      itemWiseVolume: itemWise,
      gradeWiseTotal: gradeWise,
      totalVolume: Math.round(total * 100) / 100
    };
  }

  /**
   * Calculate concrete materials (cement, sand, aggregate)
   */
  static calculateMaterials(
    volume: number,
    grade: string,
    mixDesign?: { cement: number; sand: number; aggregate: number; water: number }
  ): {
    cement: { quantity: number; bags: number };
    sand: { quantity: number; unit: string };
    aggregate: { coarse20mm: number; coarse10mm: number };
    water: { quantity: number };
    admixture?: { quantity: number };
  } {
    // Standard mix proportions with 54% wastage factor for wet volume
    const dryVolume = volume * 1.54;

    // Default mix proportions if not provided
    const defaultMix: Record<string, { cement: number; sand: number; aggregate: number }> = {
      'M15': { cement: 300, sand: 0.48, aggregate: 0.96 },  // 1:2:4
      'M20': { cement: 360, sand: 0.45, aggregate: 0.90 },  // 1:1.5:3
      'M25': { cement: 400, sand: 0.42, aggregate: 0.84 },
      'M30': { cement: 440, sand: 0.40, aggregate: 0.80 },
      'M35': { cement: 480, sand: 0.38, aggregate: 0.76 },
      'M40': { cement: 520, sand: 0.36, aggregate: 0.72 }
    };

    const mix = defaultMix[grade] || defaultMix['M25'];

    // Cement calculation
    const cementKg = volume * mix.cement * 1.05; // 5% wastage
    const cementBags = Math.ceil(cementKg / 50);

    // Sand calculation
    const sandVolume = dryVolume * mix.sand * 1.10; // 10% wastage

    // Aggregate calculation (60% 20mm, 40% 10mm typically)
    const totalAggregate = dryVolume * mix.aggregate * 1.05;
    const aggregate20mm = totalAggregate * 0.60;
    const aggregate10mm = totalAggregate * 0.40;

    // Water (typically 45-50% of cement weight)
    const water = cementKg * 0.45;

    return {
      cement: { quantity: Math.round(cementKg), bags: cementBags },
      sand: { quantity: Math.round(sandVolume * 100) / 100, unit: 'm³' },
      aggregate: { 
        coarse20mm: Math.round(aggregate20mm * 100) / 100, 
        coarse10mm: Math.round(aggregate10mm * 100) / 100 
      },
      water: { quantity: Math.round(water) }
    };
  }

  /**
   * Calculate PCC/DPC/bed concrete
   */
  static calculateBedConcrete(
    area: number, // m²
    thickness: number, // mm
    grade: string = 'M15'
  ): { volume: number; materials: ReturnType<typeof ConcreteQuantityCalculator.calculateMaterials> } {
    const volume = area * (thickness / 1000);
    const materials = this.calculateMaterials(volume, grade);

    return { volume: Math.round(volume * 100) / 100, materials };
  }
}

// ============================================================================
// REINFORCEMENT QUANTITY CALCULATOR
// ============================================================================

export class ReinforcementQuantityCalculator {
  /**
   * Bar weight per meter by diameter
   */
  static readonly BAR_WEIGHTS: Record<number, number> = {
    6: 0.222,
    8: 0.395,
    10: 0.617,
    12: 0.889,
    16: 1.580,
    20: 2.469,
    25: 3.858,
    28: 4.831,
    32: 6.313,
    36: 7.990
  };

  /**
   * Calculate reinforcement quantity for beam
   */
  static calculateBeamReinforcement(
    beam: {
      span: number; // m
      width: number; // mm
      depth: number; // mm
      cover: number; // mm
      mainBars: { top: { diameter: number; count: number }; bottom: { diameter: number; count: number } };
      stirrups: { diameter: number; spacing: number };
      extraBars?: { diameter: number; count: number; length: number }[];
    },
    quantity: number = 1
  ): {
    mainBars: { diameter: number; length: number; weight: number }[];
    stirrups: { diameter: number; count: number; weight: number };
    totalWeight: number;
    details: string;
  } {
    const mainBars: { diameter: number; length: number; weight: number }[] = [];
    const stirrupCuttingLength = 2 * (beam.width - 2 * beam.cover) + 
                                  2 * (beam.depth - 2 * beam.cover) + 
                                  24 * beam.stirrups.diameter; // Hooks

    // Top bars
    const topLength = (beam.span + 0.3) * 1000; // Development length
    const topWeight = topLength / 1000 * this.BAR_WEIGHTS[beam.mainBars.top.diameter] * 
                      beam.mainBars.top.count * quantity;
    mainBars.push({
      diameter: beam.mainBars.top.diameter,
      length: topLength * beam.mainBars.top.count * quantity / 1000,
      weight: Math.round(topWeight * 100) / 100
    });

    // Bottom bars
    const botLength = (beam.span + 0.3) * 1000;
    const botWeight = botLength / 1000 * this.BAR_WEIGHTS[beam.mainBars.bottom.diameter] * 
                      beam.mainBars.bottom.count * quantity;
    mainBars.push({
      diameter: beam.mainBars.bottom.diameter,
      length: botLength * beam.mainBars.bottom.count * quantity / 1000,
      weight: Math.round(botWeight * 100) / 100
    });

    // Stirrups
    const stirrupCount = Math.ceil((beam.span * 1000) / beam.stirrups.spacing) + 1;
    const stirrupWeight = (stirrupCuttingLength / 1000) * 
                          this.BAR_WEIGHTS[beam.stirrups.diameter] * 
                          stirrupCount * quantity;

    const totalWeight = topWeight + botWeight + stirrupWeight;

    return {
      mainBars,
      stirrups: {
        diameter: beam.stirrups.diameter,
        count: stirrupCount * quantity,
        weight: Math.round(stirrupWeight * 100) / 100
      },
      totalWeight: Math.round(totalWeight * 100) / 100,
      details: `Beam: ${beam.mainBars.top.count}-T${beam.mainBars.top.diameter} top, ` +
               `${beam.mainBars.bottom.count}-T${beam.mainBars.bottom.diameter} bot, ` +
               `T${beam.stirrups.diameter}@${beam.stirrups.spacing}c/c`
    };
  }

  /**
   * Calculate reinforcement for column
   */
  static calculateColumnReinforcement(
    column: {
      height: number; // m
      width: number; // mm
      depth: number; // mm
      cover: number; // mm
      mainBars: { diameter: number; count: number };
      ties: { diameter: number; spacing: number };
      lapLength?: number; // m
    },
    quantity: number = 1
  ): {
    mainBars: { diameter: number; length: number; weight: number };
    ties: { diameter: number; count: number; weight: number };
    totalWeight: number;
  } {
    // Main bar length (height + lap + anchorage)
    const lapLength = column.lapLength || 0.6;
    const mainLength = column.height + lapLength + 0.3; // Development into footing/beam
    const mainWeight = mainLength * this.BAR_WEIGHTS[column.mainBars.diameter] * 
                       column.mainBars.count * quantity;

    // Tie cutting length
    const tiePerimeter = 2 * (column.width - 2 * column.cover) + 
                         2 * (column.depth - 2 * column.cover);
    const hooks = 20 * column.ties.diameter;
    const tieCuttingLength = tiePerimeter + hooks;

    // Number of ties
    const tieCount = Math.ceil((column.height * 1000) / column.ties.spacing) + 1;
    const tieWeight = (tieCuttingLength / 1000) * 
                      this.BAR_WEIGHTS[column.ties.diameter] * 
                      tieCount * quantity;

    return {
      mainBars: {
        diameter: column.mainBars.diameter,
        length: Math.round(mainLength * column.mainBars.count * quantity * 100) / 100,
        weight: Math.round(mainWeight * 100) / 100
      },
      ties: {
        diameter: column.ties.diameter,
        count: tieCount * quantity,
        weight: Math.round(tieWeight * 100) / 100
      },
      totalWeight: Math.round((mainWeight + tieWeight) * 100) / 100
    };
  }

  /**
   * Calculate slab reinforcement
   */
  static calculateSlabReinforcement(
    slab: {
      length: number; // m
      width: number; // m
      thickness: number; // mm
      cover: number; // mm
      mainBars: { diameter: number; spacing: number };
      distributionBars: { diameter: number; spacing: number };
      extraBars?: { diameter: number; count: number; length: number }[];
    },
    quantity: number = 1
  ): {
    mainBars: { diameter: number; count: number; length: number; weight: number };
    distributionBars: { diameter: number; count: number; length: number; weight: number };
    totalWeight: number;
  } {
    // Main bars (along shorter span)
    const mainBarCount = Math.ceil((slab.length * 1000) / slab.mainBars.spacing) + 1;
    const mainBarLength = slab.width + 0.2; // With development
    const mainWeight = mainBarLength * this.BAR_WEIGHTS[slab.mainBars.diameter] * 
                       mainBarCount * quantity;

    // Distribution bars (along longer span)
    const distBarCount = Math.ceil((slab.width * 1000) / slab.distributionBars.spacing) + 1;
    const distBarLength = slab.length + 0.2;
    const distWeight = distBarLength * this.BAR_WEIGHTS[slab.distributionBars.diameter] * 
                       distBarCount * quantity;

    return {
      mainBars: {
        diameter: slab.mainBars.diameter,
        count: mainBarCount * quantity,
        length: Math.round(mainBarLength * mainBarCount * quantity * 100) / 100,
        weight: Math.round(mainWeight * 100) / 100
      },
      distributionBars: {
        diameter: slab.distributionBars.diameter,
        count: distBarCount * quantity,
        length: Math.round(distBarLength * distBarCount * quantity * 100) / 100,
        weight: Math.round(distWeight * 100) / 100
      },
      totalWeight: Math.round((mainWeight + distWeight) * 100) / 100
    };
  }

  /**
   * Calculate BBS (Bar Bending Schedule) summary
   */
  static generateBBS(
    allBars: { diameter: number; length: number; weight: number; shape: string }[]
  ): {
    schedule: { diameter: number; totalLength: number; totalWeight: number; count: number }[];
    summary: { totalWeight: number; breakdown: Record<number, number> };
  } {
    const diameterMap = new Map<number, { length: number; weight: number; count: number }>();

    for (const bar of allBars) {
      const existing = diameterMap.get(bar.diameter) || { length: 0, weight: 0, count: 0 };
      diameterMap.set(bar.diameter, {
        length: existing.length + bar.length,
        weight: existing.weight + bar.weight,
        count: existing.count + 1
      });
    }

    const schedule: { diameter: number; totalLength: number; totalWeight: number; count: number }[] = [];
    const breakdown: Record<number, number> = {};
    let totalWeight = 0;

    for (const [diameter, data] of diameterMap.entries()) {
      schedule.push({
        diameter,
        totalLength: Math.round(data.length * 100) / 100,
        totalWeight: Math.round(data.weight * 100) / 100,
        count: data.count
      });
      breakdown[diameter] = Math.round(data.weight * 100) / 100;
      totalWeight += data.weight;
    }

    schedule.sort((a, b) => a.diameter - b.diameter);

    return {
      schedule,
      summary: {
        totalWeight: Math.round(totalWeight * 100) / 100,
        breakdown
      }
    };
  }
}

// ============================================================================
// FORMWORK QUANTITY CALCULATOR
// ============================================================================

export class FormworkCalculator {
  /**
   * Calculate formwork for column
   */
  static columnFormwork(
    column: { width: number; depth: number; height: number },
    quantity: number = 1
  ): { area: number; description: string } {
    const perimeter = 2 * (column.width + column.depth) / 1000; // m
    const area = perimeter * column.height * quantity;

    return {
      area: Math.round(area * 100) / 100,
      description: `Column formwork: ${column.width}x${column.depth}mm, height ${column.height}m`
    };
  }

  /**
   * Calculate formwork for beam
   */
  static beamFormwork(
    beam: { width: number; depth: number; span: number },
    quantity: number = 1,
    includeSoffit: boolean = true
  ): { area: number; sides: number; soffit: number; description: string } {
    const spanM = beam.span;
    const sides = 2 * (beam.depth / 1000) * spanM * quantity;
    const soffit = includeSoffit ? (beam.width / 1000) * spanM * quantity : 0;
    const total = sides + soffit;

    return {
      area: Math.round(total * 100) / 100,
      sides: Math.round(sides * 100) / 100,
      soffit: Math.round(soffit * 100) / 100,
      description: `Beam formwork: ${beam.width}x${beam.depth}mm, span ${spanM}m`
    };
  }

  /**
   * Calculate formwork for slab
   */
  static slabFormwork(
    slab: { length: number; width: number; thickness: number },
    quantity: number = 1,
    openings: { length: number; width: number }[] = []
  ): { area: number; description: string } {
    let area = slab.length * slab.width * quantity;

    // Deduct openings
    for (const opening of openings) {
      area -= opening.length * opening.width * quantity;
    }

    return {
      area: Math.round(area * 100) / 100,
      description: `Slab formwork: ${slab.length}m x ${slab.width}m`
    };
  }

  /**
   * Calculate formwork for footing
   */
  static footingFormwork(
    footing: { length: number; width: number; depth: number },
    quantity: number = 1,
    type: 'isolated' | 'combined' | 'strip' = 'isolated'
  ): { area: number; description: string } {
    const perimeter = 2 * (footing.length + footing.width);
    const area = perimeter * footing.depth * quantity;

    return {
      area: Math.round(area * 100) / 100,
      description: `${type} footing formwork: ${footing.length}m x ${footing.width}m x ${footing.depth}m`
    };
  }
}

// ============================================================================
// STRUCTURAL STEEL QUANTITY CALCULATOR
// ============================================================================

export class SteelQuantityCalculator {
  /**
   * Standard section weights (kg/m)
   */
  static readonly SECTION_WEIGHTS: Record<string, number> = {
    'ISMB100': 11.5,
    'ISMB150': 14.9,
    'ISMB200': 25.4,
    'ISMB250': 37.3,
    'ISMB300': 44.2,
    'ISMB350': 52.4,
    'ISMB400': 61.6,
    'ISMB450': 72.4,
    'ISMB500': 86.9,
    'ISMB550': 103.7,
    'ISMB600': 122.6,
    'ISMC75': 6.8,
    'ISMC100': 9.2,
    'ISMC125': 12.7,
    'ISMC150': 16.4,
    'ISMC175': 19.1,
    'ISMC200': 22.1,
    'ISMC250': 30.4,
    'ISMC300': 35.8,
    'ISA50x50x5': 3.77,
    'ISA75x75x6': 6.81,
    'ISA100x100x8': 11.98
  };

  /**
   * Calculate steel quantity
   */
  static calculateQuantity(
    sections: SteelSection[]
  ): {
    sectionWise: { designation: string; length: number; weight: number }[];
    totalWeight: number;
    connectionWeight: number;
    grandTotal: number;
  } {
    const sectionWise: { designation: string; length: number; weight: number }[] = [];
    let totalWeight = 0;
    let totalConnections = 0;

    for (const section of sections) {
      const unitWeight = section.weight || this.SECTION_WEIGHTS[section.designation] || 50;
      const weight = section.length * unitWeight * section.quantity;

      sectionWise.push({
        designation: section.designation,
        length: Math.round(section.length * section.quantity * 100) / 100,
        weight: Math.round(weight * 100) / 100
      });

      totalWeight += weight;
      totalConnections += section.connections || 0;
    }

    // Connection weight (typically 3-5% of main weight)
    const connectionWeight = totalWeight * 0.04;

    return {
      sectionWise,
      totalWeight: Math.round(totalWeight * 100) / 100,
      connectionWeight: Math.round(connectionWeight * 100) / 100,
      grandTotal: Math.round((totalWeight + connectionWeight) * 100) / 100
    };
  }

  /**
   * Calculate plate weight
   */
  static calculatePlateWeight(
    plates: { length: number; width: number; thickness: number; quantity: number }[]
  ): { items: { size: string; weight: number }[]; total: number } {
    const density = 7850; // kg/m³
    const items: { size: string; weight: number }[] = [];
    let total = 0;

    for (const plate of plates) {
      const volume = (plate.length / 1000) * (plate.width / 1000) * (plate.thickness / 1000);
      const weight = volume * density * plate.quantity;

      items.push({
        size: `${plate.length}x${plate.width}x${plate.thickness}mm`,
        weight: Math.round(weight * 100) / 100
      });

      total += weight;
    }

    return {
      items,
      total: Math.round(total * 100) / 100
    };
  }
}

// ============================================================================
// COST ESTIMATOR
// ============================================================================

export class CostEstimator {
  private rates: UnitRates;

  constructor(rates: UnitRates = DEFAULT_RATES) {
    this.rates = rates;
  }

  /**
   * Estimate concrete work cost
   */
  estimateConcreteCost(
    volume: number,
    grade: string,
    steelWeight: number,
    formworkArea: number,
    elementType: 'foundation' | 'column' | 'beam' | 'slab' = 'beam'
  ): CostBreakdown {
    const materials: Material[] = [];
    const labor: { description: string; unit: string; quantity: number; rate: number; amount: number }[] = [];
    const equipment: { description: string; unit: string; quantity: number; rate: number; amount: number }[] = [];

    // Concrete cost
    const concreteRate = this.rates.concrete[grade] || 5500;
    const concreteCost = volume * concreteRate;
    materials.push({
      name: `Concrete ${grade}`,
      unit: 'm³',
      quantity: volume,
      unitRate: concreteRate,
      amount: concreteCost,
      category: 'Concrete'
    });

    // Reinforcement cost
    const steelRate = this.rates.reinforcement['Fe500'] || 72;
    const steelCost = steelWeight * steelRate;
    materials.push({
      name: 'Reinforcement Steel Fe500',
      unit: 'kg',
      quantity: steelWeight,
      unitRate: steelRate,
      amount: steelCost,
      category: 'Reinforcement'
    });

    // Formwork cost
    const formworkRate = this.rates.formwork[elementType] || 450;
    const formworkCost = formworkArea * formworkRate;
    materials.push({
      name: `Formwork - ${elementType}`,
      unit: 'm²',
      quantity: formworkArea,
      unitRate: formworkRate,
      amount: formworkCost,
      category: 'Formwork'
    });

    // Labor costs
    labor.push({
      description: 'Mason',
      unit: 'day',
      quantity: volume * 0.5,
      rate: 800,
      amount: volume * 0.5 * 800
    });
    labor.push({
      description: 'Helper',
      unit: 'day',
      quantity: volume * 1.0,
      rate: 500,
      amount: volume * 1.0 * 500
    });
    labor.push({
      description: 'Bar bender',
      unit: 'day',
      quantity: steelWeight / 100,
      rate: 700,
      amount: (steelWeight / 100) * 700
    });

    // Equipment
    equipment.push({
      description: 'Vibrator',
      unit: 'day',
      quantity: volume * 0.25,
      rate: 500,
      amount: volume * 0.25 * 500
    });

    // Totals
    const materialTotal = materials.reduce((sum, m) => sum + m.amount, 0);
    const laborTotal = labor.reduce((sum, l) => sum + l.amount, 0);
    const equipmentTotal = equipment.reduce((sum, e) => sum + e.amount, 0);

    const subtotal = materialTotal + laborTotal + equipmentTotal;
    const overheads = subtotal * 0.10; // 10% overheads
    const profit = (subtotal + overheads) * 0.10; // 10% profit

    return {
      materials,
      labor,
      equipment,
      overheads: Math.round(overheads),
      profit: Math.round(profit),
      totalCost: Math.round(subtotal + overheads + profit)
    };
  }

  /**
   * Estimate steel structure cost
   */
  estimateSteelCost(
    steelWeight: number,
    connectionCount: number,
    paintingArea: number
  ): CostBreakdown {
    const materials: Material[] = [];
    const labor: { description: string; unit: string; quantity: number; rate: number; amount: number }[] = [];
    const equipment: { description: string; unit: string; quantity: number; rate: number; amount: number }[] = [];

    // Steel cost
    const steelRate = this.rates.steel['structural'] || 80;
    materials.push({
      name: 'Structural Steel',
      unit: 'kg',
      quantity: steelWeight,
      unitRate: steelRate,
      amount: steelWeight * steelRate,
      category: 'Steel'
    });

    // Connection materials
    const boltWeight = connectionCount * 0.5; // Approximate
    materials.push({
      name: 'Bolts and fasteners',
      unit: 'kg',
      quantity: boltWeight,
      unitRate: 150,
      amount: boltWeight * 150,
      category: 'Connections'
    });

    // Painting
    materials.push({
      name: 'Paint (2 coats)',
      unit: 'm²',
      quantity: paintingArea,
      unitRate: 120,
      amount: paintingArea * 120,
      category: 'Finishing'
    });

    // Labor
    labor.push({
      description: 'Fabrication',
      unit: 'kg',
      quantity: steelWeight,
      rate: 15,
      amount: steelWeight * 15
    });
    labor.push({
      description: 'Erection',
      unit: 'kg',
      quantity: steelWeight,
      rate: 10,
      amount: steelWeight * 10
    });
    labor.push({
      description: 'Painting',
      unit: 'm²',
      quantity: paintingArea,
      rate: 30,
      amount: paintingArea * 30
    });

    // Equipment
    equipment.push({
      description: 'Crane rental',
      unit: 'day',
      quantity: steelWeight / 5000,
      rate: 15000,
      amount: (steelWeight / 5000) * 15000
    });
    equipment.push({
      description: 'Welding equipment',
      unit: 'day',
      quantity: steelWeight / 1000,
      rate: 1000,
      amount: (steelWeight / 1000) * 1000
    });

    const materialTotal = materials.reduce((sum, m) => sum + m.amount, 0);
    const laborTotal = labor.reduce((sum, l) => sum + l.amount, 0);
    const equipmentTotal = equipment.reduce((sum, e) => sum + e.amount, 0);

    const subtotal = materialTotal + laborTotal + equipmentTotal;
    const overheads = subtotal * 0.12;
    const profit = (subtotal + overheads) * 0.12;

    return {
      materials,
      labor,
      equipment,
      overheads: Math.round(overheads),
      profit: Math.round(profit),
      totalCost: Math.round(subtotal + overheads + profit)
    };
  }

  /**
   * Generate summary BOQ (Bill of Quantities)
   */
  generateBOQ(
    items: { description: string; unit: string; quantity: number; rate: number }[]
  ): {
    boq: { sno: number; description: string; unit: string; quantity: number; rate: number; amount: number }[];
    total: number;
  } {
    const boq = items.map((item, index) => ({
      sno: index + 1,
      ...item,
      amount: Math.round(item.quantity * item.rate)
    }));

    const total = boq.reduce((sum, item) => sum + item.amount, 0);

    return { boq, total };
  }
}

// ============================================================================
// ABSTRACT ESTIMATOR (Quick Estimate)
// ============================================================================

export class AbstractEstimator {
  /**
   * Quick estimate based on plinth area
   */
  static plinthAreaEstimate(
    plinthArea: number, // m²
    buildingType: 'residential' | 'commercial' | 'industrial' | 'institutional',
    floors: number,
    location: 'metro' | 'urban' | 'semi-urban' | 'rural',
    quality: 'basic' | 'standard' | 'premium' | 'luxury'
  ): {
    estimatedCost: number;
    costPerSqm: number;
    breakdown: { item: string; percentage: number; amount: number }[];
  } {
    // Base rates (INR per sq.m) - 2024 estimates
    const baseRates: Record<string, Record<string, number>> = {
      'residential': { 'basic': 15000, 'standard': 22000, 'premium': 35000, 'luxury': 55000 },
      'commercial': { 'basic': 18000, 'standard': 28000, 'premium': 45000, 'luxury': 70000 },
      'industrial': { 'basic': 12000, 'standard': 18000, 'premium': 28000, 'luxury': 40000 },
      'institutional': { 'basic': 20000, 'standard': 30000, 'premium': 45000, 'luxury': 60000 }
    };

    // Location factors
    const locationFactors: Record<string, number> = {
      'metro': 1.25,
      'urban': 1.00,
      'semi-urban': 0.85,
      'rural': 0.70
    };

    // Floor factor (additional floors cost less per sqm)
    const floorFactor = 1 + (floors - 1) * 0.15;

    const baseRate = baseRates[buildingType][quality];
    const locationFactor = locationFactors[location];
    const costPerSqm = Math.round(baseRate * locationFactor * floorFactor);
    const totalArea = plinthArea * floors;
    const estimatedCost = Math.round(totalArea * costPerSqm);

    // Standard breakdown percentages
    const breakdown = [
      { item: 'Substructure (Foundation)', percentage: 12, amount: Math.round(estimatedCost * 0.12) },
      { item: 'Superstructure (RCC)', percentage: 25, amount: Math.round(estimatedCost * 0.25) },
      { item: 'Masonry & Plastering', percentage: 15, amount: Math.round(estimatedCost * 0.15) },
      { item: 'Flooring', percentage: 10, amount: Math.round(estimatedCost * 0.10) },
      { item: 'Doors & Windows', percentage: 8, amount: Math.round(estimatedCost * 0.08) },
      { item: 'Electrical', percentage: 8, amount: Math.round(estimatedCost * 0.08) },
      { item: 'Plumbing & Sanitary', percentage: 7, amount: Math.round(estimatedCost * 0.07) },
      { item: 'Painting', percentage: 5, amount: Math.round(estimatedCost * 0.05) },
      { item: 'Miscellaneous', percentage: 10, amount: Math.round(estimatedCost * 0.10) }
    ];

    return {
      estimatedCost,
      costPerSqm,
      breakdown
    };
  }
}

// ============================================================================
// EXPORTS - Classes/constants already exported at declaration
// ============================================================================

export default {
  ConcreteQuantityCalculator,
  ReinforcementQuantityCalculator,
  FormworkCalculator,
  SteelQuantityCalculator,
  CostEstimator,
  AbstractEstimator,
  DEFAULT_RATES
};
