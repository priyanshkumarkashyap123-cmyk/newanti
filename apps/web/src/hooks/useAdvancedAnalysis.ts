/**
 * useAdvancedAnalysis.ts - React Hook for Advanced Structural Analysis
 * 
 * Provides interface to advanced analysis capabilities:
 * - P-Delta analysis (geometric nonlinear)
 * - Modal analysis (eigenvalue extraction)
 * - Response spectrum analysis (seismic)
 * - Buckling analysis (stability)
 * - Cable analysis (catenary/tension-only)
 */

import { useState, useCallback } from 'react';
import {
    runPDeltaAnalysis,
    runModalAnalysis,
    runSpectrumAnalysis,
    runBucklingAnalysis,
    runCableAnalysis,
    PDeltaRequest,
    PDeltaResult,
    ModalRequest,
    ModalResult,
    SpectrumRequest,
    SpectrumResult,
    BucklingRequest,
    BucklingResult,
    CableRequest,
    CableResult,
    convertModelForAdvancedAnalysis,
    IS1893_ZONE_FACTORS,
    IS1893_SOIL_TYPES,
} from '../api/advancedAnalysis';

// Re-export utility constants
export { IS1893_ZONE_FACTORS, IS1893_SOIL_TYPES };

// ============================================
// HOOK STATE TYPE
// ============================================

