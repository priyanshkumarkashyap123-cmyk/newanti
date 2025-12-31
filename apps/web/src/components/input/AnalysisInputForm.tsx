/**
 * AnalysisInputForm.tsx - Enhanced Input Forms with Real-time Validation
 * 
 * Features:
 * - Real-time validation with visual feedback
 * - Unit conversion helpers
 * - Input suggestions based on common values
 * - Guided step-by-step workflow
 * - Auto-complete for section properties
 */

import React, { FC, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertCircle,
    CheckCircle,
    HelpCircle,
    ChevronRight,
    ChevronDown,
    Calculator,
    Zap,
    Info,
    X,
    Plus,
    Copy,
    Trash2,
    Move,
    Box,
    Target,
    Settings
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface NodeInput {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints: {
        dx: boolean;
        dy: boolean;
        dz: boolean;
        rx: boolean;
        ry: boolean;
        rz: boolean;
    };
}

export interface MaterialInput {
    id: string;
    name: string;
    E: number;      // GPa
    fy: number;     // MPa
    density: number; // kg/m³
    nu: number;     // Poisson's ratio
}

export interface SectionInput {
    id: string;
    name: string;
    type: 'I' | 'W' | 'C' | 'L' | 'T' | 'HSS' | 'PIPE' | 'CUSTOM';
    A: number;      // mm²
    Iy: number;     // mm⁴ × 10⁶
    Iz: number;     // mm⁴ × 10⁶
    J: number;      // mm⁴ × 10⁶
}

export interface MemberInput {
    id: string;
    startNodeId: string;
    endNodeId: string;
    materialId: string;
    sectionId: string;
}

export interface LoadInput {
    id: string;
    nodeId: string;
    fx: number;
    fy: number;
    fz: number;
    mx: number;
    my: number;
    mz: number;
}

export interface ValidationError {
    field: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
}

// ============================================
// PRESET DATA
// ============================================

const COMMON_MATERIALS: MaterialInput[] = [
    { id: 'fe250', name: 'Fe 250 (Mild Steel)', E: 200, fy: 250, density: 7850, nu: 0.3 },
    { id: 'fe415', name: 'Fe 415 (HYSD)', E: 200, fy: 415, density: 7850, nu: 0.3 },
    { id: 'fe500', name: 'Fe 500 (TMT)', E: 200, fy: 500, density: 7850, nu: 0.3 },
    { id: 'a36', name: 'ASTM A36', E: 200, fy: 250, density: 7850, nu: 0.3 },
    { id: 'a992', name: 'ASTM A992', E: 200, fy: 345, density: 7850, nu: 0.3 },
    { id: 'al6061', name: 'Aluminum 6061-T6', E: 69, fy: 276, density: 2700, nu: 0.33 },
];

const COMMON_SECTIONS: Array<Omit<SectionInput, 'id'> & { id: string }> = [
    { id: 'ismb100', name: 'ISMB 100', type: 'I', A: 1140, Iy: 2.57, Iz: 0.26, J: 0.01 },
    { id: 'ismb150', name: 'ISMB 150', type: 'I', A: 1800, Iy: 7.26, Iz: 0.53, J: 0.03 },
    { id: 'ismb200', name: 'ISMB 200', type: 'I', A: 2850, Iy: 22.35, Iz: 1.50, J: 0.08 },
    { id: 'ismb250', name: 'ISMB 250', type: 'I', A: 4100, Iy: 51.32, Iz: 3.34, J: 0.18 },
    { id: 'ismb300', name: 'ISMB 300', type: 'I', A: 5870, Iy: 98.35, Iz: 5.89, J: 0.36 },
    { id: 'ismc100', name: 'ISMC 100', type: 'C', A: 1170, Iy: 1.92, Iz: 0.26, J: 0.01 },
    { id: 'ismc150', name: 'ISMC 150', type: 'C', A: 2060, Iy: 7.79, Iz: 0.68, J: 0.04 },
    { id: 'hss100x100x6', name: 'HSS 100×100×6', type: 'HSS', A: 2176, Iy: 3.21, Iz: 3.21, J: 4.82 },
];

const SUPPORT_PRESETS = [
    { label: 'Fixed', dx: true, dy: true, dz: true, rx: true, ry: true, rz: true },
    { label: 'Pinned', dx: true, dy: true, dz: true, rx: false, ry: false, rz: false },
    { label: 'Roller-X', dx: false, dy: true, dz: true, rx: false, ry: false, rz: false },
    { label: 'Roller-Y', dx: true, dy: false, dz: true, rx: false, ry: false, rz: false },
    { label: 'Free', dx: false, dy: false, dz: false, rx: false, ry: false, rz: false },
];

// ============================================
// VALIDATION FUNCTIONS
// ============================================

function validateNodeInput(node: NodeInput, allNodes: NodeInput[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for duplicate IDs
    const duplicates = allNodes.filter(n => n.id === node.id);
    if (duplicates.length > 1) {
        errors.push({ field: 'id', message: 'Duplicate node ID', severity: 'error' });
    }

    // Check for coincident nodes
    for (const other of allNodes) {
        if (other.id !== node.id) {
            const dist = Math.sqrt(
                (node.x - other.x) ** 2 + (node.y - other.y) ** 2 + (node.z - other.z) ** 2
            );
            if (dist < 0.001) {
                errors.push({ 
                    field: 'position', 
                    message: `Coincident with node ${other.id}`, 
                    severity: 'warning' 
                });
            }
        }
    }

    return errors;
}

function validateMemberInput(
    member: MemberInput, 
    nodes: NodeInput[], 
    allMembers: MemberInput[]
): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check if nodes exist
    const startNode = nodes.find(n => n.id === member.startNodeId);
    const endNode = nodes.find(n => n.id === member.endNodeId);

    if (!startNode) {
        errors.push({ field: 'startNodeId', message: 'Start node not found', severity: 'error' });
    }
    if (!endNode) {
        errors.push({ field: 'endNodeId', message: 'End node not found', severity: 'error' });
    }

    // Check for zero length
    if (startNode && endNode) {
        const length = Math.sqrt(
            (endNode.x - startNode.x) ** 2 + 
            (endNode.y - startNode.y) ** 2 + 
            (endNode.z - startNode.z) ** 2
        );
        if (length < 0.001) {
            errors.push({ field: 'length', message: 'Zero length member', severity: 'error' });
        }
    }

    // Check for duplicate members
    for (const other of allMembers) {
        if (other.id !== member.id) {
            if ((other.startNodeId === member.startNodeId && other.endNodeId === member.endNodeId) ||
                (other.startNodeId === member.endNodeId && other.endNodeId === member.startNodeId)) {
                errors.push({ field: 'connectivity', message: 'Duplicate member', severity: 'warning' });
            }
        }
    }

    return errors;
}

function validateLoadInput(load: LoadInput, nodes: NodeInput[]): ValidationError[] {
    const errors: ValidationError[] = [];

    const node = nodes.find(n => n.id === load.nodeId);
    if (!node) {
        errors.push({ field: 'nodeId', message: 'Node not found', severity: 'error' });
    }

    const totalForce = Math.sqrt(load.fx ** 2 + load.fy ** 2 + load.fz ** 2);
    if (totalForce < 0.001) {
        errors.push({ field: 'force', message: 'No load applied', severity: 'warning' });
    }

    // Check for very large loads
    if (totalForce > 10000) {
        errors.push({ 
            field: 'force', 
            message: 'Very large load - verify units (kN expected)', 
            severity: 'info' 
        });
    }

    return errors;
}

// ============================================
// INPUT FIELD COMPONENTS
// ============================================

interface NumberInputProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
    error?: string;
    hint?: string;
    disabled?: boolean;
}

