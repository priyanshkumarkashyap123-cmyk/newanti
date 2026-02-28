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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
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

    // Common concrete sections
    const CONCRETE_SECTIONS: SectionProperties[] = useMemo(() => [
        calculateRectangularSection(230, 300),  // 230x300 beam
        calculateRectangularSection(230, 450),  // 230x450 beam
        calculateRectangularSection(230, 600),  // 230x600 beam
        calculateRectangularSection(300, 300),  // 300x300 column
        calculateRectangularSection(300, 450),  // 300x450 column
        calculateRectangularSection(300, 600),  // 300x600 beam
        calculateRectangularSection(400, 400),  // 400x400 column
        calculateRectangularSection(450, 450),  // 450x450 column
        calculateRectangularSection(500, 500),  // 500x500 column
        calculateRectangularSection(600, 600),  // 600x600 column
        calculateCircularSection(300),          // Ø300 column
        calculateCircularSection(400),          // Ø400 column
        calculateCircularSection(450),          // Ø450 column
        calculateCircularSection(500),          // Ø500 column
        calculateCircularSection(600),          // Ø600 column
    ], []);

    // Filter sections by type
    const filteredSections = useMemo(() => {
        if (selectedSectionType === 'RECT-CONCRETE') {
            return CONCRETE_SECTIONS.filter(s => s.type === 'RECT-CONCRETE');
        }
        if (selectedSectionType === 'CIRC-CONCRETE') {
            return CONCRETE_SECTIONS.filter(s => s.type === 'CIRC-CONCRETE');
        }
        return getSectionsByType(selectedSectionType);
    }, [selectedSectionType, CONCRETE_SECTIONS]);

    // Get selected section
    const selectedSection = useMemo(() => {
        if (activeTab === 'database') {
            // Check steel sections first
            const steelSection = STEEL_SECTIONS.find(s => s.id === selectedSectionId);
            if (steelSection) return steelSection;
            // Check concrete sections
            const concreteSection = CONCRETE_SECTIONS.find(s => s.id === selectedSectionId);
            if (concreteSection) return concreteSection;
            return filteredSections[0]; // Fallback to first in filtered list
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

    const sectionTypes: { type: SectionType; label: string; category: 'steel' | 'concrete' }[] = [
        // Steel Sections
        { type: 'W', label: 'W Shapes (AISC)', category: 'steel' },
        { type: 'ISMB', label: 'ISMB (Indian)', category: 'steel' },
        { type: 'ISMC', label: 'ISMC Channel (Indian)', category: 'steel' },
        { type: 'IPE', label: 'IPE (European)', category: 'steel' },
        { type: 'HEA', label: 'HEA (European)', category: 'steel' },
        { type: 'HSS-RECT', label: 'HSS Rectangular', category: 'steel' },
        { type: 'HSS-ROUND', label: 'HSS Round/Pipe', category: 'steel' },
        // Concrete Sections
        { type: 'RECT-CONCRETE', label: 'RCC Rectangular Beam', category: 'concrete' },
        { type: 'CIRC-CONCRETE', label: 'RCC Circular Column', category: 'concrete' },
        { type: 'T-CONCRETE', label: 'RCC T-Beam', category: 'concrete' },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[900px] max-h-[90vh] overflow-hidden p-0">
                    {/* Header */}
                    <DialogHeader className="p-4 border-b border-border-dark">
                            <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-white">
                                Section & Material Properties
                            </DialogTitle>
                            <DialogDescription className="text-sm text-zinc-500 dark:text-zinc-400">
                                {memberId ? `Configure properties for Member ${memberId}` : 'Define section and material properties'}
                            </DialogDescription>
                    </DialogHeader>

                    <div className="flex h-[600px]">
                        {/* Left Panel - Input Mode */}
                        <div className="w-[400px] border-r border-border-dark overflow-y-auto">
                            {/* Mode Tabs */}
                            <div className="flex border-b border-border-dark">
                                <Button
                                    variant="ghost"
                                    onClick={() => setActiveTab('database')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium rounded-none transition-colors ${activeTab === 'database'
                                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[16px] mr-1 align-middle">database</span>
                                    Database
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setActiveTab('calculate')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium rounded-none transition-colors ${activeTab === 'calculate'
                                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[16px] mr-1 align-middle">calculate</span>
                                    Calculate
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setActiveTab('custom')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium rounded-none transition-colors ${activeTab === 'custom'
                                            ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[16px] mr-1 align-middle">edit</span>
                                    Custom
                                </Button>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Database Selection */}
                                {activeTab === 'database' && (
                                    <>
                                        <div>
                                            <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
                                                Section Type
                                            </Label>
                                            <select
                                                value={selectedSectionType}
                                                onChange={(e) => setSelectedSectionType(e.target.value as SectionType)}
                                                className="w-full bg-white dark:bg-zinc-900 border border-border-dark rounded-lg px-3 py-2 text-zinc-900 dark:text-white text-sm"
                                            >
                                                {sectionTypes.map(st => (
                                                    <option key={st.type} value={st.type}>{st.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
                                                Section ({filteredSections.length} available)
                                            </Label>
                                            <select
                                                value={selectedSectionId}
                                                onChange={(e) => setSelectedSectionId(e.target.value)}
                                                className="w-full bg-white dark:bg-zinc-900 border border-border-dark rounded-lg px-3 py-2 text-zinc-900 dark:text-white text-sm"
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
                                            <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
                                                Section Shape
                                            </Label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(['rectangular', 'circular', 'I'] as const).map(shape => (
                                                    <Button
                                                        key={shape}
                                                        variant="outline"
                                                        onClick={() => setSectionShape(shape)}
                                                        className={`p-3 h-auto rounded-lg border text-center text-xs font-medium transition-all ${sectionShape === shape
                                                                ? 'bg-primary/20 border-primary text-primary'
                                                                : 'bg-white dark:bg-zinc-900 border-border-dark text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500'
                                                            }`}
                                                    >
                                                        <span className="material-symbols-outlined text-[24px] block mb-1">
                                                            {shape === 'rectangular' ? 'rectangle' : shape === 'circular' ? 'circle' : 'view_column'}
                                                        </span>
                                                        {shape.charAt(0).toUpperCase() + shape.slice(1)}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                                                Dimensions (mm)
                                            </Label>

                                            {sectionShape === 'rectangular' && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Width (b)</Label>
                                                        <Input
                                                            type="number"
                                                            value={dimensions.b}
                                                            onChange={(e) => setDimensions({ ...dimensions, b: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Height (h)</Label>
                                                        <Input
                                                            type="number"
                                                            value={dimensions.h}
                                                            onChange={(e) => setDimensions({ ...dimensions, h: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {sectionShape === 'circular' && (
                                                <div>
                                                    <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Diameter (D)</Label>
                                                    <Input
                                                        type="number"
                                                        value={dimensions.D}
                                                        onChange={(e) => setDimensions({ ...dimensions, D: Number(e.target.value) })}
                                                    />
                                                </div>
                                            )}

                                            {sectionShape === 'I' && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Depth (d)</Label>
                                                        <Input
                                                            type="number"
                                                            value={dimensions.d}
                                                            onChange={(e) => setDimensions({ ...dimensions, d: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Flange Width (bf)</Label>
                                                        <Input
                                                            type="number"
                                                            value={dimensions.bf}
                                                            onChange={(e) => setDimensions({ ...dimensions, bf: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Flange Thickness (tf)</Label>
                                                        <Input
                                                            type="number"
                                                            value={dimensions.tf}
                                                            onChange={(e) => setDimensions({ ...dimensions, tf: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Web Thickness (tw)</Label>
                                                        <Input
                                                            type="number"
                                                            value={dimensions.tw}
                                                            onChange={(e) => setDimensions({ ...dimensions, tw: Number(e.target.value) })}
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
                                            <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Section Name</Label>
                                            <Input
                                                type="text"
                                                value={customSection.name}
                                                onChange={(e) => setCustomSection({ ...customSection, name: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Area (mm²)</Label>
                                                <Input
                                                    type="number"
                                                    value={customSection.A}
                                                    onChange={(e) => setCustomSection({ ...customSection, A: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Weight (kg/m)</Label>
                                                <Input
                                                    type="number"
                                                    value={customSection.weight}
                                                    onChange={(e) => setCustomSection({ ...customSection, weight: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Ix (mm⁴)</Label>
                                                <Input
                                                    type="number"
                                                    value={customSection.Ix}
                                                    onChange={(e) => setCustomSection({ ...customSection, Ix: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Iy (mm⁴)</Label>
                                                <Input
                                                    type="number"
                                                    value={customSection.Iy}
                                                    onChange={(e) => setCustomSection({ ...customSection, Iy: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Sx (mm³)</Label>
                                                <Input
                                                    type="number"
                                                    value={customSection.Sx}
                                                    onChange={(e) => setCustomSection({ ...customSection, Sx: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Zx (mm³)</Label>
                                                <Input
                                                    type="number"
                                                    value={customSection.Zx}
                                                    onChange={(e) => setCustomSection({ ...customSection, Zx: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">rx (mm)</Label>
                                                <Input
                                                    type="number"
                                                    value={customSection.rx}
                                                    onChange={(e) => setCustomSection({ ...customSection, rx: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">ry (mm)</Label>
                                                <Input
                                                    type="number"
                                                    value={customSection.ry}
                                                    onChange={(e) => setCustomSection({ ...customSection, ry: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Material Selection */}
                                <div className="pt-4 border-t border-border-dark">
                                    <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
                                        Material
                                    </Label>
                                    <div className="flex gap-2 mb-3">
                                        {(['steel', 'concrete', 'custom'] as const).map(type => (
                                            <Button
                                                key={type}
                                                variant={materialType === type ? 'default' : 'secondary'}
                                                onClick={() => setMaterialType(type)}
                                                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${materialType === type
                                                        ? 'bg-primary text-zinc-900 dark:text-white'
                                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                                    }`}
                                            >
                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                            </Button>
                                        ))}
                                    </div>

                                    {materialType !== 'custom' ? (
                                        <select
                                            value={selectedMaterialId}
                                            onChange={(e) => setSelectedMaterialId(e.target.value)}
                                            className="w-full bg-white dark:bg-zinc-900 border border-border-dark rounded-lg px-3 py-2 text-zinc-900 dark:text-white text-sm"
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
                                                <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">E (MPa)</Label>
                                                <Input
                                                    type="number"
                                                    value={customMaterial.E}
                                                    onChange={(e) => setCustomMaterial({ ...customMaterial, E: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">fy (MPa)</Label>
                                                <Input
                                                    type="number"
                                                    value={customMaterial.fy}
                                                    onChange={(e) => setCustomMaterial({ ...customMaterial, fy: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Panel - Properties Display */}
                        <div className="flex-1 p-4 overflow-y-auto bg-zinc-50 dark:bg-zinc-900/50">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-[18px]">info</span>
                                Section Properties
                            </h3>

                            {selectedSection && (
                                <div className="space-y-4">
                                    {/* Section Name */}
                                    <div className="bg-primary/10 rounded-lg p-3 text-center">
                                        <p className="text-primary text-lg font-bold">{selectedSection.name}</p>
                                        <p className="text-zinc-500 dark:text-zinc-400 text-xs">{selectedSection.type}</p>
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
                                            <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Dimensions</h4>
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
                                        <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Material: {selectedMaterial.name}</h4>
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
                    <DialogFooter className="flex items-center justify-between p-4 border-t border-border-dark sm:justify-between">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Properties will be applied to {memberId ? `Member ${memberId}` : 'selected members'}
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleApply}
                            >
                                Apply Properties
                            </Button>
                        </div>
                    </DialogFooter>
            </DialogContent>
        </Dialog>
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
        <div className={`bg-zinc-100 dark:bg-zinc-800 rounded-lg ${small ? 'p-2' : 'p-3'}`}>
            <p className={`text-zinc-500 dark:text-zinc-400 ${small ? 'text-[10px]' : 'text-xs'} mb-0.5`}>{label}</p>
            <p className={`text-zinc-900 dark:text-white font-mono ${small ? 'text-xs' : 'text-sm'} font-medium`}>
                {formattedValue} <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">{unit}</span>
            </p>
        </div>
    );
};

export default SectionPropertiesDialog;
