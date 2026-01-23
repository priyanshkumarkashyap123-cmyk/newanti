/**
 * StructuralVisualization.ts
 * 
 * Advanced Structural Analysis Visualization - STAAD.Pro Level
 * 
 * Features:
 * - Bending Moment Diagram (BMD)
 * - Shear Force Diagram (SFD)
 * - Axial Force Diagram (AFD)
 * - Deflected Shape Visualization
 * - Stress Contours
 * - Reaction Arrows
 * - Load Visualization
 * - Animation of deflection/vibration modes
 * - Color-coded utilization ratios
 * - Section property displays
 */

import * as THREE from 'three';
import { ColorScales } from './AdvancedRenderingEngine';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface MemberForces {
  memberId: string;
  startNode: string;
  endNode: string;
  // Local coordinates (positions along member 0-1)
  positions: number[];
  // Force values at each position
  axialForce: number[];      // P (kN)
  shearForceY: number[];     // Vy (kN)
  shearForceZ: number[];     // Vz (kN)
  torsion: number[];         // T (kN·m)
  bendingMomentY: number[];  // My (kN·m)
  bendingMomentZ: number[];  // Mz (kN·m)
}

export interface NodeDisplacements {
  nodeId: string;
  position: THREE.Vector3;
  displacement: THREE.Vector3;  // dx, dy, dz (mm)
  rotation: THREE.Vector3;      // rx, ry, rz (rad)
}

export interface MemberStresses {
  memberId: string;
  positions: number[];
  axialStress: number[];      // σa (MPa)
  bendingStressY: number[];   // σby (MPa)
  bendingStressZ: number[];   // σbz (MPa)
  shearStressY: number[];     // τy (MPa)
  shearStressZ: number[];     // τz (MPa)
  vonMisesStress: number[];   // σvm (MPa)
  utilizationRatio: number[]; // Demand/Capacity
}

export interface ReactionForce {
  nodeId: string;
  position: THREE.Vector3;
  forces: THREE.Vector3;      // Fx, Fy, Fz (kN)
  moments: THREE.Vector3;     // Mx, My, Mz (kN·m)
}

export interface LoadVisualization {
  id: string;
  type: 'point' | 'distributed' | 'moment' | 'temperature' | 'prestress';
  targetType: 'node' | 'member' | 'area';
  targetId: string;
  values: number[];
  direction?: THREE.Vector3;
  startPosition?: number;  // For member loads (0-1)
  endPosition?: number;
}

export interface DiagramSettings {
  diagramType: 'BMD' | 'SFD' | 'AFD' | 'torsion' | 'deflection' | 'stress' | 'utilization';
  scale: number;
  fillColor: THREE.Color;
  lineColor: THREE.Color;
  showValues: boolean;
  showBaseline: boolean;
  fillOpacity: number;
  segments: number;
  offsetFromMember: number;
}

export interface DeflectionSettings {
  scale: number;
  showOriginal: boolean;
  originalOpacity: number;
  animationSpeed: number;
  showDisplacementVectors: boolean;
  colorByMagnitude: boolean;
}

export interface ModeShapeSettings {
  modeNumber: number;
  scale: number;
  animationSpeed: number;
  showPhase: boolean;
  colorByAmplitude: boolean;
}

// ============================================
// DIAGRAM GENERATORS
// ============================================

