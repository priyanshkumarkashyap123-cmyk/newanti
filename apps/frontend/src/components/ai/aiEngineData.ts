/**
 * Engineering reference data — steel sections, materials, and formulas.
 * Used by BeamLabAIEngine handler modules.
 */

// ============================================
// SECTION DATABASE
// ============================================

export const STEEL_SECTIONS: Record<
  string,
  {
    h: number;
    b: number;
    tw: number;
    tf: number;
    A: number;
    Ixx: number;
    Iyy: number;
    Zxx: number;
    Zyy: number;
    rxx: number;
    ryy: number;
    weight: number;
  }
> = {
  ISMB100: { h: 100, b: 75, tw: 4.0, tf: 7.2, A: 14.6, Ixx: 258, Iyy: 40.9, Zxx: 51.7, Zyy: 10.9, rxx: 42.1, ryy: 16.7, weight: 11.5 },
  ISMB150: { h: 150, b: 80, tw: 4.8, tf: 7.6, A: 19.0, Ixx: 726, Iyy: 52.6, Zxx: 96.9, Zyy: 13.2, rxx: 61.8, ryy: 16.6, weight: 14.9 },
  ISMB200: { h: 200, b: 100, tw: 5.7, tf: 10.8, A: 32.3, Ixx: 2235, Iyy: 150, Zxx: 223.5, Zyy: 30.0, rxx: 83.2, ryy: 21.6, weight: 25.4 },
  ISMB250: { h: 250, b: 125, tw: 6.9, tf: 12.5, A: 47.5, Ixx: 5132, Iyy: 335, Zxx: 410.5, Zyy: 53.5, rxx: 104.0, ryy: 26.5, weight: 37.3 },
  ISMB300: { h: 300, b: 140, tw: 7.7, tf: 13.1, A: 58.9, Ixx: 8986, Iyy: 454, Zxx: 599.1, Zyy: 64.8, rxx: 123.5, ryy: 27.8, weight: 46.2 },
  ISMB350: { h: 350, b: 140, tw: 8.1, tf: 14.2, A: 66.7, Ixx: 13158, Iyy: 538, Zxx: 751.9, Zyy: 76.9, rxx: 140.4, ryy: 28.4, weight: 52.4 },
  ISMB400: { h: 400, b: 140, tw: 8.9, tf: 16.0, A: 78.5, Ixx: 20458, Iyy: 622, Zxx: 1022.9, Zyy: 88.9, rxx: 161.5, ryy: 28.2, weight: 61.6 },
  ISMB450: { h: 450, b: 150, tw: 9.4, tf: 17.4, A: 92.3, Ixx: 30391, Iyy: 834, Zxx: 1350.7, Zyy: 111.2, rxx: 181.5, ryy: 30.1, weight: 72.4 },
  ISMB500: { h: 500, b: 180, tw: 10.2, tf: 17.2, A: 110.7, Ixx: 45218, Iyy: 1370, Zxx: 1808.7, Zyy: 152.2, rxx: 202.2, ryy: 35.2, weight: 86.9 },
  ISMB550: { h: 550, b: 190, tw: 11.2, tf: 19.3, A: 132.1, Ixx: 64894, Iyy: 1833, Zxx: 2360.0, Zyy: 193.0, rxx: 221.6, ryy: 37.3, weight: 103.7 },
  ISMB600: { h: 600, b: 210, tw: 12.0, tf: 20.8, A: 156.2, Ixx: 91813, Iyy: 2649, Zxx: 3060.4, Zyy: 252.3, rxx: 242.4, ryy: 41.2, weight: 122.6 },
};

// ============================================
// MATERIAL DATABASE
// ============================================

export const MATERIALS = {
  steel: {
    E250: { fy: 250, fu: 410, E: 200000, density: 7850, nu: 0.3 },
    E300: { fy: 300, fu: 440, E: 200000, density: 7850, nu: 0.3 },
    E350: { fy: 350, fu: 490, E: 200000, density: 7850, nu: 0.3 },
    E450: { fy: 450, fu: 570, E: 200000, density: 7850, nu: 0.3 },
    E550: { fy: 550, fu: 650, E: 200000, density: 7850, nu: 0.3 },
  },
  concrete: {
    M15: { fck: 15, E: 19365, density: 2400 },
    M20: { fck: 20, E: 22361, density: 2400 },
    M25: { fck: 25, E: 25000, density: 2400 },
    M30: { fck: 30, E: 27386, density: 2400 },
    M35: { fck: 35, E: 29580, density: 2400 },
    M40: { fck: 40, E: 31623, density: 2400 },
    M50: { fck: 50, E: 35355, density: 2400 },
  },
} as const;

// ============================================
// FORMULA DATABASE
// ============================================

export const FORMULAS: Record<
  string,
  { formula: string; description: string; variables: string }
> = {
  euler_buckling: { formula: "Pcr = pi^2 * E * I / (K * L)^2", description: "Euler critical buckling load", variables: "E=elastic modulus, I=moment of inertia, K=effective length factor, L=member length" },
  bending_stress: { formula: "sigma = M * y / I  or  sigma = M / Z", description: "Bending stress", variables: "M=bending moment, y=distance from NA, I=moment of inertia, Z=section modulus" },
  shear_stress: { formula: "tau = V * Q / (I * b)", description: "Shear stress (general)", variables: "V=shear force, Q=first moment, I=second moment, b=width at cut" },
  deflection_ss_udl: { formula: "delta = 5 * w * L^4 / (384 * E * I)", description: "Simply supported beam — UDL", variables: "w=load/m, L=span, E=modulus, I=moment of inertia" },
  deflection_ss_pt: { formula: "delta = P * L^3 / (48 * E * I)", description: "Simply supported beam — point load at mid", variables: "P=load, L=span, E=modulus, I=moment of inertia" },
  deflection_cant_udl: { formula: "delta = w * L^4 / (8 * E * I)", description: "Cantilever — UDL", variables: "w=load/m, L=span, E=modulus, I=moment of inertia" },
  deflection_cant_pt: { formula: "delta = P * L^3 / (3 * E * I)", description: "Cantilever — point load at free end", variables: "P=load, L=span, E=modulus, I=moment of inertia" },
  moment_ss_udl: { formula: "M_max = w * L^2 / 8", description: "Max moment — simply supported with UDL", variables: "w=load/m, L=span" },
  moment_ss_pt: { formula: "M_max = P * L / 4", description: "Max moment — simply supported with central point load", variables: "P=point load, L=span" },
  moment_cant_udl: { formula: "M_max = w * L^2 / 2", description: "Max moment — cantilever with UDL", variables: "w=load/m, L=span" },
  moment_fixed_udl: { formula: "M_support = w * L^2 / 12, M_mid = w * L^2 / 24", description: "Fixed-fixed beam with UDL", variables: "w=load/m, L=span" },
  slenderness: { formula: "lambda = K * L / r", description: "Slenderness ratio", variables: "K=effective length factor, L=member length, r=radius of gyration" },
  plastic_moment: { formula: "Mp = Zp * fy", description: "Plastic moment capacity", variables: "Zp=plastic section modulus, fy=yield stress" },
  shear_capacity: { formula: "Vd = Av * fy / (sqrt(3) * gamma_m0)", description: "Design shear capacity (IS 800)", variables: "Av=shear area, fy=yield stress, gamma_m0=1.10" },
  tension_capacity: { formula: "Td = 0.9 * An * fu / gamma_m1", description: "Tension design strength (IS 800)", variables: "An=net area, fu=ultimate stress, gamma_m1=1.25" },
};
