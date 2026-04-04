/**
 * ProfessionalModelingTools.ts
 * 
 * Advanced Structural Modeling Tools - STAAD.Pro / SAP2000 Level
 * 
 * Features:
 * - Precise grid-based modeling
 * - Snap-to-grid and snap-to-node
 * - Advanced section profile generation
 * - Member offset and release handling
 * - Copy, mirror, array operations
 * - Coordinate transformation
 * - Meshing and subdivision
 * - Import/Export support
 */

import * as THREE from 'three';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface GridSettings {
  origin: Point3D;
  spacingX: number;
  spacingY: number;
  spacingZ: number;
  countX: number;
  countY: number;
  countZ: number;
  visible: boolean;
  snapEnabled: boolean;
  snapTolerance: number;
}

export interface SnapSettings {
  snapToGrid: boolean;
  snapToNode: boolean;
  snapToMidpoint: boolean;
  snapToEndpoint: boolean;
  snapToIntersection: boolean;
  snapToPerp: boolean;
  snapToParallel: boolean;
  snapDistance: number;
}

export interface MemberOffset {
  startI: Point3D;  // Offset at start node
  endJ: Point3D;    // Offset at end node
  referenceAxis: 'local' | 'global';
}

export interface MemberRelease {
  startReleases: [boolean, boolean, boolean, boolean, boolean, boolean]; // Fx, Fy, Fz, Mx, My, Mz
  endReleases: [boolean, boolean, boolean, boolean, boolean, boolean];
  partialReleases?: {
    start?: [number, number, number, number, number, number]; // Partial fixity factors
    end?: [number, number, number, number, number, number];
  };
}

export interface SectionProfile {
  type: SectionType;
  name: string;
  properties: SectionProperties;
  shape: THREE.Shape | null;
  dimensions: SectionDimensions;
}

export type SectionType = 
  | 'I' | 'W' | 'HP' | 'M' | 'S'  // Wide flange sections
  | 'C' | 'MC'                     // Channel sections
  | 'L'                            // Angle sections
  | 'WT' | 'MT' | 'ST'             // Tee sections
  | 'HSS-RECT' | 'HSS-ROUND'       // Hollow structural sections
  | 'PIPE'                         // Pipe sections
  | 'PLATE'                        // Plate sections
  | 'SOLID-RECT' | 'SOLID-ROUND'   // Solid sections
  | 'BUILT-UP'                     // Built-up sections
  | 'GENERIC';                     // User-defined

export interface SectionProperties {
  A: number;      // Area (mm²)
  Ix: number;     // Strong-axis moment of inertia (mm⁴)
  Iy: number;     // Weak-axis moment of inertia (mm⁴)
  Iz: number;     // Torsional constant (mm⁴)
  Sx: number;     // Strong-axis section modulus (mm³)
  Sy: number;     // Weak-axis section modulus (mm³)
  Zx: number;     // Strong-axis plastic modulus (mm³)
  Zy: number;     // Weak-axis plastic modulus (mm³)
  rx: number;     // Strong-axis radius of gyration (mm)
  ry: number;     // Weak-axis radius of gyration (mm)
  J: number;      // Torsional constant (mm⁴)
  Cw: number;     // Warping constant (mm⁶)
}

export interface SectionDimensions {
  // I/W/HP sections
  d?: number;     // Depth
  bf?: number;    // Flange width
  tf?: number;    // Flange thickness
  tw?: number;    // Web thickness
  
  // C/MC sections
  depth?: number;
  width?: number;
  webThickness?: number;
  flangeThickness?: number;
  
  // L sections
  legA?: number;
  legB?: number;
  thickness?: number;
  
  // HSS sections
  Ht?: number;    // Height
  B?: number;     // Width
  t?: number;     // Wall thickness
  
  // Pipe sections
  OD?: number;    // Outer diameter
  ID?: number;    // Inner diameter
  
  // Generic
  dims?: number[];
}

export interface TransformOperation {
  type: 'translate' | 'rotate' | 'scale' | 'mirror' | 'array';
  params: TransformParams;
}

export interface TransformParams {
  // Translate
  dx?: number;
  dy?: number;
  dz?: number;
  
  // Rotate
  axis?: Point3D;
  angle?: number;  // Degrees
  center?: Point3D;
  
  // Scale
  sx?: number;
  sy?: number;
  sz?: number;
  scaleCenter?: Point3D;
  
  // Mirror
  mirrorPlane?: 'XY' | 'XZ' | 'YZ' | 'custom';
  planePoint?: Point3D;
  planeNormal?: Point3D;
  
  // Array
  arrayType?: 'linear' | 'polar' | 'rectangular';
  count?: number;
  countX?: number;
  countY?: number;
  countZ?: number;
  spacing?: number;
  spacingX?: number;
  spacingY?: number;
  spacingZ?: number;
  polarCenter?: Point3D;
  polarAxis?: Point3D;
  totalAngle?: number;
}

