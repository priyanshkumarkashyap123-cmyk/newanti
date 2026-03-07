/**
 * PropertiesPanel.tsx — Industry-Grade Properties Inspector
 * 
 * STAAD Pro / ETABS-style right panel for editing node/member properties.
 * All styling uses Tailwind CSS — zero inline style objects.
 */

import React from 'react';
import { FC, useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { useModelStore, type Restraints, type MemberLoad as StoreMemberLoad } from '../store/model';
import { useShallow } from 'zustand/react/shallow';
import { STEEL_SECTIONS, MATERIALS_DATABASE, type SectionProperties, type Material } from '../data/SectionDatabase';
import {
  CircleDot,
  Link2,
  Ruler,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Trash2,
  ArrowDown,
  Minimize2,
  Maximize2,
  Box,
  Layers,
  Crosshair,
  RotateCcw,
  Activity,
  Settings2,
  CheckCircle2,
  Hash,
} from 'lucide-react';

// ============================================
// SECTION CATEGORIES & FILTERING
// ============================================

type SectionCategory = 'ISMB' | 'ISMC' | 'ISLB' | 'ISHB' | 'W' | 'RCC-BEAM' | 'RCC-COLUMN';

const SECTION_CATEGORIES: { id: SectionCategory; label: string }[] = [
    { id: 'ISMB', label: 'Steel - ISMB' },
    { id: 'ISMC', label: 'Steel - ISMC' },
    { id: 'ISLB', label: 'Steel - ISLB' },
    { id: 'ISHB', label: 'Steel - ISHB' },
    { id: 'W', label: 'Steel - W Shapes (AISC)' },
    { id: 'RCC-BEAM', label: 'RCC - Beams' },
    { id: 'RCC-COLUMN', label: 'RCC - Columns' },
];

function getSectionsByCategory(category: SectionCategory): SectionProperties[] {
    switch (category) {
        case 'ISMB': return STEEL_SECTIONS.filter(s => s.type === 'ISMB');
        case 'ISMC': return STEEL_SECTIONS.filter(s => s.type === 'ISMC');
        case 'ISLB': return STEEL_SECTIONS.filter(s => s.type === 'ISLB');
        case 'ISHB': return STEEL_SECTIONS.filter(s => s.type === 'ISHB');
        case 'W':    return STEEL_SECTIONS.filter(s => s.type === 'W');
        case 'RCC-BEAM':   return STEEL_SECTIONS.filter(s => s.id.startsWith('RCC-') && !s.id.includes('COL'));
        case 'RCC-COLUMN': return STEEL_SECTIONS.filter(s => s.id.includes('RCC-COL'));
        default: return [];
    }
}

function convertSectionToMeters(section: SectionProperties): { A: number; I: number } {
    return {
        A: section.A / 1e6,
        I: section.Ix / 1e12
    };
}

// ============================================
// MATERIAL OPTIONS
// ============================================
const MATERIAL_OPTIONS = MATERIALS_DATABASE.map(m => ({
    id: m.id,
    label: m.name,
    E: m.E * 1e3,
    fy: m.fy || m.fck || 0
}));

// ============================================
// LOAD DIRECTION OPTIONS
// ============================================
const LOAD_DIRECTIONS = [
    { value: 'global_y', label: 'Global Y (Vertical)' },
    { value: 'global_x', label: 'Global X (Horizontal)' },
    { value: 'global_z', label: 'Global Z (Out-of-plane)' },
    { value: 'local_y', label: 'Local Y (Perpendicular)' },
    { value: 'axial', label: 'Local X (Axial)' },
] as const;

type LoadDirection = typeof LOAD_DIRECTIONS[number]['value'];

// ============================================
// DEBOUNCE HOOK
// ============================================
function useDebouncedCallback<T extends (...args: any[]) => void>(
    callback: T,
    delay: number
): T {
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
    return useCallback((...args: Parameters<T>) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => callback(...args), delay);
    }, [callback, delay]) as T;
}

// ============================================
// REUSABLE SUB-COMPONENTS
// ============================================

/** Professional number input with debounce */
interface NumberInputProps {
    value: number;
    onChange: (value: number) => void;
    step?: number;
    disabled?: boolean;
    className?: string;
}
const NumberInput: FC<NumberInputProps> = memo(({ value, onChange, step = 0.1, disabled, className }) => {
    const [localValue, setLocalValue] = useState(value.toString());

    useEffect(() => {
        setLocalValue(value.toString());
    }, [value]);

    const debouncedChange = useDebouncedCallback((val: string) => {
        const num = parseFloat(val);
        if (!isNaN(num)) onChange(num);
    }, 100);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
        debouncedChange(e.target.value);
    };

    return (
        <input
            type="number"
            step={step}
            value={localValue}
            onChange={handleChange}
            disabled={disabled}
            className={`bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 px-2 py-1.5 rounded text-xs w-full
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors font-mono tabular-nums ${className ?? ''}`}
        />
    );
});
NumberInput.displayName = 'NumberInput';

/** Collapsible section wrapper */
const PanelSection: FC<{
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    accentColor?: string;
}> = ({ icon, label, children, defaultOpen = true, accentColor }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="flex flex-col">
            <button type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 py-1 text-left group"
            >
                {open ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                <span className="w-3.5 h-3.5 flex-shrink-0" style={accentColor ? { color: accentColor } : undefined}>{icon}</span>
                <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800 dark:text-slate-100 transition-colors">{label}</span>
            </button>
            {open && <div className="pl-5 flex flex-col gap-1.5 mt-1">{children}</div>}
        </div>
    );
};

