import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { temporal } from 'zundo';

export interface ProjectInfo {
    name: string;
    client: string;
    engineer: string;
    jobNo: string;
    rev: string;
    date: Date;
    description: string;
    cloudId?: string; // ID from database if saved
}

export interface Restraints {
    fx: boolean;
    fy: boolean;
    fz: boolean;
    mx: boolean;
    my: boolean;
    mz: boolean;
}

export interface Node {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: Restraints; // Optional: Support conditions
}

export interface NodeLoad {
    id: string;
    nodeId: string;
    fx?: number; fy?: number; fz?: number; // Forces (kN)
    mx?: number; my?: number; mz?: number; // Moments (kN-m)
}

// Member Loads (applied on members)
export type MemberLoadType = 'UDL' | 'UVL' | 'point' | 'moment';

export interface MemberLoad {
    id: string;
    memberId: string;
    type: MemberLoadType;
    // For distributed loads (UDL/UVL)
    w1?: number;  // Intensity at start (kN/m) - for UDL, w1 = w2
    w2?: number;  // Intensity at end (kN/m)
    // For point loads
    P?: number;   // Point load magnitude (kN)
    M?: number;   // Point moment magnitude (kN·m)
    a?: number;   // Distance from start node (m or as ratio 0-1)
    // Direction: 'local_y' is perpendicular to member, 'global_y' is vertical
    direction: 'local_y' | 'local_z' | 'global_x' | 'global_y' | 'global_z' | 'axial';
    // Start and end positions for partial loads (0-1 as ratio of length)
    startPos?: number; // Default 0
    endPos?: number;   // Default 1
}

export type SectionType = 'I-BEAM' | 'TUBE' | 'L-ANGLE' | 'RECTANGLE' | 'CIRCLE' | 'C-CHANNEL';

export interface SectionDimensions {
    // I-BEAM dimensions
    height?: number;
    width?: number;
    webThickness?: number;
    flangeThickness?: number;

    // TUBE/BOX dimensions
    outerWidth?: number;
    outerHeight?: number;
    thickness?: number;

    // L-ANGLE dimensions
    legWidth?: number;
    legHeight?: number;

    // RECTANGLE/PLATE dimensions
    rectWidth?: number;
    rectHeight?: number;

    // CIRCLE/CABLE dimensions
    diameter?: number;

    // C-CHANNEL dimensions
    channelHeight?: number;
    channelWidth?: number;
    channelThickness?: number;
}

export interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    sectionId?: string; // Made optional with default 'Default'

    // Section geometry for 3D rendering
    sectionType?: SectionType;
    dimensions?: SectionDimensions;

    // Default properties for analysis
    E?: number; // Young's Modulus (kN/m²)
    A?: number; // Cross-sectional Area (m²)
    I?: number; // Moment of Inertia (m⁴)
    // Member releases (hinges) - full 3D releases for all 6 DOFs at each end
    releases?: {
        startMoment?: boolean; // Legacy: Release moment at start
        endMoment?: boolean;   // Legacy: Release moment at end
        // Full 3D releases
        fxStart?: boolean; fyStart?: boolean; fzStart?: boolean;
        mxStart?: boolean; myStart?: boolean; mzStart?: boolean;
        fxEnd?: boolean; fyEnd?: boolean; fzEnd?: boolean;
        mxEnd?: boolean; myEnd?: boolean; mzEnd?: boolean;
    };
    // Rigid zone offsets (for beam-column connections)
    startOffset?: { x: number; y: number; z: number };

    endOffset?: { x: number; y: number; z: number };
    betaAngle?: number; // Rotation angle in degrees
}

// Plate/Shell element (quadrilateral)
export interface Plate {
    id: string;
    nodeIds: [string, string, string, string]; // 4 corner nodes (CCW order)
    thickness: number;   // Plate thickness (m)
    E?: number;          // Young's Modulus (kN/m²), default 200e6 for steel
    nu?: number;         // Poisson's ratio, default 0.3
    pressure?: number;   // Applied pressure (kN/m²), positive = downward
    materialType?: 'steel' | 'concrete' | 'custom';
}

// Member Force Results with diagram data
export interface MemberForceData {
    // Max values for quick access
    axial: number;
    shearY: number;
    shearZ: number;
    momentY: number;
    momentZ: number;
    torsion: number;
    // Diagram data arrays from PyNite (for visualization)
    diagramData?: {
        x_values: number[];
        shear_y: number[];
        shear_z: number[];
        moment_y: number[];
        moment_z: number[];
        axial: number[];
        torsion: number[];
        deflection_y: number[];
        deflection_z: number[];
    };
}

// Analysis Results
export interface AnalysisResults {
    displacements: Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>;
    reactions: Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>;
    memberForces: Map<string, MemberForceData>;
    // Plate/shell element results (optional)
    plateResults?: Record<string, {
        stress_xx?: number;
        stress_yy?: number;
        stress_xy?: number;
        stress_x?: number;
        stress_y?: number;
        moment_xx?: number;
        moment_yy?: number;
        moment_xy?: number;
        displacement?: number;
        von_mises?: number;
    }>;
    stats?: {
        solveTimeMs: number;
        assemblyTimeMs?: number;
        totalTimeMs?: number;
        method?: string;
        usedCloud?: boolean;
        fallbackFromLocal?: boolean;
    };
}

// Modal Analysis Results
export interface ModeShape {
    modeNumber: number;
    frequency: number;      // Hz
    period: number;         // seconds
    angularFrequency: number;  // rad/s
    shape: Map<string, number[]>;  // nodeId -> [dx, dy, dz, rx, ry, rz]
}

