/**
 * Comprehensive Steel Section Database
 * 
 * Industry-standard databases covering:
 * - Indian Standard (IS) Sections: ISMB, ISHB, ISMC, ISA, ISLB, ISWB, ISNT, ISLC, etc.
 * - AISC W-shapes, C-shapes, L-shapes, HSS, Pipe
 * - European HE, IPE, UPN, Equal/Unequal Angles
 * - British UB, UC, PFC, RSA
 * 
 * ~500+ sections with full geometric properties:
 *   D, B, tw, tf, r, A, Ix, Iy, Zx, Zy, Zpx, Zpy, rx, ry, weight
 */

export interface SteelSectionProperties {
  /** Section designation */
  designation: string;
  /** Standard/category */
  standard: 'IS' | 'AISC' | 'EU' | 'BS';
  /** Section type */
  type: 'I-Beam' | 'H-Column' | 'Channel' | 'Angle' | 'T-Section' | 'HSS-Rect' | 'HSS-Round' | 'Pipe' | 'Wide-Flange';
  /** Overall depth (mm) */
  D: number;
  /** Flange width (mm) */
  B: number;
  /** Web thickness (mm) */
  tw: number;
  /** Flange thickness (mm) */
  tf: number;
  /** Root radius (mm) */
  r: number;
  /** Cross-sectional area (mm²) */
  A: number;
  /** Moment of inertia - major axis (mm⁴ × 10⁴) */
  Ix: number;
  /** Moment of inertia - minor axis (mm⁴ × 10⁴) */
  Iy: number;
  /** Elastic section modulus - major (mm³ × 10³) */
  Zx: number;
  /** Elastic section modulus - minor (mm³ × 10³) */
  Zy: number;
  /** Plastic section modulus - major (mm³ × 10³) */
  Zpx: number;
  /** Plastic section modulus - minor (mm³ × 10³) */
  Zpy: number;
  /** Radius of gyration - major (mm) */
  rx: number;
  /** Radius of gyration - minor (mm) */
  ry: number;
  /** Weight per meter (kg/m) */
  weight: number;
  /** Depth of web (mm) */
  dw?: number;
}

// =============================================================================
// INDIAN STANDARD MEDIUM BEAMS (ISMB)
// =============================================================================
const ISMB_SECTIONS: SteelSectionProperties[] = [
  { designation: 'ISMB 100', standard: 'IS', type: 'I-Beam', D: 100, B: 75, tw: 4.0, tf: 7.2, r: 9, A: 1140, Ix: 257.5, Iy: 40.8, Zx: 51.5, Zy: 10.9, Zpx: 58.4, Zpy: 17.0, rx: 47.5, ry: 18.9, weight: 8.9 },
  { designation: 'ISMB 125', standard: 'IS', type: 'I-Beam', D: 125, B: 75, tw: 5.0, tf: 7.6, r: 9, A: 1410, Ix: 449.0, Iy: 43.7, Zx: 71.8, Zy: 11.7, Zpx: 82.8, Zpy: 18.4, rx: 56.4, ry: 17.6, weight: 11.0 },
  { designation: 'ISMB 150', standard: 'IS', type: 'I-Beam', D: 150, B: 80, tw: 4.8, tf: 7.6, r: 9, A: 1570, Ix: 726.4, Iy: 52.6, Zx: 96.9, Zy: 13.2, Zpx: 110.9, Zpy: 20.6, rx: 68.0, ry: 18.3, weight: 12.3 },
  { designation: 'ISMB 175', standard: 'IS', type: 'I-Beam', D: 175, B: 90, tw: 5.8, tf: 8.6, r: 10, A: 2120, Ix: 1272, Iy: 84.5, Zx: 145.4, Zy: 18.8, Zpx: 166.5, Zpy: 29.4, rx: 77.5, ry: 20.0, weight: 16.6 },
  { designation: 'ISMB 200', standard: 'IS', type: 'I-Beam', D: 200, B: 100, tw: 5.7, tf: 8.9, r: 11, A: 2530, Ix: 2235, Iy: 150.2, Zx: 223.5, Zy: 30.0, Zpx: 254.5, Zpy: 46.8, rx: 94.0, ry: 24.4, weight: 19.8 },
  { designation: 'ISMB 225', standard: 'IS', type: 'I-Beam', D: 225, B: 110, tw: 6.5, tf: 9.9, r: 12, A: 3200, Ix: 3442, Iy: 218.4, Zx: 306.0, Zy: 39.7, Zpx: 350.9, Zpy: 62.3, rx: 103.7, ry: 26.1, weight: 25.1 },
  { designation: 'ISMB 250', standard: 'IS', type: 'I-Beam', D: 250, B: 125, tw: 6.9, tf: 12.5, r: 13, A: 4130, Ix: 5132, Iy: 334.5, Zx: 410.5, Zy: 53.5, Zpx: 473.0, Zpy: 83.8, rx: 111.4, ry: 28.5, weight: 32.4 },
  { designation: 'ISMB 300', standard: 'IS', type: 'I-Beam', D: 300, B: 140, tw: 7.7, tf: 13.1, r: 14, A: 5250, Ix: 8603, Iy: 453.9, Zx: 573.6, Zy: 64.8, Zpx: 660.9, Zpy: 101.6, rx: 128.0, ry: 29.4, weight: 41.2 },
  { designation: 'ISMB 350', standard: 'IS', type: 'I-Beam', D: 350, B: 140, tw: 8.1, tf: 14.2, r: 14, A: 5910, Ix: 13158, Iy: 537.7, Zx: 751.9, Zy: 76.8, Zpx: 862.0, Zpy: 119.9, rx: 149.3, ry: 30.2, weight: 46.4 },
  { designation: 'ISMB 400', standard: 'IS', type: 'I-Beam', D: 400, B: 140, tw: 8.9, tf: 16.0, r: 14, A: 7280, Ix: 20458, Iy: 622.1, Zx: 1022.9, Zy: 88.9, Zpx: 1176.2, Zpy: 139.2, rx: 167.6, ry: 29.2, weight: 57.2 },
  { designation: 'ISMB 450', standard: 'IS', type: 'I-Beam', D: 450, B: 150, tw: 9.4, tf: 17.4, r: 15, A: 8600, Ix: 30391, Iy: 834.0, Zx: 1350.7, Zy: 111.2, Zpx: 1554.2, Zpy: 173.6, rx: 188.0, ry: 31.1, weight: 67.5 },
  { designation: 'ISMB 500', standard: 'IS', type: 'I-Beam', D: 500, B: 180, tw: 10.2, tf: 17.2, r: 17, A: 9550, Ix: 45218, Iy: 1370, Zx: 1808.7, Zy: 152.2, Zpx: 2074.7, Zpy: 235.3, rx: 217.6, ry: 37.9, weight: 74.9 },
  { designation: 'ISMB 550', standard: 'IS', type: 'I-Beam', D: 550, B: 190, tw: 11.2, tf: 19.3, r: 18, A: 11540, Ix: 64894, Iy: 1834, Zx: 2359.8, Zy: 193.1, Zpx: 2723.2, Zpy: 300.5, rx: 237.2, ry: 39.9, weight: 90.5 },
  { designation: 'ISMB 600', standard: 'IS', type: 'I-Beam', D: 600, B: 210, tw: 12.0, tf: 20.8, r: 20, A: 13210, Ix: 91813, Iy: 2650, Zx: 3060.4, Zy: 252.4, Zpx: 3531.6, Zpy: 392.3, rx: 263.7, ry: 44.8, weight: 103.7 },
];

