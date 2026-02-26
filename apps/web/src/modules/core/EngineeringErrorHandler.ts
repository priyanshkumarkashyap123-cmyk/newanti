/**
 * ============================================================================
 * STRUCTURAL ENGINEERING ERROR HANDLER
 * ============================================================================
 * 
 * Comprehensive error handling and recovery system for structural calculations.
 * Provides detailed error messages, recovery suggestions, and logging.
 * 
 * @version 3.0.0
 */

// ============================================================================
// ERROR TYPES
// ============================================================================

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  CALCULATION = 'calculation',
  GEOMETRY = 'geometry',
  MATERIAL = 'material',
  LOAD = 'load',
  SOIL = 'soil',
  CODE_COMPLIANCE = 'code_compliance',
  NUMERICAL = 'numerical',
  SYSTEM = 'system'
}

export interface EngineeringError {
  id: string;
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  technicalDetails?: string;
  affectedParameter?: string;
  currentValue?: number | string;
  expectedRange?: { min?: number; max?: number };
  suggestions: string[];
  codeReference?: string;
  timestamp: Date;
  stack?: string;
}

export interface ErrorContext {
  module: string;
  function: string;
  inputs?: Record<string, any>;
  step?: string;
}

// ============================================================================
// ERROR CODES
// ============================================================================

export const ERROR_CODES = {
  // Validation Errors (V001-V099)
  V001: { message: 'Invalid input parameter', category: ErrorCategory.VALIDATION },
  V002: { message: 'Value out of acceptable range', category: ErrorCategory.VALIDATION },
  V003: { message: 'Required parameter missing', category: ErrorCategory.VALIDATION },
  V004: { message: 'Inconsistent input parameters', category: ErrorCategory.VALIDATION },
  V005: { message: 'Invalid unit conversion', category: ErrorCategory.VALIDATION },

  // Geometry Errors (G001-G099)
  G001: { message: 'Negative dimension not allowed', category: ErrorCategory.GEOMETRY },
  G002: { message: 'Dimension too small for structural use', category: ErrorCategory.GEOMETRY },
  G003: { message: 'Aspect ratio exceeds recommended limit', category: ErrorCategory.GEOMETRY },
  G004: { message: 'Insufficient cover for reinforcement', category: ErrorCategory.GEOMETRY },
  G005: { message: 'Effective depth calculation error', category: ErrorCategory.GEOMETRY },

  // Material Errors (M001-M099)
  M001: { message: 'Invalid concrete grade', category: ErrorCategory.MATERIAL },
  M002: { message: 'Invalid steel grade', category: ErrorCategory.MATERIAL },
  M003: { message: 'Material strength below minimum', category: ErrorCategory.MATERIAL },
  M004: { message: 'Incompatible material combination', category: ErrorCategory.MATERIAL },
  M005: { message: 'Material property out of valid range', category: ErrorCategory.MATERIAL },

  // Load Errors (L001-L099)
  L001: { message: 'Load exceeds structural capacity', category: ErrorCategory.LOAD },
  L002: { message: 'Invalid load combination', category: ErrorCategory.LOAD },
  L003: { message: 'Uplift load not permitted', category: ErrorCategory.LOAD },
  L004: { message: 'Excessive eccentricity', category: ErrorCategory.LOAD },
  L005: { message: 'Missing load case', category: ErrorCategory.LOAD },

  // Soil Errors (S001-S099)
  S001: { message: 'Bearing capacity exceeded', category: ErrorCategory.SOIL },
  S002: { message: 'Invalid soil parameters', category: ErrorCategory.SOIL },
  S003: { message: 'Excessive settlement predicted', category: ErrorCategory.SOIL },
  S004: { message: 'Liquefaction potential detected', category: ErrorCategory.SOIL },
  S005: { message: 'Negative soil pressure (uplift)', category: ErrorCategory.SOIL },

  // Code Compliance Errors (C001-C099)
  C001: { message: 'Reinforcement below minimum', category: ErrorCategory.CODE_COMPLIANCE },
  C002: { message: 'Reinforcement exceeds maximum', category: ErrorCategory.CODE_COMPLIANCE },
  C003: { message: 'Spacing below minimum allowed', category: ErrorCategory.CODE_COMPLIANCE },
  C004: { message: 'Development length insufficient', category: ErrorCategory.CODE_COMPLIANCE },
  C005: { message: 'Factor of safety below required', category: ErrorCategory.CODE_COMPLIANCE },

  // Numerical Errors (N001-N099)
  N001: { message: 'Division by zero', category: ErrorCategory.NUMERICAL },
  N002: { message: 'Numerical overflow', category: ErrorCategory.NUMERICAL },
  N003: { message: 'Convergence failure', category: ErrorCategory.NUMERICAL },
  N004: { message: 'Negative square root', category: ErrorCategory.NUMERICAL },
  N005: { message: 'Matrix singularity', category: ErrorCategory.NUMERICAL },

  // System Errors (X001-X099)
  X001: { message: 'Internal calculation error', category: ErrorCategory.SYSTEM },
  X002: { message: 'Memory allocation failure', category: ErrorCategory.SYSTEM },
  X003: { message: 'Unexpected null value', category: ErrorCategory.SYSTEM },
} as const;

