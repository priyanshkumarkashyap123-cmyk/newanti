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
    Database,
    Crown,
    Activity,
    Cpu,
    Anchor,
    Weight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useModelStore } from '../../store/model';
import { useUIStore, Category } from '../../store/uiStore';
import { useSubscription } from '../../hooks/useSubscription';
import { Tooltip } from '../ui/Tooltip';

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
        vertical = true,
        className = '',
        tooltip,
        shortcut
    }: any) => (
        <Tooltip content={tooltip || label} shortcut={shortcut}>
            <button
                onClick={onClick}
                disabled={disabled}
                className={`
                    flex flex-col items-center justify-center gap-1.5 px-2 py-1.5 rounded
                    border border-transparent hover:bg-slate-800 transition-colors
                    ${isActive ? 'bg-blue-900/40 border-blue-700/50 text-blue-200' : 'text-slate-400'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${vertical ? 'h-14 w-14 min-w-[56px]' : 'flex-row h-8 px-3 w-auto gap-2'}
                    ${className}
                `}
            >
                <Icon className={`${vertical ? 'w-5 h-5' : 'w-4 h-4'} flex-shrink-0`} />
                <span className="text-[10px] whitespace-nowrap text-center leading-tight max-w-[52px] truncate">
                    {label}
                </span>
            </button>
        </Tooltip>
    );

    // Group Container - Fixed label positioning
    const ToolGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
        <div className="flex flex-col h-full border-r border-slate-800 px-3 pb-4 pt-1">
            <div className="flex-1 flex items-center gap-1">
                {children}
            </div>
            <div className="text-[9px] text-slate-500 text-center uppercase tracking-wider mt-1 select-none">
                {label}
            </div>
        </div>
    );

    // Content specific to each tab
    const renderGeometryTab = () => (
        <>
            <ToolGroup label="Project">
                <ToolButton icon={Save} label="Save" onClick={() => document.dispatchEvent(new CustomEvent('trigger-save'))} shortcut="Cmd+S" />
                <ToolButton icon={FolderOpen} label="Open" onClick={() => document.dispatchEvent(new CustomEvent('trigger-cloud-open'))} shortcut="Cmd+O" />
                <div className="flex flex-col gap-1">
                    <Tooltip content="Undo" shortcut="Cmd+Z">
                        <button onClick={() => undo()} disabled={pastStates.length === 0} className="p-1 hover:bg-slate-800 rounded disabled:opacity-30 text-slate-400" aria-label="Undo"><Undo className="w-3 h-3" aria-hidden="true" /></button>
                    </Tooltip>
                    <Tooltip content="Redo" shortcut="Cmd+Shift+Z">
                        <button onClick={() => redo()} disabled={futureStates.length === 0} className="p-1 hover:bg-slate-800 rounded disabled:opacity-30 text-slate-400" aria-label="Redo"><Redo className="w-3 h-3" aria-hidden="true" /></button>
                    </Tooltip>
                </div>
                <ToolButton
                    icon={Crown}
                    label="Upgrade"
                    onClick={() => document.dispatchEvent(new CustomEvent('trigger-upgrade'))}
                    active={false}
                    className="text-amber-400 hover:text-amber-300"
                />
            </ToolGroup>

            <ToolGroup label="Structure">
                <ToolButton icon={Grid} label="Wizard" onClick={() => openModal('structureWizard')} tooltip="Structure Wizard" shortcut="Cmd+Shift+W" />
                <ToolButton icon={Database} label="Gallery" onClick={() => openModal('structureGallery')} tooltip="Load Famous Structures" />
            </ToolGroup>

            <ToolGroup label="Create">
                <ToolButton icon={Box} label="Node" onClick={() => setTool('node')} isActive={activeTool === 'node'} tooltip="Create Node" shortcut="N" />
                <ToolButton icon={Spline} label="Beam" onClick={() => setTool('member')} isActive={activeTool === 'member'} tooltip="Create Member" shortcut="M" />
                <ToolButton icon={Grid} label="Plate" onClick={() => openModal('plateDialog')} tooltip="Create Plate/Shell Element" shortcut="P" />
            </ToolGroup>

            <ToolGroup label="Selection">
                <ToolButton icon={MousePointer2} label="Select" onClick={() => setTool('select')} isActive={activeTool === 'select'} shortcut="V" />
                <ToolButton icon={Grid} label="Advanced" onClick={() => openModal('selectionToolbar')} tooltip="Selection Toolbar" />
            </ToolGroup>

            <ToolGroup label="Supports">
                <ToolButton icon={Anchor} label="Boundary" onClick={() => openModal('boundaryConditionsDialog')} tooltip="Boundary Conditions" />
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
            <ToolGroup label="Generate">
                <ToolButton icon={Weight} label="Dead Load" onClick={() => openModal('deadLoadGenerator')} tooltip="Dead Load Generator" />
            </ToolGroup>
        </>
    );

    const renderAnalysisTab = () => (
        <>
            <ToolGroup label="Simulation">
                <ToolButton
                    icon={Play}
                    label="Run Analysis"
                    onClick={() => document.dispatchEvent(new CustomEvent('trigger-analysis'))}
                    isActive={isAnalyzing}
                    vertical
                />
                <ToolButton
                    icon={Activity}
                    label="Modal Freq"
                    onClick={() => document.dispatchEvent(new CustomEvent('trigger-modal-analysis'))}
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
        <div className="w-full bg-slate-900 border-b border-slate-800 flex flex-col select-none">
            {/* Header / Title Bar */}
            <div className="h-10 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950">
                <div className="flex items-center gap-2">
                    <Link to="/stream" className="flex items-center gap-2 group hover:opacity-80 transition-opacity">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-purple-600 rounded flex items-center justify-center shadow-lg group-hover:shadow-blue-500/25 transition-all">
                            <Cpu className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="font-bold text-sm text-slate-200">BeamLab</span>
                        <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-bold rounded tracking-wide">ULTIMATE</span>
                    </Link>
                </div>

                {/* Center - Simple Tabs (Visual Only for now) */}
                <div className="flex items-center gap-1">
                    {['MODELING', 'PROPERTIES', 'LOADING', 'ANALYSIS', 'DESIGN'].map(tab => (
                        <div
                            key={tab}
                            className={`px-3 py-1 rounded text-[10px] font-bold tracking-wider cursor-default ${activeCategory === tab
                                ? 'bg-slate-800 text-blue-400 border border-slate-700'
                                : 'text-slate-600'
                                }`}
                        >
                            {tab}
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-[10px] text-slate-500 font-medium">Auto-Saved</div>
                </div>
            </div>

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
                    <div className="flex items-center justify-center h-full w-full text-slate-600 text-xs italic">
                        Tools for {activeCategory} mode coming soon
                    </div>
                )}
            </div>
        </div>
    );
};
