/**
 * Results Components Index
 */

export { DiagramOverlay, DiagramOverlayGroup, type DiagramData, type DiagramType } from './DiagramOverlay';
export {
    StressOverlay,
    getStressColor,
    getStressColorHex,
    type VisualizationMode,
    type NodeDisplacement,
    type MemberForces,
    type NodePosition,
    type MemberGeometry
} from './StressOverlay';
export {
    ModeShapeRenderer,
    ModeShapeControls,
    type ModeShapeData
} from './ModeShapeRenderer';
export { ResultsToolbar } from './ResultsToolbar';

// New Enhanced Visualization Components
export { EnhancedDiagramViewer, type DiagramPoint as EnhancedDiagramPoint } from './EnhancedDiagramViewer';
export { EnhancedHeatMap, type MemberData as HeatMapMemberData, type HeatMapType } from './EnhancedHeatMap';
export { 
    AnalysisResultsDashboard, 
    type AnalysisResultsData,
    type NodeResult,
    type MemberResult 
} from './AnalysisResultsDashboard';
