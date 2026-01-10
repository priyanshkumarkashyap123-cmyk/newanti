import { FC, useState, useEffect, useCallback, useRef } from 'react';
import { useModelStore, type Restraints } from '../store/model';
import { STEEL_SECTIONS, MATERIALS_DATABASE, type SectionProperties, type Material } from '../data/SectionDatabase';

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

// Filter sections by category
function getSectionsByCategory(category: SectionCategory): SectionProperties[] {
    switch (category) {
        case 'ISMB':
            return STEEL_SECTIONS.filter(s => s.type === 'ISMB');
        case 'ISMC':
            return STEEL_SECTIONS.filter(s => s.type === 'ISMC');
        case 'ISLB':
            return STEEL_SECTIONS.filter(s => s.type === 'ISLB');
        case 'ISHB':
            return STEEL_SECTIONS.filter(s => s.type === 'ISHB');
        case 'W':
            return STEEL_SECTIONS.filter(s => s.type === 'W');
        case 'RCC-BEAM':
            return STEEL_SECTIONS.filter(s => s.id.startsWith('RCC-') && !s.id.includes('COL'));
        case 'RCC-COLUMN':
            return STEEL_SECTIONS.filter(s => s.id.includes('RCC-COL'));
        default:
            return [];
    }
}

// Convert section properties from mm to m for analysis
function convertSectionToMeters(section: SectionProperties): { A: number; I: number } {
    return {
        A: section.A / 1e6,      // mm² to m²
        I: section.Ix / 1e12     // mm⁴ to m⁴ (using Ix as major axis)
    };
}

// ============================================
// MATERIAL OPTIONS (from database)
// ============================================
const MATERIAL_OPTIONS = MATERIALS_DATABASE.map(m => ({
    id: m.id,
    label: m.name,
    E: m.E * 1e3,  // Convert MPa to kN/m² (1 MPa = 1000 kN/m²)
    fy: m.fy || m.fck || 0
}));

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
// NUMBER INPUT WITH DEBOUNCE
// ============================================
interface NumberInputProps {
    value: number;
    onChange: (value: number) => void;
    step?: number;
    disabled?: boolean;
    style?: React.CSSProperties;
}

const NumberInput: FC<NumberInputProps> = ({ value, onChange, step = 0.1, disabled, style }) => {
    const [localValue, setLocalValue] = useState(value.toString());

    // Sync local value when prop changes
    useEffect(() => {
        setLocalValue(value.toString());
    }, [value]);

    // Debounced onChange (100ms)
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
            style={{ ...inputStyle, ...style }}
        />
    );
};

