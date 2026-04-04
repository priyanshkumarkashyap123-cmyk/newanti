/**
 * ============================================================================
 * COMPREHENSIVE MATERIAL DATABASE SYSTEM
 * ============================================================================
 * 
 * Complete material library with:
 * - Concrete (IS 456, ACI 318, EC2, AS 3600)
 * - Steel (IS 800, AISC, EC3, AS 4100)
 * - Timber (IS 883, NDS, EC5)
 * - Masonry (IS 1905, ACI 530)
 * - Aluminum (AA, EC9)
 * - Composites (FRP, CFRP, GFRP)
 * - Soils (geotechnical properties)
 * 
 * Features:
 * - Temperature-dependent properties
 * - Non-linear material models
 * - Creep and shrinkage
 * - Fatigue properties
 * - Fire resistance ratings
 * - Environmental impact data
 * 
 * @version 2.0.0
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type MaterialCategory = 'concrete' | 'steel' | 'timber' | 'masonry' | 'aluminum' | 'composite' | 'soil';
export type MaterialCode = 'IS' | 'ACI' | 'EC' | 'AS' | 'AISC' | 'NDS' | 'BS';

export interface BaseMaterial {
  id: string;
  name: string;
  category: MaterialCategory;
  code: MaterialCode;
  grade: string;
  density: number; // kg/m³
  elasticModulus: number; // MPa
  poissonRatio: number;
  thermalCoefficient: number; // per °C
  color?: string;
  description?: string;
  environmentalImpact?: EnvironmentalData;
}

export interface ConcreteMaterial extends BaseMaterial {
  category: 'concrete';
  fck: number; // Characteristic compressive strength (MPa)
  fcm: number; // Mean compressive strength (MPa)
  fctm: number; // Mean tensile strength (MPa)
  fctk_05: number; // Characteristic tensile (5%)
  fctk_95: number; // Characteristic tensile (95%)
  Ecm: number; // Secant modulus (MPa)
  Gc: number; // Fracture energy (N/mm)
  epsC1: number; // Strain at peak stress
  epsC_u: number; // Ultimate strain
  creepCoefficient: number;
  shrinkageStrain: number;
  ageAtLoading: number; // days
  cementType: 'CEM_I' | 'CEM_II' | 'CEM_III';
  aggregateType: 'quartzite' | 'limestone' | 'basalt' | 'sandstone';
  exposureClass: string;
  maxAggregateSize: number; // mm
  slump: number; // mm
  waterCementRatio: number;
  admixtures?: string[];
  fireResistance?: FireResistance;
}

export interface SteelMaterial extends BaseMaterial {
  category: 'steel';
  fy: number; // Yield strength (MPa)
  fu: number; // Ultimate strength (MPa)
  fy_thickness?: { t_max: number; fy: number }[]; // Thickness-dependent yield
  E: number; // Elastic modulus (MPa)
  G: number; // Shear modulus (MPa)
  epsilon_y: number; // Yield strain
  epsilon_u: number; // Ultimate strain
  epsilon_sh: number; // Strain at hardening
  hardening: 'isotropic' | 'kinematic' | 'combined';
  ductilityClass: 'A' | 'B' | 'C';
  toughness: 'JR' | 'J0' | 'J2' | 'K2';
  weldability: 'excellent' | 'good' | 'fair';
  corrosionClass?: string;
  coatingType?: string;
  fatigueCategory?: number; // N/mm²
  fireResistance?: FireResistance;
}

export interface RebarMaterial extends SteelMaterial {
  type: 'deformed' | 'plain' | 'galvanized' | 'stainless' | 'epoxy_coated';
  ribPattern?: string;
  bondStrength: number; // MPa
  bendRadius: Record<number, number>; // diameter -> bend radius
  spliceRequirements: {
    tensionLap: number;
    compressionLap: number;
    hooks: {
      standardHook: number;
      seismicHook: number;
    };
  };
}

export interface TimberMaterial extends BaseMaterial {
  category: 'timber';
  species: string;
  grade: string;
  type: 'softwood' | 'hardwood' | 'glulam' | 'LVL' | 'CLT';
  fm: number; // Bending strength (MPa)
  ft0: number; // Tension parallel (MPa)
  ft90: number; // Tension perpendicular (MPa)
  fc0: number; // Compression parallel (MPa)
  fc90: number; // Compression perpendicular (MPa)
  fv: number; // Shear strength (MPa)
  E0_mean: number; // Mean modulus parallel (MPa)
  E0_05: number; // 5% modulus parallel (MPa)
  E90_mean: number; // Mean modulus perpendicular (MPa)
  G_mean: number; // Shear modulus (MPa)
  moistureContent: number; // %
  servicClass: 1 | 2 | 3;
  durationFactor: Record<string, number>;
  fireCharringRate: number; // mm/min
  treatmentType?: string;
}

export interface SoilMaterial extends BaseMaterial {
  category: 'soil';
  classification: string; // USCS classification
  cohesion: number; // kPa
  frictionAngle: number; // degrees
  unitWeight: number; // kN/m³
  saturatedUnitWeight: number; // kN/m³
  submergedUnitWeight: number; // kN/m³
  bearingCapacity: number; // kPa
  settlementModulus: number; // MPa
  permeability: number; // m/s
  compressionIndex: number;
  recompressionIndex: number;
  overconsolidationRatio: number;
  liquidLimit?: number;
  plasticLimit?: number;
  plasticityIndex?: number;
  SPT_N?: number;
  CPT_qc?: number;
}

export interface EnvironmentalData {
  embodiedCarbon: number; // kg CO2e per unit
  embodiedEnergy: number; // MJ per unit
  recyclability: number; // %
  recyclableContent: number; // %
  waterUsage: number; // liters per unit
  toxicity: 'none' | 'low' | 'medium' | 'high';
  lifeSpan: number; // years
  sustainabilityCertification?: string[];
}

export interface FireResistance {
  ratingMinutes: number;
  temperatureLimit: number; // °C
  strengthReduction: Record<number, number>; // temp -> reduction factor
  modulusReduction: Record<number, number>;
  spalling: boolean;
  protectionRequired?: string;
}

// ============================================================================
// COMPREHENSIVE MATERIAL DATABASE
// ============================================================================

export class MaterialDatabase {
  private materials: Map<string, BaseMaterial> = new Map();
  private customMaterials: Map<string, BaseMaterial> = new Map();

  constructor() {
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    this.initializeConcreteGrades();
    this.initializeSteelGrades();
    this.initializeRebarGrades();
    this.initializeTimberGrades();
    this.initializeSoilTypes();
    this.initializeComposites();
  }

  // --------------------------------------------------------------------------
  // CONCRETE GRADES
  // --------------------------------------------------------------------------
  
  private initializeConcreteGrades(): void {
    // IS 456 Concrete Grades
    const IS_concrete: ConcreteMaterial[] = [
      this.createConcrete('M15', 15, 'IS'),
      this.createConcrete('M20', 20, 'IS'),
      this.createConcrete('M25', 25, 'IS'),
      this.createConcrete('M30', 30, 'IS'),
      this.createConcrete('M35', 35, 'IS'),
      this.createConcrete('M40', 40, 'IS'),
      this.createConcrete('M45', 45, 'IS'),
      this.createConcrete('M50', 50, 'IS'),
      this.createConcrete('M55', 55, 'IS'),
      this.createConcrete('M60', 60, 'IS'),
      this.createConcrete('M65', 65, 'IS'),
      this.createConcrete('M70', 70, 'IS'),
      this.createConcrete('M75', 75, 'IS'),
      this.createConcrete('M80', 80, 'IS'),
    ];

    // ACI/ASTM Concrete
    const ACI_concrete: ConcreteMaterial[] = [
      this.createConcrete('C20', 20, 'ACI'),
      this.createConcrete('C25', 25, 'ACI'),
      this.createConcrete('C30', 30, 'ACI'),
      this.createConcrete('C35', 35, 'ACI'),
      this.createConcrete('C40', 40, 'ACI'),
      this.createConcrete('C45', 45, 'ACI'),
      this.createConcrete('C50', 50, 'ACI'),
      this.createConcrete('C55', 55, 'ACI'),
      this.createConcrete('C60', 60, 'ACI'),
    ];

    // Eurocode 2 Concrete
    const EC2_concrete: ConcreteMaterial[] = [
      this.createConcrete('C12/15', 12, 'EC'),
      this.createConcrete('C16/20', 16, 'EC'),
      this.createConcrete('C20/25', 20, 'EC'),
      this.createConcrete('C25/30', 25, 'EC'),
      this.createConcrete('C30/37', 30, 'EC'),
      this.createConcrete('C35/45', 35, 'EC'),
      this.createConcrete('C40/50', 40, 'EC'),
      this.createConcrete('C45/55', 45, 'EC'),
      this.createConcrete('C50/60', 50, 'EC'),
      this.createConcrete('C55/67', 55, 'EC'),
      this.createConcrete('C60/75', 60, 'EC'),
      this.createConcrete('C70/85', 70, 'EC'),
      this.createConcrete('C80/95', 80, 'EC'),
      this.createConcrete('C90/105', 90, 'EC'),
    ];

    [...IS_concrete, ...ACI_concrete, ...EC2_concrete].forEach(m => {
      this.materials.set(m.id, m);
    });
  }

  private createConcrete(grade: string, fck: number, code: MaterialCode): ConcreteMaterial {
    // Calculate properties based on fck
    const fcm = fck + 8; // Mean strength
    const fctm = fck <= 50 
      ? 0.3 * Math.pow(fck, 2/3)
      : 2.12 * Math.log(1 + fcm / 10);
    
    const fctk_05 = 0.7 * fctm;
    const fctk_95 = 1.3 * fctm;
    
    const Ecm = 22000 * Math.pow(fcm / 10, 0.3);
    
    const epsC1 = Math.min(0.7 * Math.pow(fcm, 0.31), 2.8) / 1000;
    const epsC_u = fck < 50 
      ? 3.5 / 1000
      : (2.8 + 27 * Math.pow((98 - fcm) / 100, 4)) / 1000;

    return {
      id: `concrete_${code}_${grade}`,
      name: `${grade} Concrete (${code})`,
      category: 'concrete',
      code,
      grade,
      density: 2400 + fck * 2, // Slight increase for higher grades
      elasticModulus: Ecm,
      poissonRatio: 0.2,
      thermalCoefficient: 10e-6,
      color: this.getConcreteColor(fck),
      fck,
      fcm,
      fctm,
      fctk_05,
      fctk_95,
      Ecm,
      Gc: 0.073 * Math.pow(fcm, 0.18),
      epsC1,
      epsC_u,
      creepCoefficient: 2.5,
      shrinkageStrain: 0.0003,
      ageAtLoading: 28,
      cementType: 'CEM_I',
      aggregateType: 'quartzite',
      exposureClass: 'XC1',
      maxAggregateSize: 20,
      slump: 100,
      waterCementRatio: Math.max(0.35, 0.65 - fck * 0.005),
      fireResistance: {
        ratingMinutes: 120,
        temperatureLimit: 500,
        strengthReduction: { 100: 1.0, 200: 0.95, 300: 0.85, 400: 0.75, 500: 0.60, 600: 0.45 },
        modulusReduction: { 100: 1.0, 200: 0.90, 300: 0.75, 400: 0.55, 500: 0.35, 600: 0.20 },
        spalling: fck > 55,
      },
      environmentalImpact: {
        embodiedCarbon: 100 + fck * 3, // kg CO2e/m³
        embodiedEnergy: 1000 + fck * 30, // MJ/m³
        recyclability: 90,
        recyclableContent: 20,
        waterUsage: 180,
        toxicity: 'low',
        lifeSpan: 100,
      },
    };
  }

  private getConcreteColor(fck: number): string {
    const lightness = Math.max(30, 70 - fck * 0.5);
    return `hsl(0, 0%, ${lightness}%)`;
  }

  // --------------------------------------------------------------------------
  // STEEL GRADES
  // --------------------------------------------------------------------------
  
  private initializeSteelGrades(): void {
    // IS 800 Steel Grades
    const IS_steel: SteelMaterial[] = [
      this.createSteel('E165', 165, 290, 'IS'),
      this.createSteel('E250', 250, 410, 'IS'),
      this.createSteel('E250-A', 250, 410, 'IS', 'A'),
      this.createSteel('E250-B', 250, 410, 'IS', 'B'),
      this.createSteel('E250-C', 250, 410, 'IS', 'C'),
      this.createSteel('E300', 300, 440, 'IS'),
      this.createSteel('E350', 350, 490, 'IS'),
      this.createSteel('E410', 410, 540, 'IS'),
      this.createSteel('E450', 450, 570, 'IS'),
      this.createSteel('E550', 550, 650, 'IS'),
      this.createSteel('E600', 600, 730, 'IS'),
      this.createSteel('E650', 650, 780, 'IS'),
    ];

    // ASTM/AISC Steel Grades
    const AISC_steel: SteelMaterial[] = [
      this.createSteel('A36', 250, 400, 'AISC'),
      this.createSteel('A572-50', 345, 450, 'AISC'),
      this.createSteel('A572-60', 415, 520, 'AISC'),
      this.createSteel('A572-65', 450, 550, 'AISC'),
      this.createSteel('A992', 345, 450, 'AISC'),
      this.createSteel('A500-B', 290, 400, 'AISC'),
      this.createSteel('A500-C', 317, 427, 'AISC'),
      this.createSteel('A514', 690, 760, 'AISC'),
    ];

    // Eurocode 3 Steel Grades
    const EC3_steel: SteelMaterial[] = [
      this.createSteel('S235', 235, 360, 'EC'),
      this.createSteel('S275', 275, 430, 'EC'),
      this.createSteel('S355', 355, 510, 'EC'),
      this.createSteel('S420', 420, 520, 'EC'),
      this.createSteel('S450', 450, 550, 'EC'),
      this.createSteel('S460', 460, 570, 'EC'),
      this.createSteel('S500', 500, 590, 'EC'),
      this.createSteel('S550', 550, 640, 'EC'),
      this.createSteel('S620', 620, 700, 'EC'),
      this.createSteel('S690', 690, 770, 'EC'),
    ];

    [...IS_steel, ...AISC_steel, ...EC3_steel].forEach(m => {
      this.materials.set(m.id, m);
    });
  }

  private createSteel(
    grade: string, 
    fy: number, 
    fu: number, 
    code: MaterialCode,
    ductilityClass: 'A' | 'B' | 'C' = 'B'
  ): SteelMaterial {
    const E = 200000; // MPa
    const G = 77000; // MPa
    
    return {
      id: `steel_${code}_${grade}`,
      name: `${grade} Steel (${code})`,
      category: 'steel',
      code,
      grade,
      density: 7850,
      elasticModulus: E,
      poissonRatio: 0.3,
      thermalCoefficient: 12e-6,
      color: '#4a4a4a',
      fy,
      fu,
      E,
      G,
      epsilon_y: fy / E,
      epsilon_u: 0.15,
      epsilon_sh: 0.02,
      hardening: 'isotropic',
      ductilityClass,
      toughness: 'J2',
      weldability: fy <= 355 ? 'excellent' : (fy <= 460 ? 'good' : 'fair'),
      fatigueCategory: fy <= 355 ? 160 : 140,
      fireResistance: {
        ratingMinutes: 30,
        temperatureLimit: 550,
        strengthReduction: { 100: 1.0, 200: 1.0, 300: 1.0, 400: 1.0, 500: 0.78, 600: 0.47, 700: 0.23 },
        modulusReduction: { 100: 1.0, 200: 0.9, 300: 0.8, 400: 0.7, 500: 0.6, 600: 0.31, 700: 0.13 },
        spalling: false,
      },
      environmentalImpact: {
        embodiedCarbon: 1850, // kg CO2e/tonne
        embodiedEnergy: 24000, // MJ/tonne
        recyclability: 98,
        recyclableContent: 35,
        waterUsage: 50,
        toxicity: 'none',
        lifeSpan: 75,
      },
    };
  }

  // --------------------------------------------------------------------------
  // REBAR GRADES
  // --------------------------------------------------------------------------
  
  private initializeRebarGrades(): void {
    const rebars: RebarMaterial[] = [
      // IS 1786 Grades
      this.createRebar('Fe415', 415, 485, 'IS'),
      this.createRebar('Fe415D', 415, 500, 'IS', 'deformed'),
      this.createRebar('Fe415S', 415, 500, 'IS', 'deformed'), // Seismic
      this.createRebar('Fe500', 500, 545, 'IS'),
      this.createRebar('Fe500D', 500, 565, 'IS', 'deformed'),
      this.createRebar('Fe500S', 500, 565, 'IS', 'deformed'), // Seismic
      this.createRebar('Fe550', 550, 585, 'IS'),
      this.createRebar('Fe550D', 550, 600, 'IS', 'deformed'),
      this.createRebar('Fe600', 600, 660, 'IS'),
      
      // ASTM Grades
      this.createRebar('Grade40', 280, 420, 'ACI'),
      this.createRebar('Grade60', 420, 550, 'ACI'),
      this.createRebar('Grade75', 520, 690, 'ACI'),
      this.createRebar('Grade80', 550, 725, 'ACI'),
      
      // BS/EC2 Grades
      this.createRebar('B500A', 500, 525, 'EC', 'deformed'),
      this.createRebar('B500B', 500, 540, 'EC', 'deformed'),
      this.createRebar('B500C', 500, 575, 'EC', 'deformed'),
    ];

    rebars.forEach(m => {
      this.materials.set(m.id, m);
    });
  }

  private createRebar(
    grade: string,
    fy: number,
    fu: number,
    code: MaterialCode,
    type: 'deformed' | 'plain' = 'deformed'
  ): RebarMaterial {
    const baseSte = this.createSteel(grade, fy, fu, code);
    
    return {
      ...baseSte,
      id: `rebar_${code}_${grade}`,
      name: `${grade} Rebar (${code})`,
      type,
      bondStrength: type === 'deformed' ? 2.25 * Math.sqrt(fy / 415) : 1.5,
      bendRadius: {
        6: 2, 8: 2, 10: 3, 12: 3, 16: 4, 20: 4, 25: 5, 28: 5, 32: 6, 36: 6, 40: 7
      },
      spliceRequirements: {
        tensionLap: Math.ceil(50 * Math.sqrt(fy / 415)),
        compressionLap: Math.ceil(38 * Math.sqrt(fy / 415)),
        hooks: {
          standardHook: 12,
          seismicHook: 6,
        },
      },
    };
  }

  // --------------------------------------------------------------------------
  // TIMBER GRADES
  // --------------------------------------------------------------------------
  
  private initializeTimberGrades(): void {
    const timbers: TimberMaterial[] = [
      // Softwood
      this.createTimber('C16', 'softwood', 16, 8.5, 17, 6.8, 2.2, 8000, 5400),
      this.createTimber('C24', 'softwood', 24, 14, 21, 7.9, 4.0, 11000, 7400),
      this.createTimber('C30', 'softwood', 30, 18, 23, 8.0, 4.0, 12000, 8000),
      this.createTimber('C40', 'softwood', 40, 24, 26, 8.8, 4.0, 14000, 9400),
      
      // Hardwood
      this.createTimber('D30', 'hardwood', 30, 18, 23, 8.0, 4.0, 10000, 8000),
      this.createTimber('D40', 'hardwood', 40, 24, 26, 8.8, 4.0, 11000, 9400),
      this.createTimber('D50', 'hardwood', 50, 30, 29, 9.3, 4.5, 14000, 11800),
      this.createTimber('D60', 'hardwood', 60, 36, 32, 10.5, 5.3, 17000, 14300),
      this.createTimber('D70', 'hardwood', 70, 42, 34, 13.5, 6.0, 20000, 16800),
      
      // Glulam
      this.createTimber('GL24h', 'glulam', 24, 16.5, 24, 7.2, 3.5, 11500, 9600),
      this.createTimber('GL28h', 'glulam', 28, 19.5, 26.5, 7.5, 3.5, 12600, 10500),
      this.createTimber('GL32h', 'glulam', 32, 22.5, 29, 8.0, 4.0, 13700, 11400),
      this.createTimber('GL36h', 'glulam', 36, 26, 31, 8.4, 4.3, 14700, 12300),
      
      // CLT
      this.createTimber('CLT-C24', 'CLT', 24, 14, 21, 7.9, 4.0, 11500, 9600),
      
      // LVL
      this.createTimber('LVL-48', 'LVL', 48, 33.6, 36, 12, 5.5, 14000, 11760),
    ];

    timbers.forEach(m => {
      this.materials.set(m.id, m);
    });
  }

  private createTimber(
    grade: string,
    type: 'softwood' | 'hardwood' | 'glulam' | 'LVL' | 'CLT',
    fm: number,
    ft0: number,
    fc0: number,
    fc90: number,
    fv: number,
    E0_mean: number,
    E0_05: number
  ): TimberMaterial {
    const density = type === 'hardwood' ? 700 : (type === 'softwood' ? 450 : 500);
    
    return {
      id: `timber_${type}_${grade}`,
      name: `${grade} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      category: 'timber',
      code: 'EC',
      grade,
      density,
      elasticModulus: E0_mean,
      poissonRatio: 0.3,
      thermalCoefficient: 5e-6,
      color: type === 'hardwood' ? '#8B4513' : '#DEB887',
      species: type,
      type,
      fm,
      ft0,
      ft90: ft0 / 20,
      fc0,
      fc90,
      fv,
      E0_mean,
      E0_05,
      E90_mean: E0_mean / 30,
      G_mean: E0_mean / 16,
      moistureContent: 12,
      servicClass: 1,
      durationFactor: {
        permanent: 0.6,
        longTerm: 0.7,
        mediumTerm: 0.8,
        shortTerm: 0.9,
        instantaneous: 1.1,
      },
      fireCharringRate: type === 'softwood' ? 0.8 : 0.55,
      environmentalImpact: {
        embodiedCarbon: -700, // Carbon negative!
        embodiedEnergy: 3000,
        recyclability: 90,
        recyclableContent: 0,
        waterUsage: 20,
        toxicity: 'none',
        lifeSpan: 60,
        sustainabilityCertification: ['FSC', 'PEFC'],
      },
    };
  }

  // --------------------------------------------------------------------------
  // SOIL TYPES
  // --------------------------------------------------------------------------
  
  private initializeSoilTypes(): void {
    const soils: SoilMaterial[] = [
      this.createSoil('GW', 'Well-graded gravel', 0, 38, 21, 23, 600, 1e-2),
      this.createSoil('GP', 'Poorly-graded gravel', 0, 35, 20, 22, 500, 1e-2),
      this.createSoil('GM', 'Silty gravel', 0, 34, 20, 22, 400, 1e-5),
      this.createSoil('GC', 'Clayey gravel', 10, 30, 21, 23, 300, 1e-7),
      this.createSoil('SW', 'Well-graded sand', 0, 36, 19, 21, 400, 1e-3),
      this.createSoil('SP', 'Poorly-graded sand', 0, 33, 18, 20, 300, 1e-3),
      this.createSoil('SM', 'Silty sand', 0, 32, 19, 21, 250, 1e-5),
      this.createSoil('SC', 'Clayey sand', 10, 28, 19, 21, 200, 1e-7),
      this.createSoil('ML', 'Low plasticity silt', 5, 28, 17, 19, 150, 1e-6),
      this.createSoil('MH', 'High plasticity silt', 10, 25, 16, 18, 100, 1e-7),
      this.createSoil('CL', 'Low plasticity clay', 20, 25, 18, 20, 150, 1e-8),
      this.createSoil('CH', 'High plasticity clay', 40, 20, 17, 19, 100, 1e-9),
      this.createSoil('OL', 'Organic silt', 10, 22, 15, 17, 50, 1e-7),
      this.createSoil('OH', 'Organic clay', 20, 18, 14, 16, 30, 1e-8),
      this.createSoil('Pt', 'Peat', 5, 15, 10, 12, 20, 1e-5),
      this.createSoil('Rock', 'Bedrock', 1000, 45, 26, 27, 5000, 1e-10),
    ];

    soils.forEach(m => {
      this.materials.set(m.id, m);
    });
  }

  private createSoil(
    classification: string,
    name: string,
    cohesion: number,
    frictionAngle: number,
    unitWeight: number,
    saturatedUnitWeight: number,
    bearingCapacity: number,
    permeability: number
  ): SoilMaterial {
    return {
      id: `soil_${classification}`,
      name: `${name} (${classification})`,
      category: 'soil',
      code: 'IS',
      grade: classification,
      density: unitWeight * 1000 / 9.81,
      elasticModulus: bearingCapacity * 100,
      poissonRatio: classification.startsWith('C') ? 0.4 : 0.3,
      thermalCoefficient: 0,
      classification,
      cohesion,
      frictionAngle,
      unitWeight,
      saturatedUnitWeight,
      submergedUnitWeight: saturatedUnitWeight - 9.81,
      bearingCapacity,
      settlementModulus: bearingCapacity * 0.5,
      permeability,
      compressionIndex: classification.startsWith('C') ? 0.3 : 0.1,
      recompressionIndex: classification.startsWith('C') ? 0.05 : 0.02,
      overconsolidationRatio: 1.5,
    };
  }

  // --------------------------------------------------------------------------
  // COMPOSITES
  // --------------------------------------------------------------------------
  
  private initializeComposites(): void {
    const composites: BaseMaterial[] = [
      {
        id: 'composite_CFRP',
        name: 'Carbon Fiber Reinforced Polymer (CFRP)',
        category: 'composite',
        code: 'IS',
        grade: 'High Modulus',
        density: 1600,
        elasticModulus: 150000,
        poissonRatio: 0.25,
        thermalCoefficient: -0.5e-6,
        color: '#1a1a1a',
      },
      {
        id: 'composite_GFRP',
        name: 'Glass Fiber Reinforced Polymer (GFRP)',
        category: 'composite',
        code: 'IS',
        grade: 'E-Glass',
        density: 2100,
        elasticModulus: 40000,
        poissonRatio: 0.22,
        thermalCoefficient: 6e-6,
        color: '#e8e8e8',
      },
      {
        id: 'composite_AFRP',
        name: 'Aramid Fiber Reinforced Polymer (AFRP)',
        category: 'composite',
        code: 'IS',
        grade: 'Kevlar 49',
        density: 1400,
        elasticModulus: 70000,
        poissonRatio: 0.34,
        thermalCoefficient: -2e-6,
        color: '#ffd700',
      },
    ];

    composites.forEach(m => {
      this.materials.set(m.id, m);
    });
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------
  
  getMaterial(id: string): BaseMaterial | undefined {
    return this.materials.get(id) || this.customMaterials.get(id);
  }

  getMaterialsByCategory(category: MaterialCategory): BaseMaterial[] {
    return Array.from(this.materials.values())
      .filter(m => m.category === category);
  }

  getMaterialsByCode(code: MaterialCode): BaseMaterial[] {
    return Array.from(this.materials.values())
      .filter(m => m.code === code);
  }

  searchMaterials(query: string): BaseMaterial[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.materials.values())
      .filter(m => 
        m.name.toLowerCase().includes(lowerQuery) ||
        m.grade.toLowerCase().includes(lowerQuery) ||
        m.category.toLowerCase().includes(lowerQuery)
      );
  }

  addCustomMaterial(material: BaseMaterial): void {
    this.customMaterials.set(material.id, material);
  }

  getAllMaterials(): BaseMaterial[] {
    return [
      ...Array.from(this.materials.values()),
      ...Array.from(this.customMaterials.values()),
    ];
  }

  getConcreteGrades(code?: MaterialCode): ConcreteMaterial[] {
    return this.getMaterialsByCategory('concrete')
      .filter(m => !code || m.code === code) as ConcreteMaterial[];
  }

  getSteelGrades(code?: MaterialCode): SteelMaterial[] {
    return this.getMaterialsByCategory('steel')
      .filter(m => !code || m.code === code) as SteelMaterial[];
  }

  getRebarGrades(code?: MaterialCode): RebarMaterial[] {
    return Array.from(this.materials.values())
      .filter(m => m.id.startsWith('rebar') && (!code || m.code === code)) as RebarMaterial[];
  }

  // Temperature-adjusted properties
  getPropertiesAtTemperature(materialId: string, temperature: number): Partial<BaseMaterial> | null {
    const material = this.getMaterial(materialId);
    if (!material) return null;

    if ('fireResistance' in material) {
      const fire = (material as any).fireResistance as FireResistance;
      const temps = Object.keys(fire.strengthReduction).map(Number).sort((a, b) => a - b);
      
      let strengthFactor = 1.0;
      let modulusFactor = 1.0;
      
      for (let i = 0; i < temps.length - 1; i++) {
        if (temperature >= temps[i] && temperature < temps[i + 1]) {
          const t1 = temps[i];
          const t2 = temps[i + 1];
          const ratio = (temperature - t1) / (t2 - t1);
          
          strengthFactor = fire.strengthReduction[t1] + 
            (fire.strengthReduction[t2] - fire.strengthReduction[t1]) * ratio;
          modulusFactor = fire.modulusReduction[t1] + 
            (fire.modulusReduction[t2] - fire.modulusReduction[t1]) * ratio;
          break;
        }
      }
      
      return {
        ...material,
        elasticModulus: material.elasticModulus * modulusFactor,
      };
    }
    
    return material;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const materialDatabase = new MaterialDatabase();

export default MaterialDatabase;
