import React, { FC, memo } from 'react';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';
import { 
  BarChart3, 
  Eye, 
  Activity, 
  Anchor,
  Box,
  Layers,
  Info
} from 'lucide-react';

export const ResultsInspectorPanel: FC = memo(() => {
    const { 
        selectedIds, 
        nodes, 
        members, 
        analysisResults,
        showSFD,
        showBMD,
        showAFD,
        showDeflectedShape,
        showStressOverlay,
        setShowSFD,
        setShowBMD,
        setShowAFD,
        setShowDeflectedShape,
        setShowStressOverlay
    } = useModelStore(
        useShallow((s) => ({
            selectedIds: s.selectedIds,
            nodes: s.nodes,
            members: s.members,
            analysisResults: s.analysisResults,
            showSFD: s.showSFD,
            showBMD: s.showBMD,
            showAFD: s.showAFD,
            showDeflectedShape: s.showDeflectedShape,
            showStressOverlay: s.showStressOverlay,
            setShowSFD: s.setShowSFD,
            setShowBMD: s.setShowBMD,
            setShowAFD: s.setShowAFD,
            setShowDeflectedShape: s.setShowDeflectedShape,
            setShowStressOverlay: s.setShowStressOverlay
        }))
    );

    if (!analysisResults) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-500">
                <BarChart3 className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No Analysis Results</p>
                <p className="text-xs mt-1">Run the analysis to view results here.</p>
            </div>
        );
    }

    const selectedNodes = Array.from(selectedIds).filter(id => nodes.has(id));
    const selectedMembers = Array.from(selectedIds).filter(id => members.has(id));

    return (
        <div className="flex flex-col h-full bg-[#0b1326] text-slate-300">
            {/* Display Toggles */}
            <div className="p-4 border-b border-slate-800/60">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5" /> Diagram Overlays
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    <ToggleCard 
                        label="Bending Moment" 
                        active={showBMD} 
                        onClick={() => setShowBMD(!showBMD)} 
                    />
                    <ToggleCard 
                        label="Shear Force" 
                        active={showSFD} 
                        onClick={() => setShowSFD(!showSFD)} 
                    />
                    <ToggleCard 
                        label="Axial Force" 
                        active={showAFD} 
                        onClick={() => setShowAFD(!showAFD)} 
                    />
                    <ToggleCard 
                        label="Deflected Shape" 
                        active={showDeflectedShape} 
                        onClick={() => setShowDeflectedShape(!showDeflectedShape)} 
                    />
                    <ToggleCard 
                        label="Stress Contour" 
                        active={showStressOverlay} 
                        onClick={() => setShowStressOverlay(!showStressOverlay)} 
                    />
                </div>
            </div>

            {/* Selection Results */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {selectedIds.size === 0 && (
                    <div className="flex flex-col gap-2 mt-4 text-center text-slate-500">
                        <Info className="w-6 h-6 mx-auto opacity-50" />
                        <p className="text-xs">Select a node or member in the 3D view to inspect local results.</p>
                    </div>
                )}

                {/* Node Results */}
                {selectedNodes.map(nodeId => {
                    const reaction = analysisResults.reactions?.get(nodeId);
                    const displacement = analysisResults.displacements?.get(nodeId);
                    
                    return (
                        <div key={nodeId} className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <Box className="w-4 h-4 text-blue-400" /> Node {nodeId}
                            </h4>
                            
                            {reaction && (
                                <div className="mb-3">
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Reactions (kN, kNm)</div>
                                    <div className="grid grid-cols-3 gap-1">
                                        <ResultBadge label="Fx" value={reaction.Fx} />
                                        <ResultBadge label="Fy" value={reaction.Fy} />
                                        <ResultBadge label="Fz" value={reaction.Fz} />
                                        <ResultBadge label="Mx" value={reaction.Mx} />
                                        <ResultBadge label="My" value={reaction.My} />
                                        <ResultBadge label="Mz" value={reaction.Mz} />
                                    </div>
                                </div>
                            )}

                            {displacement && (
                                <div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Displacement (mm, rad)</div>
                                    <div className="grid grid-cols-3 gap-1">
                                        <ResultBadge label="dx" value={displacement.dx * 1000} />
                                        <ResultBadge label="dy" value={displacement.dy * 1000} />
                                        <ResultBadge label="dz" value={displacement.dz * 1000} />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Member Results */}
                {selectedMembers.map(memberId => {
                    const forces = analysisResults.memberForces?.get(memberId);
                    
                    return (
                        <div key={memberId} className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-purple-400" /> Member {memberId}
                            </h4>
                            
                            {forces && forces.length > 0 && (
                                <div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Max End Forces (kN, kNm)</div>
                                    <div className="grid grid-cols-2 gap-1 mb-2">
                                        <ResultBadge label="Max Axial" value={Math.max(...forces.map(f => Math.abs(f.Fx)))} />
                                        <ResultBadge label="Max Shear Y" value={Math.max(...forces.map(f => Math.abs(f.Fy)))} />
                                        <ResultBadge label="Max Moment Z" value={Math.max(...forces.map(f => Math.abs(f.Mz)))} />
                                        <ResultBadge label="Max Torsion" value={Math.max(...forces.map(f => Math.abs(f.Mx)))} />
                                    </div>
                                </div>
                            )}
                            
                            <button className="w-full mt-2 py-1.5 px-3 bg-slate-700/50 hover:bg-slate-600/50 text-white text-[11px] rounded transition-colors border border-slate-600">
                                View Detailed Diagram
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
ResultsInspectorPanel.displayName = 'ResultsInspectorPanel';

const ToggleCard: FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex items-center justify-center p-2 rounded-lg text-xs font-medium transition-all border ${
            active 
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-300'
        }`}
    >
        {label}
    </button>
);

const ResultBadge: FC<{ label: string; value: number | undefined | null }> = ({ label, value }) => {
    const val = value ?? 0;
    const isZero = Math.abs(val) < 1e-4;
    return (
        <div className="flex flex-col bg-[#131b2e] p-1.5 rounded border border-slate-700/30">
            <span className="text-[8px] text-slate-500 uppercase">{label}</span>
            <span className={`text-[11px] font-mono font-medium ${isZero ? 'text-slate-600' : 'text-slate-200'}`}>
                {isZero ? '0.00' : val.toFixed(2)}
            </span>
        </div>
    );
};