export interface MeshingOptions {
  maxElementSize: number;
  minElementSize: number;
  gradingFactor: number;
  meshType: 'quad' | 'tri' | 'mixed';
  refinementZones?: RefinementZone[];
}

export interface RefinementZone {
  type: 'sphere' | 'box' | 'cylinder';
  center: Point3D;
  size: number | Point3D;
  elementSize: number;
}

// ============================================
// COORDINATE SYSTEM MANAGER
// ============================================

export class CoordinateSystemManager {
  private globalOrigin: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private globalAxes: THREE.Matrix3 = new THREE.Matrix3().identity();
  
  private localSystems: Map<string, LocalCoordinateSystem> = new Map();

  /**
   * Create a local coordinate system
   */
  createLocalSystem(
    id: string,
    origin: Point3D,
    xAxis: Point3D,
    xyPlanePoint: Point3D
  ): LocalCoordinateSystem {
    const system = new LocalCoordinateSystem(origin, xAxis, xyPlanePoint);
    this.localSystems.set(id, system);
    return system;
  }

  /**
   * Transform point from local to global coordinates
   */
  localToGlobal(point: Point3D, systemId: string): Point3D {
    const system = this.localSystems.get(systemId);
    if (!system) return point;
    return system.toGlobal(point);
  }

  /**
   * Transform point from global to local coordinates
   */
  globalToLocal(point: Point3D, systemId: string): Point3D {
    const system = this.localSystems.get(systemId);
    if (!system) return point;
    return system.toLocal(point);
  }

  /**
   * Get transformation matrix for a member
   */
  getMemberTransformMatrix(
    startPoint: Point3D,
    endPoint: Point3D,
    betaAngle: number = 0
  ): THREE.Matrix4 {
    const start = new THREE.Vector3(startPoint.x, startPoint.y, startPoint.z);
    const end = new THREE.Vector3(endPoint.x, endPoint.y, endPoint.z);
    
    // Member local x-axis (along member)
    const xLocal = new THREE.Vector3().subVectors(end, start).normalize();
    
    // Determine local y-axis (perpendicular to member, in vertical plane if possible)
    let yLocal: THREE.Vector3;
    const globalY = new THREE.Vector3(0, 1, 0);
    
    if (Math.abs(xLocal.dot(globalY)) > 0.999) {
      // Member is nearly vertical, use global X as reference
      yLocal = new THREE.Vector3(1, 0, 0);
    } else {
      // Use global Y projected onto plane perpendicular to member
      yLocal = new THREE.Vector3().crossVectors(
        new THREE.Vector3().crossVectors(xLocal, globalY),
        xLocal
      ).normalize();
    }
    
    // Apply beta angle rotation around member axis
    if (betaAngle !== 0) {
      const rotationMatrix = new THREE.Matrix4().makeRotationAxis(xLocal, betaAngle * Math.PI / 180);
      yLocal.applyMatrix4(rotationMatrix);
    }
    
    // Local z-axis (perpendicular to both)
    const zLocal = new THREE.Vector3().crossVectors(xLocal, yLocal).normalize();
    
    // Build transformation matrix
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(xLocal, yLocal, zLocal);
    matrix.setPosition(start);
    
    return matrix;
  }
}

export class LocalCoordinateSystem {
  private origin: THREE.Vector3;
  private transformMatrix: THREE.Matrix4;
  private inverseMatrix: THREE.Matrix4;

  constructor(origin: Point3D, xAxis: Point3D, xyPlanePoint: Point3D) {
    this.origin = new THREE.Vector3(origin.x, origin.y, origin.z);
    
    // Calculate local axes
    const xLocal = new THREE.Vector3(xAxis.x - origin.x, xAxis.y - origin.y, xAxis.z - origin.z).normalize();
    const xyPoint = new THREE.Vector3(xyPlanePoint.x - origin.x, xyPlanePoint.y - origin.y, xyPlanePoint.z - origin.z);
    const zLocal = new THREE.Vector3().crossVectors(xLocal, xyPoint).normalize();
    const yLocal = new THREE.Vector3().crossVectors(zLocal, xLocal).normalize();
    
    // Build transformation matrices
    this.transformMatrix = new THREE.Matrix4();
    this.transformMatrix.makeBasis(xLocal, yLocal, zLocal);
    this.transformMatrix.setPosition(this.origin);
    
    this.inverseMatrix = new THREE.Matrix4().copy(this.transformMatrix).invert();
  }

  toGlobal(point: Point3D): Point3D {
    const v = new THREE.Vector3(point.x, point.y, point.z);
    v.applyMatrix4(this.transformMatrix);
    return { x: v.x, y: v.y, z: v.z };
  }

  toLocal(point: Point3D): Point3D {
    const v = new THREE.Vector3(point.x, point.y, point.z);
    v.applyMatrix4(this.inverseMatrix);
    return { x: v.x, y: v.y, z: v.z };
  }
}

// ============================================
// GRID AND SNAP MANAGER
// ============================================

export class GridSnapManager {
  private gridSettings: GridSettings;
  private snapSettings: SnapSettings;
  private nodes: Map<string, Point3D> = new Map();