export interface ModalResult {
    modes: ModeShape[];
    totalMass: number;
}

interface ModelState {
    // 2. State using Maps for O(1) lookup
    projectInfo: ProjectInfo; // NEW
    nodes: Map<string, Node>;
    members: Map<string, Member>;
    plates: Map<string, Plate>;  // NEW: Shell/slab elements
    loads: NodeLoad[];
    memberLoads: MemberLoad[];  // NEW: Member loads (UDL, UVL, point)
    selectedIds: Set<string>;
    analysisResults: AnalysisResults | null;
    isAnalyzing: boolean;
    displacementScale: number;  // Scale factor for displaced shape visualization

    // Global Model Settings
    settings: {
        selfWeight: boolean; // Auto-apply self weight (-Y)
    };

    // Sequential ID counters for user-friendly naming (M1, M2, N1, N2...)
    nextNodeNumber: number;
    nextMemberNumber: number;
    getNextNodeId: () => string;
    getNextMemberId: () => string;

    // Diagram visibility
    showSFD: boolean;  // Shear Force Diagram
    showBMD: boolean;  // Bending Moment Diagram
    showAFD: boolean;  // Axial Force Diagram
    showStressOverlay: boolean;  // Stress color overlay on members
    showDeflectedShape: boolean;  // Deflected shape
    diagramScale: number;  // Scale factor for diagrams
    showResults: boolean;  // Results Table visibility

    // Modal Analysis / Dynamics
    modalResults: ModalResult | null;
    activeModeIndex: number;    // Which mode to visualize (0-based)
    modeAmplitude: number;      // Amplitude scale for mode shape animation
    isAnimating: boolean;       // Play/pause animation

    // 3. Actions
    setProjectInfo: (info: Partial<ProjectInfo>) => void; // NEW
    addNode: (node: Node) => void;
    removeNode: (id: string) => void;
    addMember: (member: Member) => void;
    updateMember: (id: string, updates: Partial<Member>) => void;
    updateNodePosition: (id: string, position: Partial<{ x: number; y: number; z: number }>) => void;
    setNodeRestraints: (id: string, restraints: Restraints) => void;
    addLoad: (load: NodeLoad) => void;
    removeLoad: (id: string) => void;
    addMemberLoad: (load: MemberLoad) => void;  // NEW
    removeMemberLoad: (id: string) => void;     // NEW
    setAnalysisResults: (results: AnalysisResults | null) => void;
    setIsAnalyzing: (analyzing: boolean) => void;
    select: (id: string, multi: boolean) => void;
    selectNode: (id: string | null, multi?: boolean) => void;
    selectMember: (id: string | null, multi?: boolean) => void;
    updateNode: (id: string, updates: Partial<Node>) => void;
    clearSelection: () => void;
    selectAll: () => void;                          // Select all nodes and members
    selectMultiple: (ids: string[]) => void;        // Select multiple elements
    boxSelect: (minX: number, minZ: number, maxX: number, maxZ: number) => void; // Box selection
    selectByCoordinate: (axis: 'x' | 'y' | 'z', min: number, max: number, add?: boolean) => void; // Range selection
    selectParallel: (axis: 'x' | 'y' | 'z', add?: boolean) => void; // Select members parallel to axis
    selectByProperty: (property: 'sectionId' | 'E', value: string | number, add?: boolean) => void; // Select by property

    // Clipboard Operations (like STAAD)
    clipboard: { nodes: Node[]; members: Member[] } | null;
    copySelection: () => void;                      // Copy selected to clipboard
    pasteClipboard: (offset?: { x: number; y: number; z: number }) => void; // Paste with offset
    duplicateSelection: (offset?: { x: number; y: number; z: number }) => void; // Duplicate in place
    moveSelection: (dx: number, dy: number, dz: number) => void; // Move selected elements
    deleteSelection: () => void;                    // Delete all selected

    // Tools
    activeTool: 'select' | 'node' | 'member' | 'support' | 'load' | 'memberLoad' | 'select_range' | null;
    setTool: (tool: 'select' | 'node' | 'member' | 'support' | 'load' | 'memberLoad' | 'select_range' | null) => void;
    setDisplacementScale: (scale: number) => void;
    setShowSFD: (show: boolean) => void;
    setShowBMD: (show: boolean) => void;
    setShowAFD: (show: boolean) => void;
    setShowStressOverlay: (show: boolean) => void;
    setShowDeflectedShape: (show: boolean) => void;
    setDiagramScale: (scale: number) => void;
    setShowResults: (show: boolean) => void;

    // Modal Analysis Actions
    setModalResults: (results: ModalResult | null) => void;
    setActiveModeIndex: (index: number) => void;
    setModeAmplitude: (amplitude: number) => void;
    setIsAnimating: (animating: boolean) => void;

    // Model Management
    clearModel: () => void;  // Clears entire model for fresh start
    loadStructure: (nodes: Node[], members: Member[]) => void;  // Loads generated structure

    // Geometry Operations
    removeMember: (id: string) => void;
    addNodes: (nodes: Node[]) => void;      // Bulk add nodes
    addMembers: (members: Member[]) => void; // Bulk add members
    updateNodes: (updates: Map<string, Partial<Node>>) => void; // Batch update nodes
    updateMembers: (updates: Map<string, Partial<Member>>) => void; // Batch update members
    splitMemberById: (memberId: string, ratio: number) => void; // Insert node in member
    mergeNodes: (nodeId1: string, nodeId2: string) => void; // Merge two nodes
    renumberNodes: () => void; // Renumber all nodes from N1
    renumberMembers: () => void; // Renumber all members from M1