export class DiagramGenerator {
  private scene: THREE.Scene;
  private diagramGroup: THREE.Group;
  private labelGroup: THREE.Group;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.diagramGroup = new THREE.Group();
    this.diagramGroup.name = 'DiagramGroup';
    this.labelGroup = new THREE.Group();
    this.labelGroup.name = 'LabelGroup';
    this.scene.add(this.diagramGroup);
    this.scene.add(this.labelGroup);
  }

  /**
   * Generate Bending Moment Diagram
   */
  generateBMD(
    memberForces: MemberForces,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    settings: Partial<DiagramSettings> = {}
  ): THREE.Group {
    const config: DiagramSettings = {
      diagramType: 'BMD',
      scale: 0.01,
      fillColor: new THREE.Color(0x4ecdc4),
      lineColor: new THREE.Color(0x2a9d8f),
      showValues: true,
      showBaseline: true,
      fillOpacity: 0.6,
      segments: 20,
      offsetFromMember: 0.1,
      ...settings
    };

    return this.generateForceDiagram(
      memberForces.bendingMomentZ,
      memberForces.positions,
      startPos,
      endPos,
      config,
      'y' // BMD typically drawn perpendicular to member in local y
    );
  }

  /**
   * Generate Shear Force Diagram
   */
  generateSFD(
    memberForces: MemberForces,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    settings: Partial<DiagramSettings> = {}
  ): THREE.Group {
    const config: DiagramSettings = {
      diagramType: 'SFD',
      scale: 0.02,
      fillColor: new THREE.Color(0xff6b6b),
      lineColor: new THREE.Color(0xc92a2a),
      showValues: true,
      showBaseline: true,
      fillOpacity: 0.6,
      segments: 20,
      offsetFromMember: 0.1,
      ...settings
    };

    return this.generateForceDiagram(
      memberForces.shearForceY,
      memberForces.positions,
      startPos,
      endPos,
      config,
      'y'
    );
  }

  /**
   * Generate Axial Force Diagram
   */
  generateAFD(
    memberForces: MemberForces,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    settings: Partial<DiagramSettings> = {}
  ): THREE.Group {
    const config: DiagramSettings = {
      diagramType: 'AFD',
      scale: 0.015,
      fillColor: new THREE.Color(0xffd93d),
      lineColor: new THREE.Color(0xf5a623),
      showValues: true,
      showBaseline: true,
      fillOpacity: 0.6,
      segments: 20,
      offsetFromMember: 0.1,
      ...settings
    };

    return this.generateForceDiagram(
      memberForces.axialForce,
      memberForces.positions,
      startPos,
      endPos,
      config,
      'z' // AFD drawn in z direction to differentiate from BMD/SFD
    );
  }

  /**
   * Generic force diagram generator
   */
  private generateForceDiagram(
    values: number[],
    positions: number[],
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    settings: DiagramSettings,
    perpAxis: 'y' | 'z'
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `${settings.diagramType}_Diagram`;

    // Calculate member direction and perpendicular direction
    const memberDir = new THREE.Vector3().subVectors(endPos, startPos);
    const memberLength = memberDir.length();
    memberDir.normalize();

    // Get perpendicular direction
    const perpDir = this.getPerpendicularDirection(memberDir, perpAxis);

    // Interpolate values for smooth diagram
    const interpolated = this.interpolateValues(values, positions, settings.segments);

    // Create shape for filled diagram
    const shape = new THREE.Shape();
    const points: THREE.Vector3[] = [];

    // Start at baseline
    const baseStart = startPos.clone().add(perpDir.clone().multiplyScalar(settings.offsetFromMember));
    shape.moveTo(0, 0);

    // Build diagram points
    for (let i = 0; i <= settings.segments; i++) {
      const t = i / settings.segments;
      const value = interpolated[i];
      const basePoint = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      basePoint.add(perpDir.clone().multiplyScalar(settings.offsetFromMember));
      
      const diagramPoint = basePoint.clone().add(
        perpDir.clone().multiplyScalar(value * settings.scale)
      );
      
      points.push(diagramPoint);
      
      // For shape (2D projected)
      const x = t * memberLength;
      const y = value * settings.scale;
      shape.lineTo(x, y);
    }

    // Close shape back to baseline
    shape.lineTo(memberLength, 0);
    shape.closePath();

    // Create filled mesh
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
      color: settings.fillColor,
      opacity: settings.fillOpacity,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position and orient the mesh
    this.orientDiagramMesh(mesh, startPos, memberDir, perpDir, settings.offsetFromMember);
    group.add(mesh);

    // Create outline
    const linePoints: THREE.Vector3[] = [baseStart];
    linePoints.push(...points);
    const baseEnd = endPos.clone().add(perpDir.clone().multiplyScalar(settings.offsetFromMember));
    linePoints.push(baseEnd);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: settings.lineColor,
      linewidth: 2
    });
    const outline = new THREE.Line(lineGeometry, lineMaterial);
    group.add(outline);

    // Add baseline if enabled
    if (settings.showBaseline) {
      const baselineGeom = new THREE.BufferGeometry().setFromPoints([baseStart, baseEnd]);
      const baselineMat = new THREE.LineDashedMaterial({
        color: 0x666666,
        dashSize: 0.1,
        gapSize: 0.05
      });
      const baseline = new THREE.Line(baselineGeom, baselineMat);
      baseline.computeLineDistances();
      group.add(baseline);
    }

    // Add value labels at key points
    if (settings.showValues) {
      this.addDiagramLabels(group, values, positions, startPos, endPos, perpDir, settings);
    }

    this.diagramGroup.add(group);
    return group;
  }

  /**
   * Get perpendicular direction for diagram
   */
  private getPerpendicularDirection(memberDir: THREE.Vector3, axis: 'y' | 'z'): THREE.Vector3 {
    const globalY = new THREE.Vector3(0, 1, 0);
    const globalZ = new THREE.Vector3(0, 0, 1);

    // If member is nearly vertical, use different reference
    if (Math.abs(memberDir.dot(globalY)) > 0.99) {
      return axis === 'y' ? globalZ.clone() : new THREE.Vector3(1, 0, 0);
    }

    // Calculate local y (perpendicular to member, in vertical plane)
    const localZ = new THREE.Vector3().crossVectors(memberDir, globalY).normalize();
    const localY = new THREE.Vector3().crossVectors(localZ, memberDir).normalize();

    return axis === 'y' ? localY : localZ;
  }

  /**
   * Interpolate values for smoother diagram
   */
  private interpolateValues(values: number[], positions: number[], segments: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      result.push(this.interpolateAtPosition(values, positions, t));
    }
    
    return result;
  }

  /**
   * Interpolate value at specific position
   */
  private interpolateAtPosition(values: number[], positions: number[], t: number): number {
    // Find surrounding points
    let i = 0;
    while (i < positions.length - 1 && positions[i + 1] < t) {
      i++;
    }

    if (i >= positions.length - 1) return values[values.length - 1];
    if (t <= positions[0]) return values[0];

    // Linear interpolation
    const t0 = positions[i];
    const t1 = positions[i + 1];
    const v0 = values[i];
    const v1 = values[i + 1];

    const localT = (t - t0) / (t1 - t0);
    return v0 + (v1 - v0) * localT;
  }

  /**
   * Orient diagram mesh in 3D space
   */
  private orientDiagramMesh(
    mesh: THREE.Mesh,
    startPos: THREE.Vector3,
    memberDir: THREE.Vector3,
    perpDir: THREE.Vector3,
    offset: number
  ): void {
    // Create rotation matrix to orient the mesh
    const normal = new THREE.Vector3().crossVectors(memberDir, perpDir).normalize();
    
    const rotMatrix = new THREE.Matrix4();
    rotMatrix.makeBasis(memberDir, perpDir, normal);
    
    mesh.applyMatrix4(rotMatrix);
    mesh.position.copy(startPos).add(perpDir.clone().multiplyScalar(offset));
  }

  /**
   * Add value labels to diagram
   */
  private addDiagramLabels(
    group: THREE.Group,
    values: number[],
    positions: number[],
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    perpDir: THREE.Vector3,
    settings: DiagramSettings
  ): void {
    // Find max and min values with their positions
    let maxVal = -Infinity;
    let minVal = Infinity;
    let maxPos = 0;
    let minPos = 0;

    for (let i = 0; i < values.length; i++) {
      if (values[i] > maxVal) {
        maxVal = values[i];
        maxPos = positions[i];
      }
      if (values[i] < minVal) {
        minVal = values[i];
        minPos = positions[i];
      }
    }

    // Add labels at max, min, and ends
    const labelPositions = [
      { pos: 0, val: values[0] },
      { pos: 1, val: values[values.length - 1] },
    ];

    if (maxPos !== 0 && maxPos !== 1) {
      labelPositions.push({ pos: maxPos, val: maxVal });
    }
    if (minPos !== 0 && minPos !== 1 && minPos !== maxPos) {
      labelPositions.push({ pos: minPos, val: minVal });
    }

    // Create sprite labels (simplified - in production use Text geometry or sprites)
    for (const label of labelPositions) {
      const worldPos = new THREE.Vector3().lerpVectors(startPos, endPos, label.pos);
      worldPos.add(perpDir.clone().multiplyScalar(
        settings.offsetFromMember + Math.abs(label.val) * settings.scale + 0.2
      ));

      // Create a small sphere as label placeholder
      // In production, use TextGeometry or CSS2DRenderer for actual text
      const labelGeom = new THREE.SphereGeometry(0.05);
      const labelMat = new THREE.MeshBasicMaterial({ color: settings.lineColor });
      const labelMesh = new THREE.Mesh(labelGeom, labelMat);
      labelMesh.position.copy(worldPos);
      labelMesh.userData = { value: label.val.toFixed(2), type: 'label' };
      group.add(labelMesh);
    }
  }

  /**
   * Clear all diagrams
   */
  clearDiagrams(): void {
    while (this.diagramGroup.children.length > 0) {
      const child = this.diagramGroup.children[0];
      this.diagramGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    while (this.labelGroup.children.length > 0) {
      const child = this.labelGroup.children[0];
      this.labelGroup.remove(child);
    }
  }
}

