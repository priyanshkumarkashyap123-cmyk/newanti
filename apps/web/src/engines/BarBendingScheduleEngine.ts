/**
 * Bar Bending Schedule (BBS) Engine
 * 
 * Generates IS 2502-compliant bar bending schedules for RC members.
 * Supports beams, columns, slabs, footings, and walls.
 * Calculates cutting lengths considering hooks, bends, and development lengths.
 * 
 * Standards: IS 2502:1963 (Bending of bars), IS 456:2000 (RC Design), SP 34
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type BarGrade = 'Fe250' | 'Fe415' | 'Fe500' | 'Fe550';

export type BarShape =
  | 'straight'
  | 'standard_hook'       // 180° hook (IS 2502)
  | 'standard_bend'       // 90° bend (IS 2502)
  | 'crank'               // cranked bar
  | 'L_shape'             // simple L
  | 'U_shape'             // U-bar / stirrup
  | 'closed_stirrup'      // rectangular closed loop
  | 'spiral'              // circular spiral
  | 'hairpin'             // hairpin tie
  | 'helical'             // helical reinforcement
  | 'Z_shape'             // Z-bar
  | 'chair'               // supporting chair bar
  | 'ring';               // ring bar for circular sections

export type MemberType = 'beam' | 'column' | 'slab' | 'footing' | 'wall' | 'staircase' | 'retaining_wall';

export interface BarDiameter {
  /** Nominal diameter in mm */
  dia: number;
  /** Cross-sectional area in mm² */
  area: number;
  /** Perimeter in mm */
  perimeter: number;
  /** Unit weight in kg/m */
  unitWeight: number;
}

/** Standard bar sizes per IS 1786 */
export const STANDARD_BARS: BarDiameter[] = [
  { dia: 6,  area: 28.27,   perimeter: 18.85,  unitWeight: 0.222 },
  { dia: 8,  area: 50.27,   perimeter: 25.13,  unitWeight: 0.395 },
  { dia: 10, area: 78.54,   perimeter: 31.42,  unitWeight: 0.617 },
  { dia: 12, area: 113.10,  perimeter: 37.70,  unitWeight: 0.888 },
  { dia: 16, area: 201.06,  perimeter: 50.27,  unitWeight: 1.580 },
  { dia: 20, area: 314.16,  perimeter: 62.83,  unitWeight: 2.469 },
  { dia: 25, area: 490.87,  perimeter: 78.54,  unitWeight: 3.854 },
  { dia: 28, area: 615.75,  perimeter: 87.96,  unitWeight: 4.834 },
  { dia: 32, area: 804.25,  perimeter: 100.53, unitWeight: 6.313 },
  { dia: 36, area: 1017.88, perimeter: 113.10, unitWeight: 7.990 },
  { dia: 40, area: 1256.64, perimeter: 125.66, unitWeight: 9.865 },
];

export interface BBSEntry {
  /** Bar mark / reference number */
  barMark: string;
  /** Member reference (e.g., "B1", "C2", "S1") */
  memberRef: string;
  /** Member type */
  memberType: MemberType;
  /** Bar shape code (IS 2502) */
  shape: BarShape;
  /** Bar diameter (mm) */
  dia: number;
  /** Number of bars per member */
  noPerMember: number;
  /** Number of members */
  noOfMembers: number;
  /** Total number of bars */
  totalBars: number;
  /** Cutting length per bar (mm) */
  cuttingLength: number;
  /** Total length of this bar type (m) */
  totalLength: number;
  /** Total weight of bars (kg) */
  totalWeight: number;
  /** Unit weight (kg/m) */
  unitWeight: number;
  /** Shape dimensions for drawing */
  dimensions: Record<string, number>;
  /** Remarks (e.g., "Bottom main bar", "Top bar at support") */
  remarks: string;
}

export interface BBSSchedule {
  /** Project name */
  projectName: string;
  /** Drawing reference */
  drawingRef: string;
  /** Prepared by */
  preparedBy: string;
  /** Date */
  date: string;
  /** Design code */
  code: 'IS 456' | 'IS 13920' | 'ACI 318' | 'BS 8110';
  /** Bar grade */
  barGrade: BarGrade;
  /** Concrete cover (mm) */
  cover: number;
  /** Schedule entries */
  entries: BBSEntry[];
  /** Summary by bar diameter */
  summary: BBSSummary[];
  /** Grand total weight (kg) */
  totalWeight: number;
  /** Wastage factor (%) */
  wastageFactor: number;
  /** Total weight with wastage (kg) */
  totalWeightWithWastage: number;
}

