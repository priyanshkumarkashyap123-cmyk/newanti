/**
 * QuickStartModal - First-Time User Welcome Modal
 * 
 * Provides quick start options:
 * - New empty project
 * - Pre-built sample structures
 * - Tutorial link
 * - Resume last project
 */

import { FC, useState, useEffect } from 'react';
import { Plus, FileText, Bookmark, Play, Building2, Layers, Weight, RotateCcw } from 'lucide-react';
import { ALL_SAMPLES, type SampleStructure } from '../data/SampleStructures';
import { useModelStore, loadProjectFromStorage, getSavedProjectInfo } from '../store/model';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

// ============================================
// TYPES
// ============================================

interface QuickStartModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenWizard?: () => void;
    onOpenFoundation?: () => void;
    onOpenLoads?: () => void;
    onNewProject?: () => void; // NEW: Opens ProjectDetailsDialog
}

// ============================================
// COMPONENT
// ============================================

export const QuickStartModal: FC<QuickStartModalProps> = ({
    isOpen,
    onClose,
    onOpenWizard,
    onOpenFoundation,
    onOpenLoads,
    onNewProject
}) => {
    const [selectedSample, setSelectedSample] = useState<SampleStructure | null>(null);
    const [savedProject, setSavedProject] = useState<{ name: string; savedAt: string } | null>(null);

    // Model store actions
    const addNode = useModelStore((s) => s.addNode);
    const addMember = useModelStore((s) => s.addMember);
    const addLoad = useModelStore((s) => s.addLoad);
    const addMemberLoad = useModelStore((s) => s.addMemberLoad);
    const clearModel = useModelStore((s) => s.clearModel);

    // Check for saved project on mount
    useEffect(() => {
        if (isOpen) {
            // Defer to avoid synchronous setState at effect start
            queueMicrotask(() => {
                const info = getSavedProjectInfo();
                setSavedProject(info);
            });
        }
    }, [isOpen]);

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
        if (onNewProject) {
            // Open project details dialog
            onNewProject();
        } else {
            // Fallback: just clear and close
            clearModel();
            onClose();
        }
    };

    const handleResumeProject = () => {
        const success = loadProjectFromStorage();
        if (success) {
            onClose();
        }
    };

    // Format saved date
    const formatSavedDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return 'Unknown';
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 mb-4">
                            <span className="text-3xl">⬡</span>
                        </div>
                        <DialogTitle className="text-2xl">
                            Welcome to BeamLab
                        </DialogTitle>
                        <DialogDescription className="mt-2">
                            Get started with structural analysis
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {/* Options */}
                <div className="px-8 pb-6">
                    {/* Quick Actions */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <button
                            onClick={handleNewProject}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                                <Plus className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-blue-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">New Project</span>
                        </button>

                        {/* Resume Last Project - only show if saved project exists */}
                        {savedProject ? (
                            <button
                                onClick={handleResumeProject}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/20 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-800/50 transition-colors">
                                    <RotateCcw className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <span className="text-sm font-medium text-green-700 dark:text-green-300">Resume</span>
                                <span className="text-xs text-green-600/70 dark:text-green-400/70 truncate max-w-full">{savedProject.name}</span>
                            </button>
                        ) : (
                            <button
                                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-900/50 transition-colors">
                                    <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-green-600" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Open File</span>
                            </button>
                        )}

                        <button
                            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 transition-colors">
                                <Play className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-purple-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tutorial</span>
                        </button>

                        <button
                            onClick={() => {
                                onClose();
                                onOpenWizard?.();
                            }}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-orange-100 dark:group-hover:bg-orange-900/50 transition-colors">
                                <Building2 className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-orange-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Structure Wizard</span>
                        </button>

                        <button
                            onClick={() => {
                                onClose();
                                onOpenFoundation?.();
                            }}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 transition-colors">
                                <Layers className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-amber-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Foundation Design</span>
                        </button>

                        <button
                            onClick={() => {
                                onClose();
                                onOpenLoads?.();
                            }}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/50 transition-colors">
                                <Weight className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-cyan-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">IS 875 Loads</span>
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                        <span className="text-sm text-slate-500 dark:text-slate-400">or start from a template</span>
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
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
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                    }
                                `}
                            >
                                <div className={`
                                    w-12 h-12 rounded-lg flex items-center justify-center text-2xl
                                    ${selectedSample?.id === sample.id
                                        ? 'bg-blue-100 dark:bg-blue-900/50'
                                        : 'bg-slate-100 dark:bg-slate-800'
                                    }
                                `}>
                                    {sample.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-slate-900 dark:text-white">
                                        {sample.name}
                                    </h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                        {sample.description}
                                    </p>
                                </div>
                                <Bookmark className={`
                                    w-4 h-4 flex-shrink-0
                                    ${selectedSample?.id === sample.id
                                        ? 'text-blue-500'
                                        : 'text-slate-600 dark:text-slate-500'
                                    }
                                `} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                {selectedSample && (
                    <DialogFooter className="flex items-center justify-between sm:justify-between">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{selectedSample.name}</span>
                            {' · '}
                            {selectedSample.nodes.length} nodes, {selectedSample.members.length} members
                        </div>
                        <Button onClick={() => handleLoadSample(selectedSample)}>
                            Load Template
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default QuickStartModal;
