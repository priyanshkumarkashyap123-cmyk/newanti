/**
 * ParametricModelingEngine.ts
 * 
 * Advanced parametric/generative structural design system:
 * 1. Parameter-driven geometry generation
 * 2. Constraint-based modeling
 * 3. Design space exploration
 * 4. Grasshopper-like visual programming
 * 5. Real-time model updates
 * 6. Optimization integration
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export type ParameterType = 'number' | 'integer' | 'boolean' | 'string' | 'enum' | 'point' | 'vector' | 'curve';

export interface Parameter {
  id: string;
  name: string;
  type: ParameterType;
  value: ParameterValue;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  unit?: string;
  description?: string;
  group?: string;
  visible?: boolean;
  locked?: boolean;
}

export interface ParameterGroup {
  id: string;
  name: string;
  parameters: Parameter[];
  collapsed?: boolean;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/** Union of all parameter value types used in parametric nodes */
export type ParameterValue = number | string | boolean | Point3D | Vector3D | string[];

/** A line segment between two 3D points */
export interface StructuralLine {
  start: Point3D;
  end: Point3D;
}

/** A structural member with endpoints, section, and type */
export interface StructuralMember {
  start: Point3D;
  end: Point3D;
  section: string;
  type: string;
}

/** A structural support with node, type, and restraints */
export interface StructuralSupport {
  node: Point3D;
  type: string;
  restraints: boolean[];
}

/** Complete structural model generated from parametric graph */
export interface StructuralModel {
  nodes: Point3D[];
  members: StructuralMember[];
  supports: StructuralSupport[];
  loads: Record<string, unknown>[];
}

export interface ParametricNode {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  inputs: NodeInput[];
  outputs: NodeOutput[];
  parameters: Parameter[];
  error?: string;
  cached?: boolean;
}

export interface NodeInput {
  id: string;
  name: string;
  type: string;
  required: boolean;
  multi?: boolean;
  connected?: string; // Output ID
  defaultValue?: unknown;
}

export interface NodeOutput {
  id: string;
  name: string;
  type: string;
  value?: unknown;
  connections: string[]; // Input IDs
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  sourceOutputId: string;
  targetNodeId: string;
  targetInputId: string;
}

export interface ParametricGraph {
  id: string;
  name: string;
  nodes: Map<string, ParametricNode>;
  connections: Connection[];
  parameters: ParameterGroup[];
  metadata: {
    author?: string;
    created: Date;
    modified: Date;
    version: string;
  };
}

// ============================================
// CORE NODE TYPES
// ============================================

/**
 * Base class for all parametric nodes
 */
abstract class BaseNode {
  abstract readonly type: string;
  abstract readonly category: string;
  abstract readonly inputDefs: Omit<NodeInput, 'connected'>[];
  abstract readonly outputDefs: Omit<NodeOutput, 'value' | 'connections'>[];
  
  abstract compute(inputs: Record<string, any>): Record<string, any>;
  
  createNode(id: string, position: { x: number; y: number }): ParametricNode {
    return {
      id,
      type: this.type,
      name: this.type.replace(/_/g, ' '),
      position,
      inputs: this.inputDefs.map(def => ({ ...def, connected: undefined })),
      outputs: this.outputDefs.map(def => ({ ...def, value: undefined, connections: [] })),
      parameters: [],
    };
  }
}

// ============================================
// GEOMETRY NODES
// ============================================

class PointNode extends BaseNode {
  type = 'Point';
  category = 'Geometry';
  inputDefs: Omit<NodeInput, 'connected'>[] = [
    { id: 'x', name: 'X', type: 'number', required: false, defaultValue: 0 },
    { id: 'y', name: 'Y', type: 'number', required: false, defaultValue: 0 },
    { id: 'z', name: 'Z', type: 'number', required: false, defaultValue: 0 },
  ];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'point', name: 'Point', type: 'point' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    return {
      point: {
        x: inputs.x ?? 0,
        y: inputs.y ?? 0,
        z: inputs.z ?? 0,
      } as Point3D,
    };
  }
}