    // Plate/Shell Operations
    nextPlateNumber: number;
    getNextPlateId: () => string;
    addPlate: (plate: Plate) => void;
    removePlate: (id: string) => void;
    updatePlate: (id: string, updates: Partial<Plate>) => void;
}

// Helper to convert Map to Record for DevTools display
const serializeMap = (map: Map<any, any>) => {
    return Object.fromEntries(map);
};

export const useModelStore = create<ModelState>()(
    devtools(
        temporal(
            (set, get) => ({
                projectInfo: {
                    name: 'Structure 1',
                    client: '',
                    engineer: '',
                    jobNo: '',
                    rev: '0',
                    date: new Date(),
                    description: ''
                },
                nodes: new Map(),
                members: new Map(),
                plates: new Map(),  // NEW: Plate/shell elements
                loads: [],
                memberLoads: [],  // NEW: Member distributed/point loads
                selectedIds: new Set(),
                analysisResults: null,
                isAnalyzing: false,
                displacementScale: 100, // Default scale factor

                // Global Settings
                settings: {
                    selfWeight: true
                },

                // Sequential ID counters
                nextNodeNumber: 1,
                nextMemberNumber: 1,
                getNextNodeId: () => {
                    const state = get();
                    const id = `N${state.nextNodeNumber}`;
                    set({ nextNodeNumber: state.nextNodeNumber + 1 });
                    return id;
                },
                getNextMemberId: () => {
                    const state = get();
                    const id = `M${state.nextMemberNumber}`;
                    set({ nextMemberNumber: state.nextMemberNumber + 1 });
                    return id;
                },
                nextPlateNumber: 1,
                getNextPlateId: () => {
                    const state = get();
                    const id = `P${state.nextPlateNumber}`;
                    set({ nextPlateNumber: state.nextPlateNumber + 1 });
                    return id;
                },

                showSFD: false,
                showBMD: false,
                showAFD: false,
                showStressOverlay: false,
                showDeflectedShape: false,
                diagramScale: 0.05, // Professional diagram scale
                showResults: false,
                clipboard: null, // Clipboard for copy/paste

                // Modal Analysis state
                modalResults: null,
                activeModeIndex: 0,
                modeAmplitude: 1.0,
                isAnimating: false,

                setProjectInfo: (info) =>
                    set((state) => ({ projectInfo: { ...state.projectInfo, ...info } })),

                addNode: (node) =>
                    set((state) => {
                        const newNodes = new Map(state.nodes);
                        newNodes.set(node.id, node);
                        return { nodes: newNodes };
                    }),

                removeNode: (id) =>
                    set((state) => {
                        const newNodes = new Map(state.nodes);
                        newNodes.delete(id);
                        const newMembers = new Map(state.members);
                        for (const [memberId, member] of newMembers.entries()) {
                            if (member.startNodeId === id || member.endNodeId === id) {
                                newMembers.delete(memberId);
                            }
                        }
                        const newSelected = new Set(state.selectedIds);
                        if (newSelected.has(id)) newSelected.delete(id);
                        const newLoads = state.loads.filter(l => l.nodeId !== id);
                        return { nodes: newNodes, members: newMembers, selectedIds: newSelected, loads: newLoads };
                    }),

                addMember: (member) =>
                    set((state) => {
                        const newMembers = new Map(state.members);
                        // Apply default material properties if not set
                        const memberWithDefaults = {
                            ...member,
                            sectionId: member.sectionId ?? 'Default',
                            E: member.E ?? 200e6, // Steel: 200 GPa = 200e6 kN/m²
                            A: member.A ?? 0.01,  // 100 cm² = 0.01 m²
                            I: member.I ?? 1e-4   // 10000 cm⁴ = 1e-4 m⁴
                        };
                        newMembers.set(member.id, memberWithDefaults);
                        return { members: newMembers };
                    }),

                updateMember: (id, updates) =>
                    set((state) => {
                        const member = state.members.get(id);
                        if (!member) return state;
                        const newMembers = new Map(state.members);
                        newMembers.set(id, { ...member, ...updates });
                        return { members: newMembers };
                    }),

                updateNodePosition: (id, position) =>
                    set((state) => {
                        const node = state.nodes.get(id);
                        if (!node) return state;
                        const newNodes = new Map(state.nodes);
                        // Merge partial position update (allows updating individual x, y, or z)
                        newNodes.set(id, {
                            ...node,
                            x: position.x ?? node.x,
                            y: position.y ?? node.y,
                            z: position.z ?? node.z
                        });
                        return { nodes: newNodes };
                    }),

                setNodeRestraints: (id, restraints) =>
                    set((state) => {
                        const node = state.nodes.get(id);
                        if (!node) return state;
                        const newNodes = new Map(state.nodes);
                        newNodes.set(id, { ...node, restraints });
                        return { nodes: newNodes };
                    }),

                addLoad: (load) =>
                    set((state) => ({ loads: [...state.loads, load] })),

                removeLoad: (id) =>
                    set((state) => ({ loads: state.loads.filter(l => l.id !== id) })),

                // NEW: Member load actions
                addMemberLoad: (load) =>
                    set((state) => ({ memberLoads: [...state.memberLoads, load] })),

                removeMemberLoad: (id) =>
                    set((state) => ({ memberLoads: state.memberLoads.filter(l => l.id !== id) })),

                // Plate/Shell actions
                addPlate: (plate) =>
                    set((state) => {
                        const newPlates = new Map(state.plates);
                        newPlates.set(plate.id, plate);
                        return { plates: newPlates };
                    }),

                removePlate: (id) =>
                    set((state) => {
                        const newPlates = new Map(state.plates);
                        newPlates.delete(id);
                        return { plates: newPlates, selectedIds: new Set([...state.selectedIds].filter(i => i !== id)) };
                    }),

                updatePlate: (id, updates) =>
                    set((state) => {
                        const newPlates = new Map(state.plates);
                        const existing = newPlates.get(id);
                        if (existing) {
                            newPlates.set(id, { ...existing, ...updates });
                        }
                        return { plates: newPlates };
                    }),

                setAnalysisResults: (results) =>
                    set({ analysisResults: results }),

                setIsAnalyzing: (analyzing) =>
                    set({ isAnalyzing: analyzing }),

                select: (id, multi) =>
                    set((state) => {
                        const newSelected = multi ? new Set<string>(state.selectedIds) : new Set<string>();
                        if (newSelected.has(id)) {
                            newSelected.delete(id);
                        } else {
                            newSelected.add(id);
                        }
                        return { selectedIds: newSelected };
                    }),

                clearSelection: () => set({ selectedIds: new Set() }),

                selectNode: (id, multi = false) =>
                    set((state) => {
                        if (id === null) return { selectedIds: new Set() };
                        if (multi) {
                            // Toggle selection with existing items
                            const newSelected = new Set(state.selectedIds);
                            if (newSelected.has(id)) {
                                newSelected.delete(id);
                            } else {
                                newSelected.add(id);
                            }
                            return { selectedIds: newSelected };
                        }
                        return { selectedIds: new Set([id]) };
                    }),

                selectMember: (id, multi = false) =>
                    set((state) => {
                        if (id === null) return { selectedIds: new Set() };
                        if (multi) {
                            // Toggle selection with existing items
                            const newSelected = new Set(state.selectedIds);
                            if (newSelected.has(id)) {
                                newSelected.delete(id);
                            } else {
                                newSelected.add(id);
                            }
                            return { selectedIds: newSelected };
                        }
                        return { selectedIds: new Set([id]) };
                    }),

                updateNode: (id, updates) =>
                    set((state) => {
                        const node = state.nodes.get(id);
                        if (!node) return state;
                        const newNodes = new Map(state.nodes);
                        newNodes.set(id, { ...node, ...updates });
                        return { nodes: newNodes };
                    }),

                updateNodes: (updates) =>
                    set((state) => {
                        const newNodes = new Map(state.nodes);
                        let changed = false;
                        updates.forEach((update, id) => {
                            const node = newNodes.get(id);
                            if (node) {
                                newNodes.set(id, { ...node, ...update });
                                changed = true;
                            }
                        });
                        return changed ? { nodes: newNodes } : state;
                    }),

                updateMembers: (updates) =>
                    set((state) => {
                        const newMembers = new Map(state.members);
                        let changed = false;
                        updates.forEach((update, id) => {
                            const member = newMembers.get(id);
                            if (member) {
                                newMembers.set(id, { ...member, ...update });
                                changed = true;
                            }
                        });
                        return changed ? { members: newMembers } : state;
                    }),

                // ============================================
                // ADVANCED SELECTION (Like STAAD)
                // ============================================

                selectAll: () =>
                    set((state) => {
                        const allIds = new Set<string>();
                        state.nodes.forEach((_, id) => allIds.add(id));
                        state.members.forEach((_, id) => allIds.add(id));
                        return { selectedIds: allIds };
                    }),

                selectMultiple: (ids) =>
                    set((state) => {
                        const newSelected = new Set(state.selectedIds);
                        ids.forEach(id => newSelected.add(id));
                        return { selectedIds: newSelected };
                    }),

                boxSelect: (minX, minZ, maxX, maxZ) =>
                    set((state) => {
                        const newSelected = new Set(state.selectedIds);

                        // Select nodes within box
                        state.nodes.forEach((node, id) => {
                            if (node.x >= minX && node.x <= maxX &&
                                node.z >= minZ && node.z <= maxZ) {
                                newSelected.add(id);
                            }
                        });

                        // Select members if both nodes are in selection
                        state.members.forEach((member, id) => {
                            if (newSelected.has(member.startNodeId) && newSelected.has(member.endNodeId)) {
                                newSelected.add(id);
                            }
                        });

                        return { selectedIds: newSelected };
                    }),

                selectByCoordinate: (axis, min, max, add = false) =>
                    set((state) => {
                        const newSelected = add ? new Set(state.selectedIds) : new Set<string>();

                        // Select nodes within range
                        state.nodes.forEach((node, id) => {
                            const val = node[axis];
                            if (val >= min && val <= max) {
                                newSelected.add(id);
                            }
                        });

                        // Select members if both nodes are within range (OR if strictly fully inside?)
                        // "Select at height" usually means members on that floor.
                        // If both nodes are selected, member is selected.
                        state.members.forEach((member, id) => {
                            const start = state.nodes.get(member.startNodeId);
                            const end = state.nodes.get(member.endNodeId);
                            if (start && end) {
                                const startVal = start[axis];
                                const endVal = end[axis];

                                // Check if member is essentially ON the plane/range
                                // Or fully contained?
                                // Let's simplify: if BOTH nodes are in range, select member.
                                if (startVal >= min && startVal <= max && endVal >= min && endVal <= max) {
                                    newSelected.add(id);
                                }
                            }
                        });

                        return { selectedIds: newSelected };
                    }),

                // Select members parallel to a global axis (X, Y, or Z)
                selectParallel: (axis, add = false) =>
                    set((state) => {
                        const newSelected = add ? new Set(state.selectedIds) : new Set<string>();
                        const tolerance = 0.1; // 10cm tolerance for "parallel"

                        state.members.forEach((member, id) => {
                            const start = state.nodes.get(member.startNodeId);
                            const end = state.nodes.get(member.endNodeId);
                            if (!start || !end) return;

                            const dx = Math.abs(end.x - start.x);
                            const dy = Math.abs(end.y - start.y);
                            const dz = Math.abs(end.z - start.z);

                            let isParallel = false;
                            switch (axis) {
                                case 'x':
                                    // Parallel to X means Y and Z differences are small, X difference is significant
                                    isParallel = dy <= tolerance && dz <= tolerance && dx > tolerance;
                                    break;
                                case 'y':
                                    // Parallel to Y (vertical members/columns)
                                    isParallel = dx <= tolerance && dz <= tolerance && dy > tolerance;
                                    break;
                                case 'z':
                                    // Parallel to Z
                                    isParallel = dx <= tolerance && dy <= tolerance && dz > tolerance;
                                    break;
                            }

                            if (isParallel) {
                                newSelected.add(id);
                            }
                        });

                        return { selectedIds: newSelected };
                    }),

                // Select members by property value (e.g., all members with same section)
                selectByProperty: (property, value, add = false) =>
                    set((state) => {
                        const newSelected = add ? new Set(state.selectedIds) : new Set<string>();

                        state.members.forEach((member, id) => {
                            const memberValue = member[property as keyof typeof member];
                            if (memberValue === value) {
                                newSelected.add(id);
                            }
                        });

                        return { selectedIds: newSelected };
                    }),

                // ============================================
                // CLIPBOARD OPERATIONS
                // ============================================

                copySelection: () =>
                    set((state) => {
                        const selectedNodes: Node[] = [];
                        const selectedMembers: Member[] = [];

                        state.selectedIds.forEach(id => {
                            const node = state.nodes.get(id);
                            if (node) selectedNodes.push({ ...node });

                            const member = state.members.get(id);
                            if (member) selectedMembers.push({ ...member });
                        });

                        return { clipboard: { nodes: selectedNodes, members: selectedMembers } };
                    }),

                pasteClipboard: (offset = { x: 2, y: 0, z: 0 }) =>
                    set((state) => {
                        if (!state.clipboard) return state;

                        const newNodes = new Map(state.nodes);
                        const newMembers = new Map(state.members);
                        const idMap = new Map<string, string>(); // old ID -> new ID
                        const newSelected = new Set<string>();

                        // Clone nodes with offset
                        state.clipboard.nodes.forEach(node => {
                            const newId = state.getNextNodeId();
                            idMap.set(node.id, newId);
                            newNodes.set(newId, {
                                ...node,
                                id: newId,
                                x: node.x + offset.x,
                                y: node.y + offset.y,
                                z: node.z + offset.z
                            });
                            newSelected.add(newId);
                        });

                        // Clone members with updated node references
                        state.clipboard.members.forEach(member => {
                            const newStartId = idMap.get(member.startNodeId);
                            const newEndId = idMap.get(member.endNodeId);
                            if (newStartId && newEndId) {
                                const newId = state.getNextMemberId();
                                newMembers.set(newId, {
                                    ...member,
                                    id: newId,
                                    startNodeId: newStartId,
                                    endNodeId: newEndId
                                });
                                newSelected.add(newId);
                            }
                        });

                        return { nodes: newNodes, members: newMembers, selectedIds: newSelected };
                    }),

                duplicateSelection: (offset = { x: 2, y: 0, z: 0 }) => {
                    const state = get();
                    // First copy, then paste
                    const selectedNodes: Node[] = [];
                    const selectedMembers: Member[] = [];

                    state.selectedIds.forEach(id => {
                        const node = state.nodes.get(id);
                        if (node) selectedNodes.push({ ...node });

                        const member = state.members.get(id);
                        if (member) selectedMembers.push({ ...member });
                    });

                    const newNodes = new Map(state.nodes);
                    const newMembers = new Map(state.members);
                    const idMap = new Map<string, string>();
                    const newSelected = new Set<string>();

                    selectedNodes.forEach(node => {
                        const newId = state.getNextNodeId();
                        idMap.set(node.id, newId);
                        newNodes.set(newId, {
                            ...node,
                            id: newId,
                            x: node.x + offset.x,
                            y: node.y + offset.y,
                            z: node.z + offset.z
                        });
                        newSelected.add(newId);
                    });

                    selectedMembers.forEach(member => {
                        const newStartId = idMap.get(member.startNodeId);
                        const newEndId = idMap.get(member.endNodeId);
                        if (newStartId && newEndId) {
                            const newId = state.getNextMemberId();
                            newMembers.set(newId, {
                                ...member,
                                id: newId,
                                startNodeId: newStartId,
                                endNodeId: newEndId
                            });
                            newSelected.add(newId);
                        }
                    });

                    set({ nodes: newNodes, members: newMembers, selectedIds: newSelected });
                },

                moveSelection: (dx, dy, dz) =>
                    set((state) => {
                        const newNodes = new Map(state.nodes);

                        // Move all selected nodes
                        state.selectedIds.forEach(id => {
                            const node = state.nodes.get(id);
                            if (node) {
                                newNodes.set(id, {
                                    ...node,
                                    x: node.x + dx,
                                    y: node.y + dy,
                                    z: node.z + dz
                                });
                            }
                        });

                        return { nodes: newNodes };
                    }),

                deleteSelection: () =>
                    set((state) => {
                        const newNodes = new Map(state.nodes);
                        const newMembers = new Map(state.members);
                        let newLoads = [...state.loads];
                        let newMemberLoads = [...state.memberLoads];

                        state.selectedIds.forEach(id => {
                            // Delete node
                            if (state.nodes.has(id)) {
                                newNodes.delete(id);
                                // Also delete members connected to this node
                                newMembers.forEach((member, memberId) => {
                                    if (member.startNodeId === id || member.endNodeId === id) {
                                        newMembers.delete(memberId);
                                        newMemberLoads = newMemberLoads.filter(ml => ml.memberId !== memberId);
                                    }
                                });
                                // Delete loads on this node
                                newLoads = newLoads.filter(l => l.nodeId !== id);
                            }

                            // Delete member
                            if (state.members.has(id)) {
                                newMembers.delete(id);
                                newMemberLoads = newMemberLoads.filter(ml => ml.memberId !== id);
                            }
                        });

                        return {
                            nodes: newNodes,
                            members: newMembers,
                            loads: newLoads,
                            memberLoads: newMemberLoads,
                            selectedIds: new Set()
                        };
                    }),

                activeTool: 'select',
                setTool: (tool) => set({ activeTool: tool }),
                setDisplacementScale: (scale) => set({ displacementScale: scale }),
                setShowSFD: (show) => set({ showSFD: show }),
                setShowBMD: (show) => set({ showBMD: show }),
                setShowAFD: (show) => set({ showAFD: show }),
                setShowStressOverlay: (show) => set({ showStressOverlay: show }),
                setShowDeflectedShape: (show) => set({ showDeflectedShape: show }),
                setDiagramScale: (scale) => set({ diagramScale: scale }),
                setShowResults: (show) => set({ showResults: show }),

                // Modal Analysis Actions
                setModalResults: (results) => set({ modalResults: results }),
                setActiveModeIndex: (index) => set({ activeModeIndex: index }),
                setModeAmplitude: (amplitude) => set({ modeAmplitude: amplitude }),
                setIsAnimating: (animating) => set({ isAnimating: animating }),

                // Model Management
                clearModel: () => set({
                    nodes: new Map(),
                    members: new Map(),
                    loads: [],
                    memberLoads: [],
                    selectedIds: new Set(),
                    analysisResults: null,
                    isAnalyzing: false,
                    showSFD: false,
                    showBMD: false,
                    showAFD: false,
                    showStressOverlay: false,
                    showDeflectedShape: false,
                    diagramScale: 0.05,
                    showResults: false,
                    modalResults: null,
                    activeModeIndex: 0,
                    modeAmplitude: 1.0,
                    isAnimating: false,
                    nextNodeNumber: 1,
                    nextMemberNumber: 1
                }),

                loadStructure: (newNodes, newMembers) => set((state) => {
                    const nodesMap = new Map<string, Node>();
                    const membersMap = new Map<string, Member>();

                    // Track highest numbers for counter initialization
                    let maxNodeNum = state.nextNodeNumber - 1;
                    let maxMemberNum = state.nextMemberNumber - 1;

                    for (const node of newNodes) {
                        nodesMap.set(node.id, node);
                        // Extract number from N1, N2, etc.
                        const match = node.id.match(/^N(\d+)$/);
                        if (match) {
                            maxNodeNum = Math.max(maxNodeNum, parseInt(match[1]));
                        }
                    }

                    for (const member of newMembers) {
                        // Apply default material properties
                        membersMap.set(member.id, {
                            ...member,
                            E: member.E ?? 200e6,
                            A: member.A ?? 0.01,
                            I: member.I ?? 1e-4
                        });
                        // Extract number from M1, M2, etc.
                        const match = member.id.match(/^M(\d+)$/);
                        if (match) {
                            maxMemberNum = Math.max(maxMemberNum, parseInt(match[1]));
                        }
                    }

                    return {
                        nodes: nodesMap,
                        members: membersMap,
                        loads: [],
                        memberLoads: [],
                        selectedIds: new Set(),
                        analysisResults: null,
                        isAnalyzing: false,
                        showSFD: false,
                        showBMD: false,
                        showAFD: false,
                        showStressOverlay: false,
                        showDeflectedShape: false,
                        nextNodeNumber: maxNodeNum + 1,
                        nextMemberNumber: maxMemberNum + 1,
                        diagramScale: 0.05,
                        showResults: false,
                        modalResults: null,
                        activeModeIndex: 0,
                        modeAmplitude: 1.0,
                        isAnimating: false
                    };
                }),

                // Geometry Operations
                removeMember: (id) =>
                    set((state) => {
                        const newMembers = new Map(state.members);
                        newMembers.delete(id);
                        // Also remove any member loads for this member
                        const newMemberLoads = state.memberLoads.filter(ml => ml.memberId !== id);
                        return { members: newMembers, memberLoads: newMemberLoads };
                    }),

                addNodes: (nodes) =>
                    set((state) => {
                        const newNodes = new Map(state.nodes);
                        nodes.forEach(node => newNodes.set(node.id, node));
                        return { nodes: newNodes };
                    }),

                addMembers: (members) =>
                    set((state) => {
                        const newMembers = new Map(state.members);
                        members.forEach(member => {
                            newMembers.set(member.id, {
                                ...member,
                                E: member.E ?? 200e6,
                                A: member.A ?? 0.01,
                                I: member.I ?? 1e-4
                            });
                        });
                        return { members: newMembers };
                    }),

                splitMemberById: (memberId, ratio) =>
                    set((state) => {
                        const member = state.members.get(memberId);
                        if (!member) return state;

                        const startNode = state.nodes.get(member.startNodeId);
                        const endNode = state.nodes.get(member.endNodeId);
                        if (!startNode || !endNode) return state;

                        // Calculate new node position
                        const dx = endNode.x - startNode.x;
                        const dy = endNode.y - startNode.y;
                        const dz = endNode.z - startNode.z;
                        const clampedRatio = Math.max(0.01, Math.min(0.99, ratio));

                        const newNodeId = state.getNextNodeId();
                        const newNode: Node = {
                            id: newNodeId,
                            x: startNode.x + dx * clampedRatio,
                            y: startNode.y + dy * clampedRatio,
                            z: startNode.z + dz * clampedRatio
                        };

                        // Create two new members
                        const member1: Member = {
                            id: state.getNextMemberId(),
                            startNodeId: member.startNodeId,
                            endNodeId: newNodeId,
                            sectionId: member.sectionId,
                            E: member.E,
                            A: member.A,
                            I: member.I,
                            releases: member.releases
                        };

                        const member2: Member = {
                            id: state.getNextMemberId(),
                            startNodeId: newNodeId,
                            endNodeId: member.endNodeId,
                            sectionId: member.sectionId,
                            E: member.E,
                            A: member.A,
                            I: member.I,
                            releases: member.releases
                        };

                        // Update state
                        const newNodes = new Map(state.nodes);
                        newNodes.set(newNodeId, newNode);

                        const newMembers = new Map(state.members);
                        newMembers.delete(memberId);
                        newMembers.set(member1.id, member1);
                        newMembers.set(member2.id, member2);

                        // Remove old member loads (user needs to reapply)
                        const newMemberLoads = state.memberLoads.filter(ml => ml.memberId !== memberId);

                        return {
                            nodes: newNodes,
                            members: newMembers,
                            memberLoads: newMemberLoads,
                            analysisResults: null // Clear results
                        };
                    }),

                mergeNodes: (nodeId1, nodeId2) =>
                    set((state) => {
                        // Keep nodeId1, remove nodeId2
                        // Update all members connected to nodeId2 to use nodeId1
                        const newNodes = new Map(state.nodes);
                        const newMembers = new Map(state.members);

                        if (!newNodes.has(nodeId1) || !newNodes.has(nodeId2)) return state;

                        const node1 = newNodes.get(nodeId1)!;
                        // Move node1 to average position? Or just keep it? Let's just keep node1 for now.

                        newNodes.delete(nodeId2);

                        // Remap members
                        newMembers.forEach((member, id) => {
                            if (member.startNodeId === nodeId2) {
                                newMembers.set(id, { ...member, startNodeId: nodeId1 });
                            }
                            if (member.endNodeId === nodeId2) {
                                newMembers.set(id, { ...member, endNodeId: nodeId1 });
                            }
                        });

                        return { nodes: newNodes, members: newMembers };
                    }),

                renumberNodes: () => set((state) => {
                    const sortedNodes = Array.from(state.nodes.values()).sort((a, b) => {
                        if (Math.abs(a.y - b.y) > 0.001) return a.y - b.y; // Y (Elevation) first
                        if (Math.abs(a.z - b.z) > 0.001) return a.z - b.z; // Then Z
                        return a.x - b.x; // Then X
                    });

                    const newNodes = new Map<string, Node>();
                    const idMap = new Map<string, string>(); // old -> new
                    const newSelected = new Set(state.selectedIds);
                    let counter = 1;

                    // Renumber nodes
                    sortedNodes.forEach(node => {
                        const newId = `N${counter++}`;
                        idMap.set(node.id, newId);
                        newNodes.set(newId, { ...node, id: newId });

                        // Update selection
                        if (state.selectedIds.has(node.id)) {
                            newSelected.delete(node.id);
                            newSelected.add(newId);
                        }
                    });

                    // Update member references
                    const newMembers = new Map(state.members);
                    newMembers.forEach((member, mId) => {
                        const newStart = idMap.get(member.startNodeId);
                        const newEnd = idMap.get(member.endNodeId);
                        if (newStart && newEnd) {
                            newMembers.set(mId, {
                                ...member,
                                startNodeId: newStart,
                                endNodeId: newEnd
                            });
                        }
                    });

                    // Update nodal loads
                    const newLoads = state.loads.map(load => ({
                        ...load,
                        nodeId: idMap.get(load.nodeId) || load.nodeId
                    }));

                    return {
                        nodes: newNodes,
                        members: newMembers,
                        loads: newLoads,
                        selectedIds: newSelected,
                        nextNodeNumber: counter,
                        analysisResults: null // Invalidate results
                    };
                }),

                renumberMembers: () =>
                    set((state) => {
                        // Sort by start node ID number (heuristic)
                        const sortedMembers = Array.from(state.members.values()).sort((a, b) => {
                            // Extract number from N1, N2...
                            const n1 = parseInt(a.startNodeId.substring(1)) || 0;
                            const n2 = parseInt(b.startNodeId.substring(1)) || 0;
                            return n1 - n2;
                        });

                        const newMembers = new Map<string, Member>();
                        const idMap = new Map<string, string>();
                        const newSelected = new Set(state.selectedIds);
                        let counter = 1;

                        sortedMembers.forEach(member => {
                            const newId = `M${counter++}`;
                            idMap.set(member.id, newId);
                            newMembers.set(newId, { ...member, id: newId });

                            if (state.selectedIds.has(member.id)) {
                                newSelected.delete(member.id);
                                newSelected.add(newId);
                            }
                        });

                        // Update member loads
                        const newMemberLoads = state.memberLoads.map(load => ({
                            ...load,
                            memberId: idMap.get(load.memberId) || load.memberId
                        }));

                        return {
                            members: newMembers,
                            memberLoads: newMemberLoads,
                            selectedIds: newSelected,
                            nextMemberNumber: counter,
                            analysisResults: null
                        };
                    })

            })),
        {
            name: 'StructuralModel',
            // Optional: Serializer for better Map visibility in Redux DevTools
            serialize: {
                options: {
                    map: true // Modern DevTools might handle Maps, otherwise custom logic needed
                }
            }
        }
    )
);

