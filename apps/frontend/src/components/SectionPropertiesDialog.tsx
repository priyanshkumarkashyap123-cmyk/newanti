/**
 * SectionPropertiesDialog.tsx - Comprehensive Section & Material Selection
 * 
 * Allows users to:
 * - Select from standard sections database
 * - Input custom section properties
 * - Select materials with properties
 * - Calculate section properties from dimensions
 */

import { FC } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
type Material = import('../data/SectionDatabase').Material;
type SectionProperties = import('../data/SectionDatabase').SectionProperties;
import {
    SECTION_TYPES,
} from './section-properties-dialog/helpers';
import { CalculateSectionForm, CustomSectionForm, MaterialSelectionForm } from './section-properties-dialog/forms';
import { ModeTabButton, PropertyCard } from './section-properties-dialog/ui';
import { useSectionPropertiesState } from './section-properties-dialog/useSectionPropertiesState';

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
    const {
        activeTab,
        setActiveTab,
        materialType,
        setMaterialType,
        selectedSectionType,
        setSelectedSectionType,
        selectedSectionId,
        setSelectedSectionId,
        selectedMaterialId,
        setSelectedMaterialId,
        customSection,
        setCustomSection,
        customMaterial,
        setCustomMaterial,
        sectionShape,
        setSectionShape,
        dimensions,
        setDimensions,
        filteredSections,
        selectedSection,
        selectedMaterial,
        handleApply,
    } = useSectionPropertiesState({
        initialSection,
        initialMaterial,
        onApply,
        onClose,
    });

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[900px] max-h-[90vh] overflow-hidden p-0">
                    {/* Header */}
                    <DialogHeader className="p-4 border-b border-border-dark">
                            <DialogTitle className="text-lg font-bold text-[#dae2fd]">
                                Section & Material Properties
                            </DialogTitle>
                            <DialogDescription className="text-sm text-[#869ab8]">
                                {memberId ? `Configure properties for Member ${memberId}` : 'Define section and material properties'}
                            </DialogDescription>
                    </DialogHeader>

                    <div className="flex h-[600px]">
                        {/* Left Panel - Input Mode */}
                        <div className="w-[400px] border-r border-border-dark overflow-y-auto">
                            {/* Mode Tabs */}
                            <div className="flex border-b border-border-dark">
                                <ModeTabButton tab="database" activeTab={activeTab} icon="database" label="Database" onSelect={setActiveTab} />
                                <ModeTabButton tab="calculate" activeTab={activeTab} icon="calculate" label="Calculate" onSelect={setActiveTab} />
                                <ModeTabButton tab="custom" activeTab={activeTab} icon="edit" label="Custom" onSelect={setActiveTab} />
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Database Selection */}
                                {activeTab === 'database' && (
                                    <>
                                        <div>
                                            <Label className="text-xs font-bold text-[#869ab8] uppercase tracking-wider block mb-2">
                                                Section Type
                                            </Label>
                                            <select
                                                value={selectedSectionType}
                                                onChange={(e) => setSelectedSectionType(e.target.value as typeof selectedSectionType)}
                                                className="w-full bg-[#0b1326] border border-border-dark rounded-lg px-3 py-2 text-[#dae2fd] text-sm"
                                            >
                                                {SECTION_TYPES.map(st => (
                                                    <option key={st.type} value={st.type}>{st.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <Label className="text-xs font-bold text-[#869ab8] uppercase tracking-wider block mb-2">
                                                Section ({filteredSections.length} available)
                                            </Label>
                                            <select
                                                value={selectedSectionId}
                                                onChange={(e) => setSelectedSectionId(e.target.value)}
                                                className="w-full bg-[#0b1326] border border-border-dark rounded-lg px-3 py-2 text-[#dae2fd] text-sm"
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
                                    <CalculateSectionForm
                                        sectionShape={sectionShape}
                                        dimensions={dimensions}
                                        onSectionShapeChange={setSectionShape}
                                        onDimensionsChange={setDimensions}
                                    />
                                )}

                                {/* Custom Input */}
                                {activeTab === 'custom' && (
                                    <CustomSectionForm
                                        customSection={customSection}
                                        onCustomSectionChange={setCustomSection}
                                    />
                                )}

                                <MaterialSelectionForm
                                    materialType={materialType}
                                    selectedMaterialId={selectedMaterialId}
                                    customMaterial={customMaterial}
                                    onMaterialTypeChange={setMaterialType}
                                    onSelectedMaterialIdChange={setSelectedMaterialId}
                                    onCustomMaterialChange={setCustomMaterial}
                                />
                            </div>
                        </div>

                        {/* Right Panel - Properties Display */}
                        <div className="flex-1 p-4 overflow-y-auto bg-[#0b1326]">
                            <h3 className="text-sm font-bold text-[#dae2fd] mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-[18px]">info</span>
                                Section Properties
                            </h3>

                            {selectedSection && (
                                <div className="space-y-4">
                                    {/* Section Name */}
                                    <div className="bg-primary/10 rounded-lg p-3 text-center">
                                        <p className="text-primary text-lg font-bold">{selectedSection.name}</p>
                                        <p className="text-[#869ab8] text-xs">{selectedSection.type}</p>
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
                                            <h4 className="text-xs font-bold text-[#869ab8] uppercase mb-2">Dimensions</h4>
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
                                        <h4 className="text-xs font-bold text-[#869ab8] uppercase mb-2">Material: {selectedMaterial.name}</h4>
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
                        <p className="text-xs text-[#869ab8]">
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

export default SectionPropertiesDialog;
