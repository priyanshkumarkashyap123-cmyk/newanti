/**
 * BoundaryConditionsDialog.tsx - Support/Restraint Assignment
 * 
 * Allows users to assign boundary conditions (supports) to nodes.
 * Critical feature for structural stability.
 */

import { FC, useState, useEffect } from 'react';
import { X, Anchor, CircleDot, Move } from 'lucide-react';
import { useModelStore, type Restraints } from '../store/model';

interface BoundaryConditionsDialogProps {
    open: boolean;
    onClose: () => void;
}

type SupportType = 'none' | 'fixed' | 'pinned' | 'roller-x' | 'roller-y' | 'roller-z' | 'custom';

const SUPPORT_PRESETS: Record<SupportType, { label: string; icon: string; restraints: Restraints | null }> = {
    'none': {
        label: 'No Support',
        icon: '⚪',
        restraints: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false }
    },
    'fixed': {
        label: 'Fixed Support',
        icon: '🔒',
        restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }
    },
    'pinned': {
        label: 'Pinned Support',
        icon: '📌',
        restraints: { fx: true, fy: true, fz: true, mx: false, my: false, mz: false }
    },
    'roller-x': {
        label: 'Roller (X-Free)',
        icon: '↔️',
        restraints: { fx: false, fy: true, fz: true, mx: false, my: false, mz: false }
    },
    'roller-y': {
        label: 'Roller (Y-Free)',
        icon: '↕️',
        restraints: { fx: true, fy: false, fz: true, mx: false, my: false, mz: false }
    },
    'roller-z': {
        label: 'Roller (Z-Free)',
        icon: '⤢',
        restraints: { fx: true, fy: true, fz: false, mx: false, my: false, mz: false }
    },
    'custom': {
        label: 'Custom',
        icon: '⚙️',
        restraints: null
    }
};

