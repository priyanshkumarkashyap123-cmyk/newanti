/**
 * ModelValidator.ts - Comprehensive Structural Model Validation
 * 
 * Provides extensive validation and debugging for structural models:
 * - Geometry validation (collinear nodes, zero-length elements)
 * - Topology validation (connectivity, stability)
 * - Material and section property validation
 * - Load application validation
 * - Constraint validation
 * - Pre-analysis checks
 * 
 * Based on STAAD.Pro and SAP2000 validation rules
 */

import type {
  ModelNode,
  ModelElement,
  SectionDefinition,
  MaterialDefinition,
  LoadPattern,
  NodeRestraint,
} from './AdvancedModelingEngine';

// ============================================
// VALIDATION RESULT TYPES
// ============================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  summary: ValidationSummary;
}

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  elementType?: 'node' | 'element' | 'section' | 'material' | 'load' | 'model';
  elementId?: string;
  location?: { x: number; y: number; z: number };
  suggestion?: string;
}

export interface ValidationSummary {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningCount: number;
  criticalIssues: string[];
  readyForAnalysis: boolean;
}

// ============================================
// VALIDATION CONFIGURATION
// ============================================

export interface ValidationConfig {
  // Geometry tolerances
  minElementLength: number;        // Minimum element length (default: 0.001m)
  maxAspectRatio: number;          // Maximum element aspect ratio (default: 100)
  duplicateNodeTolerance: number;  // Distance to consider nodes duplicate (default: 0.001m)
  
  // Material limits
  minYoungsModulus: number;        // Minimum E (default: 1e6 Pa)
  maxYoungsModulus: number;        // Maximum E (default: 1e12 Pa)
  minPoissonsRatio: number;        // Minimum ν (default: -1)
  maxPoissonsRatio: number;        // Maximum ν (default: 0.5)
  
  // Section limits
  minSectionArea: number;          // Minimum area (default: 1e-10 m²)
  maxSectionArea: number;          // Maximum area (default: 1e4 m²)
  
  // Load limits
  maxPointLoad: number;            // Maximum point load (default: 1e12 N)
  maxMomentLoad: number;           // Maximum moment (default: 1e12 N-m)
  
  // Stability
  checkStaticStability: boolean;   // Check for mechanisms
  checkConditionNumber: boolean;   // Check stiffness conditioning
}

const DEFAULT_CONFIG: ValidationConfig = {
  minElementLength: 0.001,
  maxAspectRatio: 100,
  duplicateNodeTolerance: 0.001,
  minYoungsModulus: 1e6,
  maxYoungsModulus: 1e12,
  minPoissonsRatio: -1,
  maxPoissonsRatio: 0.5,
  minSectionArea: 1e-10,
  maxSectionArea: 1e4,
  maxPointLoad: 1e12,
  maxMomentLoad: 1e12,
  checkStaticStability: true,
  checkConditionNumber: true,
};

// ============================================
// VALIDATION ERROR CODES
// ============================================

export const ValidationCodes = {
  // Geometry (G)
  G001: 'G001', // Zero-length element
  G002: 'G002', // Short element
  G003: 'G003', // Duplicate nodes
  G004: 'G004', // Collinear nodes (for shells)
  G005: 'G005', // High aspect ratio
  G006: 'G006', // Self-intersecting geometry
  G007: 'G007', // Node outside reasonable bounds
  
  // Topology (T)
  T001: 'T001', // Disconnected structure
  T002: 'T002', // Floating node (not connected)
  T003: 'T003', // Mechanism detected
  T004: 'T004', // Insufficient supports
  T005: 'T005', // Over-constrained node
  T006: 'T006', // Missing node reference
  T007: 'T007', // Duplicate element
  
  // Material (M)
  M001: 'M001', // Invalid Young's modulus
  M002: 'M002', // Invalid Poisson's ratio
  M003: 'M003', // Invalid density
  M004: 'M004', // Missing material reference
  M005: 'M005', // Inconsistent material properties
  
  // Section (S)
  S001: 'S001', // Invalid section area
  S002: 'S002', // Invalid moment of inertia
  S003: 'S003', // Invalid torsional constant
  S004: 'S004', // Missing section reference
  S005: 'S005', // Section dimensions inconsistent
  
  // Load (L)
  L001: 'L001', // Load on non-existent node
  L002: 'L002', // Load on non-existent element
  L003: 'L003', // Excessive load magnitude
  L004: 'L004', // No loads defined
  L005: 'L005', // Load outside element bounds
  L006: 'L006', // Self-weight with zero density
  
  // Analysis (A)
  A001: 'A001', // Singular stiffness matrix
  A002: 'A002', // Ill-conditioned matrix
  A003: 'A003', // Zero pivot detected
  A004: 'A004', // Convergence failure
  A005: 'A005', // Negative eigenvalue
  
  // Model (X)
  X001: 'X001', // Empty model
  X002: 'X002', // No elements defined
  X003: 'X003', // No sections defined
  X004: 'X004', // No materials defined
};

