import type { Member, Node as ModelNode, MemberForceData } from '../../store/model';
import { STEEL_SECTION_DATABASE as STEEL_SECTIONS, type SteelSectionProperties } from '../../data/SteelSectionDatabase';
import { REPORT_TYPE_DEFINITIONS, type ReportType } from '../../modules/reporting/config/reportTemplateConfig';

export type DesignTab = 'overview' | 'steel' | 'concrete' | 'slabs' | 'connections' | 'foundations' | 'optimization' | 'detailing' | 'report';

export interface DesignCodeOption {
  id: string;
  name: string;
  fullName: string;
  region: string;
  material: 'steel' | 'concrete' | 'timber' | 'composite';
  icon: string;
}

export interface MemberDesignResult {
  memberId: string;
  memberName: string;
  code: string;
  section: string;
  utilizationRatio: number;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_CHECKED';
  governingCheck: string;
  checks: Array<{ name: string; clause?: string; ratio: number; status: string }>;
  forces: { N: number; Vy: number; Vz: number; My: number; Mz: number };
  capacities?: { tension: number; compression: number; moment: number; shear: number };
}

export interface MemberRow {
  id: string;
  label: string;
  length: number;
  sectionId: string;
  sectionName: string;
  materialType: 'steel' | 'concrete';
  forces: MemberForceData | null;
  maxAxial: number;
  maxShearY: number;
  maxMomentZ: number;
  selected: boolean;
  designResult: MemberDesignResult | null;
}

export interface SlabDesignRecord {
  plateId: string;
  label: string;
  lx: number;
  ly: number;
  area: number;
  existingThicknessMm: number;
  recommendedThicknessMm: number;
  utilizationRatio: number;
  result: {
    main_reinforcement?: { diameter: number; spacing: number };
    [key: string]: unknown;
  };
}

export interface DesignParameters {
  steelCode: string;
  concreteCode: string;
  steelGrade: string;
  concreteGrade: string;
  rebarGrade: string;
  designMethod: 'LRFD' | 'ASD';
  effectiveLengthFactorY: number;
  effectiveLengthFactorZ: number;
  unbracedLengthRatio: number;
  Cb: number;
  gammaMo: number;
  gammaM1: number;
}

export interface ClientDesignInput {
  section: { A: number; D: number; B: number; tw: number; tf: number; Ix: number; Iy: number; rx: number; ry: number; Zpx: number; Zpy: number; designation: string };
  lengthMM: number;
  forces: { N: number; Vy: number; Vz: number; My: number; Mz: number };
  material: { fy: number; fu: number; E: number };
  Ky: number;
  Kz: number;
  Lb_ratio: number;
  Cb: number;
  code: string;
}

export interface ConcreteDesignInput {
  width: number;
  depth: number;
  cover: number;
  fck: number;
  fy: number;
  Mu: number;
  Vu: number;
  Nu: number;
  code: 'IS456' | 'ACI318';
}

export interface ConcreteDesignOutput {
  status: 'PASS' | 'FAIL';
  utilizationRatio: number;
  governingCheck: string;
  checks: Array<{ name: string; clause?: string; ratio: number; status: string }>;
  flexure: { Mu_capacity: number; Ast_required: number; Ast_provided: number; barConfig: string };
  shear: { Vu_capacity: number; Asv_required: number; stirrupConfig: string };
}

export const DESIGN_CODES: DesignCodeOption[] = [
  { id: 'AISC360', name: 'AISC 360-22', fullName: 'Specification for Structural Steel Buildings', region: 'USA', material: 'steel', icon: '🇺🇸' },
  { id: 'IS800', name: 'IS 800:2007', fullName: 'General Construction in Steel — Code of Practice', region: 'India', material: 'steel', icon: '🇮🇳' },
  { id: 'EC3', name: 'Eurocode 3', fullName: 'EN 1993-1-1 — Design of Steel Structures', region: 'Europe', material: 'steel', icon: '🇪🇺' },
  { id: 'BS5950', name: 'BS 5950', fullName: 'Structural Use of Steelwork in Building', region: 'UK', material: 'steel', icon: '🇬🇧' },
  { id: 'AS4100', name: 'AS 4100', fullName: 'Steel Structures', region: 'Australia', material: 'steel', icon: '🇦🇺' },
  { id: 'IS456', name: 'IS 456:2000', fullName: 'Plain and Reinforced Concrete — Code of Practice', region: 'India', material: 'concrete', icon: '🇮🇳' },
  { id: 'ACI318', name: 'ACI 318-19', fullName: 'Building Code Requirements for Structural Concrete', region: 'USA', material: 'concrete', icon: '🇺🇸' },
  { id: 'EC2', name: 'Eurocode 2', fullName: 'EN 1992-1-1 — Design of Concrete Structures', region: 'Europe', material: 'concrete', icon: '🇪🇺' },
  { id: 'NDS', name: 'NDS 2018', fullName: 'National Design Specification for Wood Construction', region: 'USA', material: 'timber', icon: '🌲' },
];

