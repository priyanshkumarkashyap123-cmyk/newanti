/**
 * ProjectSaveDialog.tsx - Cloud Project Save
 * 
 * Pro Feature: Save projects to cloud
 * - Save current model
 * - Load saved projects
 * - Pro tier required for saving
 */

import { FC, useState, useEffect, useCallback } from 'react';
import {
    Save,
    Cloud,
    FolderOpen,
    Trash2,
    Crown,
    Loader2,
    Check,
    AlertCircle,
    HardDrive,
    Download,
    Upload
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../providers/AuthProvider';
import { useModelStore } from '../store/model';
import { API_CONFIG } from '../config/env';

// ============================================
// TYPES
// ============================================

interface SavedProject {
    id: string;
    name: string;
    description?: string;
    nodeCount: number;
    memberCount: number;
    updatedAt: string;
}

interface ProjectSaveDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

// ============================================
// COMPONENT
// ============================================

export const ProjectSaveDialog: FC<ProjectSaveDialogProps> = ({ isOpen, onClose }) => {
    const { isSignedIn, getToken } = useAuth();
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);
    const loads = useModelStore((s) => s.loads);
    const memberLoads = useModelStore((s) => s.memberLoads);
    const projectInfo = useModelStore((s) => s.projectInfo);
    const updateProjectInfo = useModelStore((s) => s.setProjectInfo);

    // State
    const [projects, setProjects] = useState<SavedProject[]>([]);
    const [localProjects, setLocalProjects] = useState<SavedProject[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [projectName, setProjectName] = useState(projectInfo?.name || '');
    const [projectDescription, setProjectDescription] = useState(projectInfo?.description || '');
    const [isPro, setIsPro] = useState(false);
    const [activeTab, setActiveTab] = useState<'save' | 'load'>('save');

    const API_BASE = API_CONFIG.baseUrl;

    // Fetch projects and tier info
    useEffect(() => {
        if (!isOpen) return;

        // Always load local projects
        loadLocalProjects();

        if (!isSignedIn) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const token = await getToken();

                // Get tier info
                try {
                    const tierRes = await fetch(`${API_BASE}/api/user/limits`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (tierRes.ok) {
                        const tierData = await tierRes.json();
                        setIsPro(tierData.data?.tier === 'pro' || tierData.data?.tier === 'enterprise');
                    }
                } catch {
                    // Tier check failed - allow save anyway
                    setIsPro(true);
                }

                // Get saved projects
                try {
                    const projRes = await fetch(`${API_BASE}/api/project`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (projRes.ok) {
                        const projData = await projRes.json();
                        setProjects(projData.projects || []);
                    }
                } catch {
                    // Cloud projects unavailable - that's ok
                    console.warn('[ProjectSaveDialog] Cloud projects unavailable');
                }
            } catch (err) {
                console.warn('[ProjectSaveDialog] Failed to load cloud data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isOpen, isSignedIn, getToken, API_BASE]);

    // ========================
    // LOCAL STORAGE HELPERS
    // ========================
    const LOCAL_KEY = 'beamlab-saved-projects';

    const loadLocalProjects = () => {
        try {
            const stored = localStorage.getItem(LOCAL_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as SavedProject[];
                setLocalProjects(parsed);
            }
        } catch {
            setLocalProjects([]);
        }
    };

    const saveToLocalStorage = (project: SavedProject) => {
        try {
            const existing = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as SavedProject[];
            const updated = [project, ...existing.filter(p => p.id !== project.id)].slice(0, 50);
            localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
            setLocalProjects(updated);
        } catch (e) {
            console.error('[ProjectSaveDialog] Local save failed:', e);
            throw new Error('Local storage is full. Please delete some projects.');
        }
    };

    // Save project (local + cloud)
    const handleSave = useCallback(async () => {
        if (!projectName.trim()) {
            setError('Please enter a project name');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            // Serialize model data
            const modelData = {
                nodes: Array.from(nodes.entries()).map(([nodeId, n]) => ({ nodeId, ...n })),
                members: Array.from(members.entries()).map(([memberId, m]) => ({ memberId, ...m })),
                loads,
                memberLoads: memberLoads || [],
                projectInfo: { ...projectInfo, name: projectName, description: projectDescription },
            };

            // ALWAYS save locally first (works for all tiers)
            const localProject: SavedProject = {
                id: `local-${Date.now()}`,
                name: projectName,
                description: projectDescription,
                nodeCount: nodes.size,
                memberCount: members.size,
                updatedAt: new Date().toISOString(),
            };

            // Save to localStorage with full data
            const localEntry = { ...localProject, data: modelData };
            saveToLocalStorage(localEntry);

            // Update project info in store
            if (updateProjectInfo) {
                updateProjectInfo({ name: projectName, description: projectDescription });
            }

            // Also try cloud save if signed in
            if (isSignedIn) {
                try {
                    const token = await getToken();
                    const res = await fetch(`${API_BASE}/api/project`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: projectName,
                            description: projectDescription,
                            data: modelData
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        setProjects(prev => [data.project, ...prev]);
                        setSuccess('Project saved to cloud + local!');
                    } else {
                        setSuccess('Project saved locally! (Cloud save requires Pro tier)');
                    }
                } catch {
                    setSuccess('Project saved locally! (Cloud unavailable)');
                }
            } else {
                setSuccess('Project saved locally! Sign in to save to cloud.');
            }

            setProjectName('');
            setProjectDescription('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error saving project');
        } finally {
            setSaving(false);
        }
    }, [isSignedIn, projectName, projectDescription, nodes, members, loads, memberLoads, projectInfo, getToken, API_BASE, updateProjectInfo]);

    // Load project
    const handleLoad = useCallback(async (projectId: string, isLocal: boolean = false) => {
        setLoading(true);
        setError(null);

        try {
            if (isLocal) {
                // Load from localStorage
                const stored = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
                const project = stored.find((p: any) => p.id === projectId);
                if (project?.data) {
                    const loaded = useModelStore.getState().loadProject(project.data);
                    if (loaded) {
                        setSuccess('Project loaded from local storage!');
                        onClose();
                    } else {
                        setError('Failed to parse project data');
                    }
                } else {
                    setError('Project data not found locally');
                }
            } else if (isSignedIn) {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/api/project/${projectId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    const loaded = useModelStore.getState().loadProject(data.project.data);
                    if (loaded) {
                        setSuccess('Project loaded!');
                        onClose();
                    } else {
                        setError('Failed to parse project data');
                    }
                } else {
                    setError('Failed to load project');
                }
            }
        } catch (err) {
            setError('Error loading project');
        } finally {
            setLoading(false);
        }
    }, [isSignedIn, getToken, onClose, API_BASE]);

    // Delete project
    const handleDelete = useCallback(async (projectId: string, isLocal: boolean = false) => {
        if (!window.confirm('Delete this project?')) return;

        try {
            if (isLocal) {
                const stored = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
                const updated = stored.filter((p: any) => p.id !== projectId);
                localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
                setLocalProjects(updated);
                setSuccess('Project deleted');
            } else if (isSignedIn) {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/api/project/${projectId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    setProjects(prev => prev.filter(p => p.id !== projectId));
                    setSuccess('Project deleted');
                }
            }
        } catch {
            setError('Failed to delete');
        }
    }, [isSignedIn, getToken, API_BASE]);

    // Export project as JSON file
    const handleExport = useCallback(() => {
        try {
            const modelData = {
                nodes: Array.from(nodes.entries()).map(([nodeId, n]) => ({ nodeId, ...n })),
                members: Array.from(members.entries()).map(([memberId, m]) => ({ memberId, ...m })),
                loads,
                memberLoads: memberLoads || [],
                projectInfo: { ...projectInfo, name: projectName || projectInfo?.name },
            };
            const blob = new Blob([JSON.stringify(modelData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectName || 'beamlab-project'}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setSuccess('Project exported!');
        } catch {
            setError('Export failed');
        }
    }, [nodes, members, loads, memberLoads, projectInfo, projectName]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg overflow-hidden p-0">
                {/* Header */}
                <DialogHeader className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600">
                    <div className="flex items-center gap-3">
                        <Cloud className="w-6 h-6 text-white" />
                        <DialogTitle className="text-lg font-bold text-white">Cloud Projects</DialogTitle>
                        {isPro && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 rounded text-yellow-400 text-xs">
                                <Crown className="w-3 h-3" /> PRO
                            </span>
                        )}
                    </div>
                    <DialogDescription className="sr-only">Save or load your structural analysis projects</DialogDescription>
                </DialogHeader>

                {/* Tabs */}
                <div className="flex border-b border-zinc-200 dark:border-zinc-800">
                    <button
                        onClick={() => setActiveTab('save')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'save'
                            ? 'text-blue-400 border-b-2 border-blue-500'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                    >
                        <Save className="w-4 h-4 inline mr-2" />
                        Save Project
                    </button>
                    <button
                        onClick={() => setActiveTab('load')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'load'
                            ? 'text-blue-400 border-b-2 border-blue-500'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                    >
                        <FolderOpen className="w-4 h-4 inline mr-2" />
                        My Projects
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Alerts */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-2 p-3 mb-4 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
                            <Check className="w-4 h-4" />
                            {success}
                        </div>
                    )}

                    {activeTab === 'save' ? (
                        /* Save Tab - Available for ALL users */
                        <div className="space-y-4">
                            <div>
                                <Label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                                    Project Name
                                </Label>
                                <Input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="My Structure"
                                    className="w-full px-4 py-3"
                                />
                            </div>

                            <div>
                                <Label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                                    Description (optional)
                                </Label>
                                <textarea
                                    value={projectDescription}
                                    onChange={(e) => setProjectDescription(e.target.value)}
                                    placeholder="Brief description of this project..."
                                    rows={2}
                                    className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                />
                            </div>

                            <div className="p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
                                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Current Model</div>
                                <div className="flex gap-4 text-zinc-900 dark:text-white">
                                    <span>{nodes.size} nodes</span>
                                    <span>{members.size} members</span>
                                    <span>{loads.length} loads</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {/* Local + Cloud Save */}
                                <Button
                                    onClick={handleSave}
                                    disabled={saving || !projectName.trim()}
                                    className="flex-1 py-3 flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Save className="w-5 h-5" />
                                    )}
                                    Save Project
                                </Button>

                                {/* Export as JSON */}
                                <Button
                                    onClick={handleExport}
                                    disabled={nodes.size === 0}
                                    variant="secondary"
                                    className="px-4 py-3 flex items-center justify-center gap-2"
                                    title="Export as JSON file"
                                >
                                    <Download className="w-5 h-5" />
                                </Button>
                            </div>

                            {!isSignedIn && (
                                <p className="text-xs text-zinc-500 text-center">
                                    Sign in to also save to cloud
                                </p>
                            )}
                            {isSignedIn && !isPro && (
                                <p className="text-xs text-zinc-500 text-center flex items-center justify-center gap-1">
                                    <Crown className="w-3 h-3 text-yellow-500" />
                                    Upgrade to Pro for unlimited cloud storage
                                </p>
                            )}
                        </div>
                    ) : (
                        /* Load Tab */
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                </div>
                            ) : (localProjects.length === 0 && projects.length === 0) ? (
                                <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                                    No saved projects yet
                                </p>
                            ) : (
                                <>
                                    {/* Local Projects */}
                                    {localProjects.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <HardDrive className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Local</span>
                                            </div>
                                            {localProjects.map((proj) => (
                                                <div
                                                    key={proj.id}
                                                    className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors mb-2"
                                                >
                                                    <div>
                                                        <div className="font-medium text-zinc-900 dark:text-white">{proj.name}</div>
                                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                            {proj.nodeCount} nodes • {proj.memberCount} members
                                                            {proj.description && ` • ${proj.description.substring(0, 30)}`}
                                                        </div>
                                                        <div className="text-[10px] text-zinc-500">
                                                            {new Date(proj.updatedAt).toLocaleString()}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleLoad(proj.id, true)}
                                                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded"
                                                            title="Load"
                                                        >
                                                            <FolderOpen className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(proj.id, true)}
                                                            className="p-2 text-red-400 hover:bg-red-500/20 rounded"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Cloud Projects */}
                                    {projects.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                                                <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Cloud</span>
                                            </div>
                                            {projects.map((proj) => (
                                                <div
                                                    key={proj.id}
                                                    className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors mb-2"
                                                >
                                                    <div>
                                                        <div className="font-medium text-zinc-900 dark:text-white">{proj.name}</div>
                                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                            {proj.nodeCount} nodes • {proj.memberCount} members
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleLoad(proj.id)}
                                                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded"
                                                            title="Load"
                                                        >
                                                            <FolderOpen className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(proj.id)}
                                                            className="p-2 text-red-400 hover:bg-red-500/20 rounded"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectSaveDialog;