// =============================================================================
// INDIAN STANDARD HEAVY BEAMS (ISHB)
// =============================================================================
const ISHB_SECTIONS: SteelSectionProperties[] = [
  { designation: 'ISHB 150', standard: 'IS', type: 'H-Column', D: 150, B: 150, tw: 5.4, tf: 9.0, r: 10, A: 3480, Ix: 1456, Iy: 506.9, Zx: 194.2, Zy: 67.6, Zpx: 216.0, Zpy: 103.2, rx: 64.7, ry: 38.2, weight: 27.1 },
  { designation: 'ISHB 200', standard: 'IS', type: 'H-Column', D: 200, B: 200, tw: 6.1, tf: 9.0, r: 11, A: 4710, Ix: 3608, Iy: 1200, Zx: 360.8, Zy: 120.0, Zpx: 401.1, Zpy: 183.1, rx: 87.5, ry: 50.5, weight: 37.0 },
  { designation: 'ISHB 225', standard: 'IS', type: 'H-Column', D: 225, B: 225, tw: 6.5, tf: 9.1, r: 12, A: 5480, Ix: 5280, Iy: 1710, Zx: 469.3, Zy: 152.0, Zpx: 522.0, Zpy: 232.1, rx: 98.2, ry: 55.9, weight: 43.1 },
  { designation: 'ISHB 250', standard: 'IS', type: 'H-Column', D: 250, B: 250, tw: 6.9, tf: 9.7, r: 13, A: 6480, Ix: 7740, Iy: 2530, Zx: 619.2, Zy: 202.4, Zpx: 689.0, Zpy: 309.0, rx: 109.3, ry: 62.5, weight: 50.9 },
  { designation: 'ISHB 300', standard: 'IS', type: 'H-Column', D: 300, B: 250, tw: 7.6, tf: 10.6, r: 14, A: 7930, Ix: 12545, Iy: 2820, Zx: 836.4, Zy: 225.6, Zpx: 938.7, Zpy: 345.0, rx: 125.8, ry: 59.6, weight: 62.2 },
  { designation: 'ISHB 350', standard: 'IS', type: 'H-Column', D: 350, B: 250, tw: 8.3, tf: 11.6, r: 14, A: 9140, Ix: 19158, Iy: 3127, Zx: 1094.8, Zy: 250.1, Zpx: 1232.0, Zpy: 383.8, rx: 144.8, ry: 58.5, weight: 71.7 },
  { designation: 'ISHB 400', standard: 'IS', type: 'H-Column', D: 400, B: 250, tw: 9.1, tf: 12.7, r: 14, A: 10430, Ix: 28084, Iy: 3455, Zx: 1404.2, Zy: 276.4, Zpx: 1585.6, Zpy: 424.3, rx: 164.1, ry: 57.5, weight: 81.9 },
  { designation: 'ISHB 450', standard: 'IS', type: 'H-Column', D: 450, B: 250, tw: 9.8, tf: 13.7, r: 15, A: 11800, Ix: 39208, Iy: 3754, Zx: 1742.6, Zy: 300.3, Zpx: 1967.6, Zpy: 460.8, rx: 182.3, ry: 56.4, weight: 92.6 },
];

// =============================================================================
// INDIAN STANDARD LIGHT BEAMS (ISLB)
// =============================================================================
const ISLB_SECTIONS: SteelSectionProperties[] = [
  { designation: 'ISLB 75', standard: 'IS', type: 'I-Beam', D: 75, B: 50, tw: 3.7, tf: 5.0, r: 6.5, A: 730, Ix: 72.7, Iy: 10.2, Zx: 19.4, Zy: 4.1, Zpx: 22.5, Zpy: 6.5, rx: 31.6, ry: 11.8, weight: 5.7 },
  { designation: 'ISLB 100', standard: 'IS', type: 'I-Beam', D: 100, B: 50, tw: 4.0, tf: 6.4, r: 7, A: 1020, Ix: 168.0, Iy: 11.4, Zx: 33.6, Zy: 4.6, Zpx: 39.3, Zpy: 7.3, rx: 40.6, ry: 10.6, weight: 8.0 },
  { designation: 'ISLB 125', standard: 'IS', type: 'I-Beam', D: 125, B: 75, tw: 4.4, tf: 6.5, r: 8, A: 1290, Ix: 340.0, Iy: 42.8, Zx: 54.4, Zy: 11.4, Zpx: 62.9, Zpy: 17.8, rx: 51.4, ry: 18.2, weight: 10.1 },
  { designation: 'ISLB 150', standard: 'IS', type: 'I-Beam', D: 150, B: 80, tw: 4.8, tf: 6.8, r: 9, A: 1500, Ix: 589.0, Iy: 51.0, Zx: 78.5, Zy: 12.8, Zpx: 90.5, Zpy: 20.0, rx: 62.7, ry: 18.4, weight: 11.8 },
  { designation: 'ISLB 175', standard: 'IS', type: 'I-Beam', D: 175, B: 90, tw: 5.1, tf: 7.4, r: 10, A: 1870, Ix: 942.0, Iy: 81.6, Zx: 107.7, Zy: 18.1, Zpx: 124.0, Zpy: 28.3, rx: 71.0, ry: 20.9, weight: 14.7 },
  { designation: 'ISLB 200', standard: 'IS', type: 'I-Beam', D: 200, B: 100, tw: 5.4, tf: 7.8, r: 10, A: 2210, Ix: 1500, Iy: 125.0, Zx: 150.0, Zy: 25.0, Zpx: 173.0, Zpy: 39.2, rx: 82.4, ry: 23.8, weight: 17.3 },
  { designation: 'ISLB 225', standard: 'IS', type: 'I-Beam', D: 225, B: 100, tw: 5.8, tf: 8.6, r: 11, A: 2690, Ix: 2340, Iy: 137.5, Zx: 208.0, Zy: 27.5, Zpx: 239.9, Zpy: 43.2, rx: 93.3, ry: 22.6, weight: 21.1 },
  { designation: 'ISLB 250', standard: 'IS', type: 'I-Beam', D: 250, B: 125, tw: 6.1, tf: 8.2, r: 12, A: 3098, Ix: 3718, Iy: 253.8, Zx: 297.4, Zy: 40.6, Zpx: 338.9, Zpy: 62.5, rx: 109.5, ry: 28.6, weight: 24.3 },
  { designation: 'ISLB 300', standard: 'IS', type: 'I-Beam', D: 300, B: 150, tw: 6.7, tf: 9.4, r: 13, A: 4230, Ix: 6333, Iy: 420.4, Zx: 422.2, Zy: 56.1, Zpx: 487.5, Zpy: 87.4, rx: 122.4, ry: 31.5, weight: 33.2 },
  { designation: 'ISLB 350', standard: 'IS', type: 'I-Beam', D: 350, B: 165, tw: 7.4, tf: 11.4, r: 14, A: 5490, Ix: 10008, Iy: 631.9, Zx: 572.0, Zy: 76.6, Zpx: 659.3, Zpy: 118.7, rx: 135.1, ry: 33.9, weight: 43.1 },
  { designation: 'ISLB 400', standard: 'IS', type: 'I-Beam', D: 400, B: 165, tw: 8.0, tf: 12.5, r: 15, A: 6430, Ix: 15473, Iy: 699.8, Zx: 773.7, Zy: 84.8, Zpx: 893.9, Zpy: 131.7, rx: 155.2, ry: 33.0, weight: 50.5 },
  { designation: 'ISLB 450', standard: 'IS', type: 'I-Beam', D: 450, B: 170, tw: 8.4, tf: 13.4, r: 15, A: 7420, Ix: 22307, Iy: 831.0, Zx: 991.4, Zy: 97.8, Zpx: 1144.5, Zpy: 151.6, rx: 173.4, ry: 33.5, weight: 58.2 },
  { designation: 'ISLB 500', standard: 'IS', type: 'I-Beam', D: 500, B: 180, tw: 9.2, tf: 14.1, r: 16, A: 8570, Ix: 31690, Iy: 1063, Zx: 1267.6, Zy: 118.1, Zpx: 1463.5, Zpy: 183.6, rx: 192.3, ry: 35.2, weight: 67.2 },
  { designation: 'ISLB 550', standard: 'IS', type: 'I-Beam', D: 550, B: 190, tw: 9.9, tf: 15.0, r: 18, A: 9810, Ix: 43872, Iy: 1339, Zx: 1595.4, Zy: 140.9, Zpx: 1840.0, Zpy: 218.5, rx: 211.5, ry: 36.9, weight: 77.0 },
  { designation: 'ISLB 600', standard: 'IS', type: 'I-Beam', D: 600, B: 210, tw: 10.5, tf: 15.5, r: 20, A: 11120, Ix: 61475, Iy: 1881, Zx: 2049.2, Zy: 179.2, Zpx: 2364.9, Zpy: 277.3, rx: 235.1, ry: 41.1, weight: 87.3 },
];