  constructor() {
    this.gridSettings = {
      origin: { x: 0, y: 0, z: 0 },
      spacingX: 1,
      spacingY: 1,
      spacingZ: 1,
      countX: 100,
      countY: 100,
      countZ: 100,
      visible: true,
      snapEnabled: true,
      snapTolerance: 0.1
    };

    this.snapSettings = {
      snapToGrid: true,
      snapToNode: true,
      snapToMidpoint: true,
      snapToEndpoint: true,
      snapToIntersection: true,
      snapToPerp: false,
      snapToParallel: false,
      snapDistance: 0.5
    };
  }

  /**
   * Set grid configuration
   */
  setGridSettings(settings: Partial<GridSettings>): void {
    this.gridSettings = { ...this.gridSettings, ...settings };
  }

  /**
   * Set snap configuration
   */
  setSnapSettings(settings: Partial<SnapSettings>): void {
    this.snapSettings = { ...this.snapSettings, ...settings };
  }

  /**
   * Register a node for snapping
   */
  registerNode(id: string, point: Point3D): void {
    this.nodes.set(id, point);
  }

  /**
   * Snap a point to grid or nodes
   */
  snapPoint(point: Point3D): { snapped: Point3D; snapType: string | null } {
    let snappedPoint = { ...point };
    let snapType: string | null = null;
    let minDistance = Infinity;

    // Snap to node
    if (this.snapSettings.snapToNode) {
      for (const [id, nodePoint] of this.nodes) {
        const distance = this.distance3D(point, nodePoint);
        if (distance < this.snapSettings.snapDistance && distance < minDistance) {
          snappedPoint = { ...nodePoint };
          snapType = `node:${id}`;
          minDistance = distance;
        }
      }
    }

    // Snap to grid if no node snap or grid is closer
    if (this.snapSettings.snapToGrid && snapType === null) {
      const gridSnapped = this.snapToGrid(point);
      const gridDistance = this.distance3D(point, gridSnapped);
      if (gridDistance < this.gridSettings.snapTolerance) {
        snappedPoint = gridSnapped;
        snapType = 'grid';
      }
    }

    return { snapped: snappedPoint, snapType };
  }

  /**
   * Snap point to grid
   */
  private snapToGrid(point: Point3D): Point3D {
    const { origin, spacingX, spacingY, spacingZ } = this.gridSettings;
    
    return {
      x: origin.x + Math.round((point.x - origin.x) / spacingX) * spacingX,
      y: origin.y + Math.round((point.y - origin.y) / spacingY) * spacingY,
      z: origin.z + Math.round((point.z - origin.z) / spacingZ) * spacingZ
    };
  }

  /**
   * Calculate 3D distance
   */
  private distance3D(a: Point3D, b: Point3D): number {
    return Math.sqrt(
      Math.pow(b.x - a.x, 2) +
      Math.pow(b.y - a.y, 2) +
      Math.pow(b.z - a.z, 2)
    );
  }

  /**
   * Generate grid geometry for visualization
   */
  generateGridGeometry(): THREE.BufferGeometry {
    const { origin, spacingX, spacingZ, countX, countZ } = this.gridSettings;
    const halfX = (countX * spacingX) / 2;
    const halfZ = (countZ * spacingZ) / 2;
    
    const points: number[] = [];
    
    // X-direction lines
    for (let i = -countX / 2; i <= countX / 2; i++) {
      const x = origin.x + i * spacingX;
      points.push(x, origin.y, -halfZ);
      points.push(x, origin.y, halfZ);
    }
    
    // Z-direction lines
    for (let i = -countZ / 2; i <= countZ / 2; i++) {
      const z = origin.z + i * spacingZ;
      points.push(-halfX, origin.y, z);
      points.push(halfX, origin.y, z);
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    
    return geometry;
  }
}

// ============================================
// SECTION PROFILE LIBRARY
// ============================================

export class SectionProfileLibrary {
  private sections: Map<string, SectionProfile> = new Map();
  private customSections: Map<string, SectionProfile> = new Map();

  constructor() {
    this.initializeStandardSections();
  }

  /**
   * Initialize standard Indian and AISC sections
   */
  private initializeStandardSections(): void {
    // Indian Standard Sections (IS)
    this.addISMBSections();
    this.addISHBSections();
    this.addISMCSections();
    this.addISASections();
    
    // American Sections (AISC)
    this.addAISCWSections();
    this.addAISCHSSSections();
  }