// ============================================
// DEFLECTED SHAPE VISUALIZER
// ============================================

export class DeflectedShapeVisualizer {
  private scene: THREE.Scene;
  private deflectedGroup: THREE.Group;
  private originalGroup: THREE.Group;
  private animationId: number = 0;
  private animationPhase: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.deflectedGroup = new THREE.Group();
    this.deflectedGroup.name = 'DeflectedShape';
    this.originalGroup = new THREE.Group();
    this.originalGroup.name = 'OriginalShape';
    this.scene.add(this.deflectedGroup);
    this.scene.add(this.originalGroup);
  }

  /**
   * Generate deflected shape for the entire structure
   */
  generateDeflectedShape(
    members: Array<{
      id: string;
      startPos: THREE.Vector3;
      endPos: THREE.Vector3;
      startDisp: THREE.Vector3;
      endDisp: THREE.Vector3;
      intermediateDisp?: Array<{ t: number; disp: THREE.Vector3 }>;
    }>,
    settings: DeflectionSettings = {
      scale: 100,
      showOriginal: true,
      originalOpacity: 0.3,
      animationSpeed: 0,
      showDisplacementVectors: false,
      colorByMagnitude: true
    }
  ): void {
    this.clearDeflectedShape();

    // Find max displacement for color scaling
    let maxDisp = 0;
    for (const member of members) {
      const startMag = member.startDisp.length();
      const endMag = member.endDisp.length();
      maxDisp = Math.max(maxDisp, startMag, endMag);
      if (member.intermediateDisp) {
        for (const interp of member.intermediateDisp) {
          maxDisp = Math.max(maxDisp, interp.disp.length());
        }
      }
    }

    for (const member of members) {
      // Create original member (ghost)
      if (settings.showOriginal) {
        const originalGeom = new THREE.BufferGeometry();
        originalGeom.setFromPoints([member.startPos, member.endPos]);
        const originalMat = new THREE.LineBasicMaterial({
          color: 0x666666,
          opacity: settings.originalOpacity,
          transparent: true
        });
        const originalLine = new THREE.Line(originalGeom, originalMat);
        this.originalGroup.add(originalLine);
      }

      // Create deflected member
      const deflectedPoints: THREE.Vector3[] = [];
      const colors: number[] = [];

      // Start point
      const startDeflected = member.startPos.clone().add(
        member.startDisp.clone().multiplyScalar(settings.scale)
      );
      deflectedPoints.push(startDeflected);

      if (settings.colorByMagnitude) {
        const color = this.getDisplacementColor(member.startDisp.length(), maxDisp);
        colors.push(color.r, color.g, color.b);
      }

      // Intermediate points (for curved deflection)
      if (member.intermediateDisp && member.intermediateDisp.length > 0) {
        for (const interp of member.intermediateDisp) {
          const basePos = new THREE.Vector3().lerpVectors(
            member.startPos,
            member.endPos,
            interp.t
          );
          const deflectedPos = basePos.add(interp.disp.clone().multiplyScalar(settings.scale));
          deflectedPoints.push(deflectedPos);

          if (settings.colorByMagnitude) {
            const color = this.getDisplacementColor(interp.disp.length(), maxDisp);
            colors.push(color.r, color.g, color.b);
          }
        }
      }

      // End point
      const endDeflected = member.endPos.clone().add(
        member.endDisp.clone().multiplyScalar(settings.scale)
      );
      deflectedPoints.push(endDeflected);

      if (settings.colorByMagnitude) {
        const color = this.getDisplacementColor(member.endDisp.length(), maxDisp);
        colors.push(color.r, color.g, color.b);
      }

      // Create deflected line with colors
      const deflectedGeom = new THREE.BufferGeometry().setFromPoints(deflectedPoints);
      
      if (settings.colorByMagnitude) {
        deflectedGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const deflectedMat = new THREE.LineBasicMaterial({
          vertexColors: true,
          linewidth: 2
        });
        const deflectedLine = new THREE.Line(deflectedGeom, deflectedMat);
        this.deflectedGroup.add(deflectedLine);
      } else {
        const deflectedMat = new THREE.LineBasicMaterial({
          color: 0x00ff88,
          linewidth: 2
        });
        const deflectedLine = new THREE.Line(deflectedGeom, deflectedMat);
        this.deflectedGroup.add(deflectedLine);
      }

      // Add displacement vectors
      if (settings.showDisplacementVectors) {
        this.addDisplacementVector(member.startPos, member.startDisp, settings.scale);
        this.addDisplacementVector(member.endPos, member.endDisp, settings.scale);
      }
    }
  }

  /**
   * Get color based on displacement magnitude
   */
  private getDisplacementColor(magnitude: number, maxMagnitude: number): THREE.Color {
    const t = magnitude / (maxMagnitude || 1);
    const colorScale = ColorScales.displacement;
    
    // Map t to color scale
    const scaleIndex = t * (colorScale.length - 1);
    const lowIndex = Math.floor(scaleIndex);
    const highIndex = Math.min(lowIndex + 1, colorScale.length - 1);
    const localT = scaleIndex - lowIndex;

    const color = new THREE.Color();
    color.lerpColors(colorScale[lowIndex], colorScale[highIndex], localT);
    return color;
  }

  /**
   * Add displacement vector arrow
   */
  private addDisplacementVector(
    position: THREE.Vector3,
    displacement: THREE.Vector3,
    scale: number
  ): void {
    const length = displacement.length() * scale;
    if (length < 0.01) return; // Skip tiny displacements

    const dir = displacement.clone().normalize();
    const arrowHelper = new THREE.ArrowHelper(
      dir,
      position,
      length,
      0xff8800,
      length * 0.2,
      length * 0.1
    );
    this.deflectedGroup.add(arrowHelper);
  }

  /**
   * Animate deflected shape
   */
  startAnimation(speed: number = 1): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const animate = () => {
      this.animationPhase += 0.02 * speed;
      const factor = Math.sin(this.animationPhase);

      // Scale all deflected positions by sin factor
      this.deflectedGroup.traverse((child) => {
        if (child instanceof THREE.Line) {
          const positions = child.geometry.attributes.position;
          // Animation logic would modify positions
          positions.needsUpdate = true;
        }
      });

      this.animationId = requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Stop animation
   */
  stopAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
  }

  /**
   * Clear deflected shape visualization
   */
  clearDeflectedShape(): void {
    this.stopAnimation();
    
    const clearGroup = (group: THREE.Group) => {
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    };

    clearGroup(this.deflectedGroup);
    clearGroup(this.originalGroup);
  }
}

