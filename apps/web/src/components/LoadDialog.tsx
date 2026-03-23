/**
 * LoadDialog.tsx - Comprehensive Loading Input Dialog
 * 
 * Features:
 * - Nodal Loads (Forces & Moments)
 * - Member Loads (UDL, Trapezoidal, Point, Moment)
 * - Floor/Area Loads with auto-distribution
 * - Temperature Loads
 * - Prestress Loads
 * - Load Case Management
 * - Load Combinations (IS 456 / ASCE 7)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
    Plus, Trash2, ChevronRight, ChevronDown,
    ArrowDown, ArrowRight, ArrowUp, RotateCcw,
    Thermometer, Cable, Layers, Grid3X3,
    Target, Zap, Wind, Activity, Box
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useModelStore } from '../store/model';
import {
    LoadCase, LoadCaseType, LoadDirection,
    NodalLoad, UniformLoad, TrapezoidalLoad,
    PointLoadOnMember, MomentOnMember, FloorLoad,
    TemperatureLoad, PrestressLoad, MemberLoad,
    LoadCombination, DEFAULT_COMBINATIONS,
    createDefaultLoadCase, generateLoadId
} from '../types/loads';


// ============================================
// PROPS & TYPES
// ============================================

interface LoadDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

type LoadTab = 'nodal' | 'member' | 'floor' | 'temperature' | 'prestress' | 'combinations';

interface TabConfig {
    id: LoadTab;
    label: string;
    icon: React.ReactNode;
    color: string;
}


// ============================================
// TAB CONFIGURATION
// ============================================

const TABS: TabConfig[] = [
    { id: 'nodal', label: 'Nodal', icon: <Target size={16} />, color: 'text-blue-400' },
    { id: 'member', label: 'Member', icon: <ArrowDown size={16} />, color: 'text-green-400' },
    { id: 'floor', label: 'Floor', icon: <Grid3X3 size={16} />, color: 'text-purple-400' },
    { id: 'temperature', label: 'Thermal', icon: <Thermometer size={16} />, color: 'text-orange-400' },
    { id: 'prestress', label: 'Prestress', icon: <Cable size={16} />, color: 'text-cyan-400' },
    { id: 'combinations', label: 'Combos', icon: <Layers size={16} />, color: 'text-yellow-400' },
];

const LOAD_CASE_TYPES: LoadCaseType[] = [
    'DEAD', 'LIVE', 'WIND', 'SEISMIC', 'TEMPERATURE', 'PRESTRESS', 'IMPOSED'
];

const LOAD_DIRECTIONS: { value: LoadDirection; label: string }[] = [
    { value: 'global_y', label: 'Global Y (Vertical)' },
    { value: 'global_x', label: 'Global X' },
    { value: 'global_z', label: 'Global Z' },
    { value: 'local_y', label: 'Local Y (Perpendicular)' },
    { value: 'local_x', label: 'Local X (Axial)' },
    { value: 'local_z', label: 'Local Z' },
];


// ============================================
// MAIN COMPONENT
// ============================================

export const LoadDialog: React.FC<LoadDialogProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<LoadTab>('nodal');
    const [selectedLoadCase, setSelectedLoadCase] = useState<string>('DEAD');
    const [loadCases, setLoadCases] = useState<Map<string, LoadCase>>(() => {
        const initial = new Map<string, LoadCase>();
        initial.set('DEAD', createDefaultLoadCase('DEAD'));
        initial.set('LIVE', createDefaultLoadCase('LIVE'));
        return initial;
    });
    const [combinations, setCombinations] = useState<LoadCombination[]>(DEFAULT_COMBINATIONS);
    const [isApplying, setIsApplying] = useState(false);

    // Get model data
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);
    const selectedIds = useModelStore((s) => s.selectedIds);

    const activeLoadCase = useMemo(() =>
        loadCases.get(selectedLoadCase) || createDefaultLoadCase('DEAD'),
        [loadCases, selectedLoadCase]
    );

    // Global store actions
    const storeAddLoad = useModelStore(s => s.addLoad);
    const storeAddMemberLoad = useModelStore(s => s.addMemberLoad);
    const storeAddFloorLoad = useModelStore(s => s.addFloorLoad);

    // Get selected node/member IDs
    const selectedNodeIds = useMemo(() =>
        Array.from(selectedIds).filter(id => nodes.has(id)),
        [selectedIds, nodes]
    );

    const selectedMemberIds = useMemo(() =>
        Array.from(selectedIds).filter(id => members.has(id)),
        [selectedIds, members]
    );

    // ============================================
    // LOAD CASE MANAGEMENT
    // ============================================

    const addLoadCase = useCallback((type: LoadCaseType) => {
        const newCase = createDefaultLoadCase(type);
        setLoadCases(prev => new Map(prev).set(type, newCase));
        setSelectedLoadCase(type);
    }, []);

    const updateLoadCase = useCallback((updated: LoadCase) => {
        setLoadCases(prev => new Map(prev).set(updated.name, updated));
    }, []);

    // ============================================
    // ADD LOAD HANDLERS (Batch / Functional Updates)
    // ============================================

    const addNodalLoads = useCallback((nodeIds: string[]) => {
        if (!nodeIds.length) return;

        setLoadCases(prev => {
            const currentCase = prev.get(selectedLoadCase) || createDefaultLoadCase(selectedLoadCase as LoadCaseType);

            const newLoads = nodeIds.map(nodeId => ({
                id: generateLoadId('nodal'),
                nodeId,
                fx: 0, fy: -10, fz: 0,
                mx: 0, my: 0, mz: 0,
                loadCase: selectedLoadCase
            } as NodalLoad));

            const updated = {
                ...currentCase,
                nodalLoads: [...currentCase.nodalLoads, ...newLoads]
            };
            return new Map(prev).set(selectedLoadCase, updated);
        });
    }, [selectedLoadCase]);

    const addMemberLoads = useCallback((memberIds: string[], type: 'uniform' | 'trapezoidal' | 'point' | 'moment') => {
        if (!memberIds.length) return;

        setLoadCases(prev => {
            const currentCase = prev.get(selectedLoadCase) || createDefaultLoadCase(selectedLoadCase as LoadCaseType);

            const newLoads = memberIds.map(memberId => {
                let load: Partial<MemberLoad> = {
                    memberId,
                    loadCase: selectedLoadCase
                };

                switch (type) {
                    case 'uniform':
                        load = {
                            ...load,
                            id: generateLoadId('udl'), type: 'uniform',
                            w: -10, direction: 'global_y', startPos: 0, endPos: 1, isProjected: false
                        } as UniformLoad;
                        break;
                    case 'trapezoidal':
                        load = {
                            ...load,
                            id: generateLoadId('trap'), type: 'trapezoidal',
                            w1: -5, w2: -15, direction: 'global_y', startPos: 0, endPos: 1, isProjected: false
                        } as TrapezoidalLoad;
                        break;
                    case 'point':
                        load = {
                            ...load,
                            id: generateLoadId('pt'), type: 'point',
                            P: -20, a: 0.5, direction: 'global_y'
                        } as PointLoadOnMember;
                        break;
                    case 'moment':
                        load = {
                            ...load,
                            id: generateLoadId('mom'), type: 'moment',
                            M: 10, a: 0.5, aboutAxis: 'z'
                        } as MomentOnMember;
                        break;
                }
                return load as MemberLoad;
            });

            const updated = {
                ...currentCase,
                memberLoads: [...currentCase.memberLoads, ...newLoads]
            };
            return new Map(prev).set(selectedLoadCase, updated);
        });
    }, [selectedLoadCase]);

    const addFloorLoad = useCallback(() => {
        setLoadCases(prev => {
            const currentCase = prev.get(selectedLoadCase) || createDefaultLoadCase(selectedLoadCase as LoadCaseType);
            const newLoad: FloorLoad = {
                id: generateLoadId('floor'),
                pressure: -5,
                yLevel: 3,
                xMin: -Infinity, xMax: Infinity,
                zMin: -Infinity, zMax: Infinity,
                loadCase: selectedLoadCase
            };

            const updated = { ...currentCase, floorLoads: [...currentCase.floorLoads, newLoad] };
            return new Map(prev).set(selectedLoadCase, updated);
        });
    }, [selectedLoadCase]);

    const addTemperatureLoads = useCallback((memberIds: string[]) => {
        if (!memberIds.length) return;

        setLoadCases(prev => {
            const currentCase = prev.get(selectedLoadCase) || createDefaultLoadCase(selectedLoadCase as LoadCaseType);
            const newLoads = memberIds.map(memberId => ({
                id: generateLoadId('temp'),
                memberId,
                deltaT: 30,
                alpha: 12e-6,
                loadCase: selectedLoadCase
            } as TemperatureLoad));

            const updated = { ...currentCase, temperatureLoads: [...currentCase.temperatureLoads, ...newLoads] };
            return new Map(prev).set(selectedLoadCase, updated);
        });
    }, [selectedLoadCase]);

    const addPrestressLoads = useCallback((memberIds: string[]) => {
        if (!memberIds.length) return;

        setLoadCases(prev => {
            const currentCase = prev.get(selectedLoadCase) || createDefaultLoadCase(selectedLoadCase as LoadCaseType);
            const newLoads = memberIds.map(memberId => ({
                id: generateLoadId('ps'),
                memberId,
                P: 1000,
                eStart: 0, eMid: 0.15, eEnd: 0,
                loadCase: selectedLoadCase
            } as PrestressLoad));

            const updated = { ...currentCase, prestressLoads: [...currentCase.prestressLoads, ...newLoads] };
            return new Map(prev).set(selectedLoadCase, updated);
        });
    }, [selectedLoadCase]);

    // ============================================
    // REMOVE & UPDATE HANDLERS
    // ============================================

    // Generic remove handler using useCallback at component level
    const handleRemoveLoad = useCallback((field: 'nodalLoads' | 'memberLoads' | 'floorLoads' | 'temperatureLoads' | 'prestressLoads', id: string) => {
        setLoadCases(prev => {
            const currentCase = prev.get(selectedLoadCase);
            if (!currentCase) return prev;

            const list = currentCase[field] as any[];
            const updatedList = list.filter(l => l.id !== id);

            const updated = { ...currentCase, [field]: updatedList };
            return new Map(prev).set(selectedLoadCase, updated);
        });
    }, [selectedLoadCase]);

    // Create specific handlers by currying the field parameter
    const removeNodalLoad = useCallback((id: string) => handleRemoveLoad('nodalLoads', id), [handleRemoveLoad]);
    const removeMemberLoad = useCallback((id: string) => handleRemoveLoad('memberLoads', id), [handleRemoveLoad]);
    const removeFloorLoad = useCallback((id: string) => handleRemoveLoad('floorLoads', id), [handleRemoveLoad]);
    const removeTemperatureLoad = useCallback((id: string) => handleRemoveLoad('temperatureLoads', id), [handleRemoveLoad]);
    const removePrestressLoad = useCallback((id: string) => handleRemoveLoad('prestressLoads', id), [handleRemoveLoad]);

    // Generic update handler using useCallback at component level
    const handleUpdateLoad = useCallback(<T extends { id: string }>(field: 'nodalLoads' | 'memberLoads' | 'floorLoads' | 'temperatureLoads' | 'prestressLoads', id: string, updates: Partial<T>) => {
        setLoadCases(prev => {
            const currentCase = prev.get(selectedLoadCase);
            if (!currentCase) return prev;

            const list = currentCase[field] as any[];
            const updatedList = list.map(l => l.id === id ? { ...l, ...updates } : l);

            const updated = { ...currentCase, [field]: updatedList };
            return new Map(prev).set(selectedLoadCase, updated);
        });
    }, [selectedLoadCase]);

    // Create specific update handlers
    const updateNodalLoad = useCallback((id: string, updates: Partial<NodalLoad>) => handleUpdateLoad<NodalLoad>('nodalLoads', id, updates), [handleUpdateLoad]);
    const updateMemberLoad = useCallback((id: string, updates: Partial<MemberLoad>) => handleUpdateLoad<MemberLoad>('memberLoads', id, updates), [handleUpdateLoad]);
    const updateFloorLoad = useCallback((id: string, updates: Partial<FloorLoad>) => handleUpdateLoad<FloorLoad>('floorLoads', id, updates), [handleUpdateLoad]);
    const updateTemperatureLoad = useCallback((id: string, updates: Partial<TemperatureLoad>) => handleUpdateLoad<TemperatureLoad>('temperatureLoads', id, updates), [handleUpdateLoad]);
    const updatePrestressLoad = useCallback((id: string, updates: Partial<PrestressLoad>) => handleUpdateLoad<PrestressLoad>('prestressLoads', id, updates), [handleUpdateLoad]);

    // ============================================
    // APPLICATION LOGIC
    // ============================================

    const handleApplyLoads = useCallback(async () => {
        setIsApplying(true);
        try {
            // Apply all loads from the currently active load case (or all modified cases, depending on requirement)
            // For now, let's just apply the current active case context.
            // Loop through all defined loads in current case and dispatch to store
            const currentCase = loadCases.get(selectedLoadCase);

            if (currentCase) {
                // Batching is not available in store, but single dispatch is fast enough usually.
                // If extremely large number, we might block thread.
                // Could wrap in requestAnimationFrame or setTimeout chunking if really bad.

                // Nodal Loads
                currentCase.nodalLoads.forEach(load => storeAddLoad(load));

                // Member Loads - convert types to match store
                currentCase.memberLoads.forEach(load => {
                    // Convert from types/loads.ts MemberLoad to store/model.ts MemberLoad
                    const storeLoad: any = {
                        id: load.id || generateLoadId('member'),
                        memberId: load.memberId,
                        type: load.type === 'uniform' ? 'UDL' : load.type === 'trapezoidal' ? 'UVL' : load.type,
                        direction: 'direction' in load ? load.direction : 'global_y',
                        startPos: 'startPos' in load ? load.startPos : 0,
                        endPos: 'endPos' in load ? load.endPos : 1
                    };
                    
                    if (load.type === 'uniform') {
                        storeLoad.w1 = load.w;
                        storeLoad.w2 = load.w;
                    } else if (load.type === 'trapezoidal') {
                        storeLoad.w1 = load.w1;
                        storeLoad.w2 = load.w2;
                    } else if (load.type === 'point') {
                        storeLoad.P = load.P;
                        storeLoad.a = load.a || 0.5;
                    } else if (load.type === 'moment') {
                        storeLoad.M = load.M;
                        storeLoad.a = load.a || 0.5;
                    }
                    
                    storeAddMemberLoad(storeLoad);
                });

                // Floor/Area Loads → persist to store (distributed to beams at analysis time)
                currentCase.floorLoads.forEach(load => {
                    storeAddFloorLoad({
                        id: load.id,
                        pressure: load.pressure,
                        yLevel: load.yLevel,
                        xMin: load.xMin,
                        xMax: load.xMax,
                        zMin: load.zMin,
                        zMax: load.zMax,
                        distributionOverride: load.distributionOverride,
                        loadCase: load.loadCase,
                    });
                });
            }

            // Close dialog on success
            onClose();
        } catch (error) {
            console.error("Failed to apply loads:", error);
            // Optionally show error toast here
        } finally {
            setIsApplying(false);
        }
    }, [loadCases, selectedLoadCase, storeAddLoad, storeAddMemberLoad, storeAddFloorLoad, onClose]);


    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col overflow-hidden p-0">
                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b border-[#1a2333] space-y-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                                <Zap size={20} className="text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-[#dae2fd]">Loading Manager</DialogTitle>
                                <DialogDescription className="text-sm text-[#869ab8]">Define loads, cases & combinations</DialogDescription>
                            </div>
                        </div>

                        {/* Load Case Selector */}
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-[#869ab8]">Load Case:</span>
                            <select
                                value={selectedLoadCase}
                                onChange={(e) => setSelectedLoadCase(e.target.value)}
                                className="px-3 py-1.5 bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded-lg text-[#dae2fd] text-sm"
                            >
                                {Array.from(loadCases.keys()).map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    const type = LOAD_CASE_TYPES.find(t => !loadCases.has(t)) || 'IMPOSED';
                                    addLoadCase(type);
                                }}
                                title="Add Load Case"
                                className="h-8 w-8"
                            >
                                <Plus size={18} className="text-green-500" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                    {/* Tabs */}
                    <div className="flex gap-1 px-4 py-2 border-b border-[#1a2333] bg-[#0b1326]">
                        {TABS.map(tab => (
                            <button type="button"
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium tracking-wide transition-all
                                    ${activeTab === tab.id
                                        ? 'bg-slate-200 dark:bg-slate-700 text-[#dae2fd]'
                                        : 'text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'}
                                `}
                            >
                                <span className={tab.color}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-4">
                        {activeTab === 'nodal' && (
                            <NodalLoadPanel
                                loads={activeLoadCase.nodalLoads}
                                nodes={nodes}
                                selectedNodeIds={selectedNodeIds}
                                onAdd={addNodalLoads}
                                onRemove={removeNodalLoad}
                                onUpdate={updateNodalLoad}
                            />
                        )}
                        {activeTab === 'member' && (
                            <MemberLoadPanel
                                loads={activeLoadCase.memberLoads}
                                members={members}
                                selectedMemberIds={selectedMemberIds}
                                onAdd={addMemberLoads}
                                onRemove={removeMemberLoad}
                                onUpdate={updateMemberLoad}
                            />
                        )}
                        {activeTab === 'floor' && (
                            <FloorLoadPanel
                                loads={activeLoadCase.floorLoads}
                                onAdd={addFloorLoad}
                                onRemove={removeFloorLoad}
                                onUpdate={updateFloorLoad}
                            />
                        )}
                        {activeTab === 'temperature' && (
                            <TemperatureLoadPanel
                                loads={activeLoadCase.temperatureLoads}
                                members={members}
                                selectedMemberIds={selectedMemberIds}
                                onAdd={addTemperatureLoads}
                                onUpdate={updateTemperatureLoad}
                            />
                        )}
                        {activeTab === 'prestress' && (
                            <PrestressLoadPanel
                                loads={activeLoadCase.prestressLoads}
                                members={members}
                                selectedMemberIds={selectedMemberIds}
                                onAdd={addPrestressLoads}
                                onUpdate={updatePrestressLoad}
                            />
                        )}
                        {activeTab === 'combinations' && (
                            <CombinationsPanel
                                combinations={combinations}
                                loadCases={loadCases}
                                onUpdate={setCombinations}
                            />
                        )}
                    </div>

                    {/* Footer */}
                    <DialogFooter className="flex items-center justify-between px-6 py-3 border-t border-[#1a2333] bg-[#0b1326] sm:justify-between">
                        <div className="text-sm text-[#869ab8]">
                            {activeLoadCase.nodalLoads.length} nodal •
                            {activeLoadCase.memberLoads.length} member •
                            {activeLoadCase.floorLoads.length} floor loads
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button onClick={handleApplyLoads} disabled={isApplying}>
                                {isApplying ? <Activity size={16} className="animate-spin mr-2" /> : null}
                                Apply Loads
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
    );
};


// ============================================
// NODAL LOAD PANEL
// ============================================

interface NodalLoadPanelProps {
    loads: NodalLoad[];
    nodes: Map<string, { x: number; y: number; z: number }>;
    selectedNodeIds: string[];
    onAdd: (nodeIds: string[]) => void;
    onRemove: (id: string) => void;
    onUpdate: (id: string, updates: Partial<NodalLoad>) => void;
}

const NodalLoadPanel: React.FC<NodalLoadPanelProps> = ({
    loads, nodes, selectedNodeIds, onAdd, onRemove, onUpdate
}) => {
    return (
        <div className="space-y-4">
            {/* Add Load Section */}
            <div className="flex items-center gap-3 p-3 bg-[#131b2e] rounded-lg border border-[#1a2333]">
                <Target size={18} className="text-blue-400" />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                    {selectedNodeIds.length > 0
                        ? `${selectedNodeIds.length} node(s) selected`
                        : 'Select node(s) in viewport to add loads'}
                </span>
                {selectedNodeIds.length > 0 && (
                    <Button
                        onClick={() => onAdd(selectedNodeIds)}
                        className="ml-auto"
                        size="sm"
                    >
                        <Plus size={16} />
                        Add Nodal Load
                    </Button>
                )}
            </div>

            {/* Load List */}
            <div className="space-y-2">
                {loads.map(load => {
                    const node = nodes.get(load.nodeId);
                    return (
                        <div
                            key={load.id}
                            className="p-4 bg-[#131b2e] rounded-lg border border-[#1a2333] hover:border-blue-500/50 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Target size={16} className="text-blue-400" />
                                    <span className="text-sm font-medium tracking-wide text-[#dae2fd]">
                                        Node: {load.nodeId.slice(0, 8)}
                                    </span>
                                    {node && (
                                        <span className="text-xs text-[#869ab8]">
                                            ({node.x.toFixed(1)}, {node.y.toFixed(1)}, {node.z.toFixed(1)})
                                        </span>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onRemove(load.id)}
                                    className="h-6 w-6 hover:bg-red-500/20 text-red-400"
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </div>

                            <div className="grid grid-cols-6 gap-2">
                                {(['fx', 'fy', 'fz', 'mx', 'my', 'mz'] as const).map(key => (
                                    <div key={key}>
                                        <Label className="text-xs text-[#869ab8] uppercase">{key}</Label>
                                        <Input
                                            type="number"
                                            value={load[key]}
                                            onChange={(e) => onUpdate(load.id, { [key]: parseFloat(e.target.value) || 0 })}
                                            className="h-8"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 text-xs text-[#869ab8]">
                                Units: Forces (kN), Moments (kN·m) • Negative = downward/clockwise
                            </div>
                        </div>
                    );
                })}

                {loads.length === 0 && (
                    <div className="text-center py-8 text-[#869ab8]">
                        No nodal loads defined. Select nodes and click "Add Nodal Load".
                    </div>
                )}
            </div>
        </div>
    );
};


// ============================================
// MEMBER LOAD PANEL
// ============================================

interface MemberLoadPanelProps {
    loads: MemberLoad[];
    members: Map<string, unknown>;
    selectedMemberIds: string[];
    onAdd: (memberIds: string[], type: 'uniform' | 'trapezoidal' | 'point' | 'moment') => void;
    onRemove: (id: string) => void;
    onUpdate: (id: string, updates: Partial<MemberLoad>) => void;
}

const MemberLoadPanel: React.FC<MemberLoadPanelProps> = ({
    loads, members, selectedMemberIds, onAdd, onRemove, onUpdate
}) => {
    const [loadType, setLoadType] = useState<'uniform' | 'trapezoidal' | 'point' | 'moment'>('uniform');

    return (
        <div className="space-y-4">
            {/* Add Load Section */}
            <div className="p-3 bg-[#131b2e] rounded-lg border border-[#1a2333]">
                <div className="flex items-center gap-3 mb-3">
                    <ArrowDown size={18} className="text-green-400" />
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                        {selectedMemberIds.length > 0
                            ? `${selectedMemberIds.length} member(s) selected`
                            : 'Select member(s) in viewport'}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={loadType}
                        onChange={(e) => setLoadType(e.target.value as typeof loadType)}
                        className="px-3 py-1.5 bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-sm text-[#dae2fd]"
                    >
                        <option value="uniform">Uniform (UDL)</option>
                        <option value="trapezoidal">Trapezoidal/Triangular</option>
                        <option value="point">Point Load</option>
                        <option value="moment">Applied Moment</option>
                    </select>

                    {selectedMemberIds.length > 0 && (
                        <Button
                            onClick={() => onAdd(selectedMemberIds, loadType)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-500"
                        >
                            <Plus size={16} />
                            Add to Selected
                        </Button>
                    )}
                </div>
            </div>

            {/* Load List */}
            <div className="space-y-2">
                {loads.map(load => (
                    <MemberLoadCard
                        key={load.id}
                        load={load}
                        onRemove={() => onRemove(load.id)}
                        onUpdate={(updates) => onUpdate(load.id, updates)}
                    />
                ))}

                {loads.length === 0 && (
                    <div className="text-center py-8 text-[#869ab8]">
                        No member loads defined. Select members and choose a load type.
                    </div>
                )}
            </div>
        </div>
    );
};

interface MemberLoadCardProps {
    load: MemberLoad;
    onRemove: () => void;
    onUpdate: (updates: Partial<MemberLoad>) => void;
}

const MemberLoadCard: React.FC<MemberLoadCardProps> = ({ load, onRemove, onUpdate }) => {
    const [expanded, setExpanded] = useState(true);

    // Type labels and icons
    const typeLabels: Record<string, string> = {
        uniform: 'Uniform (UDL)',
        trapezoidal: 'Trapezoidal (UVL)',
        point: 'Point Load',
        moment: 'Applied Moment'
    };

    const typeIcons: Record<string, React.ReactNode> = {
        uniform: <ArrowDown size={16} className="text-green-400" />,
        trapezoidal: <Activity size={16} className="text-purple-400" />,
        point: <Target size={16} className="text-orange-400" />,
        moment: <RotateCcw size={16} className="text-cyan-400" />
    };

    return (
        <div className="bg-[#131b2e] rounded-lg border border-[#1a2333]">
            <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/30"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    {typeIcons[load.type]}
                    <span className="text-sm font-medium tracking-wide text-[#dae2fd]">{typeLabels[load.type]}</span>
                    <span className="text-xs text-[#869ab8]">on {load.memberId.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="h-6 w-6 hover:bg-red-500/20 text-red-400"
                    >
                        <Trash2 size={14} />
                    </Button>
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
            </div>

            {expanded && (
                <div className="p-3 pt-0 border-t border-[#1a2333]/50">
                    {load.type === 'uniform' && (
                        <div className="grid grid-cols-4 gap-3">
                            <div>
                                <Label className="text-xs text-[#869ab8]">Intensity (kN/m)</Label>
                                <Input
                                    type="number"
                                    value={(load as UniformLoad).w}
                                    onChange={(e) => onUpdate({ w: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">Start Pos (0-1)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0" max="1"
                                    value={(load as UniformLoad).startPos}
                                    onChange={(e) => onUpdate({ startPos: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">End Pos (0-1)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0" max="1"
                                    value={(load as UniformLoad).endPos}
                                    onChange={(e) => onUpdate({ endPos: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">Direction</Label>
                                <select
                                    value={(load as UniformLoad).direction}
                                    onChange={(e) => onUpdate({ direction: e.target.value as LoadDirection })}
                                    className="w-full h-8 px-2 bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-sm text-[#dae2fd]"
                                >
                                    {LOAD_DIRECTIONS.map(d => (
                                        <option key={d.value} value={d.value}>{d.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {load.type === 'trapezoidal' && (
                        <div className="grid grid-cols-4 gap-3">
                            <div>
                                <Label className="text-xs text-[#869ab8]">W1 Start (kN/m)</Label>
                                <Input
                                    type="number"
                                    value={(load as TrapezoidalLoad).w1}
                                    onChange={(e) => onUpdate({ w1: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">W2 End (kN/m)</Label>
                                <Input
                                    type="number"
                                    value={(load as TrapezoidalLoad).w2}
                                    onChange={(e) => onUpdate({ w2: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">Start Pos</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={(load as TrapezoidalLoad).startPos}
                                    onChange={(e) => onUpdate({ startPos: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">End Pos</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={(load as TrapezoidalLoad).endPos}
                                    onChange={(e) => onUpdate({ endPos: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                        </div>
                    )}

                    {load.type === 'point' && (
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <Label className="text-xs text-[#869ab8]">Load P (kN)</Label>
                                <Input
                                    type="number"
                                    value={(load as PointLoadOnMember).P}
                                    onChange={(e) => onUpdate({ P: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">Position (0-1)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0" max="1"
                                    value={(load as PointLoadOnMember).a}
                                    onChange={(e) => onUpdate({ a: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">Direction</Label>
                                <select
                                    value={(load as PointLoadOnMember).direction}
                                    onChange={(e) => onUpdate({ direction: e.target.value as LoadDirection })}
                                    className="w-full h-8 px-2 bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-sm text-[#dae2fd]"
                                >
                                    {LOAD_DIRECTIONS.map(d => (
                                        <option key={d.value} value={d.value}>{d.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {load.type === 'moment' && (
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <Label className="text-xs text-[#869ab8]">Moment M (kN·m)</Label>
                                <Input
                                    type="number"
                                    value={(load as MomentOnMember).M}
                                    onChange={(e) => onUpdate({ M: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">Position (0-1)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0" max="1"
                                    value={(load as MomentOnMember).a}
                                    onChange={(e) => onUpdate({ a: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">About Axis</Label>
                                <select
                                    value={(load as MomentOnMember).aboutAxis}
                                    onChange={(e) => onUpdate({ aboutAxis: e.target.value as 'y' | 'z' })}
                                    className="w-full h-8 px-2 bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-sm text-[#dae2fd]"
                                >
                                    <option value="z">Z-axis (typical)</option>
                                    <option value="y">Y-axis</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


// ============================================
// FLOOR LOAD PANEL
// ============================================

interface FloorLoadPanelProps {
    loads: FloorLoad[];
    onAdd: () => void;
    onRemove: (id: string) => void;
    onUpdate: (id: string, updates: Partial<FloorLoad>) => void;
}

const FloorLoadPanel: React.FC<FloorLoadPanelProps> = ({ loads, onAdd, onRemove, onUpdate }) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#131b2e] rounded-lg border border-[#1a2333]">
                <div className="flex items-center gap-3">
                    <Grid3X3 size={18} className="text-purple-400" />
                    <div>
                        <span className="text-sm text-[#dae2fd]">Floor/Area Loads</span>
                        <p className="text-xs text-[#869ab8]">Auto-distributes to beams using yield line method</p>
                    </div>
                </div>
                <Button

onClick={onAdd}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-500"
                >
                    <Plus size={16} />
                    Add Floor Load
                </Button>
            </div>

            <div className="space-y-2">
                {loads.map(load => (
                    <div
                        key={load.id}
                        className="p-4 bg-[#131b2e] rounded-lg border border-[#1a2333]"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Layers size={16} className="text-purple-400" />
                                <span className="text-sm font-medium tracking-wide text-[#dae2fd]">Floor Load</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onRemove(load.id)}
                                className="h-6 w-6 hover:bg-red-500/20 text-red-400"
                            >
                                <Trash2 size={14} />
                            </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                                <Label className="text-xs text-[#869ab8]">Pressure (kN/m²)</Label>
                                <Input
                                    type="number"
                                    value={load.pressure}
                                    onChange={(e) => onUpdate(load.id, { pressure: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">Y Level (m)</Label>
                                <Input
                                    type="number"
                                    value={load.yLevel}
                                    onChange={(e) => onUpdate(load.id, { yLevel: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">Distribution</Label>
                                <select
                                    value={load.distributionOverride || 'auto'}
                                    onChange={(e) => onUpdate(load.id, {
                                        distributionOverride: e.target.value === 'auto' ? undefined : e.target.value as any
                                    })}
                                    className="w-full h-8 px-2 bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-sm text-[#dae2fd]"
                                >
                                    <option value="auto">Auto (Aspect Ratio)</option>
                                    <option value="one_way">One-Way</option>
                                    <option value="two_way_triangular">Two-Way Triangular</option>
                                    <option value="two_way_trapezoidal">Two-Way Trapezoidal</option>
                                </select>
                            </div>
                        </div>

                        <div className="text-xs text-[#869ab8]">
                            Bounds: X [{load.xMin === -Infinity ? '-∞' : load.xMin} to {load.xMax === Infinity ? '∞' : load.xMax}],
                            Z [{load.zMin === -Infinity ? '-∞' : load.zMin} to {load.zMax === Infinity ? '∞' : load.zMax}]
                        </div>
                    </div>
                ))}

                {loads.length === 0 && (
                    <div className="text-center py-8 text-[#869ab8]">
                        No floor loads defined. Click "Add Floor Load" to create one.
                    </div>
                )}
            </div>
        </div>
    );
};


// ============================================
// TEMPERATURE LOAD PANEL
// ============================================

interface TemperatureLoadPanelProps {
    loads: TemperatureLoad[];
    members: Map<string, unknown>;
    selectedMemberIds: string[];
    onAdd: (memberIds: string[]) => void;
    onUpdate: (id: string, updates: Partial<TemperatureLoad>) => void;
}

const TemperatureLoadPanel: React.FC<TemperatureLoadPanelProps> = ({
    loads, members, selectedMemberIds, onAdd, onUpdate
}) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#131b2e] rounded-lg border border-[#1a2333]">
                <div className="flex items-center gap-3">
                    <Thermometer size={18} className="text-orange-400" />
                    <div>
                        <span className="text-sm text-[#dae2fd]">Temperature Loads</span>
                        <p className="text-xs text-[#869ab8]">ΔT causes axial strain: ε = α × ΔT</p>
                    </div>
                </div>
                {selectedMemberIds.length > 0 && (

<Button
                        onClick={() => onAdd(selectedMemberIds)}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-500"
                    >
                        <Plus size={16} />
                        Add to Selected
                    </Button>
                )}
            </div>

            <div className="space-y-2">
                {loads.map(load => (
                    <div
                        key={load.id}
                        className="p-4 bg-[#131b2e] rounded-lg border border-[#1a2333]"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Thermometer size={16} className="text-orange-400" />
                            <span className="text-sm font-medium tracking-wide text-[#dae2fd]">Member: {load.memberId.slice(0, 8)}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <Label className="text-xs text-[#869ab8]">ΔT (°C)</Label>
                                <Input
                                    type="number"
                                    value={load.deltaT}
                                    onChange={(e) => onUpdate(load.id, { deltaT: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">α (×10⁻⁶/°C)</Label>
                                <Input
                                    type="number"
                                    value={load.alpha * 1e6}
                                    onChange={(e) => onUpdate(load.id, { alpha: (parseFloat(e.target.value) || 0) * 1e-6 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">Gradient ΔT (°C)</Label>
                                <Input
                                    type="number"
                                    value={load.gradientT || 0}
                                    onChange={(e) => onUpdate(load.id, { gradientT: parseFloat(e.target.value) || 0 })}
                                    placeholder="Optional"
                                    className="h-8"
                                />
                            </div>
                        </div>
                    </div>
                ))}

                {loads.length === 0 && (
                    <div className="text-center py-8 text-[#869ab8]">
                        Select members to add temperature loads.
                    </div>
                )}
            </div>
        </div>
    );
};


// ============================================
// PRESTRESS LOAD PANEL
// ============================================

interface PrestressLoadPanelProps {
    loads: PrestressLoad[];
    members: Map<string, unknown>;
    selectedMemberIds: string[];
    onAdd: (memberIds: string[]) => void;
    onUpdate: (id: string, updates: Partial<PrestressLoad>) => void;
}

const PrestressLoadPanel: React.FC<PrestressLoadPanelProps> = ({
    loads, members, selectedMemberIds, onAdd, onUpdate
}) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#131b2e] rounded-lg border border-[#1a2333]">
                <div className="flex items-center gap-3">
                    <Cable size={18} className="text-cyan-400" />
                    <div>
                        <span className="text-sm text-[#dae2fd]">Prestress Loads</span>
                        <p className="text-xs text-[#869ab8]">Parabolic cable profile with equivalent loads</p>
                    </div>
                </div>
                {selectedMemberIds.length > 0 && (
                    <Button
                        onClick={() => onAdd(selectedMemberIds)}
                        size="sm"
                        className="bg-cyan-600 hover:bg-cyan-500"
                    >
                        <Plus size={16} />
                        Add to Selected
                    </Button>
                )}
            </div>

            <div className="space-y-2">
                {loads.map(load => (
                    <div
                        key={load.id}
                        className="p-4 bg-[#131b2e] rounded-lg border border-[#1a2333]"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Cable size={16} className="text-cyan-400" />
                            <span className="text-sm font-medium tracking-wide text-[#dae2fd]">Member: {load.memberId.slice(0, 8)}</span>
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                            <div>
                                <Label className="text-xs text-[#869ab8]">Force P (kN)</Label>
                                <Input
                                    type="number"
                                    value={load.P}
                                    onChange={(e) => onUpdate(load.id, { P: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">e_start (m)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={load.eStart}
                                    onChange={(e) => onUpdate(load.id, { eStart: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">e_mid (m)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={load.eMid}
                                    onChange={(e) => onUpdate(load.id, { eMid: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-[#869ab8]">e_end (m)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={load.eEnd}
                                    onChange={(e) => onUpdate(load.id, { eEnd: parseFloat(e.target.value) || 0 })}
                                    className="h-8"
                                />
                            </div>
                        </div>

                        <div className="mt-2 text-xs text-[#869ab8]">
                            Eccentricity: +ve below centroid, Equivalent UDL = 8Pe/L²
                        </div>
                    </div>
                ))}

                {loads.length === 0 && (
                    <div className="text-center py-8 text-[#869ab8]">
                        Select members to add prestress loads.
                    </div>
                )}
            </div>
        </div>
    );
};


// ============================================
// COMBINATIONS PANEL
// ============================================

interface CombinationsPanelProps {
    combinations: LoadCombination[];
    loadCases: Map<string, LoadCase>;
    onUpdate: (combos: LoadCombination[]) => void;
}

const CombinationsPanel: React.FC<CombinationsPanelProps> = ({
    combinations, loadCases, onUpdate
}) => {
    const addCombination = () => {
        const newCombo: LoadCombination = {
            name: `COMBO_${combinations.length + 1}`,
            description: 'Custom combination',
            factors: { DEAD: 1.5, LIVE: 1.5 }
        };
        onUpdate([...combinations, newCombo]);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#131b2e] rounded-lg border border-[#1a2333]">
                <div className="flex items-center gap-3">
                    <Layers size={18} className="text-yellow-400" />
                    <div>
                        <span className="text-sm text-[#dae2fd]">Load Combinations</span>
                        <p className="text-xs text-[#869ab8]">IS 456 / IS 1893 factored combinations</p>
                    </div>
                </div>
                <Button
                    onClick={addCombination}
                    size="sm"
                    className="bg-yellow-600 hover:bg-yellow-500"
                >
                    <Plus size={16} />
                    Add Combination
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {combinations.map((combo, idx) => (
                    <div
                        key={combo.name}
                        className="p-3 bg-[#131b2e] rounded-lg border border-[#1a2333]"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium tracking-wide text-[#dae2fd]">{combo.name}</span>
                            <span className="text-xs text-[#869ab8]">{combo.description}</span>
                        </div>

                        <div className="flex flex-wrap gap-1">
                            {Object.entries(combo.factors).map(([caseName, factor]) => (
                                <span
                                    key={caseName}
                                    className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs text-[#adc6ff]"
                                >
                                    {factor}{caseName}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


export default LoadDialog;
