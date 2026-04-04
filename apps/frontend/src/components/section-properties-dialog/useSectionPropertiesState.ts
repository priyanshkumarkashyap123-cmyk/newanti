import { useCallback, useMemo, useState } from 'react';
import type { Material, SectionProperties, SectionType } from '../../data/SectionDatabase';
import {
    DEFAULT_CUSTOM_MATERIAL,
    DEFAULT_CUSTOM_SECTION,
    DEFAULT_DIMENSIONS,
    buildCommonConcreteSections,
    getFilteredSections,
    resolveSelectedMaterial,
    resolveSelectedSection,
    type InputMode,
    type MaterialType,
    type SectionShape,
} from './helpers';

interface UseSectionPropertiesStateArgs {
    initialSection?: SectionProperties;
    initialMaterial?: Material;
    onApply: (section: SectionProperties, material: Material) => void;
    onClose: () => void;
}

export function useSectionPropertiesState({
    initialSection,
    initialMaterial,
    onApply,
    onClose,
}: UseSectionPropertiesStateArgs) {
    const [activeTab, setActiveTab] = useState<InputMode>('database');
    const [materialType, setMaterialType] = useState<MaterialType>('steel');

    const [selectedSectionType, setSelectedSectionType] = useState<SectionType>('W');
    const [selectedSectionId, setSelectedSectionId] = useState<string>(initialSection?.id || 'W14x30');
    const [selectedMaterialId, setSelectedMaterialId] = useState<string>(initialMaterial?.id || 'steel-a36');

    const [customSection, setCustomSection] = useState<Partial<SectionProperties>>(DEFAULT_CUSTOM_SECTION);
    const [customMaterial, setCustomMaterial] = useState<Partial<Material>>(DEFAULT_CUSTOM_MATERIAL);

    const [sectionShape, setSectionShape] = useState<SectionShape>('I');
    const [dimensions, setDimensions] = useState(DEFAULT_DIMENSIONS);

    const concreteSections = useMemo(() => buildCommonConcreteSections(), []);

    const filteredSections = useMemo(
        () => getFilteredSections(selectedSectionType, concreteSections),
        [selectedSectionType, concreteSections]
    );

    const selectedSection = useMemo(
        () =>
            resolveSelectedSection({
                activeTab,
                selectedSectionId,
                sectionShape,
                dimensions,
                customSection,
                concreteSections,
                filteredSections,
            }),
        [activeTab, selectedSectionId, sectionShape, dimensions, customSection, concreteSections, filteredSections]
    );

    const selectedMaterial = useMemo(
        () => resolveSelectedMaterial(materialType, selectedMaterialId, customMaterial),
        [materialType, selectedMaterialId, customMaterial]
    );

    const handleApply = useCallback(() => {
        if (selectedSection && selectedMaterial) {
            onApply(selectedSection, selectedMaterial);
            onClose();
        }
    }, [selectedSection, selectedMaterial, onApply, onClose]);

    return {
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
    };
}