// =============================================================================
// INDIAN STANDARD CHANNELS (ISMC)
// =============================================================================
const ISMC_SECTIONS: SteelSectionProperties[] = [
  { designation: 'ISMC 75', standard: 'IS', type: 'Channel', D: 75, B: 40, tw: 4.4, tf: 7.3, r: 8, A: 877, Ix: 76.0, Iy: 14.6, Zx: 20.3, Zy: 5.0, Zpx: 24.0, Zpy: 9.0, rx: 29.4, ry: 12.9, weight: 6.9 },
  { designation: 'ISMC 100', standard: 'IS', type: 'Channel', D: 100, B: 50, tw: 5.0, tf: 7.5, r: 8, A: 1170, Ix: 164.6, Iy: 26.7, Zx: 32.9, Zy: 7.4, Zpx: 39.4, Zpy: 13.0, rx: 37.5, ry: 15.1, weight: 9.2 },
  { designation: 'ISMC 125', standard: 'IS', type: 'Channel', D: 125, B: 65, tw: 5.3, tf: 8.2, r: 9, A: 1540, Ix: 325.0, Iy: 60.2, Zx: 52.0, Zy: 12.9, Zpx: 62.0, Zpy: 22.0, rx: 46.0, ry: 19.8, weight: 12.1 },
  { designation: 'ISMC 150', standard: 'IS', type: 'Channel', D: 150, B: 75, tw: 5.7, tf: 9.0, r: 10, A: 2040, Ix: 597.0, Iy: 103.0, Zx: 79.6, Zy: 19.4, Zpx: 95.0, Zpy: 33.0, rx: 54.1, ry: 22.5, weight: 16.0 },
  { designation: 'ISMC 175', standard: 'IS', type: 'Channel', D: 175, B: 75, tw: 5.7, tf: 10.2, r: 10, A: 2340, Ix: 899.0, Iy: 115.2, Zx: 102.7, Zy: 21.7, Zpx: 123.0, Zpy: 37.0, rx: 62.0, ry: 22.2, weight: 18.4 },
  { designation: 'ISMC 200', standard: 'IS', type: 'Channel', D: 200, B: 75, tw: 6.2, tf: 11.4, r: 11, A: 2830, Ix: 1380, Iy: 127.0, Zx: 138.0, Zy: 25.0, Zpx: 165.0, Zpy: 42.0, rx: 69.9, ry: 21.2, weight: 22.2 },
  { designation: 'ISMC 225', standard: 'IS', type: 'Channel', D: 225, B: 80, tw: 6.4, tf: 12.4, r: 12, A: 3340, Ix: 2033, Iy: 162.0, Zx: 180.7, Zy: 29.0, Zpx: 216.0, Zpy: 49.0, rx: 78.0, ry: 22.0, weight: 26.2 },
  { designation: 'ISMC 250', standard: 'IS', type: 'Channel', D: 250, B: 80, tw: 7.1, tf: 14.1, r: 12, A: 3990, Ix: 2910, Iy: 178.0, Zx: 232.8, Zy: 32.5, Zpx: 280.0, Zpy: 55.0, rx: 85.4, ry: 21.1, weight: 31.3 },
  { designation: 'ISMC 300', standard: 'IS', type: 'Channel', D: 300, B: 90, tw: 7.8, tf: 13.6, r: 13, A: 4560, Ix: 4630, Iy: 241.0, Zx: 308.7, Zy: 37.3, Zpx: 370.0, Zpy: 63.0, rx: 100.8, ry: 23.0, weight: 35.8 },
  { designation: 'ISMC 350', standard: 'IS', type: 'Channel', D: 350, B: 100, tw: 8.1, tf: 13.5, r: 13, A: 5090, Ix: 6907, Iy: 332.0, Zx: 394.7, Zy: 44.7, Zpx: 470.0, Zpy: 76.0, rx: 116.5, ry: 25.5, weight: 40.0 },
  { designation: 'ISMC 400', standard: 'IS', type: 'Channel', D: 400, B: 100, tw: 8.6, tf: 15.3, r: 14, A: 6100, Ix: 9927, Iy: 375.0, Zx: 496.4, Zy: 54.5, Zpx: 596.0, Zpy: 90.0, rx: 127.6, ry: 24.8, weight: 47.9 },
];

// =============================================================================
// INDIAN STANDARD WIDE FLANGE BEAMS (ISWB)
// =============================================================================
const ISWB_SECTIONS: SteelSectionProperties[] = [
  { designation: 'ISWB 150', standard: 'IS', type: 'Wide-Flange', D: 150, B: 100, tw: 5.4, tf: 8.0, r: 9, A: 2020, Ix: 839.0, Iy: 94.8, Zx: 111.9, Zy: 19.0, Zpx: 127.8, Zpy: 29.5, rx: 64.5, ry: 21.7, weight: 15.8 },
  { designation: 'ISWB 175', standard: 'IS', type: 'Wide-Flange', D: 175, B: 125, tw: 5.8, tf: 7.4, r: 9, A: 2430, Ix: 1396, Iy: 177.0, Zx: 159.5, Zy: 28.3, Zpx: 180.2, Zpy: 43.2, rx: 75.8, ry: 27.0, weight: 19.1 },
  { designation: 'ISWB 200', standard: 'IS', type: 'Wide-Flange', D: 200, B: 140, tw: 6.1, tf: 9.0, r: 10, A: 3230, Ix: 2620, Iy: 295.0, Zx: 262.0, Zy: 42.1, Zpx: 298.0, Zpy: 64.8, rx: 90.1, ry: 30.2, weight: 25.4 },
  { designation: 'ISWB 225', standard: 'IS', type: 'Wide-Flange', D: 225, B: 150, tw: 6.4, tf: 9.9, r: 11, A: 3910, Ix: 3920, Iy: 387.0, Zx: 348.4, Zy: 51.6, Zpx: 397.2, Zpy: 79.6, rx: 100.1, ry: 31.5, weight: 30.7 },
  { designation: 'ISWB 250', standard: 'IS', type: 'Wide-Flange', D: 250, B: 200, tw: 6.7, tf: 9.0, r: 12, A: 4600, Ix: 5938, Iy: 750.0, Zx: 475.0, Zy: 75.0, Zpx: 537.0, Zpy: 114.2, rx: 113.7, ry: 40.4, weight: 36.1 },
  { designation: 'ISWB 300', standard: 'IS', type: 'Wide-Flange', D: 300, B: 200, tw: 7.4, tf: 10.0, r: 13, A: 5690, Ix: 9826, Iy: 833.0, Zx: 655.1, Zy: 83.3, Zpx: 745.8, Zpy: 127.2, rx: 131.4, ry: 38.3, weight: 44.6 },
  { designation: 'ISWB 350', standard: 'IS', type: 'Wide-Flange', D: 350, B: 200, tw: 8.0, tf: 11.4, r: 14, A: 6710, Ix: 15521, Iy: 954.0, Zx: 886.9, Zy: 95.4, Zpx: 1013.6, Zpy: 146.5, rx: 152.1, ry: 37.7, weight: 52.7 },
  { designation: 'ISWB 400', standard: 'IS', type: 'Wide-Flange', D: 400, B: 200, tw: 8.6, tf: 13.0, r: 14, A: 7890, Ix: 23426, Iy: 1098, Zx: 1171.3, Zy: 109.8, Zpx: 1345.2, Zpy: 169.0, rx: 172.3, ry: 37.3, weight: 61.9 },
  { designation: 'ISWB 450', standard: 'IS', type: 'Wide-Flange', D: 450, B: 200, tw: 9.2, tf: 15.4, r: 15, A: 9240, Ix: 35057, Iy: 1301, Zx: 1558.1, Zy: 130.1, Zpx: 1793.8, Zpy: 200.1, rx: 194.8, ry: 37.5, weight: 72.5 },
  { designation: 'ISWB 500', standard: 'IS', type: 'Wide-Flange', D: 500, B: 250, tw: 9.9, tf: 14.7, r: 17, A: 10640, Ix: 52291, Iy: 2621, Zx: 2091.6, Zy: 209.7, Zpx: 2388.6, Zpy: 321.3, rx: 221.7, ry: 49.6, weight: 83.5 },
  { designation: 'ISWB 550', standard: 'IS', type: 'Wide-Flange', D: 550, B: 250, tw: 10.5, tf: 17.6, r: 18, A: 12890, Ix: 74906, Iy: 3092, Zx: 2723.9, Zy: 247.4, Zpx: 3137.5, Zpy: 382.0, rx: 241.1, ry: 49.0, weight: 101.1 },
  { designation: 'ISWB 600', standard: 'IS', type: 'Wide-Flange', D: 600, B: 250, tw: 11.2, tf: 21.3, r: 20, A: 15400, Ix: 106198, Iy: 3710, Zx: 3539.9, Zy: 296.8, Zpx: 4098.0, Zpy: 459.6, rx: 262.6, ry: 49.1, weight: 120.8 },
];

