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

// Types - export first to establish base types
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

// Welded Connections Module - import as namespace to avoid conflicts
import * as WeldedModule from './welded';
export { WeldedModule };

// Moment Connections Module (AISC 358-22) - import as namespace
import * as MomentModule from './moment';
export { MomentModule };

// Bracing Connections Module (AISC 341/360) - import as namespace
import * as BracingModule from './bracing';
export { BracingModule };

// Beam-Column Joints Module (ACI 352R) - import as namespace
import * as JointsModule from './joints';
export { JointsModule };

// Splice Connections Module (AISC 360/341) - import as namespace
import * as SplicesModule from './splices';
export { SplicesModule };

// Components
export { ConnectionModelingPanel } from './components/ConnectionModelingPanel';
export { Connection3DVisualization } from './components/Connection3DVisualization';
export { ConnectionAnalysisResultsPanel } from './components/ConnectionAnalysisResultsPanel';
export { ConnectionDesignWizard } from './components/ConnectionDesignWizard';

// Pages
export { ConnectionDesignPage } from './ConnectionDesignPage';
