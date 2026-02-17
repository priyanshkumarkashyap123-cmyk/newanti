import { FC, useState, useEffect, useCallback } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useModelStore } from '../../store/model';
import {
    Mountain,
    Car,
    Waves,
    TreePine,
    HardHat,
    Ruler,
    ChevronRight,
    Calculator,
    ArrowRight,
    Droplets,
    Wind,
    Activity,
    Map as MapIcon
} from 'lucide-react';

import { geotechnical } from '../../services/civil';
import { transportation } from '../../services/civil';
import { hydraulics } from '../../services/civil';
import { environmental } from '../../services/civil';
import { construction } from '../../services/civil';
import { surveying } from '../../services/civil';
import { GenerativeDesignService } from '../../services/generative/GenerativeDesignService';
import { voiceInput } from '../../services/voice/VoiceInputService';
import { PINNPanel } from '../analysis/PINNPanel';
import { sequentialLearning } from '../../services/learning';

// ============================================
// TYPES
// ============================================

type CivilTool = 'geotech' | 'transport' | 'hydraulics' | 'enviro' | 'const' | 'survey' | 'pinn';

// ============================================
// SUB-PANELS
// ============================================

const GeotechPanel: FC = () => {
    const [result, setResult] = useState<any>(null);
    const { addNode, getNextNodeId, addPlate, getNextPlateId, addCivilResult } = useModelStore();
    const { showNotification } = useUIStore();

    const [width, setWidth] = useState(2.0);
    const [depth, setDepth] = useState(1.5);

    // ...

    const visualizeFooting = useCallback((w: number, pid: string) => {
        const half = w / 2;
        const y = 0;
        const n1 = { id: getNextNodeId(), x: -half, y, z: -half };
        const n2 = { id: getNextNodeId(), x: half, y, z: -half };
        const n3 = { id: getNextNodeId(), x: half, y, z: half };
        const n4 = { id: getNextNodeId(), x: -half, y, z: half };

        addNode(n1); addNode(n2); addNode(n3); addNode(n4);
        addPlate({
            id: pid,
            nodeIds: [n1.id, n2.id, n3.id, n4.id],
            thickness: 0.5,
            materialType: 'concrete'
        });
        showNotification('info', 'Footing visualized in 3D');
    }, [getNextNodeId, addNode, addPlate, showNotification]);

    const calculateBearing = useCallback(() => {
        const res = geotechnical.calculateBearingCapacity(
            { type: 'spread', width, length: width, depth, load: 1000 },
            { unitWeight: 18, cohesion: 20, frictionAngle: 30, saturatedWeight: 20, elasticModulus: 20000, poissonRatio: 0.3 }
        );
        setResult(res);
        showNotification('success', `Capacity Calculated: ${res.qall.toFixed(2)} kPa`);

        // Record Learning Interaction
        sequentialLearning.recordInteraction('current_user', {
            type: 'calculation',
            domain: 'geotechnical',
            topic: 'bearing_capacity',
            input: { width, depth },
            output: res,
            successful: true,
            duration: 5
        });

        // Persist to Model Store (Phase 2)
        const plateId = getNextPlateId();
        const now = Date.now();
        addCivilResult({
            id: `geo_${now}`,
            moduleId: 'geotech',
            type: 'bearing_capacity',
            timestamp: now,
            input: { width, depth },
            output: res,
            linkedElementIds: [plateId]
        });

        visualizeFooting(width, plateId);
    }, [width, depth, getNextPlateId, addCivilResult, showNotification, visualizeFooting]);

    return (
        <div className="space-y-4">
            <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-4">Foundation Analysis</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-xs text-zinc-400">Width (m)</label>
                        <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full bg-zinc-800 border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300" />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400">Depth (m)</label>
                        <input type="number" value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="w-full bg-zinc-800 border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300" />
                    </div>
                </div>
                <button onClick={calculateBearing} className="w-full bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/30 border border-yellow-600/50 py-2 rounded text-sm font-medium transition-colors">
                    Calculate & Visualize
                </button>
                {result && (
                    <div className="mt-4 p-3 bg-zinc-950 rounded border border-zinc-800 text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-zinc-400">Q_allow:</span><span className="text-green-400 font-mono">{result.qall.toFixed(2)} kPa</span></div>
                        <div className="flex justify-between"><span className="text-zinc-400">Safety Factor:</span><span className="text-blue-400 font-mono">{result.factorOfSafety}</span></div>
                    </div>
                )}
            </div>
        </div>
    );
};