class LineNode extends BaseNode {
  type = 'Line';
  category = 'Geometry';
  inputDefs: Omit<NodeInput, 'connected'>[] = [
    { id: 'start', name: 'Start', type: 'point', required: true },
    { id: 'end', name: 'End', type: 'point', required: true },
  ];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'line', name: 'Line', type: 'line' },
    { id: 'length', name: 'Length', type: 'number' },
    { id: 'midpoint', name: 'Midpoint', type: 'point' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    const start = inputs.start as Point3D;
    const end = inputs.end as Point3D;
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    return {
      line: { start, end },
      length,
      midpoint: {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
        z: (start.z + end.z) / 2,
      },
    };
  }
}

class GridNode extends BaseNode {
  type = 'Grid';
  category = 'Geometry';
  inputDefs: Omit<NodeInput, 'connected'>[] = [
    { id: 'origin', name: 'Origin', type: 'point', required: false, defaultValue: { x: 0, y: 0, z: 0 } },
    { id: 'countX', name: 'Count X', type: 'integer', required: false, defaultValue: 3 },
    { id: 'countY', name: 'Count Y', type: 'integer', required: false, defaultValue: 3 },
    { id: 'spacingX', name: 'Spacing X', type: 'number', required: false, defaultValue: 5 },
    { id: 'spacingY', name: 'Spacing Y', type: 'number', required: false, defaultValue: 5 },
  ];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'points', name: 'Points', type: 'point[]' },
    { id: 'lines_x', name: 'Lines X', type: 'line[]' },
    { id: 'lines_y', name: 'Lines Y', type: 'line[]' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    const origin = inputs.origin ?? { x: 0, y: 0, z: 0 };
    const countX = inputs.countX ?? 3;
    const countY = inputs.countY ?? 3;
    const spacingX = inputs.spacingX ?? 5;
    const spacingY = inputs.spacingY ?? 5;
    
    const points: Point3D[] = [];
    const linesX: StructuralLine[] = [];
    const linesY: StructuralLine[] = [];
    
    // Generate grid points
    for (let i = 0; i < countX; i++) {
      for (let j = 0; j < countY; j++) {
        points.push({
          x: origin.x + i * spacingX,
          y: origin.y + j * spacingY,
          z: origin.z,
        });
      }
    }
    
    // Generate X lines
    for (let j = 0; j < countY; j++) {
      linesX.push({
        start: { x: origin.x, y: origin.y + j * spacingY, z: origin.z },
        end: { x: origin.x + (countX - 1) * spacingX, y: origin.y + j * spacingY, z: origin.z },
      });
    }
    
    // Generate Y lines
    for (let i = 0; i < countX; i++) {
      linesY.push({
        start: { x: origin.x + i * spacingX, y: origin.y, z: origin.z },
        end: { x: origin.x + i * spacingX, y: origin.y + (countY - 1) * spacingY, z: origin.z },
      });
    }
    
    return { points, lines_x: linesX, lines_y: linesY };
  }
}

class ExtrudeNode extends BaseNode {
  type = 'Extrude';
  category = 'Geometry';
  inputDefs: Omit<NodeInput, 'connected'>[] = [
    { id: 'curve', name: 'Curve', type: 'curve', required: true },
    { id: 'direction', name: 'Direction', type: 'vector', required: false, defaultValue: { x: 0, y: 0, z: 1 } },
    { id: 'distance', name: 'Distance', type: 'number', required: false, defaultValue: 1 },
  ];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'surface', name: 'Surface', type: 'surface' },
    { id: 'edges', name: 'Edges', type: 'line[]' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    // Simplified extrusion
    return {
      surface: { base: inputs.curve, direction: inputs.direction, distance: inputs.distance },
      edges: [],
    };
  }
}

// ============================================
// STRUCTURE GENERATION NODES
// ============================================

class ColumnGridNode extends BaseNode {
  type = 'ColumnGrid';
  category = 'Structure';
  inputDefs: Omit<NodeInput, 'connected'>[] = [
    { id: 'basePoints', name: 'Base Points', type: 'point[]', required: true },
    { id: 'height', name: 'Height', type: 'number', required: false, defaultValue: 3.5 },
    { id: 'stories', name: 'Stories', type: 'integer', required: false, defaultValue: 1 },
    { id: 'section', name: 'Section', type: 'string', required: false, defaultValue: 'W14x30' },
  ];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'columns', name: 'Columns', type: 'member[]' },
    { id: 'nodes', name: 'Nodes', type: 'node[]' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    const basePoints = inputs.basePoints as Point3D[] ?? [];
    const height = inputs.height ?? 3.5;
    const stories = inputs.stories ?? 1;
    const section = inputs.section ?? 'W14x30';
    
    const columns: StructuralMember[] = [];
    const nodes: Point3D[] = [];
    
    for (const base of basePoints) {
      for (let s = 0; s < stories; s++) {
        const startZ = base.z + s * height;
        const endZ = startZ + height;
        
        const startNode = { x: base.x, y: base.y, z: startZ };
        const endNode = { x: base.x, y: base.y, z: endZ };
        
        nodes.push(startNode, endNode);
        
        columns.push({
          start: startNode,
          end: endNode,
          section,
          type: 'column',
        });
      }
    }
    
    return { columns, nodes };
  }
}

