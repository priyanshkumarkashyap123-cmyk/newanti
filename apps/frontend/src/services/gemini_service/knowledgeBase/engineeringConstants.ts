export type SteelSectionProperties = {
  depth: number;
  width: number;
  tw: number;
  tf: number;
  area: number;
  weight: number;
  Ixx: number;
  Iyy: number;
  Zxx: number;
  rxx: number;
  ryy: number;
};

export const LOAD_COMBINATIONS = {
  ULS_1: { name: '1.5(DL+LL)', DL: 1.5, LL: 1.5, WL: 0, EQ: 0 },
  ULS_2: { name: '1.5(DL+WL)', DL: 1.5, LL: 0, WL: 1.5, EQ: 0 },
  ULS_3: { name: '1.2(DL+LL+WL)', DL: 1.2, LL: 1.2, WL: 1.2, EQ: 0 },
  ULS_4: { name: '1.5(DL+EQ)', DL: 1.5, LL: 0, WL: 0, EQ: 1.5 },
  ULS_5: { name: '1.2(DL+LL+EQ)', DL: 1.2, LL: 1.2, WL: 0, EQ: 1.2 },
  ULS_6: { name: '0.9DL+1.5WL', DL: 0.9, LL: 0, WL: 1.5, EQ: 0 },
  SLS_1: { name: '1.0(DL+LL)', DL: 1.0, LL: 1.0, WL: 0, EQ: 0 },
  SLS_2: { name: '1.0(DL+0.8LL+0.8WL)', DL: 1.0, LL: 0.8, WL: 0.8, EQ: 0 },
} as const;

export const DEFLECTION_LIMITS = {
  floor_beam: { limit: 'L/300', description: 'Floor beams supporting brittle finishes' },
  floor_beam_general: { limit: 'L/240', description: 'Floor beams general' },
  roof_purlin: { limit: 'L/180', description: 'Purlins and roof sheeting' },
  crane_girder: { limit: 'L/500', description: 'Crane girders (vertical)' },
  crane_girder_h: { limit: 'L/400', description: 'Crane girders (horizontal)' },
  cantilever: { limit: 'L/150', description: 'Cantilever beams' },
  column_drift: { limit: 'H/300', description: 'Column drift under wind/seismic' },
  total_drift: { limit: 'H/500', description: 'Total building drift' },
} as const;