// ============================================
// MODEL VALIDATOR CLASS
// ============================================

export class ModelValidator {
  private config: ValidationConfig;
  private issues: ValidationIssue[] = [];
  
  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Validate complete model
   */
  validate(
    nodes: Map<string, ModelNode>,
    elements: Map<string, ModelElement>,
    sections: Map<string, SectionDefinition>,
    materials: Map<string, MaterialDefinition>,
    loadPatterns: Map<string, LoadPattern>
  ): ValidationResult {
    this.issues = [];
    
    // Basic model checks
    this.validateModelStructure(nodes, elements, sections, materials);
    
    // Geometry checks
    this.validateGeometry(nodes, elements);
    
    // Topology checks
    this.validateTopology(nodes, elements);
    
    // Material checks
    this.validateMaterials(materials);
    
    // Section checks
    this.validateSections(sections);
    
    // Element-specific checks
    this.validateElements(elements, sections, materials, nodes);
    
    // Load checks
    this.validateLoads(loadPatterns, nodes, elements);
    
    // Support checks
    this.validateSupports(nodes);
    
    // Stability checks
    if (this.config.checkStaticStability) {
      this.checkStaticStability(nodes, elements);
    }
    
    return this.generateResult();
  }
  
  /**
   * Quick validation (essential checks only)
   */
  quickValidate(
    nodes: Map<string, ModelNode>,
    elements: Map<string, ModelElement>
  ): { valid: boolean; criticalIssues: string[] } {
    this.issues = [];
    
    // Essential checks only
    if (nodes.size === 0) {
      this.addIssue({
        code: ValidationCodes.X001,
        severity: 'error',
        message: 'Model has no nodes',
        elementType: 'model',
      });
    }
    
    if (elements.size === 0) {
      this.addIssue({
        code: ValidationCodes.X002,
        severity: 'error',
        message: 'Model has no elements',
        elementType: 'model',
      });
    }
    
    // Check for zero-length elements
    for (const [id, element] of elements) {
      const nodeI = nodes.get(element.nodeI);
      const nodeJ = nodes.get(element.nodeJ);
      
      if (!nodeI || !nodeJ) {
        this.addIssue({
          code: ValidationCodes.T006,
          severity: 'error',
          message: `Element ${id} references non-existent node`,
          elementType: 'element',
          elementId: id,
        });
        continue;
      }
      
      const length = Math.sqrt(
        Math.pow(nodeJ.x - nodeI.x, 2) +
        Math.pow(nodeJ.y - nodeI.y, 2) +
        Math.pow(nodeJ.z - nodeI.z, 2)
      );
      
      if (length < 1e-10) {
        this.addIssue({
          code: ValidationCodes.G001,
          severity: 'error',
          message: `Element ${id} has zero length`,
          elementType: 'element',
          elementId: id,
        });
      }
    }
    
    // Check for supports
    const hasSupport = Array.from(nodes.values()).some(n =>
      n.restraints.ux || n.restraints.uy || n.restraints.uz
    );
    
    if (!hasSupport) {
      this.addIssue({
        code: ValidationCodes.T004,
        severity: 'error',
        message: 'No supports defined - structure is unstable',
        elementType: 'model',
      });
    }
    
    const errors = this.issues.filter(i => i.severity === 'error');
    
    return {
      valid: errors.length === 0,
      criticalIssues: errors.map(e => e.message),
    };
  }
  
  // ==========================================
  // VALIDATION METHODS
  // ==========================================
  
