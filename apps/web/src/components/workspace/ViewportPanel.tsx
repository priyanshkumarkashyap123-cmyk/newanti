/**
 * ViewportPanel - 3D Viewport with grid background and overlays
 * Container for Three.js scene with engineering UI overlays
 */

import { FC, ReactNode } from 'react';

export interface ViewportPanelProps {
    children: ReactNode; // Three.js canvas or other 3D content
    coordinates?: { x: number; y: number; z: number };
    showGrid?: boolean;
    showAxes?: boolean;
    overlayInfo?: {
        label: string;
        value: string | number;
    }[];
}

export const ViewportPanel: FC<ViewportPanelProps> = ({
    children,
    coordinates = { x: 0, y: 0, z: 0 },
    showGrid = true,
    showAxes = true,
    overlayInfo,
}) => {
    return (
        <div className="relative h-full w-full bg-zinc-900 overflow-hidden group">
            {/* Grid Background Pattern */}
            {showGrid && (
                <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, #324867 1px, transparent 1px),
                            linear-gradient(to bottom, #324867 1px, transparent 1px)
                        `,
                        backgroundSize: '40px 40px',
                    }}
                />
            )}

            {/* Coordinates Overlay (Top Left) */}
            <div className="absolute top-4 left-4 bg-zinc-800/80 backdrop-blur-sm border border-zinc-700 px-3 py-1 rounded text-xs font-mono text-zinc-300 pointer-events-none z-10">
                X: {coordinates.x.toFixed(2)} Y: {coordinates.y.toFixed(2)} Z: {coordinates.z.toFixed(2)}
            </div>

            {/* View Controls (Top Right) */}
            <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 rounded p-1.5 shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">square</span>
                </button>
                <button className="bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 rounded p-1.5 shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">videocam</span>
                </button>
            </div>

            {/* Main 3D Content */}
            <div className="absolute inset-0">
                {children}
            </div>

            {/* Overlay Info Cards (Floating) */}
            {overlayInfo && overlayInfo.length > 0 && (
                <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
                    {overlayInfo.map((info, idx) => (
                        <div
                            key={idx}
                            className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 px-3 py-2 rounded shadow-sm"
                        >
                            <div className="text-xs text-zinc-400">{info.label}</div>
                            <div className="text-sm font-mono text-white font-bold">{info.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* 3D Axes Indicator (Bottom Left) */}
            {showAxes && (
                <div className="absolute bottom-4 left-4 w-20 h-20 opacity-80 pointer-events-none z-10">
                    <div className="relative w-full h-full">
                        {/* Y axis (green, vertical) */}
                        <div className="absolute bottom-0 left-0 w-px h-16 bg-green-500 origin-bottom"></div>
                        {/* X axis (red, horizontal) */}
                        <div className="absolute bottom-0 left-0 w-16 h-px bg-red-500 origin-left"></div>
                        {/* Z axis (blue, diagonal) */}
                        <div
                            className="absolute bottom-0 left-0 w-12 h-px bg-blue-500 origin-left"
                            style={{ transform: 'rotate(-45deg) translateX(0px)' }}
                        ></div>
                        <span className="absolute top-0 left-2 text-[10px] text-green-500 font-bold">Y</span>
                        <span className="absolute bottom-1 right-2 text-[10px] text-red-500 font-bold">X</span>
                        <span className="absolute bottom-8 left-9 text-[10px] text-blue-500 font-bold">Z</span>
                    </div>
                </div>
            )}

            {/* Placeholder when no 3D content */}
            {!children && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                    <div className="flex flex-col items-center gap-4">
                        <span className="material-symbols-outlined text-[64px] text-zinc-500">deployed_code</span>
                        <h2 className="text-xl font-bold tracking-tight text-zinc-400">3D Viewport</h2>
                        <p className="text-sm text-zinc-500">Model Space ready for input</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewportPanel;
