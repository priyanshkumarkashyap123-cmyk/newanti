import { FC } from 'react';
import {
    Box,
    Layers,
    Database,
    Settings,
    Anchor,
    Download,
    BarChart3,
    Ruler
} from 'lucide-react';
import { Category } from '../../store/uiStore';

interface WorkflowSidebarProps {
    activeCategory: Category;
    onCategoryChange: (category: Category) => void;
    currentStep?: string; // Fine-grained step control if needed
}

export const WorkflowSidebar: FC<WorkflowSidebarProps> = ({
    activeCategory,
    onCategoryChange
}) => {

    const workflowItems = [
        { id: 'MODELING', label: 'Geometry', icon: Box, subtext: 'Nodes & Beams' },
        { id: 'PROPERTIES', label: 'Properties', icon: Layers, subtext: 'Sections' },
        { id: 'MATERIALS', label: 'Materials', icon: Database, subtext: 'Concrete/Steel' }, // New category mapping needed
        { id: 'SPECS', label: 'Specifications', icon: Settings, subtext: 'Releases' },      // New category mapping needed
        { id: 'SUPPORTS', label: 'Supports', icon: Anchor, subtext: 'Restraints' },         // New category mapping needed
        { id: 'LOADING', label: 'Loading', icon: Download, subtext: 'Load Cases' },
        { id: 'ANALYSIS', label: 'Analysis', icon: BarChart3, subtext: 'Run Solver' },
        { id: 'DESIGN', label: 'Design', icon: Ruler, subtext: 'Code Check' },
    ];

    // Helper to map UI ID to Store Category
    const handleClick = (id: string) => {
        // Map specific workflow steps to general store categories for now
        // This preserves compatibility while giving granular UI
        let category: Category = 'MODELING';

        switch (id) {
            case 'MODELING': category = 'MODELING'; break;
            case 'PROPERTIES':
            case 'MATERIALS':
            case 'SPECS':
            case 'SUPPORTS':
                category = 'PROPERTIES'; break;
            case 'LOADING': category = 'LOADING'; break;
            case 'ANALYSIS': category = 'ANALYSIS'; break;
            case 'DESIGN': category = 'DESIGN'; break;
        }

        onCategoryChange(category);
    };

    return (
        <div className="h-full w-full bg-zinc-900 flex flex-col border-r border-zinc-800">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-950">
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Workflow
                </h2>
                <div className="text-[10px] text-zinc-600 mt-1 font-mono">
                    ANALYTICAL MODELING
                </div>
            </div>

            {/* Workflow Steps */}
            <div className="flex-1 overflow-y-auto py-2">
                <div className="flex flex-col gap-1 px-2">
                    {workflowItems.map((item) => {
                        // Simple active check logic - relies on mapped categories
                        const isActive =
                            (activeCategory === 'MODELING' && item.id === 'MODELING') ||
                            (activeCategory === 'PROPERTIES' && ['PROPERTIES', 'MATERIALS', 'SPECS', 'SUPPORTS'].includes(item.id)) ||
                            (activeCategory === 'LOADING' && item.id === 'LOADING') ||
                            (activeCategory === 'ANALYSIS' && item.id === 'ANALYSIS') ||
                            (activeCategory === 'DESIGN' && item.id === 'DESIGN');

                        // Specifically highlight the exact item if we track granular state in future
                        // For now, highlight broader categories slightly differently or just the main one

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleClick(item.id)}
                                className={`
                                    group flex items-center gap-3 px-3 py-3 rounded-md text-left transition-all
                                    ${isActive
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}
                                `}
                            >
                                <div className={`
                                    p-1.5 rounded-md transition-colors
                                    ${isActive ? 'bg-blue-500' : 'bg-zinc-800 group-hover:bg-zinc-700'}
                                `}>
                                    <item.icon className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-sm font-medium leading-none">
                                        {item.label}
                                    </span>
                                    <span className={`text-[10px] mt-1 leading-none ${isActive ? 'text-blue-200' : 'text-zinc-600'}`}>
                                        {item.subtext}
                                    </span>
                                </div>

                                {/* Active Indicator Bar */}
                                {isActive && (
                                    <div className="absolute left-0 w-1 h-8 bg-blue-400 rounded-r-full" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Section */}
            <div className="p-4 bg-zinc-950 border-t border-zinc-800">
                <div className="flex flex-col gap-2">
                    <button className="text-xs text-zinc-500 hover:text-white text-left">
                        Connection Client
                    </button>
                    <div className="w-full h-px bg-zinc-800" />
                    <button className="text-xs text-green-500 hover:text-green-400 text-left flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Connected
                    </button>
                </div>
            </div>
        </div>
    );
};
