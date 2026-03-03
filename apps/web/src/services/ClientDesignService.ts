interface AISCResult {
  Pn_compression: number; // lb
  Mn_major: number; // lb-in
  Pn_tension: number; // lb
}

import { logger } from '../lib/logging/logger';

interface MemberDesignInput {
  // Geometry
  d: number; // depth (in)
  bf: number; // flange width (in)
  tw: number; // web thickness (in)
  tf: number; // flange thickness (in)

  // Properties
  rx: number;
  ry: number;
  zx: number;
  zy: number;
  sx: number;
  sy: number;
  j: number;
  cw: number;
  ag: number;

  // Material
  fy: number; // yield stress (ksi)
  E: number; // modulus (ksi)

  // Lengths
  lb: number; // unbraced length (in)
  lc_x: number; // effective length major (in)
  lc_y: number; // effective length minor (in)
  cb: number; // moment gradient factor
}

export class ClientDesignService {
  private static wasm: any = null;

  static async init() {
    if (this.wasm) return;

    try {
      // Import the WASM module dynamically
      // Uses @vite-ignore to prevent build-time resolution failures
      // when solver-wasm pkg hasn't been built yet
      this.wasm = await import(/* @vite-ignore */ "solver-wasm");
    } catch (e) {
      logger.warn("Failed to load Rust WASM module", { error: e instanceof Error ? e.message : String(e) });
    }
  }

  static checkAISC(member: MemberDesignInput): AISCResult | null {
    if (!this.wasm) {
      logger.error("WASM not initialized");
      return null;
    }

    try {
      // Call Rust function
      // Note: Rust func expects (d, bf, tw, tf, rx, ry, zx, zy, sx, sy, j, cw, ag, fy, E, lb, lcx, lcy, cb)
      const res = this.wasm.calculate_aisc_capacity(
        member.d,
        member.bf,
        member.tw,
        member.tf,
        member.rx,
        member.ry,
        member.zx,
        member.zy,
        member.sx,
        member.sy,
        member.j,
        member.cw,
        member.ag,
        member.fy,
        member.E,
        member.lb,
        member.lc_x,
        member.lc_y,
        member.cb,
      );

      return res as AISCResult;
    } catch (e) {
      logger.error("Design Check Failed", { error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  }
  static async runModalAnalysis(
    nodes: any[],
    elements: any[],
    numModes: number = 3,
  ): Promise<any | null> {
    if (!this.wasm) await this.init();
    if (!this.wasm) return null;

    try {
      console.time("WASM Modal Analysis");
      const res = this.wasm.modal_analysis(nodes, elements, numModes);
      console.timeEnd("WASM Modal Analysis");
      return res;
    } catch (e) {
      logger.error("Modal Analysis Failed", { error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  }

  static async runResponseSpectrum(
    modalResults: any,
    params: {
      zone: number;
      importance: number;
      reduction: number;
      soil: number;
      scaleX?: number;
      scaleZ?: number;
    },
  ): Promise<any | null> {
    if (!this.wasm) await this.init();
    if (!this.wasm) return null;

    try {
      const res = this.wasm.solve_response_spectrum(
        modalResults,
        params.zone,
        params.importance,
        params.reduction,
        params.soil,
      );

      // Apply direction scaling factors (Post-processing)
      // Ideally this should be in the solver, but we apply it here for now
      if (res && res.success) {
        if (params.scaleX !== undefined) res.base_shear_x *= params.scaleX;
        if (params.scaleZ !== undefined) res.base_shear_z *= params.scaleZ;
      }

      return res;
    } catch (e) {
      logger.error("Seismic Analysis Failed", { error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  }
}