// ============================================
// PROPERTIES PANEL COMPONENT
// ============================================
export const PropertiesPanel: FC = () => {
    // 1. Subscription: Listen to selectedIds
    const selectedIds = useModelStore((state) => state.selectedIds);
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const loads = useModelStore((state) => state.loads);
    const analysisResults = useModelStore((state) => state.analysisResults);
    const updateNodePosition = useModelStore((state) => state.updateNodePosition);
    const updateMember = useModelStore((state) => state.updateMember);
    const updateMembers = useModelStore((state) => state.updateMembers);
    const setNodeRestraints = useModelStore((state) => state.setNodeRestraints);
    const addLoad = useModelStore((state) => state.addLoad);
    const removeLoad = useModelStore((state) => state.removeLoad);

    // Local state for new load input
    const [newLoadFy, setNewLoadFy] = useState(-10);

    // Minimize state for the panel
    const [isMinimized, setIsMinimized] = useState(false);

    // State for section category selection
    const [sectionCategory, setSectionCategory] = useState<SectionCategory>('ISMB');
    const [availableSections, setAvailableSections] = useState<SectionProperties[]>([]);

    // State for custom section/material dialogs (must be at top level - React rules of hooks)
    const [showCustomSection, setShowCustomSection] = useState(false);
    const [showCustomMaterial, setShowCustomMaterial] = useState(false);
    const [customA, setCustomA] = useState(100); // Default 100 cm²
    const [customI, setCustomI] = useState(1000); // Default 1000 cm⁴
    const [customE, setCustomE] = useState(200);  // Default 200 GPa

    // Update available sections when category changes
    useEffect(() => {
        setAvailableSections(getSectionsByCategory(sectionCategory));
    }, [sectionCategory]);

    // Get current selection for useEffect dependency
    const selectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;

    // Sync custom values when member selection changes
    // Note: Only depend on selectedId to avoid re-runs when members Map reference changes
    useEffect(() => {
        if (selectedId) {
            const member = members.get(selectedId);
            if (member) {
                setCustomA((member.A ?? 0.01) * 1e4); // Convert to cm²
                setCustomI((member.I ?? 1e-4) * 1e8); // Convert to cm⁴
                setCustomE((member.E ?? 200e6) / 1e6); // Convert to GPa
            }
        }
        // Reset dialogs when selection changes
        setShowCustomSection(false);
        setShowCustomMaterial(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]); // Only re-run when selection changes, not when members Map updates

    // Get selected member for rendering
    const selectedMember = selectedId ? members.get(selectedId) : null;

    // 2. Conditional Render: Minimized state
    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                style={{
                    width: '100%',
                    background: 'rgba(20, 20, 20, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: 'white',
                    fontFamily: 'Inter, sans-serif',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 500
                }}
                title="Expand Properties Panel"
            >
                ⚙️ Properties
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#888' }}>▼</span>
            </button>
        );
    }

    // 3. Conditional Render: No selection
    if (selectedIds.size === 0) {
        return (
            <div style={panelStyle}>
                <div style={headerWithButtonStyle}>
                    <h3 style={headerStyle}>Properties</h3>
                    <button onClick={() => setIsMinimized(true)} style={minimizeButtonStyle} title="Minimize">−</button>
                </div>
                <p style={{ color: '#888', fontSize: 13 }}>No selection</p>
                {analysisResults && (
                    <div style={{ borderTop: '1px solid #333', marginTop: 8, paddingTop: 8 }}>
                        <span style={{ color: '#4caf50', fontSize: 12 }}>✓ Analysis complete</span>
                    </div>
                )}
            </div>
        );
    }

    // Multi-selection (Bulk Edit)
    if (selectedIds.size > 1) {
        // Categorize selection
        const selectedMembers = Array.from(selectedIds)
            .map(id => members.get(id))
            .filter((m): m is NonNullable<typeof m> => !!m);

        const selectedNodes = Array.from(selectedIds)
            .map(id => nodes.get(id))
            .filter((n): n is NonNullable<typeof n> => !!n);

        // BULK MEMBER EDITING
        if (selectedMembers.length > 0 && selectedNodes.length === 0) {
            const handleBulkSectionChange = (sectionId: string) => {
                const section = STEEL_SECTIONS.find(s => s.id === sectionId);
                if (section) {
                    const { A, I } = convertSectionToMeters(section);
                    // Use batch update for performance - single state update for all members
                    const updates = new Map<string, Partial<typeof selectedMembers[0]>>();
                    selectedMembers.forEach(m => {
                        updates.set(m.id, { sectionId, A, I });
                    });
                    updateMembers(updates);
                } else if (sectionId) {
                    const updates = new Map<string, Partial<typeof selectedMembers[0]>>();
                    selectedMembers.forEach(m => {
                        updates.set(m.id, { sectionId });
                    });
                    updateMembers(updates);
                }
            };

            const handleBulkMaterialChange = (materialId: string) => {
                const material = MATERIAL_OPTIONS.find(m => m.id === materialId);
                if (material && material.E > 0) {
                    // Use batch update for performance
                    const updates = new Map<string, Partial<typeof selectedMembers[0]>>();
                    selectedMembers.forEach(m => {
                        updates.set(m.id, { E: material.E });
                    });
                    updateMembers(updates);
                }
            };

            const handleBulkReleaseChange = (key: 'startMoment' | 'endMoment', value: boolean) => {
                // Use batch update for performance
                const updates = new Map<string, Partial<typeof selectedMembers[0]>>();
                selectedMembers.forEach(m => {
                    const currentReleases = m.releases ?? { startMoment: false, endMoment: false };
                    updates.set(m.id, { releases: { ...currentReleases, [key]: value } });
                });
                updateMembers(updates);
            };

            return (
                <div style={panelStyle}>
                    <div style={headerWithButtonStyle}>
                        <h3 style={headerStyle}>Bulk Edit ({selectedMembers.length} Members)</h3>
                        <button onClick={() => setIsMinimized(true)} style={minimizeButtonStyle} title="Minimize">−</button>
                    </div>

                    {/* Common Actions */}
                    <div style={sectionStyle}>
                        <label style={labelStyle}>📐 Section Category</label>
                        <select
                            value={sectionCategory}
                            onChange={(e) => setSectionCategory(e.target.value as SectionCategory)}
                            style={selectStyle}
                        >
                            {SECTION_CATEGORIES.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.label}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ ...sectionStyle, marginTop: 8 }}>
                        <label style={labelStyle}>📏 Set Section</label>
                        <select
                            onChange={(e) => handleBulkSectionChange(e.target.value)}
                            style={selectStyle}
                            defaultValue=""
                        >
                            <option value="" disabled>Select to apply to all...</option>
                            {availableSections.map(section => (
                                <option key={section.id} value={section.id}>{section.name}</option>
                            ))}
                        </select>
                    </div>

                    <hr style={dividerStyle} />

                    <div style={sectionStyle}>
                        <label style={labelStyle}>🧱 Set Material</label>
                        <select
                            onChange={(e) => handleBulkMaterialChange(e.target.value)}
                            style={selectStyle}
                            defaultValue=""
                        >
                            <option value="" disabled>Select to apply to all...</option>
                            {MATERIAL_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <hr style={dividerStyle} />

                    <div style={sectionStyle}>
                        <label style={labelStyle}>🔓 Bulk Releases</label>
                        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" onChange={(e) => handleBulkReleaseChange('startMoment', e.target.checked)} /> Start
                            </label>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" onChange={(e) => handleBulkReleaseChange('endMoment', e.target.checked)} /> End
                            </label>
                        </div>
                        <span style={{ fontSize: 10, color: '#888', marginTop: 4 }}>(Check to apply release to all)</span>
                    </div>

                    <hr style={dividerStyle} />

                    <div style={{ marginTop: 8 }}>
                        <button
                            onClick={() => selectedMembers.forEach(m => useModelStore.getState().removeMember(m.id))}
                            style={{ ...deleteButtonStyle, border: '1px solid #f44', borderRadius: 4, width: '100%', padding: '6px' }}
                        >
                            Delete All Selected
                        </button>
                    </div>
                </div>
            );
        }

        // Mixed or Node selection
        return (
            <div style={panelStyle}>
                <div style={headerWithButtonStyle}>
                    <h3 style={headerStyle}>Multiple Selection</h3>
                    <button onClick={() => setIsMinimized(true)} style={minimizeButtonStyle} title="Minimize">−</button>
                </div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                    {selectedNodes.length > 0 && <div>• {selectedNodes.length} Nodes</div>}
                    {selectedMembers.length > 0 && <div>• {selectedMembers.length} Members</div>}
                </div>
                <button
                    onClick={() => useModelStore.getState().deleteSelection()}
                    style={{ ...deleteButtonStyle, border: '1px solid #f44', borderRadius: 4, width: '100%', padding: '6px' }}
                >
                    Delete Selection
                </button>
            </div>
        );
    }

    const id = Array.from(selectedIds)[0]!;
    const node = nodes.get(id);
    const member = members.get(id);

    // ========================================
    // RENDER NODE PROPERTIES
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
            addLoad({
                id: crypto.randomUUID(),
                nodeId: id,
                fy: newLoadFy
            });
        };

        return (
            <div style={panelStyle}>
                <div style={headerWithButtonStyle}>
                    <h3 style={headerStyle}>Node Properties</h3>
                    <button onClick={() => setIsMinimized(true)} style={minimizeButtonStyle} title="Minimize">−</button>
                </div>

                {/* ID */}
                <div style={rowStyle}>
                    <label style={labelStyle}>ID</label>
                    <span style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>{id.slice(0, 8)}...</span>
                </div>

                {/* 3. NumberInput for X, Y, Z with debounce */}
                <div style={sectionStyle}>
                    <label style={labelStyle}>Position</label>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <div style={inputGroupStyle}>
                            <span style={axisLabelStyle}>X</span>
                            <NumberInput
                                value={node.x}
                                onChange={(val) => updateNodePosition(id, { x: val })}
                                style={{ width: 60 }}
                            />
                        </div>
                        <div style={inputGroupStyle}>
                            <span style={axisLabelStyle}>Y</span>
                            <NumberInput
                                value={node.y}
                                onChange={(val) => updateNodePosition(id, { y: val })}
                                style={{ width: 60 }}
                            />
                        </div>
                        <div style={inputGroupStyle}>
                            <span style={axisLabelStyle}>Z</span>
                            <NumberInput
                                value={node.z}
                                onChange={(val) => updateNodePosition(id, { z: val })}
                                style={{ width: 60 }}
                            />
                        </div>
                    </div>
                </div>

                <hr style={dividerStyle} />

                {/* Supports */}
                <div style={sectionStyle}>
                    <label style={labelStyle}>📌 Supports</label>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                        <label style={checkboxLabelStyle}>
                            <input type="checkbox" checked={restraints.fx} onChange={(e) => handleRestraintChange('fx', e.target.checked)} /> X
                        </label>
                        <label style={checkboxLabelStyle}>
                            <input type="checkbox" checked={restraints.fy} onChange={(e) => handleRestraintChange('fy', e.target.checked)} /> Y
                        </label>
                        <label style={checkboxLabelStyle}>
                            <input type="checkbox" checked={restraints.mz} onChange={(e) => handleRestraintChange('mz', e.target.checked)} /> Rz
                        </label>
                    </div>
                    {(restraints.fx || restraints.fy || restraints.mz) && (
                        <span style={{ fontSize: 10, color: '#4caf50', marginTop: 4 }}>
                            {restraints.fx && restraints.fy && restraints.mz ? '(Fixed)' :
                                restraints.fx && restraints.fy ? '(Pinned)' : '(Partial)'}
                        </span>
                    )}
                </div>

                <hr style={dividerStyle} />

                {/* Loads */}
                <div style={sectionStyle}>
                    <label style={labelStyle}>⬇️ Loads</label>
                    {nodeLoads.length === 0 && <p style={{ fontSize: 11, color: '#666' }}>No loads</p>}
                    {nodeLoads.map(load => (
                        <div key={load.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4, alignItems: 'center' }}>
                            <span>Fy: {load.fy ?? 0} kN</span>
                            <button onClick={() => removeLoad(load.id)} style={deleteButtonStyle}>✕</button>
                        </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <NumberInput value={newLoadFy} onChange={setNewLoadFy} style={{ width: 60 }} />
                        <button onClick={handleAddLoad} style={addButtonStyle}>+ Add</button>
                    </div>
                </div>

                {/* Analysis Results */}
                {disp && (
                    <>
                        <hr style={dividerStyle} />
                        <div style={sectionStyle}>
                            <label style={{ ...labelStyle, color: '#4caf50' }}>📊 Displacements</label>
                            <div style={{ fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>
                                dx: {(disp.dx * 1000).toFixed(3)} mm<br />
                                dy: {(disp.dy * 1000).toFixed(3)} mm
                            </div>
                        </div>
                    </>
                )}
                {reaction && (
                    <div style={{ ...sectionStyle, marginTop: 8 }}>
                        <label style={{ ...labelStyle, color: '#ff9800' }}>⚡ Reactions</label>
                        <div style={{ fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>
                            Fx: {reaction.fx.toFixed(2)} kN | Fy: {reaction.fy.toFixed(2)} kN
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ========================================
    // RENDER MEMBER PROPERTIES
    // ========================================
    if (member) {
        const startNode = nodes.get(member.startNodeId);
        const endNode = nodes.get(member.endNodeId);
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
            // Find section in database
            const section = STEEL_SECTIONS.find(s => s.id === sectionId);
            if (section) {
                const { A, I } = convertSectionToMeters(section);
                updateMember(id, {
                    sectionId,
                    A,  // Already in m²
                    I   // Already in m⁴
                });
            } else {
                // Fallback: just update the ID
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
            updateMember(id, {
                sectionId: 'custom',
                A: customA / 1e4,  // Convert cm² to m²
                I: customI / 1e8  // Convert cm⁴ to m⁴
            });
            setShowCustomSection(false);
        };

        const handleApplyCustomMaterial = () => {
            updateMember(id, { E: customE * 1e6 }); // Convert GPa to kN/m²
            setShowCustomMaterial(false);
        };

        const handleReleaseChange = (key: 'startMoment' | 'endMoment', value: boolean) => {
            updateMember(id, { releases: { ...releases, [key]: value } });
        };

        return (
            <div style={panelStyle}>
                <div style={headerWithButtonStyle}>
                    <h3 style={headerStyle}>Member Properties</h3>
                    <button onClick={() => setIsMinimized(true)} style={minimizeButtonStyle} title="Minimize">−</button>
                </div>

                {/* ID */}
                <div style={rowStyle}>
                    <label style={labelStyle}>ID</label>
                    <span style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>{id.slice(0, 8)}...</span>
                </div>

                {/* Length (Read-only) */}
                <div style={rowStyle}>
                    <label style={labelStyle}>Length</label>
                    <span style={{ fontSize: 13, fontFamily: 'monospace' }}>{length.toFixed(3)} m</span>
                </div>

                <hr style={dividerStyle} />

                {/* Section Category Dropdown */}
                <div style={sectionStyle}>
                    <label style={labelStyle}>📐 Section Category</label>
                    <select
                        value={sectionCategory}
                        onChange={(e) => setSectionCategory(e.target.value as SectionCategory)}
                        style={selectStyle}
                    >
                        {SECTION_CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                    </select>
                </div>

                <hr style={dividerStyle} />

                {/* Section Dropdown (filtered by category) */}
                <div style={sectionStyle}>
                    <label style={labelStyle}>📏 Section</label>
                    <select
                        value={member.sectionId || ''}
                        onChange={(e) => handleSectionChange(e.target.value)}
                        style={selectStyle}
                    >
                        <option value="">Select section...</option>
                        {availableSections.map(section => (
                            <option key={section.id} value={section.id}>{section.name}</option>
                        ))}
                        <option value="custom">+ Custom Section...</option>
                    </select>

                    {/* Show current section properties */}
                    {member.sectionId && member.sectionId !== 'custom' && (
                        <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                            A = {((member.A ?? 0.01) * 1e4).toFixed(1)} cm² | I = {((member.I ?? 1e-4) * 1e8).toFixed(1)} cm⁴
                        </div>
                    )}

                    {/* Custom Section Dialog */}
                    {showCustomSection && (
                        <div style={{ background: 'rgba(0,0,0,0.8)', padding: 12, borderRadius: 8, marginTop: 8, border: '1px solid #555' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#4caf50' }}>✏️ Custom Section Properties</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <label style={{ fontSize: 11, width: 80 }}>Width (m)</label>
                                    <NumberInput value={member.width ?? 0.3} onChange={(v) => updateMember(id, { width: v })} style={{ flex: 1 }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <label style={{ fontSize: 11, width: 80 }}>Depth (m)</label>
                                    <NumberInput value={member.depth ?? 0.5} onChange={(v) => updateMember(id, { depth: v })} style={{ flex: 1 }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <label style={{ fontSize: 11, width: 80 }}>Area (cm²)</label>
                                    <NumberInput value={customA} onChange={setCustomA} style={{ flex: 1 }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <label style={{ fontSize: 11, width: 80 }}>Iy (cm⁴)</label>
                                    <NumberInput value={customI} onChange={setCustomI} style={{ flex: 1 }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <button onClick={handleApplyCustomSection} style={{ ...addButtonStyle, background: '#4caf50', flex: 1 }}>Apply</button>
                                <button onClick={() => setShowCustomSection(false)} style={{ ...addButtonStyle, flex: 1 }}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>

                <hr style={dividerStyle} />

                {/* Beta Angle */}
                <div style={sectionStyle}>
                    <label style={labelStyle}>🔄 Beta Angle (deg)</label>
                    <NumberInput
                        value={member.betaAngle ?? 0}
                        onChange={(val) => updateMember(id, { betaAngle: val })}
                        style={{ width: '100%', marginTop: 4 }}
                    />
                </div>

                <hr style={dividerStyle} />

                {/* Material Dropdown */}
                <div style={sectionStyle}>
                    <label style={labelStyle}>🧱 Material</label>
                    <select
                        onChange={(e) => handleMaterialChange(e.target.value)}
                        style={selectStyle}
                    >
                        {MATERIAL_OPTIONS.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>

                    {/* Custom Material Dialog */}
                    {showCustomMaterial && (
                        <div style={{ background: 'rgba(0,0,0,0.8)', padding: 12, borderRadius: 8, marginTop: 8, border: '1px solid #555' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#2196f3' }}>✏️ Custom Material Properties</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label style={{ fontSize: 11, width: 80 }}>E (GPa)</label>
                                <NumberInput value={customE} onChange={setCustomE} style={{ flex: 1 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <button onClick={handleApplyCustomMaterial} style={{ ...addButtonStyle, background: '#2196f3', flex: 1 }}>Apply</button>
                                <button onClick={() => setShowCustomMaterial(false)} style={{ ...addButtonStyle, flex: 1 }}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {/* Show current E value */}
                    <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                        E = {((member.E ?? 200e6) / 1e6).toFixed(0)} GPa
                    </div>
                </div>

                <hr style={dividerStyle} />

                {/* Releases (Checkboxes) */}
                <div style={sectionStyle}>
                    <label style={labelStyle}>🔓 Releases</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                        <label style={checkboxLabelStyle}>
                            <input
                                type="checkbox"
                                checked={releases.startMoment}
                                onChange={(e) => handleReleaseChange('startMoment', e.target.checked)}
                            /> Start Moment (Hinge)
                        </label>
                        <label style={checkboxLabelStyle}>
                            <input
                                type="checkbox"
                                checked={releases.endMoment}
                                onChange={(e) => handleReleaseChange('endMoment', e.target.checked)}
                            /> End Moment (Hinge)
                        </label>
                    </div>
                </div>

                {/* Member Forces */}
                {forces && (
                    <>
                        <hr style={dividerStyle} />
                        <div style={sectionStyle}>
                            <label style={{ ...labelStyle, color: '#4caf50' }}>📊 Member Forces</label>
                            <div style={{ fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>
                                Axial: {forces.axial.toFixed(2)} kN<br />
                                Shear: {forces.shearY.toFixed(2)} kN<br />
                                Moment: {forces.momentZ.toFixed(2)} kN-m
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    }

    return null;
};

// ============================================
// STYLES
// ============================================
const panelStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    background: '#0f172a', // Navy background
    border: '1px solid #334155', // Slate-700
    borderRadius: '8px',
    padding: '14px',
    color: '#f1f5f9', // Slate-100
    fontFamily: 'Inter, sans-serif',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '60vh',
    overflowY: 'auto',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
};

const headerWithButtonStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #334155',
    paddingBottom: 8,
    marginBottom: 4
};

const headerStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 14,
    fontWeight: 600
};

const minimizeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#94a3b8', // Slate-400
    cursor: 'pointer',
    fontSize: '16px',
    padding: '2px 6px',
    borderRadius: '4px',
    lineHeight: 1
};

const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12
};

const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column'
};

const labelStyle: React.CSSProperties = {
    fontWeight: 500,
    fontSize: 12,
    color: '#cbd5e1' // Slate-300
};

const axisLabelStyle: React.CSSProperties = {
    fontSize: 10,
    color: '#888',
    marginBottom: 2
};

const inputGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
};

const inputStyle: React.CSSProperties = {
    background: '#1e293b', // Slate-800
    border: '1px solid #475569', // Slate-600
    color: '#f8fafc', // Slate-50
    padding: '6px 8px',
    borderRadius: '4px',
    fontSize: 12,
    width: '100%'
};

const selectStyle: React.CSSProperties = {
    ...inputStyle,
    marginTop: 6,
    cursor: 'pointer'
};

const checkboxLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    cursor: 'pointer'
};

const dividerStyle: React.CSSProperties = {
    borderColor: '#334155', // Slate-700
    margin: '6px 0'
};

const addButtonStyle: React.CSSProperties = {
    background: '#334155',
    color: '#f1f5f9',
    border: '1px solid #475569',
    borderRadius: 4,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 12
};

const deleteButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#f44',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 6px'
};