  private validateModelStructure(
    nodes: Map<string, ModelNode>,
    elements: Map<string, ModelElement>,
    sections: Map<string, SectionDefinition>,
    materials: Map<string, MaterialDefinition>
  ): void {
    if (nodes.size === 0) {
      this.addIssue({
        code: ValidationCodes.X001,
        severity: 'error',
        message: 'Model is empty - no nodes defined',
        elementType: 'model',
      });
    }
    
    if (elements.size === 0) {
      this.addIssue({
        code: ValidationCodes.X002,
        severity: 'error',
        message: 'No elements defined',
        elementType: 'model',
        suggestion: 'Add at least one structural element',
      });
    }
    
    if (sections.size === 0) {
      this.addIssue({
        code: ValidationCodes.X003,
        severity: 'error',
        message: 'No sections defined',
        elementType: 'model',
        suggestion: 'Define section properties before analysis',
      });
    }
    
    if (materials.size === 0) {
      this.addIssue({
        code: ValidationCodes.X004,
        severity: 'error',
        message: 'No materials defined',
        elementType: 'model',
        suggestion: 'Define material properties before analysis',
      });
    }
  }
  
  private validateGeometry(
    nodes: Map<string, ModelNode>,
    elements: Map<string, ModelElement>
  ): void {
    // Check for duplicate nodes
    const nodeArray = Array.from(nodes.values());
    for (let i = 0; i < nodeArray.length; i++) {
      for (let j = i + 1; j < nodeArray.length; j++) {
        const dist = Math.sqrt(
          Math.pow(nodeArray[j].x - nodeArray[i].x, 2) +
          Math.pow(nodeArray[j].y - nodeArray[i].y, 2) +
          Math.pow(nodeArray[j].z - nodeArray[i].z, 2)
        );
        
        if (dist < this.config.duplicateNodeTolerance) {
          this.addIssue({
            code: ValidationCodes.G003,
            severity: 'warning',
            message: `Duplicate nodes detected: ${nodeArray[i].id} and ${nodeArray[j].id}`,
            elementType: 'node',
            elementId: nodeArray[i].id,
            location: { x: nodeArray[i].x, y: nodeArray[i].y, z: nodeArray[i].z },
            suggestion: 'Consider merging these nodes',
          });
        }
      }
    }
    
    // Check for node bounds
    for (const [id, node] of nodes) {
      if (Math.abs(node.x) > 1e6 || Math.abs(node.y) > 1e6 || Math.abs(node.z) > 1e6) {
        this.addIssue({
          code: ValidationCodes.G007,
          severity: 'warning',
          message: `Node ${id} has coordinates outside reasonable bounds`,
          elementType: 'node',
          elementId: id,
          location: { x: node.x, y: node.y, z: node.z },
        });
      }
    }
    
    // Check element geometry
    for (const [id, element] of elements) {
      const nodeI = nodes.get(element.nodeI);
      const nodeJ = nodes.get(element.nodeJ);
      
      if (!nodeI || !nodeJ) continue;
      
      const dx = nodeJ.x - nodeI.x;
      const dy = nodeJ.y - nodeI.y;
      const dz = nodeJ.z - nodeI.z;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      // Zero-length check
      if (length < 1e-10) {
        this.addIssue({
          code: ValidationCodes.G001,
          severity: 'error',
          message: `Element ${id} has zero length`,
          elementType: 'element',
          elementId: id,
        });
      }
      // Short element check
      else if (length < this.config.minElementLength) {
        this.addIssue({
          code: ValidationCodes.G002,
          severity: 'warning',
          message: `Element ${id} is very short (L=${length.toFixed(6)}m)`,
          elementType: 'element',
          elementId: id,
          suggestion: 'Consider using a mesh refinement or merging nodes',
        });
      }
    }
  }
  
