import { FC, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { useModelStore, Member } from '../../store/model';

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
            setReleases({
                fxStart: targetMember.releases?.fxStart ?? false,
                fyStart: targetMember.releases?.fyStart ?? false,
                fzStart: targetMember.releases?.fzStart ?? false,
                mxStart: targetMember.releases?.mxStart ?? targetMember.releases?.startMoment ?? false,
                myStart: targetMember.releases?.myStart ?? false,
                mzStart: targetMember.releases?.mzStart ?? false,
                fxEnd: targetMember.releases?.fxEnd ?? false,
                fyEnd: targetMember.releases?.fyEnd ?? false,
                fzEnd: targetMember.releases?.fzEnd ?? false,
                mxEnd: targetMember.releases?.mxEnd ?? targetMember.releases?.endMoment ?? false,
                myEnd: targetMember.releases?.myEnd ?? false,
                mzEnd: targetMember.releases?.mzEnd ?? false,
            });

            setOffsets({
                start: targetMember.startOffset ?? { x: 0, y: 0, z: 0 },
                end: targetMember.endOffset ?? { x: 0, y: 0, z: 0 }
            });

            setBetaAngle(targetMember.betaAngle ?? 0);
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

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
                        <h2 className="text-lg font-bold text-white">Member Specifications</h2>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-zinc-800">
                        {(['releases', 'offsets', 'beta'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab
                                    ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/10'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tab === 'beta' ? 'Angle' : ''})
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {activeTab === 'releases' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-8">
                                    {/* Start Node */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-300 mb-3 border-b border-zinc-700 pb-1">Start Node</h3>
                                        <div className="space-y-2">
                                            {['fx', 'fy', 'fz', 'mx', 'my', 'mz'].map((dof) => (
                                                <label key={`start-${dof}`} className="flex items-center justify-between group cursor-pointer">
                                                    <span className="text-sm text-zinc-400 group-hover:text-zinc-300 font-mono uppercase">{dof}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={(releases as any)[`${dof}Start`]}
                                                        onChange={(e) => setReleases(prev => ({ ...prev, [`${dof}Start`]: e.target.checked }))}
                                                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-violet-600 focus:ring-violet-500 focus:ring-offset-zinc-900"
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* End Node */}
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-300 mb-3 border-b border-zinc-700 pb-1">End Node</h3>
                                        <div className="space-y-2">
                                            {['fx', 'fy', 'fz', 'mx', 'my', 'mz'].map((dof) => (
                                                <label key={`end-${dof}`} className="flex items-center justify-between group cursor-pointer">
                                                    <span className="text-sm text-zinc-400 group-hover:text-zinc-300 font-mono uppercase">{dof}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={(releases as any)[`${dof}End`]}
                                                        onChange={(e) => setReleases(prev => ({ ...prev, [`${dof}End`]: e.target.checked }))}
                                                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-violet-600 focus:ring-violet-500 focus:ring-offset-zinc-900"
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-500 italic">
                                    Checked = Released (Free to move/rotate). Unchecked = Fixed.
                                </p>
                            </div>
                        )}

                        {activeTab === 'offsets' && (
                            <div className="space-y-6">
                                {/* Start Node Offsets */}
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-300 mb-3">Start Node Offsets (Global)</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['x', 'y', 'z'].map((axis) => (
                                            <div key={`start-${axis}`}>
                                                <label className="text-xs text-zinc-500 uppercase block mb-1">{axis} (m)</label>
                                                <input
                                                    type="number"
                                                    value={(offsets.start as any)[axis]}
                                                    onChange={(e) => setOffsets(prev => ({
                                                        ...prev,
                                                        start: { ...prev.start, [axis]: parseFloat(e.target.value) || 0 }
                                                    }))}
                                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* End Node Offsets */}
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-300 mb-3">End Node Offsets (Global)</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['x', 'y', 'z'].map((axis) => (
                                            <div key={`end-${axis}`}>
                                                <label className="text-xs text-zinc-500 uppercase block mb-1">{axis} (m)</label>
                                                <input
                                                    type="number"
                                                    value={(offsets.end as any)[axis]}
                                                    onChange={(e) => setOffsets(prev => ({
                                                        ...prev,
                                                        end: { ...prev.end, [axis]: parseFloat(e.target.value) || 0 }
                                                    }))}
                                                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
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
                                    <label className="text-sm font-semibold text-zinc-300 block mb-2">Beta Angle (Degrees)</label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="number"
                                            value={betaAngle}
                                            onChange={(e) => setBetaAngle(parseFloat(e.target.value) || 0)}
                                            className="w-32 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                        />
                                        <div className="flex gap-2">
                                            {[0, 90, 180, 270].map(angle => (
                                                <button
                                                    key={angle}
                                                    onClick={() => setBetaAngle(angle)}
                                                    className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 text-zinc-300"
                                                >
                                                    {angle}°
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-2">
                                        Rotation about the local x-axis. Positive is clockwise when looking from start to end.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-6 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2"
                        >
                            <Check className="w-4 h-4" />
                            Apply Changes
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
