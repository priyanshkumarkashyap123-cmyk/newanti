/**
 * PropertyInspector.tsx - Side Panel for Member Properties
 * 
 * Features:
 * - Selection-based property display
 * - Section database picker (European/US/UK)
 * - Material editor with presets
 * - Live updates to store
 */

import { FC, useState, useEffect, useMemo, useCallback } from 'react';
import { useModelStore, Member } from '../../store/model';
import sectionsData from '../../data/sections.json';

// ============================================
// TYPES
// ============================================

interface SectionData {
    type: string;
    height?: number;
    width?: number;
    webThickness?: number;
    flangeThickness?: number;
    outerWidth?: number;
    outerHeight?: number;
    thickness?: number;
    diameter?: number;
    legA?: number;
    legB?: number;
    area: number;
    Iy: number;
    Iz: number;
    weight: number;
}

interface MaterialData {
    name: string;
    E: number;      // MPa
    Fy: number;     // MPa
    density: number; // kg/m³
    poisson: number;
}

type DatabaseKey = 'indian' | 'european' | 'us' | 'tubes';
type MaterialKey = keyof typeof sectionsData.materials;

// ============================================
// STYLES
// ============================================

const styles = {
    container: {
        width: '320px',
        backgroundColor: '#1a1a2e',
        borderLeft: '1px solid #333',
        height: '100%',
        overflow: 'auto',
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: '#e4e4e7',
    } as React.CSSProperties,

    header: {
        padding: '16px 20px',
        borderBottom: '1px solid #333',
        backgroundColor: '#16162a',
    } as React.CSSProperties,

    title: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#fff',
        margin: 0,
    } as React.CSSProperties,

    subtitle: {
        fontSize: '12px',
        color: '#71717a',
        marginTop: '4px',
    } as React.CSSProperties,

    section: {
        padding: '16px 20px',
        borderBottom: '1px solid #2a2a40',
    } as React.CSSProperties,

    sectionTitle: {
        fontSize: '11px',
        fontWeight: 600,
        color: '#a1a1aa',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        marginBottom: '12px',
    } as React.CSSProperties,

    formGroup: {
        marginBottom: '12px',
    } as React.CSSProperties,

    label: {
        display: 'block',
        fontSize: '12px',
        color: '#a1a1aa',
        marginBottom: '6px',
    } as React.CSSProperties,

    select: {
        width: '100%',
        padding: '8px 12px',
        backgroundColor: '#2a2a40',
        border: '1px solid #3f3f5a',
        borderRadius: '6px',
        color: '#e4e4e7',
        fontSize: '13px',
        cursor: 'pointer',
        outline: 'none',
    } as React.CSSProperties,

    input: {
        width: '100%',
        padding: '8px 12px',
        backgroundColor: '#2a2a40',
        border: '1px solid #3f3f5a',
        borderRadius: '6px',
        color: '#e4e4e7',
        fontSize: '13px',
        outline: 'none',
        boxSizing: 'border-box' as const,
    } as React.CSSProperties,

    inputRow: {
        display: 'flex',
        gap: '8px',
    } as React.CSSProperties,

    inputHalf: {
        flex: 1,
    } as React.CSSProperties,

    propertyGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
    } as React.CSSProperties,

    propertyCard: {
        backgroundColor: '#2a2a40',
        padding: '12px',
        borderRadius: '8px',
    } as React.CSSProperties,

    propertyLabel: {
        fontSize: '10px',
        color: '#71717a',
        textTransform: 'uppercase' as const,
    } as React.CSSProperties,

    propertyValue: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#fff',
        marginTop: '2px',
    } as React.CSSProperties,

    noSelection: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        height: '300px',
        color: '#71717a',
        textAlign: 'center' as const,
        padding: '20px',
    } as React.CSSProperties,

    presetButton: {
        padding: '6px 12px',
        backgroundColor: '#3f3f5a',
        border: 'none',
        borderRadius: '4px',
        color: '#e4e4e7',
        fontSize: '11px',
        cursor: 'pointer',
        marginRight: '6px',
        marginBottom: '6px',
    } as React.CSSProperties,

    activePreset: {
        backgroundColor: '#3b82f6',
        color: '#fff',
    } as React.CSSProperties,
};

// ============================================
// HELPER COMPONENTS
// ============================================

