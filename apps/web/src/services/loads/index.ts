/**
 * Loads Services Index
 */

export {
    loadCombinations,
    default as LoadCombinationsService,
    type LoadCase,
    type LoadCombination,
    type CombinedLoads
} from './LoadCombinationsService';

// Backward compatibility type aliases
export type LoadCode = 'IS' | 'ASCE' | 'EC';
export type LoadType = 'dead' | 'live' | 'wind' | 'seismic' | 'snow' | 'rain' | 'temperature' | 'self_weight';

export {
    windLoad,
    default as WindLoadService,
    type RiskCategory,
    type ExposureCategory,
    type WindLoadParams,
    type WindPressure,
    type WindLoadResult
} from './WindLoadService';

export {
    seismicSpectrum,
    default as SeismicResponseSpectrum,
    type SiteClass,
    type SeismicDesignCategory,
    type SiteParameters,
    type DesignSpectra,
    type ELFResult
} from './SeismicResponseSpectrum';

export {
    patternLoading,
    default as PatternLoadingService,
    type PatternType,
    type SpanInfo,
    type PatternLoadCase,
    type PatternCombination
} from './PatternLoadingService';

export {
    advancedLoads,
    default as AdvancedLoadsService,
    type TemperatureLoad,
    type SupportSettlement,
    type NotionalLoad,
    type InitialStrain,
    type PrestressLoad
} from './AdvancedLoadsService';