  private addISMBSections(): void {
    const ismbSections: Array<{ name: string; d: number; bf: number; tw: number; tf: number; A: number; Ix: number; Iy: number }> = [
      { name: 'ISMB 100', d: 100, bf: 75, tw: 4.0, tf: 7.2, A: 1142, Ix: 2573000, Iy: 287000 },
      { name: 'ISMB 150', d: 150, bf: 80, tw: 4.8, tf: 7.6, A: 1808, Ix: 7263000, Iy: 466000 },
      { name: 'ISMB 200', d: 200, bf: 100, tw: 5.7, tf: 10.8, A: 3233, Ix: 22350000, Iy: 1500000 },
      { name: 'ISMB 250', d: 250, bf: 125, tw: 6.9, tf: 12.5, A: 4755, Ix: 51310000, Iy: 3340000 },
      { name: 'ISMB 300', d: 300, bf: 140, tw: 7.7, tf: 13.1, A: 5870, Ix: 86030000, Iy: 4540000 },
      { name: 'ISMB 350', d: 350, bf: 140, tw: 8.1, tf: 14.2, A: 6670, Ix: 136300000, Iy: 5380000 },
      { name: 'ISMB 400', d: 400, bf: 140, tw: 8.9, tf: 16.0, A: 7840, Ix: 204580000, Iy: 6220000 },
      { name: 'ISMB 450', d: 450, bf: 150, tw: 9.4, tf: 17.4, A: 9227, Ix: 303870000, Iy: 8340000 },
      { name: 'ISMB 500', d: 500, bf: 180, tw: 10.2, tf: 17.2, A: 11074, Ix: 452180000, Iy: 13700000 },
      { name: 'ISMB 550', d: 550, bf: 190, tw: 11.2, tf: 19.3, A: 13212, Ix: 649740000, Iy: 17840000 },
      { name: 'ISMB 600', d: 600, bf: 210, tw: 12.0, tf: 20.8, A: 15612, Ix: 918100000, Iy: 26500000 },
    ];

    for (const s of ismbSections) {
      const profile: SectionProfile = {
        type: 'I',
        name: s.name,
        dimensions: { d: s.d, bf: s.bf, tw: s.tw, tf: s.tf },
        properties: {
          A: s.A,
          Ix: s.Ix,
          Iy: s.Iy,
          Iz: s.Iy, // Approximate
          Sx: s.Ix / (s.d / 2),
          Sy: s.Iy / (s.bf / 2),
          Zx: s.Ix / (s.d / 2) * 1.12, // Approximate plastic modulus
          Zy: s.Iy / (s.bf / 2) * 1.2,
          rx: Math.sqrt(s.Ix / s.A),
          ry: Math.sqrt(s.Iy / s.A),
          J: (2 * s.bf * Math.pow(s.tf, 3) + (s.d - 2 * s.tf) * Math.pow(s.tw, 3)) / 3,
          Cw: (s.Iy * Math.pow(s.d - s.tf, 2)) / 4
        },
        shape: this.createIBeamShape(s.d, s.bf, s.tw, s.tf)
      };
      this.sections.set(s.name, profile);
    }
  }

  private addISHBSections(): void {
    const ishbSections: Array<{ name: string; d: number; bf: number; tw: number; tf: number; A: number; Ix: number; Iy: number }> = [
      { name: 'ISHB 150', d: 150, bf: 150, tw: 5.4, tf: 9.0, A: 3038, Ix: 14010000, Iy: 6310000 },
      { name: 'ISHB 200', d: 200, bf: 200, tw: 6.1, tf: 9.0, A: 4754, Ix: 36000000, Iy: 12000000 },
      { name: 'ISHB 225', d: 225, bf: 225, tw: 6.5, tf: 9.1, A: 5645, Ix: 52600000, Iy: 17100000 },
      { name: 'ISHB 250', d: 250, bf: 250, tw: 6.9, tf: 9.7, A: 6556, Ix: 77400000, Iy: 25400000 },
      { name: 'ISHB 300', d: 300, bf: 250, tw: 7.6, tf: 10.6, A: 7485, Ix: 125500000, Iy: 28600000 },
      { name: 'ISHB 350', d: 350, bf: 250, tw: 8.3, tf: 11.6, A: 8603, Ix: 191600000, Iy: 32300000 },
      { name: 'ISHB 400', d: 400, bf: 250, tw: 9.1, tf: 12.7, A: 9872, Ix: 280800000, Iy: 36200000 },
      { name: 'ISHB 450', d: 450, bf: 250, tw: 9.8, tf: 13.7, A: 11115, Ix: 392400000, Iy: 40200000 },
    ];

    for (const s of ishbSections) {
      const profile: SectionProfile = {
        type: 'I',
        name: s.name,
        dimensions: { d: s.d, bf: s.bf, tw: s.tw, tf: s.tf },
        properties: {
          A: s.A,
          Ix: s.Ix,
          Iy: s.Iy,
          Iz: s.Iy,
          Sx: s.Ix / (s.d / 2),
          Sy: s.Iy / (s.bf / 2),
          Zx: s.Ix / (s.d / 2) * 1.12,
          Zy: s.Iy / (s.bf / 2) * 1.2,
          rx: Math.sqrt(s.Ix / s.A),
          ry: Math.sqrt(s.Iy / s.A),
          J: (2 * s.bf * Math.pow(s.tf, 3) + (s.d - 2 * s.tf) * Math.pow(s.tw, 3)) / 3,
          Cw: (s.Iy * Math.pow(s.d - s.tf, 2)) / 4
        },
        shape: this.createIBeamShape(s.d, s.bf, s.tw, s.tf)
      };
      this.sections.set(s.name, profile);
    }
  }

