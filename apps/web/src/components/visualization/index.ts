/**
 * ============================================================================
 * VISUALIZATION COMPONENTS INDEX
 * ============================================================================
 * 
 * Central export hub for all visualization components:
 * - 3D Model Visualization
 * - Results Charts & Diagrams
 * - Heatmaps & Contours
 * - Animation Controls
 * - Export Manager
 * 
 * @version 1.0.0
 */

// ============================================================================
// 3D VISUALIZATION
// ============================================================================

export {
    ModelVisualizationDashboard,
    type ViewPreset,
    type RenderMode,
    type ColorScheme,
} from './ModelVisualizationDashboard';

// ============================================================================
// INTERACTIVE CHARTS
// ============================================================================

export {
    ForceDiagramChart,
    CombinedDiagramsChart,
    TimeHistoryChart,
    ResponseSpectrumChart,
    PMInteractionChart,
    PushoverChart,
    type DiagramDataPoint,
    type MemberDiagramData,
    type TimeHistoryData,
    type ResponseSpectrumData,
    type InteractionPoint,
    type PushoverData,
    type ChartSettings
} from './InteractiveResultsCharts';

// ============================================================================
// HEATMAPS & CONTOURS
// ============================================================================

export {
    ResultsHeatmap,
    UtilizationHeatmap,
    ColorScaleLegend,
    COLOR_SCALES,
    SCALE_LABELS,
    type HeatmapType,
    type ColorScale,
    type HeatmapDataPoint,
    type HeatmapGridCell,
    type HeatmapConfig,
    type LegendConfig,
    type TooltipData
} from './ResultsHeatmap';

// ============================================================================
// ANIMATION CONTROLS
// ============================================================================

export {
    AnimationControls,
    PlaybackControlBar,
    ModeShapeSelector,
    AnimationSettingsPanel,
    RecordingPanel,
    type AnimationType,
    type PlaybackState,
    type AnimationFrame,
    type AnimationConfig,
    type ModeShapeConfig,
    type TimeHistoryConfig,
    type RecordingConfig
} from './AnimationControls';

// ============================================================================
// ANIMATED MODE SHAPES (existing)
// ============================================================================

export {
    AnimatedModeShapes,
    type ModeShape,
    type AnimationSettings,
} from './AnimatedModeShapes';

// NodePosition is exported here and will be re-used
export type { NodePosition } from './AnimatedModeShapes';

// ============================================================================
// RE-EXPORTS FROM RELATED DIRECTORIES
// ============================================================================

// Results components - using explicit exports to avoid conflicts
export { StressContourRenderer } from '../results/StressContourRenderer';
export { MemberDiagramOverlay, StressColorOverlay, SectionScanner, AllResultsOverlay } from '../results/ResultsViewportOverlay';
export { DiagramOverlay } from '../results/DiagramOverlay';

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Common visualization color palettes
 */
export const VISUALIZATION_COLORS = {
    // Stress/Force gradients
    stressGradient: ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'],
    
    // Utilization gradient
    utilizationGradient: ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'],
    
    // Displacement gradient
    displacementGradient: ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'],
    
    // Primary analysis colors
    shear: '#3b82f6',      // Blue
    moment: '#ef4444',     // Red
    axial: '#22c55e',      // Green
    torsion: '#a855f7',    // Purple
    
    // Mode shape colors
    modeShape: '#06b6d4',  // Cyan
    undeformed: '#64748b', // Slate
    
    // Chart colors
    chartPrimary: '#06b6d4',
    chartSecondary: '#8b5cf6',
    chartTertiary: '#f59e0b',
    chartGrid: '#334155',
    chartText: '#94a3b8'
};

/**
 * Standard visualization units
 */
export const VISUALIZATION_UNITS = {
    force: {
        metric: { unit: 'kN', factor: 1 },
        imperial: { unit: 'kip', factor: 0.2248 }
    },
    moment: {
        metric: { unit: 'kN·m', factor: 1 },
        imperial: { unit: 'kip·ft', factor: 0.7376 }
    },
    stress: {
        metric: { unit: 'MPa', factor: 1 },
        imperial: { unit: 'ksi', factor: 0.145 }
    },
    displacement: {
        metric: { unit: 'mm', factor: 1 },
        imperial: { unit: 'in', factor: 0.0394 }
    },
    frequency: {
        unit: 'Hz',
        factor: 1
    },
    period: {
        unit: 's',
        factor: 1
    }
};

/**
 * Default chart dimensions
 */
export const CHART_DIMENSIONS = {
    small: { width: 400, height: 250 },
    medium: { width: 600, height: 350 },
    large: { width: 800, height: 450 },
    wide: { width: 1000, height: 350 },
    tall: { width: 500, height: 600 }
};

/**
 * Animation presets
 */
export const ANIMATION_PRESETS = {
    slow: { speed: 0.5, fps: 30 },
    normal: { speed: 1.0, fps: 60 },
    fast: { speed: 2.0, fps: 60 },
    presentation: { speed: 0.75, fps: 30 },
    recording: { speed: 1.0, fps: 30 }
};

/**
 * Export format presets
 */
export const EXPORT_PRESETS = {
    web: { width: 1920, height: 1080, format: 'webm' as const, quality: 'high' as const },
    mobile: { width: 1280, height: 720, format: 'mp4' as const, quality: 'medium' as const },
    gif: { width: 800, height: 600, format: 'gif' as const, quality: 'medium' as const },
    print: { width: 2560, height: 1440, format: 'frames' as const, quality: 'high' as const }
};
