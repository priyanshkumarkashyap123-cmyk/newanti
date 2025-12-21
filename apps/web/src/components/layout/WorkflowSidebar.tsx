/**
 * WorkflowSidebar - Vertical Workflow Navigation
 * 
 * Contains collapsible sections for Geometry, Loading, Analysis workflows.
 */

import { FC, useState } from 'react';
import {
    Box,
    Loader,
    Play,
    ChevronDown,
    ChevronRight,
    Plus,
    Move,
    Grid3X3,
    ArrowDown,
    Triangle,
    BarChart3,
    FileCheck,
    Settings,
    Layers
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface WorkflowItem {
    id: string;
    label: string;
    icon: React.ElementType;
    subItems?: { id: string; label: string }[];
}

interface WorkflowSidebarProps {
    activeWorkflow: string;
    onWorkflowChange: (id: string) => void;
    onToolSelect?: (toolId: string) => void;
}

// ============================================
// WORKFLOW DATA
// ============================================

const WORKFLOWS: WorkflowItem[] = [
    {
        id: 'geometry',
        label: 'Geometry',
        icon: Box,
        subItems: [
            { id: 'add-node', label: 'Add Node' },
            { id: 'add-beam', label: 'Add Beam' },
            { id: 'add-plate', label: 'Add Plate' },
            { id: 'add-support', label: 'Add Support' },
            { id: 'translate', label: 'Translate' },
            { id: 'rotate', label: 'Rotate' },
            { id: 'mirror', label: 'Mirror' }
        ]
    },
    {
        id: 'loading',
        label: 'Loading',
        icon: ArrowDown,
        subItems: [
            { id: 'add-point-load', label: 'Point Load' },
            { id: 'add-member-load', label: 'Member Load' },
            { id: 'add-area-load', label: 'Area Load' },
            { id: 'load-combinations', label: 'Load Combinations' },
            { id: 'selfweight', label: 'Self Weight' }
        ]
    },
    {
        id: 'analysis',
        label: 'Analysis',
        icon: Play,
        subItems: [
            { id: 'run-analysis', label: 'Run Analysis' },
            { id: 'modal-analysis', label: 'Modal Analysis' },
            { id: 'pdelta', label: 'P-Delta' },
            { id: 'buckling', label: 'Buckling' }
        ]
    },
    {
        id: 'design',
        label: 'Design',
        icon: FileCheck,
        subItems: [
            { id: 'steel-design', label: 'Steel Design' },
            { id: 'concrete-design', label: 'Concrete Design' },
            { id: 'connection-design', label: 'Connection Design' }
        ]
    },
    {
        id: 'results',
        label: 'Results',
        icon: BarChart3,
        subItems: [
            { id: 'reactions', label: 'Reactions' },
            { id: 'displacements', label: 'Displacements' },
            { id: 'member-forces', label: 'Member Forces' },
            { id: 'stress-contours', label: 'Stress Contours' }
        ]
    }
];

// ============================================
// COMPONENT
// ============================================

export const WorkflowSidebar: FC<WorkflowSidebarProps> = ({
    activeWorkflow,
    onWorkflowChange,
    onToolSelect
}) => {
    const [expandedItems, setExpandedItems] = useState<Set<string>>(
        new Set(['geometry', 'loading'])
    );

    const toggleExpanded = (id: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedItems(newExpanded);
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Workflow
                </h2>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto py-2">
                {WORKFLOWS.map((workflow) => {
                    const Icon = workflow.icon;
                    const isActive = activeWorkflow === workflow.id;
                    const isExpanded = expandedItems.has(workflow.id);

                    return (
                        <div key={workflow.id} className="mb-1">
                            {/* Workflow Header */}
                            <button
                                onClick={() => {
                                    onWorkflowChange(workflow.id);
                                    toggleExpanded(workflow.id);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${isActive
                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                    }`}
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                                )}
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span>{workflow.label}</span>
                            </button>

                            {/* Sub Items */}
                            {isExpanded && workflow.subItems && (
                                <div className="ml-6 border-l border-zinc-200 dark:border-zinc-700">
                                    {workflow.subItems.map((subItem) => (
                                        <button
                                            key={subItem.id}
                                            onClick={() => onToolSelect?.(subItem.id)}
                                            className="w-full text-left px-4 py-1.5 text-xs text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                        >
                                            {subItem.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800">
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                    <Settings className="w-3 h-3" />
                    Settings
                </button>
            </div>
        </div>
    );
};

export default WorkflowSidebar;