// ============================================
// LOAD VISUALIZER
// ============================================

export class LoadVisualizer {
  private scene: THREE.Scene;
  private loadGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.loadGroup = new THREE.Group();
    this.loadGroup.name = 'LoadVisualization';
    this.scene.add(this.loadGroup);
  }

  /**
   * Visualize point load
   */
  addPointLoad(
    position: THREE.Vector3,
    magnitude: number,
    direction: THREE.Vector3,
    color: number = 0xff4444
  ): THREE.Group {
    const group = new THREE.Group();
    const normalizedDir = direction.clone().normalize();
    const arrowLength = Math.min(Math.abs(magnitude) * 0.1, 3);

    // Arrow starting point (offset from application point)
    const startPoint = position.clone().sub(normalizedDir.clone().multiplyScalar(arrowLength));

    const arrow = new THREE.ArrowHelper(
      normalizedDir,
      startPoint,
      arrowLength,
      color,
      arrowLength * 0.3,
      arrowLength * 0.15
    );
    group.add(arrow);

    // Add magnitude label placeholder
    const labelGeom = new THREE.SphereGeometry(0.08);
    const labelMat = new THREE.MeshBasicMaterial({ color });
    const label = new THREE.Mesh(labelGeom, labelMat);
    label.position.copy(startPoint).sub(normalizedDir.clone().multiplyScalar(0.3));
    label.userData = { type: 'loadLabel', value: magnitude };
    group.add(label);

    group.userData = { type: 'pointLoad', magnitude };
    this.loadGroup.add(group);
    return group;
  }

  /**
   * Visualize distributed load (UDL)
   */
  addDistributedLoad(
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    magnitudeStart: number,
    magnitudeEnd: number,
    direction: THREE.Vector3,
    color: number = 0x4444ff
  ): THREE.Group {
    const group = new THREE.Group();
    const normalizedDir = direction.clone().normalize();
    const numArrows = 8;

    // Draw load distribution outline
    const outlinePoints: THREE.Vector3[] = [];
    const maxMag = Math.max(Math.abs(magnitudeStart), Math.abs(magnitudeEnd));
    const scaleFactor = Math.min(maxMag * 0.05, 2);

    // Top line of load distribution
    for (let i = 0; i <= numArrows; i++) {
      const t = i / numArrows;
      const pos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      const mag = magnitudeStart + (magnitudeEnd - magnitudeStart) * t;
      const offsetPos = pos.clone().sub(normalizedDir.clone().multiplyScalar(Math.abs(mag) * scaleFactor));
      outlinePoints.push(offsetPos);
    }

    // Bottom line (along member)
    outlinePoints.push(endPos.clone());
    outlinePoints.push(startPos.clone());

    const outlineGeom = new THREE.BufferGeometry().setFromPoints(outlinePoints);
    const outlineMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    const outline = new THREE.LineLoop(outlineGeom, outlineMat);
    group.add(outline);

    // Fill (semi-transparent)
    const fillShape = new THREE.Shape();
    // Create 2D shape for fill (project onto plane)
    const memberDir = new THREE.Vector3().subVectors(endPos, startPos);
    const memberLength = memberDir.length();
    
    fillShape.moveTo(0, 0);
    for (let i = 0; i <= numArrows; i++) {
      const t = i / numArrows;
      const mag = magnitudeStart + (magnitudeEnd - magnitudeStart) * t;
      fillShape.lineTo(t * memberLength, -Math.abs(mag) * scaleFactor);
    }
    fillShape.lineTo(memberLength, 0);
    fillShape.closePath();

    const fillGeom = new THREE.ShapeGeometry(fillShape);
    const fillMat = new THREE.MeshBasicMaterial({
      color,
      opacity: 0.3,
      transparent: true,
      side: THREE.DoubleSide
    });
    const fillMesh = new THREE.Mesh(fillGeom, fillMat);

    // Orient fill mesh
    const perpDir = this.getPerpendicularDirection(memberDir.normalize(), direction);
    const rotMatrix = new THREE.Matrix4();
    rotMatrix.makeBasis(memberDir.normalize(), perpDir, normalizedDir);
    fillMesh.applyMatrix4(rotMatrix);
    fillMesh.position.copy(startPos);
    group.add(fillMesh);

    // Add arrows
    for (let i = 0; i <= numArrows; i++) {
      const t = i / numArrows;
      const pos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      const mag = magnitudeStart + (magnitudeEnd - magnitudeStart) * t;
      const arrowLength = Math.abs(mag) * scaleFactor;

      if (arrowLength > 0.1) {
        const arrowStart = pos.clone().sub(normalizedDir.clone().multiplyScalar(arrowLength));
        const arrow = new THREE.ArrowHelper(
          normalizedDir,
          arrowStart,
          arrowLength,
          color,
          arrowLength * 0.3,
          arrowLength * 0.1
        );
        group.add(arrow);
      }
    }

    group.userData = { type: 'distributedLoad', magnitudeStart, magnitudeEnd };
    this.loadGroup.add(group);
    return group;
  }

  /**
   * Visualize moment load
   */
  addMomentLoad(
    position: THREE.Vector3,
    magnitude: number,
    axis: THREE.Vector3,
    color: number = 0x44ff44
  ): THREE.Group {
    const group = new THREE.Group();
    const normalizedAxis = axis.clone().normalize();
    const radius = Math.min(Math.abs(magnitude) * 0.02, 1);

    // Create curved arrow for moment
    const curve = new THREE.EllipseCurve(
      0, 0,           // center
      radius, radius, // x/y radius
      0, Math.PI * 1.5, // start/end angle
      false,          // clockwise
      0               // rotation
    );

    const curvePoints = curve.getPoints(32);
    const curveGeom = new THREE.BufferGeometry().setFromPoints(
      curvePoints.map(p => new THREE.Vector3(p.x, p.y, 0))
    );
    const curveMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    const curveLine = new THREE.Line(curveGeom, curveMat);

    // Orient curve perpendicular to moment axis
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalizedAxis);
    curveLine.quaternion.copy(quaternion);
    curveLine.position.copy(position);
    group.add(curveLine);

    // Add arrowhead at end of curve
    const lastPoint = curvePoints[curvePoints.length - 1];
    const arrowDir = new THREE.Vector3(-lastPoint.y, lastPoint.x, 0).normalize();
    arrowDir.applyQuaternion(quaternion);
    
    const arrowPos = new THREE.Vector3(lastPoint.x, lastPoint.y, 0);
    arrowPos.applyQuaternion(quaternion);
    arrowPos.add(position);

    const arrowHelper = new THREE.ArrowHelper(
      arrowDir,
      arrowPos,
      radius * 0.3,
      color,
      radius * 0.2,
      radius * 0.1
    );
    group.add(arrowHelper);

    group.userData = { type: 'momentLoad', magnitude };
    this.loadGroup.add(group);
    return group;
  }

  /**
   * Get perpendicular direction
   */
  private getPerpendicularDirection(memberDir: THREE.Vector3, loadDir: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3().crossVectors(memberDir, loadDir).normalize();
  }

  /**
   * Clear all load visualizations
   */
  clearLoads(): void {
    while (this.loadGroup.children.length > 0) {
      const child = this.loadGroup.children[0];
      this.loadGroup.remove(child);
      if (child instanceof THREE.Group) {
        child.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
      }
    }
  }
}

