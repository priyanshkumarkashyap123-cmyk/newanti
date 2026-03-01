/**
 * Canvas Status Bar - Bottom status overlay
 * 
 * Shows cursor coordinates, zoom level, and selection info.
 */

import { FC } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';

// ============================================
// TYPES
// ============================================

export interface StatusBarProps {
    cursorPosition?: { x: number; y: number; z: number } | null;
    selectedCount?: number;
    selectionType?: 'node' | 'member' | 'load' | null;
    gridSnap?: boolean;
}

// ============================================
// STATUS BAR COMPONENT
// ============================================

export const CanvasStatusBar: FC<StatusBarProps> = ({
    cursorPosition,
    selectedCount = 0,
    selectionType,
    gridSnap = true
}) => {
    return (
        <div className="
            absolute bottom-0 left-0 right-0 h-6
            bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm
            border-t border-slate-200 dark:border-slate-800
            flex items-center justify-between
            px-3 text-[11px] text-slate-500 dark:text-slate-400
            z-40 pointer-events-none
        ">
            {/* Left: Cursor Position */}
            <div className="flex items-center gap-4">
                {cursorPosition ? (
                    <div className="flex items-center gap-3 font-mono">
                        <span>
                            X: <span className="text-red-400">{cursorPosition.x.toFixed(3)}</span>
                        </span>
                        <span>
                            Y: <span className="text-green-400">{cursorPosition.y.toFixed(3)}</span>
                        </span>
                        <span>
                            Z: <span className="text-blue-400">{cursorPosition.z.toFixed(3)}</span>
                        </span>
                    </div>
                ) : (
                    <span className="text-slate-500 dark:text-slate-400">Move cursor to see coordinates</span>
                )}
            </div>

            {/* Center: Selection Info */}
            <div className="flex items-center gap-4">
                {selectedCount > 0 && (
                    <span className="text-blue-400">
                        {selectedCount} {selectionType || 'item'}{selectedCount > 1 ? 's' : ''} selected
                    </span>
                )}
            </div>

            {/* Right: Settings */}
            <div className="flex items-center gap-4">
                <span className={gridSnap ? 'text-green-400' : 'text-slate-500'}>
                    Snap: {gridSnap ? 'ON' : 'OFF'}
                </span>
                <span>Units: m</span>
            </div>
        </div>
    );
};

// ============================================
// ZOOM INDICATOR
// ============================================

export const ZoomIndicator: FC = () => {
    const { camera } = useThree();

    // Calculate approximate zoom level
    const distance = camera.position.length();
    const zoomPercent = Math.round(100 / (distance / 20));

    return (
        <div className="
            absolute bottom-8 right-4 z-40
            bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm
            px-2 py-1 rounded
            text-[10px] text-slate-500 dark:text-slate-400 font-mono
            pointer-events-none
        ">
            {zoomPercent}%
        </div>
    );
};

export default CanvasStatusBar;
