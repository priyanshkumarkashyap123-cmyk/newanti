/**
 * Code Clause References
 * Quick-reference database for IS 456, IS 800, AISC 360, ACI 318 clauses
 * used in design results. Each entry provides the clause number, title,
 * a brief summary, and the key formula.
 */

export interface CodeClause {
  code: string;
  clause: string;
  title: string;
  summary: string;
  formula?: string;
}

export const codeClauses: Record<string, CodeClause> = {
  // === IS 456:2000 — Concrete ===
  'IS456_38.1': {
    code: 'IS 456:2000',
    clause: 'Cl. 38.1',
    title: 'Flexural Strength — Singly Reinforced',
    summary: 'Ultimate moment of resistance for rectangular sections assuming parabolic-rectangular stress block with xu/d ≤ xu,max/d.',
    formula: 'Mu = 0.36 fck · b · xu (d − 0.42 xu)'
  },
  'IS456_40.1': {
    code: 'IS 456:2000',
    clause: 'Cl. 40.1',
    title: 'Nominal Shear Stress',
    summary: 'Nominal shear stress τv = Vu/(bd). Compare against design shear strength τc from Table 19.',
    formula: 'τv = Vu / (b · d)'
  },
  'IS456_40.4': {
    code: 'IS 456:2000',
    clause: 'Cl. 40.4',
    title: 'Minimum Shear Reinforcement',
    summary: 'When τv > τc, vertical stirrups required. Spacing ≤ 0.75d or 300 mm.',
    formula: 'Asv / (b·sv) ≥ 0.4 / (0.87 fy)'
  },
  'IS456_41.1': {
    code: 'IS 456:2000',
    clause: 'Cl. 41.1',
    title: 'Torsion — Equivalent Shear & Moment',
    summary: 'Equivalent shear Ve = Vu + 1.6(Tu/b). Equivalent moment Me = Mu + Mt where Mt = Tu(1 + D/b)/1.7.',
    formula: 'Ve = Vu + 1.6 Tu/b'
  },
  'IS456_26.4': {
    code: 'IS 456:2000',
    clause: 'Cl. 26.4',
    title: 'Minimum Clear Cover',
    summary: 'Cover depends on exposure: mild 20mm, moderate 30mm, severe 45mm, very severe 50mm, extreme 75mm.',
  },
  'IS456_26.5.1.1': {
    code: 'IS 456:2000',
    clause: 'Cl. 26.5.1.1',
    title: 'Minimum Tension Reinforcement',
    summary: 'Minimum area of tension reinforcement As,min = 0.85bd/fy (beams).',
    formula: 'As,min = 0.85 b d / fy'
  },
  'IS456_26.5.2.1': {
    code: 'IS 456:2000',
    clause: 'Cl. 26.5.2.1',
    title: 'Minimum Reinforcement in Slabs',
    summary: 'Minimum reinforcement: 0.12% for HYSD bars, 0.15% for mild steel.',
    formula: 'As,min = 0.12% × b × D (for Fe 415/500)'
  },
  'IS456_39.3': {
    code: 'IS 456:2000',
    clause: 'Cl. 39.3',
    title: 'Short Column — Axial Load Capacity',
    summary: 'Pu = 0.4 fck Ac + 0.67 fy Asc. For columns with slenderness ratio ≤ 12.',
    formula: 'Pu = 0.4 fck Ac + 0.67 fy Asc'
  },
  'IS456_34.2': {
    code: 'IS 456:2000',
    clause: 'Cl. 34.2',
    title: 'Punching Shear in Footings',
    summary: 'Critical section at d/2 from column face. Punching shear stress ≤ ks × 0.25√fck.',
    formula: 'τv = Vu / (bo · d), where bo = perimeter at d/2 from column'
  },

  // === IS 800:2007 — Steel ===
  'IS800_8.2.1': {
    code: 'IS 800:2007',
    clause: 'Cl. 8.2.1',
    title: 'Design Strength in Flexure',
    summary: 'Md = βb × Zp × fy / γm0. For compact sections βb = 1.0.',
    formula: 'Md = Zp × fy / γm0'
  },
  'IS800_7.1.2': {
    code: 'IS 800:2007',
    clause: 'Cl. 7.1.2',
    title: 'Design Compressive Strength',
    summary: 'Pd = Ae × fcd, where fcd depends on slenderness ratio λ and buckling class (a/b/c/d).',
    formula: 'Pd = Ae × fy / (γm0 × φ + [φ² − λ²]^0.5)'
  },

  // === AISC 360-16 — Steel ===
  'AISC_E3': {
    code: 'AISC 360-16',
    clause: 'Sec. E3',
    title: 'Compression — Flexural Buckling',
    summary: 'Nominal compressive strength Pn = Fcr × Ag. Fcr depends on KL/r vs 4.71√(E/Fy).',
    formula: 'Pn = Fcr × Ag'
  },
  'AISC_F2': {
    code: 'AISC 360-16',
    clause: 'Sec. F2',
    title: 'Flexure — Doubly Symmetric I-Shapes',
    summary: 'Mn = Mp for Lb ≤ Lp. Mn = Cb[Mp − (Mp − 0.7FySx)(Lb−Lp)/(Lr−Lp)] for Lp < Lb ≤ Lr.',
    formula: 'Mn = min(Mp, Cb × [Mp − (Mp − 0.7FySx)(Lb−Lp)/(Lr−Lp)])'
  },
  'AISC_F1-1': {
    code: 'AISC 360-16',
    clause: 'Eq. F1-1',
    title: 'Lateral-Torsional Buckling Modification Factor',
    summary: 'Cb = 12.5 Mmax / (2.5 Mmax + 3 MA + 4 MB + 3 MC). Cb = 1.0 is conservative for uniform moment.',
    formula: 'Cb = 12.5 Mmax / (2.5 Mmax + 3 MA + 4 MB + 3 MC)'
  },
  'AISC_G2': {
    code: 'AISC 360-16',
    clause: 'Sec. G2',
    title: 'Shear Strength',
    summary: 'Vn = 0.6 Fy Aw Cv1. For most rolled W-shapes, Cv1 = 1.0.',
    formula: 'Vn = 0.6 Fy Aw Cv1'
  },
  'AISC_H1': {
    code: 'AISC 360-16',
    clause: 'Sec. H1',
    title: 'Combined Forces Interaction',
    summary: 'For Pr/Pc ≥ 0.2: Pr/Pc + (8/9)(Mrx/Mcx + Mry/Mcy) ≤ 1.0.',
    formula: 'Pr/Pc + (8/9)(Mrx/Mcx + Mry/Mcy) ≤ 1.0'
  },
};

/** Look up a clause by its key or by searching clause text */
export function findClause(key: string): CodeClause | undefined {
  return codeClauses[key];
}

/** Get all clauses for a specific code (e.g., 'IS 456') */
export function getClausesByCode(codePrefix: string): CodeClause[] {
  return Object.values(codeClauses).filter(c => c.code.startsWith(codePrefix));
}
