import React, { FC, useState } from 'react';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';
import { Lock, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

export const BoundaryConditionsInspectorPanel: FC = () => {
    const { nodes, selectedIds, setNodeRestraints } = useModelStore(
        useShallow(s => ({
            nodes: s.nodes, selectedIds: s.selectedIds, setNodeRestraints: s.setNodeRestraints
        }))
    );

    const [fx, setFx] = useState(true);
    const [fy, setFy] = useState(true);
    const [fz, setFz] = useState(true);
    const [mx, setMx] = useState(true);
    const [my, setMy] = useState(true);
    const [mz, setMz] = useState(true);

    const presetFixed = () => { setFx(true); setFy(true); setFz(true); setMx(true); setMy(true); setMz(true); };
    const presetPinned = () => { setFx(true); setFy(true); setFz(true); setMx(false); setMy(false); setMz(false); };
    const presetRoller = () => { setFx(false); setFy(true); setFz(false); setMx(false); setMy(false); setMz(false); };
    const presetFree = () => { setFx(false); setFy(false); setFz(false); setMx(false); setMy(false); setMz(false); };

    const selectedNodeIds = Array.from(selectedIds).filter(id => nodes.has(id));

    const handleApply = () => {
        selectedNodeIds.forEach(id => {
            setNodeRestraints(id, { fx, fy, fz, mx, my, mz });
        });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden text-[#dae2fd]">
            <div className="p-3 border-b border-[#1a2333] shrink-0">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-2"><Lock className="w-4 h-4 text-emerald-400"/> Boundary Conditions</h3>
                <p className="text-xs text-[#869ab8]">Assign supports to nodes</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 eng-scroll space-y-4">
                <div className="bg-[#131b2e] p-3 rounded-lg border border-[#1a2333]">
                    <Label className="text-[10px] text-[#869ab8] uppercase mb-2 block">Quick Presets</Label>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <Button variant="outline" size="sm" onClick={presetFixed} className="h-8 text-[10px] bg-[#0b1326] border-[#1a2333]">Fixed</Button>
                        <Button variant="outline" size="sm" onClick={presetPinned} className="h-8 text-[10px] bg-[#0b1326] border-[#1a2333]">Pinned</Button>
                        <Button variant="outline" size="sm" onClick={presetRoller} className="h-8 text-[10px] bg-[#0b1326] border-[#1a2333]">Roller</Button>
                        <Button variant="outline" size="sm" onClick={presetFree} className="h-8 text-[10px] bg-[#0b1326] border-[#1a2333]">Free (Delete)</Button>
                    </div>

                    <Label className="text-[10px] text-[#869ab8] uppercase mb-2 block">Custom DOF (Check to Fix)</Label>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <Toggle buttonLabel="Tx" active={fx} onClick={() => setFx(!fx)} />
                        <Toggle buttonLabel="Ty" active={fy} onClick={() => setFy(!fy)} />
                        <Toggle buttonLabel="Tz" active={fz} onClick={() => setFz(!fz)} />
                        <Toggle buttonLabel="Rx" active={mx} onClick={() => setMx(!mx)} />
                        <Toggle buttonLabel="Ry" active={my} onClick={() => setMy(!my)} />
                        <Toggle buttonLabel="Rz" active={mz} onClick={() => setMz(!mz)} />
                    </div>

                    <Button onClick={handleApply} disabled={selectedNodeIds.length === 0} className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-500 mt-2">
                        Apply to {selectedNodeIds.length} Nodes
                    </Button>
                </div>
            </div>

            {/* Paintbrush Hint */}
            <div className="p-3 bg-emerald-500/10 border-t border-emerald-500/20 shrink-0">
                <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-emerald-400 mt-0.5" />
                    <div>
                        <p className="text-xs font-semibold text-emerald-400">Paintbrush Mode Active</p>
                        <p className="text-[10px] text-[#869ab8]">Configure support type above, then click nodes to apply instantly.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Toggle = ({ buttonLabel, active, onClick }: { buttonLabel: string, active: boolean, onClick: () => void }) => (
    <button 
        onClick={onClick}
        className={`h-8 rounded text-xs border ${active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-[#0b1326] text-[#869ab8] border-[#1a2333]'}`}
    >
        {buttonLabel}
    </button>
);