class BeamGridNode extends BaseNode {
  type = 'BeamGrid';
  category = 'Structure';
  inputDefs: Omit<NodeInput, 'connected'>[] = [
    { id: 'nodes', name: 'Nodes', type: 'point[]', required: true },
    { id: 'level', name: 'Level', type: 'number', required: true },
    { id: 'tolerance', name: 'Tolerance', type: 'number', required: false, defaultValue: 0.01 },
    { id: 'section', name: 'Section', type: 'string', required: false, defaultValue: 'W18x50' },
    { id: 'maxSpan', name: 'Max Span', type: 'number', required: false, defaultValue: 15 },
  ];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'beams', name: 'Beams', type: 'member[]' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    const nodes = inputs.nodes as Point3D[] ?? [];
    const level = inputs.level;
    const tolerance = inputs.tolerance ?? 0.01;
    const section = inputs.section ?? 'W18x50';
    const maxSpan = inputs.maxSpan ?? 15;
    
    // Filter nodes at specified level
    const levelNodes = nodes.filter(n => Math.abs(n.z - level) < tolerance);
    
    // Generate beams between adjacent nodes
    const beams: StructuralMember[] = [];
    
    // Sort by X then Y
    levelNodes.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    
    // Connect X-direction beams
    for (let i = 0; i < levelNodes.length - 1; i++) {
      const a = levelNodes[i];
      const b = levelNodes[i + 1];
      
      if (Math.abs(a.y - b.y) < tolerance) {
        const dist = Math.abs(b.x - a.x);
        if (dist <= maxSpan) {
          beams.push({
            start: a,
            end: b,
            section,
            type: 'beam',
          });
        }
      }
    }
    
    // Sort by Y then X for Y-direction beams
    levelNodes.sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);
    
    for (let i = 0; i < levelNodes.length - 1; i++) {
      const a = levelNodes[i];
      const b = levelNodes[i + 1];
      
      if (Math.abs(a.x - b.x) < tolerance) {
        const dist = Math.abs(b.y - a.y);
        if (dist <= maxSpan) {
          beams.push({
            start: a,
            end: b,
            section,
            type: 'beam',
          });
        }
      }
    }
    
    return { beams };
  }
}