export const NumberInput: FC<NumberInputProps> = ({
    label,
    value,
    onChange,
    unit,
    min,
    max,
    step = 1,
    error,
    hint,
    disabled = false
}) => {
    const [localValue, setLocalValue] = useState(value.toString());
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setLocalValue(value.toString());
        }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
        const num = parseFloat(e.target.value);
        if (!isNaN(num)) {
            onChange(num);
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
        const num = parseFloat(localValue);
        if (!isNaN(num)) {
            onChange(num);
            setLocalValue(num.toString());
        } else {
            setLocalValue(value.toString());
        }
    };

    return (
        <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs text-slate-400">
                {label}
                {hint && (
                    <span className="group relative">
                        <HelpCircle size={12} className="text-slate-500" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 
                                       bg-slate-700 text-white text-xs rounded whitespace-nowrap
                                       opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            {hint}
                        </span>
                    </span>
                )}
            </label>
            <div className="relative">
                <input
                    type="number"
                    value={localValue}
                    onChange={handleChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={handleBlur}
                    min={min}
                    max={max}
                    step={step}
                    disabled={disabled}
                    className={`w-full px-3 py-1.5 bg-slate-700 border rounded-md text-sm
                              text-slate-200 focus:outline-none focus:ring-1
                              ${error 
                                ? 'border-red-500 focus:ring-red-500' 
                                : 'border-slate-600 focus:ring-cyan-500'
                              }
                              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                              ${unit ? 'pr-12' : ''}`}
                />
                {unit && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        {unit}
                    </span>
                )}
            </div>
            {error && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {error}
                </p>
            )}
        </div>
    );
};

