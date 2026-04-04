/**
 * useWasmSolver - React Hook for WASM Linear Solver
 * 
 * Provides interface to the Web Worker-based WASM solver.
 * Automatically handles worker lifecycle and request/response management.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ============================================
// TYPES
// ============================================

export interface SolveOptions {
    method?: 'lu' | 'cholesky' | 'auto';
}

export interface SolveResult {
    displacements: number[];
    solveTimeMs: number;
    usedWasm: boolean;
}

export interface EigenResult {
    eigenvalues: number[];
    frequencies: number[];  // Hz
    eigenvectors: number[][];
}

export interface ConditionResult {
    isWellConditioned: boolean;
    conditionNumber?: number;
    determinant: number;
    rank: number;
    warning?: string;
}

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
}

// ============================================
// HOOK
// ============================================

export function useWasmSolver() {
    const workerRef = useRef<Worker | null>(null);
    const pendingRequests = useRef<Map<string, PendingRequest>>(new Map());
    const [isWasmReady, setIsWasmReady] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const requestIdRef = useRef(0);

    // Initialize worker
    useEffect(() => {
        // Create worker
        workerRef.current = new Worker(
            new URL('../workers/SolverWorker.ts', import.meta.url),
            { type: 'module' }
        );

        // Handle messages from worker
        workerRef.current.onmessage = (event) => {
            const data = event.data;

            // WASM ready notification
            if (data.type === 'wasm_ready') {
                setIsWasmReady(true);
                return;
            }

            // Handle response
            const pending = pendingRequests.current.get(data.requestId);
            if (pending) {
                pendingRequests.current.delete(data.requestId);

                if (data.success) {
                    pending.resolve(data);
                } else {
                    pending.reject(new Error(data.error || 'Unknown error'));
                }
            }
        };

        workerRef.current.onerror = (error) => {
            console.error('[useWasmSolver] Worker error:', error);
        };

        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, []);

    /**
     * Generate unique request ID
     */
    const generateRequestId = useCallback((): string => {
        requestIdRef.current += 1;
        return `req-${Date.now()}-${requestIdRef.current}`;
    }, []);

    /**
     * Solve linear system K * u = F
     */
    const solve = useCallback(async (
        stiffness: number[] | Float64Array,
        forces: number[] | Float64Array,
        dof: number,
        options: SolveOptions = {}
    ): Promise<SolveResult> => {
        if (!workerRef.current) {
            throw new Error('Solver worker not initialized');
        }

        const requestId = generateRequestId();
        setIsLoading(true);

        try {
            const result = await new Promise<any>((resolve, reject) => {
                pendingRequests.current.set(requestId, { resolve, reject });

                workerRef.current!.postMessage({
                    type: 'solve',
                    requestId,
                    stiffness: new Float64Array(stiffness),
                    forces: new Float64Array(forces),
                    dof,
                    method: options.method || 'auto'
                });

                // Timeout after 60 seconds
                setTimeout(() => {
                    if (pendingRequests.current.has(requestId)) {
                        pendingRequests.current.delete(requestId);
                        reject(new Error('Solver timeout'));
                    }
                }, 60000);
            });

            return {
                displacements: result.data.displacements,
                solveTimeMs: result.solveTimeMs,
                usedWasm: result.usedWasm
            };
        } finally {
            setIsLoading(false);
        }
    }, [generateRequestId]);

    /**
     * Compute eigenvalues and mode shapes
     */
    const computeEigenvalues = useCallback(async (
        stiffness: number[] | Float64Array,
        mass: number[] | Float64Array,
        dof: number,
        numModes: number = 10
    ): Promise<EigenResult> => {
        if (!workerRef.current) {
            throw new Error('Solver worker not initialized');
        }

        if (!isWasmReady) {
            throw new Error('Eigenvalue analysis requires WASM module');
        }

        const requestId = generateRequestId();
        setIsLoading(true);

        try {
            const result = await new Promise<any>((resolve, reject) => {
                pendingRequests.current.set(requestId, { resolve, reject });

                workerRef.current!.postMessage({
                    type: 'eigen',
                    requestId,
                    stiffness: new Float64Array(stiffness),
                    mass: new Float64Array(mass),
                    dof,
                    numModes
                });

                setTimeout(() => {
                    if (pendingRequests.current.has(requestId)) {
                        pendingRequests.current.delete(requestId);
                        reject(new Error('Eigenvalue computation timeout'));
                    }
                }, 120000);
            });

            return {
                eigenvalues: result.data.eigenvalues,
                frequencies: result.data.frequencies,
                eigenvectors: result.data.eigenvectors
            };
        } finally {
            setIsLoading(false);
        }
    }, [generateRequestId, isWasmReady]);

    /**
     * Check matrix condition
     */
    const checkCondition = useCallback(async (
        stiffness: number[] | Float64Array,
        dof: number
    ): Promise<ConditionResult> => {
        if (!workerRef.current) {
            throw new Error('Solver worker not initialized');
        }

        const requestId = generateRequestId();

        const result = await new Promise<any>((resolve, reject) => {
            pendingRequests.current.set(requestId, { resolve, reject });

            workerRef.current!.postMessage({
                type: 'check_condition',
                requestId,
                stiffness: new Float64Array(stiffness),
                dof
            });

            setTimeout(() => {
                if (pendingRequests.current.has(requestId)) {
                    pendingRequests.current.delete(requestId);
                    reject(new Error('Condition check timeout'));
                }
            }, 30000);
        });

        return {
            isWellConditioned: result.data.is_well_conditioned,
            conditionNumber: result.data.condition_number,
            determinant: result.data.determinant,
            rank: result.data.rank,
            warning: result.data.warning
        };
    }, [generateRequestId]);

    /**
     * Decide whether to use WASM based on model size
     */
    const shouldUseWasm = useCallback((nodeCount: number): boolean => {
        // Use WASM for models with more than 500 nodes
        // (each node typically has 6 DOF, so 500 nodes = 3000 DOF)
        return isWasmReady && nodeCount > 500;
    }, [isWasmReady]);

    return {
        solve,
        computeEigenvalues,
        checkCondition,
        shouldUseWasm,
        isWasmReady,
        isLoading
    };
}

export default useWasmSolver;
