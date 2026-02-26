/**
 * Memoized selectors for model store
 * Use these instead of accessing state directly to minimize re-renders
 * 
 * @see bottleneck_report.md - Component #1 React State Cascade fix
 */

import { useModelStore, MemberLoad } from './model';
import { useShallow } from 'zustand/shallow';

const REFERENCE_LOAD = 100; // 100 kN reference for scaling

/**
 * Select a single member load by ID
 * Only re-renders when THAT SPECIFIC load changes
 */
export const useMemberLoadById = (id: string): MemberLoad | undefined => {
    return useModelStore(
        useShallow((state) => state.memberLoads.find(l => l.id === id))
    );
};

/**
 * Select member load count (for conditional rendering)
 * Only re-renders when COUNT changes, not content
 */
export const useMemberLoadCount = (): number => {
    return useModelStore((state) => state.memberLoads.length);
};

/**
 * Select all member load IDs (for iteration without full objects)
 */
export const useMemberLoadIds = (): string[] => {
    return useModelStore(
        useShallow((state) => state.memberLoads.map(l => l.id))
    );
};

/**
 * Select max load magnitude (for scaling)
 * Optimized to only recalculate when needed
 */
export const useMaxLoadMagnitude = (): number => {
    return useModelStore((state) => {
        let maxMag = REFERENCE_LOAD;
        for (const ml of state.memberLoads) {
            const w1 = Math.abs(ml.w1 ?? 0);
            const w2 = Math.abs(ml.w2 ?? ml.w1 ?? 0);
            const P = Math.abs(ml.P ?? 0);
            maxMag = Math.max(maxMag, w1, w2, P);
        }
        return maxMag;
    });
};

/**
 * Select nodes map (for geometry calculations)
 * Uses shallow comparison to prevent unnecessary re-renders
 */
export const useNodes = () => {
    return useModelStore(useShallow((state) => state.nodes));
};

/**
 * Select members map (for geometry calculations)
 * Uses shallow comparison to prevent unnecessary re-renders
 */
export const useMembers = () => {
    return useModelStore(useShallow((state) => state.members));
};

/**
 * Select analysis results with shallow comparison
 */
export const useAnalysisResults = () => {
    return useModelStore(useShallow((state) => state.analysisResults));
};

/**
 * Select diagram visibility flags as a single object
 * Reduces number of subscriptions
 */
export const useDiagramVisibility = () => {
    return useModelStore(
        useShallow((state) => ({
            showSFD: state.showSFD,
            showBMD: state.showBMD,
            showAFD: state.showAFD,
            showStressOverlay: state.showStressOverlay,
            showDeflectedShape: state.showDeflectedShape,
        }))
    );
};
