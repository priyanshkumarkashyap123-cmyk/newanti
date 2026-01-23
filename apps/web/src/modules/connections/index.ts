/**
 * ============================================================================
 * CONNECTIONS MODULE - INDEX
 * ============================================================================
 * 
 * Main export file for all connection engineering modules
 * Comprehensive connection design per AISC, Eurocode, ACI
 * 
 * Includes:
 * - Bolted connections (AISC 360, Eurocode 3, IS 800)
 * - Welded connections (Fillet, groove, base plates)
 * - Moment connections (RBS, BFP, End plate - AISC 358)
 * - Bracing connections (Gusset plates - AISC 341/360)
 * - Beam-column joints (RC joints - ACI 352R)
 * - Splice connections (Column splices - AISC 360/341)
 * 
 * @author BeamLab Engineering Team
 * @version 2.0.0
 */

// Types
export * from './types/BoltedConnectionTypes';

// Analysis
export { BoltedConnectionAnalyzer } from './analysis/BoltedConnectionAnalyzer';
export { 
  createRectangularPattern,
  getBoltDimensions,
  getMinimumEdgeDistance,
  getMinimumSpacing,
} from './analysis/BoltedConnectionAnalyzer';

export {
  createDesignCodeCalculator,
  AISC360Calculator,
  Eurocode3Calculator,
  IS800Calculator,
} from './analysis/DesignCodeCalculators';

// Welded Connections Module
export * from './welded';

// Moment Connections Module (AISC 358-22)
export * from './moment';

// Bracing Connections Module (AISC 341/360)
export * from './bracing';

// Beam-Column Joints Module (ACI 352R)
export * from './joints';

// Splice Connections Module (AISC 360/341)
export * from './splices';

// Components
export { ConnectionModelingPanel } from './components/ConnectionModelingPanel';
export { Connection3DVisualization } from './components/Connection3DVisualization';
export { ConnectionAnalysisResultsPanel } from './components/ConnectionAnalysisResultsPanel';
export { ConnectionDesignWizard } from './components/ConnectionDesignWizard';

// Pages
export { ConnectionDesignPage } from './ConnectionDesignPage';