  private addISMCSections(): void {
    const ismcSections: Array<{ name: string; d: number; bf: number; tw: number; tf: number; A: number; Ix: number; Iy: number }> = [
      { name: 'ISMC 75', d: 75, bf: 40, tw: 4.4, tf: 7.3, A: 878, Ix: 762000, Iy: 128000 },
      { name: 'ISMC 100', d: 100, bf: 50, tw: 4.7, tf: 7.5, A: 1170, Ix: 1867000, Iy: 257000 },
      { name: 'ISMC 125', d: 125, bf: 65, tw: 5.0, tf: 8.1, A: 1638, Ix: 4160000, Iy: 569000 },
      { name: 'ISMC 150', d: 150, bf: 75, tw: 5.4, tf: 9.0, A: 2121, Ix: 7793000, Iy: 1030000 },
      { name: 'ISMC 175', d: 175, bf: 75, tw: 5.7, tf: 10.2, A: 2433, Ix: 12540000, Iy: 1230000 },
      { name: 'ISMC 200', d: 200, bf: 75, tw: 6.1, tf: 11.4, A: 2821, Ix: 18180000, Iy: 1410000 },
      { name: 'ISMC 225', d: 225, bf: 80, tw: 6.4, tf: 12.4, A: 3288, Ix: 27110000, Iy: 1870000 },
      { name: 'ISMC 250', d: 250, bf: 80, tw: 7.1, tf: 14.1, A: 3867, Ix: 38520000, Iy: 2110000 },
      { name: 'ISMC 300', d: 300, bf: 90, tw: 7.8, tf: 13.6, A: 4564, Ix: 63620000, Iy: 3100000 },
      { name: 'ISMC 400', d: 400, bf: 100, tw: 8.6, tf: 15.3, A: 6293, Ix: 150800000, Iy: 5040000 },
    ];

    for (const s of ismcSections) {
      const profile: SectionProfile = {
        type: 'C',
        name: s.name,
        dimensions: { depth: s.d, width: s.bf, webThickness: s.tw, flangeThickness: s.tf },
        properties: {
          A: s.A,
          Ix: s.Ix,
          Iy: s.Iy,
          Iz: s.Iy,
          Sx: s.Ix / (s.d / 2),
          Sy: s.Iy / (s.bf / 2),
          Zx: s.Ix / (s.d / 2) * 1.1,
          Zy: s.Iy / (s.bf / 2) * 1.15,
          rx: Math.sqrt(s.Ix / s.A),
          ry: Math.sqrt(s.Iy / s.A),
          J: (2 * s.bf * Math.pow(s.tf, 3) + (s.d - 2 * s.tf) * Math.pow(s.tw, 3)) / 3,
          Cw: 0
        },
        shape: this.createChannelShape(s.d, s.bf, s.tw, s.tf)
      };
      this.sections.set(s.name, profile);
    }
  }

  private addISASections(): void {
    const isaSections: Array<{ name: string; a: number; b: number; t: number; A: number; Ix: number; Iy: number }> = [
      { name: 'ISA 25x25x3', a: 25, b: 25, t: 3, A: 142, Ix: 8900, Iy: 8900 },
      { name: 'ISA 30x30x3', a: 30, b: 30, t: 3, A: 174, Ix: 15600, Iy: 15600 },
      { name: 'ISA 40x40x4', a: 40, b: 40, t: 4, A: 308, Ix: 48800, Iy: 48800 },
      { name: 'ISA 50x50x5', a: 50, b: 50, t: 5, A: 480, Ix: 118000, Iy: 118000 },
      { name: 'ISA 60x60x6', a: 60, b: 60, t: 6, A: 691, Ix: 244000, Iy: 244000 },
      { name: 'ISA 65x65x6', a: 65, b: 65, t: 6, A: 749, Ix: 315000, Iy: 315000 },
      { name: 'ISA 75x75x6', a: 75, b: 75, t: 6, A: 866, Ix: 487000, Iy: 487000 },
      { name: 'ISA 75x75x8', a: 75, b: 75, t: 8, A: 1138, Ix: 618000, Iy: 618000 },
      { name: 'ISA 80x80x8', a: 80, b: 80, t: 8, A: 1221, Ix: 773000, Iy: 773000 },
      { name: 'ISA 90x90x8', a: 90, b: 90, t: 8, A: 1379, Ix: 1113000, Iy: 1113000 },
      { name: 'ISA 100x100x8', a: 100, b: 100, t: 8, A: 1538, Ix: 1553000, Iy: 1553000 },
      { name: 'ISA 100x100x10', a: 100, b: 100, t: 10, A: 1903, Ix: 1873000, Iy: 1873000 },
      { name: 'ISA 110x110x10', a: 110, b: 110, t: 10, A: 2106, Ix: 2545000, Iy: 2545000 },
      { name: 'ISA 130x130x10', a: 130, b: 130, t: 10, A: 2503, Ix: 4273000, Iy: 4273000 },
      { name: 'ISA 150x150x12', a: 150, b: 150, t: 12, A: 3459, Ix: 7750000, Iy: 7750000 },
    ];

    for (const s of isaSections) {
      const profile: SectionProfile = {
        type: 'L',
        name: s.name,
        dimensions: { legA: s.a, legB: s.b, thickness: s.t },
        properties: {
          A: s.A,
          Ix: s.Ix,
          Iy: s.Iy,
          Iz: Math.min(s.Ix, s.Iy) * 0.5,
          Sx: s.Ix / (s.a * 0.3),
          Sy: s.Iy / (s.b * 0.3),
          Zx: s.Ix / (s.a * 0.3) * 1.5,
          Zy: s.Iy / (s.b * 0.3) * 1.5,
          rx: Math.sqrt(s.Ix / s.A),
          ry: Math.sqrt(s.Iy / s.A),
          J: s.A * Math.pow(s.t, 2) / 3,
          Cw: 0
        },
        shape: this.createAngleShape(s.a, s.b, s.t)
      };
      this.sections.set(s.name, profile);
    }
  }