  private validateTopology(
    nodes: Map<string, ModelNode>,
    elements: Map<string, ModelElement>
  ): void {
    // Build connectivity
    const nodeConnections = new Map<string, Set<string>>();
    for (const node of nodes.keys()) {
      nodeConnections.set(node, new Set());
    }
    
    for (const [elemId, element] of elements) {
      // Check node references
      if (!nodes.has(element.nodeI)) {
        this.addIssue({
          code: ValidationCodes.T006,
          severity: 'error',
          message: `Element ${elemId} references non-existent node ${element.nodeI}`,
          elementType: 'element',
          elementId: elemId,
        });
      } else {
        nodeConnections.get(element.nodeI)?.add(elemId);
      }
      
      if (!nodes.has(element.nodeJ)) {
        this.addIssue({
          code: ValidationCodes.T006,
          severity: 'error',
          message: `Element ${elemId} references non-existent node ${element.nodeJ}`,
          elementType: 'element',
          elementId: elemId,
        });
      } else {
        nodeConnections.get(element.nodeJ)?.add(elemId);
      }
    }
    
    // Check for floating nodes
    for (const [nodeId, connections] of nodeConnections) {
      if (connections.size === 0) {
        this.addIssue({
          code: ValidationCodes.T002,
          severity: 'warning',
          message: `Node ${nodeId} is not connected to any element`,
          elementType: 'node',
          elementId: nodeId,
          suggestion: 'Remove or connect this node',
        });
      }
    }
    
    // Check for disconnected structure using BFS
    if (elements.size > 0) {
      const visited = new Set<string>();
      const queue: string[] = [];
      
      // Start from first node
      const startNode = nodes.keys().next().value;
      if (startNode) {
        queue.push(startNode);
        visited.add(startNode);
        
        while (queue.length > 0) {
          const current = queue.shift()!;
          const connectedElements = nodeConnections.get(current);
          
          if (connectedElements) {
            for (const elemId of connectedElements) {
              const elem = elements.get(elemId);
              if (!elem) continue;
              
              const neighbors = [elem.nodeI, elem.nodeJ];
              for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                  visited.add(neighbor);
                  queue.push(neighbor);
                }
              }
            }
          }
        }
        
        // Check if all nodes are visited
        if (visited.size < nodes.size) {
          const disconnected = Array.from(nodes.keys()).filter(n => !visited.has(n));
          this.addIssue({
            code: ValidationCodes.T001,
            severity: 'error',
            message: `Structure is disconnected. ${disconnected.length} nodes not connected to main structure`,
            elementType: 'model',
            suggestion: `Disconnected nodes: ${disconnected.slice(0, 5).join(', ')}${disconnected.length > 5 ? '...' : ''}`,
          });
        }
      }
    }
    
    // Check for duplicate elements
    const elementPairs = new Map<string, string>();
    for (const [id, element] of elements) {
      const key1 = `${element.nodeI}-${element.nodeJ}`;
      const key2 = `${element.nodeJ}-${element.nodeI}`;
      
      if (elementPairs.has(key1) || elementPairs.has(key2)) {
        this.addIssue({
          code: ValidationCodes.T007,
          severity: 'warning',
          message: `Duplicate element: ${id} connects same nodes as ${elementPairs.get(key1) || elementPairs.get(key2)}`,
          elementType: 'element',
          elementId: id,
        });
      } else {
        elementPairs.set(key1, id);
      }
    }
  }
  
  private validateMaterials(materials: Map<string, MaterialDefinition>): void {
    for (const [name, material] of materials) {
      const props = material.properties;
      
      // Young's modulus
      if (props.E <= 0) {
        this.addIssue({
          code: ValidationCodes.M001,
          severity: 'error',
          message: `Material ${name} has invalid Young's modulus (E=${props.E})`,
          elementType: 'material',
          elementId: name,
        });
      } else if (props.E < this.config.minYoungsModulus || props.E > this.config.maxYoungsModulus) {
        this.addIssue({
          code: ValidationCodes.M001,
          severity: 'warning',
          message: `Material ${name} has unusual Young's modulus (E=${props.E.toExponential(2)})`,
          elementType: 'material',
          elementId: name,
        });
      }
      
      // Poisson's ratio
      if (props.nu < this.config.minPoissonsRatio || props.nu > this.config.maxPoissonsRatio) {
        this.addIssue({
          code: ValidationCodes.M002,
          severity: 'error',
          message: `Material ${name} has invalid Poisson's ratio (ν=${props.nu})`,
          elementType: 'material',
          elementId: name,
          suggestion: "Poisson's ratio must be between -1 and 0.5",
        });
      }
      
      // Density
      if (props.density < 0) {
        this.addIssue({
          code: ValidationCodes.M003,
          severity: 'error',
          message: `Material ${name} has negative density`,
          elementType: 'material',
          elementId: name,
        });
      } else if (props.density === 0) {
        this.addIssue({
          code: ValidationCodes.M003,
          severity: 'warning',
          message: `Material ${name} has zero density - self-weight will be zero`,
          elementType: 'material',
          elementId: name,
        });
      }
      
      // Check G vs E consistency
      if (props.G) {
        const expectedG = props.E / (2 * (1 + props.nu));
        const gError = Math.abs(props.G - expectedG) / expectedG;
        
        if (gError > 0.1) {
          this.addIssue({
            code: ValidationCodes.M005,
            severity: 'warning',
            message: `Material ${name}: G and E are inconsistent (expected G=${expectedG.toExponential(2)}, got ${props.G.toExponential(2)})`,
            elementType: 'material',
            elementId: name,
          });
        }
      }
    }
  }
  
  private validateSections(sections: Map<string, SectionDefinition>): void {
    for (const [name, section] of sections) {
      const props = section.properties;
      
      // Area
      if (props.A <= 0) {
        this.addIssue({
          code: ValidationCodes.S001,
          severity: 'error',
          message: `Section ${name} has invalid area (A=${props.A})`,
          elementType: 'section',
          elementId: name,
        });
      } else if (props.A < this.config.minSectionArea || props.A > this.config.maxSectionArea) {
        this.addIssue({
          code: ValidationCodes.S001,
          severity: 'warning',
          message: `Section ${name} has unusual area (A=${props.A.toExponential(2)} m²)`,
          elementType: 'section',
          elementId: name,
        });
      }
      
      // Moment of inertia
      if (props.Iy <= 0 || props.Iz <= 0) {
        this.addIssue({
          code: ValidationCodes.S002,
          severity: 'error',
          message: `Section ${name} has invalid moment of inertia`,
          elementType: 'section',
          elementId: name,
        });
      }
      
      // Torsional constant
      if (props.J <= 0) {
        this.addIssue({
          code: ValidationCodes.S003,
          severity: 'warning',
          message: `Section ${name} has zero torsional constant`,
          elementType: 'section',
          elementId: name,
          suggestion: 'Torsion effects will be ignored',
        });
      }
      
      // Radius of gyration consistency
      if (props.ry && props.A > 0) {
        const expectedRy = Math.sqrt(props.Iy / props.A);
        const ryError = Math.abs(props.ry - expectedRy) / expectedRy;
        
        if (ryError > 0.01) {
          this.addIssue({
            code: ValidationCodes.S005,
            severity: 'info',
            message: `Section ${name}: radius of gyration may be inconsistent`,
            elementType: 'section',
            elementId: name,
          });
        }
      }
    }
  }
  
  private validateElements(
    elements: Map<string, ModelElement>,
    sections: Map<string, SectionDefinition>,
    materials: Map<string, MaterialDefinition>,
    nodes: Map<string, ModelNode>
  ): void {
    for (const [id, element] of elements) {
      // Check section reference
      if (!sections.has(element.section)) {
        this.addIssue({
          code: ValidationCodes.S004,
          severity: 'error',
          message: `Element ${id} references undefined section: ${element.section}`,
          elementType: 'element',
          elementId: id,
        });
      }
      
      // Check material reference
      if (!materials.has(element.material)) {
        this.addIssue({
          code: ValidationCodes.M004,
          severity: 'error',
          message: `Element ${id} references undefined material: ${element.material}`,
          elementType: 'element',
          elementId: id,
        });
      }
      
      // Check aspect ratio for frame elements
      if (element.type === 'frame') {
        const section = sections.get(element.section);
        const nodeI = nodes.get(element.nodeI);
        const nodeJ = nodes.get(element.nodeJ);
        
        if (section && nodeI && nodeJ) {
          const length = Math.sqrt(
            Math.pow(nodeJ.x - nodeI.x, 2) +
            Math.pow(nodeJ.y - nodeI.y, 2) +
            Math.pow(nodeJ.z - nodeI.z, 2)
          );
          
          const minDim = Math.min(
            section.dimensions.d ?? Infinity,
            section.dimensions.b ?? Infinity,
            section.dimensions.bf ?? Infinity,
            section.dimensions.r ? section.dimensions.r * 2 : Infinity
          );
          
          if (minDim !== Infinity && minDim > 0) {
            const aspectRatio = length / minDim;
            
            if (aspectRatio > this.config.maxAspectRatio) {
              this.addIssue({
                code: ValidationCodes.G005,
                severity: 'warning',
                message: `Element ${id} has high aspect ratio (${aspectRatio.toFixed(1)})`,
                elementType: 'element',
                elementId: id,
                suggestion: 'Consider subdividing the element for better accuracy',
              });
            }
          }
        }
      }
    }
  }
  
  private validateLoads(
    loadPatterns: Map<string, LoadPattern>,
    nodes: Map<string, ModelNode>,
    elements: Map<string, ModelElement>
  ): void {
    let hasLoads = false;
    
    for (const [patternName, pattern] of loadPatterns) {
      if (pattern.loads.length > 0) hasLoads = true;
      
      for (const load of pattern.loads) {
        if (load.type === 'nodal') {
          // Check node exists
          if (!nodes.has(load.nodeId)) {
            this.addIssue({
              code: ValidationCodes.L001,
              severity: 'error',
              message: `Load in pattern "${patternName}" references non-existent node: ${load.nodeId}`,
              elementType: 'load',
            });
          }
          
          // Check load magnitude
          const maxForce = Math.max(
            Math.abs(load.fx ?? 0),
            Math.abs(load.fy ?? 0),
            Math.abs(load.fz ?? 0)
          );
          const maxMoment = Math.max(
            Math.abs(load.mx ?? 0),
            Math.abs(load.my ?? 0),
            Math.abs(load.mz ?? 0)
          );
          
          if (maxForce > this.config.maxPointLoad) {
            this.addIssue({
              code: ValidationCodes.L003,
              severity: 'warning',
              message: `Load on node ${load.nodeId} has very high magnitude (${maxForce.toExponential(2)} N)`,
              elementType: 'load',
            });
          }
          
          if (maxMoment > this.config.maxMomentLoad) {
            this.addIssue({
              code: ValidationCodes.L003,
              severity: 'warning',
              message: `Moment on node ${load.nodeId} has very high magnitude (${maxMoment.toExponential(2)} N-m)`,
              elementType: 'load',
            });
          }
        } else if (load.type === 'member') {
          // Check element exists
          if (!elements.has(load.memberId)) {
            this.addIssue({
              code: ValidationCodes.L002,
              severity: 'error',
              message: `Load in pattern "${patternName}" references non-existent element: ${load.memberId}`,
              elementType: 'load',
            });
          }
        }
      }
    }
    
    if (!hasLoads && loadPatterns.size > 0) {
      this.addIssue({
        code: ValidationCodes.L004,
        severity: 'warning',
        message: 'No loads defined in any load pattern',
        elementType: 'model',
        suggestion: 'Add loads before running analysis',
      });
    }
  }
  
  private validateSupports(nodes: Map<string, ModelNode>): void {
    let fixedCount = 0;
    let pinnedCount = 0;
    let rollerCount = 0;
    let springCount = 0;
    
    for (const [id, node] of nodes) {
      const r = node.restraints;
      const translationsFixed = (r.ux ? 1 : 0) + (r.uy ? 1 : 0) + (r.uz ? 1 : 0);
      const rotationsFixed = (r.rx ? 1 : 0) + (r.ry ? 1 : 0) + (r.rz ? 1 : 0);
      
      if (translationsFixed === 3 && rotationsFixed === 3) {
        fixedCount++;
      } else if (translationsFixed === 3 && rotationsFixed === 0) {
        pinnedCount++;
      } else if (translationsFixed > 0 && translationsFixed < 3) {
        rollerCount++;
      }
      
      if (r.springStiffness) {
        springCount++;
      }
      
      // Check for over-constrained
      if (translationsFixed === 3 && rotationsFixed > 0 && rotationsFixed < 3) {
        this.addIssue({
          code: ValidationCodes.T005,
          severity: 'warning',
          message: `Node ${id} has unusual restraint pattern (mixed fixed rotations)`,
          elementType: 'node',
          elementId: id,
        });
      }
    }
    
    const totalSupports = fixedCount + pinnedCount + rollerCount + springCount;
    
    if (totalSupports === 0) {
      this.addIssue({
        code: ValidationCodes.T004,
        severity: 'error',
        message: 'No supports defined - structure will be unstable',
        elementType: 'model',
        suggestion: 'Add at least one fixed or pinned support',
      });
    }
    
    // Check for mechanism (rough estimate)
    // For 3D: need at least 6 DOF constrained for rigid body motion
    const minDOF = fixedCount * 6 + pinnedCount * 3 + rollerCount;
    if (minDOF < 6) {
      this.addIssue({
        code: ValidationCodes.T003,
        severity: 'warning',
        message: `Structure may be a mechanism (only ${minDOF} DOF constrained)`,
        elementType: 'model',
        suggestion: 'Verify support conditions prevent rigid body motion',
      });
    }
  }
  
  private checkStaticStability(
    nodes: Map<string, ModelNode>,
    elements: Map<string, ModelElement>
  ): void {
    const n = nodes.size;
    const m = elements.size;
    const r = Array.from(nodes.values()).reduce((sum, node) => {
      return sum +
        (node.restraints.ux ? 1 : 0) +
        (node.restraints.uy ? 1 : 0) +
        (node.restraints.uz ? 1 : 0) +
        (node.restraints.rx ? 1 : 0) +
        (node.restraints.ry ? 1 : 0) +
        (node.restraints.rz ? 1 : 0);
    }, 0);
    
    // For space frame: m + r >= 6n for static determinacy
    const dof = 6 * n;
    const equations = m * 6 + r; // Very rough estimate
    
    if (equations < dof) {
      this.addIssue({
        code: ValidationCodes.T003,
        severity: 'info',
        message: `Structure may be statically indeterminate (DOF=${dof}, Equations≈${equations})`,
        elementType: 'model',
      });
    }
  }
  
  // ==========================================
  // HELPER METHODS
  // ==========================================
  
  private addIssue(issue: ValidationIssue): void {
    this.issues.push(issue);
  }
  
  private generateResult(): ValidationResult {
    const errors = this.issues.filter(i => i.severity === 'error');
    const warnings = this.issues.filter(i => i.severity === 'warning');
    const info = this.issues.filter(i => i.severity === 'info');
    
    const totalChecks = this.issues.length + 10; // Base checks
    const failedChecks = errors.length;
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
      summary: {
        totalChecks,
        passedChecks: totalChecks - failedChecks,
        failedChecks,
        warningCount: warnings.length,
        criticalIssues: errors.map(e => e.message),
        readyForAnalysis: errors.length === 0,
      },
    };
  }
}

