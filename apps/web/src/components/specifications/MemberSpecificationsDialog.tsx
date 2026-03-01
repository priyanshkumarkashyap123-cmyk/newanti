import { FC, useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useModelStore, Member } from '../../store/model';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';

interface MemberSpecificationsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    memberId: string | null;
}

type Tab = 'releases' | 'offsets' | 'beta';

export const MemberSpecificationsDialog: FC<MemberSpecificationsDialogProps> = ({ isOpen, onClose, memberId }) => {
    const members = useModelStore((s) => s.members);
    const updateMember = useModelStore((s) => s.updateMember);
    const selectedIds = useModelStore((s) => s.selectedIds);

    const [activeTab, setActiveTab] = useState<Tab>('releases');

    // Local state for edits
    const [releases, setReleases] = useState<{
        fxStart: boolean; fyStart: boolean; fzStart: boolean;
        mxStart: boolean; myStart: boolean; mzStart: boolean;
        fxEnd: boolean; fyEnd: boolean; fzEnd?: boolean;
        mxEnd: boolean; myEnd: boolean; mzEnd: boolean;
    }>({
        fxStart: false, fyStart: false, fzStart: false, mxStart: false, myStart: false, mzStart: false,
        fxEnd: false, fyEnd: false, fzEnd: false, mxEnd: false, myEnd: false, mzEnd: false
    });

    const [offsets, setOffsets] = useState({
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 0, z: 0 }
    });

    const [betaAngle, setBetaAngle] = useState(0);

    // Load initial values from selected member(s)
    useEffect(() => {
        if (!isOpen) return;

        let targetMember: Member | undefined;

        if (memberId) {
            targetMember = members.get(memberId);
        } else if (selectedIds.size > 0) {
            // Find first member in selection
            for (const id of selectedIds) {
                if (members.has(id)) {
                    targetMember = members.get(id);
                    break;
                }
            }
        }

        if (targetMember) {
            queueMicrotask(() => {
                setReleases({
                    fxStart: targetMember!.releases?.fxStart ?? false,
                    fyStart: targetMember!.releases?.fyStart ?? false,
                    fzStart: targetMember!.releases?.fzStart ?? false,
                    mxStart: targetMember!.releases?.mxStart ?? targetMember!.releases?.startMoment ?? false,
                    myStart: targetMember!.releases?.myStart ?? false,
                    mzStart: targetMember!.releases?.mzStart ?? false,
                    fxEnd: targetMember!.releases?.fxEnd ?? false,
                    fyEnd: targetMember!.releases?.fyEnd ?? false,
                    fzEnd: targetMember!.releases?.fzEnd ?? false,
                    mxEnd: targetMember!.releases?.mxEnd ?? targetMember!.releases?.endMoment ?? false,
                    myEnd: targetMember!.releases?.myEnd ?? false,
                    mzEnd: targetMember!.releases?.mzEnd ?? false,
                });

                setOffsets({
                    start: targetMember!.startOffset ?? { x: 0, y: 0, z: 0 },
                    end: targetMember!.endOffset ?? { x: 0, y: 0, z: 0 }
                });

                setBetaAngle(targetMember!.betaAngle ?? 0);
            });
        }
    }, [isOpen, memberId, selectedIds, members]);

    const handleApply = () => {
        const idsToUpdate: string[] = [];

        if (memberId) {
            idsToUpdate.push(memberId);
        } else {
            selectedIds.forEach(id => {
                if (members.has(id)) idsToUpdate.push(id);
            });
        }

        const updates = new Map();
        idsToUpdate.forEach(id => {
            updates.set(id, {
                releases: { ...releases },
                startOffset: { ...offsets.start },
                endOffset: { ...offsets.end },
                betaAngle
            });
        });

        // Batch update
        const updateMembers = useModelStore.getState().updateMembers;
        updateMembers(updates);

        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Member Specifications</DialogTitle>
                    <DialogDescription>Configure releases, offsets, and beta angle for selected members.</DialogDescription>
                </DialogHeader>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 dark:border-slate-800">
                        {(['releases', 'offsets', 'beta'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab
                                    ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-500 bg-violet-500/10'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tab === 'beta' ? 'Angle' : ''})
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="py-4">
                        {activeTab === 'releases' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-8">
                                    {/* Start Node */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-300 dark:border-slate-700 pb-1">Start Node</h3>
                                        <div className="space-y-2">
                                            {['fx', 'fy', 'fz', 'mx', 'my', 'mz'].map((dof) => (
                                                <label key={`start-${dof}`} className="flex items-center justify-between group cursor-pointer">
                                                    <span className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 font-mono uppercase">{dof}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={(releases as any)[`${dof}Start`]}
                                                        onChange={(e) => setReleases(prev => ({ ...prev, [`${dof}Start`]: e.target.checked }))}
                                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-violet-600 focus:ring-violet-500 focus:ring-offset-white dark:focus:ring-offset-slate-900"
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* End Node */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-300 dark:border-slate-700 pb-1">End Node</h3>
                                        <div className="space-y-2">
                                            {['fx', 'fy', 'fz', 'mx', 'my', 'mz'].map((dof) => (
                                                <label key={`end-${dof}`} className="flex items-center justify-between group cursor-pointer">
                                                    <span className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 font-mono uppercase">{dof}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={(releases as any)[`${dof}End`]}
                                                        onChange={(e) => setReleases(prev => ({ ...prev, [`${dof}End`]: e.target.checked }))}
                                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-violet-600 focus:ring-violet-500 focus:ring-offset-white dark:focus:ring-offset-slate-900"
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                    Checked = Released (Free to move/rotate). Unchecked = Fixed.
                                </p>
                            </div>
                        )}

                        {activeTab === 'offsets' && (
                            <div className="space-y-6">
                                {/* Start Node Offsets */}
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Start Node Offsets (Global)</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['x', 'y', 'z'].map((axis) => (
                                            <div key={`start-${axis}`}>
                                                <Label className="text-xs uppercase mb-1">{axis} (m)</Label>
                                                <Input
                                                    type="number"
                                                    value={(offsets.start as any)[axis]}
                                                    onChange={(e) => setOffsets(prev => ({
                                                        ...prev,
                                                        start: { ...prev.start, [axis]: parseFloat(e.target.value) || 0 }
                                                    }))}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* End Node Offsets */}
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">End Node Offsets (Global)</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['x', 'y', 'z'].map((axis) => (
                                            <div key={`end-${axis}`}>
                                                <Label className="text-xs uppercase mb-1">{axis} (m)</Label>
                                                <Input
                                                    type="number"
                                                    value={(offsets.end as any)[axis]}
                                                    onChange={(e) => setOffsets(prev => ({
                                                        ...prev,
                                                        end: { ...prev.end, [axis]: parseFloat(e.target.value) || 0 }
                                                    }))}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'beta' && (
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-sm font-semibold mb-2">Beta Angle (Degrees)</Label>
                                    <div className="flex items-center gap-4">
                                        <Input
                                            type="number"
                                            value={betaAngle}
                                            onChange={(e) => setBetaAngle(parseFloat(e.target.value) || 0)}
                                            className="w-32"
                                        />
                                        <div className="flex gap-2">
                                            {[0, 90, 180, 270].map(angle => (
                                                <Button
                                                    key={angle}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setBetaAngle(angle)}
                                                >
                                                    {angle}°
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                        Rotation about the local x-axis. Positive is clockwise when looking from start to end.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleApply} className="bg-violet-600 hover:bg-violet-700 text-white">
                            <Check className="w-4 h-4 mr-2" />
                            Apply Changes
                        </Button>
                    </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