class TrussGeneratorNode extends BaseNode {
  type = 'TrussGenerator';
  category = 'Structure';
  inputDefs: Omit<NodeInput, 'connected'>[] = [
    { id: 'span', name: 'Span', type: 'number', required: false, defaultValue: 20 },
    { id: 'height', name: 'Height', type: 'number', required: false, defaultValue: 3 },
    { id: 'panels', name: 'Panels', type: 'integer', required: false, defaultValue: 8 },
    { id: 'type', name: 'Type', type: 'string', required: false, defaultValue: 'warren' },
    { id: 'origin', name: 'Origin', type: 'point', required: false, defaultValue: { x: 0, y: 0, z: 0 } },
    { id: 'chordSection', name: 'Chord Section', type: 'string', required: false, defaultValue: 'L6x6x1/2' },
    { id: 'webSection', name: 'Web Section', type: 'string', required: false, defaultValue: 'L4x4x1/2' },
  ];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'members', name: 'Members', type: 'member[]' },
    { id: 'nodes', name: 'Nodes', type: 'node[]' },
    { id: 'supports', name: 'Supports', type: 'support[]' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    const span = inputs.span ?? 20;
    const height = inputs.height ?? 3;
    const panels = inputs.panels ?? 8;
    const type = inputs.type ?? 'warren';
    const origin = inputs.origin ?? { x: 0, y: 0, z: 0 };
    const chordSection = inputs.chordSection ?? 'L6x6x1/2';
    const webSection = inputs.webSection ?? 'L4x4x1/2';
    
    const panelWidth = span / panels;
    const nodes: Point3D[] = [];
    const members: StructuralMember[] = [];
    const supports: StructuralSupport[] = [];
    
    // Bottom chord nodes
    for (let i = 0; i <= panels; i++) {
      nodes.push({
        x: origin.x + i * panelWidth,
        y: origin.y,
        z: origin.z,
      });
    }
    
    if (type === 'warren') {
      // Top chord nodes (offset by half panel)
      for (let i = 0; i < panels; i++) {
        nodes.push({
          x: origin.x + (i + 0.5) * panelWidth,
          y: origin.y + height,
          z: origin.z,
        });
      }
      
      // Bottom chord members
      for (let i = 0; i < panels; i++) {
        members.push({
          start: nodes[i],
          end: nodes[i + 1],
          section: chordSection,
          type: 'truss',
        });
      }
      
      // Top chord members
      const topStartIdx = panels + 1;
      for (let i = 0; i < panels - 1; i++) {
        members.push({
          start: nodes[topStartIdx + i],
          end: nodes[topStartIdx + i + 1],
          section: chordSection,
          type: 'truss',
        });
      }
      
      // Web members (diagonals)
      for (let i = 0; i < panels; i++) {
        // Rising diagonal
        members.push({
          start: nodes[i],
          end: nodes[topStartIdx + i],
          section: webSection,
          type: 'truss',
        });
        // Falling diagonal
        members.push({
          start: nodes[topStartIdx + i],
          end: nodes[i + 1],
          section: webSection,
          type: 'truss',
        });
      }
    } else if (type === 'pratt') {
      // Top chord nodes (aligned with bottom)
      for (let i = 0; i <= panels; i++) {
        nodes.push({
          x: origin.x + i * panelWidth,
          y: origin.y + height,
          z: origin.z,
        });
      }
      
      // Chords
      for (let i = 0; i < panels; i++) {
        members.push({
          start: nodes[i],
          end: nodes[i + 1],
          section: chordSection,
          type: 'truss',
        });
        members.push({
          start: nodes[panels + 1 + i],
          end: nodes[panels + 2 + i],
          section: chordSection,
          type: 'truss',
        });
      }
      
      // Verticals and diagonals
      for (let i = 0; i <= panels; i++) {
        // Vertical
        members.push({
          start: nodes[i],
          end: nodes[panels + 1 + i],
          section: webSection,
          type: 'truss',
        });
        
        // Diagonal (Pratt pattern)
        if (i < panels / 2) {
          members.push({
            start: nodes[i],
            end: nodes[panels + 2 + i],
            section: webSection,
            type: 'truss',
          });
        } else if (i > panels / 2 && i < panels) {
          members.push({
            start: nodes[i + 1],
            end: nodes[panels + 1 + i],
            section: webSection,
            type: 'truss',
          });
        }
      }
    }
    
    // Supports
    supports.push({
      node: nodes[0],
      type: 'pinned',
      restraints: [true, true, true, false, false, false],
    });
    supports.push({
      node: nodes[panels],
      type: 'roller',
      restraints: [false, true, true, false, false, false],
    });
    
    return { members, nodes, supports };
  }
}

