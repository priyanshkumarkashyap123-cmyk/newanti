/**
 * NodeInputDialog - Precise Node Coordinate Input
 * 
 * Modal for entering precise node coordinates:
 * - X, Y, Z coordinate fields with unit labels
 * - Quick options: Origin, Relative positioning
 * - Restraint toggles (fixed, pinned, roller)
 */

import { FC, useState, useEffect, useRef } from 'react';
import { MapPin, Lock, Unlock } from 'lucide-react';
import { useModelStore } from '../../store/model';
import { Dialog, DialogContent, DialogFooter } from './dialog';
import { Button } from './button';

// ============================================
// TYPES
// ============================================

interface NodeInputDialogProps {
    isOpen: boolean;
    onClose: () => void;
    editNodeId?: string; // If set, editing existing node
    initialPosition?: { x: number; y: number; z: number };
}

// ============================================
// COMPONENT
// ============================================

export const NodeInputDialog: FC<NodeInputDialogProps> = ({
    isOpen,
    onClose,
    editNodeId,
    initialPosition
}) => {
    const addNode = useModelStore((s) => s.addNode);
    const nodes = useModelStore((s) => s.nodes);
    const updateNodePosition = useModelStore((s) => s.updateNodePosition);
    const setNodeRestraints = useModelStore((s) => s.setNodeRestraints);

    // Form state
    const [x, setX] = useState('0');
    const [y, setY] = useState('0');
    const [z, setZ] = useState('0');
    const [restraints, setRestraints] = useState({
        fx: false, fy: false, fz: false,
        mx: false, my: false, mz: false
    });
    const [supportType, setSupportType] = useState<'none' | 'pinned' | 'fixed' | 'roller-x' | 'roller-y'>('none');
    const [coordError, setCoordError] = useState('');

    const xInputRef = useRef<HTMLInputElement>(null);

    // Initialize from editNodeId or initialPosition
    useEffect(() => {
        if (isOpen) {
            queueMicrotask(() => {
                if (editNodeId && nodes.has(editNodeId)) {
                    const node = nodes.get(editNodeId)!;
                    setX(node.x.toString());
                    setY(node.y.toString());
                    setZ(node.z.toString());
                    if (node.restraints) {
                        setRestraints(node.restraints);
                        // Determine support type
                        const r = node.restraints;
                        if (r.fx && r.fy && r.fz && r.mx && r.my && r.mz) {
                            setSupportType('fixed');
                        } else if (r.fx && r.fy && r.fz) {
                            setSupportType('pinned');
                        } else if (r.fy && !r.fx) {
                            setSupportType('roller-x');
                        } else if (r.fx && !r.fy) {
                            setSupportType('roller-y');
                        } else {
                            setSupportType('none');
                        }
                    }
                } else if (initialPosition) {
                    setX(initialPosition.x.toString());
                    setY(initialPosition.y.toString());
                    setZ(initialPosition.z.toString());
                    setRestraints({ fx: false, fy: false, fz: false, mx: false, my: false, mz: false });
                    setSupportType('none');
                } else {
                    setX('0');
                    setY('0');
                    setZ('0');
                    setRestraints({ fx: false, fy: false, fz: false, mx: false, my: false, mz: false });
                    setSupportType('none');
                }
            });
            // Focus X input
            setTimeout(() => xInputRef.current?.focus(), 100);
        }
    }, [isOpen, editNodeId, initialPosition, nodes]);

    // Handle support type change
    const handleSupportTypeChange = (type: typeof supportType) => {
        setSupportType(type);
        switch (type) {
            case 'fixed':
                setRestraints({ fx: true, fy: true, fz: true, mx: true, my: true, mz: true });
                break;
            case 'pinned':
                setRestraints({ fx: true, fy: true, fz: true, mx: false, my: false, mz: false });
                break;
            case 'roller-x':
                setRestraints({ fx: false, fy: true, fz: true, mx: false, my: false, mz: false });
                break;
            case 'roller-y':
                setRestraints({ fx: true, fy: false, fz: true, mx: false, my: false, mz: false });
                break;
            default:
                setRestraints({ fx: false, fy: false, fz: false, mx: false, my: false, mz: false });
        }
    };

    // Submit handler
    const handleSubmit = () => {
        // Validate coordinate inputs
        const numX = parseFloat(x);
        const numY = parseFloat(y);
        const numZ = parseFloat(z);

        if (isNaN(numX) || isNaN(numY) || isNaN(numZ)) {
            setCoordError('All coordinates must be valid numbers');
            return;
        }
        setCoordError('');

        if (editNodeId) {
            // Update existing node
            updateNodePosition(editNodeId, { x: numX, y: numY, z: numZ });
            setNodeRestraints(editNodeId, restraints);
        } else {
            // Create new node
            const nodeId = `N${Date.now()}`;
            addNode({
                id: nodeId,
                x: numX,
                y: numY,
                z: numZ,
                restraints
            });
        }

        onClose();
    };

    // Quick position helpers
    const setOrigin = () => { setX('0'); setY('0'); setZ('0'); };
    const incrementX = (delta: number) => setX((parseFloat(x) + delta).toString());
    const incrementY = (delta: number) => setY((parseFloat(y) + delta).toString());

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md p-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-t-lg">
                    <MapPin className="w-5 h-5" />
                    <h2 className="text-lg font-semibold">
                        {editNodeId ? 'Edit Node' : 'Add Node'}
                    </h2>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                    {/* Coordinates */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            Coordinates
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">X (m)</label>
                                <input
                                    ref={xInputRef}
                                    type="number"
                                    step="0.1"
                                    value={x}
                                    onChange={(e) => setX(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Y (m)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={y}
                                    onChange={(e) => setY(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Z (m)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={z}
                                    onChange={(e) => setZ(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        {coordError && (
                            <p className="mt-2 text-xs text-red-500">{coordError}</p>
                        )}
                        {/* Quick position buttons */}
                        <div className="flex gap-2 mt-3">
                            <button type="button"
                                onClick={setOrigin}
                                className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                            >
                                Origin (0,0,0)
                            </button>
                            <button type="button"
                                onClick={() => incrementX(1)}
                                className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                            >
                                X+1
                            </button>
                            <button type="button"
                                onClick={() => incrementY(1)}
                                className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                            >
                                Y+1
                            </button>
                        </div>
                    </div>

                    {/* Support Type */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            Support Type
                        </h3>
                        <div className="grid grid-cols-5 gap-2">
                            {[
                                { id: 'none', label: 'None', icon: '○' },
                                { id: 'pinned', label: 'Pinned', icon: '△' },
                                { id: 'fixed', label: 'Fixed', icon: '▬' },
                                { id: 'roller-x', label: 'Roller X', icon: '◎' },
                                { id: 'roller-y', label: 'Roller Y', icon: '◎' }
                            ].map((type) => (
                                <button type="button"
                                    key={type.id}
                                    onClick={() => handleSupportTypeChange(type.id as typeof supportType)}
                                    className={`
                                        flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all
                                        ${supportType === type.id
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                        }
                                    `}
                                >
                                    <span className="text-xl">{type.icon}</span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Manual Restraints (Advanced) */}
                    <details className="mb-4">
                        <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
                            Advanced: Manual Restraints
                        </summary>
                        <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <div className="grid grid-cols-6 gap-2">
                                {(['fx', 'fy', 'fz', 'mx', 'my', 'mz'] as const).map((key) => (
                                    <button type="button"
                                        key={key}
                                        onClick={() => setRestraints(r => ({ ...r, [key]: !r[key] }))}
                                        className={`
                                            flex flex-col items-center gap-1 p-2 rounded border transition-colors
                                            ${restraints[key]
                                                ? 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-600'
                                                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                                            }
                                        `}
                                    >
                                        {restraints[key] ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                        <span className="text-[10px] uppercase">{key}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </details>
                </div>

                {/* Footer */}
                <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {editNodeId ? 'Update Node' : 'Add Node'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default NodeInputDialog;