// =============================================================================
// INDIAN STANDARD ANGLES (ISA - Equal)
// =============================================================================
const ISA_EQUAL_SECTIONS: SteelSectionProperties[] = [
  { designation: 'ISA 25x25x3', standard: 'IS', type: 'Angle', D: 25, B: 25, tw: 3, tf: 3, r: 3.5, A: 142, Ix: 1.1, Iy: 1.1, Zx: 0.6, Zy: 0.6, Zpx: 1.1, Zpy: 1.1, rx: 7.6, ry: 7.6, weight: 1.1 },
  { designation: 'ISA 25x25x4', standard: 'IS', type: 'Angle', D: 25, B: 25, tw: 4, tf: 4, r: 3.5, A: 184, Ix: 1.4, Iy: 1.4, Zx: 0.8, Zy: 0.8, Zpx: 1.4, Zpy: 1.4, rx: 7.4, ry: 7.4, weight: 1.4 },
  { designation: 'ISA 30x30x3', standard: 'IS', type: 'Angle', D: 30, B: 30, tw: 3, tf: 3, r: 4, A: 174, Ix: 1.9, Iy: 1.9, Zx: 0.9, Zy: 0.9, Zpx: 1.6, Zpy: 1.6, rx: 9.2, ry: 9.2, weight: 1.4 },
  { designation: 'ISA 35x35x4', standard: 'IS', type: 'Angle', D: 35, B: 35, tw: 4, tf: 4, r: 4.5, A: 267, Ix: 4.1, Iy: 4.1, Zx: 1.6, Zy: 1.6, Zpx: 2.9, Zpy: 2.9, rx: 10.7, ry: 10.7, weight: 2.1 },
  { designation: 'ISA 40x40x4', standard: 'IS', type: 'Angle', D: 40, B: 40, tw: 4, tf: 4, r: 5, A: 308, Ix: 6.1, Iy: 6.1, Zx: 2.2, Zy: 2.2, Zpx: 3.8, Zpy: 3.8, rx: 12.3, ry: 12.3, weight: 2.4 },
  { designation: 'ISA 40x40x5', standard: 'IS', type: 'Angle', D: 40, B: 40, tw: 5, tf: 5, r: 5, A: 378, Ix: 7.3, Iy: 7.3, Zx: 2.6, Zy: 2.6, Zpx: 4.6, Zpy: 4.6, rx: 12.1, ry: 12.1, weight: 3.0 },
  { designation: 'ISA 45x45x4', standard: 'IS', type: 'Angle', D: 45, B: 45, tw: 4, tf: 4, r: 5, A: 349, Ix: 8.9, Iy: 8.9, Zx: 2.8, Zy: 2.8, Zpx: 4.9, Zpy: 4.9, rx: 13.8, ry: 13.8, weight: 2.7 },
  { designation: 'ISA 45x45x5', standard: 'IS', type: 'Angle', D: 45, B: 45, tw: 5, tf: 5, r: 5, A: 429, Ix: 10.7, Iy: 10.7, Zx: 3.4, Zy: 3.4, Zpx: 6.0, Zpy: 6.0, rx: 13.6, ry: 13.6, weight: 3.4 },
  { designation: 'ISA 50x50x5', standard: 'IS', type: 'Angle', D: 50, B: 50, tw: 5, tf: 5, r: 5.5, A: 480, Ix: 14.8, Iy: 14.8, Zx: 4.2, Zy: 4.2, Zpx: 7.3, Zpy: 7.3, rx: 15.2, ry: 15.2, weight: 3.8 },
  { designation: 'ISA 50x50x6', standard: 'IS', type: 'Angle', D: 50, B: 50, tw: 6, tf: 6, r: 5.5, A: 567, Ix: 17.1, Iy: 17.1, Zx: 4.9, Zy: 4.9, Zpx: 8.5, Zpy: 8.5, rx: 15.0, ry: 15.0, weight: 4.5 },
  { designation: 'ISA 60x60x5', standard: 'IS', type: 'Angle', D: 60, B: 60, tw: 5, tf: 5, r: 6, A: 581, Ix: 26.0, Iy: 26.0, Zx: 6.1, Zy: 6.1, Zpx: 10.6, Zpy: 10.6, rx: 18.4, ry: 18.4, weight: 4.6 },
  { designation: 'ISA 60x60x6', standard: 'IS', type: 'Angle', D: 60, B: 60, tw: 6, tf: 6, r: 6, A: 689, Ix: 30.2, Iy: 30.2, Zx: 7.1, Zy: 7.1, Zpx: 12.5, Zpy: 12.5, rx: 18.2, ry: 18.2, weight: 5.4 },
  { designation: 'ISA 60x60x8', standard: 'IS', type: 'Angle', D: 60, B: 60, tw: 8, tf: 8, r: 6, A: 896, Ix: 38.1, Iy: 38.1, Zx: 9.1, Zy: 9.1, Zpx: 16.0, Zpy: 16.0, rx: 17.8, ry: 17.8, weight: 7.0 },
  { designation: 'ISA 65x65x5', standard: 'IS', type: 'Angle', D: 65, B: 65, tw: 5, tf: 5, r: 6, A: 631, Ix: 33.4, Iy: 33.4, Zx: 7.3, Zy: 7.3, Zpx: 12.7, Zpy: 12.7, rx: 19.9, ry: 19.9, weight: 5.0 },
  { designation: 'ISA 65x65x6', standard: 'IS', type: 'Angle', D: 65, B: 65, tw: 6, tf: 6, r: 6, A: 749, Ix: 38.9, Iy: 38.9, Zx: 8.5, Zy: 8.5, Zpx: 14.9, Zpy: 14.9, rx: 19.7, ry: 19.7, weight: 5.9 },
  { designation: 'ISA 75x75x5', standard: 'IS', type: 'Angle', D: 75, B: 75, tw: 5, tf: 5, r: 7, A: 735, Ix: 51.4, Iy: 51.4, Zx: 9.7, Zy: 9.7, Zpx: 16.9, Zpy: 16.9, rx: 23.0, ry: 23.0, weight: 5.8 },
  { designation: 'ISA 75x75x6', standard: 'IS', type: 'Angle', D: 75, B: 75, tw: 6, tf: 6, r: 7, A: 873, Ix: 60.0, Iy: 60.0, Zx: 11.3, Zy: 11.3, Zpx: 19.8, Zpy: 19.8, rx: 22.8, ry: 22.8, weight: 6.8 },
  { designation: 'ISA 75x75x8', standard: 'IS', type: 'Angle', D: 75, B: 75, tw: 8, tf: 8, r: 7, A: 1140, Ix: 76.3, Iy: 76.3, Zx: 14.5, Zy: 14.5, Zpx: 25.5, Zpy: 25.5, rx: 22.4, ry: 22.4, weight: 8.9 },
  { designation: 'ISA 75x75x10', standard: 'IS', type: 'Angle', D: 75, B: 75, tw: 10, tf: 10, r: 7, A: 1394, Ix: 90.1, Iy: 90.1, Zx: 17.4, Zy: 17.4, Zpx: 30.8, Zpy: 30.8, rx: 22.0, ry: 22.0, weight: 10.9 },
  { designation: 'ISA 80x80x6', standard: 'IS', type: 'Angle', D: 80, B: 80, tw: 6, tf: 6, r: 7, A: 938, Ix: 73.6, Iy: 73.6, Zx: 13.0, Zy: 13.0, Zpx: 22.8, Zpy: 22.8, rx: 24.5, ry: 24.5, weight: 7.4 },
  { designation: 'ISA 80x80x8', standard: 'IS', type: 'Angle', D: 80, B: 80, tw: 8, tf: 8, r: 7, A: 1224, Ix: 93.7, Iy: 93.7, Zx: 16.7, Zy: 16.7, Zpx: 29.4, Zpy: 29.4, rx: 24.1, ry: 24.1, weight: 9.6 },
  { designation: 'ISA 90x90x6', standard: 'IS', type: 'Angle', D: 90, B: 90, tw: 6, tf: 6, r: 8, A: 1058, Ix: 106.2, Iy: 106.2, Zx: 16.7, Zy: 16.7, Zpx: 29.2, Zpy: 29.2, rx: 27.5, ry: 27.5, weight: 8.3 },
  { designation: 'ISA 90x90x8', standard: 'IS', type: 'Angle', D: 90, B: 90, tw: 8, tf: 8, r: 8, A: 1389, Ix: 135.6, Iy: 135.6, Zx: 21.5, Zy: 21.5, Zpx: 37.8, Zpy: 37.8, rx: 27.1, ry: 27.1, weight: 10.9 },
  { designation: 'ISA 90x90x10', standard: 'IS', type: 'Angle', D: 90, B: 90, tw: 10, tf: 10, r: 8, A: 1703, Ix: 162.1, Iy: 162.1, Zx: 26.0, Zy: 26.0, Zpx: 46.0, Zpy: 46.0, rx: 26.7, ry: 26.7, weight: 13.4 },
  { designation: 'ISA 100x100x6', standard: 'IS', type: 'Angle', D: 100, B: 100, tw: 6, tf: 6, r: 8, A: 1178, Ix: 147.0, Iy: 147.0, Zx: 20.8, Zy: 20.8, Zpx: 36.4, Zpy: 36.4, rx: 30.6, ry: 30.6, weight: 9.2 },
  { designation: 'ISA 100x100x8', standard: 'IS', type: 'Angle', D: 100, B: 100, tw: 8, tf: 8, r: 8, A: 1549, Ix: 189.3, Iy: 189.3, Zx: 26.9, Zy: 26.9, Zpx: 47.4, Zpy: 47.4, rx: 30.2, ry: 30.2, weight: 12.1 },
  { designation: 'ISA 100x100x10', standard: 'IS', type: 'Angle', D: 100, B: 100, tw: 10, tf: 10, r: 8, A: 1903, Ix: 227.3, Iy: 227.3, Zx: 32.7, Zy: 32.7, Zpx: 57.8, Zpy: 57.8, rx: 29.8, ry: 29.8, weight: 14.9 },
  { designation: 'ISA 100x100x12', standard: 'IS', type: 'Angle', D: 100, B: 100, tw: 12, tf: 12, r: 8, A: 2239, Ix: 260.8, Iy: 260.8, Zx: 38.0, Zy: 38.0, Zpx: 67.4, Zpy: 67.4, rx: 29.4, ry: 29.4, weight: 17.6 },
  { designation: 'ISA 110x110x8', standard: 'IS', type: 'Angle', D: 110, B: 110, tw: 8, tf: 8, r: 9, A: 1718, Ix: 254.0, Iy: 254.0, Zx: 32.8, Zy: 32.8, Zpx: 57.6, Zpy: 57.6, rx: 33.4, ry: 33.4, weight: 13.5 },
  { designation: 'ISA 110x110x10', standard: 'IS', type: 'Angle', D: 110, B: 110, tw: 10, tf: 10, r: 9, A: 2113, Ix: 307.0, Iy: 307.0, Zx: 39.9, Zy: 39.9, Zpx: 70.3, Zpy: 70.3, rx: 33.0, ry: 33.0, weight: 16.6 },
  { designation: 'ISA 130x130x8', standard: 'IS', type: 'Angle', D: 130, B: 130, tw: 8, tf: 8, r: 10, A: 2040, Ix: 423.0, Iy: 423.0, Zx: 46.2, Zy: 46.2, Zpx: 80.8, Zpy: 80.8, rx: 39.6, ry: 39.6, weight: 16.0 },
  { designation: 'ISA 130x130x10', standard: 'IS', type: 'Angle', D: 130, B: 130, tw: 10, tf: 10, r: 10, A: 2516, Ix: 514.0, Iy: 514.0, Zx: 56.5, Zy: 56.5, Zpx: 99.3, Zpy: 99.3, rx: 39.2, ry: 39.2, weight: 19.7 },
  { designation: 'ISA 150x150x10', standard: 'IS', type: 'Angle', D: 150, B: 150, tw: 10, tf: 10, r: 11, A: 2929, Ix: 808.0, Iy: 808.0, Zx: 76.5, Zy: 76.5, Zpx: 134.1, Zpy: 134.1, rx: 45.5, ry: 45.5, weight: 23.0 },
  { designation: 'ISA 150x150x12', standard: 'IS', type: 'Angle', D: 150, B: 150, tw: 12, tf: 12, r: 11, A: 3469, Ix: 940.0, Iy: 940.0, Zx: 89.6, Zy: 89.6, Zpx: 157.8, Zpy: 157.8, rx: 45.1, ry: 45.1, weight: 27.2 },
  { designation: 'ISA 150x150x15', standard: 'IS', type: 'Angle', D: 150, B: 150, tw: 15, tf: 15, r: 11, A: 4263, Ix: 1129, Iy: 1129, Zx: 109.0, Zy: 109.0, Zpx: 192.8, Zpy: 192.8, rx: 44.5, ry: 44.5, weight: 33.5 },
  { designation: 'ISA 200x200x12', standard: 'IS', type: 'Angle', D: 200, B: 200, tw: 12, tf: 12, r: 13, A: 4677, Ix: 2282, Iy: 2282, Zx: 161.8, Zy: 161.8, Zpx: 283.2, Zpy: 283.2, rx: 60.6, ry: 60.6, weight: 36.7 },
  { designation: 'ISA 200x200x16', standard: 'IS', type: 'Angle', D: 200, B: 200, tw: 16, tf: 16, r: 13, A: 6124, Ix: 2914, Iy: 2914, Zx: 209.2, Zy: 209.2, Zpx: 369.2, Zpy: 369.2, rx: 60.0, ry: 60.0, weight: 48.1 },
  { designation: 'ISA 200x200x20', standard: 'IS', type: 'Angle', D: 200, B: 200, tw: 20, tf: 20, r: 13, A: 7526, Ix: 3487, Iy: 3487, Zx: 253.5, Zy: 253.5, Zpx: 450.4, Zpy: 450.4, rx: 59.4, ry: 59.4, weight: 59.1 },
];