export interface BBSSummary {
  dia: number;
  totalLength: number;  // meters
  totalWeight: number;  // kg
  unitWeight: number;   // kg/m
}

// ─────────────────────────────────────────────────────────────────────────────
// Bend Deduction & Hook Allowances (IS 2502)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bend deductions per IS 2502:1963
 * For a 45° bend: 1d, for 90° bend: 2d, for 135° bend: 3d
 * where d = bar diameter
 */
export function getBendDeduction(angleDeg: number, dia: number): number {
  if (angleDeg <= 45) return 1 * dia;
  if (angleDeg <= 90) return 2 * dia;
  if (angleDeg <= 135) return 3 * dia;
  return 4 * dia; // 180° 
}

/**
 * Standard hook allowance (180° hook) per IS 2502
 * Hook length = 9d (for Fe250) or 4d + 75mm (minimum per IS 456)
 * Returns additional length to add for each hook
 */
export function getHookAllowance(dia: number, grade: BarGrade = 'Fe500'): number {
  if (grade === 'Fe250') {
    return 9 * dia; // For mild steel
  }
  // For HYSD bars (Fe415, Fe500, Fe550): 4d + 75mm
  return 4 * dia + 75;
}

/**
 * Standard 90° bend allowance per IS 2502
 * Additional length = 0.42 × bend radius (approx.)
 */
export function get90BendAllowance(dia: number): number {
  // Min bend radius: 4d for Fe415/500, 2d for Fe250
  // Extension beyond bend: 4d or 12d depending on bar function
  return 8 * dia; // Conservative: includes bend radius + extension
}

/**
 * Development length per IS 456 Clause 26.2.1
 * Ld = (ϕ × σs) / (4 × τbd)
 */