class FrameGeneratorNode extends BaseNode {
  type = 'FrameGenerator';
  category = 'Structure';
  inputDefs: Omit<NodeInput, 'connected'>[] = [
    { id: 'baysX', name: 'Bays X', type: 'integer', required: false, defaultValue: 3 },
    { id: 'baysY', name: 'Bays Y', type: 'integer', required: false, defaultValue: 2 },
    { id: 'stories', name: 'Stories', type: 'integer', required: false, defaultValue: 5 },
    { id: 'bayWidthX', name: 'Bay Width X', type: 'number', required: false, defaultValue: 8 },
    { id: 'bayWidthY', name: 'Bay Width Y', type: 'number', required: false, defaultValue: 6 },
    { id: 'storyHeight', name: 'Story Height', type: 'number', required: false, defaultValue: 3.5 },
    { id: 'columnSection', name: 'Column Section', type: 'string', required: false, defaultValue: 'W14x30' },
    { id: 'beamSectionX', name: 'Beam Section X', type: 'string', required: false, defaultValue: 'W18x50' },
    { id: 'beamSectionY', name: 'Beam Section Y', type: 'string', required: false, defaultValue: 'W16x40' },
    { id: 'includeBracing', name: 'Include Bracing', type: 'boolean', required: false, defaultValue: false },
  ];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'members', name: 'Members', type: 'member[]' },
    { id: 'nodes', name: 'Nodes', type: 'node[]' },
    { id: 'supports', name: 'Supports', type: 'support[]' },
    { id: 'levels', name: 'Level Heights', type: 'number[]' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    const baysX = inputs.baysX ?? 3;
    const baysY = inputs.baysY ?? 2;
    const stories = inputs.stories ?? 5;
    const bayWidthX = inputs.bayWidthX ?? 8;
    const bayWidthY = inputs.bayWidthY ?? 6;
    const storyHeight = inputs.storyHeight ?? 3.5;
    const columnSection = inputs.columnSection ?? 'W14x30';
    const beamSectionX = inputs.beamSectionX ?? 'W18x50';
    const beamSectionY = inputs.beamSectionY ?? 'W16x40';
    const includeBracing = inputs.includeBracing ?? false;
    
    const nodes: Point3D[] = [];
    const members: StructuralMember[] = [];
    const supports: StructuralSupport[] = [];
    const levels: number[] = [];
    
    // Create node grid
    const nodeGrid: number[][][] = []; // [z][y][x] -> node index
    
    for (let z = 0; z <= stories; z++) {
      nodeGrid[z] = [];
      levels.push(z * storyHeight);
      
      for (let y = 0; y <= baysY; y++) {
        nodeGrid[z][y] = [];
        for (let x = 0; x <= baysX; x++) {
          const nodeIdx = nodes.length;
          nodeGrid[z][y][x] = nodeIdx;
          
          nodes.push({
            x: x * bayWidthX,
            y: y * bayWidthY,
            z: z * storyHeight,
          });
          
          // Add support at ground level
          if (z === 0) {
            supports.push({
              node: nodes[nodeIdx],
              type: 'fixed',
              restraints: [true, true, true, true, true, true],
            });
          }
        }
      }
    }
    
    // Create columns
    for (let z = 0; z < stories; z++) {
      for (let y = 0; y <= baysY; y++) {
        for (let x = 0; x <= baysX; x++) {
          members.push({
            start: nodes[nodeGrid[z][y][x]],
            end: nodes[nodeGrid[z + 1][y][x]],
            section: columnSection,
            type: 'column',
          });
        }
      }
    }
    
    // Create beams
    for (let z = 1; z <= stories; z++) {
      // X-direction beams
      for (let y = 0; y <= baysY; y++) {
        for (let x = 0; x < baysX; x++) {
          members.push({
            start: nodes[nodeGrid[z][y][x]],
            end: nodes[nodeGrid[z][y][x + 1]],
            section: beamSectionX,
            type: 'beam',
          });
        }
      }
      
      // Y-direction beams
      for (let y = 0; y < baysY; y++) {
        for (let x = 0; x <= baysX; x++) {
          members.push({
            start: nodes[nodeGrid[z][y][x]],
            end: nodes[nodeGrid[z][y + 1][x]],
            section: beamSectionY,
            type: 'beam',
          });
        }
      }
    }
    
    // Add bracing if requested
    if (includeBracing) {
      // Add X-bracing on perimeter frames
      for (let z = 0; z < stories; z++) {
        // Front and back faces (y = 0 and y = baysY)
        for (const y of [0, baysY]) {
          for (let x = 0; x < baysX; x += 2) {
            members.push({
              start: nodes[nodeGrid[z][y][x]],
              end: nodes[nodeGrid[z + 1][y][x + 1]],
              section: 'L4x4x1/2',
              type: 'brace',
            });
            members.push({
              start: nodes[nodeGrid[z][y][x + 1]],
              end: nodes[nodeGrid[z + 1][y][x]],
              section: 'L4x4x1/2',
              type: 'brace',
            });
          }
        }
        
        // Side faces (x = 0 and x = baysX)
        for (const x of [0, baysX]) {
          for (let y = 0; y < baysY; y += 2) {
            members.push({
              start: nodes[nodeGrid[z][y][x]],
              end: nodes[nodeGrid[z + 1][y + 1][x]],
              section: 'L4x4x1/2',
              type: 'brace',
            });
            members.push({
              start: nodes[nodeGrid[z][y + 1][x]],
              end: nodes[nodeGrid[z + 1][y][x]],
              section: 'L4x4x1/2',
              type: 'brace',
            });
          }
        }
      }
    }
    
    return { members, nodes, supports, levels };
  }
}