const TransportPanel: FC = () => {
    const { addNode, addMember, getNextNodeId, getNextMemberId } = useModelStore();
    const { showNotification } = useUIStore();

    const generateCurve = () => {
        const design = transportation.designHorizontalCurve(100, 45);

        // Record Learning Interaction
        sequentialLearning.recordInteraction('current_user', {
            type: 'design',
            domain: 'transportation',
            topic: 'horizontal_curve',
            input: { speed: 100, angle: 45 },
            output: design,
            successful: true,
            duration: 10
        });

        const R = design.radius;
        const center = { x: 0, y: 0, z: 0 };

        let prevNodeId: string | null = null;
        for (let i = 0; i <= 10; i++) {
            const angle = (Math.PI / 4) * (i / 10);
            const x = center.x - R * Math.cos(angle);
            const z = center.z + R * Math.sin(angle);
            const nodeId = getNextNodeId();
            addNode({ id: nodeId, x, y: 0, z });
            if (prevNodeId) {
                addMember({
                    id: getNextMemberId(),
                    startNodeId: prevNodeId,
                    endNodeId: nodeId,
                    sectionType: 'RECTANGLE',
                    dimensions: { rectWidth: 10, rectHeight: 0.5 }
                });
            }
            prevNodeId = nodeId;
        }
        showNotification('success', `Curve Generated: R=${design.radius}m`);
    };

    return (
        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-4">Highway Design</h3>
            <button onClick={generateCurve} className="w-full bg-blue-600/20 text-blue-500 hover:bg-blue-600/30 border border-blue-600/50 py-2 rounded text-sm font-medium mb-2">
                Design & Draw Horizontal Curve
            </button>
        </div>
    );
};

const HydraulicsPanel: FC = () => {
    const [result, setResult] = useState<any>(null);
    const { addNode, addMember, getNextNodeId, getNextMemberId } = useModelStore();

    const calcChannel = () => {
        const res = hydraulics.calculateOpenChannelFlow(
            { type: 'trapezoidal', baseWidth: 3, sideSlope: 1.5, depth: 2 },
            { manningN: 0.015, bedSlope: 0.001 }
        );
        setResult(res);
        visualizeChannel();
    };

    const visualizeChannel = () => {
        // Draw 50m of channel
        const n1 = getNextNodeId(); const n2 = getNextNodeId();
        addNode({ id: n1, x: 0, y: 0, z: 0 });
        addNode({ id: n2, x: 0, y: -0.05, z: 50 }); // slope

        addMember({
            id: getNextMemberId(),
            startNodeId: n1,
            endNodeId: n2,
            sectionType: 'C-CHANNEL', // Keeping it simple for viz
            dimensions: { channelWidth: 3, channelHeight: 2, channelThickness: 0.2 }
        });
    };

    return (
        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-4">Channel Flow</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="text-xs text-zinc-400">Base (m)</label><input type="number" defaultValue="3" className="w-full bg-zinc-800 border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300" /></div>
                <div><label className="text-xs text-zinc-400">Depth (m)</label><input type="number" defaultValue="2" className="w-full bg-zinc-800 border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300" /></div>
            </div>
            <button onClick={calcChannel} className="w-full bg-cyan-600/20 text-cyan-500 hover:bg-cyan-600/30 border border-cyan-600/50 py-2 rounded text-sm font-medium">
                Calculate & Draw Channel
            </button>
            {result && (
                <div className="mt-4 p-3 bg-zinc-950 rounded border border-zinc-800 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-zinc-400">Discharge:</span><span className="text-cyan-400 font-mono">{result.discharge.toFixed(2)} m³/s</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Velocity:</span><span className="text-cyan-400 font-mono">{result.velocity.toFixed(2)} m/s</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Regime:</span><span className="text-yellow-400 font-mono">{result.flowRegime}</span></div>
                </div>
            )}
        </div>
    );
};

