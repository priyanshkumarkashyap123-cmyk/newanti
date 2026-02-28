/**
 * ProjectDetailsDialog - Collect project information for reports
 * 
 * Opens when starting a new project or editing project info.
 * Data is saved to model store and used in PDF reports.
 */

import { FC, useState, useEffect } from 'react';
import { Save, User, Briefcase, FileText, Hash, Calendar } from 'lucide-react';
import { useModelStore, type ProjectInfo } from '../store/model';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <DialogTitle>
                                {isNewProject ? 'New Project' : 'Project Details'}
                            </DialogTitle>
                            <DialogDescription>
                                {isNewProject ? 'Enter project information' : 'Edit project information'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Form */}
                <div className="px-6 py-5 space-y-4">
                    {/* Project Name */}
                    <div>
                        <Label className="flex items-center gap-2 mb-1.5">
                            <Briefcase className="w-4 h-4" />
                            Project Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder="e.g., Office Building Frame Analysis"
                            className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        />
                        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                    </div>

                    {/* Client & Engineer Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="flex items-center gap-2 mb-1.5">
                                <User className="w-4 h-4" />
                                Client Name
                            </Label>
                            <Input
                                type="text"
                                value={formData.client}
                                onChange={(e) => handleChange('client', e.target.value)}
                                placeholder="Client/Company"
                            />
                        </div>
                        <div>
                            <Label className="flex items-center gap-2 mb-1.5">
                                <User className="w-4 h-4" />
                                Engineer <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="text"
                                value={formData.engineer}
                                onChange={(e) => handleChange('engineer', e.target.value)}
                                placeholder="Your name"
                                className={errors.engineer ? 'border-red-500 focus-visible:ring-red-500' : ''}
                            />
                            {errors.engineer && <p className="mt-1 text-sm text-red-500">{errors.engineer}</p>}
                        </div>
                    </div>

                    {/* Job No, Rev, Date Row */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label className="flex items-center gap-2 mb-1.5">
                                <Hash className="w-4 h-4" />
                                Job No.
                            </Label>
                            <Input
                                type="text"
                                value={formData.jobNo}
                                onChange={(e) => handleChange('jobNo', e.target.value)}
                                placeholder="PRJ-001"
                            />
                        </div>
                        <div>
                            <Label className="flex items-center gap-2 mb-1.5">
                                Rev.
                            </Label>
                            <Input
                                type="text"
                                value={formData.rev}
                                onChange={(e) => handleChange('rev', e.target.value)}
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <Label className="flex items-center gap-2 mb-1.5">
                                <Calendar className="w-4 h-4" />
                                Date
                            </Label>
                            <Input
                                type="date"
                                value={formData.date instanceof Date ? formData.date.toISOString().split('T')[0] : ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, date: new Date(e.target.value) }))}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <Label className="flex items-center gap-2 mb-1.5">
                            Description
                        </Label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="Brief project description..."
                            rows={3}
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit}>
                        <Save className="w-4 h-4" />
                        {isNewProject ? 'Create Project' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectDetailsDialog;
