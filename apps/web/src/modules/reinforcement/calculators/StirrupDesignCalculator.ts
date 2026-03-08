/**
 * Stirrup Design Calculator
 * IS 456:2000 Cl. 40 — Shear design with Table 19 interpolation
 * ACI 318-19 Ch. 22 — Concrete shear strength
 * EN 1992-1-1 Cl. 6.2 — Shear design
 */

import {
  ConcreteDesignCode,
  StirrupType,
  ShearDesignInput,
  StirrupDesignResult,
} from '../types/ReinforcementTypes';

// IS 456:2000 Table 19 — Design shear strength of concrete τc (N/mm²)
// Rows: pt%, Columns: fck (15, 20, 25, 30, 35, 40 MPa)
const IS456_TABLE_19_PT: number[] = [0.15, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00];
const IS456_TABLE_19: Record<number, number[]> = {
  15: [0.28, 0.35, 0.46, 0.54, 0.60, 0.64, 0.68, 0.71, 0.71, 0.71, 0.71, 0.71, 0.71],
  20: [0.28, 0.36, 0.48, 0.56, 0.62, 0.67, 0.72, 0.75, 0.79, 0.81, 0.82, 0.82, 0.82],
  25: [0.29, 0.36, 0.49, 0.57, 0.64, 0.70, 0.74, 0.78, 0.82, 0.85, 0.88, 0.90, 0.92],
  30: [0.29, 0.37, 0.50, 0.59, 0.66, 0.71, 0.76, 0.80, 0.84, 0.88, 0.91, 0.94, 0.96],
  35: [0.29, 0.37, 0.50, 0.59, 0.67, 0.73, 0.78, 0.82, 0.86, 0.90, 0.93, 0.96, 0.99],
  40: [0.30, 0.38, 0.51, 0.60, 0.68, 0.74, 0.79, 0.84, 0.88, 0.92, 0.95, 0.98, 1.01],
};

// IS 456:2000 Table 20 — Maximum shear stress τc,max (N/mm²)
const IS456_TABLE_20: Record<number, number> = {
  15: 2.5, 20: 2.8, 25: 3.1, 30: 3.5, 35: 3.7, 40: 4.0,
};

/** Linear interpolation between two values */
function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

/**
 * IS 456 Table 19 lookup with bilinear interpolation on pt% and fck
 * @param pt - Reinforcement percentage (100 × As / (b × d))
 * @param fck - Characteristic concrete strength (MPa)
 * @returns τc (N/mm²)
 */
function getIS456TauC(pt: number, fck: number): number {
  const ptClamped = Math.max(0.15, Math.min(pt, 3.0));
  const fckGrades = [15, 20, 25, 30, 35, 40];

  // Clamp fck to table range
  const fckLow = fckGrades.reduce((prev, curr) => curr <= fck ? curr : prev, 15);
  const fckHigh = fckGrades.find(g => g >= fck) ?? 40;

  // Find pt bracket
  let ptIdx = 0;
  for (let i = 0; i < IS456_TABLE_19_PT.length - 1; i++) {
    if (ptClamped >= IS456_TABLE_19_PT[i] && ptClamped <= IS456_TABLE_19_PT[i + 1]) {
      ptIdx = i;
      break;
    }
    if (i === IS456_TABLE_19_PT.length - 2) ptIdx = i;
  }

  const pt0 = IS456_TABLE_19_PT[ptIdx];
  const pt1 = IS456_TABLE_19_PT[ptIdx + 1];

  // Interpolate on pt for fckLow
  const tauLow0 = IS456_TABLE_19[fckLow][ptIdx];
  const tauLow1 = IS456_TABLE_19[fckLow][ptIdx + 1];
  const tauAtLow = lerp(ptClamped, pt0, pt1, tauLow0, tauLow1);

  if (fckLow === fckHigh) return tauAtLow;

  // Interpolate on pt for fckHigh
  const tauHigh0 = IS456_TABLE_19[fckHigh][ptIdx];
  const tauHigh1 = IS456_TABLE_19[fckHigh][ptIdx + 1];
  const tauAtHigh = lerp(ptClamped, pt0, pt1, tauHigh0, tauHigh1);

  // Interpolate across fck
  return lerp(fck, fckLow, fckHigh, tauAtLow, tauAtHigh);
}

/**
 * IS 456 Table 20 — Maximum shear stress with interpolation
 */
