/**
 * Custom Node Types for Visual Scripting
 * 
 * Shared types and utilities for parametric modeling nodes.
 */

// ============================================
// NODE DATA TYPES
// ============================================

export interface BaseNodeData {
    label: string;
    value?: any;
    onChange?: (value: any) => void;
}

export interface NumberInputData extends BaseNodeData {
    value: number;
    min?: number;
    max?: number;
    step?: number;
}

export interface PointData {
    x: number;
    y: number;
    z: number;
}

export interface PointGeneratorData extends BaseNodeData {
    point: PointData;
    count?: number;
    spacing?: number;
    direction?: 'x' | 'y' | 'z';
}

export interface LineConnectorData extends BaseNodeData {
    startPoint?: PointData;
    endPoint?: PointData;
    divisions?: number;
}

export interface FrameRepeaterData extends BaseNodeData {
    basePoints: PointData[];
    repeatCount: number;
    spacing: number;
    direction: 'x' | 'y' | 'z';
}

// ============================================
// OUTPUT TYPES (for model store)
// ============================================

export interface GeneratedNode {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        fx: boolean;
        fy: boolean;
        fz: boolean;
        mx: boolean;
        my: boolean;
        mz: boolean;
    };
}

export interface GeneratedMember {
    id: string;
    startNodeId: string;
    endNodeId: string;
    sectionId?: string;
}

export interface GeneratedModel {
    nodes: GeneratedNode[];
    members: GeneratedMember[];
}

// ============================================
// NODE CATEGORIES
// ============================================

export type NodeCategory = 'input' | 'geometry' | 'transform' | 'output';

export interface NodeDefinition {
    type: string;
    label: string;
    category: NodeCategory;
    inputs: string[];
    outputs: string[];
    defaultData: any;
}

export const NODE_DEFINITIONS: Record<string, NodeDefinition> = {
    numberInput: {
        type: 'numberInput',
        label: 'Number',
        category: 'input',
        inputs: [],
        outputs: ['value'],
        defaultData: { value: 0, min: -1000, max: 1000, step: 0.1 }
    },
    pointGenerator: {
        type: 'pointGenerator',
        label: 'Point',
        category: 'geometry',
        inputs: ['x', 'y', 'z'],
        outputs: ['point'],
        defaultData: { point: { x: 0, y: 0, z: 0 } }
    },
    pointArray: {
        type: 'pointArray',
        label: 'Point Array',
        category: 'geometry',
        inputs: ['start', 'count', 'spacing', 'direction'],
        outputs: ['points'],
        defaultData: { count: 5, spacing: 1, direction: 'x' }
    },
    lineConnector: {
        type: 'lineConnector',
        label: 'Line',
        category: 'geometry',
        inputs: ['start', 'end', 'divisions'],
        outputs: ['points', 'lines'],
        defaultData: { divisions: 1 }
    },
    frameRepeater: {
        type: 'frameRepeater',
        label: 'Frame Repeater',
        category: 'transform',
        inputs: ['points', 'count', 'spacing', 'direction'],
        outputs: ['nodes', 'members'],
        defaultData: { repeatCount: 3, spacing: 4, direction: 'x' }
    },
    gridGenerator: {
        type: 'gridGenerator',
        label: 'Grid',
        category: 'geometry',
        inputs: ['xCount', 'yCount', 'xSpacing', 'ySpacing'],
        outputs: ['points'],
        defaultData: { xCount: 4, yCount: 3, xSpacing: 6, ySpacing: 4 }
    },
    modelOutput: {
        type: 'modelOutput',
        label: 'Model Output',
        category: 'output',
        inputs: ['nodes', 'members'],
        outputs: [],
        defaultData: {}
    }
};

// ============================================
// HANDLE STYLES
// ============================================

export const HANDLE_STYLES = {
    input: {
        background: '#3B82F6',
        width: 12,
        height: 12,
        border: '2px solid white',
        borderRadius: '50%'
    },
    output: {
        background: '#22C55E',
        width: 12,
        height: 12,
        border: '2px solid white',
        borderRadius: '50%'
    }
};

export const NODE_COLORS: Record<NodeCategory, string> = {
    input: '#3B82F6',    // Blue
    geometry: '#8B5CF6', // Purple
    transform: '#F59E0B', // Orange
    output: '#22C55E'    // Green
};
