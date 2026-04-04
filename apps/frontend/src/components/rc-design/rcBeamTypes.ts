/**
 * Shared types for RCBeamDesigner component family
 */

export interface BeamFormData {
  beamType: "rectangular" | "T-beam" | "L-beam";
  b: number;
  D: number;
  d: number;
  bf?: number;
  Df?: number;
  L: number;
  Mu: number;
  Vu: number;
  Tu?: number;
  code: import("@/modules/concrete/RCDesignConstants").DesignCode;
  concreteGrade: string;
  steelGrade: string;
  exposure: string;
  cover: number;
}
