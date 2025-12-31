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
    // Rigid zone offsets (for beam-column connections)
    startOffset?: { x: number; y: number; z: number };
    endOffset?: { x: number; y: number; z: number };
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
    projectInfo: ProjectInfo; // NEW
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

    // Clipboard Operations (like STAAD)
    clipboard: { nodes: Node[]; members: Member[] } | null;
    copySelection: () => void;                      // Copy selected to clipboard
    pasteClipboard: (offset?: { x: number; y: number; z: number }) => void; // Paste with offset
    duplicateSelection: (offset?: { x: number; y: number; z: number }) => void; // Duplicate in place
    moveSelection: (dx: number, dy: number, dz: number) => void; // Move selected elements
    deleteSelection: () => void;                    // Delete all selected

    // Tools
    activeTool: 'select' | 'node' | 'member' | 'support' | 'load' | 'memberLoad';
    setTool: (tool: 'select' | 'node' | 'member' | 'support' | 'load' | 'memberLoad') => void;
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
    splitMemberById: (memberId: string, ratio: number) => void; // Insert node in member
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
                loads: [],
                memberLoads: [],  // NEW: Member distributed/point loads
                selectedIds: new Set(),
                analysisResults: null,
                isAnalyzing: false,
                displacementScale: 100, // Default scale factor
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
                            const newId = crypto.randomUUID();
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
                                const newId = crypto.randomUUID();
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
                        const newId = crypto.randomUUID();
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
                            const newId = crypto.randomUUID();
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
                    isAnimating: false
                }),

                loadStructure: (newNodes, newMembers) => set(() => {
                    const nodesMap = new Map<string, Node>();
                    const membersMap = new Map<string, Member>();

                    for (const node of newNodes) {
                        nodesMap.set(node.id, node);
                    }

                    for (const member of newMembers) {
                        // Apply default material properties
                        membersMap.set(member.id, {
                            ...member,
                            E: member.E ?? 200e6,
                            A: member.A ?? 0.01,
                            I: member.I ?? 1e-4
                        });
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

                        const newNodeId = `${memberId}_split`;
                        const newNode: Node = {
                            id: newNodeId,
                            x: startNode.x + dx * clampedRatio,
                            y: startNode.y + dy * clampedRatio,
                            z: startNode.z + dz * clampedRatio
                        };

                        // Create two new members
                        const member1: Member = {
                            id: `${memberId}_a`,
                            startNodeId: member.startNodeId,
                            endNodeId: newNodeId,
                            sectionId: member.sectionId,
                            E: member.E,
                            A: member.A,
                            I: member.I,
                            releases: member.releases
                        };

                        const member2: Member = {
                            id: `${memberId}_b`,
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