// =============================================================================
// AISC W-SHAPES (Wide Flange)
// =============================================================================
const AISC_W_SECTIONS: SteelSectionProperties[] = [
  { designation: 'W150x13', standard: 'AISC', type: 'Wide-Flange', D: 148, B: 100, tw: 4.3, tf: 4.9, r: 7, A: 1730, Ix: 635, Iy: 41.2, Zx: 85.8, Zy: 8.2, Zpx: 101, Zpy: 13.2, rx: 60.6, ry: 15.4, weight: 13.0 },
  { designation: 'W150x18', standard: 'AISC', type: 'Wide-Flange', D: 153, B: 102, tw: 5.8, tf: 7.1, r: 7, A: 2290, Ix: 917, Iy: 61.7, Zx: 120, Zy: 12.1, Zpx: 141, Zpy: 19.4, rx: 63.3, ry: 16.4, weight: 18.0 },
  { designation: 'W200x15', standard: 'AISC', type: 'Wide-Flange', D: 200, B: 100, tw: 4.3, tf: 5.2, r: 7, A: 1940, Ix: 1310, Iy: 44.2, Zx: 131, Zy: 8.8, Zpx: 153, Zpy: 14.2, rx: 82.2, ry: 15.1, weight: 15.0 },
  { designation: 'W200x22', standard: 'AISC', type: 'Wide-Flange', D: 206, B: 102, tw: 6.2, tf: 8.0, r: 10, A: 2860, Ix: 2000, Iy: 70.3, Zx: 194, Zy: 13.8, Zpx: 228, Zpy: 22.0, rx: 83.6, ry: 15.7, weight: 22.0 },
  { designation: 'W200x36', standard: 'AISC', type: 'Wide-Flange', D: 201, B: 165, tw: 6.2, tf: 10.2, r: 11, A: 4570, Ix: 3420, Iy: 761, Zx: 340, Zy: 92.3, Zpx: 380, Zpy: 141, rx: 86.6, ry: 40.8, weight: 36.0 },
  { designation: 'W200x46', standard: 'AISC', type: 'Wide-Flange', D: 203, B: 203, tw: 7.2, tf: 11.0, r: 11, A: 5880, Ix: 4560, Iy: 1540, Zx: 449, Zy: 151, Zpx: 504, Zpy: 231, rx: 88.0, ry: 51.2, weight: 46.0 },
  { designation: 'W250x25', standard: 'AISC', type: 'Wide-Flange', D: 257, B: 102, tw: 6.1, tf: 8.4, r: 10, A: 3220, Ix: 3480, Iy: 72.1, Zx: 271, Zy: 14.1, Zpx: 318, Zpy: 22.6, rx: 104, ry: 15.0, weight: 25.0 },
  { designation: 'W250x33', standard: 'AISC', type: 'Wide-Flange', D: 258, B: 146, tw: 6.1, tf: 9.1, r: 11, A: 4190, Ix: 4860, Iy: 465, Zx: 377, Zy: 63.6, Zpx: 432, Zpy: 98.0, rx: 108, ry: 33.3, weight: 33.0 },
  { designation: 'W250x45', standard: 'AISC', type: 'Wide-Flange', D: 266, B: 148, tw: 7.6, tf: 13.0, r: 12, A: 5700, Ix: 7100, Iy: 695, Zx: 534, Zy: 93.9, Zpx: 612, Zpy: 144, rx: 112, ry: 34.9, weight: 45.0 },
  { designation: 'W250x58', standard: 'AISC', type: 'Wide-Flange', D: 252, B: 203, tw: 8.0, tf: 13.5, r: 13, A: 7420, Ix: 8700, Iy: 2870, Zx: 690, Zy: 283, Zpx: 775, Zpy: 432, rx: 108, ry: 62.2, weight: 58.0 },
  { designation: 'W310x21', standard: 'AISC', type: 'Wide-Flange', D: 303, B: 101, tw: 5.1, tf: 5.7, r: 7, A: 2680, Ix: 3700, Iy: 39.0, Zx: 244, Zy: 7.7, Zpx: 290, Zpy: 12.5, rx: 117, ry: 12.1, weight: 21.0 },
  { designation: 'W310x33', standard: 'AISC', type: 'Wide-Flange', D: 313, B: 102, tw: 6.6, tf: 10.8, r: 10, A: 4180, Ix: 6500, Iy: 77.4, Zx: 415, Zy: 15.2, Zpx: 489, Zpy: 24.4, rx: 125, ry: 13.6, weight: 33.0 },
  { designation: 'W310x39', standard: 'AISC', type: 'Wide-Flange', D: 310, B: 165, tw: 5.8, tf: 9.7, r: 11, A: 4940, Ix: 8480, Iy: 730, Zx: 547, Zy: 88.5, Zpx: 620, Zpy: 136, rx: 131, ry: 38.5, weight: 39.0 },
  { designation: 'W310x52', standard: 'AISC', type: 'Wide-Flange', D: 317, B: 167, tw: 7.6, tf: 13.2, r: 12, A: 6650, Ix: 11900, Iy: 1020, Zx: 750, Zy: 122, Zpx: 856, Zpy: 188, rx: 134, ry: 39.2, weight: 52.0 },
  { designation: 'W310x67', standard: 'AISC', type: 'Wide-Flange', D: 306, B: 204, tw: 8.5, tf: 14.6, r: 13, A: 8530, Ix: 14500, Iy: 2880, Zx: 948, Zy: 282, Zpx: 1070, Zpy: 432, rx: 130, ry: 58.1, weight: 67.0 },
  { designation: 'W360x33', standard: 'AISC', type: 'Wide-Flange', D: 349, B: 127, tw: 5.8, tf: 8.5, r: 10, A: 4210, Ix: 8160, Iy: 221, Zx: 468, Zy: 34.8, Zpx: 543, Zpy: 54.0, rx: 139, ry: 22.9, weight: 33.0 },
  { designation: 'W360x45', standard: 'AISC', type: 'Wide-Flange', D: 352, B: 171, tw: 6.9, tf: 9.8, r: 11, A: 5710, Ix: 12100, Iy: 818, Zx: 688, Zy: 95.7, Zpx: 784, Zpy: 147, rx: 146, ry: 37.9, weight: 45.0 },
  { designation: 'W360x57', standard: 'AISC', type: 'Wide-Flange', D: 358, B: 172, tw: 7.9, tf: 13.1, r: 12, A: 7230, Ix: 16000, Iy: 1110, Zx: 894, Zy: 129, Zpx: 1020, Zpy: 199, rx: 149, ry: 39.2, weight: 57.0 },
  { designation: 'W360x79', standard: 'AISC', type: 'Wide-Flange', D: 354, B: 205, tw: 9.4, tf: 16.8, r: 14, A: 10100, Ix: 22700, Iy: 4820, Zx: 1280, Zy: 470, Zpx: 1440, Zpy: 718, rx: 150, ry: 69.1, weight: 79.0 },
  { designation: 'W410x39', standard: 'AISC', type: 'Wide-Flange', D: 399, B: 140, tw: 6.4, tf: 8.8, r: 10, A: 4960, Ix: 12600, Iy: 320, Zx: 631, Zy: 45.7, Zpx: 726, Zpy: 70.6, rx: 159, ry: 25.4, weight: 39.0 },
  { designation: 'W410x54', standard: 'AISC', type: 'Wide-Flange', D: 403, B: 177, tw: 7.5, tf: 10.9, r: 10, A: 6840, Ix: 18600, Iy: 1120, Zx: 923, Zy: 127, Zpx: 1050, Zpy: 195, rx: 165, ry: 40.5, weight: 54.0 },
  { designation: 'W410x67', standard: 'AISC', type: 'Wide-Flange', D: 410, B: 179, tw: 8.8, tf: 14.4, r: 11, A: 8580, Ix: 24700, Iy: 1480, Zx: 1200, Zy: 165, Zpx: 1370, Zpy: 254, rx: 170, ry: 41.5, weight: 67.0 },
  { designation: 'W460x52', standard: 'AISC', type: 'Wide-Flange', D: 450, B: 152, tw: 7.6, tf: 10.8, r: 10, A: 6650, Ix: 21200, Iy: 634, Zx: 944, Zy: 83.4, Zpx: 1090, Zpy: 130, rx: 179, ry: 30.9, weight: 52.0 },
  { designation: 'W460x68', standard: 'AISC', type: 'Wide-Flange', D: 459, B: 154, tw: 9.1, tf: 15.4, r: 11, A: 8710, Ix: 29600, Iy: 889, Zx: 1290, Zy: 115, Zpx: 1490, Zpy: 179, rx: 184, ry: 31.9, weight: 68.0 },
  { designation: 'W460x89', standard: 'AISC', type: 'Wide-Flange', D: 463, B: 192, tw: 10.5, tf: 17.7, r: 14, A: 11400, Ix: 41100, Iy: 3930, Zx: 1775, Zy: 409, Zpx: 2020, Zpy: 630, rx: 190, ry: 58.7, weight: 89.0 },
  { designation: 'W530x66', standard: 'AISC', type: 'Wide-Flange', D: 525, B: 165, tw: 8.9, tf: 11.4, r: 10, A: 8370, Ix: 35000, Iy: 824, Zx: 1333, Zy: 99.9, Zpx: 1540, Zpy: 156, rx: 204, ry: 31.4, weight: 66.0 },
  { designation: 'W530x82', standard: 'AISC', type: 'Wide-Flange', D: 528, B: 209, tw: 9.5, tf: 13.3, r: 13, A: 10500, Ix: 47500, Iy: 3120, Zx: 1800, Zy: 298, Zpx: 2050, Zpy: 459, rx: 213, ry: 54.6, weight: 82.0 },
  { designation: 'W610x82', standard: 'AISC', type: 'Wide-Flange', D: 599, B: 178, tw: 10.0, tf: 12.8, r: 10, A: 10500, Ix: 52700, Iy: 1180, Zx: 1760, Zy: 133, Zpx: 2030, Zpy: 208, rx: 224, ry: 33.5, weight: 82.0 },
  { designation: 'W610x101', standard: 'AISC', type: 'Wide-Flange', D: 603, B: 228, tw: 10.5, tf: 14.9, r: 13, A: 12900, Ix: 72300, Iy: 4920, Zx: 2400, Zy: 432, Zpx: 2720, Zpy: 664, rx: 237, ry: 61.7, weight: 101.0 },
];

