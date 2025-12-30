/**
 * SectionPropertiesDialog.tsx - Comprehensive Section & Material Selection
 * 
 * Allows users to:
 * - Select from standard sections database
 * - Input custom section properties
 * - Select materials with properties
 * - Calculate section properties from dimensions
 */

import { FC, useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
    MATERIALS_DATABASE,
    STEEL_SECTIONS,
    REBAR_GRADES,
    Material,
    SectionProperties,
    SectionType,
    calculateRectangularSection,
    calculateCircularSection,
    calculateISection,
    getSectionsByType
} from '../data/SectionDatabase';

// ============================================
// TYPES
// ============================================

interface SectionPropertiesDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (section: SectionProperties, material: Material) => void;
    memberId?: string;
    initialSection?: SectionProperties;
    initialMaterial?: Material;
}

type InputMode = 'database' | 'custom' | 'calculate';
type MaterialType = 'steel' | 'concrete' | 'custom';

// ============================================
// COMPONENT
// ============================================

export const SectionPropertiesDialog: FC<SectionPropertiesDialogProps> = ({
    isOpen,
    onClose,
    onApply,
    memberId,
    initialSection,
    initialMaterial
}) => {
    // Tabs
    const [activeTab, setActiveTab] = useState<InputMode>('database');
    const [materialType, setMaterialType] = useState<MaterialType>('steel');

    // Database selection
    const [selectedSectionType, setSelectedSectionType] = useState<SectionType>('W');
    const [selectedSectionId, setSelectedSectionId] = useState<string>(initialSection?.id || 'W14x30');
    const [selectedMaterialId, setSelectedMaterialId] = useState<string>(initialMaterial?.id || 'steel-a36');

    // Custom section properties
    const [customSection, setCustomSection] = useState<Partial<SectionProperties>>({
        name: 'Custom Section',
        A: 5000,
        Ix: 100e6,
        Iy: 20e6,
        J: 50e3,
        Sx: 500e3,
        Sy: 100e3,
        Zx: 600e3,
        Zy: 120e3,
        rx: 100,
        ry: 50,
        weight: 40
    });

    // Custom material properties
    const [customMaterial, setCustomMaterial] = useState<Partial<Material>>({
        name: 'Custom Material',
        E: 200000,
        fy: 250,
        fu: 400,
        density: 7850,
        poissonsRatio: 0.3
    });

    // Calculate from dimensions
    const [sectionShape, setSectionShape] = useState<'rectangular' | 'circular' | 'I'>('I');
    const [dimensions, setDimensions] = useState({
        // Rectangular
        b: 300,
        h: 500,
        // Circular
        D: 400,
        // I-Section
        d: 300,
        bf: 150,
        tf: 12,
        tw: 8
    });

    // Filter sections by type
    const filteredSections = useMemo(() => {
        return getSectionsByType(selectedSectionType);
    }, [selectedSectionType]);

    // Get selected section
    const selectedSection = useMemo(() => {
        if (activeTab === 'database') {
            return STEEL_SECTIONS.find(s => s.id === selectedSectionId);
        } else if (activeTab === 'calculate') {
            switch (sectionShape) {
                case 'rectangular':
                    return calculateRectangularSection(dimensions.b, dimensions.h);
                case 'circular':
                    return calculateCircularSection(dimensions.D);
                case 'I':
                    return calculateISection(dimensions.d, dimensions.bf, dimensions.tf, dimensions.tw);
            }
        } else {
            return {
                id: 'custom',
                type: 'CUSTOM' as SectionType,
                ...customSection
            } as SectionProperties;
        }
    }, [activeTab, selectedSectionId, sectionShape, dimensions, customSection]);

    // Get selected material
    const selectedMaterial = useMemo(() => {
        if (materialType === 'custom') {
            return {
                id: 'custom',
                type: 'custom' as const,
                ...customMaterial
            } as Material;
        }
        return MATERIALS_DATABASE.find(m => m.id === selectedMaterialId) || MATERIALS_DATABASE[0];
    }, [materialType, selectedMaterialId, customMaterial]);

    const handleApply = () => {
        if (selectedSection && selectedMaterial) {
            onApply(selectedSection, selectedMaterial);
            onClose();
        }
    };

    const sectionTypes: { type: SectionType; label: string }[] = [
        { type: 'W', label: 'W Shapes (AISC)' },
        { type: 'ISMB', label: 'ISMB (Indian)' },
        { type: 'IPE', label: 'IPE (European)' },
        { type: 'HEA', label: 'HEA (European)' },
        { type: 'HSS-RECT', label: 'HSS Rectangular' },
    ];

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] max-h-[90vh] bg-surface-dark border border-border-dark rounded-xl shadow-2xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border-dark">
                        <div>
                            <Dialog.Title className="text-lg font-bold text-white">
                                Section & Material Properties
                            </Dialog.Title>
                            <Dialog.Description className="text-sm text-text-muted">
                                {memberId ? `Configure properties for Member ${memberId}` : 'Define section and material properties'}
                            </Dialog.Description>
                        </div>
                        <Dialog.Close className="text-text-muted hover:text-white p-2">
                            <span className="material-symbols-outlined">close</span>
                        </Dialog.Close>
                    </div>

                    <div className="flex h-[600px]">
                        {/* Left Panel - Input Mode */}
                        <div className="w-[400px] border-r border-border-dark overflow-y-auto">
                            {/* Mode Tabs */}
                            <div className="flex border-b border-border-dark">
                                <button
                                    onClick={() => setActiveTab('database')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'database'
                                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                            : 'text-text-muted hover:text-white'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[16px] mr-1 align-middle">database</span>
                                    Database
                                </button>
                                <button
                                    onClick={() => setActiveTab('calculate')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'calculate'
                                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                            : 'text-text-muted hover:text-white'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[16px] mr-1 align-middle">calculate</span>
                                    Calculate
                                </button>
                                <button
                                    onClick={() => setActiveTab('custom')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'custom'
                                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                            : 'text-text-muted hover:text-white'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[16px] mr-1 align-middle">edit</span>
                                    Custom
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Database Selection */}
                                {activeTab === 'database' && (
                                    <>
                                        <div>
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
                                                Section Type
                                            </label>
                                            <select
                                                value={selectedSectionType}
                                                onChange={(e) => setSelectedSectionType(e.target.value as SectionType)}
                                                className="w-full bg-zinc-900 border border-border-dark rounded-lg px-3 py-2 text-white text-sm"
                                            >
                                                {sectionTypes.map(st => (
                                                    <option key={st.type} value={st.type}>{st.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
                                                Section ({filteredSections.length} available)
                                            </label>
                                            <select
                                                value={selectedSectionId}
                                                onChange={(e) => setSelectedSectionId(e.target.value)}
                                                className="w-full bg-zinc-900 border border-border-dark rounded-lg px-3 py-2 text-white text-sm"
                                                size={8}
                                            >
                                                {filteredSections.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name} — {s.weight.toFixed(1)} kg/m
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}

                                {/* Calculate from Dimensions */}
                                {activeTab === 'calculate' && (
                                    <>
                                        <div>
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
                                                Section Shape
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(['rectangular', 'circular', 'I'] as const).map(shape => (
                                                    <button
                                                        key={shape}
                                                        onClick={() => setSectionShape(shape)}
                                                        className={`p-3 rounded-lg border text-center text-xs font-medium transition-all ${sectionShape === shape
                                                                ? 'bg-primary/20 border-primary text-primary'
                                                                : 'bg-zinc-900 border-border-dark text-text-muted hover:border-text-muted'
                                                            }`}
                                                    >
                                                        <span className="material-symbols-outlined text-[24px] block mb-1">
                                                            {shape === 'rectangular' ? 'rectangle' : shape === 'circular' ? 'circle' : 'view_column'}
                                                        </span>
                                                        {shape.charAt(0).toUpperCase() + shape.slice(1)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                                                Dimensions (mm)
                                            </label>

                                            {sectionShape === 'rectangular' && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs text-text-muted block mb-1">Width (b)</label>
                                                        <input
                                                            type="number"
                                                            value={dimensions.b}
                                                            onChange={(e) => setDimensions({ ...dimensions, b: Number(e.target.value) })}
                                                            className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-text-muted block mb-1">Height (h)</label>
                                                        <input
                                                            type="number"
                                                            value={dimensions.h}
                                                            onChange={(e) => setDimensions({ ...dimensions, h: Number(e.target.value) })}
                                                            className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {sectionShape === 'circular' && (
                                                <div>
                                                    <label className="text-xs text-text-muted block mb-1">Diameter (D)</label>
                                                    <input
                                                        type="number"
                                                        value={dimensions.D}
                                                        onChange={(e) => setDimensions({ ...dimensions, D: Number(e.target.value) })}
                                                        className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                    />
                                                </div>
                                            )}

                                            {sectionShape === 'I' && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs text-text-muted block mb-1">Depth (d)</label>
                                                        <input
                                                            type="number"
                                                            value={dimensions.d}
                                                            onChange={(e) => setDimensions({ ...dimensions, d: Number(e.target.value) })}
                                                            className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-text-muted block mb-1">Flange Width (bf)</label>
                                                        <input
                                                            type="number"
                                                            value={dimensions.bf}
                                                            onChange={(e) => setDimensions({ ...dimensions, bf: Number(e.target.value) })}
                                                            className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-text-muted block mb-1">Flange Thickness (tf)</label>
                                                        <input
                                                            type="number"
                                                            value={dimensions.tf}
                                                            onChange={(e) => setDimensions({ ...dimensions, tf: Number(e.target.value) })}
                                                            className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-text-muted block mb-1">Web Thickness (tw)</label>
                                                        <input
                                                            type="number"
                                                            value={dimensions.tw}
                                                            onChange={(e) => setDimensions({ ...dimensions, tw: Number(e.target.value) })}
                                                            className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Custom Input */}
                                {activeTab === 'custom' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-text-muted block mb-1">Section Name</label>
                                            <input
                                                type="text"
                                                value={customSection.name}
                                                onChange={(e) => setCustomSection({ ...customSection, name: e.target.value })}
                                                className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-text-muted block mb-1">Area (mm²)</label>
                                                <input
                                                    type="number"
                                                    value={customSection.A}
                                                    onChange={(e) => setCustomSection({ ...customSection, A: Number(e.target.value) })}
                                                    className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-muted block mb-1">Weight (kg/m)</label>
                                                <input
                                                    type="number"
                                                    value={customSection.weight}
                                                    onChange={(e) => setCustomSection({ ...customSection, weight: Number(e.target.value) })}
                                                    className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-muted block mb-1">Ix (mm⁴)</label>
                                                <input
                                                    type="number"
                                                    value={customSection.Ix}
                                                    onChange={(e) => setCustomSection({ ...customSection, Ix: Number(e.target.value) })}
                                                    className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-muted block mb-1">Iy (mm⁴)</label>
                                                <input
                                                    type="number"
                                                    value={customSection.Iy}
                                                    onChange={(e) => setCustomSection({ ...customSection, Iy: Number(e.target.value) })}
                                                    className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-muted block mb-1">Sx (mm³)</label>
                                                <input
                                                    type="number"
                                                    value={customSection.Sx}
                                                    onChange={(e) => setCustomSection({ ...customSection, Sx: Number(e.target.value) })}
                                                    className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-muted block mb-1">Zx (mm³)</label>
                                                <input
                                                    type="number"
                                                    value={customSection.Zx}
                                                    onChange={(e) => setCustomSection({ ...customSection, Zx: Number(e.target.value) })}
                                                    className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-muted block mb-1">rx (mm)</label>
                                                <input
                                                    type="number"
                                                    value={customSection.rx}
                                                    onChange={(e) => setCustomSection({ ...customSection, rx: Number(e.target.value) })}
                                                    className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-muted block mb-1">ry (mm)</label>
                                                <input
                                                    type="number"
                                                    value={customSection.ry}
                                                    onChange={(e) => setCustomSection({ ...customSection, ry: Number(e.target.value) })}
                                                    className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Material Selection */}
                                <div className="pt-4 border-t border-border-dark">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
                                        Material
                                    </label>
                                    <div className="flex gap-2 mb-3">
                                        {(['steel', 'concrete', 'custom'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setMaterialType(type)}
                                                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${materialType === type
                                                        ? 'bg-primary text-white'
                                                        : 'bg-zinc-800 text-text-muted hover:text-white'
                                                    }`}
                                            >
                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                            </button>
                                        ))}
                                    </div>

                                    {materialType !== 'custom' ? (
                                        <select
                                            value={selectedMaterialId}
                                            onChange={(e) => setSelectedMaterialId(e.target.value)}
                                            className="w-full bg-zinc-900 border border-border-dark rounded-lg px-3 py-2 text-white text-sm"
                                        >
                                            {MATERIALS_DATABASE
                                                .filter(m => m.type === materialType)
                                                .map(m => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                        </select>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-text-muted block mb-1">E (MPa)</label>
                                                <input
                                                    type="number"
                                                    value={customMaterial.E}
                                                    onChange={(e) => setCustomMaterial({ ...customMaterial, E: Number(e.target.value) })}
                                                    className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-muted block mb-1">fy (MPa)</label>
                                                <input
                                                    type="number"
                                                    value={customMaterial.fy}
                                                    onChange={(e) => setCustomMaterial({ ...customMaterial, fy: Number(e.target.value) })}
                                                    className="w-full bg-zinc-900 border border-border-dark rounded px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Panel - Properties Display */}
                        <div className="flex-1 p-4 overflow-y-auto bg-zinc-900/50">
                            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-[18px]">info</span>
                                Section Properties
                            </h3>

                            {selectedSection && (
                                <div className="space-y-4">
                                    {/* Section Name */}
                                    <div className="bg-primary/10 rounded-lg p-3 text-center">
                                        <p className="text-primary text-lg font-bold">{selectedSection.name}</p>
                                        <p className="text-text-muted text-xs">{selectedSection.type}</p>
                                    </div>

                                    {/* Geometric Properties */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <PropertyCard label="Area (A)" value={selectedSection.A} unit="mm²" />
                                        <PropertyCard label="Weight" value={selectedSection.weight} unit="kg/m" />
                                        <PropertyCard label="Ix" value={selectedSection.Ix} unit="mm⁴" scientific />
                                        <PropertyCard label="Iy" value={selectedSection.Iy} unit="mm⁴" scientific />
                                        <PropertyCard label="Sx" value={selectedSection.Sx} unit="mm³" scientific />
                                        <PropertyCard label="Sy" value={selectedSection.Sy} unit="mm³" scientific />
                                        <PropertyCard label="Zx" value={selectedSection.Zx} unit="mm³" scientific />
                                        <PropertyCard label="Zy" value={selectedSection.Zy} unit="mm³" scientific />
                                        <PropertyCard label="rx" value={selectedSection.rx} unit="mm" />
                                        <PropertyCard label="ry" value={selectedSection.ry} unit="mm" />
                                        <PropertyCard label="J" value={selectedSection.J} unit="mm⁴" scientific />
                                    </div>

                                    {/* Dimensions */}
                                    {(selectedSection.d || selectedSection.bf || selectedSection.D) && (
                                        <div className="pt-3 border-t border-border-dark">
                                            <h4 className="text-xs font-bold text-text-muted uppercase mb-2">Dimensions</h4>
                                            <div className="grid grid-cols-4 gap-2">
                                                {selectedSection.d && <PropertyCard label="d" value={selectedSection.d} unit="mm" small />}
                                                {selectedSection.bf && <PropertyCard label="bf" value={selectedSection.bf} unit="mm" small />}
                                                {selectedSection.tf && <PropertyCard label="tf" value={selectedSection.tf} unit="mm" small />}
                                                {selectedSection.tw && <PropertyCard label="tw" value={selectedSection.tw} unit="mm" small />}
                                                {selectedSection.D && <PropertyCard label="D" value={selectedSection.D} unit="mm" small />}
                                                {selectedSection.b && <PropertyCard label="b" value={selectedSection.b} unit="mm" small />}
                                                {selectedSection.h && <PropertyCard label="h" value={selectedSection.h} unit="mm" small />}
                                            </div>
                                        </div>
                                    )}

                                    {/* Material Properties */}
                                    <div className="pt-3 border-t border-border-dark">
                                        <h4 className="text-xs font-bold text-text-muted uppercase mb-2">Material: {selectedMaterial.name}</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <PropertyCard label="E" value={selectedMaterial.E} unit="MPa" />
                                            {selectedMaterial.fy && <PropertyCard label="fy" value={selectedMaterial.fy} unit="MPa" />}
                                            {selectedMaterial.fu && <PropertyCard label="fu" value={selectedMaterial.fu} unit="MPa" />}
                                            {selectedMaterial.fck && <PropertyCard label="fck" value={selectedMaterial.fck} unit="MPa" />}
                                            <PropertyCard label="ρ" value={selectedMaterial.density} unit="kg/m³" />
                                            <PropertyCard label="ν" value={selectedMaterial.poissonsRatio} unit="" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-4 border-t border-border-dark">
                        <p className="text-xs text-text-muted">
                            Properties will be applied to {memberId ? `Member ${memberId}` : 'selected members'}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-white border border-border-dark rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApply}
                                className="px-6 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-lg shadow-primary/20 transition-colors"
                            >
                                Apply Properties
                            </button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

// ============================================
// PROPERTY CARD COMPONENT
// ============================================

interface PropertyCardProps {
    label: string;
    value: number;
    unit: string;
    scientific?: boolean;
    small?: boolean;
}

const PropertyCard: FC<PropertyCardProps> = ({ label, value, unit, scientific, small }) => {
    const formattedValue = scientific
        ? value.toExponential(2)
        : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

    return (
        <div className={`bg-zinc-800 rounded-lg ${small ? 'p-2' : 'p-3'}`}>
            <p className={`text-text-muted ${small ? 'text-[10px]' : 'text-xs'} mb-0.5`}>{label}</p>
            <p className={`text-white font-mono ${small ? 'text-xs' : 'text-sm'} font-medium`}>
                {formattedValue} <span className="text-text-muted text-[10px]">{unit}</span>
            </p>
        </div>
    );
};

export default SectionPropertiesDialog;