const NoSelection: FC = () => (
    <div style={styles.noSelection}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9l6 6M15 9l-6 6" />
        </svg>
        <p style={{ marginTop: '16px', fontSize: '14px' }}>No Member Selected</p>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>
            Click on a member in the 3D view to edit its properties
        </p>
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

interface PropertyInspectorProps {
    selectedMemberId?: string | null;
}

export const PropertyInspector: FC<PropertyInspectorProps> = ({ selectedMemberId: propSelectedId }) => {
    // Store connection
    const { members, updateMember, selectedIds } = useModelStore();

    // Use prop or store selection
    const selectedMemberId = propSelectedId ?? (selectedIds.size === 1 ? [...selectedIds][0] : null);

    // Get selected member
    const selectedMember = useMemo(() => {
        if (!selectedMemberId) return null;
        return members.get(selectedMemberId) || null;
    }, [selectedMemberId, members]);

    // Local state for form values
    const [selectedDatabase, setSelectedDatabase] = useState<DatabaseKey>('european');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [selectedMaterial, setSelectedMaterial] = useState<MaterialKey>('S275');
    const [customE, setCustomE] = useState<string>('210000');
    const [customFy, setCustomFy] = useState<string>('275');

    // Get available sections for selected database
    const availableSections = useMemo(() => {
        const db = sectionsData.databases[selectedDatabase];
        if (!db) return [];
        return Object.keys(db.sections);
    }, [selectedDatabase]);

    // Get current section data
    const currentSectionData = useMemo((): SectionData | null => {
        if (!selectedSection) return null;
        const db = sectionsData.databases[selectedDatabase];
        if (!db) return null;
        return (db.sections as Record<string, SectionData>)[selectedSection] || null;
    }, [selectedDatabase, selectedSection]);

    // Get current material data
    const currentMaterial = useMemo((): MaterialData => {
        return sectionsData.materials[selectedMaterial] as MaterialData;
    }, [selectedMaterial]);

    // Update member when section changes
    const handleSectionChange = useCallback((sectionName: string) => {
        setSelectedSection(sectionName);

        if (!selectedMemberId) return;

        const db = sectionsData.databases[selectedDatabase];
        if (!db) return;

        const sectionData = (db.sections as Record<string, SectionData>)[sectionName];
        if (!sectionData) return;

        // Convert mm² to m², mm⁴ to m⁴
        const area = sectionData.area * 1e-6;  // mm² to m²
        const I = sectionData.Iy * 1e-12;      // mm⁴ to m⁴

        updateMember(selectedMemberId, {
            sectionId: sectionName,
            A: area,
            I: I,
        });
    }, [selectedMemberId, selectedDatabase, updateMember]);

    // Update member when material changes
    const handleMaterialChange = useCallback((materialKey: MaterialKey) => {
        setSelectedMaterial(materialKey);

        if (!selectedMemberId) return;

        const material = sectionsData.materials[materialKey] as MaterialData;
        if (!material) return;

        // Convert MPa to kN/m² (1 MPa = 1000 kN/m²)
        const E = material.E * 1000;

        setCustomE(material.E.toString());
        setCustomFy(material.Fy.toString());

        updateMember(selectedMemberId, { E });
    }, [selectedMemberId, updateMember]);

    // Update member when custom E changes
    const handleCustomEChange = useCallback((value: string) => {
        setCustomE(value);

        if (!selectedMemberId) return;

        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;

        // Convert MPa to kN/m²
        updateMember(selectedMemberId, { E: numValue * 1000 });
    }, [selectedMemberId, updateMember]);

    // Initialize form when member changes
    useEffect(() => {
        if (selectedMember) {
            // Try to find the section in databases
            // For now, set defaults
            if (selectedMember.sectionId) {
                queueMicrotask(() => {
                    setSelectedSection(selectedMember.sectionId!);
                });
            }
        }
    }, [selectedMember]);

    // Render
    if (!selectedMember) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Property Inspector</h3>
                    <p style={styles.subtitle}>Edit member properties</p>
                </div>
                <NoSelection />
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h3 style={styles.title}>Member Properties</h3>
                <p style={styles.subtitle}>ID: {selectedMember.id.slice(0, 12)}</p>
            </div>

            {/* Section Database Picker */}
            <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Section Database</h4>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Database</label>
                    <select
                        style={styles.select}
                        value={selectedDatabase}
                        onChange={(e) => setSelectedDatabase(e.target.value as DatabaseKey)}
                    >
                        {Object.entries(sectionsData.databases).map(([key, db]) => (
                            <option key={key} value={key}>
                                {(db as any).name}
                            </option>
                        ))}
                    </select>
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Section Size</label>
                    <select
                        style={styles.select}
                        value={selectedSection}
                        onChange={(e) => handleSectionChange(e.target.value)}
                    >
                        <option value="">Select a section...</option>
                        {availableSections.map((section) => (
                            <option key={section} value={section}>
                                {section}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Section Properties Display */}
                {currentSectionData && (
                    <div style={styles.propertyGrid}>
                        <div style={styles.propertyCard}>
                            <div style={styles.propertyLabel}>Area</div>
                            <div style={styles.propertyValue}>{currentSectionData.area} mm²</div>
                        </div>
                        <div style={styles.propertyCard}>
                            <div style={styles.propertyLabel}>Weight</div>
                            <div style={styles.propertyValue}>{currentSectionData.weight} kg/m</div>
                        </div>
                        <div style={styles.propertyCard}>
                            <div style={styles.propertyLabel}>Iy</div>
                            <div style={styles.propertyValue}>{(currentSectionData.Iy / 1e4).toFixed(0)} cm⁴</div>
                        </div>
                        <div style={styles.propertyCard}>
                            <div style={styles.propertyLabel}>Iz</div>
                            <div style={styles.propertyValue}>{(currentSectionData.Iz / 1e4).toFixed(0)} cm⁴</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Material Editor */}
            <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Material</h4>

                {/* Presets */}
                <div style={{ marginBottom: '12px' }}>
                    {(Object.keys(sectionsData.materials) as MaterialKey[]).slice(0, 4).map((key) => (
                        <button
                            key={key}
                            style={{
                                ...styles.presetButton,
                                ...(selectedMaterial === key ? styles.activePreset : {})
                            }}
                            onClick={() => handleMaterialChange(key)}
                        >
                            {(sectionsData.materials[key] as MaterialData).name}
                        </button>
                    ))}
                </div>

                {/* Custom Inputs */}
                <div style={styles.inputRow}>
                    <div style={styles.inputHalf}>
                        <label style={styles.label}>E (MPa)</label>
                        <input
                            type="number"
                            style={styles.input}
                            value={customE}
                            onChange={(e) => handleCustomEChange(e.target.value)}
                        />
                    </div>
                    <div style={styles.inputHalf}>
                        <label style={styles.label}>Fy (MPa)</label>
                        <input
                            type="number"
                            style={styles.input}
                            value={customFy}
                            onChange={(e) => setCustomFy(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Current Properties */}
            <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Applied Properties</h4>
                <div style={styles.propertyGrid}>
                    <div style={styles.propertyCard}>
                        <div style={styles.propertyLabel}>E</div>
                        <div style={styles.propertyValue}>
                            {selectedMember.E ? (selectedMember.E / 1000).toFixed(0) : '—'} MPa
                        </div>
                    </div>
                    <div style={styles.propertyCard}>
                        <div style={styles.propertyLabel}>Area</div>
                        <div style={styles.propertyValue}>
                            {selectedMember.A ? (selectedMember.A * 1e6).toFixed(0) : '—'} mm²
                        </div>
                    </div>
                    <div style={styles.propertyCard}>
                        <div style={styles.propertyLabel}>I</div>
                        <div style={styles.propertyValue}>
                            {selectedMember.I ? (selectedMember.I * 1e8).toFixed(0) : '—'} cm⁴
                        </div>
                    </div>
                    <div style={styles.propertyCard}>
                        <div style={styles.propertyLabel}>Section</div>
                        <div style={styles.propertyValue}>
                            {selectedMember.sectionId || '—'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Node Info */}
            <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Connectivity</h4>
                <div style={{ fontSize: '12px', color: '#a1a1aa' }}>
                    <p>Start Node: <span style={{ color: '#fff' }}>{selectedMember.startNodeId.slice(0, 10)}</span></p>
                    <p style={{ marginTop: '4px' }}>End Node: <span style={{ color: '#fff' }}>{selectedMember.endNodeId.slice(0, 10)}</span></p>
                </div>
            </div>
        </div>
    );
};

export default PropertyInspector;
