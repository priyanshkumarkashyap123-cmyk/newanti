/**
 * SmartSidebar.tsx - Dynamic Sidebar Based on Active Category
 * 
 * Renders different tool panels based on uiStore.activeCategory:
 * - MODELING: Template Bank, Draw Tools
 * - PROPERTIES: Section Picker
 * - LOADING: Load Generators, Manual Loads
 * - ANALYSIS: Solver Controls, Result Toggles
 * - DESIGN: Design Check panels
 */

import { FC, useState, useCallback } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Box,
    Triangle,
    Building2,
    Plus,
    Trash2,
    MousePointer,
    Wind,
    Zap,
    Download,
    Play,
    CheckSquare,
    Square,
    Settings,
    Loader2,
    ArrowRight
} from 'lucide-react';
import { useUIStore, Category } from '../../store/uiStore';
import { useModelStore } from '../../store/model';

// ============================================
// TYPES
// ============================================

interface AccordionItemProps {
    title: string;
    icon?: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

// ============================================
// ACCORDION COMPONENT
// ============================================

const AccordionItem: FC<AccordionItemProps> = ({
    title,
    icon,
    defaultOpen = true,
    children
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-zinc-800">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            >
                {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                )}
                {icon && <span className="text-zinc-400">{icon}</span>}
                {title}
            </button>
            {isOpen && (
                <div className="px-3 pb-3">
                    {children}
                </div>
            )}
        </div>
    );
};

// ============================================
// MODELING PANELS
// ============================================

const TemplateBankPanel: FC = () => {
    const [loading, setLoading] = useState<string | null>(null);
    const clearModel = useModelStore((state) => state.clearModel);
    const addNode = useModelStore((state) => state.addNode);
    const addMember = useModelStore((state) => state.addMember);

    const templates = [
        { id: 'beam', label: 'Beam (SS)', endpoint: '/template/beam?span=6' },
        { id: 'truss', label: 'Truss (Pratt)', endpoint: '/template/truss?span=12&height=3&bays=6' },
        { id: 'frame', label: 'Frame (Warehouse)', endpoint: '/template/portal?width=15&height=6' },
        { id: '3d-frame', label: '3D Building', endpoint: '/template/frame?width=12&length=12&height=3.5&stories=3' },
    ];

    const handleTemplateClick = useCallback(async (template: typeof templates[0]) => {
        setLoading(template.id);
        try {
            const response = await fetch(`http://localhost:8080${template.endpoint}`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success && data.model) {
                clearModel();

                // Add nodes
                for (const node of data.model.nodes) {
                    addNode({
                        id: node.id,
                        x: node.x,
                        y: node.y,
                        z: node.z
                    });
                }

                // Add members
                for (const member of data.model.members) {
                    addMember({
                        id: member.id,
                        startNodeId: member.start_node,
                        endNodeId: member.end_node,
                        sectionId: member.section_profile || 'ISMB300'
                    });
                }
            }
        } catch (error) {
            console.error('Template fetch error:', error);
        } finally {
            setLoading(null);
        }
    }, [clearModel, addNode, addMember]);

    return (
        <div className="space-y-1.5">
            {templates.map((template) => (
                <button
                    key={template.id}
                    onClick={() => handleTemplateClick(template)}
                    disabled={loading !== null}
                    className={`
                        w-full flex items-center justify-between gap-2 px-3 py-2
                        text-sm text-left rounded-lg transition-all
                        ${loading === template.id
                            ? 'bg-blue-600/20 text-blue-400'
                            : 'text-zinc-300 bg-zinc-800/50 hover:bg-zinc-700/50'
                        }
                    `}
                >
                    <span className="flex items-center gap-2">
                        {template.id === 'beam' && <Box className="w-4 h-4" />}
                        {template.id === 'truss' && <Triangle className="w-4 h-4" />}
                        {template.id === 'frame' && <Building2 className="w-4 h-4" />}
                        {template.id === '3d-frame' && <Building2 className="w-4 h-4" />}
                        {template.label}
                    </span>
                    {loading === template.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <ArrowRight className="w-4 h-4 text-zinc-500" />
                    )}
                </button>
            ))}
        </div>
    );
};