// ============================================
// NODE INPUT PANEL
// ============================================

interface NodeInputPanelProps {
    node: NodeInput;
    onChange: (node: NodeInput) => void;
    onDelete: () => void;
    errors: ValidationError[];
    expanded?: boolean;
    onToggle?: () => void;
}

export const NodeInputPanel: FC<NodeInputPanelProps> = ({
    node,
    onChange,
    onDelete,
    errors,
    expanded = true,
    onToggle
}) => {
    const hasErrors = errors.some(e => e.severity === 'error');
    const hasWarnings = errors.some(e => e.severity === 'warning');

    const handleRestraintChange = (key: keyof NodeInput['restraints'], value: boolean) => {
        onChange({
            ...node,
            restraints: { ...node.restraints, [key]: value }
        });
    };

    const applySupportPreset = (preset: typeof SUPPORT_PRESETS[0]) => {
        onChange({
            ...node,
            restraints: {
                dx: preset.dx,
                dy: preset.dy,
                dz: preset.dz,
                rx: preset.rx,
                ry: preset.ry,
                rz: preset.rz
            }
        });
    };

    return (
        <div className={`border rounded-lg overflow-hidden transition-colors
                       ${hasErrors ? 'border-red-500/50' : hasWarnings ? 'border-yellow-500/50' : 'border-slate-700'}`}>
            {/* Header */}
            <div 
                className="flex items-center justify-between px-3 py-2 bg-slate-800/50 cursor-pointer"
                onClick={onToggle}
            >
                <div className="flex items-center gap-2">
                    {hasErrors ? (
                        <AlertCircle size={14} className="text-red-400" />
                    ) : hasWarnings ? (
                        <AlertCircle size={14} className="text-yellow-400" />
                    ) : (
                        <CheckCircle size={14} className="text-green-400" />
                    )}
                    <span className="text-sm font-medium text-slate-200">Node {node.id}</span>
                    <span className="text-xs text-slate-500">
                        ({node.x.toFixed(2)}, {node.y.toFixed(2)}, {node.z.toFixed(2)})
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                    {onToggle && (
                        expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    )}
                </div>
            </div>

            {/* Content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-3 space-y-4 bg-slate-900/50">
                            {/* Coordinates */}
                            <div>
                                <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                                    <Move size={12} />
                                    Coordinates (m)
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <NumberInput
                                        label="X"
                                        value={node.x}
                                        onChange={(x) => onChange({ ...node, x })}
                                        unit="m"
                                        step={0.1}
                                    />
                                    <NumberInput
                                        label="Y"
                                        value={node.y}
                                        onChange={(y) => onChange({ ...node, y })}
                                        unit="m"
                                        step={0.1}
                                    />
                                    <NumberInput
                                        label="Z"
                                        value={node.z}
                                        onChange={(z) => onChange({ ...node, z })}
                                        unit="m"
                                        step={0.1}
                                    />
                                </div>
                            </div>

                            {/* Support Conditions */}
                            <div>
                                <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                                    <Target size={12} />
                                    Support Conditions
                                </div>
                                
                                {/* Quick presets */}
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {SUPPORT_PRESETS.map((preset) => (
                                        <button
                                            key={preset.label}
                                            onClick={() => applySupportPreset(preset)}
                                            className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 
                                                     text-slate-300 rounded transition-colors"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Individual restraints */}
                                <div className="grid grid-cols-6 gap-2">
                                    {(['dx', 'dy', 'dz', 'rx', 'ry', 'rz'] as const).map((key) => (
                                        <label 
                                            key={key}
                                            className="flex flex-col items-center gap-1 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={node.restraints[key]}
                                                onChange={(e) => handleRestraintChange(key, e.target.checked)}
                                                className="w-4 h-4 rounded bg-slate-700 border-slate-600 
                                                         text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                                            />
                                            <span className="text-xs text-slate-500">{key}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Errors */}
                            {errors.length > 0 && (
                                <div className="space-y-1">
                                    {errors.map((err, idx) => (
                                        <div 
                                            key={idx}
                                            className={`text-xs flex items-center gap-1 ${
                                                err.severity === 'error' ? 'text-red-400' :
                                                err.severity === 'warning' ? 'text-yellow-400' :
                                                'text-blue-400'
                                            }`}
                                        >
                                            <AlertCircle size={12} />
                                            {err.message}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ============================================
// LOAD INPUT PANEL
// ============================================

interface LoadInputPanelProps {
    load: LoadInput;
    onChange: (load: LoadInput) => void;
    onDelete: () => void;
    nodes: NodeInput[];
    errors: ValidationError[];
}

export const LoadInputPanel: FC<LoadInputPanelProps> = ({
    load,
    onChange,
    onDelete,
    nodes,
    errors
}) => {
    const hasErrors = errors.some(e => e.severity === 'error');

    return (
        <div className={`border rounded-lg p-3 space-y-3 ${
            hasErrors ? 'border-red-500/50' : 'border-slate-700'
        }`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap size={14} className="text-yellow-400" />
                    <span className="text-sm font-medium text-slate-200">Load {load.id}</span>
                </div>
                <button
                    onClick={onDelete}
                    className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Node selector */}
            <div>
                <label className="text-xs text-slate-400 mb-1 block">Apply to Node</label>
                <select
                    value={load.nodeId}
                    onChange={(e) => onChange({ ...load, nodeId: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-md 
                             text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                    <option value="">Select node...</option>
                    {nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                            {node.id} ({node.x}, {node.y}, {node.z})
                        </option>
                    ))}
                </select>
            </div>

            {/* Forces */}
            <div>
                <div className="text-xs text-slate-400 mb-2">Forces (kN)</div>
                <div className="grid grid-cols-3 gap-2">
                    <NumberInput
                        label="Fx"
                        value={load.fx}
                        onChange={(fx) => onChange({ ...load, fx })}
                        unit="kN"
                    />
                    <NumberInput
                        label="Fy"
                        value={load.fy}
                        onChange={(fy) => onChange({ ...load, fy })}
                        unit="kN"
                    />
                    <NumberInput
                        label="Fz"
                        value={load.fz}
                        onChange={(fz) => onChange({ ...load, fz })}
                        unit="kN"
                    />
                </div>
            </div>

            {/* Moments */}
            <div>
                <div className="text-xs text-slate-400 mb-2">Moments (kN·m)</div>
                <div className="grid grid-cols-3 gap-2">
                    <NumberInput
                        label="Mx"
                        value={load.mx}
                        onChange={(mx) => onChange({ ...load, mx })}
                        unit="kNm"
                    />
                    <NumberInput
                        label="My"
                        value={load.my}
                        onChange={(my) => onChange({ ...load, my })}
                        unit="kNm"
                    />
                    <NumberInput
                        label="Mz"
                        value={load.mz}
                        onChange={(mz) => onChange({ ...load, mz })}
                        unit="kNm"
                    />
                </div>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
                <div className="space-y-1">
                    {errors.map((err, idx) => (
                        <div 
                            key={idx}
                            className={`text-xs flex items-center gap-1 ${
                                err.severity === 'error' ? 'text-red-400' :
                                err.severity === 'warning' ? 'text-yellow-400' :
                                'text-blue-400'
                            }`}
                        >
                            {err.severity === 'info' ? <Info size={12} /> : <AlertCircle size={12} />}
                            {err.message}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================
// ANALYSIS PROGRESS INDICATOR
// ============================================

interface AnalysisProgressProps {
    stage: 'idle' | 'validating' | 'assembling' | 'solving' | 'postprocessing' | 'complete' | 'error';
    progress: number;
    message?: string;
    onCancel?: () => void;
}

export const AnalysisProgress: FC<AnalysisProgressProps> = ({
    stage,
    progress,
    message,
    onCancel
}) => {
    const stages = [
        { id: 'validating', label: 'Validating' },
        { id: 'assembling', label: 'Assembling' },
        { id: 'solving', label: 'Solving' },
        { id: 'postprocessing', label: 'Post-processing' },
        { id: 'complete', label: 'Complete' }
    ];

    const currentIndex = stages.findIndex(s => s.id === stage);

    if (stage === 'idle') return null;

    return (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-white">Analysis Progress</h4>
                {onCancel && stage !== 'complete' && stage !== 'error' && (
                    <button
                        onClick={onCancel}
                        className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                    >
                        Cancel
                    </button>
                )}
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
                <motion.div
                    className={`h-full ${
                        stage === 'error' ? 'bg-red-500' :
                        stage === 'complete' ? 'bg-green-500' :
                        'bg-cyan-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>

            {/* Stage indicators */}
            <div className="flex justify-between mb-2">
                {stages.map((s, idx) => (
                    <div 
                        key={s.id}
                        className={`flex flex-col items-center ${
                            idx <= currentIndex ? 'text-cyan-400' : 'text-slate-500'
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${
                            idx < currentIndex ? 'bg-cyan-400' :
                            idx === currentIndex ? 'bg-cyan-400 animate-pulse' :
                            'bg-slate-600'
                        }`} />
                        <span className="text-xs mt-1">{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Message */}
            {message && (
                <p className={`text-xs ${
                    stage === 'error' ? 'text-red-400' : 'text-slate-400'
                }`}>
                    {message}
                </p>
            )}
        </div>
    );
};

// ============================================
// MATERIAL SELECTOR
// ============================================

interface MaterialSelectorProps {
    value: string;
    onChange: (materialId: string) => void;
    materials: MaterialInput[];
}

export const MaterialSelector: FC<MaterialSelectorProps> = ({
    value,
    onChange,
    materials
}) => {
    const [showPresets, setShowPresets] = useState(false);

    const allMaterials = [...COMMON_MATERIALS, ...materials];
    const selected = allMaterials.find(m => m.id === value);

    return (
        <div className="relative">
            <label className="text-xs text-slate-400 mb-1 block">Material</label>
            <button
                onClick={() => setShowPresets(!showPresets)}
                className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-md 
                         text-sm text-left text-slate-200 hover:border-slate-500 
                         focus:outline-none focus:ring-1 focus:ring-cyan-500
                         flex items-center justify-between"
            >
                <span>{selected?.name || 'Select material...'}</span>
                <ChevronDown size={14} className={`transition-transform ${showPresets ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {showPresets && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 
                                 rounded-lg shadow-xl overflow-hidden"
                    >
                        <div className="max-h-60 overflow-y-auto">
                            {allMaterials.map((mat) => (
                                <button
                                    key={mat.id}
                                    onClick={() => {
                                        onChange(mat.id);
                                        setShowPresets(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left hover:bg-slate-700/50 
                                              transition-colors ${value === mat.id ? 'bg-cyan-600/20' : ''}`}
                                >
                                    <div className="text-sm text-slate-200">{mat.name}</div>
                                    <div className="text-xs text-slate-500">
                                        E={mat.E} GPa, fy={mat.fy} MPa
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default {
    NumberInput,
    NodeInputPanel,
    LoadInputPanel,
    AnalysisProgress,
    MaterialSelector,
    validateNodeInput,
    validateMemberInput,
    validateLoadInput,
    COMMON_MATERIALS,
    COMMON_SECTIONS,
    SUPPORT_PRESETS
};
