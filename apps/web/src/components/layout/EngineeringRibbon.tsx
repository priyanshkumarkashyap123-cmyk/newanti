import { FC, memo, ReactNode } from 'react';
import {
    MousePointer2,
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
    Database,
    Crown,
    Activity,
    Cpu,
    Anchor,
    Weight,
    Ruler,
    Building2,
    Columns,
    Link2,
    Landmark,
    CheckSquare,
    FileCheck,
    Layers,
    SquareStack,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useModelStore } from '../../store/model';
import { useUIStore, Category } from '../../store/uiStore';
import { Tooltip } from '../ui/Tooltip';

/* ─── Stable sub-components (extracted to avoid re-mounting every render) ─── */

interface ToolButtonProps {
    icon: FC<{ className?: string }>;
    label: string;
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    vertical?: boolean;
    className?: string;
    tooltip?: string;
    shortcut?: string;
}

const ToolButton = memo<ToolButtonProps>(({
    icon: Icon, label, onClick,
    isActive = false, disabled = false, vertical = true,
    className = '', tooltip, shortcut
}) => (
    <Tooltip content={tooltip || label} shortcut={shortcut}>
        <button
            onClick={onClick}
            disabled={disabled}
            aria-pressed={isActive}
            className={`
                flex flex-col items-center justify-center gap-1 px-2 py-1 rounded
                border border-transparent hover:bg-slate-700/60 transition-colors
                ${isActive ? 'bg-blue-900/40 border-blue-700/50 text-blue-200' : 'text-slate-400'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${vertical ? 'h-[52px] w-[52px] min-w-[52px]' : 'flex-row h-8 px-3 w-auto gap-2'}
                ${className}
            `}
        >
            <Icon className={`${vertical ? 'w-4.5 h-4.5' : 'w-4 h-4'} flex-shrink-0`} />
            <span className="text-[9px] whitespace-nowrap text-center leading-tight max-w-[48px] truncate">
                {label}
            </span>
        </button>
    </Tooltip>
));
ToolButton.displayName = 'ToolButton';

const ToolGroup = memo<{ label: string; children: ReactNode }>(({ label, children }) => (
    <div className="flex flex-col h-full border-r border-slate-700/50 px-2 pb-3 pt-1">
        <div className="flex-1 flex items-center gap-0.5">
            {children}
        </div>
        <div className="text-[8px] text-slate-500 text-center uppercase tracking-wider mt-0.5 select-none">
            {label}
        </div>
    </div>
));
ToolGroup.displayName = 'ToolGroup';

/* ─── Ribbon categories (tabs) ─── */

const RIBBON_TABS: Category[] = ['MODELING', 'PROPERTIES', 'LOADING', 'ANALYSIS', 'DESIGN'];

/* ─── Main ribbon component ─── */

interface RibbonProps {
    activeCategory: Category;
}

