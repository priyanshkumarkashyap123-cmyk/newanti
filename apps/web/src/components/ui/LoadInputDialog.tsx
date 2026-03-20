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
    initialPosition?: number; // 0-1 ratio along member, pre-fills position slider
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
    targetMemberId,
    initialPosition
}) => {
    const addLoad = useModelStore((s) => s.addLoad);
    const addMemberLoad = useModelStore((s) => s.addMemberLoad);

    // Form state
    const [loadType, setLoadType] = useState<LoadType>('point');
    const [magnitude, setMagnitude] = useState('10');
    const [direction, setDirection] = useState<Direction>('down');
    const [position, setPosition] = useState('0.5'); // 0-1 ratio along member
    const [magError, setMagError] = useState('');

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            queueMicrotask(() => {
                setLoadType(targetMemberId ? 'udl' : 'point');
                setMagnitude('10');
                setDirection('down');
                setPosition(initialPosition?.toString() ?? '0.5');
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
        const parsedMag = parseFloat(magnitude);
        if (isNaN(parsedMag) || parsedMag <= 0) {
            setMagError('Magnitude must be a positive number');
            return;
        }
        setMagError('');
        // Store magnitudes in canonical store units (kN or kN/m). Do NOT convert to N here.
        const mag = parsedMag;
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
        } else if (loadType === 'point' && targetMemberId) {
            // Point load at arbitrary position on member
            const dir = dirConfig.factor.fy !== 0 ? 'global_y' : 'global_x';
            addMemberLoad({
                id: `ML${Date.now()}`,
                memberId: targetMemberId,
                type: 'point',
                P: mag * (dirConfig.factor.fy || dirConfig.factor.fx || -1),
                a: parseFloat(position),
                direction: dir
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
            <DialogContent className="max-w-lg p-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2 px-6 py-4 bg-orange-600 text-white rounded-t-lg">
                    <ArrowDown className="w-5 h-5" />
                    <h2 className="text-lg font-semibold">Apply Load</h2>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                    {/* Target Info */}
                    <div className="mb-4 p-3 bg-[#131b2e] rounded-lg">
                        <span className="text-sm text-[#869ab8]">
                            Applying to: {' '}
                            <span className="font-medium tracking-wide tracking-wide text-[#dae2fd]">
                                {targetNodeId ? `Node ${targetNodeId}` : targetMemberId ? `Member ${targetMemberId}` : 'Select target'}
                            </span>
                        </span>
                    </div>

                    {/* Load Type */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium tracking-wide tracking-wide text-[#adc6ff] mb-3">
                            Load Type
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'point', label: 'Point Load', icon: '↓', disabled: !targetNodeId && !targetMemberId },
                                { id: 'udl', label: 'UDL', icon: '▼▼▼', disabled: !targetMemberId },
                                { id: 'moment', label: 'Moment', icon: '↺', disabled: !targetNodeId }
                            ].map((type) => (
                                <button type="button"
                                    key={type.id}
                                    onClick={() => !type.disabled && setLoadType(type.id as LoadType)}
                                    disabled={type.disabled}
                                    className={`
                                        flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
                                        ${type.disabled
                                            ? 'opacity-50 cursor-not-allowed'
                                            : loadType === type.id
                                                ? 'border-orange-500 bg-orange-900/30 text-[#dae2fd]'
                                                : 'border-[#1a2333] hover:border-slate-400 dark:hover:border-slate-500 text-[#adc6ff]'
                                        }
                                    `}
                                >
                                    <span className="text-xl">{type.icon}</span>
                                    <span className="text-xs text-[#869ab8]">{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Direction */}
                    {loadType !== 'moment' && (
                        <div className="mb-6">
                            <h3 className="text-sm font-medium tracking-wide tracking-wide text-[#adc6ff] mb-3">
                                Direction
                            </h3>
                            <div className="grid grid-cols-4 gap-2">
                                {(['down', 'up', 'left', 'right'] as const).map((dir) => {
                                    const icons = { down: ArrowDown, up: ArrowUp, left: ArrowLeft, right: ArrowRight };
                                    const Icon = icons[dir];
                                    return (
                                        <button type="button"
                                            key={dir}
                                            onClick={() => setDirection(dir)}
                                            className={`
                                                flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
                                                ${direction === dir
                                                    ? 'border-orange-500 bg-orange-900/30 text-[#dae2fd]'
                                                    : 'border-[#1a2333] hover:border-slate-400 dark:hover:border-slate-500 text-[#adc6ff]'
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
                            <h3 className="text-sm font-medium tracking-wide tracking-wide text-[#adc6ff] mb-3">
                                Rotation
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                {(['cw', 'ccw'] as Direction[]).map((dir) => (
                                    <button type="button"
                                        key={dir}
                                        onClick={() => setDirection(dir)}
                                        className={`
                                            flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all
                                            ${direction === dir
                                                ? 'border-orange-500 bg-orange-900/30 text-[#dae2fd]'
                                                : 'border-[#1a2333] hover:border-slate-400 dark:hover:border-slate-500 text-[#adc6ff]'
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

                    {/* Position along member (for point loads on members) */}
                    {loadType === 'point' && targetMemberId && (
                        <div className="mb-6">
                            <h3 className="text-sm font-medium tracking-wide tracking-wide text-[#adc6ff] mb-3">
                                Position along Member
                            </h3>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={position}
                                    onChange={(e) => setPosition(e.target.value)}
                                    className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                    style={{ background: `linear-gradient(to right, #f97316 0%, #f97316 ${parseFloat(position) * 100}%, #334155 ${parseFloat(position) * 100}%, #334155 100%)` }}
                                />
                                <input
                                    type="number"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={position}
                                    onChange={(e) => {
                                        const v = Math.min(1, Math.max(0, parseFloat(e.target.value) || 0));
                                        setPosition(v.toString());
                                    }}
                                    className="w-16 px-2 py-1 text-center rounded border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] text-sm"
                                />
                            </div>
                            <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                                <span>Start (0)</span>
                                <span>{(parseFloat(position) * 100).toFixed(0)}% along member</span>
                                <span>End (1)</span>
                            </div>
                        </div>
                    )}

                    {/* Magnitude */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium tracking-wide tracking-wide text-[#adc6ff] mb-3">
                            Magnitude
                        </h3>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                step="1"
                                value={magnitude}
                                onChange={(e) => setMagnitude(e.target.value)}
                                className="flex-1 px-4 py-3 rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] text-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                            <span className="text-[#869ab8] font-medium tracking-wide tracking-wide">
                                {loadType === 'moment' ? 'kN·m' : loadType === 'udl' ? 'kN/m' : 'kN'}
                            </span>
                        </div>
                        {magError && (
                            <p className="mt-2 text-xs text-red-500">{magError}</p>
                        )}
                        {/* Quick magnitude buttons */}
                        <div className="flex gap-2 mt-3">
                            {[5, 10, 20, 50, 100].map((val) => (
                                <button type="button"
                                    key={val}
                                    onClick={() => setMagnitude(val.toString())}
                                    className={`
                                        px-3 py-1 text-xs rounded transition-colors
                                        ${magnitude === val.toString()
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-[#131b2e] hover:bg-slate-200 dark:hover:bg-slate-700 text-[#adc6ff]'
                                        }
                                    `}
                                >
                                    {val}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="p-4 bg-[#131b2e] rounded-lg">
                        <div className="flex items-center justify-center gap-3">
                            <DirIcon className={`w-8 h-8 text-orange-500 ${direction === 'ccw' ? 'scale-x-[-1]' : ''}`} />
                            <div className="text-center">
                                <div className="text-2xl font-bold text-[#dae2fd]">
                                    {magnitude} {loadType === 'moment' ? 'kN·m' : loadType === 'udl' ? 'kN/m' : 'kN'}
                                </div>
                                <div className="text-xs text-[#869ab8]">
                                    {dirConfig.label}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="px-6 py-4 bg-[#131b2e] border-t border-[#1a2333]">
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