  private addAISCWSections(): void {
    // Common W-shapes from AISC database
    const wSections: Array<{ name: string; d: number; bf: number; tw: number; tf: number; A: number; Ix: number; Iy: number }> = [
      { name: 'W6X9', d: 150.4, bf: 99.1, tw: 4.3, tf: 5.8, A: 1116, Ix: 6890000, Iy: 763000 },
      { name: 'W8X10', d: 200.9, bf: 99.1, tw: 4.3, tf: 5.3, A: 1290, Ix: 13400000, Iy: 722000 },
      { name: 'W10X12', d: 251.5, bf: 101.3, tw: 4.8, tf: 5.3, A: 1550, Ix: 23700000, Iy: 912000 },
      { name: 'W12X14', d: 302.3, bf: 101.3, tw: 4.8, tf: 5.7, A: 1810, Ix: 39800000, Iy: 980000 },
      { name: 'W14X22', d: 349.3, bf: 127.0, tw: 5.8, tf: 8.5, A: 2840, Ix: 82100000, Iy: 2900000 },
      { name: 'W16X26', d: 399.3, bf: 139.7, tw: 6.4, tf: 8.8, A: 3360, Ix: 134000000, Iy: 4430000 },
      { name: 'W18X35', d: 450.1, bf: 152.4, tw: 7.6, tf: 10.8, A: 4500, Ix: 222000000, Iy: 6730000 },
      { name: 'W21X44', d: 525.8, bf: 165.1, tw: 8.9, tf: 11.4, A: 5680, Ix: 350000000, Iy: 9080000 },
      { name: 'W24X55', d: 599.4, bf: 177.8, tw: 10.0, tf: 12.8, A: 7100, Ix: 562000000, Iy: 12200000 },
      { name: 'W27X84', d: 678.2, bf: 253.0, tw: 11.7, tf: 16.3, A: 10900, Ix: 1030000000, Iy: 44400000 },
      { name: 'W30X99', d: 752.9, bf: 265.4, tw: 13.2, tf: 17.0, A: 12800, Ix: 1490000000, Iy: 53300000 },
      { name: 'W33X118', d: 835.7, bf: 292.1, tw: 14.0, tf: 18.3, A: 15300, Ix: 2140000000, Iy: 74300000 },
      { name: 'W36X135', d: 903.4, bf: 303.3, tw: 15.2, tf: 20.1, A: 17400, Ix: 2960000000, Iy: 93500000 },
    ];

    for (const s of wSections) {
      const profile: SectionProfile = {
        type: 'W',
        name: s.name,
        dimensions: { d: s.d, bf: s.bf, tw: s.tw, tf: s.tf },
        properties: {
          A: s.A,
          Ix: s.Ix,
          Iy: s.Iy,
          Iz: s.Iy,
          Sx: s.Ix / (s.d / 2),
          Sy: s.Iy / (s.bf / 2),
          Zx: s.Ix / (s.d / 2) * 1.12,
          Zy: s.Iy / (s.bf / 2) * 1.5,
          rx: Math.sqrt(s.Ix / s.A),
          ry: Math.sqrt(s.Iy / s.A),
          J: (2 * s.bf * Math.pow(s.tf, 3) + (s.d - 2 * s.tf) * Math.pow(s.tw, 3)) / 3,
          Cw: (s.Iy * Math.pow(s.d - s.tf, 2)) / 4
        },
        shape: this.createIBeamShape(s.d, s.bf, s.tw, s.tf)
      };
      this.sections.set(s.name, profile);
    }
  }