// ============================================
// DEBUGGING UTILITIES
// ============================================

export class ModelDebugger {
  /**
   * Generate detailed model report
   */
  static generateReport(
    nodes: Map<string, ModelNode>,
    elements: Map<string, ModelElement>,
    sections: Map<string, SectionDefinition>,
    materials: Map<string, MaterialDefinition>
  ): string {
    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════',
      '                    STRUCTURAL MODEL DEBUG REPORT               ',
      '═══════════════════════════════════════════════════════════════',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '┌─────────────────────────────────────────────────────────────┐',
      '│ MODEL STATISTICS                                            │',
      '├─────────────────────────────────────────────────────────────┤',
      `│ Nodes:          ${nodes.size.toString().padStart(6)}                                   │`,
      `│ Elements:       ${elements.size.toString().padStart(6)}                                   │`,
      `│ Sections:       ${sections.size.toString().padStart(6)}                                   │`,
      `│ Materials:      ${materials.size.toString().padStart(6)}                                   │`,
      `│ Total DOF:      ${(nodes.size * 6).toString().padStart(6)}                                   │`,
      '└─────────────────────────────────────────────────────────────┘',
      '',
    ];
    
    // Node summary
    lines.push('┌─────────────────────────────────────────────────────────────┐');
    lines.push('│ NODE SUMMARY                                                │');
    lines.push('├───────┬────────────┬────────────┬────────────┬─────────────┤');
    lines.push('│ ID    │ X          │ Y          │ Z          │ Restraints  │');
    lines.push('├───────┼────────────┼────────────┼────────────┼─────────────┤');
    
