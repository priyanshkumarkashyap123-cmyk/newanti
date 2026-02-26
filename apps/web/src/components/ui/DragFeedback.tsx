/**
 * DragFeedback & Selection Components
 * Visual feedback for drag operations and selections
 */

import React from 'react';
import { FC, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Move, Plus, Trash2 } from 'lucide-react';

// ============================================
// Drag Handle Component
// ============================================

interface DragHandleProps {
    className?: string;
}

export const DragHandle: FC<DragHandleProps> = ({ className = '' }) => (
    <div
        className={`
            flex items-center justify-center w-6 h-6 rounded
            text-slate-400 hover:text-slate-300 hover:bg-slate-700
            cursor-grab active:cursor-grabbing transition-colors
            ${className}
        `}
    >
        <GripVertical className="w-4 h-4" />
    </div>
);

// ============================================
// Drag Ghost Preview
// ============================================

interface DragGhostProps {
    children: ReactNode;
    count?: number;
    isVisible: boolean;
    position: { x: number; y: number };
}

export const DragGhost: FC<DragGhostProps> = ({
    children,
    count = 1,
    isVisible,
    position,
}) => (
    <AnimatePresence>
        {isVisible && (
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.9, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="fixed z-[300] pointer-events-none"
                style={{
                    left: position.x + 20,
                    top: position.y + 20,
                }}
            >
                <div className="relative">
                    <div className="bg-slate-800 border-2 border-blue-500 rounded-lg shadow-2xl shadow-blue-500/20 p-3">
                        {children}
                    </div>
                    {count > 1 && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {count}
                        </div>
                    )}
                </div>
            </motion.div>
        )}
    </AnimatePresence>
);

// ============================================
// Drop Zone Component
// ============================================

interface DropZoneProps {
    children: ReactNode;
    onDrop: (data: any) => void;
    accept?: string[];
    className?: string;
}

export const DropZone: FC<DropZoneProps> = ({
    children,
    onDrop,
    accept = [],
    className = '',
}) => {
    const [isOver, setIsOver] = useState(false);
    const [canDrop, setCanDrop] = useState(true);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        const types = Array.from(e.dataTransfer.types);
        const canAccept = accept.length === 0 || accept.some(t => types.includes(t));
        setCanDrop(canAccept);
        setIsOver(true);
    };

    const handleDragLeave = () => {
        setIsOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsOver(false);

        if (!canDrop) return;

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            onDrop(data);
        } catch {
            // Handle plain text or other data types
            const text = e.dataTransfer.getData('text/plain');
            onDrop({ type: 'text', data: text });
        }
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
                relative transition-all duration-200
                ${isOver && canDrop ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}
                ${isOver && !canDrop ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-slate-900' : ''}
                ${className}
            `}
        >
            {children}

            {/* Drop Overlay */}
            <AnimatePresence>
                {isOver && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`
                            absolute inset-0 rounded-lg flex items-center justify-center
                            ${canDrop ? 'bg-blue-500/10' : 'bg-red-500/10'}
                        `}
                    >
                        <div className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg
                            ${canDrop ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'}
                        `}>
                            {canDrop ? (
                                <>
                                    <Plus className="w-4 h-4" />
                                    Drop here
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    Cannot drop here
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ============================================
// Selection Box (Marquee Select)
// ============================================

interface SelectionBoxProps {
    onSelect: (bounds: { x: number; y: number; width: number; height: number }) => void;
    containerRef: React.RefObject<HTMLElement>;
    disabled?: boolean;
}

export const SelectionBox: FC<SelectionBoxProps> = ({
    onSelect,
    containerRef,
    disabled = false,
}) => {
    const [isSelecting, setIsSelecting] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (disabled) return;
        if (!containerRef.current?.contains(e.target as Node)) return;
        if ((e.target as HTMLElement).closest('button, input, [data-no-select]')) return;

        const rect = containerRef.current.getBoundingClientRect();
        setStartPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
        setCurrentPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
        setIsSelecting(true);
    }, [containerRef, disabled]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isSelecting || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        setCurrentPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    }, [isSelecting, containerRef]);

    const handleMouseUp = useCallback(() => {
        if (!isSelecting) return;

        const bounds = {
            x: Math.min(startPos.x, currentPos.x),
            y: Math.min(startPos.y, currentPos.y),
            width: Math.abs(currentPos.x - startPos.x),
            height: Math.abs(currentPos.y - startPos.y),
        };

        if (bounds.width > 5 && bounds.height > 5) {
            onSelect(bounds);
        }

        setIsSelecting(false);
    }, [isSelecting, startPos, currentPos, onSelect]);

    useEffect(() => {
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseDown, handleMouseMove, handleMouseUp]);

    if (!isSelecting) return null;

    const boxStyle = {
        left: Math.min(startPos.x, currentPos.x),
        top: Math.min(startPos.y, currentPos.y),
        width: Math.abs(currentPos.x - startPos.x),
        height: Math.abs(currentPos.y - startPos.y),
    };

    return (
        <div
            className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/10 rounded"
            style={boxStyle}
        />
    );
};

// ============================================
// Selection Highlight
// ============================================

interface SelectionHighlightProps {
    isSelected: boolean;
    isHovered?: boolean;
    children: ReactNode;
    className?: string;
}

export const SelectionHighlight: FC<SelectionHighlightProps> = ({
    isSelected,
    isHovered = false,
    children,
    className = '',
}) => (
    <div
        className={`
            relative transition-all duration-150
            ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-900' : ''}
            ${isHovered && !isSelected ? 'ring-2 ring-slate-500 ring-offset-1 ring-offset-slate-900' : ''}
            ${className}
        `}
    >
        {children}

        {/* Selection Indicator */}
        {isSelected && (
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
            >
                <div className="w-2 h-2 bg-white rounded-full" />
            </motion.div>
        )}
    </div>
);

// ============================================
// Cursor Indicator
// ============================================

type CursorMode = 'default' | 'move' | 'add' | 'delete' | 'crosshair';

interface CursorIndicatorProps {
    mode: CursorMode;
    label?: string;
}

export const CursorIndicator: FC<CursorIndicatorProps> = ({ mode, label }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setPosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    if (mode === 'default') return null;

    const icons = {
        move: <Move className="w-4 h-4" />,
        add: <Plus className="w-4 h-4" />,
        delete: <Trash2 className="w-4 h-4" />,
        crosshair: <div className="w-3 h-3 border-2 border-white rounded-full" />,
    };

    const colors = {
        move: 'bg-blue-500',
        add: 'bg-green-500',
        delete: 'bg-red-500',
        crosshair: 'bg-slate-700',
    };

    return (
        <motion.div
            className="fixed z-[400] pointer-events-none"
            style={{ left: position.x + 16, top: position.y + 16 }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
        >
            <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${colors[mode]} text-white text-xs font-medium shadow-lg`}>
                {icons[mode]}
                {label && <span>{label}</span>}
            </div>
        </motion.div>
    );
};

export default {
    DragHandle,
    DragGhost,
    DropZone,
    SelectionBox,
    SelectionHighlight,
    CursorIndicator,
};
