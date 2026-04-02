import rawDesignCodes from "./designCodes.json" assert { type: "json" };

export type DesignCodeId =
  | "is_456"
  | "is_800"
  | "is_1893"
  | "is_875"
  | "aci_318"
  | "aisc_360"
  | "eurocode_2"
  | "eurocode_3";

export interface PartialSafetyFactors {
  concrete?: number; // γc
  steel?: number; // γs
  gamma_m0?: number; // steel yielding / instability (IS 800 / EC3)
  gamma_m1?: number; // fracture / ultimate
  gamma_mb?: number; // bolts/welds
  phi_flexure?: number; // ACI φ flexure
  phi_shear?: number; // ACI φ shear
  phi_axial?: number; // ACI φ axial
}

export interface CodeMetadata {
  id: DesignCodeId;
  name: string;
  edition: string;
  units: "SI" | "Imperial" | "Mixed";
  source: string;
  clauses?: Record<string, string>;
}

export interface WindSeismicFactors {
  zone_factors?: Record<string, number>; // IS 1893 Z values
  importance_factors?: Record<string, number>; // IS 875 / IS 1893 I
}

export interface DesignCodeRecord {
  meta: CodeMetadata;
  partialSafety: PartialSafetyFactors;
  windSeismic?: WindSeismicFactors;
}
export const designCodes: Record<DesignCodeId, DesignCodeRecord> = rawDesignCodes;
