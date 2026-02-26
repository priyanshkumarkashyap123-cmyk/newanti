/**
 * ProjectDetailsDialog - Collect project information for reports
 * 
 * Opens when starting a new project or editing project info.
 * Data is saved to model store and used in PDF reports.
 */

import { FC, useState, useEffect } from 'react';
import { X, Save, User, Briefcase, FileText, Hash, Calendar } from 'lucide-react';
import { useModelStore, type ProjectInfo } from '../store/model';

interface ProjectDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: () => void;
    isNewProject?: boolean;
}

export const ProjectDetailsDialog: FC<ProjectDetailsDialogProps> = ({
    isOpen,
    onClose,
    onSave,
    isNewProject = false
}) => {
    const projectInfo = useModelStore((s) => s.projectInfo);
    const setProjectInfo = useModelStore((s) => s.setProjectInfo);
    const clearModel = useModelStore((s) => s.clearModel);

    // Local form state
    const [formData, setFormData] = useState<ProjectInfo>({
        name: '',
        client: '',
        engineer: '',
        jobNo: '',
        rev: '0',
        date: new Date(),
        description: ''
    });

    // Validation
    const [errors, setErrors] = useState<{ name?: string; engineer?: string }>({});

    // Sync form with store when dialog opens
    useEffect(() => {
        if (isOpen) {
            // Defer to avoid synchronous setState at effect start
            queueMicrotask(() => {
                if (isNewProject) {
                    // Reset for new project
                    setFormData({
                        name: 'New Project',
                        client: '',
                        engineer: '',
                        jobNo: '',
                        rev: '0',
                        date: new Date(),
                        description: ''
                    });
                } else {
                    // Load existing project info
                    setFormData({
                        ...projectInfo,
                        date: projectInfo.date instanceof Date ? projectInfo.date : new Date(projectInfo.date)
                    });
                }
                setErrors({});
            });
        }
    }, [isOpen, isNewProject, projectInfo]);

    if (!isOpen) return null;

    const handleChange = (field: keyof ProjectInfo, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when user types
        if (errors[field as 'name' | 'engineer']) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handleSubmit = () => {
        // Validate required fields
        const newErrors: { name?: string; engineer?: string } = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Project name is required';
        }
        if (!formData.engineer.trim()) {
            newErrors.engineer = 'Engineer name is required';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        // Clear model if new project
        if (isNewProject) {
            clearModel();
        }

        // Save to store
        setProjectInfo(formData);

        // Save to localStorage
        saveProjectToLocalStorage();

        onSave?.();
        onClose();
    };

    const saveProjectToLocalStorage = () => {
        try {
            const state = useModelStore.getState();
            const projectData = {
                projectInfo: formData,
                nodes: Array.from(state.nodes.entries()),
                members: Array.from(state.members.entries()),
                loads: state.loads,
                memberLoads: state.memberLoads,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('beamlab_project', JSON.stringify(projectData));
        } catch (e) {
            console.error('Failed to save project:', e);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                                {isNewProject ? 'New Project' : 'Project Details'}
                            </h2>
                            <p className="text-sm text-zinc-400 dark:text-zinc-400">
                                {isNewProject ? 'Enter project information' : 'Edit project information'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="px-6 py-5 space-y-4">
                    {/* Project Name */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                            <Briefcase className="w-4 h-4" />
                            Project Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder="e.g., Office Building Frame Analysis"
                            className={`w-full px-3 py-2 rounded-lg border ${errors.name
                                    ? 'border-red-500 focus:ring-red-500'
                                    : 'border-zinc-300 dark:border-zinc-600 focus:ring-blue-500'
                                } bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:border-transparent`}
                        />
                        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                    </div>

                    {/* Client & Engineer Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                <User className="w-4 h-4" />
                                Client Name
                            </label>
                            <input
                                type="text"
                                value={formData.client}
                                onChange={(e) => handleChange('client', e.target.value)}
                                placeholder="Client/Company"
                                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                <User className="w-4 h-4" />
                                Engineer <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.engineer}
                                onChange={(e) => handleChange('engineer', e.target.value)}
                                placeholder="Your name"
                                className={`w-full px-3 py-2 rounded-lg border ${errors.engineer
                                        ? 'border-red-500 focus:ring-red-500'
                                        : 'border-zinc-300 dark:border-zinc-600 focus:ring-blue-500'
                                    } bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:border-transparent`}
                            />
                            {errors.engineer && <p className="mt-1 text-sm text-red-500">{errors.engineer}</p>}
                        </div>
                    </div>

                    {/* Job No, Rev, Date Row */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                <Hash className="w-4 h-4" />
                                Job No.
                            </label>
                            <input
                                type="text"
                                value={formData.jobNo}
                                onChange={(e) => handleChange('jobNo', e.target.value)}
                                placeholder="PRJ-001"
                                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                Rev.
                            </label>
                            <input
                                type="text"
                                value={formData.rev}
                                onChange={(e) => handleChange('rev', e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                <Calendar className="w-4 h-4" />
                                Date
                            </label>
                            <input
                                type="date"
                                value={formData.date instanceof Date ? formData.date.toISOString().split('T')[0] : ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, date: new Date(e.target.value) }))}
                                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="Brief project description..."
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {isNewProject ? 'Create Project' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectDetailsDialog;