const EnvironmentalPanel: FC = () => {
    const [result, setResult] = useState<any>(null);

    const designWTP = () => {
        const res = environmental.designWTP(15, { pH: 7.5, turbidity: 45, TSS: 30, TDS: 400, BOD: 5, COD: 10, ammonia: 0.5, nitrate: 1, phosphate: 0.1, coliform: 500 });
        setResult(res);
    };

    return (
        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-4">WTP Design</h3>
            <div className="mb-4"><label className="text-xs text-zinc-400">Capacity (MLD)</label><input type="number" defaultValue="15" className="w-full bg-zinc-800 border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300" /></div>
            <button onClick={designWTP} className="w-full bg-green-600/20 text-green-500 hover:bg-green-600/30 border border-green-600/50 py-2 rounded text-sm font-medium">
                Design Treatment Plant
            </button>
            {result && (
                <div className="mt-4 p-3 bg-zinc-950 rounded border border-zinc-800 text-xs space-y-2">
                    <div className="font-bold text-zinc-400">Treatment Units Required:</div>
                    <ul className="list-disc pl-4 text-zinc-400 space-y-1">
                        {result.units.map((u: any, i: number) => (
                            <li key={i}>{u.name} ({u.type})</li>
                        ))}
                    </ul>
                    <div className="pt-2 border-t border-zinc-800 flex justify-between">
                        <span className="text-zinc-400">Sludge Gen:</span>
                        <span className="text-red-400">{result.sludgeProduction.toFixed(1)} kg/d</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const ConstructionPanel: FC = () => {
    const [result, setResult] = useState<any>(null);

    const runCPM = () => {
        const acts = [
            { id: 'Excavation', name: 'Excavation', duration: 5, predecessors: [] },
            { id: 'Foundation', name: 'Foundation', duration: 7, predecessors: ['Excavation'] },
            { id: 'Columns', name: 'Columns', duration: 10, predecessors: ['Foundation'] },
            { id: 'Roof', name: 'Roof', duration: 5, predecessors: ['Columns'] },
        ];
        const res = construction.calculateCPM(acts);
        setResult(res);
    };

    return (
        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-4">Project Scheduling (CPM)</h3>
            <button onClick={runCPM} className="w-full bg-orange-600/20 text-orange-500 hover:bg-orange-600/30 border border-orange-600/50 py-2 rounded text-sm font-medium">
                Calculate Critical Path
            </button>
            {result && (
                <div className="mt-4 p-3 bg-zinc-950 rounded border border-zinc-800 text-xs space-y-2">
                    <div className="flex justify-between font-bold"><span className="text-zinc-400">Total Duration:</span><span className="text-orange-400">{result.projectDuration} days</span></div>
                    <div>
                        <div className="text-zinc-400 mb-1">Critical Path:</div>
                        <div className="flex flex-wrap gap-1">
                            {result.criticalPath.map((id: string) => (
                                <span key={id} className="px-1.5 py-0.5 bg-red-900/40 text-red-400 rounded border border-red-900/60">{id}</span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SurveyPanel: FC = () => {
    const { addNode, getNextNodeId, addMember, getNextMemberId } = useModelStore();
    const { showNotification } = useUIStore();

    const plotTraverse = () => {
        // Simple square traverse
        const start = { x: 0, y: 0, z: 0 };
        const stations = [
            { id: 'A', bearing: 0, distance: 10 },
            { id: 'B', bearing: 90, distance: 10 },
            { id: 'C', bearing: 180, distance: 10 },
            { id: 'D', bearing: 270, distance: 10 }
        ];

        const points = surveying.calculateTraverse(start, stations);

        // Plot in 3D
        let prevNodeId: string | null = null;
        const firstNodeId: string | null = null;
        const ids: string[] = [];

        points.forEach((pt, idx) => {
            const id = getNextNodeId();
            addNode({ id, x: pt.coordinates?.x || 0, y: 0, z: pt.coordinates?.y || 0 }); // Plotting Y as Z for plan view in 3D
            ids.push(id);

            if (prevNodeId) {
                addMember({ id: getNextMemberId(), startNodeId: prevNodeId, endNodeId: id });
            }
            prevNodeId = id;
        });

        // Close loop
        if (prevNodeId && ids.length > 0) {
            addMember({ id: getNextMemberId(), startNodeId: prevNodeId, endNodeId: ids[0] });
        }

        showNotification('success', 'Traverse Plotted');
    };

    return (
        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-4">Surveying</h3>
            <button onClick={plotTraverse} className="w-full bg-purple-600/20 text-purple-500 hover:bg-purple-600/30 border border-purple-600/50 py-2 rounded text-sm font-medium">
                Plot Closed Traverse
            </button>
        </div>
    );
};

// ============================================
// MAIN CIVIL PANEL
// ============================================

export const CivilPanel: FC = () => {
    const { activeTool, showNotification } = useUIStore();
    const { addNode, addMember } = useModelStore();

    // Mapping tool ID to panel type
    const getActivePanel = () => {
        if (!activeTool) return <GeotechPanel />;

        if (activeTool.startsWith('geotech') || activeTool.includes('GEO') || activeTool.includes('FOUNDATION')) return <GeotechPanel />;
        if (activeTool.startsWith('transport') || activeTool.includes('TRANS')) return <TransportPanel />;
        if (activeTool.startsWith('hydraulics') || activeTool.includes('HYDRAULICS') || activeTool.includes('CULVERT')) return <HydraulicsPanel />;
        if (activeTool.startsWith('enviro') || activeTool.includes('ENV')) return <EnvironmentalPanel />;
        if (activeTool.startsWith('const') || activeTool.includes('CONST') || activeTool.includes('COST')) return <ConstructionPanel />;
        if (activeTool.startsWith('survey') || activeTool.includes('SURVEY')) return <SurveyPanel />;

        return <GeotechPanel />; // Default
    };

    // Voice Command Listener (Phase 2)
    useEffect(() => {
        const unsubscribe = voiceInput.onCommand((cmd) => {
            if (!cmd.intent || !cmd.processed) return;

            // Handle Generative Design
            if (cmd.intent.parameters.module === 'generative') {
                const { width, length } = cmd.intent.parameters;
                showNotification('info', `Generating ${width}x${length}m Warehouse...`);

                const structure = GenerativeDesignService.generatePortalFrame({
                    width,
                    length,
                    eaveHeight: 6,
                    apexHeight: 8,
                    baySpacing: 6
                });

                // Add to store
                // We need to batch add these. For now, simple loop or bulk add if available
                // Assuming useModelStore has bulk add or we just loop
                structure.nodes.forEach(n => addNode(n));
                structure.members.forEach(m => addMember(m)); // Note: addMember from hook needs to be exposed from store actions in bulk? 
                // Currently addMember is one by one in store logic shown earlier.
                // It's fine for < 1000 members.

                showNotification('success', structure.description);

                // Learn from this
                sequentialLearning.recordInteraction('current_user', {
                    type: 'analysis',
                    domain: 'structural',
                    topic: 'portal_frame',
                    input: { width, length },
                    output: 'success',
                    successful: true,
                    duration: 2
                });
            }
        });
        return unsubscribe;
    }, []);

    return (
        <div className="h-full flex flex-col bg-zinc-950">
            {/* Context Header */}
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
                <div className="p-2 bg-yellow-600/20 rounded-lg text-yellow-500 border border-yellow-600/30">
                    <HardHat className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-white">Civil Engineering</h2>
                    <p className="text-xs text-zinc-400">Multi-disciplinary analysis & design</p>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Active Tool Panel */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <ChevronRight className="w-3 h-3" />
                        Active Module
                    </h3>
                    {getActivePanel()}
                </div>

                {/* Quick Shortcuts */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Quick Tools</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button className="flex flex-col items-center justify-center p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-zinc-700 transition-all group">
                            <Calculator className="w-5 h-5 text-zinc-400 group-hover:text-green-400 mb-2" />
                            <span className="text-xs text-zinc-400 group-hover:text-white">Unit Converter</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-zinc-700 transition-all group">
                            <Droplets className="w-5 h-5 text-zinc-400 group-hover:text-blue-400 mb-2" />
                            <span className="text-xs text-zinc-400 group-hover:text-white">Manning's Calc</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-zinc-700 transition-all group">
                            <Wind className="w-5 h-5 text-zinc-400 group-hover:text-cyan-400 mb-2" />
                            <span className="text-xs text-zinc-400 group-hover:text-white">Wind Rose</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-zinc-700 transition-all group">
                            <ArrowRight className="w-5 h-5 text-zinc-400 group-hover:text-purple-400 mb-2" />
                            <span className="text-xs text-zinc-400 group-hover:text-white">Traffic LOS</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CivilPanel;