export interface AdvancedAnalysisState {
    isLoading: boolean;
    error: string | null;
    pdeltaResult: PDeltaResult | null;
    modalResult: ModalResult | null;
    spectrumResult: SpectrumResult | null;
    bucklingResult: BucklingResult | null;
    cableResult: CableResult | null;
    lastAnalysisType: string | null;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useAdvancedAnalysis() {
    const [state, setState] = useState<AdvancedAnalysisState>({
        isLoading: false,
        error: null,
        pdeltaResult: null,
        modalResult: null,
        spectrumResult: null,
        bucklingResult: null,
        cableResult: null,
        lastAnalysisType: null,
    });

    /**
     * Reset all results
     */
    const reset = useCallback(() => {
        setState({
            isLoading: false,
            error: null,
            pdeltaResult: null,
            modalResult: null,
            spectrumResult: null,
            bucklingResult: null,
            cableResult: null,
            lastAnalysisType: null,
        });
    }, []);

    /**
     * Run P-Delta analysis
     */
    const runPDelta = useCallback(async (request: PDeltaRequest) => {
        setState((s) => ({
            ...s,
            isLoading: true,
            error: null,
            lastAnalysisType: 'pdelta',
        }));

        try {
            const result = await runPDeltaAnalysis(request);
            setState((s) => ({
                ...s,
                isLoading: false,
                pdeltaResult: result,
            }));
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'P-Delta analysis failed';
            setState((s) => ({
                ...s,
                isLoading: false,
                error: errorMessage,
            }));
            throw err;
        }
    }, []);

    /**
     * Run Modal analysis
     */
    const runModal = useCallback(async (request: ModalRequest) => {
        setState((s) => ({
            ...s,
            isLoading: true,
            error: null,
            lastAnalysisType: 'modal',
        }));

        try {
            const result = await runModalAnalysis(request);
            setState((s) => ({
                ...s,
                isLoading: false,
                modalResult: result,
            }));
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Modal analysis failed';
            setState((s) => ({
                ...s,
                isLoading: false,
                error: errorMessage,
            }));
            throw err;
        }
    }, []);

    /**
     * Run Response Spectrum analysis
     */
    const runSpectrum = useCallback(async (request: SpectrumRequest) => {
        setState((s) => ({
            ...s,
            isLoading: true,
            error: null,
            lastAnalysisType: 'spectrum',
        }));

        try {
            const result = await runSpectrumAnalysis(request);
            setState((s) => ({
                ...s,
                isLoading: false,
                spectrumResult: result,
            }));
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Spectrum analysis failed';
            setState((s) => ({
                ...s,
                isLoading: false,
                error: errorMessage,
            }));
            throw err;
        }
    }, []);

    /**
     * Run Buckling analysis
     */
    const runBuckling = useCallback(async (request: BucklingRequest) => {
        setState((s) => ({
            ...s,
            isLoading: true,
            error: null,
            lastAnalysisType: 'buckling',
        }));

        try {
            const result = await runBucklingAnalysis(request);
            setState((s) => ({
                ...s,
                isLoading: false,
                bucklingResult: result,
            }));
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Buckling analysis failed';
            setState((s) => ({
                ...s,
                isLoading: false,
                error: errorMessage,
            }));
            throw err;
        }
    }, []);

    /**
     * Run Cable/Tension-Only analysis
     */
    const runCable = useCallback(async (request: CableRequest) => {
        setState((s) => ({
            ...s,
            isLoading: true,
            error: null,
            lastAnalysisType: 'cable',
        }));

        try {
            const result = await runCableAnalysis(request);
            setState((s) => ({
                ...s,
                isLoading: false,
                cableResult: result,
            }));
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Cable analysis failed';
            setState((s) => ({
                ...s,
                isLoading: false,
                error: errorMessage,
            }));
            throw err;
        }
    }, []);

    return {
        ...state,
        runPDelta,
        runModal,
        runSpectrum,
        runBuckling,
        runCable,
        reset,
        convertModelForAdvancedAnalysis,
    };
}

// ============================================
// HELPER HOOKS
// ============================================

/**
 * Hook specifically for seismic analysis with IS 1893:2016
 */
export function useSeismicAnalysis() {
    const analysis = useAdvancedAnalysis();
    const [seismicConfig, setSeismicConfig] = useState({
        zone: 4 as 1 | 2 | 3 | 4 | 5,
        soilType: 'II' as 'I' | 'II' | 'III',
        importanceFactor: 1.0,
        responseFactor: 5.0,
        dampingRatio: 0.05,
    });

    const runSeismic = useCallback(
        async (
            nodes: Parameters<typeof convertModelForAdvancedAnalysis>[0],
            members: Parameters<typeof convertModelForAdvancedAnalysis>[1],
            supports: Parameters<typeof convertModelForAdvancedAnalysis>[2],
            numModes = 12
        ) => {
            const model = convertModelForAdvancedAnalysis(nodes, members, supports);

            const request: SpectrumRequest = {
                ...model,
                numModes,
                spectrum: {
                    type: 'IS1893',
                    zoneLevel: seismicConfig.zone,
                    soilType: seismicConfig.soilType,
                    dampingRatio: seismicConfig.dampingRatio,
                    importanceFactor: seismicConfig.importanceFactor,
                    responseFactor: seismicConfig.responseFactor,
                },
                combinationMethod: 'CQC',
            };

            return analysis.runSpectrum(request);
        },
        [analysis, seismicConfig]
    );

    return {
        ...analysis,
        seismicConfig,
        setSeismicConfig,
        runSeismic,
    };
}

/**
 * Hook specifically for stability analysis
 */
export function useStabilityAnalysis() {
    const analysis = useAdvancedAnalysis();

    /**
     * Full stability check: P-Delta + Buckling
     */
    const runStabilityCheck = useCallback(
        async (
            nodes: Parameters<typeof convertModelForAdvancedAnalysis>[0],
            members: Parameters<typeof convertModelForAdvancedAnalysis>[1],
            supports: Parameters<typeof convertModelForAdvancedAnalysis>[2],
            loads: Array<{
                nodeId: string;
                fx?: number;
                fy?: number;
                fz?: number;
            }>
        ) => {
            const model = convertModelForAdvancedAnalysis(nodes, members, supports);

            // Create node ID map for loads
            const nodeIdMap = new Map<string, number>();
            nodes.forEach((n, i) => nodeIdMap.set(n.id, i + 1));

            const convertedLoads = loads.map((l) => ({
                nodeId: nodeIdMap.get(l.nodeId) || 1,
                fx: l.fx,
                fy: l.fy,
                fz: l.fz,
            }));

            // Run P-Delta first
            const pdeltaResult = await analysis.runPDelta({
                ...model,
                loads: convertedLoads,
            });

            // Then run buckling analysis
            const bucklingResult = await analysis.runBuckling({
                ...model,
                loads: convertedLoads,
                numModes: 5,
            });

            return {
                pdelta: pdeltaResult,
                buckling: bucklingResult,
                isStable:
                    pdeltaResult.converged &&
                    bucklingResult.isStable &&
                    (bucklingResult.firstBucklingLoad || 999) > 1.0,
            };
        },
        [analysis]
    );

    return {
        ...analysis,
        runStabilityCheck,
    };
}