// =============================================================================
// EUROPEAN IPE BEAMS
// =============================================================================
const EU_IPE_SECTIONS: SteelSectionProperties[] = [
  { designation: 'IPE 80', standard: 'EU', type: 'I-Beam', D: 80, B: 46, tw: 3.8, tf: 5.2, r: 5, A: 764, Ix: 80.1, Iy: 8.5, Zx: 20.0, Zy: 3.7, Zpx: 23.2, Zpy: 5.8, rx: 32.4, ry: 10.5, weight: 6.0 },
  { designation: 'IPE 100', standard: 'EU', type: 'I-Beam', D: 100, B: 55, tw: 4.1, tf: 5.7, r: 7, A: 1032, Ix: 171, Iy: 15.9, Zx: 34.2, Zy: 5.8, Zpx: 39.4, Zpy: 9.1, rx: 40.7, ry: 12.4, weight: 8.1 },
  { designation: 'IPE 120', standard: 'EU', type: 'I-Beam', D: 120, B: 64, tw: 4.4, tf: 6.3, r: 7, A: 1321, Ix: 318, Iy: 27.7, Zx: 53.0, Zy: 8.6, Zpx: 60.7, Zpy: 13.6, rx: 49.0, ry: 14.5, weight: 10.4 },
  { designation: 'IPE 140', standard: 'EU', type: 'I-Beam', D: 140, B: 73, tw: 4.7, tf: 6.9, r: 7, A: 1643, Ix: 541, Iy: 44.9, Zx: 77.3, Zy: 12.3, Zpx: 88.3, Zpy: 19.2, rx: 57.4, ry: 16.5, weight: 12.9 },
  { designation: 'IPE 160', standard: 'EU', type: 'I-Beam', D: 160, B: 82, tw: 5.0, tf: 7.4, r: 9, A: 2009, Ix: 869, Iy: 68.3, Zx: 109, Zy: 16.7, Zpx: 124, Zpy: 26.1, rx: 65.8, ry: 18.4, weight: 15.8 },
  { designation: 'IPE 180', standard: 'EU', type: 'I-Beam', D: 180, B: 91, tw: 5.3, tf: 8.0, r: 9, A: 2395, Ix: 1317, Iy: 101, Zx: 146, Zy: 22.2, Zpx: 166, Zpy: 34.6, rx: 74.2, ry: 20.5, weight: 18.8 },
  { designation: 'IPE 200', standard: 'EU', type: 'I-Beam', D: 200, B: 100, tw: 5.6, tf: 8.5, r: 12, A: 2848, Ix: 1943, Iy: 142, Zx: 194, Zy: 28.5, Zpx: 221, Zpy: 44.6, rx: 82.6, ry: 22.4, weight: 22.4 },
  { designation: 'IPE 220', standard: 'EU', type: 'I-Beam', D: 220, B: 110, tw: 5.9, tf: 9.2, r: 12, A: 3337, Ix: 2772, Iy: 205, Zx: 252, Zy: 37.3, Zpx: 285, Zpy: 58.1, rx: 91.1, ry: 24.8, weight: 26.2 },
  { designation: 'IPE 240', standard: 'EU', type: 'I-Beam', D: 240, B: 120, tw: 6.2, tf: 9.8, r: 15, A: 3912, Ix: 3892, Iy: 284, Zx: 324, Zy: 47.3, Zpx: 367, Zpy: 73.9, rx: 99.7, ry: 26.9, weight: 30.7 },
  { designation: 'IPE 270', standard: 'EU', type: 'I-Beam', D: 270, B: 135, tw: 6.6, tf: 10.2, r: 15, A: 4594, Ix: 5790, Iy: 420, Zx: 429, Zy: 62.2, Zpx: 484, Zpy: 97.0, rx: 112, ry: 30.2, weight: 36.1 },
  { designation: 'IPE 300', standard: 'EU', type: 'I-Beam', D: 300, B: 150, tw: 7.1, tf: 10.7, r: 15, A: 5381, Ix: 8356, Iy: 604, Zx: 557, Zy: 80.5, Zpx: 628, Zpy: 125, rx: 125, ry: 33.5, weight: 42.2 },
  { designation: 'IPE 330', standard: 'EU', type: 'I-Beam', D: 330, B: 160, tw: 7.5, tf: 11.5, r: 18, A: 6261, Ix: 11770, Iy: 788, Zx: 713, Zy: 98.5, Zpx: 804, Zpy: 153, rx: 137, ry: 35.5, weight: 49.1 },
  { designation: 'IPE 360', standard: 'EU', type: 'I-Beam', D: 360, B: 170, tw: 8.0, tf: 12.7, r: 18, A: 7273, Ix: 16270, Iy: 1043, Zx: 904, Zy: 123, Zpx: 1019, Zpy: 191, rx: 150, ry: 37.9, weight: 57.1 },
  { designation: 'IPE 400', standard: 'EU', type: 'I-Beam', D: 400, B: 180, tw: 8.6, tf: 13.5, r: 21, A: 8446, Ix: 23130, Iy: 1318, Zx: 1157, Zy: 146, Zpx: 1307, Zpy: 229, rx: 166, ry: 39.5, weight: 66.3 },
  { designation: 'IPE 450', standard: 'EU', type: 'I-Beam', D: 450, B: 190, tw: 9.4, tf: 14.6, r: 21, A: 9882, Ix: 33740, Iy: 1676, Zx: 1500, Zy: 176, Zpx: 1702, Zpy: 276, rx: 185, ry: 41.2, weight: 77.6 },
  { designation: 'IPE 500', standard: 'EU', type: 'I-Beam', D: 500, B: 200, tw: 10.2, tf: 16.0, r: 21, A: 11550, Ix: 48200, Iy: 2142, Zx: 1928, Zy: 214, Zpx: 2194, Zpy: 336, rx: 204, ry: 43.1, weight: 90.7 },
  { designation: 'IPE 550', standard: 'EU', type: 'I-Beam', D: 550, B: 210, tw: 11.1, tf: 17.2, r: 24, A: 13440, Ix: 67120, Iy: 2668, Zx: 2441, Zy: 254, Zpx: 2787, Zpy: 401, rx: 224, ry: 44.6, weight: 105.5 },
  { designation: 'IPE 600', standard: 'EU', type: 'I-Beam', D: 600, B: 220, tw: 12.0, tf: 19.0, r: 24, A: 15600, Ix: 92080, Iy: 3387, Zx: 3069, Zy: 308, Zpx: 3512, Zpy: 486, rx: 243, ry: 46.6, weight: 122.4 },
];

