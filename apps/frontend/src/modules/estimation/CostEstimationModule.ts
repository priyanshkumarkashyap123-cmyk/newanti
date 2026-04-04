/**
 * BeamLab - Cost Estimation Module
 * Comprehensive quantity takeoff and cost estimation for structural projects
 * 
 * Features:
 * - Automatic quantity extraction from structural model
 * - Region-specific rate databases (India, USA, EU, Middle East)
 * - Material cost breakdown (concrete, steel, formwork)
 * - Labor cost estimation
 * - Equipment and machinery costs
 * - Overhead and contingency calculations
 * - BOQ generation (Bill of Quantities)
 * - Cost comparison analysis
 * - Historical cost tracking
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type CostRegion = 'india' | 'usa' | 'uk' | 'uae' | 'australia' | 'singapore' | 'europe';
export type Currency = 'INR' | 'USD' | 'GBP' | 'AED' | 'AUD' | 'SGD' | 'EUR';
export type UnitSystem = 'metric' | 'imperial';

export interface CostEstimationConfig {
  region: CostRegion;
  currency: Currency;
  unitSystem: UnitSystem;
  projectType: ProjectType;
  location?: string;
  yearQuarter?: string; // e.g., "2026Q1"
  contingencyPercent?: number;
  overheadPercent?: number;
  profitPercent?: number;
}

export type ProjectType = 
  | 'residential_low' | 'residential_mid' | 'residential_high'
  | 'commercial_office' | 'commercial_retail' | 'commercial_mixed'
  | 'industrial_light' | 'industrial_heavy' | 'warehouse'
  | 'infrastructure_bridge' | 'infrastructure_flyover'
  | 'institutional' | 'healthcare' | 'educational';

export interface StructuralQuantities {
  concrete: ConcreteQuantity[];
  steel: SteelQuantity[];
  formwork: FormworkQuantity[];
  reinforcement: RebarQuantity[];
  masonry?: MasonryQuantity[];
  excavation?: ExcavationQuantity[];
  piling?: PilingQuantity[];
  miscellaneous?: MiscQuantity[];
}

export interface ConcreteQuantity {
  id: string;
  element: string;
  grade: string;
  volume: number; // m³
  location?: string;
  floor?: string;
}

export interface SteelQuantity {
  id: string;
  element: string;
  section: string;
  grade: string;
  weight: number; // kg
  length?: number; // m
  location?: string;
}

export interface FormworkQuantity {
  id: string;
  element: string;
  type: 'conventional' | 'plywood' | 'steel' | 'aluminum' | 'system';
  area: number; // m²
  uses?: number; // Number of reuses
}

export interface RebarQuantity {
  id: string;
  element: string;
  diameter: number; // mm
  grade: string;
  weight: number; // kg
  cutLength?: number; // m
}

export interface MasonryQuantity {
  id: string;
  type: 'brick' | 'block' | 'AAC' | 'stone';
  thickness: number; // mm
  area: number; // m²
  openings?: number; // m²
}

export interface ExcavationQuantity {
  id: string;
  type: 'bulk' | 'trench' | 'pit';
  soilType: 'soft' | 'medium' | 'hard' | 'rock';
  volume: number; // m³
  depth?: number; // m
}

export interface PilingQuantity {
  id: string;
  type: 'bored' | 'driven' | 'CFA' | 'micropile';
  diameter: number; // mm
  length: number; // m
  count: number;
}

export interface MiscQuantity {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  rate?: number;
}

// Cost Results
export interface CostEstimationResult {
  summary: CostSummary;
  breakdown: CostBreakdown;
  boq: BillOfQuantities;
  analysis: CostAnalysis;
  metadata: EstimationMetadata;
}

export interface CostSummary {
  totalCost: number;
  currency: Currency;
  costPerSqm?: number;
  costPerSqft?: number;
  costPerCum?: number;
  directCost: number;
  indirectCost: number;
  contingency: number;
  grandTotal: number;
}

export interface CostBreakdown {
  concrete: { quantity: number; unit: string; rate: number; amount: number };
  reinforcement: { quantity: number; unit: string; rate: number; amount: number };
  structuralSteel: { quantity: number; unit: string; rate: number; amount: number };
  formwork: { quantity: number; unit: string; rate: number; amount: number };
  excavation: { quantity: number; unit: string; rate: number; amount: number };
  piling?: { quantity: number; unit: string; rate: number; amount: number };
  labor: { amount: number; percentOfDirect: number };
  equipment: { amount: number; percentOfDirect: number };
  overhead: { amount: number; percent: number };
  contingency: { amount: number; percent: number };
  profit?: { amount: number; percent: number };
}

export interface BillOfQuantities {
  items: BOQItem[];
  subtotals: { category: string; amount: number }[];
  totalBeforeMarkup: number;
  markup: number;
  grandTotal: number;
}

export interface BOQItem {
  sno: number;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  category: string;
  remarks?: string;
}

export interface CostAnalysis {
  costPerElement: { element: string; cost: number; percent: number }[];
  costPerMaterial: { material: string; cost: number; percent: number }[];
  costPerFloor?: { floor: string; cost: number; percent: number }[];
  benchmarkComparison?: { benchmark: number; actual: number; variance: number };
}

export interface EstimationMetadata {
  projectName?: string;
  estimatedBy?: string;
  date: Date;
  revision: string;
  notes: string[];
  assumptions: string[];
  exclusions: string[];
}

// ============================================================================
// RATE DATABASE
// ============================================================================

interface RateDatabase {
  concrete: Record<string, number>;
  steel: Record<string, number>;
  rebar: Record<string, number>;
  formwork: Record<string, number>;
  labor: Record<string, number>;
  excavation: Record<string, number>;
  piling: Record<string, number>;
}

const RATES: Record<CostRegion, RateDatabase> = {
  india: {
    concrete: {
      M20: 5500, M25: 5800, M30: 6200, M35: 6800, M40: 7500, M45: 8200, M50: 9000,
      'ready_mix_M25': 6500, 'ready_mix_M30': 7000, 'ready_mix_M40': 8500,
    },
    steel: {
      'E250': 75000, 'E350': 80000, 'E450': 90000, // per tonne
      'ISMB': 78000, 'ISMC': 80000, 'ISA': 82000, 'pipe': 85000,
    },
    rebar: {
      'Fe415': 62000, 'Fe500': 65000, 'Fe500D': 68000, 'Fe550D': 72000, // per tonne
    },
    formwork: {
      'conventional': 450, 'plywood': 380, 'steel': 550, 'aluminum': 650, 'system': 800, // per m²
    },
    labor: {
      'mason': 800, 'carpenter': 750, 'barbender': 700, 'helper': 500, // per day
      'welder': 900, 'rigger': 850, 'operator': 1000,
    },
    excavation: {
      'soft_manual': 250, 'soft_machine': 180, 'medium_machine': 280, 
      'hard_machine': 450, 'rock_blasting': 1200, // per m³
    },
    piling: {
      'bored_600': 8500, 'bored_800': 12000, 'bored_1000': 16000, // per rm
      'driven_350': 6000, 'driven_450': 8500, 'micropile_200': 5500,
    },
  },
  
  usa: {
    concrete: {
      'C3000': 150, 'C4000': 165, 'C5000': 185, 'C6000': 210, 'C8000': 250, // per CY
      'M20': 180, 'M25': 200, 'M30': 220, 'M40': 280, // per m³
    },
    steel: {
      'A36': 2200, 'A572_50': 2400, 'A992': 2500, 'A500': 2600, // per ton
      'ASTM': 2300, 'HSS': 2800, 'pipe': 3000,
    },
    rebar: {
      'Gr40': 1100, 'Gr60': 1200, 'Gr75': 1400, 'Gr80': 1500, // per ton
    },
    formwork: {
      'conventional': 45, 'plywood': 38, 'steel': 55, 'aluminum': 65, 'system': 80, // per SF
    },
    labor: {
      'carpenter': 55, 'ironworker': 60, 'laborer': 35, // per hour
      'operator': 65, 'welder': 70,
    },
    excavation: {
      'soft_machine': 25, 'medium_machine': 40, 'hard_machine': 65, 'rock': 120, // per CY
    },
    piling: {
      'bored_24': 180, 'bored_36': 280, 'bored_48': 400, // per LF
      'driven_HP12': 120, 'driven_HP14': 160,
    },
  },
  
  uk: {
    concrete: {
      'C20': 95, 'C25': 100, 'C30': 110, 'C35': 120, 'C40': 135, 'C50': 160, // per m³
    },
    steel: {
      'S275': 1800, 'S355': 1950, 'S460': 2200, // per tonne
    },
    rebar: {
      'B500B': 950, 'B500C': 1000, // per tonne
    },
    formwork: {
      'conventional': 45, 'plywood': 40, 'steel': 55, 'system': 75, // per m²
    },
    labor: {
      'skilled': 35, 'semi_skilled': 25, 'unskilled': 18, // per hour
    },
    excavation: {
      'soft': 25, 'medium': 40, 'hard': 65, 'rock': 110, // per m³
    },
    piling: {
      'bored_600': 180, 'bored_900': 280, 'CFA_450': 150, // per m
    },
  },
  
  uae: {
    concrete: {
      'C25': 280, 'C30': 310, 'C40': 380, 'C50': 450, 'C60': 550, // per m³ (AED)
    },
    steel: {
      'S275': 3200, 'S355': 3500, // per tonne (AED)
    },
    rebar: {
      'B500B': 2800, 'B500C': 3000, // per tonne (AED)
    },
    formwork: {
      'conventional': 120, 'system': 180, 'aluminum': 200, // per m² (AED)
    },
    labor: {
      'skilled': 150, 'semi_skilled': 100, 'unskilled': 70, // per day (AED)
    },
    excavation: {
      'soft': 35, 'medium': 55, 'hard': 90, 'rock': 180, // per m³ (AED)
    },
    piling: {
      'bored_600': 450, 'bored_900': 700, 'bored_1200': 1000, // per m (AED)
    },
  },
  
  australia: {
    concrete: {
      'N20': 220, 'N25': 235, 'N32': 260, 'N40': 300, 'N50': 360, // per m³ (AUD)
    },
    steel: {
      '300Plus': 2800, '350_grade': 3100, // per tonne (AUD)
    },
    rebar: {
      'D500N': 1600, 'D500L': 1700, // per tonne (AUD)
    },
    formwork: {
      'conventional': 65, 'plywood': 55, 'system': 95, // per m² (AUD)
    },
    labor: {
      'skilled': 75, 'semi_skilled': 55, 'unskilled': 40, // per hour (AUD)
    },
    excavation: {
      'soft': 35, 'medium': 55, 'hard': 90, 'rock': 150, // per m³ (AUD)
    },
    piling: {
      'bored_600': 280, 'bored_900': 420, 'CFA_450': 220, // per m (AUD)
    },
  },
  
  singapore: {
    concrete: {
      'G25': 120, 'G30': 135, 'G40': 160, 'G50': 195, 'G60': 240, // per m³ (SGD)
    },
    steel: {
      'S275': 1600, 'S355': 1800, // per tonne (SGD)
    },
    rebar: {
      'B500B': 1100, 'B500C': 1200, // per tonne (SGD)
    },
    formwork: {
      'conventional': 55, 'system': 85, 'aluminum': 100, // per m² (SGD)
    },
    labor: {
      'skilled': 120, 'semi_skilled': 80, 'unskilled': 50, // per day (SGD)
    },
    excavation: {
      'soft': 30, 'medium': 50, 'hard': 85, 'rock': 160, // per m³ (SGD)
    },
    piling: {
      'bored_800': 350, 'bored_1000': 480, 'bored_1200': 650, // per m (SGD)
    },
  },
  
  europe: {
    concrete: {
      'C20': 85, 'C25': 95, 'C30': 105, 'C35': 115, 'C40': 130, 'C50': 155, // per m³ (EUR)
    },
    steel: {
      'S235': 1500, 'S275': 1650, 'S355': 1800, 'S460': 2100, // per tonne (EUR)
    },
    rebar: {
      'B500A': 850, 'B500B': 900, 'B500C': 950, // per tonne (EUR)
    },
    formwork: {
      'conventional': 40, 'plywood': 35, 'system': 65, // per m² (EUR)
    },
    labor: {
      'skilled': 45, 'semi_skilled': 32, 'unskilled': 22, // per hour (EUR)
    },
    excavation: {
      'soft': 22, 'medium': 38, 'hard': 60, 'rock': 100, // per m³ (EUR)
    },
    piling: {
      'bored_600': 160, 'bored_900': 250, 'CFA_450': 130, // per m (EUR)
    },
  },
};

// Currency symbols
const CURRENCY_SYMBOLS: Record<Currency, string> = {
  INR: '₹', USD: '$', GBP: '£', AED: 'د.إ', AUD: 'A$', SGD: 'S$', EUR: '€',
};

// ============================================================================
// COST ESTIMATION ENGINE
// ============================================================================

export class CostEstimationEngine {
  private config: CostEstimationConfig;
  private rates: RateDatabase;
  
  constructor(config: CostEstimationConfig) {
    this.config = {
      contingencyPercent: 5,
      overheadPercent: 10,
      profitPercent: 10,
      ...config,
    };
    this.rates = RATES[config.region];
  }
  
  /**
   * Generate complete cost estimation
   */
  estimateCost(quantities: StructuralQuantities, projectArea?: number): CostEstimationResult {
    // Calculate concrete costs
    const concreteCost = this.calculateConcreteCost(quantities.concrete);
    
    // Calculate reinforcement costs
    const rebarCost = this.calculateRebarCost(quantities.reinforcement);
    
    // Calculate structural steel costs
    const steelCost = this.calculateSteelCost(quantities.steel);
    
    // Calculate formwork costs
    const formworkCost = this.calculateFormworkCost(quantities.formwork);
    
    // Calculate excavation costs
    const excavationCost = quantities.excavation 
      ? this.calculateExcavationCost(quantities.excavation) 
      : { quantity: 0, unit: 'm³', rate: 0, amount: 0 };
    
    // Calculate piling costs
    const pilingCost = quantities.piling 
      ? this.calculatePilingCost(quantities.piling)
      : undefined;
    
    // Direct costs
    const directCost = concreteCost.amount + rebarCost.amount + steelCost.amount + 
                       formworkCost.amount + excavationCost.amount + (pilingCost?.amount || 0);
    
    // Labor costs (as percentage of direct cost)
    const laborPercent = this.getLaborPercent();
    const laborCost = directCost * laborPercent;
    
    // Equipment costs
    const equipmentPercent = this.getEquipmentPercent();
    const equipmentCost = directCost * equipmentPercent;
    
    // Indirect costs
    const overheadCost = directCost * (this.config.overheadPercent! / 100);
    const contingencyCost = (directCost + laborCost + equipmentCost) * (this.config.contingencyPercent! / 100);
    const profitCost = (directCost + laborCost + equipmentCost + overheadCost) * (this.config.profitPercent! / 100);
    
    // Total
    const totalCost = directCost + laborCost + equipmentCost;
    const grandTotal = totalCost + overheadCost + contingencyCost + profitCost;
    
    // Cost breakdown
    const breakdown: CostBreakdown = {
      concrete: concreteCost,
      reinforcement: rebarCost,
      structuralSteel: steelCost,
      formwork: formworkCost,
      excavation: excavationCost,
      piling: pilingCost,
      labor: { amount: laborCost, percentOfDirect: laborPercent * 100 },
      equipment: { amount: equipmentCost, percentOfDirect: equipmentPercent * 100 },
      overhead: { amount: overheadCost, percent: this.config.overheadPercent! },
      contingency: { amount: contingencyCost, percent: this.config.contingencyPercent! },
      profit: { amount: profitCost, percent: this.config.profitPercent! },
    };
    
    // Generate BOQ
    const boq = this.generateBOQ(quantities, breakdown);
    
    // Analysis
    const analysis = this.generateAnalysis(breakdown, projectArea);
    
    // Summary
    const summary: CostSummary = {
      totalCost,
      currency: this.config.currency,
      directCost,
      indirectCost: overheadCost + contingencyCost,
      contingency: contingencyCost,
      grandTotal,
      costPerSqm: projectArea ? grandTotal / projectArea : undefined,
      costPerSqft: projectArea ? grandTotal / (projectArea * 10.764) : undefined,
    };
    
    // Metadata
    const metadata: EstimationMetadata = {
      date: new Date(),
      revision: '1.0',
      notes: [
        `Rates based on ${this.config.region.toUpperCase()} market (${this.config.yearQuarter || '2026Q1'})`,
        'Prices exclude GST/VAT unless specified',
        'Subject to market fluctuation',
      ],
      assumptions: [
        'Ready-mix concrete for all structural elements',
        'Standard formwork with typical reuse cycles',
        'Labor productivity as per regional norms',
      ],
      exclusions: [
        'Site development and external works',
        'MEP services',
        'Architectural finishes',
        'Furniture and fixtures',
      ],
    };
    
    return {
      summary,
      breakdown,
      boq,
      analysis,
      metadata,
    };
  }
  
  /**
   * Calculate concrete cost
   */
  private calculateConcreteCost(concrete: ConcreteQuantity[]): { quantity: number; unit: string; rate: number; amount: number } {
    let totalVolume = 0;
    let totalCost = 0;
    
    concrete.forEach(item => {
      const grade = item.grade;
      const rate = this.rates.concrete[grade] || this.rates.concrete['M25'] || 6000;
      totalVolume += item.volume;
      totalCost += item.volume * rate;
    });
    
    const avgRate = totalVolume > 0 ? totalCost / totalVolume : 0;
    
    return {
      quantity: Math.round(totalVolume * 100) / 100,
      unit: 'm³',
      rate: Math.round(avgRate),
      amount: Math.round(totalCost),
    };
  }
  
  /**
   * Calculate reinforcement cost
   */
  private calculateRebarCost(rebar: RebarQuantity[]): { quantity: number; unit: string; rate: number; amount: number } {
    let totalWeight = 0;
    let totalCost = 0;
    
    rebar.forEach(item => {
      const grade = item.grade;
      const rate = (this.rates.rebar[grade] || this.rates.rebar['Fe500'] || 65000) / 1000; // Per kg
      totalWeight += item.weight;
      totalCost += item.weight * rate;
    });
    
    // Add cutting/bending wastage (typically 3-5%)
    const wastage = 0.04;
    totalWeight *= (1 + wastage);
    totalCost *= (1 + wastage);
    
    return {
      quantity: Math.round(totalWeight),
      unit: 'kg',
      rate: Math.round(totalCost / totalWeight * 100) / 100,
      amount: Math.round(totalCost),
    };
  }
  
  /**
   * Calculate structural steel cost
   */
  private calculateSteelCost(steel: SteelQuantity[]): { quantity: number; unit: string; rate: number; amount: number } {
    let totalWeight = 0;
    let totalCost = 0;
    
    steel.forEach(item => {
      const grade = item.grade;
      const rate = (this.rates.steel[grade] || this.rates.steel['E250'] || 75000) / 1000; // Per kg
      totalWeight += item.weight;
      totalCost += item.weight * rate;
    });
    
    // Add fabrication cost (typically 20-30% of material)
    const fabrication = 0.25;
    totalCost *= (1 + fabrication);
    
    // Add erection cost (typically 15-20% of material)
    const erection = 0.18;
    totalCost *= (1 + erection);
    
    return {
      quantity: Math.round(totalWeight),
      unit: 'kg',
      rate: Math.round(totalCost / totalWeight * 100) / 100,
      amount: Math.round(totalCost),
    };
  }
  
  /**
   * Calculate formwork cost
   */
  private calculateFormworkCost(formwork: FormworkQuantity[]): { quantity: number; unit: string; rate: number; amount: number } {
    let totalArea = 0;
    let totalCost = 0;
    
    formwork.forEach(item => {
      const type = item.type;
      const baseRate = this.rates.formwork[type] || this.rates.formwork['conventional'] || 450;
      const uses = item.uses || 4; // Default 4 uses
      const effectiveRate = baseRate / Math.sqrt(uses); // Reduced rate for reuse
      
      totalArea += item.area;
      totalCost += item.area * effectiveRate;
    });
    
    return {
      quantity: Math.round(totalArea * 100) / 100,
      unit: 'm²',
      rate: Math.round(totalCost / totalArea),
      amount: Math.round(totalCost),
    };
  }
  
  /**
   * Calculate excavation cost
   */
  private calculateExcavationCost(excavation: ExcavationQuantity[]): { quantity: number; unit: string; rate: number; amount: number } {
    let totalVolume = 0;
    let totalCost = 0;
    
    excavation.forEach(item => {
      const key = `${item.soilType}_machine`;
      const rate = this.rates.excavation[key] || this.rates.excavation['medium_machine'] || 280;
      totalVolume += item.volume;
      totalCost += item.volume * rate;
    });
    
    // Add backfilling and disposal (typically 40% of excavation)
    const disposal = 0.4;
    totalCost *= (1 + disposal);
    
    return {
      quantity: Math.round(totalVolume * 100) / 100,
      unit: 'm³',
      rate: Math.round(totalCost / totalVolume),
      amount: Math.round(totalCost),
    };
  }
  
  /**
   * Calculate piling cost
   */
  private calculatePilingCost(piling: PilingQuantity[]): { quantity: number; unit: string; rate: number; amount: number } {
    let totalLength = 0;
    let totalCost = 0;
    
    piling.forEach(item => {
      const key = `${item.type}_${item.diameter}`;
      const rate = this.rates.piling[key] || this.rates.piling['bored_600'] || 8500;
      const length = item.length * item.count;
      totalLength += length;
      totalCost += length * rate;
    });
    
    return {
      quantity: Math.round(totalLength * 100) / 100,
      unit: 'rm',
      rate: Math.round(totalCost / totalLength),
      amount: Math.round(totalCost),
    };
  }
  
  /**
   * Get labor percentage based on project type
   */
  private getLaborPercent(): number {
    const laborFactors: Record<string, number> = {
      'residential_low': 0.35,
      'residential_mid': 0.30,
      'residential_high': 0.28,
      'commercial_office': 0.25,
      'commercial_retail': 0.27,
      'industrial_light': 0.22,
      'industrial_heavy': 0.20,
      'warehouse': 0.18,
      'infrastructure_bridge': 0.30,
      'infrastructure_flyover': 0.28,
      'institutional': 0.28,
      'healthcare': 0.30,
      'educational': 0.28,
    };
    
    return laborFactors[this.config.projectType] || 0.28;
  }
  
  /**
   * Get equipment percentage based on project type
   */
  private getEquipmentPercent(): number {
    const equipFactors: Record<string, number> = {
      'residential_low': 0.08,
      'residential_mid': 0.10,
      'residential_high': 0.12,
      'commercial_office': 0.12,
      'commercial_retail': 0.10,
      'industrial_light': 0.15,
      'industrial_heavy': 0.18,
      'warehouse': 0.12,
      'infrastructure_bridge': 0.20,
      'infrastructure_flyover': 0.22,
      'institutional': 0.12,
      'healthcare': 0.12,
      'educational': 0.10,
    };
    
    return equipFactors[this.config.projectType] || 0.12;
  }
  
  /**
   * Generate Bill of Quantities
   */
  private generateBOQ(quantities: StructuralQuantities, breakdown: CostBreakdown): BillOfQuantities {
    const items: BOQItem[] = [];
    let sno = 1;
    
    // Excavation items
    if (quantities.excavation) {
      quantities.excavation.forEach(exc => {
        items.push({
          sno: sno++,
          itemCode: `EXC${sno.toString().padStart(3, '0')}`,
          description: `Excavation in ${exc.soilType} soil - ${exc.type}`,
          unit: 'm³',
          quantity: exc.volume,
          rate: breakdown.excavation.rate,
          amount: exc.volume * breakdown.excavation.rate,
          category: 'Excavation',
        });
      });
    }
    
    // Piling items
    if (quantities.piling) {
      quantities.piling.forEach(pile => {
        items.push({
          sno: sno++,
          itemCode: `PIL${sno.toString().padStart(3, '0')}`,
          description: `${pile.type} pile ${pile.diameter}mm dia, ${pile.length}m long`,
          unit: 'nos',
          quantity: pile.count,
          rate: breakdown.piling?.rate || 0 * pile.length,
          amount: pile.count * pile.length * (breakdown.piling?.rate || 0),
          category: 'Piling',
        });
      });
    }
    
    // Concrete items
    const concreteByGrade = new Map<string, number>();
    quantities.concrete.forEach(c => {
      concreteByGrade.set(c.grade, (concreteByGrade.get(c.grade) || 0) + c.volume);
    });
    
    concreteByGrade.forEach((volume, grade) => {
      items.push({
        sno: sno++,
        itemCode: `CON${sno.toString().padStart(3, '0')}`,
        description: `Ready mix concrete grade ${grade}, placing, compacting and curing complete`,
        unit: 'm³',
        quantity: volume,
        rate: this.rates.concrete[grade] || breakdown.concrete.rate,
        amount: volume * (this.rates.concrete[grade] || breakdown.concrete.rate),
        category: 'Concrete',
      });
    });
    
    // Formwork items
    const formworkByType = new Map<string, number>();
    quantities.formwork.forEach(f => {
      formworkByType.set(f.type, (formworkByType.get(f.type) || 0) + f.area);
    });
    
    formworkByType.forEach((area, type) => {
      items.push({
        sno: sno++,
        itemCode: `FWK${sno.toString().padStart(3, '0')}`,
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} formwork including props, staging and removal`,
        unit: 'm²',
        quantity: area,
        rate: this.rates.formwork[type] || breakdown.formwork.rate,
        amount: area * (this.rates.formwork[type] || breakdown.formwork.rate),
        category: 'Formwork',
      });
    });
    
    // Reinforcement items
    const rebarByDia = new Map<number, number>();
    quantities.reinforcement.forEach(r => {
      rebarByDia.set(r.diameter, (rebarByDia.get(r.diameter) || 0) + r.weight);
    });
    
    rebarByDia.forEach((weight, dia) => {
      items.push({
        sno: sno++,
        itemCode: `REB${sno.toString().padStart(3, '0')}`,
        description: `TMT reinforcement ${dia}mm dia Fe500D, cutting, bending, placing and tying complete`,
        unit: 'kg',
        quantity: weight * 1.04, // 4% wastage
        rate: breakdown.reinforcement.rate,
        amount: weight * 1.04 * breakdown.reinforcement.rate,
        category: 'Reinforcement',
      });
    });
    
    // Structural steel items
    if (quantities.steel.length > 0) {
      const steelBySection = new Map<string, number>();
      quantities.steel.forEach(s => {
        steelBySection.set(s.section, (steelBySection.get(s.section) || 0) + s.weight);
      });
      
      steelBySection.forEach((weight, section) => {
        items.push({
          sno: sno++,
          itemCode: `STL${sno.toString().padStart(3, '0')}`,
          description: `Structural steel ${section}, fabrication, surface preparation, painting and erection complete`,
          unit: 'kg',
          quantity: weight,
          rate: breakdown.structuralSteel.rate,
          amount: weight * breakdown.structuralSteel.rate,
          category: 'Structural Steel',
        });
      });
    }
    
    // Calculate subtotals
    const subtotals: { category: string; amount: number }[] = [];
    const categories = ['Excavation', 'Piling', 'Concrete', 'Formwork', 'Reinforcement', 'Structural Steel'];
    
    categories.forEach(cat => {
      const catItems = items.filter(i => i.category === cat);
      if (catItems.length > 0) {
        subtotals.push({
          category: cat,
          amount: catItems.reduce((sum, i) => sum + i.amount, 0),
        });
      }
    });
    
    const totalBeforeMarkup = subtotals.reduce((sum, s) => sum + s.amount, 0);
    const markup = breakdown.overhead.amount + breakdown.contingency.amount + (breakdown.profit?.amount || 0);
    
    return {
      items,
      subtotals,
      totalBeforeMarkup,
      markup,
      grandTotal: totalBeforeMarkup + markup,
    };
  }
  
  /**
   * Generate cost analysis
   */
  private generateAnalysis(breakdown: CostBreakdown, projectArea?: number): CostAnalysis {
    const directTotal = breakdown.concrete.amount + breakdown.reinforcement.amount + 
                        breakdown.structuralSteel.amount + breakdown.formwork.amount + 
                        breakdown.excavation.amount + (breakdown.piling?.amount || 0);
    
    const costPerMaterial = [
      { material: 'Concrete', cost: breakdown.concrete.amount, percent: (breakdown.concrete.amount / directTotal) * 100 },
      { material: 'Reinforcement', cost: breakdown.reinforcement.amount, percent: (breakdown.reinforcement.amount / directTotal) * 100 },
      { material: 'Structural Steel', cost: breakdown.structuralSteel.amount, percent: (breakdown.structuralSteel.amount / directTotal) * 100 },
      { material: 'Formwork', cost: breakdown.formwork.amount, percent: (breakdown.formwork.amount / directTotal) * 100 },
      { material: 'Excavation', cost: breakdown.excavation.amount, percent: (breakdown.excavation.amount / directTotal) * 100 },
    ];
    
    if (breakdown.piling) {
      costPerMaterial.push({
        material: 'Piling', cost: breakdown.piling.amount, percent: (breakdown.piling.amount / directTotal) * 100,
      });
    }
    
    const costPerElement = [
      { element: 'Materials', cost: directTotal, percent: 60 },
      { element: 'Labor', cost: breakdown.labor.amount, percent: breakdown.labor.percentOfDirect * 0.6 },
      { element: 'Equipment', cost: breakdown.equipment.amount, percent: breakdown.equipment.percentOfDirect * 0.6 },
      { element: 'Overheads', cost: breakdown.overhead.amount, percent: breakdown.overhead.percent },
      { element: 'Contingency', cost: breakdown.contingency.amount, percent: breakdown.contingency.percent },
    ];
    
    return {
      costPerElement,
      costPerMaterial,
    };
  }
  
  /**
   * Format currency amount
   */
  formatCurrency(amount: number): string {
    const symbol = CURRENCY_SYMBOLS[this.config.currency];
    
    if (this.config.currency === 'INR') {
      // Indian numbering system (lakhs, crores)
      if (amount >= 10000000) {
        return `${symbol}${(amount / 10000000).toFixed(2)} Cr`;
      } else if (amount >= 100000) {
        return `${symbol}${(amount / 100000).toFixed(2)} L`;
      }
    }
    
    return `${symbol}${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  
  /**
   * Export to CSV format
   */
  exportBOQToCSV(boq: BillOfQuantities): string {
    let csv = 'S.No,Item Code,Description,Unit,Quantity,Rate,Amount,Category\n';
    
    boq.items.forEach(item => {
      csv += `${item.sno},"${item.itemCode}","${item.description}",${item.unit},${item.quantity},${item.rate},${item.amount},"${item.category}"\n`;
    });
    
    csv += `\n,,SUBTOTALS\n`;
    boq.subtotals.forEach(s => {
      csv += `,,"${s.category}",,,,"${this.formatCurrency(s.amount)}"\n`;
    });
    
    csv += `\n,,"Total Before Markup",,,,${this.formatCurrency(boq.totalBeforeMarkup)}\n`;
    csv += `,,"Markup (OH + Contingency + Profit)",,,,${this.formatCurrency(boq.markup)}\n`;
    csv += `,,"GRAND TOTAL",,,,${this.formatCurrency(boq.grandTotal)}\n`;
    
    return csv;
  }
  
  /**
   * Generate cost summary text
   */
  generateSummaryText(result: CostEstimationResult): string {
    const s = result.summary;
    const b = result.breakdown;
    
    return `
╔══════════════════════════════════════════════════════════════╗
║              STRUCTURAL COST ESTIMATION SUMMARY              ║
╠══════════════════════════════════════════════════════════════╣
║ Region: ${this.config.region.toUpperCase().padEnd(20)} Currency: ${this.config.currency.padEnd(15)}║
╠══════════════════════════════════════════════════════════════╣
║ DIRECT COSTS                                                 ║
╠────────────────────────────────────────────────────────────── ╣
║ Concrete        │ ${b.concrete.quantity.toFixed(0).padStart(8)} m³  × ${this.formatCurrency(b.concrete.rate).padStart(12)} = ${this.formatCurrency(b.concrete.amount).padStart(14)} ║
║ Reinforcement   │ ${b.reinforcement.quantity.toFixed(0).padStart(8)} kg  × ${this.formatCurrency(b.reinforcement.rate).padStart(12)} = ${this.formatCurrency(b.reinforcement.amount).padStart(14)} ║
║ Structural Steel│ ${b.structuralSteel.quantity.toFixed(0).padStart(8)} kg  × ${this.formatCurrency(b.structuralSteel.rate).padStart(12)} = ${this.formatCurrency(b.structuralSteel.amount).padStart(14)} ║
║ Formwork        │ ${b.formwork.quantity.toFixed(0).padStart(8)} m²  × ${this.formatCurrency(b.formwork.rate).padStart(12)} = ${this.formatCurrency(b.formwork.amount).padStart(14)} ║
║ Excavation      │ ${b.excavation.quantity.toFixed(0).padStart(8)} m³  × ${this.formatCurrency(b.excavation.rate).padStart(12)} = ${this.formatCurrency(b.excavation.amount).padStart(14)} ║
╠──────────────────────────────────────────────────────────────╣
║ Direct Cost Total                         ${this.formatCurrency(s.directCost).padStart(18)} ║
╠──────────────────────────────────────────────────────────────╣
║ Labor (${b.labor.percentOfDirect.toFixed(0)}%)                              ${this.formatCurrency(b.labor.amount).padStart(18)} ║
║ Equipment (${b.equipment.percentOfDirect.toFixed(0)}%)                           ${this.formatCurrency(b.equipment.amount).padStart(18)} ║
║ Overhead (${b.overhead.percent}%)                            ${this.formatCurrency(b.overhead.amount).padStart(18)} ║
║ Contingency (${b.contingency.percent}%)                         ${this.formatCurrency(b.contingency.amount).padStart(18)} ║
${b.profit ? `║ Profit (${b.profit.percent}%)                              ${this.formatCurrency(b.profit.amount).padStart(18)} ║` : ''}
╠══════════════════════════════════════════════════════════════╣
║ GRAND TOTAL                               ${this.formatCurrency(s.grandTotal).padStart(18)} ║
╠══════════════════════════════════════════════════════════════╣
${s.costPerSqm ? `║ Cost per m²                               ${this.formatCurrency(s.costPerSqm).padStart(18)} ║` : ''}
${s.costPerSqft ? `║ Cost per ft²                              ${this.formatCurrency(s.costPerSqft).padStart(18)} ║` : ''}
╚══════════════════════════════════════════════════════════════╝
    `.trim();
  }
}

// ============================================================================
// FACTORY AND UTILITY FUNCTIONS  
// ============================================================================

export function createCostEstimator(config: CostEstimationConfig): CostEstimationEngine {
  return new CostEstimationEngine(config);
}

/**
 * Quick estimate based on built-up area
 */
export function quickEstimate(
  builtUpArea: number,
  projectType: ProjectType,
  region: CostRegion
): { lowEstimate: number; midEstimate: number; highEstimate: number; currency: Currency } {
  // Cost per sqm benchmarks
  const benchmarks: Record<CostRegion, Record<string, { low: number; mid: number; high: number }>> = {
    india: {
      'residential_low': { low: 15000, mid: 20000, high: 28000 },
      'residential_mid': { low: 22000, mid: 30000, high: 40000 },
      'residential_high': { low: 35000, mid: 50000, high: 75000 },
      'commercial_office': { low: 30000, mid: 45000, high: 65000 },
      'industrial_light': { low: 18000, mid: 25000, high: 35000 },
      'warehouse': { low: 12000, mid: 18000, high: 25000 },
    },
    usa: {
      'residential_low': { low: 150, mid: 200, high: 280 },
      'residential_mid': { low: 220, mid: 300, high: 400 },
      'residential_high': { low: 350, mid: 500, high: 750 },
      'commercial_office': { low: 300, mid: 450, high: 650 },
      'industrial_light': { low: 180, mid: 250, high: 350 },
      'warehouse': { low: 120, mid: 180, high: 250 },
    },
    uk: {
      'residential_low': { low: 1500, mid: 2000, high: 2800 },
      'residential_mid': { low: 2200, mid: 3000, high: 4000 },
      'residential_high': { low: 3500, mid: 5000, high: 7500 },
      'commercial_office': { low: 3000, mid: 4500, high: 6500 },
      'industrial_light': { low: 1800, mid: 2500, high: 3500 },
      'warehouse': { low: 1200, mid: 1800, high: 2500 },
    },
    uae: {
      'residential_low': { low: 2500, mid: 3500, high: 5000 },
      'residential_mid': { low: 4000, mid: 5500, high: 7500 },
      'residential_high': { low: 6000, mid: 9000, high: 15000 },
      'commercial_office': { low: 5000, mid: 7500, high: 11000 },
      'industrial_light': { low: 3000, mid: 4500, high: 6500 },
      'warehouse': { low: 2000, mid: 3000, high: 4500 },
    },
    australia: {
      'residential_low': { low: 2000, mid: 2800, high: 4000 },
      'residential_mid': { low: 3000, mid: 4200, high: 6000 },
      'residential_high': { low: 5000, mid: 7500, high: 12000 },
      'commercial_office': { low: 4500, mid: 6500, high: 10000 },
      'industrial_light': { low: 2500, mid: 3500, high: 5000 },
      'warehouse': { low: 1800, mid: 2600, high: 3800 },
    },
    singapore: {
      'residential_low': { low: 2000, mid: 2800, high: 4000 },
      'residential_mid': { low: 3000, mid: 4200, high: 6000 },
      'residential_high': { low: 5000, mid: 7500, high: 12000 },
      'commercial_office': { low: 4500, mid: 6500, high: 10000 },
      'industrial_light': { low: 2500, mid: 3500, high: 5000 },
      'warehouse': { low: 1800, mid: 2600, high: 3800 },
    },
    europe: {
      'residential_low': { low: 1200, mid: 1700, high: 2400 },
      'residential_mid': { low: 1800, mid: 2500, high: 3500 },
      'residential_high': { low: 3000, mid: 4500, high: 7000 },
      'commercial_office': { low: 2500, mid: 4000, high: 6000 },
      'industrial_light': { low: 1500, mid: 2200, high: 3200 },
      'warehouse': { low: 1000, mid: 1500, high: 2200 },
    },
  };
  
  const currencies: Record<CostRegion, Currency> = {
    india: 'INR', usa: 'USD', uk: 'GBP', uae: 'AED', 
    australia: 'AUD', singapore: 'SGD', europe: 'EUR',
  };
  
  const rates = benchmarks[region][projectType] || benchmarks[region]['residential_mid'];
  
  return {
    lowEstimate: builtUpArea * rates.low,
    midEstimate: builtUpArea * rates.mid,
    highEstimate: builtUpArea * rates.high,
    currency: currencies[region],
  };
}

/**
 * Calculate concrete quantity from structural elements
 */
export function calculateConcreteQuantity(elements: {
  beams: { count: number; length: number; width: number; depth: number }[];
  columns: { count: number; width: number; depth: number; height: number }[];
  slabs: { area: number; thickness: number }[];
  foundations: { count: number; length: number; width: number; depth: number }[];
}): number {
  let total = 0;
  
  elements.beams.forEach(b => {
    total += b.count * b.length * b.width * b.depth;
  });
  
  elements.columns.forEach(c => {
    total += c.count * c.width * c.depth * c.height;
  });
  
  elements.slabs.forEach(s => {
    total += s.area * s.thickness;
  });
  
  elements.foundations.forEach(f => {
    total += f.count * f.length * f.width * f.depth;
  });
  
  return total;
}

/**
 * Estimate rebar quantity from concrete volume
 */
export function estimateRebarFromConcrete(
  concreteVolume: number,
  elementType: 'beam' | 'column' | 'slab' | 'foundation' | 'wall'
): number {
  // Typical steel ratios (kg/m³)
  const ratios: Record<string, number> = {
    beam: 120,
    column: 150,
    slab: 80,
    foundation: 70,
    wall: 100,
  };
  
  return concreteVolume * (ratios[elementType] || 100);
}

// Default export
export default CostEstimationEngine;