// ============================================
// MATH NODES
// ============================================

class NumberNode extends BaseNode {
  type = 'Number';
  category = 'Math';
  inputDefs: Omit<NodeInput, 'connected'>[] = [];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'value', name: 'Value', type: 'number' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    return { value: 0 }; // Override with parameter
  }
}

class MathOperationNode extends BaseNode {
  type = 'MathOperation';
  category = 'Math';
  inputDefs: Omit<NodeInput, 'connected'>[] = [
    { id: 'a', name: 'A', type: 'number', required: true },
    { id: 'b', name: 'B', type: 'number', required: true },
    { id: 'operation', name: 'Operation', type: 'string', required: false, defaultValue: 'add' },
  ];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'result', name: 'Result', type: 'number' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    const a = inputs.a ?? 0;
    const b = inputs.b ?? 0;
    const op = inputs.operation ?? 'add';
    
    let result: number;
    switch (op) {
      case 'add': result = a + b; break;
      case 'subtract': result = a - b; break;
      case 'multiply': result = a * b; break;
      case 'divide': result = b !== 0 ? a / b : 0; break;
      case 'power': result = Math.pow(a, b); break;
      case 'modulo': result = a % b; break;
      case 'min': result = Math.min(a, b); break;
      case 'max': result = Math.max(a, b); break;
      default: result = a + b;
    }
    
    return { result };
  }
}

class RangeNode extends BaseNode {
  type = 'Range';
  category = 'Math';
  inputDefs: Omit<NodeInput, 'connected'>[] = [
    { id: 'start', name: 'Start', type: 'number', required: false, defaultValue: 0 },
    { id: 'end', name: 'End', type: 'number', required: false, defaultValue: 10 },
    { id: 'count', name: 'Count', type: 'integer', required: false, defaultValue: 11 },
  ];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'values', name: 'Values', type: 'number[]' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    const start = inputs.start ?? 0;
    const end = inputs.end ?? 10;
    const count = inputs.count ?? 11;
    
    const values: number[] = [];
    const step = (end - start) / (count - 1);
    
    for (let i = 0; i < count; i++) {
      values.push(start + i * step);
    }
    
    return { values };
  }
}

// ============================================
// LOAD NODES
// ============================================

class PointLoadNode extends BaseNode {
  type = 'PointLoad';
  category = 'Loads';
  inputDefs: Omit<NodeInput, 'connected'>[] = [
    { id: 'node', name: 'Node', type: 'point', required: true },
    { id: 'fx', name: 'Fx', type: 'number', required: false, defaultValue: 0 },
    { id: 'fy', name: 'Fy', type: 'number', required: false, defaultValue: 0 },
    { id: 'fz', name: 'Fz', type: 'number', required: false, defaultValue: -10 },
    { id: 'loadCase', name: 'Load Case', type: 'string', required: false, defaultValue: 'Dead' },
  ];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'load', name: 'Load', type: 'load' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    return {
      load: {
        type: 'point',
        node: inputs.node,
        forces: [inputs.fx ?? 0, inputs.fy ?? 0, inputs.fz ?? -10],
        loadCase: inputs.loadCase ?? 'Dead',
      },
    };
  }
}

class DistributedLoadNode extends BaseNode {
  type = 'DistributedLoad';
  category = 'Loads';
  inputDefs: Omit<NodeInput, 'connected'>[] = [
    { id: 'member', name: 'Member', type: 'member', required: true },
    { id: 'w', name: 'Load Intensity', type: 'number', required: false, defaultValue: -10 },
    { id: 'direction', name: 'Direction', type: 'string', required: false, defaultValue: 'global_z' },
    { id: 'loadCase', name: 'Load Case', type: 'string', required: false, defaultValue: 'Dead' },
  ];
  outputDefs: Omit<NodeOutput, 'value' | 'connections'>[] = [
    { id: 'load', name: 'Load', type: 'load' },
  ];
  
  compute(inputs: Record<string, any>): Record<string, any> {
    return {
      load: {
        type: 'distributed',
        member: inputs.member,
        intensity: inputs.w ?? -10,
        direction: inputs.direction ?? 'global_z',
        loadCase: inputs.loadCase ?? 'Dead',
      },
    };
  }
}

