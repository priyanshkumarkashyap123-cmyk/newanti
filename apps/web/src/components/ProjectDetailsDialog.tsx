/**
 * ProjectDetailsDialog - Enhanced Project Setup & Configuration
 * 
 * Opens when starting a new project or editing project info.
 * User must configure: name, engineer, design code, units, materials.
 * Data is saved to model store, localStorage, AND MongoDB (cloud).
 */

import { FC, useState, useEffect } from 'react';
import { Save, User, Briefcase, FileText, Hash, Calendar, Ruler, Shield, ChevronRight, ChevronLeft, Layers, Settings } from 'lucide-react';
import { useModelStore, type ProjectInfo } from '../store/model';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../providers/AuthProvider';
import { ProjectService } from '../services/ProjectService';

// --- Design Code & Unit Presets ---
const DESIGN_CODE_PRESETS = [
  { id: 'IS', label: 'Indian Standards (IS)', steel: 'IS 800:2007', concrete: 'IS 456:2000', seismic: 'IS 1893:2016', flag: '🇮🇳' },
  { id: 'AISC', label: 'American (AISC/ACI)', steel: 'AISC 360-16', concrete: 'ACI 318-19', seismic: 'ASCE 7-22', flag: '🇺🇸' },
  { id: 'Eurocode', label: 'Eurocode (EN)', steel: 'EN 1993-1-1', concrete: 'EN 1992-1-1', seismic: 'EN 1998-1', flag: '🇪🇺' },
  { id: 'BS', label: 'British Standards (BS)', steel: 'BS 5950', concrete: 'BS 8110', seismic: 'BS EN 1998', flag: '🇬🇧' },
  { id: 'AS', label: 'Australian Standards (AS)', steel: 'AS 4100', concrete: 'AS 3600', seismic: 'AS 1170.4', flag: '🇦🇺' },
];

const UNIT_SYSTEMS = [
  { id: 'SI_kN_m', label: 'kN, m', description: 'Force in kN, Length in meters', force: 'kN', length: 'm', stress: 'MPa' },
  { id: 'SI_N_mm', label: 'N, mm', description: 'Force in N, Length in mm', force: 'N', length: 'mm', stress: 'N/mm²' },
  { id: 'SI_kN_mm', label: 'kN, mm', description: 'Force in kN, Length in mm', force: 'kN', length: 'mm', stress: 'MPa' },
  { id: 'Imperial_kip_ft', label: 'kip, ft', description: 'Force in kips, Length in feet', force: 'kip', length: 'ft', stress: 'ksi' },
  { id: 'Imperial_lb_in', label: 'lb, in', description: 'Force in pounds, Length in inches', force: 'lb', length: 'in', stress: 'psi' },
];

const MATERIAL_OPTIONS = [
  { id: 'Steel', label: 'Steel', icon: '🔩', description: 'Hot-rolled structural steel sections' },
  { id: 'Concrete', label: 'Reinforced Concrete', icon: '🏗️', description: 'RCC beams, columns, slabs, footings' },
  { id: 'Composite', label: 'Composite (Steel + Concrete)', icon: '🏢', description: 'Steel-concrete composite design' },
  { id: 'Timber', label: 'Timber', icon: '🪵', description: 'Structural timber members' },
];

const STEEL_GRADES: Record<string, string[]> = {
  IS: ['Fe250', 'Fe345', 'Fe410', 'Fe450', 'Fe550'],
  AISC: ['A36', 'A572 Gr.50', 'A992', 'A500 Gr.B', 'A500 Gr.C'],
  Eurocode: ['S235', 'S275', 'S355', 'S420', 'S460'],
  BS: ['S275', 'S355', 'S460'],
  AS: ['300PLUS', 'C350', 'C450'],
};

const CONCRETE_GRADES: Record<string, string[]> = {
  IS: ['M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50', 'M55', 'M60'],
  AISC: ["3000 psi", "4000 psi", "5000 psi", "6000 psi", "8000 psi"],
  Eurocode: ['C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60'],
  BS: ['C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50'],
  AS: ['N20', 'N25', 'N32', 'N40', 'N50'],
};

