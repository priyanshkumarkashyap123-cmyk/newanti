import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { temporal } from 'zundo';

// 1. Define Interfaces
export interface Restraints {
    fx: boolean; fy: boolean; fz: boolean; // Translation restraints
    mx: boolean; my: boolean; mz: boolean; // Rotation restraints
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

export interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    sectionId: string;
    // Default properties for analysis
    E?: number; // Young's Modulus (kN/m²)
    A?: number; // Cross-sectional Area (m²)
    I?: number; // Moment of Inertia (m⁴)
    // Member releases (hinges)
    releases?: {
        startMoment: boolean; // Release moment at start
        endMoment: boolean;   // Release moment at end
    };
}

// Analysis Results
export interface AnalysisResults {
    displacements: Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>;
    reactions: Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>;
    memberForces: Map<string, { axial: number; shearY: number; shearZ: number; momentY: number; momentZ: number; torsion: number }>;
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
    nodes: Map<string, Node>;
    members: Map<string, Member>;
    loads: NodeLoad[];
    memberLoads: MemberLoad[];  // NEW: Member loads (UDL, UVL, point)
    selectedIds: Set<string>;
    analysisResults: AnalysisResults | null;
    isAnalyzing: boolean;
    displacementScale: number;  // Scale factor for displaced shape visualization

    // Diagram visibility
    showSFD: boolean;  // Shear Force Diagram
    showBMD: boolean;  // Bending Moment Diagram
    showResults: boolean;  // Results Table visibility

    // Modal Analysis / Dynamics
    modalResults: ModalResult | null;
    activeModeIndex: number;    // Which mode to visualize (0-based)
    modeAmplitude: number;      // Amplitude scale for mode shape animation
    isAnimating: boolean;       // Play/pause animation

    // 3. Actions
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
    selectNode: (id: string | null) => void;
    selectMember: (id: string | null) => void;
    updateNode: (id: string, updates: Partial<Node>) => void;
    clearSelection: () => void;

    // Tools
    activeTool: 'select' | 'node' | 'member' | 'support' | 'load' | 'memberLoad';
    setTool: (tool: 'select' | 'node' | 'member' | 'support' | 'load' | 'memberLoad') => void;
    setDisplacementScale: (scale: number) => void;
    setShowSFD: (show: boolean) => void;
    setShowBMD: (show: boolean) => void;
    setShowResults: (show: boolean) => void;

    // Modal Analysis Actions
    setModalResults: (results: ModalResult | null) => void;
    setActiveModeIndex: (index: number) => void;
    setModeAmplitude: (amplitude: number) => void;
    setIsAnimating: (animating: boolean) => void;

    // Model Management
    clearModel: () => void;  // Clears entire model for fresh start
}

// Helper to convert Map to Record for DevTools display
const serializeMap = (map: Map<any, any>) => {
    return Object.fromEntries(map);
};

export const useModelStore = create<ModelState>()(
    devtools(
        temporal(
            (set) => ({
                nodes: new Map(),
                members: new Map(),
                loads: [],
                memberLoads: [],  // NEW: Member distributed/point loads
                selectedIds: new Set(),
                analysisResults: null,
                isAnalyzing: false,
                displacementScale: 100, // Default scale factor
                showSFD: false,
                showBMD: false,
                showResults: false,

                // Modal Analysis state
                modalResults: null,
                activeModeIndex: 0,
                modeAmplitude: 1.0,
                isAnimating: false,

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

                selectNode: (id) =>
                    set((state) => {
                        if (id === null) return { selectedIds: new Set() };
                        return { selectedIds: new Set([id]) };
                    }),

                selectMember: (id) =>
                    set((state) => {
                        if (id === null) return { selectedIds: new Set() };
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

                activeTool: 'select',
                setTool: (tool) => set({ activeTool: tool }),
                setDisplacementScale: (scale) => set({ displacementScale: scale }),
                setShowSFD: (show) => set({ showSFD: show }),
                setShowBMD: (show) => set({ showBMD: show }),
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
                    showResults: false,
                    modalResults: null,
                    activeModeIndex: 0,
                    modeAmplitude: 1.0,
                    isAnimating: false
                })
            })
        ),
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
