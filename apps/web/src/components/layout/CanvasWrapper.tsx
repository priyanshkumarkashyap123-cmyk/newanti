/**
 * CanvasWrapper - R3F Canvas Mount Point
 * 
 * Container for the 3D canvas with dark engineering background.
 */

import { FC, ReactNode } from 'react';

interface CanvasWrapperProps {
    children: ReactNode;
}

export const CanvasWrapper: FC<CanvasWrapperProps> = ({ children }) => {
    return (
        <div className="relative h-full w-full bg-white dark:bg-slate-950">
            {/* Canvas Content */}
            {children}

            {/* Optional: Corner Info */}
            <div className="absolute bottom-2 left-2 text-xs text-slate-500 font-mono select-none pointer-events-none">
                3D View
            </div>
        </div>
    );
};

export default CanvasWrapper;
