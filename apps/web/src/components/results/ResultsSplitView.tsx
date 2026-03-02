/**
 * ResultsSplitView.tsx - Professional STAAD-like Split View for Results
 * 
 * Provides a dockable split view layout:
 * - Left: Results Table (Nodes/Members/Reactions)
 * - Bottom: Results Control Panel
 * - Main: 3D Viewport with overlays
 * 
 * Designed to match STAAD.Pro, SAP2000, ETABS interface
 */

import React, { FC, useState, useCallback } from 'react';
import {
    PanelLeftClose,
    PanelLeftOpen,
    PanelBottomClose,
    PanelBottomOpen,
    Maximize2,
    Minimize2,
    Settings,
    X
} from 'lucide-react';
import { useModelStore } from '../../store/model';
import { ResultsTablePanel } from './ResultsTablePanel';
import { ResultsControlPanel } from './ResultsControlPanel';

// ============================================
// TYPES
// ============================================

interface ResultsSplitViewProps {
    isOpen?: boolean;
    onClose?: () => void;
    className?: string;
}

// ============================================
// COMPONENT
// ============================================

export const ResultsSplitView: FC<ResultsSplitViewProps> = ({
    isOpen = false,
    onClose,
    className = ''
}) => {
    const analysisResults = useModelStore(state => state.analysisResults);
    
    const [leftPanelOpen, setLeftPanelOpen] = useState(true);
    const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
    const [leftPanelWidth, setLeftPanelWidth] = useState(400);
    const [bottomPanelHeight, setBottomPanelHeight] = useState(280);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Handle resize of left panel
    const handleLeftResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = leftPanelWidth;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(280, Math.min(600, startWidth + moveEvent.clientX - startX));
            setLeftPanelWidth(newWidth);
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [leftPanelWidth]);

    // Handle resize of bottom panel
    const handleBottomResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = bottomPanelHeight;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newHeight = Math.max(150, Math.min(450, startHeight - (moveEvent.clientY - startY)));
            setBottomPanelHeight(newHeight);
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [bottomPanelHeight]);

    if (!isOpen || !analysisResults) return null;

    return (
        <div className={`fixed inset-0 z-50 bg-white dark:bg-slate-950 ${isFullscreen ? '' : 'p-4'} ${className}`}>
            {/* Header Bar */}
            <div className="h-12 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Analysis Results</h2>
                    <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Analysis Complete
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Panel Toggles */}
                    <button type="button"
                        onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                        title={leftPanelOpen ? "Hide Table Panel" : "Show Table Panel"}
                    >
                        {leftPanelOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                    </button>
                    <button type="button"
                        onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                        title={bottomPanelOpen ? "Hide Control Panel" : "Show Control Panel"}
                    >
                        {bottomPanelOpen ? <PanelBottomClose size={18} /> : <PanelBottomOpen size={18} />}
                    </button>
                    
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
                    
                    <button type="button"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    
                    {onClose && (
                        <button type="button"
                            onClick={onClose}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-white hover:bg-red-800 rounded transition-colors"
                            title="Close Results View"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex h-[calc(100%-3rem)]">
                {/* Left Panel - Results Table */}
                {leftPanelOpen && (
                    <>
                        <div 
                            className="bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden"
                            style={{ width: leftPanelWidth }}
                        >
                            <ResultsTablePanel className="flex-1 border-0 rounded-none" />
                        </div>
                        
                        {/* Left Resize Handle */}
                        <div
                            className="w-1 bg-slate-200 dark:bg-slate-700 hover:bg-cyan-500 cursor-col-resize transition-colors"
                            onMouseDown={handleLeftResize}
                        />
                    </>
                )}

                {/* Main + Bottom Area */}
                <div className="flex-1 flex flex-col">
                    {/* Main Viewport Area */}
                    <div className="flex-1 bg-white dark:bg-slate-950 relative overflow-hidden">
                        {/* This is where the 3D viewport would render */}
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500 dark:text-slate-400">
                            <div className="text-center">
                                <Settings size={48} className="mx-auto mb-4 opacity-30" />
                                <p className="text-sm">3D Viewport with Analysis Overlays</p>
                                <p className="text-xs mt-2 text-slate-500">
                                    Use the control panel to toggle diagrams
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Panel - Control Panel */}
                    {bottomPanelOpen && (
                        <>
                            {/* Bottom Resize Handle */}
                            <div
                                className="h-1 bg-slate-200 dark:bg-slate-700 hover:bg-cyan-500 cursor-row-resize transition-colors"
                                onMouseDown={handleBottomResize}
                            />
                            
                            <div 
                                className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 overflow-auto"
                                style={{ height: bottomPanelHeight }}
                            >
                                <ResultsControlPanel className="border-0 rounded-none h-full" />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// DOCKABLE PANEL FOR INTEGRATION
// ============================================

interface DockableResultsPanelProps {
    position: 'left' | 'right' | 'bottom';
    className?: string;
}

export const DockableResultsPanel: FC<DockableResultsPanelProps> = ({
    position,
    className = ''
}) => {
    const analysisResults = useModelStore(state => state.analysisResults);
    const [isCollapsed, setIsCollapsed] = useState(false);

    if (!analysisResults) return null;

    const isHorizontal = position === 'bottom';
    const size = isHorizontal ? 'h-80' : 'w-96';
    const collapsedSize = isHorizontal ? 'h-10' : 'w-10';

    return (
        <div 
            className={`
                ${isCollapsed ? collapsedSize : size}
                bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700
                ${isHorizontal ? 'border-t' : position === 'left' ? 'border-r' : 'border-l'}
                transition-all duration-300
                ${className}
            `}
        >
            {/* Collapse Toggle */}
            <button type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute top-2 right-2 z-10 p-1 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
            >
                {isCollapsed ? (
                    isHorizontal ? <PanelBottomOpen size={14} /> : <PanelLeftOpen size={14} />
                ) : (
                    isHorizontal ? <PanelBottomClose size={14} /> : <PanelLeftClose size={14} />
                )}
            </button>

            {!isCollapsed && (
                <div className="h-full overflow-auto">
                    <ResultsTablePanel className="h-full border-0 rounded-none" />
                </div>
            )}
        </div>
    );
};

export default ResultsSplitView;
