/**
 * WgpuCanvas.tsx - High-performance WebGPU Renderer
 * 
 * Integrates with the Rust-based wgpu renderer for 60 FPS performance
 * on complex structural models.
 * 
 * Falls back to WebGL automatically if WebGPU is not supported.
 */

import { FC, useEffect, useRef, useState } from 'react';
import init, { Renderer } from 'backend-rust';
import { useUIStore } from '../../store/uiStore';

interface WgpuCanvasProps {
    className?: string;
}

export const WgpuCanvas: FC<WgpuCanvasProps> = ({ className }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<Renderer | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const setUseWebGpu = useUIStore(state => state.setUseWebGpu);

    useEffect(() => {
        let animationFrameId: number;
        let isMounted = true;

        const initWgpu = async () => {
            if (!canvasRef.current) return;

            try {
                // Check if WebGPU is available before initializing
                if (!(navigator as any).gpu) {
                    throw new Error('WebGPU is not supported in this browser.');
                }

                // Test if we can get an adapter
                const testAdapter = await (navigator as any).gpu.requestAdapter();
                if (!testAdapter) {
                    throw new Error('No WebGPU adapter found. Your GPU may not support WebGPU.');
                }

                console.log('[WgpuCanvas] WebGPU available, initializing WASM...');

                // Initialize WASM
                await init();

                console.log('[WgpuCanvas] Creating WebGPU renderer...');

                // Initialize Renderer
                const renderer = await Renderer.new(canvasRef.current);

                if (!isMounted) return;

                rendererRef.current = renderer;
                setIsReady(true);
                setUseWebGpu(true);

                console.log('[WgpuCanvas] ✓ WebGPU Renderer initialized successfully');

                // Render loop
                const render = () => {
                    if (rendererRef.current && isMounted) {
                        try {
                            rendererRef.current.render();
                        } catch (e) {
                            console.error('[WgpuCanvas] Render error:', e);
                        }
                    }
                    if (isMounted) {
                        animationFrameId = requestAnimationFrame(render);
                    }
                };

                render();
            } catch (err: any) {
                const errorMessage = err.message || err.toString() || 'Unknown error';
                console.warn('[WgpuCanvas] WebGPU initialization failed:', errorMessage);
                console.warn('[WgpuCanvas] Falling back to WebGL renderer...');

                if (isMounted) {
                    setError(errorMessage);
                    setUseWebGpu(false);

                    // Automatically clear error and switch to WebGL after showing message
                    setTimeout(() => {
                        if (isMounted) {
                            console.log('[WgpuCanvas] ✓ Switched to WebGL renderer');
                            // Error will be hidden by parent switching to WebGL renderer
                        }
                    }, 2000);
                }
            }
        };

        initWgpu();

        // Handle resize
        const handleResize = () => {
            if (canvasRef.current && rendererRef.current) {
                const width = canvasRef.current.clientWidth;
                const height = canvasRef.current.clientHeight;
                canvasRef.current.width = width;
                canvasRef.current.height = height;
                rendererRef.current.resize(width, height);
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial resize

        return () => {
            isMounted = false;
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
            // Renderer cleanup if necessary (Rust might need a custom drop or free function)
        };
    }, [setUseWebGpu]);

    return (
        <div className={`relative w-full h-full overflow-hidden ${className}`}>
            <canvas
                ref={canvasRef}
                className="w-full h-full block"
                style={{ background: '#0a0a0f' }}
            />

            {!isReady && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-emerald-400 font-medium">Initializing WebGPU...</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/95 backdrop-blur-md">
                    <div className="p-6 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 max-w-lg">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-lg mb-2">WebGPU Not Available</h4>
                                <p className="text-sm text-slate-300 mb-3">{error}</p>
                                <div className="text-xs text-slate-400 space-y-1">
                                    <p>✓ Automatically switching to WebGL renderer...</p>
                                    <p className="opacity-60">Your browser may not support WebGPU or it may be disabled.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isReady && (
                <div className="absolute top-4 right-4 px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-[10px] text-emerald-400 font-mono uppercase tracking-wider pointer-events-none">
                    WebGPU Accelerated
                </div>
            )}
        </div>
    );
};

export default WgpuCanvas;