// ============================================
// PARAMETRIC ENGINE
// ============================================

export class ParametricModelingEngine {
  private graph: ParametricGraph;
  private nodeTypes: Map<string, BaseNode>;
  private computeOrder: string[];
  private cache: Map<string, Record<string, unknown>>;
  
  constructor() {
    this.graph = {
      id: `graph-${Date.now()}`,
      name: 'New Parametric Model',
      nodes: new Map(),
      connections: [],
      parameters: [],
      metadata: {
        created: new Date(),
        modified: new Date(),
        version: '1.0.0',
      },
    };
    
    this.nodeTypes = new Map();
    this.computeOrder = [];
    this.cache = new Map();
    
    // Register built-in node types
    this.registerNodeType(new PointNode());
    this.registerNodeType(new LineNode());
    this.registerNodeType(new GridNode());
    this.registerNodeType(new ExtrudeNode());
    this.registerNodeType(new ColumnGridNode());
    this.registerNodeType(new BeamGridNode());
    this.registerNodeType(new TrussGeneratorNode());
    this.registerNodeType(new FrameGeneratorNode());
    this.registerNodeType(new NumberNode());
    this.registerNodeType(new MathOperationNode());
    this.registerNodeType(new RangeNode());
    this.registerNodeType(new PointLoadNode());
    this.registerNodeType(new DistributedLoadNode());
  }
  
  /**
   * Register a custom node type
   */
  registerNodeType(node: BaseNode): void {
    this.nodeTypes.set(node.type, node);
  }
  
  /**
   * Get available node types
   */
  getNodeTypes(): { type: string; category: string }[] {
    return Array.from(this.nodeTypes.values()).map(n => ({
      type: n.type,
      category: n.category,
    }));
  }
  
  /**
   * Add a node to the graph
   */
  addNode(type: string, position: { x: number; y: number }): ParametricNode | null {
    const nodeType = this.nodeTypes.get(type);
    if (!nodeType) return null;
    
    const id = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const node = nodeType.createNode(id, position);
    
    this.graph.nodes.set(id, node);
    this.invalidateCompute();
    
    return node;
  }
  
  /**
   * Remove a node from the graph
   */
  removeNode(nodeId: string): void {
    // Remove connections to/from this node
    this.graph.connections = this.graph.connections.filter(
      c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
    );
    
    this.graph.nodes.delete(nodeId);
    this.invalidateCompute();
  }
  
  /**
   * Connect two nodes
   */
  connect(
    sourceNodeId: string,
    sourceOutputId: string,
    targetNodeId: string,
    targetInputId: string
  ): Connection | null {
    const sourceNode = this.graph.nodes.get(sourceNodeId);
    const targetNode = this.graph.nodes.get(targetNodeId);
    
    if (!sourceNode || !targetNode) return null;
    
    const sourceOutput = sourceNode.outputs.find(o => o.id === sourceOutputId);
    const targetInput = targetNode.inputs.find(i => i.id === targetInputId);
    
    if (!sourceOutput || !targetInput) return null;
    
    // Check for existing connection to this input
    const existingIdx = this.graph.connections.findIndex(
      c => c.targetNodeId === targetNodeId && c.targetInputId === targetInputId
    );
    if (existingIdx >= 0 && !targetInput.multi) {
      this.graph.connections.splice(existingIdx, 1);
    }
    
    const connection: Connection = {
      id: `conn-${Date.now()}`,
      sourceNodeId,
      sourceOutputId,
      targetNodeId,
      targetInputId,
    };
    
    this.graph.connections.push(connection);
    sourceOutput.connections.push(targetInputId);
    targetInput.connected = sourceOutputId;
    
    this.invalidateCompute();
    
    return connection;
  }
  
  /**
   * Disconnect nodes
   */
  disconnect(connectionId: string): void {
    const idx = this.graph.connections.findIndex(c => c.id === connectionId);
    if (idx >= 0) {
      const conn = this.graph.connections[idx];
      
      const sourceNode = this.graph.nodes.get(conn.sourceNodeId);
      const targetNode = this.graph.nodes.get(conn.targetNodeId);
      
      if (sourceNode) {
        const output = sourceNode.outputs.find(o => o.id === conn.sourceOutputId);
        if (output) {
          output.connections = output.connections.filter(c => c !== conn.targetInputId);
        }
      }
      
      if (targetNode) {
        const input = targetNode.inputs.find(i => i.id === conn.targetInputId);
        if (input) {
          input.connected = undefined;
        }
      }
      
      this.graph.connections.splice(idx, 1);
      this.invalidateCompute();
    }
  }
  