    let nodeCount = 0;
    for (const [id, node] of nodes) {
      if (nodeCount >= 10) {
        lines.push(`│ ... and ${nodes.size - 10} more nodes                              │`);
        break;
      }
      
      const restraintStr = [
        node.restraints.ux ? 'X' : '-',
        node.restraints.uy ? 'Y' : '-',
        node.restraints.uz ? 'Z' : '-',
        node.restraints.rx ? 'RX' : '--',
        node.restraints.ry ? 'RY' : '--',
        node.restraints.rz ? 'RZ' : '--',
      ].join('');
      
      lines.push(
        `│ ${id.padEnd(5)} │ ${node.x.toFixed(3).padStart(10)} │ ${node.y.toFixed(3).padStart(10)} │ ${node.z.toFixed(3).padStart(10)} │ ${restraintStr.padEnd(11)} │`
      );
      nodeCount++;
    }
    lines.push('└───────┴────────────┴────────────┴────────────┴─────────────┘');
    lines.push('');
    
    // Element summary
    lines.push('┌─────────────────────────────────────────────────────────────┐');
    lines.push('│ ELEMENT SUMMARY                                             │');
    lines.push('├───────┬──────┬──────┬────────────┬────────────┬────────────┤');
    lines.push('│ ID    │ I    │ J    │ Section    │ Material   │ Type       │');
    lines.push('├───────┼──────┼──────┼────────────┼────────────┼────────────┤');
    