/** Info row for displaying read-only values */
const InfoRow: FC<{ label: string; value: string; color?: string; borderColor?: string }> = ({ label, value, color, borderColor }) => (
    <div className={`flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/50 px-1.5 py-1 rounded text-[11px] font-mono ${borderColor ? `border-l-2 ${borderColor}` : ''}`}>
        <span className="text-slate-500">{label}</span>
        <span className={`font-semibold ${color ?? 'text-slate-600 dark:text-slate-300'}`}>{value}</span>
    </div>
);

/** DOF toggle button */
const DofToggle: FC<{ label: string; sub: string; active: boolean; onChange: (v: boolean) => void }> = ({ label, sub, active, onChange }) => (
    <label className={`flex flex-col items-center py-1.5 px-1 rounded cursor-pointer border-2 transition-all select-none
        ${active ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}>
        <input type="checkbox" checked={active} onChange={(e) => onChange(e.target.checked)} className="hidden" />
        <span className={`text-[10px] font-semibold ${active ? 'text-emerald-400' : 'text-slate-500'}`}>{label}</span>
        <span className="text-[8px] text-slate-600">{sub}</span>
    </label>
);

/** Preset button for support types */
const PresetBtn: FC<{ label: string; active: boolean; onClick: () => void; title?: string }> = ({ label, active, onClick, title }) => (
    <button type="button"
        onClick={onClick}
        title={title}
        className={`flex-1 py-1 px-2 rounded text-[10px] font-medium transition-all
            ${active ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
    >
        {label}
    </button>
);

/** Professional panel select */
const PanelSelect: FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select
        {...props}
        className={`mt-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 px-2 py-1.5 rounded text-xs w-full
                   cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-colors ${props.className ?? ''}`}
    />
);

/** Divider */
const Divider: FC = () => <hr className="border-slate-200/60 dark:border-slate-700/60 my-1.5" />;

// ============================================
// PROPERTIES PANEL COMPONENT
// ============================================
export const PropertiesPanel: FC = memo(() => {
    // Batched single subscription — instead of 14 individual useModelStore calls
    const {
        selectedIds, nodes, members, loads, memberLoads, analysisResults,
        updateNodePosition, updateMember, updateMembers, setNodeRestraints,
        addLoad, removeLoad, addMemberLoad, removeMemberLoad,
    } = useModelStore(
        useShallow((s) => ({
            selectedIds: s.selectedIds,
            nodes: s.nodes,
            members: s.members,
            loads: s.loads,
            memberLoads: s.memberLoads,
            analysisResults: s.analysisResults,
            updateNodePosition: s.updateNodePosition,
            updateMember: s.updateMember,
            updateMembers: s.updateMembers,
            setNodeRestraints: s.setNodeRestraints,
            addLoad: s.addLoad,
            removeLoad: s.removeLoad,
            addMemberLoad: s.addMemberLoad,
            removeMemberLoad: s.removeMemberLoad,
        }))
    );

    // Local state for new nodal load input
    const [newLoadFx, setNewLoadFx] = useState(0);
    const [newLoadFy, setNewLoadFy] = useState(-10);
    const [newLoadFz, setNewLoadFz] = useState(0);
    const [newLoadMz, setNewLoadMz] = useState(0);
    const [showFullLoadInput, setShowFullLoadInput] = useState(false);

    // Local state for new member load input (UDL)
    const [newUdlW, setNewUdlW] = useState(-10);
    const [newUdlDirection, setNewUdlDirection] = useState<LoadDirection>('global_y');
    const [newUdlStartPos, setNewUdlStartPos] = useState(0);
    const [newUdlEndPos, setNewUdlEndPos] = useState(1);
    const [showUdlOptions, setShowUdlOptions] = useState(false);

    const [isMinimized, setIsMinimized] = useState(false);
    const [sectionCategory, setSectionCategory] = useState<SectionCategory>('ISMB');
    const [availableSections, setAvailableSections] = useState<SectionProperties[]>([]);

    const [showCustomSection, setShowCustomSection] = useState(false);
    const [showCustomMaterial, setShowCustomMaterial] = useState(false);
    const [customA, setCustomA] = useState(100);
    const [customI, setCustomI] = useState(1000);
    const [customE, setCustomE] = useState(200);

    useEffect(() => {
        setAvailableSections(getSectionsByCategory(sectionCategory));
    }, [sectionCategory]);

    const selectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;

    // Memoize expensive derivations to avoid O(n) every render
    const selectedMembers = useMemo(() =>
        Array.from(selectedIds)
            .map(id => members.get(id))
            .filter((m): m is NonNullable<typeof m> => !!m),
        [selectedIds, members]
    );

    const selectedNodes = useMemo(() =>
        Array.from(selectedIds)
            .map(id => nodes.get(id))
            .filter((n): n is NonNullable<typeof n> => !!n),
        [selectedIds, nodes]
    );

    useEffect(() => {
        if (selectedId) {
            const member = members.get(selectedId);
            if (member) {
                setCustomA((member.A ?? 0.01) * 1e4);
                setCustomI((member.I ?? 1e-4) * 1e8);
                setCustomE((member.E ?? 200e6) / 1e6);
            }
        }
        setShowCustomSection(false);
        setShowCustomMaterial(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    const selectedMember = selectedId ? members.get(selectedId) : null;

    // ================================
    // PANEL SHELL
    // ================================
    const panelCls = `relative w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 rounded-lg
                      p-3 text-slate-800 dark:text-slate-100 font-sans z-50 flex flex-col gap-1.5
                      max-h-[60vh] overflow-y-auto eng-scroll
                      shadow-xl shadow-black/20`;

    // ================================
    // MINIMIZED STATE
    // ================================
    if (isMinimized) {
        return (
            <button type="button"
                onClick={() => setIsMinimized(false)}
                className="w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 rounded-lg
                           px-3 py-2.5 text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-2 text-[13px]
                           font-medium hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                title="Expand Properties Panel"
            >
                <Settings2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Properties
                <ChevronDown className="w-3 h-3 text-slate-500 ml-auto" />
            </button>
        );
    }

    // ================================
    // NO SELECTION
    // ================================
    if (selectedIds.size === 0) {
        return (
            <div className={panelCls}>
                <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700/60 pb-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Properties</h3>
                    <button type="button" onClick={() => setIsMinimized(true)} className="text-slate-500 hover:text-slate-700 dark:text-slate-200 p-0.5 rounded transition-colors" title="Minimize">
                        <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                </div>
                <p className="text-slate-500 text-[13px]">No selection</p>
                {analysisResults && (
                    <div className="border-t border-slate-200/60 dark:border-slate-700/60 mt-2 pt-2">
                        <span className="text-emerald-400 text-xs flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Analysis complete
                        </span>
                    </div>
                )}
            </div>
        );
    }

    // ================================
    // MULTI-SELECTION: BULK EDIT
    // ================================
    if (selectedIds.size > 1) {

        if (selectedMembers.length > 0 && selectedNodes.length === 0) {
            const handleBulkSectionChange = (sectionId: string) => {
                const section = STEEL_SECTIONS.find(s => s.id === sectionId);
                if (section) {
                    const { A, I } = convertSectionToMeters(section);
                    const updates = new Map<string, Partial<typeof selectedMembers[0]>>();
                    selectedMembers.forEach(m => { updates.set(m.id, { sectionId, A, I }); });
                    updateMembers(updates);
                } else if (sectionId) {
                    const updates = new Map<string, Partial<typeof selectedMembers[0]>>();
                    selectedMembers.forEach(m => { updates.set(m.id, { sectionId }); });
                    updateMembers(updates);
                }
            };

            const handleBulkMaterialChange = (materialId: string) => {
                const material = MATERIAL_OPTIONS.find(m => m.id === materialId);
                if (material && material.E > 0) {
                    const updates = new Map<string, Partial<typeof selectedMembers[0]>>();
                    selectedMembers.forEach(m => { updates.set(m.id, { E: material.E }); });
                    updateMembers(updates);
                }
            };

            const handleBulkReleaseChange = (key: 'startMoment' | 'endMoment', value: boolean) => {
                const updates = new Map<string, Partial<typeof selectedMembers[0]>>();
                selectedMembers.forEach(m => {
                    const currentReleases = m.releases ?? { startMoment: false, endMoment: false };
                    updates.set(m.id, { releases: { ...currentReleases, [key]: value } });
                });
                updateMembers(updates);
            };

            return (
                <div className={panelCls}>
                    <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700/60 pb-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Bulk Edit
                            <span className="ml-2 text-[10px] font-normal bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded">
                                {selectedMembers.length} Members
                            </span>
                        </h3>
                        <button type="button" onClick={() => setIsMinimized(true)} className="text-slate-500 hover:text-slate-700 dark:text-slate-200 p-0.5 rounded transition-colors" title="Minimize">
                            <Minimize2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <PanelSection icon={<Ruler className="w-3.5 h-3.5" />} label="Section Category">
                        <PanelSelect value={sectionCategory} onChange={(e) => setSectionCategory(e.target.value as SectionCategory)}>
                            {SECTION_CATEGORIES.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.label}</option>
                            ))}
                        </PanelSelect>
                    </PanelSection>

                    <PanelSection icon={<Box className="w-3.5 h-3.5" />} label="Set Section">
                        <PanelSelect onChange={(e) => handleBulkSectionChange(e.target.value)} defaultValue="">
                            <option value="" disabled>Select to apply to all...</option>
                            {availableSections.map(section => (
                                <option key={section.id} value={section.id}>{section.name}</option>
                            ))}
                        </PanelSelect>
                    </PanelSection>

                    <Divider />

                    <PanelSection icon={<Layers className="w-3.5 h-3.5" />} label="Set Material">
                        <PanelSelect onChange={(e) => handleBulkMaterialChange(e.target.value)} defaultValue="">
                            <option value="" disabled>Select to apply to all...</option>
                            {MATERIAL_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </PanelSelect>
                    </PanelSection>

                    <Divider />

                    <PanelSection icon={<Unlock className="w-3.5 h-3.5" />} label="Bulk Releases">
                        <div className="flex gap-3 mt-1">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input type="checkbox" onChange={(e) => handleBulkReleaseChange('startMoment', e.target.checked)}
                                       className="accent-blue-500" /> Start
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input type="checkbox" onChange={(e) => handleBulkReleaseChange('endMoment', e.target.checked)}
                                       className="accent-blue-500" /> End
                            </label>
                        </div>
                        <span className="text-[10px] text-slate-600 mt-0.5">(Check to apply release to all)</span>
                    </PanelSection>

                    <Divider />

                    <button type="button"
                        onClick={() => selectedMembers.forEach(m => useModelStore.getState().removeMember(m.id))}
                        className="w-full py-1.5 rounded border border-red-500/40 text-red-400 text-xs font-medium
                                   hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                        <Trash2 className="w-3 h-3" /> Delete All Selected
                    </button>
                </div>
            );
        }

        // Mixed selection
        return (
            <div className={panelCls}>
                <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700/60 pb-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Multiple Selection</h3>
                    <button type="button" onClick={() => setIsMinimized(true)} className="text-slate-500 hover:text-slate-700 dark:text-slate-200 p-0.5 rounded transition-colors" title="Minimize">
                        <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                </div>
                <div className="text-[13px] mb-2 space-y-0.5 text-slate-500 dark:text-slate-400">
                    {selectedNodes.length > 0 && <div className="flex items-center gap-1.5"><CircleDot className="w-3 h-3 text-blue-400" /> {selectedNodes.length} Nodes</div>}
                    {selectedMembers.length > 0 && <div className="flex items-center gap-1.5"><Link2 className="w-3 h-3 text-orange-400" /> {selectedMembers.length} Members</div>}
                </div>
                <button type="button"
                    onClick={() => useModelStore.getState().deleteSelection()}
                    className="w-full py-1.5 rounded border border-red-500/40 text-red-400 text-xs font-medium
                               hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5"
                >
                    <Trash2 className="w-3 h-3" /> Delete Selection
                </button>
            </div>
        );
    }

    // ================================
    // SINGLE SELECTION
    // ================================
    const id = Array.from(selectedIds)[0]!;
    const node = nodes.get(id);
    const member = members.get(id);

    // ========================================
    // NODE PROPERTIES
    // ========================================
    if (node) {
        const restraints = node.restraints ?? { fx: false, fy: false, fz: false, mx: false, my: false, mz: false };
        const nodeLoads = loads.filter(l => l.nodeId === id);
        const disp = analysisResults?.displacements.get(id);
        const reaction = analysisResults?.reactions.get(id);

        const handleRestraintChange = (key: keyof Restraints, value: boolean) => {
            setNodeRestraints(id, { ...restraints, [key]: value });
        };

        const handleAddLoad = () => {
            const loadData = showFullLoadInput ? {
                id: crypto.randomUUID(),
                nodeId: id,
                fx: newLoadFx, fy: newLoadFy, fz: newLoadFz, mz: newLoadMz
            } : {
                id: crypto.randomUUID(),
                nodeId: id,
                fx: 0, fy: newLoadFy, fz: 0, mz: 0
            };
            addLoad(loadData);
            setNewLoadFx(0); setNewLoadFy(-10); setNewLoadFz(0); setNewLoadMz(0);
        };

        // Support type detection
        const isFixed = Object.values(restraints).every(v => v);
        const isPinned = restraints.fx && restraints.fy && restraints.fz && !restraints.mz;
        const isRoller = restraints.fy && !restraints.fx && !restraints.mz;
        const isFree = !Object.values(restraints).some(v => v);

        return (
            <div className={panelCls}>
                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700/60 pb-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Node Properties</h3>
                    <button type="button" onClick={() => setIsMinimized(true)} className="text-slate-500 hover:text-slate-700 dark:text-slate-200 p-0.5 rounded transition-colors" title="Minimize">
                        <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Node Badge */}
                <div className="bg-gradient-to-br from-blue-100/80 dark:from-blue-950/80 to-white dark:to-slate-950 rounded-md p-2.5 border border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-blue-400 flex items-center gap-1.5">
                            <CircleDot className="w-4 h-4" /> NODE
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                            #{id.slice(0, 8)}
                        </span>
                    </div>
                </div>

                {/* Coordinates */}
                <PanelSection icon={<Crosshair className="w-3.5 h-3.5 text-blue-400" />} label="Coordinates (m)">
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-100/50 dark:bg-slate-800/50 p-2 rounded-md">
                        <div className="text-center">
                            <span className="text-[10px] text-red-400 block mb-0.5 font-semibold">X</span>
                            <NumberInput value={node.x} onChange={(val) => updateNodePosition(id, { x: val })} className="text-center" />
                        </div>
                        <div className="text-center">
                            <span className="text-[10px] text-emerald-400 block mb-0.5 font-semibold">Y</span>
                            <NumberInput value={node.y} onChange={(val) => updateNodePosition(id, { y: val })} className="text-center" />
                        </div>
                        <div className="text-center">
                            <span className="text-[10px] text-blue-400 block mb-0.5 font-semibold">Z</span>
                            <NumberInput value={node.z} onChange={(val) => updateNodePosition(id, { z: val })} className="text-center" />
                        </div>
                    </div>
                </PanelSection>

                <Divider />

                {/* Supports */}
                <PanelSection icon={<Lock className="w-3.5 h-3.5 text-emerald-400" />} label="Boundary Conditions">
                    {/* Quick presets */}
                    <div className="flex gap-1 mb-2">
                        <PresetBtn label="Fixed" active={isFixed} onClick={() => {
                            handleRestraintChange('fx', true); handleRestraintChange('fy', true);
                            handleRestraintChange('fz', true); handleRestraintChange('mz', true);
                        }} title="Fixed Support" />
                        <PresetBtn label="Pinned" active={isPinned} onClick={() => {
                            handleRestraintChange('fx', true); handleRestraintChange('fy', true);
                            handleRestraintChange('fz', true); handleRestraintChange('mz', false);
                        }} title="Pinned Support" />
                        <PresetBtn label="Roller" active={isRoller} onClick={() => {
                            handleRestraintChange('fx', false); handleRestraintChange('fy', true);
                            handleRestraintChange('fz', false); handleRestraintChange('mz', false);
                        }} title="Roller Support" />
                        <PresetBtn label="Free" active={isFree} onClick={() => {
                            handleRestraintChange('fx', false); handleRestraintChange('fy', false);
                            handleRestraintChange('fz', false); handleRestraintChange('mz', false);
                        }} title="Free (No support)" />
                    </div>

                    {/* DOF Grid */}
                    <div className="grid grid-cols-3 gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-2 rounded-md">
                        <DofToggle label="Tx" sub="X-trans" active={restraints.fx} onChange={(v) => handleRestraintChange('fx', v)} />
                        <DofToggle label="Ty" sub="Y-trans" active={restraints.fy} onChange={(v) => handleRestraintChange('fy', v)} />
                        <DofToggle label="Tz" sub="Z-trans" active={restraints.fz} onChange={(v) => handleRestraintChange('fz', v)} />
                        <DofToggle label="Rx" sub="X-rot" active={restraints.mx ?? false} onChange={(v) => handleRestraintChange('mx', v)} />
                        <DofToggle label="Ry" sub="Y-rot" active={restraints.my ?? false} onChange={(v) => handleRestraintChange('my', v)} />
                        <DofToggle label="Rz" sub="Z-rot" active={restraints.mz} onChange={(v) => handleRestraintChange('mz', v)} />
                    </div>

                    {/* Support Type Indicator */}
                    <div className="mt-1.5 py-1 px-2 bg-emerald-500/5 rounded text-center">
                        <span className="text-[11px] text-emerald-400 font-medium">
                            {isFixed ? 'Fixed Support' :
                             isPinned ? 'Pinned Support' :
                             isRoller ? 'Roller Support' :
                             !isFree ? 'Partial Restraint' :
                             'Free Node'}
                        </span>
                    </div>
                </PanelSection>

                <Divider />

                {/* Loads */}
                <PanelSection icon={<ArrowDown className="w-3.5 h-3.5 text-yellow-400" />} label="Nodal Loads">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-500">{nodeLoads.length} load(s) applied</span>
                        <button type="button"
                            onClick={() => setShowFullLoadInput(!showFullLoadInput)}
                            className="text-[10px] text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center gap-0.5"
                        >
                            {showFullLoadInput ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                            {showFullLoadInput ? 'Simple' : 'Full'}
                        </button>
                    </div>

                    {/* Existing loads */}
                    {nodeLoads.map(load => (
                        <div key={load.id} className="flex justify-between items-center text-[11px] bg-blue-500/10 border border-blue-500/20 px-2 py-1.5 rounded">
                            <div className="font-mono text-slate-600 dark:text-slate-300">
                                {load.fx ? `Fx:${load.fx} ` : ''}
                                {load.fy ? `Fy:${load.fy} ` : ''}
                                {load.fz ? `Fz:${load.fz} ` : ''}
                                {load.mz ? `Mz:${load.mz}` : ''}
                                {!load.fx && !load.fy && !load.fz && !load.mz && 'Zero load'}
                                <span className="text-slate-600 ml-1">kN</span>
                            </div>
                            <button type="button" onClick={() => removeLoad(load.id)} className="text-red-400 hover:text-red-300 p-0.5 transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}

                    {/* Add Load Form */}
                    <div className="mt-2 p-2 bg-slate-100/50 dark:bg-slate-800/50 rounded-md">
                        {showFullLoadInput ? (
                            <div className="flex flex-col gap-1.5">
                                {[
                                    { label: 'Fx', value: newLoadFx, set: setNewLoadFx, unit: 'kN' },
                                    { label: 'Fy', value: newLoadFy, set: setNewLoadFy, unit: 'kN' },
                                    { label: 'Fz', value: newLoadFz, set: setNewLoadFz, unit: 'kN' },
                                    { label: 'Mz', value: newLoadMz, set: setNewLoadMz, unit: 'kN·m' },
                                ].map(({ label, value, set, unit }) => (
                                    <div key={label} className="flex items-center gap-1.5">
                                        <span className="text-[10px] w-5 text-slate-500 font-semibold">{label}</span>
                                        <NumberInput value={value} onChange={set} className="flex-1" />
                                        <span className="text-[10px] text-slate-600 w-6">{unit}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-500 font-semibold">Fy:</span>
                                <NumberInput value={newLoadFy} onChange={setNewLoadFy} className="w-20" />
                                <span className="text-[10px] text-slate-600">kN</span>
                            </div>
                        )}
                        <button type="button"
                            onClick={handleAddLoad}
                            className="w-full mt-2 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-medium rounded
                                       transition-colors flex items-center justify-center gap-1"
                        >
                            <Plus className="w-3 h-3" /> Add Load
                        </button>
                        <p className="text-[9px] text-slate-600 text-center mt-1">Negative = downward/leftward</p>
                    </div>
                </PanelSection>

                {/* Analysis Results */}
                {(disp || reaction) && (
                    <>
                        <Divider />
                        <div className="bg-gradient-to-br from-emerald-950/30 to-black/20 rounded-md p-2.5 border border-emerald-500/20">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-xs font-medium text-emerald-400">Analysis Results</span>
                            </div>

                            {/* Displacements */}
                            {disp && (
                                <div className="mb-2">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Displacements</span>
                                    <div className="grid grid-cols-2 gap-1">
                                        <InfoRow label="δx" value={`${(disp.dx * 1000).toFixed(3)} mm`} color="text-red-400" borderColor="border-red-500" />
                                        <InfoRow label="δy" value={`${(disp.dy * 1000).toFixed(3)} mm`} color="text-emerald-400" borderColor="border-emerald-500" />
                                        <InfoRow label="δz" value={`${(disp.dz * 1000).toFixed(3)} mm`} color="text-blue-400" borderColor="border-blue-500" />
                                        <InfoRow label="θz" value={`${(disp.rz * 1000).toFixed(4)} rad`} color="text-purple-400" borderColor="border-purple-500" />
                                    </div>
                                </div>
                            )}

                            {/* Reactions */}
                            {reaction && (reaction.fx !== 0 || reaction.fy !== 0 || reaction.fz !== 0 || reaction.mz !== 0) && (
                                <div>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Support Reactions</span>
                                    <div className="grid grid-cols-2 gap-1">
                                        <InfoRow label="Rx" value={`${reaction.fx.toFixed(2)} kN`} color="text-red-400" borderColor="border-red-500" />
                                        <InfoRow label="Ry" value={`${reaction.fy.toFixed(2)} kN`} color="text-emerald-400" borderColor="border-emerald-500" />
                                        <InfoRow label="Rz" value={`${reaction.fz.toFixed(2)} kN`} color="text-blue-400" borderColor="border-blue-500" />
                                        <InfoRow label="Mz" value={`${reaction.mz.toFixed(2)} kN·m`} color="text-purple-400" borderColor="border-purple-500" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // ========================================
    // MEMBER PROPERTIES
    // ========================================
    if (member) {
        const startNode = nodes.get(member.startNodeId);
        const endNode = nodes.get(member.endNodeId);
        const loadsForMember = memberLoads.filter(ml => ml.memberId === id);
        let length = 0;
        if (startNode && endNode) {
            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const dz = endNode.z - startNode.z;
            length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        const forces = analysisResults?.memberForces.get(id);
        const releases = member.releases ?? { startMoment: false, endMoment: false };

        const handleSectionChange = (sectionId: string) => {
            if (sectionId === 'custom') {
                setShowCustomSection(true);
                return;
            }
            const section = STEEL_SECTIONS.find(s => s.id === sectionId);
            if (section) {
                const { A, I } = convertSectionToMeters(section);
                updateMember(id, { sectionId, A, I });
            } else {
                updateMember(id, { sectionId });
            }
        };

        const handleMaterialChange = (materialId: string) => {
            if (materialId === 'custom') {
                setShowCustomMaterial(true);
                return;
            }
            const material = MATERIAL_OPTIONS.find(m => m.id === materialId);
            if (material && material.E > 0) {
                updateMember(id, { E: material.E });
            }
        };

        const handleApplyCustomSection = () => {
            updateMember(id, { sectionId: 'custom', A: customA / 1e4, I: customI / 1e8 });
            setShowCustomSection(false);
        };

        const handleApplyCustomMaterial = () => {
            updateMember(id, { E: customE * 1e6 });
            setShowCustomMaterial(false);
        };

        const handleReleaseChange = (key: 'startMoment' | 'endMoment', value: boolean) => {
            updateMember(id, { releases: { ...releases, [key]: value } });
        };

        const memberAngle = startNode && endNode ?
            Math.atan2(endNode.y - startNode.y, endNode.x - startNode.x) * 180 / Math.PI : 0;
        const isHorizontal = Math.abs(memberAngle) < 15 || Math.abs(memberAngle) > 165;
        const isVertical = Math.abs(memberAngle - 90) < 15 || Math.abs(memberAngle + 90) < 15;
        const memberType = isVertical ? 'Column' : isHorizontal ? 'Beam' : 'Inclined';
        const memberTypeColor = isVertical ? 'text-purple-400 bg-purple-500/15' :
                                isHorizontal ? 'text-emerald-400 bg-emerald-500/15' :
                                'text-amber-400 bg-amber-500/15';

        return (
            <div className={panelCls}>
                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700/60 pb-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Member Properties</h3>
                    <button type="button" onClick={() => setIsMinimized(true)} className="text-slate-500 hover:text-slate-700 dark:text-slate-200 p-0.5 rounded transition-colors" title="Minimize">
                        <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Member Badge */}
                <div className="bg-gradient-to-br from-orange-100/50 dark:from-orange-950/50 to-white dark:to-slate-950 rounded-md p-2.5 border border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-orange-400 flex items-center gap-1.5">
                            <Link2 className="w-4 h-4" /> MEMBER
                        </span>
                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${memberTypeColor}`}>
                            {memberType}
                        </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-1">#{id.slice(0, 8)}</div>
                </div>

                {/* Connectivity */}
                <PanelSection icon={<Link2 className="w-3.5 h-3.5 text-blue-400" />} label="Connectivity">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-2 rounded-md">
                        <div className="text-center">
                            <span className="text-[9px] text-slate-500 block">START (I)</span>
                            <span className="text-[11px] text-blue-400 font-mono">{member.startNodeId.slice(0, 6)}</span>
                            {startNode && <span className="text-[9px] text-slate-600 block">({startNode.x.toFixed(1)}, {startNode.y.toFixed(1)})</span>}
                        </div>
                        <span className="text-base text-orange-400">→</span>
                        <div className="text-center">
                            <span className="text-[9px] text-slate-500 block">END (J)</span>
                            <span className="text-[11px] text-blue-400 font-mono">{member.endNodeId.slice(0, 6)}</span>
                            {endNode && <span className="text-[9px] text-slate-600 block">({endNode.x.toFixed(1)}, {endNode.y.toFixed(1)})</span>}
                        </div>
                    </div>
                </PanelSection>

                <Divider />

                {/* Geometry */}
                <PanelSection icon={<Ruler className="w-3.5 h-3.5 text-emerald-400" />} label="Geometry">
                    <div className="grid grid-cols-2 gap-1">
                        <InfoRow label="Length" value={`${length.toFixed(3)} m`} color="text-emerald-400" />
                        <InfoRow label="Angle" value={`${memberAngle.toFixed(1)}°`} color="text-blue-400" />
                    </div>
                </PanelSection>

                <Divider />

                {/* Section Category */}
                <PanelSection icon={<Ruler className="w-3.5 h-3.5 text-cyan-400" />} label="Section Category">
                    <PanelSelect value={sectionCategory} onChange={(e) => setSectionCategory(e.target.value as SectionCategory)}>
                        {SECTION_CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                    </PanelSelect>
                </PanelSection>

                <Divider />

                {/* Section */}
                <PanelSection icon={<Box className="w-3.5 h-3.5 text-cyan-400" />} label="Section">
                    <PanelSelect value={member.sectionId || ''} onChange={(e) => handleSectionChange(e.target.value)}>
                        <option value="">Select section...</option>
                        {availableSections.map(section => (
                            <option key={section.id} value={section.id}>{section.name}</option>
                        ))}
                        <option value="custom">+ Custom Section...</option>
                    </PanelSelect>

                    {member.sectionId && member.sectionId !== 'custom' && (
                        <div className="text-[10px] text-slate-500 mt-1 font-mono">
                            A = {((member.A ?? 0.01) * 1e4).toFixed(1)} cm² | I = {((member.I ?? 1e-4) * 1e8).toFixed(1)} cm⁴
                        </div>
                    )}

                    {/* Custom Section Dialog */}
                    {showCustomSection && (
                        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg mt-2 border border-slate-300 dark:border-slate-600">
                            <div className="text-xs font-semibold mb-2 text-emerald-400 flex items-center gap-1.5">
                                <Settings2 className="w-3 h-3" /> Custom Section Properties
                            </div>
                            <div className="flex flex-col gap-2">
                                {[
                                    { label: 'Width (m)', value: member.dimensions?.rectWidth ?? member.dimensions?.width ?? 0.3, onChange: (v: number) => updateMember(id, { dimensions: { ...member.dimensions, rectWidth: v, width: v } }) },
                                    { label: 'Depth (m)', value: member.dimensions?.rectHeight ?? member.dimensions?.height ?? 0.5, onChange: (v: number) => updateMember(id, { dimensions: { ...member.dimensions, rectHeight: v, height: v } }) },
                                    { label: 'Area (cm²)', value: customA, onChange: setCustomA },
                                    { label: 'Iy (cm⁴)', value: customI, onChange: setCustomI },
                                ].map(({ label, value, onChange }) => (
                                    <div key={label} className="flex items-center gap-2">
                                        <label className="text-[11px] w-20 text-slate-500 dark:text-slate-400">{label}</label>
                                        <NumberInput value={value} onChange={onChange} className="flex-1" />
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-3">
                                <button type="button" onClick={handleApplyCustomSection}
                                    className="flex-1 py-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-medium rounded transition-colors">
                                    Apply
                                </button>
                                <button type="button" onClick={() => setShowCustomSection(false)}
                                    className="flex-1 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </PanelSection>

                <Divider />

                {/* Beta Angle */}
                <PanelSection icon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />} label="Beta Angle (deg)">
                    <NumberInput
                        value={member.betaAngle ?? 0}
                        onChange={(val) => updateMember(id, { betaAngle: val })}
                    />
                </PanelSection>

                <Divider />

                {/* Material */}
                <PanelSection icon={<Layers className="w-3.5 h-3.5 text-amber-400" />} label="Material">
                    <PanelSelect
                        value={MATERIAL_OPTIONS.find(m => Math.abs(m.E - (member.E ?? 200e6)) < 1e3)?.id || 'custom'}
                        onChange={(e) => handleMaterialChange(e.target.value)}
                    >
                        {MATERIAL_OPTIONS.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                        <option value="custom">+ Custom Material...</option>
                    </PanelSelect>

                    {/* Custom Material Dialog */}
                    {showCustomMaterial && (
                        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg mt-2 border border-slate-300 dark:border-slate-600">
                            <div className="text-xs font-semibold mb-2 text-blue-400 flex items-center gap-1.5">
                                <Settings2 className="w-3 h-3" /> Custom Material Properties
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-[11px] w-20 text-slate-500 dark:text-slate-400">E (GPa)</label>
                                <NumberInput value={customE} onChange={setCustomE} className="flex-1" />
                            </div>
                            <div className="flex gap-2 mt-3">
                                <button type="button" onClick={handleApplyCustomMaterial}
                                    className="flex-1 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors">
                                    Apply
                                </button>
                                <button type="button" onClick={() => setShowCustomMaterial(false)}
                                    className="flex-1 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                        E = {((member.E ?? 200e6) / 1e6).toFixed(0)} GPa
                    </div>
                </PanelSection>

                <Divider />

                {/* Member End Releases */}
                <PanelSection icon={<Unlock className="w-3.5 h-3.5 text-orange-400" />} label="Member End Releases">
                    <div className="grid grid-cols-2 gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-2 rounded-md">
                        {/* Start End */}
                        <div className="text-center">
                            <span className="text-[10px] text-blue-400 font-semibold block mb-1.5">START (I)</span>
                            <label className={`flex flex-col items-center py-2 px-2 rounded cursor-pointer border-2 transition-all
                                ${releases.startMoment ? 'border-orange-500 bg-orange-500/10' : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800'}`}>
                                <input type="checkbox" checked={releases.startMoment}
                                    onChange={(e) => handleReleaseChange('startMoment', e.target.checked)} className="hidden" />
                                {releases.startMoment ?
                                    <Unlock className="w-4 h-4 text-orange-400 mb-0.5" /> :
                                    <Lock className="w-4 h-4 text-slate-500 mb-0.5" />}
                                <span className={`text-[11px] ${releases.startMoment ? 'text-orange-400' : 'text-slate-500'}`}>
                                    {releases.startMoment ? 'Hinged' : 'Fixed'}
                                </span>
                                <span className="text-[8px] text-slate-600">Moment Release</span>
                            </label>
                        </div>

                        {/* End End */}
                        <div className="text-center">
                            <span className="text-[10px] text-blue-400 font-semibold block mb-1.5">END (J)</span>
                            <label className={`flex flex-col items-center py-2 px-2 rounded cursor-pointer border-2 transition-all
                                ${releases.endMoment ? 'border-orange-500 bg-orange-500/10' : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800'}`}>
                                <input type="checkbox" checked={releases.endMoment}
                                    onChange={(e) => handleReleaseChange('endMoment', e.target.checked)} className="hidden" />
                                {releases.endMoment ?
                                    <Unlock className="w-4 h-4 text-orange-400 mb-0.5" /> :
                                    <Lock className="w-4 h-4 text-slate-500 mb-0.5" />}
                                <span className={`text-[11px] ${releases.endMoment ? 'text-orange-400' : 'text-slate-500'}`}>
                                    {releases.endMoment ? 'Hinged' : 'Fixed'}
                                </span>
                                <span className="text-[8px] text-slate-600">Moment Release</span>
                            </label>
                        </div>
                    </div>

                    {/* Release Config Indicator */}
                    <div className="mt-1.5 py-1 px-2 bg-orange-500/5 rounded text-center">
                        <span className="text-[10px] text-orange-400">
                            {releases.startMoment && releases.endMoment ? 'Truss Member (Both ends released)' :
                             releases.startMoment ? 'Start Pinned Connection' :
                             releases.endMoment ? 'End Pinned Connection' :
                             'Rigid Frame Member'}
                        </span>
                    </div>
                </PanelSection>

                {/* Member Forces */}
                {forces && (
                    <>
                        <Divider />
                        <div className="bg-gradient-to-br from-emerald-950/30 to-black/20 rounded-md p-2.5 border border-emerald-500/20">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-xs font-medium text-emerald-400">Member End Forces</span>
                            </div>

                            <div className="grid grid-cols-2 gap-1">
                                <InfoRow
                                    label="Axial"
                                    value={`${forces.axial.toFixed(2)} kN ${forces.axial > 0 ? '(T)' : forces.axial < 0 ? '(C)' : ''}`}
                                    color={forces.axial > 0 ? 'text-red-400' : forces.axial < 0 ? 'text-blue-400' : 'text-slate-500'}
                                    borderColor={forces.axial > 0 ? 'border-red-500' : forces.axial < 0 ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700'}
                                />
                                <InfoRow label="Shear Y" value={`${forces.shearY.toFixed(2)} kN`} borderColor="border-emerald-500" />
                                <InfoRow label="Shear Z" value={`${(forces.shearZ ?? 0).toFixed(2)} kN`} borderColor="border-cyan-500" />
                                <InfoRow label="Moment" value={`${forces.momentZ.toFixed(2)} kN·m`} color="text-purple-400" borderColor="border-purple-500" />
                            </div>

                            <div className="mt-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded text-center text-[9px] text-slate-500">
                                {Math.abs(forces.axial) > Math.abs(forces.shearY) && Math.abs(forces.axial) > Math.abs(forces.momentZ) ?
                                    'Axial-dominant member' :
                                    Math.abs(forces.momentZ) > Math.abs(forces.shearY) ?
                                    'Bending-dominant member' :
                                    'Shear-dominant member'
                                }
                            </div>
                        </div>
                    </>
                )}

                <Divider />

                {/* Member Loads (UDL) */}
                <PanelSection icon={<ArrowDown className="w-3.5 h-3.5 text-purple-400" />} label="Member Loads (UDL)">
                    {/* Existing member loads */}
                    {loadsForMember.length > 0 ? (
                        <div className="space-y-1.5">
                            {loadsForMember.map((ml, idx) => (
                                <div key={ml.id} className="bg-purple-500/10 border border-purple-500/20 p-2 rounded-md">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-semibold text-purple-300">
                                            {ml.type || 'UDL'} #{idx + 1}
                                        </span>
                                        <button type="button" onClick={() => removeMemberLoad(ml.id)}
                                            className="text-red-400/70 hover:text-red-400 p-0.5 rounded transition-colors">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="text-[11px] mt-1 font-mono text-slate-500 dark:text-slate-400">
                                        w = {ml.w1?.toFixed(2) ?? '0.00'} kN/m ({ml.direction || 'global_y'})<br/>
                                        Range: {((ml.startPos ?? 0) * 100).toFixed(0)}% - {((ml.endPos ?? 1) * 100).toFixed(0)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-[11px] text-slate-600">No member loads</div>
                    )}

                    {/* Add new UDL */}
                    <div className="mt-2">
                        <button type="button"
                            onClick={() => setShowUdlOptions(!showUdlOptions)}
                            className={`w-full py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1
                                ${showUdlOptions ? 'bg-purple-700/50 text-purple-200' : 'bg-purple-600/70 hover:bg-purple-600 text-white'}`}
                        >
                            {showUdlOptions ? <ChevronDown className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                            {showUdlOptions ? 'Hide UDL Form' : 'Add UDL'}
                        </button>

                        {showUdlOptions && (
                            <div className="bg-purple-500/5 border border-purple-500/20 p-2.5 rounded-lg mt-2">
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-[11px] text-purple-300 block mb-0.5">Load (w) kN/m</label>
                                        <NumberInput value={newUdlW} onChange={setNewUdlW} />
                                        <span className="text-[9px] text-slate-600">Negative = downward</span>
                                    </div>

                                    <div>
                                        <label className="text-[11px] text-purple-300 block mb-0.5">Direction</label>
                                        <PanelSelect
                                            value={newUdlDirection}
                                            onChange={(e) => setNewUdlDirection(e.target.value as typeof newUdlDirection)}
                                        >
                                            {LOAD_DIRECTIONS.map(dir => (
                                                <option key={dir.value} value={dir.value}>{dir.label}</option>
                                            ))}
                                        </PanelSelect>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-[11px] text-purple-300 block mb-0.5">Start %</label>
                                            <NumberInput
                                                value={newUdlStartPos * 100}
                                                onChange={(v) => setNewUdlStartPos(Math.min(Math.max(v / 100, 0), 1))}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[11px] text-purple-300 block mb-0.5">End %</label>
                                            <NumberInput
                                                value={newUdlEndPos * 100}
                                                onChange={(v) => setNewUdlEndPos(Math.min(Math.max(v / 100, 0), 1))}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-slate-600">0% = start, 100% = end of member</p>

                                    <button type="button"
                                        onClick={() => {
                                            addMemberLoad({
                                                id: crypto.randomUUID(),
                                                memberId: id,
                                                type: 'UDL',
                                                w1: newUdlW,
                                                w2: newUdlW,
                                                direction: newUdlDirection,
                                                startPos: newUdlStartPos,
                                                endPos: newUdlEndPos
                                            });
                                            setNewUdlW(-10);
                                            setNewUdlDirection('global_y');
                                            setNewUdlStartPos(0);
                                            setNewUdlEndPos(1);
                                            setShowUdlOptions(false);
                                        }}
                                        className="w-full py-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-medium rounded
                                                   transition-colors flex items-center justify-center gap-1"
                                    >
                                        <CheckCircle2 className="w-3 h-3" /> Apply UDL
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </PanelSection>
            </div>
        );
    }

    return null;
});