  /**
   * Update a node's parameter
   */
  updateParameter(nodeId: string, parameterId: string, value: ParameterValue): void {
    const node = this.graph.nodes.get(nodeId);
    if (node) {
      const param = node.parameters.find(p => p.id === parameterId);
      if (param) {
        param.value = value;
        this.invalidateCompute();
      }
    }
  }
  
  /**
   * Invalidate computation cache
   */
  private invalidateCompute(): void {
    this.cache.clear();
    this.computeOrder = [];
    this.graph.metadata.modified = new Date();
  }
  
  /**
   * Compute the graph and return results
   */
  compute(): Map<string, any> {
    // Topological sort
    this.computeOrder = this.topologicalSort();
    
    const results = new Map<string, any>();
    
    for (const nodeId of this.computeOrder) {
      const node = this.graph.nodes.get(nodeId);
      if (!node) continue;
      
      const nodeType = this.nodeTypes.get(node.type);
      if (!nodeType) continue;
      
      // Gather inputs
      const inputs: Record<string, any> = {};
      
      for (const input of node.inputs) {
        if (input.connected) {
          // Find the connection
          const conn = this.graph.connections.find(
            c => c.targetNodeId === nodeId && c.targetInputId === input.id
          );
          
          if (conn) {
            const sourceOutputs = results.get(conn.sourceNodeId);
            if (sourceOutputs) {
              inputs[input.id] = sourceOutputs[conn.sourceOutputId];
            }
          }
        } else {
          inputs[input.id] = input.defaultValue;
        }
      }
      
      // Add node parameters as inputs
      for (const param of node.parameters) {
        inputs[param.id] = param.value;
      }
      
      try {
        const outputs = nodeType.compute(inputs);
        results.set(nodeId, outputs);
        
        // Update node output values
        for (const output of node.outputs) {
          output.value = outputs[output.id];
        }
        
        node.error = undefined;
        node.cached = true;
      } catch (error) {
        node.error = String(error);
        results.set(nodeId, {});
      }
    }
    
    return results;
  }
  
  /**
   * Topological sort for computation order
   */
  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    
    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      // Visit dependencies first
      for (const conn of this.graph.connections) {
        if (conn.targetNodeId === nodeId) {
          visit(conn.sourceNodeId);
        }
      }
      
      order.push(nodeId);
    };
    
    for (const nodeId of this.graph.nodes.keys()) {
      visit(nodeId);
    }
    
    return order;
  }
  
  /**
   * Export the parametric graph
   */
  exportGraph(): string {
    const exportData = {
      ...this.graph,
      nodes: Array.from(this.graph.nodes.entries()),
    };
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * Import a parametric graph
   */
  importGraph(json: string): void {
    const data = JSON.parse(json);
    this.graph = {
      ...data,
      nodes: new Map(data.nodes),
    };
    this.invalidateCompute();
  }
  
  /**
   * Get the current graph
   */
  getGraph(): ParametricGraph {
    return this.graph;
  }
  
  /**
   * Generate a structural model from the graph
   */
  generateStructuralModel(): StructuralModel {
    const results = this.compute();
    
    const model: StructuralModel = {
      nodes: [] as Point3D[],
      members: [] as StructuralMember[],
      supports: [] as StructuralSupport[],
      loads: [] as Record<string, unknown>[],
    };
    
    // Collect all structural outputs
    for (const [nodeId, outputs] of results) {
      if (outputs.nodes) {
        model.nodes.push(...outputs.nodes);
      }
      if (outputs.members) {
        model.members.push(...outputs.members);
      }
      if (outputs.columns) {
        model.members.push(...outputs.columns);
      }
      if (outputs.beams) {
        model.members.push(...outputs.beams);
      }
      if (outputs.supports) {
        model.supports.push(...outputs.supports);
      }
      if (outputs.load) {
        model.loads.push(outputs.load);
      }
    }
    
    return model;
  }
}

// Export singleton instance
export const parametricEngine = new ParametricModelingEngine();

export default ParametricModelingEngine;
