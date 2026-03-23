/**
 * MiniMap Component
 * Mini navigation map for large viewports
 */

import React from 'react';
import { FC, useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Minimize2, Target } from 'lucide-react';

// ============================================
// Types
// ============================================

interface MiniMapProps {
    viewportBounds: { x: number; y: number; width: number; height: number };
    contentBounds: { x: number; y: number; width: number; height: number };
    onNavigate?: (x: number, y: number) => void;
    nodes?: Array<{ id: string; x: number; y: number; color?: string }>;
    className?: string;
}

// ============================================
// MiniMap Component
// ============================================

export const MiniMap: FC<MiniMapProps> = ({
    viewportBounds,
    contentBounds,
    onNavigate,
    nodes = [],
    className = '',
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate scale to fit content in minimap
    const mapSize = 150;
    const scale = Math.min(
        mapSize / (contentBounds.width || 1),
        mapSize / (contentBounds.height || 1)
    ) * 0.9;

    // Calculate viewport rectangle in minimap coordinates
    const viewRect = {
        x: (viewportBounds.x - contentBounds.x) * scale + mapSize / 2 - (contentBounds.width * scale) / 2,
        y: (viewportBounds.y - contentBounds.y) * scale + mapSize / 2 - (contentBounds.height * scale) / 2,
        width: viewportBounds.width * scale,
        height: viewportBounds.height * scale,
    };

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (!containerRef.current || !onNavigate) return;

        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Convert minimap coordinates back to content coordinates
        const contentX = (clickX - mapSize / 2 + (contentBounds.width * scale) / 2) / scale + contentBounds.x;
        const contentY = (clickY - mapSize / 2 + (contentBounds.height * scale) / 2) / scale + contentBounds.y;

        onNavigate(contentX, contentY);
    }, [contentBounds, scale, onNavigate]);

    const handleMouseDown = () => setIsDragging(true);
    const handleMouseUp = () => setIsDragging(false);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mouseup', handleMouseUp);
            return () => window.removeEventListener('mouseup', handleMouseUp);
        }
        return undefined;
    }, [isDragging]);

    if (!isExpanded) {
        return (
            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setIsExpanded(true)}
                className={`
                    w-10 h-10 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg border border-[#1a2333] 
                    flex items-center justify-center text-[#869ab8] hover:text-slate-900 dark:hover:text-white transition-colors
                    ${className}
                `}
            >
                <Maximize2 className="w-4 h-4" />
            </motion.button>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`
                bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-[#1a2333] shadow-lg overflow-hidden
                ${className}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a2333]">
                <span className="text-xs font-medium tracking-wide text-[#869ab8]">MINIMAP</span>
                <button type="button"
                    onClick={() => setIsExpanded(false)}
                    className="text-[#869ab8] hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                    <Minimize2 className="w-3 h-3" />
                </button>
            </div>

            {/* Map Area */}
            <div
                ref={containerRef}
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                onMouseMove={(e) => isDragging && handleClick(e)}
                className="relative cursor-crosshair"
                style={{ width: mapSize, height: mapSize }}
            >
                {/* Background Grid */}
                <div
                    className="absolute inset-0 opacity-20"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
                        `,
                        backgroundSize: `${mapSize / 10}px ${mapSize / 10}px`,
                    }}
                />

                {/* Content Bounds */}
                <div
                    className="absolute border border-slate-600 rounded"
                    style={{
                        left: mapSize / 2 - (contentBounds.width * scale) / 2,
                        top: mapSize / 2 - (contentBounds.height * scale) / 2,
                        width: contentBounds.width * scale,
                        height: contentBounds.height * scale,
                    }}
                />

                {/* Nodes */}
                {nodes.map((node) => {
                    const x = (node.x - contentBounds.x) * scale + mapSize / 2 - (contentBounds.width * scale) / 2;
                    const y = (node.y - contentBounds.y) * scale + mapSize / 2 - (contentBounds.height * scale) / 2;

                    return (
                        <div
                            key={node.id}
                            className="absolute w-2 h-2 rounded-full"
                            style={{
                                left: x - 4,
                                top: y - 4,
                                backgroundColor: node.color || '#3b82f6',
                            }}
                        />
                    );
                })}

                {/* Viewport Rectangle */}
                <motion.div
                    className="absolute border-2 border-blue-500 bg-blue-500/10 rounded"
                    style={{
                        left: viewRect.x,
                        top: viewRect.y,
                        width: Math.max(viewRect.width, 10),
                        height: Math.max(viewRect.height, 10),
                    }}
                    animate={{
                        left: viewRect.x,
                        top: viewRect.y,
                        width: Math.max(viewRect.width, 10),
                        height: Math.max(viewRect.height, 10),
                    }}
                    transition={{ duration: 0.1 }}
                />

                {/* Center indicator */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                    <Target className="w-4 h-4 text-slate-500" />
                </div>
            </div>

            {/* Footer - Zoom info */}
            <div className="px-3 py-1.5 border-t border-[#1a2333] text-xs text-[#869ab8] text-center font-mono">
                Click to navigate
            </div>
        </motion.div>
    );
};

// ============================================
// Viewport Status Bar
// ============================================

interface ViewportStatusBarProps {
    selectedCount?: number;
    nodeCount?: number;
    memberCount?: number;
    fps?: number;
    mode?: string;
    className?: string;
}

export const ViewportStatusBar: FC<ViewportStatusBarProps> = ({
    selectedCount = 0,
    nodeCount = 0,
    memberCount = 0,
    fps,
    mode = 'Select',
    className = '',
}) => (
    <div className={`
        flex items-center gap-4 px-4 py-2
        bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm border-t border-[#1a2333]
        text-xs text-[#869ab8] font-mono
        ${className}
    `}>
        {/* Mode */}
        <div className="flex items-center gap-2">
            <span className="text-[#869ab8]">Mode:</span>
            <span className="text-[#dae2fd] font-medium tracking-wide">{mode}</span>
        </div>

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

        {/* Selection */}
        <div className="flex items-center gap-2">
            <span className="text-[#869ab8]">Selected:</span>
            <span className={selectedCount > 0 ? 'text-blue-400' : 'text-[#869ab8]'}>
                {selectedCount}
            </span>
        </div>

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

        {/* Model Stats */}
        <div className="flex items-center gap-4">
            <span>
                <span className="text-[#869ab8]">Nodes: </span>
                <span className="text-green-400">{nodeCount}</span>
            </span>
            <span>
                <span className="text-[#869ab8]">Members: </span>
                <span className="text-purple-400">{memberCount}</span>
            </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* FPS */}
        {fps !== undefined && (
            <div className={`${fps < 30 ? 'text-red-400' : fps < 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                {fps} FPS
            </div>
        )}
    </div>
);

// ============================================
// Floating Toolbar
// ============================================

interface ToolbarItem {
    id: string;
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
    isActive?: boolean;
    onClick: () => void;
}

interface FloatingToolbarProps {
    items: ToolbarItem[];
    orientation?: 'horizontal' | 'vertical';
    className?: string;
}

export const FloatingToolbar: FC<FloatingToolbarProps> = ({
    items,
    orientation = 'horizontal',
    className = '',
}) => (
    <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
            flex gap-1 p-1.5 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-[#1a2333] shadow-lg
            ${orientation === 'vertical' ? 'flex-col' : 'flex-row'}
            ${className}
        `}
    >
        {items.map((item) => (
            <motion.button
                key={item.id}
                onClick={item.onClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={`${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}`}
                className={`
                    w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                    ${item.isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                    }
                `}
            >
                {item.icon}
            </motion.button>
        ))}
    </motion.div>
);

export default MiniMap;