  private addAISCHSSSections(): void {
    const hssSections: Array<{ name: string; Ht: number; B: number; t: number; A: number; Ix: number; Iy: number }> = [
      { name: 'HSS4X4X1/4', Ht: 101.6, B: 101.6, t: 6.35, A: 2323, Ix: 3690000, Iy: 3690000 },
      { name: 'HSS6X6X3/8', Ht: 152.4, B: 152.4, t: 9.53, A: 5413, Ix: 19300000, Iy: 19300000 },
      { name: 'HSS8X8X1/2', Ht: 203.2, B: 203.2, t: 12.7, A: 9677, Ix: 62800000, Iy: 62800000 },
      { name: 'HSS10X10X1/2', Ht: 254.0, B: 254.0, t: 12.7, A: 12260, Ix: 127000000, Iy: 127000000 },
      { name: 'HSS12X12X1/2', Ht: 304.8, B: 304.8, t: 12.7, A: 14840, Ix: 226000000, Iy: 226000000 },
    ];

    for (const s of hssSections) {
      const profile: SectionProfile = {
        type: 'HSS-RECT',
        name: s.name,
        dimensions: { Ht: s.Ht, B: s.B, t: s.t },
        properties: {
          A: s.A,
          Ix: s.Ix,
          Iy: s.Iy,
          Iz: Math.min(s.Ix, s.Iy),
          Sx: s.Ix / (s.Ht / 2),
          Sy: s.Iy / (s.B / 2),
          Zx: s.Ix / (s.Ht / 2) * 1.27,
          Zy: s.Iy / (s.B / 2) * 1.27,
          rx: Math.sqrt(s.Ix / s.A),
          ry: Math.sqrt(s.Iy / s.A),
          J: 2 * s.t * Math.pow((s.Ht - s.t) * (s.B - s.t), 2) / (s.Ht + s.B - 2 * s.t),
          Cw: 0
        },
        shape: this.createHSSShape(s.Ht, s.B, s.t)
      };
      this.sections.set(s.name, profile);
    }
  }

  // Shape creation methods
  private createIBeamShape(d: number, bf: number, tw: number, tf: number): THREE.Shape {
    const scale = 0.001; // mm to m
    const h = d * scale;
    const w = bf * scale;
    const tweb = tw * scale;
    const tflange = tf * scale;

    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -h / 2);
    shape.lineTo(w / 2, -h / 2);
    shape.lineTo(w / 2, -h / 2 + tflange);
    shape.lineTo(tweb / 2, -h / 2 + tflange);
    shape.lineTo(tweb / 2, h / 2 - tflange);
    shape.lineTo(w / 2, h / 2 - tflange);
    shape.lineTo(w / 2, h / 2);
    shape.lineTo(-w / 2, h / 2);
    shape.lineTo(-w / 2, h / 2 - tflange);
    shape.lineTo(-tweb / 2, h / 2 - tflange);
    shape.lineTo(-tweb / 2, -h / 2 + tflange);
    shape.lineTo(-w / 2, -h / 2 + tflange);
    shape.closePath();

    return shape;
  }

  private createChannelShape(d: number, bf: number, tw: number, tf: number): THREE.Shape {
    const scale = 0.001;
    const h = d * scale;
    const w = bf * scale;
    const tweb = tw * scale;
    const tflange = tf * scale;

    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -h / 2);
    shape.lineTo(w / 2, -h / 2);
    shape.lineTo(w / 2, -h / 2 + tflange);
    shape.lineTo(-w / 2 + tweb, -h / 2 + tflange);
    shape.lineTo(-w / 2 + tweb, h / 2 - tflange);
    shape.lineTo(w / 2, h / 2 - tflange);
    shape.lineTo(w / 2, h / 2);
    shape.lineTo(-w / 2, h / 2);
    shape.closePath();

    return shape;
  }

  private createAngleShape(a: number, b: number, t: number): THREE.Shape {
    const scale = 0.001;
    const legA = a * scale;
    const legB = b * scale;
    const thick = t * scale;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(legA, 0);
    shape.lineTo(legA, thick);
    shape.lineTo(thick, thick);
    shape.lineTo(thick, legB);
    shape.lineTo(0, legB);
    shape.closePath();

    return shape;
  }

  private createHSSShape(Ht: number, B: number, t: number): THREE.Shape {
    const scale = 0.001;
    const h = Ht * scale;
    const w = B * scale;
    const thick = t * scale;

    const outer = new THREE.Shape();
    outer.moveTo(-w / 2, -h / 2);
    outer.lineTo(w / 2, -h / 2);
    outer.lineTo(w / 2, h / 2);
    outer.lineTo(-w / 2, h / 2);
    outer.closePath();

    const hole = new THREE.Path();
    const iw = w - 2 * thick;
    const ih = h - 2 * thick;
    hole.moveTo(-iw / 2, -ih / 2);
    hole.lineTo(-iw / 2, ih / 2);
    hole.lineTo(iw / 2, ih / 2);
    hole.lineTo(iw / 2, -ih / 2);
    hole.closePath();

    outer.holes.push(hole);
    return outer;
  }

  /**
   * Get section by name
   */
  getSection(name: string): SectionProfile | undefined {
    return this.sections.get(name) || this.customSections.get(name);
  }

  /**
   * Add custom section
   */
  addCustomSection(profile: SectionProfile): void {
    this.customSections.set(profile.name, profile);
  }

  /**
   * Get all section names
   */
  getAllSectionNames(): string[] {
    return [...this.sections.keys(), ...this.customSections.keys()];
  }

  /**
   * Filter sections by type
   */
  getSectionsByType(type: SectionType): SectionProfile[] {
    const results: SectionProfile[] = [];
    for (const section of this.sections.values()) {
      if (section.type === type) {
        results.push(section);
      }
    }
    return results;
  }
}

