/**
 * AnalysisResultRenderer.ts
 * 
 * Advanced Analysis Results Visualization
 * Professional-grade rendering like STAAD.Pro / ETABS
 * 
 * Features:
 * - Stress contours with color mapping
 * - Utilization ratio visualization
 * - Mode shape animation
 * - Result tables and legends
 * - Interactive result picking
 * - Export capabilities
 */

import * as THREE from 'three';
import { ColorScales } from './AdvancedRenderingEngine';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface StressResult {
  memberId: string;
  nodePositions: THREE.Vector3[];
  stressValues: StressComponents[];
}

export interface StressComponents {
  axial: number;       // σa (MPa)
  bendingY: number;    // σby (MPa)
  bendingZ: number;    // σbz (MPa)
  shearY: number;      // τy (MPa)
  shearZ: number;      // τz (MPa)
  torsion: number;     // τt (MPa)
  vonMises: number;    // σvm (MPa)
  principal1: number;  // σ1 (MPa)
  principal2: number;  // σ2 (MPa)
  principal3: number;  // σ3 (MPa)
}

export interface UtilizationResult {
  memberId: string;
  checkType: UtilizationCheckType;
  demandCapacityRatio: number;
  governingLoadCase: string;
  governingPosition: number;  // 0-1 along member
  details: UtilizationDetails;
}

export type UtilizationCheckType = 
  | 'axial_tension'
  | 'axial_compression'
  | 'flexure_major'
  | 'flexure_minor'
  | 'shear_major'
  | 'shear_minor'
  | 'combined_axial_flexure'
  | 'lateral_torsional_buckling'
  | 'local_buckling'
  | 'deflection';

export interface UtilizationDetails {
  demand: number;
  capacity: number;
  codeReference: string;
  equation?: string;
  factors?: Record<string, number>;
}

export interface ModeShapeResult {
  modeNumber: number;
  frequency: number;        // Hz
  period: number;           // seconds
  massParticipation: {
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
  };
  nodeDisplacements: Map<string, THREE.Vector3>;
  description: string;
}

export interface ContourSettings {
  colorScale: keyof typeof ColorScales;
  minValue: number;
  maxValue: number;
  numContours: number;
  showLegend: boolean;
  legendPosition: 'left' | 'right' | 'top' | 'bottom';
  opacity: number;
  wireframeOverlay: boolean;
}

export interface LegendConfig {
  title: string;
  unit: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  numTicks: number;
  precision: number;
}

// ============================================
// STRESS CONTOUR RENDERER
// ============================================

