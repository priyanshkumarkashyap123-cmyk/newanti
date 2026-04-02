import { FC } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { MATERIALS_DATABASE, type Material, type SectionProperties } from '../../data/SectionDatabase';
import type { MaterialType, SectionDimensions, SectionShape } from './helpers';
import { MaterialTypeButton } from './ui';

interface CalculateSectionFormProps {
    sectionShape: SectionShape;
    dimensions: SectionDimensions;
    onSectionShapeChange: (shape: SectionShape) => void;
    onDimensionsChange: (nextDimensions: SectionDimensions) => void;
}

export const CalculateSectionForm: FC<CalculateSectionFormProps> = ({
    sectionShape,
    dimensions,
    onSectionShapeChange,
    onDimensionsChange,
}) => {
    return (
        <>
            <div>
                <Label className="text-xs font-bold text-[#869ab8] uppercase tracking-wider block mb-2">
                    Section Shape
                </Label>
                <div className="grid grid-cols-3 gap-2">
                    {(['rectangular', 'circular', 'I'] as const).map((shape) => (
                        <Button
                            key={shape}
                            variant="outline"
                            onClick={() => onSectionShapeChange(shape)}
                            className={`p-3 h-auto rounded-lg border text-center text-xs font-medium tracking-wide transition-all ${sectionShape === shape
                                    ? 'bg-primary/20 border-primary text-primary'
                                    : 'bg-[#0b1326] border-border-dark text-[#869ab8] hover:border-slate-400 dark:hover:border-slate-500'
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
                <Label className="text-xs font-bold text-[#869ab8] uppercase tracking-wider block">
                    Dimensions (mm)
                </Label>

                {sectionShape === 'rectangular' && (
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs text-[#869ab8] block mb-1">Width (b)</Label>
                            <Input
                                type="number"
                                value={dimensions.b}
                                onChange={(e) => onDimensionsChange({ ...dimensions, b: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-[#869ab8] block mb-1">Height (h)</Label>
                            <Input
                                type="number"
                                value={dimensions.h}
                                onChange={(e) => onDimensionsChange({ ...dimensions, h: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                )}

                {sectionShape === 'circular' && (
                    <div>
                        <Label className="text-xs text-[#869ab8] block mb-1">Diameter (D)</Label>
                        <Input
                            type="number"
                            value={dimensions.D}
                            onChange={(e) => onDimensionsChange({ ...dimensions, D: Number(e.target.value) })}
                        />
                    </div>
                )}

                {sectionShape === 'I' && (
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs text-[#869ab8] block mb-1">Depth (d)</Label>
                            <Input
                                type="number"
                                value={dimensions.d}
                                onChange={(e) => onDimensionsChange({ ...dimensions, d: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-[#869ab8] block mb-1">Flange Width (bf)</Label>
                            <Input
                                type="number"
                                value={dimensions.bf}
                                onChange={(e) => onDimensionsChange({ ...dimensions, bf: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-[#869ab8] block mb-1">Flange Thickness (tf)</Label>
                            <Input
                                type="number"
                                value={dimensions.tf}
                                onChange={(e) => onDimensionsChange({ ...dimensions, tf: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-[#869ab8] block mb-1">Web Thickness (tw)</Label>
                            <Input
                                type="number"
                                value={dimensions.tw}
                                onChange={(e) => onDimensionsChange({ ...dimensions, tw: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

interface CustomSectionFormProps {
    customSection: Partial<SectionProperties>;
    onCustomSectionChange: (nextSection: Partial<SectionProperties>) => void;
}

export const CustomSectionForm: FC<CustomSectionFormProps> = ({ customSection, onCustomSectionChange }) => {
    return (
        <div className="space-y-3">
            <div>
                <Label className="text-xs text-[#869ab8] block mb-1">Section Name</Label>
                <Input
                    type="text"
                    value={customSection.name}
                    onChange={(e) => onCustomSectionChange({ ...customSection, name: e.target.value })}
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs text-[#869ab8] block mb-1">Area (mm²)</Label>
                    <Input
                        type="number"
                        value={customSection.A}
                        onChange={(e) => onCustomSectionChange({ ...customSection, A: Number(e.target.value) })}
                    />
                </div>
                <div>
                    <Label className="text-xs text-[#869ab8] block mb-1">Weight (kg/m)</Label>
                    <Input
                        type="number"
                        value={customSection.weight}
                        onChange={(e) => onCustomSectionChange({ ...customSection, weight: Number(e.target.value) })}
                    />
                </div>
                <div>
                    <Label className="text-xs text-[#869ab8] block mb-1">Ix (mm⁴)</Label>
                    <Input
                        type="number"
                        value={customSection.Ix}
                        onChange={(e) => onCustomSectionChange({ ...customSection, Ix: Number(e.target.value) })}
                    />
                </div>
                <div>
                    <Label className="text-xs text-[#869ab8] block mb-1">Iy (mm⁴)</Label>
                    <Input
                        type="number"
                        value={customSection.Iy}
                        onChange={(e) => onCustomSectionChange({ ...customSection, Iy: Number(e.target.value) })}
                    />
                </div>
                <div>
                    <Label className="text-xs text-[#869ab8] block mb-1">Sx (mm³)</Label>
                    <Input
                        type="number"
                        value={customSection.Sx}
                        onChange={(e) => onCustomSectionChange({ ...customSection, Sx: Number(e.target.value) })}
                    />
                </div>
                <div>
                    <Label className="text-xs text-[#869ab8] block mb-1">Zx (mm³)</Label>
                    <Input
                        type="number"
                        value={customSection.Zx}
                        onChange={(e) => onCustomSectionChange({ ...customSection, Zx: Number(e.target.value) })}
                    />
                </div>
                <div>
                    <Label className="text-xs text-[#869ab8] block mb-1">rx (mm)</Label>
                    <Input
                        type="number"
                        value={customSection.rx}
                        onChange={(e) => onCustomSectionChange({ ...customSection, rx: Number(e.target.value) })}
                    />
                </div>
                <div>
                    <Label className="text-xs text-[#869ab8] block mb-1">ry (mm)</Label>
                    <Input
                        type="number"
                        value={customSection.ry}
                        onChange={(e) => onCustomSectionChange({ ...customSection, ry: Number(e.target.value) })}
                    />
                </div>
            </div>
        </div>
    );
};

interface MaterialSelectionFormProps {
    materialType: MaterialType;
    selectedMaterialId: string;
    customMaterial: Partial<Material>;
    onMaterialTypeChange: (type: MaterialType) => void;
    onSelectedMaterialIdChange: (materialId: string) => void;
    onCustomMaterialChange: (nextMaterial: Partial<Material>) => void;
}

export const MaterialSelectionForm: FC<MaterialSelectionFormProps> = ({
    materialType,
    selectedMaterialId,
    customMaterial,
    onMaterialTypeChange,
    onSelectedMaterialIdChange,
    onCustomMaterialChange,
}) => {
    return (
        <div className="pt-4 border-t border-border-dark">
            <Label className="text-xs font-bold text-[#869ab8] uppercase tracking-wider block mb-2">
                Material
            </Label>
            <div className="flex gap-2 mb-3">
                {(['steel', 'concrete', 'custom'] as const).map((type) => (
                    <MaterialTypeButton
                        key={type}
                        type={type}
                        selectedType={materialType}
                        onSelect={onMaterialTypeChange}
                    />
                ))}
            </div>

            {materialType !== 'custom' ? (
                <select
                    value={selectedMaterialId}
                    onChange={(e) => onSelectedMaterialIdChange(e.target.value)}
                    className="w-full bg-[#0b1326] border border-border-dark rounded-lg px-3 py-2 text-[#dae2fd] text-sm"
                >
                    {MATERIALS_DATABASE
                        .filter((material) => material.type === materialType)
                        .map((material) => (
                            <option key={material.id} value={material.id}>{material.name}</option>
                        ))}
                </select>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label className="text-xs text-[#869ab8] block mb-1">E (MPa)</Label>
                        <Input
                            type="number"
                            value={customMaterial.E}
                            onChange={(e) => onCustomMaterialChange({ ...customMaterial, E: Number(e.target.value) })}
                        />
                    </div>
                    <div>
                        <Label className="text-xs text-[#869ab8] block mb-1">fy (MPa)</Label>
                        <Input
                            type="number"
                            value={customMaterial.fy}
                            onChange={(e) => onCustomMaterialChange({ ...customMaterial, fy: Number(e.target.value) })}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
