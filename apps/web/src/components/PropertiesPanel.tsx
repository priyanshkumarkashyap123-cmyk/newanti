import { FC, useState, useEffect, useCallback, useRef } from 'react';
import { useModelStore, type Restraints } from '../store/model';

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
// SECTION OPTIONS
// ============================================
const SECTION_OPTIONS = [
    { id: 'default', label: 'Default', A: 0.01, I: 1e-4 },
    { id: 'W12x26', label: 'W12x26', A: 0.00495, I: 2.04e-4 },
    { id: 'W14x30', label: 'W14x30', A: 0.00568, I: 2.91e-4 },
    { id: 'W16x40', label: 'W16x40', A: 0.00756, I: 4.93e-4 },
    { id: 'ISMB200', label: 'ISMB 200', A: 0.00325, I: 2.24e-4 },
    { id: 'ISMB250', label: 'ISMB 250', A: 0.00475, I: 5.13e-4 },
    { id: 'ISMB300', label: 'ISMB 300', A: 0.00563, I: 8.6e-4 },
    { id: 'ISMB400', label: 'ISMB 400', A: 0.00783, I: 2.04e-3 },
    { id: 'HSS6x6x1/4', label: 'HSS6x6x1/4', A: 0.00355, I: 1.12e-4 },
    { id: 'HSS8x8x3/8', label: 'HSS8x8x3/8', A: 0.00684, I: 3.32e-4 },
    { id: 'custom', label: '+ Custom Section...', A: 0, I: 0 },
];

// Material presets
const MATERIAL_OPTIONS = [
    { id: 'steel_e250', label: 'Steel Fe250 (E=200 GPa)', E: 200e6, fy: 250 },
    { id: 'steel_e350', label: 'Steel Fe350 (E=200 GPa)', E: 200e6, fy: 350 },
    { id: 'steel_e410', label: 'Steel Fe410 (E=200 GPa)', E: 200e6, fy: 410 },
    { id: 'concrete_m25', label: 'Concrete M25 (E=25 GPa)', E: 25e6, fy: 25 },
    { id: 'concrete_m30', label: 'Concrete M30 (E=27 GPa)', E: 27e6, fy: 30 },
    { id: 'aluminum', label: 'Aluminum (E=70 GPa)', E: 70e6, fy: 250 },
    { id: 'custom', label: '+ Custom Material...', E: 0, fy: 0 },
];

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
    const setNodeRestraints = useModelStore((state) => state.setNodeRestraints);
    const addLoad = useModelStore((state) => state.addLoad);
    const removeLoad = useModelStore((state) => state.removeLoad);

    // Local state for new load input
    const [newLoadFy, setNewLoadFy] = useState(-10);

    // 2. Conditional Render: No selection
    if (selectedIds.size === 0) {
        return (
            <div style={panelStyle}>
                <h3 style={headerStyle}>Properties</h3>
                <p style={{ color: '#888', fontSize: 13 }}>No selection</p>
                {analysisResults && (
                    <div style={{ borderTop: '1px solid #333', marginTop: 8, paddingTop: 8 }}>
                        <span style={{ color: '#4caf50', fontSize: 12 }}>✓ Analysis complete</span>
                    </div>
                )}
            </div>
        );
    }

    // Multi-selection
    if (selectedIds.size > 1) {
        return (
            <div style={panelStyle}>
                <h3 style={headerStyle}>Properties</h3>
                <p style={{ fontSize: 13 }}>{selectedIds.size} items selected</p>
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
                <h3 style={headerStyle}>Node Properties</h3>

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

        // State for custom section/material dialogs
        const [showCustomSection, setShowCustomSection] = useState(false);
        const [showCustomMaterial, setShowCustomMaterial] = useState(false);
        const [customA, setCustomA] = useState((member.A ?? 0.01) * 1e4); // Convert to cm²
        const [customI, setCustomI] = useState((member.I ?? 1e-4) * 1e8); // Convert to cm⁴
        const [customE, setCustomE] = useState((member.E ?? 200e6) / 1e6); // Convert to GPa

        const handleSectionChange = (sectionId: string) => {
            if (sectionId === 'custom') {
                setShowCustomSection(true);
                return;
            }
            const section = SECTION_OPTIONS.find(s => s.id === sectionId);
            if (section && section.A > 0) {
                updateMember(id, { sectionId, A: section.A, I: section.I });
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
                <h3 style={headerStyle}>Member Properties</h3>

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

                {/* Section Dropdown */}
                <div style={sectionStyle}>
                    <label style={labelStyle}>📐 Section</label>
                    <select
                        value={member.sectionId}
                        onChange={(e) => handleSectionChange(e.target.value)}
                        style={selectStyle}
                    >
                        {SECTION_OPTIONS.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                    
                    {/* Custom Section Dialog */}
                    {showCustomSection && (
                        <div style={{ background: 'rgba(0,0,0,0.8)', padding: 12, borderRadius: 8, marginTop: 8, border: '1px solid #555' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#4caf50' }}>✏️ Custom Section Properties</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
    background: 'rgba(20, 20, 20, 0.95)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '14px',
    color: 'white',
    fontFamily: 'Inter, sans-serif',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '60vh',
    overflowY: 'auto'
};

const headerStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    borderBottom: '1px solid #333',
    paddingBottom: 8
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
    color: '#ccc'
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
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid #444',
    color: 'white',
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
    borderColor: 'rgba(255,255,255,0.1)',
    margin: '6px 0'
};

const addButtonStyle: React.CSSProperties = {
    background: '#333',
    color: 'white',
    border: '1px solid #555',
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