export const STEEL_CODES = DESIGN_CODES.filter((c) => c.material === 'steel');
export const CONCRETE_CODES = DESIGN_CODES.filter((c) => c.material === 'concrete');

export const REPORT_TYPE_OPTIONS: Array<{ id: ReportType; name: string; description: string }> = Object.entries(REPORT_TYPE_DEFINITIONS).map(([id, value]) => ({
  id: id as ReportType,
  name: value.name,
  description: value.description,
}));

export function getMemberLength(member: Member, nodes: Map<string, ModelNode>): number {
  const n1 = nodes.get(member.startNodeId);
  const n2 = nodes.get(member.endNodeId);
  if (!n1 || !n2) return 0;
  return Math.sqrt((n2.x - n1.x) ** 2 + (n2.y - n1.y) ** 2 + (n2.z - n1.z) ** 2);
}

export function getMaxForce(f: MemberForceData | null, key: 'axial' | 'shearY' | 'shearZ' | 'momentY' | 'momentZ'): number {
  if (!f) return 0;
  const start = f.startForces?.[key] ?? 0;
  const end = f.endForces?.[key] ?? 0;
  return Math.max(Math.abs(f[key] || 0), Math.abs(start), Math.abs(end));
}

export function getDesignSectionByIdOrName(idOrName: string): SteelSectionProperties | undefined {
  return STEEL_SECTIONS.find((s) => s.designation === idOrName);
}