// ============================================================================
// ERROR HANDLER CLASS
// ============================================================================

export class EngineeringErrorHandler {
  private errors: EngineeringError[] = [];
  private warnings: EngineeringError[] = [];
  private context?: ErrorContext;
  private onError?: (error: EngineeringError) => void;
  private onWarning?: (warning: EngineeringError) => void;

  constructor(options?: {
    context?: ErrorContext;
    onError?: (error: EngineeringError) => void;
    onWarning?: (warning: EngineeringError) => void;
  }) {
    this.context = options?.context;
    this.onError = options?.onError;
    this.onWarning = options?.onWarning;
  }

  /**
   * Create and log an error
   */
  createError(
    code: keyof typeof ERROR_CODES,
    details?: Partial<Omit<EngineeringError, 'id' | 'code' | 'category' | 'timestamp'>>
  ): EngineeringError {
    const errorDef = ERROR_CODES[code];
    const error: EngineeringError = {
      id: `${code}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      code,
      category: errorDef.category,
      severity: details?.severity || ErrorSeverity.ERROR,
      message: details?.message || errorDef.message,
      technicalDetails: details?.technicalDetails,
      affectedParameter: details?.affectedParameter,
      currentValue: details?.currentValue,
      expectedRange: details?.expectedRange,
      suggestions: details?.suggestions || this.getDefaultSuggestions(code),
      codeReference: details?.codeReference,
      timestamp: new Date(),
      stack: new Error().stack,
    };

    if (error.severity === ErrorSeverity.WARNING || error.severity === ErrorSeverity.INFO) {
      this.warnings.push(error);
      this.onWarning?.(error);
    } else {
      this.errors.push(error);
      this.onError?.(error);
    }

    // Log to console in development
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      const logMethod = error.severity === ErrorSeverity.CRITICAL ? 'error' : 
                        error.severity === ErrorSeverity.ERROR ? 'error' :
                        error.severity === ErrorSeverity.WARNING ? 'warn' : 'info';
      console[logMethod](`[${error.code}] ${error.message}`, error);
    }

    return error;
  }

  /**
   * Get default suggestions for an error code
   */
  private getDefaultSuggestions(code: keyof typeof ERROR_CODES): string[] {
    const suggestions: Record<string, string[]> = {
      V001: ['Check input format', 'Verify parameter type', 'Review documentation'],
      V002: ['Adjust value to be within acceptable range', 'Check units', 'Verify input source'],
      V003: ['Provide all required parameters', 'Check for null or undefined values'],
      G001: ['Use positive dimension values', 'Check measurement direction'],
      G002: ['Increase dimension to meet minimum requirements', 'Consider different foundation type'],
      G003: ['Increase shorter dimension', 'Consider dividing into multiple elements'],
      M001: ['Select a valid concrete grade (M15-M80)', 'Check code requirements'],
      M002: ['Select a valid steel grade (Fe250-Fe550)', 'Check availability'],
      L001: ['Reduce applied load', 'Increase structural capacity', 'Revise load path'],
      L003: ['Increase dead load', 'Add anchors', 'Redesign to resist uplift'],
      L004: ['Increase footing size', 'Reduce moment', 'Add stiffness'],
      S001: ['Increase footing size', 'Reduce load', 'Consider pile foundation'],
      S003: ['Increase footing size', 'Use ground improvement', 'Consider piles'],
      S005: ['Increase footing size', 'Add dead load', 'Check moment calculation'],
      C001: ['Increase reinforcement area', 'Reduce bar spacing', 'Use larger diameter'],
      C002: ['Reduce reinforcement area', 'Increase section size', 'Use higher grade steel'],
      N001: ['Check divisor calculation', 'Add zero-check guard', 'Verify input parameters'],
      N003: ['Increase iteration limit', 'Adjust initial guess', 'Check convergence criteria'],
    };

    return suggestions[code] || ['Review calculation parameters', 'Consult design standards'];
  }

  /**
   * Validate a numeric value
   */
  validateNumber(
    value: number,
    paramName: string,
    options: {
      min?: number;
      max?: number;
      positive?: boolean;
      integer?: boolean;
      finite?: boolean;
    } = {}
  ): { isValid: boolean; error?: EngineeringError } {
    const { min, max, positive, integer, finite = true } = options;

    if (finite && !Number.isFinite(value)) {
      return {
        isValid: false,
        error: this.createError('N002', {
          affectedParameter: paramName,
          currentValue: value,
          message: `${paramName} must be a finite number`,
        }),
      };
    }

    if (positive && value <= 0) {
      return {
        isValid: false,
        error: this.createError('G001', {
          affectedParameter: paramName,
          currentValue: value,
          message: `${paramName} must be positive`,
        }),
      };
    }

    if (integer && !Number.isInteger(value)) {
      return {
        isValid: false,
        error: this.createError('V001', {
          affectedParameter: paramName,
          currentValue: value,
          message: `${paramName} must be an integer`,
        }),
      };
    }

    if (min !== undefined && value < min) {
      return {
        isValid: false,
        error: this.createError('V002', {
          affectedParameter: paramName,
          currentValue: value,
          expectedRange: { min },
          message: `${paramName} must be at least ${min}`,
        }),
      };
    }

    if (max !== undefined && value > max) {
      return {
        isValid: false,
        error: this.createError('V002', {
          affectedParameter: paramName,
          currentValue: value,
          expectedRange: { max },
          message: `${paramName} must be at most ${max}`,
        }),
      };
    }

    return { isValid: true };
  }

  /**
   * Validate concrete grade
   */
  validateConcreteGrade(fck: number, code: string): { isValid: boolean; error?: EngineeringError } {
    const validRanges: Record<string, { min: number; max: number }> = {
      IS456: { min: 15, max: 80 },
      ACI318: { min: 17, max: 70 },
      EN1992: { min: 12, max: 90 },
    };

    const range = validRanges[code] || validRanges.IS456;

    if (fck < range.min || fck > range.max) {
      return {
        isValid: false,
        error: this.createError('M001', {
          affectedParameter: 'fck',
          currentValue: fck,
          expectedRange: range,
          codeReference: code,
        }),
      };
    }

    return { isValid: true };
  }

  /**
   * Validate bearing capacity
   */
  validateBearingCapacity(
    actualPressure: number,
    allowablePressure: number
  ): { isValid: boolean; error?: EngineeringError } {
    if (actualPressure > allowablePressure) {
      return {
        isValid: false,
        error: this.createError('S001', {
          severity: ErrorSeverity.CRITICAL,
          affectedParameter: 'soil_pressure',
          currentValue: actualPressure,
          expectedRange: { max: allowablePressure },
          technicalDetails: `Utilization: ${((actualPressure / allowablePressure) * 100).toFixed(1)}%`,
        }),
      };
    }

    // Warning if close to capacity
    if (actualPressure > allowablePressure * 0.9) {
      return {
        isValid: true,
        error: this.createError('S001', {
          severity: ErrorSeverity.WARNING,
          message: 'Soil pressure approaching allowable capacity',
          affectedParameter: 'soil_pressure',
          currentValue: actualPressure,
          expectedRange: { max: allowablePressure },
        }),
      };
    }

    return { isValid: true };
  }

  /**
   * Validate reinforcement
   */
  validateReinforcement(
    providedArea: number,
    requiredArea: number,
    minArea: number,
    maxArea: number
  ): { isValid: boolean; error?: EngineeringError } {
    if (providedArea < minArea) {
      return {
        isValid: false,
        error: this.createError('C001', {
          severity: ErrorSeverity.ERROR,
          affectedParameter: 'reinforcement_area',
          currentValue: providedArea,
          expectedRange: { min: minArea },
        }),
      };
    }

    if (providedArea > maxArea) {
      return {
        isValid: false,
        error: this.createError('C002', {
          severity: ErrorSeverity.ERROR,
          affectedParameter: 'reinforcement_area',
          currentValue: providedArea,
          expectedRange: { max: maxArea },
        }),
      };
    }

    if (providedArea < requiredArea) {
      return {
        isValid: false,
        error: this.createError('C001', {
          severity: ErrorSeverity.ERROR,
          message: 'Reinforcement area insufficient for applied moment',
          affectedParameter: 'reinforcement_area',
          currentValue: providedArea,
          expectedRange: { min: requiredArea },
        }),
      };
    }

    return { isValid: true };
  }

  /**
   * Safe division with error handling
   */
  safeDivide(
    numerator: number,
    denominator: number,
    paramName = 'division'
  ): { result: number; error?: EngineeringError } {
    if (Math.abs(denominator) < 1e-10) {
      return {
        result: 0,
        error: this.createError('N001', {
          severity: ErrorSeverity.CRITICAL,
          affectedParameter: paramName,
          technicalDetails: `Attempted: ${numerator} / ${denominator}`,
        }),
      };
    }

    const result = numerator / denominator;

    if (!Number.isFinite(result)) {
      return {
        result: 0,
        error: this.createError('N002', {
          affectedParameter: paramName,
          technicalDetails: `Result: ${result}`,
        }),
      };
    }

    return { result };
  }

  /**
   * Safe square root with error handling
   */
  safeSqrt(value: number, paramName = 'sqrt'): { result: number; error?: EngineeringError } {
    if (value < 0) {
      return {
        result: 0,
        error: this.createError('N004', {
          affectedParameter: paramName,
          currentValue: value,
          technicalDetails: 'Cannot compute square root of negative number',
        }),
      };
    }

    return { result: Math.sqrt(value) };
  }

  /**
   * Get all errors
   */
  getErrors(): EngineeringError[] {
    return [...this.errors];
  }

  /**
   * Get all warnings
   */
  getWarnings(): EngineeringError[] {
    return [...this.warnings];
  }

  /**
   * Check if there are critical errors
   */
  hasCriticalErrors(): boolean {
    return this.errors.some(e => e.severity === ErrorSeverity.CRITICAL);
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Clear all errors and warnings
   */
  clear(): void {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Generate error report
   */
  generateReport(): {
    summary: string;
    errors: EngineeringError[];
    warnings: EngineeringError[];
    recommendations: string[];
  } {
    const allSuggestions = [
      ...this.errors.flatMap(e => e.suggestions),
      ...this.warnings.flatMap(w => w.suggestions),
    ];

    return {
      summary: this.errors.length === 0
        ? 'No errors detected'
        : `${this.errors.length} error(s) and ${this.warnings.length} warning(s) found`,
      errors: this.getErrors(),
      warnings: this.getWarnings(),
      recommendations: [...new Set(allSuggestions)],
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format error for display
 */
export function formatErrorMessage(error: EngineeringError): string {
  let message = `[${error.code}] ${error.message}`;
  
  if (error.affectedParameter) {
    message += ` (Parameter: ${error.affectedParameter}`;
    if (error.currentValue !== undefined) {
      message += ` = ${error.currentValue}`;
    }
    if (error.expectedRange) {
      if (error.expectedRange.min !== undefined && error.expectedRange.max !== undefined) {
        message += `, Expected: ${error.expectedRange.min} - ${error.expectedRange.max}`;
      } else if (error.expectedRange.min !== undefined) {
        message += `, Min: ${error.expectedRange.min}`;
      } else if (error.expectedRange.max !== undefined) {
        message += `, Max: ${error.expectedRange.max}`;
      }
    }
    message += ')';
  }

  return message;
}

/**
 * Get severity icon
 */
export function getSeverityIcon(severity: ErrorSeverity): string {
  switch (severity) {
    case ErrorSeverity.INFO: return 'ℹ️';
    case ErrorSeverity.WARNING: return '⚠️';
    case ErrorSeverity.ERROR: return '❌';
    case ErrorSeverity.CRITICAL: return '🚨';
  }
}

/**
 * Get severity color class
 */
export function getSeverityColorClass(severity: ErrorSeverity): string {
  switch (severity) {
    case ErrorSeverity.INFO: return 'text-blue-400 bg-blue-500/10';
    case ErrorSeverity.WARNING: return 'text-amber-400 bg-amber-500/10';
    case ErrorSeverity.ERROR: return 'text-red-400 bg-red-500/10';
    case ErrorSeverity.CRITICAL: return 'text-red-500 bg-red-500/20';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default EngineeringErrorHandler;
