/**
 * Civil Engineering Services Index
 * 
 * All Civil Engineering Disciplines
 */

// Geotechnical Engineering
export {
    geotechnical,
    default as GeotechnicalService,
    type SoilType,
    type SoilLayer,
    type SoilProperties,
    type FoundationInput,
    type BearingCapacityResult,
    type SettlementResult,
    type SlopeStabilityResult,
    type EarthPressure,
    type PileCapacity
} from './GeotechnicalService';

// Transportation Engineering
export {
    transportation,
    default as TransportationService,
    type RoadClass,
    type TerrainType,
    type PavementType,
    type HorizontalCurve,
    type VerticalCurve,
    type CrossSection,
    type PavementDesign,
    type TrafficData,
    type LevelOfService,
    type IntersectionAnalysis
} from './TransportationService';

// Hydraulics & Water Resources
export {
    hydraulics,
    default as HydraulicsService,
    type ChannelType,
    type FlowRegime,
    type PipeType as HydraulicPipeType,
    type ChannelGeometry,
    type ChannelProperties,
    type OpenChannelResult,
    type PipeFlowInput,
    type PipeFlowResult,
    type CulvertInput,
    type CulvertResult,
    type StormDrainageInput,
    type StormDrainageResult
} from './HydraulicsService';

// Environmental Engineering
export {
    environmental,
    default as EnvironmentalService,
    type WaterQuality,
    type TreatmentUnit,
    type WTPDesign,
    type STPDesign,
    type AirQuality,
    type SolidWaste,
    type NoisePollution
} from './EnvironmentalService';

// Construction Management
export {
    construction,
    default as ConstructionManagementService,
    type Activity,
    type ResourceRequirement,
    type ScheduleResult,
    type ActivitySchedule,
    type EstimateItem,
    type CostEstimate,
    type EarnedValueMetrics,
    type RiskItem
} from './ConstructionManagementService';

// Surveying
export {
    surveying,
    default as SurveyingService,
    type Point,
    type TraverseStation,
    type LevelReading,
    type ContourPoint
} from './SurveyingService';
