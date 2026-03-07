/**
 * BIM Modules Index
 */

export {
    default as BIMIntegrationEngine
} from './BIMIntegrationEngine';

// BCF Round-Trip Engine — BIM Collaboration Format 3.0
export {
    default as BCFRoundTripEngine,
    type BCFTopic,
    type BCFComment,
    type BCFViewpoint,
    type BCFProject,
    type BCFImportResult,
    type BCFTopicsSummary,
    type DesignChangeRequest,
    type AnalysisResultForBCF,
    type StructuralTopicData,
    type TopicType,
    type TopicStatus,
    type Priority,
    type ColoredComponent,
    type ClippingPlane,
    type DocumentReference
} from './BCFRoundTripEngine';