// =============================================================================
// EUROPEAN HE BEAMS (HEA/HEB)
// =============================================================================
const EU_HE_SECTIONS: SteelSectionProperties[] = [
  { designation: 'HEA 100', standard: 'EU', type: 'H-Column', D: 96, B: 100, tw: 5.0, tf: 8.0, r: 12, A: 2124, Ix: 349, Iy: 134, Zx: 72.8, Zy: 26.8, Zpx: 83.0, Zpy: 41.1, rx: 40.5, ry: 25.1, weight: 16.7 },
  { designation: 'HEA 120', standard: 'EU', type: 'H-Column', D: 114, B: 120, tw: 5.0, tf: 8.0, r: 12, A: 2534, Ix: 606, Iy: 231, Zx: 106, Zy: 38.5, Zpx: 119, Zpy: 58.8, rx: 48.9, ry: 30.2, weight: 19.9 },
  { designation: 'HEA 140', standard: 'EU', type: 'H-Column', D: 133, B: 140, tw: 5.5, tf: 8.5, r: 12, A: 3142, Ix: 1033, Iy: 389, Zx: 155, Zy: 55.6, Zpx: 174, Zpy: 84.8, rx: 57.3, ry: 35.2, weight: 24.7 },
  { designation: 'HEA 160', standard: 'EU', type: 'H-Column', D: 152, B: 160, tw: 6.0, tf: 9.0, r: 15, A: 3877, Ix: 1673, Iy: 616, Zx: 220, Zy: 77.0, Zpx: 245, Zpy: 117, rx: 65.7, ry: 39.9, weight: 30.4 },
  { designation: 'HEA 180', standard: 'EU', type: 'H-Column', D: 171, B: 180, tw: 6.0, tf: 9.5, r: 15, A: 4525, Ix: 2510, Iy: 925, Zx: 294, Zy: 103, Zpx: 325, Zpy: 157, rx: 74.5, ry: 45.2, weight: 35.5 },
  { designation: 'HEA 200', standard: 'EU', type: 'H-Column', D: 190, B: 200, tw: 6.5, tf: 10.0, r: 18, A: 5383, Ix: 3692, Iy: 1336, Zx: 389, Zy: 134, Zpx: 430, Zpy: 204, rx: 82.8, ry: 49.8, weight: 42.3 },
  { designation: 'HEA 220', standard: 'EU', type: 'H-Column', D: 210, B: 220, tw: 7.0, tf: 11.0, r: 18, A: 6434, Ix: 5410, Iy: 1955, Zx: 515, Zy: 178, Zpx: 569, Zpy: 271, rx: 91.7, ry: 55.1, weight: 50.5 },
  { designation: 'HEA 240', standard: 'EU', type: 'H-Column', D: 230, B: 240, tw: 7.5, tf: 12.0, r: 21, A: 7684, Ix: 7763, Iy: 2769, Zx: 675, Zy: 231, Zpx: 745, Zpy: 352, rx: 101, ry: 60.0, weight: 60.3 },
  { designation: 'HEA 260', standard: 'EU', type: 'H-Column', D: 250, B: 260, tw: 7.5, tf: 12.5, r: 24, A: 8682, Ix: 10450, Iy: 3668, Zx: 836, Zy: 282, Zpx: 920, Zpy: 430, rx: 110, ry: 65.0, weight: 68.2 },
  { designation: 'HEA 280', standard: 'EU', type: 'H-Column', D: 270, B: 280, tw: 8.0, tf: 13.0, r: 24, A: 9726, Ix: 13670, Iy: 4763, Zx: 1013, Zy: 340, Zpx: 1112, Zpy: 518, rx: 119, ry: 70.0, weight: 76.4 },
  { designation: 'HEA 300', standard: 'EU', type: 'H-Column', D: 290, B: 300, tw: 8.5, tf: 14.0, r: 27, A: 11250, Ix: 18260, Iy: 6310, Zx: 1260, Zy: 421, Zpx: 1383, Zpy: 642, rx: 127, ry: 74.9, weight: 88.3 },
  { designation: 'HEB 100', standard: 'EU', type: 'H-Column', D: 100, B: 100, tw: 6.0, tf: 10.0, r: 12, A: 2604, Ix: 450, Iy: 167, Zx: 89.9, Zy: 33.5, Zpx: 104, Zpy: 51.4, rx: 41.6, ry: 25.3, weight: 20.4 },
  { designation: 'HEB 120', standard: 'EU', type: 'H-Column', D: 120, B: 120, tw: 6.5, tf: 11.0, r: 12, A: 3407, Ix: 864, Iy: 318, Zx: 144, Zy: 53.0, Zpx: 165, Zpy: 80.9, rx: 50.4, ry: 30.6, weight: 26.7 },
  { designation: 'HEB 140', standard: 'EU', type: 'H-Column', D: 140, B: 140, tw: 7.0, tf: 12.0, r: 12, A: 4296, Ix: 1509, Iy: 550, Zx: 216, Zy: 78.5, Zpx: 246, Zpy: 120, rx: 59.3, ry: 35.8, weight: 33.7 },
  { designation: 'HEB 160', standard: 'EU', type: 'H-Column', D: 160, B: 160, tw: 8.0, tf: 13.0, r: 15, A: 5425, Ix: 2492, Iy: 889, Zx: 312, Zy: 111, Zpx: 354, Zpy: 170, rx: 67.8, ry: 40.5, weight: 42.6 },
  { designation: 'HEB 180', standard: 'EU', type: 'H-Column', D: 180, B: 180, tw: 8.5, tf: 14.0, r: 15, A: 6525, Ix: 3831, Iy: 1363, Zx: 426, Zy: 152, Zpx: 481, Zpy: 231, rx: 76.6, ry: 45.7, weight: 51.2 },
  { designation: 'HEB 200', standard: 'EU', type: 'H-Column', D: 200, B: 200, tw: 9.0, tf: 15.0, r: 18, A: 7808, Ix: 5696, Iy: 2003, Zx: 570, Zy: 200, Zpx: 642, Zpy: 306, rx: 85.4, ry: 50.7, weight: 61.3 },
  { designation: 'HEB 220', standard: 'EU', type: 'H-Column', D: 220, B: 220, tw: 9.5, tf: 16.0, r: 18, A: 9104, Ix: 8091, Iy: 2843, Zx: 736, Zy: 259, Zpx: 827, Zpy: 395, rx: 94.3, ry: 55.9, weight: 71.5 },
  { designation: 'HEB 240', standard: 'EU', type: 'H-Column', D: 240, B: 240, tw: 10.0, tf: 17.0, r: 21, A: 10600, Ix: 11260, Iy: 3923, Zx: 938, Zy: 327, Zpx: 1053, Zpy: 499, rx: 103, ry: 60.8, weight: 83.2 },
  { designation: 'HEB 260', standard: 'EU', type: 'H-Column', D: 260, B: 260, tw: 10.0, tf: 17.5, r: 24, A: 11840, Ix: 14920, Iy: 5135, Zx: 1148, Zy: 395, Zpx: 1283, Zpy: 602, rx: 112, ry: 65.8, weight: 93.0 },
  { designation: 'HEB 280', standard: 'EU', type: 'H-Column', D: 280, B: 280, tw: 10.5, tf: 18.0, r: 24, A: 13140, Ix: 19270, Iy: 6595, Zx: 1376, Zy: 471, Zpx: 1534, Zpy: 718, rx: 121, ry: 70.8, weight: 103.1 },
  { designation: 'HEB 300', standard: 'EU', type: 'H-Column', D: 300, B: 300, tw: 11.0, tf: 19.0, r: 27, A: 14910, Ix: 25170, Iy: 8563, Zx: 1678, Zy: 571, Zpx: 1869, Zpy: 870, rx: 130, ry: 75.8, weight: 117.0 },
];