export const EngineeringRibbon: FC<RibbonProps> = memo(({ activeCategory }) => {
    const activeTool = useModelStore((s) => s.activeTool);
    const setTool = useModelStore((s) => s.setTool);
    const isAnalyzing = useModelStore((s) => s.isAnalyzing);
    const openModal = useUIStore((s) => s.openModal);
    const setCategory = useUIStore((s) => s.setCategory);
    const { undo, redo } = useModelStore.temporal.getState();

    const renderGeometryTab = () => (
        <>
            <ToolGroup label="Project">
                <ToolButton icon={Save} label="Save" onClick={() => document.dispatchEvent(new CustomEvent('trigger-save'))} shortcut="Cmd+S" />
                <ToolButton icon={FolderOpen} label="Open" onClick={() => document.dispatchEvent(new CustomEvent('trigger-cloud-open'))} shortcut="Cmd+O" />
                <div className="flex flex-col gap-0.5">
                    <Tooltip content="Undo" shortcut="Cmd+Z">
                        <button onClick={() => undo()} className="p-1 hover:bg-slate-700/60 rounded text-slate-400" aria-label="Undo"><Undo className="w-3 h-3" aria-hidden="true" /></button>
                    </Tooltip>
                    <Tooltip content="Redo" shortcut="Cmd+Shift+Z">
                        <button onClick={() => redo()} className="p-1 hover:bg-slate-700/60 rounded text-slate-400" aria-label="Redo"><Redo className="w-3 h-3" aria-hidden="true" /></button>
                    </Tooltip>
                </div>
                <ToolButton icon={Crown} label="Upgrade" onClick={() => document.dispatchEvent(new CustomEvent('trigger-upgrade'))} className="text-amber-400 hover:text-amber-300" />
            </ToolGroup>
            <ToolGroup label="Structure">
                <ToolButton icon={Grid} label="Wizard" onClick={() => openModal('structureWizard')} tooltip="Structure Wizard" shortcut="Cmd+Shift+W" />
                <ToolButton icon={Database} label="Gallery" onClick={() => openModal('structureGallery')} tooltip="Load Famous Structures" />
            </ToolGroup>
            <ToolGroup label="Create">
                <ToolButton icon={Box} label="Node" onClick={() => setTool('node')} isActive={activeTool === 'node'} tooltip="Create Node" shortcut="N" />
                <ToolButton icon={Spline} label="Beam" onClick={() => setTool('member')} isActive={activeTool === 'member'} tooltip="Create Member" shortcut="M" />
                <ToolButton icon={Grid} label="Plate" onClick={() => openModal('plateDialog')} tooltip="Create Plate/Shell Element" shortcut="P" />
                <ToolButton icon={Layers} label="Slab" onClick={() => openModal('floorSlabDialog')} tooltip="Add Floor Slab — auto-detect panels & assign area load" />
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
        <ToolGroup label="Specification">
            <ToolButton icon={Settings} label="Section" onClick={() => openModal('geometryTools')} />
            <ToolButton icon={Database} label="Material" onClick={() => {}} />
            <ToolButton icon={Table2} label="Beta Angle" onClick={() => {}} />
        </ToolGroup>
    );

    const renderLoadingTab = () => (
        <>
            <ToolGroup label="Definitions">
                <ToolButton icon={Download} label="Load Cases" onClick={() => openModal('is875Load')} />
                <ToolButton icon={Settings} label="Combos" onClick={() => openModal('loadDialog')} />
            </ToolGroup>
            <ToolGroup label="Apply">
                <ToolButton icon={Download} label="Nodal" onClick={() => setTool('load')} isActive={activeTool === 'load'} />
                <ToolButton icon={Spline} label="Member" onClick={() => setTool('memberLoad')} isActive={activeTool === 'memberLoad'} />
                <ToolButton icon={SquareStack} label="Area Load" onClick={() => openModal('loadDialog')} tooltip="Floor / Roof / Area Load" />
            </ToolGroup>
            <ToolGroup label="Generate">
                <ToolButton icon={Weight} label="Dead Load" onClick={() => openModal('deadLoadGenerator')} tooltip="Dead Load Generator" />
            </ToolGroup>
        </>
    );

    const renderAnalysisTab = () => (
        <>
            <ToolGroup label="Simulation">
                <ToolButton icon={Play} label="Run" onClick={() => document.dispatchEvent(new CustomEvent('trigger-analysis'))} isActive={isAnalyzing} />
                <ToolButton icon={Activity} label="Modal" onClick={() => document.dispatchEvent(new CustomEvent('trigger-modal-analysis'))} />
            </ToolGroup>
            <ToolGroup label="Results">
                <ToolButton icon={FileText} label="Output" onClick={() => {}} />
                <ToolButton icon={Download} label="Export" onClick={() => document.dispatchEvent(new CustomEvent('trigger-export'))} />
            </ToolGroup>
        </>
    );

    return (
        <div className="w-full bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/60 flex flex-col select-none" role="toolbar" aria-label="Engineering Ribbon">
            {/* Title Bar */}
            <div className="h-9 flex items-center justify-between px-3 border-b border-slate-700/40 bg-slate-950/80">
                <Link to="/stream" className="flex items-center gap-2 group hover:opacity-80 transition-opacity">
                    <div className="w-5 h-5 bg-gradient-to-br from-blue-600 to-purple-600 rounded flex items-center justify-center">
                        <Cpu className="w-3 h-3 text-white" />
                    </div>
                    <span className="font-semibold text-xs text-slate-200">BeamLab</span>
                    <span className="px-1 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[8px] font-bold rounded tracking-wide">PRO</span>
                </Link>

                {/* Category Tabs */}
                <div className="flex items-center gap-0.5" role="tablist" aria-label="Ribbon categories">
                    {RIBBON_TABS.map(tab => (
                        <button
                            key={tab}
                            role="tab"
                            aria-selected={activeCategory === tab}
                            onClick={() => setCategory(tab)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider transition-colors ${
                                activeCategory === tab
                                    ? 'bg-slate-800 text-blue-400 border border-slate-600'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="text-[9px] text-slate-500 font-medium">Auto-Saved</div>
            </div>

            {/* Tools Area */}
            <div className="h-[72px] flex items-center px-1.5 py-0.5 gap-0.5 overflow-x-auto" role="group" aria-label={`${activeCategory} tools`}>
                {activeCategory === 'MODELING' && renderGeometryTab()}
                {activeCategory === 'PROPERTIES' && renderPropertiesTab()}
                {activeCategory === 'LOADING' && renderLoadingTab()}
                {activeCategory === 'ANALYSIS' && renderAnalysisTab()}
                {activeCategory === 'DESIGN' && (
                    <>
                        <ToolGroup label="Code Check">
                            <ToolButton icon={FileCheck} label="Design Codes" onClick={() => openModal('designCodes')} tooltip="Open Design Code Compliance Dialog" />
                            <ToolButton icon={CheckSquare} label="D/C Ratios" onClick={() => document.dispatchEvent(new CustomEvent('trigger-analysis'))} tooltip="Run Analysis & View D/C Ratios" />
                        </ToolGroup>
                        <ToolGroup label="Steel">
                            <ToolButton icon={Building2} label="IS 800" onClick={() => openModal('designCodes')} tooltip="Steel Design — IS 800:2007" />
                            <ToolButton icon={Ruler} label="AISC 360" onClick={() => openModal('designCodes')} tooltip="Steel Design — AISC 360-16" />
                        </ToolGroup>
                        <ToolGroup label="Concrete">
                            <ToolButton icon={Columns} label="IS 456" onClick={() => openModal('designCodes')} tooltip="RC Design — IS 456:2000" />
                        </ToolGroup>
                        <ToolGroup label="Connection">
                            <ToolButton icon={Link2} label="Connections" onClick={() => openModal('connectionDesign')} tooltip="Connection Design — Bolted/Welded" />
                        </ToolGroup>
                        <ToolGroup label="Foundation">
                            <ToolButton icon={Landmark} label="Foundation" onClick={() => openModal('foundationDesign')} tooltip="Foundation Design — IS 456 / IS 1904" />
                        </ToolGroup>
                    </>
                )}
                {activeCategory === 'CIVIL' && (
                    <div className="flex items-center justify-center h-full w-full text-slate-500 text-xs">
                        CIVIL tools coming soon
                    </div>
                )}
            </div>
        </div>
    );
});
EngineeringRibbon.displayName = 'EngineeringRibbon';
