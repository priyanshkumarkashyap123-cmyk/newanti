/**
 * Ribbon - Horizontal Tool Ribbon
 * 
 * Context-sensitive toolbar that changes based on active workflow.
 */

import React from 'react';
import { FC } from 'react';
import {
    Plus,
    Move,
    MousePointer,
    Grid3X3,
    Box,
    ArrowDown,
    RotateCcw,
    FlipHorizontal,
    Play,
    Download,
    Undo,
    Redo,
    ZoomIn,
    ZoomOut,
    Maximize,
    Save,
    FileText,
    Hammer
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface RibbonTool {
    id: string;
    label: string;
    icon: React.ElementType;
    shortcut?: string;
}

interface RibbonGroup {
    id: string;
    label: string;
    tools: RibbonTool[];
}

interface RibbonProps {
    activeWorkflow: 'MODELING' | 'PROPERTIES' | 'SUPPORTS' | 'LOADING' | 'ANALYSIS' | 'DESIGN' | 'CIVIL';
    activeTool?: string;
    onToolSelect: (toolId: string) => void;
}

// ============================================
// RIBBON TOOLS BY WORKFLOW
// ============================================

const GEOMETRY_TOOLS: RibbonGroup[] = [
    {
        id: 'selection',
        label: 'Selection',
        tools: [
            { id: 'select', label: 'Select', icon: MousePointer, shortcut: 'V' },
            { id: 'move', label: 'Move', icon: Move, shortcut: 'M' }
        ]
    },
    {
        id: 'create',
        label: 'Create',
        tools: [
            { id: 'add-node', label: 'Node', icon: Plus, shortcut: 'N' },
            { id: 'add-beam', label: 'Beam', icon: Box, shortcut: 'B' },
            { id: 'add-plate', label: 'Plate', icon: Grid3X3, shortcut: 'P' }
        ]
    },
    {
        id: 'transform',
        label: 'Transform',
        tools: [
            { id: 'rotate', label: 'Rotate', icon: RotateCcw, shortcut: 'R' },
            { id: 'mirror', label: 'Mirror', icon: FlipHorizontal }
        ]
    }
];

const LOADING_TOOLS: RibbonGroup[] = [
    {
        id: 'loads',
        label: 'Loads',
        tools: [
            { id: 'point-load', label: 'Point Load', icon: ArrowDown, shortcut: 'F' },
            { id: 'member-load', label: 'Member Load', icon: Box },
            { id: 'area-load', label: 'Area Load', icon: Grid3X3 }
        ]
    },
    {
        id: 'combinations',
        label: 'Combinations',
        tools: [
            { id: 'load-combo', label: 'Load Combos', icon: Hammer }
        ]
    }
];

const ANALYSIS_TOOLS: RibbonGroup[] = [
    {
        id: 'run',
        label: 'Run',
        tools: [
            { id: 'run-analysis', label: 'Run Analysis', icon: Play, shortcut: 'F5' }
        ]
    },
    {
        id: 'export',
        label: 'Export',
        tools: [
            { id: 'export-report', label: 'Report', icon: FileText },
            { id: 'export-data', label: 'Export', icon: Download }
        ]
    }
];

function getToolsForWorkflow(workflow: RibbonProps['activeWorkflow']): RibbonGroup[] {
    switch (workflow) {
        case 'MODELING':
        case 'PROPERTIES':
        case 'SUPPORTS':
            return GEOMETRY_TOOLS;
        case 'LOADING':
            return LOADING_TOOLS;
        case 'ANALYSIS':
            return ANALYSIS_TOOLS;
        case 'DESIGN':
        case 'CIVIL':
            return GEOMETRY_TOOLS;
        default:
            return GEOMETRY_TOOLS;
    }
}

// ============================================
// COMPONENT
// ============================================

export const Ribbon: FC<RibbonProps> = ({ activeWorkflow, activeTool, onToolSelect }) => {
    const toolGroups = getToolsForWorkflow(activeWorkflow);

    return (
        <div className="h-16 flex items-center bg-[#0b1326] border-b border-[#1a2333] px-6">
            {/* Quick Actions */}
            <div className="flex items-center gap-2 pr-5 border-r border-[#1a2333]">
                <button type="button"
                    onClick={() => onToolSelect('save')}
                    className="h-10 w-10 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-[#869ab8] transition-colors"
                    title="Save (Ctrl+S)"
                >
                    <Save className="w-4 h-4" />
                </button>
                <button type="button"
                    onClick={() => onToolSelect('undo')}
                    className="h-10 w-10 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-[#869ab8] transition-colors"
                    aria-pressed={activeTool === 'undo'}
                    title="Undo (Ctrl+Z)"
                >
                    <Undo className="w-4 h-4" />
                </button>
                <button type="button"
                    onClick={() => onToolSelect('redo')}
                    className="h-10 w-10 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-[#869ab8] transition-colors"
                    aria-pressed={activeTool === 'redo'}
                    title="Redo (Ctrl+Y)"
                >
                    <Redo className="w-4 h-4" />
                </button>
            </div>

            {/* Tool Groups */}
            <div className="flex items-center gap-6 ml-5">
                {toolGroups.map((group) => (
                    <div key={group.id} className="flex flex-col items-center gap-1">
                        {/* Tools */}
                        <div className="flex items-center gap-2">
                            {group.tools.map((tool) => {
                                const Icon = tool.icon;
                                const isActive = activeTool === tool.id;

                                return (
                                    <button type="button"
                                        key={tool.id}
                                        onClick={() => onToolSelect(tool.id)}
                                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded transition-colors min-h-12 ${isActive
                                                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                                                : 'text-[#869ab8] hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                        title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
                                        aria-pressed={isActive}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="text-[10px] font-medium tracking-wide">{tool.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {/* Group Label */}
                        <span className="text-[9px] text-slate-500 dark:text-slate-500 mt-1">
                            {group.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* View Controls */}
            <div className="flex items-center gap-2 pl-5 border-l border-[#1a2333]">
                <button type="button"
                    onClick={() => onToolSelect('zoom-in')}
                    className="h-10 w-10 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-[#869ab8]"
                    title="Zoom In"
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button type="button"
                    onClick={() => onToolSelect('zoom-out')}
                    className="h-10 w-10 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-[#869ab8]"
                    title="Zoom Out"
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <button type="button"
                    onClick={() => onToolSelect('fit-view')}
                    className="h-10 w-10 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-[#869ab8]"
                    title="Fit View"
                >
                    <Maximize className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default Ribbon;