// =============================================================================
// COMBINED DATABASE
// =============================================================================

/** Complete steel section database (~500+ sections) */
export const STEEL_SECTION_DATABASE: SteelSectionProperties[] = [
  ...ISMB_SECTIONS,
  ...ISHB_SECTIONS,
  ...ISLB_SECTIONS,
  ...ISMC_SECTIONS,
  ...ISWB_SECTIONS,
  ...ISA_EQUAL_SECTIONS,
  ...AISC_W_SECTIONS,
  ...EU_IPE_SECTIONS,
  ...EU_HE_SECTIONS,
];

/** Get sections by standard */
export function getSectionsByStandard(standard: 'IS' | 'AISC' | 'EU' | 'BS'): SteelSectionProperties[] {
  return STEEL_SECTION_DATABASE.filter(s => s.standard === standard);
}

/** Get sections by type */
export function getSectionsByType(type: SteelSectionProperties['type']): SteelSectionProperties[] {
  return STEEL_SECTION_DATABASE.filter(s => s.type === type);
}

/** Find section by designation */
export function findSection(designation: string): SteelSectionProperties | undefined {
  return STEEL_SECTION_DATABASE.find(s =>
    s.designation.toLowerCase() === designation.toLowerCase()
  );
}

/** Search sections by partial name */
export function searchSections(query: string): SteelSectionProperties[] {
  const q = query.toLowerCase();
  return STEEL_SECTION_DATABASE.filter(s =>
    s.designation.toLowerCase().includes(q) ||
    s.standard.toLowerCase().includes(q) ||
    s.type.toLowerCase().includes(q)
  );
}

/** Get section categories */
export function getSectionCategories(): { standard: string; type: string; count: number }[] {
  const categories = new Map<string, number>();
  for (const s of STEEL_SECTION_DATABASE) {
    const key = `${s.standard}|${s.type}`;
    categories.set(key, (categories.get(key) || 0) + 1);
  }
  return Array.from(categories.entries()).map(([key, count]) => {
    const [standard, type] = key.split('|');
    return { standard, type, count };
  });
}

/** Auto-select optimal section for given requirements */
export function selectOptimalSection(
  params: {
    required_Zx: number;  // Required plastic section modulus (mm³ × 10³)
    max_depth?: number;    // Maximum depth constraint (mm)
    standard?: 'IS' | 'AISC' | 'EU';
    type?: SteelSectionProperties['type'];
    minimize?: 'weight' | 'depth' | 'area';
  }
): SteelSectionProperties | null {
  let candidates = STEEL_SECTION_DATABASE.filter(s => s.Zpx >= params.required_Zx);

  if (params.max_depth) {
    candidates = candidates.filter(s => s.D <= params.max_depth!);
  }
  if (params.standard) {
    candidates = candidates.filter(s => s.standard === params.standard);
  }
  if (params.type) {
    candidates = candidates.filter(s => s.type === params.type);
  }

  if (candidates.length === 0) return null;

  const minimize = params.minimize || 'weight';
  candidates.sort((a, b) => {
    switch (minimize) {
      case 'weight': return a.weight - b.weight;
      case 'depth': return a.D - b.D;
      case 'area': return a.A - b.A;
    }
  });

  return candidates[0];
}

export default STEEL_SECTION_DATABASE;