// ============================================
// REACTION VISUALIZER
// ============================================

export class ReactionVisualizer {
  private scene: THREE.Scene;
  private reactionGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.reactionGroup = new THREE.Group();
    this.reactionGroup.name = 'ReactionVisualization';
    this.scene.add(this.reactionGroup);
  }

  /**
   * Visualize reaction forces and moments
   */
  addReaction(reaction: ReactionForce, scale: number = 0.01): THREE.Group {
    const group = new THREE.Group();

    // Force arrows
    const forceColor = 0x00aa00;
    const momentColor = 0xaa00aa;

    // Fx
    if (Math.abs(reaction.forces.x) > 0.001) {
      const dir = new THREE.Vector3(Math.sign(reaction.forces.x), 0, 0);
      const length = Math.abs(reaction.forces.x) * scale;
      const arrow = new THREE.ArrowHelper(
        dir,
        reaction.position.clone().sub(dir.clone().multiplyScalar(length)),
        length,
        forceColor,
        length * 0.3,
        length * 0.15
      );
      group.add(arrow);
    }

    // Fy
    if (Math.abs(reaction.forces.y) > 0.001) {
      const dir = new THREE.Vector3(0, Math.sign(reaction.forces.y), 0);
      const length = Math.abs(reaction.forces.y) * scale;
      const arrow = new THREE.ArrowHelper(
        dir,
        reaction.position.clone().sub(dir.clone().multiplyScalar(length)),
        length,
        forceColor,
        length * 0.3,
        length * 0.15
      );
      group.add(arrow);
    }

    // Fz
    if (Math.abs(reaction.forces.z) > 0.001) {
      const dir = new THREE.Vector3(0, 0, Math.sign(reaction.forces.z));
      const length = Math.abs(reaction.forces.z) * scale;
      const arrow = new THREE.ArrowHelper(
        dir,
        reaction.position.clone().sub(dir.clone().multiplyScalar(length)),
        length,
        forceColor,
        length * 0.3,
        length * 0.15
      );
      group.add(arrow);
    }

    // Moment arrows (simplified as double-headed arrows)
    const addMomentArrow = (value: number, axis: THREE.Vector3) => {
      if (Math.abs(value) < 0.001) return;
      
      const radius = Math.abs(value) * scale * 0.5;
      const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 1.5, false);
      const points = curve.getPoints(24);
      const geom = new THREE.BufferGeometry().setFromPoints(
        points.map(p => new THREE.Vector3(p.x, p.y, 0))
      );
      const mat = new THREE.LineBasicMaterial({ color: momentColor });
      const line = new THREE.Line(geom, mat);
      
      const quat = new THREE.Quaternion();
      quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
      line.quaternion.copy(quat);
      line.position.copy(reaction.position);
      group.add(line);
    };

    addMomentArrow(reaction.moments.x, new THREE.Vector3(1, 0, 0));
    addMomentArrow(reaction.moments.y, new THREE.Vector3(0, 1, 0));
    addMomentArrow(reaction.moments.z, new THREE.Vector3(0, 0, 1));

    group.userData = { type: 'reaction', nodeId: reaction.nodeId };
    this.reactionGroup.add(group);
    return group;
  }

  /**
   * Clear all reactions
   */
  clearReactions(): void {
    while (this.reactionGroup.children.length > 0) {
      const child = this.reactionGroup.children[0];
      this.reactionGroup.remove(child);
    }
  }
}

// ============================================
// EXPORT
// ============================================

export {
  DiagramGenerator,
  DeflectedShapeVisualizer,
  LoadVisualizer,
  ReactionVisualizer
};

export default {
  DiagramGenerator,
  DeflectedShapeVisualizer,
  LoadVisualizer,
  ReactionVisualizer
};
