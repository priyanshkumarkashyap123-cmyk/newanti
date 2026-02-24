/**
 * ============================================================================
 * SMART DESIGN SUGGESTER — UI-facing "Self-Learning" Design Layer
 * ============================================================================
 *
 * React hook + panel component that:
 *   1. Before analysis: suggests section sizes from the knowledge base
 *   2. After analysis: auto-runs the iterative optimizer and stores results
 *   3. Displays: "Based on N similar designs → recommended b×D, Ast"
 *   4. Allows user to set extra FoS and preferred section constraints
 *
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  optimizeSection,
  quickEstimate,
  type OptimizeRequest,
  type OptimizeResult,
} from './IterativeSectionOptimizer';
import {
  DesignKnowledgeBase,
  type UserDesignPrefs,
} from './DesignKnowledgeBase';
import { useModelStore } from '../../store/model';

// ─────────────────────────────────────────────────────────────────────────────
// Hook: useSmartDesign
// ─────────────────────────────────────────────────────────────────────────────

export interface UseSmartDesignReturn {
  /** Run the iterative optimizer for a specific member or generic beam */
  optimize: (request: OptimizeRequest) => Promise<OptimizeResult | null>;
  /** Quick estimate (sync, no iteration — uses KB or rule-of-thumb) */
  estimate: (request: OptimizeRequest) => { b: number; D: number; Ast: number; source: string; confidence: number };
  /** Auto-design all members after analysis */
  autoDesignAll: () => Promise<OptimizeResult[]>;
  /** Latest optimization result */
  lastResult: OptimizeResult | null;
  /** All results from autoDesignAll */
  allResults: Map<string, OptimizeResult>;
  /** Whether an optimization is running */
  isOptimizing: boolean;
  /** User prefs (extra FoS, preferred grades, etc.) */
  userPrefs: UserDesignPrefs | null;
  /** Update user prefs */
  setUserPrefs: (prefs: Partial<UserDesignPrefs>) => Promise<void>;
  /** Knowledge base stats */
  kbStats: { cacheSize: number; bracketEntries: number; bracketTables: number };
  /** Clear knowledge base (reset learning) */
  clearKB: () => Promise<void>;
}

export function useSmartDesign(): UseSmartDesignReturn {
  const [lastResult, setLastResult] = useState<OptimizeResult | null>(null);
  const [allResults, setAllResults] = useState<Map<string, OptimizeResult>>(new Map());
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [userPrefs, setUserPrefsState] = useState<UserDesignPrefs | null>(null);
  const initRef = useRef(false);

  const members = useModelStore((s) => s.members);
  const nodes = useModelStore((s) => s.nodes);
  const analysisResults = useModelStore((s) => s.analysisResults);

  // Init KB + load prefs on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      await DesignKnowledgeBase.init();
      const prefs = await DesignKnowledgeBase.getUserPrefs();
      setUserPrefsState(prefs);
    })();
  }, []);

  const optimize = useCallback(async (request: OptimizeRequest) => {
    setIsOptimizing(true);
    try {
      const result = await optimizeSection(request);
      setLastResult(result);
      return result;
    } catch (err) {
      console.error('[SmartDesign] Optimization failed:', err);
      return null;
    } finally {
      setIsOptimizing(false);
    }
  }, []);

  const estimate = useCallback((request: OptimizeRequest) => {
    return quickEstimate(request);
  }, []);

  /**
   * After analysis completes, iterate over all members and run the
   * optimizer for each one.  Results are stored in both the KB and
   * the local allResults map for display.
   */
  const autoDesignAll = useCallback(async () => {
    if (!analysisResults || !members || members.size === 0) return [];
    setIsOptimizing(true);
    const results: OptimizeResult[] = [];
    const newMap = new Map<string, OptimizeResult>();

    try {
      const prefs = userPrefs ?? await DesignKnowledgeBase.getUserPrefs();

      for (const [id, member] of members.entries()) {
        // Get forces from analysis
        const forces = analysisResults.memberForces.get(id);
        if (!forces) continue;

        // Compute member length
        const startNode = nodes.get(member.startNodeId);
        const endNode = nodes.get(member.endNodeId);
        if (!startNode || !endNode) continue;

        const dx = endNode.x - startNode.x;
        const dy = endNode.y - startNode.y;
        const dz = (endNode.z ?? 0) - (startNode.z ?? 0);
        const L_mm = Math.sqrt(dx * dx + dy * dy + dz * dz) * 1000;

        if (L_mm < 100) continue; // Skip zero-length elements

        // Determine if beam or column (simple heuristic: predominantly vertical = column)
        const isColumn = Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > Math.abs(dz);
        if (isColumn) continue; // Skip columns for beam optimizer (separate flow)

        // Get max moment and shear from analysis results
        const maxMoment = Math.max(
          Math.abs(forces.momentZ ?? forces.moment_z ?? 0),
          Math.abs(forces.momentY ?? forces.moment_y ?? 0),
        );
        const maxShear = Math.max(
          Math.abs(forces.shearY ?? forces.shear_y ?? 0),
          Math.abs(forces.shearZ ?? forces.shear_z ?? 0),
        );

        // Back-calculate equivalent UDL from moment: w = 8M/L² (for SS beam)
        const L_m = L_mm / 1000;
        const w_equiv = maxMoment > 0 ? (8 * maxMoment) / (L_m * L_m) : 10; // kN/m

        const width = (member.dimensions?.rectWidth ?? 0.3) * 1000;
        const request: OptimizeRequest = {
          L: L_mm,
          w_service: w_equiv,
          loadFactor: 1.0, // Forces are already factored from analysis
          concreteGrade: prefs.preferredConcreteGrade,
          steelGrade: prefs.preferredSteelGrade,
          code: 'IS456',
          support: 'simply-supported', // Conservative default
          cover: 25,
          extraFoS: prefs.extraFoS,
          preferredWidth: width > 100 ? width : undefined,
        };

        try {
          const result = await optimizeSection(request);
          results.push(result);
          newMap.set(id, result);
        } catch (err) {
          console.warn(`[SmartDesign] Failed to optimize member ${id}:`, err);
        }
      }

      setAllResults(newMap);
      return results;
    } finally {
      setIsOptimizing(false);
    }
  }, [analysisResults, members, nodes, userPrefs]);

  const setUserPrefs = useCallback(async (partial: Partial<UserDesignPrefs>) => {
    const current = userPrefs ?? await DesignKnowledgeBase.getUserPrefs();
    const updated = { ...current, ...partial };
    await DesignKnowledgeBase.saveUserPrefs(updated);
    setUserPrefsState(updated);
  }, [userPrefs]);

  const clearKB = useCallback(async () => {
    await DesignKnowledgeBase.clear();
    setAllResults(new Map());
    setLastResult(null);
  }, []);

  const kbStats = {
    cacheSize: DesignKnowledgeBase.cacheSize,
    bracketEntries: DesignKnowledgeBase.totalBracketEntries,
    bracketTables: DesignKnowledgeBase.bracketTableCount,
  };

  return {
    optimize,
    estimate,
    autoDesignAll,
    lastResult,
    allResults,
    isOptimizing,
    userPrefs,
    setUserPrefs,
    kbStats,
    clearKB,
  };
}

export default useSmartDesign;
