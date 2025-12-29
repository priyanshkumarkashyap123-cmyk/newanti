/**
 * useDesign.ts - React Hook for Structural Design Checks
 * 
 * Provides interface to design code compliance:
 * - Steel design (IS 800:2007, AISC 360-16)
 * - Concrete design (IS 456:2000)
 * - Connection design
 * - Foundation design
 */

import { useState, useCallback } from 'react';
import {
    designSteelMember,
    designConcreteBeam,
    designConcreteColumn,
    designConnection,
    designFoundation,
    getDesignCodes,
    SteelDesignRequest,
    SteelDesignResult,
    ConcreteBeamRequest,
    ConcreteBeamResult,
    ConcreteColumnRequest,
    ConcreteColumnResult,
    ConnectionRequest,
    ConnectionResult,
    FootingRequest,
    FootingResult,
    STEEL_GRADES,
    CONCRETE_GRADES,
    REBAR_GRADES,
    BOLT_GRADES,
} from '../api/design';

// Re-export utility constants
export { STEEL_GRADES, CONCRETE_GRADES, REBAR_GRADES, BOLT_GRADES };

// ============================================
// HOOK STATE TYPE
// ============================================

export interface DesignState {
    isLoading: boolean;
    error: string | null;
    steelResults: Map<string, SteelDesignResult>;
    concreteBeamResults: Map<string, ConcreteBeamResult>;
    concreteColumnResults: Map<string, ConcreteColumnResult>;
    connectionResults: Map<string, ConnectionResult>;
    footingResults: Map<string, FootingResult>;
    lastDesignType: string | null;
    availableCodes: Array<{
        id: string;
        name: string;
        material: string;
        region: string;
    }>;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useDesign() {
    const [state, setState] = useState<DesignState>({
        isLoading: false,
        error: null,
        steelResults: new Map(),
        concreteBeamResults: new Map(),
        concreteColumnResults: new Map(),
        connectionResults: new Map(),
        footingResults: new Map(),
        lastDesignType: null,
        availableCodes: [],
    });

    /**
     * Reset all results
     */
    const reset = useCallback(() => {
        setState({
            isLoading: false,
            error: null,
            steelResults: new Map(),
            concreteBeamResults: new Map(),
            concreteColumnResults: new Map(),
            connectionResults: new Map(),
            footingResults: new Map(),
            lastDesignType: null,
            availableCodes: [],
        });
    }, []);

    /**
     * Load available design codes
     */
    const loadDesignCodes = useCallback(async () => {
        try {
            const codes = await getDesignCodes();
            setState((s) => ({
                ...s,
                availableCodes: codes,
            }));
            return codes;
        } catch (err) {
            console.error('Failed to load design codes:', err);
            return [];
        }
    }, []);

    /**
     * Design steel member
     */
    const designSteel = useCallback(async (
        memberId: string,
        request: SteelDesignRequest
    ) => {
        setState((s) => ({
            ...s,
            isLoading: true,
            error: null,
            lastDesignType: 'steel',
        }));

        try {
            const result = await designSteelMember(request);
            setState((s) => {
                const newResults = new Map(s.steelResults);
                newResults.set(memberId, result);
                return {
                    ...s,
                    isLoading: false,
                    steelResults: newResults,
                };
            });
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Steel design failed';
            setState((s) => ({
                ...s,
                isLoading: false,
                error: errorMessage,
            }));
            throw err;
        }
    }, []);

    /**
     * Design concrete beam
     */
    const designBeam = useCallback(async (
        beamId: string,
        request: ConcreteBeamRequest
    ) => {
        setState((s) => ({
            ...s,
            isLoading: true,
            error: null,
            lastDesignType: 'concrete_beam',
        }));

        try {
            const result = await designConcreteBeam(request);
            setState((s) => {
                const newResults = new Map(s.concreteBeamResults);
                newResults.set(beamId, result);
                return {
                    ...s,
                    isLoading: false,
                    concreteBeamResults: newResults,
                };
            });
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Beam design failed';
            setState((s) => ({
                ...s,
                isLoading: false,
                error: errorMessage,
            }));
            throw err;
        }
    }, []);

    /**
     * Design concrete column
     */
    const designColumn = useCallback(async (
        columnId: string,
        request: ConcreteColumnRequest
    ) => {
        setState((s) => ({
            ...s,
            isLoading: true,
            error: null,
            lastDesignType: 'concrete_column',
        }));

        try {
            const result = await designConcreteColumn(request);
            setState((s) => {
                const newResults = new Map(s.concreteColumnResults);
                newResults.set(columnId, result);
                return {
                    ...s,
                    isLoading: false,
                    concreteColumnResults: newResults,
                };
            });
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Column design failed';
            setState((s) => ({
                ...s,
                isLoading: false,
                error: errorMessage,
            }));
            throw err;
        }
    }, []);

    /**
     * Design connection
     */
    const designConn = useCallback(async (
        connId: string,
        request: ConnectionRequest
    ) => {
        setState((s) => ({
            ...s,
            isLoading: true,
            error: null,
            lastDesignType: 'connection',
        }));

        try {
            const result = await designConnection(request);
            setState((s) => {
                const newResults = new Map(s.connectionResults);
                newResults.set(connId, result);
                return {
                    ...s,
                    isLoading: false,
                    connectionResults: newResults,
                };
            });
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Connection design failed';
            setState((s) => ({
                ...s,
                isLoading: false,
                error: errorMessage,
            }));
            throw err;
        }
    }, []);

    /**
     * Design foundation
     */
    const designFooting = useCallback(async (
        footingId: string,
        request: FootingRequest
    ) => {
        setState((s) => ({
            ...s,
            isLoading: true,
            error: null,
            lastDesignType: 'foundation',
        }));

        try {
            const result = await designFoundation(request);
            setState((s) => {
                const newResults = new Map(s.footingResults);
                newResults.set(footingId, result);
                return {
                    ...s,
                    isLoading: false,
                    footingResults: newResults,
                };
            });
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Foundation design failed';
            setState((s) => ({
                ...s,
                isLoading: false,
                error: errorMessage,
            }));
            throw err;
        }
    }, []);

    /**
     * Get overall design status for a member
     */
    const getMemberDesignStatus = useCallback((
        memberId: string
    ): 'pass' | 'warning' | 'fail' | 'not_designed' => {
        const steelResult = state.steelResults.get(memberId);
        if (steelResult) {
            const maxRatio = Math.max(...steelResult.checks.map((c) => c.utilization_ratio));
            if (maxRatio > 1) return 'fail';
            if (maxRatio > 0.9) return 'warning';
            return 'pass';
        }
        return 'not_designed';
    }, [state.steelResults]);

    /**
     * Batch design all steel members
     */
    const designAllSteelMembers = useCallback(async (
        memberRequests: Array<{ id: string; request: SteelDesignRequest }>
    ) => {
        setState((s) => ({
            ...s,
            isLoading: true,
            error: null,
        }));

        const results: Array<{ id: string; result: SteelDesignResult | null; error?: string }> = [];

        for (const { id, request } of memberRequests) {
            try {
                const result = await designSteelMember(request);
                results.push({ id, result });
            } catch (err) {
                results.push({
                    id,
                    result: null,
                    error: err instanceof Error ? err.message : 'Design failed',
                });
            }
        }

        setState((s) => {
            const newResults = new Map(s.steelResults);
            for (const { id, result } of results) {
                if (result) {
                    newResults.set(id, result);
                }
            }
            return {
                ...s,
                isLoading: false,
                steelResults: newResults,
            };
        });

        return results;
    }, []);

    return {
        ...state,
        designSteel,
        designBeam,
        designColumn,
        designConn,
        designFooting,
        loadDesignCodes,
        getMemberDesignStatus,
        designAllSteelMembers,
        reset,
    };
}

// ============================================
// SPECIALIZED HOOKS
// ============================================

/**
 * Hook specifically for RC beam/column design
 */
export function useRCDesign() {
    const design = useDesign();

    const [rcSettings, setRCSettings] = useState({
        concreteGrade: 'M25',
        rebarGrade: 'Fe500',
        clearCover: 40, // mm
        stirrupDia: 8,  // mm
    });

    const designRCBeam = useCallback(async (
        beamId: string,
        b: number,      // mm
        D: number,      // mm
        Mu: number,     // kN.m
        Vu: number,     // kN
        span: number    // mm
    ) => {
        const concreteData = CONCRETE_GRADES.find((g) => g.name === rcSettings.concreteGrade);
        const rebarData = REBAR_GRADES.find((g) => g.name === rcSettings.rebarGrade);

        const request: ConcreteBeamRequest = {
            b,
            D,
            Mu,
            Vu,
            fck: concreteData?.fck || 25,
            fy: rebarData?.fy || 500,
            clear_cover: rcSettings.clearCover,
            span,
        };

        return design.designBeam(beamId, request);
    }, [design, rcSettings]);

    const designRCColumn = useCallback(async (
        columnId: string,
        b: number,      // mm
        D: number,      // mm
        Pu: number,     // kN
        Mux: number,    // kN.m
        Muy: number,    // kN.m
        L: number       // mm
    ) => {
        const concreteData = CONCRETE_GRADES.find((g) => g.name === rcSettings.concreteGrade);
        const rebarData = REBAR_GRADES.find((g) => g.name === rcSettings.rebarGrade);

        const request: ConcreteColumnRequest = {
            b,
            D,
            Pu,
            Mux,
            Muy: Muy || 0,
            fck: concreteData?.fck || 25,
            fy: rebarData?.fy || 500,
            clear_cover: rcSettings.clearCover,
            unsupported_length: L,
        };

        return design.designColumn(columnId, request);
    }, [design, rcSettings]);

    return {
        ...design,
        rcSettings,
        setRCSettings,
        designRCBeam,
        designRCColumn,
    };
}

/**
 * Hook specifically for foundation design
 */
export function useFoundationDesign() {
    const design = useDesign();

    const [soilSettings, setSoilSettings] = useState({
        sbc: 150,           // kN/m²
        soilType: 'medium', // 'loose' | 'medium' | 'dense'
        waterTable: 3.0,    // m below GL
    });

    const designIsolatedFooting = useCallback(async (
        footingId: string,
        columnLoad: number,     // kN
        columnMoment: number,   // kN.m
        columnSize: { B: number; D: number }, // mm
    ) => {
        const request: FootingRequest = {
            type: 'isolated',
            loads: {
                axial: columnLoad,
                momentX: columnMoment,
                momentY: 0,
            },
            soilBearingCapacity: soilSettings.sbc,
            concreteGrade: 25,
            steelGrade: 500,
            columnDimensions: columnSize,
        };

        return design.designFooting(footingId, request);
    }, [design, soilSettings]);

    return {
        ...design,
        soilSettings,
        setSoilSettings,
        designIsolatedFooting,
    };
}