export function clientSideDesignSteel(input: ClientDesignInput): MemberDesignResult & { _section: string } {
  const { section: s, lengthMM, forces, material, Ky, Kz, code } = input;
  const fy = material.fy;
  const fu = material.fu;
  const E = material.E;
  const gamma_m0 = code === 'IS800' ? 1.10 : 1.0;
  const gamma_m1 = code === 'IS800' ? 1.25 : 1.0;
  const phi_c = code === 'IS800' ? 1.0 : 0.90;
  const phi_b = code === 'IS800' ? 1.0 : 0.90;
  const phi_t = code === 'IS800' ? 1.0 : 0.90;
  const phi_v = code === 'IS800' ? 1.0 : 1.00;
  const A = s.A;
  const Iy = s.Ix * 1e4;
  const Iz = s.Iy * 1e4;
  const ry_mm = s.rx;
  const rz_mm = s.ry;
  const Zpy = s.Zpx * 1e3;
  const Zpz = s.Zpy * 1e3;
  const Aw = s.D * s.tw;
  const Td = code === 'IS800' ? (fy * A) / gamma_m0 / 1000 : phi_t * fy * A / 1000;
  const KLy = Ky * lengthMM;
  const KLz = Kz * lengthMM;
  const lambda_y = KLy / ry_mm;
  const lambda_z = KLz / rz_mm;
  const lambda_max = Math.max(lambda_y, lambda_z);
  const fe = (Math.PI ** 2 * E) / (lambda_max ** 2);
  let Pd: number;
  if (code === 'IS800') {
    const lambda_nd = Math.sqrt(fy / fe);
    const alpha = 0.49;
    const phi = 0.5 * (1 + alpha * (lambda_nd - 0.2) + lambda_nd ** 2);
    const chi = Math.min(1.0 / (phi + Math.sqrt(phi ** 2 - lambda_nd ** 2)), 1.0);
    const fcd = chi * fy / gamma_m0;
    Pd = A * fcd / 1000;
  } else {
    if (lambda_max <= 4.71 * Math.sqrt(E / fy)) {
      const Fcr = 0.658 ** (fy / fe) * fy;
      Pd = phi_c * Fcr * A / 1000;
    } else {
      const Fcr = 0.877 * fe;
      Pd = phi_c * Fcr * A / 1000;
    }
  }
  const Lb = input.Lb_ratio * lengthMM;
  const Zey = Iy / (s.D / 2);
  const Mp = Zpy * fy / 1e6;
  let Md: number;
  if (code === 'IS800') {
    const beta_b = 1.0;
    const hw_ltb = s.D - 2 * s.tf;
    const J_ltb = (1 / 3) * (2 * s.B * s.tf ** 3 + hw_ltb * s.tw ** 3);
    const hs_ltb = s.D - s.tf;
    const Iw_ltb = Iy * hs_ltb ** 2 / 4;
    const G_ltb = E / (2 * (1 + 0.3));
    const Mcr_approx = (Math.PI ** 2 * E * Iz / (Lb ** 2)) * Math.sqrt(Iw_ltb / Iz + (Lb ** 2 * G_ltb * J_ltb) / (Math.PI ** 2 * E * Iz));
    const lambda_lt = Math.sqrt(beta_b * Zpy * fy / (Mcr_approx > 0 ? Mcr_approx : 1e10));
    const alpha_lt = 0.49;
    const phi_lt = 0.5 * (1 + alpha_lt * (lambda_lt - 0.2) + lambda_lt ** 2);
    const chi_lt = Math.min(1.0 / (phi_lt + Math.sqrt(Math.max(phi_lt ** 2 - lambda_lt ** 2, 0.001))), 1.0);
    Md = beta_b * Zpy * fy * chi_lt / gamma_m0 / 1e6;
  } else {
    const ry_aisc = Math.sqrt(Iz / A);
    const hw_aisc = s.D - 2 * s.tf;
    const J_aisc = (1 / 3) * (2 * s.B * s.tf ** 3 + hw_aisc * s.tw ** 3);
    const rts_sq = Math.sqrt(Iz * (s.D - s.tf) ** 2 / 4) / Zey;
    const rts = Math.sqrt(Math.max(rts_sq, 1));
    const c_aisc = 1.0;
    const Lp_aisc = 1.76 * ry_aisc * Math.sqrt(E / fy);
    const Lr_aisc = 1.95 * rts * (E / (0.7 * fy)) * Math.sqrt(J_aisc * c_aisc / (Zey * (s.D - s.tf)) + Math.sqrt((J_aisc * c_aisc / (Zey * (s.D - s.tf))) ** 2 + 6.76 * (0.7 * fy / E) ** 2));
    if (Lb <= Lp_aisc) {
      Md = phi_b * Mp;
    } else if (Lb <= Lr_aisc) {
      const Cb = 1.0;
      const Mr = 0.7 * fy * Zey / 1e6;
      Md = phi_b * Math.min(Cb * (Mp - (Mp - Mr) * (Lb - Lp_aisc) / (Lr_aisc - Lp_aisc)), Mp);
    } else {
      const Cb = 1.0;
      const Fcr = Cb * Math.PI ** 2 * E / (Lb / rts) ** 2 * Math.sqrt(1 + 0.078 * J_aisc * c_aisc / (Zey * (s.D - s.tf)) * (Lb / rts) ** 2);
      Md = phi_b * Math.min(Fcr * Zey / 1e6, Mp);
    }
  }
  let Vd: number;
  if (code === 'IS800') {
    Vd = fy * Aw / (Math.sqrt(3) * gamma_m0 * 1000);
  } else {
    Vd = phi_v * 0.6 * fy * Aw / 1000;
  }
  const N = Math.abs(forces.N);
  const Vy = Math.abs(forces.Vy);
  const Mz = Math.abs(forces.Mz);
  const tensionRatio = forces.N > 0 ? N / Math.max(Td, 0.001) : 0;
  const compressionRatio = forces.N < 0 ? N / Math.max(Pd, 0.001) : 0;
  const flexureRatio = Mz / Math.max(Md, 0.001);
  const shearRatio = Vy / Math.max(Vd, 0.001);
  const axialRatio = forces.N >= 0 ? tensionRatio : compressionRatio;
  let interactionRatio: number;
  if (code === 'IS800') {
    const Cm = 0.85;
    const Pe = Math.PI ** 2 * E * Iy / (lengthMM ** 2) / 1000;
    const amplification = forces.N < 0 ? Cm / Math.max(1 - N / Math.max(Pe, 0.001), 0.01) : 1.0;
    interactionRatio = axialRatio + amplification * flexureRatio;
  } else {
    interactionRatio = axialRatio >= 0.2 ? axialRatio + (8 / 9) * flexureRatio : axialRatio / 2 + flexureRatio;
  }
  const maxRatio = Math.max(tensionRatio, compressionRatio, flexureRatio, shearRatio, interactionRatio);
  const checks = [
    { name: 'Tension', clause: code === 'IS800' ? 'Cl 6' : 'Ch D', ratio: tensionRatio, status: tensionRatio <= 1 ? 'PASS' : 'FAIL' },
    { name: 'Compression', clause: code === 'IS800' ? 'Cl 7' : 'Ch E', ratio: compressionRatio, status: compressionRatio <= 1 ? 'PASS' : 'FAIL' },
    { name: 'Flexure', clause: code === 'IS800' ? 'Cl 8' : 'Ch F', ratio: flexureRatio, status: flexureRatio <= 1 ? 'PASS' : 'FAIL' },
    { name: 'Shear', clause: code === 'IS800' ? 'Cl 8.4' : 'Ch G', ratio: shearRatio, status: shearRatio <= 1 ? 'PASS' : 'FAIL' },
    { name: 'Combined', clause: code === 'IS800' ? 'Cl 9.3' : 'Ch H1', ratio: interactionRatio, status: interactionRatio <= 1 ? 'PASS' : 'FAIL' },
  ];
  const governing = checks.reduce((max, c) => c.ratio > max.ratio ? c : max, checks[0]);
  return {
    _section: s.designation,
    memberId: '',
    memberName: '',
    code,
    section: s.designation,
    utilizationRatio: maxRatio,
    status: maxRatio <= 1.0 ? 'PASS' : 'FAIL',
    governingCheck: governing.name,
    checks,
    forces: { N: forces.N, Vy: forces.Vy, Vz: forces.Vz, My: forces.My, Mz: forces.Mz },
    capacities: { tension: Math.round(Td * 10) / 10, compression: Math.round(Pd * 10) / 10, moment: Math.round(Md * 10) / 10, shear: Math.round(Vd * 10) / 10 },
  };
}

