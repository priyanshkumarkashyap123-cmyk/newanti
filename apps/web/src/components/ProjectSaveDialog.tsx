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
    X,
    Save,
    Cloud,
    FolderOpen,
    Trash2,
    Crown,
    Loader2,
    Check,
    AlertCircle
} from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { useModelStore } from '../store/model';

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

    // State
    const [projects, setProjects] = useState<SavedProject[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [projectName, setProjectName] = useState('');
    const [isPro, setIsPro] = useState(false);
    const [activeTab, setActiveTab] = useState<'save' | 'load'>('save');

    // Fetch projects and tier info
    useEffect(() => {
        if (!isOpen || !isSignedIn) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const token = await getToken();

                // Get tier info
                const tierRes = await fetch('/api/user/limits', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (tierRes.ok) {
                    const tierData = await tierRes.json();
                    setIsPro(tierData.data?.tier === 'pro' || tierData.data?.tier === 'enterprise');
                }

                // Get saved projects
                const projRes = await fetch('/api/project', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (projRes.ok) {
                    const projData = await projRes.json();
                    setProjects(projData.projects || []);
                }
            } catch (err) {
                setError('Failed to load projects');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isOpen, isSignedIn, getToken]);

    // Save project
    const handleSave = useCallback(async () => {
        if (!isSignedIn || !isPro) return;
        if (!projectName.trim()) {
            setError('Please enter a project name');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const token = await getToken();

            // Serialize model data
            const modelData = {
                nodes: Array.from(nodes.entries()).map(([nodeId, n]) => ({ nodeId, ...n })),
                members: Array.from(members.entries()).map(([memberId, m]) => ({ memberId, ...m })),
                loads
            };

            const res = await fetch('/api/project', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: projectName,
                    data: modelData
                })
            });

            if (res.ok) {
                const data = await res.json();
                setSuccess('Project saved successfully!');
                setProjects(prev => [data.project, ...prev]);
                setProjectName('');
            } else {
                setError('Failed to save project');
            }
        } catch (err) {
            setError('Error saving project');
        } finally {
            setSaving(false);
        }
    }, [isSignedIn, isPro, projectName, nodes, members, loads, getToken]);

    // Load project
    const handleLoad = useCallback(async (projectId: string) => {
        if (!isSignedIn) return;

        setLoading(true);
        setError(null);

        try {
            const token = await getToken();
            const res = await fetch(`/api/project/${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                // Load project using the new loadProject function
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
        } catch (err) {
            setError('Error loading project');
        } finally {
            setLoading(false);
        }
    }, [isSignedIn, getToken, onClose]);

    // Delete project
    const handleDelete = useCallback(async (projectId: string) => {
        if (!isSignedIn || !window.confirm('Delete this project?')) return;

        try {
            const token = await getToken();
            const res = await fetch(`/api/project/${projectId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                setProjects(prev => prev.filter(p => p.id !== projectId));
                setSuccess('Project deleted');
            }
        } catch {
            setError('Failed to delete');
        }
    }, [isSignedIn, getToken]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-zinc-900 rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600">
                    <div className="flex items-center gap-3">
                        <Cloud className="w-6 h-6 text-white" />
                        <h2 className="text-lg font-bold text-white">Cloud Projects</h2>
                        {isPro && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 rounded text-yellow-400 text-xs">
                                <Crown className="w-3 h-3" /> PRO
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-800">
                    <button
                        onClick={() => setActiveTab('save')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'save'
                            ? 'text-blue-400 border-b-2 border-blue-500'
                            : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <Save className="w-4 h-4 inline mr-2" />
                        Save Project
                    </button>
                    <button
                        onClick={() => setActiveTab('load')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'load'
                            ? 'text-blue-400 border-b-2 border-blue-500'
                            : 'text-zinc-400 hover:text-white'
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
                        /* Save Tab */
                        <div className="space-y-4">
                            {!isPro ? (
                                <div className="text-center py-8">
                                    <Crown className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                                    <h3 className="text-lg font-bold text-white mb-2">Pro Feature</h3>
                                    <p className="text-zinc-400 text-sm mb-4">
                                        Upgrade to Pro to save projects to the cloud
                                    </p>
                                    <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white font-medium">
                                        Upgrade to Pro
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-400 mb-2">
                                            Project Name
                                        </label>
                                        <input
                                            type="text"
                                            value={projectName}
                                            onChange={(e) => setProjectName(e.target.value)}
                                            placeholder="My Structure"
                                            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                                        <div className="text-sm text-zinc-400 mb-2">Current Model</div>
                                        <div className="flex gap-4 text-white">
                                            <span>{nodes.size} nodes</span>
                                            <span>{members.size} members</span>
                                            <span>{loads.length} loads</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSave}
                                        disabled={saving || !projectName.trim()}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium flex items-center justify-center gap-2"
                                    >
                                        {saving ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <Save className="w-5 h-5" />
                                        )}
                                        Save to Cloud
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        /* Load Tab */
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                </div>
                            ) : projects.length === 0 ? (
                                <p className="text-center text-zinc-400 py-8">
                                    No saved projects yet
                                </p>
                            ) : (
                                projects.map((proj) => (
                                    <div
                                        key={proj.id}
                                        className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                                    >
                                        <div>
                                            <div className="font-medium text-white">{proj.name}</div>
                                            <div className="text-xs text-zinc-400">
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
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectSaveDialog;
