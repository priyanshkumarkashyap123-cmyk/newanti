import React, { FC, useState, useEffect, useMemo, useCallback } from 'react';
import { useModelStore } from '../../store/model';
import { useUIStore } from '../../store/uiStore';
import { useShallow } from 'zustand/react/shallow';
import { useSetAtom } from 'jotai';
import { previewLoadAtom } from '../../store/uiAtoms';
import { Target, ArrowDown, Grid3X3, Thermometer, Cable, Layers, Plus, Trash2, Zap, Activity, RotateCcw } from 'lucide-react';
import { createDefaultLoadCase, generateLoadId, LoadCase, NodalLoad, MemberLoad, UniformLoad, TrapezoidalLoad, PointLoadOnMember, MomentOnMember } from '../../types/loads';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export const LoadInspectorPanel: FC = () => {
    const { activeTool } = useUIStore(useShallow(s => ({ activeTool: s.activeTool })));
    const { nodes, members, selectedIds, addLoad, addMemberLoad, removeLoad, removeMemberLoad, activeLoadCaseId, setActiveLoadCase } = useModelStore(
        useShallow(s => ({
            nodes: s.nodes, members: s.members, selectedIds: s.selectedIds,
            addLoad: s.addLoad, addMemberLoad: s.addMemberLoad,
            removeLoad: s.removeLoad, removeMemberLoad: s.removeMemberLoad,
            activeLoadCaseId: s.activeLoadCaseId, setActiveLoadCase: s.setActiveLoadCase
        }))
    );

    const activeCase = activeLoadCaseId || 'DEAD';
    
    // Map tool ID to standard load types
    const isNodal = activeTool === 'ADD_POINT_LOAD' || activeTool === 'ADD_MOMENT';
    const isMember = activeTool === 'ADD_UDL' || activeTool === 'ADD_TRAPEZOID' || activeTool === 'ADD_MOVING_LOAD';
    
    // Default to Nodal if nothing selected, or if generic tool
    const [tab, setTab] = useState<'nodal' | 'member'>('nodal');
    
    useEffect(() => {
        if (isNodal) setTab('nodal');
        if (isMember) setTab('member');
    }, [isNodal, isMember]);

    const selectedNodeIds = Array.from(selectedIds).filter(id => nodes.has(id));
    const selectedMemberIds = Array.from(selectedIds).filter(id => members.has(id));

    return (
        <div className="flex flex-col h-full overflow-hidden text-[#dae2fd]">
            {/* Header / Load Case Selector */}
            <div className="p-3 border-b border-[#1a2333] shrink-0">
                <Label className="text-xs text-[#869ab8] uppercase mb-1 block">Active Load Case</Label>
                <select 
                    value={activeCase}
                    onChange={e => setActiveLoadCase(e.target.value)}
                    className="w-full bg-[#131b2e] border border-[#1a2333] rounded px-2 py-1.5 text-sm"
                >
                    <option value="DEAD">DEAD</option>
                    <option value="LIVE">LIVE</option>
                    <option value="WIND">WIND</option>
                    <option value="SEISMIC">SEISMIC</option>
                </select>
            </div>

            {/* Quick Tabs */}
            <div className="flex border-b border-[#1a2333] shrink-0">
                <button
                    onClick={() => setTab('nodal')}
                    className={`flex-1 py-2 text-xs font-semibold ${tab === 'nodal' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-[#869ab8] hover:text-[#dae2fd]'}`}
                >
                    Nodal
                </button>
                <button
                    onClick={() => setTab('member')}
                    className={`flex-1 py-2 text-xs font-semibold ${tab === 'member' ? 'text-green-400 border-b-2 border-green-400' : 'text-[#869ab8] hover:text-[#dae2fd]'}`}
                >
                    Member
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-3 eng-scroll space-y-4">
                {tab === 'nodal' && (
                    <NodalLoadForm 
                        selectedNodeIds={selectedNodeIds} 
                        activeCase={activeCase} 
                        addLoad={addLoad} 
                    />
                )}
                {tab === 'member' && (
                    <MemberLoadForm 
                        selectedMemberIds={selectedMemberIds} 
                        activeCase={activeCase} 
                        addMemberLoad={(load) => {
                            // Ensure properties expected by the store are present
                            const storeLoad: any = {
                                ...load,
                                type: load.type === 'uniform' ? 'UDL' : load.type === 'trapezoidal' ? 'UVL' : load.type,
                                startPos: 'startPos' in load ? load.startPos : 0,
                                endPos: 'endPos' in load ? load.endPos : 1
                            };
                            if (load.type === 'uniform') {
                                storeLoad.w1 = (load as UniformLoad).w;
                                storeLoad.w2 = (load as UniformLoad).w;
                            } else if (load.type === 'trapezoidal') {
                                storeLoad.w1 = (load as TrapezoidalLoad).w1;
                                storeLoad.w2 = (load as TrapezoidalLoad).w2;
                            }
                            addMemberLoad(storeLoad);
                        }} 
                        activeTool={activeTool}
                    />
                )}
            </div>
            
            {/* Paintbrush Mode Hint */}
            <div className="p-3 bg-blue-500/10 border-t border-blue-500/20 shrink-0">
                <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-blue-400 mt-0.5" />
                    <div>
                        <p className="text-xs font-semibold text-blue-400">Paintbrush Mode Active</p>
                        <p className="text-[10px] text-[#869ab8]">Configure the load above, then click elements in the 3D view to apply instantly.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Sub-components for forms
const NodalLoadForm: FC<{ selectedNodeIds: string[], activeCase: string, addLoad: any }> = ({ selectedNodeIds, activeCase, addLoad }) => {
    const [fx, setFx] = useState(0);
    const [fy, setFy] = useState(-10);
    const [fz, setFz] = useState(0);
    const [mz, setMz] = useState(0);

    const handleApply = () => {
        selectedNodeIds.forEach(nodeId => {
            addLoad({
                id: generateLoadId('nodal'),
                nodeId, fx, fy, fz, mx:0, my:0, mz,
                loadCase: activeCase
            });
        });
    };

    return (
        <div className="space-y-4">
            <div className="bg-[#131b2e] p-3 rounded-lg border border-[#1a2333]">
                <h4 className="text-xs font-bold text-[#dae2fd] mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-400" /> Apply Nodal Load
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-[10px] text-[#869ab8]">Fx (kN)</Label><Input type="number" value={fx} onChange={e => setFx(Number(e.target.value))} className="h-7 text-xs" /></div>
                    <div><Label className="text-[10px] text-[#869ab8]">Fy (kN)</Label><Input type="number" value={fy} onChange={e => setFy(Number(e.target.value))} className="h-7 text-xs" /></div>
                    <div><Label className="text-[10px] text-[#869ab8]">Fz (kN)</Label><Input type="number" value={fz} onChange={e => setFz(Number(e.target.value))} className="h-7 text-xs" /></div>
                    <div><Label className="text-[10px] text-[#869ab8]">Mz (kN·m)</Label><Input type="number" value={mz} onChange={e => setMz(Number(e.target.value))} className="h-7 text-xs" /></div>
                </div>
                <Button onClick={handleApply} disabled={selectedNodeIds.length === 0} className="w-full mt-3 h-8 text-xs bg-blue-600 hover:bg-blue-500">
                    Apply to {selectedNodeIds.length} Nodes
                </Button>
            </div>
        </div>
    );
};

const MemberLoadForm: FC<{ selectedMemberIds: string[], activeCase: string, addMemberLoad: any, activeTool: string | null }> = ({ selectedMemberIds, activeCase, addMemberLoad, activeTool }) => {
    const [type, setType] = useState<'uniform' | 'trapezoidal' | 'point'>('uniform');
    const [w, setW] = useState(-10);
    const [w1, setW1] = useState(-5);
    const [w2, setW2] = useState(-15);
    const [P, setP] = useState(-20);
    const [a, setA] = useState(0.5);
    
    const setPreviewLoad = useSetAtom(previewLoadAtom);

    useEffect(() => {
        if (activeTool === 'ADD_UDL') setType('uniform');
        if (activeTool === 'ADD_TRAPEZOID') setType('trapezoidal');
        if (activeTool === 'ADD_POINT_LOAD') setType('point');
    }, [activeTool]);

    useEffect(() => {
        setPreviewLoad({ type, w, w1, w2, P, a });
        return () => setPreviewLoad(null);
    }, [type, w, w1, w2, P, a, setPreviewLoad]);

    const handleApply = () => {
        selectedMemberIds.forEach(memberId => {
            if (type === 'uniform') {
                addMemberLoad({ id: generateLoadId('udl'), type: 'uniform', memberId, loadCase: activeCase, w, direction: 'global_y', startPos: 0, endPos: 1, isProjected: false });
            } else if (type === 'trapezoidal') {
                addMemberLoad({ id: generateLoadId('trap'), type: 'trapezoidal', memberId, loadCase: activeCase, w1, w2, direction: 'global_y', startPos: 0, endPos: 1, isProjected: false });
            } else if (type === 'point') {
                addMemberLoad({ id: generateLoadId('pt'), type: 'point', memberId, loadCase: activeCase, P, a, direction: 'global_y' });
            }
        });
    };

    return (
        <div className="space-y-4">
            <div className="bg-[#131b2e] p-3 rounded-lg border border-[#1a2333]">
                <h4 className="text-xs font-bold text-[#dae2fd] mb-3 flex items-center gap-2">
                    <ArrowDown className="w-4 h-4 text-green-400" /> Apply Member Load
                </h4>
                
                <Label className="text-[10px] text-[#869ab8] mb-1 block">Load Type</Label>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-[#0b1326] border border-[#1a2333] rounded px-2 py-1.5 text-xs mb-3 text-[#dae2fd]">
                    <option value="uniform">Uniform (UDL)</option>
                    <option value="trapezoidal">Trapezoidal</option>
                    <option value="point">Point Load</option>
                </select>

                {type === 'uniform' && (
                    <div><Label className="text-[10px] text-[#869ab8]">Intensity w (kN/m)</Label><Input type="number" value={w} onChange={e => setW(Number(e.target.value))} className="h-7 text-xs" /></div>
                )}
                {type === 'trapezoidal' && (
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-[10px] text-[#869ab8]">Start w1 (kN/m)</Label><Input type="number" value={w1} onChange={e => setW1(Number(e.target.value))} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px] text-[#869ab8]">End w2 (kN/m)</Label><Input type="number" value={w2} onChange={e => setW2(Number(e.target.value))} className="h-7 text-xs" /></div>
                    </div>
                )}
                {type === 'point' && (
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-[10px] text-[#869ab8]">Force P (kN)</Label><Input type="number" value={P} onChange={e => setP(Number(e.target.value))} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px] text-[#869ab8]">Position a (0-1)</Label><Input type="number" value={a} step="0.1" onChange={e => setA(Number(e.target.value))} className="h-7 text-xs" /></div>
                    </div>
                )}

                <Button onClick={handleApply} disabled={selectedMemberIds.length === 0} className="w-full mt-3 h-8 text-xs bg-green-600 hover:bg-green-500">
                    Apply to {selectedMemberIds.length} Members
                </Button>
            </div>
        </div>
    );
};