// ============================================
// LOCAL STORAGE PERSISTENCE
// ============================================

const STORAGE_KEY = 'beamlab_project';

export interface SavedProjectData {
    projectInfo: ProjectInfo;
    nodes: [string, Node][];
    members: [string, Member][];
    loads: NodeLoad[];
    memberLoads: MemberLoad[];
    savedAt: string;
}

/**
 * Save current project to localStorage
 */
export const saveProjectToStorage = (): boolean => {
    try {
        const state = useModelStore.getState();
        const projectData: SavedProjectData = {
            projectInfo: state.projectInfo,
            nodes: Array.from(state.nodes.entries()),
            members: Array.from(state.members.entries()),
            loads: state.loads || [],
            memberLoads: state.memberLoads || [],
            savedAt: new Date().toISOString()
        };

        // Validate data before saving
        if (projectData.nodes.length === 0) {
            console.warn('Attempting to save empty project');
        }

        const jsonString = JSON.stringify(projectData);

        // Check approximate size (localStorage typically 5-10MB limit)
        if (jsonString.length > 5 * 1024 * 1024) {
            console.error('Project too large to save locally');
            return false;
        }

        try {
            localStorage.setItem(STORAGE_KEY, jsonString);
        } catch (quotaError) {
            if (quotaError instanceof DOMException && (quotaError as any).code === 22) {
                console.error('localStorage quota exceeded - clear some projects');
                return false;
            }
            throw quotaError;
        }

        return true;
    } catch (e) {
        console.error('Failed to save project:', e);
        return false;
    }
};