export class StressContourRenderer {
  private scene: THREE.Scene;
  private contourGroup: THREE.Group;
  private legendSprite: THREE.Sprite | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.contourGroup = new THREE.Group();
    this.contourGroup.name = 'StressContours';
    this.scene.add(this.contourGroup);
  }

  /**
   * Render stress contours on members
   */
  renderStressContours(
    stressResults: StressResult[],
    stressType: keyof StressComponents,
    settings: Partial<ContourSettings> = {}
  ): void {
    this.clearContours();

    const config: ContourSettings = {
      colorScale: 'stress',
      minValue: 0,
      maxValue: 250, // Default yield stress
      numContours: 10,
      showLegend: true,
      legendPosition: 'right',
      opacity: 1.0,
      wireframeOverlay: true,
      ...settings
    };

    // Auto-calculate min/max if not provided
    if (config.minValue === 0 && config.maxValue === 250) {
      let min = Infinity;
      let max = -Infinity;
      for (const result of stressResults) {
        for (const stress of result.stressValues) {
          const value = stress[stressType];
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }
      config.minValue = min;
      config.maxValue = max;
    }

    // Render each member with stress colors
    for (const result of stressResults) {
      this.renderMemberStress(result, stressType, config);
    }

    // Add legend
    if (config.showLegend) {
      this.createLegend({
        title: this.getStressTitle(stressType),
        unit: 'MPa',
        position: this.getLegendPosition(config.legendPosition),
        size: { width: 30, height: 200 },
        numTicks: 6,
        precision: 1
      }, config);
    }
  }

  /**
   * Render stress on a single member
   */
  private renderMemberStress(
    result: StressResult,
    stressType: keyof StressComponents,
    config: ContourSettings
  ): void {
    const colorScale = ColorScales[config.colorScale];
    const segments = result.nodePositions.length - 1;

    for (let i = 0; i < segments; i++) {
      const startPos = result.nodePositions[i];
      const endPos = result.nodePositions[i + 1];
      const startStress = result.stressValues[i][stressType];
      const endStress = result.stressValues[i + 1][stressType];

      // Create gradient-colored cylinder segment
      const direction = new THREE.Vector3().subVectors(endPos, startPos);
      const length = direction.length();
      const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);

      const geometry = new THREE.CylinderGeometry(0.05, 0.05, length, 8, 1);
      
      // Apply vertex colors for gradient
      const colors = [];
      const positionAttr = geometry.getAttribute('position');
      
      for (let j = 0; j < positionAttr.count; j++) {
        const y = positionAttr.getY(j);
        const t = (y + length / 2) / length; // 0 at start, 1 at end
        const stress = startStress + (endStress - startStress) * t;
        const color = this.interpolateColor(stress, config.minValue, config.maxValue, colorScale);
        colors.push(color.r, color.g, color.b);
      }

      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.3,
        roughness: 0.6,
        opacity: config.opacity,
        transparent: config.opacity < 1
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      // Orient and position
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      mesh.quaternion.copy(quaternion);
      mesh.position.copy(midPoint);

      mesh.userData = {
        type: 'stressContour',
        memberId: result.memberId,
        segment: i,
        stressStart: startStress,
        stressEnd: endStress
      };

      this.contourGroup.add(mesh);

      // Add wireframe overlay
      if (config.wireframeOverlay) {
        const wireGeom = new THREE.EdgesGeometry(geometry);
        const wireMat = new THREE.LineBasicMaterial({ color: 0x333333, opacity: 0.5, transparent: true });
        const wireframe = new THREE.LineSegments(wireGeom, wireMat);
        wireframe.quaternion.copy(quaternion);
        wireframe.position.copy(midPoint);
        this.contourGroup.add(wireframe);
      }
    }
  }

  /**
   * Interpolate color from scale.
   * Returns a pooled Color - clone if you need to keep it.
   */
  private static _poolColor = new THREE.Color();
  private interpolateColor(
    value: number,
    min: number,
    max: number,
    scale: THREE.Color[]
  ): THREE.Color {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
    const scaleIndex = t * (scale.length - 1);
    const lowIndex = Math.floor(scaleIndex);
    const highIndex = Math.min(lowIndex + 1, scale.length - 1);
    const localT = scaleIndex - lowIndex;

    StressContourRenderer._poolColor.lerpColors(scale[lowIndex], scale[highIndex], localT);
    return StressContourRenderer._poolColor;
  }

  /**
   * Create color legend
   */
  private createLegend(legendConfig: LegendConfig, contourConfig: ContourSettings): void {
    // Create legend texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Draw gradient
    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    const colorScale = ColorScales[contourConfig.colorScale];
    for (let i = 0; i < colorScale.length; i++) {
      const t = i / (colorScale.length - 1);
      const color = colorScale[i];
      gradient.addColorStop(t, `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(20, 30, 40, canvas.height - 80);

    // Draw border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 30, 40, canvas.height - 80);

    // Draw title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(legendConfig.title, 64, 20);

    // Draw tick marks and values
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    for (let i = 0; i <= legendConfig.numTicks; i++) {
      const t = i / legendConfig.numTicks;
      const y = canvas.height - 50 - t * (canvas.height - 80);
      const value = contourConfig.minValue + t * (contourConfig.maxValue - contourConfig.minValue);

      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(70, y);
      ctx.stroke();

      ctx.fillText(value.toFixed(legendConfig.precision), 75, y + 4);
    }

    // Draw unit
    ctx.fillText(legendConfig.unit, 75, canvas.height - 10);

    // Create sprite
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    this.legendSprite = new THREE.Sprite(spriteMaterial);
    this.legendSprite.scale.set(2, 8, 1);
    this.legendSprite.position.set(legendConfig.position.x, legendConfig.position.y, 0);
    
    // Note: Legend sprite should be added to a screen-space layer in actual implementation
  }

  /**
   * Get legend position based on setting
   */
  private getLegendPosition(position: string): { x: number; y: number } {
    switch (position) {
      case 'left': return { x: -20, y: 0 };
      case 'right': return { x: 20, y: 0 };
      case 'top': return { x: 0, y: 15 };
      case 'bottom': return { x: 0, y: -15 };
      default: return { x: 20, y: 0 };
    }
  }

  /**
   * Get stress type display title
   */
  private getStressTitle(type: keyof StressComponents): string {
    const titles: Record<keyof StressComponents, string> = {
      axial: 'Axial Stress',
      bendingY: 'Bending Y',
      bendingZ: 'Bending Z',
      shearY: 'Shear Y',
      shearZ: 'Shear Z',
      torsion: 'Torsion',
      vonMises: 'Von Mises',
      principal1: 'Principal σ₁',
      principal2: 'Principal σ₂',
      principal3: 'Principal σ₃'
    };
    return titles[type];
  }

  /**
   * Clear all contours
   */
  clearContours(): void {
    while (this.contourGroup.children.length > 0) {
      const child = this.contourGroup.children[0];
      this.contourGroup.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
    if (this.legendSprite) {
      if (this.legendSprite.material.map) {
        this.legendSprite.material.map.dispose();
      }
      this.legendSprite.material.dispose();
      this.legendSprite = null;
    }
  }
}

// ============================================
// UTILIZATION RATIO RENDERER
// ============================================

export class UtilizationRenderer {
  private scene: THREE.Scene;
  private utilizationGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.utilizationGroup = new THREE.Group();
    this.utilizationGroup.name = 'UtilizationRatios';
    this.scene.add(this.utilizationGroup);
  }

  /**
   * Render utilization ratios on members
   */
  renderUtilization(
    results: UtilizationResult[],
    members: Map<string, { startPos: THREE.Vector3; endPos: THREE.Vector3 }>,
    options: {
      showLabels?: boolean;
      threshold?: number;
      failColor?: THREE.Color;
      passColor?: THREE.Color;
    } = {}
  ): void {
    this.clearUtilization();

    const config = {
      showLabels: true,
      threshold: 1.0,
      failColor: new THREE.Color(0xff0000),
      passColor: new THREE.Color(0x00aa00),
      ...options
    };

    const colorScale = ColorScales.utilization;

    for (const result of results) {
      const member = members.get(result.memberId);
      if (!member) continue;

      const { startPos, endPos } = member;
      const direction = new THREE.Vector3().subVectors(endPos, startPos);
      const length = direction.length();
      const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);

      // Get color based on utilization
      const color = this.getUtilizationColor(result.demandCapacityRatio, colorScale);

      // Create member visualization
      const geometry = new THREE.CylinderGeometry(0.06, 0.06, length, 8);
      const material = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.2,
        roughness: 0.7,
        emissive: result.demandCapacityRatio > config.threshold ? config.failColor : undefined,
        emissiveIntensity: result.demandCapacityRatio > config.threshold ? 0.3 : 0
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      mesh.quaternion.copy(quaternion);
      mesh.position.copy(midPoint);

      mesh.userData = {
        type: 'utilizationMember',
        memberId: result.memberId,
        utilization: result.demandCapacityRatio,
        checkType: result.checkType,
        governing: result.governingLoadCase
      };

      this.utilizationGroup.add(mesh);

      // Add label at governing position
      if (config.showLabels) {
        const labelPos = new THREE.Vector3().lerpVectors(
          startPos,
          endPos,
          result.governingPosition
        );
        labelPos.y += 0.3; // Offset above member

        const labelGeom = new THREE.SphereGeometry(0.08);
        const labelMat = new THREE.MeshBasicMaterial({
          color: result.demandCapacityRatio > config.threshold ? 0xff0000 : 0x00ff00
        });
        const label = new THREE.Mesh(labelGeom, labelMat);
        label.position.copy(labelPos);
        label.userData = {
          type: 'utilizationLabel',
          value: (result.demandCapacityRatio * 100).toFixed(1) + '%',
          memberId: result.memberId
        };
        this.utilizationGroup.add(label);
      }
    }
  }

  /**
   * Get color for utilization ratio
   */
  private getUtilizationColor(ratio: number, scale: THREE.Color[]): THREE.Color {
    // Map ratio to color scale (0% -> green, 100%+ -> red)
    const t = Math.min(ratio, 1.2) / 1.2; // Cap at 120%
    const scaleIndex = t * (scale.length - 1);
    const lowIndex = Math.floor(scaleIndex);
    const highIndex = Math.min(lowIndex + 1, scale.length - 1);
    const localT = scaleIndex - lowIndex;

    const color = new THREE.Color();
    color.lerpColors(scale[lowIndex], scale[highIndex], localT);
    return color;
  }

  /**
   * Clear utilization visualization
   */
  clearUtilization(): void {
    while (this.utilizationGroup.children.length > 0) {
      const child = this.utilizationGroup.children[0];
      this.utilizationGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }
}

// ============================================
// MODE SHAPE ANIMATOR
// ============================================

export class ModeShapeAnimator {
  private scene: THREE.Scene;
  private modeGroup: THREE.Group;
  private originalPositions: Map<string, THREE.Vector3> = new Map();
  private animationId: number = 0;
  private currentPhase: number = 0;

  // Pre-allocated vectors to avoid per-frame GC pressure
  private readonly _startPos = new THREE.Vector3();
  private readonly _endPos = new THREE.Vector3();
  private readonly _direction = new THREE.Vector3();
  private readonly _midPoint = new THREE.Vector3();
  private readonly _quaternion = new THREE.Quaternion();
  private static readonly _UP = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.modeGroup = new THREE.Group();
    this.modeGroup.name = 'ModeShapeAnimation';
    this.scene.add(this.modeGroup);
  }

  /**
   * Setup mode shape visualization
   */
  setupModeShape(
    modeResult: ModeShapeResult,
    members: Map<string, { startNode: string; endNode: string; mesh: THREE.Mesh }>,
    nodes: Map<string, THREE.Vector3>,
    scale: number = 10
  ): void {
    this.clearModeShape();

    // Store original positions
    for (const [nodeId, position] of nodes) {
      this.originalPositions.set(nodeId, position.clone());
    }

    // Create mode shape geometry
    for (const [memberId, member] of members) {
      const startOriginal = this.originalPositions.get(member.startNode);
      const endOriginal = this.originalPositions.get(member.endNode);
      const startDisp = modeResult.nodeDisplacements.get(member.startNode);
      const endDisp = modeResult.nodeDisplacements.get(member.endNode);

      if (!startOriginal || !endOriginal || !startDisp || !endDisp) continue;

      // Create animated member
      const geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
      const material = new THREE.MeshStandardMaterial({
        color: 0x4488ff,
        metalness: 0.3,
        roughness: 0.6
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = {
        memberId,
        startNode: member.startNode,
        endNode: member.endNode,
        startOriginal: startOriginal.clone(),
        endOriginal: endOriginal.clone(),
        startDisp: startDisp.clone().multiplyScalar(scale),
        endDisp: endDisp.clone().multiplyScalar(scale)
      };

      this.modeGroup.add(mesh);
    }

    // Add mode info
    console.log(`Mode ${modeResult.modeNumber}: f=${modeResult.frequency.toFixed(2)} Hz, T=${modeResult.period.toFixed(3)} s`);
    console.log(`Mass participation: X=${(modeResult.massParticipation.x * 100).toFixed(1)}%, Y=${(modeResult.massParticipation.y * 100).toFixed(1)}%, Z=${(modeResult.massParticipation.z * 100).toFixed(1)}%`);
  }

  /**
   * Start animation
   */
  startAnimation(speed: number = 1): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const animate = () => {
      this.currentPhase += 0.03 * speed;
      const factor = Math.sin(this.currentPhase);

      // Update member positions using pre-allocated vectors
      this.modeGroup.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.memberId) {
          const data = child.userData;
          
          // Calculate displaced positions using pre-allocated vectors
          this._startPos.copy(data.startOriginal);
          this._startPos.addScaledVector(data.startDisp, factor);

          this._endPos.copy(data.endOriginal);
          this._endPos.addScaledVector(data.endDisp, factor);

          // Update mesh
          this._direction.subVectors(this._endPos, this._startPos);
          const length = this._direction.length();
          this._midPoint.addVectors(this._startPos, this._endPos).multiplyScalar(0.5);

          child.scale.y = length;
          child.position.copy(this._midPoint);
          
          this._direction.normalize();
          this._quaternion.setFromUnitVectors(ModeShapeAnimator._UP, this._direction);
          child.quaternion.copy(this._quaternion);
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
   * Set animation phase (for manual control)
   */
  setPhase(phase: number): void {
    this.currentPhase = phase;
    
    const factor = Math.sin(this.currentPhase);
    
    this.modeGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.memberId) {
        const data = child.userData;
        
        this._startPos.copy(data.startOriginal);
        this._startPos.addScaledVector(data.startDisp, factor);

        this._endPos.copy(data.endOriginal);
        this._endPos.addScaledVector(data.endDisp, factor);

        this._direction.subVectors(this._endPos, this._startPos);
        const length = this._direction.length();
        this._midPoint.addVectors(this._startPos, this._endPos).multiplyScalar(0.5);

        child.scale.y = length;
        child.position.copy(this._midPoint);
        
        this._direction.normalize();
        this._quaternion.setFromUnitVectors(ModeShapeAnimator._UP, this._direction);
        child.quaternion.copy(this._quaternion);
      }
    });
  }

  /**
   * Clear mode shape
   */
  clearModeShape(): void {
    this.stopAnimation();
    
    while (this.modeGroup.children.length > 0) {
      const child = this.modeGroup.children[0];
      this.modeGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    
    this.originalPositions.clear();
    this.currentPhase = 0;
  }
}

// ============================================
// RESULT TABLE GENERATOR
// ============================================

export class ResultTableGenerator {
  /**
   * Generate HTML table for node displacements
   */
  static generateDisplacementTable(
    displacements: Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>
  ): string {
    let html = `
      <table class="result-table">
        <thead>
          <tr>
            <th>Node</th>
            <th>dx (mm)</th>
            <th>dy (mm)</th>
            <th>dz (mm)</th>
            <th>rx (rad)</th>
            <th>ry (rad)</th>
            <th>rz (rad)</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const [nodeId, disp] of displacements) {
      html += `
        <tr>
          <td>${nodeId}</td>
          <td>${disp.dx.toFixed(3)}</td>
          <td>${disp.dy.toFixed(3)}</td>
          <td>${disp.dz.toFixed(3)}</td>
          <td>${disp.rx.toExponential(3)}</td>
          <td>${disp.ry.toExponential(3)}</td>
          <td>${disp.rz.toExponential(3)}</td>
        </tr>
      `;
    }

    html += '</tbody></table>';
    return html;
  }

  /**
   * Generate HTML table for member forces
   */
  static generateMemberForcesTable(
    forces: Array<{
      memberId: string;
      position: string;
      axial: number;
      shearY: number;
      shearZ: number;
      torsion: number;
      momentY: number;
      momentZ: number;
    }>
  ): string {
    let html = `
      <table class="result-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Position</th>
            <th>P (kN)</th>
            <th>Vy (kN)</th>
            <th>Vz (kN)</th>
            <th>T (kN·m)</th>
            <th>My (kN·m)</th>
            <th>Mz (kN·m)</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const f of forces) {
      html += `
        <tr>
          <td>${f.memberId}</td>
          <td>${f.position}</td>
          <td class="${f.axial < 0 ? 'compression' : 'tension'}">${f.axial.toFixed(2)}</td>
          <td>${f.shearY.toFixed(2)}</td>
          <td>${f.shearZ.toFixed(2)}</td>
          <td>${f.torsion.toFixed(2)}</td>
          <td>${f.momentY.toFixed(2)}</td>
          <td>${f.momentZ.toFixed(2)}</td>
        </tr>
      `;
    }

    html += '</tbody></table>';
    return html;
  }

  /**
   * Generate HTML table for reactions
   */
  static generateReactionsTable(
    reactions: Array<{
      nodeId: string;
      fx: number;
      fy: number;
      fz: number;
      mx: number;
      my: number;
      mz: number;
    }>
  ): string {
    let html = `
      <table class="result-table">
        <thead>
          <tr>
            <th>Node</th>
            <th>Fx (kN)</th>
            <th>Fy (kN)</th>
            <th>Fz (kN)</th>
            <th>Mx (kN·m)</th>
            <th>My (kN·m)</th>
            <th>Mz (kN·m)</th>
          </tr>
        </thead>
        <tbody>
    `;

    let sumFx = 0, sumFy = 0, sumFz = 0;

    for (const r of reactions) {
      sumFx += r.fx;
      sumFy += r.fy;
      sumFz += r.fz;

      html += `
        <tr>
          <td>${r.nodeId}</td>
          <td>${r.fx.toFixed(2)}</td>
          <td>${r.fy.toFixed(2)}</td>
          <td>${r.fz.toFixed(2)}</td>
          <td>${r.mx.toFixed(2)}</td>
          <td>${r.my.toFixed(2)}</td>
          <td>${r.mz.toFixed(2)}</td>
        </tr>
      `;
    }

    html += `
      <tr class="total-row">
        <td><strong>Total</strong></td>
        <td><strong>${sumFx.toFixed(2)}</strong></td>
        <td><strong>${sumFy.toFixed(2)}</strong></td>
        <td><strong>${sumFz.toFixed(2)}</strong></td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
      </tr>
    `;

    html += '</tbody></table>';
    return html;
  }

  /**
   * Generate HTML table for utilization summary
   */
  static generateUtilizationSummaryTable(
    results: UtilizationResult[]
  ): string {
    // Sort by utilization ratio (highest first)
    const sorted = [...results].sort((a, b) => b.demandCapacityRatio - a.demandCapacityRatio);

    let html = `
      <table class="result-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Check Type</th>
            <th>D/C Ratio</th>
            <th>Status</th>
            <th>Governing LC</th>
            <th>Code Ref.</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const r of sorted) {
      const status = r.demandCapacityRatio <= 1.0 ? 'PASS' : 'FAIL';
      const statusClass = r.demandCapacityRatio <= 1.0 ? 'pass' : 'fail';
      const ratioClass = r.demandCapacityRatio > 1.0 ? 'over-utilization' : 
                         r.demandCapacityRatio > 0.9 ? 'high-utilization' : 'normal';

      html += `
        <tr>
          <td>${r.memberId}</td>
          <td>${r.checkType.replace(/_/g, ' ')}</td>
          <td class="${ratioClass}">${(r.demandCapacityRatio * 100).toFixed(1)}%</td>
          <td class="${statusClass}">${status}</td>
          <td>${r.governingLoadCase}</td>
          <td>${r.details.codeReference}</td>
        </tr>
      `;
    }

    html += '</tbody></table>';
    return html;
  }
}

// All classes are exported with 'export class' declarations above
