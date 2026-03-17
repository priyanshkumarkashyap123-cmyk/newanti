/**
 * ToolGroups.ts - Comprehensive Tool Definitions
 * 
 * Organized tool metadata for the modeling toolbar including:
 * - Icons (Lucide React)
 * - Labels and tooltips
 * - Keyboard shortcuts
 * - Tool groups for dropdown menus
 */

import {
    MousePointer, Square, Move, Circle, Triangle,
    Minus, Plus, Copy, Trash2, FlipHorizontal2,
    Grid, RotateCw, Maximize2, ArrowRight, Split,
    Merge, AlignLeft, Columns, Cable, Spline,
    Link2, Box, Building, Layers, Ruler,
    CornerUpRight, CircleDot, Hexagon, Milestone,
    ArrowDown, Wind, Zap, Thermometer, Waves,
    Weight, Play, Eye, FileText, Settings,
    Wrench, Hammer, ChevronDown, LucideIcon,
    Magnet, Crosshair, Axis3D, Scan, Table,
    Hash, RefreshCw, FolderTree, Shapes, Pipette,
    CopyPlus, Scissors, ScanLine, Frame, Paintbrush,
    FocusIcon, EyeOff, Grip, ArrowUpDown, Workflow,
    Navigation, Orbit, SquareDashedBottom, List,
    ListTree, Tag, Search, Globe, Sparkles,
    Diff, Group, Ungroup, Lock, Unlock,
    PanelTop, History, Undo2, Redo2, Aperture,
    MoveHorizontal, MoveVertical, Move3D, LayoutGrid,
    TrendingUp, Activity, Radio, AlertTriangle,
    BarChart2, BarChart, Sliders, ArrowUp,
    Percent, Snowflake
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface ToolDefinition {
    id: string;
    label: string;
    tooltip: string;
    icon: LucideIcon;
    shortcut?: string;
    category: 'MODELING' | 'PROPERTIES' | 'LOADING' | 'ANALYSIS' | 'DESIGN' | 'VIEW' | 'SNAP';
    group?: string;
    isGenerator?: boolean;
}

export interface ToolGroup {
    id: string;
    label: string;
    icon: LucideIcon;
    tools: string[];  // Tool IDs
}

// ============================================
// TOOL GROUPS FOR MODELING CATEGORY
// ============================================

export const MODELING_TOOL_GROUPS: ToolGroup[] = [
    {
        id: 'selection',
        label: 'Select',
        icon: MousePointer,
        tools: ['SELECT', 'SELECT_RANGE', 'PAN', 'ZOOM_WINDOW']
    },
    {
        id: 'draw',
        label: 'Draw',
        icon: Plus,
        tools: ['DRAW_NODE', 'DRAW_BEAM', 'DRAW_COLUMN', 'DRAW_CABLE', 'DRAW_ARCH', 'DRAW_RIGID_LINK', 'DRAW_PLATE']
    },
    {
        id: 'edit',
        label: 'Edit',
        icon: Wrench,
        tools: ['COPY', 'MIRROR', 'DELETE', 'DIVIDE_MEMBER', 'MERGE_NODES', 'ALIGN_NODES', 'SPLIT_MEMBER']
    },
    {
        id: 'array',
        label: 'Array',
        icon: Grid,
        tools: ['ARRAY_LINEAR', 'ARRAY_POLAR', 'ARRAY_3D']
    },
    {
        id: 'transform',
        label: 'Transform',
        icon: Move,
        tools: ['MOVE', 'ROTATE', 'SCALE', 'OFFSET_MEMBER', 'EXTRUDE']
    },
    {
        id: 'generate',
        label: 'Generate',
        icon: Building,
        tools: [
            'GRID_GENERATE', 'GRID_3D', 'CIRCULAR_GRID',
            'TRUSS_GENERATOR', 'ARCH_GENERATOR', 'PIER_GENERATOR',
            'TOWER_GENERATOR', 'DECK_GENERATOR', 'CABLE_PATTERN',
            'FRAME_GENERATOR', 'STAIRCASE_GENERATOR'
        ]
    },
    {
        id: 'measure',
        label: 'Measure',
        icon: Ruler,
        tools: ['MEASURE_DISTANCE', 'MEASURE_ANGLE', 'MEASURE_AREA']
    },
    {
        id: 'snap',
        label: 'Snap',
        icon: Magnet,
        tools: ['SNAP_GRID', 'SNAP_NODE', 'SNAP_MIDPOINT', 'SNAP_INTERSECTION', 'SNAP_PERPENDICULAR', 'SNAP_NEAREST']
    },
    {
        id: 'view',
        label: 'View',
        icon: Eye,
        tools: [
            'VIEW_FRONT', 'VIEW_TOP', 'VIEW_RIGHT', 'VIEW_ISO',
            'VIEW_FIT', 'VIEW_PREVIOUS',
            'RENDER_WIREFRAME', 'RENDER_SOLID', 'RENDER_ANALYTICAL',
            'SHOW_LABELS', 'SHOW_LOADS', 'SHOW_SUPPORTS',
            'SHOW_MEMBER_NUMBERS', 'SHOW_NODE_NUMBERS', 'SHOW_DIMENSIONS'
        ]
    },
    {
        id: 'utilities',
        label: 'Utilities',
        icon: Wrench,
        tools: [
            'RENUMBER_NODES', 'RENUMBER_MEMBERS',
            'CHECK_GEOMETRY', 'MEMBER_QUERY',
            'SELECT_BY_PROPERTY', 'SELECT_BY_GROUP',
            'CREATE_GROUP', 'MEMBER_OFFSET_SPECS',
            'UNDO', 'REDO'
        ]
    }
];

// ============================================
// ALL TOOL DEFINITIONS
// ============================================

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
    // ========== SELECTION TOOLS ==========
    SELECT: {
        id: 'SELECT',
        label: 'Select',
        tooltip: 'Select elements (Esc)',
        icon: MousePointer,
        shortcut: 'Escape',
        category: 'MODELING',
        group: 'selection'
    },
    SELECT_RANGE: {
        id: 'SELECT_RANGE',
        label: 'Box Select',
        tooltip: 'Select by rectangle',
        icon: Square,
        shortcut: 'Shift+S',
        category: 'MODELING',
        group: 'selection'
    },
    PAN: {
        id: 'PAN',
        label: 'Pan',
        tooltip: 'Pan view (Hold middle mouse)',
        icon: Move,
        category: 'MODELING',
        group: 'selection'
    },
    ZOOM_WINDOW: {
        id: 'ZOOM_WINDOW',
        label: 'Zoom Window',
        tooltip: 'Zoom to selected area',
        icon: Maximize2,
        shortcut: 'Z',
        category: 'MODELING',
        group: 'selection'
    },

    // ========== DRAW TOOLS ==========
    DRAW_NODE: {
        id: 'DRAW_NODE',
        label: 'Node',
        tooltip: 'Place node at point (N)',
        icon: CircleDot,
        shortcut: 'N',
        category: 'MODELING',
        group: 'draw'
    },
    DRAW_BEAM: {
        id: 'DRAW_BEAM',
        label: 'Beam',
        tooltip: 'Draw beam between nodes (B)',
        icon: Minus,
        shortcut: 'B',
        category: 'MODELING',
        group: 'draw'
    },
    DRAW_COLUMN: {
        id: 'DRAW_COLUMN',
        label: 'Column',
        tooltip: 'Draw vertical column (V)',
        icon: ArrowDown,
        shortcut: 'V',
        category: 'MODELING',
        group: 'draw'
    },
    DRAW_CABLE: {
        id: 'DRAW_CABLE',
        label: 'Cable',
        tooltip: 'Draw cable/tension element (C)',
        icon: Cable,
        shortcut: 'C',
        category: 'MODELING',
        group: 'draw'
    },
    DRAW_ARCH: {
        id: 'DRAW_ARCH',
        label: 'Arch',
        tooltip: 'Draw parabolic/circular arch',
        icon: Spline,
        shortcut: 'A',
        category: 'MODELING',
        group: 'draw'
    },
    DRAW_RIGID_LINK: {
        id: 'DRAW_RIGID_LINK',
        label: 'Rigid Link',
        tooltip: 'Create rigid link between nodes',
        icon: Link2,
        category: 'MODELING',
        group: 'draw'
    },
    DRAW_PLATE: {
        id: 'DRAW_PLATE',
        label: 'Plate/Shell',
        tooltip: 'Draw plate or shell element',
        icon: Square,
        shortcut: 'P',
        category: 'MODELING',
        group: 'draw'
    },

    // ========== EDIT TOOLS ==========
    COPY: {
        id: 'COPY',
        label: 'Copy',
        tooltip: 'Copy selected elements (Ctrl+C)',
        icon: Copy,
        shortcut: 'Ctrl+C',
        category: 'MODELING',
        group: 'edit'
    },
    MIRROR: {
        id: 'MIRROR',
        label: 'Mirror',
        tooltip: 'Mirror selected elements',
        icon: FlipHorizontal2,
        category: 'MODELING',
        group: 'edit'
    },
    DELETE: {
        id: 'DELETE',
        label: 'Delete',
        tooltip: 'Delete selected elements (D or Del)',
        icon: Trash2,
        shortcut: 'Delete',
        category: 'MODELING',
        group: 'edit'
    },
    DIVIDE_MEMBER: {
        id: 'DIVIDE_MEMBER',
        label: 'Divide',
        tooltip: 'Divide member into segments',
        icon: Split,
        category: 'MODELING',
        group: 'edit'
    },
    SPLIT_MEMBER: {
        id: 'SPLIT_MEMBER',
        label: 'Split at Point',
        tooltip: 'Split member at intersection',
        icon: Split,
        category: 'MODELING',
        group: 'edit'
    },
    MERGE_NODES: {
        id: 'MERGE_NODES',
        label: 'Merge Nodes',
        tooltip: 'Merge coincident nodes',
        icon: Merge,
        category: 'MODELING',
        group: 'edit'
    },
    ALIGN_NODES: {
        id: 'ALIGN_NODES',
        label: 'Align',
        tooltip: 'Align nodes to line/plane',
        icon: AlignLeft,
        category: 'MODELING',
        group: 'edit'
    },

    // ========== ARRAY TOOLS ==========
    ARRAY_LINEAR: {
        id: 'ARRAY_LINEAR',
        label: 'Linear Array',
        tooltip: 'Create linear copies',
        icon: ArrowRight,
        category: 'MODELING',
        group: 'array'
    },
    ARRAY_POLAR: {
        id: 'ARRAY_POLAR',
        label: 'Polar Array',
        tooltip: 'Create rotational copies',
        icon: Circle,
        category: 'MODELING',
        group: 'array'
    },
    ARRAY_3D: {
        id: 'ARRAY_3D',
        label: '3D Array',
        tooltip: 'Create 3D grid copies',
        icon: Box,
        category: 'MODELING',
        group: 'array'
    },

    // ========== TRANSFORM TOOLS ==========
    MOVE: {
        id: 'MOVE',
        label: 'Move',
        tooltip: 'Move selected elements (M)',
        icon: Move,
        shortcut: 'M',
        category: 'MODELING',
        group: 'transform'
    },
    ROTATE: {
        id: 'ROTATE',
        label: 'Rotate',
        tooltip: 'Rotate selected elements (R)',
        icon: RotateCw,
        shortcut: 'R',
        category: 'MODELING',
        group: 'transform'
    },
    SCALE: {
        id: 'SCALE',
        label: 'Scale',
        tooltip: 'Scale selected elements (S)',
        icon: Maximize2,
        shortcut: 'S',
        category: 'MODELING',
        group: 'transform'
    },
    OFFSET_MEMBER: {
        id: 'OFFSET_MEMBER',
        label: 'Offset',
        tooltip: 'Create parallel offset',
        icon: Columns,
        shortcut: 'O',
        category: 'MODELING',
        group: 'transform'
    },
    EXTRUDE: {
        id: 'EXTRUDE',
        label: 'Extrude',
        tooltip: 'Extrude nodes/edges',
        icon: CornerUpRight,
        shortcut: 'E',
        category: 'MODELING',
        group: 'transform'
    },

    // ========== GENERATOR TOOLS ==========
    GRID_GENERATE: {
        id: 'GRID_GENERATE',
        label: '2D Grid',
        tooltip: 'Generate 2D structural grid',
        icon: Grid,
        category: 'MODELING',
        group: 'generate',
        isGenerator: true
    },
    GRID_3D: {
        id: 'GRID_3D',
        label: '3D Grid',
        tooltip: 'Generate 3D structural frame',
        icon: Box,
        category: 'MODELING',
        group: 'generate',
        isGenerator: true
    },
    CIRCULAR_GRID: {
        id: 'CIRCULAR_GRID',
        label: 'Circular Grid',
        tooltip: 'Generate radial/circular grid',
        icon: Circle,
        category: 'MODELING',
        group: 'generate',
        isGenerator: true
    },
    TRUSS_GENERATOR: {
        id: 'TRUSS_GENERATOR',
        label: 'Truss',
        tooltip: 'Generate Warren/Pratt/Howe truss',
        icon: Triangle,
        category: 'MODELING',
        group: 'generate',
        isGenerator: true
    },
    ARCH_GENERATOR: {
        id: 'ARCH_GENERATOR',
        label: 'Arch',
        tooltip: 'Generate parabolic/circular arch',
        icon: Spline,
        category: 'MODELING',
        group: 'generate',
        isGenerator: true
    },
    PIER_GENERATOR: {
        id: 'PIER_GENERATOR',
        label: 'Pier',
        tooltip: 'Generate bridge pier with cap beam',
        icon: Milestone,
        category: 'MODELING',
        group: 'generate',
        isGenerator: true
    },
    TOWER_GENERATOR: {
        id: 'TOWER_GENERATOR',
        label: 'Tower',
        tooltip: 'Generate tower structure',
        icon: Building,
        category: 'MODELING',
        group: 'generate',
        isGenerator: true
    },
    DECK_GENERATOR: {
        id: 'DECK_GENERATOR',
        label: 'Deck',
        tooltip: 'Generate bridge deck with stringers',
        icon: Layers,
        category: 'MODELING',
        group: 'generate',
        isGenerator: true
    },
    CABLE_PATTERN: {
        id: 'CABLE_PATTERN',
        label: 'Cable Pattern',
        tooltip: 'Generate fan/harp cable arrangement',
        icon: Cable,
        category: 'MODELING',
        group: 'generate',
        isGenerator: true
    },
    FRAME_GENERATOR: {
        id: 'FRAME_GENERATOR',
        label: 'Frame',
        tooltip: 'Generate portal/multi-story frame',
        icon: Building,
        category: 'MODELING',
        group: 'generate',
        isGenerator: true
    },
    STAIRCASE_GENERATOR: {
        id: 'STAIRCASE_GENERATOR',
        label: 'Staircase',
        tooltip: 'Generate staircase structure',
        icon: ArrowDown,
        category: 'MODELING',
        group: 'generate',
        isGenerator: true
    },

    // ========== MEASURE TOOLS ==========
    MEASURE_DISTANCE: {
        id: 'MEASURE_DISTANCE',
        label: 'Distance',
        tooltip: 'Measure distance between points',
        icon: Ruler,
        category: 'MODELING',
        group: 'measure'
    },
    MEASURE_ANGLE: {
        id: 'MEASURE_ANGLE',
        label: 'Angle',
        tooltip: 'Measure angle between lines',
        icon: CornerUpRight,
        category: 'MODELING',
        group: 'measure'
    },
    MEASURE_AREA: {
        id: 'MEASURE_AREA',
        label: 'Area',
        tooltip: 'Measure enclosed area',
        icon: Square,
        category: 'MODELING',
        group: 'measure'
    },

    // ========== SNAP TOOLS ==========
    SNAP_GRID: {
        id: 'SNAP_GRID',
        label: 'Grid Snap',
        tooltip: 'Snap to grid intersections (Ctrl+G)',
        icon: Grid,
        shortcut: 'Ctrl+G',
        category: 'SNAP',
        group: 'snap'
    },
    SNAP_NODE: {
        id: 'SNAP_NODE',
        label: 'Node Snap',
        tooltip: 'Snap to existing nodes',
        icon: CircleDot,
        category: 'SNAP',
        group: 'snap'
    },
    SNAP_MIDPOINT: {
        id: 'SNAP_MIDPOINT',
        label: 'Midpoint',
        tooltip: 'Snap to member midpoints',
        icon: Minus,
        category: 'SNAP',
        group: 'snap'
    },
    SNAP_INTERSECTION: {
        id: 'SNAP_INTERSECTION',
        label: 'Intersection',
        tooltip: 'Snap to member intersections',
        icon: Crosshair,
        category: 'SNAP',
        group: 'snap'
    },
    SNAP_PERPENDICULAR: {
        id: 'SNAP_PERPENDICULAR',
        label: 'Perpendicular',
        tooltip: 'Snap perpendicular to members',
        icon: CornerUpRight,
        category: 'SNAP',
        group: 'snap'
    },
    SNAP_NEAREST: {
        id: 'SNAP_NEAREST',
        label: 'Nearest',
        tooltip: 'Snap to nearest point on member',
        icon: Magnet,
        category: 'SNAP',
        group: 'snap'
    },

    // ========== VIEW TOOLS ==========
    VIEW_FRONT: {
        id: 'VIEW_FRONT',
        label: 'Front (XY)',
        tooltip: 'View from front (XY plane)',
        icon: Square,
        shortcut: '1',
        category: 'VIEW',
        group: 'view'
    },
    VIEW_TOP: {
        id: 'VIEW_TOP',
        label: 'Top (XZ)',
        tooltip: 'View from top (plan view)',
        icon: Square,
        shortcut: '2',
        category: 'VIEW',
        group: 'view'
    },
    VIEW_RIGHT: {
        id: 'VIEW_RIGHT',
        label: 'Right (YZ)',
        tooltip: 'View from right (elevation)',
        icon: Square,
        shortcut: '3',
        category: 'VIEW',
        group: 'view'
    },
    VIEW_ISO: {
        id: 'VIEW_ISO',
        label: 'Isometric',
        tooltip: 'Standard isometric view',
        icon: Box,
        shortcut: '0',
        category: 'VIEW',
        group: 'view'
    },
    VIEW_FIT: {
        id: 'VIEW_FIT',
        label: 'Zoom Fit',
        tooltip: 'Fit entire model in view (F)',
        icon: Maximize2,
        shortcut: 'F',
        category: 'VIEW',
        group: 'view'
    },
    VIEW_PREVIOUS: {
        id: 'VIEW_PREVIOUS',
        label: 'Previous View',
        tooltip: 'Restore previous camera view',
        icon: History,
        category: 'VIEW',
        group: 'view'
    },
    RENDER_WIREFRAME: {
        id: 'RENDER_WIREFRAME',
        label: 'Wireframe',
        tooltip: 'Wireframe rendering mode',
        icon: Box,
        category: 'VIEW',
        group: 'view'
    },
    RENDER_SOLID: {
        id: 'RENDER_SOLID',
        label: 'Solid/Extrude',
        tooltip: 'Solid 3D rendering with section shapes',
        icon: Hexagon,
        category: 'VIEW',
        group: 'view'
    },
    RENDER_ANALYTICAL: {
        id: 'RENDER_ANALYTICAL',
        label: 'Analytical',
        tooltip: 'Line model with centerline representation',
        icon: Minus,
        category: 'VIEW',
        group: 'view'
    },
    SHOW_LABELS: {
        id: 'SHOW_LABELS',
        label: 'Toggle Labels',
        tooltip: 'Show/hide element labels',
        icon: Tag,
        shortcut: 'L',
        category: 'VIEW',
        group: 'view'
    },
    SHOW_LOADS: {
        id: 'SHOW_LOADS',
        label: 'Toggle Loads',
        tooltip: 'Show/hide applied loads with values',
        icon: ArrowDown,
        category: 'VIEW',
        group: 'view'
    },
    SHOW_SUPPORTS: {
        id: 'SHOW_SUPPORTS',
        label: 'Toggle Supports',
        tooltip: 'Show/hide support symbols',
        icon: Triangle,
        category: 'VIEW',
        group: 'view'
    },
    SHOW_MEMBER_NUMBERS: {
        id: 'SHOW_MEMBER_NUMBERS',
        label: 'Member Nos.',
        tooltip: 'Show/hide member numbers',
        icon: Hash,
        category: 'VIEW',
        group: 'view'
    },
    SHOW_NODE_NUMBERS: {
        id: 'SHOW_NODE_NUMBERS',
        label: 'Node Nos.',
        tooltip: 'Show/hide node numbers',
        icon: Hash,
        category: 'VIEW',
        group: 'view'
    },
    SHOW_DIMENSIONS: {
        id: 'SHOW_DIMENSIONS',
        label: 'Dimensions',
        tooltip: 'Show/hide member length dimensions',
        icon: Ruler,
        category: 'VIEW',
        group: 'view'
    },

    // ========== UTILITY TOOLS ==========
    RENUMBER_NODES: {
        id: 'RENUMBER_NODES',
        label: 'Renumber Nodes',
        tooltip: 'Renumber nodes sequentially',
        icon: Hash,
        category: 'MODELING',
        group: 'utilities'
    },
    RENUMBER_MEMBERS: {
        id: 'RENUMBER_MEMBERS',
        label: 'Renumber Members',
        tooltip: 'Renumber members sequentially',
        icon: Hash,
        category: 'MODELING',
        group: 'utilities'
    },
    CHECK_GEOMETRY: {
        id: 'CHECK_GEOMETRY',
        label: 'Check Geometry',
        tooltip: 'Find duplicate nodes, zero-length members, orphan nodes',
        icon: Search,
        category: 'MODELING',
        group: 'utilities'
    },
    MEMBER_QUERY: {
        id: 'MEMBER_QUERY',
        label: 'Member Query',
        tooltip: 'Query member properties, forces, and section details',
        icon: Pipette,
        shortcut: 'Q',
        category: 'MODELING',
        group: 'utilities'
    },
    SELECT_BY_PROPERTY: {
        id: 'SELECT_BY_PROPERTY',
        label: 'Select by Property',
        tooltip: 'Select elements by section or material',
        icon: Paintbrush,
        category: 'MODELING',
        group: 'utilities'
    },
    SELECT_BY_GROUP: {
        id: 'SELECT_BY_GROUP',
        label: 'Select by Group',
        tooltip: 'Select elements by member group',
        icon: FolderTree,
        category: 'MODELING',
        group: 'utilities'
    },
    CREATE_GROUP: {
        id: 'CREATE_GROUP',
        label: 'Create Group',
        tooltip: 'Create named member/node group',
        icon: Group,
        category: 'MODELING',
        group: 'utilities'
    },
    MEMBER_OFFSET_SPECS: {
        id: 'MEMBER_OFFSET_SPECS',
        label: 'Offset Specs',
        tooltip: 'Rigid end offset specifications (STAAD format)',
        icon: MoveHorizontal,
        category: 'PROPERTIES',
        group: 'utilities'
    },
    UNDO: {
        id: 'UNDO',
        label: 'Undo',
        tooltip: 'Undo last operation (Ctrl+Z)',
        icon: Undo2,
        shortcut: 'Ctrl+Z',
        category: 'MODELING',
        group: 'utilities'
    },
    REDO: {
        id: 'REDO',
        label: 'Redo',
        tooltip: 'Redo last operation (Ctrl+Y)',
        icon: Redo2,
        shortcut: 'Ctrl+Y',
        category: 'MODELING',
        group: 'utilities'
    },

    // ========== PROPERTIES TOOLS ==========
    ASSIGN_SECTION: {
        id: 'ASSIGN_SECTION',
        label: 'Section',
        tooltip: 'Assign cross-section to members',
        icon: Hexagon,
        category: 'PROPERTIES'
    },
    ASSIGN_MATERIAL: {
        id: 'ASSIGN_MATERIAL',
        label: 'Material',
        tooltip: 'Assign material properties',
        icon: Box,
        category: 'PROPERTIES'
    },
    ASSIGN_RELEASE: {
        id: 'ASSIGN_RELEASE',
        label: 'Releases',
        tooltip: 'Define member end releases (hinges)',
        icon: Link2,
        category: 'PROPERTIES'
    },
    ASSIGN_OFFSET: {
        id: 'ASSIGN_OFFSET',
        label: 'Offset',
        tooltip: 'Define member rigid offsets',
        icon: Columns,
        category: 'PROPERTIES'
    },
    ASSIGN_CABLE_PROPS: {
        id: 'ASSIGN_CABLE_PROPS',
        label: 'Cable Props',
        tooltip: 'Assign cable properties (pretension, area)',
        icon: Cable,
        category: 'PROPERTIES'
    },
    ASSIGN_SPRING: {
        id: 'ASSIGN_SPRING',
        label: 'Spring',
        tooltip: 'Assign spring stiffness',
        icon: Zap,
        category: 'PROPERTIES'
    },
    ASSIGN_MASS: {
        id: 'ASSIGN_MASS',
        label: 'Mass',
        tooltip: 'Assign lumped mass for dynamics',
        icon: Weight,
        category: 'PROPERTIES'
    },
    MEMBER_ORIENTATION: {
        id: 'MEMBER_ORIENTATION',
        label: 'Orientation',
        tooltip: 'Set member beta angle',
        icon: RotateCw,
        category: 'PROPERTIES'
    },
    ASSIGN_SUPPORT: {
        id: 'ASSIGN_SUPPORT',
        label: 'Support',
        tooltip: 'Define nodal restraints',
        icon: ArrowDown,
        category: 'PROPERTIES'
    },
    SECTION_BUILDER: {
        id: 'SECTION_BUILDER',
        label: 'Section Builder',
        tooltip: 'Create custom cross-section',
        icon: Settings,
        category: 'PROPERTIES'
    },

    // ========== LOADING TOOLS ==========
    ADD_POINT_LOAD: {
        id: 'ADD_POINT_LOAD',
        label: 'Point Load',
        tooltip: 'Apply concentrated force',
        icon: ArrowDown,
        shortcut: 'F',
        category: 'LOADING'
    },
    ADD_MOMENT: {
        id: 'ADD_MOMENT',
        label: 'Moment',
        tooltip: 'Apply concentrated moment',
        icon: RotateCw,
        category: 'LOADING'
    },
    ADD_UDL: {
        id: 'ADD_UDL',
        label: 'UDL',
        tooltip: 'Apply uniform distributed load',
        icon: Minus,
        shortcut: 'U',
        category: 'LOADING'
    },
    ADD_TRAPEZOID: {
        id: 'ADD_TRAPEZOID',
        label: 'Varying Load',
        tooltip: 'Apply trapezoidal/varying load',
        icon: Triangle,
        category: 'LOADING'
    },
    ADD_WIND: {
        id: 'ADD_WIND',
        label: 'Wind Load',
        tooltip: 'Generate wind loads (IS 875-3)',
        icon: Wind,
        shortcut: 'W',
        category: 'LOADING'
    },
    ADD_SEISMIC: {
        id: 'ADD_SEISMIC',
        label: 'Seismic',
        tooltip: 'Generate seismic loads (IS 1893)',
        icon: Zap,
        category: 'LOADING'
    },
    ADD_PRETENSION: {
        id: 'ADD_PRETENSION',
        label: 'Pretension',
        tooltip: 'Apply cable pretension force',
        icon: Cable,
        category: 'LOADING'
    },
    ADD_TEMPERATURE: {
        id: 'ADD_TEMPERATURE',
        label: 'Temperature',
        tooltip: 'Apply temperature change (ΔT)',
        icon: Thermometer,
        shortcut: 'T',
        category: 'LOADING'
    },
    ADD_MOVING_LOAD: {
        id: 'ADD_MOVING_LOAD',
        label: 'Moving Load',
        tooltip: 'Apply IRC/AASHTO vehicle loads',
        icon: Milestone,
        category: 'LOADING'
    },
    ADD_HYDROSTATIC: {
        id: 'ADD_HYDROSTATIC',
        label: 'Hydrostatic',
        tooltip: 'Apply water pressure',
        icon: Waves,
        category: 'LOADING'
    },
    ADD_SELF_WEIGHT: {
        id: 'ADD_SELF_WEIGHT',
        label: 'Self Weight',
        tooltip: 'Apply automatic self-weight',
        icon: Weight,
        shortcut: 'G',
        category: 'LOADING'
    },
    LOAD_COMBINATIONS: {
        id: 'LOAD_COMBINATIONS',
        label: 'Combinations',
        tooltip: 'Define load combinations',
        icon: Layers,
        category: 'LOADING'
    },

    // ========== ANALYSIS TOOLS ==========
    RUN_ANALYSIS: {
        id: 'RUN_ANALYSIS',
        label: 'Run Analysis',
        tooltip: 'Execute structural analysis (F5)',
        icon: Play,
        shortcut: 'F5',
        category: 'ANALYSIS'
    },
    VIEW_DEFORMED: {
        id: 'VIEW_DEFORMED',
        label: 'Deformed Shape',
        tooltip: 'View displaced structure',
        icon: Eye,
        category: 'ANALYSIS'
    },
    VIEW_REACTIONS: {
        id: 'VIEW_REACTIONS',
        label: 'Reactions',
        tooltip: 'View support reactions',
        icon: ArrowDown,
        category: 'ANALYSIS'
    },
    VIEW_SFD: {
        id: 'VIEW_SFD',
        label: 'Shear Diagram',
        tooltip: 'View shear force diagram',
        icon: CornerUpRight,
        category: 'ANALYSIS'
    },
    VIEW_BMD: {
        id: 'VIEW_BMD',
        label: 'Bending Diagram',
        tooltip: 'View bending moment diagram',
        icon: Spline,
        category: 'ANALYSIS'
    },
    MODAL_ANALYSIS: {
        id: 'MODAL_ANALYSIS',
        label: 'Modal Analysis',
        tooltip: 'Calculate natural frequencies',
        icon: Zap,
        category: 'ANALYSIS'
    },

    // ========== DESIGN TOOLS ==========
    STEEL_CHECK: {
        id: 'STEEL_CHECK',
        label: 'Steel Design',
        tooltip: 'Check steel members (IS 800)',
        icon: Hammer,
        category: 'DESIGN'
    },
    CONCRETE_DESIGN: {
        id: 'CONCRETE_DESIGN',
        label: 'Concrete Design',
        tooltip: 'Design RCC sections (IS 456)',
        icon: Box,
        category: 'DESIGN'
    },
    GENERATE_REPORT: {
        id: 'GENERATE_REPORT',
        label: 'Generate Report',
        tooltip: 'Create PDF calculation report',
        icon: FileText,
        category: 'DESIGN'
    },

    // ========== NEW ANALYSIS TOOLS (STAAD.Pro parity) ==========
    PDELTA_ANALYSIS: {
        id: 'PDELTA_ANALYSIS',
        label: 'P-Delta',
        tooltip: 'P-Delta second-order geometric nonlinear analysis',
        icon: TrendingUp,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    BUCKLING_ANALYSIS: {
        id: 'BUCKLING_ANALYSIS',
        label: 'Buckling',
        tooltip: 'Linear buckling analysis — critical load factors',
        icon: Layers,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    TIME_HISTORY_ANALYSIS: {
        id: 'TIME_HISTORY_ANALYSIS',
        label: 'Time History',
        tooltip: 'Time-history dynamic analysis',
        icon: Activity,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    NONLINEAR_ANALYSIS: {
        id: 'NONLINEAR_ANALYSIS',
        label: 'Nonlinear',
        tooltip: 'Nonlinear static analysis',
        icon: Workflow,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    DYNAMICS_PANEL: {
        id: 'DYNAMICS_PANEL',
        label: 'Dynamics',
        tooltip: 'Dynamics analysis panel',
        icon: Waves,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    PLATE_STRESS_CONTOUR: {
        id: 'PLATE_STRESS_CONTOUR',
        label: 'Plate Stress',
        tooltip: 'Plate/shell stress contour visualization',
        icon: Grid,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    RESPONSE_SPECTRUM_ANALYSIS: {
        id: 'RESPONSE_SPECTRUM_ANALYSIS',
        label: 'Response Spectrum',
        tooltip: 'Response spectrum analysis (SRSS/CQC modal combination)',
        icon: BarChart2,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    PUSHOVER_ANALYSIS: {
        id: 'PUSHOVER_ANALYSIS',
        label: 'Pushover',
        tooltip: 'Nonlinear static pushover analysis',
        icon: TrendingUp,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    STEADY_STATE_ANALYSIS: {
        id: 'STEADY_STATE_ANALYSIS',
        label: 'Steady State',
        tooltip: 'Steady-state harmonic response analysis',
        icon: Radio,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    IMPERFECTION_ANALYSIS: {
        id: 'IMPERFECTION_ANALYSIS',
        label: 'Imperfection',
        tooltip: 'Direct analysis method with notional loads (AISC 360 Ch. C)',
        icon: AlertTriangle,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    VIEW_STORY_DRIFT: {
        id: 'VIEW_STORY_DRIFT',
        label: 'Story Drift',
        tooltip: 'View inter-story drift ratios',
        icon: Building,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    VIEW_FORCE_ENVELOPE: {
        id: 'VIEW_FORCE_ENVELOPE',
        label: 'Force Envelope',
        tooltip: 'View force envelopes across all load combinations',
        icon: BarChart,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    VIEW_SECTION_FORCES: {
        id: 'VIEW_SECTION_FORCES',
        label: 'Section Forces',
        tooltip: 'View internal forces at fractional positions along member',
        icon: Scissors,
        category: 'ANALYSIS',
        group: 'analysis'
    },
    ANIMATE_MODE_SHAPE: {
        id: 'ANIMATE_MODE_SHAPE',
        label: 'Mode Shape',
        tooltip: 'Animate mode shapes from modal analysis',
        icon: Play,
        category: 'ANALYSIS',
        group: 'analysis'
    },

    // ========== NEW PROPERTIES TOOLS (STAAD.Pro parity) ==========
    ASSIGN_PARTIAL_RELEASE: {
        id: 'ASSIGN_PARTIAL_RELEASE',
        label: 'Partial Release',
        tooltip: 'Assign partial moment releases to member ends',
        icon: Sliders,
        category: 'PROPERTIES'
    },
    ASSIGN_TENSION_ONLY: {
        id: 'ASSIGN_TENSION_ONLY',
        label: 'Tension Only',
        tooltip: 'Mark members as tension-only (bracing)',
        icon: ArrowUp,
        category: 'PROPERTIES'
    },
    ASSIGN_COMPRESSION_ONLY: {
        id: 'ASSIGN_COMPRESSION_ONLY',
        label: 'Compression Only',
        tooltip: 'Mark members as compression-only (struts)',
        icon: ArrowDown,
        category: 'PROPERTIES'
    },
    ASSIGN_INACTIVE: {
        id: 'ASSIGN_INACTIVE',
        label: 'Inactive',
        tooltip: 'Mark members as inactive for selected load cases',
        icon: EyeOff,
        category: 'PROPERTIES'
    },
    ASSIGN_DIAPHRAGM: {
        id: 'ASSIGN_DIAPHRAGM',
        label: 'Diaphragm',
        tooltip: 'Assign rigid/semi-rigid/flexible diaphragm to floor nodes',
        icon: LayoutGrid,
        category: 'PROPERTIES'
    },
    ASSIGN_MASTER_SLAVE: {
        id: 'ASSIGN_MASTER_SLAVE',
        label: 'Master/Slave',
        tooltip: 'Define master/slave joint constraints',
        icon: Link2,
        category: 'PROPERTIES'
    },
    ASSIGN_PROPERTY_REDUCTION: {
        id: 'ASSIGN_PROPERTY_REDUCTION',
        label: 'Prop. Reduction',
        tooltip: 'Apply property reduction factors (cracked section)',
        icon: Percent,
        category: 'PROPERTIES'
    },

    // ========== NEW LOADING TOOLS (STAAD.Pro parity) ==========
    ADD_FLOOR_LOAD: {
        id: 'ADD_FLOOR_LOAD',
        label: 'Floor Load',
        tooltip: 'Generate floor loads using two-way yield-line distribution',
        icon: Layers,
        category: 'LOADING'
    },
    ADD_AREA_LOAD: {
        id: 'ADD_AREA_LOAD',
        label: 'Area Load',
        tooltip: 'Generate one-way tributary area loads on beams',
        icon: Square,
        category: 'LOADING'
    },
    ADD_SNOW_LOAD: {
        id: 'ADD_SNOW_LOAD',
        label: 'Snow Load',
        tooltip: 'Generate snow loads per ASCE 7 or IS 875 Part 4',
        icon: Snowflake,
        category: 'LOADING'
    },
};

// ============================================
// KEYBOARD SHORTCUTS MAP
// ============================================

export const KEYBOARD_SHORTCUTS: Record<string, string> = {
    'Escape': 'SELECT',
    'n': 'DRAW_NODE',
    'b': 'DRAW_BEAM',
    'c': 'DRAW_CABLE',
    'v': 'DRAW_COLUMN',
    'a': 'DRAW_ARCH',
    'p': 'DRAW_PLATE',
    'm': 'MOVE',
    'r': 'ROTATE',
    's': 'SCALE',
    'o': 'OFFSET_MEMBER',
    'e': 'EXTRUDE',
    'd': 'DELETE',
    'z': 'ZOOM_WINDOW',
    'f': 'ADD_POINT_LOAD',
    'u': 'ADD_UDL',
    'w': 'ADD_WIND',
    't': 'ADD_TEMPERATURE',
    'g': 'ADD_SELF_WEIGHT',
    'q': 'MEMBER_QUERY',
    'l': 'SHOW_LABELS',
    '1': 'VIEW_FRONT',
    '2': 'VIEW_TOP',
    '3': 'VIEW_RIGHT',
    '0': 'VIEW_ISO',
    'F5': 'RUN_ANALYSIS',
    'Delete': 'DELETE',
    'Backspace': 'DELETE'
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get tool definition by ID
 */
export function getToolDefinition(toolId: string): ToolDefinition | undefined {
    return TOOL_DEFINITIONS[toolId];
}

/**
 * Get tools for a specific group
 */
export function getGroupTools(groupId: string): ToolDefinition[] {
    const group = MODELING_TOOL_GROUPS.find(g => g.id === groupId);
    if (!group) return [];
    return group.tools
        .map(id => TOOL_DEFINITIONS[id])
        .filter((t): t is ToolDefinition => t !== undefined);
}

/**
 * Get tool by keyboard shortcut
 */
export function getToolByShortcut(key: string): string | undefined {
    return KEYBOARD_SHORTCUTS[key];
}

/**
 * Get all generator tools
 */
export function getGeneratorTools(): ToolDefinition[] {
    return Object.values(TOOL_DEFINITIONS).filter(t => t.isGenerator);
}

/**
 * Get all view/display tools
 */
export function getViewTools(): ToolDefinition[] {
    return Object.values(TOOL_DEFINITIONS).filter(t => t.category === 'VIEW');
}

/**
 * Get all snap tools
 */
export function getSnapTools(): ToolDefinition[] {
    return Object.values(TOOL_DEFINITIONS).filter(t => t.category === 'SNAP');
}

/**
 * View groups for quick access
 */
export const VIEW_TOOL_GROUPS: ToolGroup[] = [
    {
        id: 'camera',
        label: 'Camera',
        icon: Eye,
        tools: ['VIEW_FRONT', 'VIEW_TOP', 'VIEW_RIGHT', 'VIEW_ISO', 'VIEW_FIT', 'VIEW_PREVIOUS']
    },
    {
        id: 'rendering',
        label: 'Render',
        icon: Paintbrush,
        tools: ['RENDER_WIREFRAME', 'RENDER_SOLID', 'RENDER_ANALYTICAL']
    },
    {
        id: 'display',
        label: 'Display',
        icon: Eye,
        tools: ['SHOW_LABELS', 'SHOW_LOADS', 'SHOW_SUPPORTS', 'SHOW_MEMBER_NUMBERS', 'SHOW_NODE_NUMBERS', 'SHOW_DIMENSIONS']
    }
];

export default TOOL_DEFINITIONS;
