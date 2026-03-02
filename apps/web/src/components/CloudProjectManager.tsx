
import { FC, useState, useEffect, useCallback } from 'react';
import { FolderOpen, Trash2, Calendar, FileText, Loader2, Cloud } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { ProjectService, Project } from '../services/ProjectService';
import { useUIStore } from '../store/uiStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

interface CloudProjectManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onLoad: (project: Project) => void;
}

export const CloudProjectManager: FC<CloudProjectManagerProps> = ({ isOpen, onClose, onLoad }) => {
    const { getToken, user } = useAuth();
    const { showNotification } = useUIStore();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const loadProjects = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            const list = await ProjectService.listProjects(token);
            queueMicrotask(() => setProjects(list));
        } catch (err) {
            console.error(err);
            showNotification('error', 'Failed to load projects');
        } finally {
            queueMicrotask(() => setIsLoading(false));
        }
    }, [getToken, showNotification]);

    // Load projects when dialog opens
    useEffect(() => {
        if (isOpen && user) {
            loadProjects();
        }
    }, [isOpen, user, loadProjects]);

    const handleDelete = async (id: string) => {
        try {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');
            await ProjectService.deleteProject(id, token);
            setProjects(prev => prev.filter(p => p._id !== id));
            showNotification('success', 'Project deleted');
            setDeleteId(null);
        } catch {
            showNotification('error', 'Failed to delete project');
        }
    };

    const handleLoad = async (project: Project) => {
        try {
            setIsLoading(true);
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');

            // Fetch full details including data
            const fullProject = await ProjectService.getProject(project._id, token);
            onLoad(fullProject);
            onClose();
        } catch (error) {
            console.error(error);
            showNotification('error', 'Failed to load project details');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col overflow-hidden p-0">

                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                            <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                                My Cloud Projects
                            </DialogTitle>
                            <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                                Manage and load your saved projects
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/50">
                    {isLoading && projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-500 dark:text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <p>Loading projects...</p>
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-60 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                            <FolderOpen className="w-12 h-12 mb-3 opacity-20" />
                            <p className="font-medium">No projects found</p>
                            <p className="text-sm mt-1">Save a project to see it here</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {projects.map(project => (
                                <div
                                    key={project._id}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-blue-500 dark:hover:border-blue-500 transition-colors group relative"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-500 transition-colors">
                                                    {project.name}
                                                </h3>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(project.updatedAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {deleteId === project._id ? (
                                                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded text-xs text-red-600">
                                                    <span>Sure?</span>
                                                    <button type="button" onClick={() => handleDelete(project._id)} className="font-bold hover:underline">Yes</button>
                                                    <button type="button" onClick={() => setDeleteId(null)} className="hover:underline">No</button>
                                                </div>
                                            ) : (
                                                <button type="button"
                                                    onClick={(e) => { e.stopPropagation(); setDeleteId(project._id); }}
                                                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                    title="Delete Project"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 h-10">
                                        {project.description || 'No description provided.'}
                                    </p>

                                    <Button
                                        variant="outline"
                                        onClick={() => handleLoad(project)}
                                        className="w-full"
                                    >
                                        Open Project
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                    <Button variant="ghost" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