// ============================================
// TRANSFORM OPERATIONS
// ============================================

export class TransformOperations {
  /**
   * Translate points
   */
  static translate(points: Point3D[], dx: number, dy: number, dz: number): Point3D[] {
    return points.map(p => ({
      x: p.x + dx,
      y: p.y + dy,
      z: p.z + dz
    }));
  }

  /**
   * Rotate points around an axis
   */
  static rotate(
    points: Point3D[],
    center: Point3D,
    axis: Point3D,
    angleDegrees: number
  ): Point3D[] {
    const angleRad = angleDegrees * Math.PI / 180;
    const axisVec = new THREE.Vector3(axis.x, axis.y, axis.z).normalize();
    const rotMatrix = new THREE.Matrix4().makeRotationAxis(axisVec, angleRad);
    const centerVec = new THREE.Vector3(center.x, center.y, center.z);

    return points.map(p => {
      const vec = new THREE.Vector3(p.x - center.x, p.y - center.y, p.z - center.z);
      vec.applyMatrix4(rotMatrix);
      return {
        x: vec.x + centerVec.x,
        y: vec.y + centerVec.y,
        z: vec.z + centerVec.z
      };
    });
  }

  /**
   * Scale points
   */
  static scale(
    points: Point3D[],
    center: Point3D,
    sx: number,
    sy: number,
    sz: number
  ): Point3D[] {
    return points.map(p => ({
      x: center.x + (p.x - center.x) * sx,
      y: center.y + (p.y - center.y) * sy,
      z: center.z + (p.z - center.z) * sz
    }));
  }

  /**
   * Mirror points across a plane
   */
  static mirror(
    points: Point3D[],
    planePoint: Point3D,
    planeNormal: Point3D
  ): Point3D[] {
    const normal = new THREE.Vector3(planeNormal.x, planeNormal.y, planeNormal.z).normalize();
    const d = -(normal.x * planePoint.x + normal.y * planePoint.y + normal.z * planePoint.z);

    return points.map(p => {
      const dist = normal.x * p.x + normal.y * p.y + normal.z * p.z + d;
      return {
        x: p.x - 2 * dist * normal.x,
        y: p.y - 2 * dist * normal.y,
        z: p.z - 2 * dist * normal.z
      };
    });
  }

  /**
   * Create linear array of points
   */
  static linearArray(
    points: Point3D[],
    direction: Point3D,
    spacing: number,
    count: number
  ): Point3D[][] {
    const results: Point3D[][] = [];
    const dirNorm = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
    const dx = (direction.x / dirNorm) * spacing;
    const dy = (direction.y / dirNorm) * spacing;
    const dz = (direction.z / dirNorm) * spacing;

    for (let i = 0; i < count; i++) {
      results.push(this.translate(points, dx * i, dy * i, dz * i));
    }

    return results;
  }

  /**
   * Create polar array of points
   */
  static polarArray(
    points: Point3D[],
    center: Point3D,
    axis: Point3D,
    totalAngle: number,
    count: number
  ): Point3D[][] {
    const results: Point3D[][] = [];
    const angleStep = totalAngle / count;

    for (let i = 0; i < count; i++) {
      results.push(this.rotate(points, center, axis, angleStep * i));
    }

    return results;
  }

  /**
   * Create rectangular array of points
   */
  static rectangularArray(
    points: Point3D[],
    spacingX: number,
    spacingY: number,
    spacingZ: number,
    countX: number,
    countY: number,
    countZ: number
  ): Point3D[][] {
    const results: Point3D[][] = [];

    for (let iz = 0; iz < countZ; iz++) {
      for (let iy = 0; iy < countY; iy++) {
        for (let ix = 0; ix < countX; ix++) {
          results.push(this.translate(
            points,
            spacingX * ix,
            spacingY * iy,
            spacingZ * iz
          ));
        }
      }
    }

    return results;
  }
}

// ============================================
// EXPORT SINGLETONS
// ============================================

export const coordinateSystemManager = new CoordinateSystemManager();
export const gridSnapManager = new GridSnapManager();
export const sectionLibrary = new SectionProfileLibrary();

export default {
  CoordinateSystemManager,
  LocalCoordinateSystem,
  GridSnapManager,
  SectionProfileLibrary,
  TransformOperations,
  coordinateSystemManager,
  gridSnapManager,
  sectionLibrary
};
