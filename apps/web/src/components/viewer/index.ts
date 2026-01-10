/**
 * Viewer Components Index
 */

export { Overlays, AxisLabels, type NodeData, type LoadData } from './Overlays';
export { ViewCubeOverlay, useViewCubeCamera } from './ViewCube';
export { CanvasStatusBar, ZoomIndicator } from './StatusBar';
export { InteractionLayer } from './InteractionLayer';
export {
    StructuralMesh,
    StructuralMember,
    SupportVisualization,
    getSectionGeometry,
    type SectionType,
    type SectionDimensions,
    type SupportType,
    type MemberData
} from './StructuralMesh';
export { StructuralCanvas } from './StructuralCanvas';
export { WgpuCanvas } from './WgpuCanvas';

// Ultra-light renderers for massive models (50,000+ members)
export { UltraLightMembersRenderer } from './UltraLightMembersRenderer';
export { UltraLightNodesRenderer } from './UltraLightNodesRenderer';

// Standard instanced renderers
export { InstancedMembersRenderer } from './InstancedMembersRenderer';
export { InstancedNodesRenderer } from './InstancedNodesRenderer';

// Safe wrapper with error boundary and memory monitoring
export { 
    SafeCanvasWrapper, 
    CanvasErrorBoundary, 
    PerformanceWarning,
    useMemoryMonitor,
    useModelSizeCheck 
} from './SafeCanvasWrapper';