export const BoundaryConditionsDialog: FC<BoundaryConditionsDialogProps> = ({ open, onClose }) => {
    const nodes = useModelStore(state => state.nodes);
    const selectedIds = useModelStore(state => state.selectedIds);
    const updateNode = useModelStore(state => state.updateNode);

    const [selectedType, setSelectedType] = useState<SupportType>('fixed');
    const [customRestraints, setCustomRestraints] = useState<Restraints>({
        fx: true, fy: true, fz: true, mx: false, my: false, mz: false
    });

    // Get selected nodes
    const selectedNodes = Array.from(selectedIds)
        .map(id => nodes.get(id))
        .filter(node => node !== undefined);

    // Update custom restraints when selecting a preset
    useEffect(() => {
        if (selectedType !== 'custom' && SUPPORT_PRESETS[selectedType].restraints) {
            setCustomRestraints(SUPPORT_PRESETS[selectedType].restraints!);
        }
    }, [selectedType]);

    // Detect existing support type from selection
    useEffect(() => {
        if (selectedNodes.length > 0 && open) {
            const firstNode = selectedNodes[0];
            if (!firstNode.restraints) {
                setSelectedType('none');
            } else {
                // Try to match to a preset
                const restraints = firstNode.restraints;
                for (const [type, preset] of Object.entries(SUPPORT_PRESETS)) {
                    if (preset.restraints &&
                        preset.restraints.fx === restraints.fx &&
                        preset.restraints.fy === restraints.fy &&
                        preset.restraints.fz === restraints.fz &&
                        preset.restraints.mx === restraints.mx &&
                        preset.restraints.my === restraints.my &&
                        preset.restraints.mz === restraints.mz) {
                        setSelectedType(type as SupportType);
                        return;
                    }
                }
                // No match - must be custom
                setSelectedType('custom');
                setCustomRestraints(restraints);
            }
        }
    }, [selectedNodes.length, open]);

    const handleApply = () => {
        const restraintsToApply = selectedType === 'custom'
            ? customRestraints
            : SUPPORT_PRESETS[selectedType].restraints;

        if (!restraintsToApply) return;

        // Prepare batch updates
        const updates = new Map();
        selectedNodes.forEach(node => {
            updates.set(node.id, { restraints: { ...restraintsToApply } });
        });

        // Batch update
        const updateNodes = useModelStore.getState().updateNodes;
        updateNodes(updates);

        onClose();
    };

    const toggleCustomRestraint = (dof: keyof Restraints) => {
        setCustomRestraints(prev => ({ ...prev, [dof]: !prev[dof] }));
    };

    if (!open) return null;

    const hasSelection = selectedNodes.length > 0;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900">
                    <div className="flex items-center gap-3">
                        <Anchor className="w-6 h-6 text-blue-400" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Boundary Conditions</h2>
                            <p className="text-sm text-slate-400">
                                {hasSelection
                                    ? `${selectedNodes.length} node(s) selected`
                                    : 'No nodes selected'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!hasSelection ? (
                        <div className="text-center py-12">
                            <CircleDot className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                            <p className="text-slate-400 text-lg">No nodes selected</p>
                            <p className="text-slate-500 text-sm mt-2">
                                Please select one or more nodes to assign boundary conditions
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Support Type Presets */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-300 mb-3">Support Type</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {(Object.entries(SUPPORT_PRESETS) as [SupportType, typeof SUPPORT_PRESETS[SupportType]][]).map(([type, preset]) => (
                                        <button
                                            key={type}
                                            onClick={() => setSelectedType(type)}
                                            className={`p-4 rounded-lg border-2 transition-all text-left ${selectedType === type
                                                ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/20'
                                                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{preset.icon}</span>
                                                <div>
                                                    <div className={`font-semibold ${selectedType === type ? 'text-white' : 'text-slate-300'
                                                        }`}>
                                                        {preset.label}
                                                    </div>
                                                    {preset.restraints && (
                                                        <div className="text-xs text-slate-500 mt-1 font-mono">
                                                            {Object.entries(preset.restraints)
                                                                .filter(([_, val]) => val)
                                                                .map(([key]) => key.toUpperCase())
                                                                .join(', ') || 'Free'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom DOF Selection */}
                            {selectedType === 'custom' && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Custom Restraints</h3>
                                    <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Translation DOFs */}
                                            <div className="space-y-2">
                                                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Translation</div>
                                                {(['fx', 'fy', 'fz'] as const).map(dof => (
                                                    <label key={dof} className="flex items-center gap-3 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={customRestraints[dof]}
                                                            onChange={() => toggleCustomRestraint(dof)}
                                                            className="w-5 h-5 rounded border-2 border-slate-600 bg-slate-700 checked:bg-blue-500 checked:border-blue-500 cursor-pointer"
                                                        />
                                                        <span className="text-slate-300 group-hover:text-white font-mono text-sm">
                                                            {dof.toUpperCase()}
                                                            <span className="text-slate-500 ml-2">
                                                                ({dof === 'fx' ? 'X-axis' : dof === 'fy' ? 'Y-axis' : 'Z-axis'})
                                                            </span>
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>

                                            {/* Rotation DOFs */}
                                            <div className="space-y-2">
                                                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rotation</div>
                                                {(['mx', 'my', 'mz'] as const).map(dof => (
                                                    <label key={dof} className="flex items-center gap-3 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={customRestraints[dof]}
                                                            onChange={() => toggleCustomRestraint(dof)}
                                                            className="w-5 h-5 rounded border-2 border-slate-600 bg-slate-700 checked:bg-blue-500 checked:border-blue-500 cursor-pointer"
                                                        />
                                                        <span className="text-slate-300 group-hover:text-white font-mono text-sm">
                                                            {dof.toUpperCase()}
                                                            <span className="text-slate-500 ml-2">
                                                                ({dof === 'mx' ? 'About X' : dof === 'my' ? 'About Y' : 'About Z'})
                                                            </span>
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Preview */}
                            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                                <div className="text-sm font-semibold text-blue-300 mb-2">Preview</div>
                                <div className="text-sm text-blue-200">
                                    {selectedType !== 'custom' && SUPPORT_PRESETS[selectedType].restraints ? (
                                        <>
                                            <strong>{SUPPORT_PRESETS[selectedType].label}</strong> will be applied to {selectedNodes.length} node(s)
                                        </>
                                    ) : (
                                        <>
                                            <strong>Custom restraints</strong> will be applied to {selectedNodes.length} node(s)
                                        </>
                                    )}
                                </div>
                                <div className="mt-2 text-xs text-blue-300 font-mono">
                                    Restrained DOFs: {Object.entries(selectedType === 'custom' ? customRestraints : SUPPORT_PRESETS[selectedType].restraints || {})
                                        .filter(([_, val]) => val)
                                        .map(([key]) => key.toUpperCase())
                                        .join(', ') || 'None (Free)'}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!hasSelection}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${hasSelection
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        Apply to {selectedNodes.length} Node{selectedNodes.length !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BoundaryConditionsDialog;