function getIS456TauCMax(fck: number): number {
  const fckGrades = [15, 20, 25, 30, 35, 40];
  const fckLow = fckGrades.reduce((prev, curr) => curr <= fck ? curr : prev, 15);
  const fckHigh = fckGrades.find(g => g >= fck) ?? 40;
  if (fckLow === fckHigh) return IS456_TABLE_20[fckLow];
  return lerp(fck, fckLow, fckHigh, IS456_TABLE_20[fckLow], IS456_TABLE_20[fckHigh]);
}

/**
 * ACI 318-19 Cl. 22.5.5 — Concrete shear strength Vc
 */
function getACIVc(fc: number, bw: number, d: number, _pt: number): number {
  // Vc = 0.17 × λ × √f'c × bw × d   (λ = 1.0 for normal weight)
  return 0.17 * 1.0 * Math.sqrt(fc) * bw * d / 1000; // kN
}

/**
 * EN 1992-1-1 Cl. 6.2.2 — Concrete shear resistance VRd,c
 */
function getEC2VRdc(fck: number, bw: number, d: number, pt: number): number {
  const k = Math.min(1 + Math.sqrt(200 / d), 2.0);
  const rhoL = Math.min(pt / 100, 0.02);
  const CRdc = 0.18 / 1.5; // γc = 1.5
  const vRdc = CRdc * k * Math.pow(100 * rhoL * fck, 1 / 3); // N/mm²
  const vMin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck);
  return Math.max(vRdc, vMin) * bw * d / 1000; // kN
}

/**
 * Stirrup Design Calculator with multi-code, multi-region shear design
 */
