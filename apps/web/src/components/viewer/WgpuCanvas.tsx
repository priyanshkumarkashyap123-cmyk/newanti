/**
 * WgpuCanvas.tsx - High-performance WebGPU Renderer
 * 
 * Integrates with the Rust-based wgpu renderer for 60 FPS performance
 * on complex structural models.
 */

import { FC, useEffect, useRef, useState } from 'react';
import init, { Renderer } from 'backend-rust';

interface WgpuCanvasProps {
    className?: string;
}

export const WgpuCanvas: FC<WgpuCanvasProps> = ({ className }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<Renderer | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let animationFrameId: number;

        const initWgpu = async () => {
            if (!canvasRef.current) return;

            try {
                // Initialize WASM
                await init();

                // Initialize Renderer
                const renderer = await Renderer.new(canvasRef.current);
                rendererRef.current = renderer;
                setIsReady(true);

                console.log('[WgpuCanvas] WebGPU Renderer initialized');

                // Render loop
                const render = () => {
                    if (rendererRef.current) {
                        try {
                            rendererRef.current.render();
                        } catch (e) {
                            console.error('[WgpuCanvas] Render error:', e);
                        }
                    }
                    animationFrameId = requestAnimationFrame(render);
                };

                render();
            } catch (err: any) {
                console.error('[WgpuCanvas] Initialization failed:', err);
                setError(err.message || 'Failed to initialize WebGPU');
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
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
            // Renderer cleanup if necessary (Rust might need a custom drop or free function)
        };
    }, []);

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
                <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 backdrop-blur-md">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 max-w-md">
                        <h4 className="font-bold mb-1">WebGPU Error</h4>
                        <p className="text-sm">{error}</p>
                        <p className="text-xs mt-2 opacity-70">
                            Please ensure your browser supports WebGPU and it is enabled in flags.
                        </p>
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
