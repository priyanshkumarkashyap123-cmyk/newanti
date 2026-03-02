/**
 * ViewCube - Interactive Navigation Cube
 * 
 * Fixed position overlay (not in 3D scene) for quick camera orientation.
 * Placed in top-right corner of the canvas container.
 */

import { FC, useCallback, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';

// ============================================
// TYPES
// ============================================

type CubeFace = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right';

interface ViewCubeProps {
    onViewChange?: (view: CubeFace) => void;
}

// ============================================
// VIEW VECTORS
// ============================================

const VIEW_POSITIONS: Record<CubeFace, [number, number, number]> = {
    front: [0, 0, 20],
    back: [0, 0, -20],
    top: [0, 20, 0.01],
    bottom: [0, -20, 0.01],
    left: [-20, 0, 0],
    right: [20, 0, 0]
};

// ============================================
// CUBE FACE COMPONENT
// ============================================

interface CubeFaceButtonProps {
    face: CubeFace;
    label: string;
    position: string;
    isHovered: boolean;
    onHover: (face: CubeFace | null) => void;
    onClick: (face: CubeFace) => void;
}

const CubeFaceButton: FC<CubeFaceButtonProps> = ({
    face,
    label,
    position,
    isHovered,
    onHover,
    onClick
}) => {
    return (
        <button type="button"
            className={`
                absolute ${position}
                w-12 h-12 flex items-center justify-center
                text-[9px] font-semibold uppercase tracking-wide
                transition-all duration-150
                ${isHovered
                    ? 'bg-blue-500 text-white scale-105'
                    : 'bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-600'
                }
                border border-slate-600
            `}
            onMouseEnter={() => onHover(face)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onClick(face)}
        >
            {label}
        </button>
    );
};

// ============================================
// VIEW CUBE (HTML OVERLAY VERSION)
// ============================================

export const ViewCubeOverlay: FC<ViewCubeProps> = ({ onViewChange }) => {
    const [hoveredFace, setHoveredFace] = useState<CubeFace | null>(null);

    const handleClick = useCallback((face: CubeFace) => {
        onViewChange?.(face);
    }, [onViewChange]);

    return (
        <div className="absolute top-4 right-4 z-10 pointer-events-auto">
            {/* Cube Container */}
            <div className="relative w-16 h-16">
                {/* 2D representation of cube faces */}
                <div className="
                    w-16 h-16 relative
                    bg-slate-100/90 dark:bg-slate-800/90 rounded-lg
                    border border-slate-200 dark:border-slate-700
                    backdrop-blur-sm
                    shadow-lg
                    overflow-hidden
                ">
                    {/* Center - TOP face */}
                    <button type="button"
                        className={`
                            absolute inset-2
                            flex items-center justify-center
                            text-[10px] font-bold uppercase
                            rounded
                            transition-colors
                            ${hoveredFace === 'top'
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-600'
                            }
                        `}
                        onMouseEnter={() => setHoveredFace('top')}
                        onMouseLeave={() => setHoveredFace(null)}
                        onClick={() => handleClick('top')}
                    >
                        Top
                    </button>
                </div>

                {/* Edge buttons */}
                <button type="button"
                    className={`
                        absolute -top-2 left-1/2 -translate-x-1/2
                        w-8 h-4 flex items-center justify-center
                        text-[8px] font-medium uppercase
                        rounded-t
                        transition-colors
                        ${hoveredFace === 'back'
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-500'
                        }
                    `}
                    onMouseEnter={() => setHoveredFace('back')}
                    onMouseLeave={() => setHoveredFace(null)}
                    onClick={() => handleClick('back')}
                >
                    B
                </button>

                <button type="button"
                    className={`
                        absolute -bottom-2 left-1/2 -translate-x-1/2
                        w-8 h-4 flex items-center justify-center
                        text-[8px] font-medium uppercase
                        rounded-b
                        transition-colors
                        ${hoveredFace === 'front'
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-500'
                        }
                    `}
                    onMouseEnter={() => setHoveredFace('front')}
                    onMouseLeave={() => setHoveredFace(null)}
                    onClick={() => handleClick('front')}
                >
                    F
                </button>

                <button type="button"
                    className={`
                        absolute -left-2 top-1/2 -translate-y-1/2
                        w-4 h-8 flex items-center justify-center
                        text-[8px] font-medium uppercase
                        rounded-l
                        transition-colors
                        ${hoveredFace === 'left'
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-500'
                        }
                    `}
                    onMouseEnter={() => setHoveredFace('left')}
                    onMouseLeave={() => setHoveredFace(null)}
                    onClick={() => handleClick('left')}
                >
                    L
                </button>

                <button type="button"
                    className={`
                        absolute -right-2 top-1/2 -translate-y-1/2
                        w-4 h-8 flex items-center justify-center
                        text-[8px] font-medium uppercase
                        rounded-r
                        transition-colors
                        ${hoveredFace === 'right'
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-500'
                        }
                    `}
                    onMouseEnter={() => setHoveredFace('right')}
                    onMouseLeave={() => setHoveredFace(null)}
                    onClick={() => handleClick('right')}
                >
                    R
                </button>
            </div>

            {/* Axis indicator */}
            <div className="flex items-center justify-center gap-2 mt-2 text-[9px]">
                <span className="text-red-400">X</span>
                <span className="text-green-400">Y</span>
                <span className="text-blue-400">Z</span>
            </div>
        </div>
    );
};

// ============================================
// VIEW CUBE HOOK (for camera control)
// ============================================

export function useViewCubeCamera() {
    const { camera, controls } = useThree();

    const setView = useCallback((face: CubeFace) => {
        const [x, y, z] = VIEW_POSITIONS[face];

        // Animate camera position
        camera.position.set(x, y, z);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        // Update orbit controls target if available
        if (controls && 'target' in controls) {
            (controls as any).target.set(0, 0, 0);
            (controls as any).update();
        }
    }, [camera, controls]);

    return { setView };
}

export default ViewCubeOverlay;
