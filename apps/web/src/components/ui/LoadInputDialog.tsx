/**
 * LoadInputDialog - Intuitive Load Application
 * 
 * Modal for applying loads to nodes or members:
 * - Load type selector (Point, UDL, Moment)
 * - Direction buttons with visual preview
 * - Magnitude input with unit display
 */

import { FC, useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight, RotateCw } from 'lucide-react';
import { useModelStore } from '../../store/model';
import { Dialog, DialogContent, DialogFooter } from './dialog';
import { Button } from './button';

// ============================================
// TYPES
// ============================================

interface LoadInputDialogProps {
    isOpen: boolean;
    onClose: () => void;
    targetNodeId?: string;
    targetMemberId?: string;
}

type LoadType = 'point' | 'udl' | 'moment';
type Direction = 'down' | 'up' | 'left' | 'right' | 'cw' | 'ccw';

// ============================================
// COMPONENT
// ============================================

export const LoadInputDialog: FC<LoadInputDialogProps> = ({
    isOpen,
    onClose,
    targetNodeId,
    targetMemberId
}) => {
    const addLoad = useModelStore((s) => s.addLoad);
    const addMemberLoad = useModelStore((s) => s.addMemberLoad);

    // Form state
    const [loadType, setLoadType] = useState<LoadType>('point');
    const [magnitude, setMagnitude] = useState('10');
    const [direction, setDirection] = useState<Direction>('down');

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            queueMicrotask(() => {
                setLoadType(targetMemberId ? 'udl' : 'point');
                setMagnitude('10');
                setDirection('down');
            });
        }
    }, [isOpen, targetMemberId]);

    // Get direction icon and label
    const getDirectionConfig = () => {
        switch (direction) {
            case 'down': return { icon: ArrowDown, label: 'Downward (-Y)', factor: { fx: 0, fy: -1 } };
            case 'up': return { icon: ArrowUp, label: 'Upward (+Y)', factor: { fx: 0, fy: 1 } };
            case 'left': return { icon: ArrowLeft, label: 'Left (-X)', factor: { fx: -1, fy: 0 } };
            case 'right': return { icon: ArrowRight, label: 'Right (+X)', factor: { fx: 1, fy: 0 } };
            case 'cw': return { icon: RotateCw, label: 'Clockwise', factor: { fx: 0, fy: 0, mz: 1 } };
            case 'ccw': return { icon: RotateCw, label: 'Counter-CW', factor: { fx: 0, fy: 0, mz: -1 } };
        }
    };

    // Submit handler
    const handleSubmit = () => {
        const mag = parseFloat(magnitude) * 1000; // Convert kN to N
        const dirConfig = getDirectionConfig();

        if (loadType === 'point' && targetNodeId) {
            addLoad({
                id: `L${Date.now()}`,
                nodeId: targetNodeId,
                fx: mag * (dirConfig.factor.fx ?? 0),
                fy: mag * (dirConfig.factor.fy ?? 0),
                fz: 0,
                mx: 0,
                my: 0,
                mz: 0
            });
        } else if (loadType === 'moment' && targetNodeId) {
            addLoad({
                id: `L${Date.now()}`,
                nodeId: targetNodeId,
                fx: 0,
                fy: 0,
                fz: 0,
                mx: 0,
                my: 0,
                mz: mag * ((dirConfig.factor as { mz?: number }).mz ?? 0)
            });
        } else if (loadType === 'udl' && targetMemberId) {
            addMemberLoad({
                id: `ML${Date.now()}`,
                memberId: targetMemberId,
                type: 'UDL',
                w1: mag * (dirConfig.factor.fy ?? -1), // Default to gravity direction
                w2: mag * (dirConfig.factor.fy ?? -1),
                direction: 'global_y'
            });
        }

        onClose();
    };

    const dirConfig = getDirectionConfig();
    const DirIcon = dirConfig.icon;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md p-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2 px-6 py-4 bg-orange-600 text-white rounded-t-lg">
                    <ArrowDown className="w-5 h-5" />
                    <h2 className="text-lg font-semibold">Apply Load</h2>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                    {/* Target Info */}
                    <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            Applying to: {' '}
                            <span className="font-medium text-slate-900 dark:text-white">
                                {targetNodeId ? `Node ${targetNodeId}` : targetMemberId ? `Member ${targetMemberId}` : 'Select target'}
                            </span>
                        </span>
                    </div>

                    {/* Load Type */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            Load Type
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'point', label: 'Point Load', icon: '↓', disabled: !targetNodeId },
                                { id: 'udl', label: 'UDL', icon: '▼▼▼', disabled: !targetMemberId },
                                { id: 'moment', label: 'Moment', icon: '↺', disabled: !targetNodeId }
                            ].map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => !type.disabled && setLoadType(type.id as LoadType)}
                                    disabled={type.disabled}
                                    className={`
                                        flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
                                        ${type.disabled
                                            ? 'opacity-50 cursor-not-allowed'
                                            : loadType === type.id
                                                ? 'border-orange-500 bg-orange-900/30 text-slate-900 dark:text-white'
                                                : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300'
                                        }
                                    `}
                                >
                                    <span className="text-xl">{type.icon}</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Direction */}
                    {loadType !== 'moment' && (
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                Direction
                            </h3>
                            <div className="grid grid-cols-4 gap-2">
                                {(['down', 'up', 'left', 'right'] as const).map((dir) => {
                                    const icons = { down: ArrowDown, up: ArrowUp, left: ArrowLeft, right: ArrowRight };
                                    const Icon = icons[dir];
                                    return (
                                        <button
                                            key={dir}
                                            onClick={() => setDirection(dir)}
                                            className={`
                                                flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
                                                ${direction === dir
                                                    ? 'border-orange-500 bg-orange-900/30 text-slate-900 dark:text-white'
                                                    : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300'
                                                }
                                            `}
                                        >
                                            <Icon className="w-5 h-5" />
                                            <span className="text-[10px] capitalize">{dir}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Moment Direction */}
                    {loadType === 'moment' && (
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                Rotation
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                {(['cw', 'ccw'] as Direction[]).map((dir) => (
                                    <button
                                        key={dir}
                                        onClick={() => setDirection(dir)}
                                        className={`
                                            flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all
                                            ${direction === dir
                                                ? 'border-orange-500 bg-orange-900/30 text-slate-900 dark:text-white'
                                                : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300'
                                            }
                                        `}
                                    >
                                        <RotateCw className={`w-5 h-5 ${dir === 'ccw' ? 'scale-x-[-1]' : ''}`} />
                                        <span className="text-xs">{dir === 'cw' ? 'Clockwise' : 'Counter-CW'}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Magnitude */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            Magnitude
                        </h3>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                step="1"
                                value={magnitude}
                                onChange={(e) => setMagnitude(e.target.value)}
                                className="flex-1 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                                {loadType === 'moment' ? 'kN·m' : loadType === 'udl' ? 'kN/m' : 'kN'}
                            </span>
                        </div>
                        {/* Quick magnitude buttons */}
                        <div className="flex gap-2 mt-3">
                            {[5, 10, 20, 50, 100].map((val) => (
                                <button
                                    key={val}
                                    onClick={() => setMagnitude(val.toString())}
                                    className={`
                                        px-3 py-1 text-xs rounded transition-colors
                                        ${magnitude === val.toString()
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                        }
                                    `}
                                >
                                    {val}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center justify-center gap-3">
                            <DirIcon className={`w-8 h-8 text-orange-500 ${direction === 'ccw' ? 'scale-x-[-1]' : ''}`} />
                            <div className="text-center">
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {magnitude} {loadType === 'moment' ? 'kN·m' : loadType === 'udl' ? 'kN/m' : 'kN'}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {dirConfig.label}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-300 dark:border-slate-700">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!targetNodeId && !targetMemberId}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                        Apply Load
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default LoadInputDialog;
