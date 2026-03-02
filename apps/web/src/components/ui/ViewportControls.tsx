/**
 * ViewportControls Component
 * Floating controls for 3D viewport navigation
 */

import React from 'react';
import { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ZoomIn, ZoomOut, Maximize2, RotateCcw, Grid3x3, Eye, EyeOff,
    Box, Layers, Move3d, Compass, Home, ChevronUp, ChevronDown,
    ChevronLeft, ChevronRight, Crosshair, ScanLine
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface ViewportControlsProps {
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onResetView?: () => void;
    onFitToView?: () => void;
    onToggleGrid?: () => void;
    onToggleAxes?: () => void;
    onToggleLabels?: () => void;
    onSetView?: (view: 'front' | 'top' | 'right' | 'iso') => void;
    gridEnabled?: boolean;
    axesEnabled?: boolean;
    labelsEnabled?: boolean;
    zoomLevel?: number;
    className?: string;
}

// ============================================
// Control Button Component
// ============================================

interface ControlButtonProps {
    onClick?: () => void;
    icon: React.ReactNode;
    label?: string;
    isActive?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md';
}

const ControlButton: FC<ControlButtonProps> = ({
    onClick,
    icon,
    label,
    isActive = false,
    disabled = false,
    size = 'md',
}) => (
    <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        disabled={disabled}
        title={label}
        className={`
            flex items-center justify-center rounded-lg transition-colors
            ${size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'}
            ${isActive
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
            }
            ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        `}
    >
        {icon}
    </motion.button>
);

// ============================================
// Zoom Controls
// ============================================

export const ZoomControls: FC<{
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    zoomLevel?: number;
}> = ({ onZoomIn, onZoomOut, zoomLevel = 100 }) => (
    <div className="flex flex-col items-center gap-1 p-1 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg">
        <ControlButton onClick={onZoomIn} icon={<ZoomIn className="w-4 h-4" />} label="Zoom In" />
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono py-1">
            {Math.round(zoomLevel)}%
        </div>
        <ControlButton onClick={onZoomOut} icon={<ZoomOut className="w-4 h-4" />} label="Zoom Out" />
    </div>
);

// ============================================
// View Cube / Orientation Controls
// ============================================

export const ViewCube: FC<{
    onSetView?: (view: 'front' | 'top' | 'right' | 'iso') => void;
    currentView?: string;
}> = ({ onSetView, currentView = 'iso' }) => (
    <div className="flex flex-col gap-1 p-2 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg">
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center mb-1">VIEW</div>
        <div className="grid grid-cols-3 gap-1">
            <div />
            <ControlButton
                onClick={() => onSetView?.('top')}
                icon={<ChevronUp className="w-4 h-4" />}
                label="Top"
                isActive={currentView === 'top'}
                size="sm"
            />
            <div />
            <ControlButton
                onClick={() => onSetView?.('right')}
                icon={<ChevronLeft className="w-4 h-4" />}
                label="Right"
                isActive={currentView === 'right'}
                size="sm"
            />
            <ControlButton
                onClick={() => onSetView?.('front')}
                icon={<Box className="w-4 h-4" />}
                label="Front"
                isActive={currentView === 'front'}
                size="sm"
            />
            <ControlButton
                onClick={() => onSetView?.('iso')}
                icon={<Move3d className="w-4 h-4" />}
                label="Isometric"
                isActive={currentView === 'iso'}
                size="sm"
            />
        </div>
    </div>
);

// ============================================
// Display Toggles
// ============================================

export const DisplayToggles: FC<{
    onToggleGrid?: () => void;
    onToggleAxes?: () => void;
    onToggleLabels?: () => void;
    gridEnabled?: boolean;
    axesEnabled?: boolean;
    labelsEnabled?: boolean;
}> = ({
    onToggleGrid,
    onToggleAxes,
    onToggleLabels,
    gridEnabled = true,
    axesEnabled = true,
    labelsEnabled = true,
}) => (
        <div className="flex flex-col gap-1 p-1 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg">
            <ControlButton
                onClick={onToggleGrid}
                icon={<Grid3x3 className="w-4 h-4" />}
                label="Toggle Grid"
                isActive={gridEnabled}
            />
            <ControlButton
                onClick={onToggleAxes}
                icon={<Compass className="w-4 h-4" />}
                label="Toggle Axes"
                isActive={axesEnabled}
            />
            <ControlButton
                onClick={onToggleLabels}
                icon={labelsEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                label="Toggle Labels"
                isActive={labelsEnabled}
            />
        </div>
    );

// ============================================
// Main Viewport Controls
// ============================================

export const ViewportControls: FC<ViewportControlsProps> = ({
    onZoomIn,
    onZoomOut,
    onResetView,
    onFitToView,
    onToggleGrid,
    onToggleAxes,
    onToggleLabels,
    onSetView,
    gridEnabled = true,
    axesEnabled = true,
    labelsEnabled = true,
    zoomLevel = 100,
    className = '',
}) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex flex-col gap-3 ${className}`}
        >
            {/* Zoom Controls */}
            <ZoomControls
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                zoomLevel={zoomLevel}
            />

            {/* Quick Actions */}
            <div className="flex flex-col gap-1 p-1 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg">
                <ControlButton
                    onClick={onResetView}
                    icon={<Home className="w-4 h-4" />}
                    label="Reset View"
                />
                <ControlButton
                    onClick={onFitToView}
                    icon={<Maximize2 className="w-4 h-4" />}
                    label="Fit to View"
                />
            </div>

            {/* Expandable Section */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col gap-3"
                    >
                        {/* View Cube */}
                        <ViewCube onSetView={onSetView} />

                        {/* Display Toggles */}
                        <DisplayToggles
                            onToggleGrid={onToggleGrid}
                            onToggleAxes={onToggleAxes}
                            onToggleLabels={onToggleLabels}
                            gridEnabled={gridEnabled}
                            axesEnabled={axesEnabled}
                            labelsEnabled={labelsEnabled}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Expand/Collapse */}
            <button type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs flex items-center justify-center gap-1 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-slate-700"
            >
                {isExpanded ? 'Less' : 'More'}
                <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                >
                    <ChevronDown className="w-3 h-3" />
                </motion.span>
            </button>
        </motion.div>
    );
};

// ============================================
// Coordinate Display
// ============================================

interface CoordinateDisplayProps {
    x: number;
    y: number;
    z?: number;
    label?: string;
    className?: string;
}

export const CoordinateDisplay: FC<CoordinateDisplayProps> = ({
    x,
    y,
    z,
    label,
    className = '',
}) => (
    <div className={`
        flex items-center gap-3 px-3 py-2 
        bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg
        font-mono text-xs
        ${className}
    `}>
        {label && <span className="text-slate-500 dark:text-slate-400">{label}</span>}
        <span className="text-red-400">X: {x.toFixed(2)}</span>
        <span className="text-green-400">Y: {y.toFixed(2)}</span>
        {z !== undefined && (
            <span className="text-blue-400">Z: {z.toFixed(2)}</span>
        )}
    </div>
);

// ============================================
// Crosshair / Center Indicator
// ============================================

export const ViewportCrosshair: FC<{ visible?: boolean }> = ({ visible = true }) => {
    if (!visible) return null;

    return (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <Crosshair className="w-6 h-6 text-slate-500" />
        </div>
    );
};

// ============================================
// Scale Bar
// ============================================

interface ScaleBarProps {
    scale: number; // meters per unit
    className?: string;
}

export const ScaleBar: FC<ScaleBarProps> = ({ scale, className = '' }) => {
    // Calculate nice scale bar length
    const getScaleInfo = (s: number) => {
        const lengths = [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100];
        const targetPixels = 100;
        const metersPerPixel = s;

        let bestLength = lengths[0];
        for (const len of lengths) {
            if (len / metersPerPixel <= targetPixels * 1.5) {
                bestLength = len;
            }
        }

        return {
            length: bestLength,
            pixels: bestLength / metersPerPixel,
            label: bestLength >= 1 ? `${bestLength}m` : `${bestLength * 100}cm`,
        };
    };

    const scaleInfo = getScaleInfo(scale);

    return (
        <div className={`flex flex-col items-start gap-1 ${className}`}>
            <div
                className="h-1 bg-white rounded-full"
                style={{ width: scaleInfo.pixels }}
            />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {scaleInfo.label}
            </span>
        </div>
    );
};

export default ViewportControls;