// --- Default project info ---
const DEFAULT_PROJECT_INFO: ProjectInfo = {
    name: 'New Project',
    client: '',
    engineer: '',
    jobNo: '',
    rev: '0',
    date: new Date(),
    description: '',
    designCode: 'IS',
    steelCode: 'IS 800:2007',
    concreteCode: 'IS 456:2000',
    seismicCode: 'IS 1893:2016',
    unitSystem: 'SI_kN_m',
    primaryMaterial: 'Steel',
    steelGrade: 'Fe250',
    concreteGrade: 'M25',
};

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
    const { isSignedIn, getToken } = useAuth();

    // Multi-step wizard state
    const [step, setStep] = useState(0); // 0=info, 1=codes, 2=units+materials
    const totalSteps = isNewProject ? 3 : 1; // Only show all steps for new projects

    // Local form state
    const [formData, setFormData] = useState<ProjectInfo>({ ...DEFAULT_PROJECT_INFO });

    // Validation
    const [errors, setErrors] = useState<{ name?: string; engineer?: string }>({});

    // Sync form with store when dialog opens
    useEffect(() => {
        if (isOpen) {
            queueMicrotask(() => {
                setStep(0);
                if (isNewProject) {
                    setFormData({ ...DEFAULT_PROJECT_INFO, date: new Date() });
                } else {
                    setFormData({
                        ...projectInfo,
                        date: projectInfo.date instanceof Date ? projectInfo.date : new Date(projectInfo.date),
                        designCode: projectInfo.designCode || 'IS',
                        unitSystem: projectInfo.unitSystem || 'SI_kN_m',
                        primaryMaterial: projectInfo.primaryMaterial || 'Steel',
                        steelGrade: projectInfo.steelGrade || 'Fe250',
                        concreteGrade: projectInfo.concreteGrade || 'M25',
                    });
                }
                setErrors({});
            });
        }
    }, [isOpen, isNewProject, projectInfo]);

    const handleChange = (field: keyof ProjectInfo, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field as 'name' | 'engineer']) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handleDesignCodeChange = (codeId: string) => {
        const preset = DESIGN_CODE_PRESETS.find(p => p.id === codeId);
        if (preset) {
            const steelGrades = STEEL_GRADES[codeId] || STEEL_GRADES['IS'];
            const concreteGrades = CONCRETE_GRADES[codeId] || CONCRETE_GRADES['IS'];
            setFormData(prev => ({
                ...prev,
                designCode: codeId,
                steelCode: preset.steel,
                concreteCode: preset.concrete,
                seismicCode: preset.seismic,
                steelGrade: steelGrades[0],
                concreteGrade: concreteGrades[1] || concreteGrades[0],
            }));
        }
    };

    const validateStep = (): boolean => {
        if (step === 0) {
            const newErrors: { name?: string; engineer?: string } = {};
            if (!formData.name.trim()) newErrors.name = 'Project name is required';
            if (!formData.engineer.trim()) newErrors.engineer = 'Engineer name is required';
            if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return false; }
        }
        return true;
    };

    const handleNext = () => {
        if (!validateStep()) return;
        if (step < totalSteps - 1) {
            setStep(s => s + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (step > 0) setStep(s => s - 1);
    };

    const handleSubmit = async () => {
        if (!validateStep()) return;

        if (isNewProject) clearModel();
        setProjectInfo(formData);
        saveProjectToLocalStorage();

        // Persist to MongoDB (cloud)
        if (isSignedIn) {
            try {
                const token = await getToken();
                if (token) {
                    const state = useModelStore.getState();
                    const projectData = {
                        projectInfo: formData,
                        nodes: Array.from(state.nodes.entries()),
                        members: Array.from(state.members.entries()),
                        loads: state.loads || [],
                        memberLoads: state.memberLoads || [],
                    };
                    const existingCloudId = state.projectInfo?.cloudId;
                    if (existingCloudId) {
                        await ProjectService.updateProject(existingCloudId, {
                            name: formData.name, description: formData.description, data: projectData,
                        }, token);
                    } else {
                        const created = await ProjectService.createProject({
                            name: formData.name, description: formData.description, data: projectData,
                        }, token);
                        useModelStore.setState((s) => ({
                            projectInfo: { ...s.projectInfo, cloudId: created._id },
                        }));
                    }
                }
            } catch (err) {
                console.error('[ProjectDetailsDialog] Cloud save failed:', err);
            }
        }

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

    const currentSteelGrades = STEEL_GRADES[formData.designCode || 'IS'] || STEEL_GRADES['IS'];
    const currentConcreteGrades = CONCRETE_GRADES[formData.designCode || 'IS'] || CONCRETE_GRADES['IS'];

    // Step labels
    const STEP_LABELS = ['Project Info', 'Design Codes', 'Units & Materials'];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <DialogTitle>
                                {isNewProject ? 'New Project Setup' : 'Project Details'}
                            </DialogTitle>
                            <DialogDescription>
                                {isNewProject
                                    ? 'Configure your project settings before modelling'
                                    : 'Edit project information and settings'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Step Indicator (new projects only) */}
                {isNewProject && totalSteps > 1 && (
                    <div className="px-6 pt-2">
                        <div className="flex items-center gap-2">
                            {STEP_LABELS.map((label, i) => (
                                <div key={i} className="flex items-center gap-2 flex-1">
                                    <div className={`flex items-center gap-1.5 ${i <= step ? 'text-blue-500' : 'text-slate-400'}`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                                            i < step ? 'bg-blue-500 border-blue-500 text-white' :
                                            i === step ? 'border-blue-500 text-blue-500' :
                                            'border-slate-300 dark:border-slate-600 text-slate-400'
                                        }`}>
                                            {i < step ? '✓' : i + 1}
                                        </div>
                                        <span className={`text-[11px] font-medium whitespace-nowrap ${
                                            i <= step ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
                                        }`}>{label}</span>
                                    </div>
                                    {i < STEP_LABELS.length - 1 && (
                                        <div className={`flex-1 h-px ${i < step ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Form Content */}
                <div className="px-6 py-5 space-y-4">
                    {/* Step 0: Project Info */}
                    {step === 0 && (
                        <>
                            <div>
                                <Label className="flex items-center gap-2 mb-1.5">
                                    <Briefcase className="w-4 h-4" /> Project Name <span className="text-red-500">*</span>
                                </Label>
                                <Input type="text" value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    placeholder="e.g., Office Building Frame Analysis"
                                    className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="flex items-center gap-2 mb-1.5"><User className="w-4 h-4" /> Client Name</Label>
                                    <Input type="text" value={formData.client}
                                        onChange={(e) => handleChange('client', e.target.value)} placeholder="Client/Company" />
                                </div>
                                <div>
                                    <Label className="flex items-center gap-2 mb-1.5">
                                        <User className="w-4 h-4" /> Engineer <span className="text-red-500">*</span>
                                    </Label>
                                    <Input type="text" value={formData.engineer}
                                        onChange={(e) => handleChange('engineer', e.target.value)} placeholder="Your name"
                                        className={errors.engineer ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                                    {errors.engineer && <p className="mt-1 text-sm text-red-500">{errors.engineer}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label className="flex items-center gap-2 mb-1.5"><Hash className="w-4 h-4" /> Job No.</Label>
                                    <Input type="text" value={formData.jobNo}
                                        onChange={(e) => handleChange('jobNo', e.target.value)} placeholder="PRJ-001" />
                                </div>
                                <div>
                                    <Label className="flex items-center gap-2 mb-1.5">Rev.</Label>
                                    <Input type="text" value={formData.rev}
                                        onChange={(e) => handleChange('rev', e.target.value)} placeholder="0" />
                                </div>
                                <div>
                                    <Label className="flex items-center gap-2 mb-1.5"><Calendar className="w-4 h-4" /> Date</Label>
                                    <Input type="date"
                                        value={formData.date instanceof Date ? formData.date.toISOString().split('T')[0] : ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, date: new Date(e.target.value) }))} />
                                </div>
                            </div>

                            <div>
                                <Label className="flex items-center gap-2 mb-1.5">Description</Label>
                                <textarea value={formData.description}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    placeholder="Brief project description..." rows={2}
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none" />
                            </div>
                        </>
                    )}

                    {/* Step 1: Design Codes */}
                    {step === 1 && (
                        <>
                            <div>
                                <Label className="flex items-center gap-2 mb-3">
                                    <Shield className="w-4 h-4" /> Select Design Code Standard
                                </Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {DESIGN_CODE_PRESETS.map((preset) => (
                                        <button key={preset.id} type="button"
                                            onClick={() => handleDesignCodeChange(preset.id)}
                                            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                                                formData.designCode === preset.id
                                                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                                            }`}>
                                            <span className="text-2xl">{preset.flag}</span>
                                            <div className="flex-1">
                                                <div className="font-semibold text-sm text-slate-900 dark:text-white">{preset.label}</div>
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                    Steel: {preset.steel} · Concrete: {preset.concrete} · Seismic: {preset.seismic}
                                                </div>
                                            </div>
                                            {formData.designCode === preset.id && (
                                                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                                    <span className="text-white text-xs">✓</span>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/30 dark:border-blue-800/30 p-3">
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                    <strong>Note:</strong> All formulas, load combinations, safety factors, and design checks will follow the selected code provisions. You can change this later in Project Settings.
                                </p>
                            </div>
                        </>
                    )}

                    {/* Step 2: Units & Materials */}
                    {step === 2 && (
                        <>
                            <div>
                                <Label className="flex items-center gap-2 mb-3">
                                    <Ruler className="w-4 h-4" /> Unit System
                                </Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {UNIT_SYSTEMS.map((unit) => (
                                        <button key={unit.id} type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, unitSystem: unit.id }))}
                                            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                                                formData.unitSystem === unit.id
                                                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                                            }`}>
                                            <div className="flex-1">
                                                <div className="font-semibold text-sm text-slate-900 dark:text-white">{unit.label}</div>
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400">{unit.description} · Stress: {unit.stress}</div>
                                            </div>
                                            {formData.unitSystem === unit.id && (
                                                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                                    <span className="text-white text-xs">✓</span>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <Label className="flex items-center gap-2 mb-3">
                                    <Layers className="w-4 h-4" /> Primary Material
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {MATERIAL_OPTIONS.map((mat) => (
                                        <button key={mat.id} type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, primaryMaterial: mat.id }))}
                                            className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                                                formData.primaryMaterial === mat.id
                                                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                                            }`}>
                                            <span className="text-xl">{mat.icon}</span>
                                            <div>
                                                <div className="font-semibold text-xs text-slate-900 dark:text-white">{mat.label}</div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400">{mat.description}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="flex items-center gap-2 mb-1.5">
                                        <Settings className="w-4 h-4" /> Steel Grade
                                    </Label>
                                    <select value={formData.steelGrade}
                                        onChange={(e) => setFormData(prev => ({ ...prev, steelGrade: e.target.value }))}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                        {currentSteelGrades.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <Label className="flex items-center gap-2 mb-1.5">
                                        <Settings className="w-4 h-4" /> Concrete Grade
                                    </Label>
                                    <select value={formData.concreteGrade}
                                        onChange={(e) => setFormData(prev => ({ ...prev, concreteGrade: e.target.value }))}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                        {currentConcreteGrades.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/30 dark:border-emerald-800/30 p-3">
                                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                    <strong>Summary:</strong> {formData.designCode} codes · {UNIT_SYSTEMS.find(u => u.id === formData.unitSystem)?.label} units · {formData.primaryMaterial} · {formData.steelGrade} steel · {formData.concreteGrade} concrete
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter className="flex justify-between gap-2">
                    <div className="flex gap-2">
                        {step > 0 && isNewProject && (
                            <Button variant="outline" onClick={handleBack}>
                                <ChevronLeft className="w-4 h-4 mr-1" /> Back
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleNext}>
                            {isNewProject && step < totalSteps - 1 ? (
                                <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
                            ) : (
                                <><Save className="w-4 h-4 mr-1" /> {isNewProject ? 'Create Project' : 'Save Changes'}</>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectDetailsDialog;