export class StirrupDesignCalculator {
  /**
   * Design stirrups for given input parameters
   */
  design(input: ShearDesignInput): StirrupDesignResult {
    const fc = input.concrete.compressiveStrength;
    const bw = input.webWidth;
    const d = input.effectiveDepth;
    const Vu = input.factoredShear;
    const fy = input.stirrupBar.yieldStrength;
    const Av = input.stirrupBar.area * 2; // 2-legged stirrups
    const pt = input.tensionSteelRatio ?? 0.5; // Default 0.5% if not provided
    const code = input.designCode ?? 'IS456';

    let tau_v: number;
    let Vc: number;
    let tauCMax: number;
    let phi: number;
    let codeRef: string;

    if (code === 'ACI318') {
      // ACI 318-19 — Cl. 22.5
      phi = 0.75;
      Vc = getACIVc(fc, bw, d, pt);
      tau_v = (Vu * 1000) / (bw * d);
      tauCMax = 0.83 * Math.sqrt(fc); // N/mm² — ACI upper limit
      codeRef = 'ACI 318-19 Cl. 22.5';
    } else if (code === 'EN1992') {
      // Eurocode 2 — Cl. 6.2
      phi = 1.0; // Safety via γc in VRd,c
      Vc = getEC2VRdc(fc, bw, d, pt);
      tau_v = (Vu * 1000) / (bw * d);
      tauCMax = 0.5 * 0.6 * (1 - fc / 250) * fc / 1.5; // N/mm² VRd,max simplified
      codeRef = 'EN 1992-1-1 Cl. 6.2';
    } else {
      // IS 456:2000 — Cl. 40
      phi = 1.0; // IS 456 uses factored loads directly
      const tauC = getIS456TauC(pt, fc);
      tau_v = (Vu * 1000) / (bw * d);
      Vc = tauC * bw * d / 1000; // kN
      tauCMax = getIS456TauCMax(fc);
      codeRef = 'IS 456:2000 Cl. 40, Table 19';
    }

    // Check if section is adequate for maximum shear stress
    const sectionAdequate = tau_v <= tauCMax;

    // Required shear steel capacity
    const Vs = Math.max(0, Vu - Vc);

    // Required spacing (IS 456 Cl. 40.4.1 / ACI 318 Cl. 22.5.10)
    const requiredSpacing = Vs > 0 ? (0.87 * fy * Av * d) / (Vs * 1000) : 999;
    const maxSpacing = Math.min(0.75 * d, 300); // IS 456 Cl. 26.5.1.5
    const minSpacing = 75; // Practical minimum
    const providedSpacing = Math.min(
      Math.max(Math.floor(requiredSpacing / 25) * 25, minSpacing),
      maxSpacing
    );

    // Calculate provided capacity
    const VsProvided = (0.87 * fy * Av * d) / (providedSpacing * 1000);
    const Vn = Vc + VsProvided;

    // Multi-region shear design
    // Region 1: Critical zone (0 to 2d from support face) — close spacing
    // Region 2: Transition zone (2d to mid-span) — standard spacing
    const spanLength = input.spanLength ?? 6000; // mm
    const halfSpan = spanLength / 2;
    const criticalEnd = Math.min(2 * d, halfSpan);
    const shearAtCritical = Vu; // Conservative: use max shear in critical zone
    const shearAtMidTransition = Vu * (1 - criticalEnd / halfSpan);

    // Transition region: spacing can be relaxed if shear decreases
    const VsTransition = Math.max(0, shearAtMidTransition - Vc);
    const transitionSpacing = VsTransition > 0
      ? Math.min(Math.floor((0.87 * fy * Av * d) / (VsTransition * 1000) / 25) * 25, maxSpacing)
      : maxSpacing;

    const regions = [
      {
        startPosition: 0,
        endPosition: criticalEnd,
        spacing: providedSpacing,
        type: 'CRITICAL' as const,
        count: Math.ceil(criticalEnd / providedSpacing),
        shearAtStart: Vu,
        shearAtEnd: shearAtCritical,
      },
      {
        startPosition: criticalEnd,
        endPosition: halfSpan,
        spacing: Math.min(transitionSpacing, maxSpacing),
        type: 'STANDARD' as const,
        count: Math.ceil((halfSpan - criticalEnd) / transitionSpacing),
        shearAtStart: shearAtCritical * 0.8,
        shearAtEnd: shearAtMidTransition,
      },
    ];

    const checks = [
      {
        name: 'Maximum Shear Stress',
        description: `τv ≤ τc,max (${codeRef})`,
        required: tau_v,
        provided: tauCMax,
        utilization: tau_v / tauCMax,
        passed: sectionAdequate,
        codeReference: codeRef,
      },
      {
        name: 'Shear Capacity',
        description: 'Vu ≤ φ × Vn',
        required: Vu,
        provided: Vn * phi,
        utilization: Vu / (Vn * phi),
        passed: Vu <= Vn * phi,
        codeReference: codeRef,
      },
      {
        name: 'Minimum Shear Reinforcement',
        description: 'Av,min = 0.4 × bw × s / (0.87 × fy)',
        required: 0.4 * bw * providedSpacing / (0.87 * fy),
        provided: Av,
        utilization: (0.4 * bw * providedSpacing / (0.87 * fy)) / Av,
        passed: Av >= 0.4 * bw * providedSpacing / (0.87 * fy),
        codeReference: 'IS 456:2000 Cl. 26.5.1.6',
      },
    ];

    const warnings: string[] = [];
    if (!sectionAdequate) {
      warnings.push(`Section inadequate: τv (${tau_v.toFixed(2)} N/mm²) > τc,max (${tauCMax.toFixed(2)} N/mm²). Increase section size.`);
    }
    if (Vs > 4 * Vc) {
      warnings.push('Vs > 4Vc — consider increasing section depth per IS 456 Cl. 40.2.3');
    }

    return {
      reinforcementRequired: Vs > 0,
      concreteCapacity: Vc,
      requiredSteelCapacity: Vs,
      maxSteelCapacity: 4 * Vc,
      totalCapacity: Vn * phi,
      phiFactor: phi,
      stirrupConfig: {
        type: StirrupType.TWO_LEGGED,
        barSize: input.stirrupBar.size,
        legs: 2,
        spacing: providedSpacing,
        maxSpacing,
        minSpacing,
      },
      requiredAvs: Vs > 0 ? (Vs * 1000) / (0.87 * fy * d) : 0,
      providedAvs: Av / providedSpacing,
      regions,
      checks,
      isAdequate: Vu <= Vn * phi && sectionAdequate,
      utilization: Vu / (Vn * phi),
      warnings,
      calculations: [
        `τv = Vu×1000 / (bw×d) = ${(Vu * 1000).toFixed(0)} / (${bw}×${d}) = ${tau_v.toFixed(2)} N/mm²`,
        `Vc (concrete) = ${Vc.toFixed(1)} kN [${codeRef}]`,
        `Vs (required) = Vu - Vc = ${Vu.toFixed(1)} - ${Vc.toFixed(1)} = ${Vs.toFixed(1)} kN`,
        `Spacing = 0.87×fy×Av×d / (Vs×1000) = ${requiredSpacing.toFixed(0)} mm → provided ${providedSpacing} mm`,
      ],
    };
  }
}

// Export singleton instance
export const stirrupCalculator = new StirrupDesignCalculator();
