/**
 * ModelingToolbar.tsx - Comprehensive Modeling Toolbar
 * 
 * Organized toolbar with dropdown groups for all modeling tools:
 * - Selection, Draw, Edit, Array, Transform, Generate, Measure
 * 
 * Features:
 * - Dropdown menus for each tool group
 * - Visual icons with tooltips
 * - Keyboard shortcut display
 * - Active tool highlighting
 */

import { FC, useState, useEffect, useCallback } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useUIStore, CATEGORY_TOOLS } from '../../store/uiStore';
import { useModelStore } from '../../store/model';
import { DemoModelsPanel } from '../DemoModelsPanel';
import {
    MODELING_TOOL_GROUPS,
    TOOL_DEFINITIONS,
    KEYBOARD_SHORTCUTS,
    ToolGroup,
    ToolDefinition
} from '../../data/ToolGroups';

// ============================================
// TYPES
// ============================================

interface ToolButtonProps {
    tool: ToolDefinition;
    isActive: boolean;
    onClick: () => void;
    showLabel?: boolean;
}

// ============================================
// TOOL BUTTON COMPONENT
// ============================================

const ToolButton: FC<ToolButtonProps> = ({ tool, isActive, onClick, showLabel = true }) => {
    const Icon = tool.icon;

    return (
        <button
            onClick={onClick}
            className={`
        flex items-center gap-2 px-3 py-2 rounded-md text-sm
        transition-all duration-150
        ${isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-300 hover:bg-zinc-700 hover:text-white'
                }
      `}
            title={`${tool.tooltip}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
            aria-label={tool.label}
            aria-pressed={isActive}
        >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {showLabel && <span>{tool.label}</span>}
            {tool.shortcut && (
                <span className="text-[10px] text-zinc-500 ml-auto" aria-hidden="true">{tool.shortcut}</span>
            )}
        </button>
    );
};

// ============================================
// TOOL GROUP DROPDOWN
// ============================================

interface ToolGroupDropdownProps {
    group: ToolGroup;
    activeTool: string | null;
    onToolSelect: (toolId: string) => void;
}

const ToolGroupDropdown: FC<ToolGroupDropdownProps> = ({ group, activeTool, onToolSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const Icon = group.icon;

    // Check if any tool in this group is active
    const hasActiveTool = group.tools.some(id => id === activeTool);

    // Get the active tool in this group for display
    const activeToolInGroup = group.tools.find(id => id === activeTool);
    const displayTool = activeToolInGroup
        ? TOOL_DEFINITIONS[activeToolInGroup]
        : TOOL_DEFINITIONS[group.tools[0]];
    const DisplayIcon = displayTool?.icon || Icon;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-md
          border border-zinc-700 text-sm
          transition-all duration-150
          ${hasActiveTool
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }
        `}
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-label={`${group.label} tools`}
            >
                <DisplayIcon className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">{group.label}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Menu */}
                    <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 
                          rounded-lg shadow-xl z-50 min-w-[200px] py-1">
                        {group.tools.map(toolId => {
                            const tool = TOOL_DEFINITIONS[toolId];
                            if (!tool) return null;

                            return (
                                <ToolButton
                                    key={toolId}
                                    tool={tool}
                                    isActive={activeTool === toolId}
                                    onClick={() => {
                                        onToolSelect(toolId);
                                        setIsOpen(false);
                                    }}
                                />
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

// ============================================
// QUICK ACCESS TOOLS
// ============================================

const QUICK_TOOLS = ['SELECT', 'DRAW_NODE', 'DRAW_BEAM', 'DRAW_COLUMN', 'DELETE'];

// ============================================
// MAIN TOOLBAR COMPONENT
// ============================================

export const ModelingToolbar: FC = () => {
    const activeTool = useUIStore(state => state.activeTool);
    const activeCategory = useUIStore(state => state.activeCategory);
    const setActiveTool = useUIStore(state => state.setActiveTool);
    const openModal = useUIStore(state => state.openModal);
    const { setTool: setModelTool } = useModelStore();

    // Helper function to set tool in both stores
    const handleToolSelect = useCallback((toolId: string) => {
        setActiveTool(toolId);

        // Map UI tool names to model tool names
        const toolMap: Record<string, string> = {
            'SELECT': 'select',
            'NODE': 'node',
            'MEMBER': 'member',
            'SUPPORT': 'support',
            'LOAD': 'load',
            'MEMBER_LOAD': 'memberLoad',
        };

        const modelTool = toolMap[toolId] || toolId.toLowerCase();
        setModelTool(modelTool as any);
    }, [setActiveTool, setModelTool]);

    // Handle keyboard shortcuts
    useEffect(() => {
        if (activeCategory !== 'MODELING') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if typing in input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const key = e.key.toLowerCase();
            const toolId = KEYBOARD_SHORTCUTS[key] || KEYBOARD_SHORTCUTS[e.key];

            if (toolId && CATEGORY_TOOLS.MODELING.includes(toolId)) {
                e.preventDefault();
                handleToolSelect(toolId);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleToolSelect, activeCategory]);

    // Only show modeling tools when in MODELING category
    if (activeCategory !== 'MODELING') {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 p-2 bg-zinc-900 border-b border-zinc-800">
            {/* Quick Access Bar */}
            <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase text-zinc-500 px-2">Quick:</span>
                {QUICK_TOOLS.map(toolId => {
                    const tool = TOOL_DEFINITIONS[toolId];
                    if (!tool) return null;

                    const Icon = tool.icon;
                    return (
                        <button
                            key={toolId}
                            onClick={() => handleToolSelect(toolId)}
                            className={`
                p-2 rounded-md transition-all
                ${activeTool === toolId
                                    ? 'bg-blue-600 text-white'
                                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                }
              `}
                            title={`${tool.tooltip}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
                            aria-label={`${tool.tooltip}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
                        >
                            <Icon className="w-4 h-4" aria-hidden="true" />
                        </button>
                    );
                })}

                {/* Structure Gallery Button */}
                <button
                    onClick={() => openModal('structureGallery')}
                    className="p-2 rounded-md transition-all bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    title="Open Structure Gallery - Load iconic civil engineering structures"
                    aria-label="Open Structure Gallery"
                >
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                </button>

                {/* Demo Models Panel */}
                <DemoModelsPanel onLoadDemo={(demo) => {
                    console.log('Loaded demo:', demo.name);
                }} />

                <div className="w-px h-6 bg-zinc-700 mx-2" />

                {/* Tool Groups */}
                <div className="flex items-center gap-1">
                    {MODELING_TOOL_GROUPS.map(group => (
                        <ToolGroupDropdown
                            key={group.id}
                            group={group}
                            activeTool={activeTool}
                            onToolSelect={handleToolSelect}
                        />
                    ))}
                </div>
            </div>

            {/* Active Tool Indicator */}
            {activeTool && TOOL_DEFINITIONS[activeTool] && (
                <div className="flex items-center gap-2 px-2 py-1 bg-zinc-800/50 rounded text-xs">
                    <span className="text-zinc-500">Active:</span>
                    <span className="text-blue-400 font-medium">
                        {TOOL_DEFINITIONS[activeTool].label}
                    </span>
                    <span className="text-zinc-600">—</span>
                    <span className="text-zinc-400">
                        {TOOL_DEFINITIONS[activeTool].tooltip}
                    </span>
                </div>
            )}
        </div>
    );
};

export default ModelingToolbar;