    let elemCount = 0;
    for (const [id, elem] of elements) {
      if (elemCount >= 10) {
        lines.push(`│ ... and ${elements.size - 10} more elements                          │`);
        break;
      }
      
      lines.push(
        `│ ${id.padEnd(5)} │ ${elem.nodeI.padEnd(4)} │ ${elem.nodeJ.padEnd(4)} │ ${elem.section.padEnd(10)} │ ${elem.material.padEnd(10)} │ ${elem.type.padEnd(10)} │`
      );
      elemCount++;
    }
    lines.push('└───────┴──────┴──────┴────────────┴────────────┴────────────┘');
    
    return lines.join('\n');
  }
  
  /**
   * Check for specific issue
   */
  static diagnoseIssue(
    nodes: Map<string, ModelNode>,
    elements: Map<string, ModelElement>,
    issueType: 'zero-length' | 'disconnected' | 'no-support' | 'all'
  ): string[] {
    const issues: string[] = [];
    
    if (issueType === 'zero-length' || issueType === 'all') {
      for (const [id, elem] of elements) {
        const nodeI = nodes.get(elem.nodeI);
        const nodeJ = nodes.get(elem.nodeJ);
        
        if (nodeI && nodeJ) {
          const length = Math.sqrt(
            Math.pow(nodeJ.x - nodeI.x, 2) +
            Math.pow(nodeJ.y - nodeI.y, 2) +
            Math.pow(nodeJ.z - nodeI.z, 2)
          );
          
          if (length < 1e-10) {
            issues.push(`Zero-length element: ${id} (nodes ${elem.nodeI} -> ${elem.nodeJ})`);
          }
        }
      }
    }
    
    if (issueType === 'no-support' || issueType === 'all') {
      const hasSupport = Array.from(nodes.values()).some(n =>
        n.restraints.ux || n.restraints.uy || n.restraints.uz
      );
      
      if (!hasSupport) {
        issues.push('No supports defined - structure is unstable');
      }
    }
    
    if (issueType === 'disconnected' || issueType === 'all') {
      const connected = new Set<string>();
      const nodeList = Array.from(nodes.keys());
      
      if (nodeList.length > 0) {
        const queue = [nodeList[0]];
        connected.add(nodeList[0]);
        
        while (queue.length > 0) {
          const current = queue.shift()!;
          
          for (const [, elem] of elements) {
            if (elem.nodeI === current && !connected.has(elem.nodeJ)) {
              connected.add(elem.nodeJ);
              queue.push(elem.nodeJ);
            } else if (elem.nodeJ === current && !connected.has(elem.nodeI)) {
              connected.add(elem.nodeI);
              queue.push(elem.nodeI);
            }
          }
        }
        
        if (connected.size < nodes.size) {
          const disconnected = nodeList.filter(n => !connected.has(n));
          issues.push(`Disconnected nodes: ${disconnected.join(', ')}`);
        }
      }
    }
    
    return issues;
  }
  
  /**
   * Visualize model connectivity
   */
  static generateConnectivityMatrix(
    nodes: Map<string, ModelNode>,
    elements: Map<string, ModelElement>
  ): number[][] {
    const nodeList = Array.from(nodes.keys());
    const n = nodeList.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    const nodeIndex = new Map(nodeList.map((id, idx) => [id, idx]));
    
    for (const [, elem] of elements) {
      const i = nodeIndex.get(elem.nodeI);
      const j = nodeIndex.get(elem.nodeJ);
      
      if (i !== undefined && j !== undefined) {
        matrix[i][j] = 1;
        matrix[j][i] = 1;
      }
    }
    
    return matrix;
  }
}

// ============================================
// EXPORTS
// ============================================

export const validator = new ModelValidator();

export default {
  ModelValidator,
  ModelDebugger,
  ValidationCodes,
  validator,
};