export function getDevelopmentLength(
  dia: number,
  grade: BarGrade = 'Fe500',
  concreteGrade: number = 25, // M25
  isCompression: boolean = false,
): number {
  // Design bond stress τbd (MPa) per IS 456 Table 26.2.1.1
  const tauBdTable: Record<number, number> = {
    15: 1.0, 20: 1.2, 25: 1.4, 30: 1.5, 35: 1.7, 40: 1.9, 45: 2.0, 50: 2.2,
  };
  let tauBd = tauBdTable[concreteGrade] || 1.4;
  
  // For HYSD bars, increase by 60%
  if (grade !== 'Fe250') {
    tauBd *= 1.6;
  }
  // For compression bars, increase by 25%
  if (isCompression) {
    tauBd *= 1.25;
  }

  // σs = 0.87 × fy
  const fyMap: Record<BarGrade, number> = {
    'Fe250': 250, 'Fe415': 415, 'Fe500': 500, 'Fe550': 550,
  };
  const fy = fyMap[grade];
  const sigma_s = 0.87 * fy;

  const Ld = (dia * sigma_s) / (4 * tauBd);
  return Math.ceil(Ld);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cutting Length Calculations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate cutting length for a straight bar with standard hooks at both ends.
 */
export function cuttingLengthStraightWithHooks(
  length: number,
  dia: number,
  grade: BarGrade = 'Fe500',
  hooksAtEnds: 0 | 1 | 2 = 0,
): number {
  const hookExtra = getHookAllowance(dia, grade);
  return length + hooksAtEnds * hookExtra;
}

/**
 * Calculate cutting length for a cranked (bent-up) bar.
 * Per IS 2502: cranked bar at 45° adds 0.42d per crank.
 */
export function cuttingLengthCrankedBar(
  span: number,
  crankHeight: number,
  dia: number,
  noCranks: 1 | 2 = 2, // cranked at both ends
  grade: BarGrade = 'Fe500',
): number {
  // Extra length per 45° crank = 0.42 × crank height (hypotenuse - horizontal)
  const extraPerCrank = 0.42 * crankHeight;
  // Bend deduction per crank (45° bend up + 45° bend back horizontal)
  const bendDed = 2 * getBendDeduction(45, dia);

  return span + noCranks * extraPerCrank - noCranks * bendDed;
}

/**
 * Calculate cutting length for a rectangular closed stirrup.
 * Perimeter = 2(A + B) - 8 × bend deduction + 2 × hook allowance + overlap
 */
export function cuttingLengthStirrup(
  width: number,       // Width of member (mm)
  depth: number,       // Depth of member (mm)
  cover: number,       // Clear cover (mm)
  dia: number,         // Stirrup diameter (mm)
  mainBarDia: number,  // Main bar diameter (mm)
  grade: BarGrade = 'Fe500',
): number {
  // Internal dimensions
  const A = width - 2 * cover + dia;
  const B = depth - 2 * cover + dia;

  // Perimeter of stirrup
  const perimeter = 2 * (A + B);
  
  // 4 corners × 90° bend deduction
  const bendDeductions = 4 * getBendDeduction(90, dia);
  
  // Two 135° hooks per IS 13920 (seismic) or one hook (regular)
  const hookAllowance = 2 * (10 * dia); // 10d hook extension per IS 13920

  return perimeter - bendDeductions + hookAllowance;
}

/**
 * Calculate cutting length for a U-bar / hairpin.
 */
export function cuttingLengthUBar(
  width: number,
  cover: number,
  dia: number,
): number {
  const internalWidth = width - 2 * cover;
  // Two legs + semicircular bend
  const bendAllowance = Math.PI * 2 * dia; // π × 2d for the U-bend
  return 2 * (internalWidth + getDevelopmentLength(dia)) + bendAllowance;
}

/**
 * Calculate cutting length for spiral reinforcement.
 */
export function cuttingLengthSpiral(
  coreDiameter: number,  // Diameter of confined core (mm)
  height: number,         // Height of spiral zone (mm)
  pitch: number,          // Pitch of spiral (mm)
  dia: number,            // Spiral bar diameter (mm)
): number {
  const nTurns = Math.ceil(height / pitch);
  const circumference = Math.PI * (coreDiameter - dia);
  const perTurnLength = Math.sqrt(circumference ** 2 + pitch ** 2);
  return nTurns * perTurnLength;
}

// ─────────────────────────────────────────────────────────────────────────────
// BBS Generator for common member types
// ─────────────────────────────────────────────────────────────────────────────

interface BeamBBSInput {
  memberRef: string;
  span: number;           // Clear span (mm)
  width: number;          // Beam width (mm)
  depth: number;          // Beam depth (mm)
  cover: number;          // Clear cover (mm)
  noOfMembers: number;

  // Bottom bars
  bottomBarDia: number;
  bottomBarCount: number;

  // Top bars (at supports)
  topBarDia: number;
  topBarCount: number;
  topBarLength?: number;  // If not given, default L/4 from each support

  // Extra bars (cranked)
  crankBarDia?: number;
  crankBarCount?: number;

  // Stirrups
  stirrupDia: number;
  stirrupSpacing: number; // Spacing at center
  stirrupSpacingEnd: number; // Spacing near supports (tighter)
  endZoneLength?: number;  // Length of end zone (default span/4)
  
  grade: BarGrade;
}

export function generateBeamBBS(input: BeamBBSInput): BBSEntry[] {
  const entries: BBSEntry[] = [];
  let markNum = 1;

  const {
    memberRef, span, width, depth, cover, noOfMembers,
    bottomBarDia, bottomBarCount, topBarDia, topBarCount,
    crankBarDia, crankBarCount, stirrupDia, stirrupSpacing,
    stirrupSpacingEnd, endZoneLength, grade,
  } = input;
  const topBarLen = input.topBarLength || Math.ceil(span / 4);
  const endZone = endZoneLength || Math.ceil(span / 4);

  // --- Bottom main bars (straight with hooks) ---
  const bottomCutLen = cuttingLengthStraightWithHooks(
    span + 2 * getDevelopmentLength(bottomBarDia, grade),
    bottomBarDia,
    grade,
    0,
  );
  const bottomBarInfo = STANDARD_BARS.find(b => b.dia === bottomBarDia)!;
  entries.push({
    barMark: `${memberRef}-${markNum++}`,
    memberRef,
    memberType: 'beam',
    shape: 'straight',
    dia: bottomBarDia,
    noPerMember: bottomBarCount,
    noOfMembers,
    totalBars: bottomBarCount * noOfMembers,
    cuttingLength: Math.ceil(bottomCutLen),
    totalLength: (bottomCutLen * bottomBarCount * noOfMembers) / 1000,
    totalWeight: (bottomCutLen * bottomBarCount * noOfMembers * bottomBarInfo.unitWeight) / 1000,
    unitWeight: bottomBarInfo.unitWeight,
    dimensions: { L: span, Ld: getDevelopmentLength(bottomBarDia, grade) },
    remarks: 'Bottom main bar (throughout)',
  });

  // --- Top bars at supports ---
  const topCutLen = topBarLen + getDevelopmentLength(topBarDia, grade);
  const topBarInfo = STANDARD_BARS.find(b => b.dia === topBarDia)!;
  entries.push({
    barMark: `${memberRef}-${markNum++}`,
    memberRef,
    memberType: 'beam',
    shape: 'straight',
    dia: topBarDia,
    noPerMember: topBarCount * 2, // Both supports
    noOfMembers,
    totalBars: topBarCount * 2 * noOfMembers,
    cuttingLength: Math.ceil(topCutLen),
    totalLength: (topCutLen * topBarCount * 2 * noOfMembers) / 1000,
    totalWeight: (topCutLen * topBarCount * 2 * noOfMembers * topBarInfo.unitWeight) / 1000,
    unitWeight: topBarInfo.unitWeight,
    dimensions: { a: topBarLen, Ld: getDevelopmentLength(topBarDia, grade) },
    remarks: 'Top bar at support (extra)',
  });

  // --- Cranked bars (if specified) ---
  if (crankBarDia && crankBarCount) {
    const crankHeight = depth - 2 * cover - bottomBarDia;
    const crankCutLen = cuttingLengthCrankedBar(span, crankHeight, crankBarDia, 2, grade);
    const crankInfo = STANDARD_BARS.find(b => b.dia === crankBarDia)!;
    entries.push({
      barMark: `${memberRef}-${markNum++}`,
      memberRef,
      memberType: 'beam',
      shape: 'crank',
      dia: crankBarDia,
      noPerMember: crankBarCount,
      noOfMembers,
      totalBars: crankBarCount * noOfMembers,
      cuttingLength: Math.ceil(crankCutLen),
      totalLength: (crankCutLen * crankBarCount * noOfMembers) / 1000,
      totalWeight: (crankCutLen * crankBarCount * noOfMembers * crankInfo.unitWeight) / 1000,
      unitWeight: crankInfo.unitWeight,
      dimensions: { L: span, h: crankHeight },
      remarks: 'Cranked bar (bent-up at 45°)',
    });
  }

  // --- Stirrups ---
  const stirrupCutLen = cuttingLengthStirrup(width, depth, cover, stirrupDia, bottomBarDia, grade);
  const stirrupInfo = STANDARD_BARS.find(b => b.dia === stirrupDia)!;

  // Stirrups in end zone
  const endStirrupCount = Math.ceil(endZone / stirrupSpacingEnd);
  entries.push({
    barMark: `${memberRef}-${markNum++}`,
    memberRef,
    memberType: 'beam',
    shape: 'closed_stirrup',
    dia: stirrupDia,
    noPerMember: endStirrupCount * 2, // both ends
    noOfMembers,
    totalBars: endStirrupCount * 2 * noOfMembers,
    cuttingLength: Math.ceil(stirrupCutLen),
    totalLength: (stirrupCutLen * endStirrupCount * 2 * noOfMembers) / 1000,
    totalWeight: (stirrupCutLen * endStirrupCount * 2 * noOfMembers * stirrupInfo.unitWeight) / 1000,
    unitWeight: stirrupInfo.unitWeight,
    dimensions: { a: width - 2 * cover, b: depth - 2 * cover },
    remarks: `Stirrup end zone @ ${stirrupSpacingEnd}mm c/c`,
  });

  // Stirrups in mid zone
  const midZoneLen = span - 2 * endZone;
  const midStirrupCount = Math.ceil(midZoneLen / stirrupSpacing);
  entries.push({
    barMark: `${memberRef}-${markNum++}`,
    memberRef,
    memberType: 'beam',
    shape: 'closed_stirrup',
    dia: stirrupDia,
    noPerMember: midStirrupCount,
    noOfMembers,
    totalBars: midStirrupCount * noOfMembers,
    cuttingLength: Math.ceil(stirrupCutLen),
    totalLength: (stirrupCutLen * midStirrupCount * noOfMembers) / 1000,
    totalWeight: (stirrupCutLen * midStirrupCount * noOfMembers * stirrupInfo.unitWeight) / 1000,
    unitWeight: stirrupInfo.unitWeight,
    dimensions: { a: width - 2 * cover, b: depth - 2 * cover },
    remarks: `Stirrup mid zone @ ${stirrupSpacing}mm c/c`,
  });

  return entries;
}

interface ColumnBBSInput {
  memberRef: string;
  height: number;          // Column clear height (mm)
  width: number;           // Column width (mm)
  depth: number;           // Column depth (mm)
  cover: number;           // Clear cover (mm)
  noOfMembers: number;

  // Main bars
  mainBarDia: number;
  mainBarCount: number;

  // Ties
  tieDia: number;
  tieSpacing: number;

  // Overlap
  lapLength?: number;

  grade: BarGrade;
}

export function generateColumnBBS(input: ColumnBBSInput): BBSEntry[] {
  const entries: BBSEntry[] = [];
  let markNum = 1;

  const {
    memberRef, height, width, depth, cover, noOfMembers,
    mainBarDia, mainBarCount, tieDia, tieSpacing, grade,
  } = input;
  const lapLen = input.lapLength || getDevelopmentLength(mainBarDia, grade);

  // --- Main bars with lap splice ---
  const mainCutLen = height + lapLen + 2 * getDevelopmentLength(mainBarDia, grade);
  const mainInfo = STANDARD_BARS.find(b => b.dia === mainBarDia)!;
  entries.push({
    barMark: `${memberRef}-${markNum++}`,
    memberRef,
    memberType: 'column',
    shape: 'straight',
    dia: mainBarDia,
    noPerMember: mainBarCount,
    noOfMembers,
    totalBars: mainBarCount * noOfMembers,
    cuttingLength: Math.ceil(mainCutLen),
    totalLength: (mainCutLen * mainBarCount * noOfMembers) / 1000,
    totalWeight: (mainCutLen * mainBarCount * noOfMembers * mainInfo.unitWeight) / 1000,
    unitWeight: mainInfo.unitWeight,
    dimensions: { L: height, Lap: lapLen, Ld: getDevelopmentLength(mainBarDia, grade) },
    remarks: 'Main vertical bar with lap splice',
  });

  // --- Lateral ties ---
  const tieCutLen = cuttingLengthStirrup(width, depth, cover, tieDia, mainBarDia, grade);
  const tieInfo = STANDARD_BARS.find(b => b.dia === tieDia)!;
  const noTies = Math.ceil(height / tieSpacing) + 1;
  entries.push({
    barMark: `${memberRef}-${markNum++}`,
    memberRef,
    memberType: 'column',
    shape: 'closed_stirrup',
    dia: tieDia,
    noPerMember: noTies,
    noOfMembers,
    totalBars: noTies * noOfMembers,
    cuttingLength: Math.ceil(tieCutLen),
    totalLength: (tieCutLen * noTies * noOfMembers) / 1000,
    totalWeight: (tieCutLen * noTies * noOfMembers * tieInfo.unitWeight) / 1000,
    unitWeight: tieInfo.unitWeight,
    dimensions: { a: width - 2 * cover, b: depth - 2 * cover },
    remarks: `Lateral tie @ ${tieSpacing}mm c/c`,
  });

  return entries;
}

interface SlabBBSInput {
  memberRef: string;
  spanX: number;         // Span in X direction (mm)
  spanY: number;         // Span in Y direction (mm)
  thickness: number;     // Slab thickness (mm)
  cover: number;
  noOfMembers: number;

  // Main bars (shorter span)
  mainBarDia: number;
  mainBarSpacing: number;

  // Distribution bars (longer span)
  distBarDia: number;
  distBarSpacing: number;

  // Extra top bars at supports
  extraTopDia?: number;
  extraTopSpacing?: number;
  extraTopLength?: number;

  grade: BarGrade;
}

export function generateSlabBBS(input: SlabBBSInput): BBSEntry[] {
  const entries: BBSEntry[] = [];
  let markNum = 1;

  const {
    memberRef, spanX, spanY, thickness, cover, noOfMembers,
    mainBarDia, mainBarSpacing, distBarDia, distBarSpacing,
    extraTopDia, extraTopSpacing, extraTopLength, grade,
  } = input;

  // Determine shorter span
  const shortSpan = Math.min(spanX, spanY);
  const longSpan = Math.max(spanX, spanY);

  // --- Main bars (shorter span direction) ---
  const mainBarLen = shortSpan + 2 * getDevelopmentLength(mainBarDia, grade);
  const mainBarCount = Math.ceil(longSpan / mainBarSpacing) + 1;
  const mainInfo = STANDARD_BARS.find(b => b.dia === mainBarDia)!;
  entries.push({
    barMark: `${memberRef}-${markNum++}`,
    memberRef,
    memberType: 'slab',
    shape: 'straight',
    dia: mainBarDia,
    noPerMember: mainBarCount,
    noOfMembers,
    totalBars: mainBarCount * noOfMembers,
    cuttingLength: Math.ceil(mainBarLen),
    totalLength: (mainBarLen * mainBarCount * noOfMembers) / 1000,
    totalWeight: (mainBarLen * mainBarCount * noOfMembers * mainInfo.unitWeight) / 1000,
    unitWeight: mainInfo.unitWeight,
    dimensions: { L: shortSpan, Ld: getDevelopmentLength(mainBarDia, grade) },
    remarks: `Main bar (short span) @ ${mainBarSpacing}mm c/c`,
  });

  // --- Distribution bars (longer span direction) ---
  const distBarLen = longSpan + 2 * getDevelopmentLength(distBarDia, grade);
  const distBarCount = Math.ceil(shortSpan / distBarSpacing) + 1;
  const distInfo = STANDARD_BARS.find(b => b.dia === distBarDia)!;
  entries.push({
    barMark: `${memberRef}-${markNum++}`,
    memberRef,
    memberType: 'slab',
    shape: 'straight',
    dia: distBarDia,
    noPerMember: distBarCount,
    noOfMembers,
    totalBars: distBarCount * noOfMembers,
    cuttingLength: Math.ceil(distBarLen),
    totalLength: (distBarLen * distBarCount * noOfMembers) / 1000,
    totalWeight: (distBarLen * distBarCount * noOfMembers * distInfo.unitWeight) / 1000,
    unitWeight: distInfo.unitWeight,
    dimensions: { L: longSpan, Ld: getDevelopmentLength(distBarDia, grade) },
    remarks: `Distribution bar (long span) @ ${distBarSpacing}mm c/c`,
  });

  // --- Extra top bars at supports (if specified) ---
  if (extraTopDia && extraTopSpacing) {
    const etLen = extraTopLength || Math.ceil(shortSpan / 4);
    const etCount = Math.ceil(longSpan / extraTopSpacing) + 1;
    const etInfo = STANDARD_BARS.find(b => b.dia === extraTopDia)!;
    entries.push({
      barMark: `${memberRef}-${markNum++}`,
      memberRef,
      memberType: 'slab',
      shape: 'L_shape',
      dia: extraTopDia,
      noPerMember: etCount * 2, // Both supports
      noOfMembers,
      totalBars: etCount * 2 * noOfMembers,
      cuttingLength: Math.ceil(etLen + getDevelopmentLength(extraTopDia, grade)),
      totalLength: ((etLen + getDevelopmentLength(extraTopDia, grade)) * etCount * 2 * noOfMembers) / 1000,
      totalWeight: ((etLen + getDevelopmentLength(extraTopDia, grade)) * etCount * 2 * noOfMembers * etInfo.unitWeight) / 1000,
      unitWeight: etInfo.unitWeight,
      dimensions: { a: etLen, Ld: getDevelopmentLength(extraTopDia, grade) },
      remarks: `Top extra bar at support @ ${extraTopSpacing}mm c/c`,
    });
  }

  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// BBS Schedule Compilation
// ─────────────────────────────────────────────────────────────────────────────

export function compileBBS(
  entries: BBSEntry[],
  options: {
    projectName: string;
    drawingRef: string;
    preparedBy: string;
    barGrade: BarGrade;
    cover: number;
    wastageFactor: number; // e.g., 3 for 3%
    code: BBSSchedule['code'];
  },
): BBSSchedule {
  // Summary by diameter
  const summaryMap = new Map<number, { totalLength: number; totalWeight: number; unitWeight: number }>();
  
  let grandTotalWeight = 0;

  for (const entry of entries) {
    grandTotalWeight += entry.totalWeight;
    const existing = summaryMap.get(entry.dia) || { totalLength: 0, totalWeight: 0, unitWeight: entry.unitWeight };
    existing.totalLength += entry.totalLength;
    existing.totalWeight += entry.totalWeight;
    summaryMap.set(entry.dia, existing);
  }

  const summary: BBSSummary[] = Array.from(summaryMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([dia, data]) => ({
      dia,
      totalLength: Math.round(data.totalLength * 100) / 100,
      totalWeight: Math.round(data.totalWeight * 100) / 100,
      unitWeight: data.unitWeight,
    }));

  const totalWeightWithWastage = grandTotalWeight * (1 + options.wastageFactor / 100);

  return {
    projectName: options.projectName,
    drawingRef: options.drawingRef,
    preparedBy: options.preparedBy,
    date: new Date().toISOString().split('T')[0],
    code: options.code,
    barGrade: options.barGrade,
    cover: options.cover,
    entries,
    summary,
    totalWeight: Math.round(grandTotalWeight * 100) / 100,
    wastageFactor: options.wastageFactor,
    totalWeightWithWastage: Math.round(totalWeightWithWastage * 100) / 100,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BBS Export to CSV / Table format
// ─────────────────────────────────────────────────────────────────────────────

export function bbsToCSV(schedule: BBSSchedule): string {
  const lines: string[] = [];

  // Header
  lines.push(`BAR BENDING SCHEDULE`);
  lines.push(`Project:,${schedule.projectName}`);
  lines.push(`Drawing Ref:,${schedule.drawingRef}`);
  lines.push(`Prepared By:,${schedule.preparedBy}`);
  lines.push(`Date:,${schedule.date}`);
  lines.push(`Code:,${schedule.code}`);
  lines.push(`Bar Grade:,${schedule.barGrade}`);
  lines.push(`Cover:,${schedule.cover}mm`);
  lines.push('');

  // Table header
  lines.push('Bar Mark,Member,Type,Shape,Dia (mm),No./Member,Members,Total Bars,Cutting Length (mm),Total Length (m),Unit Wt (kg/m),Total Wt (kg),Remarks');

  // Entries
  for (const e of schedule.entries) {
    lines.push([
      e.barMark,
      e.memberRef,
      e.memberType,
      e.shape,
      e.dia,
      e.noPerMember,
      e.noOfMembers,
      e.totalBars,
      e.cuttingLength,
      e.totalLength.toFixed(2),
      e.unitWeight.toFixed(3),
      e.totalWeight.toFixed(2),
      e.remarks,
    ].join(','));
  }

  lines.push('');
  lines.push('SUMMARY BY DIAMETER');
  lines.push('Dia (mm),Total Length (m),Unit Wt (kg/m),Total Weight (kg)');
  for (const s of schedule.summary) {
    lines.push(`${s.dia},${s.totalLength.toFixed(2)},${s.unitWeight.toFixed(3)},${s.totalWeight.toFixed(2)}`);
  }

  lines.push('');
  lines.push(`Total Steel Weight:,${schedule.totalWeight.toFixed(2)} kg`);
  lines.push(`Wastage (${schedule.wastageFactor}%):,${(schedule.totalWeightWithWastage - schedule.totalWeight).toFixed(2)} kg`);
  lines.push(`Total with Wastage:,${schedule.totalWeightWithWastage.toFixed(2)} kg`);

  return lines.join('\n');
}

/**
 * Generate a formatted BBS table as an array of row objects for UI rendering.
 */
export function bbsToTableRows(schedule: BBSSchedule): Record<string, string | number>[] {
  return schedule.entries.map(e => ({
    'Bar Mark': e.barMark,
    'Member': e.memberRef,
    'Type': e.memberType,
    'Shape': e.shape,
    'Dia (mm)': e.dia,
    'No./Member': e.noPerMember,
    'Members': e.noOfMembers,
    'Total Bars': e.totalBars,
    'Cutting Length (mm)': e.cuttingLength,
    'Total Length (m)': Number(e.totalLength.toFixed(2)),
    'Unit Wt (kg/m)': Number(e.unitWeight.toFixed(3)),
    'Total Wt (kg)': Number(e.totalWeight.toFixed(2)),
    'Remarks': e.remarks,
  }));
}

export default {
  STANDARD_BARS,
  getDevelopmentLength,
  getHookAllowance,
  getBendDeduction,
  cuttingLengthStraightWithHooks,
  cuttingLengthCrankedBar,
  cuttingLengthStirrup,
  cuttingLengthUBar,
  cuttingLengthSpiral,
  generateBeamBBS,
  generateColumnBBS,
  generateSlabBBS,
  compileBBS,
  bbsToCSV,
  bbsToTableRows,
};
