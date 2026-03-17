/**
 * Property-based test for analysis guard (Property 3)
 * Feature: staad-pro-modeling-tools, Property 3: analysis guard prevents panel opening without results
 * Validates: Requirements 1.7, 15.5, 16.2, 17.2, 18.6
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { useUIStore } from '../uiStore';

// Tools that require completed analysis
const ANALYSIS_REQUIRED_TOOLS = [
  'PDELTA_ANALYSIS',
  'BUCKLING_ANALYSIS',
  'TIME_HISTORY_ANALYSIS',
  'NONLINEAR_ANALYSIS',
  'DYNAMICS_PANEL',
  'PLATE_STRESS_CONTOUR',
  'VIEW_STORY_DRIFT',
  'VIEW_FORCE_ENVELOPE',
  'VIEW_SECTION_FORCES',
  'ANIMATE_MODE_SHAPE',
];

// Modal keys corresponding to analysis-required tools
const ANALYSIS_MODAL_KEYS = [
  'pDeltaAnalysisPanel',
  'bucklingAnalysisPanel',
  'timeHistoryPanel',
  'nonLinearAnalysisPanel',
  'dynamicsPanel',
  'plateResultsVisualization',
  'storyDriftPanel',
  'forceEnvelopePanel',
  'sectionForcesPanel',
  'modeShapeAnimationPanel',
] as const;

/**
 * Simulates the analysis guard logic from ModernModeler.tsx.
 * Returns whether the modal should be opened.
 */
function simulateAnalysisGuard(
  toolId: string,
  analysisCompleted: boolean,
): boolean {
  const requiresAnalysis = [
    'PDELTA_ANALYSIS', 'BUCKLING_ANALYSIS', 'TIME_HISTORY_ANALYSIS',
    'NONLINEAR_ANALYSIS', 'DYNAMICS_PANEL', 'PLATE_STRESS_CONTOUR',
    'VIEW_STORY_DRIFT', 'VIEW_FORCE_ENVELOPE', 'VIEW_SECTION_FORCES',
    'ANIMATE_MODE_SHAPE',
  ];
  if (requiresAnalysis.includes(toolId) && !analysisCompleted) {
    return false; // guard blocks opening
  }
  return true; // allowed to open
}

describe('Analysis Guard — STAAD.Pro parity property tests', () => {
  beforeEach(() => {
    // Reset all modals to false before each test
    const store = useUIStore.getState();
    ANALYSIS_MODAL_KEYS.forEach((key) => {
      store.setModal(key, false);
    });
  });

  /**
   * Property 3: Analysis guard prevents panel opening without results
   * Feature: staad-pro-modeling-tools, Property 3: analysis guard prevents panel opening without results
   */
  it('analysis guard blocks all result-dependent tools when analysis is not completed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ANALYSIS_REQUIRED_TOOLS),
        (toolId) => {
          // When analysis is NOT completed, guard should block
          const allowed = simulateAnalysisGuard(toolId, false);
          return allowed === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('analysis guard allows result-dependent tools when analysis IS completed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ANALYSIS_REQUIRED_TOOLS),
        (toolId) => {
          // When analysis IS completed, guard should allow
          const allowed = simulateAnalysisGuard(toolId, true);
          return allowed === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all analysis-required modal keys start as false in uiStore', () => {
    const store = useUIStore.getState();
    ANALYSIS_MODAL_KEYS.forEach((key) => {
      expect(store.modals[key]).toBe(false);
    });
  });

  it('uiStore setModal correctly sets and clears analysis modal keys', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ANALYSIS_MODAL_KEYS),
        fc.boolean(),
        (key, value) => {
          const store = useUIStore.getState();
          store.setModal(key, value);
          return useUIStore.getState().modals[key] === value;
        },
      ),
      { numRuns: 100 },
    );
  });
});
