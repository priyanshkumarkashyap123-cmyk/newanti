/**
 * Loads Module Index
 * Comprehensive load analysis per ASCE 7-22
 */

// Load Combinations
export * from './LoadCombinationTypes';
export { LoadCombinationCalculator, calculateLoadCombinations } from './LoadCombinationCalculator';

// Wind Loads (use namespace to avoid conflicts)
import * as WindTypes from './wind/WindLoadTypes';
export { WindTypes };
export { WindLoadCalculator, calculateWindLoads } from './wind/WindLoadCalculator';

// Seismic Loads (use namespace to avoid conflicts)
import * as SeismicTypes from './seismic/SeismicLoadTypes';
export { SeismicTypes };
export { SeismicLoadCalculator, calculateSeismicLoads } from './seismic/SeismicLoadCalculator';

// Re-export common types explicitly
export type { 
    WindLoadInput,
    WindLoadResult,
    DesignPressure as WindPressure,
    VelocityPressureResult as MWFRS_Result,
    PressureCoefficients as ComponentResult
} from './wind/WindLoadTypes';

export type {
    SeismicLoadInput,
    SeismicLoadResult,
    SeismicDesignCategory
} from './seismic/SeismicLoadTypes';