/**
 * Load project from localStorage
 */
export const loadProjectFromStorage = (): boolean => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return false;

        // Validate JSON before parsing
        let data: SavedProjectData;
        try {
            data = JSON.parse(stored);
        } catch (parseError) {
            console.error('Corrupted localStorage data, clearing...');
            localStorage.removeItem(STORAGE_KEY);
            return false;
        }

        // Validate essential fields
        if (!data.projectInfo || !Array.isArray(data.nodes) || !Array.isArray(data.members)) {
            console.error('Invalid project data structure');
            return false;
        }

        const state = useModelStore.getState();

        // Restore nodes with error handling
        const nodesMap = new Map<string, Node>();
        try {
            data.nodes.forEach(([id, node]) => {
                if (id && node && typeof node.x === 'number' && typeof node.y === 'number' && typeof node.z === 'number') {
                    nodesMap.set(id, node);
                }
            });
        } catch (nodeError) {
            console.error('Error restoring nodes:', nodeError);
        }

        // Restore members with error handling
        const membersMap = new Map<string, Member>();
        try {
            data.members.forEach(([id, member]) => {
                if (id && member && member.startNodeId && member.endNodeId) {
                    membersMap.set(id, member);
                }
            });
        } catch (memberError) {
            console.error('Error restoring members:', memberError);
        }

        // Calculate next IDs with safety checks
        let maxNodeNum = 0;
        let maxMemberNum = 0;

        try {
            nodesMap.forEach((_, id) => {
                const match = id?.match?.(/^N(\d+)$/);
                if (match && match[1]) {
                    maxNodeNum = Math.max(maxNodeNum, parseInt(match[1], 10) || 0);
                }
            });

            membersMap.forEach((_, id) => {
                const match = id?.match?.(/^M(\d+)$/);
                if (match && match[1]) {
                    maxMemberNum = Math.max(maxMemberNum, parseInt(match[1], 10) || 0);
                }
            });
        } catch (idError) {
            console.error('Error calculating next IDs:', idError);
        }

        // Validate loaded data
        if (nodesMap.size === 0 && data.nodes.length > 0) {
            console.warn('No valid nodes loaded');
        }

        // Update store with loaded data
        useModelStore.setState({
            projectInfo: {
                ...data.projectInfo,
                date: data.projectInfo.date instanceof Date ? data.projectInfo.date : new Date(data.projectInfo.date || Date.now())
            },
            nodes: nodesMap,
            members: membersMap,
            loads: Array.isArray(data.loads) ? data.loads : [],
            memberLoads: Array.isArray(data.memberLoads) ? data.memberLoads : [],
            nextNodeNumber: maxNodeNum + 1,
            nextMemberNumber: maxMemberNum + 1,
            selectedIds: new Set(),
            analysisResults: null
        });

        return true;
    } catch (e) {
        console.error('Failed to load project:', e);
        return false;
    }
};

/**
 * Check if a saved project exists
 */
export const hasSavedProject = (): boolean => {
    return localStorage.getItem(STORAGE_KEY) !== null;
};

/**
 * Get saved project metadata without loading it
 */
export const getSavedProjectInfo = (): { name: string; savedAt: string } | null => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const data: SavedProjectData = JSON.parse(stored);
        return {
            name: data.projectInfo.name,
            savedAt: data.savedAt
        };
    } catch {
        return null;
    }
};

/**
 * Clear saved project from localStorage
 */
export const clearSavedProject = (): void => {
    localStorage.removeItem(STORAGE_KEY);
};
