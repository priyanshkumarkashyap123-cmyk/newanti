import { FC } from 'react';
import {
    MousePointer2,
    Move3d,
    Box,
    Spline,
    Table2,
    Save,
    FolderOpen,
    Undo,
    Redo,
    Play,
    Settings,
    Download,
    FileText,
    Grid,
    ZoomIn,
    Rotate3d,
    Eye,
    Database
} from 'lucide-react';
import { useModelStore } from '../../store/model';
import { useUIStore, Category } from '../../store/uiStore';
import { useSubscription } from '../../hooks/useSubscription';

interface RibbonProps {
    activeCategory: Category;
}

export const EngineeringRibbon: FC<RibbonProps> = ({ activeCategory }) => {
    // Store access
    const { activeTool, setTool, isAnalyzing } = useModelStore();
    const { openModal } = useUIStore();
    const { undo, redo, pastStates, futureStates } = useModelStore.temporal.getState();

    // Map Category to Ribbon Tab
    // This allows the ribbon to switch automatically based on workflow sidebar
    const activeTab = activeCategory;

    // Helper for tool buttons - Consistent sizing
    const ToolButton = ({
        icon: Icon,
        label,
        onClick,
        isActive = false,
        disabled = false,
        vertical = true
    }: any) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                flex flex-col items-center justify-center gap-1.5 px-2 py-1.5 rounded
                border border-transparent hover:bg-zinc-800 transition-colors
                ${isActive ? 'bg-blue-900/40 border-blue-700/50 text-blue-200' : 'text-zinc-400'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${vertical ? 'h-14 w-14 min-w-[56px]' : 'flex-row h-8 px-3 w-auto gap-2'}
            `}
        >
            <Icon className={`${vertical ? 'w-5 h-5' : 'w-4 h-4'} flex-shrink-0`} />
            <span className="text-[10px] whitespace-nowrap text-center leading-tight max-w-[52px] truncate">
                {label}
            </span>
        </button>
    );

    // Group Container - Fixed label positioning
    const ToolGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
        <div className="flex flex-col h-full border-r border-zinc-800 px-3 pb-4 pt-1">
            <div className="flex-1 flex items-center gap-1">
                {children}
            </div>
            <div className="text-[9px] text-zinc-500 text-center uppercase tracking-wider mt-1 select-none">
                {label}
            </div>
        </div>
    );

    // Content specific to each tab
    const renderGeometryTab = () => (
        <>
            <ToolGroup label="Project">
                <ToolButton icon={Save} label="Save" onClick={() => document.dispatchEvent(new CustomEvent('trigger-save'))} />
                <ToolButton icon={FolderOpen} label="Open" onClick={() => document.dispatchEvent(new CustomEvent('trigger-cloud-open'))} />
                <div className="flex flex-col gap-1">
                    <button onClick={() => undo()} disabled={pastStates.length === 0} className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"><Undo className="w-3 h-3" /></button>
                    <button onClick={() => redo()} disabled={futureStates.length === 0} className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"><Redo className="w-3 h-3" /></button>
                </div>
            </ToolGroup>

            <ToolGroup label="Structure">
                <ToolButton icon={Grid} label="Wizard" onClick={() => openModal('structureWizard')} vertical />
                <ToolButton icon={Table2} label="Tables" onClick={() => { }} vertical />
            </ToolGroup>

            <ToolGroup label="Create">
                <ToolButton icon={Box} label="Node" onClick={() => setTool('node')} isActive={activeTool === 'node'} />
                <ToolButton icon={Spline} label="Beam" onClick={() => setTool('member')} isActive={activeTool === 'member'} />
                <ToolButton icon={Grid} label="Plate" onClick={() => { }} disabled />
            </ToolGroup>

            <ToolGroup label="Selection">
                <ToolButton icon={MousePointer2} label="Node Cursor" onClick={() => setTool('select')} isActive={activeTool === 'select'} />
                <ToolButton icon={Move3d} label="Beam Cursor" onClick={() => setTool('select')} isActive={activeTool === 'select'} />
            </ToolGroup>
        </>
    );

    const renderPropertiesTab = () => (
        <>
            <ToolGroup label="Specification">
                <ToolButton icon={Settings} label="Section" onClick={() => openModal('geometryTools')} />
                <ToolButton icon={Database} label="Material" onClick={() => { }} />
                <ToolButton icon={Table2} label="Beta Angle" onClick={() => { }} />
            </ToolGroup>
        </>
    );

    const renderLoadingTab = () => (
        <>
            <ToolGroup label="Definitions">
                <ToolButton icon={Download} label="Load Cases" onClick={() => openModal('is875Load')} />
                <ToolButton icon={Settings} label="Combinations" onClick={() => openModal('loadDialog')} />
            </ToolGroup>
            <ToolGroup label="Apply">
                <ToolButton icon={Download} label="Nodal Load" onClick={() => setTool('load')} isActive={activeTool === 'load'} />
                <ToolButton icon={Spline} label="Member Load" onClick={() => setTool('memberLoad')} isActive={activeTool === 'memberLoad'} />
            </ToolGroup>
        </>
    );

    const renderAnalysisTab = () => (
        <>
            <ToolGroup label="Simulation">
                <ToolButton
                    icon={Play}
                    label="Run Analysis"
                    onClick={() => document.dispatchEvent(new CustomEvent('trigger-analysis'))} // We'll listen for this
                    isActive={isAnalyzing}
                    vertical
                />
            </ToolGroup>
            <ToolGroup label="Results">
                <ToolButton icon={FileText} label="Output" onClick={() => { }} />
                <ToolButton icon={Download} label="Export" onClick={() => document.dispatchEvent(new CustomEvent('trigger-export'))} />
            </ToolGroup>
        </>
    );

    return (
        <div className="w-full bg-zinc-900 border-b border-zinc-800 flex flex-col select-none">
            {/* Tab Bar usually handled by parent active state, but ribbon could show tabs too */}

            {/* Tools Area */}
            <div className="h-24 flex items-center px-2 py-1 gap-1 overflow-x-auto">

                {/* Always show File/View basics? Or strictly context? 
                    STAAD Ribbon changes content based on Tab. 
                    Let's switch content based on activeCategory. 
                */}

                {activeCategory === 'MODELING' && renderGeometryTab()}
                {activeCategory === 'PROPERTIES' && renderPropertiesTab()}
                {activeCategory === 'LOADING' && renderLoadingTab()}
                {activeCategory === 'ANALYSIS' && renderAnalysisTab()}

                {/* Fallback for other tabs */}
                {['DESIGN'].includes(activeCategory) && (
                    <div className="flex items-center justify-center h-full w-full text-zinc-600 text-xs italic">
                        Tools for {activeCategory} mode coming soon
                    </div>
                )}
            </div>
        </div>
    );
};
