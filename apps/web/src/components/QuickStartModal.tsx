/**
 * QuickStartModal - First-Time User Welcome Modal
 * 
 * Provides quick start options:
 * - New empty project
 * - Pre-built sample structures
 * - Tutorial link
 */

import { FC, useState } from 'react';
import { X, Plus, FileText, Bookmark, Play } from 'lucide-react';
import { ALL_SAMPLES, type SampleStructure } from '../data/SampleStructures';
import { useModelStore } from '../store/model';

// ============================================
// TYPES
// ============================================

interface QuickStartModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// ============================================
// COMPONENT
// ============================================

export const QuickStartModal: FC<QuickStartModalProps> = ({ isOpen, onClose }) => {
    const [selectedSample, setSelectedSample] = useState<SampleStructure | null>(null);

    // Model store actions
    const addNode = useModelStore((s) => s.addNode);
    const addMember = useModelStore((s) => s.addMember);
    const addLoad = useModelStore((s) => s.addLoad);
    const addMemberLoad = useModelStore((s) => s.addMemberLoad);
    const clearModel = useModelStore((s) => s.clearModel);

    if (!isOpen) return null;

    const handleLoadSample = (sample: SampleStructure) => {
        // Clear existing model
        clearModel();

        // Add nodes
        sample.nodes.forEach(node => addNode(node));

        // Add members
        sample.members.forEach(member => addMember(member));

        // Add loads
        sample.loads.forEach(load => addLoad(load));

        // Add member loads
        sample.memberLoads.forEach(load => addMemberLoad(load));

        onClose();
    };

    const handleNewProject = () => {
        clearModel();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="relative px-8 pt-8 pb-4">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 mb-4">
                            <span className="text-3xl">⬡</span>
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                            Welcome to BeamLab
                        </h2>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                            Get started with structural analysis
                        </p>
                    </div>
                </div>

                {/* Options */}
                <div className="px-8 pb-6">
                    {/* Quick Actions */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <button
                            onClick={handleNewProject}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                                <Plus className="w-5 h-5 text-zinc-500 group-hover:text-blue-600" />
                            </div>
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">New Project</span>
                        </button>

                        <button
                            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-900/50 transition-colors">
                                <FileText className="w-5 h-5 text-zinc-500 group-hover:text-green-600" />
                            </div>
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Open File</span>
                        </button>

                        <button
                            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 transition-colors">
                                <Play className="w-5 h-5 text-zinc-500 group-hover:text-purple-600" />
                            </div>
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tutorial</span>
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                        <span className="text-sm text-zinc-400">or start from a template</span>
                        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                    </div>

                    {/* Sample Structures */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ALL_SAMPLES.map(sample => (
                            <button
                                key={sample.id}
                                onClick={() => setSelectedSample(sample)}
                                onDoubleClick={() => handleLoadSample(sample)}
                                className={`
                                    flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all
                                    ${selectedSample?.id === sample.id
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                    }
                                `}
                            >
                                <div className={`
                                    w-12 h-12 rounded-lg flex items-center justify-center text-2xl
                                    ${selectedSample?.id === sample.id
                                        ? 'bg-blue-100 dark:bg-blue-900/50'
                                        : 'bg-zinc-100 dark:bg-zinc-800'
                                    }
                                `}>
                                    {sample.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-zinc-900 dark:text-white">
                                        {sample.name}
                                    </h4>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                                        {sample.description}
                                    </p>
                                </div>
                                <Bookmark className={`
                                    w-4 h-4 flex-shrink-0
                                    ${selectedSample?.id === sample.id
                                        ? 'text-blue-500'
                                        : 'text-zinc-300 dark:text-zinc-600'
                                    }
                                `} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                {selectedSample && (
                    <div className="px-8 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">{selectedSample.name}</span>
                                {' · '}
                                {selectedSample.nodes.length} nodes, {selectedSample.members.length} members
                            </div>
                            <button
                                onClick={() => handleLoadSample(selectedSample)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Load Template
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuickStartModal;