export const STEEL_SECTIONS: Record<string, SteelSectionProperties> = {
  'ISMB 150': { depth: 150, width: 80, tw: 4.8, tf: 7.6, area: 19.0, weight: 14.9, Ixx: 726, Iyy: 53, Zxx: 96.9, rxx: 6.18, ryy: 1.67 },
  'ISMB 200': { depth: 200, width: 100, tw: 5.7, tf: 10.8, area: 32.3, weight: 25.4, Ixx: 2235, Iyy: 150, Zxx: 224, rxx: 8.32, ryy: 2.15 },
  'ISMB 250': { depth: 250, width: 125, tw: 6.9, tf: 12.5, area: 47.1, weight: 37.3, Ixx: 5132, Iyy: 335, Zxx: 411, rxx: 10.4, ryy: 2.67 },
  'ISMB 300': { depth: 300, width: 140, tw: 7.7, tf: 13.1, area: 58.9, weight: 46.2, Ixx: 8603, Iyy: 454, Zxx: 574, rxx: 12.1, ryy: 2.78 },
  'ISMB 350': { depth: 350, width: 140, tw: 8.1, tf: 14.2, area: 66.7, weight: 52.4, Ixx: 13630, Iyy: 538, Zxx: 779, rxx: 14.3, ryy: 2.84 },
  'ISMB 400': { depth: 400, width: 140, tw: 8.9, tf: 16.0, area: 78.5, weight: 61.6, Ixx: 20500, Iyy: 622, Zxx: 1022, rxx: 16.2, ryy: 2.82 },
  'ISMB 450': { depth: 450, width: 150, tw: 9.4, tf: 17.4, area: 92.3, weight: 72.4, Ixx: 30390, Iyy: 834, Zxx: 1350, rxx: 18.1, ryy: 3.01 },
  'ISMB 500': { depth: 500, width: 180, tw: 10.2, tf: 17.2, area: 110.7, weight: 86.9, Ixx: 45220, Iyy: 1370, Zxx: 1808, rxx: 20.2, ryy: 3.52 },
  'ISMB 550': { depth: 550, width: 190, tw: 11.2, tf: 19.3, area: 132.1, weight: 103.7, Ixx: 64900, Iyy: 1830, Zxx: 2360, rxx: 22.2, ryy: 3.73 },
  'ISMB 600': { depth: 600, width: 210, tw: 12.0, tf: 20.8, area: 156.2, weight: 122.6, Ixx: 91800, Iyy: 2650, Zxx: 3060, rxx: 24.2, ryy: 4.12 },
  'ISHB 150': { depth: 150, width: 150, tw: 5.4, tf: 9.0, area: 34.5, weight: 27.1, Ixx: 1456, Iyy: 432, Zxx: 194, rxx: 6.50, ryy: 3.54 },
  'ISHB 200': { depth: 200, width: 200, tw: 6.1, tf: 9.0, area: 47.5, weight: 37.3, Ixx: 3608, Iyy: 967, Zxx: 361, rxx: 8.72, ryy: 4.51 },
  'ISHB 250': { depth: 250, width: 250, tw: 6.9, tf: 9.7, area: 65.0, weight: 51.0, Ixx: 7740, Iyy: 1961, Zxx: 619, rxx: 10.9, ryy: 5.49 },
  'ISHB 300': { depth: 300, width: 250, tw: 7.6, tf: 10.6, area: 75.0, weight: 58.8, Ixx: 12550, Iyy: 2194, Zxx: 837, rxx: 12.9, ryy: 5.41 },
  'ISHB 350': { depth: 350, width: 250, tw: 8.3, tf: 11.6, area: 85.6, weight: 67.4, Ixx: 19160, Iyy: 2451, Zxx: 1094, rxx: 15.0, ryy: 5.35 },
  'ISHB 400': { depth: 400, width: 250, tw: 9.1, tf: 12.7, area: 97.8, weight: 76.8, Ixx: 28080, Iyy: 2728, Zxx: 1404, rxx: 16.9, ryy: 5.28 },
  'ISHB 450': { depth: 450, width: 250, tw: 9.8, tf: 13.7, area: 109.7, weight: 86.1, Ixx: 39210, Iyy: 2987, Zxx: 1743, rxx: 18.9, ryy: 5.22 },
  'ISMC 75': { depth: 75, width: 40, tw: 4.4, tf: 7.3, area: 8.7, weight: 6.8, Ixx: 76, Iyy: 12.5, Zxx: 20.2, rxx: 2.95, ryy: 1.20 },
  'ISMC 100': { depth: 100, width: 50, tw: 5.0, tf: 7.7, area: 11.7, weight: 9.2, Ixx: 187, Iyy: 26.0, Zxx: 37.3, rxx: 4.00, ryy: 1.49 },
  'ISMC 125': { depth: 125, width: 65, tw: 5.3, tf: 8.2, area: 16.2, weight: 12.7, Ixx: 416, Iyy: 60.0, Zxx: 66.5, rxx: 5.07, ryy: 1.92 },
  'ISMC 150': { depth: 150, width: 75, tw: 5.7, tf: 9.0, area: 20.9, weight: 16.4, Ixx: 779, Iyy: 103, Zxx: 104, rxx: 6.11, ryy: 2.22 },
  'ISMC 200': { depth: 200, width: 75, tw: 6.2, tf: 11.4, area: 28.2, weight: 22.1, Ixx: 1819, Iyy: 141, Zxx: 182, rxx: 8.03, ryy: 2.24 },
  'ISMC 250': { depth: 250, width: 80, tw: 7.1, tf: 14.1, area: 39.0, weight: 30.6, Ixx: 3817, Iyy: 211, Zxx: 306, rxx: 9.89, ryy: 2.33 },
  'ISMC 300': { depth: 300, width: 90, tw: 7.8, tf: 13.6, area: 46.3, weight: 36.3, Ixx: 6362, Iyy: 310, Zxx: 424, rxx: 11.7, ryy: 2.59 },
  'ISA 50x50x5': { depth: 50, width: 50, tw: 5, tf: 5, area: 4.8, weight: 3.8, Ixx: 11.0, Iyy: 11.0, Zxx: 3.1, rxx: 1.51, ryy: 1.51 },
  'ISA 65x65x6': { depth: 65, width: 65, tw: 6, tf: 6, area: 7.4, weight: 5.8, Ixx: 28.2, Iyy: 28.2, Zxx: 6.1, rxx: 1.95, ryy: 1.95 },
  'ISA 75x75x8': { depth: 75, width: 75, tw: 8, tf: 8, area: 11.4, weight: 8.9, Ixx: 59.3, Iyy: 59.3, Zxx: 11.1, rxx: 2.28, ryy: 2.28 },
  'ISA 90x90x10': { depth: 90, width: 90, tw: 10, tf: 10, area: 17.0, weight: 13.4, Ixx: 127, Iyy: 127, Zxx: 19.8, rxx: 2.73, ryy: 2.73 },
  'ISA 100x100x10': { depth: 100, width: 100, tw: 10, tf: 10, area: 19.0, weight: 14.9, Ixx: 177, Iyy: 177, Zxx: 24.9, rxx: 3.05, ryy: 3.05 },
  'ISA 100x100x12': { depth: 100, width: 100, tw: 12, tf: 12, area: 22.6, weight: 17.7, Ixx: 207, Iyy: 207, Zxx: 29.3, rxx: 3.03, ryy: 3.03 },
  'ISA 150x150x15': { depth: 150, width: 150, tw: 15, tf: 15, area: 43.0, weight: 33.8, Ixx: 699, Iyy: 699, Zxx: 66.4, rxx: 4.03, ryy: 4.03 },
};
