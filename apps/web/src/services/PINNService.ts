/**
 * PINNService - Physics-Informed Neural Network Service
 * 
 * Client-side beam deflection analysis using WASM PINN solver.
 * No server round-trip needed.
 */

// Types
export interface BeamConfig {
    length: number;      // Beam length (m)
    e: number;           // Young's modulus (Pa)
    i: number;           // Second moment of area (m^4)
    load: number;        // Uniform load magnitude (N/m)
    boundary: 'simply_supported' | 'cantilever' | 'fixed_fixed';
}

export interface TrainingConfig {
    epochs?: number;
    learning_rate?: number;
    hidden_dims?: number[];
    num_collocation?: number;
}

export interface PINNResult {
    success: boolean;
    training?: {
        final_loss: number;
        epochs_trained: number;
        training_time_ms: number;
    };
    prediction?: {
        x: number[];
        deflection: number[];
        max_deflection: number;
        max_position: number;
    };
    error?: string;
}

export interface PINNDemoResult {
    success: boolean;
    pinn_max_deflection: number;
    analytical_max_deflection: number;
    relative_error_percent: number;
    training_time_ms: number;
    final_loss: number;
}

// WASM module reference
let wasmModule: any = null;
let wasmReady = false;

/**
 * Load WASM module
 */
async function loadWasm(): Promise<boolean> {
    if (wasmReady) return true;

    try {
        const response = await fetch('/solver_wasm_bg.wasm');
        if (!response.ok) {
            throw new Error(`Failed to fetch WASM: ${response.status}`);
        }
        const wasmBytes = await response.arrayBuffer();

        // Dynamic import
        wasmModule = await import('../libs/solver_wasm');
        await wasmModule.default(wasmBytes);

        wasmReady = true;
        console.log('[PINNService] WASM loaded successfully');
        return true;
    } catch (error) {
        console.error('[PINNService] Failed to load WASM:', error);
        return false;
    }
}

/**
 * Run PINN demo with default parameters
 * @returns Demo result comparing PINN vs analytical solution
 */
export async function runPINNDemo(): Promise<PINNDemoResult | null> {
    const ready = await loadWasm();
    if (!ready || !wasmModule) {
        console.error('[PINNService] WASM not available');
        return null;
    }

    try {
        const resultJson = wasmModule.pinn_demo();
        return JSON.parse(resultJson) as PINNDemoResult;
    } catch (error) {
        console.error('[PINNService] Demo failed:', error);
        return null;
    }
}

/**
 * Train PINN for custom beam configuration
 * @param beamConfig Beam geometry and loading
 * @param trainingConfig Training hyperparameters
 */
export async function trainBeamPINN(
    beamConfig: BeamConfig,
    trainingConfig?: TrainingConfig
): Promise<PINNResult | null> {
    const ready = await loadWasm();
    if (!ready || !wasmModule) {
        console.error('[PINNService] WASM not available');
        return null;
    }

    const config = {
        beam: {
            length: beamConfig.length,
            e: beamConfig.e,
            i: beamConfig.i,
            load: beamConfig.load,
            boundary: beamConfig.boundary,
        },
        training: {
            epochs: trainingConfig?.epochs ?? 2000,
            learning_rate: trainingConfig?.learning_rate ?? 0.01,
            lr_decay: 0.999,
            hidden_dims: trainingConfig?.hidden_dims ?? [32, 32],
            num_collocation: trainingConfig?.num_collocation ?? 50,
            lambda_pde: 1.0,
            lambda_bc: 100.0,
        }
    };

    try {
        const resultJson = wasmModule.train_beam_pinn(JSON.stringify(config));
        return JSON.parse(resultJson) as PINNResult;
    } catch (error) {
        console.error('[PINNService] Training failed:', error);
        return null;
    }
}

/**
 * Analyze simply supported beam with UDL using PINN
 * Convenience function for common use case
 */
export async function analyzeSimplySupported(
    length: number,
    load: number,
    E: number = 200e9,
    I: number = 1e-4
): Promise<PINNResult | null> {
    return trainBeamPINN({
        length,
        e: E,
        i: I,
        load,
        boundary: 'simply_supported'
    });
}

/**
 * Calculate analytical solution for simply supported beam with UDL
 * For comparison/validation
 */
export function analyticalSimplySupported(
    length: number,
    load: number,
    E: number,
    I: number,
    numPoints: number = 100
): { x: number[]; deflection: number[]; maxDeflection: number } {
    const EI = E * I;
    const q = Math.abs(load);
    const L = length;

    const x: number[] = [];
    const deflection: number[] = [];

    for (let i = 0; i <= numPoints; i++) {
        const xi = (L * i) / numPoints;
        // w(x) = (q*x)/(24*EI) * (L³ - 2*L*x² + x³)
        const w = (q * xi) / (24 * EI) * (L ** 3 - 2 * L * xi ** 2 + xi ** 3);
        x.push(xi);
        deflection.push(load < 0 ? -w : w);
    }

    // Max at midspan: 5qL⁴/(384EI)
    const maxDeflection = (5 * q * L ** 4) / (384 * EI);

    return { x, deflection, maxDeflection: load < 0 ? -maxDeflection : maxDeflection };
}

// Export service object for convenience
export const PINNService = {
    loadWasm,
    runDemo: runPINNDemo,
    train: trainBeamPINN,
    analyzeSimplySupported,
    analyticalSolution: analyticalSimplySupported,
};

export default PINNService;