export function clientSideDesignConcreteBeam(input: ConcreteDesignInput): ConcreteDesignOutput {
  const { width: b, depth: D, cover, fck, fy, Mu, Vu, code } = input;
  const d = D - cover - 10;
  let Mu_cap: number;
  let xu_max_ratio: number;
  let Ast_req: number;
  if (code === 'IS456') {
    xu_max_ratio = fy <= 300 ? 0.53 : fy <= 450 ? 0.48 : 0.46;
    const xu_max = xu_max_ratio * d;
    Mu_cap = 0.36 * fck * b * xu_max * (d - 0.42 * xu_max) / 1e6;
    const MuNmm = Math.abs(Mu) * 1e6;
    const discriminant = 1 - (4.598 * MuNmm) / (fck * b * d * d);
    Ast_req = discriminant > 0 ? (fck * b * d / (2 * fy)) * (1 - Math.sqrt(discriminant)) : MuNmm / (0.87 * fy * 0.80 * d);
  } else {
    xu_max_ratio = 0.375;
    const a_max = xu_max_ratio * d * 0.85;
    Mu_cap = 0.9 * 0.85 * fck * b * a_max * (d - a_max / 2) / 1e6;
    const MuNmm = Math.abs(Mu) * 1e6;
    const Rn = MuNmm / (0.9 * b * d * d);
    const rho = (0.85 * fck / fy) * (1 - Math.sqrt(1 - 2 * Rn / (0.85 * fck)));
    Ast_req = Math.max(rho * b * d, 0);
  }
  const Ast_min = code === 'IS456' ? 0.85 * b * d / fy : 0.0018 * b * d;
  const Ast_provided = Math.max(Ast_req, Ast_min);
  const spacing = Math.max(100, Math.min(300, Math.floor(πSafe(d, Ast_provided) / 5) * 5));
  const stirrupSpacing = code === 'IS456' ? Math.min(300, Math.floor(Math.max(0.75 * d, 100) / 5) * 5) : Math.min(450, Math.floor(Math.max(0.75 * d, 100) / 5) * 5);
  const Vu_cap = code === 'IS456' ? 0.62 * Math.sqrt(fck) * b * d / 1000 : 0.17 * Math.sqrt(fck) * b * d / 1000;
  const Asv_req = Math.max(0, Vu - Vu_cap);
  const flexureRatio = Math.abs(Mu) / Math.max(Mu_cap, 1e-6);
  const shearRatio = Math.abs(Vu) / Math.max(Vu_cap, 1e-6);
  const governing = flexureRatio >= shearRatio ? 'Flexure' : 'Shear';
  const maxRatio = Math.max(flexureRatio, shearRatio);
  return {
    status: maxRatio <= 1 ? 'PASS' : 'FAIL',
    utilizationRatio: maxRatio,
    governingCheck: governing,
    checks: [
      { name: 'Flexure', clause: code === 'IS456' ? 'Cl 38.1' : 'ACI 318', ratio: flexureRatio, status: flexureRatio <= 1 ? 'PASS' : 'FAIL' },
      { name: 'Shear', clause: code === 'IS456' ? 'Cl 40' : 'ACI 318', ratio: shearRatio, status: shearRatio <= 1 ? 'PASS' : 'FAIL' },
    ],
    flexure: { Mu_capacity: Mu_cap, Ast_required: Ast_req, Ast_provided, barConfig: `Ast=${Ast_provided.toFixed(0)} mm²` },
    shear: { Vu_capacity: Vu_cap, Asv_required: Asv_req, stirrupConfig: `@ ${stirrupSpacing} mm c/c` },
  };
}

function πSafe(d: number, ast: number): number {
  return (Math.PI * d * d) / Math.max(ast, 1);
}