const DrawToolsPanel: FC = () => {
    const { activeTool, setActiveTool } = useUIStore();

    const tools = [
        { id: 'SELECT', label: 'Select', icon: <MousePointer className="w-4 h-4" /> },
        { id: 'DRAW_NODE', label: 'Add Node', icon: <Plus className="w-4 h-4" /> },
        { id: 'DRAW_BEAM', label: 'Add Beam', icon: <Box className="w-4 h-4" /> },
        { id: 'DELETE', label: 'Delete', icon: <Trash2 className="w-4 h-4" /> },
    ];

    return (
        <div className="grid grid-cols-2 gap-1.5">
            {tools.map((tool) => (
                <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    className={`
                        flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all
                        ${activeTool === tool.id
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                            : 'text-zinc-300 bg-zinc-800/50 hover:bg-zinc-700/50'
                        }
                    `}
                >
                    {tool.icon}
                    {tool.label}
                </button>
            ))}
        </div>
    );
};

// ============================================
// PROPERTIES PANEL
// ============================================

const SectionPickerPanel: FC = () => {
    const [selectedCode, setSelectedCode] = useState('IS808');
    const [selectedSection, setSelectedSection] = useState('ISMB300');

    const codes = [
        { id: 'IS808', label: 'IS 808 (Indian)' },
        { id: 'AISC', label: 'AISC (American)' },
        { id: 'EN', label: 'EN 10034 (European)' },
    ];

    const sections: Record<string, string[]> = {
        IS808: ['ISMB 150', 'ISMB 200', 'ISMB 250', 'ISMB 300', 'ISMB 350', 'ISMB 400'],
        AISC: ['W10x12', 'W12x26', 'W14x30', 'W16x40', 'W18x50', 'W21x62'],
        EN: ['IPE 200', 'IPE 240', 'IPE 270', 'IPE 300', 'IPE 330', 'IPE 360'],
    };

    return (
        <div className="space-y-3">
            {/* Code Selector */}
            <div>
                <label className="block text-xs text-zinc-500 mb-1">Design Code</label>
                <select
                    value={selectedCode}
                    onChange={(e) => setSelectedCode(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
                >
                    {codes.map((code) => (
                        <option key={code.id} value={code.id}>{code.label}</option>
                    ))}
                </select>
            </div>

            {/* Section List */}
            <div>
                <label className="block text-xs text-zinc-500 mb-1">Section Profile</label>
                <div className="max-h-40 overflow-y-auto space-y-1 bg-zinc-800/50 rounded-lg p-2">
                    {sections[selectedCode]?.map((section) => (
                        <button
                            key={section}
                            onClick={() => setSelectedSection(section)}
                            className={`
                                w-full text-left px-2 py-1.5 text-sm rounded transition-colors
                                ${selectedSection === section
                                    ? 'bg-blue-600/20 text-blue-400'
                                    : 'text-zinc-300 hover:bg-zinc-700/50'
                                }
                            `}
                        >
                            {section}
                        </button>
                    ))}
                </div>
            </div>

            {/* Assign Button */}
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                Assign to Selected
            </button>
        </div>
    );
};

// ============================================
// LOADING PANELS
// ============================================

const LoadGeneratorsPanel: FC = () => {
    const [windSpeed, setWindSpeed] = useState('39');
    const [terrainCategory, setTerrainCategory] = useState('2');
    const [deadLoadEnabled, setDeadLoadEnabled] = useState(true);

    return (
        <div className="space-y-4">
            {/* Wind Load Generator */}
            <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                    <Wind className="w-4 h-4 text-cyan-400" />
                    Wind Load (IS 875)
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs text-zinc-500">Wind Speed (m/s)</label>
                        <input
                            type="number"
                            value={windSpeed}
                            onChange={(e) => setWindSpeed(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-500">Terrain</label>
                        <select
                            value={terrainCategory}
                            onChange={(e) => setTerrainCategory(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200"
                        >
                            <option value="1">Category 1</option>
                            <option value="2">Category 2</option>
                            <option value="3">Category 3</option>
                            <option value="4">Category 4</option>
                        </select>
                    </div>
                </div>
                <button className="w-full bg-cyan-600/20 text-cyan-400 text-sm py-1.5 rounded hover:bg-cyan-600/30 transition-colors">
                    Generate Wind Loads
                </button>
            </div>

            {/* Dead Load Toggle */}
            <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-orange-400" />
                    <span className="text-sm text-zinc-300">Dead Load (Self Weight)</span>
                </div>
                <button
                    onClick={() => setDeadLoadEnabled(!deadLoadEnabled)}
                    className={`w-10 h-5 rounded-full transition-colors ${deadLoadEnabled ? 'bg-green-600' : 'bg-zinc-700'}`}
                >
                    <span className={`block w-4 h-4 bg-white rounded-full transform transition-transform ${deadLoadEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
            </div>
        </div>
    );
};

const ManualLoadsPanel: FC = () => {
    const [fx, setFx] = useState('0');
    const [fy, setFy] = useState('-10');
    const [fz, setFz] = useState('0');
    const [moment, setMoment] = useState('0');

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className="block text-xs text-zinc-500">Fx (kN)</label>
                    <input
                        type="number"
                        value={fx}
                        onChange={(e) => setFx(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500">Fy (kN)</label>
                    <input
                        type="number"
                        value={fy}
                        onChange={(e) => setFy(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500">Fz (kN)</label>
                    <input
                        type="number"
                        value={fz}
                        onChange={(e) => setFz(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200"
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs text-zinc-500">Moment (kN·m)</label>
                <input
                    type="number"
                    value={moment}
                    onChange={(e) => setMoment(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200"
                />
            </div>
            <button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                Apply to Selected Node
            </button>
        </div>
    );
};

// ============================================
// ANALYSIS PANELS
// ============================================

const SolverControlsPanel: FC = () => {
    const [isRunning, setIsRunning] = useState(false);
    const setAnalysisResults = useUIStore((state) => state.setAnalysisResults);

    const handleRunSolver = async () => {
        setIsRunning(true);

        // Simulate analysis
        await new Promise(resolve => setTimeout(resolve, 2000));

        setAnalysisResults({
            completed: true,
            timestamp: Date.now()
        });

        setIsRunning(false);
    };

    return (
        <div className="space-y-3">
            <button
                onClick={handleRunSolver}
                disabled={isRunning}
                className={`
                    w-full flex items-center justify-center gap-2 py-4 text-lg font-bold rounded-lg transition-all
                    ${isRunning
                        ? 'bg-green-600/50 text-green-300 cursor-wait'
                        : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/30'
                    }
                `}
            >
                {isRunning ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Running Analysis...
                    </>
                ) : (
                    <>
                        <Play className="w-5 h-5" />
                        RUN SOLVER
                    </>
                )}
            </button>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-zinc-800/50 rounded p-2">
                    <span className="text-zinc-500">Solver:</span>
                    <span className="text-zinc-300 ml-1">Linear Static</span>
                </div>
                <div className="bg-zinc-800/50 rounded p-2">
                    <span className="text-zinc-500">DOF:</span>
                    <span className="text-zinc-300 ml-1">6 per node</span>
                </div>
            </div>
        </div>
    );
};

const ResultTogglesPanel: FC = () => {
    const [showDeflection, setShowDeflection] = useState(true);
    const [showBendingMoment, setShowBendingMoment] = useState(false);
    const [showShearForce, setShowShearForce] = useState(false);

    const toggles = [
        { id: 'deflection', label: 'Deflection', checked: showDeflection, toggle: setShowDeflection, color: 'blue' },
        { id: 'bending', label: 'Bending Moment', checked: showBendingMoment, toggle: setShowBendingMoment, color: 'green' },
        { id: 'shear', label: 'Shear Force', checked: showShearForce, toggle: setShowShearForce, color: 'orange' },
    ];

    return (
        <div className="space-y-2">
            {toggles.map((toggle) => (
                <button
                    key={toggle.id}
                    onClick={() => toggle.toggle(!toggle.checked)}
                    className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                        ${toggle.checked
                            ? `bg-${toggle.color}-600/20 text-${toggle.color}-400 border border-${toggle.color}-500/30`
                            : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50'
                        }
                    `}
                >
                    {toggle.checked ? (
                        <CheckSquare className="w-4 h-4" />
                    ) : (
                        <Square className="w-4 h-4" />
                    )}
                    {toggle.label}
                </button>
            ))}
        </div>
    );
};

// ============================================
// DESIGN PANEL
// ============================================

const DesignChecksPanel: FC = () => {
    return (
        <div className="space-y-3">
            <button className="w-full flex items-center justify-between px-3 py-3 bg-zinc-800/50 rounded-lg text-zinc-300 hover:bg-zinc-700/50 transition-colors">
                <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-blue-400" />
                    Steel Code Check (IS 800)
                </span>
                <ArrowRight className="w-4 h-4 text-zinc-500" />
            </button>
            <button className="w-full flex items-center justify-between px-3 py-3 bg-zinc-800/50 rounded-lg text-zinc-300 hover:bg-zinc-700/50 transition-colors">
                <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-orange-400" />
                    Concrete Rebar Calc
                </span>
                <ArrowRight className="w-4 h-4 text-zinc-500" />
            </button>
            <button className="w-full flex items-center justify-between px-3 py-3 bg-zinc-800/50 rounded-lg text-zinc-300 hover:bg-zinc-700/50 transition-colors">
                <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-green-400" />
                    Generate Report
                </span>
                <ArrowRight className="w-4 h-4 text-zinc-500" />
            </button>
        </div>
    );
};

// ============================================
// MAIN SMART SIDEBAR COMPONENT
// ============================================

export const SmartSidebar: FC = () => {
    const { activeCategory, sidebarMode } = useUIStore();

    if (sidebarMode === 'COLLAPSED') {
        return null;
    }

    return (
        <div className="h-full w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-3 py-3 border-b border-zinc-800">
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    {activeCategory} TOOLS
                </h2>
            </div>

            {/* Dynamic Content */}
            <div className="flex-1 overflow-y-auto">
                {/* MODELING */}
                {activeCategory === 'MODELING' && (
                    <>
                        <AccordionItem title="Template Bank" icon={<Box className="w-4 h-4" />}>
                            <TemplateBankPanel />
                        </AccordionItem>
                        <AccordionItem title="Draw Tools" icon={<Plus className="w-4 h-4" />}>
                            <DrawToolsPanel />
                        </AccordionItem>
                    </>
                )}

                {/* PROPERTIES */}
                {activeCategory === 'PROPERTIES' && (
                    <>
                        <AccordionItem title="Section Picker" icon={<Settings className="w-4 h-4" />}>
                            <SectionPickerPanel />
                        </AccordionItem>
                    </>
                )}

                {/* LOADING */}
                {activeCategory === 'LOADING' && (
                    <>
                        <AccordionItem title="Load Generators" icon={<Wind className="w-4 h-4" />}>
                            <LoadGeneratorsPanel />
                        </AccordionItem>
                        <AccordionItem title="Manual Loads" icon={<Download className="w-4 h-4" />}>
                            <ManualLoadsPanel />
                        </AccordionItem>
                    </>
                )}

                {/* ANALYSIS */}
                {activeCategory === 'ANALYSIS' && (
                    <>
                        <AccordionItem title="Solver Controls" icon={<Play className="w-4 h-4" />} defaultOpen>
                            <SolverControlsPanel />
                        </AccordionItem>
                        <AccordionItem title="Result Toggles" icon={<CheckSquare className="w-4 h-4" />}>
                            <ResultTogglesPanel />
                        </AccordionItem>
                    </>
                )}

                {/* DESIGN */}
                {activeCategory === 'DESIGN' && (
                    <>
                        <AccordionItem title="Design Checks" icon={<Settings className="w-4 h-4" />}>
                            <DesignChecksPanel />
                        </AccordionItem>
                    </>
                )}
            </div>
        </div>
    );
};

export default SmartSidebar;
