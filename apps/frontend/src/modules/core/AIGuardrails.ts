/**
 * ============================================================================
 * AI GUARDRAILS - PHASE 2
 * ============================================================================
 * 
 * Safety layer for AI-assisted engineering calculations:
 * - Plausibility checks on inputs and outputs
 * - Sanity bounds for structural parameters
 * - Warning generation for edge cases
 * - Confidence scoring
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

export interface GuardrailCheck {
  id: string;
  parameter: string;
  value: number;
  unit: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  message: string;
  suggestion?: string;
}

export interface GuardrailResult {
  passed: boolean;
  checks: GuardrailCheck[];
  warnings: string[];
  errors: string[];
  confidence: number; // 0-100
}

export interface ParameterBounds {
  min?: number;
  max?: number;
  typical?: { min: number; max: number };
  unit: string;
  description: string;
}

// ============================================================================
// ENGINEERING SANITY BOUNDS
// ============================================================================

export const STRUCTURAL_BOUNDS: Record<string, ParameterBounds> = {
  // Geometric
  'beam_span': { min: 0.5, max: 50, typical: { min: 3, max: 15 }, unit: 'm', description: 'Beam span' },
  'beam_depth': { min: 100, max: 3000, typical: { min: 300, max: 1200 }, unit: 'mm', description: 'Beam depth' },
  'beam_width': { min: 100, max: 1500, typical: { min: 200, max: 600 }, unit: 'mm', description: 'Beam width' },
  'column_height': { min: 2, max: 20, typical: { min: 3, max: 6 }, unit: 'm', description: 'Column height' },
  'slab_thickness': { min: 100, max: 500, typical: { min: 125, max: 250 }, unit: 'mm', description: 'Slab thickness' },
  'span_depth_ratio': { min: 5, max: 30, typical: { min: 10, max: 20 }, unit: '-', description: 'Span-to-depth ratio' },

  // Material
  'concrete_fck': { min: 15, max: 100, typical: { min: 20, max: 50 }, unit: 'MPa', description: 'Concrete grade' },
  'steel_fy': { min: 250, max: 600, typical: { min: 415, max: 500 }, unit: 'MPa', description: 'Steel yield strength' },
  'rebar_ratio': { min: 0.002, max: 0.04, typical: { min: 0.008, max: 0.025 }, unit: '-', description: 'Reinforcement ratio' },

  // Loading
  'dead_load': { min: 0, max: 100, typical: { min: 2, max: 15 }, unit: 'kN/m²', description: 'Dead load' },
  'live_load': { min: 0, max: 50, typical: { min: 2, max: 10 }, unit: 'kN/m²', description: 'Live load' },
  'point_load': { min: 0, max: 5000, typical: { min: 10, max: 500 }, unit: 'kN', description: 'Point load' },

  // Seismic
  'seismic_zone_factor': { min: 0.1, max: 0.5, typical: { min: 0.1, max: 0.36 }, unit: '-', description: 'Seismic zone factor Z' },
  'importance_factor': { min: 1.0, max: 2.0, typical: { min: 1.0, max: 1.5 }, unit: '-', description: 'Importance factor I' },
  'response_factor_R': { min: 1.5, max: 8.0, typical: { min: 3.0, max: 5.0 }, unit: '-', description: 'Response reduction factor' },
  'base_shear_pct': { min: 0.5, max: 25, typical: { min: 2, max: 15 }, unit: '%W', description: 'Base shear as % of weight' },

  // Geotechnical
  'pile_length': { min: 5, max: 80, typical: { min: 10, max: 40 }, unit: 'm', description: 'Pile length' },
  'pile_diameter': { min: 300, max: 3000, typical: { min: 600, max: 1500 }, unit: 'mm', description: 'Pile diameter' },
  'bearing_capacity': { min: 50, max: 2000, typical: { min: 150, max: 600 }, unit: 'kPa', description: 'Bearing capacity' },
  'settlement': { min: 0, max: 100, typical: { min: 0, max: 25 }, unit: 'mm', description: 'Settlement' },

  // Steel
  'slenderness_ratio': { min: 10, max: 250, typical: { min: 30, max: 150 }, unit: '-', description: 'Slenderness ratio' },
  'width_thickness_ratio': { min: 5, max: 60, typical: { min: 8, max: 30 }, unit: '-', description: 'Width-thickness ratio' },

  // Results
  'dcr': { min: 0, max: 2.0, typical: { min: 0.3, max: 0.95 }, unit: '-', description: 'Demand/Capacity ratio' },
  'factor_of_safety': { min: 1.0, max: 5.0, typical: { min: 1.5, max: 3.0 }, unit: '-', description: 'Factor of safety' },
};

// ============================================================================
// GUARDRAIL ENGINE
// ============================================================================

export class AIGuardrails {
  private customBounds: Record<string, ParameterBounds>;

  constructor(customBounds?: Record<string, ParameterBounds>) {
    this.customBounds = { ...STRUCTURAL_BOUNDS, ...customBounds };
  }

  /**
   * Check a single parameter against bounds
   */
  checkParameter(
    parameterId: string,
    value: number,
    customBounds?: ParameterBounds
  ): GuardrailCheck {
    const bounds = customBounds || this.customBounds[parameterId];

    if (!bounds) {
      return {
        id: parameterId,
        parameter: parameterId,
        value,
        unit: '-',
        status: 'WARNING',
        message: `No bounds defined for parameter "${parameterId}"`,
      };
    }

    // Hard limit check
    if (bounds.min !== undefined && value < bounds.min) {
      return {
        id: parameterId,
        parameter: bounds.description,
        value,
        unit: bounds.unit,
        status: 'FAIL',
        message: `Value ${value} ${bounds.unit} is below minimum ${bounds.min} ${bounds.unit}`,
        suggestion: `Increase to at least ${bounds.min} ${bounds.unit}`,
      };
    }

    if (bounds.max !== undefined && value > bounds.max) {
      return {
        id: parameterId,
        parameter: bounds.description,
        value,
        unit: bounds.unit,
        status: 'FAIL',
        message: `Value ${value} ${bounds.unit} exceeds maximum ${bounds.max} ${bounds.unit}`,
        suggestion: `Reduce to at most ${bounds.max} ${bounds.unit}`,
      };
    }

    // Typical range check
    if (bounds.typical) {
      if (value < bounds.typical.min || value > bounds.typical.max) {
        return {
          id: parameterId,
          parameter: bounds.description,
          value,
          unit: bounds.unit,
          status: 'WARNING',
          message: `Value ${value} ${bounds.unit} is outside typical range (${bounds.typical.min}-${bounds.typical.max} ${bounds.unit})`,
          suggestion: `Verify this is intentional; typical values are ${bounds.typical.min}-${bounds.typical.max} ${bounds.unit}`,
        };
      }
    }

    return {
      id: parameterId,
      parameter: bounds.description,
      value,
      unit: bounds.unit,
      status: 'PASS',
      message: `Value ${value} ${bounds.unit} is within acceptable range`,
    };
  }

  /**
   * Check multiple parameters at once
   */
  checkParameters(params: Record<string, number>): GuardrailResult {
    const checks: GuardrailCheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const [key, value] of Object.entries(params)) {
      const check = this.checkParameter(key, value);
      checks.push(check);

      if (check.status === 'WARNING') {
        warnings.push(check.message);
      } else if (check.status === 'FAIL') {
        errors.push(check.message);
      }
    }

    // Calculate confidence score
    const passCount = checks.filter((c) => c.status === 'PASS').length;
    const warnCount = checks.filter((c) => c.status === 'WARNING').length;
    const failCount = checks.filter((c) => c.status === 'FAIL').length;
    const total = checks.length;

    let confidence = 100;
    if (total > 0) {
      confidence = Math.round((passCount * 100 + warnCount * 50) / total);
    }
    if (failCount > 0) {
      confidence = Math.min(confidence, 50 - failCount * 10);
    }
    confidence = Math.max(0, Math.min(100, confidence));

    return {
      passed: failCount === 0,
      checks,
      warnings,
      errors,
      confidence,
    };
  }

  /**
   * Plausibility check for calculation results
   */
  checkResultPlausibility(
    calculationType: string,
    inputs: Record<string, number>,
    outputs: Record<string, number>
  ): GuardrailResult {
    const checks: GuardrailCheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check outputs against bounds
    for (const [key, value] of Object.entries(outputs)) {
      if (this.customBounds[key]) {
        const check = this.checkParameter(key, value);
        checks.push(check);
        if (check.status === 'WARNING') warnings.push(check.message);
        if (check.status === 'FAIL') errors.push(check.message);
      }
    }

    // Cross-validation checks based on calculation type
    switch (calculationType) {
      case 'beam_flexure':
        // Span/depth ratio
        if (inputs.span && inputs.depth) {
          const ratio = (inputs.span * 1000) / inputs.depth;
          const ratioCheck = this.checkParameter('span_depth_ratio', ratio);
          checks.push(ratioCheck);
          if (ratioCheck.status === 'WARNING') warnings.push(ratioCheck.message);
          if (ratioCheck.status === 'FAIL') errors.push(ratioCheck.message);
        }
        // Reinforcement ratio
        if (inputs.Ast && inputs.b && inputs.d) {
          const rho = inputs.Ast / (inputs.b * inputs.d);
          const rhoCheck = this.checkParameter('rebar_ratio', rho);
          checks.push(rhoCheck);
          if (rhoCheck.status === 'WARNING') warnings.push(rhoCheck.message);
          if (rhoCheck.status === 'FAIL') errors.push(rhoCheck.message);
        }
        break;

      case 'column_axial':
        // Slenderness check
        if (inputs.L && inputs.r) {
          const slenderness = (inputs.L * 1000) / inputs.r;
          const slenderCheck = this.checkParameter('slenderness_ratio', slenderness);
          checks.push(slenderCheck);
          if (slenderCheck.status === 'WARNING') warnings.push(slenderCheck.message);
          if (slenderCheck.status === 'FAIL') errors.push(slenderCheck.message);
        }
        break;

      case 'seismic_base_shear':
        // Base shear percentage
        if (outputs.Vb && inputs.W) {
          const pct = (outputs.Vb / inputs.W) * 100;
          const pctCheck = this.checkParameter('base_shear_pct', pct);
          checks.push(pctCheck);
          if (pctCheck.status === 'WARNING') warnings.push(pctCheck.message);
          if (pctCheck.status === 'FAIL') errors.push(pctCheck.message);
        }
        break;
    }

    // Calculate confidence
    const passCount = checks.filter((c) => c.status === 'PASS').length;
    const total = checks.length;
    let confidence = total > 0 ? Math.round((passCount / total) * 100) : 50;
    if (errors.length > 0) confidence = Math.min(confidence, 30);

    return {
      passed: errors.length === 0,
      checks,
      warnings,
      errors,
      confidence,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const guardrails = new AIGuardrails();

// ============================================================================
// QUICK VALIDATION HELPERS
// ============================================================================

export function validateBeamInputs(inputs: {
  span: number;      // m
  width: number;     // mm
  depth: number;     // mm
  fck: number;       // MPa
  fy: number;        // MPa
  load?: number;     // kN/m
}): GuardrailResult {
  return guardrails.checkParameters({
    beam_span: inputs.span,
    beam_width: inputs.width,
    beam_depth: inputs.depth,
    concrete_fck: inputs.fck,
    steel_fy: inputs.fy,
    ...(inputs.load ? { dead_load: inputs.load } : {}),
  });
}

export function validateSeismicInputs(inputs: {
  Z: number;
  I: number;
  R: number;
  W: number;
}): GuardrailResult {
  return guardrails.checkParameters({
    seismic_zone_factor: inputs.Z,
    importance_factor: inputs.I,
    response_factor_R: inputs.R,
  });
}

export function validatePileInputs(inputs: {
  length: number;      // m
  diameter: number;    // mm
  capacity?: number;   // kN
}): GuardrailResult {
  return guardrails.checkParameters({
    pile_length: inputs.length,
    pile_diameter: inputs.diameter,
  });
}

// ============================================================================
// CONFIDENCE LABEL
// ============================================================================

export function getConfidenceLabel(confidence: number): {
  label: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
} {
  if (confidence >= 85) return { label: 'High', color: 'green' };
  if (confidence >= 65) return { label: 'Medium', color: 'yellow' };
  if (confidence >= 40) return { label: 'Low', color: 'orange' };
  return { label: 'Very Low', color: 'red' };
}
